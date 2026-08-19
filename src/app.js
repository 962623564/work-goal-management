import './styles.css';
import { BOARDS, id, timestamp } from './data/models.js';
import { loadState, updateState } from './data/dataStore.js';
import { extractText, ocrMode, parseGoalDocument, parseMonthlyReport, parseWeeklyReport } from './services/ocrService.js';
import { applyGoalVersion, boardName, generateReport, mergeMonthlyReport, saveMonthlyGoal, saveWeeklyFollowUp } from './logic/workflows.js';

const nav = [
  ['goals', '部门目标管理与月度拆解'], ['monthly', '月度目标跟进与整合'], ['weekly', '周度执行跟进与纪要管理'],
  ['todo', '个人 To-Do List'], ['reports', '报告生成中心'],
];
const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
let page = 'goals';
let notice = '';

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const activeProjects = (state) => state.projects.filter((item) => item.status === 'active');
const options = (state) => activeProjects(state).map((project) => `<option value="${project.id}">${esc(boardName(project.boardId))} · ${esc(project.name)}</option>`).join('');
const header = (title, description, action = '') => `<header class="page-head"><div><h1>${title}</h1><p>${description}</p></div>${action}</header>`;
const empty = (text) => `<div class="empty">${text}</div>`;
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';

function goalPage(state) {
  const latest = state.goalVersions.at(-1);
  const boardCards = BOARDS.map((board) => {
    const current = state.projects.filter((project) => project.boardId === board.id && project.status === 'active');
    const archived = state.projects.filter((project) => project.boardId === board.id && project.status === 'archived');
    return `<article class="card board"><h3>${board.name}</h3><div class="label">当前专项</div>${current.length ? current.map((item) => `<span class="pill">${esc(item.name)}</span>`).join('') : '<p class="muted">等待目标文件识别</p>'}<div class="label archived-label">历史专项</div>${archived.length ? archived.map((item) => `<span class="pill archived">${esc(item.name)}</span>`).join('') : '<p class="muted">暂无历史专项</p>'}</article>`;
  }).join('');
  return header('部门目标管理与月度拆解', '最新版部门目标是当前专项清单的唯一权威来源。', '<label class="button">上传新版部门目标<input id="goal-upload" type="file" accept=".png,.jpg,.jpeg,.pdf,.xls,.xlsx,.doc,.docx,.txt" hidden></label>') +
    `<section class="stats"><article><span>当前版本</span><strong>${latest?.version || '未上传'}</strong></article><article><span>当前专项</span><strong>${activeProjects(state).length}</strong></article><article><span>历史专项</span><strong>${state.projects.filter((item) => item.status === 'archived').length}</strong></article></section>
    <div class="info">OCR状态：${ocrMode}。可上传 UTF-8 文本文件体验真实结构化解析。</div>
    <section><div class="section-title"><h2>固定业务板块</h2><span>板块不可新增、修改或删除</span></div><div class="board-grid">${boardCards}</div></section>
    <section><div class="section-title"><h2>月度目标拆解</h2></div>${activeProjects(state).length ? `<form id="monthly-goal-form" class="inline-form"><input name="month" type="month" value="${month}" required><select name="projectId" required>${options(state)}</select><input name="target" placeholder="输入该月目标" required><button>保存拆解</button></form>` : empty('上传目标并识别专项后，即可按月拆解。')}
    ${state.monthlyGoals.length ? `<div class="table-wrap"><table><thead><tr><th>月份</th><th>板块 / 专项</th><th>目标</th><th>进度</th></tr></thead><tbody>${state.monthlyGoals.map((item) => { const project = state.projects.find((p) => p.id === item.projectId); return `<tr><td>${item.month}</td><td>${boardName(project?.boardId)} · ${esc(project?.name)}</td><td>${esc(item.target)}</td><td>${item.progress}%</td></tr>`; }).join('')}</tbody></table></div>` : ''}</section>
    <section><div class="section-title"><h2>目标版本历史</h2></div>${latest ? `<div class="table-wrap"><table><thead><tr><th>版本</th><th>文件</th><th>上传时间</th><th>识别内容</th></tr></thead><tbody>${[...state.goalVersions].reverse().map((item) => `<tr><td>${item.version}</td><td>${esc(item.fileName)}</td><td>${formatDate(item.createdAt)}</td><td>${item.parsed.boards.reduce((sum, b) => sum + b.projects.length, 0)} 个专项</td></tr>`).join('')}</tbody></table></div>` : empty('暂无目标版本。')}</section>`;
}

