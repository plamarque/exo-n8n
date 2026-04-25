import { workflow, node, trigger, ifElse, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const manualStart = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Manual Start', position: [224, 224] },
  output: [{}],
});

const intakeEvery5m = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Intake Every 5m',
    parameters: { rule: { interval: [{ field: 'minutes' }] } },
    position: [224, 448],
  },
  output: [{}],
});

const mcpListEmails = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP List Emails',
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'list_emails' },
      inputMode: 'json',
      jsonInput: '{"limit":50,"offset":0}',
      options: { timeout: 60000 },
    },
    position: [528, 336],
  },
  output: [{ content: [{ type: 'text', text: '{"emails":[]}' }] }],
});

const unwrapMcpEmails = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1,
  config: {
    name: 'Unwrap MCP Emails',
    parameters: { workflowId: 'E4OAThogWRG93MUG', options: {} },
    position: [768, 336],
  },
  output: [{ payload: [] }],
});

const splitOutEmails = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'Split Out Emails',
    parameters: { fieldToSplitOut: 'payload', options: {} },
    position: [992, 336],
  },
  output: [{}],
});

const normalizeEmail = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize Email',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'emailId', name: 'emailId', value: expr("{{ String($json.email_id ?? $json.messageId ?? $json.id ?? '') }}"), type: 'string' },
          { id: 'subject', name: 'subject', value: expr("{{ $json.subject || 'Email sans sujet' }}"), type: 'string' },
          { id: 'body', name: 'body', value: expr("{{ $json.content?.body || $json.body || '' }}"), type: 'string' },
          { id: 'sender', name: 'sender', value: expr("{{ $json.sender?.address || $json.sender || $json.from || 'unknown' }}"), type: 'string' },
          { id: 'receivedAt', name: 'receivedAt', value: expr('{{ $json.receivedDate || $json.receivedAt || $now.toISO() }}'), type: 'string' },
        ],
      },
      includeOtherFields: false,
      options: {},
    },
    position: [1200, 336],
  },
  output: [{ emailId: 'mail-1', subject: 'URGENT - VPN KO', body: 'VPN KO', sender: 'client@example.org' }],
});

const filterHasEmailId = ifElse({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'Filter - Has Email ID',
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'has_email_id', leftValue: expr('{{$json.emailId}}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty' } }],
        combinator: 'and',
      },
      options: {},
    },
    position: [1424, 336],
  },
  output: [{}],
});

const routingModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'Routing Model',
    parameters: { model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' }, options: { temperature: 0.1 } },
    position: [1664, 544],
  },
});

const routingOutputParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Routing Output Parser',
    parameters: {
      jsonSchemaExample: '{"action_required":true,"response_expected":true,"action_confidence":0.92,"assignee_username":"louis","priority":"HIGH","slaHours":4,"task_title":"Incident VPN billetterie","summary":"Interruption VPN.","next_action":"Diagnostiquer.","rationale":"Sujet technique."}',
    },
    position: [1824, 544],
  },
});

const aiRouter = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'AI Router',
    parameters: {
      promptType: 'define',
      text: expr('Analyse cet email pour determiner s il est clairement actionnable.\nSubject: {{ $json.subject }}\nSender: {{ $json.sender }}\nBody: {{ $json.body }}\n\nRetourne uniquement les champs structures demandés.'),
      hasOutputParser: true,
      options: {
        systemMessage: 'Tu es l agent de tri des emails du festival Art2Rue. Regle absolue: on cree une tache uniquement si l email est clairement actionnable. Si doute, ambiguite, ou simple information: ne pas creer de tache. Retourne alors action_required=false et response_expected=false. Valeurs attendues: action_required (boolean), response_expected (boolean), action_confidence (0..1), assignee_username (louis|claire|lucie), priority (LOW|NORMAL|HIGH|URGENT), slaHours (>0), task_title, summary, next_action, rationale. Si action_required=false: assignee_username=claire, priority=LOW, slaHours=72, task_title="Information sans action", next_action="Aucune action immediate".',
      },
    },
    position: [1664, 336],
    subnodes: { model: routingModel, outputParser: routingOutputParser },
  },
  output: [{ output: { action_required: true, response_expected: true, action_confidence: 0.9, assignee_username: 'louis', priority: 'HIGH', task_title: 'Incident VPN', summary: 'VPN KO', next_action: 'Diagnostiquer', rationale: 'Urgent' } }],
});

