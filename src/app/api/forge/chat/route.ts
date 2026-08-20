import { NextRequest } from 'next/server';
import { checkRateLimit, validateModel, Limits, MODEL_TIER, ValidationError } from '@/lib/security';
import { verifyAdminToken } from '@/lib/auth';
import { requireApiKey } from '@/lib/api-key-auth';
import {
  FORGE_SYSTEM_WITH_FILES,
  encodeDone,
  encodeError,
  encodeEvent,
  encodeStatus,
  extractForgeEditProposal,
  extractForgeFiles,
  streamModelText,
} from '@/lib/forge/model-stream';
import { listSkillSummaries } from '@/skills/skill-loader';
import { analyzeIntent } from '@/trigger/triggerEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function enc(text: string): Uint8Array {
  return encodeEvent({ token: text });
}

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const rawPrompt = body.prompt;
  if (typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const prompt = rawPrompt.trim().slice(0, Limits.MAX_PROMPT_LENGTH);
  const messages = [{ role: 'user', content: prompt }];

  const adminToken = req.cookies.get('cog_admin')?.value ?? '';
  const isAdmin = adminToken ? verifyAdminToken(adminToken) : false;

  const hasApiKey = req.headers.get('authorization')?.startsWith('Bearer cog_') || req.headers.get('x-api-key')?.startsWith('cog_');
  let userPlan: 'free' | 'pro' = isAdmin ? 'pro' : 'free';
  if (!isAdmin && hasApiKey) {
    const auth = await requireApiKey(req);
    if ('key' in auth && auth.key) userPlan = (auth.key.plan === 'pro' || auth.key.plan === 'enterprise') ? 'pro' : 'free';
  }

  let selectedModel = 'nvidia';
  try { selectedModel = validateModel(typeof body.model === 'string' ? body.model : 'nvidia'); } catch { /* default */ }
  if (MODEL_TIER(selectedModel) === 'pro' && userPlan === 'free') {
    return new Response(JSON.stringify({ error: 'PRO_REQUIRED' }), { status: 402, headers: { 'Content-Type': 'application/json' } });
  }

  if (!isAdmin && !hasApiKey) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/forge/chat');
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const validMsgs = messages.map(m => ({ role: m.role, content: String(m.content).slice(0, Limits.MAX_PROMPT_LENGTH) }));
  // FORGE_UPGRADE: classify each Forge prompt for the terminal TriggerReport badge.
  const triggerReport = await listSkillSummaries()
    .then(skills => analyzeIntent(prompt, skills))
    .catch(() => analyzeIntent(prompt, []));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encodeStatus('A contactar o modelo…'));
        console.log(`[forge:chat] start model=${selectedModel}`);

        let full = '';
        try {
          full = await streamModelText({
            model: selectedModel,
            messages: validMsgs,
            system: FORGE_SYSTEM_WITH_FILES,
            onToken: token => controller.enqueue(enc(token)),
          });
        } catch (err) {
          const message = err instanceof ValidationError ? err.message : (err instanceof Error ? err.message : String(err));
          console.error(`[forge:chat] stream error model=${selectedModel}`, message);
          controller.enqueue(encodeError('Falha ao gerar a resposta. Verifique as chaves de API no servidor ou tente outro modelo.'));
          return;
        }

        const files = extractForgeFiles(full);
        const editProposal = extractForgeEditProposal(full);
        if (files.length) {
          controller.enqueue(encodeStatus(`${files.length} ficheiro${files.length > 1 ? 's' : ''} estruturado${files.length > 1 ? 's' : ''} extraido${files.length > 1 ? 's' : ''}.`));
        }
        if (editProposal) {
          controller.enqueue(encodeStatus(`Diff review prepared for ${editProposal.path}.`));
        }
        console.log(`[forge:chat] done model=${selectedModel} chars=${full.length} files=${files.length} edit=${editProposal ? editProposal.path : 'none'}`);
        controller.enqueue(encodeDone({ model: selectedModel, files, editProposal, triggerReport }));
      } catch (err) {
        const message = err instanceof ValidationError ? err.message : (err instanceof Error ? err.message : String(err));
        console.error(`[forge:chat] error model=${selectedModel}`, message);
        controller.enqueue(encodeError('Falha ao gerar a resposta. Verifique as chaves de API no servidor ou tente outro modelo.'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
