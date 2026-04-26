# Workflow 01 - Spécification fonctionnelle

> Voir `[SPEC.technical.md](SPEC.technical.md)` pour l’artefact JSON, la séquence n8n et les payloads MCP. Synthèse portefeuille : `[../../docs/SPEC.md](../../docs/SPEC.md)`.

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

## 3) Fonctionnel couvert

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

## 4) Hors scope actuel

- Pas de fallback REST.
- Pas de resolution dynamique projet/statut par `list_projects` ou `list_project_statuses`.
- Pas de sweep SLA, relance automatique ou escalade manager.
- Pas d'ajout automatique de commentaire de preuve.
- Pas d'idempotence persistante pour eviter les doublons lors de reruns.
- Pas d'appel `get_email_by_id`: `list_emails` fournit les champs necessaires au workflow actuel.

Ces capacites restent des ameliorations possibles, mais elles ne font pas partie du workflow final actuel.

## 5) Criteres d'acceptation

- Les emails clairement actionnables creent une tache eXo.
- Les emails non actionnables ou ambigus ne creent pas de tache.
- Les taches creees ont un titre, une description HTML, une priorite et un assignee.
- `create_task_in_project` recoit un `project_id` valide (`WF01_PROJECT_ID` ou `3` par defaut).
- Une reponse de creation sans `task_id` stoppe explicitement le workflow.
- `assign_task` utilise le champ MCP attendu `username`.