'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  forgeAgents,
  FORGE_STORAGE_KEY,
  initialBuildSteps,
  initialFiles,
  initialMemoryNodes,
  initialTerminalLines,
} from '@/lib/forge/demo-data';
import type {
  ForgeAgent,
  ForgeAgentId,
  ForgeBuildStep,
  ForgeFile,
  ForgeMemoryNode,
  ForgePanelTab,
  ForgePhase,
  ForgeRunStatus,
  ForgeSandboxSession,
  ForgeTerminalLine,
} from '@/lib/forge/types';

interface ForgeState {
  phase: ForgePhase;
  runStatus: ForgeRunStatus;
  promptHistory: string[];
  activePrompt: string;
  streamedResponse: string;
  agents: ForgeAgent[];
  terminal: ForgeTerminalLine[];
  files: ForgeFile[];
  selectedFile: string;
  buildSteps: ForgeBuildStep[];
  memoryNodes: ForgeMemoryNode[];
  deployStatus: string;
  panelTab: ForgePanelTab;
  sandboxSessions: ForgeSandboxSession[];
  activeSandboxSessionId: string;
  setPhase: (phase: ForgePhase) => void;
  setRunStatus: (runStatus: ForgeRunStatus) => void;
  setActivePrompt: (prompt: string) => void;
  setPanelTab: (tab: ForgePanelTab) => void;
  setSelectedFile: (path: string) => void;
  appendTerminal: (line: ForgeTerminalLine) => void;
  appendResponse: (chunk: string) => void;
  addPromptHistory: (prompt: string) => void;
  upsertFile: (file: ForgeFile) => void;
  upsertMemory: (node: ForgeMemoryNode) => void;
  updateAgent: (id: ForgeAgentId, patch: Partial<ForgeAgent>) => void;
  updateBuildStep: (id: string, status: ForgeBuildStep['status']) => void;
  setDeployStatus: (status: string) => void;
  applyProposal: () => ForgeSandboxSession | null;
  resetRun: (prompt: string) => void;
  resetSession: () => void;
  restoreIdle: () => void;
}

function cloneAgents() {
  return forgeAgents.map(agent => ({ ...agent, logs: [...agent.logs] }));
}

function cloneBuildSteps() {
  return initialBuildSteps.map(step => ({ ...step }));
}

function cloneFiles() {
  return initialFiles.map(file => ({ ...file }));
}

function cloneMemoryNodes() {
  return initialMemoryNodes.map(node => ({ ...node }));
}

