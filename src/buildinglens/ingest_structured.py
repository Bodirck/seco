"""Structured building data ingestion from EUBUCCO v0.2 (Luxembourg).

Downloads the EUBUCCO parquet for the LU00 NUTS region, extracts a seeded
sample, reprojects WKB centroids from EPSG:3035 to WGS84, and inserts rows
into the buildings table. Falls back to fully synthetic data if the network
is unavailable, so the pipeline never hard-fails offline.
"""

from __future__ import annotations

import random
import sqlite3
import warnings
from functools import lru_cache
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Luxembourg street/place name material for synthetic address generation.
# All names and addresses generated here are SYNTHETIC. EUBUCCO provides no
# per-building names or addresses for Luxembourg. The lists below are derived
# from publicly known commune and street names solely to produce plausible
# placeholder data for demo purposes.
# ---------------------------------------------------------------------------

# Names match the official ACT COMMUNE spelling so the synthetic fallback stays
# consistent with the real commune boundaries.
_LU_COMMUNES = [
    "Luxembourg",
    "Esch-sur-Alzette",
    "Differdange",
    "Dudelange",
    "Ettelbruck",
    "Diekirch",
    "Wiltz",
    "Echternach",
    "Remich",
    "Grevenmacher",
    "Mersch",
    "Bettembourg",
    "Sanem",
    "Pétange",
    "Steinfort",
]

_LU_STREET_TYPES = ["Rue", "Avenue", "Boulevard", "Allée", "Route", "Chemin", "Place"]

_LU_STREET_NAMES = [
    "de la Liberté",
    "Grande-Duchesse Charlotte",
    "du Moulin",
    "des Champs",
    "de la Forêt",
    "des Roses",
    "du Parc",
    "de l'Eglise",
    "de la Gare",
    "des Artisans",
    "du Commerce",
    "de l'Europe",
    "des Nations",
    "du Château",
    "de la Vallée",
]

_LU_BUILDING_TYPES = [
    "Résidence",
    "Immeuble",
    "Bâtiment",
    "Complexe",
    "Centre",
    "Tour",
]

# EUBUCCO v0.2 LU00 parquet URL (anonymous, no auth required).
_EUBUCCO_URL = (
    "https://s3.eubucco.com/eubucco/v0.2/buildings/parquet/"
    "nuts_id=LU00/LU00.parquet"
)
_DEFAULT_CACHE_SUBPATH = Path("data") / "raw" / "eubucco_lu.parquet"


def _repo_root() -> Path:
    """Resolve the repository root (two levels above this file in src/buildinglens/)."""
    return Path(__file__).resolve().parents[2]


def _cache_path(cache_dir: str | Path | None) -> Path:
    if cache_dir is not None:
        return Path(cache_dir) / "eubucco_lu.parquet"
    return _repo_root() / _DEFAULT_CACHE_SUBPATH


