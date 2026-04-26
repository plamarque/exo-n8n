# Workflow 03 - COPIL hebdomadaire

## Fichiers

| Fichier | Rôle |
|--------|------|
| [`workflow.json`](workflow.json) | Export n8n canonique (objet `workflow` extrait de la réponse API, voir [ADR 0002](../../docs/ADR/0002-repository-layout-workflows.md)). |
| [`fixtures/api-response.snapshot.json`](fixtures/api-response.snapshot.json) | Réponse API brute (workflow + `triggerInfo`) conservée pour traçabilité. |
| [`SPEC.functional.md`](SPEC.functional.md) | Objectifs, règles et critères d’acceptation. |
| [`SPEC.technical-exo-mips.md`](SPEC.technical-exo-mips.md) | Contrat MCP eXo MIPS (notes, projets, agenda, etc.). |
| [`SPEC.technical-mcp.md`](SPEC.technical-mcp.md) | Exploration MCP eXo QAUI (phase 1). |
| [`fixtures/copil-template-note.md`](fixtures/copil-template-note.md) | Modèle de note (référence rédactionnelle). |
| [`config.env.example`](config.env.example) | Variables n8n à dupliquer si besoin. |

## Identifiants (extraits de la spec)

- Workflow n8n : `1suyxKutB174p7b4` (nom côté instance : `WF03 - Preparation COPIL hebdomadaire`).

## Etat d’avancement (audit Code vs natif)

Le refactor visant à réduire les nœuds **Code** est **à mener** (contrairement aux WF01 et WF04). Voir [`docs/ISSUES.md`](../../docs/ISSUES.md) et [audit `docs/audit-code-vs-natif.md`](../../docs/audit-code-vs-natif.md).

## Import

1. Importer `workflow.json` dans n8n (ou `validate_workflow` / `update_workflow` via le MCP n8n).
2. Configurer `EXO_MCP_ENDPOINT` et les variables `WF03_*` documentées dans le graphe / les specs techniques.
3. Vérifier les accès OAuth MCP et OpenAI sur l’instance.
