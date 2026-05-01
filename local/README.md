# Local scratch env (not committed)

The **primary** output of [`.cursor/skills/exo-fixture-bootstrap/SKILL.md`](../.cursor/skills/exo-fixture-bootstrap/SKILL.md) is a **merge into the repository root `.env`** (with user confirmation on conflicts).

**Optional:** agents may write **`generated-wf0x.env`** here (for example `generated-wf03.env`) as a scratch copy for the last run.

- **Git:** ignored via `local/*` with **`README.md` kept** (see repository [`.gitignore`](../.gitignore)); `*.env` is also ignored globally.
- **n8n:** root `.env` supplies **`EXO_MCP_ENDPOINT`** for REST deploy injection; **`WF*_*` keys** still need matching **n8n Variables** for workflow runtime unless you copy them manually.
- **Do not** commit tenant ids or secrets into canonical [`workflow.json`](../workflows/wf03-weekly-steering/workflow.json) or tracked `config.env.example` beyond placeholders.
