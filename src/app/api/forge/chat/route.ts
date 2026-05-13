import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, validateModel, Limits, MODEL_TIER, ValidationError } from '@/lib/security';
import { verifyAdminToken } from '@/app/api/auth/verify/route';
import { requireApiKey } from '@/lib/api-key-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORGE_SYSTEM = `Você é o CongChain Forge — workspace de IA focado em Solana, programas Anchor, clients TypeScript e desenho de dApps com segurança em mente.
Use devnet nos exemplos por defeito. Nunca afirme que uma transação foi executada on-chain sem o utilizador fornecer uma assinatura ou prova.
Responda em português salvo se o utilizador escrever noutra língua. Use markdown (###, listas, blocos \`\`\`linguagem).
Não invente endereços, program IDs, ou assinaturas de transações. Se faltar contexto de código, pede-o de forma objetiva.`;

function enc(text: string) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ token: text })}\n\n`);
}
function encDone(extra?: object) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ done: true, ...extra })}\n\n`);
}
function encError(message: string) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ error: message, done: true })}\n\n`);
}
function encStatus(text: string) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ status: text })}\n\n`);
}

const FORGE_MAX_TOKENS = 2048;

async function streamOpenAI(messages: { role: string; content: string }[], model: string, system: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, ...messages] as never,
    stream: true,
    max_tokens: FORGE_MAX_TOKENS,
  });
  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) { full += token; controller.enqueue(enc(token)); }
  }
  return full;
}

async function streamAnthropic(messages: { role: string; content: string }[], system: string, controller: ReadableStreamDefaultController) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: FORGE_MAX_TOKENS,
    system,
    messages: messages as never,
    stream: true,
  });
  let full = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      controller.enqueue(enc(event.delta.text));
    }
  }
  return full;
}

async function streamOpenAICompat(messages: { role: string; content: string }[], model: string, baseURL: string, apiKey: string, system: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, ...messages] as never,
    stream: true,
    max_tokens: FORGE_MAX_TOKENS,
  });
  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) { full += token; controller.enqueue(enc(token)); }
  }
  return full;
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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encStatus('A contactar o modelo…'));
        let full = '';
        console.log(`[forge:chat] start model=${selectedModel}`);

        if (selectedModel === 'gpt') {
          full = await streamOpenAI(validMsgs, 'gpt-4o', FORGE_SYSTEM, controller);
        } else if (selectedModel === 'claude') {
          full = await streamAnthropic(validMsgs, FORGE_SYSTEM, controller);
        } else if (selectedModel === 'deepseek') {
          full = await streamOpenAICompat(validMsgs, 'deepseek-chat', 'https://api.deepseek.com', process.env.DEEPSEEK_API_KEY ?? '', FORGE_SYSTEM, controller);
        } else if (selectedModel === 'gemini') {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
          const gemModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite', systemInstruction: FORGE_SYSTEM });
          const chat = gemModel.startChat({ history: [] });
          const result = await chat.sendMessageStream(validMsgs.at(-1)?.content ?? '');
          for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) { full += token; controller.enqueue(enc(token)); }
          }
        } else {
          const modelMap: Record<string, { url: string; name: string; key: string }> = {
            nvidia:  { url: 'https://integrate.api.nvidia.com/v1', name: 'meta/llama-3.3-70b-instruct', key: process.env.NVIDIA_API_KEY ?? '' },
            glm:     { url: 'https://integrate.api.nvidia.com/v1', name: 'z-ai/glm4.7', key: process.env.NVIDIA_GLM_KEY ?? '' },
            minimax: { url: 'https://integrate.api.nvidia.com/v1', name: 'minimaxai/minimax-m2.7', key: process.env.NVIDIA_MINIMAX_KEY ?? '' },
            qwen:    { url: 'https://integrate.api.nvidia.com/v1', name: 'qwen/qwen3-next-80b-a3b-instruct', key: process.env.NVIDIA_QWEN_KEY ?? '' },
          };
          const cfg = modelMap[selectedModel] ?? modelMap.nvidia;
          full = await streamOpenAICompat(validMsgs, cfg.name, cfg.url, cfg.key, FORGE_SYSTEM, controller);
        }

        console.log(`[forge:chat] done model=${selectedModel} chars=${full.length}`);
        controller.enqueue(encDone({ model: selectedModel }));
      } catch (err) {
        const message = err instanceof ValidationError ? err.message : (err instanceof Error ? err.message : String(err));
        console.error(`[forge:chat] error model=${selectedModel}`, message);
        controller.enqueue(encError('Falha ao gerar a resposta. Verifique as chaves de API no servidor ou tente outro modelo.'));
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
