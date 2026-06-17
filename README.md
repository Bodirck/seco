# BuildingLens

BuildingLens transforme des rapports d'inspection de bâtiments (PDF) et des données publiques du secteur de la construction en informations exploitables pour un asset manager ou un assureur.

Le produit fait trois choses :

1. **Extraction des défauts.** Il lit les rapports d'inspection et en extrait les défauts constatés.
2. **Scoring de risque.** Chaque défaut est classé par sévérité, puis un score de risque est calculé par bâtiment.
3. **Questions en langage naturel (RAG).** On interroge le parc de bâtiments en langage courant et on obtient des réponses sourcées, avec citation des passages d'origine.

## Pour qui, pour quoi

Un asset manager ou un assureur reçoit beaucoup de rapports d'inspection, longs et hétérogènes. Les lire un par un pour repérer les défauts critiques et comparer les bâtiments prend du temps. BuildingLens centralise cette lecture, met en avant les risques, et permet d'interroger l'ensemble du parc en quelques secondes.

## Statut

Projet en cours de construction. Le dépôt se complète au fil de l'eau :

- [ ] Pipeline de données (sources publiques et jeu d'exemple)
- [ ] Extraction des défauts
- [ ] Classification de sévérité et scoring de risque
- [ ] Recherche et questions/réponses (RAG) avec citations
- [ ] Interface Streamlit
- [ ] Évaluation de l'extraction sur un petit jeu de référence

## Stack envisagée

- Python 3.11
- SQLite pour le stockage
- pdfplumber pour la lecture des PDF
- sentence-transformers et FAISS pour la recherche sémantique
- Un LLM via API, avec un mode hors ligne (mock) pour tourner sans clé
- Streamlit pour l'interface

## Données

Le projet s'appuie uniquement sur des données publiques et reste reproductible depuis zéro. Si des rapports d'inspection publics ne sont pas disponibles, un jeu d'exemple réaliste est généré par script et documenté comme tel.

## Lancer le projet

Les commandes arrivent via un Makefile au fil des prochains commits :

- `make data` : récupère ou génère les données et peuple la base
- `make run` : lance l'interface Streamlit
- `make eval` : évalue l'extraction sur le jeu de référence
