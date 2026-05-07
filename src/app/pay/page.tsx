'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiItem {
  id: string; name: string; provider: string; category: string;
  price: number; unit?: string; tone: string; short: string; endpoint: string;
}
interface Stats { payments: number; sol: number; memories: number; }

// ─── Data ─────────────────────────────────────────────────────────────────────

const APIS: ApiItem[] = [
  { id: 'claude',       name: 'Claude Opus',    provider: 'Anthropic', category: 'IA',     price: 0.015, unit: '1k',  tone: 'orange', short: 'claude',     endpoint: 'https://api.anthropic.com/v1/messages' },
  { id: 'gpt4o',        name: 'GPT-4o',         provider: 'OpenAI',    category: 'IA',     price: 0.005, unit: '1k',  tone: 'green',  short: 'openai',     endpoint: 'https://api.openai.com/v1/chat' },
  { id: 'deepseek',     name: 'DeepSeek V3',    provider: 'DeepSeek',  category: 'IA',     price: 0.001, unit: '1k',  tone: 'cyan',   short: 'deepseek',   endpoint: 'https://api.deepseek.com/chat' },
  { id: 'gemini',       name: 'Gemini 2.0',     provider: 'Google',    category: 'IA',     price: 0.002, unit: '1k',  tone: 'gold',   short: 'gemini',     endpoint: 'https://generativelanguage.googleapis.com/v1' },
  { id: 'llama',        name: 'Llama 3.3',      provider: 'NVIDIA',    category: 'IA',     price: 0,               tone: 'green',  short: 'llama',      endpoint: 'https://api.nvcf.nvidia.com/llama' },
  { id: 'helius',       name: 'Helius RPC',     provider: 'Helius',    category: 'Solana', price: 0.001, unit: 'req', tone: 'purple', short: 'helius',     endpoint: 'https://rpc.helius.xyz' },
  { id: 'jupiter',      name: 'Jupiter Price',  provider: 'Jupiter',   category: 'Solana', price: 0,               tone: 'purple', short: 'jupiter',    endpoint: 'https://price.jup.ag/v6/price' },
  { id: 'solana-fm',    name: 'Solana FM',      provider: 'SolanaFM',  category: 'Solana', price: 0,               tone: 'green',  short: 'solanafm',   endpoint: 'https://api.solana.fm' },
  { id: 'coingecko',    name: 'CoinGecko',      provider: 'CoinGecko', category: 'Market', price: 0,               tone: 'green',  short: 'coingecko',  endpoint: 'https://api.coingecko.com/api/v3' },
  { id: 'binance',      name: 'Binance',        provider: 'Binance',   category: 'Market', price: 0,               tone: 'gold',   short: 'binance',    endpoint: 'https://api.binance.com/api/v3' },
  { id: 'cmc',          name: 'CoinMarketCap',  provider: 'CMC',       category: 'Market', price: 0.001, unit: 'req', tone: 'green', short: 'cmc',        endpoint: 'https://pro-api.coinmarketcap.com' },
  { id: 'defillama',    name: 'DeFiLlama',      provider: 'DefiLlama', category: 'Market', price: 0,               tone: 'cyan',   short: 'defillama',  endpoint: 'https://api.llama.fi' },
  { id: 'openai-status',name: 'OpenAI Status',  provider: 'OpenAI',    category: 'Infra',  price: 0,               tone: 'green',  short: 'openai-st',  endpoint: 'https://status.openai.com/api/v2' },
  { id: 'anthropic-st', name: 'Anthropic',      provider: 'Anthropic', category: 'Infra',  price: 0,               tone: 'orange', short: 'anthropic',  endpoint: 'https://status.anthropic.com/api' },
];

// ─── Small utilities ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{
      width: 12, height: 12, border: '2px solid rgba(124,92,255,0.3)',
      borderTopColor: '#b794ff', borderRadius: '50%', display: 'inline-block',
      animation: 'ccSpin 0.7s linear infinite',
    }} />
  );
}

function Dot({ c }: { c: string }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />;
}

function MidDot() {
  return <span style={{ color: 'var(--text-4)', margin: '0 2px' }}>·</span>;
}

