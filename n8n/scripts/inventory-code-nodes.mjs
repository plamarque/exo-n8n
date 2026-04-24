#!/usr/bin/env node
/**
 * Inventaire des nœuds Code dans les exports JSON n8n du dépôt.
 * Sortie : n8n/docs/inventory-code-nodes.json (+ stdout résumé)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.join(__dirname, "..", "workflows");
const outPath = path.join(__dirname, "..", "docs", "inventory-code-nodes.json");

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
  const files = fs.readdirSync(workflowsDir).filter((f) => {
    if (!f.endsWith(".json")) return false;
    if (f.startsWith(".")) return false;
    return true;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    workflowsDir,
    files: [],
    totals: {
      codeNodes: 0,
      linesOfCode: 0,
      chars: 0,
    },
  };

  for (const file of files.sort()) {
    const full = path.join(workflowsDir, file);
    let root;
    try {
      const raw = fs.readFileSync(full, "utf8");
      root = JSON.parse(raw);
    } catch (e) {
      report.files.push({ file, error: String(e.message || e) });
      continue;
    }

    const nodes = getNodes(root);
    const wName = workflowName(root, file);
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
      file,
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
