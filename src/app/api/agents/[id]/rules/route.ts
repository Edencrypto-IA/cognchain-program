import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

// GET — List all rules for an agent
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rules = await db.decisionRule.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ rules: rules.map(r => ({
      id: r.id,
      agentId: r.agentId,
      name: r.name,
      condition: r.condition,
      action: r.action,
      params: r.params,
      isActive: r.isActive,
      lastTriggered: r.lastTriggered,
      triggerCount: r.triggerCount,
      createdAt: r.createdAt.toISOString(),
    })) });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST — Create a new rule
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/agents/rules');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const { name, condition, action, params: ruleParams, isActive } = body;

    if (!name || !condition || !action) {
      return NextResponse.json({ error: 'name, condition, and action are required' }, { status: 400 });
    }

    // Validate condition is valid JSON
    let parsedCondition: Record<string, unknown>;
    try {
      parsedCondition = typeof condition === 'string' ? JSON.parse(condition) : condition;
      if (!parsedCondition.type || !parsedCondition.value) {
        throw new Error('Missing type or value in condition');
      }
    } catch {
      return NextResponse.json({ error: 'condition must be valid JSON with type and value' }, { status: 400 });
    }

    // Validate action
    const validActions = ['notify', 'analyze', 'save_preference', 'webhook_trigger', 'blockchain_anchor', 'memory_query'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    const rule = await db.decisionRule.create({
      data: {
        agentId: id,
        name: String(name).substring(0, 100),
        condition: typeof condition === 'string' ? condition : JSON.stringify(condition),
        action,
        params: ruleParams ? JSON.stringify(ruleParams) : '{}',
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// PATCH — Toggle rule active/inactive
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { ruleId, isActive } = body;

    if (!ruleId) {
      return NextResponse.json({ error: 'ruleId is required' }, { status: 400 });
    }

    const rule = await db.decisionRule.update({
      where: { id: ruleId, agentId },
      data: { isActive: typeof isActive === 'boolean' ? isActive : undefined },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// DELETE — Delete a rule
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params;
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json({ error: 'ruleId query param is required' }, { status: 400 });
    }

    await db.decisionRule.delete({
      where: { id: ruleId, agentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
