import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from '@/services/api-keys/api-key.service';
import { safeErrorMessage } from '@/lib/security';

// GET /api/keys?owner=email@x.com  — list keys for an owner
export async function GET(req: NextRequest) {
  try {
    const owner = req.nextUrl.searchParams.get('owner');
    if (!owner) return NextResponse.json({ error: 'owner param required' }, { status: 400 });
    const keys = await listApiKeys(owner);
    return NextResponse.json({ keys });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST /api/keys — create a new API key
// Body: { name, owner, plan? }
export async function POST(req: NextRequest) {
  try {
    const { name, owner, plan } = await req.json();
    if (!name || !owner) return NextResponse.json({ error: 'name and owner required' }, { status: 400 });

    const safeName  = String(name).substring(0, 80);
    const safeOwner = String(owner).substring(0, 100);
    const safePlan  = ['free', 'pro', 'enterprise'].includes(plan) ? plan : 'free';

    const result = await createApiKey(safeName, safeOwner, safePlan);

    return NextResponse.json({
      key:    result.record,
      rawKey: result.rawKey,
      warning: 'Save this key now. It will NOT be shown again.',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
