# UTIL - Unwrap MCP JSON (sous-workflow)

Décode les réponses MCP eXo (souvent enveloppées) en JSON exploitable par les nœuds n8n en aval.

## Fichiers

- `[workflow.json](workflow.json)` : export canonique à importer dans n8n.
- `[fixtures/workflow.import.snapshot.json](fixtures/workflow.import.snapshot.json)` : variante d’import UI.
- `[fixtures/subworkflow-unwrap-mcp-json.sdk.js](fixtures/subworkflow-unwrap-mcp-json.sdk.js)` : référence SDK (non source d’exécution seule).

## Consommateurs

Utilisé notamment par [WF01 - Email to task](../../wf01-email-to-task/README.md) (`Execute Workflow`).

## ID distant (référence)

- `E4OAThogWRG93MUG` (nom côté n8n : `UTIL - Unwrap MCP JSON` — vérifier sur l’instance active).