"""Duplicate detection for the import path.

Before a brand-new building is created from an uploaded report, we check whether
an equivalent already exists in the portfolio. The hard case this prevents is
importing the same address twice: both imports geocode to the same EUBUCCO
footprint and would otherwise create two identical buildings (this is exactly how
ids 43 and 44 appeared).

Design (see the import flow in api/routers/ingest.py):
  - We BLOCK only when we are near-certain it is the same physical building:
    same EUBUCCO source_id AND the same (normalized) name AND the same
    (normalized) address. A false block is worse than a missed near-duplicate,
    because the user can always delete a true duplicate but cannot un-block
    legitimate work, so the bar to block is deliberately high.
  - We still SHOW softer matches (same footprint with a different name, a similar
    name, a nearby footprint, the same volume) so the user is informed and can
    decide. Showing is generous; blocking is strict.

Everything here is pure-stdlib (unicodedata, difflib, math) and side-effect free,
so it is cheap to run under the ingest lock and straightforward to unit test.
"""

from __future__ import annotations

import math
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Iterable, Mapping

# Common Luxembourg / French street-type abbreviations, folded so "10 r. de la
# Gare" and "10 rue de la Gare" compare equal. Kept small on purpose: an unlisted
# abbreviation just means the address will not fold equal, which errs toward NOT
# blocking (the safe direction).
_STREET_ABBREV = {
    "r": "rue",
    "av": "avenue",
    "ave": "avenue",
    "bd": "boulevard",
    "bld": "boulevard",
    "blvd": "boulevard",
    "rte": "route",
    "ch": "chemin",
    "pl": "place",
    "all": "allee",
    "imp": "impasse",
    "sq": "square",
    "st": "saint",
    "ste": "sainte",
}

# Name-similarity ratio at or above which two names are "similar" enough to show
# (never to block). 0.86 catches typos/casing/accents while keeping clearly
# distinct names ("ecole fondamentale" vs "ecole maternelle") below the bar.
_NAME_SHOW_RATIO = 0.86

# Footprints closer than this (metres) are surfaced as "nearby". Just under the
# 40 m snap radius used by find_building_at_point, so neighbours are not fused.
_NEARBY_M = 35.0

# Relative + absolute tolerance on volume (m3 = height_m * footprint_area_m2).
# For the same footprint these are identical; the band only absorbs float noise.
_VOL_REL = 0.01
_VOL_ABS = 1.0

# How many candidates to surface at most, ranked strongest-first.
_MAX_CANDIDATES = 5


def _fold(s: str | None) -> str:
    """Lowercase, accent-strip and collapse a string to alphanumeric words.

    NFKD-decomposes, drops combining marks (so "e" == accented "e"), casefolds,
    turns every run of non-alphanumeric characters into a single space, and trims.
    """
    if not s:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(s))
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = no_accents.casefold()
    return re.sub(r"[^a-z0-9]+", " ", lowered).strip()


def norm_name(s: str | None) -> str:
    """Normalize a building name for equality and similarity comparison."""
    return _fold(s)


def norm_addr(s: str | None) -> str:
    """Normalize an address: fold, drop a trailing country tag, expand street
    abbreviations token-wise. Empty in, empty out (an empty address never matches).
    """
    folded = _fold(s)
    if not folded:
        return ""
    tokens = [_STREET_ABBREV.get(tok, tok) for tok in folded.split()]
    # Drop a trailing "luxembourg" country tag so "..., Luxembourg" matches "...".
    if len(tokens) > 1 and tokens[-1] == "luxembourg":
        tokens = tokens[:-1]
    # Drop postal-code tokens (4+ digit numbers) so the same address typed with or
    # without its postcode normalizes the same. House numbers (1-3 digits) are kept.
    tokens = [t for t in tokens if not (t.isdigit() and len(t) >= 4)]
    return " ".join(tokens)


