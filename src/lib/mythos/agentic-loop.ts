/**
 * Mythos agentic loop — tool executors bound to the pure core definitions.
 *
 * Read-only tools run automatically; side-effecting tools (memory, HTML)
 * become proposals that require human approval.
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import {
  MYTHOS_TOOL_DEFS,
  getMythosToolDef,
  deepseekWebSearch,
  type MythosToolDef,
} from './agentic-core';
import { readWebUrl } from './web-reader';
import { parseMythosExternalDataCommand, runMythosExternalDataQuery } from './external-data-query';
import { runMythosSolanaEngine } from '@/features/agent-memory-bridge/solana-dev-engine';

// Web search cache: repeated queries hit the cache, not the paid API.
const WEB_SEARCH_CACHE_TTL_MS = 10 * 60_000;
const webSearchCache = new Map<string, { text: string; expiresAt: number }>();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export type { MythosAgentProposal, MythosAgenticPlan } from './agentic-core';
export { buildMythosToolSchemas, planMythosSteps } from './agentic-core';

export interface MythosToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  permission: 'read' | 'propose';
  result?: { ok: boolean; summary: string; data?: unknown };
}

export interface MythosTool extends MythosToolDef {
  execute: (args: unknown) => Promise<{ ok: boolean; summary: string; data?: unknown }>;
}

const memorySaveArgs = z.object({
  content: z.string().min(10).max(4000),
  label: z.string().max(120).optional(),
});
const htmlDraftArgs = z.object({ prompt: z.string().min(10).max(2000) });

const EXECUTORS: Record<string, MythosTool['execute']> = {
  async web_search(args) {
    const { query } = (z.object({ query: z.string().min(3).max(300) }).parse(args));
    const cacheKey = sha256(query.toLowerCase().trim());
    const hit = webSearchCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return { ok: true, summary: hit.text.slice(0, 1200), data: { query, text: hit.text.slice(0, 6000), cached: true } };
    }
    const text = await deepseekWebSearch(query);
    webSearchCache.set(cacheKey, { text, expiresAt: Date.now() + WEB_SEARCH_CACHE_TTL_MS });
    return { ok: true, summary: text.slice(0, 1200), data: { query, text: text.slice(0, 6000), cached: false } };
  },
  async web_read(args) {
    const { url } = z.object({ url: z.string().min(8).max(500) }).parse(args);
    const result = await readWebUrl(url);
    if (!result.success) throw new Error(result.error || `Falha ao ler ${url}`);
    return {
      ok: true,
      summary: `${result.title} — ${result.wordCount} palavras`,
      data: { title: result.title, content: result.content.slice(0, 6000), contentHash: result.contentHash },
    };
  },
  async data_query(args) {
    const { command } = z.object({ command: z.string().min(3).max(240) }).parse(args);
    const parsed = parseMythosExternalDataCommand(command);
    if (!parsed) throw new Error(`Comando de dados não reconhecido: ${command}`);
    const report = await runMythosExternalDataQuery(parsed.kind, parsed.query);
    return {
      ok: true,
      summary: `${report.title} — ${report.summary.slice(0, 400)}`,
      data: { kind: report.kind, title: report.title, summary: report.summary.slice(0, 4000), facts: report.facts },
    };
  },
  async solana_wallet(args) {
    const { address } = z.object({ address: z.string().min(32).max(48) }).parse(args);
    const result = await runMythosSolanaEngine({ mode: 'wallet', input: address });
    const record = result as unknown as Record<string, unknown>;
    const summary = typeof record.summary === 'string'
      ? record.summary
      : `Análise de carteira ${address.slice(0, 8)}… concluída.`;
    return { ok: true, summary: summary.slice(0, 800), data: result };
  },
  async memory_save(args) {
    const { content, label } = memorySaveArgs.parse(args);
    return { ok: true, summary: `Proposta de memória pronta (${label || 'sem rótulo'})`, data: { content, label } };
  },
  async html_draft(args) {
    const { prompt } = htmlDraftArgs.parse(args);
    return { ok: true, summary: 'Proposta de artefato HTML pronta para revisão', data: { prompt } };
  },
};

export const MYTHOS_AGENT_TOOLS: MythosTool[] = MYTHOS_TOOL_DEFS.map(def => ({
  ...def,
  execute: EXECUTORS[def.id] ?? (async () => ({ ok: false, summary: `Executor não implementado: ${def.id}` })),
}));

export function getMythosTool(id: string): MythosTool | null {
  const def = getMythosToolDef(id);
  if (!def) return null;
  return MYTHOS_AGENT_TOOLS.find(tool => tool.id === id) ?? null;
}

/** Validate + execute one tool call. */
export async function executeMythosTool(toolId: string, args: unknown): Promise<{ ok: boolean; summary: string; data?: unknown }> {
  const tool = getMythosTool(toolId);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${toolId}`);
  return tool.execute(args);
}
