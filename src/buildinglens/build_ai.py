"""Run the AI steps over the already-populated database.

  WP2: extract defects from every report, then score each building.
  WP3: build the RAG embedding index.

Run with `make extract` or `python -m buildinglens.build_ai`.

Extraction uses the configured LLM provider (see .env). With no API key it falls
back to the mock client, which inserts no defects, so this never hard-fails; you
just get an empty defects table until a key is set.
"""

from __future__ import annotations

from .config import settings
from .db import connect
from .extract import extract_all
from .llm import get_llm
from .rag import build_index
from .scoring import compute_scores


def run(build_rag: bool = True) -> dict[str, int]:
    conn = connect(settings.db_path)
    client = get_llm()
    provider = type(client).__name__
    print(f"Using LLM client: {provider}")
    if provider == "MockClient":
        print(
            "  (no API key detected, running in mock mode: no defects will be "
            "extracted. Set LLM_PROVIDER and an API key in .env for a real run.)"
        )

    print("Extracting defects from reports...")
    n_defects = extract_all(conn, client=client)
    print(f"Inserted {n_defects} defects.")

    print("Scoring buildings...")
    compute_scores(conn)

    n_chunks = 0
    if build_rag:
        print("Building RAG index...")
        n_chunks = build_index(conn)
        print(f"Indexed {n_chunks} chunks.")

    counts = {
        "defects": conn.execute("SELECT COUNT(*) FROM defects").fetchone()[0],
        "scored_buildings": conn.execute(
            "SELECT COUNT(*) FROM buildings WHERE risk_score > 0"
        ).fetchone()[0],
        "chunks": n_chunks,
    }
    conn.close()
    print(
        f"\nDone. {counts['defects']} defects, "
        f"{counts['scored_buildings']} buildings with a non-zero risk score, "
        f"{counts['chunks']} RAG chunks."
    )
    return counts


if __name__ == "__main__":
    run()
