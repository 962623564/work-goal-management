export const BOARDS = Object.freeze([
  { id: 'board-classroom', name: '赛尔课堂' },
  { id: 'board-leadership', name: '干部赋能' },
  { id: 'board-ecosystem', name: '生态赋能' },
]);

export const initialState = {
  schemaVersion: 1,
  goalVersions: [],
  projects: [],
  projectHistory: [],
  monthlyGoals: [],
  monthlyFollowUps: [],
  memberMonthlyReports: [],
  weeklyReports: [],
  weeklyFollowUps: [],
  meetingMinutes: [],
  todos: [],
  generatedReports: [],
  reportSources: [],
};

export const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const timestamp = () => new Date().toISOString();
