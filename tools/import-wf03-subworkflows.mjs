#!/usr/bin/env node
/**
 * @deprecated Prefer `./deploy.sh wf03 --create-missing-deps` (or
 * `npm run deploy:workflow -- wf03 --create-missing-deps`) so missing UTIL
 * sub-workflows are POST-created, env lines are printed, and the parent is
 * deployed with in-memory `workflowId` injection — without rewriting
 * canonical `workflows/wf03-weekly-steering/workflow.json` on disk.
 *
 * This script forwards to the unified deploy entrypoint for backward compatibility.
 */
import { spawnSync } from "node:child_process";
import { loadRepoDotenv } from "./load-repo-dotenv.mjs";

const repoRoot = loadRepoDotenv();

const extra = process.argv.slice(2).filter((a) => a !== "--dry-run");
const dryRun = process.argv.includes("--dry-run");

console.warn(
  "[deprecated] tools/import-wf03-subworkflows.mjs — use: ./deploy.sh wf03 --create-missing-deps",
);

const forward = ["tools/push-workflow-to-n8n-api.mjs", "wf03", "--create-missing-deps", ...extra];
if (dryRun) {
  forward.push("--dry-run");
}

const r = spawnSync(process.execPath, forward, {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
});
process.exit(r.status ?? 1);
