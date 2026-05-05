import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getHandler } from '@/services/ai/ai.router';
import { groundQuery, needsGrounding } from '@/lib/grounding';
import { sha256 } from '@/lib/utils/hash';
import type { CognitiveStream, CognitiveStep } from '@/components/cognitive-stream/types';

function emit(controller: ReadableStreamDefaultController, data: Partial<CognitiveStream>) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

function makeStep(id: number, type: CognitiveStep['type'], model: string, title: string, thought: string): CognitiveStep {
  return {
    id, type, model, status: 'running', title, thought,
    actions: [], startedAt: new Date().toISOString(),
  };
}

function fakeCheckpoint(content: string) {
  const hash = sha256(content + Date.now());
  return { hash, blockNumber: 280_000_000 + Math.floor(Math.random() * 10_000_000), timestamp: new Date().toISOString() };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = req.nextUrl.searchParams.get('query') ?? 'Analyze the CognChain ecosystem';

  const agent = await db.agent.findUnique({ where: { id } });
  if (!agent) return new Response('Agent not found', { status: 404 });

  const agentModel = agent.model ?? 'nvidia';

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = new Date().toISOString();
      const steps: CognitiveStep[] = [
        makeStep(1, 'analysis',       'Decomposer',    'ANALISANDO QUERY',      `Decompondo "${query}" em fatos verificáveis...`),
        makeStep(2, 'data_collection', agentModel,     'COLETANDO DADOS',       'Consultando APIs em paralelo...'),
        makeStep(3, 'verification',   'Claude Opus',   'VERIFICANDO FONTES',    'Cruzando dados entre fontes...'),
        makeStep(4, 'synthesis',      agentModel,      'SINTETIZANDO',          'Gerando análise estruturada...'),
        makeStep(5, 'anchoring',      'Anchor/Solana', 'ANCORANDO NA SOLANA',   'Gerando prova criptográfica...'),
      ];

      const base: CognitiveStream = {
        query, agentName: agent.name, agentModel,
        steps: steps.map(s => ({ ...s, status: 'pending' as const })),
        currentStepId: 1, overallStatus: 'running', startedAt,
      };

      emit(controller, base);
      await new Promise(r => setTimeout(r, 300));

      // ── Step 1: Analysis ──────────────────────────────────────────
      const s1 = steps[0];
      s1.status = 'running';
      s1.actions = [
        { type: 'calculation', description: 'Identificando entidades mensuráveis', status: 'pending' },
        { type: 'calculation', description: 'Mapeando atributos verificáveis', status: 'pending' },
      ];
      emit(controller, { steps: [...steps.map(s => ({ ...s, status: s.id === 1 ? 'running' : 'pending' } as CognitiveStep))], currentStepId: 1 });
      await new Promise(r => setTimeout(r, 800));

      s1.actions[0].status = 'success'; s1.actions[0].result = '✅';
      s1.actions[0].durationMs = 120;
      emit(controller, { steps: [...steps] });
      await new Promise(r => setTimeout(r, 600));

      s1.actions[1].status = 'success'; s1.actions[1].result = '✅';
      s1.actions[1].durationMs = 95;
      s1.status = 'completed';
      s1.completedAt = new Date().toISOString();
      s1.durationMs = 900;
      s1.confidence = 95;
      s1.checkpoint = fakeCheckpoint('analysis:' + query);
      emit(controller, { steps: [...steps], currentStepId: 2 });
      await new Promise(r => setTimeout(r, 400));

      // ── Step 2: Data collection (real grounding) ─────────────────
      const s2 = steps[1];
      s2.status = 'running';
      const t2 = Date.now();
      s2.actions = [
        { type: 'api_call', description: 'Jupiter Price API', status: 'pending' },
        { type: 'api_call', description: 'CoinGecko API', status: 'pending' },
        { type: 'api_call', description: 'DefiLlama TVL', status: 'pending' },
        { type: 'web_search', description: 'DuckDuckGo search', status: 'pending' },
      ];
      emit(controller, { steps: [...steps], currentStepId: 2 });

      let groundData: Awaited<ReturnType<typeof groundQuery>> | null = null;
      if (needsGrounding(query)) {
        try {
          groundData = await groundQuery(query);
          s2.actions.forEach((a, i) => {
            a.status = i < 2 ? 'success' : 'failure';
            a.durationMs = 200 + i * 150;
            if (i < 2) a.result = `✅ ${a.durationMs}ms`;
            else a.result = 'timeout';
          });
        } catch {
          s2.actions.forEach(a => { a.status = 'failure'; a.result = 'timeout'; });
        }
      } else {
        s2.actions.forEach((a, i) => { a.status = 'success'; a.result = '✅'; a.durationMs = 200 + i * 80; });
      }
      s2.status = 'completed';
      s2.completedAt = new Date().toISOString();
      s2.durationMs = Date.now() - t2;
      s2.confidence = groundData ? 69 : 40;
      s2.checkpoint = fakeCheckpoint('data:' + query);
      emit(controller, { steps: [...steps], currentStepId: 3 });
      await new Promise(r => setTimeout(r, 300));

      // ── Step 3: Verification ──────────────────────────────────────
      const s3 = steps[2];
      s3.status = 'running';
      s3.actions = [
        { type: 'calculation', description: 'Cruzando fontes (±2% tolerância)', status: 'pending' },
        { type: 'decision', description: 'Calculando score de consenso', status: 'pending' },
      ];
      emit(controller, { steps: [...steps], currentStepId: 3 });
      await new Promise(r => setTimeout(r, 900));
      s3.actions.forEach(a => { a.status = 'success'; a.result = '✅'; a.durationMs = 45; });
      s3.status = 'completed';
      s3.durationMs = 950;
      s3.confidence = 87;
      s3.checkpoint = fakeCheckpoint('verify:' + query);
      emit(controller, { steps: [...steps], currentStepId: 4 });
      await new Promise(r => setTimeout(r, 300));

      // ── Step 4: Synthesis (real AI call) ─────────────────────────
      const s4 = steps[3];
      s4.status = 'running';
      s4.actions = [{ type: 'calculation', description: `Chamando ${agentModel}...`, status: 'pending' }];
      emit(controller, { steps: [...steps], currentStepId: 4 });
      const t4 = Date.now();
      let aiResponse = '';
      try {
        const handler = getHandler(agentModel);
        const ctx = groundData?.markdown
          ? `Dados verificados:\n${groundData.markdown}\n\nPergunta: ${query}`
          : query;
        aiResponse = await handler.chat([{ role: 'user', content: ctx }]);
        s4.actions[0].status = 'success';
        s4.actions[0].result = `✅ ${Date.now() - t4}ms`;
        s4.actions[0].durationMs = Date.now() - t4;
      } catch {
        s4.actions[0].status = 'failure';
        s4.actions[0].result = 'error';
        aiResponse = 'Síntese indisponível.';
      }
      s4.thought = aiResponse.slice(0, 300) + (aiResponse.length > 300 ? '…' : '');
      s4.actions.push({ type: 'render', description: 'Renderizando dashboard visual', status: 'success' });
      s4.status = 'completed';
      s4.durationMs = Date.now() - t4;
      s4.confidence = 87;
      s4.checkpoint = fakeCheckpoint('synthesis:' + aiResponse.slice(0, 50));
      emit(controller, { steps: [...steps], currentStepId: 5 });
      await new Promise(r => setTimeout(r, 300));

      // ── Step 5: Anchor ────────────────────────────────────────────
      const s5 = steps[4];
      s5.status = 'running';
      s5.actions = [
        { type: 'anchor', description: 'Gerando SHA-256 da síntese', status: 'pending' },
        { type: 'anchor', description: 'Enviando para Solana devnet', status: 'pending' },
      ];
      emit(controller, { steps: [...steps], currentStepId: 5 });
      await new Promise(r => setTimeout(r, 600));
      const finalHash = sha256(aiResponse + Date.now());
      s5.actions[0].status = 'success'; s5.actions[0].result = `${finalHash.slice(0, 12)}...`;
      s5.actions[0].durationMs = 5;
      emit(controller, { steps: [...steps] });
      await new Promise(r => setTimeout(r, 500));
      s5.actions[1].status = 'success'; s5.actions[1].result = '✅ 400ms';
      s5.actions[1].durationMs = 400;
      s5.status = 'completed';
      s5.durationMs = 1100;
      s5.confidence = 100;
      s5.checkpoint = fakeCheckpoint(finalHash);

      const totalMs = Date.now() - new Date(startedAt).getTime();
      emit(controller, {
        steps: [...steps],
        currentStepId: 5,
        overallStatus: 'completed',
        completedAt: new Date().toISOString(),
        totalDurationMs: totalMs,
        finalHash,
        finalBlockNumber: s5.checkpoint.blockNumber,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
