#!/usr/bin/env node
/**
 * Validate canonical n8n workflow exports using @n8n/workflow-sdk (validateWorkflow).
 * Source of truth remains workflow.json; this runs locally before API/UI import to n8n.
 *
 * Usage:
 *   node tools/validate-workflow-json.mjs workflows/wf01-email-dispatch/workflow.json
 *   node tools/validate-workflow-json.mjs --all
 *   node tools/validate-workflow-json.mjs workflows/wf01-email-dispatch/workflow.json --emit-sdk work/wf01.generated.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { validateWorkflow, generateWorkflowCode } from "@n8n/workflow-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

/** Import preamble required for MCP validate_workflow / generated bundles. */
const SDK_IMPORT = `import {
  workflow,
  node,
  trigger,
  sticky,
  placeholder,
  newCredential,
  ifElse,
  switchCase,
  merge,
  splitInBatches,
  nextBatch,
  languageModel,
  memory,
  tool,
  outputParser,
  embedding,
  embeddings,
  vectorStore,
  retriever,
  documentLoader,
  textSplitter,
  reranker,
  fromAi,
  expr,
} from '@n8n/workflow-sdk';
`;

/**
 * @param {unknown} raw
 * @returns {import('@n8n/workflow-sdk').WorkflowJSON}
 */
function toWorkflowJSON(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Root JSON must be an object");
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (typeof o.name !== "string" || !Array.isArray(o.nodes)) {
    throw new Error('Export must include string "name" and array "nodes"');
  }
  return {
    id: typeof o.id === "string" ? o.id : undefined,
    name: o.name,
    nodes: /** @type {import('@n8n/workflow-sdk').NodeJSON[]} */ (o.nodes),
    connections:
      o.connections && typeof o.connections === "object"
        ? /** @type {import('@n8n/workflow-sdk').WorkflowJSON['connections']} */ (o.connections)
        : {},
    settings:
      o.settings && typeof o.settings === "object"
        ? /** @type {import('@n8n/workflow-sdk').WorkflowSettings} */ (o.settings)
        : undefined,
    pinData:
      o.pinData && typeof o.pinData === "object"
        ? /** @type {import('@n8n/workflow-sdk').WorkflowJSON['pinData']} */ (o.pinData)
        : undefined,
    meta:
      o.meta && typeof o.meta === "object"
        ? /** @type {import('@n8n/workflow-sdk').WorkflowJSON['meta']} */ (o.meta)
        : undefined,
  };
}

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

/**
 * @param {import('@n8n/workflow-sdk').ValidationError} e
 */
function formatError(e) {
  const loc = [e.nodeName, e.parameterName].filter(Boolean).join(" / ");
  return loc ? `${e.code} (${loc}): ${e.message}` : `${e.code}: ${e.message}`;
}

/**
 * @param {import('@n8n/workflow-sdk').ValidationWarning} w
 */
function formatWarning(w) {
  const loc = [w.nodeName, w.parameterPath].filter(Boolean).join(" / ");
  return loc ? `${w.code} (${loc}): ${w.message}` : `${w.code}: ${w.message}`;
}

/**
 * @param {string} filePath
 * @param {{ emitSdk?: string }} opts
 */
function validateOne(filePath, opts) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    console.error(`Invalid JSON: ${abs}`);
    console.error(err);
    process.exitCode = 1;
    return false;
  }
  let wf;
  try {
    wf = toWorkflowJSON(raw);
  } catch (err) {
    console.error(`${abs}: ${/** @type {Error} */ (err).message}`);
    process.exitCode = 1;
    return false;
  }
  const result = validateWorkflow(wf);
  if (opts.emitSdk) {
    const outPath = path.isAbsolute(opts.emitSdk) ? opts.emitSdk : path.join(repoRoot, opts.emitSdk);
    const dir = path.dirname(outPath);
    fs.mkdirSync(dir, { recursive: true });
    const body = generateWorkflowCode(wf);
    const banner = `// Generated from ${path.relative(repoRoot, abs)} — do not edit by hand; re-run validate-workflow-json.mjs --emit-sdk\n`;
    fs.writeFileSync(outPath, banner + SDK_IMPORT + "\n" + body + "\n", "utf8");
    console.log(`Wrote SDK bundle: ${outPath}`);
  }
  if (!result.valid) {
    console.error(`${abs}: invalid (${result.errors.length} error(s))`);
    for (const e of result.errors) {
      console.error(`  - ${formatError(e)}`);
    }
    process.exitCode = 1;
    return false;
  }
  if (result.warnings.length > 0) {
    console.warn(`${abs}: valid with ${result.warnings.length} warning(s)`);
    for (const w of result.warnings) {
      console.warn(`  - ${formatWarning(w)}`);
    }
  } else {
    console.log(`${abs}: valid`);
  }
  return true;
}

function usage() {
  console.log(`Usage:
  node tools/validate-workflow-json.mjs <path-to-workflow.json>
  node tools/validate-workflow-json.mjs --all
  node tools/validate-workflow-json.mjs <path> --emit-sdk <output.mjs>

Examples:
  npm run validate:workflow -- workflows/wf01-email-dispatch/workflow.json
  npm run validate:workflows
`);
}

const argv = process.argv.slice(2);
const emitIdx = argv.indexOf("--emit-sdk");
let emitSdk;
if (emitIdx !== -1) {
  emitSdk = argv[emitIdx + 1];
  if (!emitSdk) {
    console.error("--emit-sdk requires a path");
    usage();
    process.exit(1);
  }
  argv.splice(emitIdx, 2);
}

if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
  usage();
  process.exit(argv.length === 0 ? 1 : 0);
}

if (argv[0] === "--all") {
  if (emitSdk) {
    console.error("--emit-sdk cannot be used with --all (pick one workflow file).");
    process.exit(1);
  }
  const files = findWorkflowJsonFiles(path.join(repoRoot, "workflows"));
  if (files.length === 0) {
    console.error("No workflow.json files found under workflows/");
    process.exit(1);
  }
  let ok = true;
  for (const f of files) {
    if (!validateOne(f, {})) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

const target = argv[0];
if (argv.length > 1) {
  console.error("Unexpected extra arguments (use --emit-sdk before --all or single file)");
  usage();
  process.exit(1);
}

const success = validateOne(target, { emitSdk });
process.exit(success ? 0 : 1);
