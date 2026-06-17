"""Building list and detail endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from buildinglens.scoring import building_risk_breakdown

from ..deps import get_conn

router = APIRouter(tags=["buildings"])

_SEV = "CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 ELSE 2 END"


@router.get("/buildings")
def list_buildings(conn=Depends(get_conn)):
    """All buildings with risk score and severity counts, ranked by risk."""
    rows = conn.execute(
        """
        SELECT b.id, b.name, b.address, b.height_m, b.latitude, b.longitude, b.source,
               COALESCE(b.risk_score, 0.0) AS risk_score,
               COALESCE(SUM(d.severity = 'critical'), 0) AS critical,
               COALESCE(SUM(d.severity = 'major'), 0) AS major,
               COALESCE(SUM(d.severity = 'minor'), 0) AS minor
        FROM buildings b
        LEFT JOIN defects d ON d.building_id = b.id
        GROUP BY b.id
        ORDER BY risk_score DESC
        """
    ).fetchall()
    return {"buildings": [dict(r) for r in rows]}


@router.get("/buildings/{building_id}")
def building_detail(building_id: int, conn=Depends(get_conn)):
    """Full detail for one building: metadata, risk breakdown, KPIs, and defects."""
    b = conn.execute("SELECT * FROM buildings WHERE id = ?", (building_id,)).fetchone()
    if b is None:
        raise HTTPException(status_code=404, detail="Building not found")

    breakdown = building_risk_breakdown(conn, building_id)
    defects = [
        dict(r)
        for r in conn.execute(
            f"SELECT discipline, element, description, location, severity, citation "
            f"FROM defects WHERE building_id = ? ORDER BY {_SEV}, discipline",
            (building_id,),
        ).fetchall()
    ]
    by_discipline = [
        dict(r)
        for r in conn.execute(
            "SELECT discipline, COUNT(*) AS count FROM defects WHERE building_id = ? "
            "GROUP BY discipline ORDER BY count DESC",
            (building_id,),
        ).fetchall()
    ]
    detail = dict(b)
    detail["risk_score"] = detail.get("risk_score") or 0.0
    detail["breakdown"] = breakdown
    detail["kpis"] = {
        "by_discipline": by_discipline,
        "by_severity": {
            "critical": breakdown["critical"],
            "major": breakdown["major"],
            "minor": breakdown["minor"],
        },
    }
    detail["defects"] = defects
    return detail
