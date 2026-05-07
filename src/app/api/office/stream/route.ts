import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getEventsSince, getLatestSeq, updateAgentSnapshot } from '../shared';

function enc(data: object) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

const MODEL_COLORS: Record<string, string> = {
  gpt: '#10A37F', claude: '#9945FF', nvidia: '#76B900',
  gemini: '#4285F4', deepseek: '#FF6B35', glm: '#00D1FF',
  minimax: '#FF6B9D', qwen: '#A855F7',
};

function modelKey(model: string) {
  return Object.keys(MODEL_COLORS).find(k => model.toLowerCase().includes(k)) ?? 'nvidia';
}

const THOUGHTS: Record<string, string[]> = {
  gpt:      ['Analisando padrões DeFi na Solana...', 'Cruzando dados com memórias anteriores...', 'Calculando estratégia ótima...', 'Verificando integridade do hash...', 'Sintetizando insights de mercado...'],
  claude:   ['Considerando múltiplas perspectivas...', 'Avaliando credibilidade das fontes...', 'Construindo raciocínio passo a passo...', 'Ponderando implicações sistêmicas...', 'Refinando resposta para máxima clareza...'],
  nvidia:   ['Paralelizando análise de dados...', 'Otimizando pipeline de inferência...', 'Processando embeddings vetoriais...', 'Executando com máxima eficiência...', 'Comprimindo contexto para velocidade...'],
  gemini:   ['Correlacionando fontes multimodais...', 'Expandindo contexto de busca...', 'Validando contra base de conhecimento...', 'Integrando sinais de mercado...', 'Mapeando dependências conceituais...'],
  deepseek: ['Análise profunda em progresso...', 'Decomposing problema em subproblemas...', 'Verificando coerência lógica...', 'Explorando espaço de soluções...', 'Refinando hipótese central...'],
  glm:      ['Processando contexto cross-lingual...', 'Alinhando com objetivos do agente...', 'Buscando padrões em dados históricos...'],
  minimax:  ['Balanceando múltiplos objetivos...', 'Otimizando para resultado máximo...', 'Integrando feedback anterior...'],
  qwen:     ['Raciocínio em cadeia ativado...', 'Verificando premissas fundamentais...', 'Construindo árvore de decisão...'],
};

const TASK_TITLES = [
  'Análise de liquidez em pools Raydium', 'Verificação de smart contract SPL',
  'Pesquisa de tendências NFT Solana', 'Auditoria de memórias cross-model',
  'Monitoramento de whale wallets', 'Análise de sentimento DeFi',
  'Detecção de anomalias on-chain', 'Otimização de estratégia de yield',
  'Relatório de métricas do protocolo', 'Avaliação de risco de liquidez',
  'Síntese de dados de mercado', 'Validação de proof-of-insight',
];

const MEMORY_SNIPPETS = [
  'Padrão de acumulação detectado em SOL/USDC...', 'Taxa de staking aumentou 12% na última semana...',
  'Correlação negativa entre volume NFT e price SOL...', 'Novo protocolo DeFi com TVL crescendo 340%...',
  'Whale moveu 50k SOL para exchange — bearish signal...', 'Proof of History alcançou 99.98% uptime...',
  'Jupiter agregou $2.1B em volume nas últimas 24h...', 'Mempool congestionado — fee spike esperado...',
];

interface AgentState {
  id: string; name: string; model: string; goal: string;
  score: number; status: 'idle' | 'thinking' | 'executing' | 'warning' | 'fired';
  currentTask?: string; memoryCount: number; solSpent: number;
  tasksDone: number; consecutivePoor: number; firedAt?: number;
}

