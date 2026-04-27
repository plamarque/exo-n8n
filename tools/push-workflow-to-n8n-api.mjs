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
  N8N_MCP_OAUTH2_CREDENTIAL_ID   optional but recommended: mcpOAuth2Api credential id to attach to MCP Client nodes (canonical JSON omits credentials)
  N8N_MCP_OAUTH2_CREDENTIAL_NAME optional display name for that credential
  N8N_OPENAI_CREDENTIAL_ID       optional: openAiApi credential id for lmChatOpenAi nodes
  N8N_OPENAI_CREDENTIAL_NAME      optional display name for that credential

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

const MCP_CLIENT_NODE_TYPE = "@n8n/n8n-nodes-langchain.mcpClient";
const MCP_OAUTH2_CREDENTIAL_TYPE = "mcpOAuth2Api";

/**
 * Canonical `workflow.json` files omit `credentials` (not committed). n8n REST `PUT` replaces
 * nodes as sent; without credential ids, MCP Client nodes lose OAuth binding and active
 * workflows fail publish validation. Resolve a shared credential to inject before PUT.
 *
 * @param {string} base
 * @param {string} apiKey
 * @returns {Promise<{ id: string; name: string } | null>}
 */
/**
 * @param {string} base
 * @param {string} apiKey
 * @returns {Promise<Array<{ id: string; name: string; type: string }> | null>}
 */
async function fetchCredentialsList(base, apiKey) {
  const res = await fetch(`${base}/api/v1/credentials`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!res.ok) return null;
  /** @type {{ data?: Array<{ id: string; name: string; type: string }> }} */
  const body = await res.json();
  return body.data || [];
}

/**
 * @param {Array<{ id: string; name: string; type: string }> | null} all
 */
function resolveMcpOAuth2CredentialBindingFromList(all) {
  const explicitId = (process.env.N8N_MCP_OAUTH2_CREDENTIAL_ID || "").trim();
  const explicitName = (process.env.N8N_MCP_OAUTH2_CREDENTIAL_NAME || "").trim();
  if (explicitId) {
    return { id: explicitId, name: explicitName || "MCP OAuth2 API" };
  }
  if (!all) return null;
  const list = all.filter((c) => c.type === MCP_OAUTH2_CREDENTIAL_TYPE);
  if (list.length === 1) return { id: list[0].id, name: list[0].name };
  if (list.length > 1) {
    console.warn(
      `Multiple ${MCP_OAUTH2_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_MCP_OAUTH2_CREDENTIAL_ID in .env to attach MCP Client nodes on PUT.`,
    );
  }
  return null;
}

/** @param {unknown[] | undefined} nodes */
function workflowUsesMcpOAuth2(nodes) {
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (node) =>
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).type ===
        MCP_CLIENT_NODE_TYPE &&
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).parameters
        ?.authentication === MCP_OAUTH2_CREDENTIAL_TYPE,
  );
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @returns {number}
 */
function injectMcpOAuth2Credentials(nodes, binding) {
  if (!binding || !Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string; parameters?: { authentication?: string }; credentials?: unknown }} */ (
        node
      ).type === MCP_CLIENT_NODE_TYPE &&
      /** @type {{ type?: string; parameters?: { authentication?: string }; credentials?: unknown }} */ (
        node
      ).parameters?.authentication === MCP_OAUTH2_CREDENTIAL_TYPE
    ) {
      /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials = {
        [MCP_OAUTH2_CREDENTIAL_TYPE]: { id: binding.id, name: binding.name },
      };
      count++;
    }
  }
  return count;
}

const LM_CHAT_OPENAI_NODE_TYPE = "@n8n/n8n-nodes-langchain.lmChatOpenAi";
const OPENAI_API_CREDENTIAL_TYPE = "openAiApi";

/**
 * @param {string} base
 * @param {string} apiKey
 * @returns {Promise<{ id: string; name: string } | null>}
 */
/**
 * @param {Array<{ id: string; name: string; type: string }> | null} all
 */
function resolveOpenAiCredentialBindingFromList(all) {
  const explicitId = (process.env.N8N_OPENAI_CREDENTIAL_ID || "").trim();
  const explicitName = (process.env.N8N_OPENAI_CREDENTIAL_NAME || "").trim();
  if (explicitId) {
    return { id: explicitId, name: explicitName || "OpenAI API" };
  }
  if (!all) return null;
  const list = all.filter((c) => c.type === OPENAI_API_CREDENTIAL_TYPE);
  if (list.length === 1) return { id: list[0].id, name: list[0].name };
  if (list.length > 1) {
    console.warn(
      `Multiple ${OPENAI_API_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_OPENAI_CREDENTIAL_ID in .env for lmChatOpenAi nodes.`,
    );
  }
  return null;
}

/** @param {unknown[] | undefined} nodes */
function workflowUsesLmChatOpenAi(nodes) {
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (node) =>
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string }} */ (node).type === LM_CHAT_OPENAI_NODE_TYPE,
  );
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @returns {number}
 */
function injectOpenAiCredentials(nodes, binding) {
  if (!binding || !Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string; credentials?: unknown }} */ (node).type === LM_CHAT_OPENAI_NODE_TYPE
    ) {
      /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials = {
        [OPENAI_API_CREDENTIAL_TYPE]: { id: binding.id, name: binding.name },
      };
      count++;
    }
  }
  return count;
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

const credList = await fetchCredentialsList(base, key);
const mcpBinding = resolveMcpOAuth2CredentialBindingFromList(credList);
const attachedMcp = injectMcpOAuth2Credentials(
  /** @type {unknown[] | undefined} */ (local.nodes),
  mcpBinding,
);
if (attachedMcp > 0) {
  console.log(`Attached ${MCP_OAUTH2_CREDENTIAL_TYPE} to ${attachedMcp} MCP Client node(s).`);
} else if (workflowUsesMcpOAuth2(/** @type {unknown[] | undefined} */ (local.nodes)) && !mcpBinding) {
  console.warn(
    "No mcpOAuth2Api credential resolved; MCP Client nodes were not given credentials. Set N8N_MCP_OAUTH2_CREDENTIAL_ID or ensure exactly one mcpOAuth2Api credential exists. Publishing/activating may fail until fixed.",
  );
}

const openAiBinding = resolveOpenAiCredentialBindingFromList(credList);
const attachedOpenAi = injectOpenAiCredentials(
  /** @type {unknown[] | undefined} */ (local.nodes),
  openAiBinding,
);
if (attachedOpenAi > 0) {
  console.log(`Attached ${OPENAI_API_CREDENTIAL_TYPE} to ${attachedOpenAi} OpenAI chat model node(s).`);
} else if (workflowUsesLmChatOpenAi(/** @type {unknown[] | undefined} */ (local.nodes)) && !openAiBinding) {
  console.warn(
    "No openAiApi credential resolved; lmChatOpenAi nodes were not given credentials. Set N8N_OPENAI_CREDENTIAL_ID or ensure exactly one openAiApi credential exists.",
  );
}

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
