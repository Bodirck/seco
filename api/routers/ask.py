"""RAG question-answering endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from buildinglens import rag

from ..deps import get_conn

router = APIRouter(tags=["ask"])


class AskBody(BaseModel):
    question: str
    building_id: int | None = None


@router.post("/ask")
def ask(body: AskBody, conn=Depends(get_conn)):
    """Answer a question from the inspection reports, with cited sources."""
    return rag.answer(body.question, conn, building_id=body.building_id)
