"""PDF ingestion: extract raw text and insert document rows into SQLite.

Text extraction uses pdfplumber. Malformed or unreadable PDFs are skipped
with a warning so that a single bad file never aborts the batch.
"""

from __future__ import annotations

import sqlite3
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def _strip_repeated_boilerplate(pages: list[str]) -> str:
    """Join page texts, dropping header/footer lines that repeat on every page.

    The reports draw a banner and footer on every page, and pdfplumber extracts
    that boilerplate once per page. Without this, identical lines appear several
    times in raw_text and pollute the RAG chunks. We keep the first occurrence
    of any line that shows up on all pages and drop the repeats.
    """
    if len(pages) <= 1:
        return "\n".join(pages).strip()

    page_lines = [[ln.rstrip() for ln in page.splitlines()] for page in pages]

    presence: Counter[str] = Counter()
    for lines in page_lines:
        for ln in {line for line in lines if line.strip()}:
            presence[ln] += 1

    n_pages = len(page_lines)
    boilerplate = {ln for ln, count in presence.items() if count == n_pages}

    seen: set[str] = set()
    kept: list[str] = []
    for lines in page_lines:
        for ln in lines:
            if ln in boilerplate:
                if ln in seen:
                    continue
                seen.add(ln)
            kept.append(ln)
    return "\n".join(kept).strip()


def ingest_reports(
    conn: sqlite3.Connection,
    items: list[tuple[int, Path]],
    doc_type: str = "inspection_report",
) -> list[int]:
    """Extract text from PDFs and insert rows into the documents table.

    Parameters
    ----------
    conn:
        An open SQLite connection (row factory, FK on) as returned by
        buildinglens.db.connect.
    items:
        List of (building_id, pdf_path) pairs produced by
        buildinglens.synthetic_reports.generate_reports or any other source.
    doc_type:
        Value stored in documents.type. Defaults to "inspection_report".

    Returns
    -------
    List of inserted document ids in the same order as the input pairs.
    Pairs that fail to ingest are silently skipped (not included in the list).
    """
    import pdfplumber  # lazy: already installed but keep import scoped

    inserted_ids: list[int] = []

    for building_id, pdf_path in items:
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            warnings.warn(f"PDF not found, skipping: {pdf_path}", stacklevel=2)
            continue

        # --- Text extraction ---
        raw_text: str
        try:
            pages: list[str] = []
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    pages.append(page_text)
            raw_text = _strip_repeated_boilerplate(pages)
        except Exception as exc:
            warnings.warn(
                f"Could not extract text from {pdf_path.name}: {exc!r} - skipping.",
                stacklevel=2,
            )
            continue

        if not raw_text:
            warnings.warn(
                f"Extracted text is empty for {pdf_path.name}, storing anyway.",
                stacklevel=2,
            )

        ingested_at = datetime.now(timezone.utc).isoformat()

        # --- DB insert ---
        cur = conn.execute(
            """
            INSERT INTO documents (building_id, type, path, raw_text, ingested_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (building_id, doc_type, str(pdf_path), raw_text, ingested_at),
        )
        conn.commit()
        inserted_ids.append(cur.lastrowid)

    return inserted_ids


# ---------------------------------------------------------------------------
# Combined smoke test (generates PDFs then ingests them)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import tempfile
    from pathlib import Path

    from buildinglens.db import connect, init_schema
    from buildinglens.synthetic_reports import generate_reports

    BUILDINGS = [
        {
            "id": 1,
            "name": "Immeuble Alpha",
            "address": "12 Rue de la Liberte, L-1930 Luxembourg",
            "year_built": 1985,
            "height_m": 22.5,
        },
        {
            "id": 2,
            "name": "Residence Beta",
            "address": "7 Avenue de la Gare, L-1610 Luxembourg",
            "year_built": 2003,
            "height_m": 14.0,
        },
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # 1. Generate PDFs
        items = generate_reports(BUILDINGS, tmp / "pdfs", seed=42)
        print(f"Generated {len(items)} PDF(s).")

        # 2. Init temp DB and insert building rows
        db_path = tmp / "test.db"
        conn = connect(db_path)
        init_schema(conn)

        for b in BUILDINGS:
            conn.execute(
                """
                INSERT INTO buildings (id, source_id, name, address, year_built, height_m)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (b["id"], f"SMOKE-{b['id']}", b["name"], b["address"],
                 b["year_built"], b["height_m"]),
            )
        conn.commit()

        # 3. Ingest PDFs
        doc_ids = ingest_reports(conn, items)
        print(f"Inserted document ids: {doc_ids}")

        # 4. Verify rows have non-empty raw_text
        for doc_id in doc_ids:
            row = conn.execute(
                "SELECT building_id, length(raw_text) AS txt_len FROM documents WHERE id = ?",
                (doc_id,),
            ).fetchone()
            print(f"  doc_id={doc_id}  building_id={row['building_id']}  text_length={row['txt_len']} chars")
            assert row["txt_len"] and row["txt_len"] > 0, "raw_text must not be empty"

        conn.close()

    print("ingest_pdf smoke: OK")