function createSandboxHash(files: ForgeFile[]) {
  const input = files
    .map(file => `${file.path}:${file.language}:${file.contents}`)
    .sort()
    .join('\n---forge-file---\n');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `forge_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function createSessionTitle(prompt: string) {
  const clean = prompt.replace(/^\[[^\]]+\]\s*/, '').trim();
  return clean ? clean.slice(0, 58) : 'Forge sandbox proposal';
}

export const useForgeStore = create<ForgeState>()(
  persist(
    (set) => ({
      phase: 'idle',
      runStatus: 'idle',
      promptHistory: [],
      activePrompt: '',
      streamedResponse: '',
      agents: cloneAgents(),
      terminal: initialTerminalLines,
      files: cloneFiles(),
      selectedFile: initialFiles[0]?.path ?? '',
      buildSteps: cloneBuildSteps(),
      memoryNodes: cloneMemoryNodes(),
      deployStatus: 'Local sandbox',
      panelTab: 'preview',
      sandboxSessions: [],
      activeSandboxSessionId: '',
      setPhase: phase => set({ phase }),
      setRunStatus: runStatus => set({ runStatus }),
      setActivePrompt: activePrompt => set({ activePrompt }),
      setPanelTab: panelTab => set({ panelTab }),
      setSelectedFile: selectedFile => set({ selectedFile }),
      appendTerminal: line => set(state => ({ terminal: [...state.terminal.slice(-80), line] })),
      appendResponse: chunk => set(state => ({ streamedResponse: `${state.streamedResponse}${chunk}` })),
      addPromptHistory: prompt => set(state => ({
        promptHistory: [prompt, ...state.promptHistory.filter(item => item !== prompt)].slice(0, 8),
      })),
      upsertFile: file => set(state => {
        const exists = state.files.some(item => item.path === file.path);
        return {
          files: exists ? state.files.map(item => item.path === file.path ? file : item) : [...state.files, file],
          selectedFile: file.path,
          panelTab: state.panelTab === 'preview' ? 'preview' : 'code',
        };
      }),
      upsertMemory: node => set(state => {
        const exists = state.memoryNodes.some(item => item.id === node.id);
        return {
          memoryNodes: exists
            ? state.memoryNodes.map(item => item.id === node.id ? node : item)
            : [...state.memoryNodes, node],
        };
      }),
      updateAgent: (id, patch) => set(state => ({
        agents: state.agents.map(agent => {
          if (agent.id !== id) return agent;
          const nextLog = patch.currentTask && patch.currentTask !== agent.currentTask ? patch.currentTask : null;
          return {
            ...agent,
            ...patch,
            logs: nextLog ? [nextLog, ...agent.logs].slice(0, 5) : agent.logs,
          };
        }),
      })),
      updateBuildStep: (id, status) => set(state => ({
        buildSteps: state.buildSteps.map(step => step.id === id ? { ...step, status } : step),
      })),
      setDeployStatus: deployStatus => set({ deployStatus }),
      applyProposal: () => {
        let created: ForgeSandboxSession | null = null;
        set(state => {
          const proposalFiles = state.files.filter(file => file.status === 'created' || file.status === 'modified');
          if (!proposalFiles.length) return {};

          const hash = createSandboxHash(proposalFiles);
          created = {
            id: `session_${Date.now().toString(36)}`,
            title: createSessionTitle(state.activePrompt || state.promptHistory[0] || ''),
            prompt: state.activePrompt || state.promptHistory[0] || '',
            files: proposalFiles.map(file => ({ ...file })),
            appliedAt: new Date().toISOString(),
            hash,
            status: 'applied',
          };

          return {
            sandboxSessions: [created, ...state.sandboxSessions.filter(session => session.hash !== hash)].slice(0, 8),
            activeSandboxSessionId: created.id,
            deployStatus: `Sandbox applied · ${hash}`,
            panelTab: 'diff',
          };
        });
        return created;
      },
      resetRun: prompt => set({
        phase: 'thinking',
        runStatus: 'connecting',
        activePrompt: prompt,
        streamedResponse: '',
        agents: cloneAgents().map(agent => ({ ...agent, status: 'thinking', progress: Math.max(agent.progress, 16) })),
        terminal: initialTerminalLines,
        files: cloneFiles(),
        selectedFile: initialFiles[0]?.path ?? '',
        buildSteps: cloneBuildSteps(),
        memoryNodes: cloneMemoryNodes().map(node => node.id === 'm1' ? { ...node, detail: prompt, confidence: 68 } : node),
        deployStatus: 'Planning',
        panelTab: 'preview',
      }),
      resetSession: () => set({
        phase: 'idle',
        runStatus: 'idle',
        promptHistory: [],
        activePrompt: '',
        streamedResponse: '',
        agents: cloneAgents(),
        terminal: initialTerminalLines,
        files: cloneFiles(),
        selectedFile: initialFiles[0]?.path ?? '',
        buildSteps: cloneBuildSteps(),
        memoryNodes: cloneMemoryNodes(),
        deployStatus: 'Local sandbox',
        panelTab: 'preview',
        activeSandboxSessionId: '',
      }),
      restoreIdle: () => set(state => ({
        phase: state.phase === 'error' ? 'error' : 'idle',
        runStatus: state.phase === 'error' ? 'error' : 'idle',
        agents: state.agents.map(agent => ({ ...agent, status: agent.progress >= 100 ? 'complete' : 'idle' })),
      })),
    }),
    {
      name: FORGE_STORAGE_KEY,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ForgeState>;
        const rs = p.runStatus;
        const runStatus: ForgeRunStatus =
          rs === 'idle' || rs === 'connecting' || rs === 'streaming' || rs === 'complete' || rs === 'error' || rs === 'cancelled'
            ? rs
            : current.runStatus;
        return { ...current, ...p, runStatus };
      },
      partialize: state => ({
        promptHistory: state.promptHistory,
        streamedResponse: state.streamedResponse,
        terminal: state.terminal.slice(-40),
        files: state.files,
        selectedFile: state.selectedFile,
        memoryNodes: state.memoryNodes,
        deployStatus: state.deployStatus,
        panelTab: state.panelTab,
        sandboxSessions: state.sandboxSessions,
        activeSandboxSessionId: state.activeSandboxSessionId,
      }),
    },
  ),
);
