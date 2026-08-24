/**
 * Mythos task scheduler store — pure persistence (memory + JSON file).
 * No heavy imports, so it is unit-testable. Execution lives in task-scheduler.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { MythosChannel } from './notify';

export interface MythosScheduledTask {
  id: string;
  command: string;
  intervalMinutes: number;
  channel: MythosChannel;
  target: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
  lastStatus: 'ok' | 'error' | null;
  lastSummary: string | null;
}

const STORE_PATH = path.resolve(process.cwd(), 'db', 'mythos-tasks.json');
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 24 * 60;
const MAX_TASKS = 50;

let store: MythosScheduledTask[] = [];
let loaded = false;

function isValidTask(value: unknown): value is MythosScheduledTask {
  if (!value || typeof value !== 'object') return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === 'string' &&
    typeof task.command === 'string' &&
    typeof task.intervalMinutes === 'number' &&
    (task.channel === 'telegram' || task.channel === 'whatsapp') &&
    typeof task.target === 'string'
  );
}

export function loadTaskStore(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as unknown;
      if (Array.isArray(raw)) store = raw.filter(isValidTask).slice(0, MAX_TASKS);
    }
  } catch {
    store = [];
  }
}

export function persistTaskStore(): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // Persistência é best-effort.
  }
}

function taskId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function listScheduledTasks(): MythosScheduledTask[] {
  loadTaskStore();
  return [...store].sort((a, b) => a.createdAt - b.createdAt);
}

export function addScheduledTask(input: {
  command: string;
  intervalMinutes: number;
  channel: MythosChannel;
  target: string;
}): { ok: true; task: MythosScheduledTask } | { ok: false; error: string } {
  loadTaskStore();
  const command = input.command.trim();
  if (command.length < 3 || command.length > 2000) return { ok: false, error: 'Comando deve ter entre 3 e 2000 caracteres.' };
  const interval = Math.round(input.intervalMinutes);
  if (!Number.isFinite(interval) || interval < MIN_INTERVAL_MINUTES || interval > MAX_INTERVAL_MINUTES) {
    return { ok: false, error: `Intervalo deve ser entre ${MIN_INTERVAL_MINUTES} min e ${MAX_INTERVAL_MINUTES} min.` };
  }
  const target = input.target.trim();
  if (!target) return { ok: false, error: 'Destino (chatId ou telefone) é obrigatório.' };
  if (store.length >= MAX_TASKS) return { ok: false, error: `Máximo de ${MAX_TASKS} tarefas agendadas.` };

  const task: MythosScheduledTask = {
    id: taskId(),
    command,
    intervalMinutes: interval,
    channel: input.channel,
    target,
    enabled: true,
    createdAt: Date.now(),
    lastRunAt: null,
    lastStatus: null,
    lastSummary: null,
  };
  store.push(task);
  persistTaskStore();
  return { ok: true, task };
}

export function removeScheduledTask(id: string): boolean {
  loadTaskStore();
  const before = store.length;
  store = store.filter(task => task.id !== id);
  if (store.length !== before) {
    persistTaskStore();
    return true;
  }
  return false;
}

export function getDueTasks(now = Date.now()): MythosScheduledTask[] {
  loadTaskStore();
  return store.filter(task => task.enabled && (task.lastRunAt === null || now - task.lastRunAt >= task.intervalMinutes * 60_000));
}

export function markTaskRunning(id: string, at = Date.now()): void {
  const index = store.findIndex(task => task.id === id);
  if (index >= 0) store[index].lastRunAt = at;
}

export function updateTaskResult(id: string, status: 'ok' | 'error', summary: string | null): void {
  const task = store.find(item => item.id === id);
  if (task) {
    task.lastStatus = status;
    task.lastSummary = summary ? summary.slice(0, 300) : null;
    persistTaskStore();
  }
}

export function resetSchedulerStoreForTest(): void {
  store = [];
  loaded = false;
  try {
    fs.unlinkSync(STORE_PATH);
  } catch {
    // Arquivo pode não existir.
  }
}
