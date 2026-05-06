import { NextResponse } from 'next/server';
import { getAgentSnapshots, getFiredAgents, getRecentRealEvents } from '../shared';

export async function GET() {
  return NextResponse.json({
    agents: getAgentSnapshots(),
    fired: getFiredAgents(),
    recentTasks: getRecentRealEvents(8),
    ts: Date.now(),
  });
}
