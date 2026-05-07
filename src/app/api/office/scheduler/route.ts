import { NextRequest, NextResponse } from 'next/server';
import { setSchedulerActive, isSchedulerActive } from '../stream/route';

export async function GET() {
  return NextResponse.json({ active: isSchedulerActive() });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json() as { action: 'start' | 'stop' };
  if (action === 'start') {
    setSchedulerActive(true);
    return NextResponse.json({ active: true });
  }
  if (action === 'stop') {
    setSchedulerActive(false);
    return NextResponse.json({ active: false });
  }
  return NextResponse.json({ error: 'action must be start or stop' }, { status: 400 });
}
