# Workflow 04 - Spécification fonctionnelle

> Détails d’implémentation n8n et MCP : [`SPEC.technical.md`](SPEC.technical.md). Artefact : [`workflow.json`](workflow.json).

## 1) Objectif

Enrichir automatiquement les documents eXo avec IA (description courte + categories suggerees), puis persister le suivi de traitement pour eviter les retraitements inutiles.

## 2) Contexte metier et storytelling

Le workflow cible la gouvernance documentaire de l'espace eXo, avec execution planifiee et traitement incrémental:
- selection de l'espace par nom (`$vars.EXO_SPACE_NAME`)
- scan des documents de l'espace
- enrichissement IA des metadonnees
- ecriture de la description et affectation de categories
- tracking de l'etat de traitement dans une table n8n

## 3) Ce qu'on cherche a demontrer

1. Orchestration n8n hybride (schedule + manuel).
2. Utilisation MCP eXo de bout en bout.
3. Enrichissement IA structure (schema JSON).
4. Deduplication/incremental processing via Data Table.
5. Pipeline robuste avec checks explicites d'erreurs sur retours MCP.

## 4) Limites actuelles observees (produit / contrat)

1. Pas de fallback si `EXO_SPACE_NAME` absent ou incorrect (erreur bloquante volontaire).
2. Endpoint MCP potentiellement duplique dans plusieurs noeuds (voir technique).
3. Limite fixe a 5 documents par run.
4. Pas de rollback si description OK mais categories KO.

## 5) Criteres d'acceptation

- Echec immediat si `spaceName` manquant.
- Un document non traite est enrichi puis tracke.
- Un document deja traite et non modifie n'est pas retraite.
- Les categories appliquees correspondent a des `category_id` resolus.
