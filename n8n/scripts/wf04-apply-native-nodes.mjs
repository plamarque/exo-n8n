#!/usr/bin/env node
/**
 * Adapte WF04 (eXo Document Enrichment) : moins de Code, plus de nœuds natifs.
 * Entrée: n8n/workflows/wf04-mcp-workflow.json (téléversé via MCP get_workflow_details, branche { workflow } ou l’objet seul)
 * Sorties: workflow-04-document-enrichment-ai.import.json, workflow-04-document-enrichment-ai.export.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const defIn = join(__dir, "../workflows/wf04-mcp-workflow.json");
const outDir = join(__dir, "../workflows");

const IDS = {
  ifSpace: "a0e1d2c3-0001-4000-8000-000000000001",
  stopNoSpace: "a0e1d2c3-0001-4000-8000-000000000002",
  ifResolved: "a0e1d2c3-0001-4000-8000-000000000003",
  stopNoSpace2: "a0e1d2c3-0001-4000-8000-000000000004",
  split: "a0e1d2c3-0001-4000-8000-000000000005",
  flt: "a0e1d2c3-0001-4000-8000-000000000006",
  ifDesc: "a0e1d2c3-0001-4000-8000-000000000007",
  stopDesc: "a0e1d2c3-0001-4000-8000-000000000008",
  ifAssign: "a0e1d2c3-0001-4000-8000-000000000009",
  stopAssign: "a0e1d2c3-0001-4000-8000-00000000000a",
  noop: "a0e1d2c3-0001-4000-8000-00000000000b",
  mergeDocs: "a0e1d2c3-0001-4000-8000-00000000000c",
  resolveSet: "5c947c06-0ce0-4d18-bd9f-48c8cda2abf4",
  normalizeSet: "ba3cfbdd-faad-402c-9613-79a487e7ee03",
  checkDescSet: "3effc3d8-c248-43b4-b80d-fda3b2b1cdbb",
};

const inputPath = process.argv[2] || defIn;
let w;
try {
  const j = JSON.parse(readFileSync(inputPath, "utf8"));
  w = j.workflow || j;
} catch (e) {
  console.error("Fichier introuvable ou JSON invalide:", inputPath, e.message);
  process.exit(1);
}
if (!w?.nodes) process.exit(1);

// Nettoyage re-runs : retirer les nœuds générés la fois précédente
const removeNames = new Set([
  "Validate Input",
  "IF Space Name",
  "Stop - Missing spaceName",
  "IF Space Resolved",
  "Stop - Space not found",
  "Split Out Documents",
  "Filter - Has document_id",
  "Filter Documents to Process",
  "Merge Documents to Process",
  "IF Description MCP OK",
  "Stop - Description update failed",
  "IF Assign MCP OK",
  "Stop - Category assign failed",
  "Check Assign Result",
]);
w.nodes = w.nodes.filter((n) => !removeNames.has(n.name));

w.nodes.push(
  {
    id: IDS.ifSpace,
    name: "IF Space Name",
    type: "n8n-nodes-base.if",
    typeVersion: 2.3,
    position: [620, 464],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
        conditions: [
          {
            id: "s0",
            leftValue: "={{ String($json.spaceName || '').trim() }}",
            rightValue: "",
            operator: { type: "string", operation: "notEmpty" },
          },
        ],
        combinator: "and",
      },
    },
  },
  {
    id: IDS.stopNoSpace,
    name: "Stop - Missing spaceName",
    type: "n8n-nodes-base.stopAndError",
    typeVersion: 1,
    position: [640, 280],
    parameters: { errorType: "errorMessage", errorMessage: "Missing required workflow input: 'spaceName'" },
  }
);

// Resolve Space : Set
const r = w.nodes.find((n) => n.id === IDS.resolveSet);
if (r) {
  r.type = "n8n-nodes-base.set";
  r.typeVersion = 3.4;
  r.name = "Resolve Space";
  r.position = [1240, 464];
  r.parameters = {
    assignments: {
      assignments: [
        { id: "1", name: "spaceName", value: "={{ String($('Workflow Input').item.json.spaceName || '').trim() }}", type: "string" },
        {
          id: "2",
          name: "spaceId",
          value:
            "={{ ($json.content?.[0]?.text || []).find((s) => s.name === String($('Workflow Input').item.json.spaceName || '').trim())?.space_id }}",
          type: "number",
        },
      ],
    },
    options: {},
  };
}
w.nodes.push(
  {
    id: IDS.ifResolved,
    name: "IF Space Resolved",
    type: "n8n-nodes-base.if",
    typeVersion: 2.3,
    position: [1420, 464],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
        conditions: [
          {
            id: "k0",
            leftValue: "={{ $json.spaceId != null && $json.spaceId !== \"\" && !Number.isNaN(Number($json.spaceId)) }}",
            rightValue: true,
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
    },
  },
  {
    id: IDS.stopNoSpace2,
    name: "Stop - Space not found",
    type: "n8n-nodes-base.stopAndError",
    typeVersion: 1,
    position: [1440, 300],
    parameters: {
      errorType: "errorMessage",
      errorMessage: "Espace eXo introuvable (aucun espace de ce nom pour l’utilisateur).",
    },
  }
);

// Normaliser : remplacer Code par Split + Filter + Set
const nrm = w.nodes.find((n) => n.id === IDS.normalizeSet);
const nrmPos = nrm?.position || [1940, 464];
w.nodes = w.nodes.filter((n) => n.id !== IDS.normalizeSet);
w.nodes.push(
  { id: IDS.split, name: "Split Out Documents", type: "n8n-nodes-base.splitOut", typeVersion: 1, position: [1700, 464], parameters: { fieldToSplitOut: "content[0].text", include: "noOtherFields", options: {} } },
  {
    id: IDS.flt,
    name: "Filter - Has document_id",
    type: "n8n-nodes-base.filter",
    typeVersion: 2.3,
    position: [1800, 464],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
        conditions: [
          { id: "d0", leftValue: "={{ String($json.document_id || '') }}", rightValue: "", operator: { type: "string", operation: "notEmpty" } },
        ],
        combinator: "and",
      },
    },
  }
);
w.nodes.push({
  name: "Normalize Documents",
  id: IDS.normalizeSet,
  type: "n8n-nodes-base.set",
  typeVersion: 3.4,
  position: nrmPos,
  parameters: {
    assignments: {
      assignments: [
        { id: "1", name: "id", value: "={{ String($json.document_id) }}", type: "string" },
        { id: "2", name: "updatedDate", value: "={{ $json.updated_date }}", type: "string" },
        { id: "3", name: "description", value: "={{ $json.description ?? '' }}", type: "string" },
      ],
    },
    options: {},
  },
});

const getProcessed = w.nodes.find((n) => n.name === "Get Processed For Doc");
if (getProcessed) {
  getProcessed.parameters = {
    operation: "get",
    dataTableId: { __rl: true, mode: "name", value: "exo_processed_documents" },
    returnAll: true,
  };
  getProcessed.executeOnce = true;
  getProcessed.alwaysOutputData = true;
  getProcessed.onError = "continueRegularOutput";
}
w.nodes.push({
  id: IDS.mergeDocs,
  name: "Merge Documents to Process",
  type: "n8n-nodes-base.merge",
  typeVersion: 3.2,
  position: [2256, 464],
  parameters: {
    mode: "combineBySql",
    numberInputs: 2,
    query:
      "SELECT input1.id, input1.updatedDate, input1.description\n" +
      "FROM input1\n" +
      "LEFT JOIN input2 ON input1.id = input2.documentId\n" +
      "WHERE input2.documentId IS NULL\n" +
      "   OR input2.lastProcessedDate IS NULL\n" +
      "   OR input2.lastProcessedDate = ''\n" +
      "   OR input1.updatedDate > input2.lastProcessedDate",
    options: { emptyQueryResult: "empty" },
  },
});

// Check description : remplacer Code par IF + Set
w.nodes = w.nodes.filter((n) => n.id !== IDS.checkDescSet);
w.nodes.push(
  { id: IDS.ifDesc, name: "IF Description MCP OK", type: "n8n-nodes-base.if", typeVersion: 2.3, position: [4180, 464], parameters: ifBool("={{ !String($json.content?.[0]?.text ?? '').toLowerCase().includes('exception') }}") },
  { id: IDS.stopDesc, name: "Stop - Description update failed", type: "n8n-nodes-base.stopAndError", typeVersion: 1, position: [4200, 300], parameters: { errorType: "errorMessage", errorMessage: "MCP update_document_description: réponse d’échec." } },
  {
    id: IDS.checkDescSet,
    name: "Check Description Result",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [4420, 464],
    parameters: {
      assignments: {
        assignments: [
          { id: "1", name: "documentId", value: "={{ $('Extract Results').item.json.documentId }}", type: "string" },
          { id: "2", name: "description", value: "={{ $('Extract Results').item.json.description }}", type: "string" },
          { id: "3", name: "suggestedCategories", value: "={{ $('Extract Results').item.json.suggestedCategories }}", type: "array" },
          { id: "4", name: "updatedDate", value: "={{ $('Extract Results').item.json.updatedDate }}", type: "string" },
          { id: "5", name: "spaceName", value: "={{ $('Extract Results').item.json.spaceName }}", type: "string" },
          { id: "6", name: "documentName", value: "={{ $('Extract Results').item.json.documentName }}", type: "string" },
          { id: "7", name: "documentUrl", value: "={{ $('Extract Results').item.json.documentUrl }}", type: "string" },
          { id: "8", name: "editorUrl", value: "={{ $('Extract Results').item.json.editorUrl }}", type: "string" },
        ],
      },
      options: {},
    },
  }
);

// Check assign
w.nodes = w.nodes.filter((n) => n.name !== "Check Assign Result");
w.nodes.push(
  { id: IDS.ifAssign, name: "IF Assign MCP OK", type: "n8n-nodes-base.if", typeVersion: 2.3, position: [4860, 464], parameters: ifBool("={{ !String($json.content?.[0]?.text ?? '').toLowerCase().includes('exception') }}") },
  { id: IDS.stopAssign, name: "Stop - Category assign failed", type: "n8n-nodes-base.stopAndError", typeVersion: 1, position: [4880, 300], parameters: { errorType: "errorMessage", errorMessage: "MCP add_content_to_category: échec." } },
  { id: "96682082-a20e-46cd-b8cd-302af3c077fb", name: "Check Assign Result", type: "n8n-nodes-base.noOp", typeVersion: 1, position: [5080, 464], parameters: {} }
);

w.connections = build();

mkdirSync(outDir, { recursive: true });
const imp = { name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings || { executionOrder: "v1" }, meta: w.meta, staticData: w.staticData, pinData: w.pinData };
const exp = { source: "wf04-apply-native-nodes.mjs", exportedAt: new Date().toISOString(), workflow: w, note: "Moins de Code. Reste: Prepare Category (récursion catégories)." };
writeFileSync(join(outDir, "workflow-04-document-enrichment-ai.import.json"), JSON.stringify(imp, null, 2), "utf8");
writeFileSync(join(outDir, "workflow-04-document-enrichment-ai.export.json"), JSON.stringify(exp, null, 2), "utf8");
console.log("OK", join(outDir, "workflow-04-document-enrichment-ai.import.json"), "nœuds=", w.nodes.length);

function ifBool(left) {
  return {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
      conditions: [{ id: "b0", leftValue: left, rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } }],
      combinator: "and",
    },
  };
}
function m(to) {
  return { main: [[{ node: to, type: "main", index: 0 }]] };
}
function m2(t, f) {
  return { main: [[{ node: t, type: "main", index: 0 }], [{ node: f, type: "main", index: 0 }]] };
}
function build() {
  return {
    "Manual Start": m("Workflow Input"),
    "Daily Schedule": m("Workflow Input"),
    "Workflow Input": m("IF Space Name"),
    "IF Space Name": m2("Ensure Tracking Table", "Stop - Missing spaceName"),
    "Ensure Tracking Table": m("Get Spaces"),
    "Get Spaces": m("Resolve Space"),
    "Resolve Space": m("IF Space Resolved"),
    "IF Space Resolved": m2("List Documents", "Stop - Space not found"),
    "List Documents": m("Split Out Documents"),
    "Split Out Documents": m("Filter - Has document_id"),
    "Filter - Has document_id": m("Normalize Documents"),
    "Normalize Documents": { main: [[{ node: "Get Processed For Doc", type: "main", index: 0 }, { node: "Merge Documents to Process", type: "main", index: 0 }]] },
    "Get Processed For Doc": { main: [[{ node: "Merge Documents to Process", type: "main", index: 1 }]] },
    "Merge Documents to Process": m("Limit to 5 Documents"),
    "Limit to 5 Documents": m("Process Each Document"),
    "Read Document Content": m("List Categories"),
    "List Categories": m("Prepare AI Input"),
    "Prepare AI Input": m("Analyze Document"),
    "Analyze Document": m("Extract Results"),
    "Extract Results": m("Add Description"),
    "Add Description": m("IF Description MCP OK"),
    "IF Description MCP OK": m2("Check Description Result", "Stop - Description update failed"),
    "Check Description Result": m("Prepare Category Assignments"),
    "Prepare Category Assignments": m("Assign Categories"),
    "Assign Categories": m("IF Assign MCP OK"),
    "IF Assign MCP OK": m2("Check Assign Result", "Stop - Category assign failed"),
    "Check Assign Result": m("Update Tracking"),
    "Update Tracking": m("Process Each Document"),
    "Process Each Document": { main: [[{ node: "Processing Summary", type: "main", index: 0 }], [{ node: "Read Document Content", type: "main", index: 0 }]] },
    "GPT-4o Mini Model": { ai_languageModel: [[{ node: "Analyze Document", type: "ai_languageModel", index: 0 }]] },
    "Structured Output": { ai_outputParser: [[{ node: "Analyze Document", type: "ai_outputParser", index: 0 }]] },
  };
}
