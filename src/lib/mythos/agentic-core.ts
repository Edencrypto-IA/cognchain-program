/**
 * Mythos agentic core — pure planner, tool definitions and schema builders.
 *
 * Deliberately dependency-free (only zod): it powers the agentic loop and is
 * unit-testable without a server or heavy imports. Executors live in
 * agentic-loop.ts.
 */

import { z } from 'zod';

export type MythosToolPermission = 'read' | 'propose';

export interface MythosToolDef {
  id: string;
  description: string;
  parameters: z.ZodTypeAny;
  permission: MythosToolPermission;
  maxCalls: number;
}

export interface MythosAgentProposal {
  kind: 'memory_save' | 'html_draft' | 'file_suggest';
  title: string;
  payload: Record<string, unknown>;
}

export interface MythosAgenticPlan {
  intent: string;
  steps: Array<{ tool: string; purpose: string }>;
  safety: string[];
}

// ── zod → JSON schema (OpenAI/DeepSeek function-calling shape) ────────────

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options as string[] };
  if (schema.isOptional()) {
    const unwrap = (schema as unknown as { unwrap(): z.ZodTypeAny }).unwrap();
    return zodToJsonSchema(unwrap);
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional)) required.push(key);
    }
    return { type: 'object', properties, required };
  }
  return { type: 'string' };
}

export { zodToJsonSchema };

// ── Tool definitions (no executors — see agentic-loop.ts) ─────────────────

export const MYTHOS_TOOL_DEFS: MythosToolDef[] = [
  {
    id: 'web_search',
    description: 'Buscar na internet informações atualizadas (DeepSeek search). Útil para notícias, preços, fatos recentes, pesquisa de mercado.',
    parameters: z.object({ query: z.string().min(3).max(300).describe('Busca a fazer na internet') }),
    permission: 'read',
    maxCalls: 3,
  },
  {
    id: 'web_read',
    description: 'Ler o conteúdo de uma URL pública (via leitor de páginas). Útil quando já se sabe o endereço.',
    parameters: z.object({ url: z.string().min(8).max(500).describe('URL pública para ler') }),
    permission: 'read',
    maxCalls: 3,
  },
  {
    id: 'data_query',
    description: 'Consultar dados públicos estruturados: CEP, CNPJ, Selic, IPCA, dólar, B3, Fed, radar político, transparência.',
    parameters: z.object({ command: z.string().min(3).max(240).describe('Comando de dados: cep <cep>, cnpj <cnpj>, selic, dolar, ipca, b3, fed, radar politico <tema>...') }),
    permission: 'read',
    maxCalls: 3,
  },
  {
    id: 'solana_wallet',
    description: 'Análise read-only de uma carteira Solana pública: saldo, atividade, risco e explicação.',
    parameters: z.object({ address: z.string().min(32).max(48).describe('Endereço público Solana (base58) para análise read-only') }),
    permission: 'read',
    maxCalls: 2,
  },
  {
    id: 'memory_save',
    description: 'Salvar uma memória no CongChain (com hash verificável). Ação com efeito — vira proposta para o usuário aprovar.',
    parameters: z.object({
      content: z.string().min(10).max(4000).describe('Memória que o usuário quer salvar'),
      label: z.string().max(120).optional(),
    }),
    permission: 'propose',
    maxCalls: 2,
  },
  {
    id: 'html_draft',
    description: 'Gerar um artefato HTML (landing, card, preview) a partir de uma descrição. Ação com efeito — vira proposta.',
    parameters: z.object({ prompt: z.string().min(10).max(2000).describe('Descrição do artefato HTML desejado') }),
    permission: 'propose',
    maxCalls: 2,
  },
];

export function getMythosToolDef(id: string): MythosToolDef | null {
  return MYTHOS_TOOL_DEFS.find(tool => tool.id === id) ?? null;
}

