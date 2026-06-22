"""Unit tests for the import duplicate-detection logic (buildinglens.dedup).

Pure-stdlib, no model and no DB: these exercise the normalization, the distance
helper, and the block-vs-show decision that the import guardrail relies on.
"""

from __future__ import annotations

from buildinglens import dedup


# --------------------------------------------------------------------------- #
# Normalization
# --------------------------------------------------------------------------- #


def test_norm_name_folds_accents_case_punct_whitespace():
    assert dedup.norm_name("  Ecole   Fondamentale! ") == "ecole fondamentale"
    # Accented and unaccented spellings collapse to the same string.
    assert dedup.norm_name("École Fondamentale") == dedup.norm_name("ecole fondamentale")


def test_norm_addr_folds_abbrev_and_drops_country_tag():
    a = dedup.norm_addr("10, R. de la Gare, Esch-sur-Alzette, Luxembourg")
    b = dedup.norm_addr("10 rue de la gare esch sur alzette")
    assert a == b == "10 rue de la gare esch sur alzette"


def test_norm_addr_empty_stays_empty():
    assert dedup.norm_addr("") == ""
    assert dedup.norm_addr(None) == ""


def test_norm_addr_drops_postal_code_keeps_house_number():
    # The postcode is dropped so the same address with or without it normalizes equal.
    assert dedup.norm_addr("10 rue de la gare, 4131 esch-sur-alzette") == dedup.norm_addr(
        "10 rue de la gare, esch-sur-alzette"
    )
    # The house number (1-3 digits) is preserved.
    assert dedup.norm_addr("10 rue de la gare").split()[0] == "10"


def test_name_ratio_identical_and_distinct():
    assert dedup.name_ratio("Ecole Fondamentale", "ecole  fondamentale") == 1.0
    assert dedup.name_ratio("ecole fondamentale", "ecole maternelle") < dedup._NAME_SHOW_RATIO
    # An empty side never scores.
    assert dedup.name_ratio("", "anything") == 0.0


# --------------------------------------------------------------------------- #
# Distance
# --------------------------------------------------------------------------- #


def test_haversine_zero_close_far_and_none():
    assert dedup.haversine_m(49.5, 6.0, 49.5, 6.0) == 0.0
    # ~22 m east at this latitude: within the nearby band.
    assert dedup.haversine_m(49.5, 6.0, 49.5, 6.0003) is not None
    assert dedup.haversine_m(49.5, 6.0, 49.5, 6.0003) <= dedup._NEARBY_M
    # ~72 m east: outside it.
    assert dedup.haversine_m(49.5, 6.0, 49.5, 6.001) > dedup._NEARBY_M
    # Any missing coordinate yields None rather than raising.
    assert dedup.haversine_m(None, 6.0, 49.5, 6.0) is None
    assert dedup.haversine_m(49.5, 6.0, 49.5, None) is None


# --------------------------------------------------------------------------- #
# find_duplicates: block vs show
# --------------------------------------------------------------------------- #


def _existing(**over):
    base = {
        "id": 1,
        "name": "Ecole Fondamentale",
        "address": "10, Rue de la Gare, Esch-sur-Alzette, Luxembourg",
        "commune": "Esch-sur-Alzette",
        "source": "EUBUCCO v0.2 / gov-luxembourg",
        "source_id": "LU00-1",
        "risk_score": 31.0,
        "latitude": 49.5,
        "longitude": 6.0,
        "height_m": 8.0,
        "footprint_area_m2": 500.0,
    }
    base.update(over)
    return base


def _candidate(**over):
    base = {
        "name": "ecole  fondamentale!",
        "address": "10 r. de la gare, esch sur alzette",
        "source_id": "LU00-1",
        "latitude": 49.5,
        "longitude": 6.0,
        "height_m": 8.0,
        "footprint_area_m2": 500.0,
    }
    base.update(over)
    return base


def test_block_on_same_footprint_name_and_address():
    blocked, cands = dedup.find_duplicates(_candidate(), [_existing()])
    assert blocked is True
    assert cands[0]["id"] == 1
    assert cands[0]["strength"] == "exact"
    for reason in ("same_footprint", "same_name", "same_address", "same_volume"):
        assert reason in cands[0]["reasons"]


def test_no_block_on_different_name_but_shows_footprint():
    blocked, cands = dedup.find_duplicates(
        _candidate(name="Maison Communale"), [_existing()]
    )
    assert blocked is False
    assert cands and cands[0]["id"] == 1
    assert cands[0]["strength"] == "similar"
    assert "same_footprint" in cands[0]["reasons"]
    assert "same_name" not in cands[0]["reasons"]


def test_no_block_on_different_source_id_even_if_name_and_address_match():
    # Same generic name + same street but a different footprint: never block,
    # only show (this guards the campus / shared-address false-positive case).
    blocked, cands = dedup.find_duplicates(
        _candidate(source_id="LU00-9"), [_existing(source_id="LU00-1")]
    )
    assert blocked is False
    assert cands and "same_name" in cands[0]["reasons"]
    assert "same_address" in cands[0]["reasons"]
    assert "same_footprint" not in cands[0]["reasons"]


def test_block_when_address_differs_only_by_postal_or_sparseness():
    # Same footprint + same name, but the re-import typed a sparser address (no
    # postcode/commune). This must STILL block: requiring an exact address match here
    # was the false-negative that recreated ids 43/44.
    blocked, cands = dedup.find_duplicates(
        _candidate(address="10 rue de la gare"),
        [_existing(address="10 rue de la gare, 4131 esch-sur-alzette")],
    )
    assert blocked is True
    assert cands[0]["id"] == 1 and cands[0]["strength"] == "exact"


def test_block_on_same_footprint_and_name_even_without_address():
    # No address typed on either side: the shared footprint + name is enough to block.
    blocked, cands = dedup.find_duplicates(
        _candidate(address=None), [_existing(address=None)]
    )
    assert blocked is True
    assert cands[0]["strength"] == "exact"


def test_no_block_for_name_only_import_without_footprint():
    # No geocode match: source_id/coords absent. A matching name alone must not block.
    cand = _candidate(source_id=None, latitude=None, longitude=None, height_m=None, footprint_area_m2=None)
    blocked, cands = dedup.find_duplicates(cand, [_existing()])
    assert blocked is False
    assert cands and "same_name" in cands[0]["reasons"]


def test_no_candidates_when_nothing_matches():
    other = _existing(
        id=2, name="Tour du Nord", address="99 avenue de France, Luxembourg",
        source_id="LU00-2", latitude=49.6, longitude=6.1,
    )
    blocked, cands = dedup.find_duplicates(
        _candidate(name="Residence du Parc", address="3 place de Paris", source_id="LU00-7",
                   latitude=49.4, longitude=5.9),
        [other],
    )
    assert blocked is False
    assert cands == []


def test_ranking_puts_exact_first_and_caps_at_five():
    # One exact duplicate plus several nearby-only neighbours.
    rows = [_existing(id=1)]
    for i in range(2, 9):
        rows.append(
            _existing(
                id=i, name=f"Voisin {i}", address=f"{i} rue Voisine",
                source_id=f"LU00-{i}", latitude=49.5, longitude=6.0,
            )
        )
    blocked, cands = dedup.find_duplicates(_candidate(), rows)
    assert blocked is True
    assert cands[0]["id"] == 1 and cands[0]["strength"] == "exact"
    assert len(cands) <= 5
