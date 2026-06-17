"""Retrieval-Augmented Generation over BuildingLens inspection reports.

Architecture
------------
Chunking  : overlapping fixed-length character windows (600 chars, 100 overlap).
Embedding : sentence-transformers "paraphrase-multilingual-MiniLM-L12-v2" (French-capable).
Index     : FAISS IndexFlatIP on L2-normalised vectors (equivalent to cosine similarity).
Persistence : faiss.write_index + JSON for chunk metadata, stored under index_dir.
Generation : any LLMClient; defaults to get_llm() (falls back to mock when no key).

Public surface
--------------
    build_index(conn, index_dir) -> int
    answer(question, conn, building_id, k, client) -> dict
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path
from typing import Any

import faiss
import numpy as np

from .config import settings
from .llm import LLMClient, get_llm

# ---------------------------------------------------------------------------
# Embedding model (loaded once, module-level)
# ---------------------------------------------------------------------------

_EMBED_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_embed_model: Any | None = None  # SentenceTransformer instance, lazy


def _get_embed_model() -> Any:
    """Return the SentenceTransformer model, loading it on first call."""
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer  # lazy import

        _embed_model = SentenceTransformer(_EMBED_MODEL_NAME)
    return _embed_model


# ---------------------------------------------------------------------------
# Chunking helpers
# ---------------------------------------------------------------------------

_CHUNK_SIZE = 600
_CHUNK_OVERLAP = 100


def _chunk_text(text: str, chunk_size: int = _CHUNK_SIZE, overlap: int = _CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character windows.

    Returns at least one chunk (the full text) even when len(text) < chunk_size.
    """
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Index paths
# ---------------------------------------------------------------------------

_DEFAULT_INDEX_DIR = settings.db_path.parent / "raw" / "rag"
_INDEX_FILE = "faiss.index"
_META_FILE = "chunks.json"


def _resolve_index_dir(index_dir: str | Path | None) -> Path:
    d = Path(index_dir) if index_dir is not None else _DEFAULT_INDEX_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _index_path(index_dir: Path) -> Path:
    return index_dir / _INDEX_FILE


def _meta_path(index_dir: Path) -> Path:
    return index_dir / _META_FILE


# ---------------------------------------------------------------------------
# build_index
# ---------------------------------------------------------------------------


def build_index(conn: Any, index_dir: str | Path | None = None) -> int:
    """Embed every document in the DB and persist a FAISS index.

    Parameters
    ----------
    conn:
        Open SQLite connection (row factory active).
    index_dir:
        Directory for the FAISS index and chunk metadata file.
        Defaults to <db_parent>/raw/rag.

    Returns
    -------
    int
        Total number of chunks indexed.
    """
    idx_dir = _resolve_index_dir(index_dir)
    model = _get_embed_model()

    rows = conn.execute(
        "SELECT id, building_id, raw_text FROM documents WHERE raw_text IS NOT NULL"
    ).fetchall()

    texts: list[str] = []
    meta: list[dict] = []  # one entry per chunk

    for row in rows:
        doc_id: int = row["id"]
        bld_id: int = row["building_id"]
        raw: str = row["raw_text"] or ""
        try:
            chunks = _chunk_text(raw)
        except Exception as exc:
            warnings.warn(f"Chunking failed for document {doc_id}: {exc}", stacklevel=2)
            continue
        for chunk in chunks:
            texts.append(chunk)
            meta.append({"document_id": doc_id, "building_id": bld_id, "text": chunk})

    if not texts:
        warnings.warn("No text found in documents; the FAISS index will be empty.", stacklevel=2)
        # Build a zero-vector index so callers never get a FileNotFoundError.
        dim = model.get_sentence_embedding_dimension()
        index = faiss.IndexFlatIP(dim)
        faiss.write_index(index, str(_index_path(idx_dir)))
        _meta_path(idx_dir).write_text(json.dumps([]), encoding="utf-8")
        return 0

    # Embed in one shot (sentence-transformers handles batching internally).
    embeddings: np.ndarray = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)

    # L2-normalise so IndexFlatIP computes cosine similarity.
    faiss.normalize_L2(embeddings)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    faiss.write_index(index, str(_index_path(idx_dir)))
    _meta_path(idx_dir).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return len(texts)


# ---------------------------------------------------------------------------
# answer
# ---------------------------------------------------------------------------


def _load_index(idx_dir: Path) -> tuple[Any, list[dict]]:
    """Load the FAISS index and chunk metadata from disk."""
    index = faiss.read_index(str(_index_path(idx_dir)))
    meta = json.loads(_meta_path(idx_dir).read_text(encoding="utf-8"))
    return index, meta


