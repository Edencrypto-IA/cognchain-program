import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent, computeIntelligenceScore } from '@/services/agents';
import { safeErrorMessage } from '@/lib/security';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [agent, intelligence] = await Promise.all([
      getAgent(id),
      computeIntelligenceScore(id).catch(() => null),
    ]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ agent: { ...agent, intelligence } });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Whitelist updatable fields to prevent overwriting internal fields
    const allowedFields = ['name', 'goal', 'personality', 'model', 'tools', 'template', 'systemPrompt'];
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    const agent = await updateAgent(id, sanitizedBody);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteAgent(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
