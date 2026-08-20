'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Blocks, Bot, CheckCircle2, Clipboard, Command, Database, Ellipsis, Play, RotateCcw, Settings, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import type { ForgeFile } from '@/lib/forge/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ForgeSidebar } from '@/components/forge/forge-sidebar';
import { ForgeTerminal } from '@/components/forge/forge-terminal';
import { ForgeRightPanel } from '@/components/forge/forge-right-panel';
import { ForgeFileExplorer } from '@/components/forge/forge-file-explorer';
import { NeuralOrb } from '@/components/forge/neural-orb';
import { useForgeSimulation } from '@/hooks/forge/use-forge-simulation';
import { useForgeAgentic } from '@/hooks/forge/use-forge-agentic';
import { useForgeByok } from '@/hooks/forge/use-forge-byok';
import { useForgeStore } from '@/hooks/forge/use-forge-store';
import { RUN_STATUS_LABELS } from '@/lib/forge/forge-ui';
import { forgeId, nowLabel } from '@/lib/forge/simulation';
import { buildForgeMemoryContent, FORGE_MEMORY_MODEL } from '@/lib/forge/memory';

const busyPhases = ['thinking', 'planning', 'building', 'deploying'] as const;

function ForgeWorkspaceInner() {
  const { runPrompt, stop, runPrivatePayDemo, replayLastBuild } = useForgeSimulation();
  const { runAgentic, stopAgentic } = useForgeAgentic();
  const { config: byokConfig, saveConfig: saveByokConfig, clearKeys: clearByokKeys } = useForgeByok();
  const [agentsOpen, setAgentsOpen] = useState(false);
  // FORGE_AGENTIC: when enabled, the terminal composer runs the plan→propose→verify loop.
  const [agenticMode, setAgenticMode] = useState(false);
  // FORGE_AGENTIC: local (Ollama) mode — private, zero API cost.
  const [localMode, setLocalMode] = useState(false);
  // FORGE_AGENTIC: Solana-native templates picker.
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateList, setTemplateList] = useState<Array<{ id: string; name: string; description: string; tags: string[] }>>([]);
  const [loadingTemplate, setLoadingTemplate] = useState('');
  // FORGE_AGENTIC: BYOK settings modal state.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [byokDraft, setByokDraft] = useState({ deepseekKey: '', ollamaBaseUrl: '', ollamaModel: '' });
  // FORGE_AGENTIC: Apply All in-flight guard.
  const [applyingAll, setApplyingAll] = useState(false);
  // FORGE_AGENTIC: build memory save state (explicit user action, per safety contract).
  const [buildMemorySaved, setBuildMemorySaved] = useState(false);

  const {
    phase,
    runStatus,
    agents,
    terminal,
    streamedResponse,
    files,
    selectedFile: selectedFilePath,
    buildSteps,
    deployStatus,
    commandRun,
    panelTab,
    promptHistory,
    sandboxSessions,
    activeSandboxSessionId,
    diffProposal,
    nexusPlan,
    setPanelTab,
    setSelectedFile,
    updateFileContents,
    hydrateFileContents,
    setFiles,
    markFilesApplied,
    upsertFile,
    setCommandRun,
    setDeployStatus,
    setDiffProposal,
    appendTerminal,
    applyProposal,
    resetSession,
  } = useForgeStore(
    useShallow(s => ({
      phase: s.phase,
      runStatus: s.runStatus,
      agents: s.agents,
      terminal: s.terminal,
      streamedResponse: s.streamedResponse,
      files: s.files,
      selectedFile: s.selectedFile,
      buildSteps: s.buildSteps,
      deployStatus: s.deployStatus,
      commandRun: s.commandRun,
      setDeployStatus: s.setDeployStatus,
      panelTab: s.panelTab,
      promptHistory: s.promptHistory,
      sandboxSessions: s.sandboxSessions,
      activeSandboxSessionId: s.activeSandboxSessionId,
      diffProposal: s.diffProposal,
      nexusPlan: s.nexusPlan,
      setPanelTab: s.setPanelTab,
      setSelectedFile: s.setSelectedFile,
      updateFileContents: s.updateFileContents,
      hydrateFileContents: s.hydrateFileContents,
      setFiles: s.setFiles,
      markFilesApplied: s.markFilesApplied,
      upsertFile: s.upsertFile,
      setCommandRun: s.setCommandRun,
      setDiffProposal: s.setDiffProposal,
      appendTerminal: s.appendTerminal,
      applyProposal: s.applyProposal,
      resetSession: s.resetSession,
    })),
  );

  // FORGE_AGENTIC: reset the "memory saved" flag whenever a new run starts.
  useEffect(() => {
    if (phase !== 'complete' || runStatus !== 'complete') setBuildMemorySaved(false);
  }, [phase, runStatus]);

  const busy = busyPhases.includes(phase as (typeof busyPhases)[number]);
  const canReplay = promptHistory.length > 0 && !busy;
  const latestSandboxSession =
    sandboxSessions.find(session => session.id === activeSandboxSessionId) ?? sandboxSessions[0];
  const selectedFile = files.find(file => file.path === selectedFilePath) ?? files[0];
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // FORGE_UPGRADE: Ctrl+P opens a safe fuzzy picker without changing explorer or terminal state.
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [filePickerQuery, setFilePickerQuery] = useState('');
  const [filePickerIndex, setFilePickerIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/forge/files', { credentials: 'include' })
      .then(response => response.json() as Promise<{ files?: Array<{ path: string; language?: string; size?: number }> }>)
      .then(data => {
        if (cancelled || !Array.isArray(data.files) || data.files.length === 0) return;
        setFiles(data.files.slice(0, 180).map(file => ({
          path: file.path,
          language: file.language ?? 'txt',
          status: 'queued',
          contents: '',
          real: true,
          size: file.size ?? 0,
        })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setFiles]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(value => !value);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setFilePickerOpen(true);
        setFilePickerQuery('');
        setFilePickerIndex(0);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openFile = useCallback((path: string) => {
    setSelectedFile(path);
    const existing = useForgeStore.getState().files.find(file => file.path === path);
    if (existing?.contents) return;
    void fetch(`/api/forge/file?path=${encodeURIComponent(path)}`, { credentials: 'include' })
      .then(response => response.json() as Promise<{ content?: string }>)
      .then(data => {
        if (typeof data.content === 'string') hydrateFileContents(path, data.content);
      })
      .catch(() => {});
  }, [hydrateFileContents, setSelectedFile]);

  const runSafeCommand = useCallback((command: 'npm run lint' | 'npm run build') => {
    setCommandRun({ command, status: 'running', output: '', startedAt: new Date().toISOString() });
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Forge Exec',
      text: `Running ${command} in safe allowlist mode...`,
    });
    void fetch('/api/forge/command/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command }),
    })
      .then(response => response.json() as Promise<{ status?: 'complete' | 'error'; output?: string }>)
      .then(data => {
        const status = data.status === 'complete' ? 'complete' : 'error';
        setCommandRun({ command, status, output: data.output ?? '', finishedAt: new Date().toISOString() });
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: status === 'complete' ? 'success' : 'error',
          source: 'Forge Exec',
          text: `${command} ${status === 'complete' ? 'passed' : 'failed'}.\n${(data.output ?? '').slice(0, 900)}`,
        });
      })
      .catch(error => {
        setCommandRun({ command, status: 'error', output: error instanceof Error ? error.message : 'Command failed', finishedAt: new Date().toISOString() });
      });
  }, [appendTerminal, setCommandRun]);

  const saveForgeMemory = useCallback(async () => {
    const content = [
      `Forge session: ${promptHistory[0] ?? 'manual session'}`,
      `Selected file: ${selectedFile?.path ?? 'none'}`,
      `Status: ${deployStatus}`,
      `Files loaded: ${files.length}`,
    ].join('\n');
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Memory Core',
      text: 'Saving Forge decision to CognChain memory layer...',
    });
    try {
      const response = await fetch('/api/save-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, source: 'forge' }),
      });
      const data = await response.json() as { hash?: string };
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: response.ok ? 'success' : 'warning',
        source: 'Memory Core',
        text: response.ok ? `Forge memory saved${data.hash ? `: ${data.hash}` : '.'}` : 'Memory save endpoint returned a warning.',
      });
    } catch {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Memory Core',
        text: 'Memory save unavailable; session remains local.',
      });
    }
  }, [appendTerminal, deployStatus, files.length, promptHistory, selectedFile]);

  const commandActions = useMemo(() => [
    { label: 'Run lint', detail: 'Execute npm run lint safely', action: () => runSafeCommand('npm run lint') },
    { label: 'Run build', detail: 'Execute npm run build safely', action: () => runSafeCommand('npm run build') },
    { label: 'Open preview', detail: 'Focus real sandbox preview', action: () => setPanelTab('preview') },
    { label: 'Open code', detail: 'Focus CodeMirror editor', action: () => setPanelTab('code') },
    { label: 'Review diff', detail: 'Focus accept/reject diff gate', action: () => setPanelTab('diff') },
    { label: 'Save memory', detail: 'Anchor current Forge decision locally', action: () => void saveForgeMemory() },
  ], [runSafeCommand, saveForgeMemory, setPanelTab]);

  const fuzzyMatch = useCallback((query: string, target: string): number[] | null => {
    if (!query.trim()) return [];
    const hits: number[] = [];
    let cursor = 0;
    const cleanQuery = query.toLowerCase();
    const cleanTarget = target.toLowerCase();
    for (const char of cleanQuery) {
      const found = cleanTarget.indexOf(char, cursor);
      if (found < 0) return null;
      hits.push(found);
      cursor = found + 1;
    }
    return hits;
  }, []);

  const pickerResults = useMemo(() => {
    return files
      .map(file => ({ file, hits: fuzzyMatch(filePickerQuery, file.path) }))
      .filter((item): item is { file: typeof files[number]; hits: number[] } => item.hits !== null)
      .slice(0, 80);
  }, [filePickerQuery, files, fuzzyMatch]);

  const openPickerFile = useCallback((path: string) => {
    openFile(path);
    setPanelTab('code');
    setFilePickerOpen(false);
  }, [openFile, setPanelTab]);

  const handleReset = useCallback(() => {
    stop();
    resetSession();
  }, [stop, resetSession]);

  const handleApplyProposal = useCallback(() => {
    const session = applyProposal();
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: session ? 'success' : 'warning',
      source: 'Forge Sandbox',
      text: session
        ? `Applied ${session.files.length} file proposal(s) to sandbox session ${session.hash}.`
        : 'No generated file proposal available to apply.',
    });
  }, [appendTerminal, applyProposal]);

  // FORGE_AGENTIC: Apply All — writes every proposal (created/modified files + pending diff)
  // to the workspace through the existing safe endpoints, then records a sandbox session.
  const handleApplyAll = useCallback(async (): Promise<{ applied: number; total: number } | null> => {
    if (applyingAll || busy) return null;
    const proposalFiles = files.filter(
      file => (file.status === 'created' || file.status === 'modified') && file.contents.trim().length > 0,
    );
    const diffTarget = diffProposal && !proposalFiles.some(file => file.path === diffProposal.path) ? diffProposal : null;
    if (!proposalFiles.length && !diffTarget) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Forge Apply',
        text: 'Nenhuma proposta disponível para aplicar.',
      });
      return null;
    }

    setApplyingAll(true);
    const results: Array<{ path: string; ok: boolean; error?: string }> = [];

    for (const file of proposalFiles) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'shell',
        source: 'Forge Apply',
        text: `Aplicando ${file.path}…`,
      });
      try {
        const response = await fetch('/api/forge/file/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: file.path, content: file.contents }),
        });
        const data = await response.json() as { error?: unknown };
        if (!response.ok) {
          const message = typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
          results.push({ path: file.path, ok: false, error: message });
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'error',
            source: 'Forge Apply',
            text: `✗ ${file.path}: ${message}`,
          });
        } else {
          results.push({ path: file.path, ok: true });
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'success',
            source: 'Forge Apply',
            text: `✓ ${file.path} aplicado no workspace.`,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha de rede ao aplicar.';
        results.push({ path: file.path, ok: false, error: message });
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'error',
          source: 'Forge Apply',
          text: `✗ ${file.path}: ${message}`,
        });
      }
    }

    if (diffTarget) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'shell',
        source: 'Forge Apply',
        text: `Aplicando diff ${diffTarget.path}…`,
      });
      try {
        const response = await fetch('/api/forge/file/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: diffTarget.path, diff: diffTarget.diff }),
        });
        const data = await response.json() as { content?: unknown; error?: unknown };
        if (!response.ok || typeof data.content !== 'string') {
          const message = typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
          results.push({ path: diffTarget.path, ok: false, error: message });
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'error',
            source: 'Forge Apply',
            text: `✗ diff ${diffTarget.path}: ${message}`,
          });
        } else {
          results.push({ path: diffTarget.path, ok: true });
          updateFileContents(diffTarget.path, data.content);
          appendTerminal({
            id: forgeId('line'),
            timestamp: nowLabel(),
            kind: 'success',
            source: 'Forge Apply',
            text: `✓ diff ${diffTarget.path} aplicado no workspace.`,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha de rede ao aplicar diff.';
        results.push({ path: diffTarget.path, ok: false, error: message });
        appendTerminal({
          id: forgeId('line'),
          timestamp: nowLabel(),
          kind: 'error',
          source: 'Forge Apply',
          text: `✗ diff ${diffTarget.path}: ${message}`,
        });
      }
    }

    const okPaths = results.filter(result => result.ok).map(result => result.path);
    const okCount = okPaths.length;
    if (okPaths.length) {
      // Sandbox session first (it collects created/modified proposals), then mark applied.
      const session = applyProposal();
      markFilesApplied(okPaths);
      if (diffTarget && okPaths.includes(diffTarget.path)) setDiffProposal(null);
      setDeployStatus(`Apply All · ${okCount}/${results.length} aplicados`);
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: okCount === results.length ? 'success' : 'warning',
        source: 'Forge Apply',
        text: `Apply All concluído: ${okCount}/${results.length} aplicados no workspace.${session ? ` Sandbox ${session.hash}.` : ''}`,
      });
    } else {
      setDeployStatus('Apply All · falhou');
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'error',
        source: 'Forge Apply',
        text: 'Apply All: nenhum arquivo foi aplicado. Revise os erros acima.',
      });
    }
    setApplyingAll(false);
    return { applied: okCount, total: results.length };
  }, [applyingAll, busy, files, diffProposal, appendTerminal, applyProposal, markFilesApplied, setDeployStatus, updateFileContents, setDiffProposal]);

  // FORGE_AGENTIC: build memory — save the completed build summary to the
  // CognChain memory layer through an explicit user action (safety contract).
  const buildMemoryReady = phase === 'complete' && runStatus === 'complete';

  const saveBuildMemory = useCallback(async () => {
    if (!buildMemoryReady || buildMemorySaved) return;
    const memoryFiles = files.filter(
      file => file.status === 'created' || file.status === 'modified' || file.status === 'applied',
    );
    const content = buildForgeMemoryContent({
      prompt: promptHistory[0] ?? undefined,
      deployStatus,
      files: memoryFiles.map(file => file.path),
      sandboxHash: latestSandboxSession?.hash,
      verify: commandRun ? `${commandRun.command} → ${commandRun.status}` : undefined,
      source: 'forge',
    });
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Memory Core',
      text: 'Salvando memória do build na camada CognChain…',
    });
    try {
      const response = await fetch('/api/save-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, model: FORGE_MEMORY_MODEL }),
      });
      const data = await response.json() as { hash?: string; error?: string };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
      }
      setBuildMemorySaved(true);
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'success',
        source: 'Memory Core',
        text: data.hash ? `Memória do build salva: ${data.hash}` : 'Memória do build salva.',
      });
    } catch (err) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Memory Core',
        text: `Não foi possível salvar a memória do build: ${err instanceof Error ? err.message : 'erro desconhecido'}.`,
      });
    }
  }, [buildMemoryReady, buildMemorySaved, files, promptHistory, deployStatus, latestSandboxSession, commandRun, appendTerminal]);

  // FORGE_AGENTIC: one-click flow — Apply All proposals, then save the build
  // memory. The single click IS the explicit user action (safety contract).
  const handleApplyAllAndSave = useCallback(async () => {
    const result = await handleApplyAll();
    if (result && result.applied > 0 && buildMemoryReady) {
      await saveBuildMemory();
    }
  }, [handleApplyAll, buildMemoryReady, saveBuildMemory]);

  // FORGE_AGENTIC: Solana-native templates (Anchor, pump.fun, SPL, dApp).
  const openTemplates = useCallback(() => {
    setTemplatesOpen(true);
    if (templateList.length) return;
    void fetch('/api/forge/templates', { credentials: 'include' })
      .then(response => response.json() as Promise<{ templates?: Array<{ id: string; name: string; description: string; tags: string[] }> }>)
      .then(data => {
        if (Array.isArray(data.templates)) setTemplateList(data.templates);
      })
      .catch(() => {});
  }, [templateList.length]);

  const loadTemplate = useCallback(async (templateId: string) => {
    if (loadingTemplate) return;
    setLoadingTemplate(templateId);
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Forge Templates',
      text: `Carregando template ${templateId}…`,
    });
    try {
      const response = await fetch('/api/forge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId }),
      });
      const data = await response.json() as {
        files?: ForgeFile[];
        error?: string;
        template?: { id?: string; name?: string };
      };
      if (!response.ok || !Array.isArray(data.files) || !data.files.length) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
      }
      data.files.forEach(file => upsertFile(file));
      setPanelTab('files');
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'success',
        source: 'Forge Templates',
        text: `Template ${data.template?.name ?? templateId} carregado: ${data.files.length} arquivo(s). Revise e aplique explicitamente.`,
      });
    } catch (err) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Forge Templates',
        text: `Falha ao carregar template: ${err instanceof Error ? err.message : 'erro desconhecido'}.`,
      });
    } finally {
      setLoadingTemplate('');
      setTemplatesOpen(false);
    }
  }, [appendTerminal, loadingTemplate, setPanelTab, upsertFile]);

  // FORGE_UPLOAD: files loaded from the user's computer (sandbox).
  const handleUploaded = useCallback((uploaded: Array<{ path: string; name: string; language: string; size: number }>) => {
    for (const file of uploaded) {
      upsertFile({ path: file.path, language: file.language, status: 'queued', contents: '', real: true, size: file.size });
    }
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'success',
      source: 'Forge Upload',
      text: `${uploaded.length} arquivo(s) carregado(s) no sandbox. Clique para abrir o código.`,
    });
  }, [appendTerminal, upsertFile]);

  const handleUploadError = useCallback((message: string) => {
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'warning',
      source: 'Forge Upload',
      text: `Upload: ${message}`,
    });
  }, [appendTerminal]);

  // FORGE_UPLOAD: persist an uploaded file as a verifiable CognChain memory.
  const handleSaveAsMemory = useCallback(async (path: string) => {
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'shell',
      source: 'Memory Core',
      text: `Salvando ${path} como memória verificável…`,
    });
    try {
      const response = await fetch('/api/forge/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path }),
      });
      const data = await response.json() as { hash?: string; error?: string; truncated?: boolean };
      if (!response.ok || !data.hash) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${response.status}`);
      }
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'success',
        source: 'Memory Core',
        text: `Arquivo salvo como memória: ${data.hash}${data.truncated ? ' (conteúdo truncado)' : ''}`,
      });
    } catch (err) {
      appendTerminal({
        id: forgeId('line'),
        timestamp: nowLabel(),
        kind: 'warning',
        source: 'Memory Core',
        text: `Falha ao salvar memória: ${err instanceof Error ? err.message : 'erro desconhecido'}.`,
      });
    }
  }, [appendTerminal]);

  // FORGE_AGENTIC: BYOK settings (user-owned keys, localStorage only).
  const openSettings = useCallback(() => {
    setByokDraft({
      deepseekKey: byokConfig.deepseekKey,
      ollamaBaseUrl: byokConfig.ollamaBaseUrl,
      ollamaModel: byokConfig.ollamaModel,
    });
    setSettingsOpen(true);
  }, [byokConfig]);

  const handleSaveSettings = useCallback(() => {
    saveByokConfig(byokDraft);
    setSettingsOpen(false);
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'success',
      source: 'Forge BYOK',
      text: 'Configuração BYOK salva (armazenada apenas neste navegador).',
    });
  }, [byokDraft, saveByokConfig, appendTerminal]);

  const handleClearByok = useCallback(() => {
    clearByokKeys();
    setByokDraft(current => ({ ...current, deepseekKey: '' }));
    appendTerminal({
      id: forgeId('line'),
      timestamp: nowLabel(),
      kind: 'warning',
      source: 'Forge BYOK',
      text: 'Chave DeepSeek removida deste navegador.',
    });
  }, [clearByokKeys, appendTerminal]);

  const handleCopySelectedFile = useCallback(() => {
    if (!selectedFile) return;
    navigator.clipboard?.writeText(selectedFile.contents).catch(() => {});
  }, [selectedFile]);

  const handleCopySandboxSummary = useCallback(() => {
    const session = latestSandboxSession;
    const summary = session
      ? [
        `Forge sandbox session: ${session.title}`,
        `Hash: ${session.hash}`,
        `Applied at: ${session.appliedAt}`,
        `Files:`,
        ...session.files.map(file => `- ${file.path} (${file.language})`),
      ].join('\n')
      : [
        'Forge sandbox proposal',
        `Selected file: ${selectedFile?.path ?? 'none'}`,
        `Status: ${deployStatus}`,
      ].join('\n');
    navigator.clipboard?.writeText(summary).catch(() => {});
  }, [deployStatus, latestSandboxSession, selectedFile]);

  return (
    <main className="relative flex h-screen max-h-screen min-h-0 flex-col overflow-hidden bg-[#0f0f10] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-16rem] h-96 w-[42rem] -translate-x-1/2 rounded-full bg-[#9945FF]/8 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-12rem] h-96 w-96 rounded-full bg-[#14F195]/5 blur-3xl" />
      </div>

      <header className="relative z-10 flex h-9 shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#111113]/95 px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="grid size-7 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-white/45 transition-colors hover:text-white/85"
            aria-label="Back to CongChain"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
          <span className="text-xs font-semibold tracking-tight text-white/72">Forge</span>
          <div className="hidden items-center gap-1.5 text-[10px] text-white/32 sm:flex">
            <NeuralOrb active={phase !== 'idle'} className="scale-75" />
            <span className="max-w-[7rem] truncate">{RUN_STATUS_LABELS[runStatus]}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-7 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-white/45 transition-colors hover:text-white/85 data-[state=open]:bg-white/[0.08]"
              aria-label="Mais opções"
            >
              <Ellipsis className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 border-white/[0.08] bg-[#0b0b0d] text-white/76">
              <DropdownMenuLabel className="text-xs text-white/38">Forge</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleReset} className="text-xs">
                <RotateCcw className="size-3.5" />
                Nova sessão
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void runPrivatePayDemo()} disabled={busy} className="text-xs">
                <Play className="size-3.5" />
                Demo PrivatePay
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void replayLastBuild()} disabled={!canReplay} className="text-xs">
                <Sparkles className="size-3.5" />
                Repetir último build
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onSelect={handleApplyProposal} disabled={busy} className="text-xs">
                <CheckCircle2 className="size-3.5" />
                Aplicar proposta
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleApplyAll()} disabled={busy || applyingAll} className="text-xs">
                <Zap className="size-3.5" />
                Aplicar tudo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleApplyAllAndSave()} disabled={busy || applyingAll || !buildMemoryReady} className="text-xs">
                <Database className="size-3.5" />
                Aplicar e salvar memória
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void saveBuildMemory()} disabled={!buildMemoryReady || buildMemorySaved} className="text-xs">
                <Database className="size-3.5" />
                Salvar memória do build
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleCopySandboxSummary} className="text-xs">
                <Clipboard className="size-3.5" />
                Copiar resumo do sandbox
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onSelect={openTemplates} className="text-xs">
                <Blocks className="size-3.5" />
                Templates Solana
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openSettings} className="text-xs">
                <Settings className="size-3.5" />
                Config (BYOK)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAgentsOpen(true)} className="text-xs">
                <Bot className="size-3.5" />
                Agentes
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <DropdownMenuItem onSelect={() => { window.location.href = '/pricing'; }} className="text-xs">
                <Database className="size-3.5" />
                Preços (BRL)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={handleReset}
            className="grid size-7 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-white/45 transition-colors hover:text-white/85"
            aria-label="Nova sessão"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </header>


      <section className="relative z-10 hidden min-h-0 flex-1 overflow-hidden lg:block">
        <ResizablePanelGroup direction="horizontal" className="h-full min-h-0 overflow-hidden">
          <ResizablePanel defaultSize={16} minSize={12} maxSize={28}>
            <ForgeFileExplorer
              files={files}
              selectedFile={selectedFilePath}
              buildSteps={buildSteps}
              busy={busy}
              onSelectFile={openFile}
              onUploaded={handleUploaded}
              onUploadError={handleUploadError}
              onSaveAsMemory={(path) => void handleSaveAsMemory(path)}
            />
          </ResizablePanel>
          <ResizableHandle className="bg-white/[0.06]" />
          <ResizablePanel defaultSize={79} minSize={50}>
            <ResizablePanelGroup direction="vertical" className="h-full min-h-0 overflow-hidden">
              <ResizablePanel defaultSize={62} minSize={38}>
                <ForgeRightPanel
                  phase={phase}
                  runStatus={runStatus}
                  files={files}
                  selectedFile={selectedFilePath}
                  deployStatus={deployStatus}
                  tab={panelTab}
                  onTabChange={setPanelTab}
                  onSelectFile={openFile}
                  // FORGE_UPGRADE: Code tab can persist edited content and update the Forge store.
                  onFileSaved={updateFileContents}
                  onPrivatePayDemo={runPrivatePayDemo}
                  onReplayLast={replayLastBuild}
                  onApplyProposal={handleApplyProposal}
                  onApplyAll={() => void handleApplyAll()}
                  onApplyAllAndSave={() => void handleApplyAllAndSave()}
                  canReplay={canReplay}
                  busy={busy}
                  latestSandboxSession={latestSandboxSession}
                  diffProposal={diffProposal}
                  // FORGE_UPGRADE: Diff proposals can be accepted only from the explicit review button.
                  onDiffAccepted={updateFileContents}
                  onDiffRejected={() => setDiffProposal(null)}
                  onInlineDiff={setDiffProposal}
                  nexusPlan={nexusPlan}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-white/[0.06]" />
              <ResizablePanel defaultSize={38} minSize={26}>
                <ForgeTerminal
                  phase={phase}
                  runStatus={runStatus}
                  terminal={terminal}
                  streamedResponse={streamedResponse}
                  // FORGE_UPGRADE: Terminal composer can attach @file context from the explorer graph.
                  files={files}
                  onRunPrompt={runPrompt}
                  // FORGE_AGENTIC: plan→propose→verify loop from the same composer.
                  onRunAgentic={(prompt, opts) => runAgentic(prompt, {
                    ...opts,
                    localMode,
                    providerKeys: {
                      deepseek: byokConfig.deepseekKey || undefined,
                      ollamaBaseUrl: byokConfig.ollamaBaseUrl || undefined,
                      ollamaModel: byokConfig.ollamaModel || undefined,
                    },
                  })}
                  agenticMode={agenticMode}
                  onAgenticModeChange={setAgenticMode}
                  localMode={localMode}
                  onLocalModeChange={setLocalMode}
                  onStop={agenticMode ? stopAgentic : stop}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 pb-4 lg:hidden">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-[min(52vh,28rem)] shrink-0"
        >
          <ForgeRightPanel
            phase={phase}
            runStatus={runStatus}
            files={files}
            selectedFile={selectedFilePath}
            deployStatus={deployStatus}
            tab={panelTab}
            onTabChange={setPanelTab}
            onSelectFile={openFile}
            // FORGE_UPGRADE: Code tab can persist edited content and update the Forge store.
            onFileSaved={updateFileContents}
            onPrivatePayDemo={runPrivatePayDemo}
            onReplayLast={replayLastBuild}
            onApplyProposal={handleApplyProposal}
            onApplyAll={() => void handleApplyAll()}
            onApplyAllAndSave={() => void handleApplyAllAndSave()}
            canReplay={canReplay}
            busy={busy}
            latestSandboxSession={latestSandboxSession}
            diffProposal={diffProposal}
            // FORGE_UPGRADE: Diff proposals can be accepted only from the explicit review button.
            onDiffAccepted={updateFileContents}
            onDiffRejected={() => setDiffProposal(null)}
            onInlineDiff={setDiffProposal}
            nexusPlan={nexusPlan}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="min-h-[14rem] shrink-0"
        >
          <ForgeTerminal
            phase={phase}
            runStatus={runStatus}
            terminal={terminal}
            streamedResponse={streamedResponse}
            // FORGE_UPGRADE: Terminal composer can attach @file context from the explorer graph.
            files={files}
            onRunPrompt={runPrompt}
            // FORGE_AGENTIC: plan→propose→verify loop from the same composer.
            onRunAgentic={(prompt, opts) => runAgentic(prompt, {
              ...opts,
              localMode,
              providerKeys: {
                deepseek: byokConfig.deepseekKey || undefined,
                ollamaBaseUrl: byokConfig.ollamaBaseUrl || undefined,
                ollamaModel: byokConfig.ollamaModel || undefined,
              },
            })}
            agenticMode={agenticMode}
            onAgenticModeChange={setAgenticMode}
            localMode={localMode}
            onLocalModeChange={setLocalMode}
            onStop={agenticMode ? stopAgentic : stop}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="max-h-[38vh] min-h-[12rem] shrink-0 overflow-hidden"
        >
          <ForgeFileExplorer
            files={files}
            selectedFile={selectedFilePath}
            buildSteps={buildSteps}
            busy={busy}
            onSelectFile={openFile}
            onUploaded={handleUploaded}
            onUploadError={handleUploadError}
            onSaveAsMemory={(path) => void handleSaveAsMemory(path)}
          />
        </motion.div>
      </section>

      <Sheet open={agentsOpen} onOpenChange={setAgentsOpen}>
        <SheetContent side="right" className="w-[min(28rem,92vw)] border-white/[0.08] bg-[#08080a] p-0 text-white sm:max-w-[28rem]">
          <SheetHeader className="border-b border-white/[0.07] p-4">
            <SheetTitle className="flex items-center gap-2 text-white/88">
              <Bot className="size-4 text-[#C084FC]" />
              Agent Mesh
            </SheetTitle>
            <SheetDescription className="text-white/38">
              Select and monitor Forge agents without leaving the code workspace.
            </SheetDescription>
          </SheetHeader>
          <ForgeSidebar
            agents={agents}
            phase={phase}
            runStatus={runStatus}
            deployStatus={deployStatus}
            promptHistory={promptHistory}
            sandboxSessions={sandboxSessions}
            terminal={terminal}
            busy={busy}
            onPromptSelect={runPrompt}
          />
        </SheetContent>
      </Sheet>
      {commandPaletteOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onClick={() => setCommandPaletteOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-white/[0.09] bg-[#08080a] p-2 shadow-2xl shadow-black" onClick={event => event.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2 text-white/50">
              <Command className="size-4 text-[#00D4FF]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Forge Command Palette</span>
              <span className="ml-auto font-mono text-[10px] text-white/25">Ctrl K</span>
            </div>
            <div className="p-2">
              {commandActions.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-[#14F195]">
                    <Command className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white/82">{item.label}</span>
                    <span className="block truncate text-[11px] text-white/35">{item.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {filePickerOpen && (
        <div
          className="absolute bottom-0 left-[21%] right-0 top-10 z-40 bg-black/40 pt-8"
          onClick={() => setFilePickerOpen(false)}
        >
          <div
            className="mx-auto w-[min(480px,92%)] overflow-hidden rounded-[10px] border border-[#1f3a1f] bg-[#0d120d] shadow-2xl shadow-black"
            onClick={event => event.stopPropagation()}
          >
            <input
              value={filePickerQuery}
              onChange={event => {
                setFilePickerQuery(event.target.value);
                setFilePickerIndex(0);
              }}
              onKeyDown={event => {
                if (event.key === 'Escape') setFilePickerOpen(false);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setFilePickerIndex(index => Math.min(index + 1, Math.max(0, pickerResults.length - 1)));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setFilePickerIndex(index => Math.max(0, index - 1));
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const picked = pickerResults[filePickerIndex]?.file;
                  if (picked) openPickerFile(picked.path);
                }
              }}
              autoFocus
              placeholder="Buscar arquivo..."
              className="w-full border-0 border-b border-[#1f3a1f] bg-transparent px-4 py-3 font-mono text-[13px] text-[#b8d4b8] outline-none"
            />
            <div className="max-h-[17rem] overflow-y-auto py-1">
              {pickerResults.slice(0, 32).map((item, index) => {
                const hitSet = new Set(item.hits);
                return (
                  <button
                    key={item.file.path}
                    type="button"
                    onClick={() => openPickerFile(item.file.path)}
                    className={`block w-full px-4 py-2 text-left font-mono text-[12px] ${
                      index === filePickerIndex ? 'bg-[#0d2a1a] text-[#00FF9C]' : 'text-white/55 hover:bg-[#111a11]'
                    }`}
                  >
                    {item.file.path.split('').map((char, charIndex) => (
                      <span key={`${item.file.path}-${charIndex}`} className={hitSet.has(charIndex) ? 'text-[#00FF9C]' : undefined}>
                        {char}
                      </span>
                    ))}
                  </button>
                );
              })}
              {pickerResults.length === 0 ? <p className="px-4 py-6 text-center text-xs text-white/28">Nenhum arquivo encontrado.</p> : null}
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[14vh]"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#08080a] p-4 shadow-2xl shadow-black"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 border-b border-white/[0.07] pb-2">
              <Settings className="size-4 text-[#C084FC]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">BYOK — traga sua própria chave</span>
            </div>
            <p className="mb-3 text-[11px] leading-5 text-white/38">
              Chaves ficam <span className="text-white/60">apenas neste navegador</span> (localStorage) e são enviadas
              por requisição para a sua sessão — nunca são salvas no servidor. DeepSeek é o modelo barato para refactors
              simples; Ollama roda 100% local.
            </p>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Chave DeepSeek (opcional)</label>
            <input
              type="password"
              value={byokDraft.deepseekKey}
              onChange={event => setByokDraft(current => ({ ...current, deepseekKey: event.target.value }))}
              placeholder="sk-..."
              className="mb-3 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[12px] text-white/75 outline-none placeholder:text-white/20 focus:border-[#C084FC]/40"
            />
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Ollama base URL</label>
            <input
              type="text"
              value={byokDraft.ollamaBaseUrl}
              onChange={event => setByokDraft(current => ({ ...current, ollamaBaseUrl: event.target.value }))}
              placeholder="http://127.0.0.1:11434"
              className="mb-3 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[12px] text-white/75 outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40"
            />
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Ollama model</label>
            <input
              type="text"
              value={byokDraft.ollamaModel}
              onChange={event => setByokDraft(current => ({ ...current, ollamaModel: event.target.value }))}
              placeholder="qwen2.5-coder:7b"
              className="mb-4 w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 font-mono text-[12px] text-white/75 outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40"
            />
            <div className="flex items-center justify-end gap-2">
              {byokConfig.deepseekKey ? (
                <button
                  type="button"
                  onClick={handleClearByok}
                  className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/15"
                >
                  Remover chave
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/55 transition-colors hover:text-white/80"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="rounded-lg border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-2 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {templatesOpen && (
        <div
          className="absolute inset-0 z-40 flex items-start justify-center bg-black/50 px-4 pt-[14vh]"
          onClick={() => setTemplatesOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#08080a] p-3 shadow-2xl shadow-black"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 border-b border-white/[0.07] px-1 pb-2">
              <Blocks className="size-4 text-[#00D4FF]" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Templates Solana-native</span>
              <span className="ml-auto text-[10px] text-white/25">propostas — aplique explicitamente</span>
            </div>
            <div className="max-h-[46vh] space-y-2 overflow-y-auto">
              {templateList.map(template => (
                <button
                  key={template.id}
                  type="button"
                  disabled={loadingTemplate === template.id}
                  onClick={() => void loadTemplate(template.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-left transition-colors hover:border-[#14F195]/30 hover:bg-[#14F195]/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]">
                    <Blocks className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white/82">{template.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-white/40">{template.description}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {template.tags.map(tag => (
                        <span key={tag} className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#00D4FF]/80">
                          {tag}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              ))}
              {!templateList.length ? (
                <p className="px-2 py-6 text-center text-xs text-white/30">Carregando templates…</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export function ForgeWorkspace() {
  return <ForgeWorkspaceInner />;
}
