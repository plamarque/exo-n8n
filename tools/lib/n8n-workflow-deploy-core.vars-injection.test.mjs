/**
 * Regression tests for applyN8nPortfolioVarsFallbackOverrides (Node 18+).
 * Run: npm test
 */
import assert from "node:assert/strict";
import {
  applyExoMcpEndpointDeployOverride,
  applyN8nPortfolioVarsFallbackOverrides,
  applyPortfolioHardcodeFromEnv,
  applyWf02CreateTaskProjectIdFromEnv,
  applyWf03PrepareSteeringConfigFromEnv,
  escapeSingleQuotedJsStringLiteral,
  WF02_CANONICAL_PARENT_FOLDER_ID,
  WF04_CANONICAL_EXO_SPACE_NAME_DEMO,
} from "./n8n-workflow-deploy-core.mjs";

const KEYS = [
  "WF01_PROJECT_ID",
  "WF04_SPACE_ID",
  "WF02_PROJECT_ID",
  "WF02_INPROGRESS_STATUS_ID",
  "WF02_DONE_STATUS_ID",
  "WF02_PARENT_FOLDER_ID",
  "WF02_APPROVAL_BASE_URL", // restore after tests (avoid leaking into other tooling)
  "WF03_SPACE_ID",
  "WF03_PROJECT_ID",
  "WF03_TEMPLATE_NOTE_ID",
  "WF03_REPORTS_PARENT_NOTE_ID",
  "WF03_AGENDA_PARENT_EVENT_ID",
  "WF03_ATTENDEE_USERNAMES",
  "WF03_MEETING_OWNER",
  "WF03_STAGNATION_DAYS",
  "WF03_BLOCKED_DAYS",
  "WF03_OVERLOAD_THRESHOLD",
  "EXO_SPACE_NAME",
];

function stashEnv() {
  /** @type {Record<string, string | undefined>} */
  const prev = {};
  for (const k of KEYS) {
    prev[k] = process.env[k];
    delete process.env[k];
  }
  return prev;
}

/** @param {Record<string, string | undefined>} prev */
function restoreEnv(prev) {
  for (const k of KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
}

function testEscapeSingleQuoted() {
  assert.equal(escapeSingleQuotedJsStringLiteral("a'b"), "a\\'b");
  assert.equal(escapeSingleQuotedJsStringLiteral("a\\b"), "a\\\\b");
}

function testIntegerAndCodeNode() {
  const nodes = [
    {
      parameters: {
        x: "={{ Number($vars.WF01_PROJECT_ID || 3) }}",
        jsCode:
          "return { project_id: Number($vars.WF02_PROJECT_ID || 2), ok: true };\n",
      },
    },
  ];
  process.env.WF01_PROJECT_ID = "99";
  process.env.WF02_PROJECT_ID = "7";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.match(nodes[0].parameters.x, /\|\|\s*99\b/);
  assert.match(nodes[0].parameters.jsCode, /\|\|\s*7\b/);
}

/** Legacy JSON-mode MCP payload: string rewrite still applies via {@link injectWf04ListDocumentsSpaceIdFromEnv}. */
function testWf04SpaceIdFallbackOverrideLegacyJsonInputString() {
  const nodes = [
    {
      parameters: {
        jsonInput: '={{ { "offset": 0, "query": " ", "limit": 500, "space_id": 1 } }}',
      },
    },
  ];
  process.env.WF04_SPACE_ID = "4242";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.jsonInput.includes('"space_id": 4242'));
}

function testWf04SpaceIdFallbackOverrideManualListDocuments() {
  const nodes = [
    {
      name: "List Documents",
      parameters: {
        tool: { value: "search_documents" },
        parameters: {
          value: {
            offset: 0,
            query: " ",
            limit: 500,
            space_id: 1,
          },
        },
      },
    },
  ];
  process.env.WF04_SPACE_ID = "4242";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.equal(nodes[0].parameters.parameters.value.space_id, 4242);
}

function testWf04SpaceIdHardcodeLegacyJsonInputString() {
  const prev = process.env.WF04_SPACE_ID;
  try {
    process.env.WF04_SPACE_ID = "99";
    const nodes = [
      {
        parameters: {
          jsonInput: '={{ { "offset": 0, "query": " ", "limit": 500, "space_id": 1 } }}',
        },
      },
    ];
    applyPortfolioHardcodeFromEnv(nodes);
    assert.ok(nodes[0].parameters.jsonInput.includes('"space_id": 99'));
    assert.ok(!nodes[0].parameters.jsonInput.includes("$vars"));
  } finally {
    if (prev === undefined) delete process.env.WF04_SPACE_ID;
    else process.env.WF04_SPACE_ID = prev;
  }
}

