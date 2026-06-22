"""Document upload and ingestion endpoint.

Ingests a single inspection-report PDF end to end by composing the existing
core functions: ingest_pdf (text extraction + documents row), extract (LLM
defect extraction), scoring (risk recompute), and rag (vector-index reindex).

The whole pipeline runs under one module-level lock so concurrent uploads
serialize. This avoids SQLite write races and a double vector-index reindex when
two requests arrive at once. The corpus is small, so a synchronous endpoint is fine.
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

# Serializes the full ingest pipeline (DB writes + vector-index reindex) across requests.
_INGEST_LOCK = threading.Lock()

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")

# Cap on uploaded PDFs, so a single request cannot read an unbounded blob into memory.
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


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
    registry_source_id: str | None = Form(None),
    force: bool = Form(False),
    conn=Depends(get_conn),
):
    """Ingest one uploaded PDF: extract text, defects, rescore, and reindex.

    Target one of three ways: an existing building via building_id, a public-registry
    building via registry_source_id (real footprint/height/coordinates), or a brand
    new building via a non-empty name. Returns a summary of what the pipeline produced.
    """
    # Lazy imports: keep startup light and avoid loading heavy deps (llama-index,
    # sentence-transformers, pdfplumber) until an ingest actually happens.
    from buildinglens import dedup, extract, geocode, ingest_pdf, ingest_structured, rag, scoring
    from buildinglens.llm import get_llm

    # --- Validate the request shape ---
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF (.pdf).")

    clean_name = (name or "").strip()
    clean_registry_id = (registry_source_id or "").strip()
    if building_id is None and not clean_registry_id and not clean_name:
        raise HTTPException(
            status_code=400,
            detail="Provide building_id to attach the report, a registry_source_id to add a registry building, or a non-empty name to create one.",
        )

    # Reject oversized uploads before reading the whole file into memory.
    if file.size is not None and file.size > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF is too large (maximum 20 MB).")

    # Read the upload bytes before taking the lock (I/O that needs no DB).
    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="PDF is too large (maximum 20 MB).")

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
        # Close matches surfaced to the caller (new-building path only); stays empty
        # when attaching to an existing building or importing a registry building.
        possible_duplicates: list = []
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
            elif clean_registry_id:
                # Materialize a public-registry building with its real footprint,
                # height and coordinates (name/address synthetic).
                cand = ingest_structured.find_candidate(clean_registry_id)
                if cand is None:
                    raise HTTPException(status_code=404, detail="Registry building not found.")
                # Under the ingest lock, so this read-then-insert is atomic and closes
                # the window for importing the same registry building twice.
                if conn.execute(
                    "SELECT 1 FROM buildings WHERE source_id = ?",
                    (cand.get("source_id"),),
                ).fetchone() is not None:
                    raise HTTPException(
                        status_code=409,
                        detail="This registry building has already been imported.",
                    )
                cur = conn.execute(
                    "INSERT INTO buildings "
                    "(source_id, name, address, year_built, height_m, latitude, longitude, source, commune, "
                    "use_type, use_subtype, floors, footprint_area_m2, type_confidence) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        cand.get("source_id"),
                        cand.get("name"),
                        cand.get("address"),
                        cand.get("year_built"),
                        cand.get("height_m"),
                        cand.get("latitude"),
                        cand.get("longitude"),
                        cand.get("source"),
                        cand.get("commune"),
                        cand.get("use_type"),
                        cand.get("use_subtype"),
                        cand.get("floors"),
                        cand.get("footprint_area_m2"),
                        cand.get("type_confidence"),
                    ),
                )
                conn.commit()
                target_building_id = int(cur.lastrowid)
                created_building_id = target_building_id
                building_name = cand.get("name") or f"Building {target_building_id}"
            else:
                # New building. If an address is given, geocode it and snap to the
                # real EUBUCCO footprint at that point, so the dossier gets a real
                # location, footprint and height. The typed name and address are
                # kept (they come from the report); only the geometry is EUBUCCO.
                # Falls back to a name-only record when geocoding or the match fails.
                addr = (address or "").strip()
                coords = geocode.geocode_lu(addr) if addr else None
                matched = (
                    ingest_structured.find_building_at_point(coords[0], coords[1])
                    if coords is not None
                    else None
                )

                # Guardrail: before creating a building, check whether an equivalent
                # already exists. Same EUBUCCO footprint + same name + same address is
                # a near-certain duplicate (this is how ids 43/44 appeared), so we block
                # it unless the caller forces the import. Softer matches (same footprint
                # under a different name, a similar name, a nearby footprint) are surfaced
                # but never block. Running here, before the expensive extraction/reindex,
                # means a blocked duplicate costs nothing. The SELECT runs under the
                # ingest lock so a concurrent double-submit cannot slip a second copy in.
                candidate = {
                    "name": clean_name,
                    "address": addr or None,
                    "source_id": matched.get("source_id") if matched else None,
                    "latitude": matched.get("latitude") if matched else None,
                    "longitude": matched.get("longitude") if matched else None,
                    "height_m": matched.get("height_m") if matched else None,
                    "footprint_area_m2": matched.get("footprint_area_m2") if matched else None,
                }
                existing_rows = conn.execute(
                    "SELECT id, name, address, commune, source, source_id, risk_score, "
                    "latitude, longitude, height_m, footprint_area_m2 FROM buildings"
                ).fetchall()
                blocked, possible_duplicates = dedup.find_duplicates(
                    candidate, [dict(r) for r in existing_rows]
                )
                if blocked and not force:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "duplicate_building",
                            "message": (
                                "A building with the same footprint and name is already "
                                "in the portfolio. Review it, or import anyway."
                            ),
                            "force_param": "force",
                            "matched_source_id": candidate["source_id"],
                            "candidates": possible_duplicates,
                        },
                    )

                if matched is not None:
                    cur = conn.execute(
                        "INSERT INTO buildings "
                        "(source_id, name, address, year_built, height_m, latitude, longitude, source, commune, "
                        "use_type, use_subtype, floors, footprint_area_m2, type_confidence) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (
                            matched.get("source_id"),
                            clean_name,
                            addr or None,
                            matched.get("year_built"),
                            matched.get("height_m"),
                            matched.get("latitude"),
                            matched.get("longitude"),
                            matched.get("source"),
                            matched.get("commune"),
                            matched.get("use_type"),
                            matched.get("use_subtype"),
                            matched.get("floors"),
                            matched.get("footprint_area_m2"),
                            matched.get("type_confidence"),
                        ),
                    )
                else:
                    cur = conn.execute(
                        "INSERT INTO buildings (name, address, source) VALUES (?, ?, ?)",
                        (clean_name, addr or None, "upload"),
                    )
                conn.commit()
                target_building_id = int(cur.lastrowid)
                created_building_id = target_building_id
                building_name = clean_name

            # --- Extract text and insert the documents row ---
            try:
                doc_ids = ingest_pdf.ingest_reports(conn, [(target_building_id, saved_path)])
            except HTTPException:
                raise
            except Exception as exc:
                # A malformed or non-PDF file surfaces here as a parser error; report
                # it as a client error rather than a 500.
                raise HTTPException(
                    status_code=400,
                    detail="Could not read the uploaded PDF; it may be corrupt or not a valid PDF file.",
                ) from exc
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

            # --- Rebuild the vector index explicitly (answer() only auto-builds when
            # the index is missing, so a fresh document would otherwise be unseen). ---
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
        "possible_duplicates": possible_duplicates,
    }