const normalizeAiOutput = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize AI Output',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'subject', name: 'subject', value: expr("{{ $('Normalize Email').item.json.subject }}"), type: 'string' },
          { id: 'body', name: 'body', value: expr("{{ $('Normalize Email').item.json.body }}"), type: 'string' },
          { id: 'sender', name: 'sender', value: expr("{{ $('Normalize Email').item.json.sender }}"), type: 'string' },
          { id: 'actionRequired', name: 'actionRequired', value: expr('{{ Boolean(($json.output || $json).action_required) }}'), type: 'boolean' },
          { id: 'responseExpected', name: 'responseExpected', value: expr('{{ Boolean(($json.output || $json).response_expected) }}'), type: 'boolean' },
          { id: 'actionConfidence', name: 'actionConfidence', value: expr('{{ Number(($json.output || $json).action_confidence || 0) }}'), type: 'number' },
          { id: 'assigneeCandidate', name: 'assigneeCandidate', value: expr("{{ String((($json.output || $json).assignee_username || '')).toLowerCase() }}"), type: 'string' },
          { id: 'priorityCandidate', name: 'priorityCandidate', value: expr("{{ String((($json.output || $json).priority || 'NORMAL')).toUpperCase() }}"), type: 'string' },
          { id: 'taskTitleCandidate', name: 'taskTitleCandidate', value: expr("{{ String((($json.output || $json).task_title || $('Normalize Email').item.json.subject || 'Email a traiter')).slice(0,80) }}"), type: 'string' },
          { id: 'summary', name: 'summary', value: expr("{{ String((($json.output || $json).summary || 'Synthese non fournie')).slice(0,500) }}"), type: 'string' },
          { id: 'nextAction', name: 'nextAction', value: expr("{{ String((($json.output || $json).next_action || 'Analyser et mettre a jour le statut')).slice(0,300) }}"), type: 'string' },
          { id: 'rationale', name: 'rationale', value: expr("{{ String((($json.output || $json).rationale || 'Decision IA')).slice(0,300) }}"), type: 'string' },
        ],
      },
      includeOtherFields: false,
      options: {},
    },
    position: [1904, 336],
  },
  output: [{}],
});

const ifClearlyActionable = ifElse({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'IF Clearly Actionable',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { id: 'action', leftValue: expr('{{$json.actionRequired}}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } },
          { id: 'response', leftValue: expr('{{$json.responseExpected}}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } },
          { id: 'confidence', leftValue: expr('{{$json.actionConfidence}}'), rightValue: 0.7, operator: { type: 'number', operation: 'gte' } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [2128, 336],
  },
  output: [{}],
});

const buildMcpPayload = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build MCP Payload',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'resolvedAssignee', name: 'resolvedAssignee', value: expr("{{ ['louis','claire','lucie'].includes($json.assigneeCandidate) ? $json.assigneeCandidate : 'claire' }}"), type: 'string' },
          { id: 'assigneeLabel', name: 'assigneeLabel', value: expr("{{ ({louis:'Louis', claire:'Claire', lucie:'Lucie'}[$json.assigneeCandidate]) || 'Claire' }}"), type: 'string' },
          { id: 'resolvedPriority', name: 'resolvedPriority', value: expr("{{ $json.priorityCandidate === 'URGENT' ? 'HIGH' : (['LOW','NORMAL','HIGH'].includes($json.priorityCandidate) ? $json.priorityCandidate : 'NORMAL') }}"), type: 'string' },
          { id: 'taskTitle', name: 'taskTitle', value: expr('{{$json.taskTitleCandidate}}'), type: 'string' },
        ],
      },
      includeOtherFields: true,
      options: {},
    },
    position: [2352, 336],
  },
  output: [{}],
});

