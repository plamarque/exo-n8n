#!/usr/bin/env node
/**
 * Rewrite canonical workflow.json files on disk using the repository root `.env`:
 * replaces portfolio `$vars.* || …` patterns and MCP Client endpointUrl with literals from env.
 * REST deploy does **not** apply these transforms; run this script before `deploy.sh` / validate when needed.
 *
 * Usage:
 *   node tools/generate-workflow-json-from-env.mjs
 *   node tools/generate-workflow-json-from-env.mjs --dry-run
 *   node tools/generate-workflow-json-from-env.mjs workflows/wf01-email-dispatch/workflow.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRepoDotenv } from "./load-repo-dotenv.mjs";
import { applyPortfolioHardcodeFromEnv } from "./lib/n8n-workflow-deploy-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

/**
 * @param {string} dir
 * @returns {string[]}
 */
function findWorkflowJsonFiles(dir) {
  /** @type {string[]} */
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) {
        if (name.name === "fixtures") continue;
        walk(p);
      } else if (name.name === "workflow.json") {
        out.push(p);
      }
    }
  }
  walk(dir);
  return out.sort();
}

function usage() {
  console.log(`Usage:
  node tools/generate-workflow-json-from-env.mjs [--dry-run] [workflow.json ...]

With no file arguments, processes every workflows/**/workflow.json (fixtures/ skipped).

Loads repository root .env (see .env.example). Only keys that are set are applied; see
applyPortfolioHardcodeFromEnv in tools/lib/n8n-workflow-deploy-core.mjs.

Options:
  --dry-run   Print files that would change, without writing
`);
}

function main() {
  loadRepoDotenv();
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    usage();
    process.exit(0);
  }
  const dryRun = argv.includes("--dry-run");
  const paths = argv.filter((a) => !a.startsWith("-"));

  /** @type {string[]} */
  let absPaths;
  if (paths.length === 0) {
    absPaths = findWorkflowJsonFiles(path.join(repoRoot, "workflows"));
  } else {
    absPaths = paths.map((p) => path.resolve(repoRoot, p));
  }

  let changed = 0;
  let totalMcp = 0;
  let totalStr = 0;
  for (const abs of absPaths) {
    if (!fs.existsSync(abs)) {
      console.error("Missing file:", abs);
      process.exit(1);
    }
    const raw = fs.readFileSync(abs, "utf8");
    /** @type {Record<string, unknown>} */
    let w;
    try {
      w = /** @type {Record<string, unknown>} */ (JSON.parse(raw));
    } catch (e) {
      console.error("Invalid JSON:", abs, /** @type {Error} */ (e).message);
      process.exit(1);
    }
    const nodes = /** @type {unknown[] | undefined} */ (w.nodes);
    if (!Array.isArray(nodes)) {
      console.warn("Skip (no nodes array):", path.relative(repoRoot, abs));
      continue;
    }

    const clone = /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(w)));
    const cloneNodes = /** @type {unknown[]} */ (clone.nodes);
    const { mcpNodes, stringNodes } = applyPortfolioHardcodeFromEnv(cloneNodes, { silent: true });

    if (JSON.stringify(clone) === JSON.stringify(w)) {
      continue;
    }
    const next = `${JSON.stringify(clone, null, 2)}\n`;
    changed++;
    totalMcp += mcpNodes;
    totalStr += stringNodes;
    const rel = path.relative(repoRoot, abs);
    if (dryRun) {
      console.log("Would update:", rel);
    } else {
      fs.writeFileSync(abs, next, "utf8");
      console.log("Updated:", rel);
    }
  }

  if (changed === 0) {
    console.log(dryRun ? "No files would change." : "No files changed.");
  } else {
    console.log(
      `Summary: ${changed} file(s) ${dryRun ? "would change" : "changed"} (${totalMcp} MCP Client endpointUrl rewrites, ${totalStr} node object(s) with other string updates).`,
    );
  }
}

main();
