import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, validateModel, Limits, MODEL_TIER } from '@/lib/security';
import { verifyAdminToken } from '@/app/api/auth/verify/route';
import { needsGrounding, groundQuery } from '@/lib/grounding';
import { requireApiKey } from '@/lib/api-key-auth';

const BASE_SYSTEM = `Você é o CONGCHAIN — Verifiable AI Memory Layer na Solana. Responda em português de forma precisa, bem formatada com markdown. Use **negrito** para termos importantes, ### para seções, listas quando apropriado, e blocos de código com \`\`\`linguagem quando mostrar código. Nunca invente dados.`;

// Returns recent agent insights to inject as context
async function getAgentInsightContext(): Promise<string> {
  try {
    const { db } = await import('@/lib/db');
    const since = Math.floor(Date.now() / 1000) - 24 * 3600;
    const mems = await db.memory.findMany({
      where: { content: { startsWith: '[AGENT_INSIGHT]' }, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    if (!mems.length) return '';
    const summaries = mems.map(m => {
      const lines = m.content.split('\n');
      const topic = lines.find(l => l.startsWith('Tópico:'))?.replace('Tópico: ', '') ?? '';
      const body = lines.slice(6).join(' ').trim().slice(0, 200);
      return `• ${topic}: ${body}`;
    });
    return `\n\n[INSIGHTS DOS SEUS AGENTES — últimas 24h]\n${summaries.join('\n')}\n[Use esses insights quando relevante para a conversa]`;
  } catch { return ''; }
}

function isAgentQuery(msg: string): boolean {
  return /agente|descobri|analise|insight|encontrou|monitorou|pesquisou|mercado hoje|sol hoje|defi hoje|trade|sinal|compra|venda/i.test(msg);
}

function enc(text: string) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ token: text })}\n\n`);
}
function encDone(extra?: object) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ done: true, ...extra })}\n\n`);
}

async function streamOpenAI(messages: { role: string; content: string }[], model: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: SYSTEM }, ...messages] as never,
    stream: true,
    max_tokens: 1500,
  });
  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) { full += token; controller.enqueue(enc(token)); }
  }
  return full;
}

async function streamAnthropic(messages: { role: string; content: string }[], controller: ReadableStreamDefaultController) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1500,
    system: SYSTEM,
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