def answer(
    question: str,
    conn: Any,
    building_id: int | None = None,
    k: int = 5,
    client: LLMClient | None = None,
    index_dir: str | Path | None = None,
) -> dict:
    """Answer a natural-language question grounded in the inspection reports.

    Parameters
    ----------
    question:
        User question (French or English).
    conn:
        Open SQLite connection. Used to build the index if not yet persisted.
    building_id:
        When set, retrieval is restricted to chunks from this building.
    k:
        Number of chunks to retrieve.
    client:
        LLM client for answer generation. Defaults to get_llm().
    index_dir:
        Override the default index directory (useful for testing).

    Returns
    -------
    dict with keys:
        "answer"  : str - generated answer grounded in context
        "sources" : list of {"document_id", "building_id", "snippet"}
    """
    if client is None:
        client = get_llm()

    idx_dir = _resolve_index_dir(index_dir)
    model = _get_embed_model()

    # Build index if missing.
    if not _index_path(idx_dir).exists():
        build_index(conn, idx_dir)

    index, meta = _load_index(idx_dir)

    if index.ntotal == 0:
        return {
            "answer": "Il n'y a pas d'information disponible dans la base de donnees.",
            "sources": [],
        }

    # Embed the question.
    q_vec: np.ndarray = model.encode([question], show_progress_bar=False, convert_to_numpy=True)
    faiss.normalize_L2(q_vec)

    # When filtering to one building, search the whole index so that building's
    # best chunks are guaranteed to be considered (the corpus is small).
    retrieve_k = k if building_id is None else index.ntotal
    scores, indices = index.search(q_vec, retrieve_k)

    # Collect matching chunks.
    retrieved: list[dict] = []
    for idx in indices[0]:
        if idx < 0 or idx >= len(meta):
            continue
        chunk_meta = meta[idx]
        if building_id is not None and chunk_meta["building_id"] != building_id:
            continue
        retrieved.append(chunk_meta)
        if len(retrieved) >= k:
            break

    if not retrieved:
        return {
            "answer": "Il n'y a pas d'information pertinente pour cette question dans la base de donnees.",
            "sources": [],
        }

    # Build grounded prompt.
    context_lines: list[str] = []
    for i, chunk in enumerate(retrieved, start=1):
        context_lines.append(
            f"[{i}] (document_id={chunk['document_id']}, building_id={chunk['building_id']})\n"
            f"{chunk['text']}"
        )
    context_block = "\n\n".join(context_lines)

    system_prompt = (
        "Tu es un assistant specialise dans l'analyse de rapports d'inspection immobiliere. "
        "Reponds uniquement en te basant sur le contexte fourni. "
        "Si le contexte ne contient pas l'information necessaire, dis que tu ne sais pas."
    )

    user_prompt = (
        f"Contexte extrait des rapports d'inspection:\n\n{context_block}\n\n"
        f"Question: {question}\n\n"
        "Reponds en francais, de facon concise et factuellement exacte, "
        "en citant les numeros de contexte entre crochets quand tu t'appuies dessus."
    )

    try:
        raw_answer = client.complete(user_prompt, system=system_prompt)
    except Exception as exc:
        warnings.warn(f"LLM completion failed: {exc}", stacklevel=2)
        raw_answer = f"[erreur de generation: {exc}]"

    sources = [
        {
            "document_id": c["document_id"],
            "building_id": c["building_id"],
            "snippet": c["text"][:200],
        }
        for c in retrieved
    ]

    return {"answer": raw_answer, "sources": sources}


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sqlite3

    from .db import connect

    print(f"Connecting to: {settings.db_path}")
    conn = connect(settings.db_path)

    n_docs = conn.execute("SELECT COUNT(*) FROM documents WHERE raw_text IS NOT NULL").fetchone()[0]
    print(f"Documents with text: {n_docs}")

    print("Building FAISS index...")
    n_chunks = build_index(conn)
    print(f"Chunks indexed: {n_chunks}")

    mock_client = get_llm("mock")
    question = "Quels sont les defauts critiques ?"
    print(f"\nQuestion: {question}")
    result = answer(question, conn, client=mock_client)

    print(f"Sources returned: {len(result['sources'])}")
    print(f"Answer: {result['answer'][:120]}")
    if result["sources"]:
        first = result["sources"][0]
        print(
            f"First source: document_id={first['document_id']}, "
            f"building_id={first['building_id']}, "
            f"snippet={first['snippet'][:80]!r}"
        )

    conn.close()
    print("\nSmoke test passed. No exception raised.")
