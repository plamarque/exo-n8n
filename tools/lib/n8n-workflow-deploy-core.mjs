/**
 * Shared REST deploy helpers for n8n workflows (used by push-workflow-to-n8n-api.mjs
 * and sub-workflow dependency orchestration).
 */
import fs from "node:fs";
import path from "node:path";

/** Keys accepted by n8n Cloud `PUT /api/v1/workflows/:id` for `settings`. */
export const SETTINGS_PUT_ALLOW = new Set([
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

export function sanitizeSettingsForPut(settings) {
  if (!settings || typeof settings !== "object") return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of Object.keys(settings)) {
    if (SETTINGS_PUT_ALLOW.has(k)) out[k] = settings[k];
  }
  return out;
}

/**
 * @param {Record<string, unknown>} local parsed workflow.json
 * @returns {Record<string, unknown>}
 */
export function buildWorkflowPutPayload(local) {
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

/** @param {Record<string, unknown>} local */
export function buildWorkflowPostPayload(local) {
  return {
    name: local.name,
    nodes: local.nodes,
    connections: local.connections ?? {},
    settings: sanitizeSettingsForPut(
      /** @type {Record<string, unknown> | undefined} */ (local.settings),
    ),
  };
}

export const MCP_CLIENT_NODE_TYPE = "@n8n/n8n-nodes-langchain.mcpClient";
export const MCP_OAUTH2_CREDENTIAL_TYPE = "mcpOAuth2Api";
export const LM_CHAT_OPENAI_NODE_TYPE = "@n8n/n8n-nodes-langchain.lmChatOpenAi";
export const OPENAI_API_CREDENTIAL_TYPE = "openAiApi";

/**
 * @param {string} base
 * @param {string} apiKey
 * @returns {Promise<Array<{ id: string; name: string; type: string }> | null>}
 */
export async function fetchCredentialsList(base, apiKey) {
  const res = await fetch(`${base}/api/v1/credentials`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!res.ok) return null;
  /** @type {{ data?: Array<{ id: string; name: string; type: string }> }} */
  const body = await res.json();
  return body.data || [];
}

/**
 * @typedef {"explicit" | "resolveByName" | "singleton" | "none"} McpOAuth2BindingSource
 */

/**
 * Resolve which MCP OAuth2 credential reference to apply during deploy.
 * Priority: `N8N_MCP_CREDENTIAL_ID` → `N8N_MCP_CREDENTIAL_NAME` as exact n8n display name when id is unset → singleton `mcpOAuth2Api` on the instance.
 * `N8N_MCP_CREDENTIAL_NAME` is also the optional `{name}` label in the workflow JSON when `N8N_MCP_CREDENTIAL_ID` is set.
 *
 * @param {Array<{ id: string; name: string; type: string }> | null} all
 * @returns {{ binding: { id: string; name: string } | null; source: McpOAuth2BindingSource }}
 */
export function resolveMcpOAuth2CredentialBindingFromList(all) {
  const explicitId = (process.env.N8N_MCP_CREDENTIAL_ID || "").trim();
  const credName = (process.env.N8N_MCP_CREDENTIAL_NAME || "").trim();
  if (explicitId) {
    return {
      binding: { id: explicitId, name: credName || "MCP OAuth2 API" },
      source: "explicit",
    };
  }

  if (credName && all) {
    const mcpList = all.filter((c) => c.type === MCP_OAUTH2_CREDENTIAL_TYPE);
    const matches = mcpList.filter((c) => c.name === credName);
    if (matches.length === 1) {
      return {
        binding: { id: matches[0].id, name: matches[0].name },
        source: "resolveByName",
      };
    }
    if (matches.length === 0) {
      console.warn(
        `N8N_MCP_CREDENTIAL_NAME="${credName}": no ${MCP_OAUTH2_CREDENTIAL_TYPE} credential with that exact display name on the instance.`,
      );
    } else {
      console.warn(
        `N8N_MCP_CREDENTIAL_NAME="${credName}": ambiguous — ${matches.length} ${MCP_OAUTH2_CREDENTIAL_TYPE} credentials match that name (expected exactly one).`,
      );
    }
  }

  if (!all) {
    return { binding: null, source: "none" };
  }
  const list = all.filter((c) => c.type === MCP_OAUTH2_CREDENTIAL_TYPE);
  if (list.length === 1) {
    return { binding: { id: list[0].id, name: list[0].name }, source: "singleton" };
  }
  if (list.length > 1) {
    console.warn(
      `Multiple ${MCP_OAUTH2_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_MCP_CREDENTIAL_ID, N8N_MCP_CREDENTIAL_NAME (exact display name when id is unset), or use a single credential when merge leaves MCP nodes without credentials.`,
    );
  }
  return { binding: null, source: "none" };
}

/**
 * @param {Array<{ id: string; name: string; type: string }> | null} all
 */
export function resolveOpenAiCredentialBindingFromList(all) {
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
      `Multiple ${OPENAI_API_CREDENTIAL_TYPE} credentials (${list.map((c) => c.name).join(", ")}). Set N8N_OPENAI_CREDENTIAL_ID for fallback injection when merge leaves OpenAI nodes still missing credentials.`,
    );
  }
  return null;
}

