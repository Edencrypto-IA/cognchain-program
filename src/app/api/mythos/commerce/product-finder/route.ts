import { NextRequest, NextResponse } from 'next/server';
import { findProductOpportunities } from '@/lib/commerce/product-finder';
import { parseProductFinderPrompt } from '@/lib/commerce/product-finder-parser';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

function getIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(getIp(request), '/api/mythos/commerce/product-finder');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many Mythos product finder requests. Try again soon.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  try {
    const prompt = request.nextUrl.searchParams.get('prompt') || '';
    const query = request.nextUrl.searchParams.get('query') || '';
    const budget = Number(request.nextUrl.searchParams.get('budget') || '');
    const parsed = prompt ? parseProductFinderPrompt(prompt) : null;
    const report = await findProductOpportunities({
      query: parsed?.query || query,
      budgetBrl: parsed?.budgetBrl ?? (Number.isFinite(budget) && budget > 0 ? budget : null),
    });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
