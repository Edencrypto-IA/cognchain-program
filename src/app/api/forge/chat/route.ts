import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, validateModel, Limits, MODEL_TIER, ValidationError } from '@/lib/security';
import { verifyAdminToken } from '@/app/api/auth/verify/route';
import { requireApiKey } from '@/lib/api-key-auth';
import type { ForgeDiffProposal, ForgeFile } from '@/lib/forge/types';
import { listSkillSummaries } from '@/skills/skill-loader';
import { analyzeIntent } from '@/trigger/triggerEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORGE_SYSTEM = `Você é o CongChain Forge — workspace de IA focado em Solana, programas Anchor, clients TypeScript e desenho de dApps com segurança em mente.
Use devnet nos exemplos por defeito. Nunca afirme que uma transação foi executada on-chain sem o utilizador fornecer uma assinatura ou prova.
Responda em português salvo se o utilizador escrever noutra língua. Use markdown (###, listas, blocos \`\`\`linguagem).
Não invente endereços, program IDs, ou assinaturas de transações. Se faltar contexto de código, pede-o de forma objetiva.`;

const FORGE_FILE_INSTRUCTIONS = `

Quando propuser ficheiros para o Forge, use exatamente este formato antes de cada bloco de codigo:
File: app/example/page.tsx
\`\`\`tsx
// codigo aqui
\`\`\`
Use no maximo 4 ficheiros por resposta e prefira caminhos dentro de app/, components/, lib/, hooks/ ou solana/.`;

const FORGE_SYSTEM_WITH_FILES = `${FORGE_SYSTEM}${FORGE_FILE_INSTRUCTIONS}`;

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
const FORGE_MAX_FILE_CONTENT = 24_000;
const FORGE_MAX_FILES = 4;
const SAFE_FILE_PREFIXES = ['app/', 'components/', 'lib/', 'hooks/', 'solana/'];

function normalizeForgePath(path: string) {
  return path
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function isSafeForgePath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 140 &&
    !path.startsWith('/') &&
    !path.includes('..') &&
    SAFE_FILE_PREFIXES.some(prefix => path.startsWith(prefix))
  );
}

function inferLanguage(path: string, fallback?: string) {
  if (fallback && fallback.trim()) return fallback.trim().slice(0, 20);
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'md';
  return 'txt';
}

