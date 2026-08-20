'use client';

import { useCallback, useEffect, useRef } from 'react';
import { forgeId, nowLabel } from '@/lib/forge/simulation';
import { extractFileMentions, stripFileMentions } from '@/lib/forge/context';
import { useForgeStore } from './use-forge-store';
import type { TriggerReport } from '@/trigger/triggerEngine';
import type { ForgeAgentId, ForgeDiffProposal, ForgeFile, ForgeNexusPlan } from '@/lib/forge/types';

type AgenticEvent = {
  status?: string;
  plan?: ForgeNexusPlan;
  agent?: ForgeAgentId;
  task?: string;
  token?: string;
  files?: ForgeFile[];
  edit?: { proposal: ForgeDiffProposal };
  verify?: { command: string; status: 'complete' | 'error'; output: string; durationMs: number };
  retry?: { iteration: number; maxIterations: number; reason?: string };
  done?: boolean;
  summary?: string;
  error?: string;
  triggerReport?: TriggerReport;
};

function parseSseData(raw: string): string | null {
  const data = raw
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s?/, ''))
    .join('\n');
  return data || null;
}

/**
 * Agentic Run hook — consumes /api/forge/agent/run (plan → propose → verify → fix → done)
 * and drives the existing Forge store. Proposals never write to disk: the user still
 * applies them explicitly through the diff/sandbox gate.
 */
