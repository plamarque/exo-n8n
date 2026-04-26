# Workflow 01 - Spécification technique

> Voir `[SPEC.functional.md](SPEC.functional.md)` pour le contexte et les règles produit. Artefact n8n : `[workflow.json](workflow.json)` ; sous-workflow partagé : `[../shared/subworkflows/unwrap-mcp-json/](../shared/subworkflows/unwrap-mcp-json/)`.

## 1) Artefacts de reference

- Workflow final (repo): `workflows/wf01-email-to-task/workflow.json`.
- Workflow distant n8n: `zeVd0scWqU5vcOUq` (`WF01 - Email to Task (SDK)`).
- Sous-workflow utilitaire: `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`).
- Source locale du sous-workflow: `workflows/shared/subworkflows/unwrap-mcp-json/workflow.json`.

Les anciens artefacts `workflow-01-email-to-task.live.*` etaient des etats intermediaires et ne sont plus la source de reference.

## 2) Tools MCP utilises

### 2.1 eXo MCP

- `list_emails`
- `create_task_in_project`
- `assign_task`

### 2.2 n8n / workflow utilitaire

- `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`) est appele avec `Execute Workflow` apres `list_emails` et apres `create_task_in_project`.

## 3) Variables et configuration

- `EXO_MCP_ENDPOINT`: endpoint MCP eXo utilise par les noeuds `MCP Client`.
- `WF01_PROJECT_ID`: projet eXo cible optionnel.

Si `WF01_PROJECT_ID` n'est pas defini, le workflow utilise `3`, correspondant au projet `Festival Art2Rue` observe sur l'instance eXo MIPS.

## 4) Sequence technique actuelle

1. `Manual Start` ou `Intake Every 5m`.
2. `MCP List Emails`: appelle `list_emails` avec `{ "limit": 50, "offset": 0 }`.
3. `Unwrap MCP Emails`: convertit la reponse MCP en payload JSON exploitable.
4. `Split Out Emails`: cree un item n8n par email.
5. `Normalize Email`: extrait les champs utiles.
6. `Filter - Has Email ID`: ignore les items sans `emailId`.
7. `AI Router`: qualifie l'email avec `Routing Model` et `Routing Output Parser`.
8. `Normalize AI Output`: convertit la sortie IA vers des champs natifs.
9. `IF Clearly Actionable`: applique les garde-fous.
10. `Build MCP Payload`: calcule assignee, label, priorite et titre.
11. `Render Task Description HTML`: construit la description HTML et `createTaskInput`.
12. `MCP Create Task`: appelle `create_task_in_project`.
13. `Unwrap MCP Create Task`: decode la reponse MCP de creation.
14. `Extract Task Assignment`: extrait `task_id`, `username` et `raw_create_payload`.
15. `IF Has Task ID`: verifie que le `task_id` est strictement positif.
16. Branche true: `MCP Assign Task` appelle `assign_task`.
17. Branche false: `Stop - Missing task_id` stoppe l'execution avec un message explicite.

## 5) Sortie IA attendue

Le parser structure attend une sortie compatible avec ce schema:

```json
{
  "action_required": true,
  "response_expected": true,
  "action_confidence": 0.92,
  "assignee_username": "louis",
  "priority": "HIGH",
  "slaHours": 4,
  "task_title": "Incident VPN billetterie",
  "summary": "Interruption VPN.",
  "next_action": "Diagnostiquer.",
  "rationale": "Sujet technique."
}
```

`slaHours` est conserve dans le contrat IA pour usage futur, mais le workflow actuel ne calcule pas d'echeance et ne declenche pas de sweep SLA.

## 6) Regles de mapping

### Assignee

- Valeurs acceptees: `louis`, `claire`, `lucie`.
- Toute autre valeur retombe sur `claire`.
- Labels affiches dans la description: `Louis`, `Claire`, `Lucie`.

### Priorite

- Valeurs acceptees par la creation de tache: `LOW`, `NORMAL`, `HIGH`.
- `URGENT` est mappe vers `HIGH`, car `create_task_in_project` n'accepte pas `URGENT`.
- Toute valeur inconnue retombe sur `NORMAL`.

## 7) Payloads de reference

### 7.1 Creation de tache: `create_task_in_project`

Le workflow construit ce payload sous le champ `createTaskInput`:

```json
{
  "project_id": 3,
  "title": "Probleme d'acces a la billetterie",
  "description": "<div>...</div>",
  "assignee": "louis",
  "priority": "HIGH"
}
```

### 7.2 Assignation: `assign_task`

```json
{
  "task_id": 14,
  "username": "louis"
}
```

## 8) Validation observee

Derniere validation serveur observee:

- execution n8n: `1117`;
- statut: success;
- taches creees: `13` et `14`;
- projet: `Festival Art2Rue` (`project_id=3`);
- creation via `create_task_in_project` validee;
- extraction `task_id` via `Unwrap MCP Create Task` validee.

Un appel direct `assign_task` avec `{ "task_id": 13, "username": "louis" }` a egalement ete valide.

## 9) Points d'amelioration

1. Ajouter une idempotence persistante par `emailId`.
2. Reintroduire un sweep SLA dans un workflow dedie si le besoin demo revient.
3. Ajouter un commentaire de preuve apres creation de tache.
4. Resoudre dynamiquement le projet cible par nom si plusieurs environnements eXo sont utilises.
5. Externaliser les regles assignee/priorite dans une table de configuration.
6. Supprimer le dernier noeud Code si un rendu HTML natif devient maintenable avec les noeuds n8n disponibles.

