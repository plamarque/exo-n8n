# Workflow 01 - Email to Task

## Spécifications

- `[SPEC.functional.md](SPEC.functional.md)` : objectifs et règles produit.
- `[SPEC.technical.md](SPEC.technical.md)` : séquence, MCP, variables, payloads.
- Sous-workflow partagé : `[../shared/subworkflows/unwrap-mcp-json/](../shared/subworkflows/unwrap-mcp-json/)`.

## Artefacts

- `[workflow.json](workflow.json)` : export JSON final du workflow n8n `zeVd0scWqU5vcOUq`.
- `../shared/subworkflows/unwrap-mcp-json/workflow.json` : sous-workflow utilitaire `UTIL - Unwrap MCP JSON`.
- `../shared/subworkflows/unwrap-mcp-json/fixtures/workflow.import.snapshot.json` : variante import UI.
- `../shared/subworkflows/unwrap-mcp-json/fixtures/subworkflow-unwrap-mcp-json.sdk.js` : source SDK (référence).

Les anciens fichiers `workflow-01-email-to-task.live.*` etaient des artefacts de travail et ne sont plus la source de reference.

## Comportement actuel

- Declenchement manuel avec `Manual Start` et declenchement planifie avec `Intake Every 5m`.
- Lecture des emails via MCP eXo avec `list_emails`.
- Decodage des reponses MCP par le sous-workflow `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`).
- Normalisation native des emails (`Normalize Email`) puis filtrage des items sans `emailId`.
- Classification par `AI Router` avec `Routing Model` et `Routing Output Parser`.
- Creation de tache seulement si `actionRequired`, `responseExpected` et `actionConfidence >= 0.7`.
- Construction native des champs metier (`Build MCP Payload`) : assignee, libelle assignee, priorite et titre.
- Rendu HTML de la description dans le seul noeud Code residuel `Render Task Description HTML`.
- Creation de tache eXo via `create_task_in_project`, puis extraction native du `task_id`.
- Echec explicite via `Stop - Missing task_id` si la creation ne retourne pas de `task_id`.
- Assignation explicite via `assign_task` avec le payload `{ task_id, username }`.

## Configuration n8n

- `EXO_MCP_ENDPOINT` : endpoint MCP eXo utilise par les noeuds MCP Client.
- `WF01_PROJECT_ID` : projet cible optionnel. Si absent, le workflow utilise `3`, soit le projet `Festival Art2Rue` observe sur l'instance eXo MIPS.

Le payload de creation de tache est construit sous `createTaskInput` avec cette forme :

```json
{
  "project_id": 3,
  "title": "Titre de tache",
  "description": "<div>...</div>",
  "assignee": "louis",
  "priority": "HIGH"
}
```

## Import et test

1. Importer ou mettre a jour `workflows/shared/subworkflows/unwrap-mcp-json/workflow.json` pour garantir le workflow `UTIL - Unwrap MCP JSON`.
2. Importer ou mettre a jour `workflows/wf01-email-to-task/workflow.json`.
3. Verifier les credentials MCP eXo et OpenAI sur `MCP List Emails`, `MCP Create Task`, `MCP Assign Task` et `Routing Model`.
4. Executer `Manual Start`.
5. Controler `MCP Create Task`, `Unwrap MCP Create Task`, `Extract Task Assignment` et `MCP Assign Task`.

Derniere validation serveur observee : execution `1117`, creation reussie des taches `13` et `14` dans `Festival Art2Rue` (`project_id=3`).

## Limites connues

- Le workflow ne contient plus de fallback REST.
- Le workflow ne contient plus de sweep SLA ni de relance automatique.
- L'idempotence des emails traites n'est pas encore persistée.
- Le projet cible est configurable uniquement par `WF01_PROJECT_ID`, avec fallback local a `3`.

