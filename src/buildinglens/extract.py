"""WP2 - LLM-based defect extraction from building inspection reports.

Reads raw_text from the documents table, calls the LLM with a structured prompt,
and writes parsed defects into the defects table. The extraction schema mirrors the
RICS condition rating used in the synthetic reports:

  C3 -> critical
  C2 -> major
  C1 -> minor

Public API
----------
  extract_for_document(conn, document_id, client=None) -> list[int]
  extract_all(conn, client=None, limit=None)           -> int
"""

from __future__ import annotations

import sqlite3
import warnings
from typing import Any

from .config import settings
from .db import connect
from .llm import LLMClient, extract_json, get_llm

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a senior building-inspection analyst with expertise in structural \
engineering, fire safety, HVAC, electrical systems, facades, and roofing.

Your task is to read building inspection reports and extract EVERY distinct defect \
mentioned in the text. Each defect must be supported by an explicit passage in the report.

Rules:
- Extract every defect you find. Do not miss any.
- Never invent or infer defects that are not stated in the text.
- Map RICS condition ratings strictly: C3 -> "critical", C2 -> "major", C1 -> "minor".
  If no RICS code is present, infer severity from the language used (e.g., \
"immediate action required" -> critical, "should be repaired" -> major, \
"monitor" or "superficial" -> minor).
- Output ONLY the JSON object described below. No preamble, no explanation, no code fence.

Output format (strict JSON, no trailing commas):
{
  "defects": [
    {
      "discipline": "<section heading from the report, e.g. Structure>",
      "element": "<specific building element, e.g. Facade Nord>",
      "description": "<clear, concise description of the defect>",
      "location": "<location within the building, e.g. Niveau 3, Escalier A>",
      "severity": "<critical | major | minor>",
      "citation": "<short verbatim snippet from the report that evidences this defect>"
    }
  ]
}

If no defects are found, return {"defects": []}.
"""

_EXTRACTION_PROMPT_TEMPLATE = """Below is the raw text extracted from a building inspection report.
Extract every defect it contains and return them in the JSON format specified in your instructions.

