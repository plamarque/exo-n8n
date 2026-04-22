# Workflow 02 - Validation documentaire (Split/Join)

## Files
- `n8n/workflows/workflow-02-validation-documentaire.json`
- `n8n/config/workflow-02.env.example`
- `workflow-02-validation-documentaire.md`

## Scope implemented
- Intake des documents dans le dossier eXo ciblé (`00_Programmation`).
- Création automatique d'une tâche Exo par document.
- Assignation des acteurs (`nadia`, `etienne`) et auteur (fallback `claire`).
- Commentaire initial + génération des liens d'approbation.
- Branche d'approbation via webhook (`split/join`) avec deux validations parallèles.
- Passage automatique en `Done` uniquement si double approbation.
- Commentaires automatiques de suivi (décision individuelle + décision finale).

## Runtime variables (n8n Variables)
- `EXO_MCP_ENDPOINT`
- `WF02_PARENT_FOLDER_ID` (default: `b468cb5639805e11480baa56164da90c`)
- `WF02_PROJECT_ID` (default: `117`)
- `WF02_INPROGRESS_STATUS_ID` (default: `475`)
- `WF02_DONE_STATUS_ID` (default: `477`)
- `WF02_APPROVAL_BASE_URL` (URL webhook publique de ce workflow)

## Webhook
- Production: `/webhook/wf02-doc-validation/approve`
- Method: `POST`
- Expected payload: `task_id`, `cycle_id`, `role`, `decision`, `reason` (optionnel)

## Validation status
- SDK validation: OK (`validate_workflow`)
- Workflow created in n8n cloud: `GA62lATVYnfzvCdk`
- Test execution #1 (`executionId=73`): failed due to MCP authentication in n8n credential (`Could not connect to your MCP server. Authentication failed.`)
- Test execution #2 (`executionId=76`): MCP connectivity OK, then failed in Code node (`getWorkflowStaticData is not defined`), corrected in repo with `$getWorkflowStaticData`.

## Next step before activation
- Re-import/update the workflow from repo JSON, then rerun manual execution.
