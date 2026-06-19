"""Tests for the commune point-in-polygon mapping (real ACT boundaries)."""

from __future__ import annotations

from buildinglens.communes import commune_for_point, commune_index


def test_capital_maps_to_luxembourg():
    assert commune_for_point(49.6116, 6.1319) == "Luxembourg"


def test_esch_maps_to_esch_sur_alzette():
    assert commune_for_point(49.4958, 5.9806) == "Esch-sur-Alzette"


def test_point_outside_luxembourg_is_none():
    assert commune_for_point(0.0, 0.0) is None


def test_coordinate_order_is_lat_lon():
    # Passing (lon, lat) by mistake lands outside Luxembourg, so it must be None,
    # which guards against a swapped-argument regression.
    assert commune_for_point(6.1319, 49.6116) is None


def test_index_loads_real_boundaries():
    idx = commune_index()
    assert idx.is_synthetic is False
    # 100 features in the file, minus the non-commune "Lac de la Haute-Sûre" territory.
    assert len(idx.names) == 99
    assert "Lac de la Haute-Sûre" not in idx.names
