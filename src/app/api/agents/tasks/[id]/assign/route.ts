import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeErrorMessage } from '@/lib/security';
import { callModel } from '@/services/ai';

// POST /api/agents/tasks/[id]/assign
// Agente pega a tarefa, executa com seu modelo de AI e retorna resultado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { assigneeId } = await request.json();

    if (!assigneeId) return NextResponse.json({ error: 'assigneeId required' }, { status: 400 });

    const [task, assignee] = await Promise.all([
      db.agentTask.findUnique({ where: { id }, include: { poster: true } }),
      db.agent.findUnique({ where: { id: assigneeId } }),
    ]);

    if (!task)    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (!assignee) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    if (task.status !== 'open') return NextResponse.json({ error: 'Task is not open' }, { status: 409 });
    if (task.posterId === assigneeId) return NextResponse.json({ error: 'Agent cannot assign its own task' }, { status: 400 });

    // Mark as assigned
    await db.agentTask.update({ where: { id }, data: { status: 'assigned', assigneeId } });

    // Try all models until one works (fallback chain)
    const modelOrder = [assignee.model, 'gpt', 'claude', 'gemini', 'nvidia'];
    const tried = new Set<string>();
    let result: { content: string; model: string; modelLabel: string } | null = null;
    let lastError = '';

    for (const model of modelOrder) {
      if (tried.has(model)) continue;
      tried.add(model);
      try {
        result = await callModel({
          model,
          messages: [{ role: 'user', content: `${task.title}\n\n${task.description}` }],
          systemPrompt:
            `Voce e o agente "${assignee.name}". ` +
            `${assignee.goal}. ` +
            `Personalidade: ${assignee.personality}. ` +
            `Execute a tarefa abaixo com precisao e retorne um resultado claro e objetivo.`,
          useContext: false,
          agentName: assignee.name,
        });
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.warn(`[Agent Economy] model ${model} failed, trying next...`);
      }
    }

    if (!result) {
      // All models failed — mark task as failed
      await db.agentTask.update({ where: { id }, data: { status: 'open', assigneeId: null } });
      return NextResponse.json({ error: `All AI models unavailable. Last error: ${lastError}` }, { status: 503 });
    }

    // Complete task with result
    const completed = await db.agentTask.update({
      where: { id },
      data: {
        status:      'completed',
        result:      result.content,
        completedAt: new Date(),
      },
      include: {
        poster:   { select: { id: true, name: true, model: true } },
        assignee: { select: { id: true, name: true, model: true } },
      },
    });

    // Update agent stats
    await db.agent.update({
      where: { id: assigneeId },
      data: {
        totalInteractions: { increment: 1 },
        memoryCount:       { increment: 1 },
      },
    });

    // Anchor task completion on Solana (fire-and-forget)
    anchorTaskOnChain(id, task.solReward, assignee.name, task.poster.name).catch(() => {});

    return NextResponse.json({ task: completed });
  } catch (error) {
    console.error('[Agent Economy] assign failed:', error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

async function anchorTaskOnChain(taskId: string, reward: number, executor: string, poster: string) {
  try {
    const {
      Connection, Keypair, PublicKey,
      Transaction, TransactionInstruction,
    } = await import('@solana/web3.js');

    const key = process.env.SOLANA_PRIVATE_KEY;
    if (!key) return;

    const payer     = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const MEMO_ID   = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWjMyngNGYBwpkY51L');

    const memo = `CONGCHAIN-TASK:${taskId}:${reward}SOL:${executor}←${poster}`;

    const ix = new TransactionInstruction({
      programId: MEMO_ID,
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(memo),
    });

    const tx = new Transaction().add(ix);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    await db.agentTask.update({ where: { id: taskId }, data: { txHash: sig } });
  } catch { /* silent — blockchain failure doesn't block task */ }
}
