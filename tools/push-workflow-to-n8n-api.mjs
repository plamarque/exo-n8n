#!/usr/bin/env node
/**
 * Push canonical workflow.json to n8n via REST API (PUT /api/v1/workflows/:id).
 * Loads `.env` from the repository root (see root `.env.example`).
 *
 * Merges credential references from the existing remote workflow (GET) by matching
 * node `id`, so canonical JSON does not need embedded credentials. Optionally
 * deactivates before PUT when the remote workflow is active, then re-activates.
 * Env-based credential overrides apply only to nodes still missing credentials after merge.
 * When the OpenAI credential list cannot pick a single binding, the script can reuse the
 * openAiApi reference from another remote workflow (see N8N_OPENAI_REFERENCE_WORKFLOW_ID / WF01 id in usage).
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
  N8N_WORKFLOW_ID_WF01 … N8N_WORKFLOW_ID_WF04, N8N_WORKFLOW_ID_UNWRAP (optional if workflow.json has top-level "id")
  N8N_MCP_OAUTH2_CREDENTIAL_ID   optional override: fill only MCP Client nodes still missing credentials after merge
  N8N_MCP_OAUTH2_CREDENTIAL_NAME optional display name for that override
  N8N_OPENAI_CREDENTIAL_ID       optional override: fill only lmChatOpenAi nodes still missing credentials after merge
  N8N_OPENAI_CREDENTIAL_NAME     optional display name for that override
  N8N_OPENAI_REFERENCE_WORKFLOW_ID  optional: copy openAiApi ref from first configured lmChatOpenAi on that workflow id (else tries N8N_WORKFLOW_ID_WF01) when /credentials cannot pick a single binding

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

/**
 * @param {string} portfolioId
 * @param {string} envKey
 * @param {Record<string, unknown>} local
 * @param {string} jsonPathForError
 */
function resolveRemoteWorkflowId(portfolioId, envKey, local, jsonPathForError) {
  const fromEnv = (process.env[envKey] || "").trim();
  if (fromEnv) return fromEnv;
  const raw = local?.id;
  const fromFile = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  if (fromFile) return fromFile;
  throw new Error(
    `Set ${envKey} in .env, or add a top-level "id" (remote n8n workflow id) to ${jsonPathForError}.`,
  );
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
const LM_CHAT_OPENAI_NODE_TYPE = "@n8n/n8n-nodes-langchain.lmChatOpenAi";
const OPENAI_API_CREDENTIAL_TYPE = "openAiApi";

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
      `Multiple ${MCP_OAUTH2_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_MCP_OAUTH2_CREDENTIAL_ID for fallback injection when merge leaves MCP nodes without credentials.`,
    );
  }
  return null;
}

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
      `Multiple ${OPENAI_API_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_OPENAI_CREDENTIAL_ID for fallback injection when merge leaves OpenAI nodes without credentials.`,
    );
  }
  return null;
}

/** @param {unknown} node */
function credentialRefMissing(node, credType) {
  if (!node || typeof node !== "object") return true;
  const cred = /** @type {{ credentials?: Record<string, { id?: string }> }} */ (node).credentials?.[credType];
  return !cred || typeof cred.id !== "string" || !cred.id.trim();
}