function monthlyPage(state) {
  return header('月度目标跟进与整合', '整合组员月报，并与周度跟进内容自动比较、合并去重。') +
    `<section class="card form-card"><h2>上传组员月报</h2><form id="monthly-upload-form" class="stack"><div class="form-row"><input name="month" type="month" value="${month}" required><select name="projectId" required><option value="">选择板块 / 专项</option>${options(state)}</select><label class="file-field">选择月报文件<input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf,.txt" required></label></div><button ${activeProjects(state).length ? '' : 'disabled'}>识别并整合</button></form></section>
    <section><div class="section-title"><h2>月度跟进结果</h2></div>${state.monthlyFollowUps.length ? `<div class="table-wrap"><table><thead><tr><th>月份</th><th>专项</th><th>完成情况</th><th>新增内容</th><th>下月计划</th></tr></thead><tbody>${[...state.monthlyFollowUps].reverse().map((item) => { const project = state.projects.find((p) => p.id === item.projectId); return `<tr><td>${item.month}</td><td>${boardName(project?.boardId)} · ${esc(project?.name)}</td><td>${item.completed.map(esc).join('；') || '—'}</td><td><span class="status">${item.added.length} 条</span></td><td>${item.nextPlan.map(esc).join('；') || '—'}</td></tr>`; }).join('')}</tbody></table></div>` : empty('尚未整合组员月报。')}</section>`;
}

function weeklyPage(state) {
  return header('周度执行跟进与纪要管理', '把个人维度周报转换为专项维度，并同步沉淀周会纪要。') +
    `<section class="card form-card"><h2>上传并聚合组员周报</h2><form id="weekly-upload-form" class="stack"><div class="form-row"><input name="week" type="week" required><select name="projectId" required><option value="">选择归属专项</option>${options(state)}</select><label class="file-field">选择周报文件<input name="file" type="file" accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.txt" required></label></div><div class="form-row"><input name="issues" placeholder="问题点"><input name="findings" placeholder="发现点"><input name="support" placeholder="需要支持"></div><button ${activeProjects(state).length ? '' : 'disabled'}>生成专项跟进与纪要</button></form></section>
    <section><div class="section-title"><h2>专项维度周会跟进</h2><span>保存后作为月度整合数据源</span></div>${state.weeklyFollowUps.length ? `<div class="table-wrap"><table><thead><tr><th>周</th><th>板块 / 专项</th><th>本周进展</th><th>问题 / 发现</th><th>需要支持</th></tr></thead><tbody>${[...state.weeklyFollowUps].reverse().map((item) => { const project = state.projects.find((p) => p.id === item.projectId); return `<tr><td>${item.week}</td><td>${boardName(project?.boardId)} · ${esc(project?.name)}</td><td>${item.progress.map(esc).join('；')}</td><td>${esc(item.issues || '—')} / ${esc(item.findings || '—')}</td><td>${esc(item.support || '—')}</td></tr>`; }).join('')}</tbody></table></div>` : empty('尚未生成专项维度周会跟进。')}</section>`;
}

function todoPage(state) {
  const [year, mon] = month.split('-').map(Number); const first = new Date(year, mon - 1, 1); const days = new Date(year, mon, 0).getDate(); const pad = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: pad }, () => '<div class="calendar-day blank"></div>').concat(Array.from({ length: days }, (_, index) => { const date = `${month}-${String(index + 1).padStart(2, '0')}`; const items = state.todos.filter((todo) => todo.date === date); return `<div class="calendar-day"><b>${index + 1}</b>${items.map((item) => `<div class="todo-item ${item.completed ? 'done' : ''}" title="${esc(item.title)}"><button class="todo-toggle" data-id="${item.id}">✓</button><span>${esc(item.title)}</span><button class="todo-delete" data-id="${item.id}">×</button></div>`).join('')}</div>`; }));
  return header('个人 To-Do List', '每日完成与待办事项自动进入周报、月报数据源。') + `<section class="card form-card"><form id="todo-form" class="form-row"><input name="date" type="date" value="${today}" required><select name="projectId"><option value="">不关联专项</option>${options(state)}</select><input name="title" placeholder="输入今日完成事项或待办事项" required><button>新增事项</button></form></section><section><div class="section-title"><h2>${month} 月历</h2></div><div class="calendar week-head">${['周一','周二','周三','周四','周五','周六','周日'].map((day) => `<div>${day}</div>`).join('')}</div><div class="calendar">${cells.join('')}</div></section>`;
}

