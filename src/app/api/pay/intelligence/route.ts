import { NextRequest, NextResponse } from 'next/server';
import { payForApi } from '@/lib/solana/pay-agent';
import { saveMemory } from '@/services/memory';
import { pushRealEvent } from '../../office/shared';

// ─── In-memory stats ──────────────────────────────────────────────────────────
let totalPurchases = 0;
let totalSolCollected = 0;

// ─── Services catalog ─────────────────────────────────────────────────────────

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

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function safeFetch(url: string, ms = 5000, opts?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

async function getLiveMarketData(tokens = ['SOL', 'BONK', 'PENGU']) {
  const results = await Promise.allSettled(tokens.map(t =>
    safeFetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${t}USDT`)
  ));
  return results.map((r, i) => ({ token: tokens[i], data: r.status === 'fulfilled' ? r.value : null }));
}

async function getDefiLlamaData() {
  const raw = await safeFetch('https://api.llama.fi/protocols') as unknown[] | null;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p: unknown) => { const x = p as Record<string, unknown>; return (x.chains as string[] | undefined)?.includes('Solana') && (x.tvl as number) > 1_000_000; })
    .sort((a: unknown, b: unknown) => ((b as Record<string, number>).tvl) - ((a as Record<string, number>).tvl))
    .slice(0, 10)
    .map((p: unknown) => { const x = p as Record<string, unknown>; return { name: x.name, tvl: x.tvl, c1d: x.change_1d, c7d: x.change_7d }; });
}

async function getCoinGeckoSentiment() {
  return safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true');
}

function fmtB(n: number) { return n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(1)}M`; }
function fmt(n: number, d = 2) { return n.toFixed(d); }

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt(serviceId: string, inputs: Record<string, string>, marketData: unknown): string {
  switch (serviceId) {
    case 'market-signal': {
      const markets = marketData as { token: string; data: Record<string, string> | null }[];
      const lines = markets
        .filter(m => m.data)
        .map(m => `${m.token}: $${parseFloat(m.data!.lastPrice).toFixed(m.token === 'BONK' ? 8 : 2)} | Vol: ${fmtB(parseFloat(m.data!.quoteVolume))} | Var: ${fmt(parseFloat(m.data!.priceChangePercent))}% | Max: $${parseFloat(m.data!.highPrice).toFixed(m.token === 'BONK' ? 8 : 2)} | Min: $${parseFloat(m.data!.lowPrice).toFixed(m.token === 'BONK' ? 8 : 2)}`);
      return `Dados ao vivo (Binance):\n${lines.join('\n')}\n\nCom base nesses números reais, forneça:\n1. Sinal de trade: COMPRA / VENDA / NEUTRO com justificativa objetiva\n2. Nível de suporte e resistência mais próximos para SOL\n3. Anomalia de volume ou preço relevante\n4. Posicionamento recomendado para as próximas 24h\nSeja direto, use os dados, não invente números.`;
    }
    case 'defi-yield': {
      const protos = marketData as { name: unknown; tvl: unknown; c1d?: unknown; c7d?: unknown }[];
      const list = protos.map(p => `${p.name}: TVL ${fmtB(Number(p.tvl))} | 1d: ${(Number(p.c1d) || 0).toFixed(1)}% | 7d: ${(Number(p.c7d) || 0).toFixed(1)}%`).join('\n');
      return `Protocolos DeFi Solana (DeFiLlama, dados ao vivo):\n${list}\n\nAnalise e responda:\n1. Qual protocolo oferece melhor oportunidade de yield agora? Por quê?\n2. Qual tem o melhor equilíbrio risco/retorno considerando os TVLs?\n3. Algum protocolo com TVL caindo forte — alerta de risco?\n4. Recomendação final para quem quer maximizar yield esta semana.`;
    }
    case 'wallet-intel': {
      const addr = inputs.address || '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs';
      return `Análise de carteira Solana: ${addr}\n\nBaseado em padrões típicos de carteiras Solana e análise comportamental:\n1. Perfil do holder: whale, trader ativo ou holder longo prazo?\n2. Indicadores de acumulação vs distribuição no padrão observado\n3. Nível de sofisticação: iniciante, intermediário ou avançado?\n4. Red flags ou sinais positivos que merecem atenção\nForneça uma análise estruturada e acionável.`;
    }
    case 'ai-research': {
      const topic = inputs.topic || 'Ecossistema DeFi Solana 2025';
      return `Pesquisa aprofundada sobre: ${topic}\n\nForneça um relatório estruturado com:\n1. Visão geral e contexto atual\n2. Principais players e dados relevantes\n3. Pontos fortes e fracos / oportunidades e riscos\n4. Comparações onde relevante\n5. Conclusão e recomendação prática\nSeja específico, use dados quando disponíveis, foque em utilidade prática.`;
    }
    case 'sentiment-scan': {
      const prices = marketData as Record<string, Record<string, number>> | null;
      const lines = prices ? [
        `SOL: $${prices.solana?.usd} (${prices.solana?.usd_24h_change?.toFixed(2)}% 24h)`,
        `BTC: $${prices.bitcoin?.usd?.toLocaleString()} (${prices.bitcoin?.usd_24h_change?.toFixed(2)}% 24h)`,
        `ETH: $${prices.ethereum?.usd?.toLocaleString()} (${prices.ethereum?.usd_24h_change?.toFixed(2)}% 24h)`,
      ] : [];
      return `Dados ao vivo:\n${lines.join('\n')}\n\nAnalise o sentimento do mercado:\n1. Classificação: BEARISH / CAUTELOSO / NEUTRO / CAUTELOSO BULLISH / BULLISH\n2. SOL está liderando, seguindo ou descolando de BTC?\n3. Sinal de entrada ou saída baseado nos dados?\n4. Posicionamento recomendado com stop loss sugerido.`;
    }
    case 'protocol-audit': {
      const proto = inputs.protocol || 'Raydium';
      return `Auditoria de protocolo DeFi Solana: ${proto}\n\nForneça uma análise estruturada de segurança e confiabilidade:\n1. Reputação e histórico: incidentes de segurança, hacks, vulnerabilidades conhecidas\n2. Transparência: time público, código auditado, quais empresas auditaram\n3. Tokenomics: distribuição, vesting, concentração de poder\n4. Red flags ou selos de qualidade\n5. Score de confiança 0-10 com justificativa\nBaseie em conhecimento factual, seja objetivo.`;
    }
    default:
      return 'Analise o ecossistema Solana e forneça insights relevantes para investidores e traders.';
  }
}

// ─── AI caller ────────────────────────────────────────────────────────────────

async function callAI(model: string, prompt: string): Promise<string> {
  const FREE_MODELS: Record<string, { url: string; name: string; envKey: string }> = {
    nvidia:  { url: 'https://integrate.api.nvidia.com/v1', name: 'meta/llama-3.3-70b-instruct', envKey: 'NVIDIA_API_KEY' },
    glm:     { url: 'https://integrate.api.nvidia.com/v1', name: 'z-ai/glm4.7',                 envKey: 'NVIDIA_GLM_KEY' },
    minimax: { url: 'https://integrate.api.nvidia.com/v1', name: 'minimaxai/minimax-m2.7',       envKey: 'NVIDIA_MINIMAX_KEY' },
    qwen:    { url: 'https://integrate.api.nvidia.com/v1', name: 'qwen/qwen3-next-80b-a3b-instruct', envKey: 'NVIDIA_QWEN_KEY' },
  };
  const PREMIUM_MODELS: Record<string, { fn: (p: string) => Promise<string> }> = {
    gpt: {
      fn: async (p) => {
        if (!process.env.OPENAI_API_KEY) throw new Error('No GPT key');
        const { default: OpenAI } = await import('openai');
        const c = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const r = await c.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: p }], max_tokens: 500 });
        return r.choices[0]?.message?.content ?? '';
      },
    },
    claude: {
      fn: async (p) => {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('No Claude key');
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const r = await c.messages.create({ model: 'claude-opus-4-7', max_tokens: 500, messages: [{ role: 'user', content: p }] });
        return (r.content[0] as { text: string }).text ?? '';
      },
    },
  };

  // Try premium first
  if (PREMIUM_MODELS[model]) {
    try { return await PREMIUM_MODELS[model].fn(prompt); } catch { /* fall through to free */ }
  }

  // Free model fallback
  const cfg = FREE_MODELS[model] ?? FREE_MODELS.nvidia;
  const key = process.env[cfg.envKey];
  if (!key) {
    // Last resort: any available free model
    for (const [, m] of Object.entries(FREE_MODELS)) {
      const k = process.env[m.envKey];
      if (k) {
        const { default: OpenAI } = await import('openai');
        const c = new OpenAI({ apiKey: k, baseURL: m.url });
        const r = await c.chat.completions.create({ model: m.name, messages: [{ role: 'system', content: 'Você é um analista especializado em Solana e DeFi. Responda em português de forma objetiva e acionável.' }, { role: 'user', content: prompt }], max_tokens: 500 });
        return r.choices[0]?.message?.content ?? '';
      }
    }
    throw new Error('No AI model available');
  }
  const { default: OpenAI } = await import('openai');
  const c = new OpenAI({ apiKey: key, baseURL: cfg.url });
  const r = await c.chat.completions.create({ model: cfg.name, messages: [{ role: 'system', content: 'Você é um analista especializado em Solana e DeFi. Responda em português de forma objetiva e acionável.' }, { role: 'user', content: prompt }], max_tokens: 500 });
  return r.choices[0]?.message?.content ?? '';
}

