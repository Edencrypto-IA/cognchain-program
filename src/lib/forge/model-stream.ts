/**
 * Forge model plumbing — shared by /api/forge/chat and /api/forge/agent/run.
 *
 * Owns:
 *  - the Forge system prompts (file-proposal protocol);
 *  - provider-agnostic streaming (gpt, claude, deepseek, gemini, nvidia/glm/minimax/qwen);
 *  - extraction of model output into structured file proposals and edit diffs.
 *
 * The caller owns SSE encoding and the stream lifecycle.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { normalizeForgePath, isSafeForgePath, inferLanguage } from './paths';
import type { ForgeDiffProposal, ForgeFile } from './types';

export const FORGE_MAX_TOKENS = 2048;
export const FORGE_MAX_FILE_CONTENT = 24_000;
export const FORGE_MAX_FILES = 4;

export const FORGE_SYSTEM = `Você é o CongChain Forge — workspace de IA focado em Solana, programas Anchor, clients TypeScript e desenho de dApps com segurança em mente.
Use devnet nos exemplos por defeito. Nunca afirme que uma transação foi executada on-chain sem o utilizador fornecer uma assinatura ou prova.
Responda em português salvo se o utilizador escrever noutra língua. Use markdown (###, listas, blocos \`\`\`linguagem).
Não invente endereços, program IDs, ou assinaturas de transações. Se faltar contexto de código, pede-o de forma objetiva.`;

export const FORGE_FILE_INSTRUCTIONS = `

Quando propuser ficheiros para o Forge, use exatamente este formato antes de cada bloco de codigo:
File: app/example/page.tsx
\`\`\`tsx
// codigo aqui
\`\`\`
Use no maximo 4 ficheiros por resposta e prefira caminhos dentro de app/, components/, lib/, hooks/ ou solana/.`;

export const FORGE_SYSTEM_WITH_FILES = `${FORGE_SYSTEM}${FORGE_FILE_INSTRUCTIONS}`;

/** Agentic loop prompt: same file protocol + diff protocol, plus verify feedback support. */
export const FORGE_AGENT_SYSTEM = `${FORGE_SYSTEM}

Você está rodando em MODO AGÊNTICO. Antes de responder:
1. Pense no plano em passos (mapear, desenhar, implementar, validar).
2. Proponha arquivos no formato File: caminho + bloco de código (máx 4 arquivos).
3. Se uma edição em arquivo existente for melhor que criar, emita UM objeto JSON isolado:
{"action":"edit","path":"caminho/seguro","diff":"@@ hunk no formato unified diff @@"}
4. Só proponha. NUNCA aplique mudanças, rode comandos ou escreva no disco — o Forge revisa primeiro.
5. Se receber um relatório de verificação (lint/build) com erros, responda APENAS com as propostas corrigidas.`;

// ---- SSE event encoders (server side) ----

export function encodeEvent(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export function encodeStatus(text: string): Uint8Array {
  return encodeEvent({ status: text });
}

export function encodeDone(extra?: object): Uint8Array {
  return encodeEvent({ done: true, ...extra });
}

export function encodeError(message: string): Uint8Array {
  return encodeEvent({ error: message, done: true });
}

// ---- Model output extraction ----

export function extractForgeFiles(markdown: string): ForgeFile[] {
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

export function extractForgeEditProposal(markdown: string): ForgeDiffProposal | null {
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

// ---- Provider streaming ----

export type ForgeChatMessage = { role: string; content: string };

async function streamOpenAI(
  messages: ForgeChatMessage[],
  model: string,
  system: string,
  onToken: (token: string) => void,
): Promise<string> {
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
    if (token) { full += token; onToken(token); }
  }
  return full;
}

async function streamAnthropic(
  messages: ForgeChatMessage[],
  system: string,
  onToken: (token: string) => void,
): Promise<string> {
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
      onToken(event.delta.text);
    }
  }
  return full;
}

async function streamOpenAICompat(
  messages: ForgeChatMessage[],
  model: string,
  baseURL: string,
  apiKey: string,
  system: string,
  onToken: (token: string) => void,
): Promise<string> {
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
    if (token) { full += token; onToken(token); }
  }
  return full;
}

/**
 * Ollama local mode — private, zero API cost. Talks to a local Ollama server
 * (default http://127.0.0.1:11434) via its /api/chat streaming endpoint.
 * Data never leaves the machine. Server-side only.
 */
async function streamOllama(
  messages: ForgeChatMessage[],
  system: string,
  onToken: (token: string) => void,
  overrides?: { baseUrl?: string; model?: string },
): Promise<string> {
  const baseUrl = (overrides?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = overrides?.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Ollama não respondeu (HTTP ${response.status}). Verifique se o servidor local está em ${baseUrl}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        const json = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
        const token = json.message?.content ?? '';
        if (token) { full += token; onToken(token); }
        if (json.done) break;
      } catch {
        // Partial JSON line — wait for the next chunk.
      }
    }
  }
  return full;
}

export interface StreamModelOptions {
  model: string;
  messages: ForgeChatMessage[];
  system: string;
  onToken: (token: string) => void;
  /** BYOK overrides — sent per-request from the client, never stored/logged. */
  apiKeyOverrides?: Record<string, string>;
  ollamaOverrides?: { baseUrl?: string; model?: string };
}

/**
 * Stream a full completion from the selected provider, calling `onToken`
 * per chunk and returning the assembled text.
 */
export async function streamModelText(options: StreamModelOptions): Promise<string> {
  const { model, messages, system, onToken, apiKeyOverrides, ollamaOverrides } = options;

  if (model === 'ollama') {
    return streamOllama(messages, system, onToken, ollamaOverrides);
  }
  if (model === 'gpt') {
    return streamOpenAI(messages, 'gpt-4o', system, onToken);
  }
  if (model === 'claude') {
    return streamAnthropic(messages, system, onToken);
  }
  if (model === 'deepseek') {
    const byokKey = apiKeyOverrides?.deepseek;
    return streamOpenAICompat(messages, 'deepseek-chat', 'https://api.deepseek.com', byokKey || process.env.DEEPSEEK_API_KEY || '', system, onToken);
  }
  if (model === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
    const gemModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite', systemInstruction: system });
    const chat = gemModel.startChat({ history: [] });
    const result = await chat.sendMessageStream(messages.at(-1)?.content ?? '');
    let full = '';
    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) { full += token; onToken(token); }
    }
    return full;
  }

  const modelMap: Record<string, { url: string; name: string; key: string }> = {
    nvidia:  { url: 'https://integrate.api.nvidia.com/v1', name: 'meta/llama-3.3-70b-instruct', key: process.env.NVIDIA_API_KEY ?? '' },
    glm:     { url: 'https://integrate.api.nvidia.com/v1', name: 'z-ai/glm4.7', key: process.env.NVIDIA_GLM_KEY ?? '' },
    minimax: { url: 'https://integrate.api.nvidia.com/v1', name: 'minimaxai/minimax-m2.7', key: process.env.NVIDIA_MINIMAX_KEY ?? '' },
    qwen:    { url: 'https://integrate.api.nvidia.com/v1', name: 'qwen/qwen3-next-80b-a3b-instruct', key: process.env.NVIDIA_QWEN_KEY ?? '' },
  };
  const cfg = modelMap[model] ?? modelMap.nvidia;
  return streamOpenAICompat(messages, cfg.name, cfg.url, cfg.key, system, onToken);
}