function Check({ c }: { c: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: 'inline-block' }}>
      <path d="M2 7L6 11L12 3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function Dash() { return <span style={{ color: 'var(--text-4)', fontSize: 14 }}>—</span>; }

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ccLg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c5cff" /><stop offset="100%" stopColor="#3ddb88" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#ccLg)" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="url(#ccLg)" />
    </svg>
  );
}

// ─── Brand logos per API id ───────────────────────────────────────────────────

function BrandLogo({ id, size = 22 }: { id: string; size?: number }) {
  const s = size;
  switch (id) {
    case 'claude': case 'anthropic-st':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M7.4 6h2.6l3.4 9.2L9.4 18 7.4 6z" fill="#D97757"/><path d="M14 6h2.6L20 18h-2.7l-.7-2.2h-3.6l1.4-3.7-.4-1.5L13 14.5l-1.4-3.7L14 6z" fill="#D97757"/></svg>;
    case 'gpt4o': case 'openai-status':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="#10a37f" strokeWidth="1.6" fill="none"/><circle cx="12" cy="12" r="3" stroke="#10a37f" strokeWidth="1.6" fill="none"/></svg>;
    case 'deepseek':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M4 12c0-4 4-7 8-7s8 3 8 7c-2 0-4-1-5-2-1 2-3 3-3 6-3-1-5-2-5-4-1 0-2 0-3 0z" fill="#5ce3ff"/><circle cx="14" cy="9" r="0.9" fill="#050608"/></svg>;
    case 'gemini':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><defs><linearGradient id="gemG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4285f4"/><stop offset="100%" stopColor="#f5c952"/></linearGradient></defs><path d="M12 2c0 5.5 4.5 10 10 10-5.5 0-10 4.5-10 10 0-5.5-4.5-10-10-10 5.5 0 10-4.5 10-10z" fill="url(#gemG)"/></svg>;
    case 'llama':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 21V3L21 12 3 21z" fill="#76b900"/></svg>;
    case 'helius': case 'jupiter': case 'solana-fm':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><defs><linearGradient id={`solG${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#9945FF"/><stop offset="100%" stopColor="#14F195"/></linearGradient></defs><path d="M5 7h13l-2 2H3l2-2zm0 4h13l-2 2H3l2-2zm14 4H6l-2 2h13l2-2z" fill={`url(#solG${id})`}/></svg>;
    case 'coingecko':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="#8dc63f"/><circle cx="9" cy="10" r="2" fill="#fff"/><circle cx="9" cy="10" r="0.9" fill="#000"/></svg>;
    case 'binance':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 4l3 3-3 3-3-3 3-3zM5 11l3 3-3 3-3-3 3-3zm14 0l3 3-3 3-3-3 3-3zm-7 7l3 3-3 3-3-3 3-3z" fill="#f5c952"/><path d="M12 11l1.5 1.5L12 14l-1.5-1.5L12 11z" fill="#f5c952"/></svg>;
    case 'cmc':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3ddb88" strokeWidth="1.8" fill="none"/><path d="M7 13l3-3 3 3 4-5" stroke="#3ddb88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
    case 'defillama':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M8 5h8l1 4-2 2v6c0 1-1 2-2 2H9c-1 0-2-1-2-2v-6L5 9l3-4z" fill="#5ce3ff"/><circle cx="10" cy="11" r="0.8" fill="#050608"/><circle cx="14" cy="11" r="0.8" fill="#050608"/></svg>;
    default:
      return <span style={{ fontSize: 14 }}>○</span>;
  }
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ stats }: { stats: Stats }) {
  return (
    <div style={{ borderBottom: '1px solid var(--line)', background: 'rgba(5,6,8,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="/" className="cc-mono" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>←</span><span>Chat</span>
          </a>
          <div style={{ width: 1, height: 16, background: 'var(--line-2)' }} />
          <a href="/pay" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)' }}>
            <Logo />
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>CONGCHAIN</span>
            <span className="cc-mono" style={{ fontSize: 9.5, color: 'var(--text-3)', padding: '3px 7px', border: '1px solid var(--line-2)', borderRadius: 4, letterSpacing: '0.12em' }}>PAY</span>
          </a>
        </div>
        <div className="cc-mono" style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.04em' }}>
          <StatInline n={stats.payments} l="pagamentos" c="var(--purple)" />
          <StatInline n={`${stats.sol.toFixed(4)} SOL`} l="transferido" c="var(--orange)" />
          <StatInline n={stats.memories} l="memórias" c="var(--green)" />
        </div>
      </div>
    </div>
  );
}

function StatInline({ n, l, c }: { n: number | string; l: string; c: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: c, fontWeight: 600 }}>{n}</span>
      <span style={{ color: 'var(--text-3)' }}>{l}</span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function CodeChip() {
  const [copied, setCopied] = useState(false);
  const cmd = 'npx congchain pay https://api.qualquer.com';
  return (
    <div onClick={() => { navigator.clipboard?.writeText(cmd).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 18px', marginTop: 36, background: 'var(--bg-elev)', border: '1px solid var(--line-2)', borderRadius: 10, cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', transition: 'all 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--line-3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-2)')}>
      <span className="cc-mono" style={{ color: 'var(--green)', fontSize: 13, flexShrink: 0 }}>$</span>
      <span className="cc-mono" style={{ fontSize: 13.5, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        npx congchain pay <span style={{ color: 'var(--purple)' }}>https://api.qualquer.com</span>
      </span>
      <button style={{ background: 'transparent', border: 'none', color: copied ? 'var(--green)' : 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, marginLeft: 4 }}>
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  );
}

function Hero() {
  return (
    <section style={{ maxWidth: 980, margin: '0 auto', padding: '100px 28px 40px', textAlign: 'center', position: 'relative' }}>
      <h1 style={{ fontSize: 'clamp(56px, 9vw, 112px)', lineHeight: 0.92, fontWeight: 600, letterSpacing: '-0.045em', margin: 0 }}>
        Agentes pagam<br />
        <span style={{ background: 'linear-gradient(95deg, #b794ff 0%, #7c5cff 35%, #5ce3ff 70%, #3ddb88 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          e <span className="cc-serif">lembram.</span>
        </span>
      </h1>

      <p style={{ fontSize: 18, color: 'var(--text-2)', lineHeight: 1.5, margin: '32px auto 0', maxWidth: 540 }}>
        Uma linha para pagar por qualquer API em SOL.<br />
        Mais o resultado salvo como <span style={{ color: 'var(--text)' }}>memória verificável</span> na Solana.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 0, margin: '44px auto 0', maxWidth: 480 }}>
        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div className="cc-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.18em', marginBottom: 8 }}>PAY.SH</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>paga <MidDot /> recebe dados</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-4)', fontSize: 18, padding: '0 4px' }}>›</div>
        <div style={{ flex: 1, padding: '16px 20px', borderLeft: '1px solid var(--line)', background: 'linear-gradient(180deg, rgba(124,92,255,0.06), transparent)' }}>
          <div className="cc-mono" style={{ fontSize: 10, color: 'var(--purple)', letterSpacing: '0.18em', marginBottom: 8, fontWeight: 600 }}>CONGCHAIN PAY</div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            paga <MidDot /> recebe <MidDot /> <span style={{ color: 'var(--green)' }}>salva</span> <MidDot /> <span style={{ color: 'var(--purple)' }}>verifica</span>
          </div>
        </div>
      </div>

      <CodeChip />
    </section>
  );
}

// ─── Stats Grid ───────────────────────────────────────────────────────────────

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <section style={{ maxWidth: 1080, margin: '60px auto 0', padding: '0 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <BigStat n={stats.payments} l="PAGAMENTOS" c="var(--purple)" />
      <BigStat n={<>{stats.sol.toFixed(4)} <span style={{ fontSize: '0.65em', marginLeft: 6, color: 'var(--text-3)' }}>SOL</span></>} l="SOL TRANSFERIDO" c="var(--orange)" />
      <BigStat n={stats.memories} l="MEMÓRIAS SALVAS" c="var(--green)" />
    </section>
  );
}

function BigStat({ n, l, c }: { n: React.ReactNode; l: string; c: string }) {
  return (
    <div style={{ background: 'linear-gradient(180deg, var(--bg-elev), var(--bg-card))', border: '1px solid var(--line)', borderRadius: 14, padding: '32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 1, background: `linear-gradient(90deg, transparent, ${c}, transparent)`, opacity: 0.5 }} />
      <div className="cc-mono" style={{ fontSize: 36, fontWeight: 700, color: c, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 12 }}>{n}</div>
      <div className="cc-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.2em', fontWeight: 500 }}>{l}</div>
    </div>
  );
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

function Terminal({ apis, onPay, selectedApi, setSelectedApi, amount, setAmount }: {
  apis: ApiItem[]; onPay: (sol: number) => void;
  selectedApi: ApiItem; setSelectedApi: (a: ApiItem) => void;
  amount: string; setAmount: (s: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<{ kind: string; text: string }[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  const handleRun = () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    const seq = [
      { t: 200,  line: { kind: 'info', text: `→ POST ${selectedApi.endpoint}` } },
      { t: 600,  line: { kind: 'info', text: `→ Locking ${amount} SOL...` } },
      { t: 1100, line: { kind: 'ok',   text: `✓ Tx 4f8a...e2b1 confirmed (block 4,201,892)` } },
      { t: 1600, line: { kind: 'info', text: `→ Receiving response...` } },
      { t: 2200, line: { kind: 'ok',   text: `✓ Response 200 OK · 1,847 bytes` } },
      { t: 2700, line: { kind: 'info', text: `→ Anchoring SHA-256 hash on Solana...` } },
      { t: 3400, line: { kind: 'ok',   text: `✓ Memory stored · cid:bafyrei...x4q` } },
      { t: 3700, line: { kind: 'done', text: `Total: ${amount} SOL · 1.2s · ✓ verifiable` } },
    ];
    seq.forEach(({ t, line }) => setTimeout(() => setLogs(l => [...l, line]), t));
    setTimeout(() => { setRunning(false); onPay(parseFloat(amount) || 0.001); }, 3900);
  };

  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [logs]);

  return (
    <section style={{ maxWidth: 1080, margin: '44px auto 0', padding: '0 28px' }}>
      <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line-2)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02) inset' }}>
        {/* Title bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', gap: 6 }}><Dot c="#ff5f56" /><Dot c="#ffbd2e" /><Dot c="#27c93f" /></div>
          <span className="cc-mono" style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 8 }}>congchain pay — terminal</span>
          <div style={{ flex: 1 }} />
          <span className="cc-mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>zsh · 80×24</span>
        </div>

        {/* Command */}
        <div style={{ padding: '20px 24px 14px' }}>
          <div className="cc-mono" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
            <span style={{ color: 'var(--green)' }}>$</span>{' '}
            <span style={{ color: 'var(--text)' }}>congchain pay</span>{' '}
            <span style={{ color: 'var(--purple)' }}>{selectedApi.endpoint}</span>
            {!running && <span style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--green)', verticalAlign: 'middle', marginLeft: 4, animation: 'ccBlink 1s infinite' }} />}
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '0 24px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span className="cc-mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>--amount</span>
          <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="cc-mono"
            style={{ width: 80, background: 'var(--bg-card)', border: '1px solid var(--line-2)', color: 'var(--text)', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>SOL</span>
          <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 4px' }} />
          {apis.slice(0, 6).map(a => (
            <button key={a.id} onClick={() => setSelectedApi(a)} className="cc-mono"
              style={{ background: selectedApi.id === a.id ? 'rgba(124,92,255,0.15)' : 'transparent', border: '1px solid ' + (selectedApi.id === a.id ? 'rgba(124,92,255,0.4)' : 'var(--line-2)'), color: selectedApi.id === a.id ? 'var(--purple)' : 'var(--text-2)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {a.short}
            </button>
          ))}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div ref={logsRef} className="cc-mono" style={{ padding: '0 24px 14px', fontSize: 12, lineHeight: 1.7, maxHeight: 180, overflow: 'auto' }}>
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.kind === 'ok' ? 'var(--green)' : l.kind === 'done' ? 'var(--purple)' : 'var(--text-2)', animation: 'ccFadeIn 0.3s ease' }}>{l.text}</div>
            ))}
          </div>
        )}

        {/* Button */}
        <div style={{ padding: '0 24px 20px' }}>
          <button onClick={handleRun} disabled={running}
            style={{ width: '100%', background: running ? 'rgba(124,92,255,0.1)' : 'linear-gradient(180deg, rgba(124,92,255,0.18), rgba(124,92,255,0.08))', border: '1px solid ' + (running ? 'rgba(124,92,255,0.2)' : 'rgba(124,92,255,0.4)'), color: running ? 'var(--text-3)' : 'var(--purple)', padding: '12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: running ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}>
            {running ? <><Spinner /> Executando...</> : <><span>⚡</span> Executar Pagamento</>}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── API Card ─────────────────────────────────────────────────────────────────

const TONE_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  purple: { bg: 'rgba(124,92,255,0.04)',  border: 'rgba(124,92,255,0.2)',  glow: 'rgba(124,92,255,0.15)' },
  orange: { bg: 'rgba(255,158,61,0.04)',  border: 'rgba(255,158,61,0.2)',  glow: 'rgba(255,158,61,0.12)' },
  green:  { bg: 'rgba(61,219,136,0.04)',  border: 'rgba(61,219,136,0.2)',  glow: 'rgba(61,219,136,0.12)' },
  cyan:   { bg: 'rgba(92,227,255,0.04)',  border: 'rgba(92,227,255,0.2)',  glow: 'rgba(92,227,255,0.12)' },
  gold:   { bg: 'rgba(245,201,82,0.04)',  border: 'rgba(245,201,82,0.2)',  glow: 'rgba(245,201,82,0.12)' },
};

function ApiCard({ api, onSelect }: { api: ApiItem; onSelect: (a: ApiItem) => void }) {
  const [hover, setHover] = useState(false);
  const isFree = api.price === 0;
  const c = TONE_COLORS[api.tone] ?? TONE_COLORS.purple;

  return (
    <article onClick={() => onSelect(api)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? c.bg : 'var(--bg-card)', border: '1px solid ' + (hover ? c.border : 'var(--line)'), borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden', transform: hover ? 'translateY(-1px)' : 'translateY(0)', boxShadow: hover ? `0 12px 30px -8px ${c.glow}` : 'none' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 8px', background: isFree ? 'rgba(61,219,136,0.12)' : 'rgba(255,158,61,0.10)', border: '1px solid ' + (isFree ? 'rgba(61,219,136,0.3)' : 'rgba(255,158,61,0.25)'), borderRadius: 5 }}>
        <span className="cc-mono" style={{ fontSize: 9.5, color: isFree ? 'var(--green)' : 'var(--orange)', fontWeight: 600, letterSpacing: '0.04em' }}>
          {isFree ? 'Grátis' : `${api.price.toFixed(3)}/${api.unit}`}
        </span>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elev)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <BrandLogo id={api.id} size={20} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3, letterSpacing: '-0.005em' }}>{api.name}</div>
      <div className="cc-mono" style={{ fontSize: 10.5, color: 'var(--text-3)', letterSpacing: '0.02em' }}>{api.provider}</div>
      {isFree && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--green)', fontSize: 10 }}>▶</span>
          <span className="cc-mono" style={{ fontSize: 11, color: 'var(--green)' }}>testar agora</span>
        </div>
      )}
    </article>
  );
}

