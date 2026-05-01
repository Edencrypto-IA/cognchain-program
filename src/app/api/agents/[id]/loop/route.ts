import { NextRequest, NextResponse } from 'next/server';
import {
  startAutonomousLoop,
  stopAutonomousLoop,
  getLoopStatus,
  triggerLoopOnce,
} from '@/services/agents/autonomous-loop';
import { safeErrorMessage } from '@/lib/security';

// GET — Get loop status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const status = getLoopStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST — Start/stop loop or trigger once
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { command, intervalMs } = body;

    switch (command) {
      case 'start': {
        const interval = Math.max(Number(intervalMs) || 60_000, 10_000); // min 10s
        startAutonomousLoop(id, interval);
        return NextResponse.json({
          success: true,
          message: `Autonomous loop started for agent ${id} (interval: ${interval / 1000}s)`,
          status: getLoopStatus(id),
        });
      }
      case 'stop': {
        const stopped = stopAutonomousLoop(id);
        return NextResponse.json({
          success: stopped,
          message: stopped ? `Autonomous loop stopped for agent ${id}` : 'Loop was not running',
          status: getLoopStatus(id),
        });
      }
      case 'trigger': {
        const result = await triggerLoopOnce(id);
        return NextResponse.json({
          success: true,
          message: `Triggered one loop iteration for agent ${id}`,
          result,
        });
      }
      default:
        return NextResponse.json({ error: 'command must be "start", "stop", or "trigger"' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
