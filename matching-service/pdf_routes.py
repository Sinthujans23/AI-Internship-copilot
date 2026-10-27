from typing import Literal
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from pdf_editing import PDFEditError, inspect_pdf, edit_pdf

router = APIRouter(prefix="/pdf", tags=["PDF editor"])


class PDFInput(BaseModel):
    pdf_base64: str = Field(min_length=1, max_length=5600000)


class InspectInput(PDFInput):
    page: int = Field(default=0, ge=0, le=9)


class EditBlock(BaseModel):
    page: int = Field(ge=0, le=9)
    block_id: int = Field(ge=0, le=10000)
    text: str = Field(min_length=1, max_length=4000)
    font: Literal["helv", "hebo", "heit", "tiro", "tibo", "cour"] = "helv"
    font_size: float = Field(ge=6, le=48)


class EditInput(PDFInput):
    edits: list[EditBlock] = Field(min_length=1, max_length=10)


@router.post("/inspect")
def inspect(payload: InspectInput):
    try:
        return inspect_pdf(payload.pdf_base64, payload.page)
    except PDFEditError as error:
        raise HTTPException(error.status, str(error)) from None


@router.post("/edit")
def edit(payload: EditInput):
    try:
        data = edit_pdf(payload.pdf_base64, [item.model_dump() for item in payload.edits])
        return Response(data, media_type="application/pdf", headers={"Cache-Control": "no-store"})
    except PDFEditError as error:
        raise HTTPException(error.status, str(error)) from None
