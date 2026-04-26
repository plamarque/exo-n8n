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
    .replace(/^\s*<h1>Weekly COPIL note template<\/h1>\s*<blockquote>[\s\S]*?<\/blockquote>/i, '')
    .replace(/^\s*<h1>Template note COPIL hebdomadaire<\/h1>\s*<blockquote>[\s\S]*?<\/blockquote>/i, '')
    .replaceAll('Ordre du jour suggere par l&#39;IA', '🤖 AI-suggested agenda')
    .replaceAll('Vigilances suggerees par l&#39;IA', '⚠️ AI watch items')
    .replaceAll('Informations de reunion', '🗓️ Meeting information')
    .replaceAll('<h2>Ordre du jour</h2>', '<h2>🧭 Agenda</h2>')
    .replaceAll('<h2>Synthese de la semaine</h2>', '<h2>📌 Week in review</h2>')
    .replaceAll('Rapport d&#39;avancement', '📊 Progress report')
    .replaceAll('<h2>Points a discuter</h2>', '<h2>💬 Discussion</h2>')
    .replaceAll('<h2>Decisions prises</h2>', '<h2>✅ Decisions</h2>')
    .replaceAll('<h2>Actions a lancer</h2>', '<h2>🎯 Action items</h2>')
    .replaceAll('<h2>Risques et points de vigilance</h2>', '<h2>⚠️ Risks and watch items</h2>')
    .replaceAll('<h2>Prochaine reunion</h2>', '<h2>📅 Next meeting</h2>')
    .replaceAll('<h2>Annexes</h2>', '<h2>📎 Annexes</h2>');
}

function enrichRefs(text) {
  return String(text || '').replace(/\bIDs?\s*[:#]?\s*(\d+)\b/gi, '/task:$1');
}

function conciseAgendaItem(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\-•\d\.\)\s]+/, '')
    .trim();
  if (!clean) return '';
  const first = clean.split(/[;:.]/)[0].trim();
  return first.slice(0, 90);
}

function injectAgendaItems(sourceHtml, items) {
  const start = sourceHtml.indexOf('<ol>');
  const end = sourceHtml.indexOf('</ol>');
  if (start === -1 || end === -1 || end <= start) return sourceHtml;
  const extra = items.length ? items.map(item => '<li>' + esc(item) + '</li>').join('') : '';
  return sourceHtml.slice(0, end) + extra + sourceHtml.slice(end);
}

function buildDiscussionSectionHtml(suggested) {
  const intro = '<p><em>Section the AI can pre-fill; adjust with participants.</em></p>';
  const iaItems = (Array.isArray(suggested) ? suggested : [])
    .map(s => conciseAgendaItem(enrichRefs(String(s))))
    .filter(Boolean);
  let body;
  if (iaItems.length) {
    body = '<p><strong>Items from AI suggestions (agenda)</strong></p><ul>'
      + iaItems.map(t => '<li>' + esc(t) + '</li>').join('')
      + '</ul>';
  } else {
    body = '<p><em>No dedicated AI item this week. Use the slots below during the meeting.</em></p>';
  }
  const placeholders = '<p><strong>Fill in during the meeting</strong></p><ul>'
    + ['<li><em>Other topic (participants)</em></li>', '<li><em>Other topic (participants)</em></li>', '<li><em>Other topic (participants)</em></li>'].join('')
    + '</ul>';
  return intro + body + placeholders;
}

function injectDiscussionSection(html, suggested) {
  const inner = buildDiscussionSectionHtml(suggested);
  const startM = '[POINTS_A_DISCUTER_START]';
  const endM = '[POINTS_A_DISCUTER_END]';
  if (html.indexOf(startM) !== -1 && html.indexOf(endM) !== -1) {
    return replaceSection(html, startM, endM, inner);
  }
  const needles = ['<h2>💬 Points a discuter</h2>', '<h2>Points a discuter</h2>', '<h2>💬 Discussion</h2>', '<h2>Discussion</h2>'];
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

function buildAnnexesLinksHtml(ctx) {
  const base = String(ctx.exo_base_url || 'https://exo-mips-ft.meeds.io').replace(/\/+$/, '');
  const slug = String(ctx.space_slug || 'festival_art2rue');
  const pid = Number(ctx.project_id || 3);
  const parentId = Number(ctx.agenda_parent_event_id || 13);
  const occ = encodeURIComponent(new Date(String(ctx.meeting_start)).toISOString());
  const projectUrl = base + '/portal/g/:spaces:' + slug + '/home/tasks/projectDetail/' + pid;
  const agendaUrl = base + '/portal/g/:spaces:' + slug + '/home/agenda?parentId=' + parentId + '&occurrenceId=' + occ;
  return '<p><strong>Useful links</strong></p><ul>'
    + '<li><a href="' + esc(projectUrl) + '" target="_blank" rel="noopener noreferrer">Project — task board</a></li>'
    + '<li><a href="' + esc(agendaUrl) + '" target="_blank" rel="noopener noreferrer">Agenda — meeting occurrence</a></li>'
    + '</ul>';
}

function injectAnnexesLinks(html, ctx) {
  const inner = buildAnnexesLinksHtml(ctx);
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
  html = '<h1>[[NOTE_TITLE]]</h1><h2>🤖 AI-suggested agenda</h2><p>[SUGGESTED_AGENDA_START][SUGGESTED_AGENDA_END]</p><h2>📊 Progress report</h2><p>[REPORT_AVANCEMENT_START][REPORT_AVANCEMENT_END]</p><h2>⚠️ Watch items</h2><p>[VIGILANCES]</p><h2>💬 Discussion</h2><p>[POINTS_A_DISCUTER_START][POINTS_A_DISCUTER_END]</p><h2>✅ Decisions</h2><p></p><h2>🎯 Actions and owners</h2><p></p><h2>📎 Annexes</h2><p>[ANNEXES_LIENS_START][ANNEXES_LIENS_END]</p>';
}

const vigilanceHtml = '<ul>' + (vigilances.length ? vigilances : ['No significant watch item detected automatically.']).map(item => '<li>' + esc(enrichRefs(item)) + '</li>').join('') + '</ul>';
const robotAgenda = suggested
  .map(item => conciseAgendaItem(enrichRefs(item)))
  .filter(Boolean)
  .slice(0, 3)
  .map(item => '🤖 ' + item);
const finalAgendaPoints = [
  'Short round robin',
  'Overall progress review',
  'Overdue or blocked items',
  'Decisions expected',
  'Decisions made',
  'Actions and next due dates',
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
html = injectDiscussionSection(html, suggested);
html = injectAnnexesLinks(html, context);
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
  .replaceAll('<h2>🤖 AI-suggested agenda</h2>', '')
  .replaceAll('<h2>🤖 Ordre du jour suggere</h2>', '')
  .replaceAll('<h3>Points de vigilance suggeres</h3>', '<h3>⚠️ Watch items</h3>')
  .replace(/<p>\s*<\/p>/g, '');

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
      summary: 'Weekly COPIL auto-prepared on ' + new Date().toISOString()
    },
    searchNotesInput: {
      query: context.note_title,
      space_id: context.space_id,
      limit: 20,
      offset: 0
    }
  }
}];
