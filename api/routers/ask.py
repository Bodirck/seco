"""RAG question-answering endpoints (non-streaming and streaming)."""

from __future__ import annotations

import json
from typing import Iterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from buildinglens import rag

from ..deps import get_conn

router = APIRouter(tags=["ask"])


class Turn(BaseModel):
    question: str
    answer: str


class AskBody(BaseModel):
    question: str
    building_id: int | None = None
    # Portfolio scope: a non-empty list restricts retrieval to those buildings;
    # an empty list means "filters matched nothing" and yields a friendly answer.
    building_ids: list[int] | None = None
    # Prior conversation turns, used only to help resolve a follow-up question.
    history: list[Turn] = []


@router.post("/ask")
def ask(body: AskBody, conn=Depends(get_conn)):
    """Answer a question from the inspection reports, with cited sources."""
    return rag.answer(
        body.question,
        conn,
        building_id=body.building_id,
        building_ids=body.building_ids,
        history=[t.model_dump() for t in body.history],
    )


@router.post("/ask/stream")
def ask_stream(body: AskBody, conn=Depends(get_conn)):
    """Stream the answer as newline-delimited JSON frames.

    Frames, in order: one {"type": "sources", ...}, then zero or more
    {"type": "delta", "text": ...}, then one {"type": "done"} (or
    {"type": "error", "message": ...} if generation fails after retrieval).
    Carries the same scope and history fields as /ask; the legacy /ask stays
    untouched for the building-page AskBar.
    """
    history = [t.model_dump() for t in body.history]

    def _ndjson() -> Iterator[str]:
        # The per-request connection from get_conn stays open while Starlette
        # consumes this generator, so retrieval inside answer_stream is safe.
        for event in rag.answer_stream(
            body.question,
            conn,
            building_id=body.building_id,
            building_ids=body.building_ids,
            history=history,
        ):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        _ndjson(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
