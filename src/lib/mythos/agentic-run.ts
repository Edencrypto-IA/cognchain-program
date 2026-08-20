/**
 * Mythos agentic run — orchestration with DeepSeek function calling and a
 * deterministic fallback. Emits structured events for the SSE route.
 */

import {
  buildMythosToolSchemas,
  executeMythosTool,
  getMythosTool,
  planMythosSteps,
  type MythosAgenticPlan,
  type MythosAgentProposal,
  type MythosToolCall,
} from './agentic-loop';
import { estimateDeepSeekCostUSD, recordMythosTask } from './agentic-metrics';
import {
  buildMemoryContextBlock,
  buildTaskMemoryContent,
  retrieveMythosMemories,
  saveTaskMemory,
} from './agentic-memory';

export type MythosAgenticEvent =
  | { type: 'status'; text: string }
  | { type: 'plan'; plan: MythosAgenticPlan }
  | { type: 'tool_start'; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; ok: boolean; summary: string }
  | { type: 'proposal'; proposal: MythosAgentProposal }
  | {
      type: 'done';
      summary: string;
      tools: MythosToolCall[];
      proposals: MythosAgentProposal[];
      mode: 'function-calling' | 'deterministic';
      cost?: { estimatedCostUSD: number; inputChars: number; outputChars: number };
      memory?: { reused: number; saved: boolean; savedHash?: string };
    }
  | { type: 'error'; message: string };

export interface MythosAgenticOptions {
  model?: string;
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 8;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Execute a tool call: read-only runs now; side-effecting tools become proposals. */
async function runToolCall(
  call: MythosToolCall,
  emit: (event: MythosAgenticEvent) => void,
  proposals: MythosAgentProposal[],
  budget: { inputChars: number; outputChars: number },
): Promise<string> {
  emit({ type: 'tool_start', tool: call.tool, args: call.args });
  try {
    const result = await executeMythosTool(call.tool, call.args);
    call.result = result;
    emit({ type: 'tool_result', tool: call.tool, ok: result.ok, summary: result.summary });

    // Rough cost accounting for expensive read tools (DeepSeek web search output).
    const data = result.data as Record<string, unknown> | undefined;
    if (call.tool === 'web_search') {
      if (typeof call.args.query === 'string') budget.inputChars += call.args.query.length;
      if (data && typeof data.text === 'string') budget.outputChars += data.text.length;
    }

    const tool = getMythosTool(call.tool);
    if (tool?.permission === 'propose') {
      const kind = (['memory_save', 'html_draft', 'file_suggest'] as const).includes(call.tool as never)
        ? call.tool as MythosAgentProposal['kind']
        : 'file_suggest';
      const proposal: MythosAgentProposal = {
        kind,
        title: tool.description.slice(0, 90),
        payload: call.args,
      };
      proposals.push(proposal);
      emit({ type: 'proposal', proposal });
      return `Proposta ${kind} criada (aguarda aprovacao humana): ${JSON.stringify(call.args).slice(0, 300)}`;
    }
    return result.summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'falha ao executar ferramenta';
    call.result = { ok: false, summary: message };
    emit({ type: 'tool_result', tool: call.tool, ok: false, summary: message });
    return `Erro: ${message}`;
  }
}

function callDeepSeek(messages: DeepSeekMessage[], tools: boolean): Promise<{ message: DeepSeekMessage; finish: string | null } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  return fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      messages,
      temperature: 0.2,
      max_tokens: 1200,
      ...(tools ? { tools: buildMythosToolSchemas(), tool_choice: 'auto' as const } : {}),
    }),
    cache: 'no-store',
  })
    .then(async response => {
      if (!response.ok) {
        console.warn('[MythosAgent] DeepSeek HTTP', response.status);
        return null;
      }
      const data = await response.json() as {
        choices?: Array<{ message?: DeepSeekMessage; finish_reason?: string | null }>;
        error?: { message?: string };
      };
      if (data.error) {
        console.warn('[MythosAgent] DeepSeek error', data.error.message);
        return null;
      }
      const choice = data.choices?.[0];
      if (!choice?.message) return null;
      return { message: choice.message, finish: choice.finish_reason ?? null };
    })
    .catch(error => {
      console.warn('[MythosAgent] DeepSeek call failed', error instanceof Error ? error.message : String(error));
      return null;
    });
}

/**
 * Run the Mythos agentic loop. Prefers DeepSeek function calling; falls back
 * to the deterministic plan when the remote call is unavailable.
 */
