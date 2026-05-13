#!/usr/bin/env node
/**
 * Push canonical workflow.json to n8n via REST API.
 *
 * Bootstrap-friendly resolution of the remote workflow id:
 * - If `N8N_WORKFLOW_ID_<SHORTID>` is set in `.env`, deploy issues `PUT /api/v1/workflows/:id`.
 * - If unset, deploy `POST /api/v1/workflows` to create the workflow on n8n, then writes the
 *   returned id back to the repository root `.env` (commenting any prior value with a timestamp,
 *   or appending under a `# --- deploy auto-bootstrap ---` section). The next run becomes a PUT.
 *
 * The same logic applies to dependencies declared in `subworkflow-dependencies.json`. Use
 * `--dry-run` to preview without any POST/PUT or `.env` mutation. The legacy
 * `--create-missing-deps` flag is accepted as a no-op alias (auto-create is now the default).
 *
 * `EXO_MCP_ENDPOINT` (MCP Client URLs) and portfolio fallback literals are applied in memory
 * before each POST/PUT (`applyPortfolioEnvOverridesBeforePush`); use
 * `npm run generate:workflow-json` to persist them into `workflow.json` on disk instead.
 *
 * Usage:
 *   node tools/push-workflow-to-n8n-api.mjs wf01
 *   node tools/push-workflow-to-n8n-api.mjs wf03 --dry-run
 *   node tools/push-workflow-to-n8n-api.mjs all
 *   node tools/push-workflow-to-n8n-api.mjs wf03 --no-deps
 */
import { loadRepoDotenv } from "./load-repo-dotenv.mjs";
import { listWorkflowIds } from "./lib/n8n-workflow-portfolio.mjs";
import { deployOneWorkflow } from "./lib/n8n-workflow-deploy-orchestrator.mjs";

function usage() {
  console.log(`Usage:
  node tools/push-workflow-to-n8n-api.mjs <shortId|all> [options]

  shortId: first segment of workflows/<name>/ folder before "-" (or full folder name if no hyphen).
  Examples: wf01 (from wf01-email-dispatch), unwrap (from unwrap-mcp-json).

Options:
  --dry-run              No POST/PUT and no .env writes; prints what would happen
  --skip-validate        Skip local validateWorkflow (use with care)
  --no-deps              Do not deploy subworkflow-dependencies.json even if present
  --create-missing-deps  Deprecated alias: auto-create on missing remote id is now the default

When subworkflow-dependencies.json exists next to the workflow, dependencies are deployed first
by default (then parent).

Bootstrap behavior (per workflow, including dependencies):
  - When the remote id env key is unset, deploy POST-creates the workflow on n8n and writes the
    returned id into repository root .env (existing values are commented with a timestamp).
  - When the remote id env key is set, deploy issues a regular PUT update.
  - --dry-run never POST-creates and never writes .env.

Environment (from process env or repo root .env):
  N8N_BASE_URL       n8n instance base URL (no trailing slash)
  N8N_API_KEY        API key (header X-N8N-API-KEY)
  EXO_MCP_ENDPOINT, WF01_PROJECT_ID, WF02_* … EXO_SPACE_NAME  optional; applied in memory before each POST/PUT (MCP URLs + $vars fallback literals). Run npm run generate:workflow-json to persist them into workflow.json on disk (see docs/DEVELOPMENT.md)
  N8N_WORKFLOW_ID_<SHORTID> for each root workflow (e.g. N8N_WORKFLOW_ID_WF01, N8N_WORKFLOW_ID_UNWRAP); leave unset to bootstrap
  Plus any N8N_WORKFLOW_ID_* keys listed in subworkflow-dependencies.json (when a workflow declares dependencies)
  N8N_MCP_CREDENTIAL_ID              optional; when set, forces mcpOAuth2Api on all MCP Client (OAuth2) nodes
  N8N_MCP_CREDENTIAL_NAME            with ID: optional {name} in workflow JSON; without ID: exact n8n credential display name for lookup (forces apply when unique match)
  N8N_OPENAI_CREDENTIAL_ID           optional override for lmChatOpenAi nodes still missing credentials after merge
  N8N_OPENAI_CREDENTIAL_NAME         optional display name for that override
  N8N_OPENAI_REFERENCE_WORKFLOW_ID   optional: copy openAiApi ref from first lmChatOpenAi on that workflow id
`);
}

const repoRoot = loadRepoDotenv();

const argv = process.argv.slice(2);
if (
  argv.length === 0 ||
  argv[0] === "-h" ||
  argv[0] === "--help"
) {
  usage();
  process.exit(argv.length === 0 ? 1 : 0);
}

const KNOWN_FLAGS = new Set([
  "--dry-run",
  "--skip-validate",
  "--no-deps",
  "--create-missing-deps",
]);

const portfolioId = argv[0];
const flagArgs = argv.slice(1);
const dryRun = flagArgs.includes("--dry-run");
const skipValidate = flagArgs.includes("--skip-validate");
const noDeps = flagArgs.includes("--no-deps");
if (flagArgs.includes("--create-missing-deps")) {
  console.warn(
    "Note: --create-missing-deps is now a no-op alias; auto-create on missing remote id is the default behaviour.",
  );
}
const unknown = flagArgs.filter((a) => !KNOWN_FLAGS.has(a));
if (unknown.length > 0) {
  console.error("Unexpected arguments:", unknown.join(" "));
  usage();
  process.exit(1);
}

const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error("Set N8N_BASE_URL and N8N_API_KEY (repo root .env or environment).");
  process.exit(1);
}

const deployOpts = { base, key, dryRun, skipValidate, noDeps };

async function main() {
  if (portfolioId === "all") {
    let ids;
    try {
      ids = listWorkflowIds(repoRoot);
    } catch (e) {
      console.error(/** @type {Error} */ (e).message);
      process.exit(1);
    }
    if (ids.length === 0) {
      console.error("No root workflows found under workflows/*/workflow.json");
      process.exit(1);
    }
    console.log(`Deploy all: ${ids.join(", ")}`);
    for (const id of ids) {
      console.log(`\n--- ${id} ---\n`);
      await deployOneWorkflow(repoRoot, id, deployOpts);
    }
    return;
  }

  await deployOneWorkflow(repoRoot, portfolioId, deployOpts);
}

main().catch((e) => {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
});