/** @param {unknown} node */
export function credentialRefMissing(node, credType) {
  if (!node || typeof node !== "object") return true;
  const cred = /** @type {{ credentials?: Record<string, { id?: string }> }} */ (node).credentials?.[credType];
  return !cred || typeof cred.id !== "string" || !cred.id.trim();
}

/** @param {unknown[] | undefined} localNodes @param {unknown[] | undefined} remoteNodes */
export function mergeCredentialsFromRemote(localNodes, remoteNodes) {
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
 * Attach `mcpOAuth2Api` to MCP Client nodes using OAuth2 authentication.
 * When `force` is true, overwrites existing references (used for explicit id / resolve-by-name).
 * When false, only nodes with a missing reference are updated (singleton heuristic).
 *
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @param {{ force?: boolean }} [opts]
 * @returns {number}
 */
export function applyMcpOAuth2CredentialBinding(nodes, binding, opts = {}) {
  const force = opts.force === true;
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
    if (!force && !credentialRefMissing(node, MCP_OAUTH2_CREDENTIAL_TYPE)) continue;
    /** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials = {
      ...(/** @type {{ credentials?: Record<string, { id: string; name: string }> }} */ (node).credentials || {}),
      [MCP_OAUTH2_CREDENTIAL_TYPE]: { id: binding.id, name: binding.name },
    };
    count++;
  }
  return count;
}

/**
 * Escape a URL (or any string) for use inside the double-quoted fallback of an n8n expression.
 * @param {string} s
 */
