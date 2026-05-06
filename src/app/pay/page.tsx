'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Zap, Shield, Brain, Copy, Check, ExternalLink, ChevronRight, Play, Loader2 } from 'lucide-react';

interface PayResult {
  success: boolean;
  payment: { txHash: string; simulated: boolean; amountSol: number; fromWallet: string; explorerUrl?: string };
  data: unknown;
  memoryHash: string | null;
  proof: string | null;
  duration: number;
  steps: string[];
  stats: { totalPayments: number; totalSolPaid: number; totalMemories: number };
}

interface GlobalStats { wallet: string; balance: number; stats: { totalPayments: number; totalSolPaid: number; totalMemories: number } }

const DEMO_URLS = [
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  'https://price.jup.ag/v6/price?ids=SOL',
  'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
  'https://httpbin.org/json',
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/70">
      {copied ? <Check className="w-3.5 h-3.5 text-[#14F195]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TerminalLine({ text, delay, color = 'text-white/60' }: { text: string; delay?: number; color?: string }) {
  const [visible, setVisible] = useState(delay === undefined);
  useEffect(() => {
    if (delay !== undefined) { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }
  }, [delay]);
  if (!visible) return null;
  return <div className={`font-mono text-[13px] leading-relaxed ${color}`}>{text}</div>;
}

function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    ref.current = display;
    const diff = value - ref.current;
    if (Math.abs(diff) < 0.001) return;
    const steps = 30;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplay(prev => {
        const next = prev + diff / steps;
        return i >= steps ? value : next;
      });
      if (i >= steps) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [value]); // eslint-disable-line
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