function makeDefaultAgents(): AgentState[] {
  return [
    { id: 'atlas-001', name: 'Atlas', model: 'gpt', goal: 'Análise financeira e estratégia DeFi', score: 8.7, status: 'idle', memoryCount: 47, solSpent: 0.234, tasksDone: 23, consecutivePoor: 0 },
    { id: 'lyra-002', name: 'Lyra', model: 'claude', goal: 'Raciocínio ético e análise de risco', score: 9.2, status: 'idle', memoryCount: 31, solSpent: 0.187, tasksDone: 18, consecutivePoor: 0 },
    { id: 'nexus-003', name: 'Nexus', model: 'deepseek', goal: 'Pesquisa técnica profunda', score: 6.4, status: 'idle', memoryCount: 22, solSpent: 0.098, tasksDone: 12, consecutivePoor: 1 },
    { id: 'orion-004', name: 'Orion', model: 'gemini', goal: 'Inteligência de mercado multimodal', score: 7.8, status: 'idle', memoryCount: 38, solSpent: 0.156, tasksDone: 19, consecutivePoor: 0 },
    { id: 'vega-005', name: 'Vega', model: 'nvidia', goal: 'Execução rápida e síntese de dados', score: 7.1, status: 'idle', memoryCount: 89, solSpent: 0.412, tasksDone: 44, consecutivePoor: 0 },
    { id: 'nova-006', name: 'Nova', model: 'qwen', goal: 'Raciocínio estruturado e verificação', score: 5.2, status: 'idle', memoryCount: 14, solSpent: 0.045, tasksDone: 7, consecutivePoor: 2 },
  ];
}

let hireCounter = 7;
function generateNewAgent(model: string): AgentState {
  const names = ['Apex', 'Echo', 'Flux', 'Iris', 'Kira', 'Luna', 'Mars', 'Neon', 'Onyx', 'Pike'];
  const goals: Record<string, string> = {
    gpt: 'Análise avançada e tomada de decisão', claude: 'Síntese e raciocínio profundo',
    nvidia: 'Execução eficiente em larga escala', gemini: 'Pesquisa e correlação de dados',
    deepseek: 'Análise técnica especializada', qwen: 'Verificação e raciocínio em cadeia',
  };
  return {
    id: `agent-${hireCounter++}`, name: pick(names),
    model, goal: goals[modelKey(model)] ?? 'Execução de tarefas gerais',
    score: rand(6, 8), status: 'idle', memoryCount: 0, solSpent: 0, tasksDone: 0, consecutivePoor: 0,
  };
}

// ─── Agent Skills — real data fetching + AI analysis ─────────────────────────

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

function fmt(n: number, decimals = 2) { return n.toFixed(decimals); }
function fmtB(n: number) { return n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : `$${(n/1e6).toFixed(1)}M`; }

interface AgentSkill {
  name: string;
  category: string;
  fetchData: () => Promise<Record<string, unknown>>;
  buildPrompt: (data: Record<string, unknown>) => string | null;
}

