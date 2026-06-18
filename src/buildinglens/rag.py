"""Retrieval-Augmented Generation over BuildingLens inspection reports.

Architecture
------------
Indexing  : LlamaIndex VectorStoreIndex over the default in-memory SimpleVectorStore.
Chunking  : LlamaIndex SentenceSplitter (~600 char window, 100 char overlap).
Embedding : sentence-transformers "paraphrase-multilingual-MiniLM-L12-v2" (French-capable),
            wrapped by llama_index HuggingFaceEmbedding and run fully locally (no network).
Retrieval : VectorStoreIndex retriever with similarity_top_k=k and an optional building_id
            metadata filter.
Persistence : StorageContext.persist / load_index_from_storage under index_dir.
Generation : our own get_llm() (the passed client), never LlamaIndex's LLM. This keeps the
            multi-provider behaviour and the mock fallback intact. Settings.llm is forced to
            None so LlamaIndex never tries to build an OpenAI client.

Public surface (unchanged, callers depend on it byte for byte)
--------------------------------------------------------------
    build_index(conn, index_dir) -> int
    answer(question, conn, building_id, k, client, index_dir) -> dict
"""

from __future__ import annotations

import warnings
from pathlib import Path
from typing import Any

from .config import settings
from .llm import LLMClient, get_llm

# ---------------------------------------------------------------------------
# Embedding model (LlamaIndex Settings, configured once and lazily)
# ---------------------------------------------------------------------------
# Same multilingual model as before, now served through LlamaIndex's
# HuggingFaceEmbedding so indexing and retrieval go through one engine. The model
# runs locally: no network call at query time once the weights are cached.

_EMBED_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_settings_ready = False


def _ensure_llama_settings() -> None:
    """Configure LlamaIndex global Settings once.

    Sets our local HuggingFace embedding model and forces the LLM to None so
    LlamaIndex never constructs an OpenAI client behind our back. Generation is
    always done by our own get_llm() client, never by LlamaIndex.
    """
    global _settings_ready
    if _settings_ready:
        return
    from llama_index.core import Settings as LISettings  # lazy import
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding

    LISettings.embed_model = HuggingFaceEmbedding(model_name=_EMBED_MODEL_NAME)
    LISettings.llm = None  # never let LlamaIndex call an online LLM
    _settings_ready = True


# ---------------------------------------------------------------------------
# Chunking parameters (comparable to the previous 600 / 100 character windows)
# ---------------------------------------------------------------------------

_CHUNK_SIZE = 600
_CHUNK_OVERLAP = 100


def _make_splitter() -> Any:
    """Return a SentenceSplitter sized like the previous character windows."""
    from llama_index.core.node_parser import SentenceSplitter  # lazy import

    return SentenceSplitter(chunk_size=_CHUNK_SIZE, chunk_overlap=_CHUNK_OVERLAP)


# ---------------------------------------------------------------------------
# Index paths
# ---------------------------------------------------------------------------

_DEFAULT_INDEX_DIR = settings.db_path.parent / "raw" / "rag"
# LlamaIndex persists several files in the directory; this one is the docstore,
# always present after a successful persist. We use it as the "index exists"
# probe, mirroring the previous code's single-file check.
_PERSIST_PROBE = "docstore.json"
# Marker written when the corpus is empty, so the lazy build in answer() does not
# loop forever trying to (re)build a persisted index that cannot exist.
_EMPTY_MARKER = "empty.marker"


def _resolve_index_dir(index_dir: str | Path | None) -> Path:
    d = Path(index_dir) if index_dir is not None else _DEFAULT_INDEX_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _is_persisted(idx_dir: Path) -> bool:
    """True if a real index OR the empty-corpus marker is present on disk."""
    return (idx_dir / _PERSIST_PROBE).exists() or (idx_dir / _EMPTY_MARKER).exists()


# ---------------------------------------------------------------------------
# build_index
# ---------------------------------------------------------------------------


