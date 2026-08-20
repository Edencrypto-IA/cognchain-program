import { NextRequest } from 'next/server';
import { runMythosAgenticLoop, type MythosAgenticEvent } from '@/lib/mythos/agentic-run';
import { checkRateLimit, Limits, safeErrorMessage } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encodeEvent(event: MythosAgenticEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(request: NextRequest) {
  let body: { command?: unknown; model?: unknown; maxIterations?: unknown };
  try {
    body = await request.json() as { command?: unknown; model?: unknown; maxIterations?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const rawCommand = typeof body.command === 'string' ? body.command : '';
  const command = rawCommand.trim().slice(0, Limits.MAX_PROMPT_LENGTH);
  if (!command) {
    return new Response(JSON.stringify({ error: 'Missing command' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(ip, '/api/mythos/agent/run');
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  const model = typeof body.model === 'string' && body.model.trim() ? body.model : undefined;
  const maxIterations = typeof body.maxIterations === 'number' ? body.maxIterations : undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: MythosAgenticEvent) => {
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          /* stream closed */
        }
      };
      try {
        await runMythosAgenticLoop(command, emit, { model, maxIterations });
      } catch (error) {
        emit({ type: 'error', message: safeErrorMessage(error) });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
