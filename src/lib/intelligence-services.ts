export interface IntelligenceService {
  id: string;
  name: string;
  description: string;
  priceSol: number;
  priceUsd: string;
  model: string;
  category: string;
  example: string;
  inputs: { key: string; label: string; placeholder: string; required: boolean }[];
}

export const SERVICES: IntelligenceService[] = [
  {
    id: 'market-signal',
    name: 'Sinal de Trade em Tempo Real',
    description: 'Dados ao vivo de SOL, BONK, PENGU + análise IA com sinal COMPRA/VENDA/NEUTRO, suporte, resistência e recomendação de posicionamento.',
    priceSol: 0.005,
    priceUsd: '~$0.40',
    model: 'nvidia',
    category: 'Trade',
    example: 'SOL está em acumulação. Sinal: COMPRA. Suporte: $86. Resistência: $94. Volume acima da média indica entrada institucional.',
    inputs: [
      { key: 'tokens', label: 'Tokens', placeholder: 'SOL, BONK, PENGU', required: false },
    ],
  },
  {
    id: 'defi-yield',
    name: 'Scanner de Yield DeFi',
    description: 'Varre os 10 maiores protocolos DeFi na Solana (DeFiLlama) e identifica as melhores oportunidades de yield agora, com análise de risco/retorno.',
    priceSol: 0.008,
    priceUsd: '~$0.65',
    model: 'nvidia',
    category: 'DeFi',
    example: 'Raydium USDC-SOL: APY 18.4%, TVL crescendo +12% 7d. Melhor risco/retorno agora. Orca SOL-mSOL: conservador, APY 8.2%.',
    inputs: [],
  },
  {
    id: 'wallet-intel',
    name: 'Inteligência de Carteira Solana',
    description: 'Analisa qualquer carteira Solana via Helius RPC: histórico de transações, tokens, padrão de comportamento e perfil do holder.',
    priceSol: 0.01,
    priceUsd: '~$0.80',
    model: 'glm',
    category: 'On-Chain',
    example: 'Carteira XYZ: holder de longo prazo, acumulou SOL nos últimos 30d, sem histórico de sell. Probabilidade de whale: alta.',
    inputs: [
      { key: 'address', label: 'Endereço Solana', placeholder: '7vfCXTU...', required: true },
    ],
  },
  {
    id: 'ai-research',
    name: 'Pesquisa IA Profunda',
    description: 'Submeta qualquer tópico sobre crypto, DeFi ou blockchain. O CONGCHAIN pesquisa fontes reais e entrega um relatório estruturado com GPT-4o.',
    priceSol: 0.02,
    priceUsd: '~$1.60',
    model: 'gpt',
    category: 'Pesquisa',
    example: 'Relatório: Jupiter vs Raydium. Volume, TVL, fees, experiência do usuário, pontos fortes e fracos. Recomendação para traders ativos.',
    inputs: [
      { key: 'topic', label: 'Tópico de pesquisa', placeholder: 'Ex: Jupiter vs Raydium para trading', required: true },
    ],
  },
  {
    id: 'sentiment-scan',
    name: 'Análise de Sentimento Crypto',
    description: 'Analisa o sentimento atual do mercado usando dados reais de preço, volume e correlações BTC/ETH/SOL. Entrega posicionamento recomendado.',
    priceSol: 0.005,
    priceUsd: '~$0.40',
    model: 'minimax',
    category: 'Sentimento',
    example: 'Sentimento: CAUTELOSO BULLISH. BTC lidera, SOL correlacionado. Vol acima da média. Recomendação: posição pequena, stop $84.',
    inputs: [],
  },
  {
    id: 'protocol-audit',
    name: 'Auditoria de Protocolo DeFi',
    description: 'Análise de segurança e confiabilidade de qualquer protocolo Solana: TVL, histórico de hacks, time, tokenomics, red flags.',
    priceSol: 0.015,
    priceUsd: '~$1.20',
    model: 'claude',
    category: 'Segurança',
    example: 'Protocolo XYZ: TVL $42M, auditado pela OtterSec, sem incidentes. Time doxxed. Tokenomics: 15% insiders com vesting 2 anos. Score: 8.2/10.',
    inputs: [
      { key: 'protocol', label: 'Nome ou endereço do protocolo', placeholder: 'Ex: Raydium, Jupiter, etc.', required: true },
    ],
  },
];
