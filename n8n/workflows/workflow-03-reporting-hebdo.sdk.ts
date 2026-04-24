import { workflow, node, trigger, ifElse, languageModel, outputParser, newCredential, expr } from '@n8n/workflow-sdk';

const manualStart = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: {
    name: 'Manual Start',
    position: [160, 160],
    parameters: {},
  },
  output: [{}],
});

const weeklyPreparation = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Weekly Preparation (Thu 08:00)',
    position: [160, 340],
    parameters: {
      rule: {
        interval: [
          {
            field: 'weeks',
            weeksInterval: 1,
            triggerAtDay: [4],
            triggerAtHour: 8,
            triggerAtMinute: 0,
          },
        ],
      },
    },
  },
  output: [{}],
});

const prepareConfig = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare COPIL Config',
    position: [440, 250],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const now = new Date();
const day = now.getDay();
const delta = (4 - day + 7) % 7;
const meeting = new Date(now);
meeting.setDate(now.getDate() + delta);
meeting.setHours(10, 0, 0, 0);

const nextMeeting = new Date(meeting);
nextMeeting.setDate(meeting.getDate() + 7);
const plus2 = new Date(meeting);
plus2.setDate(meeting.getDate() + 14);

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

const title = 'COPIL Festival Art2Rue - ' + ymd(meeting);

