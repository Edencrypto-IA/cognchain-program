'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  KeyRound,
  Loader2,
  Network,
  Plus,
  Save,
  Send,
  Sparkles,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { createMythosWalletCommandPlan } from '@/features/wallet-agent/mythos-wallet-command';
import type { MythosCryptoMarketReport } from '@/lib/market/crypto-report';
import type { MythosSolanaEcosystemReport, MythosSolanaReportMode } from '@/lib/market/solana-ecosystem-report';
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_FEATURED_SKILLS,
} from '../mythos';
import type { MythosSkillRouteResult } from '../skill-router';

type MythosLabMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  cryptoReport?: MythosCryptoMarketReport;
  solanaReport?: MythosSolanaEcosystemReport;
  memoryHash?: string;
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
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
  readUrl?: string;
  verifyUrl?: string;
  proofUrl?: string;
  error?: string;
};

const STORAGE_KEY = 'congchain:mythos-lab:sessions:v1';

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
    command: '/solana report',
    detail: 'Show a clean SOL price report: market cap, 24h volume, ATH, supply, and safe context.',
  },
  {
    command: '/solana protocols',
    detail: 'Show the top 10 Solana DeFi protocols by TVL, excluding centralized exchanges.',
  },
  {
    command: '/solana volume',
    detail: 'Show the top Solana ecosystem assets by 24h trading volume.',
  },
  {
    command: '/solana memes',
    detail: 'Show the top Solana meme coins by market activity with high-risk framing.',
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
    '/solana report',
    '/solana protocols',
    '/solana volume',
    '/solana memes',
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

function isSolanaEcosystemRequest(content: string) {
  const normalized = content.trim().toLowerCase();
  if (/^\/solana\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  if (/^\/sol\s+(report|price|preco|preço|protocols|protocolos|volume|memes?)$/.test(normalized)) return true;
  const asksSolana = /\b(sol|solana)\b/i.test(content);
  const asksPrice = /\b(price|preco|preço|cotacao|cotação|valor)\b/i.test(content);
  const asksProtocols = /\b(protocol|protocolo|protocolos|protocols|tvl|defi)\b/i.test(content);
  const asksVolume = /\b(volume|liquidez|liquidity)\b/i.test(content);
  const asksMemes = /\b(meme|memes|memecoin|memecoins)\b/i.test(content);
  const asksTop = /\b(top|maiores|principais|10|dez)\b/i.test(content);
  return asksSolana && ((asksPrice && !asksProtocols && !asksVolume && !asksMemes) || (asksProtocols && asksTop) || (asksVolume && asksTop) || (asksMemes && asksTop));
}

function solanaReportModeFor(content: string): MythosSolanaReportMode {
  const normalized = content.trim().toLowerCase();
  if (/\b(memes?|memecoin|memecoins)\b/.test(normalized)) return 'memes';
  if (/\b(volume|liquidez|liquidity)\b/.test(normalized)) return 'volume';
  if (/\b(protocols?|protocolos?|protocolo|tvl|defi)\b/.test(normalized)) return 'protocols';
  return 'price';
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

function formatSolanaReportText(report: MythosSolanaEcosystemReport) {
  const list = report.mode === 'memes'
    ? (report.assets?.memeLeaders ?? []).map((asset, index) => `${index + 1}. ${asset.symbol} - ${asset.volume24hLabel} 24h volume (${asset.change24hLabel})`)
    : report.mode === 'volume'
      ? (report.assets?.volumeLeaders ?? []).map((asset, index) => `${index + 1}. ${asset.symbol} - ${asset.volume24hLabel} 24h volume (${asset.change24hLabel})`)
      : report.mode === 'protocols'
        ? report.defi.topProtocols.map((protocol, index) => `${index + 1}. ${protocol.name} - ${protocol.tvlLabel} TVL (${protocol.category})`)
        : [
            `SOL price: ${report.price.label}`,
            `24h move: ${report.price.change24hLabel}`,
            `Market cap: ${report.price.marketCapLabel}`,
            `24h volume: ${report.price.volume24hLabel}`,
            `ATH: ${report.price.athLabel}`,
          ];

  return cleanTerminalText([
    terminalSection('Intent', `Solana ${report.mode} intelligence report`),
    terminalSection('SOL market readout', [
      `SOL price: ${report.price.label}`,
      `24h move: ${report.price.change24hLabel}`,
      `Market cap: ${report.price.marketCapLabel}`,
      `24h volume: ${report.price.volume24hLabel}`,
      `ATH: ${report.price.athLabel}`,
    ]),
    terminalSection(report.mode === 'protocols' ? 'Top Solana protocols' : report.mode === 'volume' ? 'Top Solana volume leaders' : report.mode === 'memes' ? 'Top Solana memes' : 'SOL price context', list),
    terminalSection('Decision', report.readout.headline),
    terminalSection('Plain English', report.readout.plainEnglish),
    terminalSection('Next safe step', report.readout.nextSafeStep),
    terminalSection('Safety boundary', [
      'Read-only CoinGecko and DeFiLlama market intelligence.',
      'Not financial advice.',
      'No wallet connection, signature, swap, payment, or fund movement.',
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

export default function MythosLabConsole() {
  const profile = MYTHOS_AGENT_PROFILE;
  const [sessions, setSessions] = useState<MythosLabSession[]>([]);
  const [activeId, setActiveId] = useState('');
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [pendingSaveMessageId, setPendingSaveMessageId] = useState('');
  const [savingMemoryId, setSavingMemoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

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
  const assistantMessages = activeSession?.messages.filter(message => message.role === 'assistant') || [];
  const lastAssistant = assistantMessages[assistantMessages.length - 1];

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
    setPendingSaveMessageId('');
  }

  function deleteSession(sessionId: string) {
    setSessions(current => {
      const remaining = current.filter(session => session.id !== sessionId);
      const next = remaining.length > 0 ? remaining : [makeSession()];
      if (sessionId === activeId) setActiveId(next[0]?.id || '');
      return next;
    });
    setPendingSaveMessageId('');
    setNotice('');
  }

  function clearHistory() {
    const session = makeSession();
    setSessions([session]);
    setActiveId(session.id);
    setInput('');
    setNotice('');
    setPendingSaveMessageId('');
  }

  function markMessageSaved(messageId: string, data: MemoryWriteResponse) {
    updateActive(session => ({
      ...session,
      messages: session.messages.map(message => message.id === messageId
        ? {
          ...message,
          memoryHash: data.hash,
          readUrl: data.readUrl,
          verifyUrl: data.verifyUrl,
          proofUrl: data.proofUrl,
        }
        : message),
      lastObservability: {
        ...session.lastObservability,
        memoryHash: data.hash,
        savedAt: nowIso(),
      },
      updatedAt: nowIso(),
    }));
  }

  async function saveMessageAsMemory(message: MythosLabMessage) {
    if (!message.content) return;
    if (!apiKey.trim().startsWith('cog_live_')) {
      setPendingSaveMessageId(message.id);
      setNotice('Paste a full CongChain key under this Mythos answer, then save. The key is sent once and never displayed back.');
      return;
    }

    setSavingMemoryId(message.id);
    setNotice('');
    try {
      const response = await fetch(profile.endpoints.writeMemory, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...memoryPayload,
          content: message.content,
          metadata: {
            ...memoryPayload.metadata,
            messageId: message.id,
            messageCreatedAt: message.createdAt,
          },
        }),
      });
      const data = await response.json() as MemoryWriteResponse;
      if (!response.ok) throw new Error(data.error || 'Could not save Mythos memory.');
      markMessageSaved(message.id, data);
      setPendingSaveMessageId('');
      setNotice(`Memory saved to Mythos vault: ${shortHash(data.hash, 18)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save Mythos memory.');
    } finally {
      setSavingMemoryId('');
    }
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

    if (isSolanaEcosystemRequest(command)) {
      const mode = solanaReportModeFor(command);
      const response = await fetch(`/api/mythos/market/solana?mode=${mode}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (!response.ok || !isRecord(data)) {
        throw new Error(isRecord(data) ? asString(data.error, 'Mythos Solana ecosystem report failed.') : 'Mythos Solana ecosystem report failed.');
      }
      const report = data as MythosSolanaEcosystemReport;
      const assistantMessage: MythosLabMessage = {
        id: createId('msg'),
        role: 'assistant',
        createdAt: nowIso(),
        content: formatSolanaReportText(report),
        solanaReport: report,
      };
      updateActive(session => ({
        ...session,
        messages: [...nextMessages, assistantMessage],
        lastTrace: {
          perception: `User requested a Solana ${mode} market report.`,
          memoryContext: 'No private wallet memory was used. This uses public market and DeFi data only.',
          selectedSkill: 'Solana Ecosystem Intelligence',
          reasoningPath: 'CoinGecko and DeFiLlama public data were fetched server-side and rendered as a read-only Mythos report.',
          prediction: 'User can pick one protocol for deeper token, wallet, or transaction analysis.',
          decision: 'Render a beginner-friendly Solana ecosystem card with safety boundaries.',
          confidence: 84,
          safetyBoundary: 'Read-only market intelligence. Not financial advice.',
          nextHumanStep: 'Choose one protocol or token and run a focused Mythos analysis before acting.',
        },
        lastObservability: {
          model: activeSession.model,
          modelLabel: 'CoinGecko + DeFiLlama + Mythos renderer',
          latencyMs: Date.now() - started,
          mode: activeSession.mode,
          traceSchema: 'mythos-solana-ecosystem/v1',
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
        setPendingSaveMessageId(lastAssistant.id);
        appendTerminalResponse([
          terminalSection('Intent', 'Save last Mythos answer as CongChain memory'),
          terminalSection('Decision', 'Blocked until a full CongChain key is pasted under the Mythos answer.'),
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
      markMessageSaved(lastAssistant.id, data);
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
      if (content.startsWith('/') || isMarketReportRequest(content) || isSolanaEcosystemRequest(content)) {
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

  if (!activeSession) {
    return <main className="min-h-screen bg-black text-white" />;
  }

  const visibleMessages = activeSession.messages.filter(message => message.role !== 'system');
  const hasConversation = visibleMessages.length > 0;

  return (
    <main className="min-h-screen bg-black p-3 text-white sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-[1540px] overflow-hidden rounded-[28px] border border-white/10 bg-[#020402] shadow-[0_0_90px_rgba(0,0,0,0.8)] sm:min-h-[calc(100vh-32px)] lg:flex-row">
        <aside className="relative hidden w-[320px] shrink-0 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(4,10,4,0.98),rgba(0,0,0,0.98))] p-6 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_4%,rgba(118,255,3,0.16),transparent_26%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-[#76FF03]/35 bg-black shadow-[0_0_32px_rgba(118,255,3,0.28)]">
                <img src={profile.image} alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xl font-black uppercase tracking-[0.32em] text-[#A7FF3D]">Mythos</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">The 1st autonomous external agent</p>
              </div>
            </div>
            <button
              type="button"
              onClick={startSession}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#76FF03]/20 bg-white/[0.035] text-[#A7FF3D] transition hover:bg-[#76FF03]/10"
              aria-label="New Mythos conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-10 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={startSession}
              className="inline-flex h-14 w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.065] px-4 text-sm font-semibold text-white/88 transition hover:border-[#76FF03]/25 hover:bg-[#76FF03]/10"
            >
              <TerminalSquare className="h-5 w-5 text-white/80" />
              New Conversation
            </button>
          </div>

          <div className="relative mt-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/45">Today</p>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 transition hover:text-[#A7FF3D]"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {sessions.map(session => (
                <div key={session.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(session.id)}
                    className={`min-w-0 flex-1 rounded-xl px-1 py-2 text-left text-sm transition ${
                      session.id === activeId ? 'text-white' : 'text-white/58 hover:text-white/80'
                    }`}
                  >
                    <span className="line-clamp-1">{session.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/22 opacity-0 transition hover:bg-white/8 hover:text-[#FF5C7A] group-hover:opacity-100"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full border border-[#76FF03]/26 bg-black">
                  <img src={profile.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Mythos</p>
                  <p className="flex items-center gap-2 text-xs text-white/55">
                    <span className="h-2 w-2 rounded-full bg-[#76FF03]" />
                    ONLINE
                  </p>
                </div>
                <span className="text-white/55">›</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-[calc(100vh-24px)] flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_52%_18%,rgba(118,255,3,0.13),transparent_28%),linear-gradient(180deg,rgba(2,5,2,0.99),rgba(0,0,0,1))] sm:min-h-[calc(100vh-32px)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(118,255,3,0.08),transparent_20%),radial-gradient(circle_at_70%_10%,rgba(118,255,3,0.06),transparent_18%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(118,255,3,0.06),transparent)]" />

          <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <a href="/mythos" className="text-xs text-white/45 transition hover:text-white/80">Back to Mythos</a>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-[#76FF03]/16 bg-[#76FF03]/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#A7FF3D] sm:inline-flex">
                {activeSession.model}
              </span>
              <button
                type="button"
                onClick={() => sendMessage('/help')}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#76FF03]/24 bg-[#76FF03]/10 px-4 text-xs font-black text-[#A7FF3D] transition hover:bg-[#76FF03]/16 disabled:opacity-50"
              >
                <TerminalSquare className="h-4 w-4" />
                Commands
              </button>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
              <div className={`flex flex-1 flex-col ${hasConversation ? 'justify-start pt-6' : 'justify-center'}`}>
                {!hasConversation ? (
                  <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
                    <img
                      src="/agents/mythos-terminal.png"
                      alt="Mythos, the first autonomous external agent"
                      className="w-full max-w-[720px] object-contain opacity-95 drop-shadow-[0_0_58px_rgba(118,255,3,0.18)]"
                    />
                  </div>
                ) : (
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
                    {visibleMessages.map(message => (
                      <div
                        key={message.id}
                        className={`max-w-[92%] rounded-[22px] border px-5 py-4 text-sm leading-6 backdrop-blur ${
                          message.role === 'user'
                            ? 'ml-auto border-[#76FF03]/30 bg-[#173b02]/80 text-white'
                            : 'mr-auto border-white/10 bg-white/[0.055] text-white/78'
                        }`}
                      >
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
                          {message.role === 'user' ? 'You' : 'Mythos'}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.role === 'assistant' ? (
                          <div className="mt-4 border-t border-white/8 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveMessageAsMemory(message)}
                                disabled={savingMemoryId === message.id}
                                className="inline-flex h-8 items-center gap-2 rounded-full border border-[#76FF03]/18 bg-[#76FF03]/8 px-3 text-[11px] font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/14 disabled:opacity-50"
                              >
                                {savingMemoryId === message.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {message.memoryHash ? 'Saved' : 'Save'}
                              </button>
                              {message.memoryHash ? (
                                <>
                                  <span className="rounded-full border border-white/8 bg-white/[0.035] px-3 py-1 text-[11px] font-mono text-white/48">
                                    {shortHash(message.memoryHash, 18)}
                                  </span>
                                  {message.readUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.readUrl}>Read</a> : null}
                                  {message.verifyUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.verifyUrl}>Verify</a> : null}
                                  {message.proofUrl ? <a className="text-[11px] font-bold text-[#7DE4FF]" href={message.proofUrl}>Proof</a> : null}
                                </>
                              ) : null}
                            </div>
                            {pendingSaveMessageId === message.id && !message.memoryHash ? (
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="password"
                                  value={apiKey}
                                  onChange={event => setApiKey(event.target.value)}
                                  placeholder="cog_live_..."
                                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#76FF03]/35"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveMessageAsMemory(message)}
                                  disabled={savingMemoryId === message.id}
                                  className="rounded-xl border border-[#76FF03]/18 bg-[#76FF03]/10 px-4 py-2 text-xs font-bold text-[#A7FF3D] transition hover:bg-[#76FF03]/15 disabled:opacity-50"
                                >
                                  Confirm save
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {loading && (
                      <div className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white/55">
                        <Loader2 className="h-4 w-4 animate-spin text-[#76FF03]" />
                        Mythos is processing the command...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <footer className="sticky bottom-0 pb-4 pt-3">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="rounded-[28px] border border-[#76FF03]/34 bg-black/56 p-4 shadow-[0_0_58px_rgba(118,255,3,0.09)] backdrop-blur-xl">
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
                      className="w-full resize-none bg-transparent px-2 text-base leading-7 text-white outline-none placeholder:text-white/34"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label="Attach context"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-black transition hover:bg-[#A7FF3D] disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Send message to Mythos"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    {[
                      ['Analyze', Activity],
                      ['Research', Network],
                      ['Reason', Brain],
                      ['Create', Sparkles],
                      ['Commands', TerminalSquare],
                    ].map(([label, Icon]) => (
                      <button
                        key={String(label)}
                        type="button"
                        onClick={() => label === 'Commands' ? sendMessage('/help') : setInput(String(label).toLowerCase())}
                        disabled={loading}
                        className="inline-flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/34 px-5 text-sm text-white/74 transition hover:border-[#76FF03]/25 hover:bg-[#76FF03]/10 hover:text-white disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-[#A7FF3D]" />
                        {String(label)}
                      </button>
                    ))}
                  </div>

                  {notice ? (
                    <p className="mt-4 text-center text-xs text-white/45">{notice}</p>
                  ) : null}
                  <p className="mt-8 text-center text-xs text-white/34">
                    Mythos can make mistakes. Verify important information.
                  </p>
                </div>
              </footer>
            </div>
          </div>

          <button
            type="button"
            onClick={() => sendMessage('/help')}
            className="absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/50 text-xl text-white/70 transition hover:border-[#76FF03]/25 hover:text-[#A7FF3D] sm:inline-flex"
            aria-label="Show Mythos commands"
          >
            ?
          </button>
        </section>
      </div>
    </main>
  );
}
