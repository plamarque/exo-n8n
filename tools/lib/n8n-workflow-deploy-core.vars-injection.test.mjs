/**
 * Regression tests for applyN8nPortfolioVarsFallbackOverrides (Node 18+).
 * Run: npm test
 */
import assert from "node:assert/strict";
import {
  applyExoMcpEndpointDeployOverride,
  applyN8nPortfolioVarsFallbackOverrides,
  applyPortfolioHardcodeFromEnv,
  escapeSingleQuotedJsStringLiteral,
} from "./n8n-workflow-deploy-core.mjs";

const KEYS = [
  "WF01_PROJECT_ID",
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

function testWf03MeetingOwner() {
  const nodes = [
    {
      parameters: {
        v: "={{ String($vars.WF03_MEETING_OWNER || 'Project team') }}",
      },
    },
  ];
  process.env.WF03_MEETING_OWNER = "Team O'Brien";
  applyN8nPortfolioVarsFallbackOverrides(nodes);
  assert.ok(nodes[0].parameters.v.includes("Team O\\'Brien"));
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
  testExoSpaceName();
  testWf03MeetingOwner();
  testWf02ApprovalUrl();
  testWf02ParentFolder();
  testExoMcpEndpointLiteral();
  testExoMcpEndpointInvalidSkips();
  testPortfolioHardcodeRemovesVars();
  console.log("n8n-workflow-deploy-core.vars-injection.test.mjs: OK");
} finally {
  restoreEnv(prev);
}