function testWf04SpaceIdHardcodeManualListDocuments() {
  const prev = process.env.WF04_SPACE_ID;
  try {
    process.env.WF04_SPACE_ID = "99";
    const nodes = [
      {
        name: "List Documents",
        parameters: {
          tool: { value: "search_documents" },
          parameters: {
            value: {
              offset: 0,
              query: " ",
              limit: 500,
              space_id: 1,
            },
          },
        },
      },
    ];
    applyPortfolioHardcodeFromEnv(nodes);
    assert.equal(nodes[0].parameters.parameters.value.space_id, 99);
  } finally {
    if (prev === undefined) delete process.env.WF04_SPACE_ID;
    else process.env.WF04_SPACE_ID = prev;
  }
}

function testExoSpaceName() {
  const nodes = [
    {
      parameters: {
        v: '={{ $vars.EXO_SPACE_NAME || "Festival Art2Rue - Documents" }}',
      },
    },
  ];
  process.env.EXO_SPACE_NAME = 'Other " quoted';
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.v.includes('Other \\" quoted'));
}

function testExoSpaceNameWf04LiteralInject() {
  const nodes = [
    {
      parameters: {
        v: `={{ "${WF04_CANONICAL_EXO_SPACE_NAME_DEMO}" }}`,
      },
    },
  ];
  process.env.EXO_SPACE_NAME = "Tenant display name";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.v.includes("Tenant display name"));
  applyPortfolioHardcodeFromEnv(nodes);
  assert.ok(nodes[0].parameters.v.includes("Tenant display name"));
  assert.ok(!nodes[0].parameters.v.includes("$vars"));
}

/** Canonical WF03 `Prepare Steering Config` Set node fixture (didactic slice, no `$vars`). */
function buildWf03PrepareSteeringConfigNode() {
  return {
    name: "Prepare Steering Config",
    type: "n8n-nodes-base.set",
    parameters: {
      assignments: {
        assignments: [
          { id: "f695bdae", name: "space_id", value: 1, type: "number" },
          { id: "6f7850f6", name: "project_id", value: 3, type: "number" },
          { id: "6a5fd473", name: "template_note_id", value: 25, type: "number" },
          { id: "bd9dc430", name: "reports_parent_note_id", value: 6, type: "number" },
          { id: "ccdc8611", name: "agenda_parent_event_id", value: 13, type: "number" },
          { id: "0d5f6a25", name: "meeting_owner", value: "Project team", type: "string" },
          {
            id: "b8d348f1",
            name: "attendee_usernames",
            value: "={{ ['claire', 'etienne', 'louis', 'nadia', 'antoine', 'emma'] }}",
            type: "array",
          },
          { id: "a65e3459", name: "stagnation_days", value: 3, type: "number" },
          { id: "313d3a07", name: "blocked_days", value: 5, type: "number" },
          { id: "d25d464f", name: "overload_threshold", value: 5, type: "number" },
        ],
      },
    },
  };
}

function testWf03PrepareSteeringConfigIntegerOverrides() {
  const nodes = [buildWf03PrepareSteeringConfigNode()];
  process.env.WF03_SPACE_ID = "42";
  process.env.WF03_PROJECT_ID = "99";
  process.env.WF03_TEMPLATE_NOTE_ID = "111";
  process.env.WF03_REPORTS_PARENT_NOTE_ID = "222";
  process.env.WF03_AGENDA_PARENT_EVENT_ID = "333";
  process.env.WF03_STAGNATION_DAYS = "7";
  process.env.WF03_BLOCKED_DAYS = "9";
  process.env.WF03_OVERLOAD_THRESHOLD = "11";
  const touched = applyWf03PrepareSteeringConfigFromEnv(nodes);
  assert.equal(touched, 1);
  const a = nodes[0].parameters.assignments.assignments;
  assert.equal(a.find((x) => x.name === "space_id").value, 42);
  assert.equal(a.find((x) => x.name === "project_id").value, 99);
  assert.equal(a.find((x) => x.name === "template_note_id").value, 111);
  assert.equal(a.find((x) => x.name === "reports_parent_note_id").value, 222);
  assert.equal(a.find((x) => x.name === "agenda_parent_event_id").value, 333);
  assert.equal(a.find((x) => x.name === "stagnation_days").value, 7);
  assert.equal(a.find((x) => x.name === "blocked_days").value, 9);
  assert.equal(a.find((x) => x.name === "overload_threshold").value, 11);
}

function testWf03PrepareSteeringConfigMeetingOwnerAndAttendees() {
  const nodes = [buildWf03PrepareSteeringConfigNode()];
  process.env.WF03_MEETING_OWNER = "Team O'Brien";
  process.env.WF03_ATTENDEE_USERNAMES = "alice, bob ,carol";
  applyWf03PrepareSteeringConfigFromEnv(nodes);
  const a = nodes[0].parameters.assignments.assignments;
  assert.equal(a.find((x) => x.name === "meeting_owner").value, "Team O'Brien");
  assert.equal(
    a.find((x) => x.name === "attendee_usernames").value,
    "={{ ['alice', 'bob', 'carol'] }}",
  );
}

