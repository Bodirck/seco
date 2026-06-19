"""BuildingLens API: a thin FastAPI layer over the buildinglens Python core.

Run with: python -m uvicorn api.main:app --port 8000
Build the data first with `make data` and `make extract`.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from buildinglens import config, db
from buildinglens.llm import get_llm

from .deps import get_conn
from .routers import ask, buildings, ingest, registry, reports, search, settings

app = FastAPI(title="BuildingLens API", version="0.1.0")

# Allow the Vite dev server origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(buildings.router, prefix="/api")
app.include_router(ask.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
app.include_router(registry.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.on_event("startup")
def _load_persisted_settings() -> None:
    """Apply any runtime overrides saved in the database so they survive restarts.

    Ensures the app_settings table exists first, then rebuilds the effective
    configuration (and llm.default_settings) from .env defaults + persisted values.
    """
    conn = db.connect(config.get_settings().db_path)
    try:
        db.init_schema(conn)
        config.load_persisted(conn)
    finally:
        conn.close()


@app.get("/api/meta")
def meta(conn=Depends(get_conn)):
    """Provider in use and row counts, for the UI to show data readiness."""
    return {
        "provider": getattr(get_llm(), "name", "unknown"),
        "buildings": conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0],
        "documents": conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
        "defects": conn.execute("SELECT COUNT(*) FROM defects").fetchone()[0],
    }