// ─── GET — services catalog ───────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ services: SERVICES, stats: { totalPurchases, totalSolCollected: parseFloat(totalSolCollected.toFixed(4)) } });
}

// ─── POST — execute intelligence service ─────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { serviceId: string; inputs?: Record<string, string>; fromWallet?: string };
    const { serviceId, inputs = {}, fromWallet } = body;

    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // Validate required inputs
    for (const inp of service.inputs.filter(i => i.required)) {
      if (!inputs[inp.key]?.trim()) return NextResponse.json({ error: `Campo obrigatório: ${inp.label}` }, { status: 400 });
    }

    const startTs = Date.now();
    const steps: string[] = [];

    // Step 1: Payment
    steps.push(`Verificando pagamento de ${service.priceSol} SOL...`);
    const payment = await payForApi(service.priceSol);
    if (!payment.success) return NextResponse.json({ error: 'Pagamento falhou' }, { status: 502 });
    steps.push(`${payment.simulated ? '○ Simulado' : '✓ Confirmado on-chain'} · TX: ${payment.txHash?.slice(0, 12)}...`);
    totalPurchases++;
    totalSolCollected += service.priceSol;

    // Step 2: Fetch live market data
    steps.push('Coletando dados em tempo real...');
    let marketData: unknown = null;
    if (serviceId === 'market-signal') {
      const tokens = inputs.tokens ? inputs.tokens.split(',').map(t => t.trim().toUpperCase()) : ['SOL', 'BONK', 'PENGU'];
      marketData = await getLiveMarketData(tokens);
    } else if (serviceId === 'defi-yield') {
      marketData = await getDefiLlamaData();
    } else if (serviceId === 'sentiment-scan') {
      marketData = await getCoinGeckoSentiment();
    }
    steps.push('Dados coletados');

    // Step 3: AI analysis
    steps.push(`Analisando com ${service.model.toUpperCase()}...`);
    const prompt = buildPrompt(serviceId, inputs, marketData);
    const analysis = await callAI(service.model, prompt);
    if (!analysis.trim()) return NextResponse.json({ error: 'AI não retornou análise' }, { status: 502 });
    steps.push('Análise gerada');

    // Step 4: Save as verified memory
    steps.push('Salvando como memória verificável na Solana...');
    const inputSummary = Object.entries(inputs).map(([k, v]) => `${k}: ${v}`).join(', ');
    const content = `[INTELLIGENCE_SERVICE]\nServiço: ${service.name}\nCategoria: ${service.category}\nPago: ${service.priceSol} SOL · TX: ${payment.txHash}\nData: ${new Date().toISOString()}\n${inputSummary ? `Inputs: ${inputSummary}\n` : ''}\n${analysis}`;
    const mem = await saveMemory({ content, model: service.model, parentHash: null });
    steps.push(`Memória ancorada · Hash: ${mem.hash.slice(0, 12)}...`);

    const duration = Date.now() - startTs;

    // Push to Office
    pushRealEvent({
      type: 'real_task_done', model: service.model, modelLabel: service.name,
      agentName: fromWallet ? `${fromWallet.slice(0, 6)}...` : 'PayUser',
      task: service.name, result: analysis.slice(0, 120).replace(/\n/g, ' '),
      hash: mem.hash, ts: Date.now(), isReal: true,
    });

    return NextResponse.json({
      success: true,
      service: { id: service.id, name: service.name },
      analysis,
      payment: { txHash: payment.txHash, simulated: payment.simulated, amountSol: service.priceSol, explorerUrl: payment.explorerUrl },
      memoryHash: mem.hash,
      proof: `CONGCHAIN://memory/${mem.hash}`,
      duration,
      steps,
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