function reportPage(state) {
  return header('报告生成中心', '仅生成周报和月报；每一项内容均保留原始记录来源。') + `<section class="report-actions"><article class="card"><h2>周报</h2><p>聚合指定日期范围内的个人 To-Do。</p><form id="weekly-report-form" class="stack"><input name="start" type="date" required><input name="end" type="date" required><button>生成周报</button></form></article><article class="card"><h2>月报</h2><p>聚合当月 To-Do 与月度目标跟进。</p><form id="monthly-report-form" class="stack"><input name="month" type="month" value="${month}" required><button>生成月报</button></form></article></section><section><div class="section-title"><h2>已生成报告</h2></div>${state.generatedReports.length ? state.generatedReports.map((report) => `<article class="card report"><div class="report-title"><h3>${report.type === 'weekly' ? '周报' : '月报'} · ${report.period}</h3><span>${formatDate(report.createdAt)}</span></div>${report.items.length ? `<ul>${report.items.map((item) => { const sources = state.reportSources.filter((source) => source.reportItemId === item.id); return `<li><b>${esc(item.content)}</b><small>来源：${sources.map((source) => esc(source.label)).join('、')}</small></li>`; }).join('')}</ul>` : '<p class="muted">该周期暂无原始记录。</p>'}</article>`).join('') : empty('尚未生成报告。')}</section>`;
}

const renderers = { goals: goalPage, monthly: monthlyPage, weekly: weeklyPage, todo: todoPage, reports: reportPage };

function render() {
  const state = loadState();
  document.querySelector('#app').innerHTML = `<aside><div class="brand"><span>W</span><div>工作维度目标管理系统<small>部门负责人工作全流程管理</small></div></div><nav>${nav.map(([key, label], index) => `<button data-page="${key}" class="${page === key ? 'active' : ''}"><i>0${index + 1}</i>${label}</button>`).join('')}</nav><div class="chain">部门目标 → 月度拆解<br>→ 周度执行 → To-Do<br>→ 周报 / 月报</div></aside><main>${notice ? `<div class="notice">${esc(notice)}</div>` : ''}${renderers[page](state)}</main>`;
  bindEvents();
}

async function withFile(form, parser, callback) {
  const data = new FormData(form); const file = data.get('file'); const text = await extractText(file); callback(data, file, parser(text), text);
}

function bindEvents() {
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => { page = button.dataset.page; notice = ''; render(); }));
  document.querySelector('#goal-upload')?.addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const text = await extractText(file); const parsed = parseGoalDocument(text); updateState((state) => applyGoalVersion(state, file, parsed, text)); notice = `已保存 ${file.name} 并生成新目标版本。`; render(); });
  document.querySelector('#monthly-goal-form')?.addEventListener('submit', (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); updateState((state) => saveMonthlyGoal(state, data)); notice = '月度目标拆解已保存。'; render(); });
  document.querySelector('#monthly-upload-form')?.addEventListener('submit', async (event) => { event.preventDefault(); await withFile(event.target, parseMonthlyReport, (data, file, parsed, rawText) => updateState((state) => mergeMonthlyReport(state, { month: data.get('month'), projectId: data.get('projectId'), fileName: file.name, rawText, ...parsed }))); notice = '组员月报已识别、匹配并完成去重整合。'; render(); });
  document.querySelector('#weekly-upload-form')?.addEventListener('submit', async (event) => { event.preventDefault(); await withFile(event.target, parseWeeklyReport, (data, file, parsed, rawText) => { const week = data.get('week'); updateState((state) => saveWeeklyFollowUp(state, { week, month: week.slice(0, 4) + '-' + String(new Date(`${week.slice(0, 4)}-01-04`).getMonth() + 1).padStart(2, '0'), projectId: data.get('projectId'), fileName: file.name, rawText, progress: parsed.progress, issues: data.get('issues'), findings: data.get('findings'), support: data.get('support') })); }); notice = '个人周报已转换为专项维度并生成周会纪要。'; render(); });
  document.querySelector('#todo-form')?.addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); updateState((state) => state.todos.push({ id: id('todo'), ...values, completed: false, createdAt: timestamp() })); notice = '个人事项已保存，并进入报告数据源。'; render(); });
  document.querySelectorAll('.todo-toggle').forEach((button) => button.addEventListener('click', () => { updateState((state) => { const todo = state.todos.find((item) => item.id === button.dataset.id); todo.completed = !todo.completed; }); render(); }));
  document.querySelectorAll('.todo-delete').forEach((button) => button.addEventListener('click', () => { updateState((state) => { state.todos = state.todos.filter((item) => item.id !== button.dataset.id); }); render(); }));
  document.querySelector('#weekly-report-form')?.addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); updateState((state) => generateReport(state, 'weekly', values)); notice = '周报已生成，内容可查看来源。'; render(); });
  document.querySelector('#monthly-report-form')?.addEventListener('submit', (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); updateState((state) => generateReport(state, 'monthly', values)); notice = '月报已生成，内容可查看来源。'; render(); });
}

render();