// ─── API Catalog ──────────────────────────────────────────────────────────────

function ApiCatalog({ apis, onSelect }: { apis: ApiItem[]; onSelect: (a: ApiItem) => void }) {
  const grouped = useMemo(() => {
    const g: Record<string, ApiItem[]> = {};
    apis.forEach(a => { (g[a.category] = g[a.category] ?? []).push(a); });
    return g;
  }, [apis]);

  return (
    <section style={{ maxWidth: 1240, margin: '120px auto 0', padding: '0 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 36, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="cc-mono" style={{ fontSize: 12, color: 'var(--text-3)', letterSpacing: '0.22em', fontWeight: 500, margin: 0 }}>APIS SUPORTADAS · PAGUE EM SOL</h2>
        <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{apis.length} provedores · qualquer endpoint</div>
      </div>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 40 }}>
          <h3 className="cc-mono" style={{ fontSize: 10.5, color: 'var(--text-3)', letterSpacing: '0.25em', fontWeight: 500, margin: '0 0 12px', paddingLeft: 2 }}>{cat.toUpperCase()}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {items.map(a => <ApiCard key={a.id} api={a} onSelect={onSelect} />)}
          </div>
        </div>
      ))}
      <div className="cc-mono" style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: 'var(--text-4)' }}>
        Cards com <span style={{ color: 'var(--green)' }}>Grátis</span> são clicáveis — funcionam sem chave API. Os demais precisam de autenticação.
      </div>
    </section>
  );
}

