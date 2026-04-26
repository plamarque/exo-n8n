#!/usr/bin/env node
/**
 * Push workflows/wf04-document-enrichment-ai/workflow.json
 * to n8n (API v1) — PUT /workflows/:id
 * Uses the same N8N_BASE_URL / N8N_API_KEY as wf04-from-n8n-api.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const base = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
const key = process.env.N8N_API_KEY;
const p = join(__dir, "../workflows/wf04-document-enrichment-ai/workflow.json");
const WF_ID = "aze2wAktXHYrTBTr";

if (!base || !key) {
  console.error("Set N8N_BASE_URL and N8N_API_KEY");
  process.exit(1);
}

const local = JSON.parse(readFileSync(p, "utf8"));
// Body shape n8n expects (name + nodes + connections + settings, etc.)
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
console.log("Workflow updated", saved.id, saved.name, saved.updatedAt);
