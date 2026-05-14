import { NextRequest, NextResponse } from 'next/server';
import { runRealTask } from '../stream/route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { model, task, walletAddress } = body as { model?: string; task?: 'market' | 'wallet'; walletAddress?: string };
    const success = await runRealTask({ model, task, walletAddress });
    if (!success) {
      return NextResponse.json({ error: 'No free model API keys configured or task failed' }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