return [{
  json: {
    space_id: Number($vars.WF03_SPACE_ID || 1),
    project_id: Number($vars.WF03_PROJECT_ID || 3),
    template_note_id: Number($vars.WF03_TEMPLATE_NOTE_ID || 25),
    reports_parent_note_id: Number($vars.WF03_REPORTS_PARENT_NOTE_ID || 6),
    agenda_parent_event_id: Number($vars.WF03_AGENDA_PARENT_EVENT_ID || 13),
    attendee_usernames: String($vars.WF03_ATTENDEE_USERNAMES || 'claire,etienne,louis,nadia,antoine,emma').split(',').map(s => s.trim()).filter(Boolean),
    meeting_owner: String($vars.WF03_MEETING_OWNER || 'Equipe projet'),
    meeting_date: ymd(meeting),
    next_meeting_date: ymd(nextMeeting),
    meeting_date_plus_2: ymd(plus2),
    meeting_start: ymd(meeting) + 'T10:00:00+02:00',
    meeting_end: ymd(meeting) + 'T11:30:00+02:00',
    note_title: title,
    search_query: title,
    stagnation_days: Number($vars.WF03_STAGNATION_DAYS || 3),
    blocked_days: Number($vars.WF03_BLOCKED_DAYS || 5),
    overload_threshold: Number($vars.WF03_OVERLOAD_THRESHOLD || 5),
    exo_base_url: String($vars.WF03_EXO_BASE_URL || 'https://exo-mips-ft.meeds.io').replace(/\\/+$/, ''),
    space_slug: String($vars.WF03_SPACE_SLUG || 'festival_art2rue')
  }
}];
      `,
    },
  },
  output: [{ note_title: 'COPIL Festival Art2Rue - 2026-04-30', project_id: 3, template_note_id: 25 }],
});

const mcpGetTemplate = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Get Template Note',
    position: [720, 250],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'get_note' },
      inputMode: 'json',
      jsonInput: expr('{{ { note_id: $json.template_note_id } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"note_id":25,"html_content":"<h1>[[MEETING_DATE]]</h1>"}' }] }],
});

const mcpListTasks = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP List Project Tasks',
    position: [1000, 250],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'list_tasks' },
      inputMode: 'json',
      jsonInput: expr('{{ { project_id: $("Prepare COPIL Config").item.json.project_id, limit: 100, offset: 0, hide_completed_tasks: false, include_change_log: false } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"tasks":[],"count":0}' }] }],
});

const buildAiContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Report Context',
    position: [1280, 250],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
function parseMcp(value) {
  let payload = value;
  if (payload?.content?.[0]?.text !== undefined) payload = payload.content[0].text;
  if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0].text === 'string') payload = payload[0].text;
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return payload; }
  }
  return payload;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#43;/g, '+');
}

function strip(value, size = 240) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, '')
    .replaceAll('\\n', ' ')
    .replaceAll('\\r', ' ')
    .replaceAll('\\t', ' ')
    .trim()
    .slice(0, size);
}

function shortDate(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function mapStatusFr(value) {
  const v = String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\\s+/g, ' ').trim();
  if (v === 'to do' || v === 'todo') return 'A faire';
  if (v === 'in progress' || v === 'inprogress') return 'En cours';
  if (v === 'done') return 'Terminee';
  if (v === 'blocked') return 'Bloquee';
  if (v === 'waiting on' || v === 'waitingon') return 'En attente';
  return value || 'Non qualifie';
}

function statusWithEmoji(value) {
  const v = String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\\s+/g, ' ').trim();
  const label = mapStatusFr(value);
  if (v === 'to do' || v === 'todo') return '📋 ' + label;
  if (v === 'in progress' || v === 'inprogress') return '🔵 ' + label;
  if (v === 'done') return '✅ ' + label;
  if (v === 'blocked') return '🚧 ' + label;
  if (v === 'waiting on' || v === 'waitingon') return '⏳ ' + label;
  return '📌 ' + label;
}

function mapPriorityFr(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'HIGH') return 'Haute';
  if (v === 'NORMAL' || v === 'MEDIUM') return 'Moyenne';
  if (v === 'LOW') return 'Basse';
  return value || 'Non qualifiee';
}

function priorityRank(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'HIGH') return 0;
  if (v === 'NORMAL' || v === 'MEDIUM') return 1;
  if (v === 'LOW') return 2;
  return 3;
}

function mentionUser(value) {
  const username = String(value || '').trim();
  if (!username) return '';
  return username.startsWith('@') ? username : '@' + username;
}

function taskRef(task) {
  const id = task.task_id || task.id || '';
  if (!id) return '';
  return '/task:' + id;
}

function taskUrl(task, config) {
  const id = task.task_id || task.id || '';
  if (!id) return '';
  return String(config.exo_base_url || 'https://exo-mips-ft.meeds.io').replace(/\\/+$/, '')
    + '/portal/g/:spaces:' + String(config.space_slug || 'festival_art2rue')
    + '/home/tasks/taskDetail/' + id;
}

const config = $('Prepare COPIL Config').item.json;
const template = parseMcp($('MCP Get Template Note').item.json);
const taskPayload = parseMcp($input.first().json);
const tasks = Array.isArray(taskPayload) ? taskPayload : (taskPayload?.tasks || []);
const tasksSorted = [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

const rows = tasksSorted.map(task => {
  const status = task.status?.status || task.status?.name || task.status || '';
  const assignee = mentionUser(task.assignee?.username || task.assignee || task.assignee_username || '');
  const due = shortDate(task.due_date || task.end_date || task.dueDate || '');
  const priority = task.priority || '';
  const id = task.task_id || task.id || '';
  const title = strip(task.title || task.name || ('Task ' + (task.task_id || task.id || '')), 120);
  const comment = task.description || task.last_comment || task.blocking_comment || '';
  const url = taskUrl(task, config);
  const linkedTitle = url
    ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>'
    : esc(title);
  return '<tr><td>' + esc(id) + '</td><td>' + linkedTitle + '</td><td>' + esc(assignee) + '</td><td>' + esc(statusWithEmoji(status)) + '</td><td>' + esc(due) + '</td><td>' + esc(mapPriorityFr(priority)) + '</td><td>' + esc(strip(comment)) + '</td></tr>';
});

const reportHtml = rows.length
  ? '<table><thead><tr><th>ID</th><th>Tache</th><th>Responsable</th><th>Statut</th><th>Echeance</th><th>Priorite</th><th>Commentaire / blocage</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'
  : '<p>Aucune tache trouvee dans le perimetre du projet au moment de la preparation.</p>';

const statusCounts = {};
for (const task of tasks) {
  const status = String(task.status?.status || task.status?.name || task.status || 'Non qualifie');
  statusCounts[status] = (statusCounts[status] || 0) + 1;
}

return [{
  json: {
    ...config,
    template_note: template,
    template_html: String(template?.html_content || ''),
    tasks,
    task_count: tasks.length,
    status_counts: statusCounts,
    report_html: reportHtml,
    ai_prompt_payload: JSON.stringify({
      meeting_date: config.meeting_date,
      thresholds: {
        stagnation_days: config.stagnation_days,
        blocked_days: config.blocked_days,
        overload_threshold: config.overload_threshold
      },
      status_counts: statusCounts,
      tasks: tasksSorted.map(task => ({
        task_id: task.task_id || task.id,
        task_ref: taskRef(task),
        title: task.title || task.name,
        status: mapStatusFr(task.status?.status || task.status?.name || task.status),
        priority: mapPriorityFr(task.priority),
        assignee: mentionUser(task.assignee?.username || task.assignee || task.assignee_username),
        due_date: shortDate(task.due_date || task.end_date || task.dueDate),
        updated_date: task.updated_date || task.updatedDate,
        description: strip(task.description)
      }))
    })
  }
}];
      `,
    },
  },
  output: [{ note_title: 'COPIL Festival Art2Rue - 2026-04-30', report_html: '<table></table>', ai_prompt_payload: '{}' }],
});

const openAiModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI COPIL Model',
    position: [1530, 520],
    credentials: { openAiApi: newCredential('OpenAI') },
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5-mini' },
      responsesApiEnabled: true,
      options: {
        reasoningEffort: 'low',
        timeout: 90000,
        maxRetries: 2,
      },
    },
  },
});

const structuredOutput = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'COPIL Structured Output',
    position: [1770, 520],
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"suggested_agenda":["Suivi livraison affiches — retard @claire /task:12","Arbitrage budget stand — /task:45"],"vigilances":["Plusieurs taches haute priorite sans assignee"],"summary":"Synthese courte pour ouverture du COPIL"}',
      autoFix: true,
    },
    subnodes: { model: openAiModel },
  },
});

const analyzeCopil = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Analyze COPIL Signals',
    position: [1560, 250],
    parameters: {
      promptType: 'define',
      hasOutputParser: true,
      text: expr('=Analyse le JSON des taches (champs title, status, assignee, due_date, task_id). Propose 3 a 5 points d ordre du jour CONCRETS pour ce projet: chaque phrase doit contenir un extrait significatif du titre d une tache reelle ou un enjeu clairement lie aux donnees (retard, blocage, charge, risque). Interdit: le mot litteral task_id, les phrases generiques sans lien avec les taches (ex: avancement global seul), les lignes qui ne seraient que /task: ou Point /task. A la fin d une ligne tu peux ajouter /task:ID numerique et @username si utile. Donnees JSON: {{ $json.ai_prompt_payload }}'),
      options: {
        systemMessage: 'Tu prepares un COPIL projet reel. Chaque element de suggested_agenda est une phrase autonome en francais (10 a 18 mots), lisible sans contexte externe: commence par le sujet concret (mot-cle du titre de tache ou du risque), puis precision (statut, echeance, responsable). Base-toi uniquement sur les taches fournies; si peu de taches, propose des points de pilotage derives des champs fournis (priorite, dates). Ne jamais ecrire task_id comme texte. N utilise pas de libelles anglais (To do, Blocked). Ne decide pas a la place du COPIL.',
        maxIterations: 3,
        enableStreaming: false,
      },
    },
    subnodes: { model: openAiModel, outputParser: structuredOutput },
  },
  output: [{ suggested_agenda: ['Avancement global'], vigilances: [], summary: 'Synthese courte' }],
});

const composeNote = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Compose COPIL Note',
    position: [1840, 250],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function replaceSection(source, start, end, replacement) {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (from === -1 || to === -1 || to < from) return source;
  return source.slice(0, from) + replacement + source.slice(to + end.length);
}

