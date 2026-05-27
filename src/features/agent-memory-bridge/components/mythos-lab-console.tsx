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
  TerminalSquare,
} from 'lucide-react';
import { createMythosWalletCommandPlan } from '@/features/wallet-agent/mythos-wallet-command';
import type { MythosCryptoMarketReport } from '@/lib/market/crypto-report';
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_COGNITIVE_LAYERS,
  MYTHOS_FEATURED_SKILLS,
  MYTHOS_SKILL_CATEGORIES,
} from '../mythos';
import type { MythosSkillRouteResult } from '../skill-router';
import MythosCryptoReportCard from './mythos-crypto-report-card';

type MythosLabMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  cryptoReport?: MythosCryptoMarketReport;
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
    label: 'Help',
    prompt: '/help',
  },
  {
    label: 'Wallet',
    prompt: '/analyze wallet 2snAwv3rui3kcjBZbwN2uigN7yYTNnhEsZh6k5ZAg1Vs',
  },
  {
    label: 'Quote',
    prompt: '/quote swap 0.1 SOL to USDC',
  },
  {
    label: 'Market',
    prompt: '/market report',
  },
  {
    label: 'Plan',
    prompt: '/plan swap 0.1 SOL to USDC with Phantom review',
  },
];

const TERMINAL_COMMANDS = [
  {
    command: '/analyze tx <signature>',
    detail: 'Explain a Solana transaction with evidence, risk, next step, and memory draft.',
  },
  {
    command: '/analyze wallet <address>',
    detail: 'Read a public wallet profile: balance, recent activity, failures, token exposure, and risk.',
  },
  {
    command: '/analyze token <mint>',
    detail: 'Review token metadata, holder/distribution context, listings, and safe-risk signals.',
  },
  {
    command: '/debug anchor <error or program context>',
    detail: 'Turn Anchor logs or program errors into cause, fix, and review checklist.',
  },
  {
    command: '/explain rpc <issue>',
    detail: 'Diagnose RPC, wallet, webhook, priority-fee, or indexing problems.',
  },
  {
    command: '/quote swap <amount> <token> to <token>',
    detail: 'Fetch a read-only Jupiter route quote. No swap transaction is created.',
  },
  {
    command: '/market report',
    detail: 'Generate a visual crypto market report with CoinGecko data, gainers, losers, trends, and opportunity watchlist.',
  },
  {
    command: '/plan <wallet command>',
    detail: 'Create the safe six-phase Wallet Agent plan for payments, swaps, schedules, and memory.',
  },
  {
    command: '/memory save last',
    detail: 'Save the last approved Mythos answer to CongChain when a full cog_live key is pasted.',
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

function terminalSection(title: string, body: string | string[]) {
  const content = Array.isArray(body) ? body.filter(Boolean).join('\n') : body;
  return `${title}\n${content || 'No data available.'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = 'not available') {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] as Record<string, unknown> : {};
}

function getArray(value: unknown, key: string) {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] as unknown[] : [];
}

function formatEvidenceItems(evidence: unknown[]) {
  if (evidence.length === 0) return 'No evidence cards returned.';
  return evidence
    .slice(0, 10)
    .map(item => {
      if (!isRecord(item)) return '';
      return `- ${asString(item.label, 'Evidence')}: ${asString(item.value)} (${asString(item.status, 'review')})`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatMythosSolanaResponse(data: Record<string, unknown>) {
  const risk = getRecord(data, 'risk');
  const monitor = getRecord(data, 'chainMonitor');
  const trace = getRecord(data, 'cognitiveTrace');
  const memoryReplay = getRecord(data, 'memoryReplay');
  const observability = getRecord(data, 'observability');
  const evidence = getArray(data, 'evidence');

  return cleanTerminalText([
    terminalSection('Intent', `${asString(data.mode, 'solana')} analysis for ${asString(data.subject, 'provided input')}`),
    terminalSection('Plain-English readout', [
      asString(risk.userLabel, 'Review required'),
      asString(risk.plainEnglish, asString(risk.summary, 'Mythos reviewed public on-chain evidence.')),
    ]),
    terminalSection('Evidence', formatEvidenceItems(evidence)),
    terminalSection('Risk', [
      `Threat level: ${asNumber(risk.score)} / 100`,
      `Label: ${asString(risk.level, 'review')}`,
      `AI confidence: ${Math.round(asNumber(risk.confidenceBps) / 100)}%`,
      `Memory match: ${Math.round(asNumber(risk.memoryMatchBps) / 100)}%`,
      `Signals: ${getArray(risk, 'signals').map(signal => asString(signal)).join('; ') || 'none'}`,
    ]),
    terminalSection('Decision', asString(trace.decision, asString(data.analysis, 'Review the evidence before acting.'))),
    terminalSection('Next safe step', asString(risk.nextSafeStep, asString(trace.nextHumanStep, 'Review manually before saving memory.'))),
    terminalSection('Memory replay', [
      `Pattern: ${asString(memoryReplay.pattern, 'no pattern')}`,
      `Similar memories: ${asNumber(memoryReplay.previousMatches)}`,
      `Likely cause: ${asString(memoryReplay.likelyCause, 'not available')}`,
    ]),
    terminalSection('Observability', [
      `Provider: ${asString(observability.provider, asString(monitor.provider, 'server'))}`,
      `Cluster: ${asString(monitor.cluster, 'mainnet')}`,
      `Slot: ${asString(monitor.slotLabel, 'not available')}`,
      `Latency: ${asString(observability.latencyMs, 'not available')} ms`,
    ]),
    terminalSection('Safety boundary', [
      'Read-only public chain intelligence.',
      'No private keys, seed phrases, signatures, or wallet secrets are requested.',
      'No buy, sell, payment, swap, or submission is executed from this terminal.',
    ]),
  ].join('\n\n'));
}

function parseQuoteCommand(content: string) {
  const match = content.match(/^\/quote\s+swap\s+(\d+(?:[.,]\d+)?)\s+([a-z0-9]+)\s+(?:to|for)\s+([a-z0-9]+)$/i);
  if (!match) return null;
  return {
    amountUi: Number(match[1].replace(',', '.')),
    inputSymbol: match[2].toUpperCase(),
    outputSymbol: match[3].toUpperCase(),
  };
}

function formatJupiterQuoteResponse(data: Record<string, unknown>) {
  const quote = getRecord(data, 'quote');
  const safety = getRecord(data, 'safety');
  return cleanTerminalText([
    terminalSection('Intent', `Read-only Jupiter quote: ${asString(quote.amountUi)} ${asString(quote.inputSymbol)} to ${asString(quote.outputSymbol)}`),
    terminalSection('Route evidence', [
      `Input mint: ${asString(quote.inputMint)}`,
      `Output mint: ${asString(quote.outputMint)}`,
      `Output raw amount: ${asString(quote.outAmountRaw)}`,
      `Minimum output raw: ${asString(quote.otherAmountThresholdRaw)}`,
      `Route legs: ${asNumber(quote.routePlanCount)}`,
      `Price impact: ${asString(quote.priceImpactPct, 'not reported')}`,
      `Context slot: ${asString(quote.contextSlot)}`,
    ]),
    terminalSection('Decision', 'Quote is ready for human review. It is not a transaction.'),
    terminalSection('Next safe step', 'If the route looks acceptable, continue only through a future audited wallet-signature flow.'),
    terminalSection('Safety boundary', [
      asString(safety.note, 'Read-only quote only.'),
      `Transaction payload created: ${asString(safety.transactionPayloadCreated, 'false')}`,
      `Wallet signature requested: ${asString(safety.walletSignatureRequested, 'false')}`,
      `Submitted to Solana: ${asString(safety.submittedToSolana, 'false')}`,
    ]),
  ].join('\n\n'));
}

function formatWalletPlanResponse(command: string) {
  const plan = createMythosWalletCommandPlan({
    prompt: command,
    network: 'solana-mainnet',
  });
  return cleanTerminalText([
    terminalSection('Intent', `${plan.intentType} / ${plan.routeKind}`),
    terminalSection('Route status', [
      `Status: ${plan.routeStatus}`,
      `Confirmation allowed: ${plan.confirmation.allowed}`,
      `Reason: ${plan.confirmation.reason}`,
      plan.jupiterQuoteRequest
        ? `Jupiter quote: ${plan.jupiterQuoteRequest.status} - ${plan.jupiterQuoteRequest.reason}`
        : 'Jupiter quote: not required for this command',
    ]),
    terminalSection('Execution ladder', plan.phases.map(phase => `- ${phase.title}: ${phase.status} - ${phase.detail}`)),
    terminalSection('Wallet actions required', plan.walletActions.map(action => `- ${action}`)),
    terminalSection('Blocked actions', plan.blockedActions.map(action => `- ${action}`)),
    terminalSection('Memory candidate', [
      plan.memoryCandidate.title,
      plan.memoryCandidate.content,
    ]),
    terminalSection('Safety boundary', plan.safety.notes.map(note => `- ${note}`)),
  ].join('\n\n'));
}

function helpResponse() {
  return cleanTerminalText([
    'Mythos Command Terminal',
    'Use slash commands for the same Solana, Wallet Agent, Jupiter, and CongChain memory logic from one place.',
    '',
    ...TERMINAL_COMMANDS.map(item => `${item.command}\n${item.detail}\n`),
    'Examples',
    '/analyze tx 5ycrKxWCw4Px...',
    '/analyze wallet 2snAwv3rui3kcjBZbwN2uigN7yYTNnhEsZh6k5ZAg1Vs',
    '/analyze token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    '/market report',
    '/quote swap 0.1 SOL to USDC',
    '/plan pay 0.05 SOL to <wallet>',
    '',
    'Safety',
    'Commands explain, prepare, quote, and save reviewed memory. They do not sign, submit, buy, sell, pay, schedule, or move funds automatically.',
  ].join('\n'));
}

function isMarketReportRequest(content: string) {
  return /^\/(?:market|crypto)\s+report$/i.test(content.trim()) ||
    /\b(relatorio|relatório|report|market|mercado|oportunidades)\b/i.test(content) &&
    /\b(crypto|cripto|bitcoin|solana|altcoin|tokens?)\b/i.test(content);
}

function formatMarketReportText(report: MythosCryptoMarketReport) {
  return cleanTerminalText([
    terminalSection('Intent', 'Crypto market intelligence report'),
    terminalSection('Market pulse', [
      `Sentiment: ${report.sentiment.replace('_', '-')}`,
      `Market cap: ${report.global.marketCapLabel}`,
      `BTC dominance: ${report.global.btcDominanceLabel}`,
      `24h volume: ${report.global.volume24hLabel}`,
    ]),
    terminalSection('Opportunity watchlist', report.opportunities.slice(0, 5).map(item =>
      `- ${item.coin.symbol}: ${item.conviction} conviction, risk ${item.riskLevel}/100. ${item.thesis}`
    )),
    terminalSection('Decision', report.executiveSummary),
    terminalSection('Next safe step', 'Use Mythos token, wallet, and transaction analysis before making any real decision. This report is a watchlist, not a buy/sell instruction.'),
    terminalSection('Safety boundary', [
      'Read-only public market data.',
      'No trading, wallet signature, or fund movement.',
      'Not financial advice.',
    ]),
  ].join('\n\n'));
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

  async function runTerminalCommand(content: string, nextMessages: MythosLabMessage[], started: number) {
    const command = content.trim();
    const lower = command.toLowerCase();

    function appendTerminalResponse(responseContent: string, extra?: {
      trace?: MythosCognitiveTrace;
      observability?: MythosObservability;
    }) {
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: cleanTerminalText(responseContent),
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: extra?.trace || session.lastTrace,
        lastObservability: {
          ...session.lastObservability,
          ...extra?.observability,
          latencyMs: extra?.observability?.latencyMs ?? Date.now() - started,
        },
        updatedAt: nowIso(),
      }));
    }

    if (lower === '/help' || lower === '/commands') {
      appendTerminalResponse(helpResponse(), {
        trace: {
          perception: 'User asked for the command surface.',
          selectedSkill: 'Mythos Command Terminal',
          decision: 'Show the available safe commands and execution boundaries.',
          prediction: 'User can now run Solana, Wallet Agent, Jupiter, and memory commands from one place.',
          safetyBoundary: 'Help is local and cannot execute transactions.',
          nextHumanStep: 'Choose one command and paste public on-chain data only.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-command-terminal/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    if (isMarketReportRequest(command)) {
      const response = await fetch('/api/mythos/market/report', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) {
        throw new Error(isRecord(data) ? asString(data.error, 'Mythos market report failed.') : 'Mythos market report failed.');
      }
      const report = data as MythosCryptoMarketReport;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatMarketReportText(report),
        cryptoReport: report,
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: {
          perception: 'User requested a crypto market report.',
          memoryContext: 'No private portfolio or wallet memory was used automatically.',
          selectedSkill: 'Mythos Market Intelligence',
          reasoningPath: 'CoinGecko global, top market, trending, and selected opportunity datasets were fetched server-side.',
          prediction: 'User may use the watchlist to choose deeper token or wallet analysis next.',
          decision: 'Return a visual report and clearly mark it as read-only market intelligence.',
          confidence: 82,
          safetyBoundary: 'No financial advice and no trade execution.',
          nextHumanStep: 'Pick one token or wallet and run a focused Mythos analysis before acting.',
        },
        lastObservability: {
          model: activeSession.model,
          modelLabel: 'CoinGecko + Mythos report renderer',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-market-report/v1',
        },
        updatedAt: nowIso(),
      }));
      return;
    }

    if (lower === '/memory save last') {
      if (!lastAssistant?.content) {
        appendTerminalResponse([
          terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
          terminalSection('Decision', 'Blocked because there is no assistant answer to save yet.'),
          terminalSection('Next safe step', 'Run a command or ask Mythos a question first, then type /memory save last.'),
        ].join('\n\n'));
        return;
      }
      if (!apiKey.trim().startsWith('cog_live_')) {
        appendTerminalResponse([
          terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
          terminalSection('Decision', 'Blocked until a full CongChain key is pasted in the memory panel.'),
          terminalSection('Safety boundary', 'The terminal never guesses keys and never stores secrets in output.'),
        ].join('\n\n'));
        return;
      }

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
          latencyMs: Date.now() - started,
        },
        updatedAt: nowIso(),
      }));
      appendTerminalResponse([
        terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
        terminalSection('Decision', `Memory saved to the isolated Mythos vault: ${shortHash(data.hash, 18)}`),
        terminalSection('Next safe step', data.hash ? `/api/memory/${data.hash}` : 'Open the Memory Brain to review the saved record.'),
        terminalSection('Safety boundary', 'Only metadata-approved Mythos content was sent. No secrets, private keys, signed payloads, or fund actions.'),
      ].join('\n\n'), {
        observability: {
          memoryHash: data.hash,
          savedAt: nowIso(),
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-memory-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    const quoteRequest = parseQuoteCommand(command);
    if (quoteRequest) {
      const response = await fetch('/api/wallet-agent/jupiter/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...quoteRequest, slippageBps: 50 }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) throw new Error(isRecord(data) ? asString(data.error, 'Jupiter quote failed.') : 'Jupiter quote failed.');
      appendTerminalResponse(formatJupiterQuoteResponse(data), {
        trace: {
          perception: `User requested a read-only Jupiter quote for ${quoteRequest.amountUi} ${quoteRequest.inputSymbol} to ${quoteRequest.outputSymbol}.`,
          selectedSkill: 'Jupiter safe quote contract',
          decision: 'Return quote context only, without creating a swap transaction.',
          prediction: 'If the user proceeds later, a separate audited wallet-signature phase is required.',
          safetyBoundary: 'No swap payload, no wallet signature, no submission.',
          nextHumanStep: 'Review the quote and continue only through a visible wallet approval path in a future phase.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-jupiter-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    if (lower.startsWith('/plan ')) {
      const planCommand = command.slice('/plan '.length).trim();
      appendTerminalResponse(formatWalletPlanResponse(planCommand), {
        trace: {
          perception: 'User requested a Wallet Agent command plan.',
          selectedSkill: 'Wallet Agent safety planner',
          decision: 'Create an auditable six-phase plan and block automatic execution.',
          prediction: 'Value-moving work will require explicit wallet approval in a separate phase.',
          safetyBoundary: 'No signing, no mainnet submission, no fund movement.',
          nextHumanStep: 'Review the route status, missing fields, and blocked actions.',
        },
        observability: {
          model: activeSession.model,
          modelLabel: activeSession.model,
          mode: activeSession.mode,
          traceSchema: 'mythos-wallet-plan-command/v1',
          latencyMs: Date.now() - started,
        },
      });
      return;
    }

    const solanaCommand = [
      { pattern: /^\/analyze\s+tx\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-transaction', mode: 'transaction' },
      { pattern: /^\/analyze\s+wallet\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-wallet', mode: 'wallet' },
      { pattern: /^\/analyze\s+token\s+(.+)$/i, endpoint: '/api/mythos/solana/analyze-token', mode: 'token' },
      { pattern: /^\/debug\s+anchor\s+([\s\S]+)$/i, endpoint: '/api/mythos/solana/debug-anchor', mode: 'anchor' },
      { pattern: /^\/explain\s+rpc\s+([\s\S]+)$/i, endpoint: '/api/mythos/solana/explain-rpc', mode: 'rpc' },
    ].map(item => ({ ...item, match: command.match(item.pattern) })).find(item => item.match);

    if (solanaCommand?.match) {
      const subject = solanaCommand.match[1].trim();
      const response = await fetch(solanaCommand.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: subject,
          cluster: 'mainnet',
          model: activeSession.model,
        }),
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) throw new Error(isRecord(data) ? asString(data.error, 'Mythos Solana command failed.') : 'Mythos Solana command failed.');
      const trace = getRecord(data, 'cognitiveTrace');
      const observability = getRecord(data, 'observability');
      appendTerminalResponse(formatMythosSolanaResponse(data), {
        trace: {
          perception: asString(trace.perception, `User requested ${solanaCommand.mode} analysis.`),
          memoryContext: asString(getRecord(data, 'memoryReplay').likelyCause, 'Memory replay is evidence-bound.'),
          selectedSkill: asString(trace.skill, `Solana ${solanaCommand.mode} intelligence`),
          reasoningPath: asString(trace.evidenceUsed, 'Public chain evidence was reviewed.'),
          prediction: asString(trace.prediction, 'Manual review remains required.'),
          decision: asString(trace.decision, 'Review the evidence before acting.'),
          confidence: asNumber(getRecord(data, 'risk').confidenceBps) / 100,
          safetyBoundary: asString(trace.safetyBoundary, 'Read-only analysis only.'),
          nextHumanStep: asString(trace.nextHumanStep, 'Review manually before saving memory.'),
        },
        observability: {
          model: asString(observability.model, activeSession.model),
          modelLabel: asString(observability.modelLabel, activeSession.model),
          latencyMs: asNumber(observability.latencyMs, Date.now() - started),
          mode: activeSession.mode,
          traceSchema: 'mythos-solana-command/v1',
        },
      });
      return;
    }

    appendTerminalResponse([
      terminalSection('Intent', 'Unknown command'),
      terminalSection('Decision', 'Mythos did not recognize this terminal command.'),
      terminalSection('Next safe step', 'Type /help to see supported commands, or send a normal message without a slash for skill-routed chat.'),
      terminalSection('Safety boundary', 'Unknown commands are not executed.'),
    ].join('\n\n'));
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
      if (content.startsWith('/') || isMarketReportRequest(content)) {
        await runTerminalCommand(content, nextMessages, started);
        return;
      }

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
                      {message.cryptoReport ? <MythosCryptoReportCard report={message.cryptoReport} /> : null}
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
                      placeholder="Message Mythos or use /help, /analyze wallet, /analyze tx, /quote swap, /plan..."
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
                    <TerminalSquare className="h-4 w-4 text-[#A7FF3D]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#A7FF3D]">Command terminal</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/50">
                    One terminal for Solana analysis, wallet planning, read-only Jupiter quotes, and CongChain memory.
                  </p>
                  <div className="mt-3 grid gap-2">
                    {TERMINAL_COMMANDS.slice(0, 7).map(item => (
                      <button
                        key={item.command}
                        type="button"
                        onClick={() => setInput(item.command)}
                        className="rounded-xl border border-white/8 bg-black/26 p-3 text-left transition hover:border-[#76FF03]/20 hover:bg-[#76FF03]/8"
                      >
                        <p className="font-mono text-[11px] font-bold text-[#A7FF3D]">{item.command}</p>
                        <p className="mt-1 text-xs leading-5 text-white/44">{item.detail}</p>
                      </button>
                    ))}
                  </div>
                </section>

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
