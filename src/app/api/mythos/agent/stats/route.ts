import { NextResponse } from 'next/server';
import { getMythosAgentStats } from '@/lib/mythos/agentic-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getMythosAgentStats());
}