function cleanTemplate(html) {
  return String(html || '')
    .replace(/^\\s*<h1>Template note COPIL hebdomadaire<\\/h1>\\s*<blockquote>[\\s\\S]*?<\\/blockquote>/i, '')
    .replaceAll('Ordre du jour suggere par l&#39;IA', '🤖 Ordre du jour suggere')
    .replaceAll('Vigilances suggerees par l&#39;IA', '⚠️ Vigilances')
    .replaceAll('Informations de reunion', '🗓️ Informations de reunion')
    .replaceAll('<h2>Ordre du jour</h2>', '<h2>🧭 Ordre du jour</h2>')
    .replaceAll('<h2>Synthese de la semaine</h2>', '<h2>📌 Synthese de la semaine</h2>')
    .replaceAll('Rapport d&#39;avancement', '📊 Rapport d&#39;avancement')
    .replaceAll('<h2>Points a discuter</h2>', '<h2>💬 Points a discuter</h2>')
    .replaceAll('<h2>Decisions prises</h2>', '<h2>✅ Decisions prises</h2>')
    .replaceAll('<h2>Actions a lancer</h2>', '<h2>🎯 Actions a lancer</h2>')
    .replaceAll('<h2>Risques et points de vigilance</h2>', '<h2>⚠️ Risques et points de vigilance</h2>')
    .replaceAll('<h2>Prochaine reunion</h2>', '<h2>📅 Prochaine reunion</h2>')
    .replaceAll('<h2>Annexes</h2>', '<h2>📎 Annexes</h2>');
}

