#!/usr/bin/env node
/**
 * Copiez-collez le résultat de get_workflow_details (MCP) dans stdin,
 * ou passez le chemin d'un fichier contenant l'objet { workflow: {...} }.
 * Produit: n8n/workflows/wf04-mcp-workflow.json (seulement la clé workflow).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "../workflows");
const out = join(outDir, "wf04-mcp-workflow.json");

const raw = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : readFileSync(0, "utf8");
mkdirSync(outDir, { recursive: true });
const o = JSON.parse(raw);
const w = o.workflow || o;
writeFileSync(out, JSON.stringify(w, null, 2), "utf8");
console.log("Written", out, "bytes", readFileSync(out, "utf8").length);