def _download_parquet(dest: Path) -> None:
    """Download the EUBUCCO LU parquet to dest, showing a progress indicator."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading EUBUCCO LU00 parquet -> {dest} ...")
    with requests.get(_EUBUCCO_URL, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 20):  # 1 MB chunks
                fh.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    print(f"  {pct}% ({downloaded // (1 << 20)} MB / {total // (1 << 20)} MB)", end="\r")
    print(f"\nDownload complete: {dest.stat().st_size // (1 << 20)} MB")


def _build_transformer() -> Any:
    """Return a pyproj Transformer from EPSG:3035 to EPSG:4326."""
    from pyproj import Transformer

    return Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)


def _synthetic_name(rng: random.Random) -> str:
    """Return a synthetic but plausible Luxembourg building name (deterministic)."""
    btype = rng.choice(_LU_BUILDING_TYPES)
    suffix_words = ["du Nord", "du Sud", "de l'Est", "de l'Ouest", "Central", "Royal",
                    "Beaumont", "Bellevue", "Horizon", "Lumière", "Vert", "Bleu"]
    suffix = rng.choice(suffix_words)
    return f"{btype} {suffix}"


def _synthetic_address(rng: random.Random, commune: str | None = None) -> str:
    """Return a synthetic Luxembourg address (deterministic).

    The street, number and postcode are synthetic placeholders. The commune is the
    real one (resolved by point-in-polygon) when provided, and falls back to a random
    commune only when it could not be resolved. The fallback choice is always drawn
    so the rng sequence (hence the rest of the address) is stable either way.
    """
    number = rng.randint(1, 120)
    street_type = rng.choice(_LU_STREET_TYPES)
    street_name = rng.choice(_LU_STREET_NAMES)
    fallback_commune = rng.choice(_LU_COMMUNES)
    commune_name = commune or fallback_commune
    postcode = rng.randint(1000, 9999)
    return f"{number}, {street_type} {street_name}, {postcode} {commune_name}, Luxembourg"


def _insert_buildings(
    conn: sqlite3.Connection,
    rows: list[dict[str, Any]],
) -> list[int]:
    """Insert building rows and return the list of newly created ids."""
    cursor = conn.cursor()
    ids: list[int] = []
    for row in rows:
        cursor.execute(
            """
            INSERT INTO buildings
                (source_id, name, address, year_built, height_m, latitude, longitude, source, commune,
                 use_type, use_subtype, floors, footprint_area_m2, type_confidence)
            VALUES
                (:source_id, :name, :address, :year_built, :height_m, :latitude, :longitude, :source, :commune,
                 :use_type, :use_subtype, :floors, :footprint_area_m2, :type_confidence)
            """,
            row,
        )
        ids.append(cursor.lastrowid)
    conn.commit()
    return ids


def _geom_attrs(record: Any, geom: Any, transformer: Any) -> dict[str, Any]:
    """Geometry-derived building attributes from one EUBUCCO record and its parsed
    shapely geometry (EPSG:3035). Shared by the seeded sampler and the address point
    lookup. Returns everything EXCEPT the synthetic name/address.
    """
    from buildinglens import communes

    centroid = geom.centroid
    # always_xy=True: input (x=easting, y=northing), output (lon, lat).
    lon, lat = transformer.transform(centroid.x, centroid.y)

    height_raw = record.get("height")
    height_m = (
        float(height_raw) if height_raw is not None and str(height_raw) != "nan" else None
    )

    year_raw = record.get("construction_year")
    year_built: int | None = None
    if year_raw is not None:
        try:
            year_built = int(year_raw)
        except (ValueError, TypeError):
            pass

    geo_src = record.get("geometry_source")
    source_label = (
        f"EUBUCCO v0.2 / {geo_src}"
        if geo_src and str(geo_src) not in ("", "nan", "None")
        else "EUBUCCO v0.2 / gov-luxembourg"
    )

    # Real commune from the centroid (point-in-polygon against ACT boundaries).
    commune = communes.commune_for_point(lat, lon)

    # Real footprint area from the EPSG:3035 polygon (3035 is an equal-area metric
    # CRS, so .area is already in m2).
    try:
        _area = round(float(geom.area), 1)
    except Exception:
        _area = None
    footprint_area_m2 = _area if _area and _area > 0 else None

    type_raw = record.get("type")
    use_type = str(type_raw) if type_raw is not None and str(type_raw).lower() != "nan" else None
    subtype_raw = record.get("subtype")
    use_subtype = (
        str(subtype_raw) if subtype_raw is not None and str(subtype_raw).lower() != "nan" else None
    )
    floors_raw = record.get("floors")
    try:
        floors = (
            int(round(float(floors_raw)))
            if floors_raw is not None and str(floors_raw).lower() != "nan"
            else None
        )
    except (ValueError, TypeError):
        floors = None
    conf_raw = record.get("type_confidence")
    try:
        type_confidence = (
            round(float(conf_raw), 2)
            if conf_raw is not None and str(conf_raw).lower() != "nan"
            else None
        )
    except (ValueError, TypeError):
        type_confidence = None

    sid_raw = record.get("id")
    source_id = str(sid_raw) if sid_raw is not None else None

    return {
        "source_id": source_id,
        "year_built": year_built,
        "height_m": height_m,
        "latitude": lat,
        "longitude": lon,
        "source": source_label,
        "commune": commune,
        "use_type": use_type,
        "use_subtype": use_subtype,
        "floors": floors,
        "footprint_area_m2": footprint_area_m2,
        "type_confidence": type_confidence,
    }


def _parquet_rows(
    parquet_path: Path,
    sample_size: int,
    seed: int,
) -> list[dict[str, Any]]:
    """Read the cached parquet, sample rows, reproject, and return building dicts."""
    import pyarrow.parquet as pq
    from shapely import wkb as shapely_wkb

    transformer = _build_transformer()

    table = pq.read_table(parquet_path)
    df = table.to_pandas()

    # Deterministic sample using pandas sample (seeded).
    if len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=seed).reset_index(drop=True)

    # Name/address RNG: seeded per (seed, row_index) for full reproducibility.
    name_rng = random.Random(seed)

    rows: list[dict[str, Any]] = []
    for idx, record in df.iterrows():
        # Parse WKB geometry (EPSG:3035) and compute centroid.
        geom_raw = record.get("geometry")
        if geom_raw is None:
            continue

        # pyarrow may give bytes or a memoryview depending on version.
        if isinstance(geom_raw, memoryview):
            geom_raw = bytes(geom_raw)

        try:
            geom = shapely_wkb.loads(geom_raw)
        except Exception:
            continue

        attrs = _geom_attrs(record, geom, transformer)

        # EUBUCCO has no names or addresses for LU: name/street/number/postcode are
        # synthetic placeholders; the commune in the address is the real one above.
        name = _synthetic_name(name_rng)
        address = _synthetic_address(name_rng, commune=attrs["commune"])

        # source_id: use EUBUCCO's own id when present, else a positional label.
        if attrs["source_id"] is None:
            attrs["source_id"] = f"LU00-{idx}"

        rows.append({**attrs, "name": name, "address": address})

    return rows


def _synthetic_rows(
    sample_size: int,
    seed: int,
) -> list[dict[str, Any]]:
    """Generate fully synthetic Luxembourg building dicts when the real download fails.

    Coordinates are uniform-random within the LU bounding box:
      lat: 49.44 to 50.18
      lon: 5.73  to 6.53
    Heights are drawn from a realistic distribution (5 to 30 m).
    """
    rng = random.Random(seed)

    rows: list[dict[str, Any]] = []
    for i in range(sample_size):
        lat = rng.uniform(49.44, 50.18)
        lon = rng.uniform(5.73, 6.53)
        height_m = round(rng.uniform(5.0, 30.0), 1)
        name = _synthetic_name(rng)
        # Offline fallback: no boundaries to resolve a real commune, so the commune
        # field is None (honest). The address still shows a random commune string,
        # which is cosmetic and does not claim to be the building's real commune.
        address = _synthetic_address(rng)
        rows.append(
            {
                "source_id": f"synth-LU-{seed}-{i:04d}",
                "name": name,
                "address": address,
                "year_built": None,
                "height_m": height_m,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6),
                "source": "synthetic",
                "commune": None,
                # No real footprint offline, so area stays None (never fabricated).
                "use_type": None,
                "use_subtype": None,
                "floors": None,
                "footprint_area_m2": None,
                "type_confidence": None,
            }
        )

    return rows


def ingest_buildings(
    conn: sqlite3.Connection,
    sample_size: int = 40,
    seed: int = 0,
    cache_dir: str | Path | None = None,
) -> list[int]:
    """Download (or load from cache) EUBUCCO v0.2 LU buildings and insert into DB.

    Parameters
    ----------
    conn:
        Open SQLite connection (row factory set, FK on) with the schema already
        initialised. Use buildinglens.db.connect() + init_schema() before calling.
    sample_size:
        Number of buildings to ingest. Defaults to 40 for fast smoke runs.
    seed:
        Random seed for deterministic sampling and synthetic name/address generation.
    cache_dir:
        Directory for the cached parquet. Defaults to data/raw/ in the repo root.

    Returns
    -------
    list[int]
        The SQLite row ids of the inserted buildings.
    """
    dest = _cache_path(cache_dir)

    # --- Attempt real download (skip if already cached). ---
    if not dest.exists():
        try:
            _download_parquet(dest)
        except Exception as exc:
            warnings.warn(
                f"[ingest_structured] EUBUCCO download failed: {exc}. "
                "Falling back to fully synthetic Luxembourg buildings.",
                stacklevel=2,
            )
            return _insert_buildings(conn, _synthetic_rows(sample_size, seed))

    # --- Parse parquet and ingest. ---
    try:
        return _insert_buildings(conn, _parquet_rows(dest, sample_size, seed))
    except Exception as exc:
        warnings.warn(
            f"[ingest_structured] Parquet parse failed: {exc}. "
            "Falling back to fully synthetic Luxembourg buildings.",
            stacklevel=2,
        )
        return _insert_buildings(conn, _synthetic_rows(sample_size, seed))


def read_candidates(
    sample_size: int = 200,
    seed: int = 1,
    cache_dir: str | Path | None = None,
) -> list[dict[str, Any]]:
    """Return candidate building dicts from the public registry WITHOUT inserting.

    Uses the cached EUBUCCO parquet if present and never downloads on this path, so
    it is safe to call from a web request; falls back to synthetic dicts otherwise.
    A seed distinct from the main parc keeps these candidates disjoint from the
    buildings the pipeline already loaded.
    """
    dest = _cache_path(cache_dir)
    if dest.exists():
        try:
            return _parquet_rows(dest, sample_size, seed)
        except Exception as exc:
            warnings.warn(
                f"[ingest_structured] Parquet read failed: {exc}. Using synthetic candidates.",
                stacklevel=2,
            )
    return _synthetic_rows(sample_size, seed)


@lru_cache(maxsize=2)
def candidate_pool(sample_size: int = 200, seed: int = 1) -> list[dict[str, Any]]:
    """Cached candidate pool so the parquet is read at most once per process."""
    return read_candidates(sample_size=sample_size, seed=seed)


def find_candidate(source_id: str) -> dict[str, Any] | None:
    """Find a candidate by its source_id within the cached pool.

    Calls candidate_pool() with no arguments so it shares the exact lru_cache entry
    the registry endpoints use; this guarantees a building shown in search resolves
    here on ingest (same pool, computed once per process).
    """
    return next(
        (c for c in candidate_pool() if str(c.get("source_id")) == str(source_id)),
        None,
    )


# ---------------------------------------------------------------------------
# Address point lookup: which EUBUCCO footprint contains a geocoded point.
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _eubucco_arrays(parquet_str: str) -> Any:
    """Load EUBUCCO bounding boxes (EPSG:3035), the raw WKB column and the attribute
    columns, once. We index on the precomputed bbox so a point lookup never has to
    parse all 186k geometries: a vectorised numpy bbox filter narrows to a handful
    of candidates, and only those are parsed. Cached for the process lifetime.
    """
    import numpy as np
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    cols = [
        "geometry", "bbox", "height", "floors", "type", "subtype",
        "type_confidence", "construction_year", "geometry_source", "id",
    ]
    table = pq.read_table(parquet_str, columns=cols)
    bbox = table.column("bbox")
    bounds = {
        k: pc.struct_field(bbox, k).to_numpy(zero_copy_only=False)
        for k in ("xmin", "ymin", "xmax", "ymax")
    }
    wkb_col = table.column("geometry")  # parsed lazily, candidate by candidate
    attrs = table.drop(["geometry", "bbox"]).to_pandas()
    return bounds, wkb_col, attrs, np


def find_building_at_point(
    lat: float,
    lon: float,
    cache_dir: str | Path | None = None,
    max_snap_m: float = 40.0,
) -> dict[str, Any] | None:
    """Find the EUBUCCO building footprint at a WGS84 (lat, lon).

    Returns the geometry-derived building dict (no name/address), or None when the
    parquet is absent, or no footprint covers the point and none is within
    max_snap_m of it. Read-only and safe to call from a web request (no download).
    """
    dest = _cache_path(cache_dir)
    if not dest.exists():
        return None
    try:
        import shapely
        from pyproj import Transformer

        bounds, wkb_col, attrs, np = _eubucco_arrays(str(dest))
        to_3035 = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
        x, y = to_3035.transform(lon, lat)  # always_xy: (lon, lat) -> (easting, northing)
        point = shapely.Point(x, y)

        def parse(i: int) -> Any:
            return shapely.from_wkb(wkb_col[i].as_py())

        # 1) Footprints whose bbox covers the point: parse only those, take the
        #    first that truly contains it.
        covering = np.nonzero(
            (bounds["xmin"] <= x)
            & (x <= bounds["xmax"])
            & (bounds["ymin"] <= y)
            & (y <= bounds["ymax"])
        )[0]
        for i in covering:
            geom = parse(int(i))
            if geom.covers(point):
                return _geom_attrs(attrs.iloc[int(i)], geom, _build_transformer())

        # 2) Fallback: the nearest footprint within max_snap_m (search a small bbox
        #    window so a point that lands just off a building still snaps to it).
        window = np.nonzero(
            (bounds["xmin"] <= x + max_snap_m)
            & (bounds["xmax"] >= x - max_snap_m)
            & (bounds["ymin"] <= y + max_snap_m)
            & (bounds["ymax"] >= y - max_snap_m)
        )[0]
        best_i: int | None = None
        best_d = max_snap_m
        best_geom = None
        for i in window:
            geom = parse(int(i))
            d = geom.distance(point)
            if d <= best_d:
                best_d, best_i, best_geom = d, int(i), geom
        if best_i is not None:
            return _geom_attrs(attrs.iloc[best_i], best_geom, _build_transformer())
        return None
    except Exception as exc:
        warnings.warn(f"[ingest_structured] point lookup failed: {exc}", stacklevel=2)
        return None


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import tempfile

    from buildinglens.db import connect, init_schema

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        tmp_path = Path(tmp)
        db_conn = connect(tmp_path / "smoke.db")
        init_schema(db_conn)

        print("Running ingest_buildings (real download, sample_size=40, seed=0) ...")
        inserted_ids = ingest_buildings(db_conn, sample_size=40, seed=0, cache_dir=tmp_path)

        print(f"\nInserted {len(inserted_ids)} buildings (ids {inserted_ids[0]}..{inserted_ids[-1]}).")

        # Print one sample row.
        row = db_conn.execute(
            "SELECT name, latitude, longitude, height_m, source FROM buildings LIMIT 1"
        ).fetchone()
        print("\nSample row:")
        print(f"  name      : {row['name']}")
        print(f"  latitude  : {row['latitude']:.5f}")
        print(f"  longitude : {row['longitude']:.5f}")
        print(f"  height_m  : {row['height_m']}")
        print(f"  source    : {row['source']}")

        # Close the connection before the temp dir cleanup to avoid the
        # Windows file-lock error (SQLite WAL / journal files).
        db_conn.close()
