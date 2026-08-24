/**
 * Mythos task scheduler — autonomous scheduled tasks executor.
 *
 * A task runs the agentic loop at a fixed interval and delivers the result to
 * Telegram or WhatsApp. Persistence lives in task-scheduler-store.ts.
 */

import { runMythosForChannel } from './agent-channel';
import { deliverToChannel } from './notify';
import {
  getDueTasks,
  listScheduledTasks,
  addScheduledTask,
  removeScheduledTask,
  markTaskRunning,
  updateTaskResult,
} from './task-scheduler-store';
import type { MythosScheduledTask } from './task-scheduler-store';

export type { MythosScheduledTask } from './task-scheduler-store';
export { listScheduledTasks as listMythosTasks, addScheduledTask as addMythosTask, removeScheduledTask as removeMythosTask } from './task-scheduler-store';

const TICK_MS = 60_000;

let ticker: ReturnType<typeof setInterval> | null = null;

async function runTask(task: MythosScheduledTask): Promise<void> {
  const result = await runMythosForChannel(task.command);
  if (result.ok) {
    updateTaskResult(task.id, 'ok', result.text);
    const delivered = await deliverToChannel(task.channel, task.target, result.text);
    if (!delivered.ok && delivered.reason) {
      updateTaskResult(task.id, 'error', `${result.text.slice(0, 200)}\n[envio ${task.channel} falhou: ${delivered.reason}]`);
    }
  } else {
    updateTaskResult(task.id, 'error', result.text.slice(0, 300));
    await deliverToChannel(task.channel, task.target, result.text).catch(() => undefined);
  }
}

/** Run every due task once. */
export async function tickMythosTasks(): Promise<number> {
  const due = getDueTasks();
  for (const task of due) {
    markTaskRunning(task.id);
    try {
      await runTask(task);
    } catch {
      updateTaskResult(task.id, 'error', 'Falha inesperada ao executar a tarefa.');
    }
  }
  return due.length;
}

/** Start the 60s tick loop (singleton). Safe to call from any route. */
export function ensureMythosScheduler(): void {
  if (ticker) return;
  ticker = setInterval(() => {
    void tickMythosTasks().catch(() => undefined);
  }, TICK_MS);
  if (typeof ticker.unref === 'function') ticker.unref();
}

/** Test helper. */
export function resetMythosSchedulerForTest(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}