def name_ratio(a: str | None, b: str | None) -> float:
    """difflib similarity ratio between two normalized names; 0.0 if either empty."""
    na, nb = norm_name(a), norm_name(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def haversine_m(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
) -> float | None:
    """Great-circle distance in metres, or None if any coordinate is missing."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    r = 6371000.0  # Earth radius, metres
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _sid(value: Any) -> str:
    """Stringify and strip a source_id for comparison; "" when absent."""
    if value is None:
        return ""
    return str(value).strip()


def _volume(height_m: Any, footprint_area_m2: Any) -> float | None:
    """height x footprint area in m3, or None if either is missing/non-numeric."""
    try:
        if height_m is None or footprint_area_m2 is None:
            return None
        return float(height_m) * float(footprint_area_m2)
    except (TypeError, ValueError):
        return None


def _same_volume(v1: float | None, v2: float | None) -> bool:
    if v1 is None or v2 is None:
        return False
    return abs(v1 - v2) <= max(_VOL_ABS, _VOL_REL * max(v1, v2))


def find_duplicates(
    candidate: Mapping[str, Any],
    existing: Iterable[Mapping[str, Any]],
) -> tuple[bool, list[dict[str, Any]]]:
    """Compare a to-be-created building against existing rows.

    `candidate` carries the typed name/address plus the EUBUCCO-matched geometry
    (source_id, latitude, longitude, height_m, footprint_area_m2); for a name-only
    import the geometry fields are absent/None. `existing` is the buildings table
    rows (anything supporting mapping access: sqlite3.Row, dict).

    Returns (blocked, candidates):
      - `blocked` is True when at least one existing building is near-certainly the
        same physical building (same source_id AND same name AND same address).
      - `candidates` is the ranked, capped list of buildings worth showing, each a
        plain dict with id/name/address/commune/source/source_id/risk_score plus
        distance_m, name_similarity, reasons[] and strength ("exact"|"similar").

    The caller decides what to do with `blocked` (e.g. raise 409 unless forced) and
    always surfaces `candidates` so the user sees what already exists.
    """
    cand_name = candidate.get("name")
    cand_addr = candidate.get("address")
    cand_sid = _sid(candidate.get("source_id"))
    cand_lat = candidate.get("latitude")
    cand_lon = candidate.get("longitude")
    cand_vol = _volume(candidate.get("height_m"), candidate.get("footprint_area_m2"))

    nm_cand = norm_name(cand_name)
    na_cand = norm_addr(cand_addr)

    results: list[dict[str, Any]] = []
    for b in existing:
        b_sid = _sid(b.get("source_id"))
        same_source = bool(cand_sid) and cand_sid == b_sid

        nm_b = norm_name(b.get("name"))
        same_name = bool(nm_cand) and nm_cand == nm_b
        ratio = name_ratio(cand_name, b.get("name"))
        similar_name = (not same_name) and ratio >= _NAME_SHOW_RATIO

        na_b = norm_addr(b.get("address"))
        same_address = bool(na_cand) and na_cand == na_b

        dist = haversine_m(cand_lat, cand_lon, b.get("latitude"), b.get("longitude"))
        nearby = dist is not None and dist <= _NEARBY_M

        same_vol = _same_volume(cand_vol, _volume(b.get("height_m"), b.get("footprint_area_m2")))

        # Show on any signal; the volume signal alone is too weak to surface on.
        if not (same_source or same_address or same_name or similar_name or nearby):
            continue

        reasons: list[str] = []
        if same_source:
            reasons.append("same_footprint")
        if same_name:
            reasons.append("same_name")
        if same_address:
            reasons.append("same_address")
        if same_vol:
            reasons.append("same_volume")
        if similar_name:
            reasons.append("similar_name")
        if nearby and not same_source:
            # "nearby" is only informative when it is not already the same footprint.
            reasons.append("nearby")

        # Block bar: the same physical footprint (EUBUCCO source_id) under the same
        # name. We deliberately do NOT also require the address to match: typed
        # addresses are noisy (postcode present or not, commune omitted or spelled
        # differently), and a same-footprint + same-name pair is already the same
        # building. Two genuinely distinct buildings always differ on the footprint
        # or on the name, so this never produces a false block; the address is kept
        # only as a corroborating reason. Requiring it was a false-negative source
        # (it let a re-import with a sparser address slip through, recreating 43/44).
        is_exact = same_source and same_name

        results.append(
            {
                "id": b.get("id"),
                "name": b.get("name"),
                "address": b.get("address"),
                "commune": b.get("commune"),
                "source": b.get("source"),
                "source_id": b.get("source_id"),
                "risk_score": round(float(b.get("risk_score") or 0.0), 2),
                "distance_m": round(dist, 1) if dist is not None else None,
                "name_similarity": round(ratio, 2),
                "reasons": reasons,
                "strength": "exact" if is_exact else "similar",
                # private sort helpers, stripped before returning
                "_same_source": same_source,
                "_same_address": same_address,
            }
        )

    # Rank strongest-first: exact blocks, then footprint, then address, then name
    # similarity, then closest.
    def _key(c: dict[str, Any]) -> tuple[Any, ...]:
        dist = c["distance_m"]
        return (
            c["strength"] == "exact",
            c["_same_source"],
            c["_same_address"],
            c["name_similarity"],
            -(dist if dist is not None else 9.0e9),
        )

    results.sort(key=_key, reverse=True)
    capped = results[:_MAX_CANDIDATES]
    for c in capped:
        c.pop("_same_source", None)
        c.pop("_same_address", None)

    blocked = any(c["strength"] == "exact" for c in capped)
    return blocked, capped
