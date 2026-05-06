// Module-level singleton — persists across requests on Railway (persistent Node.js server)

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
