#!/usr/bin/env node
/**
 * Print repo-relative path to canonical workflow.json for a workflow shortId.
 * Used by validate-workflow.sh (single source of truth with n8n-workflow-portfolio.mjs).
 *
 * Usage: node tools/resolve-workflow-json.mjs wf01
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePortfolioJsonPath } from "./lib/n8n-workflow-portfolio.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const id = process.argv[2];
if (!id || id === "-h" || id === "--help") {
  console.error("Usage: node tools/resolve-workflow-json.mjs <shortId>");
  process.exit(id ? 0 : 1);
}

try {
  const abs = resolvePortfolioJsonPath(repoRoot, id);
  console.log(path.relative(repoRoot, abs));
} catch (e) {
  console.error(/** @type {Error} */ (e).message);
  process.exit(1);
}
