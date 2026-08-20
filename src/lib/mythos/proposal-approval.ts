/**
 * Mythos proposal approval — executes side-effecting proposals after explicit
 * human approval. memory_save writes a verifiable CognChain memory; html_draft
 * generates an HTML artifact with DeepSeek (cheap, no search needed).
 */

import { saveMemory } from '@/services/memory';

export type MythosApprovalKind = 'memory_save' | 'html_draft';

export interface MythosApprovalResult {
  ok: boolean;
  kind: MythosApprovalKind;
  detail: string;
  model: string;
  hash?: string;
  html?: string;
  htmlLength?: number;
}

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

/** Generate a self-contained HTML artifact with DeepSeek (no web search). */
async function generateHtmlWithDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY nao configurada.');

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      max_tokens: 1600,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'Voce gera artefatos HTML completos e auto-contidos (landing pages, cards, previews) com estilo moderno. Retorne APENAS o codigo HTML, sem markdown, sem explicacao.',
        },
        { role: 'user', content: prompt.slice(0, 2000) },
      ],
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || '';
  const html = raw.replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim();
  if (!response.ok || !html) {
    throw new Error(data.error?.message || `Falha ao gerar HTML (HTTP ${response.status}).`);
  }
  return html;
}

/** Approve + execute a side-effecting proposal. */
export async function approveMythosProposal(
  kind: string,
  payload: Record<string, unknown>,
): Promise<MythosApprovalResult> {
  if (kind === 'memory_save') {
    const content = typeof payload.content === 'string' ? payload.content.trim() : '';
    if (content.length < 10) throw new Error('Conteudo de memoria muito curto.');
    const memory = await saveMemory({ content: content.slice(0, 100_000), model: 'deepseek' });
    return {
      ok: true,
      kind,
      detail: `Memoria salva no CongChain: ${memory.hash}`,
      hash: memory.hash,
      model: 'deepseek',
    };
  }

  if (kind === 'html_draft') {
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
    if (prompt.length < 10) throw new Error('Prompt de HTML muito curto.');
    const html = await generateHtmlWithDeepSeek(prompt);
    return {
      ok: true,
      kind,
      detail: `Artefato HTML gerado (${html.length} caracteres).`,
      html,
      htmlLength: html.length,
      model: 'deepseek',
    };
  }

  throw new Error(`Tipo de proposta nao suportado: ${kind}`);
}
