import { NextRequest, NextResponse } from 'next/server';
import { payForApi, getAgentPublicKey, getAgentBalance } from '@/lib/solana/pay-agent';
import { saveMemory } from '@/services/memory';
import { pushRealEvent } from '../office/shared';

// Simple in-memory stats (module-level, Railway persistent)
let totalPayments = 0;
let totalSolPaid = 0;
let totalMemories = 0;

export async function GET() {
  return NextResponse.json({
    wallet: getAgentPublicKey(),
    balance: await getAgentBalance(),
    stats: { totalPayments, totalSolPaid: parseFloat(totalSolPaid.toFixed(4)), totalMemories },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, amount = 0.001, model = 'nvidia', saveResult = true, agentName = 'PayAgent' } = body as {
      url?: string; amount?: number; model?: string; saveResult?: boolean; agentName?: string;
    };

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid URL — must start with http/https' }, { status: 400 });
    }

    const steps: string[] = [];
    const startTs = Date.now();

    // Step 1: Pay
    steps.push(`Iniciando pagamento de ${amount} SOL do agente...`);
    const payment = await payForApi(amount);
    if (!payment.success) {
      return NextResponse.json({ error: payment.error ?? 'Payment failed' }, { status: 502 });
    }
    steps.push(`${payment.simulated ? '🔵 Simulado' : '✅ Confirmado'} · TX: ${payment.txHash?.slice(0, 16)}...`);
    totalPayments++;
    totalSolPaid += amount;

    // Step 2: Fetch API
    steps.push(`Chamando API: ${url.slice(0, 60)}...`);
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'CONGCHAIN-PayAgent/1.0', Accept: 'application/json,text/plain,*/*' },
      signal: AbortSignal.timeout(8000),
    });
    if (!fetchRes.ok) {
      return NextResponse.json({ error: `API returned ${fetchRes.status}` }, { status: 502 });
    }

    const contentType = fetchRes.headers.get('content-type') ?? '';
    const isJson = contentType.includes('json');
    const rawText = await fetchRes.text();
    let data: unknown;
    try { data = isJson ? JSON.parse(rawText) : rawText; } catch { data = rawText; }

    const dataPreview = typeof data === 'string' ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500);
    steps.push(`Resposta recebida · ${rawText.length} bytes`);

    // Step 3: Save as memory
    let memoryHash: string | null = null;
    if (saveResult) {
      const content = `[CONGCHAIN PAY — ${new Date().toISOString()}]\nURL: ${url}\nCosto: ${amount} SOL · TX: ${payment.txHash}\n\nResposta:\n${dataPreview}`;
      const mem = await saveMemory({ content, model, parentHash: null });
      memoryHash = mem.hash;
      totalMemories++;
      steps.push(`Memória salva · Hash: ${memoryHash.slice(0, 16)}...`);
    }

    const duration = Date.now() - startTs;
    steps.push(`Concluído em ${duration}ms`);

    // Push to Office live feed
    pushRealEvent({
      type: 'real_task_done', model, modelLabel: 'PayAgent',
      agentName, task: `Pay → ${new URL(url).hostname}`,
      result: `${amount} SOL · ${dataPreview.slice(0, 100)}`,
      hash: memoryHash ?? payment.txHash ?? '',
      ts: Date.now(), isReal: true,
    });

    return NextResponse.json({
      success: true,
      payment: {
        txHash: payment.txHash,
        simulated: payment.simulated,
        amountSol: amount,
        fromWallet: payment.fromWallet,
        explorerUrl: payment.explorerUrl,
      },
      data,
      memoryHash,
      proof: memoryHash ? `CONGCHAIN://memory/${memoryHash}` : null,
      duration,
      steps,
      stats: { totalPayments, totalSolPaid: parseFloat(totalSolPaid.toFixed(4)), totalMemories },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
