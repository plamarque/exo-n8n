#!/usr/bin/env node
/**
 * Lit le JSON d’appel get_workflow_details (contenu: { workflow: {...} } ou workflow seul)
 * et enregistre n8n/workflows/wf04-mcp-workflow.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const p = resolve(process.argv[2] || "");
if (!p) {
  console.error("Usage: node wf04-ingest-mcp-json.mjs <chemin/mcp-reponse.json>");
  process.exit(1);
}
const o = JSON.parse(readFileSync(p, "utf8"));
const w = o.workflow || o;
const out = join(__dir, "../workflows/wf04-mcp-workflow.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(w, null, 2), "utf8");
console.log("ok", out);
