"""STATEC / LUSTAT building-permits ingestion (aggregate sector context).

Fetches the DF_D4113 dataflow (dwellings authorised by canton and type, annual)
from the LUSTAT SDMX REST API. This is aggregate context only; it is never joined
to individual buildings in the DB.

Public API
----------
fetch_permits(start_year, dataflow) -> pandas.DataFrame
cache_permits(df, path)             -> Path
permits_summary(df)                 -> dict
"""

from __future__ import annotations

import io
import warnings
from pathlib import Path

import pandas as pd
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SDMX_BASE = "https://lustat.statec.lu/rest/data"
_ACCEPT_HEADER = "application/vnd.sdmx.data+csv;urn=true;file=true;labels=both"
_DEFAULT_DATAFLOW = "DF_D4113"
_REQUEST_TIMEOUT = 30  # seconds

# Column name fragments used for defensive lookup (the API includes label suffixes).
_COL_CANTON = "CANTON"
_COL_PERIOD = "TIME_PERIOD"
_COL_OBS = "OBS_VALUE"

# Seed for reproducible synthetic fallback.
_SEED = 42


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_col(df: pd.DataFrame, fragment: str) -> str | None:
    """Return the first column whose name contains *fragment* (case-insensitive)."""
    fragment_lower = fragment.lower()
    for col in df.columns:
        if fragment_lower in col.lower():
            return col
    return None


def _synthetic_permits(start_year: int = 2010) -> pd.DataFrame:
    """Return a small, clearly labelled synthetic dataset.

    Used only when the real API is unreachable so that downstream context
    never hard-fails offline. The data is deterministic (fixed seed).
    """
    import random

    rng = random.Random(_SEED)
    cantons = [
        "VDL: Luxembourg city",
        "ESC: Canton Esch",
        "LUX: Canton Luxembourg (except Luxembourg City)",
        "CPL: Canton Capellen",
        "GRE: Canton Grevenmacher",
    ]
    years = list(range(max(start_year, 2015), 2026))
    rows = []
    for canton in cantons:
        for year in years:
            rows.append(
                {
                    "DATAFLOW": "LU1:DF_D4113(1.0) [SYNTHETIC]",
                    "REF_AREA: Reference area": "LU: Luxembourg",
                    "CANTON: Canton": canton,
                    "FREQ: Frequency": "A: Annual",
                    "PRODUCT_BCS: Building type": "CPA_F41001: Residential buildings",
                    "INDICATOR_BCS: BCS Indicator": "PNUM: Number of dwellings",
                    "TIME_PERIOD: Time period": year,
                    "OBS_VALUE": rng.randint(200, 1200),
                    "_synthetic": True,
                }
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------


def fetch_permits(
    start_year: int = 2010,
    dataflow: str = _DEFAULT_DATAFLOW,
) -> pd.DataFrame:
    """Fetch dwellings-authorised data from the LUSTAT SDMX REST API.

    Parameters
    ----------
    start_year:
        First year to include (passed as the SDMX ``startPeriod`` query param).
    dataflow:
        SDMX dataflow identifier. Defaults to DF_D4113 (dwellings by canton
        and type, annual).

    Returns
    -------
    pandas.DataFrame
        Raw SDMX CSV parsed into a DataFrame. If the request fails, returns a
        clearly labelled synthetic fallback and prints a warning.
    """
    url = f"{_SDMX_BASE}/LU1,{dataflow}/all"
    headers = {"Accept": _ACCEPT_HEADER}
    params = {"startPeriod": str(start_year)}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        if df.empty:
            raise ValueError("Empty response from LUSTAT API.")
        return df
    except Exception as exc:
        warnings.warn(
            f"LUSTAT API unavailable ({exc}). Returning synthetic permits data.",
            UserWarning,
            stacklevel=2,
        )
        return _synthetic_permits(start_year=start_year)


def cache_permits(
    df: pd.DataFrame | None = None,
    path: str | Path = "data/raw/statec_permits.csv",
) -> Path:
    """Write permits DataFrame to CSV, fetching first if *df* is None.

    Parameters
    ----------
    df:
        DataFrame to persist. If None, ``fetch_permits()`` is called.
    path:
        Destination path. Parent directories are created automatically.

    Returns
    -------
    Path
        Absolute path to the written CSV file.
    """
    if df is None:
        df = fetch_permits()

    dest = Path(path)
    # Resolve relative paths against cwd so the caller gets a stable absolute path.
    if not dest.is_absolute():
        dest = Path.cwd() / dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(dest, index=False)
    return dest


def permits_summary(df: pd.DataFrame) -> dict:
    """Compute a small, robust summary for display as sector context.

    Defensively handles any column naming variation (the SDMX CSV includes
    label suffixes such as ": Time period" after the code name).

    Returns
    -------
    dict with keys:
        latest_year (int | None),
        total_permits_latest_year (int | None),
        by_canton (dict[str, int]),
        is_synthetic (bool),
        row_count (int),
        col_count (int)
    """
    period_col = _find_col(df, _COL_PERIOD)
    obs_col = _find_col(df, _COL_OBS)
    canton_col = _find_col(df, _COL_CANTON)

    summary: dict = {
        "row_count": len(df),
        "col_count": len(df.columns),
        "is_synthetic": bool("_synthetic" in df.columns),
        "latest_year": None,
        "total_permits_latest_year": None,
        "by_canton": {},
    }

    if period_col is None or obs_col is None:
        return summary

    # Coerce to numeric, ignoring unparseable values.
    df = df.copy()
    df[period_col] = pd.to_numeric(df[period_col], errors="coerce")
    df[obs_col] = pd.to_numeric(df[obs_col], errors="coerce")
    df = df.dropna(subset=[period_col, obs_col])

    if df.empty:
        return summary

    latest_year = int(df[period_col].max())
    latest = df[df[period_col] == latest_year]
    total_latest = int(latest[obs_col].sum())

    summary["latest_year"] = latest_year
    summary["total_permits_latest_year"] = total_latest

    if canton_col is not None:
        by_canton: dict[str, int] = (
            latest.groupby(canton_col)[obs_col]
            .sum()
            .astype(int)
            .sort_values(ascending=False)
            .to_dict()
        )
        summary["by_canton"] = by_canton

    return summary


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import tempfile

    print("=== statec.py smoke test ===")

    # 1. Fetch from real API (or fallback).
    print("\n[1] Calling fetch_permits(start_year=2015) ...")
    df = fetch_permits(start_year=2015)
    print(f"    DataFrame shape : {df.shape}")
    print(f"    Columns         : {list(df.columns)}")
    synthetic_flag = "_synthetic" in df.columns
    print(f"    Synthetic data  : {synthetic_flag}")

    # 2. Cache to a temp dir.
    with tempfile.TemporaryDirectory() as tmp:
        dest = cache_permits(df=df, path=Path(tmp) / "permits.csv")
        on_disk = pd.read_csv(dest)
        print(f"\n[2] Cached to {dest}")
        print(f"    Re-read shape   : {on_disk.shape}")

    # 3. Summary.
    summary = permits_summary(df)
    print("\n[3] permits_summary():")
    for k, v in summary.items():
        if k == "by_canton":
            print(f"    by_canton (top 5): {dict(list(v.items())[:5])}")
        else:
            print(f"    {k}: {v}")

    print("\n=== Done ===")
