import { BOARDS, id, timestamp } from '../data/models.js';

export function applyGoalVersion(state, file, parsed, rawText) {
  const createdAt = timestamp();
  const version = `V${state.goalVersions.length + 1}.0`;
  const goalVersion = { id: id('goal-version'), version, fileName: file.name, fileType: file.type, fileSize: file.size, createdAt, rawText, parsed };
  state.goalVersions.push(goalVersion);
  const incoming = new Set();
  parsed.boards.forEach((board) => board.projects.forEach((name) => {
    const key = `${board.id}:${name}`;
    incoming.add(key);
    const existing = state.projects.find((project) => project.boardId === board.id && project.name === name);
    if (existing) {
      existing.status = 'active'; existing.archivedAt = null; existing.version = version;
    } else {
      const project = { id: id('project'), name, boardId: board.id, status: 'active', version, createdAt, archivedAt: null };
      state.projects.push(project);
      state.projectHistory.push({ id: id('project-history'), projectId: project.id, action: 'created', version, createdAt });
    }
  }));
  state.projects.filter((project) => project.status === 'active').forEach((project) => {
    if (!incoming.has(`${project.boardId}:${project.name}`)) {
      project.status = 'archived'; project.archivedAt = createdAt;
      state.projectHistory.push({ id: id('project-history'), projectId: project.id, action: 'archived', version, createdAt });
    }
  });
  return goalVersion;
}

export function saveMonthlyGoal(state, values) {
  state.monthlyGoals.push({ id: id('monthly-goal'), ...values, progress: 0, createdAt: timestamp() });
}

export function mergeMonthlyReport(state, values) {
  const weeklyText = state.weeklyFollowUps.filter((item) => item.month === values.month && item.projectId === values.projectId).flatMap((item) => item.progress);
  const normal = (text) => text.replace(/[\s，。,.]/g, '').toLowerCase();
  const existing = values.completed.filter((item) => weeklyText.some((weekly) => normal(weekly).includes(normal(item)) || normal(item).includes(normal(weekly))));
  const added = values.completed.filter((item) => !existing.includes(item));
  state.memberMonthlyReports.push({ id: id('monthly-report'), ...values, existing, added, createdAt: timestamp() });
  state.monthlyFollowUps.push({ id: id('monthly-followup'), month: values.month, projectId: values.projectId, completed: [...new Set([...existing, ...added])], added, nextPlan: values.nextPlan, weeklySources: weeklyText, createdAt: timestamp() });
}

export function saveWeeklyFollowUp(state, values) {
  const followUp = { id: id('weekly-followup'), ...values, createdAt: timestamp() };
  state.weeklyFollowUps.push(followUp);
  state.meetingMinutes.push({ id: id('minutes'), weeklyFollowUpId: followUp.id, week: values.week, projectId: values.projectId, createdAt: timestamp() });
}

export function generateReport(state, type, period) {
  const sourceRows = type === 'weekly'
    ? state.todos.filter((todo) => todo.date >= period.start && todo.date <= period.end)
    : [...state.todos.filter((todo) => todo.date.startsWith(period.month)), ...state.monthlyFollowUps.filter((item) => item.month === period.month)];
  const report = { id: id('report'), type, period: type === 'weekly' ? `${period.start} 至 ${period.end}` : period.month, items: [], createdAt: timestamp() };
  sourceRows.forEach((source) => {
    const content = source.title || source.completed?.join('；') || '工作跟进记录';
    const itemId = id('report-item'); report.items.push({ id: itemId, content });
    state.reportSources.push({ id: id('report-source'), reportId: report.id, reportItemId: itemId, sourceType: source.title ? 'TodoItem' : 'MonthlyFollowUp', sourceId: source.id, label: source.title ? `${source.date} To-Do` : `${source.month} 月度跟进` });
  });
  state.generatedReports.unshift(report);
}

export const boardName = (boardId) => BOARDS.find((board) => board.id === boardId)?.name || '—';
