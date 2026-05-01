#!/usr/bin/env node
/**
 * Push canonical workflow.json to n8n via REST API (PUT /api/v1/workflows/:id).
 * Loads `.env` from the repository root (see root `.env.example`).
 *
 * When `subworkflow-dependencies.json` exists next to the portfolio `workflow.json`,
 * deploys those sub-workflows first (same credential merge as the parent), injects
 * remote `workflowId` values from `.env` into parent **Execute Workflow** nodes in memory,
 * then PUTs the parent. Use `--no-deps` to skip. Use `--create-missing-deps` to POST
 * create any dependency missing a remote id (prints `.env` lines to add).
 *
 * Usage:
 *   node tools/push-workflow-to-n8n-api.mjs wf01
 *   node tools/push-workflow-to-n8n-api.mjs wf03 --dry-run
 *   node tools/push-workflow-to-n8n-api.mjs wf03 --no-deps
 *   node tools/push-workflow-to-n8n-api.mjs wf03 --create-missing-deps
 */
import fs from "node:fs";
import path from "node:path";
import { loadRepoDotenv } from "./load-repo-dotenv.mjs";
import {
  remoteIdEnvKey,
  resolvePortfolioJsonPath,
  resolveRemoteWorkflowId,
  runLocalValidation,
} from "./lib/n8n-workflow-portfolio.mjs";
import {
  applyCredentialMergeAndFallbacks,
  applyExoMcpEndpointDeployOverride,
  buildWorkflowPostPayload,
  buildWorkflowPutPayload,
  fetchMergeAndPutWorkflow,
  getRemoteWorkflow,
  injectExecuteWorkflowRemoteIds,
  loadSubworkflowDependencyManifest,
  postCreateWorkflow,
  postWorkflowLifecycle,
  resolveDependencyJsonPath,
  resolveRemoteIdForDependency,
} from "./lib/n8n-workflow-deploy-core.mjs";

function usage() {
  console.log(`Usage:
  node tools/push-workflow-to-n8n-api.mjs <wf01|wf02|wf03|wf04|unwrap> [options]

Options:
  --dry-run              No PUT/POST; still GETs remotes for merge logs (see docs/DEVELOPMENT.md)
  --skip-validate        Skip local validateWorkflow (use with care)
  --no-deps              Do not deploy subworkflow-dependencies.json even if present
  --create-missing-deps  POST-create dependencies missing remote id; print .env lines

When subworkflow-dependencies.json exists next to the portfolio workflow, dependencies
are deployed first by default (then parent). unwrap ignores portfolio manifests.

Environment (from process env or repo root .env):
  N8N_BASE_URL       n8n instance base URL (no trailing slash)
  N8N_API_KEY        API key (header X-N8N-API-KEY)
  EXO_MCP_ENDPOINT   optional; tenant MCP URL — injects MCP Client endpointUrl fallback before PUT (same name as n8n $vars.EXO_MCP_ENDPOINT)
  N8N_WORKFLOW_ID_WF01 … N8N_WORKFLOW_ID_WF04, N8N_WORKFLOW_ID_UNWRAP (optional if workflow.json has top-level "id")
  Plus any N8N_WORKFLOW_ID_* keys listed in subworkflow-dependencies.json (e.g. N8N_WORKFLOW_ID_WF03_BUILD_REPORT)
  N8N_MCP_CREDENTIAL_ID              optional; when set, forces mcpOAuth2Api on all MCP Client (OAuth2) nodes
  N8N_MCP_CREDENTIAL_NAME            with ID: optional {name} in workflow JSON; without ID: exact n8n credential display name for lookup (forces apply when unique match)
  N8N_OPENAI_CREDENTIAL_ID       optional override for lmChatOpenAi nodes still missing credentials after merge
  N8N_OPENAI_CREDENTIAL_NAME     optional display name for that override
  N8N_OPENAI_REFERENCE_WORKFLOW_ID  optional: copy openAiApi ref from first lmChatOpenAi on that workflow id
`);
}

/**
 * @param {string} repoRoot
 * @param {string} portfolioId
 * @param {string} workflowDir
 * @param {string} base
 * @param {string} key
 * @param {boolean} dryRun
 * @param {boolean} skipValidate
 * @param {boolean} createMissingDeps
 * @param {Record<string, unknown>} parentLocal parsed portfolio `workflow.json` (for resolving dep ids from parent Execute Workflow nodes when env is unset)
 * @returns {Promise<Map<string, string>>}
 */
