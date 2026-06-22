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

Public surface
--------------
    build_index(conn, index_dir) -> int
    answer(question, conn, building_id, k, client, index_dir, building_ids, history) -> dict
    answer_stream(...) -> Iterator[dict]   # NDJSON-ready {type: sources|delta|done|error}

The legacy answer() call shape (question, conn, building_id, k, client, index_dir)
is preserved byte for byte; building_ids and history are optional and appended
after it. Scope precedence: a single building_id wins (the building-page path),
else a non-empty building_ids set, else the whole portfolio. history feeds only
the generation prompt, never retrieval.
"""

from __future__ import annotations

import warnings
from pathlib import Path
from typing import Any, Iterator

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

# Friendly terminal messages. French, to match the synthetic corpus and the
# existing answers; the UI chrome around them is English only.
_EMPTY_CORPUS_MSG = "Il n'y a pas d'information disponible dans la base de donnees."
_NO_RESULT_MSG = (
    "Il n'y a pas d'information pertinente pour cette question dans la base de donnees."
)
_EMPTY_SCOPE_MSG = (
    "Aucun batiment ne correspond au perimetre selectionne. "
    "Retirez un filtre pour elargir la recherche."
)


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


def _retrieve(
    index: Any,
    question: str,
    building_id: int | None,
    building_ids: list[int] | None,
    k: int,
) -> list[Any]:
    """Retrieve up to k nodes, optionally scoped to one building or a set.

    Scope precedence: a single building_id (EQ filter) wins and keeps the
    building-page behaviour byte for byte; otherwise a non-empty building_ids
    list restricts retrieval with an IN filter; otherwise the whole portfolio is
    in scope. We always post-filter defensively so the scope guarantee holds
    regardless of the vector store backend. For the set case the corpus is small,
    so we over-fetch then post-filter and cap, ensuring in-scope chunks survive.
    """
    if building_id is not None:
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
        retriever = index.as_retriever(similarity_top_k=k, filters=filters)
        results = retriever.retrieve(question)
        results = [
            r for r in results if r.node.metadata.get("building_id") == building_id
        ]
        return results[:k]

    if building_ids:
        from llama_index.core.vector_stores import (  # lazy import
            FilterOperator,
            MetadataFilter,
            MetadataFilters,
        )

        id_set = set(building_ids)
        filters = MetadataFilters(
            filters=[
                MetadataFilter(
                    key="building_id",
                    value=list(id_set),
                    operator=FilterOperator.IN,
                )
            ]
        )
        # Over-fetch then post-filter: on a small corpus the in-scope chunks can
        # be crowded out by out-of-scope nearest neighbours before the IN filter.
        retriever = index.as_retriever(
            similarity_top_k=max(k * 4, 20), filters=filters
        )
        results = retriever.retrieve(question)
        results = [
            r for r in results if r.node.metadata.get("building_id") in id_set
        ]
        return results[:k]

    retriever = index.as_retriever(similarity_top_k=k)
    return retriever.retrieve(question)[:k]


def _format_history(
    history: list[dict] | None,
    max_turns: int = 3,
    max_answer_chars: int = 300,
) -> str:
    """Render the last few conversation turns as a compact plain-text transcript.

    Used only to help the model resolve a follow-up question, never as a source
    of facts. Bounded server side (turn count and answer length) so a client
    cannot blow up the prompt with a long history.
    """
    if not history:
        return ""
    lines: list[str] = []
    for turn in history[-max_turns:]:
        q = str(turn.get("question") or "").strip()
        a = str(turn.get("answer") or "").strip()
        if not q and not a:
            continue
        if len(a) > max_answer_chars:
            a = a[:max_answer_chars].rstrip() + "..."
        lines.append(f"Q: {q}\nR: {a}")
    return "\n\n".join(lines)


def _build_sources(conn: Any, retrieved: list[Any]) -> list[dict]:
    """Build enriched cited passages from the retrieved nodes.

    Each source keeps the original document_id / building_id / snippet and adds
    the relevance score, the full chunk text (for an expandable view), and the
    building name + commune resolved with one batched lookup, never N+1.
    """
    ids = sorted(
        {
            item.node.metadata.get("building_id")
            for item in retrieved
            if item.node.metadata.get("building_id") is not None
        }
    )
    info_by_id: dict[int, tuple[str | None, str | None]] = {}
    if ids:
        placeholders = ",".join("?" for _ in ids)
        for row in conn.execute(
            f"SELECT id, name, commune FROM buildings WHERE id IN ({placeholders})",
            ids,
        ).fetchall():
            info_by_id[row["id"]] = (row["name"], row["commune"])

    sources: list[dict] = []
    for item in retrieved:
        meta = item.node.metadata
        bid = meta.get("building_id")
        name, commune = info_by_id.get(bid, (None, None))
        content = item.node.get_content()
        score = getattr(item, "score", None)
        sources.append(
            {
                "document_id": meta.get("document_id"),
                "building_id": bid,
                "snippet": content[:200],
                "full_text": content,
                "score": round(score, 4) if score is not None else None,
                "building_name": name,
                "commune": commune,
            }
        )
    return sources


def _prepare(
    question: str,
    conn: Any,
    building_id: int | None,
    building_ids: list[int] | None,
    k: int,
    index_dir: str | Path | None,
    history: list[dict] | None,
) -> dict:
    """Shared retrieval + scope + enriched sources + prompt building.

    Returns either {"early": <answer dict>} for a terminal case (empty scope,
    empty corpus, or no relevant chunk) or {"sources", "system_prompt",
    "user_prompt"} ready for generation. answer() and answer_stream() both go
    through this, so streamed and non-streamed results can never drift.
    """
    # Empty scope: filters matched zero buildings. Never touch the index.
    if building_ids is not None and len(building_ids) == 0:
        return {"early": {"answer": _EMPTY_SCOPE_MSG, "sources": []}}

    idx_dir = _resolve_index_dir(index_dir)
    _ensure_llama_settings()

    # Build the index lazily if nothing is persisted yet (matches old behaviour).
    if not _is_persisted(idx_dir):
        build_index(conn, idx_dir)

    # Empty corpus: a marker is present but no real index.
    if (idx_dir / _EMPTY_MARKER).exists():
        return {"early": {"answer": _EMPTY_CORPUS_MSG, "sources": []}}

    index = _load_index(idx_dir)
    retrieved = _retrieve(index, question, building_id, building_ids, k)

    if not retrieved:
        return {"early": {"answer": _NO_RESULT_MSG, "sources": []}}

    sources = _build_sources(conn, retrieved)

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
        "Reponds toujours dans la meme langue que la question (francais ou anglais). "
        "Reponds uniquement en te basant sur le contexte fourni. "
        "Si le contexte ne contient pas l'information necessaire, dis que tu ne sais pas. "
        "L'historique de conversation sert uniquement a comprendre la question de suivi: "
        "ne cite jamais entre crochets a partir de l'historique, "
        "uniquement a partir du contexte numerote."
    )

    history_block = _format_history(history)
    history_prefix = (
        f"Conversation precedente:\n{history_block}\n\n" if history_block else ""
    )

    user_prompt = (
        f"{history_prefix}"
        f"Contexte extrait des rapports d'inspection:\n\n{context_block}\n\n"
        f"Question: {question}\n\n"
        "Reponds dans la langue de la question, de facon concise et factuellement exacte, "
        "en citant les numeros de contexte entre crochets quand tu t'appuies dessus."
    )

    return {
        "sources": sources,
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
    }


def answer(
    question: str,
    conn: Any,
    building_id: int | None = None,
    k: int = 5,
    client: LLMClient | None = None,
    index_dir: str | Path | None = None,
    building_ids: list[int] | None = None,
    history: list[dict] | None = None,
) -> dict:
    """Answer a natural-language question grounded in the inspection reports.

    Parameters
    ----------
    question:
        User question (French or English).
    conn:
        Open SQLite connection. Used to build the index if not yet persisted.
    building_id:
        When set, retrieval is restricted to chunks from this single building
        (the building-page path; this branch is unchanged).
    k:
        Number of chunks to retrieve.
    client:
        LLM client for answer generation. Defaults to get_llm().
    index_dir:
        Override the default index directory (useful for testing).
    building_ids:
        Portfolio scope: when a non-empty list, retrieval is restricted to this
        set. An empty list short-circuits to the friendly empty-scope message.
        Ignored when building_id is set.
    history:
        Prior conversation turns ({"question", "answer"}), used only to help the
        model resolve a follow-up. Retrieval always uses the latest question.

    Returns
    -------
    dict with keys:
        "answer"  : str - generated answer grounded in context
        "sources" : list of {"document_id", "building_id", "snippet",
                    "full_text", "score", "building_name", "commune"}
    """
    if client is None:
        client = get_llm()

    prep = _prepare(question, conn, building_id, building_ids, k, index_dir, history)
    if "early" in prep:
        return prep["early"]

    try:
        raw_answer = client.complete(
            prep["user_prompt"], system=prep["system_prompt"]
        )
    except Exception as exc:
        warnings.warn(f"LLM completion failed: {exc}", stacklevel=2)
        raw_answer = f"[erreur de generation: {exc}]"

    return {"answer": raw_answer, "sources": prep["sources"]}


def answer_stream(
    question: str,
    conn: Any,
    building_id: int | None = None,
    k: int = 5,
    client: LLMClient | None = None,
    index_dir: str | Path | None = None,
    building_ids: list[int] | None = None,
    history: list[dict] | None = None,
) -> Iterator[dict]:
    """Stream the grounded answer as NDJSON-ready event dicts.

    Emits exactly one {"type": "sources", ...} frame from this turn's retrieval,
    then zero or more {"type": "delta", "text": ...} frames whose concatenation
    is the full answer, then one {"type": "done"} frame. A failure during
    retrieval (in _prepare, before any sources) or during generation emits
    {"type": "error", "message": ...} instead, so the client never sees a
    silently truncated stream.

    Shares _prepare with answer(), so the streamed sources are identical to the
    non-streamed ones for the same request.
    """
    if client is None:
        client = get_llm()

    try:
        prep = _prepare(
            question, conn, building_id, building_ids, k, index_dir, history
        )
    except Exception as exc:
        # Retrieval or index load failed before any answer body. Surface it as an
        # error frame (the sources frame has not been sent, so ordering is intact).
        warnings.warn(f"RAG preparation failed: {exc}", stacklevel=2)
        yield {"type": "error", "message": str(exc)}
        return

    if "early" in prep:
        early = prep["early"]
        yield {"type": "sources", "sources": early["sources"]}
        yield {"type": "delta", "text": early["answer"]}
        yield {"type": "done"}
        return

    yield {"type": "sources", "sources": prep["sources"]}
    try:
        for piece in client.stream(prep["user_prompt"], system=prep["system_prompt"]):
            if piece:
                yield {"type": "delta", "text": piece}
    except Exception as exc:
        warnings.warn(f"LLM stream failed: {exc}", stacklevel=2)
        yield {"type": "error", "message": str(exc)}
        return
    yield {"type": "done"}


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