export default function PayPage() {
  const [url, setUrl] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/pay').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const handlePay = async () => {
    if (!url.trim() || loading) return;
    setLoading(true); setResult(null); setError(''); setActiveStep(0);
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), amount: parseFloat(amount) || 0.001 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro'); return; }
      setResult(data);
      setStats(s => s ? { ...s, stats: data.stats } : null);
      // Animate steps
      data.steps?.forEach((_: string, i: number) => {
        setTimeout(() => setActiveStep(i), i * 400);
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const dataPreview = result?.data
    ? JSON.stringify(result.data, null, 2).slice(0, 600)
    : null;

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor { animation: blink 1s ease-in-out infinite; }
        @keyframes glow-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .glow-in { animation: glow-in 0.4s ease-out forwards; }
        @keyframes scan { from{background-position:0 0} to{background-position:0 100%} }
      `}</style>

      <div className="min-h-screen bg-[#000000] text-white"
        style={{
          backgroundImage: 'linear-gradient(rgba(153,69,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(153,69,255,0.02) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }}>

        {/* ── Nav ── */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] backdrop-blur-xl sticky top-0 z-20 bg-black/80">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/70 transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />Chat
            </a>
            <div className="w-px h-4 bg-white/[0.08]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L10.5 3.5V8.5L6 11L1.5 8.5V3.5L6 1Z" fill="white" fillOpacity="0.9"/>
                </svg>
              </div>
              <span className="text-[12px] font-black tracking-[0.1em] bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">CONGCHAIN</span>
              <span className="text-[10px] text-white/30 border-l border-white/[0.08] pl-3">PAY</span>
            </div>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-white/25">
              <span>{stats.stats.totalPayments} pagamentos</span>
              <span>{stats.stats.totalSolPaid.toFixed(4)} SOL</span>
              <span>{stats.stats.totalMemories} memórias</span>
            </div>
          )}
        </nav>

        <div className="max-w-4xl mx-auto px-4 sm:px-6">

          {/* ── Hero ── */}
          <div className="pt-16 pb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9945FF]/80">Pay.sh → mas muito melhor</span>
            </div>

            <h1 className="text-[40px] sm:text-[56px] font-black leading-tight mb-4">
              <span className="bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                Agentes pagam
              </span>
              <br />
              <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                e lembram.
              </span>
            </h1>

            <p className="text-[15px] text-white/40 max-w-xl mx-auto mb-3 leading-relaxed">
              Uma linha para pagar por qualquer API em SOL.<br />
              <span className="text-white/60">Mais o resultado salvo como memória verificável na Solana.</span>
            </p>

            {/* Comparison */}
            <div className="flex items-center justify-center gap-6 mb-10">
              <div className="text-center">
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Pay.sh</div>
                <div className="text-[11px] text-white/40">paga · recebe dados</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/15" />
              <div className="text-center">
                <div className="text-[10px] font-black text-[#9945FF]/80 uppercase tracking-widest mb-1">CONGCHAIN PAY</div>
                <div className="text-[11px] text-white/60">paga · recebe · <span className="text-[#14F195]">salva</span> · <span className="text-[#9945FF]">verifica</span></div>
              </div>
            </div>

            {/* CLI badge */}
            <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[#14F195]/60 font-mono text-[12px]">$</span>
              <span className="font-mono text-[12px] text-white/70">npx congchain pay https://api.qualquer.com</span>
              <CopyButton text="npx congchain pay https://api.qualquer.com" />
            </div>
          </div>

          {/* ── Live Stats ── */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mb-10">
              {[
                { label: 'Pagamentos', value: stats.stats.totalPayments, color: '#9945FF', decimals: 0 },
                { label: 'SOL Transferido', value: stats.stats.totalSolPaid, color: '#F59E0B', suffix: ' SOL', decimals: 4 },
                { label: 'Memórias Salvas', value: stats.stats.totalMemories, color: '#14F195', decimals: 0 },
              ].map(({ label, value, color, suffix, decimals }) => (
                <div key={label} className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 text-center">
                  <div className="text-[28px] font-black font-mono" style={{ color, textShadow: `0 0 20px ${color}40` }}>
                    <AnimatedCounter value={value} suffix={suffix ?? ''} decimals={decimals} />
                  </div>
                  <div className="text-[10px] text-white/25 uppercase tracking-widest mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Try it Live ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden mb-10">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.05] bg-white/[0.01]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[11px] text-white/30 font-mono ml-2">congchain pay — terminal</span>
            </div>

            <div className="p-5">
              {/* Input */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#14F195]/60 font-mono text-[13px] flex-shrink-0">$</span>
                <span className="text-white/40 font-mono text-[13px] flex-shrink-0">congchain pay</span>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePay()}
                  placeholder="https://api.qualquer.com/dados"
                  className="flex-1 bg-transparent font-mono text-[13px] text-white/80 placeholder-white/15 outline-none"
                />
                {!url && <span className="cursor text-[#14F195]/60 font-mono">▌</span>}
              </div>

              {/* Amount + Demo URLs */}
              <div className="flex items-center gap-3 mb-4 pl-4">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-white/25 font-mono">--amount</span>
                  <input value={amount} onChange={e => setAmount(e.target.value)}
                    className="w-16 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 font-mono text-[11px] text-white/70 outline-none text-center"
                  />
                  <span className="text-white/25 font-mono">SOL</span>
                </div>
                <span className="text-white/10">|</span>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_URLS.map(u => {
                    const host = new URL(u).hostname.replace('api.', '').split('.')[0];
                    return (
                      <button key={u} onClick={() => setUrl(u)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-all ${url === u ? 'border-[#9945FF]/50 bg-[#9945FF]/10 text-[#9945FF]/80' : 'border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/[0.12]'}`}>
                        {host}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Execute button */}
              <button onClick={handlePay} disabled={!url.trim() || loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-all disabled:opacity-30"
                style={{
                  background: loading ? 'rgba(153,69,255,0.1)' : 'linear-gradient(135deg, #9945FF, #14F195)',
                  boxShadow: loading ? 'none' : '0 0 30px rgba(153,69,255,0.3)',
                }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
                  : <><Zap className="w-4 h-4" />Executar Pagamento</>}
              </button>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[11px] text-[#EF4444]/80 font-mono">
                  ✗ {error}
                </div>
              )}

              {/* Output */}
              {(loading || result) && (
                <div ref={terminalRef} className="mt-4 space-y-1 glow-in">
                  <div className="h-px bg-white/[0.05] mb-3" />

                  {loading && !result && (
                    <div className="flex items-center gap-2 text-[#00D1FF]/60 font-mono text-[12px]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processando pagamento...
                    </div>
                  )}

                  {result && (
                    <>
                      {result.steps.map((step, i) => (
                        <TerminalLine key={i} text={`→ ${step}`} delay={i * 300}
                          color={i === 0 ? 'text-[#9945FF]/70' : i === result.steps.length - 1 ? 'text-[#14F195]/80' : 'text-white/45'} />
                      ))}

                      {/* TX Hash */}
                      <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]/60">TX Solana</span>
                          <span className="font-mono text-[11px] text-white/50">{result.payment.txHash?.slice(0, 20)}...</span>
                          <CopyButton text={result.payment.txHash ?? ''} />
                          {result.payment.explorerUrl && (
                            <a href={result.payment.explorerUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[#14F195]/40 hover:text-[#14F195]/80 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {result.payment.simulated && (
                            <span className="text-[9px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded-full">simulado</span>
                          )}
                        </div>

                        {result.memoryHash && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9945FF]/60">Memória</span>
                            <span className="font-mono text-[11px] text-white/50">{result.memoryHash.slice(0, 20)}...</span>
                            <CopyButton text={result.memoryHash} />
                          </div>
                        )}

                        {result.proof && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#14F195]/60">Proof</span>
                            <span className="font-mono text-[11px] text-[#14F195]/60">{result.proof}</span>
                            <CopyButton text={result.proof} />
                          </div>
                        )}
                      </div>

                      {/* Data preview */}
                      {dataPreview && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05]">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 block mb-2">Dados</span>
                          <pre className="font-mono text-[11px] text-[#14F195]/70 leading-relaxed overflow-x-auto max-h-40 overflow-y-auto">{dataPreview}</pre>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 text-[#14F195]/60 font-mono text-[12px]">
                        <Check className="w-3.5 h-3.5" />
                        Concluído em {result.duration}ms · {result.payment.amountSol} SOL
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Comparison table ── */}
          <div className="mb-10">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-4 text-center">Por que é superior ao Pay.sh</h2>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="px-4 py-3 text-left text-white/25 font-medium">Recurso</th>
                    <th className="px-4 py-3 text-center text-white/25 font-medium">Pay.sh</th>
                    <th className="px-4 py-3 text-center font-bold" style={{ color: '#9945FF' }}>CONGCHAIN</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Paga por API em SOL', true, true],
                    ['Uma linha de código', true, true],
                    ['Salva resultado como memória', false, true],
                    ['Hash verificável SHA-256', false, true],
                    ['Ancorado na Solana blockchain', false, true],
                    ['Visível no Agent Office ao vivo', false, true],
                    ['Cross-model (8 IAs)', false, true],
                    ['Dashboard de pagamentos', false, true],
                    ['API pública reutilizável', false, true],
                  ].map(([feature, paysh, cong]) => (
                    <tr key={String(feature)} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="px-4 py-2.5 text-white/50">{String(feature)}</td>
                      <td className="px-4 py-2.5 text-center">{paysh ? <span className="text-[#14F195]/50">✓</span> : <span className="text-white/15">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">{cong ? <span className="text-[#14F195] font-bold">✓</span> : <span className="text-white/15">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── How agents pay ── */}
          <div className="grid sm:grid-cols-3 gap-4 mb-16">
            {[
              { icon: <Zap className="w-5 h-5" />, color: '#F59E0B', title: 'Paga', desc: 'Agente transfere SOL automaticamente para acessar o dado' },
              { icon: <Brain className="w-5 h-5" />, color: '#9945FF', title: 'Lembra', desc: 'Resultado salvo como memória verificável com hash SHA-256' },
              { icon: <Shield className="w-5 h-5" />, color: '#14F195', title: 'Prova', desc: 'Hash ancorado na Solana — qualquer IA pode verificar a origem' },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 text-center hover:border-white/[0.1] transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `${color}15`, color }}>
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-white/80 mb-1">{title}</h3>
                <p className="text-[11px] text-white/35 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <div className="text-center pb-12 text-[10px] text-white/15 font-mono">
            CONGCHAIN · Verifiable AI Memory Layer · Solana
          </div>
        </div>
      </div>
    </>
  );
}