export async function runMythosAgenticLoop(
  command: string,
  emit: (event: MythosAgenticEvent) => void,
  options: MythosAgenticOptions = {},
): Promise<void> {
  const maxIterations = Math.max(2, Math.min(12, options.maxIterations ?? DEFAULT_MAX_ITERATIONS));
  const plan = planMythosSteps(command);
  const proposals: MythosAgentProposal[] = [];
  const tools: MythosToolCall[] = [];
  const callCounts = new Map<string, number>();
  const budget = { inputChars: 0, outputChars: 0 };

  const canCall = (tool: string): boolean => {
    const def = getMythosTool(tool);
    const count = callCounts.get(tool) ?? 0;
    return !!def && count < def.maxCalls;
  };
  const bump = (tool: string) => callCounts.set(tool, (callCounts.get(tool) ?? 0) + 1);

  // Active memory: reuse verified memories before acting (DeepSeek-style).
  const retrieved = await retrieveMythosMemories(command);
  const memoryReused = retrieved.length;

  const finish = async (summary: string, mode: 'function-calling' | 'deterministic') => {
    const cost = {
      estimatedCostUSD: estimateDeepSeekCostUSD(budget.inputChars, budget.outputChars),
      inputChars: budget.inputChars,
      outputChars: budget.outputChars,
    };

    // Auto-memory: persist a compact summary as a verified-chain memory.
    let memorySaved = false;
    let savedHash: string | undefined;
    if (summary.trim()) {
      const content = buildTaskMemoryContent({
        command,
        intent: plan.intent,
        summary,
        toolCalls: tools.length,
        costUSD: cost.estimatedCostUSD,
        reusedHashes: retrieved.map(memory => memory.hash),
      });
      savedHash = (await saveTaskMemory(content, retrieved[0]?.hash)) ?? undefined;
      memorySaved = Boolean(savedHash);
    }

    recordMythosTask({
      command: command.slice(0, 200),
      intent: plan.intent,
      mode,
      toolCalls: tools.length,
      approvedCount: proposals.length,
      inputChars: budget.inputChars,
      outputChars: budget.outputChars,
      tools: Object.fromEntries(callCounts),
      memoryReused,
      memorySaved,
    });
    emit({
      type: 'done',
      summary,
      tools,
      proposals,
      mode,
      cost,
      memory: { reused: memoryReused, saved: memorySaved, savedHash },
    });
  };

  emit({ type: 'plan', plan });
  emit({ type: 'status', text: `Plano: intenção ${plan.intent} — ${plan.steps.length} passo(s).` });

  // ---- Mode 1: DeepSeek function calling ----
  const memoryBlock = buildMemoryContextBlock(retrieved);
  const systemPrompt = [
    'Voce e o Mythos, agente de IA do CongChain, executando uma tarefa com ferramentas seguras.',
    'Use as ferramentas para coletar informacoes reais antes de responder.',
    'web_search, web_read, data_query e solana_wallet sao somente leitura e executam automaticamente.',
    'memory_save e html_draft tem efeito: chamam, mas a acao so acontece apos aprovacao humana (proposta).',
    'Ao terminar, responda em portugues brasileiro com um resumo claro e cite o que usou.',
    'Seguranca: nunca assine, envie, compre, venda ou mova fundos. Nao invente fontes nem dados.',
    memoryBlock ? memoryBlock : '',
  ].filter(Boolean).join(' ');

  const history: DeepSeekMessage[] = [{ role: 'system', content: systemPrompt }, { role: 'user', content: command.slice(0, 2000) }];

  let usedFunctionCalling = false;
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    budget.inputChars += JSON.stringify(history).length;
    const remote = await callDeepSeek(history, true);
    if (!remote) break; // fall back to deterministic below

    usedFunctionCalling = true;
    const { message } = remote;
    budget.outputChars += JSON.stringify(message).length;

    if (message.tool_calls && message.tool_calls.length > 0) {
      // Record the assistant's tool calls in history.
      history.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls });
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function?.name ?? '';
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function?.arguments || '{}') as Record<string, unknown>; } catch { args = {}; }
        if (!getMythosTool(name) || !canCall(name)) {
          history.push({ role: 'tool', tool_call_id: toolCall.id, content: `Ferramenta indisponivel ou limite atingido: ${name}` });
          continue;
        }
        bump(name);
        const call: MythosToolCall = { id: toolCall.id, tool: name, args, permission: getMythosTool(name)!.permission };
        tools.push(call);
        const summary = await runToolCall(call, emit, proposals, budget);
        history.push({ role: 'tool', tool_call_id: toolCall.id, content: summary.slice(0, 1500) });
      }
      continue;
    }

    // Model finished without tool calls.
    const finalText = (message.content ?? '').trim();
    await finish(finalText || 'Tarefa concluída.', 'function-calling');
    return;
  }

  // ---- Mode 2: deterministic fallback (no remote function calling) ----
  if (!usedFunctionCalling) {
    emit({ type: 'status', text: 'Function calling indisponível — executando plano determinístico read-only.' });
    for (const step of plan.steps) {
      if (!canCall(step.tool)) {
        emit({ type: 'status', text: `Pulando ${step.tool} (limite de chamadas atingido).` });
        continue;
      }
      bump(step.tool);
      const tool = getMythosTool(step.tool);
      if (!tool) continue;
      const args = step.tool === 'solana_wallet'
        ? { address: command.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? '' }
        : step.tool === 'data_query'
          ? { command: command.slice(0, 240) }
          : step.tool === 'memory_save'
            ? { content: `Tarefa concluída pelo Mythos: ${command.slice(0, 500)}` }
            : step.tool === 'html_draft'
              ? { prompt: command.slice(0, 2000) }
              : { query: command.slice(0, 300) };
      const call: MythosToolCall = { id: `step_${tools.length + 1}`, tool: step.tool, args, permission: tool.permission };
      tools.push(call);
      await runToolCall(call, emit, proposals, budget);
    }

    const summary = `Mythos executou ${tools.filter(t => t.result?.ok).length} ferramenta(s) para "${command.slice(0, 120)}" (intenção ${plan.intent}). ${
      proposals.length ? `${proposals.length} proposta(s) aguardando sua aprovação.` : 'Tudo em modo somente leitura.'
    }`;
    await finish(summary, 'deterministic');
    return;
  }

  // Remote worked but exhausted iterations without a final answer.
  await finish(
    `Iterações esgotadas (${maxIterations}). ${tools.length} ferramenta(s) executadas; ${proposals.length} proposta(s) pendentes.`,
    'function-calling',
  );
}

export { MYTHOS_AGENT_TOOLS } from './agentic-loop';
export type { MythosToolCall as MythosAgentToolCall } from './agentic-loop';
