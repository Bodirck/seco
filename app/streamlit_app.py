"""BuildingLens Streamlit UI.

Three views over the populated database:
  - Portfolio: buildings ranked by risk score, with a map and sector context.
  - Building: risk breakdown and the defect table for one building.
  - Ask: natural-language questions answered from the reports (RAG), with citations.

Run with `make run` (streamlit run app/streamlit_app.py). Build the data first
with `make data` and `make extract`. Without an API key the Ask tab runs in mock
mode and returns a placeholder answer; retrieval still works.
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

from buildinglens import db, rag
from buildinglens.config import settings
from buildinglens.llm import get_llm
from buildinglens.scoring import building_risk_breakdown
from buildinglens.statec import permits_summary

st.set_page_config(page_title="BuildingLens", page_icon="🏢", layout="wide")

_SEVERITY_ORDER = "CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 ELSE 2 END"


def get_conn():
    return db.connect(settings.db_path)


def load_buildings(conn) -> pd.DataFrame:
    rows = conn.execute(
        f"""
        SELECT b.id, b.name, b.address, b.height_m, b.latitude, b.longitude, b.source,
               COALESCE(b.risk_score, 0.0) AS risk_score,
               SUM(d.severity = 'critical') AS critical,
               SUM(d.severity = 'major') AS major,
               SUM(d.severity = 'minor') AS minor
        FROM buildings b
        LEFT JOIN defects d ON d.building_id = b.id
        GROUP BY b.id
        ORDER BY risk_score DESC
        """
    ).fetchall()
    df = pd.DataFrame([dict(r) for r in rows])
    if not df.empty:
        for col in ("critical", "major", "minor"):
            df[col] = df[col].fillna(0).astype(int)
        df["risk_score"] = df["risk_score"].round(1)
    return df


def load_defects(conn, building_id: int) -> pd.DataFrame:
    rows = conn.execute(
        f"""
        SELECT discipline, element, description, location, severity, citation
        FROM defects WHERE building_id = ?
        ORDER BY {_SEVERITY_ORDER}, discipline
        """,
        (building_id,),
    ).fetchall()
    return pd.DataFrame([dict(r) for r in rows])


def sector_context() -> dict | None:
    """Latest STATEC permit context, if the cached CSV is present."""
    path = settings.db_path.parent / "raw" / "statec_permits.csv"
    if not path.exists():
        return None
    try:
        return permits_summary(pd.read_csv(path))
    except Exception:
        return None


conn = get_conn()
buildings = load_buildings(conn)

st.title("BuildingLens")
st.caption(
    "Building inspection reports and public construction data, turned into a risk "
    "view for an asset manager or insurer."
)

if buildings.empty:
    st.warning("No buildings in the database. Run `make data` (and `make extract`) first.")
    st.stop()

provider = type(get_llm()).__name__
if provider == "MockClient":
    st.info(
        "No API key detected: the Ask tab runs in mock mode (placeholder answers). "
        "Add a key to .env for real answers. Retrieval still works."
    )

# Sidebar: building selector shared by the Building and Ask tabs.
st.sidebar.header("Building")
id_to_label = {
    int(r.id): f"{r.name}  (risk {r.risk_score:.0f})" for r in buildings.itertuples()
}
selected_id = st.sidebar.selectbox(
    "Select a building",
    options=list(id_to_label),
    format_func=lambda bid: id_to_label[bid],
)

tab_portfolio, tab_building, tab_ask = st.tabs(["Portfolio", "Building", "Ask"])

with tab_portfolio:
    st.subheader("Portfolio risk")
    c1, c2, c3 = st.columns(3)
    c1.metric("Buildings", len(buildings))
    c2.metric("Defects", int(buildings[["critical", "major", "minor"]].to_numpy().sum()))
    c3.metric("Critical defects", int(buildings["critical"].sum()))

    st.dataframe(
        buildings[
            ["name", "address", "risk_score", "critical", "major", "minor", "source"]
        ],
        hide_index=True,
        width="stretch",
    )

    geo = buildings[["latitude", "longitude"]].dropna()
    if not geo.empty:
        st.map(geo, latitude="latitude", longitude="longitude")

    context = sector_context()
    if context and context.get("latest_year"):
        with st.expander("Sector context (STATEC building permits, Luxembourg)"):
            st.write(
                f"Dwellings authorised in {context['latest_year']}: "
                f"{context['total_permits_latest_year']}."
            )
            if context.get("by_canton"):
                st.bar_chart(pd.Series(context["by_canton"]))

with tab_building:
    row = buildings[buildings["id"] == selected_id].iloc[0]
    st.subheader(row["name"])
    st.caption(f"{row['address']}  -  source: {row['source']}")

    breakdown = building_risk_breakdown(conn, selected_id)
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Risk score", f"{breakdown['risk_score']:.0f}")
    m2.metric("Critical", breakdown["critical"])
    m3.metric("Major", breakdown["major"])
    m4.metric("Minor", breakdown["minor"])

    defects = load_defects(conn, selected_id)
    if defects.empty:
        st.write("No defects extracted for this building yet (run `make extract`).")
    else:
        chosen = st.multiselect(
            "Severity",
            ["critical", "major", "minor"],
            default=["critical", "major", "minor"],
        )
        view = defects[defects["severity"].isin(chosen)] if chosen else defects
        st.dataframe(view, hide_index=True, use_container_width=True)

with tab_ask:
    st.subheader("Ask about the portfolio")
    scope_one = st.checkbox(f"Restrict to {buildings[buildings['id'] == selected_id].iloc[0]['name']}")
    question = st.text_input(
        "Question",
        placeholder="Quels sont les defauts critiques de ce batiment ?",
    )
    if st.button("Ask") and question.strip():
        with st.spinner("Retrieving and answering..."):
            result = rag.answer(
                question,
                conn,
                building_id=selected_id if scope_one else None,
            )
        st.markdown(result["answer"])
        if result["sources"]:
            st.caption("Sources")
            for i, src in enumerate(result["sources"], start=1):
                with st.expander(f"[{i}] document {src['document_id']} (building {src['building_id']})"):
                    st.write(src["snippet"])
