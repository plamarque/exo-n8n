# Issues And Deferred Work

This document is tracking-only. It does not define expected behavior.

## Known Limitations

### WF01

- Persistent email idempotence is missing. Recommended key: `email_id`, with fallback to `messageId` and `receivedDate` (previously noted in a removed `n8n/TODO.md`).
- No REST fallback exists in the latest documented workflow.
- No SLA sweep, relance, or escalation workflow is currently part of the final WF01 behavior.

### WF02

- Latest README status says a re-import/update and manual rerun are needed after correcting `getWorkflowStaticData` to `$getWorkflowStaticData`.
- The workflow uses static/demo actor mappings (`nadia`, `etienne`, fallback `claire`).
- [UNCERTAIN] The persistence mechanism for approval state should be reviewed before production use; the audit recommends Data Table-based state for better visibility.

### WF03

- **WF03**: refactor Code → native nodes (HTML composition, config dates, report body) is still to do. Progress vs native patterns is described in [audit-code-vs-natif.md](audit-code-vs-natif.md). Operational entry point: [workflows/wf03-copil-hebdomadaire/README.md](../workflows/wf03-copil-hebdomadaire/README.md).
- [UNCERTAIN] Activation status and latest successful execution evidence are not documented in the same style as WF01.

### WF04

- `EXO_SPACE_NAME` is mandatory and missing values stop the workflow.
- The MCP endpoint is documented as hardcoded in multiple nodes in the reverse-engineered workflow.
- Processing is capped at five documents per run.
- There is no rollback if description update succeeds but category assignment fails.
- One Code node remains for category assignment mapping after the native-node refactor.

## Cross-Cutting Issues

- MCP response formats are heterogeneous and often require envelope parsing before business logic.
- Some `.env.example` files contain older-looking settings that may not match the latest workflow specs.
- Historical dual exports (import vs full export) are addressed for WF04 by [ADR 0002](ADR/0002-repository-layout-workflows.md); other workflows should keep a single `workflow.json` unless a `fixtures/*` snapshot is explicitly documented.
- Secrets and live API keys must not be committed; example config should remain placeholder-only.

