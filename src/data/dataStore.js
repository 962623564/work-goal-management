import { initialState } from './models.js';

const STORAGE_KEY = 'work-goal-management-v1';

export function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(initialState);
  try {
    return { ...structuredClone(initialState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(initialState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('work-goals:changed'));
  return state;
}

export function updateState(mutator) {
  const state = loadState();
  mutator(state);
  return saveState(state);
}
