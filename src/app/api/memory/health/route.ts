import { NextResponse } from 'next/server';
import {
  AGENT_MEMORY_BRIDGE_CONTENT_TYPES,
  AGENT_MEMORY_BRIDGE_ENDPOINTS,
  AGENT_MEMORY_BRIDGE_SOURCES,
} from '@/features/agent-memory-bridge/types';

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: 'ok',
    service: 'congchain-agent-memory-bridge',
    mode: 'compat',
    network: 'off-chain-memory-bridge',
    cluster: 'devnet-ready',
    program_id: 'agent-memory-bridge',
    programId: 'agent-memory-bridge',
    authRequiredForWrites: true,
    keyHeaders: ['Authorization: Bearer cog_live_xxx', 'X-API-Key: cog_live_xxx'],
    sources: AGENT_MEMORY_BRIDGE_SOURCES,
    contentTypes: AGENT_MEMORY_BRIDGE_CONTENT_TYPES,
    endpoints: AGENT_MEMORY_BRIDGE_ENDPOINTS,
    safety: {
      storesSecrets: false,
      storesPrivateKeys: false,
      storesSignedPayloads: false,
      canMoveFunds: false,
      walletSignatureRequiredForFunds: true,
    },
  });
}
