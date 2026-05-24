'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  Loader2,
  Network,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_COGNITIVE_LAYERS,
  MYTHOS_FEATURED_SKILLS,
  MYTHOS_SKILL_CATEGORIES,
} from '../mythos';
import type { MythosSkillRouteResult } from '../skill-router';

type MythosLabMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

type MythosCognitiveTrace = {
  perception?: string;
  memoryContext?: string;
  selectedSkill?: string;
  reasoningPath?: string;
  prediction?: string;
  decision?: string;
  confidence?: number;
  safetyBoundary?: string;
  nextHumanStep?: string;
};

type MythosLabSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: 'demo' | 'connected';
  model: string;
  skillId: string;
  messages: MythosLabMessage[];
  lastTrace?: MythosCognitiveTrace;
  lastObservability?: MythosObservability;
  lastSkillRoute?: MythosSkillRouteResult;
};

type MythosObservability = {
  model?: string;
  modelLabel?: string;
  latencyMs?: number;
  traceSchema?: string;
  mode?: string;
  memoryHash?: string;
  savedAt?: string;
};

type MemoryWriteResponse = {
  hash?: string;
  error?: string;
};

const STORAGE_KEY = 'congchain:mythos-lab:sessions:v1';

const STARTER_PROMPTS = [
  {
    label: 'Analyze',
    prompt: 'Analyze a real task and explain which Mythos skill should govern it.',
  },
  {
    label: 'Research',
    prompt: 'Research how Mythos should evaluate an AI agent idea before saving memory.',
  },
  {
    label: 'Reason',
    prompt: 'Reason about a 401 API error and show the safe next debugging steps.',
  },
  {
    label: 'Create',
    prompt: 'Create a production-safe plan to connect an external agent to CongChain.',
  },
];

const GUARDRAILS = [
  'No API keys, private keys, seed phrases, wallet secrets, signed payloads, or hidden prompts in memory.',
  'No buys, sells, payments, signatures, scheduling, or fund movement from the Lab.',
  'Saving memory requires an explicit CongChain key and a visible user action.',
  'The cognitive trace is an operational explanation, not hidden chain-of-thought.',
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function shortHash(value?: string, size = 12) {
  if (!value) return 'not saved';
  return value.length > size ? `${value.slice(0, size)}...` : value;
}

function cleanTerminalText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, match => match.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, ''))
    .replace(/(^|\s)\*\*([^*\n]+)\*\*/g, '$1$2')
    .replace(/(^|\s)__([^_\n]+)__/g, '$1$2')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function makeSession(): MythosLabSession {
  const createdAt = nowIso();
  return {
    id: createId('mythos_session'),
    title: 'Welcome to Mythos',
    createdAt,
    updatedAt: createdAt,
    mode: 'demo',
    model: 'nvidia',
    skillId: MYTHOS_FEATURED_SKILLS[0]?.id || 'congchain-memory',
    messages: [
      {
        id: createId('msg'),
        role: 'system',
        createdAt,
        content:
          'Mythos Lab is ready. Choose a skill, send a task, review the cognitive trace, then save only approved output as CongChain memory.',
      },
    ],
  };
}

