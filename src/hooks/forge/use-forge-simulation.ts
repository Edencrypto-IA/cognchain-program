'use client';

import { useCallback, useEffect, useRef } from 'react';
import { forgeId, nowLabel } from '@/lib/forge/simulation';
import { useForgeStore } from './use-forge-store';
import type { ForgeAgentId } from '@/lib/forge/types';

const FORGE_MODEL = 'nvidia';

type StreamEvent = { status?: string; token?: string; done?: boolean; error?: string };

function parseSseData(raw: string): string | null {
  const data = raw
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s?/, ''))
    .join('\n');
  return data || null;
}

export function useForgeSimulation() {
  const abortRef = useRef<AbortController | null>(null);
  const pendingTokensRef = useRef('');
  const rafRef = useRef<number | null>(null);

  const phase = useForgeStore(s => s.phase);
  const {
    resetRun,
    addPromptHistory,
    appendTerminal,
    updateAgent,
    updateBuildStep,
    upsertMemory,
    setDeployStatus,
    setPhase,
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingTokens();
    setPhase('idle');
  }, [flushPendingTokens, setPhase]);

  const runPrompt = useCallback(
    async (prompt: string) => {
      const cleanPrompt = prompt.trim();
      if (!cleanPrompt || ['thinking', 'planning', 'building', 'deploying'].includes(phase)) return;

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

      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'system',
        source: 'Forge Kernel',
        text: 'A pedir stream ao modelo (CongChain Forge)…',
      });
      updateBuildStep('intent', 'running');
      setDeployStatus('Modelo em execução');

      let firstToken = false;
      let finalized = false;

      const finalizeSuccess = () => {
        if (finalized) return;
        finalized = true;
        flushPendingTokens();
        ['intent', 'plan', 'files', 'verify', 'deploy'].forEach(id => updateBuildStep(id, 'complete'));
        setPhase('complete');
        setDeployStatus('Resposta Forge · sem deploy on-chain automático');

        const agentsIdle: ForgeAgentId[] = ['solana', 'backend', 'ui', 'security'];
        agentsIdle.forEach(id => {
          updateAgent(id, { status: 'idle', currentTask: 'Em espera' });
        });
        updateAgent('architect', {
          status: 'complete',
          progress: 100,
          currentTask: 'Resposta do modelo entregue',
        });

        upsertMemory({
          id: 'm1',
          label: 'Prompt Intent',
          detail: cleanPrompt.slice(0, 220),
          confidence: 86,
        });

        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'success',
          source: 'Forge Kernel',
          text: 'Stream concluído. Revise a resposta acima; próximos passos podem ligar ficheiros e RPC.',
        });
      };

      const finalizeError = (message: string) => {
        if (finalized) return;
        finalized = true;
        flushPendingTokens();
        setPhase('error');
        updateBuildStep('intent', 'error');
        setDeployStatus('Erro no modelo');
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'error',
          source: 'Forge Kernel',
          text: message,
        });
      };

      const handleEvent = (evt: StreamEvent) => {
        if (evt.status) {
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'shell',
            source: 'forge.llm',
            text: evt.status,
          });
        }
        if (evt.token) {
          if (!firstToken) {
            firstToken = true;
            setPhase('building');
            updateBuildStep('intent', 'complete');
            updateBuildStep('plan', 'running');
          }
          scheduleToken(evt.token);
        }
        if (evt.error) {
          finalizeError(evt.error);
          return;
        }
        if (evt.done) {
          finalizeSuccess();
        }
      };

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        const res = await fetch('/api/forge/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prompt: cleanPrompt, model: FORGE_MODEL }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          let detail = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error === 'PRO_REQUIRED') detail = 'Este modelo requer plano Pro ou sessão admin.';
            else if (j.error === 'RATE_LIMIT') detail = 'Limite de pedidos. Aguarde um minuto e tente de novo.';
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
              handleEvent(JSON.parse(data) as StreamEvent);
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
              handleEvent(JSON.parse(data) as StreamEvent);
            } catch { /* ignore */ }
          }
        }

        if (!finalized) finalizeSuccess();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (!finalized) {
            finalized = true;
            flushPendingTokens();
            appendTerminal({
              id: forgeId('line'),
              timestamp: nowLabel(),
              kind: 'warning',
              source: 'Forge Kernel',
              text: 'Pedido cancelado.',
            });
            setPhase('idle');
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
      phase,
      resetRun,
      addPromptHistory,
      appendTerminal,
      scheduleToken,
      flushPendingTokens,
      updateBuildStep,
      updateAgent,
      upsertMemory,
      setDeployStatus,
      setPhase,
    ],
  );

  useEffect(() => () => {
    abortRef.current?.abort();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { runPrompt, stop };
}
