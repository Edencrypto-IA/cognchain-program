/**
 * Forge safe command execution — allowlist only, no shell, bounded resources.
 * Shared by /api/forge/command/run and the agentic loop verification phase.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ForgeCommand = 'npm run lint' | 'npm run build';

export const FORGE_ALLOWED_COMMANDS = new Set<ForgeCommand>(['npm run lint', 'npm run build']);

export const FORGE_COMMAND_TIMEOUTS: Record<ForgeCommand, number> = {
  'npm run lint': 90_000,
  'npm run build': 180_000,
};

export interface ForgeCommandResult {
  command: ForgeCommand;
  status: 'complete' | 'error';
  output: string;
  durationMs: number;
}

/**
 * Run one of the allowlisted commands via execFile (never exec/shell).
 * Returns a bounded output string; never throws for command failures.
 */
export async function runAllowlistedCommand(command: ForgeCommand): Promise<ForgeCommandResult> {
  const startedAt = Date.now();
  const script = command === 'npm run build' ? 'build' : 'lint';
  try {
    const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = await execFileAsync(npmBinary, ['run', script], {
      cwd: process.cwd(),
      timeout: FORGE_COMMAND_TIMEOUTS[command],
      maxBuffer: 1_400_000,
      windowsHide: true,
    });
    return {
      command,
      status: 'complete',
      output: `${result.stdout}\n${result.stderr}`.trim().slice(0, 60_000),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    return {
      command,
      status: 'error',
      output: `${detail.stdout ?? ''}\n${detail.stderr ?? ''}\n${detail.message ?? ''}`.trim().slice(0, 60_000),
      durationMs: Date.now() - startedAt,
    };
  }
}
