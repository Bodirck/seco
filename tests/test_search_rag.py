"""Tests for the Search deep pass: scope resolution, history, streaming, sources.

The model-free tests (resolve SQL, history formatting, mock streaming, the
empty-scope guard) run everywhere. The retrieval integration test builds a tiny
real index and is skipped if the local embedding model is unavailable.
"""

from __future__ import annotations

import pytest

from api.routers.search import ScopeBody, resolve_scope, search_options
from buildinglens import db, llm, rag


def _seed(path):
    """A 2-building DB: Esch/residential with a critical defect, Luxembourg/
    commercial with a minor defect, each with a short report text."""
    conn = db.connect(path / "t.db")
    db.init_schema(conn)
    conn.execute(
        "INSERT INTO buildings (name, source, commune, use_type) VALUES (?,?,?,?)",
        ("Esch Tower", "test", "Esch-sur-Alzette", "residential"),
    )
    conn.execute(
        "INSERT INTO buildings (name, source, commune, use_type) VALUES (?,?,?,?)",
        ("City Hall", "test", "Luxembourg", "commercial"),
    )
    conn.execute(
        "INSERT INTO documents (building_id, type, raw_text) VALUES (?,?,?)",
        (1, "inspection_report", "La toiture presente des fissures importantes."),
    )
    conn.execute(
        "INSERT INTO documents (building_id, type, raw_text) VALUES (?,?,?)",
        (2, "inspection_report", "La facade est en bon etat general."),
    )
    conn.execute(
        "INSERT INTO defects (building_id, document_id, element, severity) VALUES (?,?,?,?)",
        (1, 1, "toiture", "critical"),
    )
    conn.execute(
        "INSERT INTO defects (building_id, document_id, element, severity) VALUES (?,?,?,?)",
        (2, 2, "facade", "minor"),
    )
    conn.commit()
    return conn


# --------------------------------------------------------------------------- #
# Scope resolution (pure SQL, no model)
# --------------------------------------------------------------------------- #


def test_resolve_by_commune(tmp_path):
    conn = _seed(tmp_path)
    out = resolve_scope(ScopeBody(communes=["Esch-sur-Alzette"]), conn)
    assert out["building_ids"] == [1]
    assert out["count"] == 1


def test_resolve_intersects_facets(tmp_path):
    conn = _seed(tmp_path)
    # Esch building has a critical defect, so this matches it.
    hit = resolve_scope(
        ScopeBody(communes=["Esch-sur-Alzette"], severities=["critical"]), conn
    )
    assert hit["building_ids"] == [1]
    # Esch building has no minor defect, so the intersection is empty.
    miss = resolve_scope(
        ScopeBody(communes=["Esch-sur-Alzette"], severities=["minor"]), conn
    )
    assert miss["building_ids"] == []


def test_resolve_no_facets_is_whole_portfolio(tmp_path):
    conn = _seed(tmp_path)
    out = resolve_scope(ScopeBody(), conn)
    assert set(out["building_ids"]) == {1, 2}


def test_search_options_excludes_nulls_and_counts_severity(tmp_path):
    conn = _seed(tmp_path)
    opts = search_options(conn)
    assert {c["value"] for c in opts["communes"]} == {"Esch-sur-Alzette", "Luxembourg"}
    assert {u["value"] for u in opts["uses"]} == {"residential", "commercial"}
    sev = {s["value"]: s["count"] for s in opts["severities"]}
    assert sev == {"critical": 1, "major": 0, "minor": 1}


# --------------------------------------------------------------------------- #
# History formatting (pure)
# --------------------------------------------------------------------------- #


def test_format_history_bounds_turns_and_length():
    hist = [{"question": f"q{i}", "answer": "a" * 500} for i in range(6)]
    out = rag._format_history(hist, max_turns=3, max_answer_chars=300)
    assert out.count("Q:") == 3
    assert "..." in out


def test_format_history_empty():
    assert rag._format_history([]) == ""
    assert rag._format_history(None) == ""


