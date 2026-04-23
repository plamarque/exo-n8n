import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const manualStart = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: {
    name: 'Manual Start',
    position: [220, 120],
    parameters: {},
  },
  output: [{}],
});

const scheduleIntake = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Schedule Intake (5m)',
    position: [220, 280],
    parameters: {
      rule: {
        interval: [
          {
            field: 'minutes',
            minutesInterval: 5,
          },
        ],
      },
    },
  },
  output: [{}],
});

const mcpSearchDocs = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Search Folder Docs',
    position: [480, 200],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'search_documents' },
      inputMode: 'json',
      jsonInput: expr('{{ { query: "", parent_folder_id: ($vars.WF02_PARENT_FOLDER_ID || "b468cb5639805e11480baa56164da90c"), limit: 100, offset: 0 } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '[]' }] }],
});

const parseDedupDocs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse + Deduplicate Docs',
    position: [740, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const seen = $getWorkflowStaticData('global');
if (!Array.isArray(seen.wf02ProcessedDocKeys)) seen.wf02ProcessedDocKeys = [];

const first = $input.first().json;
let payload = first;
if (first?.content?.[0]?.text !== undefined) payload = first.content[0].text;
if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0]?.text === 'string') payload = JSON.parse(payload[0].text);
else if (typeof payload === 'string') payload = JSON.parse(payload);

const docs = Array.isArray(payload) ? payload : (payload?.documents || []);
const out = [];
for (const doc of docs) {
  const docId = String(doc.document_id || '').trim();
  if (!docId) continue;
  const key = String(docId) + ':' + String(doc.updated_date || '');
  if (seen.wf02ProcessedDocKeys.includes(key)) continue;
  seen.wf02ProcessedDocKeys.push(key);
  out.push({ json: { document_id: docId, list_item: doc, cycle_id: key } });
}

if (seen.wf02ProcessedDocKeys.length > 5000) {
  seen.wf02ProcessedDocKeys = seen.wf02ProcessedDocKeys.slice(-5000);
}

return out;
      `,
    },
  },
  output: [{ document_id: 'doc_1', list_item: {}, cycle_id: 'doc_1:2026-01-01' }],
});

const mcpGetDocument = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Get Document By ID',
    position: [980, 200],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'get_document_by_id' },
      inputMode: 'json',
      jsonInput: expr('{{ { document_id: $json.document_id } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{}' }] }],
});

const buildTaskPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Task Payload',
    position: [1240, 200],
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const fromList = $('Parse + Deduplicate Docs').item.json;
const first = $json;
let payload = first;
if (first?.content?.[0]?.text !== undefined) payload = first.content[0].text;
if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0]?.text === 'string') payload = JSON.parse(payload[0].text);
else if (typeof payload === 'string') payload = JSON.parse(payload);

const doc = payload || {};
const documentId = String(doc.document_id || fromList.document_id || '').trim();
if (!documentId) throw new Error('Missing document_id from get_document_by_id');

const cycleId = fromList.cycle_id || (String(documentId) + ':' + String(doc.updated_date || new Date().toISOString()));
const titleCore = String(doc.name || 'Document sans titre').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
const title = ('Validation - ' + titleCore).slice(0, 140);
const author = String(doc?.created_username?.username || 'claire').trim() || 'claire';
const docUrl = (doc.url && String(doc.url).startsWith('http'))
  ? String(doc.url)
  : ('https://exo-qaui.meeds.io' + String(doc.url || ''));

const description = [
  '<p><strong>Document source:</strong> <a href="' + docUrl + '" target="_blank" rel="noopener noreferrer">' + (doc.name || documentId) + '</a></p>',
  '<p><strong>Cycle:</strong> ' + cycleId + '</p>',
  '<p><strong>Validation:</strong> utilisez les liens d&apos;approbation dans le premier commentaire de la tache.</p>',
  '<p>Regle: passage en Done uniquement si les deux tampons sont APPROUVE.</p>'
].join('');

return {
  document_id: documentId,
  cycle_id: cycleId,
  author_username: author,
  title,
  description,
  createTaskInput: {
    project_id: Number($vars.WF02_PROJECT_ID || 117),
    title,
    description,
    assignee: author,
    coworkers: ['nadia', 'etienne'],
    status_id: Number($vars.WF02_INPROGRESS_STATUS_ID || 475),
    priority: 'NORMAL'
  }
};
      `,
    },
  },
  output: [{ document_id: 'doc_1', cycle_id: 'doc_1:2026-01-01', author_username: 'claire', title: 'Validation - Test', description: '<p>...</p>', createTaskInput: { project_id: 117 } }],
});

