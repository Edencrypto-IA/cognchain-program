import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const ALLOWED_COMMANDS = new Set(['npm run lint', 'npm run build']);

type CommandBody = {
  command?: unknown;
};

export async function POST(request: NextRequest) {
  let body: CommandBody;
  try {
    body = await request.json() as CommandBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.command !== 'string' || !ALLOWED_COMMANDS.has(body.command)) {
    return NextResponse.json({ error: 'Command is not allowlisted' }, { status: 400 });
  }

  const script = body.command === 'npm run build' ? 'build' : 'lint';
  try {
    const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = await execFileAsync(npmBinary, ['run', script], {
      cwd: process.cwd(),
      timeout: script === 'build' ? 180_000 : 90_000,
      maxBuffer: 1_400_000,
      windowsHide: true,
    });
    return NextResponse.json({
      status: 'complete',
      output: `${result.stdout}\n${result.stderr}`.trim(),
    });
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json({
      status: 'error',
      output: `${detail.stdout ?? ''}\n${detail.stderr ?? ''}\n${detail.message ?? ''}`.trim(),
    });
  }
}
