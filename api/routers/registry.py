"""Public-registry candidate and search endpoints.

Surfaces buildings from the cached EUBUCCO public registry so a user can add one in
the Import flow. The footprint, height, coordinates and commune are real (commune
derived by point-in-polygon against the ACT boundaries); the name and street address
are synthetic, since EUBUCCO has no per-building identity for Luxembourg.

All three endpoints read the same candidate_pool() that find_candidate() resolves on
ingest, so every building shown here can be imported. Filtering by commune and
excluding already-imported buildings happen BEFORE pagination, so the totals and the
visible page stay consistent.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query

from buildinglens import ingest_structured

from ..deps import get_conn

router = APIRouter(tags=["registry"])


def _existing_source_ids(conn) -> set[str]:
    """Source ids already present in the database (so we never offer a duplicate)."""
    return {
        str(r["source_id"])
        for r in conn.execute(
            "SELECT source_id FROM buildings WHERE source_id IS NOT NULL"
        ).fetchall()
    }


@router.get("/registry/candidates")
def registry_candidates(n: int = Query(8, ge=1, le=50), conn=Depends(get_conn)):
    """Return up to n registry buildings that are not already in the database."""
    existing = _existing_source_ids(conn)
    pool = ingest_structured.candidate_pool()
    fresh = [c for c in pool if str(c.get("source_id")) not in existing][:n]
    return {"candidates": fresh}


@router.get("/registry/search")
def registry_search(
    q: str = Query("", description="commune substring, case-insensitive; empty = all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    conn=Depends(get_conn),
):
    """Search registry buildings by commune, paginated.

    Filters by commune and excludes already-imported buildings before paginating, so
    `total` / `total_pages` and the returned page are always consistent.
    """
    existing = _existing_source_ids(conn)
    pool = ingest_structured.candidate_pool()
    needle = q.strip().lower()

    def keep(c: dict) -> bool:
        if str(c.get("source_id")) in existing:
            return False
        if not needle:
            return True
        commune = c.get("commune") or ""
        return needle in commune.lower()

    filtered = [c for c in pool if keep(c)]
    total = len(filtered)
    total_pages = max(1, math.ceil(total / page_size))
    start = (page - 1) * page_size
    return {
        "candidates": filtered[start : start + page_size],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


@router.get("/registry/communes")
def registry_communes(
    q: str = Query("", description="optional substring for type-ahead"),
    limit: int = Query(50, ge=1, le=200),
    conn=Depends(get_conn),
):
    """List communes (with the count of not-yet-imported buildings) for type-ahead."""
    existing = _existing_source_ids(conn)
    pool = ingest_structured.candidate_pool()
    needle = q.strip().lower()

    counts: dict[str, int] = {}
    for c in pool:
        if str(c.get("source_id")) in existing:
            continue
        commune = c.get("commune")
        if not commune:
            continue
        if needle and needle not in commune.lower():
            continue
        counts[commune] = counts.get(commune, 0) + 1

    items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]
    return {"communes": [{"name": name, "count": count} for name, count in items]}
