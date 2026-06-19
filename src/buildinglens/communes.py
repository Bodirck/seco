"""Map a coordinate to its real Luxembourg commune via point-in-polygon.

Source: ACT (Administration du cadastre et de la topographie) commune boundaries,
published on data.public.lu under CC0, retrieved 2026-06-19 (100 current communes,
EPSG:4326, property COMMUNE). EUBUCCO provides no commune per building, so the
commune is DERIVED here from each building's real centroid; names and street
addresses stay synthetic.

The committed reference copy under data/reference/ keeps the build offline and
byte-for-byte reproducible. If it is ever missing, a deterministic synthetic grid
keyed by the synthetic commune list is used instead, flagged via is_synthetic.
"""

from __future__ import annotations

import json
import math
import warnings
from functools import lru_cache
from pathlib import Path
from typing import Any, NamedTuple

# Committed reference copy (outside the gitignored data/raw/), then an optional
# refreshed copy. Version-stable permalink (302s to the dated file) for manual refresh:
# https://data.public.lu/fr/datasets/r/16103fa4-7ff1-486a-88bc-5018353957ea
_REFERENCE_RELPATH = Path("data") / "reference" / "lu_communes_4326.geojson"
_RAW_RELPATH = Path("data") / "raw" / "lu_communes.geojson"

# Luxembourg bounding box, matching the synthetic fallback in ingest_structured.
_LU_BBOX = (49.44, 50.18, 5.73, 6.53)  # lat_min, lat_max, lon_min, lon_max


class CommuneIndex(NamedTuple):
    tree: Any  # shapely.strtree.STRtree
    geoms: list[Any]
    names: list[str]
    is_synthetic: bool


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_geojson_path() -> Path | None:
    """Prefer the committed reference file, then an optional refreshed cache."""
    for rel in (_REFERENCE_RELPATH, _RAW_RELPATH):
        p = _repo_root() / rel
        if p.exists():
            return p
    return None


def _load_real() -> tuple[list[str], list[Any]] | None:
    """Load commune names + validated geometries from the official GeoJSON."""
    path = _resolve_geojson_path()
    if path is None:
        return None
    try:
        from shapely.geometry import shape
        from shapely.validation import make_valid

        data = json.loads(path.read_text(encoding="utf-8"))
        names: list[str] = []
        geoms: list[Any] = []
        for feat in data.get("features", []):
            props = feat.get("properties") or {}
            name = props.get("COMMUNE")
            geom_json = feat.get("geometry")
            if not name or geom_json is None:
                continue
            geom = shape(geom_json)
            if not geom.is_valid:
                try:
                    geom = make_valid(geom)
                except Exception:
                    geom = geom.buffer(0)
            names.append(str(name))
            geoms.append(geom)
        if names:
            return names, geoms
    except Exception as exc:
        warnings.warn(f"[communes] failed to load boundaries: {exc}", stacklevel=2)
    return None


def _synthetic_grid() -> tuple[list[str], list[Any]]:
    """Deterministic grid over the LU bbox keyed by the synthetic commune list.

    Only used when the official boundaries are unavailable, so the feature degrades
    gracefully offline rather than hard-failing. Disclosed via is_synthetic.
    """
    from shapely.geometry import box

    from buildinglens.ingest_structured import _LU_COMMUNES

    lat_min, lat_max, lon_min, lon_max = _LU_BBOX
    n = len(_LU_COMMUNES)
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    dlat = (lat_max - lat_min) / rows
    dlon = (lon_max - lon_min) / cols

    names: list[str] = []
    geoms: list[Any] = []
    k = 0
    for r in range(rows):
        for c in range(cols):
            if k >= n:
                break
            cell = box(
                lon_min + c * dlon,
                lat_min + r * dlat,
                lon_min + (c + 1) * dlon,
                lat_min + (r + 1) * dlat,
            )
            names.append(_LU_COMMUNES[k])
            geoms.append(cell)
            k += 1
    return names, geoms


@lru_cache(maxsize=1)
def commune_index() -> CommuneIndex:
    """Build the commune spatial index once per process (real, else synthetic)."""
    from shapely.strtree import STRtree

    loaded = _load_real()
    if loaded is not None:
        names, geoms = loaded
        return CommuneIndex(STRtree(geoms), geoms, names, False)

    warnings.warn(
        "[communes] official boundaries unavailable; using a synthetic commune grid.",
        stacklevel=2,
    )
    names, geoms = _synthetic_grid()
    return CommuneIndex(STRtree(geoms), geoms, names, True)


def commune_for_point(lat: float | None, lon: float | None) -> str | None:
    """Return the commune containing (lat, lon), or None if no polygon contains it.

    Builds Point(lon, lat) to match the always-xy ordering ingest_structured uses.
    The STRtree query returns candidate indices (shapely >= 2.0); each candidate is
    re-tested with contains() so a bounding-box hit is never mistaken for a real one.
    """
    if lat is None or lon is None:
        return None
    from shapely.geometry import Point

    idx = commune_index()
    point = Point(lon, lat)
    for i in idx.tree.query(point):
        j = int(i)
        if idx.geoms[j].contains(point):
            return idx.names[j]
    return None
