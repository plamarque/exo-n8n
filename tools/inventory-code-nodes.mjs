#!/usr/bin/env node
/**
 * Inventaire des nœuds Code dans les exports JSON n8n du dépôt.
 * Sortie : docs/inventory-code-nodes.json (+ stdout résumé)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const workflowsDir = path.join(repoRoot, "workflows");
const outPath = path.join(repoRoot, "docs", "inventory-code-nodes.json");

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

function getNodes(root) {
  if (Array.isArray(root?.nodes)) return root.nodes;
  if (Array.isArray(root?.workflow?.nodes)) return root.workflow.nodes;
  return [];
}

function workflowName(root, file) {
  return root?.name || root?.workflow?.name || file;
}

function analyzeJs(js) {
  if (!js || typeof js !== "string") {
    return {
      linesOfCode: 0,
      chars: 0,
      hasParseEnvelope: false,
      hasGetWorkflowStaticData: false,
      hasHtml: false,
      hasMcpContentText: false,
    };
  }
  const lines = js.split(/\r?\n/).length;
  const hasParseEnvelope =
    /parseMaybeEnvelope|parseMcp|function\s+parseMcp/i.test(js);
  const hasGetWorkflowStaticData =
    /\$getWorkflowStaticData|getWorkflowStaticData\s*\(/.test(js);
  const hasHtml = /<\/(table|tr|td|p|h[12])>/i.test(js) || /\.replaceAll\s*\(\s*['"]<h2/i.test(js);
  const hasMcpContentText = /\.content\s*\[\s*0\s*\]\s*\.\s*text|content\?\.\[0\]\?\.text/.test(js);
  return {
    linesOfCode: lines,
    chars: js.length,
    hasParseEnvelope,
    hasGetWorkflowStaticData,
    hasHtml,
    hasMcpContentText,
  };
}

function main() {
  const filePaths = findWorkflowJsonFiles(workflowsDir);

  const report = {
    generatedAt: new Date().toISOString(),
    workflowsDir: path.relative(repoRoot, workflowsDir) + path.sep,
    files: [],
    totals: {
      codeNodes: 0,
      linesOfCode: 0,
      chars: 0,
    },
  };

  for (const full of filePaths) {
    const rel = path.relative(repoRoot, full);
    let root;
    try {
      const raw = fs.readFileSync(full, "utf8");
      root = JSON.parse(raw);
    } catch (e) {
      report.files.push({ file: rel, error: String(e.message || e) });
      continue;
    }

    const nodes = getNodes(root);
    const wName = workflowName(root, rel);
    const codeNodes = [];

    for (const node of nodes) {
      if (node?.type !== "n8n-nodes-base.code") continue;
      const js = node.parameters?.jsCode ?? "";
      const flags = analyzeJs(js);
      report.totals.codeNodes += 1;
      report.totals.linesOfCode += flags.linesOfCode;
      report.totals.chars += flags.chars;

      const hasJsCode = Boolean(js && js.trim());
      codeNodes.push({
        name: node.name,
        id: node.id,
        mode: node.parameters?.mode ?? null,
        typeVersion: node.typeVersion,
        ...flags,
        hasJsCode,
        missingJsCodeInRepo: !hasJsCode,
      });
    }

    report.files.push({
      file: rel,
      workflowName: wName,
      codeNodeCount: codeNodes.length,
      codeNodes,
    });
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report.totals, null, 2));
  console.log("Written:", outPath);
}

main();
