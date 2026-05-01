import { NextRequest, NextResponse } from 'next/server';
import { createAgent, listAgents, computeIntelligenceScore, buildInheritedContext } from '@/services/agents';
import { checkRateLimit, safeErrorMessage, validateModel } from '@/lib/security';

export async function GET() {
  try {
    const agents = await listAgents();
    const agentsWithScore = await Promise.all(
      agents.map(async (agent) => {
        const intelligence = await computeIntelligenceScore(agent.id).catch(() => null);
        return { ...agent, intelligence };
      })
    );
    return NextResponse.json({ agents: agentsWithScore });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/agents');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const { name, goal, personality, model, tools, template, systemPrompt, seedMemories } = body;

    if (!name || !goal || !model) {
      return NextResponse.json({ error: 'name, goal, and model are required' }, { status: 400 });
    }

    const safeModel = validateModel(model);

    // Build inherited context from verified memories, if provided
    let finalSystemPrompt = systemPrompt || null;
    if (Array.isArray(seedMemories) && seedMemories.length > 0) {
      const hashes = seedMemories.map((h: unknown) => String(h).substring(0, 100)).slice(0, 10);
      const inheritedCtx = await buildInheritedContext(hashes).catch(() => '');
      if (inheritedCtx) {
        finalSystemPrompt = (finalSystemPrompt || '') + inheritedCtx;
      }
    }

    const agent = await createAgent({
      name: String(name).substring(0, 100),
      goal: String(goal).substring(0, 500),
      personality: String(personality || 'friendly and helpful').substring(0, 500),
      model: safeModel,
      tools: Array.isArray(tools) ? tools : [],
      template: template || null,
      systemPrompt: finalSystemPrompt,
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