export function escapeN8nExpressionStringLiteral(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * When `EXO_MCP_ENDPOINT` is set in the repository root `.env`, rewrite every MCP Client
 * `parameters.endpointUrl` to `={{$vars.EXO_MCP_ENDPOINT || "<url>"}}` using that value as the
 * fallback literal. Same env name as n8n Variables (`$vars.EXO_MCP_ENDPOINT`) for operator clarity.
 *
 * @param {unknown[] | undefined} nodes
 * @returns {number} number of nodes updated
 */
export function applyExoMcpEndpointDeployOverride(nodes) {
  const raw = (process.env.EXO_MCP_ENDPOINT || "").trim();
  if (!raw) return 0;
  if (!/^https?:\/\//i.test(raw)) {
    console.warn(
      "EXO_MCP_ENDPOINT is set but invalid (expected a URL starting with http:// or https://); skipping MCP endpoint injection.",
    );
    return 0;
  }
  const escaped = escapeN8nExpressionStringLiteral(raw);
  const expression = `={{$vars.EXO_MCP_ENDPOINT || "${escaped}"}}`;
  if (!Array.isArray(nodes)) return 0;
  let count = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (/** @type {{ type?: string }} */ (node).type !== MCP_CLIENT_NODE_TYPE) continue;
    const n = /** @type {{ parameters?: { endpointUrl?: string } }} */ (node);
    if (!n.parameters || typeof n.parameters.endpointUrl !== "string") continue;
    n.parameters.endpointUrl = expression;
    count++;
  }
  if (count > 0) {
    console.log(
      `Injected EXO_MCP_ENDPOINT fallback for ${count} MCP Client node(s) (from repository root .env).`,
    );
  }
  return count;
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {{ id: string; name: string } | null} binding
 * @returns {number}
 */
export function injectOpenAiCredentialsMissing(nodes, binding) {
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
 * @param {string} base
 * @param {string} apiKey
 * @param {string} remoteId
 */
export async function getRemoteWorkflow(base, apiKey, remoteId) {
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
 * @param {string} workflowId
 * @returns {Promise<{ id: string; name: string } | null>}
 */
export async function extractOpenAiCredentialRefFromRemoteWorkflow(base, apiKey, workflowId) {
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
export function workflowUsesMcpOAuth2(nodes) {
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
export function workflowUsesLmChatOpenAi(nodes) {
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
 * @param {"activate" | "deactivate"} action
 */
export async function postWorkflowLifecycle(base, apiKey, remoteId, action) {
  return fetch(`${base}/api/v1/workflows/${remoteId}/${action}`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey },
  });
}

/**
 * @param {string} base
 * @param {string} apiKey
 * @param {Record<string, unknown>} body
 */
export async function postCreateWorkflow(base, apiKey, body) {
  const res = await fetch(`${base}/api/v1/workflows`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST workflow failed (${res.status}): ${text.slice(0, 800)}`);
  }
  return /** @type {{ id: string; name: string }} */ (JSON.parse(text));
}

/**
 * Merge remote credentials and apply MCP/OpenAI fallbacks (mutates `local.nodes`).
 * @param {Record<string, unknown>} local
 * @param {Record<string, unknown>} remote
 * @param {string} base
 * @param {string} apiKey
 */
export async function applyCredentialMergeAndFallbacks(local, remote, base, apiKey) {
  const mergedCredSlots = mergeCredentialsFromRemote(
    /** @type {unknown[] | undefined} */ (local.nodes),
    /** @type {unknown[] | undefined} */ (remote.nodes),
  );
  if (mergedCredSlots > 0) {
    console.log(`Merged ${mergedCredSlots} credential reference(s) from remote workflow by node id.`);
  }

  const credList = await fetchCredentialsList(base, apiKey);
  const mcpResolution = resolveMcpOAuth2CredentialBindingFromList(credList);
  const mcpForceApply =
    mcpResolution.source === "explicit" || mcpResolution.source === "resolveByName";
  const filledMcp = applyMcpOAuth2CredentialBinding(
    /** @type {unknown[] | undefined} */ (local.nodes),
    mcpResolution.binding,
    { force: mcpForceApply },
  );
  if (filledMcp > 0) {
    if (mcpForceApply) {
      console.log(
        `Fallback: applied ${MCP_OAUTH2_CREDENTIAL_TYPE} to ${filledMcp} MCP Client node(s) (${mcpResolution.source}; overwrites existing references).`,
      );
    } else {
      console.log(
        `Fallback: attached ${MCP_OAUTH2_CREDENTIAL_TYPE} to ${filledMcp} MCP Client node(s) still missing credentials.`,
      );
    }
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
      openAiBinding = await extractOpenAiCredentialRefFromRemoteWorkflow(base, apiKey, refWorkflowId);
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
    console.log(
      `Fallback: attached ${OPENAI_API_CREDENTIAL_TYPE} to ${filledOpenAi} OpenAI chat model node(s) still missing credentials.`,
    );
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
}

/**
 * @param {unknown[] | undefined} nodes
 * @param {Map<string, string>} nodeNameToRemoteWorkflowId
 */
export function injectExecuteWorkflowRemoteIds(nodes, nodeNameToRemoteWorkflowId) {
  if (!Array.isArray(nodes) || !(nodeNameToRemoteWorkflowId instanceof Map)) return 0;
  let n = 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    if (/** @type {{ type?: string }} */ (node).type !== "n8n-nodes-base.executeWorkflow") continue;
    const name = /** @type {{ name?: string }} */ (node).name;
    if (typeof name !== "string") continue;
    const rid = nodeNameToRemoteWorkflowId.get(name);
    if (typeof rid !== "string" || !rid.trim()) continue;
    /** @type {{ parameters?: Record<string, unknown> }} */ (node).parameters =
      /** @type {{ parameters?: Record<string, unknown> }} */ (node).parameters || {};
    /** @type {{ parameters: Record<string, unknown> }} */ (node).parameters.workflowId = rid;
    n++;
  }
  return n;
}

/**
 * @param {string} workflowDir directory containing workflow.json and optional subworkflow-dependencies.json
 * @returns {Array<{ path: string; remoteIdEnv: string; parentExecuteWorkflowNodeNames: string[] }> | null}
 */
export function loadSubworkflowDependencyManifest(workflowDir) {
  const manifestPath = path.join(workflowDir, "subworkflow-dependencies.json");
  if (!fs.existsSync(manifestPath)) return null;
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!raw || raw.version !== 1 || !Array.isArray(raw.dependencies)) {
    throw new Error(
      `Invalid subworkflow-dependencies.json at ${manifestPath}: expected { "version": 1, "dependencies": [...] }`,
    );
  }
  for (const dep of raw.dependencies) {
    if (!dep || typeof dep !== "object") throw new Error(`Invalid dependency entry in ${manifestPath}`);
    if (typeof dep.path !== "string" || !dep.path.trim()) {
      throw new Error(`Invalid dependency.path in ${manifestPath}`);
    }
    if (typeof dep.remoteIdEnv !== "string" || !dep.remoteIdEnv.trim()) {
      throw new Error(`Invalid dependency.remoteIdEnv in ${manifestPath}`);
    }
    const names = dep.parentExecuteWorkflowNodeNames;
    if (!Array.isArray(names) || names.some((x) => typeof x !== "string" || !x.trim())) {
      throw new Error(
        `Invalid dependency.parentExecuteWorkflowNodeNames in ${manifestPath} (expected non-empty string array)`,
      );
    }
  }
  return raw.dependencies;
}

/**
 * @param {string} workflowDir
 * @param {string} relPath
 */
export function resolveDependencyJsonPath(workflowDir, relPath) {
  return path.normalize(path.join(workflowDir, relPath));
}

/**
 * GET remote, merge credentials + fallbacks into `local`, then PUT (and lifecycle).
 * Mutates `local`.
 * @param {{
 *   base: string;
 *   apiKey: string;
 *   remoteId: string;
 *   local: Record<string, unknown>;
 *   dryRun: boolean;
 *   label?: string;
 * }} opts
 */
export async function fetchMergeAndPutWorkflow(opts) {
  const { base, apiKey, remoteId, local, dryRun, label } = opts;
  const url = `${base}/api/v1/workflows/${remoteId}`;
  let remote;
  let wasActive = false;
  try {
    remote = await getRemoteWorkflow(base, apiKey, remoteId);
    wasActive = remote.active === true;
  } catch (e) {
    throw new Error(
      `${label || remoteId}: ${/** @type {Error} */ (e).message}`,
    );
  }
  await applyCredentialMergeAndFallbacks(local, remote, base, apiKey);
  applyExoMcpEndpointDeployOverride(/** @type {unknown[] | undefined} */ (local.nodes));
  const payload = buildWorkflowPutPayload(local);
  if (dryRun) {
    console.log("Dry run — would PUT", label || remoteId, url);
    return;
  }
  if (wasActive) {
    const de = await postWorkflowLifecycle(base, apiKey, remoteId, "deactivate");
    if (!de.ok) {
      throw new Error(`Failed to deactivate before PUT (${remoteId}): ${de.status} ${await de.text()}`);
    }
    console.log("Deactivated workflow before PUT (was active):", label || remoteId);
  }
  const res = await fetch(url, {
    method: "PUT",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`PUT failed (${remoteId}): ${res.status} ${await res.text()}`);
  }
  const saved = await res.json();
  console.log("Workflow updated", saved.id, saved.name, saved.updatedAt);

  if (wasActive) {
    const act = await postWorkflowLifecycle(base, apiKey, remoteId, "activate");
    if (!act.ok) {
      const body = await act.text();
      console.warn("Workflow updated but re-activate failed:", act.status, body);
    } else {
      console.log("Re-activated workflow after successful PUT:", label || remoteId);
    }
  }
}

/**
 * Resolve remote n8n workflow id for a dependency: env, then optional top-level `id` on the
 * dependency JSON, then optional hint from the parent portfolio `workflow.json` (first
 * matching Execute Workflow node name in `hint.nodeNames`).
 *
 * @param {string} envKey
 * @param {Record<string, unknown>} localParsed dependency workflow root
 * @param {{ parent?: Record<string, unknown>; nodeNames?: string[] } | undefined} hint
 */
export function resolveRemoteIdForDependency(envKey, localParsed, hint) {
  const fromEnv = (process.env[envKey] || "").trim();
  if (fromEnv) return fromEnv;
  const raw = localParsed?.id;
  const fromFile = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  if (fromFile) return fromFile;
  const nodes = /** @type {unknown[] | undefined} */ (hint?.parent?.nodes);
  const names = hint?.nodeNames;
  if (Array.isArray(nodes) && Array.isArray(names)) {
    for (const name of names) {
      if (typeof name !== "string" || !name.trim()) continue;
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        if (/** @type {{ name?: string }} */ (node).name !== name) continue;
        if (/** @type {{ type?: string }} */ (node).type !== "n8n-nodes-base.executeWorkflow") continue;
        const wid = /** @type {{ parameters?: { workflowId?: string } }} */ (node).parameters?.workflowId;
        if (typeof wid === "string" && wid.trim()) return wid.trim();
      }
    }
  }
  return "";
}
