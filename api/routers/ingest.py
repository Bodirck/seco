"""Document upload and ingestion endpoint.

Ingests a single inspection-report PDF end to end by composing the existing
core functions: ingest_pdf (text extraction + documents row), extract (LLM
defect extraction), scoring (risk recompute), and rag (FAISS reindex).

The whole pipeline runs under one module-level lock so concurrent uploads
serialize. This avoids SQLite write races and a double FAISS reindex when two
requests arrive at once. The corpus is small, so a synchronous endpoint is fine.
"""

from __future__ import annotations

import re
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from buildinglens.config import settings

from ..deps import get_conn

router = APIRouter(tags=["ingest"])

# Serializes the full ingest pipeline (DB writes + FAISS reindex) across requests.
_INGEST_LOCK = threading.Lock()

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_unique_name(original: str) -> str:
    """Build a collision-free filesystem name from an uploaded file name.

    Keeps the original stem (sanitised to a conservative character set) for
    readability and prepends a short uuid so repeated uploads never clobber
    each other. Always ends in .pdf.
    """
    stem = Path(original or "upload").stem
    stem = _SAFE_NAME.sub("_", stem).strip("._") or "upload"
    return f"{uuid.uuid4().hex[:8]}_{stem}.pdf"


@router.post("/ingest")
def ingest(
    file: UploadFile = File(...),
    building_id: int | None = Form(None),
    name: str | None = Form(None),
    address: str | None = Form(None),
    conn=Depends(get_conn),
):
    """Ingest one uploaded PDF: extract text, defects, rescore, and reindex.

    Attach to an existing building via building_id, or create a new building by
    passing a non-empty name. Returns a summary of what the pipeline produced.
    """
    # Lazy imports: keep startup light and avoid loading heavy deps (faiss,
    # sentence-transformers, pdfplumber) until an ingest actually happens.
    from buildinglens import extract, ingest_pdf, rag, scoring
    from buildinglens.llm import get_llm

    # --- Validate the request shape ---
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF (.pdf).")

    clean_name = (name or "").strip()
    if building_id is None and not clean_name:
        raise HTTPException(
            status_code=400,
            detail="Provide building_id to attach the report, or a non-empty name to create a building.",
        )

    # Read the upload bytes before taking the lock (I/O that needs no DB).
    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with _INGEST_LOCK:
        # --- Save the upload under the configured data root ---
        uploads_dir = settings.db_path.parent / "raw" / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        saved_path = uploads_dir / _safe_unique_name(filename)
        saved_path.write_bytes(data)

        # Track what this request created so a partial failure leaves nothing
        # behind (no orphan building polluting the portfolio, no stray file/doc).
        created_building_id: int | None = None
        document_id: int | None = None
        try:
            # --- Resolve the target building ---
            if building_id is not None:
                row = conn.execute(
                    "SELECT id, name FROM buildings WHERE id = ?", (building_id,)
                ).fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Building not found")
                target_building_id = int(row["id"])
                building_name = row["name"] or f"Building {target_building_id}"
            else:
                cur = conn.execute(
                    "INSERT INTO buildings (name, address, source) VALUES (?, ?, ?)",
                    (clean_name, (address or "").strip() or None, "upload"),
                )
                conn.commit()
                target_building_id = int(cur.lastrowid)
                created_building_id = target_building_id
                building_name = clean_name

            # --- Extract text and insert the documents row ---
            doc_ids = ingest_pdf.ingest_reports(conn, [(target_building_id, saved_path)])
            if not doc_ids:
                raise HTTPException(
                    status_code=400,
                    detail="Could not extract any text from the uploaded PDF.",
                )
            document_id = doc_ids[0]

            # --- LLM defect extraction (mock-safe) ---
            client = get_llm()
            is_mock = type(client).__name__ == "MockClient"
            defect_ids = extract.extract_for_document(conn, document_id, client=client)
            defects_extracted = len(defect_ids)

            # --- Recompute risk scores and read back this building's score ---
            scoring.compute_scores(conn)
            score_row = conn.execute(
                "SELECT risk_score FROM buildings WHERE id = ?", (target_building_id,)
            ).fetchone()
            new_risk_score = round(float(score_row["risk_score"] or 0.0), 2)

            # --- Rebuild the FAISS index explicitly (answer() only auto-builds when
            # the index file is missing, so a fresh document would otherwise be unseen). ---
            chunks_indexed = rag.build_index(conn)
        except BaseException:
            # Undo a partial ingest: drop a building we created (and anything
            # attached to it), or just the document row when attaching to an
            # existing building, then remove the saved file. Then re-raise.
            if created_building_id is not None:
                conn.execute("DELETE FROM defects WHERE building_id = ?", (created_building_id,))
                conn.execute("DELETE FROM documents WHERE building_id = ?", (created_building_id,))
                conn.execute("DELETE FROM buildings WHERE id = ?", (created_building_id,))
                conn.commit()
            elif document_id is not None:
                conn.execute("DELETE FROM defects WHERE document_id = ?", (document_id,))
                conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
                conn.commit()
            try:
                saved_path.unlink(missing_ok=True)
            except OSError:
                pass
            raise

    if is_mock:
        message = (
            f"Ingested '{building_name}': document stored and indexed "
            f"({chunks_indexed} chunks). No defects were extracted because the "
            f"active LLM client is mock (offline). Configure a provider and API "
            f"key to extract defects."
        )
    else:
        message = (
            f"Ingested '{building_name}': {defects_extracted} defect(s) extracted, "
            f"risk score {new_risk_score}, {chunks_indexed} chunks indexed."
        )

    return {
        "document_id": document_id,
        "building_id": target_building_id,
        "building_name": building_name,
        "defects_extracted": defects_extracted,
        "new_risk_score": new_risk_score,
        "chunks_indexed": chunks_indexed,
        "mock": is_mock,
        "message": message,
    }
