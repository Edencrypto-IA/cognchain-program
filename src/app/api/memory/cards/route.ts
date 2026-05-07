import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const AGENT_TAGS = [
  '[AGENT_INSIGHT]', '[INTELLIGENCE_SERVICE]', '[CONGCHAIN PAY',
  '[VEGA ', '[NEXUS ', '[NOVA ', '[ECHO ', '[APEX ', '[ARES ', '[FLUX ', '[ZION ',
];

function isAgentMemory(content: string) {
  const t = content.trimStart();
  return AGENT_TAGS.some(tag => t.startsWith(tag));
}

export interface AgentCard {
  hash: string;
  model: string;
  timestamp: number;
  score: number | null;
  service: string;
  category: string;
  solPaid: number;
  snippet: string;
  fullContent: string;
  tag: 'intelligence' | 'insight' | 'pay' | 'agent';
}

function parse(m: { hash: string; content: string; model: string; timestamp: number; score: number | null }): AgentCard {
  const lines = m.content.split('\n');
  let service = '', category = '', solPaid = 0, tag: AgentCard['tag'] = 'agent';

  if (m.content.startsWith('[INTELLIGENCE_SERVICE]')) {
    tag      = 'intelligence';
    service  = lines.find(l => l.startsWith('Serviço:'))?.replace('Serviço: ', '') ?? 'Serviço';
    category = lines.find(l => l.startsWith('Categoria:'))?.replace('Categoria: ', '') ?? '';
    const paidLine = lines.find(l => l.startsWith('Pago:')) ?? '';
    const m2 = paidLine.match(/([\d.]+)\s*SOL/);
    solPaid  = m2 ? parseFloat(m2[1]) : 0;
  } else if (m.content.startsWith('[AGENT_INSIGHT]')) {
    tag      = 'insight';
    service  = lines.find(l => l.startsWith('Tópico:'))?.replace('Tópico: ', '') ?? 'Insight';
    category = lines.find(l => l.startsWith('Categoria:'))?.replace('Categoria: ', '') ?? '';
  } else if (m.content.startsWith('[CONGCHAIN PAY')) {
    tag      = 'pay';
    const urlLine = lines.find(l => l.startsWith('URL:'))?.replace('URL: ', '') ?? '';
    const solLine = lines.find(l => l.includes('SOL ·')) ?? '';
    const mSol = solLine.match(/([\d.]+)\s*SOL/);
    service  = urlLine ? `Pay → ${new URL(urlLine.trim()).hostname}` : 'Pay API';
    solPaid  = mSol ? parseFloat(mSol[1]) : 0;
    category = 'Pay';
  } else {
    service  = lines[0]?.replace(/^\[/, '').replace(/\].*$/, '') ?? 'Agente';
    category = 'Agente';
  }

  // Body starts after header block (skip tag lines)
  const bodyStart = m.content.startsWith('[INTELLIGENCE_SERVICE]') || m.content.startsWith('[AGENT_INSIGHT]') ? 6 : 2;
  const snippet = lines.slice(bodyStart).join(' ').replace(/\*\*/g, '').trim().slice(0, 160);

  return { hash: m.hash, model: m.model, timestamp: m.timestamp, score: m.score, service, category, solPaid, snippet, fullContent: m.content, tag };
}

export async function GET() {
  const all = await db.memory.findMany({
    where: { OR: AGENT_TAGS.map(t => ({ content: { startsWith: t } })) },
    orderBy: { timestamp: 'desc' },
    take: 80,
    select: { hash: true, content: true, model: true, timestamp: true, score: true },
  });

  return NextResponse.json({ cards: all.map(parse) });
}
