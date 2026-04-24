#!/usr/bin/env node
/**
 * Télécharge le workflow aze2wAktXHYrTBTr depuis l’instance n8n (API v1) et
 * écrit n8n/workflows/wf04-mcp-workflow.json puis lance l’adaptation native (option --apply).
 * Variables: N8N_BASE_URL (ex. https://votre-instance.app.n8n.cloud), N8N_API_KEY
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const WF_ID = "aze2wAktXHYrTBTr";
const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;

if (!base || !key) {
  console.error("Définir N8N_BASE_URL et N8N_API_KEY (clé API n8n, pas OAuth MCP).");
  process.exit(1);
}

const url = `${base}/api/v1/workflows/${WF_ID}`;
const res = await fetch(url, { headers: { "X-N8N-API-KEY": key, accept: "application/json" } });
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
const body = await res.json();
const out = join(__dir, "../workflows/wf04-mcp-workflow.json");
mkdirSync(join(__dir, "../workflows"), { recursive: true });
writeFileSync(out, JSON.stringify(body, null, 2), "utf8");
console.log("Sauvegardé", out);
if (process.argv.includes("--apply")) {
  const child = spawn(process.execPath, [join(__dir, "wf04-apply-native-nodes.mjs"), out], { stdio: "inherit" });
  child.on("exit", (c) => process.exit(c || 0));
} else {
  console.log("Relancez: node n8n/scripts/wf04-apply-native-nodes.mjs");
}