function enrichRefs(text) {
  return String(text || '').replace(/\\bIDs?\\s*[:#]?\\s*(\\d+)\\b/gi, '/task:$1');
}

function protectTaskRefColons(s) {
  return String(s || '').replace(/\\/task:(\\d+)/gi, '/task__c__$1');
}

function restoreTaskRefColons(s) {
  return String(s || '').replace(/\\/task__c__(\\d+)/gi, '/task:$1');
}

function conciseAgendaItem(text) {
  const clean = String(text || '')
    .replace(/\\s+/g, ' ')
    .replace(/^[\\-•\\d\\.\\)\\s]+/, '')
    .trim();
  if (!clean) return '';
  const shielded = protectTaskRefColons(clean);
  const first = shielded.split(/[;:.]/)[0].trim();
  return restoreTaskRefColons(first).slice(0, 90);
}

function agendaLineTooWeak(line) {
  const t = String(line || '').trim();
  if (t.length < 12) return true;
  const withoutRef = t.replace(/\\/task:\\d+/gi, '').replace(/@\\w+/g, '').trim();
  if (withoutRef.length < 8) return true;
  if (/^\\/task:\\d+$/i.test(t)) return true;
  if (/point\\s+\\/task$/i.test(t)) return true;
  if (!/[a-zàâäéèêëïîôùûüç]{5,}/i.test(withoutRef)) return true;
  return false;
}

function fallbackAgendaFromTasks(tasks, need, excludeIds) {
  const out = [];
  const ex = new Set(excludeIds || []);
  const list = Array.isArray(tasks) ? tasks : [];
  for (const t of list) {
    if (out.length >= need) break;
    const id = t.task_id || t.id;
    if (!id || ex.has(String(id))) continue;
    const raw = String(t.title || t.name || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();
    if (!raw) continue;
    const status = String(t.status?.status || t.status?.name || t.status || '').toLowerCase();
    let hint = '';
    if (status.includes('block')) hint = 'Point bloque — ';
    else if (status.includes('progress') || status.includes('cours')) hint = 'Suivi — ';
    else hint = 'Point projet — ';
    const line = (hint + raw).replace(/\\s+/g, ' ').trim().slice(0, 72) + ' /task:' + id;
    out.push(line);
  }
  return out;
}

function injectAgendaItems(sourceHtml, items) {
  const start = sourceHtml.indexOf('<ol>');
  const end = sourceHtml.indexOf('</ol>');
  if (start === -1 || end === -1 || end <= start) return sourceHtml;
  const extra = items.length ? items.map(item => '<li>' + esc(item) + '</li>').join('') : '';
  return sourceHtml.slice(0, end) + extra + sourceHtml.slice(end);
}

function buildPointsADiscuterHtml(suggested) {
  const intro = '<p><em>Section pre-remplissable par l&#39;IA puis ajustee par les participants.</em></p>';
  const iaItems = (Array.isArray(suggested) ? suggested : [])
    .map(s => conciseAgendaItem(enrichRefs(String(s))))
    .filter(Boolean);
  let body;
  if (iaItems.length) {
    body = '<p><strong>Sujets issus des propositions IA (ordre du jour suggere)</strong></p><ul>'
      + iaItems.map(t => '<li>' + esc(t) + '</li>').join('')
      + '</ul>';
  } else {
    body = '<p><em>Aucun point IA dedie pour cette semaine. Utilisez les emplacements ci-dessous en reunion.</em></p>';
  }
  const placeholders = '<p><strong>Complements a renseigner pendant la reunion</strong></p><ul>'
    + ['<li><em>Autre sujet (participants)</em></li>', '<li><em>Autre sujet (participants)</em></li>', '<li><em>Autre sujet (participants)</em></li>'].join('')
    + '</ul>';
  return intro + body + placeholders;
}

function injectPointsADiscuter(html, suggested) {
  const inner = buildPointsADiscuterHtml(suggested);
  const startM = '[POINTS_A_DISCUTER_START]';
  const endM = '[POINTS_A_DISCUTER_END]';
  if (html.indexOf(startM) !== -1 && html.indexOf(endM) !== -1) {
    return replaceSection(html, startM, endM, inner);
  }
  const needles = ['<h2>💬 Points a discuter</h2>', '<h2>Points a discuter</h2>'];
  for (const needle of needles) {
    const idx = html.indexOf(needle);
    if (idx === -1) continue;
    const after = idx + needle.length;
    const nextH2 = html.indexOf('<h2', after);
    const end = nextH2 === -1 ? html.length : nextH2;
    return html.slice(0, after) + inner + html.slice(end);
  }
  return html;
}

function buildAnnexesLiensHtml(ctx) {
  const base = String(ctx.exo_base_url || 'https://exo-mips-ft.meeds.io').replace(/\\/+$/, '');
  const slug = String(ctx.space_slug || 'festival_art2rue');
  const pid = Number(ctx.project_id || 3);
  const parentId = Number(ctx.agenda_parent_event_id || 13);
  const occ = encodeURIComponent(new Date(String(ctx.meeting_start)).toISOString());
  const projectUrl = base + '/portal/g/:spaces:' + slug + '/home/tasks/projectDetail/' + pid;
  const agendaUrl = base + '/portal/g/:spaces:' + slug + '/home/agenda?parentId=' + parentId + '&occurrenceId=' + occ;
  return '<p><strong>Liens utiles</strong></p><ul>'
    + '<li><a href="' + esc(projectUrl) + '" target="_blank" rel="noopener noreferrer">Projet — tableau des taches</a></li>'
    + '<li><a href="' + esc(agendaUrl) + '" target="_blank" rel="noopener noreferrer">Agenda — occurrence du COPIL</a></li>'
    + '</ul>';
}

function injectAnnexesLiens(html, ctx) {
  const inner = buildAnnexesLiensHtml(ctx);
  const startM = '[ANNEXES_LIENS_START]';
  const endM = '[ANNEXES_LIENS_END]';
  if (html.indexOf(startM) !== -1 && html.indexOf(endM) !== -1) {
    return replaceSection(html, startM, endM, inner);
  }
  const needles = ['<h2>📎 Annexes</h2>', '<h2>Annexes</h2>'];
  for (const needle of needles) {
    const idx = html.indexOf(needle);
    if (idx === -1) continue;
    const after = idx + needle.length;
    return html.slice(0, after) + inner + html.slice(after);
  }
  return html;
}

const context = $('Build Report Context').item.json;
const rawAi = $input.first().json || {};
const ai = rawAi.output || rawAi;
const suggested = Array.isArray(ai.suggested_agenda) ? ai.suggested_agenda : [];
const vigilances = Array.isArray(ai.vigilances) ? ai.vigilances : [];
const summary = ai.summary || '';

let html = cleanTemplate(context.template_html || '');
if (!html.trim()) {
  html = '<h1>[[NOTE_TITLE]]</h1><h2>🤖 Ordre du jour suggere</h2><p>[SUGGESTED_AGENDA_START][SUGGESTED_AGENDA_END]</p><h2>📊 Rapport d&#39;avancement</h2><p>[REPORT_AVANCEMENT_START][REPORT_AVANCEMENT_END]</p><h2>⚠️ Vigilances</h2><p>[VIGILANCES]</p><h2>💬 Points a discuter</h2><p>[POINTS_A_DISCUTER_START][POINTS_A_DISCUTER_END]</p><h2>✅ Decisions</h2><p></p><h2>🎯 Actions et responsables</h2><p></p><h2>📎 Annexes</h2><p>[ANNEXES_LIENS_START][ANNEXES_LIENS_END]</p>';
}

const vigilanceHtml = '<ul>' + (vigilances.length ? vigilances : ['Aucun signal de vigilance saillant detecte automatiquement.']).map(item => '<li>' + esc(enrichRefs(item)) + '</li>').join('') + '</ul>';
const aiAgendaRaw = suggested
  .map(item => conciseAgendaItem(enrichRefs(String(item))))
  .filter(Boolean);
let agendaCore = aiAgendaRaw.filter((p) => !agendaLineTooWeak(p)).slice(0, 3);
const missing = 3 - agendaCore.length;
if (missing > 0) {
  const usedIds = new Set(
    agendaCore.map((line) => {
      const m = line.match(/\\/task:(\\d+)/i);
      return m ? m[1] : null;
    }).filter(Boolean)
  );
  agendaCore = agendaCore.concat(fallbackAgendaFromTasks(context.tasks, missing, usedIds)).slice(0, 3);
}
if (!agendaCore.length && context.tasks && context.tasks.length) {
  agendaCore = fallbackAgendaFromTasks(context.tasks, 3, new Set());
}
const robotAgenda = agendaCore.map((item) => '🤖 ' + item);
const finalAgendaPoints = [
  'Tour de table rapide',
  'Revue de l avancement global',
  'Points en retard ou bloques',
  'Arbitrages attendus',
  'Decisions prises',
  'Actions et prochaines echeances',
  ...robotAgenda
];

html = html
  .replaceAll('[[MEETING_DATE]]', context.meeting_date)
  .replaceAll('[[MEETING_OWNER]]', esc(context.meeting_owner))
  .replaceAll('[[NEXT_MEETING_DATE]]', context.next_meeting_date)
  .replaceAll('[[MEETING_DATE_PLUS_2]]', context.meeting_date_plus_2)
  .replaceAll('[[NOTE_TITLE]]', esc(context.note_title));

html = injectAgendaItems(html, robotAgenda);
html = replaceSection(html, '[SUGGESTED_AGENDA_START]', '[SUGGESTED_AGENDA_END]', '');
html = replaceSection(html, '[REPORT_AVANCEMENT_START]', '[REPORT_AVANCEMENT_END]', context.report_html);
html = html.replace('[VIGILANCES]', vigilanceHtml);
html = injectPointsADiscuter(html, suggested);
html = injectAnnexesLiens(html, context);
html = html
  .replaceAll('[ANNEXES_LIENS_START]', '')
  .replaceAll('[ANNEXES_LIENS_END]', '')
  .replaceAll('[POINTS_A_DISCUTER_START]', '')
  .replaceAll('[POINTS_A_DISCUTER_END]', '')
  .replaceAll('[SUGGESTED_AGENDA_START]', '')
  .replaceAll('[SUGGESTED_AGENDA_END]', '')
  .replaceAll('[REPORT_AVANCEMENT_START]', '')
  .replaceAll('[REPORT_AVANCEMENT_END]', '')
  .replaceAll('<h2>Ordre du jour suggere IA</h2>', '')
  .replaceAll('<h2>🤖 Ordre du jour suggere</h2>', '')
  .replaceAll('<h3>Points de vigilance suggeres</h3>', '<h3>⚠️ Vigilances</h3>')
  .replace(/<p>\\s*<\\/p>/g, '');

return [{
  json: {
    ...context,
    ai,
    agenda_points: finalAgendaPoints,
    html_content: html,
    createNoteInput: {
      parent_note_id: context.reports_parent_note_id,
      title: context.note_title,
      html_content: html,
      summary: 'COPIL hebdomadaire prepare automatiquement le ' + new Date().toISOString()
    },
    searchNotesInput: {
      query: context.note_title,
      space_id: context.space_id,
      limit: 20,
      offset: 0
    }
  }
}];
      `,
    },
  },
  output: [{ note_title: 'COPIL Festival Art2Rue - 2026-04-30', html_content: '<h1>...</h1>', searchNotesInput: {} }],
});

const mcpSearchExistingNote = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Search Existing COPIL Note',
    position: [2120, 250],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'search_notes' },
      inputMode: 'json',
      jsonInput: expr('{{$json.searchNotesInput}}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '[]' }] }],
});

const decideNoteUpsert = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Note Upsert',
    position: [2400, 250],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
function parseMcp(value) {
  let payload = value;
  if (payload?.content?.[0]?.text !== undefined) payload = payload.content[0].text;
  if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0].text === 'string') payload = payload[0].text;
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return payload; }
  }
  return payload;
}

const note = $('Compose COPIL Note').item.json;
const searchPayload = parseMcp($input.first().json);
const notes = Array.isArray(searchPayload) ? searchPayload : (searchPayload?.notes || searchPayload?.results || []);
const existing = notes.find(n => String(n.title || '').trim() === note.note_title);
const existingNoteId = Number(existing?.note_id || existing?.id || 0);

return [{
  json: {
    ...note,
    existing_note_id: existingNoteId,
    should_update_note: existingNoteId > 0,
    updateNoteInput: {
      note_id: existingNoteId,
      title: note.note_title,
      html_content: note.html_content
    }
  }
}];
      `,
    },
  },
  output: [{ should_update_note: false, existing_note_id: 0, createNoteInput: {}, updateNoteInput: {} }],
});

