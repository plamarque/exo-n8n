#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const p = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "../workflows/mcp-wf04-response.json");
const raw = readFileSync(p, "utf8");
const o = JSON.parse(raw);
const w = o.workflow || o;
const out = join(dirname(fileURLToPath(import.meta.url)), "../workflows/wf04-mcp-workflow.json");
writeFileSync(out, JSON.stringify(w, null, 2), "utf8");
console.log("OK", out);