/** Build the OpenAI/DeepSeek function-calling tool list. */
export function buildMythosToolSchemas(): Array<Record<string, unknown>> {
  return MYTHOS_TOOL_DEFS.map(tool => ({
    type: 'function',
    function: {
      name: tool.id,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }));
}

// ── Intent inference (local mirror of the orchestrator's rules) ────────────

const POLITICAL_PATTERNS = /\b(pol[ií]tic\w*|prefeitura|vereador|deputado|senador|governador|presidente|elei[cç][aã]o|tse|tre|tcu|tce|cgu|transpar[eê]ncia)\b/i;
const FINANCIAL_PATTERNS = /\b(selic|ipca|d[oó]lar|b3|bolsa|ibovespa|fed|copom|juros|infla[cç][aã]o|mercado|financeiro)\b/i;
const CODE_PATTERNS = /\b(c[oó]digo|debug|erro|log|stack|typescript|javascript|python|solana program|anchor|api|endpoint)\b/i;
const HTML_PATTERNS = /\b(html|landing|site|website|p[aá]gina|design|layout|css|preview)\b/i;
const PRODUCT_PATTERNS = /\b(comprar|procurar|produto|pre[cç]o|marketplace|mercado livre|amazon|powerbank|oferta)\b/i;
const SOLANA_PATTERNS = /\b(solana|wallet|carteira|token|tx|assinatura|phantom|pump\.?fun|memecoin)\b/i;

export function inferMythosIntent(command: string): string {
  if (POLITICAL_PATTERNS.test(command)) return 'analise_politica';
  if (FINANCIAL_PATTERNS.test(command)) return 'busca_financeira';
  if (PRODUCT_PATTERNS.test(command)) return 'produto_compras';
  if (HTML_PATTERNS.test(command)) return 'criacao_html';
  if (CODE_PATTERNS.test(command)) return 'analise_codigo';
  if (SOLANA_PATTERNS.test(command)) {
    if (/\b(memecoin|pump\.?fun|lan[cç]ar|criar\s+meme)\b/i.test(command)) return 'memecoin_safe_draft';
    return 'solana_readonly';
  }
  if (/\b(plano|planeje|fa[cç]a tudo|workflow|multi.?step|agente)\b/i.test(command)) return 'multi_step_agente';
  return 'roteamento_simples';
}

// ── Planner (deterministic) ────────────────────────────────────────────────

export function planMythosSteps(command: string): MythosAgenticPlan {
  const intent = inferMythosIntent(command);
  const lowered = command.toLowerCase();

  const steps: Array<{ tool: string; purpose: string }> = [];
  if (intent === 'solana_readonly') {
    const addressMatch = command.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (addressMatch) {
      steps.push({ tool: 'solana_wallet', purpose: `Analisar carteira ${addressMatch[0].slice(0, 8)}…` });
    } else {
      steps.push({ tool: 'web_search', purpose: 'Buscar informações sobre o ativo/endereço Solana citado' });
    }
  } else if (intent === 'produto_compras' || intent === 'busca_financeira' || intent === 'radar_publico' || intent === 'analise_politica' || intent === 'analise_codigo') {
    steps.push({ tool: 'web_search', purpose: `Pesquisar: ${command.slice(0, 140)}` });
    if (intent === 'analise_politica') {
      steps.push({ tool: 'data_query', purpose: 'Tentar dados públicos complementares (radar político)' });
    }
  } else if (intent === 'memecoin_safe_draft') {
    steps.push({ tool: 'web_search', purpose: 'Pesquisar contexto do memecoin/token' });
    steps.push({ tool: 'html_draft', purpose: 'Propor draft visual (proposta)' });
  } else {
    // Default: navigate.
    steps.push({ tool: 'web_search', purpose: `Pesquisar: ${command.slice(0, 140)}` });
  }

  const hasExplicitMemory = /(salvar|lembrar|memorizar|guarda\s+essa)/i.test(lowered);
  if (hasExplicitMemory) {
    steps.push({ tool: 'memory_save', purpose: 'Propor salvar o resultado como memória verificável' });
  }

  return {
    intent,
    steps,
    safety: [
      'Somente leitura por padrão: busca, leitura de URL e dados públicos executam automaticamente.',
      'Ações com efeito (memória, HTML) viram propostas e exigem aprovação humana.',
      'Nenhuma assinatura, transação, compra ou movimentação de fundos é executada.',
    ],
  };
}

/** Shared DeepSeek web search helper (cheap native navigation). */
export async function deepseekWebSearch(
  query: string,
  systemPrompt = 'Voce e o Mythos, um agente de IA do CongChain. Use busca web para responder com informacoes atualizadas e verificaveis. Responda em portugues brasileiro. Se nao encontrar fonte, diga claramente. Nao invente dados nem fontes.',
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY nao configurada.');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      max_tokens: 900,
      temperature: 0.2,
      search_enable: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query.slice(0, 400) },
      ],
    }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  if (!response.ok || !text) {
    throw new Error(data.error?.message || `DeepSeek web search falhou (HTTP ${response.status}).`);
  }
  return text;
}
