"""Bounded, region-based edits; the source PDF is never overwritten."""
import base64
import math
import threading

MAX_PDF_BYTES = 4 * 1024 * 1024
PDF_LOCK = threading.Lock()
FONTS = {"helv", "hebo", "heit", "tiro", "tibo", "cour"}


class PDFEditError(Exception):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


def _library():
    try:
        import pymupdf
        return pymupdf
    except ImportError:
        raise PDFEditError("Install the updated matching-service requirements and restart with npm run dev:matching.", 503) from None


def _open(encoded):
    pdf = _library()
    try:
        data = base64.b64decode(encoded, validate=True)
        if not data.startswith(b"%PDF-") or len(data) > MAX_PDF_BYTES:
            raise PDFEditError("Use a valid PDF no larger than 4 MB.")
        doc = pdf.open(stream=data, filetype="pdf")
    except PDFEditError:
        raise
    except Exception:
        raise PDFEditError("Could not read this PDF.") from None
    if doc.needs_pass or not 1 <= doc.page_count <= 10 or doc.get_sigflags() > 0:
        doc.close()
        raise PDFEditError("Editing supports unlocked, unsigned PDFs with 1–10 pages.")
    return doc


def _blocks(page):
    blocks = []
    document_blocks = page.get_text("dict")["blocks"]
    pdf = _library()
    image_areas = [pdf.Rect(block["bbox"]) for block in document_blocks if block.get("type") == 1]
    for index, block in enumerate(document_blocks):
        if block.get("type") != 0:
            continue
        lines = block.get("lines", [])
        spans = [span for line in lines for span in line.get("spans", [])]
        if not spans:
            continue
        first = spans[0]
        text = "\n".join("".join(span["text"] for span in line.get("spans", [])) for line in lines).strip()
        if not text:
            continue
        original_font = first.get("font", "Helvetica")
        lower_font = original_font.lower()
        font = "cour" if "courier" in lower_font else "tibo" if "times" in lower_font and "bold" in lower_font else "tiro" if "times" in lower_font else "hebo" if "bold" in lower_font else "heit" if "italic" in lower_font or "oblique" in lower_font else "helv"
        blocks.append({"id": index, "text": text, "bbox": list(block["bbox"]), "font": font,
                       "font_size": round(float(first.get("size", 11)), 2), "original_font": original_font,
                       "color": int(first.get("color", 0)),
                       "editable": page.rotation == 0 and all(tuple(line.get("dir", (1, 0))) == (1, 0) for line in lines)
                       and not any((pdf.Rect(block["bbox"]) & image).get_area() > 1 for image in image_areas)})
    return blocks


def inspect_pdf(encoded, page_number):
    # MuPDF operations are serialized; its native library is not thread-safe.
    with PDF_LOCK, _open(encoded) as doc:
        if not 0 <= page_number < doc.page_count:
            raise PDFEditError("PDF page not found.", 404)
        page = doc[page_number]
        if not 0 < page.rect.width <= 2000 or not 0 < page.rect.height <= 3000:
            raise PDFEditError("This page size is not supported by the CV editor.")
        scale = min(800 / page.rect.width, 1100 / page.rect.height, 1.5)
        pixmap = page.get_pixmap(matrix=_library().Matrix(scale, scale), alpha=False)
        image = pixmap.tobytes("png")
        if len(image) > 2700000:
            raise PDFEditError("The PDF preview is too large. Use a simpler text-based CV.")
        return {"page": page_number, "page_count": doc.page_count, "width": page.rect.width, "height": page.rect.height,
                "image": "data:image/png;base64," + base64.b64encode(image).decode(),
                "blocks": _blocks(page)[:200], "rotated": page.rotation != 0}


def edit_pdf(encoded, edits):
    pdf = _library()
    with PDF_LOCK, _open(encoded) as doc:
        seen = set()
        prepared = []
        for edit in edits:
            page_number, block_id = edit["page"], edit["block_id"]
            if (page_number, block_id) in seen:
                raise PDFEditError("A text block can only be edited once per preview.")
            seen.add((page_number, block_id))
            if not 0 <= page_number < doc.page_count:
                raise PDFEditError("PDF page not found.", 404)
            page = doc[page_number]
            blocks = _blocks(page)
            block = next((item for item in blocks if item["id"] == block_id), None)
            if not block or not block["editable"]:
                raise PDFEditError("Choose an upright, horizontal text block. Scanned/rotated text is not editable.")
            rect = pdf.Rect(block["bbox"])
            if not rect.is_valid or rect.is_empty or not page.rect.contains(rect):
                raise PDFEditError("This text block has unsupported page geometry.")
            if any(other["id"] != block_id and (rect & pdf.Rect(other["bbox"])).get_area() > 1 for other in blocks):
                raise PDFEditError("Overlapping text blocks cannot be edited safely without changing nearby text.")
            text = edit["text"]
            font, size = edit["font"], float(edit["font_size"])
            if font not in FONTS or not math.isfinite(size) or not 6 <= size <= 48 or not text.strip() or len(text) > 4000:
                raise PDFEditError("Choose valid text, a standard font, and a font size from 6 to 48.")
            punctuation = {0x2022, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026}
            if any(ord(character) > 0x024F and ord(character) not in punctuation for character in text):
                raise PDFEditError("Replacement text currently supports Latin text only. Custom/Unicode fonts need a separate font workflow.")
            embedded_font = pdf.Font(font)
            if any(not character.isspace() and not embedded_font.has_glyph(ord(character), fallback=False) for character in text):
                raise PDFEditError("The selected replacement font does not contain every character.")
            alias = f"cv-edit-{font}"
            page.insert_font(fontname=alias, fontbuffer=embedded_font.buffer)
            color = tuple(((block["color"] >> shift) & 255) / 255 for shift in (16, 8, 0))
            # Dry-run the layout before any redaction is applied.
            shape = page.new_shape()
            remaining = shape.insert_textbox(rect, text, fontname=alias, fontsize=size, color=color)
            if remaining < -0.001:
                raise PDFEditError("Replacement text does not fit the original area. Shorten it or choose a smaller font; no PDF was saved.")
            prepared.append((page_number, rect, text, font, size, color))
        for page_number in sorted({item[0] for item in prepared}):
            page = doc[page_number]
            changes = [item for item in prepared if item[0] == page_number]
            for _, rect, *_ in changes:
                page.add_redact_annot(rect, fill=False, cross_out=False)
            # Remove original text, retaining images, drawings, and background.
            page.apply_redactions(images=0, graphics=0, text=0)
            for _, rect, text, font, size, color in changes:
                alias = f"cv-edit-{font}"
                page.insert_font(fontname=alias, fontbuffer=pdf.Font(font).buffer)
                if page.insert_textbox(rect, text, fontname=alias, fontsize=size, color=color) < -0.001:
                    raise PDFEditError("Replacement text could not be placed. No PDF was saved.")
        result = doc.tobytes(garbage=4, deflate=True)
        if len(result) > MAX_PDF_BYTES:
            raise PDFEditError("The edited PDF exceeds the 4 MB CV limit.")
        return result
