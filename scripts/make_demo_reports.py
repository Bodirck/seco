"""Generate fresh synthetic inspection-report PDFs for the import demo.

These are NEW buildings, not part of the built 40-building database, so importing
one through the app's Import page exercises the full ingest, extract, score and
index loop and adds a dossier you can then open and query. Reproducible: same
seed, same PDFs.

Run: python scripts/make_demo_reports.py
"""

from __future__ import annotations

from pathlib import Path

from buildinglens.synthetic_reports import generate_reports

OUT_DIR = Path(__file__).resolve().parents[1] / "demo" / "import_samples"
SEED = 2026

# Ten buildings with ids outside the default 1..40 dataset, so each import
# creates a genuinely new building. The generator derives the defect plan from
# (id + seed), so the ten reports differ from one another and from the built set.
BUILDINGS = [
    {"id": 101, "name": "Residence Belair", "address": "12 rue des Roses, 8011 Strassen", "year_built": 2008, "height_m": 18.5},
    {"id": 102, "name": "Immeuble de bureaux Cloche d'Or", "address": "5 boulevard de Kockelscheuer, 1821 Luxembourg", "year_built": 2017, "height_m": 34.0},
    {"id": 103, "name": "Ecole fondamentale Lallange", "address": "40 rue de Belvaux, 4025 Esch-sur-Alzette", "year_built": 1996, "height_m": 12.0},
    {"id": 104, "name": "Centre commercial Belval Plaza", "address": "7 avenue du Rock'n'Roll, 4361 Esch-sur-Alzette", "year_built": 2011, "height_m": 22.0},
    {"id": 105, "name": "Residence Op der Lay", "address": "18 rue de la Liberation, 4602 Differdange", "year_built": 2003, "height_m": 16.0},
    {"id": 106, "name": "Hotel Parc Belair", "address": "111 avenue du Dix Septembre, 2551 Luxembourg", "year_built": 1999, "height_m": 21.5},
    {"id": 107, "name": "Entrepot logistique Contern", "address": "2 rue des Chaux, 5324 Contern", "year_built": 2014, "height_m": 11.0},
    {"id": 108, "name": "Clinique Sainte-Marie", "address": "7 rue Emile Mayrisch, 4240 Esch-sur-Alzette", "year_built": 1988, "height_m": 19.0},
    {"id": 109, "name": "Residence Kiem", "address": "25 rue Edward Steichen, 2540 Luxembourg", "year_built": 2019, "height_m": 28.0},
    {"id": 110, "name": "Parking silo Gare", "address": "3 place de la Gare, 4131 Esch-sur-Alzette", "year_built": 2006, "height_m": 15.0},
]


def slugify(name: str) -> str:
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " -_'":
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pairs = generate_reports(BUILDINGS, OUT_DIR, seed=SEED)
    by_id = {b["id"]: b for b in BUILDINGS}
    for bid, path in pairs:
        building = by_id[bid]
        target = OUT_DIR / f"{slugify(building['name'])}.pdf"
        Path(path).replace(target)
        print(f"{target.name}  ->  import as: {building['name']}")
    print(f"\n{len(pairs)} demo reports written to {OUT_DIR}")


if __name__ == "__main__":
    main()
