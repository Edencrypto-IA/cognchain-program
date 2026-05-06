// Module-level singleton — persists across requests on Railway (persistent Node.js server)

// ─── Real Events ─────────────────────────────────────────────────────────────

export interface RealEvent {
  seq: number;
  type: string;
  model: string;
  modelLabel: string;
  agentName: string;
  task: string;
  result: string;
  hash: string;
  ts: number;
  isReal: true;
}

const events: RealEvent[] = [];
let seq = 0;

export function pushRealEvent(ev: Omit<RealEvent, 'seq'>) {
  const e = { ...ev, seq: ++seq };
  events.push(e);
  if (events.length > 60) events.shift();
}

export function getEventsSince(lastSeq: number): RealEvent[] {
  return events.filter(e => e.seq > lastSeq);
}

export function getLatestSeq(): number { return seq; }

export function getRecentRealEvents(limit = 10): RealEvent[] {
  return [...events].reverse().slice(0, limit);
}

// ─── Agent Snapshots ──────────────────────────────────────────────────────────

export interface AgentSnapshot {
  id: string;
  name: string;
  model: string;
  score: number;
  status: 'idle' | 'thinking' | 'executing' | 'warning' | 'fired';
  tasksDone: number;
  memoryCount: number;
  solSpent: number;
  consecutivePoor: number;
  updatedAt: number;
}

const agentSnapshots = new Map<string, AgentSnapshot>();
const firedAgentIds = new Set<string>();

export function updateAgentSnapshot(snap: AgentSnapshot) {
  agentSnapshots.set(snap.id, { ...snap, updatedAt: Date.now() });
  if (snap.status === 'fired') firedAgentIds.add(snap.id);
}

export function getAgentSnapshots(): AgentSnapshot[] {
  return [...agentSnapshots.values()].sort((a, b) => b.score - a.score);
}

export function getFiredAgents(): AgentSnapshot[] {
  return [...agentSnapshots.values()].filter(a => a.status === 'fired');
}

export function getActiveAgents(): AgentSnapshot[] {
  return [...agentSnapshots.values()].filter(a => a.status !== 'fired');
}
