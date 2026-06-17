"""BuildingLens API: a thin FastAPI layer over the buildinglens Python core.

Run with: python -m uvicorn api.main:app --port 8000
Build the data first with `make data` and `make extract`.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from buildinglens.llm import get_llm

from .deps import get_conn
from .routers import ask, buildings, reports

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
app.include_router(reports.router, prefix="/api")


@app.get("/api/meta")
def meta(conn=Depends(get_conn)):
    """Provider in use and row counts, for the UI to show data readiness."""
    return {
        "provider": getattr(get_llm(), "name", "unknown"),
        "buildings": conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0],
        "documents": conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
        "defects": conn.execute("SELECT COUNT(*) FROM defects").fetchone()[0],
    }
