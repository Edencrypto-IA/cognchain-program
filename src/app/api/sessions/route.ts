import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const memories = await db.memory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (memories.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    const GAP_SECONDS = 30 * 60;
    const sorted = [...memories].sort((a, b) => a.timestamp - b.timestamp);

    const sessionGroups: (typeof sorted)[] = [];
    let current: typeof sorted = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].timestamp - sorted[i - 1].timestamp > GAP_SECONDS) {
        sessionGroups.push(current);
        current = [sorted[i]];
      } else {
        current.push(sorted[i]);
      }
    }
    sessionGroups.push(current);

    const now = Math.floor(Date.now() / 1000);

    const sessions = sessionGroups.reverse().slice(0, 20).map((group) => {
      const first = group[0];
      const last = group[group.length - 1];

      const rawTitle = first.content.replace(/^Q:\s*/i, '').split('\n')[0];
      const title = rawTitle.length > 55 ? rawTitle.substring(0, 55) + '...' : rawTitle || 'Conversa';

      const rawLast = last.content.replace(/^Q:\s*/i, '').split('\n')[0];
      const lastMessage = rawLast.length > 45 ? rawLast.substring(0, 45) + '...' : rawLast || '...';

      const age = now - last.timestamp;
      const timestamp =
        age < 60 ? 'Agora' :
        age < 3600 ? `${Math.floor(age / 60)}min atrás` :
        age < 86400 ? `${Math.floor(age / 3600)}h atrás` :
        age < 172800 ? 'Yesterday' :
        `${Math.floor(age / 86400)} days ago`;

      return { id: first.hash, title, lastMessage, timestamp, memoryCount: group.length };
    });

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
