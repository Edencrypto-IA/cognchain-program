import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security';

function clean(value: string | null, maxLength: number) {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rate = checkRateLimit(ip, '/api/mythos/pumpfun/metadata-preview');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many metadata preview requests.' }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const name = clean(params.get('name'), 42) || 'Untitled Meme';
  const symbol = clean(params.get('symbol'), 10).replace(/[^a-z0-9]/gi, '').toUpperCase() || 'MEME';
  const description = clean(params.get('description'), 360) || `${name} is a Mythos-reviewed Pump.fun metadata preview.`;
  const imagePrompt = clean(params.get('imagePrompt'), 420);
  const hash = clean(params.get('hash'), 80);

  return NextResponse.json({
    name,
    symbol,
    description,
    image: '',
    external_url: 'https://cognchain-program-production.up.railway.app/mythos/lab',
    attributes: [
      { trait_type: 'platform', value: 'pump.fun metadata preview' },
      { trait_type: 'reviewed_by', value: 'Mythos' },
      { trait_type: 'metadata_hash', value: hash || 'not-provided' },
      { trait_type: 'image_prompt', value: imagePrompt || 'not-provided' },
    ],
    properties: {
      files: [],
      category: 'image',
      safety_note: 'Preview metadata only. No IPFS/Arweave upload, mint, signature, submit, or fund movement is performed by this endpoint.',
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
