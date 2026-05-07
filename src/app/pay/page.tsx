'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Zap, Shield, Brain, Copy, Check, ExternalLink, Loader2, ChevronRight, ArrowRight, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: string; name: string; description: string;
  priceSol: number; priceUsd: string; model: string;
  category: string; example: string;
  inputs: { key: string; label: string; placeholder: string; required: boolean }[];
}

interface PurchaseResult {
  success: boolean;
  analysis: string;
  service: { id: string; name: string };
  payment: { txHash: string; simulated: boolean; amountSol: number; explorerUrl?: string };
  memoryHash: string;
  proof: string;
  duration: number;
  steps: string[];
}

interface Stats { totalPurchases: number; totalSolCollected: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Trade: '#F59E0B', DeFi: '#14F195', 'On-Chain': '#9945FF',
  Pesquisa: '#4285F4', Sentimento: '#00D1FF', Segurança: '#FF6B35',
};

const MODEL_LABELS: Record<string, string> = {
  nvidia: 'Llama 3.3', glm: 'GLM-4.7', minimax: 'MiniMax',
  qwen: 'Qwen3', gpt: 'GPT-4o', claude: 'Claude',
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/25 hover:text-white/60">
      {ok ? <Check className="w-3.5 h-3.5 text-[#14F195]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, onSelect }: { service: Service; onSelect: (s: Service) => void }) {
  const [hover, setHover] = useState(false);
  const color = CATEGORY_COLORS[service.category] ?? '#9945FF';

  return (
    <article
      onClick={() => onSelect(service)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? `rgba(${color === '#F59E0B' ? '245,158,11' : color === '#14F195' ? '20,241,149' : color === '#9945FF' ? '153,69,255' : '66,133,244'},0.04)` : '#0f1218',
        border: `1px solid ${hover ? color + '30' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hover ? `0 12px 30px -8px ${color}15` : 'none',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
      className="rounded-2xl p-5 cursor-pointer transition-all duration-200">

      {/* Top */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
              style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
              {service.category}
            </span>
            <span className="text-[10px] text-white/25">{MODEL_LABELS[service.model] ?? service.model}</span>
          </div>
          <h3 className="text-[14px] font-bold text-white/85 leading-tight">{service.name}</h3>
        </div>
        <div className="text-right flex-shrink-0 ml-3">
          <div className="text-[18px] font-black font-mono" style={{ color }}>{service.priceSol} SOL</div>
          <div className="text-[10px] text-white/25">{service.priceUsd}</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-white/45 leading-relaxed mb-4 line-clamp-2">{service.description}</p>

      {/* Example preview */}
      <div className="rounded-xl p-3 border border-white/[0.04] bg-white/[0.015]">
        <div className="text-[9px] font-semibold uppercase tracking-widest text-white/20 mb-1.5">Exemplo de resultado</div>
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2 italic">{service.example}</p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-1 mt-3" style={{ color }}>
        <span className="text-[11px] font-semibold">Comprar análise</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </article>
  );
}

// ─── Purchase Modal ───────────────────────────────────────────────────────────

function PurchaseModal({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'running' | 'done'>('form');
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!service) return;
    setInputs({});
    setStep('form');
    setResult(null);
    setLogs([]);
    setError('');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [service, onClose]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  if (!service) return null;
  const color = CATEGORY_COLORS[service.category] ?? '#9945FF';

  const handlePurchase = async () => {
    setStep('running');
    setLogs([]);
    setError('');
    try {
      const res = await fetch('/api/pay/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service.id, inputs }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro'); setStep('form'); return; }
      // Animate steps
      data.steps?.forEach((s: string, i: number) => setTimeout(() => setLogs(l => [...l, s]), i * 600));
      setTimeout(() => { setResult(data); setStep('done'); }, (data.steps?.length ?? 3) * 600 + 400);
    } catch (e) { setError(String(e)); setStep('form'); }
  };

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)' }}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#0b0d12', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full mr-2"
              style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>{service.category}</span>
            <span className="text-[13px] font-bold text-white/85">{service.name}</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xl">×</button>
        </div>

        <div className="p-6">
          {/* Form */}
          {step === 'form' && (
            <>
              <p className="text-[13px] text-white/50 leading-relaxed mb-5">{service.description}</p>

              {service.inputs.length > 0 && (
                <div className="space-y-3 mb-5">
                  {service.inputs.map(inp => (
                    <div key={inp.key}>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">
                        {inp.label}{inp.required && ' *'}
                      </label>
                      <input value={inputs[inp.key] ?? ''} onChange={e => setInputs(p => ({ ...p, [inp.key]: e.target.value }))}
                        placeholder={inp.placeholder}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[13px] text-white/80 placeholder-white/20 outline-none focus:border-white/[0.15] transition-colors" />
                    </div>
                  ))}
                </div>
              )}

              {/* Price box */}
              <div className="rounded-xl p-4 mb-5 border" style={{ background: `${color}08`, borderColor: `${color}20` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-white/50">Você paga</span>
                  <div className="text-right">
                    <div className="text-[22px] font-black font-mono" style={{ color }}>{service.priceSol} SOL</div>
                    <div className="text-[10px] text-white/30">{service.priceUsd} · sem assinatura</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-white/35 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  Resultado salvo como memória verificável na Solana
                </div>
              </div>

              {error && <p className="text-[11px] text-red-400/70 mb-3">{error}</p>}

              <button onClick={handlePurchase}
                className="w-full py-3.5 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${color}80, ${color}40)`, border: `1px solid ${color}40`, color }}>
                <Zap className="w-4 h-4" />
                Comprar por {service.priceSol} SOL
              </button>
            </>
          )}

          {/* Running */}
          {step === 'running' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
                <span className="text-[13px] text-white/60">Processando inteligência...</span>
              </div>
              <div ref={logsRef} className="space-y-1.5 max-h-40 overflow-y-auto">
                {logs.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span style={{ color }} className="flex-shrink-0 mt-0.5">→</span>
                    <span className="text-white/55">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {step === 'done' && result && (
            <div className="space-y-4">
              {/* Analysis */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Análise</div>
                <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] text-[13px] text-white/75 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {result.analysis}
                </div>
              </div>

              {/* Proofs */}
              <div className="space-y-2.5 pt-3 border-t border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-white/20 w-14">TX</span>
                  <span className="font-mono text-[11px] text-white/45">{result.payment.txHash.slice(0, 20)}…</span>
                  <CopyBtn text={result.payment.txHash} />
                  {result.payment.explorerUrl && (
                    <a href={result.payment.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-[#14F195]/60 transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {result.payment.simulated && <span className="text-[9px] text-white/15 bg-white/[0.04] px-2 py-0.5 rounded-full">simulado</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-white/20 w-14">Hash</span>
                  <span className="font-mono text-[11px] text-white/45">{result.memoryHash.slice(0, 20)}…</span>
                  <CopyBtn text={result.memoryHash} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-[#14F195]/40 w-14">Proof</span>
                  <span className="font-mono text-[10px] text-[#14F195]/50 truncate">{result.proof}</span>
                  <CopyBtn text={result.proof} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#14F195]/60 flex items-center gap-1"><Check className="w-3.5 h-3.5" />{result.duration}ms · {result.payment.amountSol} SOL</span>
                <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live Terminal ────────────────────────────────────────────────────────────

const DEMO_SCRIPTS = [
  {
    service: 'Sinal de Mercado — SOL/USDT',
    price: '0.005 SOL',
    color: '#F59E0B',
    lines: [
      { text: '$ congchain pay market-signal --asset SOL', delay: 0,    color: 'text-white/55' },
      { text: '⚡ Pagamento: 0.005 SOL → CONGCHAIN vault', delay: 600,  color: 'text-[#F59E0B]/70' },
      { text: '   TX: 3xKmB7pQ9r...  ✓ 89ms',              delay: 1200, color: 'text-[#14F195]/60' },
      { text: '[1/4] Conectando ao Binance...',             delay: 1900, color: 'text-white/35' },
      { text: '   SOL/USDT: $148.23 | Vol 24h: $4.2B  ✓', delay: 2500, color: 'text-[#14F195]/60' },
      { text: '[2/4] Order book + OHLCV capturado',        delay: 3100, color: 'text-white/35' },
      { text: '[3/4] NVIDIA Llama 3.3 70B processando...', delay: 3700, color: 'text-white/35' },
      { text: '[4/4] Gerando análise de trade...',         delay: 4400, color: 'text-white/35' },
      { text: '',                                          delay: 5000, color: '' },
      { text: '▶ SINAL: COMPRA | Confiança: 87%',         delay: 5100, color: 'text-[#F59E0B] font-bold' },
      { text: '  Entrada: $145–149 | Stop: $139.50',      delay: 5700, color: 'text-white/60' },
      { text: '  Target 1: $158.00 (+6.6%)',              delay: 6200, color: 'text-[#14F195]/70' },
      { text: '  Target 2: $172.00 (+16.0%)',             delay: 6700, color: 'text-[#14F195]/70' },
      { text: '',                                          delay: 7200, color: '' },
      { text: '◆ Hash: a3f9b2c1d7e8...  | SHA-256',       delay: 7400, color: 'text-[#9945FF]/70' },
      { text: '◆ Ancorado na Solana · Verificável ✓',     delay: 7900, color: 'text-[#9945FF]/70' },
    ],
  },
  {
    service: 'Scan DeFi Yields — Solana',
    price: '0.008 SOL',
    color: '#14F195',
    lines: [
      { text: '$ congchain pay defi-yield --chain solana',  delay: 0,    color: 'text-white/55' },
      { text: '⚡ Pagamento: 0.008 SOL → CONGCHAIN vault',  delay: 600,  color: 'text-[#14F195]/70' },
      { text: '   TX: 9pNr4vWx2k...  ✓ 71ms',              delay: 1200, color: 'text-[#14F195]/60' },
      { text: '[1/3] DeFiLlama API — buscando TVL...',      delay: 1900, color: 'text-white/35' },
      { text: '   23 protocolos · TVL total: $8.41B  ✓',   delay: 2600, color: 'text-[#14F195]/60' },
      { text: '[2/3] GLM-4.7 Flash analisando yields...',  delay: 3300, color: 'text-white/35' },
      { text: '[3/3] Ranking + filtro de risco...',         delay: 4100, color: 'text-white/35' },
      { text: '',                                           delay: 4800, color: '' },
      { text: '▶ TOP YIELDS IDENTIFICADOS',                delay: 5000, color: 'text-[#14F195] font-bold' },
      { text: '  #1 Kamino USDC/SOL: 34.2% APY',          delay: 5500, color: 'text-white/60' },
      { text: '  #2 Meteora SOL/JitoSOL: 28.7% APY',      delay: 6000, color: 'text-white/60' },
      { text: '  #3 Raydium USDC/USDT: 18.4% APY',        delay: 6500, color: 'text-white/60' },
      { text: '  Yield ponderado recomendado: 27.4% APY', delay: 7100, color: 'text-[#14F195]/70' },
      { text: '',                                           delay: 7600, color: '' },
      { text: '◆ Hash: c8d2e1f3a0b9...  | Solana ✓',      delay: 7800, color: 'text-[#9945FF]/70' },
    ],
  },
];

function LiveTerminal() {
  const [scriptIdx, setScriptIdx] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const script = DEMO_SCRIPTS[scriptIdx];

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const play = useCallback((idx: number) => {
    clearTimers();
    setVisibleLines(0);
    const s = DEMO_SCRIPTS[idx];
    s.lines.forEach((_, i) => {
      const t = setTimeout(() => setVisibleLines(i + 1), s.lines[i].delay);
      timersRef.current.push(t);
    });
    // Auto advance to next script after last line + 2s pause
    const last = s.lines[s.lines.length - 1].delay + 2400;
    const advance = setTimeout(() => {
      const next = (idx + 1) % DEMO_SCRIPTS.length;
      setScriptIdx(next);
      play(next);
    }, last);
    timersRef.current.push(advance);
  }, []);

  useEffect(() => {
    if (playing) play(scriptIdx);
    else clearTimers();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const restart = () => { setScriptIdx(0); setPlaying(true); play(0); };

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 mb-16">
      <div className="rounded-2xl border border-white/[0.06] bg-[#050507] overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-white/[0.015]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]/80" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]/80" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]/80" />
            </div>
            <span className="text-[11px] font-mono text-white/25 ml-1">congchain pay — terminal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border"
              style={{ color: script.color, borderColor: `${script.color}30`, background: `${script.color}10` }}>
              {script.service}
            </span>
            <button onClick={restart}
              className="p-1 rounded hover:bg-white/10 transition-colors text-white/20 hover:text-white/50">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div className="p-5 min-h-[240px] font-mono text-[12px] leading-relaxed">
          {script.lines.slice(0, visibleLines).map((line, i) => (
            <div key={`${scriptIdx}-${i}`}
              className={`${line.color} transition-all duration-150`}
              style={{ animation: 'termFadeIn 0.15s ease-out' }}>
              {line.text || ' '}
            </div>
          ))}
          {visibleLines < script.lines.length && (
            <span className="inline-block w-2 h-3.5 bg-white/30 animate-pulse ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Comparison vs Pay.sh ─────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    ['Paga por serviço em SOL',                  true,  true ],
    ['Sem conta / sem cadastro',                 true,  true ],
    ['Dados de mercado em tempo real',           false, true ],
    ['Análise com IA integrada',                 false, true ],
    ['Hash SHA-256 verificável',                 false, true ],
    ['Resultado ancorado na Solana blockchain',  false, true ],
    ['Memória salva entre sessões de IA',        false, true ],
    ['Visível no Agent Office ao vivo',          false, true ],
    ['Suporte a 8 modelos de IA',                false, true ],
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 mb-16">
      <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 mb-5 text-center">
        CONGCHAIN Pay vs Pay.sh — Comparação de funcionalidades
      </div>
      <div className="rounded-2xl border border-white/[0.05] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.01]">
              <th className="px-5 py-3 text-left text-white/25 font-medium">Funcionalidade</th>
              <th className="px-5 py-3 text-center text-white/25 font-medium text-[11px]">Pay.sh</th>
              <th className="px-5 py-3 text-center font-bold text-[11px]" style={{ color: '#9945FF' }}>CONGCHAIN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feature, paysh, cong]) => (
              <tr key={String(feature)} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                <td className="px-5 py-2.5 text-white/45">{String(feature)}</td>
                <td className="px-5 py-2.5 text-center">
                  {paysh ? <span className="text-white/35">✓</span> : <span className="text-white/10">—</span>}
                </td>
                <td className="px-5 py-2.5 text-center">
                  {cong ? <span className="text-[#14F195] font-bold">✓</span> : <span className="text-white/10">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Escolha a análise', desc: 'Selecione o serviço de inteligência que precisa. Sem conta, sem cadastro.' },
    { n: '02', title: 'Pague em SOL', desc: 'Micropagamento instantâneo. Menos de $2 pela maioria das análises.' },
    { n: '03', title: 'Receba a inteligência', desc: 'CONGCHAIN coleta dados reais e gera análise com o melhor modelo de IA.' },
    { n: '04', title: 'Prova na Solana', desc: 'Resultado salvo com hash SHA-256, ancorado on-chain. Verificável por qualquer IA.' },
  ];
  return (
    <section className="max-w-4xl mx-auto px-5 sm:px-8 mb-20">
      <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20 mb-8 text-center">Como funciona</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {steps.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-[28px] font-black font-mono text-white/[0.06] mb-2">{s.n}</div>
            <h3 className="text-[12px] font-bold text-white/70 mb-1.5">{s.title}</h3>
            <p className="text-[11px] text-white/35 leading-relaxed">{s.desc}</p>
            {i < steps.length - 1 && (
              <div className="hidden md:flex justify-end mt-4 pr-2">
                <ArrowRight className="w-3.5 h-3.5 text-white/15" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<Stats>({ totalPurchases: 0, totalSolCollected: 0 });
  const [selected, setSelected] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Todos');

  useEffect(() => {
    fetch('/api/pay/intelligence').then(r => r.json()).then(d => {
      setServices(d.services ?? []);
      setStats(d.stats ?? { totalPurchases: 0, totalSolCollected: 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(services.map(s => s.category))];
  const filters = ['Todos', ...categories];
  const visibleServices = activeFilter === 'Todos' ? services : services.filter(s => s.category === activeFilter);

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fade-up 0.4s ease-out forwards; }
        @keyframes termFadeIn { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      <div className="min-h-screen bg-[#050608] text-white" style={{ fontFamily: '"Geist", system-ui, sans-serif' }}>

        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-[#050608]/90 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />Chat
            </a>
            <div className="w-px h-4 bg-white/[0.06]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L10.5 3.5V8.5L6 11L1.5 8.5V3.5L6 1Z" fill="white" fillOpacity="0.95"/></svg>
              </div>
              <span className="text-[11px] font-black tracking-[0.12em] bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">CONGCHAIN</span>
              <span className="text-[9px] text-white/20 border-l border-white/[0.06] pl-3 tracking-wider uppercase">Intelligence Pay</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-[10px] font-mono text-white/20">
            <span>{stats.totalPurchases} análises vendidas</span>
            <span>{stats.totalSolCollected.toFixed(3)} SOL coletados</span>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-20 pb-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#9945FF]/20 bg-[#9945FF]/8 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9945FF] animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9945FF]/70">Inteligência Verificável com SOL</span>
          </div>

          <h1 className="text-[44px] sm:text-[60px] font-black leading-[1.05] tracking-tight mb-5">
            <span className="text-white/90">Compre análises de IA.</span><br />
            <span className="bg-gradient-to-r from-[#9945FF] via-[#a855f7] to-[#14F195] bg-clip-text text-transparent">Pague em SOL.</span>
          </h1>

          <p className="text-[16px] text-white/40 max-w-xl mx-auto mb-4 leading-relaxed">
            Sem conta. Sem assinatura. Sem cartão de crédito.<br />
            <span className="text-white/55">Dados reais + IA + prova na blockchain.</span>
          </p>

          <div className="flex items-center justify-center gap-6 text-[12px] text-white/30">
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#F59E0B]" />A partir de 0.005 SOL</span>
            <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-[#9945FF]" />Resultado salvo como memória</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#14F195]" />Prova on-chain Solana</span>
          </div>
        </div>

        {/* Live Terminal Demo */}
        <LiveTerminal />

        {/* Services */}
        <div className="max-w-6xl mx-auto px-5 sm:px-8 mb-20">
          {/* Category filter pills */}
          {!loading && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {filters.map(f => {
                const isActive = activeFilter === f;
                const color = f === 'Todos' ? '#9945FF' : (CATEGORY_COLORS[f] ?? '#9945FF');
                return (
                  <button key={f} onClick={() => setActiveFilter(f)}
                    style={{
                      background: isActive ? `${color}18` : 'transparent',
                      border: `1px solid ${isActive ? color + '40' : 'rgba(255,255,255,0.07)'}`,
                      color: isActive ? color : 'rgba(255,255,255,0.35)',
                      boxShadow: isActive ? `0 0 14px ${color}18` : 'none',
                    }}
                    className="px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-150 hover:border-white/20">
                    {f}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-white/20" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleServices.map(s => (
                <ServiceCard key={s.id} service={s} onSelect={setSelected} />
              ))}
            </div>
          )}
        </div>

        <HowItWorks />

        {/* Comparison */}
        <ComparisonTable />

        {/* Why SOL */}
        <div className="max-w-3xl mx-auto px-5 sm:px-8 mb-20">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-8">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20 mb-6 text-center">Por que pagar em SOL?</div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { title: 'Sem conta', desc: 'Nenhum cadastro, nenhum billing, nenhum e-mail. Só carteira + SOL.', color: '#9945FF' },
                { title: 'Micropagamento', desc: 'Pague por análise, não por mês. 0.005 SOL por chamada ao invés de $20/mês.', color: '#F59E0B' },
                { title: 'Prova verificável', desc: 'Cada análise tem hash SHA-256 ancorado na Solana. Nenhuma outra plataforma faz isso.', color: '#14F195' },
              ].map(({ title, desc, color }) => (
                <div key={title} className="text-center">
                  <div className="text-[13px] font-bold mb-1.5" style={{ color }}>{title}</div>
                  <p className="text-[11px] text-white/35 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.04] py-8 text-center">
          <div className="flex items-center justify-center gap-3 text-[10px] text-white/20 font-mono">
            <span>CONGCHAIN</span><span>·</span>
            <span>Verifiable AI Memory Layer</span><span>·</span>
            <span className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="slFt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#9945FF"/><stop offset="100%" stopColor="#14F195"/></linearGradient></defs><path d="M5 7h13l-2 2H3l2-2zm0 4h13l-2 2H3l2-2zm14 4H6l-2 2h13l2-2z" fill="url(#slFt)"/></svg>
              Solana
            </span>
          </div>
        </div>
      </div>

      <PurchaseModal service={selected} onClose={() => setSelected(null)} />
    </>
  );
}