const mcpCreateTask = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Create Task',
    position: [1500, 200],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'create_task_in_project' },
      inputMode: 'json',
      jsonInput: expr('{{$json.createTaskInput}}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"task_id": 999}' }] }],
});

const extractCreatedTask = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Created Task',
    position: [1760, 200],
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const fromBuild = $('Build Task Payload').item.json;
let payload = $json;
if ($json?.content?.[0]?.text !== undefined) payload = $json.content[0].text;
if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0]?.text === 'string') payload = JSON.parse(payload[0].text);
else if (typeof payload === 'string') payload = JSON.parse(payload);

const taskId = Number(payload?.task_id || payload?.id || payload?.task?.task_id || 0);
if (!taskId) throw new Error('create_task_in_project returned no task_id');

return {
  ...fromBuild,
  task_id: taskId,
};
      `,
    },
  },
  output: [{ task_id: 999, cycle_id: 'doc_1:2026-01-01' }],
});

const mcpInitialComment = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Add Initial Comment',
    position: [2020, 200],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'add_task_comment' },
      inputMode: 'json',
      jsonInput: expr('{{ (() => { let base = String($vars.WF02_APPROVAL_BASE_URL || "https://meeds.app.n8n.cloud").replace(/\\/$/, ""); if (!/\\/form\\/wf02-doc-validation\\/approve$/.test(base)) base = base + "/form/wf02-doc-validation/approve"; const art = base + "?task_id=" + $json.task_id + "&cycle_id=" + encodeURIComponent($json.cycle_id) + "&role=artistique&actor=nadia"; const tech = base + "?task_id=" + $json.task_id + "&cycle_id=" + encodeURIComponent($json.cycle_id) + "&role=technique&actor=etienne"; const text = "<p><strong>Validation lancee</strong> (cycle: " + $json.cycle_id + ").</p><p><a href=\\"" + art + "\\" target=\\"_blank\\" rel=\\"noopener noreferrer\\">Valider Artistique (Nadia)</a></p><p><a href=\\"" + tech + "\\" target=\\"_blank\\" rel=\\"noopener noreferrer\\">Valider Technique (Etienne)</a></p><p>Chaque lien ouvre un formulaire de decision avec motif (obligatoire en cas de refus).</p>"; return { task_id: $json.task_id, text }; })() }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"task_comment_id": 1}' }] }],
});

const registerApprovalState = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Register Approval State',
    position: [2280, 200],
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `
const state = $getWorkflowStaticData('global');
if (!state.wf02Approvals) state.wf02Approvals = {};
const key = String($json.task_id) + ':' + String($json.cycle_id);
state.wf02Approvals[key] = {
  task_id: $json.task_id,
  cycle_id: $json.cycle_id,
  document_id: $json.document_id,
  author_username: $json.author_username,
  approvals: {
    artistique: { actor: 'nadia', decision: 'EN_ATTENTE', reason: '', at: '' },
    technique: { actor: 'etienne', decision: 'EN_ATTENTE', reason: '', at: '' }
  }
};
return $json;
      `,
    },
  },
  output: [{ task_id: 999, cycle_id: 'doc_1:2026-01-01' }],
});

const approvalForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.5,
  config: {
    name: 'Approval Form',
    position: [220, 620],
    parameters: {
      authentication: 'none',
      formTitle: 'Validation documentaire Festival Art de Rue',
      formDescription: '<p>Validez ou refusez le document. En cas de refus, un motif est obligatoire.</p>',
      formFields: {
        values: [
          { fieldType: 'hiddenField', fieldName: 'task_id' },
          { fieldType: 'hiddenField', fieldName: 'cycle_id' },
          { fieldType: 'hiddenField', fieldName: 'role' },
          { fieldType: 'hiddenField', fieldName: 'actor' },
          {
            fieldType: 'dropdown',
            fieldName: 'decision',
            fieldLabel: 'Decision',
            requiredField: true,
            fieldOptions: { values: [{ option: 'APPROUVE' }, { option: 'REFUSE' }] },
            defaultValue: 'APPROUVE',
          },
          {
            fieldType: 'textarea',
            fieldName: 'reason',
            fieldLabel: 'Motif (obligatoire si REFUSE)',
            requiredField: false,
            placeholder: 'Saisissez le motif si vous refusez',
          },
        ],
      },
      responseMode: 'onReceived',
      options: {
        path: 'wf02-doc-validation/approve',
        buttonLabel: 'Envoyer la decision',
        appendAttribution: false,
        respondWithOptions: {
          values: {
            respondWith: 'text',
            formSubmittedText: 'Decision enregistree. Merci.',
          },
        },
      },
    },
  },
  output: [{ task_id: 999, cycle_id: 'doc_1:2026-01-01', role: 'artistique', actor: 'nadia', decision: 'APPROUVE', reason: '' }],
});

const parseApprovalInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Approval Input',
    position: [480, 620],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const input = $input.first().json || {};
const taskId = Number(input.task_id ?? 0);
const cycleId = String(input.cycle_id ?? '').trim();
const role = String(input.role ?? '').trim().toLowerCase();
const decision = String(input.decision ?? '').trim().toUpperCase();
const reason = String(input.reason ?? '').trim();
const actor = String(input.actor ?? '').trim().toLowerCase();

const allowedRoles = ['artistique', 'technique'];
const allowedDecisions = ['APPROUVE', 'REFUSE'];
let valid = true;
let message = 'OK';
if (!taskId || !cycleId || !allowedRoles.includes(role) || !allowedDecisions.includes(decision)) {
  valid = false;
  message = 'Payload invalide';
}
if (decision === 'REFUSE' && !reason) {
  valid = false;
  message = 'Motif obligatoire en cas de refus';
}

return [{ json: { task_id: taskId, cycle_id: cycleId, role, decision, reason, actor, valid, message } }];
      `,
    },
  },
  output: [{ task_id: 999, cycle_id: 'doc_1:2026-01-01', role: 'artistique', decision: 'APPROUVE', reason: '', actor: 'nadia', valid: true, message: 'OK' }],
});

