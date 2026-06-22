"""Endpoint-level tests for the import duplicate guardrail (POST /api/ingest).

We call the router function directly (like the other API tests) and monkeypatch
the heavy collaborators: geocoding, the EUBUCCO footprint lookup, PDF text
extraction, LLM defect extraction, scoring and the vector reindex. That isolates
the dedup decision and the request wiring without needing a network, the parquet,
the embedding model or an API key.
"""

from __future__ import annotations

import io
from dataclasses import replace

import pytest
from fastapi import HTTPException, UploadFile

from api.routers import ingest as ingest_router
from buildinglens import config, db


def _pdf_upload(name: str = "report.pdf") -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(b"%PDF-1.4 fake content for tests"))


def _seed_existing(conn) -> None:
    conn.execute(
        "INSERT INTO buildings "
        "(source_id, name, address, source, commune, latitude, longitude, height_m, footprint_area_m2, risk_score) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            "LU00-1",
            "ecole fondamentale",
            "10 rue de la gare, 4131 Esch-sur-Alzette",
            "EUBUCCO v0.2 / gov-luxembourg",
            "Esch-sur-Alzette",
            49.5,
            6.0,
            8.0,
            500.0,
            31.0,
        ),
    )
    conn.commit()


@pytest.fixture
def env(tmp_path, monkeypatch):
    """A seeded DB plus monkeypatched collaborators. Returns (conn, calls) where
    `calls` records whether the LLM extraction ran (it must not on a block)."""
    # Route the saved upload + uploads dir into tmp (Settings is frozen, and the
    # router imported `settings` by name, so replace that binding).
    monkeypatch.setattr(
        ingest_router, "settings", replace(config.settings, db_path=tmp_path / "t.db")
    )

    matched = {
        "source_id": "LU00-1",
        "latitude": 49.5,
        "longitude": 6.0,
        "height_m": 8.0,
        "footprint_area_m2": 500.0,
        "use_type": "residential",
        "use_subtype": None,
        "floors": 3,
        "year_built": None,
        "type_confidence": None,
        "source": "EUBUCCO v0.2 / gov-luxembourg",
        "commune": "Esch-sur-Alzette",
    }
    monkeypatch.setattr("buildinglens.geocode.geocode_lu", lambda addr, **kw: (49.5, 6.0))
    monkeypatch.setattr(
        "buildinglens.ingest_structured.find_building_at_point",
        lambda lat, lon, **kw: dict(matched),
    )

    def fake_ingest_reports(conn, items):
        bid, path = items[0]
        cur = conn.execute(
            "INSERT INTO documents (building_id, type, path) VALUES (?, 'inspection_report', ?)",
            (bid, str(path)),
        )
        conn.commit()
        return [cur.lastrowid]

    calls = {"extract": 0}

    def fake_extract(conn, document_id, client=None):
        calls["extract"] += 1
        return []

    monkeypatch.setattr("buildinglens.ingest_pdf.ingest_reports", fake_ingest_reports)
    monkeypatch.setattr("buildinglens.extract.extract_for_document", fake_extract)
    monkeypatch.setattr("buildinglens.scoring.compute_scores", lambda conn: None)
    monkeypatch.setattr("buildinglens.rag.build_index", lambda conn, *a, **k: 0)

    class _Client:
        pass

    monkeypatch.setattr("buildinglens.llm.get_llm", lambda *a, **k: _Client())

    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    return conn, calls


def _ingest(conn, **kw):
    base = dict(
        file=_pdf_upload(),
        building_id=None,
        name=None,
        address=None,
        registry_source_id=None,
        force=False,
        conn=conn,
    )
    base.update(kw)
    return ingest_router.ingest(**base)


def test_second_identical_import_is_blocked(env):
    conn, calls = env
    _seed_existing(conn)
    with pytest.raises(HTTPException) as ei:
        _ingest(
            conn,
            name="École Fondamentale",
            address="10, Rue de la Gare, 4131 Esch-sur-Alzette",
        )
    assert ei.value.status_code == 409
    assert ei.value.detail["code"] == "duplicate_building"
    assert ei.value.detail["candidates"][0]["id"] == 1
    # No second building, and the expensive extraction never ran.
    assert conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0] == 1
    assert calls["extract"] == 0


def test_force_imports_the_duplicate_anyway(env):
    conn, calls = env
    _seed_existing(conn)
    res = _ingest(
        conn,
        name="École Fondamentale",
        address="10, Rue de la Gare, Esch-sur-Alzette",
        force=True,
    )
    assert conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0] == 2
    assert calls["extract"] == 1
    # The forced import still reports the close match it overrode.
    assert res["possible_duplicates"] and res["possible_duplicates"][0]["id"] == 1


def test_different_name_same_footprint_is_not_blocked_but_warns(env):
    conn, _ = env
    _seed_existing(conn)
    res = _ingest(
        conn,
        name="Maison Communale",
        address="10, Rue de la Gare, Esch-sur-Alzette",
    )
    # A genuinely different building at the same footprint is created, with a warning.
    assert conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0] == 2
    dups = res["possible_duplicates"]
    assert dups and dups[0]["id"] == 1 and dups[0]["strength"] == "similar"
    assert "same_footprint" in dups[0]["reasons"]


def test_attach_to_existing_building_skips_dedup(env):
    conn, _ = env
    _seed_existing(conn)
    res = _ingest(conn, building_id=1)
    assert res["building_id"] == 1
    assert conn.execute("SELECT COUNT(*) FROM buildings").fetchone()[0] == 1
    assert res["possible_duplicates"] == []
