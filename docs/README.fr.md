# BuildingLens

> Des rapports d'inspection technique non structurés à une vue de risque actionnable à l'échelle du portefeuille, avec des réponses citées.

![Python 3.11](https://img.shields.io/badge/Python-3.11-blue) ![Licence : MIT](https://img.shields.io/badge/Licence-MIT-green) ![Hors ligne](https://img.shields.io/badge/hors%20ligne-sans%20cl%C3%A9%20API-success) ![UI](https://img.shields.io/badge/UI-Streamlit%20%2B%20React-orange)

[English](../README.md) | **Français**

[**Voir la démo**](../buildinglens-demo-web.mp4) (présentation de 9 min : recherche, dossier bâtiment, import, et Q&A sourcée). Plan détaillé dans [`demo-script.md`](demo-script.md).

BuildingLens transforme des rapports d'inspection technique de bâtiments (PDF non structurés) et des données publiques de bâtiments en une vue de risque actionnable pour un asset manager ou un assureur construction. Il extrait les défauts des rapports, score le risque de chaque bâtiment, et permet d'interroger tout le parc en langage naturel avec des sources citées, sur un corpus de démonstration reproductible de 40 bâtiments inspectés. Il se reproduit depuis zéro et fonctionne hors ligne en mode mock sans clé API LLM.

## Démarrage rapide

```bash
# 1. Installer (deps Python + React)
make install
cd web && npm install && cd ..      # deps React, premiere fois seulement

# 2. Construire les donnees de demo et l'index IA
make data                           # EUBUCCO + STATEC + communes + PDF synthetiques -> SQLite
make extract                        # extraction LLM des defauts + scoring du risque + index RAG

# 3. Lancer l'app, puis ouvrir http://localhost:5173
make web                            # FastAPI (:8000) + React (Vite, :5173) ensemble
```

Pas de clé API ? Copier `.env.example` vers `.env` et mettre `LLM_PROVIDER=mock` : tout le pipeline, l'application et l'évaluation tournent hors ligne (le mode mock n'insère aucun défaut ; ajouter une clé pour la vraie extraction). Streamlit est une UI de secours légère (`make run`), et `make eval` évalue l'extraction contre le gold set. Détails complets dans [Reproductibilité](#reproductibilité).

## Ce que ça fait

- **Extraire les défauts.** Chaque PDF d'inspection devient une liste structurée de défauts, chacun avec élément, localisation, sévérité (critique / majeur / mineur) et une citation textuelle.
- **Scorer le risque.** Les défauts d'un bâtiment s'agrègent en un score de risque unique de 0 à 100 avec le décompte par sévérité, pour classer tout un parc d'un coup d'oeil.
- **Demander en langage naturel.** Un Q&A RAG répond en français ou en anglais, ancré uniquement dans le texte des rapports, cite les blocs sources utilisés, et dit qu'il ne sait pas plutôt que d'inventer.

## 1. Quel problème, et pour qui ?

L'utilisateur est un **asset manager ou un assureur construction**. Le point de douleur concret : aujourd'hui il ne peut pas obtenir une réponse rapide à l'échelle du portefeuille à la question "lesquels de mes bâtiments ont des défauts critiques, et lesquels ?", parce que la réponse est dispersée dans des rapports d'inspection rédigés en prose, pas dans une structure interrogeable.

BuildingLens répond avec trois briques qui fonctionnent ensemble :

1. **Extraction des défauts.** Un PDF d'inspection devient une liste structurée de défauts, chacun avec `element`, `description`, `location`, `severity` (critique / majeur / mineur) et une `citation` (l'extrait textuel du rapport qui le justifie).
2. **Scoring du risque.** Les défauts d'un bâtiment sont agrégés en un score de risque unique de 0 à 100, plus le décompte critique / majeur / mineur, pour classer tout un parc d'un coup d'oeil.
3. **Q&A RAG avec citations.** On peut demander, en français ou en anglais, "quels sont les défauts critiques du bâtiment X ?" ou "quels bâtiments présentent un risque incendie ?". Les réponses sont ancrées uniquement dans le texte récupéré, chaque réponse cite les blocs sources utilisés, et le modèle est instruit de dire qu'il ne sait pas plutôt que d'inventer.

## 2. En quoi est-ce pertinent pour SECO ?

SECO est un organisme indépendant de contrôle technique et d'ingénierie pour la construction (fondé en 1934 en Belgique, SECO Luxembourg depuis 1987, environ 12 500 ouvrages inspectés au fil de son histoire). Son métier coeur, le contrôle technique de construction, est exactement l'amont de la garantie d'assurance décennale et biennale : SECO produit le rapport initial pour l'assureur ainsi que les notes d'inspection qui forment la base de l'évaluation du risque.

Ce métier génère de gros volumes de données techniques (rapports d'inspection par phase, tableaux de synthèse des observations par discipline, photos de défauts, mesures, scans BIM) qui restent aujourd'hui largement sous-exploités. Il n'y a ni recherche ni RAG sur les rapports, ni modèle de défauts par-dessus. C'est précisément le point de douleur de ce challenge.

BuildingLens s'adresse directement à la chaîne de valeur de SECO :

- La structure défaut-par-discipline qu'il produit reflète les propres tableaux de synthèse des observations de SECO, où chaque constat est tagué par discipline et noté.
- Le point de contact assureur est l'endroit naturel pour un **signal de risque exploitable par machine** au lieu d'un PDF, ce qui transforme un service de contrôle en partenariat de données.
- Le corpus historique de SECO (des milliers d'ouvrages inspectés) est un jeu de données propriétaire uniquement structurable : des observations horodatées, taguées par discipline, liées aux plans et aux normes. C'est l'un des problèmes "non structuré vers structuré" les plus propres de la construction.

La taxonomie de sévérité est ancrée sur des échelles publiques reconnues (les notes de condition RICS C1/C2/C3 comme trois classes canoniques, avec ASTM E2018 et les classes de conséquence Eurocode CC1/CC2/CC3 comme vocabulaire public complémentaire).

## 3. Quelles sources de données, et pourquoi ?

BuildingLens tourne sur des **données publiques et reproductibles uniquement**, en combinant trois sources luxembourgeoises réelles avec une couche synthétique. Tout peut être re-téléchargé ou régénéré depuis zéro par le pipeline.

| Source | Type / format | Rôle | Licence |
|---|---|---|---|
| **EUBUCCO v0.2 (Luxembourg, `nuts_id=LU00`)** | Structuré, par bâtiment, Parquet (géométrie en WKB, EPSG:3035), téléchargement S3 anonyme | Ancrage par bâtiment : emprises réelles, coordonnées, surface d'emprise, hauteur, plus usage et étages estimés par modèle. Peuple la table `buildings` | Mixte par bâtiment, stocké dans `buildings.source` : cadastre national LOD1 (gov-luxembourg, environ 77%) en CC0 ; OpenStreetMap (environ 13%) en ODbL (attribution et partage à l'identique) ; Microsoft (environ 10%) |
| **STATEC "Autorisations de bâtir"** | Structuré, agrégé, CSV labellisé via l'API REST SDMX LUSTAT (sans clé) | Contexte sectoriel uniquement : tendances d'autorisations par canton et type. Jamais joint aux bâtiments individuels. Satisfait la deuxième source hétérogène du brief | CC0 |
| **Limites communales ACT (Luxembourg)** | Polygones structurés, GeoJSON, EPSG:4326, versionné dans le dépôt (environ 1 Mo) | Récupère la commune réelle de chaque bâtiment par point-dans-polygone sur son centroïde (EUBUCCO ne porte qu'un code grossier, pas un nom) | CC0 |
| **Rapports d'inspection synthétiques** | PDF non structuré (généré avec ReportLab) | Le corpus d'inspection qui alimente l'extraction et le RAG | Généré par le projet |

Pourquoi ces sources : EUBUCCO est la meilleure source ouverte d'attributs par bâtiment pour le Luxembourg (environ 186 000 bâtiments dans le sous-ensemble LU), avec géométrie et hauteur réelles à l'échelle du pays, sans compte. STATEC donne un contexte sectoriel officiel, exploitable par machine et épinglable (dataflows plus `startPeriod`), sans prétendre à une précision par bâtiment. Les limites ACT récupèrent un attribut administratif réel (la commune) qu'EUBUCCO ne nomme pas, et elles sont versionnées dans le dépôt pour que le build reste hors ligne et reproductible à l'octet près.

**Réel vs synthétique (encodé dans les commentaires du schéma) :**

- **Réel, par bâtiment :** géométrie d'emprise et coordonnées (couverture 100%), surface d'emprise en m² calculée depuis le contour réel, et la commune résolue par point-dans-polygone. La hauteur est réelle (cadastre / LOD1) pour environ 78% des bâtiments et estimée par ML pour environ 22%, la source étant signalée.
- **Réel mais estimé par modèle (libellé "estimé" dans l'UI) :** type et sous-type d'usage (en partie estimés par ML, en partie OpenStreetMap), étages (régression, stockés arrondis). L'année de construction est quasi absente dans le sous-ensemble LU et traitée comme non fiable.
- **Synthétique :** nom du bâtiment, rue, numéro et code postal (EUBUCCO n'en fournit aucun pour le Luxembourg), et les rapports d'inspection eux-mêmes avec chaque défaut qu'ils contiennent. Donc la **localisation et l'emprise d'un bâtiment sont réelles, mais son état est fictif.**

Pourquoi les rapports sont synthétiques, et l'argument du remplacement en production : aucun corpus public de vrais rapports d'inspection technique n'existe en volume (ce sont des livrables commerciaux), et EUBUCCO n'a ni noms ni adresses. Un générateur à graine est la seule option entièrement reproductible, et générer le corpus par code est plus robuste qu'un scraping tout en démontrant la maîtrise du schéma cible. En production, ces PDF sont remplacés par de **vrais rapports SECO sans rien changer au reste du pipeline** : extraction, scoring, RAG et schéma restent identiques.

Plus de détails dans `docs/data-sources.md`.

## 4. Décisions techniques et compromis

**Vue d'ensemble de l'architecture.** Deux couches. Une bibliothèque Python coeur, `src/buildinglens/`, porte toute la logique (ingestion des données, accès LLM, extraction, scoring, RAG, génération de rapports). Une fine couche **FastAPI**, `api/`, compose ce coeur en endpoints HTTP ; elle ne réimplémente jamais la logique, elle appelle les fonctions du coeur, et le coeur n'importe jamais l'API. Le stockage est une unique base **SQLite**. Deux front-ends s'appuient sur la même API : une application monopage **React + Vite + TypeScript** (`web/`, la couche de présentation soignée) et une application **Streamlit** légère (`app/`, l'UI de référence). Les deux front-ends sont intentionnels, voir les compromis ci-dessous.

**Abstraction de fournisseur LLM.** Un unique protocole `LLMClient` (`complete` et `stream`) est implémenté par six backends : `anthropic`, `openai`, `mistral`, `local` (Ollama en HTTP, sans clé) et `mock`. Chaque SDK fournisseur est importé paresseusement, donc un paquet manquant ne casse que si on sélectionne réellement ce fournisseur. La fabrique a un comportement de sécurité délibéré : si un fournisseur en ligne est sélectionné mais que sa clé manque, elle renvoie le client mock au lieu de planter, et les appelants peuvent détecter ce repli silencieux. C'est ce qui garde toute l'application exécutable sans clé.

**Couche de réglages à l'exécution.** Le fournisseur, la clé et le modèle sont modifiables à l'exécution depuis la page Réglages et persistés dans SQLite (table `app_settings`), donc la configuration survit à un redémarrage. La dataclass `Settings` est figée et jamais mutée ; à la place la config effective est reconstruite depuis les défauts `.env` plus les surcharges persistées, puis re-liée atomiquement. Le chemin de la base est volontairement exclu de ce qui est surchargeable à l'exécution. Le compromis est assumé : le chemin live utilise une re-liaison de variable globale de module mono-processus plutôt qu'une injection de dépendance, ce qui est simple et correct pour un seul processus serveur mais devrait être revu avec plusieurs processus workers.

Autres décisions et compromis acceptés :

- **SQLite, pas Postgres.** Zéro configuration, entièrement reproductible, assez rapide à cette échelle, et cela fait fonctionner `make data && make run` depuis zéro. Le journal WAL et un busy-timeout sont activés pour que l'API serve lectures, écritures de réglages et écritures d'ingestion depuis un pool de threads sans erreur "database is locked". Compromis : cela ne tiendrait pas une vraie charge production multi-écrivains concurrente ; c'est un remplacement connu.
- **pdfplumber pour le texte, pas d'OCR.** Le corpus synthétique est nativement numérique, donc l'extraction de texte simple suffit et l'OCR serait du poids mort ici. Compromis : de vrais rapports scannés avec photos demanderaient une étape OCR (Tesseract ou un modèle de mise en page), listée comme à refaire pour la production.
- **Embeddings locaux pour le RAG.** La récupération utilise LlamaIndex avec un modèle `sentence-transformers` multilingue local (`paraphrase-multilingual-MiniLM-L12-v2`), donc aucun texte d'embedding ne quitte la machine et il n'y a pas de coût réseau par requête une fois les poids en cache. Le LLM interne de LlamaIndex est désactivé pour qu'il ne construise jamais un client OpenAI dans notre dos ; la génération passe toujours par notre abstraction de fournisseur. Compromis : un petit modèle et un magasin de vecteurs en mémoire conviennent à ce corpus mais passeraient à un vrai magasin de vecteurs à l'échelle.
- **Score de risque calibré à la main, pas appris.** Le score vaut `100 * (1 - exp(-raw / K))` avec des poids de sévérité critique=10, majeur=4, mineur=1 et K=30, qui sature pour que même les bâtiments très dégradés restent dans 0 à 100. Il est calibré pour un étalement plausible, pas appris. Avec un vrai historique labellisé, cela devrait devenir un modèle ajusté.
- **Un seul appel d'extraction par document.** L'extraction est un unique appel JSON ancré par rapport (sans tool-use), avec un parsing tolérant aux fences et un nouvel essai sur la sous-chaîne entre la première et la dernière accolade. Les défauts à sévérité non reconnue sont ignorés avec un avertissement plutôt qu'insérés. Cela privilégie la robustesse et la simplicité plutôt que le rappel maximal.
- **Streamlit d'abord, puis React.** Streamlit a prouvé les trois features coeur rapidement et reste l'UI de référence minimale. L'application React a été ajoutée par-dessus la même API pour rendre le produit présentable en démo (vues dossier, Q&A en streaming, graphique de portefeuille, carte de localisation). L'application Streamlit est l'UI de référence et l'application React la version soignée, toutes deux sur la même API.
- **Dégradation défensive partout.** Chaque récupération externe (EUBUCCO, LUSTAT, limites communales) a un repli déterministe hors ligne, les lignes invalides sont averties-et-ignorées au lieu d'avorter un lot, et une ingestion échouée effectue un rollback compensatoire complet pour ne jamais laisser d'orphelins.
- **Import protégé contre les doublons.** Un nouveau bâtiment créé depuis une adresse est rattaché à son emprise réelle EUBUCCO ; la même emprise sous le même nom est alors reconnue comme déjà présente, donc l'import est bloqué (le dossier existant est montré, avec un contournement en un clic) au lieu de créer silencieusement une copie. Les correspondances plus souples (nom similaire, emprise proche) sont signalées mais ne bloquent jamais, donc un bâtiment réellement nouveau n'est jamais refusé à tort. Le contrôle s'exécute sous le verrou d'ingestion et avant l'extraction coûteuse, ce qui ferme aussi la course au double envoi et rend un doublon refusé gratuit.

L'application web est stylée comme une interface sombre "dossier / terminal". Elle embarque des ressources de traduction complètes en anglais et en français, mais elle s'initialise actuellement en anglais uniquement et n'a pas de sélecteur de langue actif dans l'UI (le bundle français reste chargé pour pouvoir réactiver le commutateur plus tard).

Plus de détails dans `docs/architecture.md` et `docs/api.md`.

## 5. Que mettre en production demain vs jeter

**À garder pour la production (avec de petits changements) :**

- La frontière de la bibliothèque coeur (données / LLM / extraction / scoring / RAG séparés de l'API).
- L'abstraction de fournisseur et le repli mock. Pouvoir changer de fournisseur ou tourner hors ligne sans clé est réellement utile en exploitation.
- Le contrat d'extraction : des défauts structurés avec une citation textuelle par constat, ce qui rend la sortie auditable.
- Le garde-fou de citation et de "je ne sais pas" du RAG, la résolution des sources par requête groupée (jamais N+1), et le protocole de streaming.
- Le pipeline reproductible avec replis hors ligne et la provenance réel-vs-synthétique honnête encodée dans le schéma.

**À jeter ou refaire avant la production :**

- Les **rapports d'inspection synthétiques**, remplacés par de vrais rapports SECO (le reste du pipeline reste).
- Le **gold set d'évaluation synthétique**, remplacé par un gold set annoté à la main sur de vrais rapports (voir la section évaluation pour pourquoi le 1.00 actuel n'est pas un vrai chiffre de précision).
- Les **poids de scoring calibrés à la main**, remplacés par un modèle ajusté sur un historique réel de sinistres ou de défauts.
- **SQLite**, échangé contre une base managée dès qu'il y a de la vraie concurrence, et la re-liaison mono-processus de la couche de réglages retravaillée pour plusieurs workers.
- Le **CORS** accepte n'importe quelle origine localhost en dev (un regex, pour que le port de repli de Vite fonctionne aussi) ; la production demande une liste d'origines resserrée ou un reverse proxy.
- Une **étape OCR** serait ajoutée pour les rapports scannés (Tesseract ou un modèle de mise en page, avant l'extraction).
- L'**indexation RAG incrémentale** remplacerait le réindex complet par upload par une file d'ingestion en arrière-plan et une indexation différentielle, pour qu'ajouter un rapport ne ré-embedde pas tout le corpus.
- **Confiance d'extraction et file de relecture** : un score de confiance par défaut et une étape de relecture avec humain dans la boucle, pour que les constats peu sûrs soient validés avant d'entrer dans le score.
- **Observabilité et CI** : logging structuré, suivi de coût par appel LLM, et runs d'évaluation en CI, pour que la qualité et le coût restent visibles à mesure que le corpus grossit.

## 6. Avec 3 mois de plus

BuildingLens passerait d'un outil par bâtiment à un cockpit de risque assureur à l'échelle du portefeuille :

- une carte géo du parc avec points chauds de risque et agrégation multi-bâtiments, croisée avec la classe énergétique (DPE), bâtie sur les coordonnées et communes réelles déjà dans la base ;
- une vue temporelle de l'évolution du risque de chaque bâtiment au fil de ses inspections par phase, pour voir si un ouvrage s'améliore ou se dégrade plutôt qu'un simple instantané ;
- l'étalonnage du risque d'un bâtiment face au portefeuille ou à des types de bâtiments et cantons similaires, via le contexte sectoriel STATEC déjà ingéré ;
- une ingestion taguée par discipline qui lie les défauts aux plans et normes (références Eurocode), en reflétant les tableaux de synthèse des observations de SECO pour que la sortie s'insère dans le flux de travail existant ;
- un signal de risque exploitable par machine livré aux assureurs via API, pour qu'un service de contrôle technique devienne un produit de données ;
- un accès d'équipe par rôle derrière le SSO Azure Entra ID, avec des vues distinctes pour inspecteur, asset manager et assureur ;
- de la vision par ordinateur sur les photos de défauts (détection de fissures, assistance à la sévérité) avec suivi spatial sur un modèle BIM ou un scan 3D, pour qu'un défaut soit localisé dans l'ouvrage, pas seulement décrit en prose ;
- de l'apprentissage actif qui réinjecte les corrections des opérateurs dans l'extraction et le scoring ;
- la traçabilité des données et une posture RGPD : provenance de bout en bout, journal d'audit des actions d'ingestion et d'édition, résidence et rétention des données, et une option LLM hébergée en UE via l'abstraction de fournisseur.

C'est une vision, ce n'est pas codé.

## Architecture en bref

```
Sources publiques            Coeur (src/buildinglens/)             Interfaces
-----------------            -------------------------             ----------
EUBUCCO parquet  ─┐
Communes ACT     ─┼─ ingest ─▶ SQLite (buildings/documents/        FastAPI (api/)  ─┬─▶ React + Vite (web/)
Permis STATEC    ─┘            defects/app_settings)                                 └─▶ (même API)
                                      │                             Streamlit (app/)
PDF synthétiques ─ ingest_pdf ────────┤
                                      ├─ extract  (LLM, JSON + citation)
                                      ├─ scoring  (risque 0..100)
                                      └─ rag      (LlamaIndex + embeddings locaux,
                                                   génération via abstraction de fournisseur)

Abstraction de fournisseur LLM : anthropic | openai | mistral | local (Ollama) | mock
Réglages à l'exécution (fournisseur/clé/modèle) persistés dans SQLite, modifiables sans redémarrage.
```

## Reproductibilité

Tout tourne depuis zéro. Python 3.11 recommandé. Les cibles `make` sont dans le [Démarrage rapide](#démarrage-rapide). `make web` démarre le backend FastAPI et le serveur de dev React ensemble (il lance `scripts/dev.py`). Pour les lancer séparément, dans deux terminaux :

```bash
# Terminal 1 : backend FastAPI
python -m uvicorn api.main:app --port 8000

# Terminal 2 : application web React
cd web
npm install
npm run dev        # serveur de dev Vite sur http://localhost:5173, proxy /api vers :8000
```

Extras : `make run` (UI de secours Streamlit), `make test` (pytest), `make fmt` (ruff format), `make clean` (supprime la base générée, garde les sources brutes téléchargées).

**Mode mock (sans clé API).** Copier `.env.example` vers `.env`. Sans clé, mettre `LLM_PROVIDER=mock` (ou passer `--mock`) pour utiliser des fixtures déterministes : tout le pipeline, l'application et l'évaluation tournent hors ligne. `.env` n'est jamais commité ; les clés sont laissées vides dans l'exemple (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`), le modèle par défaut est `claude-opus-4-8`, et le fournisseur local pointe sur Ollama (`http://localhost:11434`, `llama3.1`). Note : la vraie extraction de défauts demande une clé. En mode mock, `make extract` n'insère aucun défaut, donc `make eval` rapporte alors le gold set avec zéro prédiction et affiche un indice pour configurer une clé.

## Évaluation

L'évaluation est dans `eval/eval_extraction.py` et compare les défauts **prédits** (ce que l'extraction a écrit dans la table `defects`) à une **vérité terrain synthétique**.

- **Gold set.** C'est l'ensemble exact des défauts que le générateur a intégrés dans chaque rapport, reconstruit au moment de l'éval et persisté dans `eval/gold.jsonl` (une ligne JSON par défaut). Le set versionné compte **241 défauts sur 40 bâtiments**.
- **Appariement.** Au niveau de l'élément, par bâtiment : une prédiction correspond à un défaut du gold quand leurs ensembles de tokens d'élément normalisés se recouvrent assez (Jaccard au moins 0,5, ou un ensemble est inclus dans l'autre). L'appariement est glouton et un-à-un.
- **Métriques rapportées.** `gold_defects`, `predicted_defects`, `matched` (vrais positifs), **précision**, **rappel**, **F1**, et **exactitude de sévérité** mesurée uniquement sur les paires appariées (correspondance exacte de sévérité), le tout arrondi à trois décimales.

**Limites honnêtes.** Comme le même générateur écrit les PDF et émet le gold set, c'est une **vérification de mécanique sur la fidélité d'extraction sur texte synthétique, pas une exactitude réelle.** Avec Claude le run rapporte une précision, un rappel et un F1 de 1.00 et une exactitude de sévérité de 1.00 ; c'est attendu et montre seulement que le modèle relit ce que le générateur a injecté et mappe chaque note RICS à la bonne sévérité. Cela ne doit pas se lire comme un vrai chiffre de précision. De vrais rapports hétérogènes, avec du bruit OCR et des formulations variées, obtiendraient un score plus bas et exigeraient un gold set annoté à la main, listé comme à refaire avant la production.

Autres limites :

- **Hallucinations.** Le chemin RAG est contraint de répondre uniquement à partir du texte récupéré, de citer ses sources et de dire qu'il ne sait pas sinon, mais aucun garde-fou LLM n'est parfait.
- **Faux positifs.** L'extraction peut sur-extraire ou mal classer sur de la vraie prose ; le champ citation existe précisément pour qu'un humain vérifie chaque constat.
- **Données d'inspection synthétiques.** Les rapports et les défauts qu'ils contiennent sont générés, donc l'état de chaque bâtiment est fictif ; seules sa localisation et son emprise sont réelles.

## Démo

Un court screencast du produit est enregistré en local (lancer le backend FastAPI et l'application React, puis dérouler la recherche, un dossier bâtiment et l'ingestion). 

## Couverture du brief

Le MVP coeur est terminé.

- [x] `make data && make run` fonctionne depuis zéro (reproductible)
- [x] Au moins deux sources hétérogènes ingérées, au moins une source publique réelle citée
- [x] Extraction IA des défauts et classification de sévérité, évaluées (vérification de mécanique sur synthétique, P/R/F1 = 1.00 ; voir Évaluation pour pourquoi ce n'est pas une exactitude réelle)
- [x] RAG avec citations et garde-fou anti-hallucination "je ne sais pas"
- [x] UI utilisable (UI de référence Streamlit plus application compagnon React)
- [x] Mode `--mock` pour tourner sans clé API LLM
- [x] README répondant aux six questions, avec limites documentées et compromis assumés
- [x] Historique git propre et atomique
- [x] **Rapports client (feature signature), v1 livrée.** Rapports Excel et PDF par bâtiment, avec code couleur de sévérité et un résumé exécutif LLM (gabarit déterministe en mode mock), exportables depuis le dossier bâtiment. La v2, un tableau de synthèse assureur avec flag automatique des écarts RICS / ASTM, est une extension prévue (voir la section 6).
- [x] Screencast de démo (bonus, enregistré en local)
