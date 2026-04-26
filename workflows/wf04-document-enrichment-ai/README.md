# Workflow 04 - eXo Document Enrichment with AI (Reverse Engineered)

## Spécifications

- [`SPEC.functional.md`](SPEC.functional.md) : attentes et critères d’acceptation.
- [`SPEC.technical.md`](SPEC.technical.md) : séquence, MCP, données, statut.
- **Export secondaire** (snapshot complet) : [`fixtures/workflow.export.snapshot.json`](fixtures/workflow.export.snapshot.json)

## Fichiers

- [`workflow.json`](workflow.json) : artefact **canonique** (ex-import) pour l’import n8n et l’API.
- `fixtures/` : extraits et snapshots secondaires (export MCP, réponses de debug) — ne pas confondre avec le json canonique.

## Source of truth (historique)

- Récupéré via MCP n8n : `get_workflow_details` (workflowId: `aze2wAktXHYrTBTr`).

## Comportement d’exécution (rappel)

- Déclenchement manuel ou planification quotidienne (ex. 02:00).
- Requiert `$vars.EXO_SPACE_NAME` (contrainte stricte).
- MCP eXo pour espaces, documents, catégories.
- `gpt-4o-mini` + sortie structurée pour la description et les catégories.
- Data Table `exo_processed_documents` pour l’idempotence.
