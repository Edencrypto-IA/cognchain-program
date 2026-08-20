import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { checkRateLimit, validateModel, Limits, MODEL_TIER, ValidationError } from '@/lib/security';
import { verifyAdminToken } from '@/lib/auth';
import { requireApiKey } from '@/lib/api-key-auth';
import {
  FORGE_AGENT_SYSTEM,
  encodeDone,
  encodeError,
  encodeEvent,
  encodeStatus,
  extractForgeEditProposal,
  extractForgeFiles,
  streamModelText,
} from '@/lib/forge/model-stream';
import { createForgeNexusPlan } from '@/lib/forge/nexus';
import { classifyForgeTask, selectForgeModel } from '@/lib/forge/cost-router';
import { runAllowlistedCommand, FORGE_ALLOWED_COMMANDS, type ForgeCommand } from '@/lib/forge/commands';
import { validateContextFiles, buildForgeContextBlock, type ForgeContextFile } from '@/lib/forge/context';
import { searchForgeContext } from '@/lib/forge/context-search';
import { resolveForgePath } from '@/lib/forge/paths';
import type { ForgeDiffProposal, ForgeFile } from '@/lib/forge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ITERATIONS = 3;
const DEFAULT_ITERATIONS = 2;
const VERIFY_FEEDBACK_MAX_CHARS = 6_000;
const AGENT_RUN_LIMIT_KEY = '/api/forge/agent/run';

type VerifyMode = 'lint' | 'build' | 'none';

function normalizeVerifyMode(value: unknown): VerifyMode {
  if (value === 'build') return 'build';
  if (value === 'none') return 'none';
  return 'lint';
}

function normalizeIterations(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ITERATIONS;
  return Math.max(1, Math.min(MAX_ITERATIONS, Math.floor(value)));
}

interface AgentRunState {
  files: ForgeFile[];
  editProposal: ForgeDiffProposal | null;
  verify: { command: ForgeCommand; status: 'complete' | 'error'; output: string; durationMs: number } | null;
}

