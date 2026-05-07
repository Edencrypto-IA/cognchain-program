import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hours = parseInt(searchParams.get('hours') ?? '24');
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const since = Math.floor(Date.now() / 1000) - hours * 3600;

  const memories = await db.memory.findMany({
    where: { content: { startsWith: '[AGENT_INSIGHT]' }, timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  const insights = memories.map(m => {
    const lines = m.content.split('\n');
    const agent  = lines.find(l => l.startsWith('Agente:'))?.replace('Agente: ', '') ?? '';
    const topic  = lines.find(l => l.startsWith('Tópico:'))?.replace('Tópico: ', '') ?? '';
    const cat    = lines.find(l => l.startsWith('Categoria:'))?.replace('Categoria: ', '') ?? '';
    const date   = lines.find(l => l.startsWith('Data:'))?.replace('Data: ', '') ?? '';
    // Body starts after the header (5 lines: tag, agent, topic, category, date, blank)
    const body = lines.slice(6).join('\n').trim();
    return { hash: m.hash, agent, topic, category: cat, date, content: body, model: m.model, timestamp: m.timestamp };
  });

  return NextResponse.json({ insights, count: insights.length, hoursLookback: hours });
}
