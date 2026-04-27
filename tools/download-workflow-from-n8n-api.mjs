#!/usr/bin/env node
/**
 * Download workflow JSON from n8n (GET /api/v1/workflows/:id) and overwrite the canonical
 * local workflow.json. Use to pull editor-only changes (e.g. sticky notes) from the server.
 * Loads `.env` from the repository root (see root `.env.example`).
 *
 * When `subworkflow-dependencies.json` exists, fetches dependencies from the server first
 * (same remote id resolution as deploy), then the parent. Use `--no-deps` to only update
 * the requested portfolio workflow.
 *
 * Usage:
 *   node tools/download-workflow-from-n8n-api.mjs wf01
 *   node tools/download-workflow-from-n8n-api.mjs wf03 --dry-run
 *   node tools/download-workflow-from-n8n-api.mjs wf02 --no-deps
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
  getRemoteWorkflow,
  loadSubworkflowDependencyManifest,
  resolveDependencyJsonPath,
  resolveRemoteIdForDependency,
} from "./lib/n8n-workflow-deploy-core.mjs";

function usage() {
  console.log(`Usage:
  node tools/download-workflow-from-n8n-api.mjs <wf01|wf02|wf03|wf04|unwrap> [options]

Options:
  --dry-run         No file write; still GETs from n8n and prints summary
  --skip-validate   Skip local validateWorkflow after write (use with care)
  --no-deps         Do not download subworkflow-dependencies.json entries (if present)

When subworkflow-dependencies.json exists next to the portfolio workflow, dependencies
are downloaded first by default (then parent). unwrap ignores portfolio manifests.

Environment (from process env or repo root .env):
  N8N_BASE_URL, N8N_API_KEY
  N8N_WORKFLOW_ID_WF01 … N8N_WORKFLOW_ID_WF04, N8N_WORKFLOW_ID_UNWRAP (optional if workflow.json has "id")
  Plus N8N_WORKFLOW_ID_* for each subworkflow-dependencies.json entry
`);
}

/**
 * @param {unknown[] | undefined} nodes
 */
function countStickyNodes(nodes) {
  if (!Array.isArray(nodes)) return 0;
  return nodes.filter(
    (n) =>
      n &&
      typeof n === "object" &&
      typeof /** @type {{ type?: string }} */ (n).type === "string" &&
      /** @type {{ type?: string }} */ (n).type.includes("stickyNote"),
  ).length;
}

/**
 * @param {Record<string, unknown>} remote
 */
function workflowStats(remote) {
  const nodes = /** @type {unknown[] | undefined} */ (remote.nodes);
  const n = Array.isArray(nodes) ? nodes.length : 0;
  return { nodeCount: n, stickyCount: countStickyNodes(nodes) };
}

/**
 * @param {string} repoRoot
 * @param {string} absPath
 * @param {string} remoteId
 * @param {string} base
 * @param {string} key
 * @param {object} opts
 * @param {boolean} opts.dryRun
 * @param {boolean} opts.skipValidate
 * @param {string} [opts.logLabel]
 */
async function downloadOne(
  repoRoot,
  absPath,
  remoteId,
  base,
  key,
  { dryRun, skipValidate, logLabel },
) {
  const rel = path.relative(repoRoot, absPath);
  const url = `${base}/api/v1/workflows/${remoteId}`;
  let remote;
  try {
    remote = await getRemoteWorkflow(base, key, remoteId);
  } catch (e) {
    throw new Error(/** @type {Error} */ (e).message);
  }
  const { nodeCount, stickyCount } = workflowStats(remote);
  const name = typeof remote.name === "string" ? remote.name : "";
  if (dryRun) {
    console.log(
      `Dry run — would write ${rel} from ${url} (${logLabel || "workflow"})`,
    );
    console.log(
      `  name: ${name}  remoteId: ${remoteId}  nodes: ${nodeCount}  stickyNote nodes: ${stickyCount}`,
    );
    return;
  }
  const body = JSON.stringify(remote, null, 2) + "\n";
  fs.writeFileSync(absPath, body, "utf8");
  console.log(`Wrote ${rel} (${name}, ${nodeCount} nodes, ${stickyCount} sticky note node(s))`);
  if (!skipValidate) {
    if (!runLocalValidation(repoRoot, rel)) {
      process.exit(1);
    }
  }
}

const repoRoot = loadRepoDotenv();

const argv = process.argv.slice(2);
if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  usage();
  process.exit(argv.length === 0 ? 1 : 0);
}

const KNOWN_FLAGS = new Set(["--dry-run", "--skip-validate", "--no-deps"]);

const portfolioId = argv[0];
const flagArgs = argv.slice(1);
const dryRun = flagArgs.includes("--dry-run");
const skipValidate = flagArgs.includes("--skip-validate");
const noDeps = flagArgs.includes("--no-deps");
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

const envKey = remoteIdEnvKey(portfolioId);
const rawParent = fs.readFileSync(jsonPath, "utf8");
const parentLocal = /** @type {Record<string, unknown>} */ (JSON.parse(rawParent));

const manifestPresent =
  portfolioId !== "unwrap" && fs.existsSync(path.join(workflowDir, "subworkflow-dependencies.json"));
const runDeps = manifestPresent && !noDeps;

if (runDeps) {
  console.log(
    `Portfolio ${portfolioId}: downloading subworkflow-dependencies.json entries before parent (use --no-deps to skip).`,
  );
} else if (manifestPresent && noDeps) {
  console.log("Skipping subworkflow dependencies (--no-deps).");
}

/**
 * @param {string} depAbs
 * @param {{ path: string; remoteIdEnv: string; parentExecuteWorkflowNodeNames: string[] }} dep
 */
async function downloadDependencyRow(depAbs, dep) {
  const rel = path.relative(repoRoot, depAbs);
  if (!fs.existsSync(depAbs)) {
    throw new Error(`Missing dependency JSON: ${depAbs} (from ${workflowDir})`);
  }
  const localDep = /** @type {Record<string, unknown>} */ (
    JSON.parse(fs.readFileSync(depAbs, "utf8"))
  );
  const remoteId = resolveRemoteIdForDependency(dep.remoteIdEnv, localDep, {
    parent: parentLocal,
    nodeNames: dep.parentExecuteWorkflowNodeNames,
  }).trim();
  if (!remoteId) {
    throw new Error(
      `Dependency ${dep.path}: set ${dep.remoteIdEnv} in .env, add a top-level "id" to that dependency JSON, or ensure the parent Execute Workflow node(s) in parentExecuteWorkflowNodeNames expose parameters.workflowId`,
    );
  }
  await downloadOne(repoRoot, depAbs, remoteId, base, key, {
    dryRun,
    skipValidate,
    logLabel: `dep ${rel}`,
  });
}

async function main() {
  if (runDeps) {
    const deps = loadSubworkflowDependencyManifest(workflowDir);
    if (deps && deps.length > 0) {
      for (const dep of deps) {
        const depAbs = resolveDependencyJsonPath(workflowDir, dep.path);
        await downloadDependencyRow(depAbs, dep);
      }
    }
  }

  const remoteId = resolveRemoteWorkflowId(
    portfolioId,
    envKey,
    parentLocal,
    path.relative(repoRoot, jsonPath),
  );
  await downloadOne(repoRoot, jsonPath, remoteId, base, key, {
    dryRun,
    skipValidate,
    logLabel: "parent",
  });
}

main().catch((e) => {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
});