const ifNoteExists = ifElse({
  version: 2.3,
  config: {
    name: 'IF COPIL Note Exists',
    position: [2660, 250],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: 'note_exists',
            leftValue: expr('{{$json.should_update_note}}'),
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
    },
  },
});

const mcpCreateNote = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Create COPIL Note',
    position: [2920, 380],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'create_child_note' },
      inputMode: 'json',
      jsonInput: expr('{{$json.createNoteInput}}'),
      options: { timeout: 90000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"note_id":100,"url":"https://exo-qaui.meeds.io/notes/100"}' }] }],
});

const mcpUpdateNote = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Update COPIL Note',
    position: [2920, 120],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'update_note' },
      inputMode: 'json',
      jsonInput: expr('{{$json.updateNoteInput}}'),
      options: { timeout: 90000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"note_id":100,"url":"https://exo-qaui.meeds.io/notes/100"}' }] }],
});

const prepareAgendaAfterCreate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Agenda Update After Create',
    position: [3200, 380],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
function parseMcp(value) {
  let payload = value;
  if (payload?.content?.[0]?.text !== undefined) payload = payload.content[0].text;
  if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0].text === 'string') payload = payload[0].text;
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return payload; }
  }
  return payload;
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const noteContext = $('Decide Note Upsert').item.json;
const saved = parseMcp($input.first().json);
const base = String(noteContext.exo_base_url || 'https://exo-mips-ft.meeds.io').replace(/\\/+$/, '');
const noteUrl = saved?.url || saved?.link || (base + '/portal/dw/notes/' + (saved?.note_id || noteContext.existing_note_id || ''));
const agendaItems = Array.isArray(noteContext.agenda_points) ? noteContext.agenda_points : [];
const agendaHtml = agendaItems.length ? '<p><strong>Ordre du jour</strong></p><ul>' + agendaItems.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '';
return [{ json: { ...noteContext, saved_note: saved, note_url: noteUrl, agendaUpdateInput: { event_id: noteContext.agenda_parent_event_id, summary: 'COPIL hebdo - ' + noteContext.meeting_date, description: '<p>Support de reunion: <a href="' + noteUrl + '" target="_blank" rel="noopener noreferrer">' + noteContext.note_title + '</a></p><p>Prepare automatiquement depuis les taches du projet ' + noteContext.project_id + '.</p>' + agendaHtml } } }];
      `,
    },
  },
  output: [{ note_url: 'https://exo-qaui.meeds.io/notes/100', agenda_parent_event_id: 13, attendee_usernames: ['claire'], agendaUpdateInput: {} }],
});

const prepareAgendaAfterUpdate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Agenda Update After Update',
    position: [3200, 120],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
function parseMcp(value) {
  let payload = value;
  if (payload?.content?.[0]?.text !== undefined) payload = payload.content[0].text;
  if (Array.isArray(payload) && payload[0]?.type === 'text' && typeof payload[0].text === 'string') payload = payload[0].text;
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch (e) { return payload; }
  }
  return payload;
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const noteContext = $('Decide Note Upsert').item.json;
const saved = parseMcp($input.first().json);
const base = String(noteContext.exo_base_url || 'https://exo-mips-ft.meeds.io').replace(/\\/+$/, '');
const noteUrl = saved?.url || saved?.link || (base + '/portal/dw/notes/' + (saved?.note_id || noteContext.existing_note_id || ''));
const agendaItems = Array.isArray(noteContext.agenda_points) ? noteContext.agenda_points : [];
const agendaHtml = agendaItems.length ? '<p><strong>Ordre du jour</strong></p><ul>' + agendaItems.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul>' : '';
return [{ json: { ...noteContext, saved_note: saved, note_url: noteUrl, agendaUpdateInput: { event_id: noteContext.agenda_parent_event_id, summary: 'COPIL hebdo - ' + noteContext.meeting_date, description: '<p>Support de reunion: <a href="' + noteUrl + '" target="_blank" rel="noopener noreferrer">' + noteContext.note_title + '</a></p><p>Prepare automatiquement depuis les taches du projet ' + noteContext.project_id + '.</p>' + agendaHtml } } }];
      `,
    },
  },
  output: [{ note_url: 'https://exo-qaui.meeds.io/notes/100', agenda_parent_event_id: 13, attendee_usernames: ['claire'], agendaUpdateInput: {} }],
});

