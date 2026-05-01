import { workflow, node, trigger } from '@n8n/workflow-sdk';

const whenExecuted = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1,
  config: {
    name: 'When Executed by Another Workflow',
    parameters: {},
    position: [220, 260],
  },
  output: [{}],
});

const unwrapPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Unwrap Payload',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: "let payload = $json;\nif (payload?.content?.[0]?.text !== undefined) payload = payload.content[0].text;\nif (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0]?.text === 'string') payload = payload[0].text;\nif (typeof payload === 'string') {\n  try {\n    payload = JSON.parse(payload);\n  } catch {\n    payload = {};\n  }\n}\nif (Array.isArray(payload) && payload.length === 1 && payload[0]?.type === 'text' && typeof payload[0]?.text === 'string') {\n  try {\n    payload = JSON.parse(payload[0].text);\n  } catch {\n    payload = payload[0].text;\n  }\n}\nreturn { payload };",
    },
    position: [480, 260],
  },
  output: [{ payload: {} }],
});

export default workflow('util-unwrap-mcp-json', 'UTIL - Unwrap MCP JSON')
  .add(whenExecuted)
  .to(unwrapPayload);