const AGENT_SKILLS: AgentSkill[] = [
  // 1. Trader — live price analysis + signal
  {
    name: 'Análise de Trade — SOL/BONK ao Vivo',
    category: 'trade',
    async fetchData() {
      const [sol, bonk, pengu] = await Promise.all([
        safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT'),
        safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BONKUSDT'),
        safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PENGUUSDT'),
      ]);
      return { sol, bonk, pengu };
    },
    buildPrompt(data) {
      const s = data.sol as Record<string, string> | null;
      const b = data.bonk as Record<string, string> | null;
      const p = data.pengu as Record<string, string> | null;
      if (!s) return null;
      const lines = [`SOL: $${fmt(+s.lastPrice)} | Vol: ${fmtB(+s.quoteVolume)} | Var 24h: ${fmt(+s.priceChangePercent)}% | Max: $${fmt(+s.highPrice)} | Min: $${fmt(+s.lowPrice)}`];
      if (b) lines.push(`BONK: $${(+b.lastPrice).toFixed(8)} | Vol: ${fmtB(+b.quoteVolume)} | Var 24h: ${fmt(+b.priceChangePercent)}%`);
      if (p) lines.push(`PENGU: $${fmt(+p.lastPrice, 4)} | Vol: ${fmtB(+p.quoteVolume)} | Var 24h: ${fmt(+p.priceChangePercent)}%`);
      return `Dados de mercado AO VIVO (Binance, ${new Date().toLocaleTimeString('pt-BR')}):\n${lines.join('\n')}\n\nCom esses dados reais, forneça:\n1. Sinal COMPRA / VENDA / NEUTRO para SOL com justificativa baseada nos números\n2. Suporte e resistência mais próximos para SOL\n3. Anomalia de volume ou preço que merece atenção agora\nSeja direto, use os números, não invente.`;
    },
  },

  // 2. DeFi Scout — real TVL data
  {
    name: 'Scout DeFi — Oportunidades de Yield',
    category: 'defi',
    async fetchData() {
      const raw = await safeFetch('https://api.llama.fi/protocols') as unknown[] | null;
      if (!Array.isArray(raw)) return { protocols: [] };
      const solana = raw
        .filter((p: unknown) => { const x = p as Record<string, unknown>; return (x.chains as string[] | undefined)?.includes('Solana') && (x.tvl as number) > 500_000; })
        .sort((a: unknown, b: unknown) => ((b as Record<string,number>).tvl) - ((a as Record<string,number>).tvl))
        .slice(0, 8)
        .map((p: unknown) => { const x = p as Record<string, unknown>; return { name: x.name, tvl: x.tvl, c1d: x.change_1d, c7d: x.change_7d }; });
      return { protocols: solana };
    },
    buildPrompt(data) {
      const protos = data.protocols as { name: string; tvl: number; c1d?: number; c7d?: number }[];
      if (!protos.length) return null;
      const list = protos.map(p => `${p.name}: TVL ${fmtB(p.tvl)} | 1d: ${p.c1d?.toFixed(1) ?? '?'}% | 7d: ${p.c7d?.toFixed(1) ?? '?'}%`).join('\n');
      return `Protocolos DeFi Solana — dados ao vivo DeFiLlama:\n${list}\n\nAnalise:\n1. Qual protocolo está captando mais capital (TVL crescendo)? Por que isso importa?\n2. Existe oportunidade de yield/liquidez com bom risco/retorno baseado nesses TVLs?\n3. Algum protocolo com queda abrupta que indica risco? Alerte com os números.`;
    },
  },

  // 3. Sentimento multi-asset
  {
    name: 'Sentimento de Mercado — Crypto Global',
    category: 'sentiment',
    async fetchData() {
      const [prices, btc] = await Promise.all([
        safeFetch('https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true'),
        safeFetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
      ]);
      return { prices, btc };
    },
    buildPrompt(data) {
      const p = data.prices as Record<string, Record<string, number>> | null;
      const btc = data.btc as Record<string, string> | null;
      if (!p?.solana) return null;
      const lines = [
        `SOL: $${p.solana.usd} (${p.solana.usd_24h_change?.toFixed(2)}% 24h)`,
        `BTC: $${p.bitcoin?.usd?.toLocaleString()} (${p.bitcoin?.usd_24h_change?.toFixed(2)}% 24h)`,
        `ETH: $${p.ethereum?.usd?.toLocaleString()} (${p.ethereum?.usd_24h_change?.toFixed(2)}% 24h)`,
      ];
      if (btc) lines.push(`BTC Vol 24h: ${fmtB(+btc.quoteVolume)}`);
      return `Snapshot ao vivo do mercado crypto:\n${lines.join('\n')}\n\nAnalise o sentimento:\n1. Mercado em modo RISK-ON ou RISK-OFF agora? Justifique com os dados.\n2. SOL está descolando de BTC/ETH? O que isso sinaliza?\n3. Posicionamento recomendado para as próximas 24h com base nesses números.`;
    },
  },

  // 4. Whale monitor via Helius
  {
    name: 'Monitor Whale — Atividade On-Chain',
    category: 'onchain',
    async fetchData() {
      const key = (() => {
        if (process.env.HELIUS_API_KEY) return process.env.HELIUS_API_KEY;
        const m = (process.env.SOLANA_RPC_URL ?? '').match(/api-key=([a-f0-9-]+)/i);
        return m?.[1] ?? '';
      })();
      if (!key) return { slot: null, txCount: 0 };
      const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentBlockhash', params: [] });
      const data = await safeFetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, 5000, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }) as Record<string, unknown> | null;
      const sol = await safeFetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT') as Record<string, string> | null;
      return { slotOk: !!data?.result, solPrice: sol?.price ?? '?' };
    },
    buildPrompt(data) {
      const { slotOk, solPrice } = data as { slotOk: boolean; solPrice: string };
      return `Contexto on-chain Solana (Helius RPC ${slotOk ? 'ativo' : 'offline'}) | SOL atual: $${solPrice}\n\nCom base em padrões históricos de atividade on-chain na Solana:\n1. Quais métricas on-chain (velocidade tx, congestionamento, fees) indicam acumulação institucional vs distribuição?\n2. Como identificar movimento de whale antes que apareça no price? Dê exemplo com SOL.\n3. Qual nível de preço do SOL costuma ativar grandes movimentações? Analise o preço atual.`;
    },
  },
];

