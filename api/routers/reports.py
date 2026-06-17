"""Client report download endpoint (Excel and PDF)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from buildinglens import reports

from ..deps import get_conn

router = APIRouter(tags=["reports"])

_MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@router.get("/buildings/{building_id}/report")
def report(
    building_id: int,
    format: str = Query("pdf", pattern="^(pdf|xlsx)$"),
    conn=Depends(get_conn),
):
    """Generate and stream a per-building report as a file download."""
    exists = conn.execute(
        "SELECT 1 FROM buildings WHERE id = ?", (building_id,)
    ).fetchone()
    if exists is None:
        raise HTTPException(status_code=404, detail="Building not found")

    if format == "xlsx":
        data = reports.build_excel_report(conn, building_id)
    else:
        data = reports.build_pdf_report(conn, building_id)

    filename = f"buildinglens_report_{building_id}.{format}"
    return Response(
        content=data,
        media_type=_MEDIA[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
