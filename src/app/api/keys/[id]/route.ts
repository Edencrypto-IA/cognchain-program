import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey, getApiKeyStats } from '@/services/api-keys/api-key.service';
import { safeErrorMessage } from '@/lib/security';

type Params = { params: Promise<{ id: string }> };

// GET /api/keys/[id] — stats for a single key
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const key = await getApiKeyStats(id);
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    return NextResponse.json({ key });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// DELETE /api/keys/[id] — revoke a key
// Body: { owner }  (must match the key's owner)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { owner } = await req.json();
    if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });
    const ok = await revokeApiKey(id, String(owner));
    if (!ok) return NextResponse.json({ error: 'Key not found or owner mismatch' }, { status: 404 });
    return NextResponse.json({ ok: true, message: 'Key revoked. It will stop working immediately.' });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
