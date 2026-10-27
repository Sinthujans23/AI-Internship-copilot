import base64
import os
import unittest
from unittest.mock import patch
import pymupdf
from fastapi.testclient import TestClient
from main import app
from pdf_editing import inspect_pdf, edit_pdf, PDFEditError


def fixture():
    with pymupdf.open() as doc:
        page = doc.new_page()
        page.insert_text((50, 70), "Student CV", fontsize=18)
        page.insert_textbox(pymupdf.Rect(50, 110, 450, 170), "Built a Python API for a student project.\nUsed SQL to save application records.", fontsize=11)
        second = doc.new_page()
        second.insert_text((50, 70), "Unchanged second page", fontsize=12)
        return doc.tobytes()


class PDFEditingTests(unittest.TestCase):
    def setUp(self):
        self.original = fixture()
        self.encoded = base64.b64encode(self.original).decode()

    def change(self, text="Built a Python API.", size=10):
        data = inspect_pdf(self.encoded, 0)
        block = next(item for item in data["blocks"] if "Built a Python" in item["text"])
        return {"page": 0, "block_id": block["id"], "text": text, "font": "helv", "font_size": size}

    def test_preview_and_text_blocks(self):
        result = inspect_pdf(self.encoded, 0)
        self.assertEqual(result["page_count"], 2)
        self.assertTrue(result["image"].startswith("data:image/png;base64,"))
        self.assertTrue(any("Python API" in block["text"] for block in result["blocks"]))

    def test_original_text_removed_and_other_page_layout_preserved(self):
        edited = edit_pdf(self.encoded, [self.change()])
        with pymupdf.open(stream=self.original, filetype="pdf") as old, pymupdf.open(stream=edited, filetype="pdf") as new:
            self.assertEqual(new.page_count, old.page_count)
            self.assertEqual(new[0].rect, old[0].rect)
            self.assertIn("Built a Python API.", new[0].get_text())
            self.assertNotIn("Used SQL", new[0].get_text())
            self.assertIn("Student CV", new[0].get_text())
            heading = pymupdf.Rect(0, 0, old[0].rect.width, 95)
            self.assertEqual(old[0].get_pixmap(clip=heading).samples, new[0].get_pixmap(clip=heading).samples)
            self.assertEqual(old[1].get_pixmap().samples, new[1].get_pixmap().samples)
        self.assertEqual(base64.b64decode(self.encoded), self.original)

    def test_overflow_and_unsupported_characters_rejected(self):
        with self.assertRaisesRegex(PDFEditError, "does not fit"):
            edit_pdf(self.encoded, [self.change("Very long replacement text " * 80, 16)])
        with self.assertRaisesRegex(PDFEditError, "Latin"):
            edit_pdf(self.encoded, [self.change("தமிழ்")])

    def test_common_cv_punctuation_is_preserved(self):
        text = "\u2022 Python API \u2013 student project"
        edited = edit_pdf(self.encoded, [self.change(text)])
        with pymupdf.open(stream=edited, filetype="pdf") as doc:
            self.assertIn(text, doc[0].get_text())

    def test_text_over_a_scanned_image_is_not_editable(self):
        with pymupdf.open(stream=self.original, filetype="pdf") as doc:
            page = doc[0]
            image = page.get_pixmap()
            page.insert_image(page.rect, pixmap=image)
            encoded = base64.b64encode(doc.tobytes()).decode()
        result = inspect_pdf(encoded, 0)
        self.assertTrue(result["blocks"])
        self.assertTrue(all(not block["editable"] for block in result["blocks"]))

    def test_bad_page_duplicate_and_invalid_pdf_rejected(self):
        with self.assertRaises(PDFEditError):
            inspect_pdf(base64.b64encode(b"not a pdf").decode(), 0)
        with self.assertRaises(PDFEditError):
            inspect_pdf(self.encoded, 9)
        edit = self.change()
        with self.assertRaisesRegex(PDFEditError, "once"):
            edit_pdf(self.encoded, [edit, edit])

    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only-key"})
    def test_pdf_endpoints_need_service_key(self):
        client = TestClient(app)
        self.assertEqual(client.post("/pdf/inspect", json={"pdf_base64": self.encoded}).status_code, 401)
        response = client.post("/pdf/inspect", headers={"X-API-Key": "test-only-key"}, json={"pdf_base64": self.encoded})
        self.assertEqual(response.status_code, 200)
        changed = client.post("/pdf/edit", headers={"X-API-Key": "test-only-key"}, json={"pdf_base64": self.encoded, "edits": [self.change()]})
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.headers["content-type"], "application/pdf")


if __name__ == "__main__":
    unittest.main()
