"""Address geocoding via the official Luxembourg geocoder (geoportail.lu).

Turns a free-text address into WGS84 coordinates so an uploaded inspection report
can be placed on the map and matched to its real EUBUCCO footprint. The service is
public, needs no API key, and covers Luxembourg addresses well. Any network error
or empty result returns None so callers degrade gracefully (the import still works,
just without geo-enrichment).
"""

from __future__ import annotations

_GEOCODER_URL = "https://apiv4.geoportail.lu/geocode/search"


def geocode_lu(address: str, timeout: float = 10.0) -> tuple[float, float] | None:
    """Geocode a Luxembourg address to (lat, lon) in WGS84, or None.

    Returns the best match's latitude/longitude. Returns None on a blank address,
    a network/HTTP error, or no result, so the caller can fall back cleanly.
    """
    address = (address or "").strip()
    if not address:
        return None

    import requests

    try:
        resp = requests.get(
            _GEOCODER_URL, params={"queryString": address}, timeout=timeout
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    results = data.get("results") if isinstance(data, dict) else None
    if not results:
        return None

    coords = (results[0].get("geomlonlat") or {}).get("coordinates")
    if not coords or len(coords) != 2:
        return None

    try:
        lon, lat = float(coords[0]), float(coords[1])
    except (TypeError, ValueError):
        return None
    return (lat, lon)
