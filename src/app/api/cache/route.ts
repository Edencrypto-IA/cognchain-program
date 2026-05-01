import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats, seedFAQCache } from '@/services/cache/response-cache';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';

// GET /api/cache — stats: hits, tokens saved, top questions
export async function GET() {
  try {
    const stats = await getCacheStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST /api/cache — actions: seed_faq | clear_expired | clear_all
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'seed_faq') {
      await seedFAQCache();
      return NextResponse.json({ ok: true, message: 'FAQ cache seeded.' });
    }

    if (action === 'clear_expired') {
      const result = await db.responseCache.deleteMany({
        where: { seeded: false, expiresAt: { lt: new Date() } },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    if (action === 'clear_all') {
      const result = await db.responseCache.deleteMany({ where: { seeded: false } });
      return NextResponse.json({ ok: true, deleted: result.count, note: 'Seeded FAQ entries preserved.' });
    }

    return NextResponse.json({ error: 'Unknown action. Use: seed_faq | clear_expired | clear_all' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