async function deployDeclaredSubworkflows(
  repoRoot,
  portfolioId,
  workflowDir,
  base,
  key,
  dryRun,
  skipValidate,
  createMissingDeps,
  parentLocal,
) {
  if (portfolioId === "unwrap") {
    return new Map();
  }
  const deps = loadSubworkflowDependencyManifest(workflowDir);
  if (!deps || deps.length === 0) {
    return new Map();
  }

  /** @type {Map<string, string>} */
  const injectionMap = new Map();

  for (const dep of deps) {
    const abs = resolveDependencyJsonPath(workflowDir, dep.path);
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing dependency JSON: ${abs} (from ${workflowDir})`);
    }
    const rel = path.relative(repoRoot, abs);
    if (!skipValidate && !runLocalValidation(repoRoot, rel)) {
      process.exit(1);
    }
    const localDep = /** @type {Record<string, unknown>} */ (
      JSON.parse(fs.readFileSync(abs, "utf8"))
    );
    let remoteId = resolveRemoteIdForDependency(dep.remoteIdEnv, localDep, {
      parent: parentLocal,
      nodeNames: dep.parentExecuteWorkflowNodeNames,
    }).trim();
    if (!remoteId && createMissingDeps && dryRun) {
      throw new Error(
        `Dependency ${dep.path}: no remote id resolved; --create-missing-deps with --dry-run cannot POST-create. Set ${dep.remoteIdEnv}, add a top-level "id" on the dependency JSON, or ensure parent Execute Workflow nodes expose workflowId, then re-run dry-run.`,
      );
    }
    if (!remoteId && createMissingDeps) {
      applyExoMcpEndpointDeployOverride(/** @type {unknown[] | undefined} */ (localDep.nodes));
      const created = await postCreateWorkflow(base, key, buildWorkflowPostPayload(localDep));
      remoteId = created.id;
      console.log(`Created sub-workflow on n8n: ${created.name} (${remoteId}). Add to repository root .env:`);
      console.log(`${dep.remoteIdEnv}=${remoteId}`);
      process.env[dep.remoteIdEnv] = remoteId;
    }
    if (!remoteId) {
      throw new Error(
        `Dependency ${dep.path}: set ${dep.remoteIdEnv} in .env, add a top-level "id" to that dependency JSON, ensure the parent portfolio Execute Workflow node(s) in parentExecuteWorkflowNodeNames expose parameters.workflowId, or re-run with --create-missing-deps`,
      );
    }

    const label = path.relative(repoRoot, abs);
    console.log(`Deploy dependency: ${label} → n8n id ${remoteId}`);
    const localClone = /** @type {Record<string, unknown>} */ (
      JSON.parse(JSON.stringify(localDep))
    );
    await fetchMergeAndPutWorkflow({
      base,
      apiKey: key,
      remoteId,
      local: localClone,
      dryRun,
      label,
    });

    for (const nodeName of dep.parentExecuteWorkflowNodeNames) {
      injectionMap.set(nodeName, remoteId);
    }
  }

  return injectionMap;
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
const createMissingDeps = flagArgs.includes("--create-missing-deps");
const unknown = flagArgs.filter((a) => !KNOWN_FLAGS.has(a));
if (unknown.length > 0) {
  console.error("Unexpected arguments:", unknown.join(" "));
  usage();
  process.exit(1);
}

let jsonPath;
try {
  jsonPath = resolvePortfolioJsonPath(repoRoot, portfolioId);
} catch (e) {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
}

const workflowDir = path.dirname(jsonPath);
const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error("Set N8N_BASE_URL and N8N_API_KEY (repo root .env or environment).");
  process.exit(1);
}

if (!skipValidate) {
  if (!runLocalValidation(repoRoot, path.relative(repoRoot, jsonPath))) {
    process.exit(1);
  }
}

const envKey = remoteIdEnvKey(portfolioId);

async function main() {
  const rawParent = fs.readFileSync(jsonPath, "utf8");
  const local = /** @type {Record<string, unknown>} */ (JSON.parse(rawParent));

  /** @type {Map<string, string>} */
  let injectionMap = new Map();
  const manifestPresent =
    portfolioId !== "unwrap" &&
    fs.existsSync(path.join(workflowDir, "subworkflow-dependencies.json"));
  const runDeps = manifestPresent && !noDeps;

  if (runDeps) {
    console.log(
      `Portfolio ${portfolioId}: deploying subworkflow-dependencies.json before parent (use --no-deps to skip).`,
    );
    injectionMap = await deployDeclaredSubworkflows(
      repoRoot,
      portfolioId,
      workflowDir,
      base,
      key,
      dryRun,
      skipValidate,
      createMissingDeps,
      local,
    );
  } else if (manifestPresent && noDeps) {
    console.log("Skipping subworkflow dependencies (--no-deps).");
  }

  if (injectionMap.size > 0) {
    const injected = injectExecuteWorkflowRemoteIds(
      /** @type {unknown[] | undefined} */ (local.nodes),
      injectionMap,
    );
    console.log(`Injected ${injected} Execute Workflow workflowId(s) from environment before parent PUT.`);
  }

  const remoteId = resolveRemoteWorkflowId(
    portfolioId,
    envKey,
    local,
    path.relative(repoRoot, jsonPath),
  );

  const url = `${base}/api/v1/workflows/${remoteId}`;
  if (dryRun) {
    console.log("Dry run — would PUT parent", url);
    console.log("Portfolio:", portfolioId, "JSON:", path.relative(repoRoot, jsonPath));
    console.log("Remote id:", remoteId);
    return;
  }

  let remote;
  let wasActive = false;
  try {
    remote = await getRemoteWorkflow(base, key, remoteId);
    wasActive = remote.active === true;
  } catch (e) {
    throw new Error(/** @type {Error} */ (e).message);
  }

  await applyCredentialMergeAndFallbacks(local, remote, base, key);
  applyExoMcpEndpointDeployOverride(/** @type {unknown[] | undefined} */ (local.nodes));
  const payload = buildWorkflowPutPayload(local);

  if (wasActive) {
    const de = await postWorkflowLifecycle(base, key, remoteId, "deactivate");
    if (!de.ok) {
      throw new Error(`Failed to deactivate workflow before PUT: ${de.status} ${await de.text()}`);
    }
    console.log("Deactivated workflow before PUT (was active).");
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
  const saved = await res.json();
  console.log("Workflow updated", saved.id, saved.name, saved.updatedAt);

  if (wasActive) {
    const act = await postWorkflowLifecycle(base, key, remoteId, "activate");
    if (!act.ok) {
      const body = await act.text();
      console.warn("Workflow updated but re-activate failed:", act.status, body);
      console.warn(
        "The workflow was left inactive in n8n. Fix the reported configuration issues, then activate in the UI or re-run deploy.",
      );
    } else {
      console.log("Re-activated workflow after successful PUT.");
    }
  }
}

main().catch((e) => {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
});
