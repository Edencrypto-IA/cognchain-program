import { createWalletAgentCore } from './core';
import type { WalletAgentCoreResult } from './types';

export const WALLET_AGENT_DEMO_PROMPTS = [
  'Comprar 0.2 SOL de BONK com seguranca e mostrar riscos antes de assinar.',
  'Vender PENGU quando chegar em 20% de lucro.',
  'Agendar pagamento de funcionarios sexta-feira as 10h.',
  'Criar pagamento privado para fornecedor sem expor memo publico.',
] as const;

export function createWalletAgentDemoPreview(prompt = WALLET_AGENT_DEMO_PROMPTS[0]): WalletAgentCoreResult {
  return createWalletAgentCore({
    prompt,
    network: 'solana-devnet',
    walletAddress: null,
  });
}
