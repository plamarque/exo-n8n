#!/usr/bin/env node
/**
 * Push canonical workflow.json to n8n via REST API (PUT /api/v1/workflows/:id).
 * Loads `.env` from the repository root (see root `.env.example`).
 *
 * Usage:
 *   node tools/push-workflow-to-n8n-api.mjs wf01
 *   node tools/push-workflow-to-n8n-api.mjs wf04 --dry-run
 *   node tools/push-workflow-to-n8n-api.mjs wf02 --skip-validate
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadRepoDotenv } from "./load-repo-dotenv.mjs";

function usage() {
  console.log(`Usage:
  node tools/push-workflow-to-n8n-api.mjs <wf01|wf02|wf03|wf04|unwrap> [--dry-run] [--skip-validate]

Environment (from process env or repo root .env):
  N8N_BASE_URL       n8n instance base URL (no trailing slash)
  N8N_API_KEY        API key (header X-N8N-API-KEY)
  N8N_WORKFLOW_ID_WF01 … N8N_WORKFLOW_ID_WF04, N8N_WORKFLOW_ID_UNWRAP

By default, runs local validateWorkflow on the JSON before PUT. Use --skip-validate only with care.
`);
}

/**
 * @param {string} repoRoot
 * @param {string} portfolioId
 */
function resolvePortfolioJsonPath(repoRoot, portfolioId) {
  const workflowsDir = path.join(repoRoot, "workflows");
  if (portfolioId === "unwrap") {
    const p = path.join(
      workflowsDir,
      "shared/subworkflows/unwrap-mcp-json/workflow.json",
    );
    if (!fs.existsSync(p)) {
      throw new Error(`Missing ${p}`);
    }
    return p;
  }
  if (!/^wf0[1-4]$/.test(portfolioId)) {
    throw new Error(
      `Unknown portfolio id: ${portfolioId} (use wf01..wf04 or unwrap)`,
    );
  }
  const dirs = fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(`${portfolioId}-`))
    .map((e) => e.name);
  if (dirs.length === 0) {
    throw new Error(`No directory matching workflows/${portfolioId}-*/`);
  }
  if (dirs.length > 1) {
    throw new Error(
      `Ambiguous: multiple workflows/${portfolioId}-*/ — ${dirs.join(", ")}`,
    );
  }
  return path.join(workflowsDir, dirs[0], "workflow.json");
}

/** @param {string} portfolioId */
function remoteIdEnvKey(portfolioId) {
  if (portfolioId === "unwrap") return "N8N_WORKFLOW_ID_UNWRAP";
  return `N8N_WORKFLOW_ID_${portfolioId.toUpperCase()}`;
}

/** Keys accepted by n8n Cloud `PUT /api/v1/workflows/:id` for `settings` (export adds extras like `availableInMCP`, `binaryMode`). */
const SETTINGS_PUT_ALLOW = new Set([
  "executionOrder",
  "timezone",
  "errorWorkflow",
  "callerPolicy",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "saveManualExecutions",
  "saveExecutionProgress",
  "executionTimeout",
]);

/**
 * @param {Record<string, unknown> | undefined} settings
 * @returns {Record<string, unknown>}
 */
function sanitizeSettingsForPut(settings) {
  if (!settings || typeof settings !== "object") return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of Object.keys(settings)) {
    if (SETTINGS_PUT_ALLOW.has(k)) out[k] = settings[k];
  }
  return out;
}

/**
 * n8n `PUT /api/v1/workflows/:id` validates a strict schema; full editor exports
 * include read-only or unsupported top-level keys (`description`, `versionId`, …)
 * and return 400 "must NOT have additional properties". `id` belongs in the URL only.
 * @param {Record<string, unknown>} local parsed workflow.json
 * @returns {Record<string, unknown>}
 */
function buildWorkflowPutPayload(local) {
  /** @type {Record<string, unknown>} */
  const out = {
    name: local.name,
    nodes: local.nodes,
    connections: local.connections ?? {},
    settings: sanitizeSettingsForPut(
      /** @type {Record<string, unknown> | undefined} */ (local.settings),
    ),
  };
  if (local.staticData !== undefined && local.staticData !== null) {
    out.staticData = local.staticData;
  }
  if (local.pinData !== undefined && local.pinData !== null) {
    out.pinData = local.pinData;
  }
  return out;
}

/**
 * @param {string} repoRoot
 * @param {string} jsonPath absolute or relative to repo
 * @returns {boolean}
 */
function runLocalValidation(repoRoot, jsonPath) {
  const rel = path.isAbsolute(jsonPath)
    ? path.relative(repoRoot, jsonPath)
    : jsonPath;
  const r = spawnSync(process.execPath, ["tools/validate-workflow-json.mjs", rel], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
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

const portfolioId = argv[0];
const flags = new Set(argv.slice(1));
const dryRun = flags.has("--dry-run");
const skipValidate = flags.has("--skip-validate");
const unknown = argv.slice(1).filter((a) => a !== "--dry-run" && a !== "--skip-validate");
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

const envKey = remoteIdEnvKey(portfolioId);
const remoteId = (process.env[envKey] || "").trim();
const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error("Set N8N_BASE_URL and N8N_API_KEY (repo root .env or environment).");
  process.exit(1);
}
if (!remoteId) {
  console.error(`Set ${envKey} to the remote n8n workflow id for ${portfolioId}.`);
  process.exit(1);
}

if (!skipValidate) {
  if (!runLocalValidation(repoRoot, jsonPath)) {
    process.exit(1);
  }
}

const raw = fs.readFileSync(jsonPath, "utf8");
const local = JSON.parse(raw);
const payload = buildWorkflowPutPayload(
  /** @type {Record<string, unknown>} */ (local),
);

const url = `${base}/api/v1/workflows/${remoteId}`;

if (dryRun) {
  console.log("Dry run — would PUT", url);
  console.log("Portfolio:", portfolioId, "JSON:", path.relative(repoRoot, jsonPath));
  console.log("Remote id:", remoteId);
  process.exit(0);
}

const res = await fetch(url, {
  method: "PUT",
  headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
const saved = await res.json();
console.log("Workflow updated", saved.id, saved.name, saved.updatedAt);