const mcpUpdateAgendaAfterCreate = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Update Agenda After Create',
    position: [3480, 380],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'update_agenda_event' },
      inputMode: 'json',
      jsonInput: expr('{{$json.agendaUpdateInput}}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"event_id":13}' }] }],
});

const mcpUpdateAgendaAfterUpdate = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Update Agenda After Update',
    position: [3480, 120],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'update_agenda_event' },
      inputMode: 'json',
      jsonInput: expr('{{$json.agendaUpdateInput}}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"event_id":13}' }] }],
});

const inviteParticipantsAfterCreate = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Invite Participants After Create',
    position: [3760, 380],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'invite_users_to_agenda_event' },
      inputMode: 'json',
      jsonInput: expr('{{ { event_id: $("Prepare Agenda Update After Create").item.json.agenda_parent_event_id, attendee_usernames: $("Prepare Agenda Update After Create").item.json.attendee_usernames } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"event_id":13}' }] }],
});

const inviteParticipantsAfterUpdate = node({
  type: '@n8n/n8n-nodes-langchain.mcpClient',
  version: 1,
  config: {
    name: 'MCP Invite Participants After Update',
    position: [3760, 120],
    credentials: { mcpOAuth2Api: newCredential('exo-mips-ft MCP') },
    parameters: {
      endpointUrl: expr('{{$vars.EXO_MCP_ENDPOINT || "https://exo-qaui.meeds.io/mcp-server/mcp"}}'),
      authentication: 'mcpOAuth2Api',
      tool: { __rl: true, mode: 'id', value: 'invite_users_to_agenda_event' },
      inputMode: 'json',
      jsonInput: expr('{{ { event_id: $("Prepare Agenda Update After Update").item.json.agenda_parent_event_id, attendee_usernames: $("Prepare Agenda Update After Update").item.json.attendee_usernames } }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ content: [{ type: 'text', text: '{"event_id":13}' }] }],
});

export default workflow('wf03-reporting-hebdo', 'WF03 - Preparation COPIL hebdomadaire')
  .add(manualStart)
  .to(prepareConfig)
  .to(mcpGetTemplate)
  .to(mcpListTasks)
  .to(buildAiContext)
  .to(analyzeCopil)
  .to(composeNote)
  .to(mcpSearchExistingNote)
  .to(decideNoteUpsert)
  .to(ifNoteExists
    .onTrue(mcpUpdateNote.to(prepareAgendaAfterUpdate).to(mcpUpdateAgendaAfterUpdate).to(inviteParticipantsAfterUpdate))
    .onFalse(mcpCreateNote.to(prepareAgendaAfterCreate).to(mcpUpdateAgendaAfterCreate).to(inviteParticipantsAfterCreate))
  )

  .add(weeklyPreparation)
  .to(prepareConfig);