export async function POST(req: NextRequest) {
  let body: { prompt?: unknown; model?: unknown; verify?: unknown; iterations?: unknown; contextFiles?: unknown; repoContext?: unknown; localMode?: unknown };
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
  const verifyMode = normalizeVerifyMode(body.verify);
  const maxIterations = normalizeIterations(body.iterations);
  const contextFilePaths = validateContextFiles(body.contextFiles);
  const repoContextEnabled = body.repoContext !== false;
  const localMode = body.localMode === true;

  // ---- Auth / tier / rate limit (same posture as /api/forge/chat) ----
  const adminToken = req.cookies.get('cog_admin')?.value ?? '';
  const isAdmin = adminToken ? verifyAdminToken(adminToken) : false;

  const hasApiKey = req.headers.get('authorization')?.startsWith('Bearer cog_') || req.headers.get('x-api-key')?.startsWith('cog_');
  let userPlan: 'free' | 'pro' = isAdmin ? 'pro' : 'free';
  if (!isAdmin && hasApiKey) {
    const auth = await requireApiKey(req);
    if ('key' in auth && auth.key) userPlan = (auth.key.plan === 'pro' || auth.key.plan === 'enterprise') ? 'pro' : 'free';
  }

  // Cost router: an explicit model override wins; local mode (Ollama) is next;
  // otherwise pick the cheapest model that fits the task complexity and the
  // user tier (simple→Qwen/DeepSeek, complex→NVIDIA/Claude).
  const explicitModel = typeof body.model === 'string' && body.model.trim() ? body.model : '';
  let selectedModel: string;
  if (explicitModel) {
    try { selectedModel = validateModel(explicitModel); } catch { selectedModel = 'nvidia'; }
  } else if (localMode) {
    selectedModel = 'ollama';
  } else {
    selectedModel = selectForgeModel(prompt, userPlan);
  }
  try { selectedModel = validateModel(selectedModel); } catch { selectedModel = 'nvidia'; }
  if (MODEL_TIER(selectedModel) === 'pro' && userPlan === 'free') {
    return new Response(JSON.stringify({ error: 'PRO_REQUIRED' }), { status: 402, headers: { 'Content-Type': 'application/json' } });
  }

  if (!isAdmin && !hasApiKey) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, AGENT_RUN_LIMIT_KEY);
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: 'RATE_LIMIT' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
  }

  // BYOK: user-owned keys sent per-request as headers — bounded, never logged,
  // never persisted server-side. DeepSeek key + Ollama base URL/model.
  const byokDeepseekKey = req.headers.get('x-forge-deepseek-key') ?? '';
  const byokOllamaBaseUrl = req.headers.get('x-forge-ollama-base-url') ?? '';
  const byokOllamaModel = req.headers.get('x-forge-ollama-model') ?? '';
  const apiKeyOverrides = byokDeepseekKey ? { deepseek: byokDeepseekKey.slice(0, 200) } : undefined;
  const ollamaOverrides = {
    ...(byokOllamaBaseUrl ? { baseUrl: byokOllamaBaseUrl.slice(0, 300) } : {}),
    ...(byokOllamaModel ? { model: byokOllamaModel.slice(0, 80) } : {}),
  } as { baseUrl?: string; model?: string };

  const stream = new ReadableStream({
    async start(controller) {
      const state: AgentRunState = { files: [], editProposal: null, verify: null };

      const mergeOutput = (full: string) => {
        const files = extractForgeFiles(full);
        const editProposal = extractForgeEditProposal(full);
        if (files.length) {
          // Upsert by path so retry passes replace earlier proposals.
          const seen = new Set(files.map(f => f.path));
          state.files = [...state.files.filter(f => !seen.has(f.path)), ...files];
          controller.enqueue(encodeEvent({ files }));
          controller.enqueue(encodeStatus(`${files.length} proposta(s) de ficheiro pronta(s) para revisão.`));
        }
        if (editProposal) {
          state.editProposal = editProposal;
          controller.enqueue(encodeEvent({ edit: { proposal: editProposal } }));
          controller.enqueue(encodeStatus(`Diff de revisão preparado para ${editProposal.path}.`));
        }
      };

      try {
        controller.enqueue(encodeStatus('Nexus: a gerar plano de execução…'));

        // ---- 1. PLAN ----
        const plan = createForgeNexusPlan(prompt);
        controller.enqueue(encodeEvent({ plan }));
        controller.enqueue(encodeStatus(`Strategus: ${plan.estimatedSteps} nós · risco ${plan.risk} · revisão humana obrigatória.`));
        controller.enqueue(encodeEvent({ agent: 'architect', task: `Plano Nexus pronto (${plan.estimatedSteps} nós)` }));

        // ---- 1b. CONTEXT (real repo files: @file selection or auto repo map) ----
        let userMessage = prompt;
        if (contextFilePaths.length) {
          controller.enqueue(encodeStatus(`A ler ${contextFilePaths.length} arquivo(s) de contexto…`));
          const contextEntries: ForgeContextFile[] = [];
          for (const contextPath of contextFilePaths) {
            const target = resolveForgePath(contextPath);
            if (!target) continue;
            const content = await readFile(target.absolutePath, 'utf8').catch(() => null);
            if (content) contextEntries.push({ path: target.relativePath, content });
          }
          const contextBlock = buildForgeContextBlock(contextEntries);
          if (contextBlock) {
            userMessage = `${contextBlock}Pedido do usuário:\n${prompt}`;
            controller.enqueue(encodeStatus(`Contexto injetado: ${contextEntries.length} arquivo(s).`));
          } else {
            controller.enqueue(encodeStatus('Nenhum arquivo de contexto pôde ser lido (caminhos inválidos ou fora do allowlist).'));
          }
        } else if (repoContextEnabled) {
          controller.enqueue(encodeStatus('A indexar o repositório para contexto automático…'));
          const repo = await searchForgeContext(prompt);
          if (repo.files.length) {
            const mapBlock = `Estrutura do repositório (${repo.indexedFiles} arquivos indexados):\n${repo.map}\n\n`;
            const fileBlock = buildForgeContextBlock(repo.files.map(({ path, content }) => ({ path, content })));
            userMessage = `${mapBlock}${fileBlock}Pedido do usuário:\n${prompt}`;
            controller.enqueue(encodeStatus(`Contexto automático: ${repo.indexedFiles} arquivos indexados, ${repo.files.length} relevantes injetados.`));
          } else {
            controller.enqueue(encodeStatus('Repositório sem arquivos relevantes encontrados; seguindo sem contexto.'));
          }
        }

        // ---- 2. PROPOSE ----
        const taskComplexity = classifyForgeTask(prompt);
        controller.enqueue(encodeStatus(`Router de custo: tarefa ${taskComplexity} → modelo ${selectedModel} (tier ${userPlan}).`));
        controller.enqueue(encodeStatus(`A contactar o modelo (${selectedModel})…`));
        let full: string;
        try {
          full = await streamModelText({
            model: selectedModel,
            messages: [{ role: 'user', content: userMessage }],
            system: FORGE_AGENT_SYSTEM,
            apiKeyOverrides,
            ollamaOverrides,
            onToken: token => controller.enqueue(encodeEvent({ token })),
          });
        } catch (err) {
          const message = err instanceof ValidationError ? err.message : (err instanceof Error ? err.message : String(err));
          console.error(`[forge:agent] stream error model=${selectedModel}`, message);
          controller.enqueue(encodeError('Falha ao gerar as propostas. Verifique as chaves de API no servidor ou tente outro modelo.'));
          return;
        }

        mergeOutput(full);

        // ---- 3. VERIFY + FIX LOOP ----
        if (verifyMode !== 'none' && FORGE_ALLOWED_COMMANDS.has(verifyMode === 'build' ? 'npm run build' : 'npm run lint')) {
          const command: ForgeCommand = verifyMode === 'build' ? 'npm run build' : 'npm run lint';
          for (let iteration = 1; iteration <= maxIterations; iteration++) {
            controller.enqueue(encodeStatus(`Verificação ${iteration}/${maxIterations}: ${command}…`));
            controller.enqueue(encodeEvent({ agent: 'backend', task: `A validar com ${command} (${iteration}/${maxIterations})` }));

            const result = await runAllowlistedCommand(command);
            state.verify = result;
            controller.enqueue(encodeEvent({ verify: result }));

            if (result.status === 'complete') {
              controller.enqueue(encodeStatus(`${command} passou (${result.durationMs}ms).`));
              break;
            }

            controller.enqueue(encodeEvent({
              retry: { iteration, maxIterations, reason: `${command} falhou` },
            }));
            controller.enqueue(encodeStatus(`⚠ ${command} falhou. A pedir correções ao modelo…`));

            if (iteration >= maxIterations) {
              controller.enqueue(encodeStatus(`Sem mais tentativas (máx ${maxIterations}). Propostas mantidas para revisão manual.`));
              break;
            }

            const feedback = `O comando "${command}" falhou na verificação. Saída (limitada):\n\`\`\`\n${result.output.slice(0, VERIFY_FEEDBACK_MAX_CHARS)}\n\`\`\`\nCorrija as propostas anteriores e retorne APENAS os arquivos corrigidos no formato File: caminho + código, ou um diff JSON {"action":"edit",...}. Não escreva no disco.`;
            try {
              full = await streamModelText({
                model: selectedModel,
                messages: [
                  { role: 'user', content: userMessage },
                  { role: 'assistant', content: 'Propostas geradas. Aguardando verificação.' },
                  { role: 'user', content: feedback },
                ],
                system: FORGE_AGENT_SYSTEM,
                apiKeyOverrides,
                ollamaOverrides,
                onToken: token => controller.enqueue(encodeEvent({ token })),
              });
              mergeOutput(full);
            } catch (err) {
              console.error('[forge:agent] retry stream error', err instanceof Error ? err.message : String(err));
              controller.enqueue(encodeStatus('Não foi possível obter correções do modelo; mantendo propostas atuais.'));
              break;
            }
          }
        }

        // ---- 4. DONE ----
        controller.enqueue(encodeEvent({ agent: 'security', task: 'Revisão final de risco concluída' }));
        const summary = [
          `Loop agêntico concluído: ${state.files.length} proposta(s) de ficheiro${state.editProposal ? ` + 1 diff (${state.editProposal.path})` : ''}.`,
          verifyMode === 'none'
            ? 'Verificação automática desativada.'
            : state.verify
              ? `${state.verify.command} ${state.verify.status === 'complete' ? 'passou' : 'falhou'} (${state.verify.durationMs}ms).`
              : 'Sem verificação executada.',
          'Nada foi escrito no disco — revise as propostas e aplique explicitamente.',
        ].join(' ');
        controller.enqueue(encodeDone({
          model: selectedModel,
          summary,
          files: state.files,
          editProposal: state.editProposal,
          verify: state.verify,
          plan,
        }));
        console.log(`[forge:agent] done model=${selectedModel} files=${state.files.length} edit=${state.editProposal ? state.editProposal.path : 'none'} verify=${state.verify?.status ?? 'none'}`);
      } catch (err) {
        const message = err instanceof ValidationError ? err.message : (err instanceof Error ? err.message : String(err));
        console.error('[forge:agent] error', message);
        controller.enqueue(encodeError('Falha no loop agêntico. Tente novamente ou mude o modelo.'));
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
