#!/usr/bin/env node
/** Lit stdin (UTF-8) et écrit vers le 1er argument, puis JSON.parse. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("Usage: node stdin-to-file.mjs <fichier-sortie>");
  process.exit(1);
}
const s = readFileSync(0, "utf8").trim();
writeFileSync(out, s, "utf8");
JSON.parse(s);
console.log("ok", out, "len", s.length, "bytes", Buffer.byteLength(s, "utf8"));