async function streamOpenAICompat(messages: { role: string; content: string }[], model: string, baseURL: string, apiKey: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey, baseURL });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: SYSTEM }, ...messages] as never,
    stream: true,
    max_tokens: 1500,
  });
  let full = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) { full += token; controller.enqueue(enc(token)); }
  }
  return full;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, model: rawModel } = body;

  if (!messages?.length) return new Response('Missing messages', { status: 400 });

  // Auth
  const adminToken = req.cookies.get('cog_admin')?.value ?? '';
  const isAdmin = adminToken ? verifyAdminToken(adminToken) : false;

  const hasApiKey = req.headers.get('authorization')?.startsWith('Bearer cog_') || req.headers.get('x-api-key')?.startsWith('cog_');
  let userPlan: 'free' | 'pro' = isAdmin ? 'pro' : 'free';
  if (!isAdmin && hasApiKey) {
    const auth = await requireApiKey(req);
    if ('key' in auth && auth.key) userPlan = (auth.key.plan === 'pro' || auth.key.plan === 'enterprise') ? 'pro' : 'free';
  }

  let selectedModel = 'nvidia';
  try { selectedModel = validateModel(rawModel || 'nvidia'); } catch { /* use default */ }
  if (MODEL_TIER(selectedModel) === 'pro' && userPlan === 'free') {
    return new Response(JSON.stringify({ error: 'PRO_REQUIRED' }), { status: 402 });
  }

  // Rate limit
  if (!isAdmin && !hasApiKey) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/chat');
    if (!rate.allowed) return new Response('Rate limit exceeded', { status: 429 });
  }

  const lastMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user');

  // Build dynamic system prompt: inject agent insights if query is relevant
  const agentCtx = lastMsg && isAgentQuery(lastMsg.content) ? await getAgentInsightContext() : '';
  const SYSTEM = BASE_SYSTEM + agentCtx;

  function encStatus(text: string) {
    return new TextEncoder().encode(`data: ${JSON.stringify({ status: text })}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let full = '';

        // Grounding with live status events
        let groundingPrefix = '';
        let structuredResponse: import('@/lib/grounding/types').StructuredResponse | null = null;
        if (lastMsg && needsGrounding(lastMsg.content)) {
          controller.enqueue(encStatus('🔍 Analisando query...'));
          await new Promise(r => setTimeout(r, 100));
          controller.enqueue(encStatus('📡 Consultando exchanges em tempo real...'));
          try {
            const grounded = await groundQuery(lastMsg.content);
            structuredResponse = grounded.response;
            const srcCount = grounded.response.allSources.length;
            if (grounded.markdown) {
              groundingPrefix = `[Dados verificados]\n${grounded.markdown}\n\n`;
              controller.enqueue(encStatus(`✅ ${srcCount} fonte${srcCount !== 1 ? 's' : ''} verificada${srcCount !== 1 ? 's' : ''} · Gerando resposta...`));
            } else {
              controller.enqueue(encStatus('🧠 Gerando resposta...'));
            }
          } catch {
            controller.enqueue(encStatus('🧠 Gerando resposta...'));
          }
        } else {
          controller.enqueue(encStatus('🧠 Gerando resposta...'));
        }

        const augmented = groundingPrefix && lastMsg
          ? messages.map((m: { role: string; content: string }) => m === lastMsg ? { ...m, content: groundingPrefix + m.content } : m)
          : messages;
        const validMsgs = augmented.map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content).slice(0, Limits.MAX_PROMPT_LENGTH) }));
        if (selectedModel === 'gpt') {
          full = await streamOpenAI(validMsgs, 'gpt-4o', controller);
        } else if (selectedModel === 'claude') {
          full = await streamAnthropic(validMsgs, controller);
        } else if (selectedModel === 'deepseek') {
          full = await streamOpenAICompat(validMsgs, 'deepseek-chat', 'https://api.deepseek.com', process.env.DEEPSEEK_API_KEY ?? '', controller);
        } else if (selectedModel === 'gemini') {
          // Gemini via OpenAI-compatible endpoint
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
          const gemModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite', systemInstruction: SYSTEM });
          const history = validMsgs.slice(0, -1).map((m: { role: string; content: string }) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
          const chat = gemModel.startChat({ history });
          const result = await chat.sendMessageStream(validMsgs.at(-1)?.content ?? '');
          for await (const chunk of result.stream) {
            const token = chunk.text();
            if (token) { full += token; controller.enqueue(enc(token)); }
          }
        } else {
          // Free NVIDIA models via OpenAI-compat
          const modelMap: Record<string, { url: string; name: string; key: string }> = {
            nvidia:  { url: 'https://integrate.api.nvidia.com/v1', name: 'meta/llama-3.3-70b-instruct', key: process.env.NVIDIA_API_KEY ?? '' },
            glm:     { url: 'https://integrate.api.nvidia.com/v1', name: 'z-ai/glm4.7', key: process.env.NVIDIA_GLM_KEY ?? '' },
            minimax: { url: 'https://integrate.api.nvidia.com/v1', name: 'minimaxai/minimax-m2.7', key: process.env.NVIDIA_MINIMAX_KEY ?? '' },
            qwen:    { url: 'https://integrate.api.nvidia.com/v1', name: 'qwen/qwen3-next-80b-a3b-instruct', key: process.env.NVIDIA_QWEN_KEY ?? '' },
          };
          const cfg = modelMap[selectedModel] ?? modelMap.nvidia;
          full = await streamOpenAICompat(validMsgs, cfg.name, cfg.url, cfg.key, controller);
        }

        controller.enqueue(encDone({ model: selectedModel, structuredResponse }));
      } catch (err) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
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