const FREE_MODELS = [
  { key: 'nvidia',  label: 'NVIDIA Llama', model: 'meta/llama-3.3-70b-instruct',        envKey: 'NVIDIA_API_KEY'      },
  { key: 'glm',     label: 'GLM-4.7',      model: 'z-ai/glm4.7',                        envKey: 'NVIDIA_GLM_KEY'      },
  { key: 'minimax', label: 'MiniMax M2.7', model: 'minimaxai/minimax-m2.7',             envKey: 'NVIDIA_MINIMAX_KEY'  },
  { key: 'qwen',    label: 'Qwen3 80B',    model: 'qwen/qwen3-next-80b-a3b-instruct',   envKey: 'NVIDIA_QWEN_KEY'     },
];

const AGENT_NAMES: Record<string, string[]> = {
  nvidia: ['Vega', 'Ares', 'Core'], glm: ['Nexus', 'Link', 'Node'],
  minimax: ['Nova', 'Flux', 'Wave'], qwen: ['Echo', 'Apex', 'Zion'],
};

// Manual on/off — only runs when user presses Play in the Office
let schedulerActive = false;
let schedulerRunning = false;

export function setSchedulerActive(active: boolean) {
  schedulerActive = active;
  if (active && !schedulerRunning) startSchedulerLoop();
}

export function isSchedulerActive() { return schedulerActive; }

function startSchedulerLoop() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  (async () => {
    while (schedulerActive) {
      try { await runRealTask(); } catch { /* silent */ }
      // Wait 55s but check every second if still active
      for (let i = 0; i < 55 && schedulerActive; i++) await sleep(1000);
    }
    schedulerRunning = false;
  })();
}

// ─── Agent memory history ──────────────────────────────────────────────────