const ifApprovalValid = ifElse({
  version: 2.3,
  config: {
    name: 'IF Approval Valid',
    position: [740, 620],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'if_valid',
            leftValue: expr('{{$json.valid}}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const stopInvalid = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: {
    name: 'Stop Invalid',
    position: [980, 760],
    parameters: {},
  },
  output: [{ ok: false, message: 'Payload invalide' }],
});

const mcpDecisionComment = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Add Decision Comment',
    position: [980, 560],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'add_task_comment' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $json.task_id, text: ("Tampon " + $json.role + ": " + $json.decision + ($json.reason ? (". Motif: " + $json.reason) : "")) } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"task_comment_id": 2}' }] }],
});

const updateApprovalState = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Update Approval State',
    position: [1240, 560],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const input = $('Parse Approval Input').item.json;
const state = $getWorkflowStaticData('global');
if (!state.wf02Approvals) state.wf02Approvals = {};

const key = String(input.task_id) + ':' + String(input.cycle_id);
if (!state.wf02Approvals[key]) {
  state.wf02Approvals[key] = {
    task_id: input.task_id,
    cycle_id: input.cycle_id,
    approvals: {
      artistique: { actor: 'nadia', decision: 'EN_ATTENTE', reason: '', at: '' },
      technique: { actor: 'etienne', decision: 'EN_ATTENTE', reason: '', at: '' }
    }
  };
}

