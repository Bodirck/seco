"""Public-registry candidate endpoint.

Surfaces a few buildings from the cached EUBUCCO public registry so a user can add
a building from the registry in the Import flow instead of typing a name. The
footprint, height and coordinates are real (EUBUCCO Luxembourg); the name and
address are synthetic, since EUBUCCO has no per-building identity for LU.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from buildinglens import ingest_structured

from ..deps import get_conn

router = APIRouter(tags=["registry"])


@router.get("/registry/candidates")
def registry_candidates(n: int = Query(8, ge=1, le=50), conn=Depends(get_conn)):
    """Return up to n registry buildings that are not already in the database."""
    existing = {
        str(r["source_id"])
        for r in conn.execute(
            "SELECT source_id FROM buildings WHERE source_id IS NOT NULL"
        ).fetchall()
    }
    pool = ingest_structured.candidate_pool()
    fresh = [c for c in pool if str(c.get("source_id")) not in existing][:n]
    return {"candidates": fresh}
