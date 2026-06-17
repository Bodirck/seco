"""Synthetic inspection-report PDF generator.

Generates realistic technical inspection reports in PDF format for Luxembourg
buildings, organized by discipline and using RICS condition ratings.

No network calls are made. Output is fully deterministic given the same seed
and building list, so the pipeline is reproducible offline.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Defect vocabulary per discipline
# Each entry: (element, description_template, location_options, rics_rating)
# ---------------------------------------------------------------------------

_VOCABULARY: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Structure": [
        (
            "Dalle de plancher",
            "Fissures de flexion visibles en sous-face, ouverture estimee a 0.3 mm.",
            ["Niveau 3, axe B-C", "Niveau 1, axe A-B", "Sous-sol, axe C-D"],
            "C2",
        ),
        (
            "Poteau beton",
            "Eclatement du beton d'enrobage avec armatures apparentes sur 15 cm.",
            ["Hall central, file 4", "Parking niveau -1, file 2", "Niveau 2, file 5"],
            "C3",
        ),
        (
            "Poutre principale",
            "Deformation excessive visible a mi-portee, fleche mesuree a L/250.",
            ["Niveau 2, entre axes 3 et 5", "Niveau 4, entre axes 1 et 3"],
            "C2",
        ),
        (
            "Voile porteur",
            "Fissures diagonales en extremite de voile, probablement liees a un tassement differentiel.",
            ["Cage d'escalier nord", "Facade ouest, niveaux 1-2", "Core central"],
            "C3",
        ),
        (
            "Fondation superficielle",
            "Tassement differentiel observe, ecart de 8 mm entre deux mesures de nivellement.",
            ["Angle nord-est", "Facade sud"],
            "C2",
        ),
        (
            "Plancher collaborant",
            "Corrosion des bacs acier sous chape, aucune perforation mais oxydation generalisee.",
            ["Niveau 2, zone bureau B", "Niveau 5, open space"],
            "C1",
        ),
    ],
    "Toiture": [
        (
            "Membrane d'etancheite",
            "Cloques et decollements localises sur 4 m², risque d'infiltration en periode de pluie.",
            ["Terrasse niveau 7, zone nord-ouest", "Acrotere est", "Terrasse technique"],
            "C2",
        ),
        (
            "Acrotere",
            "Fissuration du couronnement sur 3 m lineaires, joint de dilatation obture.",
            ["Facade nord", "Angle sud-est", "Facade ouest"],
            "C2",
        ),
        (
            "Evacuation pluviale",
            "Descente bouchee, depot de feuilles et sediments, ecoulement bloque.",
            ["Noue centrale", "Terrasse sud, descente D3", "Angle nord-ouest"],
            "C1",
        ),
        (
            "Isolation thermique",
            "Decollement des panneaux isolants sous membrane, pont thermique potentiel.",
            ["Zone centrale, 20 m²", "Terrasse nord, bordure"],
            "C1",
        ),
        (
            "Lanterneau",
            "Joint de vitrage deteriore, condensation entre les vitrages, perte de transparence.",
            ["Cage d'escalier principale", "Atrium central"],
            "C2",
        ),
    ],
    "Facade": [
        (
            "Bardage metallique",
            "Corrosion en pied de panneaux sur 4 files verticales, peinture cloquee.",
            ["Facade ouest, niveaux 1-3", "Facade nord, file 2"],
            "C2",
        ),
        (
            "Vitrage exterieur",
            "Bris de vitrage feuillete externe sur un panneau, vitrage interne intact.",
            ["Facade sud, niveau 4, panneau V-47", "Facade est, niveau 2"],
            "C2",
        ),
        (
            "Joints de mastic",
            "Vieillissement et retrait des joints verticaux, micro-fissuration cohesive.",
            ["Ensemble de la facade est", "Angles nord, niveaux 5-7"],
            "C1",
        ),
        (
            "Brise-soleil",
            "Ancrage d'un brise-soleil deserre, jeu de 5 mm observe, risque de chute.",
            ["Facade sud, niveau 6, lame LS-12", "Facade ouest, niveau 3"],
            "C3",
        ),
        (
            "Enduit de facade",
            "Decollements et gonflements sur 6 m², risque de chute de plaques.",
            ["Pignon nord, zone mediane", "Facade est, niveau 2"],
            "C2",
        ),
    ],
    "Securite incendie": [
        (
            "Porte coupe-feu",
            "Ferme-porte defaillant, la porte reste ouverte en position non maintenue.",
            ["Niveau 3, couloir principal", "Cage d'escalier B, niveau 2", "Local technique"],
            "C3",
        ),
        (
            "Compartimentage",
            "Passe-cable non obture autour de gaines, rupture de compartimentage CF 60.",
            ["Faux plafond niveau 2, gaine technique nord", "Tableau electrique niveau 1"],
            "C3",
        ),
        (
            "Detecteur de fumee",
            "Deux detecteurs hors service, signalement de defaut sur la centrale incendie.",
            ["Zone 4, detecteurs D-14 et D-15", "Zone 2, detecteur D-07"],
            "C2",
        ),
        (
            "Extincteur portatif",
            "Date de revision depassee de plus de 12 mois pour 3 extincteurs.",
            ["Couloir niveau 1", "Local menage niveau 3", "Parking"],
            "C1",
        ),
        (
            "Eclairage de securite",
            "Bloc autonome non fonctionnel, lampe de remplacement non montee.",
            ["Issue de secours nord, niveau 1", "Cage d'escalier A, niveau 4"],
            "C2",
        ),
        (
            "Desenfumage",
            "Trappe de desenfumage bloquee en position fermee, verrin oxyde.",
            ["Cage d'escalier C, niveau 5", "Hall d'entree, trappe T-3"],
            "C3",
        ),
    ],
    "CVC": [
        (
            "Groupe frigorifique",
            "Fuite de fluide frigorigene detectee au niveau du compresseur, recharge necessaire.",
            ["Toiture, GF-2", "Local technique niveau -1, GF-1"],
            "C2",
        ),
        (
            "Centrale de traitement d'air",
            "Filtres G4 colmates (saut de pression 250 Pa), encrassement des batteries.",
            ["Local CTA niveau -1, CTA-Nord", "Toiture, CTA-Sud"],
            "C1",
        ),
        (
            "Reseau de tuyauteries",
            "Corrosion externe de la tuyauterie acier en local technique, isolation endommagee.",
            ["Local chaufferie, troncon retour", "Vide sanitaire, troncon aller"],
            "C2",
        ),
        (
            "Tour aerorefrigerante",
            "Legionella: prelevement hors norme lors de la derniere analyse (> 1000 UFC/L).",
            ["Toiture, tour TAR-1"],
            "C3",
        ),
        (
            "Robinetterie",
            "Robinet de regulation gripe, regulation thermique du circuit hors service.",
            ["Niveau 2, circuit est", "Chaufferie, depart primaire"],
            "C1",
        ),
        (
            "Gaine de ventilation",
            "Gaine flexible deconnectee, soufflage de l'air pleniere vers le faux plafond.",
            ["Bureau 214, faux plafond", "Salle de reunion 305"],
            "C2",
        ),
    ],
    "Electricite": [
        (
            "Tableau divisionnaire",
            "Absence de protection differentielle 30 mA sur le circuit prises, non conforme NF C 15-100.",
            ["TD niveau 2, armoire A2", "TD niveau 4, armoire B1"],
            "C3",
        ),
        (
            "Chemin de cables",
            "Chemins de cables surcharges, cables en vrac et non attaches, risque d'echauffement.",
            ["Faux plafond couloir niveau 1", "Gaine technique verticale"],
            "C2",
        ),
        (
            "Eclairage general",
            "Luminaires LED defaillants, taux de panne superieur a 20% dans la zone.",
            ["Open space niveau 3, zone nord", "Parking niveaux -1 et -2"],
            "C1",
        ),
        (
            "Groupe electrogene de secours",
            "Groupe non demarre lors du dernier essai mensuel, panne de demarreur signalée.",
            ["Local GE, niveau -1"],
            "C3",
        ),
        (
            "Prise de terre",
            "Resistance de terre mesuree a 28 Ohms, seuil admissible de 30 Ohms approche.",
            ["Barrette de terre, local TGBT"],
            "C1",
        ),
        (
            "TGBT",
            "Echauffement anormal detecte au thermogramme infrarouge sur la jeu de barres.",
            ["Local TGBT, niveau -1"],
            "C2",
        ),
    ],
}

_RICS_LABELS = {
    "C1": "minor",
    "C2": "major",
    "C3": "critical",
}

_RICS_DESC = {
    "C1": "Condition 1 - No immediate action required. Monitor at next inspection.",
    "C2": "Condition 2 - Defect requiring repair or investigation in the short term.",
    "C3": "Condition 3 - Urgent defect requiring immediate action to prevent risk.",
}

# A small pool of Luxembourg-flavored inspectors
_INSPECTORS = [
    "Ing. P. Schmit, SECO Luxembourg S.A.",
    "Ing. M. Thill, SECO Luxembourg S.A.",
    "Ing. C. Wagner, SECO Luxembourg S.A.",
    "Ing. A. Becker, SECO Luxembourg S.A.",
]

_DISCIPLINES = list(_VOCABULARY.keys())


def _sample_defects(
    rng: random.Random, discipline: str, n: int
) -> list[dict[str, str]]:
    """Pick n distinct defects for a discipline without repetition."""
    pool = _VOCABULARY[discipline]
    chosen = rng.sample(pool, min(n, len(pool)))
    result = []
    for element, desc, locations, rics in chosen:
        location = rng.choice(locations)
        result.append(
            {
                "element": element,
                "description": desc,
                "location": location,
                "rics": rics,
                "rics_desc": _RICS_DESC[rics],
                "severity": _RICS_LABELS[rics],
            }
        )
    return result


def _build_inspection_date(rng: random.Random) -> date:
    """Return a plausible recent inspection date."""
    base = date(2024, 1, 1)
    offset = rng.randint(0, 364)
    return base + timedelta(days=offset)


def _format_ref(building_id: int, insp_date: date) -> str:
    return f"BL-LU-{building_id:04d}-{insp_date.strftime('%Y%m%d')}"


def _draw_header(canvas: Any, doc: Any, building: dict, insp_date: date, ref: str) -> None:
    """Draw a simple page header with building metadata."""
    from reportlab.lib import colors
    from reportlab.lib.units import mm

    canvas.saveState()

    # Top bar
    canvas.setFillColor(colors.HexColor("#1a3a5c"))
    canvas.rect(10 * mm, doc.height + doc.topMargin - 18 * mm, doc.width, 14 * mm, fill=1, stroke=0)

    # Title in bar
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(12 * mm, doc.height + doc.topMargin - 9 * mm, "RAPPORT D'INSPECTION TECHNIQUE - BUILDINGLENS")

    # Building info below bar
    canvas.setFillColor(colors.HexColor("#1a3a5c"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(12 * mm, doc.height + doc.topMargin - 22 * mm, f"Batiment : {building['name']}")
    canvas.setFont("Helvetica", 8)
    canvas.drawString(12 * mm, doc.height + doc.topMargin - 27 * mm, f"Adresse  : {building['address']}")
    canvas.drawString(12 * mm, doc.height + doc.topMargin - 32 * mm,
                      f"Date d'inspection : {insp_date.strftime('%d/%m/%Y')}    "
                      f"Reference : {ref}")

    # Footer
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.grey)
    canvas.drawString(12 * mm, 8 * mm, f"BuildingLens - Rapport confidentiel - Page {canvas.getPageNumber()}")

    canvas.restoreState()


def generate_reports(
    buildings: list[dict],
    out_dir: str | Path,
    seed: int = 0,
) -> list[tuple[int, Path]]:
    """Generate one PDF inspection report per building.

    Parameters
    ----------
    buildings:
        List of dicts with keys id, name, address, year_built, height_m.
    out_dir:
        Directory where report_<building_id>.pdf files are written. Created
        if it does not exist.
    seed:
        Base random seed for reproducibility. Each building uses seed + id.

    Returns
    -------
    List of (building_id, pdf_path) pairs.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        BaseDocTemplate,
        Frame,
        PageTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
    )

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()

    style_h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontSize=12,
        textColor=colors.HexColor("#1a3a5c"),
        spaceAfter=4,
    )
    style_h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=10,
        textColor=colors.HexColor("#2e6da4"),
        spaceAfter=2,
        spaceBefore=6,
    )
    style_body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
    )
    style_small = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=7,
        leading=10,
        textColor=colors.grey,
    )

    results: list[tuple[int, Path]] = []

    for building in buildings:
        bid = building["id"]
        rng = random.Random(seed + bid)

        insp_date = _build_inspection_date(rng)
        ref = _format_ref(bid, insp_date)
        inspector = rng.choice(_INSPECTORS)

        pdf_path = out_dir / f"report_{bid}.pdf"

        # -- Document setup with header/footer via page template --
        doc = BaseDocTemplate(
            str(pdf_path),
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=45 * mm,
            bottomMargin=20 * mm,
        )

        def make_header(canvas: Any, doc: Any) -> None:
            _draw_header(canvas, doc, building, insp_date, ref)

        frame = Frame(
            doc.leftMargin,
            doc.bottomMargin,
            doc.width,
            doc.height,
            id="main",
        )
        template = PageTemplate(id="main", frames=[frame], onPage=make_header)
        doc.addPageTemplates([template])

        story = []

        # --- Cover section ---
        story.append(Paragraph("Rapport d'inspection technique des batiments", style_h1))
        story.append(Spacer(1, 3 * mm))

        # EUBUCCO has no construction year for Luxembourg, so year_built is often
        # None; height is well covered but stay defensive about both.
        year_built = building.get("year_built")
        year_str = str(year_built) if year_built is not None else "N/D"
        height_m = building.get("height_m")
        height_str = f"{height_m} m" if height_m is not None else "N/D"

        meta_data = [
            ["Batiment", building["name"]],
            ["Adresse", building["address"]],
            ["Annee de construction", year_str],
            ["Hauteur du batiment", height_str],
            ["Date d'inspection", insp_date.strftime("%d %B %Y")],
            ["Inspecteur", inspector],
            ["Reference du rapport", ref],
        ]
        meta_table = Table(meta_data, colWidths=[60 * mm, doc.width - 60 * mm])
        meta_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dce8f5")),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#f5f9ff"), colors.white]),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#aaaaaa")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(meta_table)
        story.append(Spacer(1, 6 * mm))

        # --- Summary sentence ---
        if year_built is not None:
            age_phrase = f"a ete construit il y a environ {insp_date.year - year_built} ans"
        else:
            age_phrase = "a une annee de construction non renseignee dans les donnees publiques"
        story.append(
            Paragraph(
                f"Ce rapport presente les observations relevees lors de l'inspection visuelle et "
                f"instrumentale du batiment {building['name']}, situe {building['address']}, "
                f"Luxembourg. Le batiment {age_phrase} "
                f"(hauteur : {height_str}). Les observations sont classees "
                f"selon l'echelle RICS : C1 (mineur), C2 (significatif), C3 (critique).",
                style_body,
            )
        )
        story.append(Spacer(1, 5 * mm))

        # Sample every discipline's defects up front so the conclusion count
        # stays consistent with the tables, and so output is fully deterministic.
        sections = [
            (discipline, _sample_defects(rng, discipline, rng.randint(2, 4)))
            for discipline in _DISCIPLINES
        ]

        # --- Discipline sections ---
        for discipline, defects in sections:
            story.append(Paragraph(discipline, style_h2))

            # Table header
            table_data = [
                [
                    Paragraph("<b>Element</b>", style_small),
                    Paragraph("<b>Observation</b>", style_small),
                    Paragraph("<b>Localisation</b>", style_small),
                    Paragraph("<b>RICS</b>", style_small),
                ]
            ]
            for d in defects:
                rics_color = {
                    "C1": colors.HexColor("#e8f5e9"),
                    "C2": colors.HexColor("#fff9e6"),
                    "C3": colors.HexColor("#fdecea"),
                }[d["rics"]]
                table_data.append(
                    [
                        Paragraph(d["element"], style_small),
                        Paragraph(d["description"], style_small),
                        Paragraph(d["location"], style_small),
                        Paragraph(f"<b>{d['rics']}</b>", style_small),
                    ]
                )

            col_widths = [40 * mm, doc.width - 40 * mm - 35 * mm - 15 * mm, 35 * mm, 15 * mm]
            t = Table(table_data, colWidths=col_widths, repeatRows=1)
            row_bg = [colors.HexColor("#dce8f5")]
            for i, d in enumerate(defects):
                row_bg.append(
                    {
                        "C1": colors.HexColor("#f5fbf5"),
                        "C2": colors.HexColor("#fffdf0"),
                        "C3": colors.HexColor("#fff5f5"),
                    }[d["rics"]]
                )

            style_items = [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
            for idx in range(len(table_data)):
                style_items.append(("BACKGROUND", (0, idx), (-1, idx), row_bg[idx]))

            t.setStyle(TableStyle(style_items))
            story.append(t)
            story.append(Spacer(1, 3 * mm))

        # --- Conclusion ---
        story.append(Paragraph("Conclusion et recommandations", style_h1))
        c3_count = sum(
            1
            for _discipline, defects in sections
            for d in defects
            if d["rics"] == "C3"
        )
        story.append(
            Paragraph(
                f"L'inspection a identifie plusieurs observations dont {c3_count} classees en "
                f"condition C3 (critique), necessitant une intervention immediate. "
                f"Un suivi sous 30 jours est recommande pour les elements en C3. "
                f"Les elements en C2 devront etre traites dans un delai de 6 mois. "
                f"Un prochain rapport complet est recommande dans 12 mois.",
                style_body,
            )
        )
        story.append(Spacer(1, 4 * mm))
        story.append(
            Paragraph(
                f"Rapport etabli par : {inspector}    Date : {insp_date.strftime('%d/%m/%Y')}",
                style_small,
            )
        )

        doc.build(story)
        results.append((bid, pdf_path))

    return results


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import tempfile

    BUILDINGS = [
        {
            "id": 1,
            "name": "Immeuble Alpha",
            "address": "12 Rue de la Liberte, L-1930 Luxembourg",
            "year_built": 1985,
            "height_m": 22.5,
        },
        {
            "id": 2,
            "name": "Residence Beta",
            "address": "7 Avenue de la Gare, L-1610 Luxembourg",
            "year_built": 2003,
            "height_m": 14.0,
        },
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        items = generate_reports(BUILDINGS, tmpdir, seed=42)
        for bid, path in items:
            size_kb = path.stat().st_size // 1024
            print(f"  building_id={bid}  file={path.name}  size={size_kb} KB")
    print("synthetic_reports smoke: OK")
