#!/usr/bin/env node
/**
 * Fusionne n8n/workflows/mcp-frag-0.txt + mcp-frag-1.txt
 * (sortie get_workflow_details, une ligne) → mcp-wf04-response.json, puis
 * n8n/scripts/wf04-ingest-mcp-json.mjs et optionnellement wf04-apply-native-nodes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const wdir = join(__dir, "../workflows");
const a = readFileSync(join(wdir, "mcp-frag-0.txt"), "utf8");
const b = readFileSync(join(wdir, "mcp-frag-1.txt"), "utf8");
const raw = a + b;
JSON.parse(raw);
const out = join(wdir, "mcp-wf04-response.json");
writeFileSync(out, raw, "utf8");
console.log("ok", out, "bytes", Buffer.byteLength(raw, "utf8"));
const ingest = spawnSync(process.execPath, [join(__dir, "wf04-ingest-mcp-json.mjs"), out], { stdio: "inherit" });
if (ingest.status) process.exit(ingest.status);
if (process.argv.includes("--apply")) {
  const p = join(__dir, "wf04-apply-native-nodes.mjs");
  const a2 = spawnSync(process.execPath, [p, join(wdir, "wf04-mcp-workflow.json")], { stdio: "inherit" });
  process.exit(a2.status || 0);
}