const row = state.wf02Approvals[key];
if (row.approvals[input.role]) {
  row.approvals[input.role].decision = input.decision;
  row.approvals[input.role].reason = input.reason || '';
  row.approvals[input.role].at = new Date().toISOString();
  if (input.actor) row.approvals[input.role].actor = input.actor;
}

const art = row.approvals.artistique?.decision;
const tech = row.approvals.technique?.decision;
const joinReady = art !== 'EN_ATTENTE' && tech !== 'EN_ATTENTE';
const bothApproved = art === 'APPROUVE' && tech === 'APPROUVE';

return [{ json: { ...row, joinReady, bothApproved, artistique: row.approvals.artistique, technique: row.approvals.technique } }];
      `,
    },
  },
  output: [{ task_id: 999, cycle_id: 'doc_1:2026-01-01', joinReady: false, bothApproved: false }],
});

const ifJoinReady = ifElse({
  version: 2.3,
  config: {
    name: 'IF Join Ready',
    position: [1480, 560],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'if_join_ready',
            leftValue: expr('{{$json.joinReady}}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const stopPending = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: {
    name: 'Stop Pending',
    position: [1720, 700],
    parameters: {},
  },
  output: [{ ok: true, status: 'pending' }],
});

const ifBothApproved = ifElse({
  version: 2.3,
  config: {
    name: 'IF Both Approved',
    position: [1720, 500],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'if_both_approved',
            leftValue: expr('{{$json.bothApproved}}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const mcpSetDone = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Set Done',
    position: [1980, 420],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'update_task_status' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $json.task_id, status_id: Number($vars.WF02_DONE_STATUS_ID || 477) } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '"Done"' }] }],
});

const mcpCommentApproved = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Final Comment Approved',
    position: [2240, 420],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'add_task_comment' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $("Update Approval State").item.json.task_id, text: "Double tampon obtenu. Tache approuvee et cloturee." } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"task_comment_id": 3}' }] }],
});

const stopApproved = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: {
    name: 'Stop Approved',
    position: [2500, 420],
    parameters: {},
  },
  output: [{ ok: true, status: 'approved' }],
});

const mcpSetInProgress = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Keep InProgress',
    position: [1980, 620],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'update_task_status' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $json.task_id, status_id: Number($vars.WF02_INPROGRESS_STATUS_ID || 475) } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '"Done"' }] }],
});

const mcpCommentRejected = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Final Comment Rejected',
    position: [2240, 620],
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'add_task_comment' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $("Update Approval State").item.json.task_id, text: "Validation incomplete/refusee. Merci de corriger puis resoumettre le document." } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"task_comment_id": 4}' }] }],
});

const stopRejected = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: {
    name: 'Stop Rejected',
    position: [2500, 620],
    parameters: {},
  },
  output: [{ ok: true, status: 'rejected' }],
});

export default workflow('wf02-doc-validation', 'WF02 - Validation documentaire split join')
  .add(manualStart)
  .to(mcpSearchDocs)
  .to(parseDedupDocs)
  .to(mcpGetDocument)
  .to(buildTaskPayload)
  .to(mcpCreateTask)
  .to(extractCreatedTask)
  .to(mcpInitialComment)
  .to(registerApprovalState)

  .add(scheduleIntake)
  .to(mcpSearchDocs)

  .add(approvalForm)
  .to(parseApprovalInput)
  .to(ifApprovalValid
    .onFalse(stopInvalid)
    .onTrue(
      mcpDecisionComment
        .to(updateApprovalState)
        .to(ifJoinReady
          .onFalse(stopPending)
          .onTrue(
            ifBothApproved
              .onTrue(mcpSetDone.to(mcpCommentApproved.to(stopApproved)))
              .onFalse(mcpSetInProgress.to(mcpCommentRejected.to(stopRejected)))
          )
        )
    )
  );
