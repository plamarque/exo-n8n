/**
 * Shared resolution of portfolio ids (wf01..wf04, unwrap) to canonical workflow.json paths
 * and remote n8n workflow ids. Used by push and download REST scripts.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * @param {string} repoRoot
 * @param {string} portfolioId
 * @returns {string} absolute path to workflow.json
 */
export function resolvePortfolioJsonPath(repoRoot, portfolioId) {
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
export function remoteIdEnvKey(portfolioId) {
  if (portfolioId === "unwrap") return "N8N_WORKFLOW_ID_UNWRAP";
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