function testWf03PrepareSteeringConfigInvalidIntegerSkips() {
  const nodes = [buildWf03PrepareSteeringConfigNode()];
  process.env.WF03_PROJECT_ID = "not-a-number";
  applyWf03PrepareSteeringConfigFromEnv(nodes);
  assert.equal(
    nodes[0].parameters.assignments.assignments.find((x) => x.name === "project_id").value,
    3,
  );
}

function testWf03PrepareSteeringConfigSkipsForeignNode() {
  const nodes = [
    {
      name: "Some Other Set",
      type: "n8n-nodes-base.set",
      parameters: {
        assignments: {
          assignments: [{ name: "space_id", value: 0, type: "number" }],
        },
      },
    },
  ];
  process.env.WF03_SPACE_ID = "7";
  const touched = applyWf03PrepareSteeringConfigFromEnv(nodes);
  assert.equal(touched, 0);
  assert.equal(nodes[0].parameters.assignments.assignments[0].value, 0);
}

function testWf03PrepareSteeringConfigPipelineCallsThroughFallback() {
  const nodes = [buildWf03PrepareSteeringConfigNode()];
  process.env.WF03_SPACE_ID = "55";
  process.env.WF03_MEETING_OWNER = "Festival ops";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  const a = nodes[0].parameters.assignments.assignments;
  assert.equal(a.find((x) => x.name === "space_id").value, 55);
  assert.equal(a.find((x) => x.name === "meeting_owner").value, "Festival ops");
}

function testWf03PrepareSteeringConfigPipelineCallsThroughHardcode() {
  const nodes = [buildWf03PrepareSteeringConfigNode()];
  process.env.WF03_AGENDA_PARENT_EVENT_ID = "999";
  process.env.WF03_ATTENDEE_USERNAMES = "x,y";
  applyPortfolioHardcodeFromEnv(nodes);
  const a = nodes[0].parameters.assignments.assignments;
  assert.equal(a.find((x) => x.name === "agenda_parent_event_id").value, 999);
  assert.equal(
    a.find((x) => x.name === "attendee_usernames").value,
    "={{ ['x', 'y'] }}",
  );
  const serialized = JSON.stringify(nodes[0]);
  assert.ok(!serialized.includes("$vars"));
}

function testWf02ApprovalUrl() {
  const nodes = [
    {
      parameters: {
        j: '={{ String($vars.WF02_APPROVAL_BASE_URL || "https://meeds.app.n8n.cloud/form/wf02-doc-validation/approve") }}',
      },
    },
  ];
  process.env.WF02_APPROVAL_BASE_URL = "https://tenant.app.n8n.cloud/form/wf02-doc-validation/approve";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.j.includes("https://tenant.app.n8n.cloud"));
}

function testWf02ParentFolder() {
  const nodes = [
    {
      parameters: {
        j: '={{ { parent_folder_id: (($vars.WF02_PARENT_FOLDER_ID && String($vars.WF02_PARENT_FOLDER_ID).trim()) || "ced6e9c539805e114bd65696b26bd073") } }}',
      },
    },
  ];
  process.env.WF02_PARENT_FOLDER_ID = "aaaabbbbccccddddeeeeffff00001111";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.j.includes("aaaabbbbccccddddeeeeffff00001111"));
}

function testWf02ParentFolderManualMcpValue() {
  const nodes = [
    {
      parameters: {
        value: { parent_folder_id: WF02_CANONICAL_PARENT_FOLDER_ID },
      },
    },
  ];
  process.env.WF02_PARENT_FOLDER_ID = "aaaabbbbccccddddeeeeffff00001111";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.equal(
    nodes[0].parameters.value.parent_folder_id,
    "aaaabbbbccccddddeeeeffff00001111",
  );
  applyPortfolioHardcodeFromEnv(nodes);
  assert.equal(
    nodes[0].parameters.value.parent_folder_id,
    "aaaabbbbccccddddeeeeffff00001111",
  );
}

function testExoMcpEndpointLiteral() {
  const prev = process.env.EXO_MCP_ENDPOINT;
  const tenantUrl = "https://tenant.example.com/mcp-server/mcp";
  try {
    process.env.EXO_MCP_ENDPOINT = tenantUrl;
    const nodes = [
      {
        type: "@n8n/n8n-nodes-langchain.mcpClient",
        parameters: {
          endpointUrl:
            '={{$vars.EXO_MCP_ENDPOINT || "https://exo.example.com/mcp-server/mcp"}}',
        },
      },
    ];
    const n = applyExoMcpEndpointDeployOverride(nodes);
    assert.equal(n, 1);
    assert.equal(nodes[0].parameters.endpointUrl, tenantUrl);
    assert.ok(!String(nodes[0].parameters.endpointUrl).includes("$vars"));
  } finally {
    if (prev === undefined) delete process.env.EXO_MCP_ENDPOINT;
    else process.env.EXO_MCP_ENDPOINT = prev;
  }
}

