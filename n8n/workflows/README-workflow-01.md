# Workflow 01 - Email to Task (MVP)

## Files
- `n8n/workflows/workflow-01-email-to-task.json`
- `n8n/workflows/workflow-01-email-to-task.live.export.json`
- `n8n/workflows/workflow-01-email-to-task.live.import.json` (import UI n8n, sans `id`)
- `n8n/workflows/subworkflow-unwrap-mcp-json.json`
- `n8n/workflows/subworkflow-unwrap-mcp-json.import.json` (import UI n8n)
- `n8n/workflows/subworkflow-unwrap-mcp-json.sdk.js` (source SDK pour validation/import MCP)
- `n8n/workflows/workflow-01-email-to-task.live.sdk.js` (source SDK pour validation/import MCP)
- `n8n/config/workflow-01.env.example`

## Scope implemented
- Email intake trigger (manual + every 5 min).
- MCP email polling (`list_emails`) and detail fetch (`get_email_by_id`).
- Rule-based qualification (priority, assignee, SLA due date).
- Project + status resolution (`list_projects`, `list_project_statuses`).
- Task creation MCP-first (`create_task_in_project`) with REST fallback (`POST /tasks`).
- Evidence comment on created task (`add_task_comment`).
- SLA sweep every hour with overdue reminder and escalation (`list_tasks`, `assign_task`, `add_task_comment`).

## Assumptions
- The MCP endpoint accepts a JSON payload in this shape:
  - `{ "tool": "<tool_name>", "arguments": { ... } }`
- The MCP response may be wrapped in `[{"type":"text","text":"<json-string>"}]` and is parsed in Code nodes.
- REST fallback uses bearer token auth.

## Import in n8n
1. Import `n8n/workflows/workflow-01-email-to-task.json`.
2. Define env vars from `n8n/config/workflow-01.env.example`.
3. Run with `Manual Trigger` for first validation.
4. Activate workflow after endpoint contract validation.

## Next hardening steps
1. Replace static keyword rules with configurable data source.
2. Add assignee capacity check (via `list_assigned_tasks`).
3. Add idempotency persisted in Data Store (instead of workflow static data only).
4. Add per-node MCP->REST fallback for assignment/comment/status update.

## Live SDK variant (refactor natif)
- Cible: `workflow-01-email-to-task.live.export.json`.
- Le parsing MCP est factorise dans le sous-workflow `UTIL - Unwrap MCP JSON`.
- Les garde-fous IA sont exposes en nœuds natifs (`IF` + `Switch` + `Set`).
- L'extraction post-creation (`task_id`) est faite en natif (`Execute Workflow` + `Set` + `IF` + `Stop and Error`).
- Un seul nœud Code residuel est conserve pour le rendu HTML securise de la description de tache (`Render Task Description HTML`).

## Tester le WF01 live sur n8n

### Option A — Import dans l’UI n8n
1. Menu **…** sur un dossier → **Import from File**.
2. Importer d’abord `n8n/workflows/subworkflow-unwrap-mcp-json.import.json` (nom exact **`UTIL - Unwrap MCP JSON`**).
3. Importer ensuite `n8n/workflows/workflow-01-email-to-task.live.import.json` (ou remplacer le graphe d’un workflow existant en collant `nodes` + `connections` depuis ce fichier).
4. Vérifier les credentials MCP / OpenAI sur les nœuds concernés, puis exécuter **Manual Start**.

### Option B — MCP n8n
Valider les fichiers SDK avec `validate_workflow`, puis utiliser `create_workflow_from_code` pour le sous-workflow et `update_workflow` pour `zeVd0scWqU5vcOUq`.

Workflow distant créé pour le parsing : `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`).
