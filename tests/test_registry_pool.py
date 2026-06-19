"""Lock the registry invariant: a building shown in search resolves on ingest.

The registry search endpoints read ingest_structured.candidate_pool(), and ingest
resolves the chosen building via find_candidate(). If those two ever read different
pools, a searched building would 404 on import. This guards that they share one pool.
"""

from __future__ import annotations

from buildinglens.ingest_structured import candidate_pool, find_candidate


def test_search_candidate_resolves_on_ingest():
    pool = candidate_pool()
    assert pool, "candidate pool should not be empty"
    sample = pool[0]
    assert find_candidate(sample["source_id"]) is not None


def test_candidates_carry_a_commune_field():
    # Every candidate exposes the commune key (real value or None), so the API and
    # the ingest insert never KeyError on it.
    pool = candidate_pool()
    assert all("commune" in c for c in pool)