async function getAgentHistory(agentName: string, limit = 3): Promise<string> {
  try {
    const mems = await db.memory.findMany({
      where: {
        AND: [
          { content: { startsWith: '[AGENT_INSIGHT]' } },
          { content: { contains: `Agente: ${agentName}` } },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: { content: true, timestamp: true },
    });
    if (mems.length === 0) return '';

    const entries = mems.map(m => {
      const lines = m.content.split('\n');
      // Body starts after the header block (skip tag + metadata lines)
      const bodyStart = lines.findIndex((l, i) => i > 3 && l.trim() === '') + 1;
      const body = lines.slice(bodyStart > 0 ? bodyStart : 5).join(' ').replace(/\*\*/g, '').trim().slice(0, 250);
      const date = new Date(m.timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `[${date}] ${body}`;
    });

    return `\n\n--- HISTÓRICO DAS ÚLTIMAS ${mems.length} ANÁLISE(S) DESTE AGENTE ---\n${entries.join('\n\n')}\n--- FIM DO HISTÓRICO ---\n\nCom base no seu histórico acima e nos dados novos abaixo:\n- O que mudou desde sua última análise?\n- Seu sinal/conclusão anterior se confirmou?\n- O que você ajustaria agora?`;
  } catch {
    return '';
  }
}

export async function runRealTask(forceModelKey?: string): Promise<boolean> {
  const available = FREE_MODELS.filter(m => !!process.env[m.envKey]);
  if (available.length === 0) return false;
  const cfg = forceModelKey ? (available.find(m => m.key === forceModelKey) ?? pick(available)) : pick(available);
  const skill = pick(AGENT_SKILLS);
  const agentName = pick(AGENT_NAMES[cfg.key] ?? ['Agent']);

  try {
    // Step 1: Fetch real live data + agent's own memory history (in parallel)
    const [liveData, history] = await Promise.all([
      skill.fetchData().catch(() => ({})),
      getAgentHistory(agentName),
    ]);

    // Step 2: Build prompt with real data + memory context
    const basePrompt = skill.buildPrompt(liveData);
    if (!basePrompt) return false;

    // Inject history before the live data if agent has past memories
    const prompt = history
      ? `${history}\n\n${basePrompt}`
      : basePrompt;

    const systemPrompt = history
      ? `Você é o agente ${agentName}, especializado em Solana e DeFi. Você tem memória contínua — seu histórico de análises anteriores está incluído. Use-o para evoluir seu raciocínio, identificar se suas previsões se confirmaram e ajustar sua perspectiva. Analise os dados reais fornecidos, nunca invente números.`
      : `Você é o agente ${agentName}, especializado em Solana e DeFi. Analise os dados reais fornecidos e dê insights acionáveis em português. Nunca invente números — use apenas os dados fornecidos.`;

    // Step 3: Call free AI with history-enriched prompt
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env[cfg.envKey] ?? '', baseURL: 'https://integrate.api.nvidia.com/v1' });
    const resp = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
    });
    const content = resp.choices[0]?.message?.content ?? '';
    if (!content.trim()) return false;

    // Step 4: Save as AGENT_INSIGHT with continuity flag
    const hasContinuity = history.length > 0;
    const insightContent = `[AGENT_INSIGHT]\nAgente: ${agentName} (${cfg.label})\nTópico: ${skill.name}\nCategoria: ${skill.category}\nContinuidade: ${hasContinuity ? 'sim — baseado em histórico' : 'primeira análise'}\nData: ${new Date().toISOString()}\n\n${content}`;
    const { saveMemory } = await import('@/services/memory');
    const mem = await saveMemory({ content: insightContent, model: cfg.key, parentHash: null });

    const { pushRealEvent } = await import('../shared');
    pushRealEvent({
      type: 'real_task_done', model: cfg.key, modelLabel: cfg.label,
      agentName: hasContinuity ? `${agentName} ↻` : agentName,
      task: skill.name,
      result: content.replace(/\n+/g, ' ').trim().slice(0, 160),
      hash: mem.hash, ts: Date.now(), isReal: true,
    });
    return true;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  let stopped = false;
  req.signal.addEventListener('abort', () => { stopped = true; });
  // No auto-start — user controls via Play button

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Load real agents from DB, fallback to defaults
        const dbAgents = await db.agent.findMany({ take: 10, orderBy: { createdAt: 'desc' } }).catch(() => []);
        const recentMems = await db.memory.findMany({ take: 30, orderBy: { timestamp: 'desc' }, select: { hash: true, content: true } }).catch(() => []);

        const agents: AgentState[] = dbAgents.length > 0
          ? dbAgents.map((a: { id: string; name: string; model: string; goal: string; memoryCount: number; totalInteractions: number }) => ({
              id: a.id, name: a.name, model: modelKey(a.model), goal: a.goal,
              score: Math.min(10, Math.max(1, 5 + rand(-1, 2))),
              status: 'idle' as const, memoryCount: a.memoryCount,
              solSpent: parseFloat((a.totalInteractions * 0.005).toFixed(3)),
              tasksDone: a.totalInteractions, consecutivePoor: 0,
            }))
          : makeDefaultAgents();

        let totalSol = agents.reduce((s, a) => s + a.solSpent, 0);
        let totalMems = agents.reduce((s, a) => s + a.memoryCount, 0) + recentMems.length;
        let totalTasks = agents.reduce((s, a) => s + a.tasksDone, 0);
        let statsTimer = 0;

        // Send initial state + push to shared store
        controller.enqueue(enc({ type: 'init', agents, stats: { activeAgents: agents.filter(a => a.status !== 'fired').length, solSpent: totalSol, memories: totalMems, tasks: totalTasks } }));
        agents.forEach(a => updateAgentSnapshot({ ...a, updatedAt: Date.now() }));

        const activeAgents = () => agents.filter(a => a.status !== 'fired');

        // Helper: sync agent to shared store after any state change
        const sync = (a: AgentState) => updateAgentSnapshot({ ...a, updatedAt: Date.now() });

        // Track which real events this connection has already seen
        let lastRealSeq = getLatestSeq();

        while (!stopped) {
          await sleep(rand(1200, 2800));
          if (stopped) break;

          // Flush any new real AI events to this client
          const newRealEvents = getEventsSince(lastRealSeq);
          for (const ev of newRealEvents) {
            controller.enqueue(enc(ev));
            lastRealSeq = ev.seq;
            // Also update agent stats when a real task completes
            totalMems++;
            totalTasks++;
          }

          const pool = activeAgents();
          if (pool.length === 0) break;
          const agent = pick(pool);
          const ts = Date.now();
          const roll = Math.random();

          statsTimer++;
          if (statsTimer % 6 === 0) {
            controller.enqueue(enc({ type: 'stats', activeAgents: pool.length, solSpent: parseFloat(totalSol.toFixed(3)), memories: totalMems, tasks: totalTasks, ts }));
          }

          if (roll < 0.35) {
            agent.status = 'thinking';
            sync(agent);
            const thought = pick(THOUGHTS[agent.model] ?? THOUGHTS.nvidia);
            controller.enqueue(enc({ type: 'thinking', agentId: agent.id, name: agent.name, model: agent.model, text: thought, ts }));

          } else if (roll < 0.60) {
            const task = pick(TASK_TITLES);
            const reward = parseFloat(rand(0.005, 0.025).toFixed(4));
            agent.status = 'executing'; agent.currentTask = task;
            sync(agent);
            controller.enqueue(enc({ type: 'task_start', agentId: agent.id, name: agent.name, model: agent.model, task, reward, ts }));

            await sleep(rand(1500, 3500));
            if (stopped) break;

            const success = Math.random() > 0.22;
            const oldScore = agent.score;
            agent.score = Math.min(10, Math.max(0.5, agent.score + (success ? rand(0.1, 0.4) : -rand(0.3, 0.9))));
            agent.tasksDone++; agent.solSpent += reward;
            totalSol += reward; totalTasks++;
            agent.currentTask = undefined;
            agent.status = agent.score < 4.5 ? 'warning' : 'idle';
            agent.consecutivePoor = success ? 0 : agent.consecutivePoor + 1;
            sync(agent);

            controller.enqueue(enc({ type: 'task_done', agentId: agent.id, name: agent.name, model: agent.model, task, reward, success, duration: Math.round(rand(800, 3200)), oldScore: parseFloat(oldScore.toFixed(1)), newScore: parseFloat(agent.score.toFixed(1)), ts }));

            if (agent.consecutivePoor >= 3 || agent.score < 3.0) {
              await sleep(800);
              agent.status = 'fired'; sync(agent);
              controller.enqueue(enc({ type: 'agent_fired', agentId: agent.id, name: agent.name, model: agent.model, finalScore: parseFloat(agent.score.toFixed(1)), reason: agent.score < 3.0 ? 'Score crítico abaixo de 3.0' : '3 falhas consecutivas', ts: Date.now() }));

              await sleep(3000);
              if (stopped) break;
              const newAgent = generateNewAgent(pick(['gpt', 'claude', 'nvidia', 'gemini', 'deepseek', 'qwen']));
              agents.push(newAgent); sync(newAgent);
              controller.enqueue(enc({ type: 'agent_hired', agent: newAgent, ts: Date.now() }));
            }

          } else if (roll < 0.80) {
            const mem = recentMems.length > 0 ? pick(recentMems) : null;
            const snippet = mem ? mem.content.replace(/\n/g, ' ').slice(0, 60) : pick(MEMORY_SNIPPETS);
            const hash = mem ? mem.hash.slice(0, 8) : Math.random().toString(16).slice(2, 10);
            agent.memoryCount++; totalMems++;
            const scoreGain = rand(0.05, 0.2);
            agent.score = Math.min(10, agent.score + scoreGain);
            sync(agent);
            controller.enqueue(enc({ type: 'memory_saved', agentId: agent.id, name: agent.name, model: agent.model, snippet, hash, scoreGain: parseFloat(scoreGain.toFixed(2)), ts }));

          } else {
            const others = pool.filter(a => a.id !== agent.id);
            if (others.length > 0) {
              const receiver = pick(others);
              const amount = parseFloat(rand(0.001, 0.01).toFixed(4));
              agent.solSpent += amount; totalSol += amount;
              sync(agent);
              controller.enqueue(enc({ type: 'sol_payment', fromId: agent.id, fromName: agent.name, toId: receiver.id, toName: receiver.name, amount, ts }));
            }
          }
        }
      } catch {
        // stream ended
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
