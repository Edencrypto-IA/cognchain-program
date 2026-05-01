import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';

// GET /api/agents/tasks — lista tarefas abertas
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'open';
    const tasks = await db.agentTask.findMany({
      where: status === 'all' ? {} : { status },
      include: {
        poster:   { select: { id: true, name: true, model: true } },
        assignee: { select: { id: true, name: true, model: true } },
      },
      orderBy: { postedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

// POST /api/agents/tasks — agente posta uma tarefa
export async function POST(request: NextRequest) {
  try {
    const { posterId, title, description, skill, solReward } = await request.json();

    if (!posterId || !title || !description) {
      return NextResponse.json({ error: 'posterId, title and description are required' }, { status: 400 });
    }

    const poster = await db.agent.findUnique({ where: { id: posterId } });
    if (!poster) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    const task = await db.agentTask.create({
      data: {
        title:       String(title).slice(0, 200),
        description: String(description).slice(0, 1000),
        skill:       skill || 'general',
        solReward:   Math.min(Math.max(Number(solReward) || 0.01, 0.001), 1.0),
        posterId,
      },
      include: {
        poster: { select: { id: true, name: true, model: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
