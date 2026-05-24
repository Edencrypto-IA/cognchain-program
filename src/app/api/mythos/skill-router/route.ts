import { NextRequest, NextResponse } from 'next/server';
import { routeMythosSkill } from '@/features/agent-memory-bridge/skill-router';
import { checkRateLimit, Limits, safeErrorMessage } from '@/lib/security';

type MythosSkillRouterBody = {
  prompt?: unknown;
  currentSkillId?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/skill-router');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many Mythos skill routing requests. Wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json() as MythosSkillRouterBody;
    const prompt = typeof body.prompt === 'string'
      ? body.prompt.slice(0, Limits.MAX_PROMPT_LENGTH)
      : '';
    const currentSkillId = typeof body.currentSkillId === 'string'
      ? body.currentSkillId.slice(0, 120)
      : undefined;

    const route = routeMythosSkill(prompt, currentSkillId);
    return NextResponse.json(route);
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