function safeLoadSessions(): MythosLabSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as MythosLabSession[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function traceCards(trace?: MythosCognitiveTrace) {
  return [
    { label: 'Perception', value: trace?.perception || 'No task observed yet.' },
    { label: 'Memory', value: trace?.memoryContext || 'No private memory loaded automatically.' },
    { label: 'Skill', value: trace?.selectedSkill || 'Choose a skill before testing.' },
    { label: 'Decision', value: trace?.decision || 'No decision recorded yet.' },
    { label: 'Prediction', value: trace?.prediction || 'No forecast available yet.' },
    { label: 'Safety', value: trace?.safetyBoundary || 'No secrets, no funds, no automatic writes.' },
  ];
}

export default function MythosLabConsole() {
  const profile = MYTHOS_AGENT_PROFILE;
  const [sessions, setSessions] = useState<MythosLabSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const loaded = safeLoadSessions();
    const initial = loaded.length > 0 ? loaded : [makeSession()];
    setSessions(initial);
    setActiveId(initial[0]?.id || '');
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 8)));
    }
  }, [sessions]);

  const activeSession = sessions.find(session => session.id === activeId) || sessions[0];
  const selectedSkill =
    MYTHOS_FEATURED_SKILLS.find(skill => skill.id === activeSession?.skillId) ||
    MYTHOS_FEATURED_SKILLS[0];
  const selectedCategory = MYTHOS_SKILL_CATEGORIES.find(category => category.id === selectedSkill?.category);
  const categorySkills = MYTHOS_FEATURED_SKILLS.filter(skill => skill.category === selectedSkill?.category);
  const assistantMessages = activeSession?.messages.filter(message => message.role === 'assistant') || [];
  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  const canSaveMemory = apiKey.trim().startsWith('cog_live_') && Boolean(lastAssistant?.content);

  const memoryPayload = useMemo(() => ({
    content: lastAssistant?.content || '',
    model: 'mythos',
    metadata: {
      source: 'mythos',
      contentType: 'mythos_lab_response',
      agentId: 'mythos-lab',
      agentName: 'Mythos',
      namespace: profile.identity.namespace,
      selectedSkill: selectedSkill?.name,
      skillPath: selectedSkill?.path,
      sessionId: activeSession?.id,
      skillRoute: activeSession?.lastSkillRoute,
      cognitiveTrace: activeSession?.lastTrace,
      observability: activeSession?.lastObservability,
      origin: 'mythos-lab',
      safety: {
        containsSecrets: false,
        containsPrivateKeys: false,
        containsSignedPayloads: false,
        canMoveFunds: false,
        requiresHumanReview: true,
      },
    },
  }), [activeSession?.id, activeSession?.lastObservability, activeSession?.lastSkillRoute, activeSession?.lastTrace, lastAssistant?.content, profile.identity.namespace, selectedSkill?.name, selectedSkill?.path]);

  function updateActive(updater: (session: MythosLabSession) => MythosLabSession) {
    setSessions(current => current.map(session => session.id === activeSession?.id ? updater(session) : session));
  }

  function startSession() {
    const session = makeSession();
    setSessions(current => [session, ...current].slice(0, 8));
    setActiveId(session.id);
    setInput('');
    setNotice('');
  }

  function setSessionField<K extends keyof MythosLabSession>(key: K, value: MythosLabSession[K]) {
    updateActive(session => ({ ...session, [key]: value, updatedAt: nowIso() }));
  }

  async function routeSkillForPrompt(content: string) {
    const response = await fetch('/api/mythos/skill-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: content,
        currentSkillId: selectedSkill?.id,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Mythos could not route this skill.');
    return data as MythosSkillRouteResult;
  }

  async function routeCurrentDraft() {
    if (!activeSession || loading) return;
    const content = input.trim();
    if (!content) {
      setNotice('Write a task first, then Mythos can select the governing skill.');
      return;
    }

    setLoading(true);
    setNotice('');
    try {
      const route = await routeSkillForPrompt(content);
      updateActive(session => ({
        ...session,
        skillId: route.selectedSkill.id,
        lastSkillRoute: route,
        updatedAt: nowIso(),
      }));
      setNotice(`Skill routed to ${route.selectedSkill.name}. Review it before sending.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Mythos could not route this skill.');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(prompt?: string) {
    if (!activeSession || loading) return;
    const content = (prompt || input).trim();
    if (!content) return;

    const createdAt = nowIso();
    const userMessage: MythosLabMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      createdAt,
    };
    const nextMessages = [...activeSession.messages, userMessage];
    updateActive(session => ({
      ...session,
      title: session.messages.filter(message => message.role === 'user').length === 0
        ? content.slice(0, 42)
        : session.title,
      messages: nextMessages,
      updatedAt: createdAt,
    }));
    setInput('');
    setLoading(true);
    setNotice('');

    const started = Date.now();
    try {
      const route = await routeSkillForPrompt(content);
      const routedSkill =
        MYTHOS_FEATURED_SKILLS.find(skill => skill.id === route.selectedSkill.id) ||
        selectedSkill;
      updateActive(session => ({
        ...session,
        skillId: route.selectedSkill.id,
        lastSkillRoute: route,
        updatedAt: nowIso(),
      }));

      const response = await fetch('/api/mythos/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeSession.model,
          mode: activeSession.mode,
          selectedSkill: routedSkill?.name,
          skillPath: routedSkill?.path,
          messages: nextMessages
            .filter(message => message.role !== 'system')
            .map(message => ({ role: message.role, content: message.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Mythos Lab request failed.');

      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText(data.response || 'Mythos returned an empty response.'),
      };
      const latencyMs = Date.now() - started;
      updateActive(session => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        lastTrace: data.cognitiveTrace,
        lastObservability: {
          model: data.model,
          modelLabel: data.modelLabel,
          latencyMs,
          traceSchema: data.cognitiveTraceSchema,
          mode: data.mode,
          memoryHash: session.lastObservability?.memoryHash,
          savedAt: session.lastObservability?.savedAt,
        },
        updatedAt: nowIso(),
      }));
    } catch (error) {
      updateActive(session => ({
        ...session,
        messages: [
          ...session.messages,
          {
            id: createId('msg'),
            role: 'system',
            createdAt: nowIso(),
            content: error instanceof Error ? error.message : 'Could not reach Mythos Lab right now.',
          },
        ],
        updatedAt: nowIso(),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function saveLastResponse() {
    if (!activeSession || !canSaveMemory) {
      setNotice('Paste a full cog_live key and create a Mythos response before saving memory.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch(profile.endpoints.writeMemory, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memoryPayload),
      });
      const data = await response.json() as MemoryWriteResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save Mythos memory.');
      updateActive(session => ({
        ...session,
        lastObservability: {
          ...session.lastObservability,
          memoryHash: data.hash,
          savedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }));
      setNotice(`Memory saved to Mythos vault: ${shortHash(data.hash, 18)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save Mythos memory.');
    } finally {
      setSaving(false);
    }
  }

  async function copyText(value: string, id: string) {
    await navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1400);
  }

  if (!activeSession) {
    return <main className="min-h-screen bg-black text-white" />;
  }

  return (
    <main className="min-h-screen bg-[#020402] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] flex-col border-x border-[#76FF03]/10 lg:flex-row">
        <aside className="relative flex w-full flex-col border-b border-white/8 bg-[linear-gradient(180deg,rgba(9,19,7,0.96),rgba(0,0,0,0.98))] p-5 lg:w-[330px] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(118,255,3,0.16),transparent_26%)]" />
          <div className="relative">
            <a href="/mythos" className="text-xs text-white/45 transition hover:text-white/80">
              Back to Mythos
            </a>
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-[#76FF03]/34 bg-black shadow-[0_0_28px_rgba(118,255,3,0.24)]">
                  <img src={profile.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-xl font-black uppercase tracking-[0.28em] text-[#A7FF3D]">Mythos</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Verifiable Agent Lab
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startSession}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-[#A7FF3D] transition hover:bg-[#76FF03]/10"
                aria-label="New Mythos conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={startSession}
              className="mt-8 inline-flex h-14 w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.06] px-4 text-sm font-bold text-white/82 transition hover:border-[#76FF03]/20 hover:bg-[#76FF03]/8"
            >
              <Sparkles className="h-5 w-5 text-[#A7FF3D]" />
              New Conversation
            </button>

            <div className="mt-8">
              <p className="text-sm text-white/42">Sessions</p>
              <div className="mt-3 grid gap-2">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setActiveId(session.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      session.id === activeId
                        ? 'border-[#76FF03]/28 bg-[#76FF03]/10'
                        : 'border-white/7 bg-black/28 hover:bg-white/[0.045]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-semibold text-white/82">{session.title}</span>
                      <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase text-white/45">
                        {session.mode}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/36">{session.messages.filter(message => message.role !== 'system').length} turns</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mt-auto pt-8">
            <div className="rounded-2xl border border-[#76FF03]/16 bg-black/34 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Safe mode</p>
              <p className="mt-2 text-xs leading-5 text-white/45">
                Providers run on the CongChain backend. The Lab cannot move funds, sign payloads, or save memory without a visible key action.
              </p>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_8%,rgba(118,255,3,0.12),transparent_30%),linear-gradient(180deg,rgba(3,7,3,0.98),rgba(0,0,0,0.99))]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(118,255,3,0.035)_1px,transparent_1px),linear-gradient(180deg,rgba(118,255,3,0.025)_1px,transparent_1px)] bg-[size:92px_92px] opacity-20" />

          <div className="relative grid flex-1 gap-0 xl:grid-cols-[1fr_360px]">
            <div className="flex min-h-screen flex-col">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#A7FF3D]">Mythos Lab</p>
                  <h1 className="mt-1 text-2xl font-black">External Agent Test Terminal</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activeSession.mode}
                    onChange={event => setSessionField('mode', event.target.value as MythosLabSession['mode'])}
                    className="h-10 rounded-xl border border-white/10 bg-black/45 px-3 text-xs font-bold text-white outline-none focus:border-[#76FF03]/30"
                  >
                    <option value="demo">Demo mode</option>
                    <option value="connected">Connected mode</option>
                  </select>
                  <select
                    value={activeSession.model}
                    onChange={event => setSessionField('model', event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-black/45 px-3 text-xs font-bold text-white outline-none focus:border-[#76FF03]/30"
                  >
                    <option value="nvidia">NVIDIA</option>
                    <option value="glm">GLM-4.7</option>
                    <option value="minimax">MiniMax</option>
                    <option value="qwen">Qwen</option>
                  </select>
                </div>
              </header>

              <div className="grid gap-4 border-b border-white/8 p-5 lg:grid-cols-[280px_1fr]">
                <div className="rounded-2xl border border-[#76FF03]/18 bg-black/34 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Active skill</p>
                  <select
                    value={selectedSkill?.category || 'congchain'}
                    onChange={event => {
                      const next = MYTHOS_FEATURED_SKILLS.find(skill => skill.category === event.target.value);
                      if (next) setSessionField('skillId', next.id);
                    }}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    {MYTHOS_SKILL_CATEGORIES.map(category => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                  <select
                    value={activeSession.skillId}
                    onChange={event => setSessionField('skillId', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    {categorySkills.map(skill => (
                      <option key={skill.id} value={skill.id}>{skill.name}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/28 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5AD7FF]">{selectedCategory?.label || 'Skill'}</p>
                      <h2 className="mt-1 text-xl font-black">{selectedSkill?.name}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/52">{selectedSkill?.useCase}</p>
                    </div>
                    <span className="rounded-full border border-[#76FF03]/18 bg-[#76FF03]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#A7FF3D]">
                      {selectedSkill?.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/48">
                    <span className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1">{selectedSkill?.path}</span>
                    <span className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1">{selectedSkill?.bestFor}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                  {activeSession.messages.map(message => (
                    <div
                      key={message.id}
                      className={`rounded-2xl border px-4 py-3 text-sm leading-6 backdrop-blur ${
                        message.role === 'user'
                          ? 'ml-auto max-w-[86%] border-[#76FF03]/28 bg-[#76FF03]/12 text-white'
                          : message.role === 'assistant'
                            ? 'mr-auto max-w-[94%] border-white/8 bg-white/[0.055] text-white/78'
                            : 'mx-auto max-w-[94%] border-[#5AD7FF]/14 bg-[#5AD7FF]/8 text-white/54'
                      }`}
                    >
                      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
                        {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Mythos' : 'System'}
                      </p>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                  {loading && (
                    <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.055] px-4 py-3 text-sm text-white/55">
                      <Loader2 className="h-4 w-4 animate-spin text-[#76FF03]" />
                      Mythos is thinking through skill, memory, safety, and prediction...
                    </div>
                  )}
                </div>
              </div>

              <footer className="border-t border-white/8 p-5">
                <div className="mx-auto max-w-4xl">
                  <div className="rounded-[26px] border border-[#76FF03]/28 bg-black/54 p-4 shadow-[0_0_40px_rgba(118,255,3,0.08)] backdrop-blur-xl">
                    <textarea
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      rows={3}
                      placeholder="Message Mythos..."
                      className="w-full resize-none bg-transparent px-1 text-base leading-6 text-white outline-none placeholder:text-white/34"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {STARTER_PROMPTS.map(prompt => (
                          <button
                            key={prompt.label}
                            type="button"
                            onClick={() => sendMessage(prompt.prompt)}
                            disabled={loading}
                            className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/58 transition hover:border-[#76FF03]/20 hover:text-white disabled:opacity-45"
                          >
                            {prompt.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={routeCurrentDraft}
                          disabled={!input.trim() || loading}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#5AD7FF]/18 bg-[#5AD7FF]/10 px-4 text-xs font-bold text-[#7DE4FF] transition hover:bg-[#5AD7FF]/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Network className="h-4 w-4" />
                          Route skill
                        </button>
                        <button
                          type="button"
                          onClick={() => sendMessage()}
                          disabled={!input.trim() || loading}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/85 text-black transition hover:bg-[#A7FF3D] disabled:cursor-not-allowed disabled:opacity-45"
                          aria-label="Send message to Mythos"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-white/35">
                    Mythos can make mistakes. Verify important information before saving memory.
                  </p>
                </div>
              </footer>
            </div>

            <aside className="border-t border-white/8 bg-black/38 p-5 xl:border-l xl:border-t-0">
              <div className="grid gap-4">
                <section className="rounded-2xl border border-[#76FF03]/16 bg-[#76FF03]/6 p-4">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-[#A7FF3D]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Skill router</p>
                  </div>
                  {activeSession.lastSkillRoute ? (
                    <div className="mt-3">
                      <div className="rounded-xl border border-[#76FF03]/14 bg-black/32 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-white">{activeSession.lastSkillRoute.selectedSkill.name}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/35">
                              {activeSession.lastSkillRoute.categoryLabel} / {activeSession.lastSkillRoute.confidenceLabel} confidence
                            </p>
                          </div>
                          <span className="rounded-full border border-[#76FF03]/18 bg-[#76FF03]/10 px-2 py-1 text-[10px] font-black text-[#A7FF3D]">
                            {Math.round(activeSession.lastSkillRoute.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-white/55">{activeSession.lastSkillRoute.reason}</p>
                        <button
                          type="button"
                          onClick={() => copyText(activeSession.lastSkillRoute?.command || '', 'skill-route-command')}
                          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#76FF03]/18 bg-[#76FF03]/10 px-3 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copied === 'skill-route-command' ? 'Copied' : 'Copy skill command'}
                        </button>
                      </div>
                      {activeSession.lastSkillRoute.alternatives.length > 0 && (
                        <div className="mt-3 rounded-xl border border-white/8 bg-black/24 p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/36">Alternatives</p>
                          <div className="mt-2 grid gap-2">
                            {activeSession.lastSkillRoute.alternatives.map(alternative => (
                              <div key={alternative.id} className="flex items-center justify-between gap-2 text-xs text-white/55">
                                <span className="truncate">{alternative.name}</span>
                                <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-0.5 text-[10px] text-white/38">
                                  score {alternative.score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 grid gap-2">
                        {[
                          'The router selects context before the answer.',
                          'It does not execute skills automatically.',
                          'The selected skill is attached to memory receipts.',
                        ].map(item => (
                          <div key={item} className="flex gap-2 text-xs leading-5 text-white/50">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14F195]" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-white/48">
                      Send a task or click Route skill. Mythos will choose the governing skill, explain why, and keep execution human-reviewed.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-[#5AD7FF]/16 bg-[#5AD7FF]/6 p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-[#7DE4FF]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7DE4FF]">Cognitive trace</p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {traceCards(activeSession.lastTrace).map(card => (
                      <div key={card.label} className="rounded-xl border border-white/8 bg-black/28 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/36">{card.label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/58">{card.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#76FF03]/16 bg-[#76FF03]/6 p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#A7FF3D]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Observability</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Model', activeSession.lastObservability?.modelLabel || activeSession.model],
                      ['Latency', activeSession.lastObservability?.latencyMs ? `${activeSession.lastObservability.latencyMs} ms` : 'waiting'],
                      ['Trace', activeSession.lastObservability?.traceSchema || 'pending'],
                      ['Memory', shortHash(activeSession.lastObservability?.memoryHash)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-black/28 p-3">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/32">{label}</p>
                        <p className="mt-1 break-words text-xs font-bold text-white/70">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#14F195]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14F195]">Guardrails</p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {GUARDRAILS.map(item => (
                      <div key={item} className="flex gap-2 text-xs leading-5 text-white/56">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14F195]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#FACC15]/18 bg-[#FACC15]/6 p-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#FACC15]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FACC15]">Save approved memory</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/48">
                    Paste a CongChain key only when you want to save the latest Mythos answer to the isolated Mythos vault.
                  </p>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={event => setApiKey(event.target.value)}
                    placeholder="cog_live_..."
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#FACC15]/35"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={saveLastResponse}
                      disabled={!canSaveMemory || saving}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#FACC15]/20 bg-[#FACC15]/10 px-3 text-xs font-bold text-[#FACC15] transition hover:bg-[#FACC15]/15 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(JSON.stringify(memoryPayload, null, 2), 'payload')}
                      disabled={!lastAssistant}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-white/58 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Copy className="h-4 w-4" />
                      {copied === 'payload' ? 'Copied' : 'Payload'}
                    </button>
                  </div>
                  {notice && (
                    <p className="mt-3 rounded-xl border border-white/8 bg-black/28 px-3 py-2 text-xs leading-5 text-white/58">
                      {notice}
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-white/8 bg-black/28 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-white/50" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Capability layers</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MYTHOS_COGNITIVE_LAYERS.map(layer => (
                      <span key={layer.id} className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1 text-[11px] text-white/52">
                        {layer.name}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