function testExoMcpEndpointInvalidSkips() {
  const prev = process.env.EXO_MCP_ENDPOINT;
  try {
    process.env.EXO_MCP_ENDPOINT = "ftp://wrong";
    const original =
      '={{$vars.EXO_MCP_ENDPOINT || "https://exo.example.com/mcp-server/mcp"}}';
    const nodes = [
      {
        type: "@n8n/n8n-nodes-langchain.mcpClient",
        parameters: { endpointUrl: original },
      },
    ];
    const n = applyExoMcpEndpointDeployOverride(nodes);
    assert.equal(n, 0);
    assert.equal(nodes[0].parameters.endpointUrl, original);
  } finally {
    if (prev === undefined) delete process.env.EXO_MCP_ENDPOINT;
    else process.env.EXO_MCP_ENDPOINT = prev;
  }
}

function testWf02CreateTaskProjectIdOnlyWf02Node() {
  const nodes = [
    {
      name: "MCP Create Task",
      parameters: {
        tool: { value: "create_task_in_project" },
        parameters: {
          value: {
            project_id: 2,
            title:
              "={{ ('Validation - ' + $('Merge Docs to Process').item.json.name).slice(0, 12) }}",
          },
        },
      },
    },
    {
      name: "MCP Create Task",
      parameters: {
        tool: { value: "create_task_in_project" },
        parameters: {
          value: {
            project_id: 3,
            title: "={{ $('AI Router').item.json.output.task_title }}",
          },
        },
      },
    },
  ];
  process.env.WF02_PROJECT_ID = "9";
  applyWf02CreateTaskProjectIdFromEnv(nodes);
  assert.equal(nodes[0].parameters.parameters.value.project_id, 9);
  assert.equal(nodes[1].parameters.parameters.value.project_id, 3);
}

function testPortfolioHardcodeRemovesVars() {
  const prevP = process.env.WF01_PROJECT_ID;
  const prevS = process.env.EXO_SPACE_NAME;
  try {
    process.env.WF01_PROJECT_ID = "42";
    process.env.EXO_SPACE_NAME = "Tenant Space";
    const nodes = [
      {
        parameters: {
          a: "={{ Number($vars.WF01_PROJECT_ID || 3) }}",
          b: '={{ $vars.EXO_SPACE_NAME || "demo" }}',
        },
      },
    ];
    applyPortfolioHardcodeFromEnv(nodes);
    assert.match(nodes[0].parameters.a, /Number\(42\)/);
    assert.ok(!nodes[0].parameters.a.includes("$vars"));
    assert.ok(nodes[0].parameters.b.includes("Tenant Space"));
    assert.ok(!nodes[0].parameters.b.includes("$vars"));
  } finally {
    if (prevP === undefined) delete process.env.WF01_PROJECT_ID;
    else process.env.WF01_PROJECT_ID = prevP;
    if (prevS === undefined) delete process.env.EXO_SPACE_NAME;
    else process.env.EXO_SPACE_NAME = prevS;
  }
}

const prev = stashEnv();
try {
  testEscapeSingleQuoted();
  testIntegerAndCodeNode();
  testWf04SpaceIdFallbackOverrideLegacyJsonInputString();
  testWf04SpaceIdFallbackOverrideManualListDocuments();
  testWf04SpaceIdHardcodeLegacyJsonInputString();
  testWf04SpaceIdHardcodeManualListDocuments();
  testExoSpaceName();
  testExoSpaceNameWf04LiteralInject();
  testWf03PrepareSteeringConfigIntegerOverrides();
  testWf03PrepareSteeringConfigMeetingOwnerAndAttendees();
  testWf03PrepareSteeringConfigInvalidIntegerSkips();
  testWf03PrepareSteeringConfigSkipsForeignNode();
  testWf03PrepareSteeringConfigPipelineCallsThroughFallback();
  testWf03PrepareSteeringConfigPipelineCallsThroughHardcode();
  testWf02ApprovalUrl();
  testWf02ParentFolder();
  testWf02ParentFolderManualMcpValue();
  testExoMcpEndpointLiteral();
  testExoMcpEndpointInvalidSkips();
  testWf02CreateTaskProjectIdOnlyWf02Node();
  testPortfolioHardcodeRemovesVars();
  console.log("n8n-workflow-deploy-core.vars-injection.test.mjs: OK");
} finally {
  restoreEnv(prev);
}