export function useForgeAgentic() {
  const abortRef = useRef<AbortController | null>(null);
  const pendingTokensRef = useRef('');
  const rafRef = useRef<number | null>(null);

  const {
    resetRun,
    addPromptHistory,
    appendTerminal,
    updateAgent,
    updateBuildStep,
    upsertFile,
    setDiffProposal,
    setCommandRun,
    upsertMemory,
    setDeployStatus,
    setPhase,
    setRunStatus,
    setNexusPlan,
  } = useForgeStore();

  const flushPendingTokens = useCallback(() => {
    rafRef.current = null;
    const chunk = pendingTokensRef.current;
    pendingTokensRef.current = '';
    if (chunk) useForgeStore.getState().appendResponse(chunk);
  }, []);

  const scheduleToken = useCallback(
    (token: string) => {
      pendingTokensRef.current += token;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flushPendingTokens);
    },
    [flushPendingTokens],
  );

  const stopAgentic = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingTokens();
    setRunStatus('cancelled');
    setPhase('idle');
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'warning',
      source: 'Forge Agentic',
      text: 'Loop agêntico cancelado pelo utilizador.',
    });
  }, [appendTerminal, flushPendingTokens, setPhase, setRunStatus]);

  const runAgentic = useCallback(
    async (prompt: string, opts?: {
      verify?: 'lint' | 'build' | 'none';
      iterations?: number;
      contextFiles?: string[];
      localMode?: boolean;
      model?: string;
      providerKeys?: { deepseek?: string; ollamaBaseUrl?: string; ollamaModel?: string };
    }) => {
      const rawPrompt = prompt.trim();
      if (!rawPrompt) return;

      // Extract [FILE:path] mentions even if the caller passed the raw prompt,
      // then strip the tokens so the model only sees the clean instruction.
      const contextFiles = opts?.contextFiles?.length
        ? opts.contextFiles.slice(0, 5)
        : extractFileMentions(rawPrompt).slice(0, 5);
      const cleanPrompt = stripFileMentions(rawPrompt);
      if (!cleanPrompt) return;

      abortRef.current?.abort();
      pendingTokensRef.current = '';
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      resetRun(cleanPrompt);
      addPromptHistory(cleanPrompt);

      const ac = new AbortController();
      abortRef.current = ac;

      let finalized = false;
      const finalizeSuccess = (summary?: string) => {
        if (finalized) return;
        finalized = true;
        flushPendingTokens();
        ['intent', 'plan', 'files', 'verify', 'deploy'].forEach(id => updateBuildStep(id, 'complete'));
        setRunStatus('complete');
        setPhase('complete');
        setDeployStatus('Loop agêntico concluído · revisão pendente');

        (['solana', 'backend', 'ui', 'security'] as ForgeAgentId[]).forEach(id => {
          updateAgent(id, { status: 'idle', currentTask: 'Em espera' });
        });
        updateAgent('architect', {
          status: 'complete',
          progress: 100,
          currentTask: 'Loop agêntico entregue',
        });

        upsertMemory({
          id: 'm-agentic',
          label: 'Agentic Run',
          detail: cleanPrompt.slice(0, 220),
          confidence: 84,
          source: 'session',
        });

        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'success',
          source: 'Forge Agentic',
          text: summary ?? 'Loop agêntico concluído. Revise propostas no painel e aplique explicitamente.',
        });
      };

      const finalizeError = (message: string) => {
        if (finalized) return;
        finalized = true;
        flushPendingTokens();
        setRunStatus('error');
        setPhase('error');
        updateBuildStep('intent', 'error');
        setDeployStatus('Erro no loop agêntico');
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'error',
          source: 'Forge Agentic',
          text: message,
        });
      };

      const handleEvent = (evt: AgenticEvent) => {
        if (evt.status) {
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'shell',
            source: 'forge.agent',
            text: evt.status,
          });
        }
        if (evt.plan) {
          setNexusPlan(evt.plan);
          updateBuildStep('plan', 'running');
          updateAgent('architect', {
            status: 'running',
            progress: 38,
            currentTask: `Strategus: ${evt.plan.estimatedSteps} nós`,
          });
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'success',
            source: 'Forge Nexus',
            text: `Plano Nexus: ${evt.plan.estimatedSteps} nós · risco ${evt.plan.risk}.`,
          });
        }
        if (evt.agent && evt.task) {
          updateAgent(evt.agent, { status: 'running', currentTask: evt.task });
        }
        if (evt.token) {
          setRunStatus('streaming');
          setPhase('building');
          scheduleToken(evt.token);
        }
        if (evt.files?.length) {
          evt.files.forEach(file => upsertFile(file));
          updateBuildStep('files', 'complete');
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'success',
            source: 'Forge Files',
            text: `${evt.files.length} proposta${evt.files.length > 1 ? 's' : ''} pronta${evt.files.length > 1 ? 's' : ''} no explorer.`,
          });
        }
        if (evt.edit?.proposal) {
          setDiffProposal(evt.edit.proposal);
          updateBuildStep('verify', 'running');
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'warning',
            source: 'Forge Diff',
            text: `Diff de revisão pronto para ${evt.edit.proposal.path}. Aceite ou rejeite no painel.`,
          });
        }
        if (evt.verify) {
          setCommandRun({
            command: evt.verify.command as 'npm run lint' | 'npm run build',
            status: evt.verify.status,
            output: evt.verify.output,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          });
          updateBuildStep('verify', evt.verify.status === 'complete' ? 'complete' : 'error');
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: evt.verify.status === 'complete' ? 'success' : 'error',
            source: 'Forge Verify',
            text: `${evt.verify.command} ${evt.verify.status === 'complete' ? 'passou' : 'falhou'} (${evt.verify.durationMs}ms).\n${evt.verify.output.slice(0, 900)}`,
          });
        }
        if (evt.retry) {
          updateBuildStep('verify', 'running');
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'warning',
            source: 'Forge Agentic',
            text: `Correção ${evt.retry.iteration}/${evt.retry.maxIterations}: a pedir novas propostas ao modelo…`,
          });
        }
        if (evt.error) {
          finalizeError(evt.error);
          return;
        }
        if (evt.done) {
          finalizeSuccess(evt.summary);
        }
      };

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        const res = await fetch('/api/forge/agent/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(opts?.providerKeys?.deepseek ? { 'x-forge-deepseek-key': opts.providerKeys.deepseek } : {}),
            ...(opts?.providerKeys?.ollamaBaseUrl ? { 'x-forge-ollama-base-url': opts.providerKeys.ollamaBaseUrl } : {}),
            ...(opts?.providerKeys?.ollamaModel ? { 'x-forge-ollama-model': opts.providerKeys.ollamaModel } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            prompt: cleanPrompt,
            // No fixed model: the server cost router picks the cheapest fit
            // (or Ollama when localMode is on).
            model: opts?.model ?? undefined,
            localMode: opts?.localMode ?? false,
            verify: opts?.verify ?? 'lint',
            iterations: opts?.iterations ?? 2,
            contextFiles,
          }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error === 'PRO_REQUIRED') detail = 'Este modelo requer plano Pro ou sessão admin.';
            else if (j.error === 'RATE_LIMIT') detail = 'Limite de pedidos agênticos. Aguarde um minuto.';
            else if (j.error) detail = j.error;
          } catch { /* ignore */ }
          finalizeError(detail);
          return;
        }

        reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            sseBuffer += decoder.decode();
            break;
          }
          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split('\n\n');
          sseBuffer = events.pop() ?? '';
          for (const rawEvent of events) {
            const data = parseSseData(rawEvent);
            if (!data) continue;
            try {
              handleEvent(JSON.parse(data) as AgenticEvent);
              if (finalized) break;
            } catch {
              /* malformed chunk */
            }
          }
          if (finalized) break;
        }

        if (sseBuffer.trim()) {
          const data = parseSseData(sseBuffer);
          if (data) {
            try {
              handleEvent(JSON.parse(data) as AgenticEvent);
            } catch { /* ignore */ }
          }
        }

        if (!finalized) finalizeSuccess();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (!finalized) {
            finalized = true;
            flushPendingTokens();
            setRunStatus('cancelled');
            setPhase('idle');
            appendTerminal({
              id: forgeId('line'),
              timestamp: nowLabel(),
              kind: 'warning',
              source: 'Forge Agentic',
              text: 'Pedido cancelado.',
            });
          }
        } else {
          finalizeError(err instanceof Error ? err.message : 'Falha de rede ou stream.');
        }
      } finally {
        try {
          reader?.releaseLock();
        } catch {
          /* already released */
        }
        abortRef.current = null;
      }
    },
    [
      resetRun,
      addPromptHistory,
      appendTerminal,
      scheduleToken,
      flushPendingTokens,
      updateBuildStep,
      updateAgent,
      upsertFile,
      setDiffProposal,
      setCommandRun,
      upsertMemory,
      setDeployStatus,
      setPhase,
      setRunStatus,
      setNexusPlan,
    ],
  );

  useEffect(() => () => {
    abortRef.current?.abort();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { runAgentic, stopAgentic };
}
