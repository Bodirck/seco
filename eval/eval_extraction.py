"""Evaluate LLM defect extraction against the synthetic ground truth.

The gold set is the exact set of defects embedded in each report by the generator
(buildinglens.synthetic_reports.report_ground_truth). The predicted set is whatever
the extraction wrote into the defects table (populate it first with `make extract`).

This is an honest but synthetic evaluation: because we generated the reports, we know
the ground truth exactly, so we get a reproducible precision/recall without hand
labelling. The limitation is that it measures extraction fidelity on synthetic text;
real inspection reports would need a hand-labelled gold set. This is stated in the README.

Matching
--------
Element-level, per building. A predicted defect matches a gold defect when their
normalized element token sets overlap enough (Jaccard >= 0.5, or one is a subset of
the other). Matching is greedy and one-to-one. We report precision, recall, F1, and
severity accuracy measured on the matched pairs.

Run with `make eval` or `python -m eval.eval_extraction`.
"""

from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from pathlib import Path

from buildinglens.config import settings
from buildinglens.db import connect
from buildinglens.synthetic_reports import report_ground_truth

GOLD_PATH = settings.db_path.parent.parent / "eval" / "gold.jsonl"
_MATCH_THRESHOLD = 0.5


def _norm_tokens(text: str | None) -> set[str]:
    """Lowercase, strip accents, and split into alphanumeric tokens."""
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _elements_match(predicted: str | None, gold: str | None) -> bool:
    a, b = _norm_tokens(predicted), _norm_tokens(gold)
    if not a or not b:
        return False
    if a <= b or b <= a:
        return True
    jaccard = len(a & b) / len(a | b)
    return jaccard >= _MATCH_THRESHOLD


def build_gold(conn: sqlite3.Connection) -> dict[int, list[dict]]:
    """Build the ground-truth defects for every building currently in the DB."""
    rows = conn.execute("SELECT id FROM buildings ORDER BY id").fetchall()
    buildings = [{"id": row["id"]} for row in rows]
    return report_ground_truth(buildings, seed=0)


def write_gold_jsonl(gold: dict[int, list[dict]], path: Path = GOLD_PATH) -> Path:
    """Persist the gold set as one JSON line per defect (for inspection/reuse)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for building_id, defects in gold.items():
            for d in defects:
                fh.write(json.dumps({"building_id": building_id, **d}, ensure_ascii=False) + "\n")
    return path


def evaluate(conn: sqlite3.Connection) -> dict:
    """Compare extracted defects against the gold set and compute metrics."""
    gold = build_gold(conn)

    true_positives = 0
    total_predicted = 0
    total_gold = sum(len(v) for v in gold.values())
    severity_correct = 0
    severity_matched = 0

    for building_id, gold_defects in gold.items():
        preds = [
            dict(r)
            for r in conn.execute(
                "SELECT element, severity FROM defects WHERE building_id = ?",
                (building_id,),
            ).fetchall()
        ]
        total_predicted += len(preds)

        matched_gold: set[int] = set()
        for pred in preds:
            for gi, gold_defect in enumerate(gold_defects):
                if gi in matched_gold:
                    continue
                if _elements_match(pred["element"], gold_defect["element"]):
                    matched_gold.add(gi)
                    true_positives += 1
                    severity_matched += 1
                    if (pred["severity"] or "") == gold_defect["severity"]:
                        severity_correct += 1
                    break

    precision = true_positives / total_predicted if total_predicted else 0.0
    recall = true_positives / total_gold if total_gold else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    severity_accuracy = severity_correct / severity_matched if severity_matched else 0.0

    return {
        "gold_defects": total_gold,
        "predicted_defects": total_predicted,
        "matched": true_positives,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "severity_accuracy": round(severity_accuracy, 3),
    }


def main() -> None:
    conn = connect(settings.db_path)

    gold = build_gold(conn)
    path = write_gold_jsonl(gold)
    print(f"Gold set written to {path} ({sum(len(v) for v in gold.values())} defects).")

    metrics = evaluate(conn)
    conn.close()

    if metrics["predicted_defects"] == 0:
        print(
            "\nNo extracted defects found. Run `make extract` with a configured API key "
            "to populate the defects table, then re-run `make eval`."
        )
        return

    print("\nExtraction evaluation (predicted vs synthetic ground truth):")
    print(f"  gold defects      : {metrics['gold_defects']}")
    print(f"  predicted defects : {metrics['predicted_defects']}")
    print(f"  matched           : {metrics['matched']}")
    print(f"  precision         : {metrics['precision']}")
    print(f"  recall            : {metrics['recall']}")
    print(f"  F1                : {metrics['f1']}")
    print(f"  severity accuracy : {metrics['severity_accuracy']}  (on matched pairs)")


if __name__ == "__main__":
    main()
