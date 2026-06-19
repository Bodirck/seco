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
                (source_id, name, address, year_built, height_m, latitude, longitude, source, commune)
            VALUES
                (:source_id, :name, :address, :year_built, :height_m, :latitude, :longitude, :source, :commune)
            """,
            row,
        )
        ids.append(cursor.lastrowid)
    conn.commit()
    return ids


def _parquet_rows(
    parquet_path: Path,
    sample_size: int,
    seed: int,
) -> list[dict[str, Any]]:
    """Read the cached parquet, sample rows, reproject, and return building dicts."""
    import pyarrow.parquet as pq
    from shapely import wkb as shapely_wkb

    from buildinglens import communes

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

        centroid = geom.centroid
        # always_xy=True means: input is (x=easting, y=northing), output is (lon, lat).
        lon, lat = transformer.transform(centroid.x, centroid.y)

        # Height is well-covered for Luxembourg in EUBUCCO.
        height_raw = record.get("height")
        height_m = float(height_raw) if height_raw is not None and str(height_raw) != "nan" else None

        # Construction year is nearly always null for LU in EUBUCCO.
        year_raw = record.get("construction_year")
        year_built: int | None = None
        if year_raw is not None:
            try:
                year_built = int(year_raw)
            except (ValueError, TypeError):
                pass

        # Source provenance: prefer geometry_source column, else default label.
        geo_src = record.get("geometry_source")
        source_label = (
            f"EUBUCCO v0.2 / {geo_src}"
            if geo_src and str(geo_src) not in ("", "nan", "None")
            else "EUBUCCO v0.2 / gov-luxembourg"
        )

        # Real commune from the centroid (point-in-polygon against ACT boundaries).
        commune = communes.commune_for_point(lat, lon)

        # EUBUCCO has no names or addresses for LU: name/street/number/postcode are
        # synthetic placeholders; the commune in the address is the real one above.
        name = _synthetic_name(name_rng)
        address = _synthetic_address(name_rng, commune=commune)

        # source_id: use EUBUCCO's own id column if present, else a positional label.
        sid_raw = record.get("id")
        source_id = str(sid_raw) if sid_raw is not None else f"LU00-{idx}"

        rows.append(
            {
                "source_id": source_id,
                "name": name,
                "address": address,
                "year_built": year_built,
                "height_m": height_m,
                "latitude": lat,
                "longitude": lon,
                "source": source_label,
                "commune": commune,
            }
        )

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
