import { BOARDS } from '../data/models.js';

export async function extractText(file) {
  if (file.type.startsWith('text/') || /\.(txt|csv|md)$/i.test(file.name)) return file.text();
  return `[模拟OCR待替换]\n文件：${file.name}\n请在识别结果中按“板块名称：专项名称”补充内容。`;
}

function lines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function parseGoalDocument(text) {
  const parsed = Object.fromEntries(BOARDS.map((board) => [board.name, []]));
  let currentBoard = null;
  for (const line of lines(text)) {
    const board = BOARDS.find((item) => line.includes(item.name));
    if (board) {
      currentBoard = board.name;
      const inline = line.split(/[：:]/).slice(1).join(':').trim();
      if (inline) parsed[currentBoard].push(...inline.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean));
      continue;
    }
    if (currentBoard && !line.startsWith('[') && !line.startsWith('文件：')) {
      parsed[currentBoard].push(line.replace(/^[-•\d.、\s]+/, '').trim());
    }
  }
  return { boards: BOARDS.map((board) => ({ ...board, projects: [...new Set(parsed[board.name])] })) };
}

export function parseMonthlyReport(text) {
  const parts = text.split(/下月(?:工作)?计划[：:]?/);
  return { completed: lines(parts[0].replace(/本月完成(?:情况)?[：:]?/, '')), nextPlan: lines(parts[1] || '') };
}

export function parseWeeklyReport(text) {
  return { progress: lines(text), issues: [], plan: [] };
}

export const ocrMode = '模拟适配器（文本文件真实解析，图片/PDF待接入OCR API）';