// ─── Brand Marquee ────────────────────────────────────────────────────────────

function BrandMarquee({ apis }: { apis: ApiItem[] }) {
  const items = [...apis, ...apis];
  return (
    <section style={{ margin: '80px 0 0', padding: '32px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'linear-gradient(180deg, transparent, rgba(124,92,255,0.03), transparent)', overflow: 'hidden', position: 'relative' }}>
      <div className="cc-mono" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 9.5, color: 'var(--text-4)', letterSpacing: '0.25em', background: 'var(--bg)', padding: '0 12px' }}>
        14 APIS · 1 LINHA · 0 FRICÇÃO
      </div>
      <div style={{ display: 'flex', gap: 48, animation: 'ccMarquee 40s linear infinite', width: 'fit-content', marginTop: 12 }}>
        {items.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 100, flexShrink: 0 }}>
            <BrandLogo id={a.id} size={20} />
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span className="cc-mono" style={{ fontSize: 10, color: a.price === 0 ? 'var(--green)' : 'var(--orange)', padding: '2px 7px', background: a.price === 0 ? 'rgba(61,219,136,0.1)' : 'rgba(255,158,61,0.1)', borderRadius: 4, letterSpacing: '0.04em' }}>
              {a.price === 0 ? 'grátis' : a.price.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 120, background: 'linear-gradient(90deg, var(--bg), transparent)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 120, background: 'linear-gradient(270deg, var(--bg), transparent)', pointerEvents: 'none' }} />
    </section>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    { k: 'Paga por API em SOL',                 paysh: true,  cong: true  },
    { k: 'Uma linha de código',                 paysh: true,  cong: true  },
    { k: 'Salva resultado como memória',        paysh: false, cong: true  },
    { k: 'Hash verificável SHA-256',            paysh: false, cong: true  },
    { k: 'Ancorado na Solana blockchain',       paysh: false, cong: true  },
    { k: 'Visível no Agent Office ao vivo',     paysh: false, cong: true  },
    { k: 'Cross-model — 8 modelos de IA',       paysh: false, cong: true  },
    { k: 'Dashboard de pagamentos',             paysh: false, cong: true  },
    { k: 'API pública reutilizável',            paysh: false, cong: true  },
  ];

  return (
    <section style={{ maxWidth: 980, margin: '120px auto 0', padding: '0 28px' }}>
      <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.25em', fontWeight: 500, textAlign: 'center', marginBottom: 32 }}>
        COMPARAÇÃO DE FUNCIONALIDADES
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--line-2)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', padding: '16px 24px', borderBottom: '1px solid var(--line-2)', background: 'rgba(0,0,0,0.25)' }}>
          <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.1em' }}>Recurso</div>
          <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', letterSpacing: '0.1em' }}>Pay.sh</div>
          <div className="cc-mono" style={{ fontSize: 11, color: 'var(--purple)', textAlign: 'center', letterSpacing: '0.15em', fontWeight: 700 }}>CONGCHAIN</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', padding: '14px 24px', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{r.k}</div>
            <div style={{ textAlign: 'center' }}>{r.paysh ? <Check c="var(--text-3)" /> : <Dash />}</div>
            <div style={{ textAlign: 'center' }}>{r.cong ? <Check c="var(--green)" /> : <Dash />}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Pillars ──────────────────────────────────────────────────────────────────

function Pillars() {
  const items = [
    { title: 'Paga', color: 'var(--orange)', desc: 'Agente transfere SOL automaticamente para acessar o dado.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14H11L10 22L19 10H12L13 2Z" stroke="var(--orange)" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
    { title: 'Lembra', color: 'var(--purple)', desc: 'Resultado salvo como memória verificável com hash SHA-256.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--purple)" strokeWidth="1.8"/><path d="M12 7V12L15 14" stroke="var(--purple)" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { title: 'Prova', color: 'var(--green)', desc: 'Hash ancorado na Solana — qualquer IA pode verificar a origem.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 6V12C4 16.5 7.5 20 12 21C16.5 20 20 16.5 20 12V6L12 3Z" stroke="var(--green)" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
  ];
  return (
    <section style={{ maxWidth: 1080, margin: '80px auto 0', padding: '0 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 14, padding: '32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--bg-elev)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{it.icon}</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: it.color, letterSpacing: '-0.01em' }}>{it.title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{it.desc}</p>
        </div>
      ))}
    </section>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ api, onClose, onConfirm }: { api: ApiItem | null; onClose: () => void; onConfirm: (sol: number) => void }) {
  const [amount, setAmount] = useState('0.001');
  const [step, setStep] = useState<'review' | 'done'>('review');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [api, onClose]);

  if (!api) return null;

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); setStep('done'); onConfirm(parseFloat(amount) || 0.001); }, 1800);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'ccModalFade 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line-2)', borderRadius: 16, width: '100%', maxWidth: 480, animation: 'ccModalSlide 0.25s ease', boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cc-mono" style={{ fontSize: 10.5, color: 'var(--text-3)', letterSpacing: '0.2em' }}>
            {step === 'review' ? 'PAGAR API · 1/2' : 'CONFIRMADO'}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', width: 26, height: 26, padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {step === 'review' && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 22 }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--bg-elev)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BrandLogo id={api.id} size={22} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{api.name}</div>
                <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{api.provider} · {api.endpoint}</div>
              </div>
            </div>
            <label className="cc-mono" style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.18em', marginBottom: 8 }}>VALOR EM SOL</label>
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <input type="number" step="0.001" value={amount} onChange={e => setAmount(e.target.value)} className="cc-mono"
                style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--line-2)', color: 'var(--text)', padding: '13px 60px 13px 14px', borderRadius: 9, fontSize: 18, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }} />
              <span className="cc-mono" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 12 }}>SOL</span>
            </div>
            <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)', padding: '10px 14px', background: 'rgba(124,92,255,0.05)', border: '1px solid rgba(124,92,255,0.15)', borderRadius: 8, marginBottom: 20, lineHeight: 1.55 }}>
              <span style={{ color: 'var(--purple)' }}>ℹ</span> Settlement on-chain em ~1.2s. Resultado anexado como memória verificável.
            </div>
            <button onClick={handlePay} disabled={processing}
              style={{ width: '100%', background: processing ? 'var(--bg-card)' : 'linear-gradient(180deg, #8d6dff, #6845e8)', border: '1px solid ' + (processing ? 'var(--line-2)' : 'rgba(255,255,255,0.15)'), color: processing ? 'var(--text-3)' : '#fff', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: processing ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {processing ? <><Spinner /> Processando on-chain...</> : <>→ Pagar {amount} SOL</>}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(61,219,136,0.12)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--green)', fontSize: 26 }}>✓</div>
            <h2 style={{ fontSize: 20, margin: '0 0 6px', letterSpacing: '-0.01em' }}>Pagamento confirmado</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 20px' }}>Memória ancorada na Solana.</p>
            <div className="cc-mono" style={{ fontSize: 11, color: 'var(--text-3)', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, wordBreak: 'break-all', textAlign: 'left' }}>
              <div style={{ color: 'var(--text-4)', marginBottom: 4 }}>tx_signature</div>
              4f8a9c2e...e2b1 · block 4,201,892
            </div>
            <button onClick={onClose} style={{ width: '100%', marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--line-2)', color: 'var(--text)', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ padding: '60px 28px 40px', marginTop: 100, textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-4)', letterSpacing: '0.15em', fontFamily: '"JetBrains Mono", monospace' }}>
        <span>CONGCHAIN</span>
        <span>·</span>
        <span>Verifiable AI Memory Layer</span>
        <span>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <defs><linearGradient id="solFt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#9945FF"/><stop offset="100%" stopColor="#14F195"/></linearGradient></defs>
            <path d="M5 7h13l-2 2H3l2-2zm0 4h13l-2 2H3l2-2zm14 4H6l-2 2h13l2-2z" fill="url(#solFt)"/>
          </svg>
          Solana
        </span>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayPage() {
  const [stats, setStats] = useState<Stats>({ payments: 0, sol: 0, memories: 0 });
  const [selectedApi, setSelectedApi] = useState<ApiItem>(APIS[5]);
  const [amount, setAmount] = useState('0.001');
  const [modalApi, setModalApi] = useState<ApiItem | null>(null);

  useEffect(() => {
    fetch('/api/pay').then(r => r.json()).then(d => {
      if (d.stats) setStats({ payments: d.stats.totalPayments, sol: d.stats.totalSolPaid, memories: d.stats.totalMemories });
    }).catch(() => {});
  }, []);

  const onPay = (sol: number) => {
    setStats(s => ({ payments: s.payments + 1, sol: s.sol + sol, memories: s.memories + 1 }));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

        :root {
          --bg: #050608; --bg-elev: #0b0d12; --bg-card: #0f1218;
          --line: rgba(255,255,255,0.06); --line-2: rgba(255,255,255,0.10); --line-3: rgba(255,255,255,0.18);
          --text: #f5f6fa; --text-2: #a8acb8; --text-3: #6b6f7c; --text-4: #3f434e;
          --purple: #b794ff; --orange: #ff9e3d; --green: #3ddb88; --cyan: #5ce3ff; --gold: #f5c952;
        }
        .cc-mono { font-family: 'JetBrains Mono', ui-monospace, monospace !important; }
        .cc-serif { font-family: 'Instrument Serif', Georgia, serif !important; font-style: italic; font-weight: 400; }

        @keyframes ccBlink  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes ccFadeIn { from{opacity:0;transform:translateY(-2px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ccSpin   { to{transform:rotate(360deg)} }
        @keyframes ccMarquee{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes ccModalFade  { from{opacity:0} to{opacity:1} }
        @keyframes ccModalSlide { from{opacity:0;transform:translateY(16px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ccBgDrift { 0%{background-position:0% 0%} 100%{background-position:100% 100%} }
      `}</style>

      <div style={{
        background: 'radial-gradient(1200px 700px at 50% -200px, rgba(124,92,255,0.10), transparent 60%), radial-gradient(900px 500px at 90% 30%, rgba(255,158,61,0.04), transparent 60%), radial-gradient(700px 400px at 10% 60%, rgba(61,219,136,0.04), transparent 60%), #050608',
        minHeight: '100vh',
        color: 'var(--text)',
        fontFamily: '"Geist", system-ui, -apple-system, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        animation: 'ccBgDrift 30s ease-in-out infinite alternate',
        backgroundSize: '200% 200%',
      }}>
        <TopBar stats={stats} />
        <Hero />
        <StatsGrid stats={stats} />
        <Terminal apis={APIS} selectedApi={selectedApi} setSelectedApi={setSelectedApi} amount={amount} setAmount={setAmount} onPay={onPay} />
        <ApiCatalog apis={APIS} onSelect={setModalApi} />
        <BrandMarquee apis={APIS} />
        <ComparisonTable />
        <Pillars />
        <Footer />
        <CheckoutModal api={modalApi} onClose={() => setModalApi(null)} onConfirm={onPay} />
      </div>
    </>
  );
}
