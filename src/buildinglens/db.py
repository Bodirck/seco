"""SQLite schema and access layer.

This schema is the frozen data contract that every other work package consumes
(ingestion, extraction, scoring, RAG, UI). Change it deliberately, not casually.

Tables
------
buildings : one row per building (real footprints from EUBUCCO Luxembourg,
            names/addresses synthetic since no public per-building source exists).
documents : one row per ingested document (inspection report PDF text).
defects   : one row per defect extracted from a document, classified by severity.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS buildings (
    id          INTEGER PRIMARY KEY,
    source_id   TEXT,                 -- external id from the source (e.g. EUBUCCO id)
    name        TEXT,
    address     TEXT,
    year_built  INTEGER,
    height_m    REAL,                 -- real attribute, well covered by EUBUCCO LU
    latitude    REAL,
    longitude   REAL,
    source      TEXT,                 -- provenance label, e.g. "EUBUCCO v0.2 / gov-luxembourg"
    risk_score  REAL                  -- computed by the scoring step
);

CREATE TABLE IF NOT EXISTS documents (
    id           INTEGER PRIMARY KEY,
    building_id  INTEGER REFERENCES buildings(id),
    type         TEXT,                -- e.g. "inspection_report"
    path         TEXT,
    raw_text     TEXT,
    ingested_at  TEXT
);

CREATE TABLE IF NOT EXISTS defects (
    id           INTEGER PRIMARY KEY,
    building_id  INTEGER REFERENCES buildings(id),
    document_id  INTEGER REFERENCES documents(id),
    discipline   TEXT,                -- SECO organises observations by discipline
    element      TEXT,
    description  TEXT,
    location     TEXT,
    severity     TEXT CHECK (severity IN ('critical', 'major', 'minor')),
    citation     TEXT                 -- source passage, for traceability and anti-hallucination
);

CREATE INDEX IF NOT EXISTS idx_documents_building ON documents(building_id);
CREATE INDEX IF NOT EXISTS idx_defects_building ON defects(building_id);
CREATE INDEX IF NOT EXISTS idx_defects_document ON defects(document_id);

-- Runtime configuration overlay. Lets the API change the LLM provider and keys
-- at runtime (persisted across restarts) without editing .env or restarting.
-- Kept separate from the buildings/documents/defects data contract.
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    """Open a connection with foreign keys on and row access by column name."""
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Create the tables and indexes if they do not exist (idempotent)."""
    conn.executescript(SCHEMA)
    conn.commit()


def reset(conn: sqlite3.Connection) -> None:
    """Drop and recreate the data tables. Used by the pipeline for a clean rebuild.

    The app_settings overlay is deliberately preserved: rebuilding the data set
    should not wipe the operator's configured provider and keys.
    """
    for table in ("defects", "documents", "buildings"):
        conn.execute(f"DROP TABLE IF EXISTS {table}")
    conn.commit()
    init_schema(conn)


def read_settings(conn: sqlite3.Connection) -> dict[str, str]:
    """Return every persisted runtime override as a plain key -> value dict.

    Returns an empty dict if the table does not exist yet (e.g. an old database),
    so callers can treat "no overrides" and "fresh database" the same way.
    """
    try:
        rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    except sqlite3.OperationalError:
        return {}
    return {row["key"]: row["value"] for row in rows}


def write_settings(conn: sqlite3.Connection, values: dict[str, str]) -> None:
    """Upsert the given key/value overrides into app_settings (idempotent)."""
    init_schema(conn)
    conn.executemany(
        """
        INSERT INTO app_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        [(str(k), str(v)) for k, v in values.items()],
    )
    conn.commit()