def build_index(conn: Any, index_dir: str | Path | None = None) -> int:
    """Index every document in the DB and persist a LlamaIndex VectorStoreIndex.

    Parameters
    ----------
    conn:
        Open SQLite connection (row factory active).
    index_dir:
        Directory for the persisted index. Defaults to <db_parent>/raw/rag.

    Returns
    -------
    int
        Total number of nodes (chunks) indexed.
    """
    from llama_index.core import Document, VectorStoreIndex  # lazy imports

    idx_dir = _resolve_index_dir(index_dir)
    _ensure_llama_settings()

    rows = conn.execute(
        "SELECT id, building_id, raw_text FROM documents WHERE raw_text IS NOT NULL"
    ).fetchall()

    documents: list[Any] = []
    for row in rows:
        doc_id: int = row["id"]
        bld_id: int = row["building_id"]
        raw: str = row["raw_text"] or ""
        if not raw.strip():
            continue
        documents.append(
            Document(
                text=raw,
                metadata={"document_id": doc_id, "building_id": bld_id},
                # Keep all metadata out of what the embedding/LLM sees, so the
                # vectorised text stays the report text, not "document_id: 3 ...".
                excluded_embed_metadata_keys=["document_id", "building_id"],
                excluded_llm_metadata_keys=["document_id", "building_id"],
            )
        )

    # Parse documents into nodes up front so we can both report the count and
    # build the index from the same node list.
    splitter = _make_splitter()
    try:
        nodes = splitter.get_nodes_from_documents(documents) if documents else []
    except Exception as exc:  # never crash the pipeline on a bad document
        warnings.warn(f"Chunking failed: {exc}", stacklevel=2)
        nodes = []

    # Start clean so a rebuild never mixes stale persisted files with new ones.
    _clear_index_dir(idx_dir)

    if not nodes:
        warnings.warn(
            "No text found in documents; the RAG index will be empty.", stacklevel=2
        )
        # Drop a marker so answer() returns the friendly "no data" message
        # without trying to (re)build on every call.
        (idx_dir / _EMPTY_MARKER).write_text("", encoding="utf-8")
        return 0

    index = VectorStoreIndex(nodes)
    index.storage_context.persist(persist_dir=str(idx_dir))
    return len(nodes)


def _clear_index_dir(idx_dir: Path) -> None:
    """Remove previously persisted index files and any empty marker."""
    for name in (
        _EMPTY_MARKER,
        _PERSIST_PROBE,
        "index_store.json",
        "graph_store.json",
        "image__vector_store.json",
        "default__vector_store.json",
    ):
        p = idx_dir / name
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# answer
# ---------------------------------------------------------------------------


def _load_index(idx_dir: Path) -> Any:
    """Load the persisted VectorStoreIndex from disk."""
    from llama_index.core import StorageContext, load_index_from_storage  # lazy

    storage = StorageContext.from_defaults(persist_dir=str(idx_dir))
    return load_index_from_storage(storage)


def _retrieve(index: Any, question: str, building_id: int | None, k: int) -> list[Any]:
    """Retrieve up to k nodes, restricted to one building when building_id is set.

    Uses LlamaIndex MetadataFilters for the building restriction and also
    post-filters defensively so the building_id guarantee holds regardless of the
    vector store backend.
    """
    if building_id is None:
        retriever = index.as_retriever(similarity_top_k=k)
        results = retriever.retrieve(question)
    else:
        from llama_index.core.vector_stores import (  # lazy import
            FilterOperator,
            MetadataFilter,
            MetadataFilters,
        )

        filters = MetadataFilters(
            filters=[
                MetadataFilter(
                    key="building_id", value=building_id, operator=FilterOperator.EQ
                )
            ]
        )
        # The corpus is small; over-fetch then post-filter and cap, so the right
        # building's best chunks are guaranteed to make the final k.
        retriever = index.as_retriever(similarity_top_k=k, filters=filters)
        results = retriever.retrieve(question)
        results = [
            r for r in results if r.node.metadata.get("building_id") == building_id
        ]

    return results[:k]


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
    _ensure_llama_settings()

    # Build the index lazily if nothing is persisted yet (matches old behaviour).
    if not _is_persisted(idx_dir):
        build_index(conn, idx_dir)

    # Empty corpus: a marker is present but no real index. Return the friendly
    # "no data" message instead of crashing on a missing index.
    if (idx_dir / _EMPTY_MARKER).exists():
        return {
            "answer": "Il n'y a pas d'information disponible dans la base de donnees.",
            "sources": [],
        }

    index = _load_index(idx_dir)
    retrieved = _retrieve(index, question, building_id, k)

    if not retrieved:
        return {
            "answer": "Il n'y a pas d'information pertinente pour cette question dans la base de donnees.",
            "sources": [],
        }

    # Build the numbered, grounded context block from the retrieved nodes.
    context_lines: list[str] = []
    for i, item in enumerate(retrieved, start=1):
        node = item.node
        meta = node.metadata
        context_lines.append(
            f"[{i}] (document_id={meta.get('document_id')}, "
            f"building_id={meta.get('building_id')})\n"
            f"{node.get_content()}"
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
            "document_id": item.node.metadata.get("document_id"),
            "building_id": item.node.metadata.get("building_id"),
            "snippet": item.node.get_content()[:200],
        }
        for item in retrieved
    ]

    return {"answer": raw_answer, "sources": sources}


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from .db import connect

    print(f"Connecting to: {settings.db_path}")
    conn = connect(settings.db_path)

    n_docs = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE raw_text IS NOT NULL"
    ).fetchone()[0]
    print(f"Documents with text: {n_docs}")

    print("Building RAG index (LlamaIndex)...")
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
