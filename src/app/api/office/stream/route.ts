import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

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

export async function GET(req: NextRequest) {
  let stopped = false;
  req.signal.addEventListener('abort', () => { stopped = true; });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Load real agents from DB, fallback to defaults
        const dbAgents = await db.agent.findMany({ take: 10, orderBy: { createdAt: 'desc' } }).catch(() => []);
        const recentMems = await db.memory.findMany({ take: 30, orderBy: { timestamp: 'desc' }, select: { hash: true, content: true } }).catch(() => []);

        const agents: AgentState[] = dbAgents.length > 0
          ? dbAgents.map(a => ({
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

        // Send initial state
        controller.enqueue(enc({ type: 'init', agents, stats: { activeAgents: agents.filter(a => a.status !== 'fired').length, solSpent: totalSol, memories: totalMems, tasks: totalTasks } }));

        const activeAgents = () => agents.filter(a => a.status !== 'fired');

        while (!stopped) {
          await sleep(rand(1200, 2800));
          if (stopped) break;

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
            // Thinking event
            const thoughts = THOUGHTS[agent.model] ?? THOUGHTS.nvidia;
            const thought = pick(thoughts);
            agent.status = 'thinking';
            controller.enqueue(enc({ type: 'thinking', agentId: agent.id, name: agent.name, model: agent.model, text: thought, ts }));

          } else if (roll < 0.60) {
            // Task execution
            const task = pick(TASK_TITLES);
            const reward = parseFloat(rand(0.005, 0.025).toFixed(4));
            agent.status = 'executing';
            agent.currentTask = task;
            controller.enqueue(enc({ type: 'task_start', agentId: agent.id, name: agent.name, model: agent.model, task, reward, ts }));

            await sleep(rand(1500, 3500));
            if (stopped) break;

            const success = Math.random() > 0.22;
            const scoreDelta = success ? rand(0.1, 0.4) : -rand(0.3, 0.9);
            const oldScore = agent.score;
            agent.score = Math.min(10, Math.max(0.5, agent.score + scoreDelta));
            agent.tasksDone++;
            agent.solSpent += reward;
            totalSol += reward;
            totalTasks++;
            agent.currentTask = undefined;
            agent.status = agent.score < 4.5 ? 'warning' : 'idle';

            if (!success) {
              agent.consecutivePoor++;
            } else {
              agent.consecutivePoor = 0;
            }

            controller.enqueue(enc({ type: 'task_done', agentId: agent.id, name: agent.name, model: agent.model, task, reward, success, duration: Math.round(rand(800, 3200)), oldScore: parseFloat(oldScore.toFixed(1)), newScore: parseFloat(agent.score.toFixed(1)), ts }));

            // Fire check
            if (agent.consecutivePoor >= 3 || agent.score < 3.0) {
              await sleep(800);
              agent.status = 'fired';
              controller.enqueue(enc({ type: 'agent_fired', agentId: agent.id, name: agent.name, model: agent.model, finalScore: parseFloat(agent.score.toFixed(1)), reason: agent.score < 3.0 ? 'Score crítico abaixo de 3.0' : '3 falhas consecutivas', ts: Date.now() }));

              // Hire replacement after 3s
              await sleep(3000);
              if (stopped) break;
              const models = ['gpt', 'claude', 'nvidia', 'gemini', 'deepseek', 'qwen'];
              const newAgent = generateNewAgent(pick(models));
              agents.push(newAgent);
              controller.enqueue(enc({ type: 'agent_hired', agent: newAgent, ts: Date.now() }));
            }

          } else if (roll < 0.80) {
            // Memory saved
            const mem = recentMems.length > 0 ? pick(recentMems) : null;
            const snippet = mem ? mem.content.replace(/\n/g, ' ').slice(0, 60) : pick(MEMORY_SNIPPETS);
            const hash = mem ? mem.hash.slice(0, 8) : Math.random().toString(16).slice(2, 10);
            agent.memoryCount++;
            totalMems++;
            const scoreGain = rand(0.05, 0.2);
            agent.score = Math.min(10, agent.score + scoreGain);
            controller.enqueue(enc({ type: 'memory_saved', agentId: agent.id, name: agent.name, model: agent.model, snippet, hash, scoreGain: parseFloat(scoreGain.toFixed(2)), ts }));

          } else {
            // SOL payment between agents
            const others = pool.filter(a => a.id !== agent.id);
            if (others.length > 0) {
              const receiver = pick(others);
              const amount = parseFloat(rand(0.001, 0.01).toFixed(4));
              agent.solSpent += amount;
              totalSol += amount;
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
