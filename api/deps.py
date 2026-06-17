"""Shared FastAPI dependencies."""

from __future__ import annotations

from buildinglens import db
from buildinglens.config import settings


def get_conn():
    """Yield a per-request SQLite connection and close it afterwards."""
    conn = db.connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()
