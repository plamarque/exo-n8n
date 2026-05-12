# WF04 — Enrichissement des métadonnées (tutoriel FR)

**En bref** — Sur **déclenchement manuel ou planifié**, le workflow interroge un **espace documentaire** eXo, sélectionne jusqu’à **cinq** fichiers **nouveaux ou modifiés**, propose une **description courte** et des **catégories** via un **LLM à sortie structurée**, écrit le résultat dans eXo (**MCP**), et **journalise** l’état dans une **Data Table** n8n pour des exécutions **incrémentales**.

**Vidéo (démo) :** [Loom](https://www.loom.com/share/fe21624ca7a94363b33d21f2e3a66815)

**Spécifications techniques (référence, EN) :** [SPEC.technical.md](SPEC.technical.md) · [SPEC.functional.md](SPEC.functional.md) · [workflow.json](workflow.json)

---

## Contexte

Dans eXo, les **catégories** et **descriptions** assistées par IA existent souvent **document par document**. Pour **industrialiser** la mise à jour sur une bibliothèque, n8n orchestre **MCP eXo** + **modèle OpenAI** : même logique métier qu’à la main, mais **par lots**, avec **plafond** et **historique de traitement**.

## Prérequis

| Côté | Indispensable |
|------|----------------|
| **eXo** | Espace cible (`WF04_SPACE_ID`), documents, arbre de **catégories** ; droits MCP sur la lecture des fichiers, `update_document_description`, `add_content_to_category`. |
| **n8n** | Instance avec **credentials MCP** (eXo) et **OpenAI** ; Data Tables créées par le graphe (`exo_processed_documents`, `exo_category_cache`). |
| **Projet** | `.env` racine avec `WF04_SPACE_ID`, `EXO_SPACE_NAME`, `EXO_MCP_ENDPOINT` — voir [config.env.example](config.env.example) et [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md). |

## Vue d’ensemble du graphe

![WF04 — aperçu dans l’éditeur n8n](wf04.png)

Trois branches au départ se **rejoignent** avant le traitement : **liste des documents**, **table de suivi** (idempotence), **cache des catégories** (arbre mis **à plat** pour le LLM et les lookups). Ensuite, **au plus cinq** documents par exécution passent dans une boucle : lecture du contenu → **prompt** structuré → écriture **description** → **affectation** des catégories validées par libellé.

## Déroulé (aligné sur la démo)

1. **Déclencheur** — manuel ou **cron** (ex. exécution nocturne).
2. **Préparation** — garantir la **table de suivi** ; charger les documents de l’espace ; **synchroniser** les catégories issues de `get_category_tree` dans une table plate (`exo_category_cache`).
3. **Sélection** — exclure ce qui est déjà traité **à jour** ; appliquer la **limite de cinq** documents par run.
4. **Par document** — `get_document_by_id` ; **entrée LLM** (identifiant, nom, contenu, **liste des libellés** de catégories) ; consigne type : **~30 mots** de description et **deux à trois** catégories parmi les libellés fournis ; **schéma de sortie** (description + suggestions).
5. **Écriture eXo** — `update_document_description` ; pour chaque suggestion : **lookup** par libellé dans le cache → si l’ID existe, `add_content_to_category`.
6. **Suivi** — mise à jour de la ligne de suivi (document, URL, horodatage, catégories) pour les prochains passages et pour **retraiter** les fichiers **modifiés** après la dernière exécution.

## Choix didactiques à connaître

- **Pas d’appel `get_my_spaces` dans le graphe** : l’`space_id` est injecté depuis l’environnement (bootstrap possible via [fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)).
- **Libellés de catégories** : le LLM doit **reprendre exactement** les libellés du tenant ; sinon le lookup ne trouve pas d’ID et l’affectation est ignorée.
- **Limite à 5** : garde-fou coût / charge ; documenté dans les specs EN.

## Références

- [README.md](README.md) — tutoriel long (EN) et variables détaillées.
- [SPEC.technical.md](SPEC.technical.md), [SPEC.functional.md](SPEC.functional.md).
- Sous-workflow partagé : [unwrap-mcp-json](../unwrap-mcp-json/).
