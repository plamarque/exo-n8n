/**
 * Resolve workflow shortIds (from `workflows/<dirname>/workflow.json` folder names)
 * to canonical workflow.json paths and remote n8n workflow id env keys.
 * Used by push and download REST scripts.
 *
 * shortId rule: substring before the first `-` in the immediate folder name under
 * `workflows/`, or the full folder name if there is no hyphen.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * @param {string} dirname immediate child name under workflows/ (not a full path)
 * @returns {string}
 */
export function shortIdFromDirName(dirname) {
  const i = dirname.indexOf("-");
  if (i === -1) return dirname;
  return dirname.slice(0, i);
}

/**
 * Direct children of workflows/ that contain workflow.json at
 * workflows/<name>/workflow.json
 * @param {string} repoRoot
 * @returns {Array<{ dirName: string; shortId: string; jsonPath: string }>}
 */
export function listRootWorkflowEntries(repoRoot) {
  const workflowsDir = path.join(repoRoot, "workflows");
  if (!fs.existsSync(workflowsDir)) {
    throw new Error(`Missing ${workflowsDir}`);
  }
  /** @type {Array<{ dirName: string; shortId: string; jsonPath: string }>} */
  const out = [];
  /** @type {Map<string, string>} shortId -> dirName (detect collision) */
  const seen = new Map();
  for (const e of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dirName = e.name;
    const jsonPath = path.join(workflowsDir, dirName, "workflow.json");
    if (!fs.existsSync(jsonPath)) continue;
    const shortId = shortIdFromDirName(dirName);
    const prev = seen.get(shortId);
    if (prev !== undefined && prev !== dirName) {
      throw new Error(
        `Ambiguous shortId "${shortId}": both workflows/${prev} and workflows/${dirName} map to the same id (rename one folder so shortIds differ).`,
      );
    }
    seen.set(shortId, dirName);
    out.push({ dirName, shortId, jsonPath });
  }
  return out.sort((a, b) => a.shortId.localeCompare(b.shortId));
}

/**
 * Sorted unique shortIds for workflows that have a root workflow.json.
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function listWorkflowIds(repoRoot) {
  return listRootWorkflowEntries(repoRoot).map((e) => e.shortId);
}

/**
 * @param {string} repoRoot
 * @param {string} portfolioId workflow shortId (not the word "all")
 * @returns {string} absolute path to workflow.json
 */
export function resolvePortfolioJsonPath(repoRoot, portfolioId) {
  const matches = listRootWorkflowEntries(repoRoot).filter(
    (e) => e.shortId === portfolioId,
  );
  if (matches.length === 0) {
    throw new Error(
      `Unknown workflow id: ${portfolioId} (no workflows/<name>/workflow.json where shortId matches; see docs/DEVELOPMENT.md).`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous workflow id: ${portfolioId} — ${matches.map((m) => m.dirName).join(", ")}`,
    );
  }
  return matches[0].jsonPath;
}

/** @param {string} portfolioId */
export function remoteIdEnvKey(portfolioId) {
  return `N8N_WORKFLOW_ID_${portfolioId.toUpperCase()}`;
}

/**
 * @param {string} portfolioId
 * @param {string} envKey
 * @param {Record<string, unknown>} local
 * @param {string} jsonPathForError
 */
export function resolveRemoteWorkflowId(portfolioId, envKey, local, jsonPathForError) {
  const fromEnv = (process.env[envKey] || "").trim();
  if (fromEnv) return fromEnv;
  const raw = local?.id;
  const fromFile = typeof raw === "string" && raw.trim() ? raw.trim() : "";
  if (fromFile) return fromFile;
  throw new Error(
    `Set ${envKey} in .env, or add a top-level "id" (remote n8n workflow id) to ${jsonPathForError}.`,
  );
}

/**
 * @param {string} repoRoot
 * @param {string} jsonPath absolute or relative to repo
 * @returns {boolean}
 */
export function runLocalValidation(repoRoot, jsonPath) {
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
