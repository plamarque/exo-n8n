#!/usr/bin/env node
/**
 * Pousse n8n/workflows/workflow-04-document-enrichment-ai.import.json
 * vers n8n (API v1) — PUT /workflows/:id
 * Même N8N_BASE_URL / N8N_API_KEY que wf04-from-n8n-api.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;
const p = join(__dir, "../workflows/workflow-04-document-enrichment-ai.import.json");
const WF_ID = "aze2wAktXHYrTBTr";

if (!base || !key) {
  console.error("Définir N8N_BASE_URL et N8N_API_KEY");
  process.exit(1);
}

const local = JSON.parse(readFileSync(p, "utf8"));
// Corps attendu par n8n (nom + nodes + connections + settings, etc.)
const payload = { ...local, id: WF_ID };
if (!payload.id) payload.id = WF_ID;

const res = await fetch(`${base}/api/v1/workflows/${WF_ID}`, {
  method: "PUT",
  headers: { "X-N8N-API-KEY": key, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
const saved = await res.json();
console.log("Workflow mis à jour", saved.id, saved.name, saved.updatedAt);
