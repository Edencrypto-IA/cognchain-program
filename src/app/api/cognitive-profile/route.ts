import { NextResponse } from 'next/server';
import { buildCognitiveProfile } from '@/services/agents';
import { safeErrorMessage } from '@/lib/security';

export async function GET() {
  try {
    const profile = await buildCognitiveProfile();
    if (profile === null || profile === undefined) {
      return NextResponse.json({ profile: null });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
