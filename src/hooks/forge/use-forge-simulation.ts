'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createForgeEvents, forgeId, nowLabel } from '@/lib/forge/simulation';
import { useForgeStore } from './use-forge-store';

export function useForgeSimulation() {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const {
    phase,
    resetRun,
    addPromptHistory,
    appendTerminal,
    appendResponse,
    updateAgent,
    updateBuildStep,
    upsertFile,
    upsertMemory,
    setDeployStatus,
    setPhase,
  } = useForgeStore();

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runPrompt = useCallback((prompt: string) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || phase === 'building' || phase === 'planning' || phase === 'deploying') return;

    clearTimers();
    resetRun(cleanPrompt);
    addPromptHistory(cleanPrompt);

    const events = createForgeEvents(cleanPrompt);
    events.forEach((event, index) => {
      const timer = setTimeout(() => {
        if (index === 0) setPhase('planning');
        if (index === 2) setPhase('building');
        if (index === 7) setPhase('deploying');

        if (event.agent) {
          updateAgent(event.agent, {
            status: event.agentProgress && event.agentProgress >= 100 ? 'complete' : 'running',
            progress: event.agentProgress,
            currentTask: event.agentTask,
          });
        }

        if (event.terminal) {
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            ...event.terminal,
          });
        }

        if (event.responseChunk) appendResponse(event.responseChunk);
        if (event.file) upsertFile(event.file);
        if (event.memory) upsertMemory(event.memory);
        if (event.buildStep) updateBuildStep(event.buildStep.id, event.buildStep.status);
        if (event.deployStatus) setDeployStatus(event.deployStatus);

        if (index === events.length - 1) {
          ['intent', 'plan', 'files', 'verify', 'deploy'].forEach(id => updateBuildStep(id, 'complete'));
          setPhase('complete');
        }
      }, event.delay);
      timersRef.current.push(timer);
    });
  }, [
    addPromptHistory,
    appendResponse,
    appendTerminal,
    clearTimers,
    phase,
    resetRun,
    setDeployStatus,
    setPhase,
    updateAgent,
    updateBuildStep,
    upsertFile,
    upsertMemory,
  ]);

  const stop = useCallback(() => {
    clearTimers();
    setPhase('idle');
  }, [clearTimers, setPhase]);

  useEffect(() => clearTimers, [clearTimers]);

  return { runPrompt, stop };
}
