import { NextRequest, NextResponse } from 'next/server';
import { FORGE_ALLOWED_COMMANDS, type ForgeCommand, runAllowlistedCommand } from '@/lib/forge/commands';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  if (typeof body.command !== 'string' || !FORGE_ALLOWED_COMMANDS.has(body.command as ForgeCommand)) {
    return NextResponse.json({ error: 'Command is not allowlisted' }, { status: 400 });
  }

  const result = await runAllowlistedCommand(body.command as ForgeCommand);
  return NextResponse.json({
    status: result.status,
    output: result.output,
    durationMs: result.durationMs,
  });
}
