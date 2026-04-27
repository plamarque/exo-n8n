# Workflow 01 - Email dispatch

## REST deploy

From the repository root, after configuring root `.env` ([`.env.example`](../../.env.example)):

```bash
./deploy.sh wf01
./deploy.sh wf01 --dry-run
```

WF01 declares **[subworkflow-dependencies.json](subworkflow-dependencies.json)** so shared **Unwrap MCP JSON** is **PUT** before the parent; remote **Execute Workflow** ids are injected in memory from `.env` (`N8N_WORKFLOW_ID_UNWRAP`) or from matching node names on the parent graph. Use `./deploy.sh wf01 --no-deps` to skip the manifest.

See [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#portfolio-deploy-dependencies-manifest) for the manifest schema and flags.