function extractForgeFiles(markdown: string): ForgeFile[] {
  const files: ForgeFile[] = [];
  const seen = new Set<string>();
  const pattern = /(?:^|\n)(?:File|Arquivo):\s*([^\n]+)\n```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) && files.length < FORGE_MAX_FILES) {
    const path = normalizeForgePath(match[1] ?? '');
    if (!isSafeForgePath(path) || seen.has(path)) continue;

    const contents = (match[3] ?? '').slice(0, FORGE_MAX_FILE_CONTENT).trimEnd();
    if (!contents) continue;

    seen.add(path);
    files.push({
      path,
      language: inferLanguage(path, match[2]),
      status: 'created',
      contents,
    });
  }

  return files;
}

function extractJsonCandidates(markdown: string): string[] {
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenced.exec(markdown))) {
    const body = (match[1] ?? '').trim();
    if (body.startsWith('{') && body.endsWith('}')) candidates.push(body);
  }
  const firstBrace = markdown.indexOf('{');
  const lastBrace = markdown.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(markdown.slice(firstBrace, lastBrace + 1));
  }
  return candidates;
}

function isForgeEditPayload(value: unknown): value is { action: 'edit'; path: string; diff: string } {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.action === 'edit' && typeof item.path === 'string' && typeof item.diff === 'string';
}

function extractForgeEditProposal(markdown: string): ForgeDiffProposal | null {
  // FORGE_UPGRADE: capture review-only edit diffs; the frontend still requires explicit user acceptance.
  for (const candidate of extractJsonCandidates(markdown)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!isForgeEditPayload(parsed)) continue;
      const path = normalizeForgePath(parsed.path);
      if (!isSafeForgePath(path) || parsed.diff.length > 260_000) continue;
      return {
        action: 'edit',
        path,
        diff: parsed.diff,
        createdAt: new Date().toISOString(),
      };
    } catch {
      // Continue scanning other candidates.
    }
  }
  return null;
}

async function streamOpenAI(messages: { role: string; content: string }[], model: string, system: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, ...messages] as never,
    stream: true,
    max_tokens: FORGE_MAX_TOKENS,
  });
  let full = '';
  for await (const chunk of stream as unknown as AsyncIterable<any>) {
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
  for await (const event of stream as unknown as AsyncIterable<any>) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text;
      controller.enqueue(enc(event.delta.text));
    }
  }
  return full;
}

async function streamOpenAICompat(messages: { role: string; content: string }[], model: string, baseURL: string, apiKey: string, system: string, controller: ReadableStreamDefaultController) {
  const client = new OpenAI({ apiKey, baseURL });
  // Determine if we should enable web search for DeepSeek based on the user's last message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  let necessidade_busca = false;
  if (lastUserMsg && /\b(hoje|agora|ultim|últim|últimas|recentes|recentemente|not[íi]cias|noticias|data|hora|clima|tempo|pre[cç]os|cotac|cota[cç][oã]es|preco|preços|lan[cç]amento|lancamento|evento|eventos|novidade|novidades|atualidade|atualizado)\b/i.test(lastUserMsg)) {
    necessidade_busca = true;
  }

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: system }, ...messages] as never,
    stream: true,
    max_tokens: FORGE_MAX_TOKENS,
  };
  // Add DeepSeek-specific flag only when targeting DeepSeek
  if (baseURL.includes('deepseek') || model === 'deepseek-chat') {
    body.search_enable = necessidade_busca;
  }

  const stream = await client.chat.completions.create(body as any);
  let full = '';
  for await (const chunk of stream as unknown as AsyncIterable<any>) {
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
  // FORGE_UPGRADE: classify each Forge prompt for the terminal TriggerReport badge.
  const triggerReport = await listSkillSummaries()
    .then(skills => analyzeIntent(prompt, skills))
    .catch(() => analyzeIntent(prompt, []));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encStatus('A contactar o modelo…'));
        let full = '';
        console.log(`[forge:chat] start model=${selectedModel}`);

        if (selectedModel === 'gpt') {
          full = await streamOpenAI(validMsgs, 'gpt-4o', FORGE_SYSTEM_WITH_FILES, controller);
        } else if (selectedModel === 'claude') {
          full = await streamAnthropic(validMsgs, FORGE_SYSTEM_WITH_FILES, controller);
        } else if (selectedModel === 'deepseek') {
          full = await streamOpenAICompat(validMsgs, 'deepseek-chat', 'https://api.deepseek.com', process.env.DEEPSEEK_API_KEY ?? '', FORGE_SYSTEM_WITH_FILES, controller);
        } else if (selectedModel === 'gemini') {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
          const gemModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite', systemInstruction: FORGE_SYSTEM_WITH_FILES });
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
          full = await streamOpenAICompat(validMsgs, cfg.name, cfg.url, cfg.key, FORGE_SYSTEM_WITH_FILES, controller);
        }

        const files = extractForgeFiles(full);
        const editProposal = extractForgeEditProposal(full);
        if (files.length) {
          controller.enqueue(encStatus(`${files.length} ficheiro${files.length > 1 ? 's' : ''} estruturado${files.length > 1 ? 's' : ''} extraido${files.length > 1 ? 's' : ''}.`));
        }
        if (editProposal) {
          controller.enqueue(encStatus(`Diff review prepared for ${editProposal.path}.`));
        }
        console.log(`[forge:chat] done model=${selectedModel} chars=${full.length} files=${files.length} edit=${editProposal ? editProposal.path : 'none'}`);
        controller.enqueue(encDone({ model: selectedModel, files, editProposal, triggerReport }));
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
