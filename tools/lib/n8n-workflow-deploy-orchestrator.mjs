/**
 * Orchestrate REST deploy for one root workflow + its declared subworkflow dependencies.
 *
 * Resolves the remote n8n workflow id from `.env` (`N8N_WORKFLOW_ID_<SHORTID>`); when unset,
 * POST-creates on n8n, writes the new id back to repository root `.env`, and switches to
 * the regular PUT update path. `--dry-run` never POST-creates and never writes `.env`.
 *
 * Used by `tools/push-workflow-to-n8n-api.mjs`. Kept in `lib/` so it stays testable in isolation.
 */
import fs from "node:fs";
import path from "node:path";

import {
  remoteIdEnvKey,
  resolvePortfolioJsonPath,
  resolveRemoteWorkflowId,
  runLocalValidation,
} from "./n8n-workflow-portfolio.mjs";
import {
  applyPortfolioEnvOverridesBeforePush,
  buildWorkflowPostPayload,
  fetchMergeAndPutWorkflow,
  injectExecuteWorkflowRemoteIds,
  loadSubworkflowDependencyManifest,
  postCreateWorkflow,
  resolveDependencyJsonPath,
  resolveRemoteIdForDependency,
} from "./n8n-workflow-deploy-core.mjs";
import { writeEnvKey } from "./env-writer.mjs";

/**
 * Deploy each entry in `subworkflow-dependencies.json` (validate, POST-create when missing,
 * persist new ids to `.env`, then PUT-update). Returns the map used to inject Execute Workflow
 * `workflowId` in the parent graph.
 *
 * @param {string} repoRoot
 * @param {string} workflowDir directory containing `workflow.json` (and optional manifest)
 * @param {string} base n8n base URL (no trailing slash)
 * @param {string} key n8n API key
 * @param {boolean} dryRun
 * @param {boolean} skipValidate
 * @param {Record<string, unknown>} parentLocal parsed parent `workflow.json`
 * @returns {Promise<Map<string, string>>}
 */
export async function deployDeclaredSubworkflows(
  repoRoot,
  workflowDir,
  base,
  key,
  dryRun,
  skipValidate,
  parentLocal,
) {
  const deps = loadSubworkflowDependencyManifest(workflowDir);
  if (!deps || deps.length === 0) {
    return new Map();
  }

  const envFilePath = path.join(repoRoot, ".env");

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
    let remoteId = resolveRemoteIdForDependency(dep.remoteIdEnv, {
      parent: parentLocal,
      nodeNames: dep.parentExecuteWorkflowNodeNames,
    }).trim();

    if (!remoteId) {
      if (dryRun) {
        throw new Error(
          `Dependency ${dep.path}: ${dep.remoteIdEnv} is not set and --dry-run cannot POST-create. Re-run deploy without --dry-run to bootstrap, or set ${dep.remoteIdEnv} in .env.`,
        );
      }
      applyPortfolioEnvOverridesBeforePush(/** @type {unknown[] | undefined} */ (localDep.nodes));
      const created = await postCreateWorkflow(base, key, buildWorkflowPostPayload(localDep));
      remoteId = created.id;
      console.log(`Created sub-workflow on n8n: ${created.name} (${remoteId}).`);
      const result = writeEnvKey(envFilePath, dep.remoteIdEnv, remoteId, { tool: "deploy" });
      console.log(
        `Repository root .env ${result.action}: ${dep.remoteIdEnv}=${remoteId}${
          result.previousValue ? ` (previous value ${result.previousValue} commented)` : ""
        }.`,
      );
      process.env[dep.remoteIdEnv] = remoteId;
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

/**
 * Deploy one root workflow (validate, deploy declared deps, bootstrap-or-update parent).
 *
 * @param {string} repoRoot
 * @param {string} portfolioId workflow shortId (e.g. `wf01`)
 * @param {object} opts
 * @param {string} opts.base n8n base URL (no trailing slash)
 * @param {string} opts.key n8n API key
 * @param {boolean} opts.dryRun
 * @param {boolean} opts.skipValidate
 * @param {boolean} opts.noDeps
 */
export async function deployOneWorkflow(repoRoot, portfolioId, opts) {
  const { base, key, dryRun, skipValidate, noDeps } = opts;
  const jsonPath = resolvePortfolioJsonPath(repoRoot, portfolioId);
  const workflowDir = path.dirname(jsonPath);

  if (!skipValidate) {
    if (!runLocalValidation(repoRoot, path.relative(repoRoot, jsonPath))) {
      process.exit(1);
    }
  }

  const envKey = remoteIdEnvKey(portfolioId);
  const local = /** @type {Record<string, unknown>} */ (
    JSON.parse(fs.readFileSync(jsonPath, "utf8"))
  );

  /** @type {Map<string, string>} */
  let injectionMap = new Map();
  const manifestPresent = fs.existsSync(
    path.join(workflowDir, "subworkflow-dependencies.json"),
  );
  const runDeps = manifestPresent && !noDeps;

  if (runDeps) {
    console.log(
      `Workflow ${portfolioId}: deploying subworkflow-dependencies.json before parent (use --no-deps to skip).`,
    );
    injectionMap = await deployDeclaredSubworkflows(
      repoRoot,
      workflowDir,
      base,
      key,
      dryRun,
      skipValidate,
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
    console.log(`Injected ${injected} Execute Workflow workflowId(s) from environment before parent push.`);
  }

  let remoteId = resolveRemoteWorkflowId(envKey);

  if (!remoteId) {
    if (dryRun) {
      console.log(
        `Dry run — ${portfolioId}: ${envKey} is unset; would POST-create on n8n and write the new id to .env.`,
      );
      console.log(`  JSON: ${path.relative(repoRoot, jsonPath)}`);
      console.log(
        "  Re-run without --dry-run to bootstrap; subsequent runs will become regular PUT updates.",
      );
      return;
    }
    applyPortfolioEnvOverridesBeforePush(/** @type {unknown[] | undefined} */ (local.nodes));
    const created = await postCreateWorkflow(base, key, buildWorkflowPostPayload(local));
    remoteId = created.id;
    console.log(`Created workflow ${portfolioId} on n8n: ${created.name} (${remoteId}).`);
    const result = writeEnvKey(path.join(repoRoot, ".env"), envKey, remoteId, { tool: "deploy" });
    console.log(
      `Repository root .env ${result.action}: ${envKey}=${remoteId}${
        result.previousValue ? ` (previous value ${result.previousValue} commented)` : ""
      }.`,
    );
    process.env[envKey] = remoteId;
  }

  await fetchMergeAndPutWorkflow({
    base,
    apiKey: key,
    remoteId,
    local,
    dryRun,
    label: portfolioId,
  });
}