# --------------------------------------------------------------------------- #
# Mock streaming (no model)
# --------------------------------------------------------------------------- #


def test_mock_stream_reconstructs_complete():
    client = llm.get_llm("mock")
    full = client.complete("hello")
    streamed = "".join(client.stream("hello"))
    assert streamed.split() == full.split()


def test_all_clients_expose_stream():
    for cls in (
        llm.MockClient,
        llm.AnthropicClient,
        llm.OpenAIClient,
        llm.MistralClient,
        llm.OllamaClient,
    ):
        assert hasattr(cls, "stream")


# --------------------------------------------------------------------------- #
# Empty-scope guard (short-circuits before the index, no model)
# --------------------------------------------------------------------------- #


def test_empty_scope_answer_short_circuits(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    res = rag.answer(
        "anything",
        conn,
        building_ids=[],
        client=llm.get_llm("mock"),
        index_dir=tmp_path / "idx",
    )
    assert res["sources"] == []
    assert "perimetre" in res["answer"].lower()


def test_empty_scope_stream_emits_sources_then_done(tmp_path):
    conn = db.connect(tmp_path / "t.db")
    db.init_schema(conn)
    frames = list(
        rag.answer_stream(
            "anything",
            conn,
            building_ids=[],
            client=llm.get_llm("mock"),
            index_dir=tmp_path / "idx",
        )
    )
    assert frames[0]["type"] == "sources" and frames[0]["sources"] == []
    assert any(f["type"] == "delta" for f in frames)
    assert frames[-1]["type"] == "done"


# --------------------------------------------------------------------------- #
# Retrieval integration (needs the local embedding model; skipped if absent)
# --------------------------------------------------------------------------- #


@pytest.fixture(scope="module")
def indexed(tmp_path_factory):
    path = tmp_path_factory.mktemp("rag")
    conn = _seed(path)
    idx = path / "idx"
    try:
        rag.build_index(conn, idx)
    except Exception as exc:  # model weights not available locally
        pytest.skip(f"embedding model unavailable: {exc}")
    return conn, idx


def test_scope_restricts_sources_to_in_scope_buildings(indexed):
    conn, idx = indexed
    res = rag.answer(
        "toiture", conn, building_ids=[1], client=llm.get_llm("mock"), index_dir=idx
    )
    assert res["sources"], "expected at least one in-scope chunk"
    assert all(s["building_id"] == 1 for s in res["sources"])


def test_stream_sources_match_nonstream(indexed):
    conn, idx = indexed
    mock = llm.get_llm("mock")
    frames = list(
        rag.answer_stream(
            "toiture", conn, building_ids=[1], client=mock, index_dir=idx
        )
    )
    assert frames[0]["type"] == "sources"
    assert frames[-1]["type"] == "done"
    assert any(f["type"] == "delta" for f in frames)
    stream_ids = [s["building_id"] for s in frames[0]["sources"]]
    non = rag.answer(
        "toiture", conn, building_ids=[1], client=mock, index_dir=idx
    )["sources"]
    assert stream_ids == [s["building_id"] for s in non]


def test_sources_are_enriched(indexed):
    conn, idx = indexed
    res = rag.answer(
        "toiture", conn, building_ids=[1], client=llm.get_llm("mock"), index_dir=idx
    )
    src = res["sources"][0]
    for key in (
        "document_id",
        "building_id",
        "snippet",
        "full_text",
        "score",
        "building_name",
        "commune",
    ):
        assert key in src
    assert len(src["snippet"]) <= 200
    assert src["building_name"] == "Esch Tower"
    assert src["commune"] == "Esch-sur-Alzette"


def test_legacy_single_building_path_unchanged(indexed):
    conn, idx = indexed
    # The AskBar path: a single building_id, no building_ids, no history.
    res = rag.answer(
        "toiture", conn, building_id=1, client=llm.get_llm("mock"), index_dir=idx
    )
    assert "answer" in res and "sources" in res
    assert all(s["building_id"] == 1 for s in res["sources"])
