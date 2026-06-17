"""Per-building risk scoring from the defects table.

Formula (transparent, one-sentence summary):
    Each defect contributes a weight (critical=10, major=4, minor=1). The weights
    are summed into a raw score, then mapped to [0, 100] via a saturating
    exponential: score = 100 * (1 - exp(-raw / K)), where K=30 is the
    half-saturation constant (a building with raw=30 gets ~63 out of 100).
    This keeps zero-defect buildings at exactly 0.0, and the scale saturates
    gracefully so even portfolios with extremely defective buildings stay in range.
"""

from __future__ import annotations

import math
import sqlite3
import warnings

# Severity weights used for raw score accumulation.
WEIGHT_CRITICAL: int = 10
WEIGHT_MAJOR: int = 4
WEIGHT_MINOR: int = 1

# Half-saturation constant: raw score at which the output reaches ~63/100.
# Tuned so a single critical defect gives ~28/100 and three criticals give ~63/100.
K: float = 30.0

_WEIGHTS: dict[str, int] = {
    "critical": WEIGHT_CRITICAL,
    "major": WEIGHT_MAJOR,
    "minor": WEIGHT_MINOR,
}


def _raw_to_score(raw: float) -> float:
    """Map a non-negative raw weight sum to a [0, 100] risk score."""
    if raw <= 0.0:
        return 0.0
    return 100.0 * (1.0 - math.exp(-raw / K))


def compute_scores(conn: sqlite3.Connection) -> dict[int, float]:
    """Compute and persist a risk score for every building in the database.

    Aggregates defect weights per building, converts to a 0-100 score via the
    saturating exponential defined above, and writes the result back to
    buildings.risk_score. Buildings with no defects receive 0.0.

    Returns a mapping {building_id: score} for all buildings.
    """
    # Fetch all building ids.
    building_rows = conn.execute("SELECT id FROM buildings").fetchall()
    all_ids: list[int] = [row[0] for row in building_rows]

    # Fetch all defects with their severity.
    defect_rows = conn.execute(
        "SELECT building_id, severity FROM defects"
    ).fetchall()

    # Accumulate raw weights per building.
    raw: dict[int, float] = {bid: 0.0 for bid in all_ids}
    for row in defect_rows:
        bid, severity = row[0], row[1]
        weight = _WEIGHTS.get(severity)
        if weight is None:
            warnings.warn(
                f"Unknown severity {severity!r} for building {bid}, skipping.",
                stacklevel=2,
            )
            continue
        if bid not in raw:
            # Defect references a building not in our set, skip gracefully.
            warnings.warn(
                f"Defect references unknown building_id={bid}, skipping.",
                stacklevel=2,
            )
            continue
        raw[bid] += weight

    # Convert to final scores and persist.
    scores: dict[int, float] = {}
    for bid in all_ids:
        score = _raw_to_score(raw[bid])
        scores[bid] = score
        conn.execute(
            "UPDATE buildings SET risk_score = ? WHERE id = ?", (score, bid)
        )
    conn.commit()

    return scores


def building_risk_breakdown(conn: sqlite3.Connection, building_id: int) -> dict:
    """Return a risk summary for one building, ready for UI display.

    Returns a dict with keys:
        building_id, risk_score, critical, major, minor, total
    """
    score_row = conn.execute(
        "SELECT risk_score FROM buildings WHERE id = ?", (building_id,)
    ).fetchone()

    if score_row is None:
        raise ValueError(f"No building found with id={building_id}")

    risk_score = score_row[0] if score_row[0] is not None else 0.0

    counts = {"critical": 0, "major": 0, "minor": 0}
    rows = conn.execute(
        "SELECT severity, COUNT(*) FROM defects WHERE building_id = ? GROUP BY severity",
        (building_id,),
    ).fetchall()
    for row in rows:
        sev, cnt = row[0], row[1]
        if sev in counts:
            counts[sev] = cnt

    total = counts["critical"] + counts["major"] + counts["minor"]

    return {
        "building_id": building_id,
        "risk_score": round(risk_score, 2),
        "critical": counts["critical"],
        "major": counts["major"],
        "minor": counts["minor"],
        "total": total,
    }


if __name__ == "__main__":
    """Smoke test: temporary in-memory DB, one building with mixed defects."""
    import tempfile
    from pathlib import Path

    from buildinglens.db import connect, init_schema

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "smoke.db"
        conn = connect(db_path)
        init_schema(conn)

        # Insert two buildings.
        conn.execute(
            "INSERT INTO buildings (id, source_id, name, address, source) "
            "VALUES (1, 'B001', 'Batiment A', '1 rue Test', 'smoke')"
        )
        conn.execute(
            "INSERT INTO buildings (id, source_id, name, address, source) "
            "VALUES (2, 'B002', 'Batiment B', '2 rue Test', 'smoke')"
        )
        conn.commit()

        # Building 1: 1 critical + 2 major + 1 minor (raw = 10 + 8 + 1 = 19)
        defects_b1 = [
            (1, None, "Structure", "Poutre", "Fissure traversante", "RDC", "critical", "sec. 3.1"),
            (1, None, "Facade",    "Enduit",  "Decollement partiel", "Ext.", "major",    "sec. 4.2"),
            (1, None, "CVC",       "Chaudiere","Fuite vapeur",       "Cave", "major",    "sec. 6.1"),
            (1, None, "Toiture",   "Solins",  "Infiltration",       "T1",   "minor",    "sec. 2.3"),
        ]
        # Building 2: 3 critical (raw = 30), should score higher than building 1.
        defects_b2 = [
            (2, None, "Structure",     "Colonne", "Eclatement beton",  "R1", "critical", "sec. 3.2"),
            (2, None, "Securite incendie", "Detecteur", "Hors service","RDC","critical", "sec. 5.1"),
            (2, None, "Electricite",   "TGBT",    "Disjoncteur defaillant","Cave","critical","sec. 7.1"),
        ]

        for row in defects_b1 + defects_b2:
            conn.execute(
                "INSERT INTO defects "
                "(building_id, document_id, discipline, element, description, location, severity, citation) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                row,
            )
        conn.commit()

        scores = compute_scores(conn)

        score_b1 = scores[1]
        score_b2 = scores[2]

        assert score_b1 > 0, "Building 1 has defects, score must be > 0"
        assert score_b2 > score_b1, (
            f"Building 2 (3 criticals) should outscore building 1 (1 critical), "
            f"got {score_b2:.2f} vs {score_b1:.2f}"
        )

        print("Scores:")
        print(f"  Building 1 (raw=19): {score_b1:.4f} / 100")
        print(f"  Building 2 (raw=30): {score_b2:.4f} / 100")

        bd1 = building_risk_breakdown(conn, 1)
        bd2 = building_risk_breakdown(conn, 2)

        print("\nBreakdown building 1:")
        for k, v in bd1.items():
            print(f"  {k}: {v}")

        print("\nBreakdown building 2:")
        for k, v in bd2.items():
            print(f"  {k}: {v}")

        conn.close()

    print("\nSmoke test passed.")
