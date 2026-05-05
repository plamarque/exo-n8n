# Local scratch env (not committed)

The **primary** output of [`.cursor/skills/exo-fixture-bootstrap/SKILL.md`](../.cursor/skills/exo-fixture-bootstrap/SKILL.md) is a **merge into the repository root `.env`** (with user confirmation on conflicts).

**Optional:** agents may write **`generated-wf0x.env`** here (for example `generated-wf03.env`) as a scratch copy for the last run.

- **Git:** ignored via `local/*` with **`README.md` kept** (see repository [`.gitignore`](../.gitignore)); `*.env` is also ignored globally.
- **n8n:** root `.env` drives MCP URLs and portfolio **`||` literals** on **`deploy.sh`** (in memory before PUT) and optionally **`npm run generate:workflow-json`** (rewrite JSON on disk).
- **Do not** commit tenant ids or secrets into canonical [`workflow.json`](../workflows/wf03-weekly-steering/workflow.json) or tracked `config.env.example` beyond placeholders.
