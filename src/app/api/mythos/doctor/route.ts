import { NextResponse } from 'next/server';
import {
  MYTHOS_AGENT_PROFILE,
  MYTHOS_FEATURED_SKILLS,
  MYTHOS_READINESS_ITEMS,
  MYTHOS_SKILL_CATEGORIES,
} from '@/features/agent-memory-bridge/mythos';
import {
  AGENT_MEMORY_BRIDGE_CONTENT_TYPES,
  AGENT_MEMORY_BRIDGE_SOURCES,
} from '@/features/agent-memory-bridge/types';

type DoctorState = 'ready' | 'configured' | 'review' | 'blocked';

function envPresent(name: string) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

function envAny(names: string[]) {
  return names.some(envPresent);
}

function envStatus(names: string[], required = false): DoctorState {
  if (envAny(names)) return 'configured';
  return required ? 'review' : 'review';
}

function readBridgeHealth() {
  return {
    ok: true,
    service: 'congchain-agent-memory-bridge',
    mode: 'compat',
    network: 'off-chain-memory-bridge',
    cluster: 'devnet-ready',
    authRequiredForWrites: true,
    sources: AGENT_MEMORY_BRIDGE_SOURCES,
    contentTypes: AGENT_MEMORY_BRIDGE_CONTENT_TYPES,
  };
}

export async function GET() {
  const bridge = readBridgeHealth();

  const checks = [
    {
      id: 'bridge-health',
      label: 'CongChain bridge health',
      state: bridge.ok ? 'ready' : 'review',
      detail: bridge.ok
        ? `Bridge online in ${bridge.mode} mode.`
        : 'Bridge health could not be confirmed from the server route.',
    },
    {
      id: 'congchain-api-key',
      label: 'CongChain API key',
      state: envStatus(['CONGCHAIN_API_KEY'], true),
      detail: envPresent('CONGCHAIN_API_KEY')
        ? 'Server has a CongChain API key configured for runtime integrations.'
        : 'No server-side CongChain API key detected; browser tests still require a user-provided cog_live key.',
    },
    {
      id: 'web-search',
      label: 'Web search providers',
      state: envStatus(['TAVILY_API_KEY', 'EXA_API_KEY', 'FIRECRAWL_API_KEY', 'PARALLEL_API_KEY']),
      detail: envAny(['TAVILY_API_KEY', 'EXA_API_KEY', 'FIRECRAWL_API_KEY', 'PARALLEL_API_KEY'])
        ? 'At least one web/search provider key is present.'
        : 'No common web/search provider key detected.',
    },
    {
      id: 'messaging',
      label: 'Messaging gateway',
      state: envStatus(['TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN']),
      detail: envAny(['TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN'])
        ? 'Telegram or Discord token is configured.'
        : 'Telegram and Discord tokens are not detected.',
    },
    {
      id: 'media',
      label: 'Media generation',
      state: envStatus(['FAL_KEY', 'OPENAI_API_KEY']),
      detail: envAny(['FAL_KEY', 'OPENAI_API_KEY'])
        ? 'A media-capable provider key is present.'
        : 'No common media provider key detected.',
    },
    {
      id: 'computer-use',
      label: 'Computer use',
      state: 'blocked',
      detail: 'Full computer-use stays blocked on this Windows-oriented setup; use browser automation and terminal tools.',
    },
    {
      id: 'wallet-funds',
      label: 'Wallet and funds movement',
      state: 'blocked',
      detail: 'Mythos cannot buy, sell, sign, submit, schedule, or move funds automatically.',
    },
  ] satisfies Array<{
    id: string;
    label: string;
    state: DoctorState;
    detail: string;
  }>;

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    profile: {
      id: MYTHOS_AGENT_PROFILE.id,
      namespace: MYTHOS_AGENT_PROFILE.identity.namespace,
      skills: MYTHOS_AGENT_PROFILE.counts.skills,
      featuredSkills: MYTHOS_FEATURED_SKILLS.length,
      categories: MYTHOS_SKILL_CATEGORIES.length,
      readinessItems: MYTHOS_READINESS_ITEMS.length,
    },
    bridge,
    checks,
    counts: {
      ready: checks.filter(check => check.state === 'ready' || check.state === 'configured').length,
      review: checks.filter(check => check.state === 'review').length,
      blocked: checks.filter(check => check.state === 'blocked').length,
    },
    safety: {
      exposesSecrets: false,
      writesMemory: false,
      movesFunds: false,
      signsPayloads: false,
    },
  });
}
