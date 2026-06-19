"""WP1 orchestration: build the BuildingLens database from scratch.

Steps:
  1. Reset the SQLite schema (clean rebuild).
  2. Ingest real building footprints from EUBUCCO Luxembourg (synthetic fallback offline).
  3. Cache STATEC building-permit statistics as sector context (not per-building).
  4. Generate one synthetic inspection report (PDF) per building.
  5. Ingest those PDFs into the documents table.

Run with `make data` or `python -m buildinglens.pipeline`.
Defect extraction and scoring (WP2) and the RAG index (WP3) build on top of this.
"""

from __future__ import annotations

from pathlib import Path

from . import db
from .config import settings
from .ingest_pdf import ingest_reports
from .ingest_structured import ingest_buildings
from .statec import cache_permits
from .synthetic_reports import generate_reports

REPORTS_DIR = settings.db_path.parent / "raw" / "reports"


def run(sample_size: int = 40, seed: int = 0) -> dict[str, int]:
    """Build the database end to end and return row counts."""
    print(f"[1/5] Resetting database at {settings.db_path}")
    conn = db.connect(settings.db_path)
    db.reset(conn)

    print(f"[2/5] Ingesting up to {sample_size} buildings from EUBUCCO Luxembourg")
    building_ids = ingest_buildings(conn, sample_size=sample_size, seed=seed)
    total = conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0]
    resolved = conn.execute(
        "SELECT COUNT(*) FROM buildings WHERE commune IS NOT NULL"
    ).fetchone()[0]
    pct = (100 * resolved / total) if total else 0.0
    print(f"      commune resolved for {resolved}/{total} buildings ({pct:.1f}%)")

    print("[3/5] Caching STATEC building-permit statistics (sector context)")
    try:
        permits_csv = cache_permits()
        print(f"      permits cached at {permits_csv}")
    except Exception as exc:  # never let context fetching break the build
        print(f"      skipped permits cache: {exc}")

    print(f"[4/5] Generating synthetic inspection reports into {REPORTS_DIR}")
    rows = conn.execute(
        "SELECT id, name, address, year_built, height_m FROM buildings"
    ).fetchall()
    buildings = [dict(r) for r in rows]
    items = generate_reports(buildings, REPORTS_DIR, seed=seed)

    print("[5/5] Ingesting report PDFs into the documents table")
    doc_ids = ingest_reports(conn, items)

    counts = {
        "buildings": conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0],
        "documents": conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
        "defects": conn.execute("SELECT COUNT(*) FROM defects").fetchone()[0],
    }
    conn.close()

    print(
        "\nDone. "
        f"{counts['buildings']} buildings, {counts['documents']} documents, "
        f"{counts['defects']} defects (defects are populated by WP2)."
    )
    print("Next: `make eval` once extraction lands, then `make run` for the UI.")
    return counts


if __name__ == "__main__":
    run()
