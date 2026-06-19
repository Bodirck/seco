"""Search scope endpoints: facet options and facets-to-building_ids resolution.

The Search page filters questions to a subset of the portfolio by commune,
building use and defect severity. Those facets resolve to a set of building ids
that the RAG retrieval is then scoped to. This router is the single source of
truth for that resolution; the LLM is never involved, so it works in mock mode.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..deps import get_conn

router = APIRouter(tags=["search"])

_SEVERITIES = ("critical", "major", "minor")


@router.get("/search/options")
def search_options(conn=Depends(get_conn)):
    """Available facet values with counts, for the Search scope bar.

    Communes and uses exclude NULLs so no phantom "(none)" facet appears.
    Severity counts are distinct buildings having at least one defect of that
    severity, which is what scoping by severity actually selects.
    """
    communes = [
        {"value": r["value"], "count": r["count"]}
        for r in conn.execute(
            "SELECT commune AS value, COUNT(*) AS count FROM buildings "
            "WHERE commune IS NOT NULL GROUP BY commune ORDER BY value"
        ).fetchall()
    ]
    uses = [
        {"value": r["value"], "count": r["count"]}
        for r in conn.execute(
            "SELECT use_type AS value, COUNT(*) AS count FROM buildings "
            "WHERE use_type IS NOT NULL GROUP BY use_type ORDER BY count DESC, value"
        ).fetchall()
    ]
    severities = []
    for sev in _SEVERITIES:
        count = conn.execute(
            "SELECT COUNT(DISTINCT building_id) FROM defects WHERE severity = ?",
            (sev,),
        ).fetchone()[0]
        severities.append({"value": sev, "count": count})

    return {"communes": communes, "uses": uses, "severities": severities}


class ScopeBody(BaseModel):
    communes: list[str] = []
    uses: list[str] = []
    severities: list[str] = []


@router.post("/search/resolve")
def resolve_scope(body: ScopeBody, conn=Depends(get_conn)):
    """Resolve a set of facet selections to the AND-combined building id set.

    An absent facet imposes no constraint. The three constraints intersect, so
    "commune Esch AND severity critical" selects buildings in Esch that have at
    least one critical defect. An empty result is returned as {building_ids: []}.
    """
    clauses: list[str] = []
    params: list[object] = []

    if body.communes:
        placeholders = ",".join("?" for _ in body.communes)
        clauses.append(f"commune IN ({placeholders})")
        params.extend(body.communes)

    if body.uses:
        placeholders = ",".join("?" for _ in body.uses)
        clauses.append(f"use_type IN ({placeholders})")
        params.extend(body.uses)

    severities = [s for s in body.severities if s in _SEVERITIES]
    if severities:
        placeholders = ",".join("?" for _ in severities)
        clauses.append(
            f"id IN (SELECT building_id FROM defects WHERE severity IN ({placeholders}))"
        )
        params.extend(severities)

    sql = "SELECT id FROM buildings"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY id"

    building_ids = [r["id"] for r in conn.execute(sql, params).fetchall()]
    return {"building_ids": building_ids, "count": len(building_ids)}