--- BEGIN REPORT ---
{text}
--- END REPORT ---
"""

# ---------------------------------------------------------------------------
# RICS rating mapper
# ---------------------------------------------------------------------------

_RICS_MAP: dict[str, str] = {
    "c3": "critical",
    "c2": "major",
    "c1": "minor",
}

_VALID_SEVERITIES = frozenset({"critical", "major", "minor"})


def _normalise_severity(raw: str) -> str | None:
    """Return a canonical severity string or None if unrecognised."""
    s = raw.strip().lower()
    if s in _VALID_SEVERITIES:
        return s
    if s in _RICS_MAP:
        return _RICS_MAP[s]
    return None


# ---------------------------------------------------------------------------
# Core extraction helpers
# ---------------------------------------------------------------------------

def _build_prompt(raw_text: str) -> str:
    return _EXTRACTION_PROMPT_TEMPLATE.format(text=raw_text)


def _insert_defect(
    conn: sqlite3.Connection,
    building_id: int,
    document_id: int,
    d: dict[str, Any],
) -> int | None:
    """Validate and insert one defect row. Returns the new row id or None on failure."""
    severity = _normalise_severity(d.get("severity", ""))
    if severity is None:
        warnings.warn(
            f"Skipping defect with unrecognised severity {d.get('severity')!r} "
            f"(document_id={document_id})",
            stacklevel=3,
        )
        return None

    cur = conn.execute(
        """
        INSERT INTO defects
            (building_id, document_id, discipline, element, description, location, severity, citation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            building_id,
            document_id,
            (d.get("discipline") or "").strip() or None,
            (d.get("element") or "").strip() or None,
            (d.get("description") or "").strip() or None,
            (d.get("location") or "").strip() or None,
            severity,
            (d.get("citation") or "").strip() or None,
        ),
    )
    return cur.lastrowid


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_for_document(
    conn: sqlite3.Connection,
    document_id: int,
    client: LLMClient | None = None,
) -> list[int]:
    """Extract defects from a single document and insert them into the defects table.

    Parameters
    ----------
    conn:
        Open SQLite connection (row factory, FK on) as returned by db.connect.
    document_id:
        Primary key of the row in the documents table to process.
    client:
        LLM client. Defaults to get_llm() which reads the provider from settings.
        Pass get_llm("mock") to run fully offline.

    Returns
    -------
    List of inserted defect row ids. Empty when the mock client is used or no
    defects are found in the text.
    """
    if client is None:
        client = get_llm()

    row = conn.execute(
        "SELECT id, building_id, raw_text FROM documents WHERE id = ?",
        (document_id,),
    ).fetchone()
    if row is None:
        warnings.warn(f"document_id={document_id} not found, skipping.", stacklevel=2)
        return []

    building_id: int = row["building_id"]
    raw_text: str = row["raw_text"] or ""

    if not raw_text.strip():
        warnings.warn(
            f"document_id={document_id} has empty raw_text, skipping.", stacklevel=2
        )
        return []

    prompt = _build_prompt(raw_text)

    try:
        data = extract_json(client, prompt, system=_SYSTEM_PROMPT, max_tokens=4096)
    except ValueError as exc:
        warnings.warn(
            f"JSON parse error for document_id={document_id}: {exc}", stacklevel=2
        )
        return []

    defect_list = data.get("defects", [])
    if not isinstance(defect_list, list):
        warnings.warn(
            f"'defects' key is not a list for document_id={document_id}, skipping.",
            stacklevel=2,
        )
        return []

    inserted_ids: list[int] = []
    for defect in defect_list:
        if not isinstance(defect, dict):
            warnings.warn(
                f"Non-dict item in defects for document_id={document_id}: {defect!r}",
                stacklevel=2,
            )
            continue
        row_id = _insert_defect(conn, building_id, document_id, defect)
        if row_id is not None:
            inserted_ids.append(row_id)

    conn.commit()
    return inserted_ids


def extract_all(
    conn: sqlite3.Connection,
    client: LLMClient | None = None,
    limit: int | None = None,
) -> int:
    """Run defect extraction over all documents in the database.

    Parameters
    ----------
    conn:
        Open SQLite connection.
    client:
        LLM client. Defaults to get_llm().
    limit:
        If given, process only the first `limit` documents (useful for quick tests).

    Returns
    -------
    Total number of defects inserted across all processed documents.
    """
    if client is None:
        client = get_llm()

    query = "SELECT id FROM documents ORDER BY id"
    if limit is not None:
        query += f" LIMIT {int(limit)}"

    doc_ids = [row["id"] for row in conn.execute(query).fetchall()]
    total = 0

    for doc_id in doc_ids:
        try:
            ids = extract_for_document(conn, doc_id, client=client)
            total += len(ids)
            print(f"  document_id={doc_id}: {len(ids)} defect(s) inserted.")
        except Exception as exc:
            warnings.warn(
                f"Unexpected error processing document_id={doc_id}: {exc!r} - skipping.",
                stacklevel=2,
            )

    return total


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mock_client = get_llm("mock")

    conn = connect(settings.db_path)

    first_doc = conn.execute(
        "SELECT id, building_id FROM documents ORDER BY id LIMIT 1"
    ).fetchone()

    if first_doc is None:
        print("No documents found. Run `make data` first to populate the database.")
    else:
        doc_id = first_doc["id"]
        building_id = first_doc["building_id"]
        print(
            f"Smoke test: extracting defects from document_id={doc_id} "
            f"(building_id={building_id}) using the mock client."
        )

        ids = extract_for_document(conn, doc_id, client=mock_client)
        print(f"Inserted defect ids (mock): {ids}")
        print(
            "(Empty list expected: the mock client returns no defects by design.)"
        )
        print("No exception raised. Code path confirmed OK.")

    conn.close()
    print()
    print(
        "Note: a real run uses get_llm() with a configured API key "
        "(set LLM_PROVIDER and the matching *_API_KEY in .env)."
    )