const renderTaskDescriptionHtml = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Render Task Description HTML',
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: "const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\\"/g, '&quot;');\nconst excerpt = String($json.body || '').replace(/\\s+/g, ' ').slice(0, 400);\nconst description = ['<div>','<p><strong>Email source:</strong> ' + esc($json.sender) + '<br/><strong>Sujet:</strong> ' + esc($json.subject) + '</p>','<h4>Contexte</h4>','<p>' + esc($json.summary || 'Synthese non fournie') + '</p>','<h4>Action attendue</h4>','<p>' + esc($json.nextAction || 'Analyser et mettre a jour le statut') + '</p>','<h4>Decision IA</h4>','<ul>','<li><strong>Assignee:</strong> ' + esc($json.assigneeLabel || $json.resolvedAssignee) + ' (' + esc($json.resolvedAssignee) + ')</li>','<li><strong>Priorite:</strong> ' + esc($json.resolvedPriority) + '</li>','<li><strong>Confiance actionnable:</strong> ' + esc($json.actionConfidence) + '</li>','<li><strong>Justification:</strong> ' + esc($json.rationale || 'Decision IA') + '</li>','</ul>','<h4>Extrait email</h4>','<blockquote>' + esc(excerpt) + '</blockquote>','</div>'].join('').slice(0, 5000);\nconst projectId = Number($vars.WF01_PROJECT_ID || 3);\nreturn { ...$json, aiDecision: { clearlyActionable: true, assignee: $json.resolvedAssignee, assigneeLabel: $json.assigneeLabel, priority: $json.resolvedPriority, actionConfidence: $json.actionConfidence, taskTitle: $json.taskTitle, summary: $json.summary, nextAction: $json.nextAction, rationale: $json.rationale }, createTaskInput: { project_id: projectId, title: $json.taskTitle, description, assignee: $json.resolvedAssignee, priority: $json.resolvedPriority } };",
    },
    position: [2576, 336],
  },
  output: [{ createTaskInput: { project_id: 3, title: 'Incident VPN', description: '<div></div>', assignee: 'louis', priority: 'HIGH' } }],
});

const mcpCreateTask = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Create Task',
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'create_task_in_project' },
      inputMode: 'json',
      jsonInput: expr('{{$json.createTaskInput}}'),
      options: { timeout: 60000 },
    },
    position: [2800, 336],
  },
  output: [{ content: [{ type: 'text', text: '{"task_id":123}' }] }],
});

const unwrapMcpCreateTask = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1,
  config: {
    name: 'Unwrap MCP Create Task',
    parameters: { workflowId: 'E4OAThogWRG93MUG', options: {} },
    position: [3024, 336],
  },
  output: [{ payload: { task_id: 123 } }],
});

const extractTaskAssignment = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Extract Task Assignment',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'task_id', name: 'task_id', value: expr('{{ Number($json.payload?.task_id || $json.payload?.id || $json.payload?.task?.task_id || 0) }}'), type: 'number' },
          { id: 'username', name: 'username', value: expr("{{ $('Render Task Description HTML').item.json.createTaskInput.assignee || 'claire' }}"), type: 'string' },
          { id: 'raw_create_payload', name: 'raw_create_payload', value: expr('{{ JSON.stringify($json.payload || {}).slice(0, 800) }}'), type: 'string' },
        ],
      },
      includeOtherFields: false,
      options: {},
    },
    position: [3248, 336],
  },
  output: [{ task_id: 123, username: 'louis', raw_create_payload: '{"task_id":123}' }],
});

const ifHasTaskId = ifElse({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: {
    name: 'IF Has Task ID',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'has_task_id', leftValue: expr('{{$json.task_id}}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and',
      },
      options: {},
    },
    position: [3472, 336],
  },
  output: [{}],
});

const mcpAssignTask = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Assign Task',
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'assign_task' },
      inputMode: 'json',
      jsonInput: expr('{{ { task_id: $json.task_id, username: $json.username } }}'),
      options: { timeout: 60000 },
    },
    position: [3696, 240],
  },
  output: [{ content: [{ type: 'text', text: '{"ok":true}' }] }],
});

const stopMissingTaskId = node({
  type: 'n8n-nodes-base.stopAndError',
  version: 1,
  config: {
    name: 'Stop - Missing task_id',
    parameters: { errorMessage: expr('create_task_in_project failed or returned no task_id. payload={{$json.raw_create_payload}}') },
    position: [3696, 464],
  },
  output: [{}],
});

const mainFlow = mcpListEmails
  .to(unwrapMcpEmails)
  .to(splitOutEmails)
  .to(normalizeEmail)
  .to(filterHasEmailId
    .onTrue(aiRouter
      .to(normalizeAiOutput)
      .to(ifClearlyActionable
        .onTrue(buildMcpPayload
          .to(renderTaskDescriptionHtml)
          .to(mcpCreateTask)
          .to(unwrapMcpCreateTask)
          .to(extractTaskAssignment)
          .to(ifHasTaskId
            .onTrue(mcpAssignTask)
            .onFalse(stopMissingTaskId))))));

export default workflow('zeVd0scWqU5vcOUq', 'WF01 - Email to Task (SDK)')
  .add(manualStart)
  .to(mainFlow)
  .add(intakeEvery5m)
  .to(mainFlow);