/** @param {unknown[] | undefined} localNodes @param {unknown[] | undefined} remoteNodes */
function mergeCredentialsFromRemote(localNodes, remoteNodes) {
  if (!Array.isArray(localNodes) || !Array.isArray(remoteNodes)) return 0;
  /** @type {Map<string, { credentials?: Record<string, { id: string; name: string }> }>} */
  const byId = new Map();
  for (const n of remoteNodes) {
    if (n && typeof n === "object" && typeof /** @type {{ id?: string }} */ (n).id === "string") {
      byId.set(/** @type {{ id: string }} */ (n).id, /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (n));
    }
  }
  let patched = 0;
  for (const node of localNodes) {
    if (!node || typeof node !== "object" || typeof /** @type {{ id?: string }} */ (node).id !== "string") {
      continue;
    }
    const rem = byId.get(/** @type {{ id: string }} */ (node).id);
    const rc = rem?.credentials;
    if (!rc || typeof rc !== "object" || Object.keys(rc).length === 0) continue;

    /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */
    const ln = node;
    if (!ln.credentials || typeof ln.credentials !== "object" || Object.keys(ln.credentials).length === 0) {
      ln.credentials = /** @type {Record<string, { id: string; name: string }>} */ (
        JSON.parse(JSON.stringify(rc))
      );
      patched += Object.keys(ln.credentials).length;
      continue;
    }
    for (const [ctype, ref] of Object.entries(rc)) {
      if (!ref || typeof ref !== "object") continue;
      if (credentialRefMissing(node, ctype)) {
        if (!ln.credentials) ln.credentials = {};
        ln.credentials[ctype] = { id: ref.id, name: ref.name };
        patched++;
      }
    }
  }
  return patched;
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @returns {number}
 */
function injectMcpOAuth2CredentialsMissing(nodes, binding) {
  if (!binding || !Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (
      !node ||
      typeof node !== "object" ||
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).type !==
        MCP_CLIENT_NODE_TYPE ||
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).parameters
        ?.authentication !== MCP_OAUTH2_CREDENTIAL_TYPE
    ) {
      continue;
    }
    if (!credentialRefMissing(node, MCP_OAUTH2_CREDENTIAL_TYPE)) continue;
    /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials = {
      ...(/** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials || {}),
      [MCP_OAUTH2_CREDENTIAL_TYPE]: { id: binding.id, name: binding.name },
    };
    count++;
  }
  return count;
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @returns {number}
 */
function injectOpenAiCredentialsMissing(nodes, binding) {
  if (!binding || !Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (
      !node ||
      typeof node !== "object" ||
      /** @type {{ type?: string }} */ (node).type !== LM_CHAT_OPENAI_NODE_TYPE
    ) {
      continue;
    }
    if (!credentialRefMissing(node, OPENAI_API_CREDENTIAL_TYPE)) continue;
    /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials = {
      ...(/** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials || {}),
      [OPENAI_API_CREDENTIAL_TYPE]: { id: binding.id, name: binding.name },
    };
    count++;
  }
  return count;
}

/**
 * Reuse the same openAiApi {id,name} as an existing lmChatOpenAi on another workflow (typically WF01),
 * when the credentials API list is missing, forbidden, or ambiguous.
 * @param {string} base
 * @param {string} apiKey
 * @param {string} workflowId
 * @returns {Promise<{ id: string; name: string } | null>}
 */
async function extractOpenAiCredentialRefFromRemoteWorkflow(base, apiKey, workflowId) {
  let remote;
  try {
    remote = await getRemoteWorkflow(base, apiKey, workflowId);
  } catch {
    return null;
  }
  const nodes = /** @type {unknown[] | undefined} */ (remote.nodes);
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (/** @type {{ type?: string }} */ (node).type !== LM_CHAT_OPENAI_NODE_TYPE) continue;
    const cred = /** @type {{ credentials?: { openAiApi?: { id?: string; name?: string } } }} */ (
      node
    ).credentials?.openAiApi;
    const id = typeof cred?.id === "string" ? cred.id.trim() : "";
    if (!id) continue;
    const name =
      typeof cred?.name === "string" && cred.name.trim() ? cred.name.trim() : "OpenAI API";
    return { id, name };
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
 * @param {string} base
 * @param {string} apiKey
 * @param {string} remoteId
 */
async function getRemoteWorkflow(base, apiKey, remoteId) {
  const res = await fetch(`${base}/api/v1/workflows/${remoteId}`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!res.ok) {
    throw new Error(
      `GET workflow failed (${res.status}): ${(await res.text()).slice(0, 500)}`,
    );
  }
  return /** @type {Record<string, unknown>} */ (await res.json());
}

/**
 * @param {string} base
 * @param {string} apiKey
 * @param {string} remoteId
 * @param {"activate" | "deactivate"} action
 */
async function postWorkflowLifecycle(base, apiKey, remoteId, action) {
  return fetch(`${base}/api/v1/workflows/${remoteId}/${action}`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey },
  });
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

const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error("Set N8N_BASE_URL and N8N_API_KEY (repo root .env or environment).");
  process.exit(1);
}

if (!skipValidate) {
  if (!runLocalValidation(repoRoot, jsonPath)) {
    process.exit(1);
  }
}

const raw = fs.readFileSync(jsonPath, "utf8");
const local = /** @type {Record<string, unknown>} */ (JSON.parse(raw));

const envKey = remoteIdEnvKey(portfolioId);
let remoteId;
try {
  remoteId = resolveRemoteWorkflowId(
    portfolioId,
    envKey,
    local,
    path.relative(repoRoot, jsonPath),
  );
} catch (e) {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
}

const url = `${base}/api/v1/workflows/${remoteId}`;

let remote = null;
let wasActive = false;
try {
  remote = await getRemoteWorkflow(base, key, remoteId);
  wasActive = remote.active === true;
} catch (e) {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
}

const mergedCredSlots = mergeCredentialsFromRemote(
  /** @type {unknown[] | undefined} */ (local.nodes),
  /** @type {unknown[] | undefined} */ (remote.nodes),
);
if (mergedCredSlots > 0) {
  console.log(`Merged ${mergedCredSlots} credential reference(s) from remote workflow by node id.`);
}

const credList = await fetchCredentialsList(base, key);
const mcpBinding = resolveMcpOAuth2CredentialBindingFromList(credList);
const filledMcp = injectMcpOAuth2CredentialsMissing(
  /** @type {unknown[] | undefined} */ (local.nodes),
  mcpBinding,
);
if (filledMcp > 0) {
  console.log(`Fallback: attached ${MCP_OAUTH2_CREDENTIAL_TYPE} to ${filledMcp} MCP Client node(s) still missing credentials.`);
}

let openAiBinding = resolveOpenAiCredentialBindingFromList(credList);
if (
  !openAiBinding &&
  workflowUsesLmChatOpenAi(/** @type {unknown[] | undefined} */ (local.nodes))
) {
  const refWorkflowId =
    (process.env.N8N_OPENAI_REFERENCE_WORKFLOW_ID || "").trim() ||
    (process.env.N8N_WORKFLOW_ID_WF01 || "").trim();
  if (refWorkflowId) {
    openAiBinding = await extractOpenAiCredentialRefFromRemoteWorkflow(base, key, refWorkflowId);
    if (openAiBinding) {
      console.log(
        `OpenAI credential reference resolved from workflow ${refWorkflowId} (reuse an existing lmChatOpenAi binding when the /credentials list is ambiguous or unavailable).`,
      );
    }
  }
}
const filledOpenAi = injectOpenAiCredentialsMissing(
  /** @type {unknown[] | undefined} */ (local.nodes),
  openAiBinding,
);
if (filledOpenAi > 0) {
  console.log(`Fallback: attached ${OPENAI_API_CREDENTIAL_TYPE} to ${filledOpenAi} OpenAI chat model node(s) still missing credentials.`);
}

if (workflowUsesMcpOAuth2(/** @type {unknown[] | undefined} */ (local.nodes))) {
  for (const node of /** @type {unknown[]} */ (local.nodes || [])) {
    if (
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).type ===
        MCP_CLIENT_NODE_TYPE &&
      /** @type {{ type?: string; parameters?: { authentication?: string } }} */ (node).parameters
        ?.authentication === MCP_OAUTH2_CREDENTIAL_TYPE &&
      credentialRefMissing(node, MCP_OAUTH2_CREDENTIAL_TYPE)
    ) {
      console.warn(
        `MCP Client node "${/** @type {{ name?: string }} */ (node).name}" still has no ${MCP_OAUTH2_CREDENTIAL_TYPE} reference after merge and fallback.`,
      );
    }
  }
}

if (workflowUsesLmChatOpenAi(/** @type {unknown[] | undefined} */ (local.nodes))) {
  for (const node of /** @type {unknown[]} */ (local.nodes || [])) {
    if (
      node &&
      typeof node === "object" &&
      /** @type {{ type?: string; name?: string }} */ (node).type === LM_CHAT_OPENAI_NODE_TYPE &&
      credentialRefMissing(node, OPENAI_API_CREDENTIAL_TYPE)
    ) {
      console.warn(
        `Node "${/** @type {{ name?: string }} */ (node).name}" still has no ${OPENAI_API_CREDENTIAL_TYPE} reference after merge and fallback.`,
      );
    }
  }
}

const payload = buildWorkflowPutPayload(local);

if (dryRun) {
  console.log("Dry run — would PUT", url);
  console.log("Portfolio:", portfolioId, "JSON:", path.relative(repoRoot, jsonPath));
  console.log("Remote id:", remoteId);
  console.log("Remote active before push:", wasActive);
  process.exit(0);
}

if (wasActive) {
  const de = await postWorkflowLifecycle(base, key, remoteId, "deactivate");
  if (!de.ok) {
    console.error("Failed to deactivate workflow before PUT:", de.status, await de.text());
    process.exit(1);
  }
  console.log("Deactivated workflow before PUT (was active).");
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
