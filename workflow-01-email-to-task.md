# Workflow 01 - Email entrant vers tache eXo auto-assignee

## 1) Objectif
Automatiser le tri des emails entrants du festival Art2Rue et creer des taches eXo uniquement pour les emails clairement actionnables.

Le workflow final privilegie les noeuds natifs n8n pour la normalisation, les garde-fous et l'extraction des donnees. Un seul noeud Code reste utilise pour le rendu HTML controle de la description de tache.

## 2) Contexte metier et storytelling
La ville de Chevigny prepare le festival Art2Rue. L'equipe projet centralise les echanges dans eXo, mais une partie des demandes arrive encore par email.

Exemples de demandes utiles pour la demo:
- panne VPN du prestataire billetterie;
- demande d'acces GED pour des partenaires;
- question urgente sur un document manquant;
- message informatif qui ne doit pas creer de tache.

Le but est de montrer qu'un flux n8n + MCP eXo peut transformer les emails actionnables en taches assignees, tout en ignorant les emails ambigus ou purement informatifs.

## 3) Artefacts de reference
- Workflow final exporte: `n8n/workflows/workflow-01-email-to-task.json`.
- Workflow distant n8n: `zeVd0scWqU5vcOUq` (`WF01 - Email to Task (SDK)`).
- Sous-workflow utilitaire: `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`).
- Source locale du sous-workflow: `n8n/workflows/subworkflow-unwrap-mcp-json.json`.

Les anciens artefacts `workflow-01-email-to-task.live.*` etaient des etats intermediaires et ne sont plus la source de reference.

## 4) Fonctionnel couvert
1. Lecture des emails via `list_emails`.
2. Decodage des enveloppes MCP via le sous-workflow `UTIL - Unwrap MCP JSON`.
3. Normalisation des champs email: `emailId`, `subject`, `body`, `sender`, `receivedAt`.
4. Filtrage des emails sans identifiant.
5. Analyse IA structuree de chaque email.
6. Creation de tache seulement si les trois conditions sont vraies:
   - `actionRequired=true`;
   - `responseExpected=true`;
   - `actionConfidence >= 0.7`.
7. Resolution native de l'assignee et de la priorite a partir de la sortie IA.
8. Creation d'une tache eXo dans le projet cible.
9. Extraction native du `task_id` depuis la reponse MCP.
10. Echec explicite si la creation ne retourne pas de `task_id`.
11. Assignation explicite de la tache avec `assign_task`.

## 5) Hors scope actuel
- Pas de fallback REST.
- Pas de resolution dynamique projet/statut par `list_projects` ou `list_project_statuses`.
- Pas de sweep SLA, relance automatique ou escalade manager.
- Pas d'ajout automatique de commentaire de preuve.
- Pas d'idempotence persistante pour eviter les doublons lors de reruns.
- Pas d'appel `get_email_by_id`: `list_emails` fournit les champs necessaires au workflow actuel.

Ces capacites restent des ameliorations possibles, mais elles ne font pas partie du workflow final actuel.

## 6) Tools MCP utilises
### 6.1 eXo MCP
- `list_emails`
- `create_task_in_project`
- `assign_task`

### 6.2 n8n MCP / workflow utilitaire
- `UTIL - Unwrap MCP JSON` (`E4OAThogWRG93MUG`) est appele avec `Execute Workflow` apres `list_emails` et apres `create_task_in_project`.

## 7) Variables et configuration
- `EXO_MCP_ENDPOINT`: endpoint MCP eXo utilise par les noeuds `MCP Client`.
- `WF01_PROJECT_ID`: projet eXo cible optionnel.

Si `WF01_PROJECT_ID` n'est pas defini, le workflow utilise `3`, correspondant au projet `Festival Art2Rue` observe sur l'instance eXo MIPS.

## 8) Sequence technique actuelle
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

## 9) Sortie IA attendue
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

## 10) Regles de mapping
### Assignee
- Valeurs acceptees: `louis`, `claire`, `lucie`.
- Toute autre valeur retombe sur `claire`.
- Labels affiches dans la description: `Louis`, `Claire`, `Lucie`.

### Priorite
- Valeurs acceptees par la creation de tache: `LOW`, `NORMAL`, `HIGH`.
- `URGENT` est mappe vers `HIGH`, car `create_task_in_project` n'accepte pas `URGENT`.
- Toute valeur inconnue retombe sur `NORMAL`.

## 11) Payloads de reference
### 11.1 Creation de tache: `create_task_in_project`
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

### 11.2 Assignation: `assign_task`
```json
{
  "task_id": 14,
  "username": "louis"
}
```

## 12) Criteres d'acceptation
- Les emails clairement actionnables creent une tache eXo.
- Les emails non actionnables ou ambigus ne creent pas de tache.
- Les taches creees ont un titre, une description HTML, une priorite et un assignee.
- `create_task_in_project` recoit un `project_id` valide (`WF01_PROJECT_ID` ou `3` par defaut).
- Une reponse de creation sans `task_id` stoppe explicitement le workflow.
- `assign_task` utilise le champ MCP attendu `username`.

## 13) Validation observee
Derniere validation serveur observee:
- execution n8n: `1117`;
- statut: success;
- taches creees: `13` et `14`;
- projet: `Festival Art2Rue` (`project_id=3`);
- creation via `create_task_in_project` validee;
- extraction `task_id` via `Unwrap MCP Create Task` validee.

Un appel direct `assign_task` avec `{ "task_id": 13, "username": "louis" }` a egalement ete valide.

## 14) Points d'amelioration
1. Ajouter une idempotence persistante par `emailId`.
2. Reintroduire un sweep SLA dans un workflow dedie si le besoin demo revient.
3. Ajouter un commentaire de preuve apres creation de tache.
4. Resoudre dynamiquement le projet cible par nom si plusieurs environnements eXo sont utilises.
5. Externaliser les regles assignee/priorite dans une table de configuration.
6. Supprimer le dernier noeud Code si un rendu HTML natif devient maintenable avec les noeuds n8n disponibles.
