'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Zap, Shield, Brain, Copy, Check, ExternalLink, Loader2, ChevronRight } from 'lucide-react';

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

interface GlobalStats {
  wallet: string;
  balance: number;
  stats: { totalPayments: number; totalSolPaid: number; totalMemories: number };
}

const DEMO_URLS = [
  { label: 'CoinGecko',  url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd' },
  { label: 'Jupiter',    url: 'https://price.jup.ag/v6/price?ids=SOL' },
  { label: 'Binance',    url: 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT' },
  { label: 'DeFiLlama',  url: 'https://api.llama.fi/tvl/solana' },
  { label: 'OpenAI',     url: 'https://status.openai.com/api/v2/status.json' },
];

const API_CATALOG = [
  { cat: 'AI Models',    name: 'Anthropic Claude', endpoint: 'api.anthropic.com/v1',         cost: '$0.015/1k tok', color: '#FF6B35' },
  { cat: 'AI Models',    name: 'OpenAI GPT-4o',    endpoint: 'api.openai.com/v1',            cost: '$0.005/1k tok', color: '#10A37F' },
  { cat: 'AI Models',    name: 'DeepSeek V3',      endpoint: 'api.deepseek.com/v1',          cost: '$0.001/1k tok', color: '#4285F4' },
  { cat: 'AI Models',    name: 'Google Gemini',    endpoint: 'generativelanguage.googleapis.com', cost: '$0.002/1k tok', color: '#FBBC05' },
  { cat: 'AI Models',    name: 'NVIDIA Llama 3.3', endpoint: 'integrate.api.nvidia.com/v1',  cost: 'Grátis',        color: '#76B900' },
  { cat: 'Solana',       name: 'Helius RPC',       endpoint: 'mainnet.helius-rpc.com',       cost: '$0.001/req',    color: '#FF6B35' },
  { cat: 'Solana',       name: 'Jupiter Price',    endpoint: 'price.jup.ag/v6',              cost: 'Grátis',        color: '#9945FF' },
  { cat: 'Solana',       name: 'SolanaFM',         endpoint: 'api.solana.fm/v0',             cost: 'Grátis',        color: '#14F195' },
  { cat: 'Market Data',  name: 'CoinGecko',        endpoint: 'api.coingecko.com/api/v3',     cost: 'Grátis',        color: '#8DC647' },
  { cat: 'Market Data',  name: 'Binance',          endpoint: 'api.binance.com/api/v3',       cost: 'Grátis',        color: '#F0B90B' },
  { cat: 'Market Data',  name: 'CoinMarketCap',    endpoint: 'pro-api.coinmarketcap.com/v1', cost: '$0.001/req',    color: '#00aff0' },
  { cat: 'Market Data',  name: 'DeFiLlama',        endpoint: 'api.llama.fi',                 cost: 'Grátis',        color: '#00D1FF' },
];

const CATEGORIES = ['AI Models', 'Solana', 'Market Data'];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/25 hover:text-white/60">
      {copied ? <Check className="w-3.5 h-3.5 text-[#14F195]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 px-6 py-5 border-r border-white/[0.04] last:border-0 text-center">
      <div className="text-[30px] font-black font-mono leading-none mb-1.5"
        style={{ color, textShadow: `0 0 24px ${color}50` }}>{value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">{label}</div>
    </div>
  );
}

export default function PayPage() {
  const [url, setUrl] = useState('');
  const [amount, setAmount] = useState('0.001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [_step, setStep] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/pay').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const handlePay = async () => {
    if (!url.trim() || loading) return;
    setLoading(true); setResult(null); setError(''); setStep(0);
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
      data.steps?.forEach((_: string, i: number) => setTimeout(() => setStep(i), i * 400));
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor { display:inline-block; animation:blink 1s ease-in-out infinite; }
        @keyframes fade-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fade-up 0.35s ease-out forwards; }
      `}</style>

      <div className="min-h-screen bg-[#030305] text-white">

        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-[#030305]/90 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Chat
            </a>
            <div className="w-px h-4 bg-white/[0.06]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L10.5 3.5V8.5L6 11L1.5 8.5V3.5L6 1Z" fill="white" fillOpacity="0.95"/>
                </svg>
              </div>
              <span className="text-[11px] font-black tracking-[0.12em] bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">CONGCHAIN</span>
              <span className="text-[9px] text-white/20 border-l border-white/[0.06] pl-3 tracking-wider uppercase">Pay</span>
            </div>
          </div>
          {stats && (
            <div className="hidden sm:flex items-center gap-5 text-[10px] font-mono text-white/20">
              <span>{stats.stats.totalPayments} pagamentos</span>
              <span>{stats.stats.totalSolPaid.toFixed(4)} SOL</span>
            </div>
          )}
        </nav>

        <div className="max-w-[960px] mx-auto px-5 sm:px-8">

          {/* Hero */}
          <div className="pt-20 pb-14 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/25 mb-6">
              Solana Payment Layer
            </p>
            <h1 className="text-[48px] sm:text-[64px] font-black leading-[1.05] tracking-tight mb-5">
              <span className="text-white/90">Pague por qualquer API</span>
              <br />
              <span className="bg-gradient-to-r from-[#9945FF] via-[#a855f7] to-[#14F195] bg-clip-text text-transparent">
                em SOL.
              </span>
            </h1>
            <p className="text-[16px] text-white/35 max-w-lg mx-auto mb-10 leading-relaxed font-light">
              Uma linha de código. Sem contas. Sem assinaturas.<br />
              <span className="text-white/50">O resultado salvo como memória verificável na Solana.</span>
            </p>

            {/* CLI line */}
            <div className="inline-flex items-center gap-3 bg-white/[0.025] border border-white/[0.06] rounded-xl px-5 py-3 mb-4">
              <span className="text-[#14F195]/50 font-mono text-[12px]">$</span>
              <span className="font-mono text-[12px] text-white/60 select-all">
                npx congchain pay https://api.qualquer.com
              </span>
              <CopyBtn text="npx congchain pay https://api.qualquer.com" />
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex border border-white/[0.04] rounded-2xl overflow-hidden mb-14 bg-white/[0.01]">
              <Stat label="Pagamentos" value={String(stats.stats.totalPayments)} color="#9945FF" />
              <Stat label="SOL Transferido" value={`${stats.stats.totalSolPaid.toFixed(4)}`} color="#F59E0B" />
              <Stat label="Memórias Salvas" value={String(stats.stats.totalMemories)} color="#14F195" />
            </div>
          )}

          {/* Terminal */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#050507] overflow-hidden mb-14">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.015]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]/80" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]/80" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]/80" />
              </div>
              <span className="text-[11px] font-mono text-white/20 ml-2">congchain pay</span>
            </div>

            <div className="p-6">
              {/* Input line */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[#14F195]/50 font-mono text-[13px] flex-shrink-0">$</span>
                <span className="text-white/35 font-mono text-[13px] flex-shrink-0">congchain pay</span>
                <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePay()}
                  placeholder="https://api.endpoint.com/recurso"
                  className="flex-1 bg-transparent font-mono text-[13px] text-white/75 placeholder-white/15 outline-none" />
                {!url && <span className="cursor text-[#14F195]/40 font-mono">▌</span>}
              </div>

              {/* Options */}
              <div className="flex items-center gap-4 pl-5 mb-5">
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-white/20">--amount</span>
                  <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.001"
                    className="w-16 text-center bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5 text-white/60 outline-none text-[11px]" />
                  <span className="text-white/20">SOL</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_URLS.map(d => (
                    <button key={d.url} onClick={() => setUrl(d.url)}
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono border transition-all ${url === d.url ? 'border-[#9945FF]/50 bg-[#9945FF]/10 text-[#9945FF]/80' : 'border-white/[0.05] text-white/20 hover:text-white/45 hover:border-white/[0.1]'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execute */}
              <button onClick={handlePay} disabled={!url.trim() || loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-all duration-200 disabled:opacity-25"
                style={{
                  background: loading ? 'rgba(153,69,255,0.1)' : 'linear-gradient(135deg,#9945FF,#14F195)',
                  boxShadow: loading || !url.trim() ? 'none' : '0 0 28px rgba(153,69,255,0.25)',
                }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processando...</> : <><Zap className="w-4 h-4" />Executar</>}
              </button>

              {/* Output */}
              {(loading || result || error) && (
                <div ref={terminalRef} className="mt-5 pt-5 border-t border-white/[0.04] space-y-1 fade-up">
                  {loading && !result && (
                    <div className="flex items-center gap-2 font-mono text-[12px] text-[#00D1FF]/60">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />Processando...
                    </div>
                  )}
                  {error && <div className="font-mono text-[11px] text-[#EF4444]/70 bg-[#EF4444]/5 border border-[#EF4444]/10 rounded-lg px-3 py-2">{error}</div>}
                  {result && (
                    <>
                      {result.steps.map((s, i) => (
                        <div key={i} className="font-mono text-[12px] leading-relaxed"
                          style={{ color: i === result.steps.length - 1 ? '#14F195' : 'rgba(255,255,255,0.4)', animation: `fade-up 0.3s ease-out ${i * 150}ms both` }}>
                          → {s}
                        </div>
                      ))}

                      <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2.5">
                        {/* TX */}
                        <div className="flex items-center gap-2.5">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20 w-16">TX</span>
                          <span className="font-mono text-[11px] text-white/45">{result.payment.txHash?.slice(0,20)}…</span>
                          <CopyBtn text={result.payment.txHash ?? ''} />
                          {result.payment.explorerUrl && (
                            <a href={result.payment.explorerUrl} target="_blank" rel="noopener noreferrer"
                              className="text-white/20 hover:text-[#14F195]/70 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {result.payment.simulated && <span className="text-[9px] text-white/15 bg-white/[0.04] px-2 py-0.5 rounded-full">devnet simulado</span>}
                        </div>
                        {/* Memory */}
                        {result.memoryHash && (
                          <div className="flex items-center gap-2.5">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20 w-16">Memória</span>
                            <span className="font-mono text-[11px] text-white/45">{result.memoryHash.slice(0,20)}…</span>
                            <CopyBtn text={result.memoryHash} />
                          </div>
                        )}
                        {/* Proof */}
                        {result.proof && (
                          <div className="flex items-center gap-2.5">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#14F195]/40 w-16">Proof</span>
                            <span className="font-mono text-[11px] text-[#14F195]/50">{result.proof}</span>
                            <CopyBtn text={result.proof} />
                          </div>
                        )}
                        {/* Data */}
                        {result.data !== undefined && result.data !== null && (
                          <div className="mt-3 pt-3 border-t border-white/[0.04]">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/15 block mb-2">Resposta</span>
                            <pre className="font-mono text-[11px] text-[#14F195]/60 leading-relaxed overflow-x-auto max-h-36 overflow-y-auto">
                              {JSON.stringify(result.data, null, 2).slice(0, 600)}
                            </pre>
                          </div>
                        )}
                        <div className="font-mono text-[11px] text-[#14F195]/50 flex items-center gap-1.5 pt-1">
                          <Check className="w-3.5 h-3.5" />
                          {result.duration}ms · {result.payment.amountSol} SOL
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Feature columns */}
          <div className="grid sm:grid-cols-3 gap-4 mb-14">
            {[
              { icon: <Zap className="w-5 h-5" />, color: '#F59E0B', title: 'Pagamento em SOL', desc: 'Transferência direta na rede Solana. Sem intermediários, sem custódia.' },
              { icon: <Brain className="w-5 h-5" />, color: '#9945FF', title: 'Memória Verificável', desc: 'Cada resposta salva com hash SHA-256 imutável. Recuperável por qualquer IA.' },
              { icon: <Shield className="w-5 h-5" />, color: '#14F195', title: 'Prova On-Chain', desc: 'Hash ancorado na Solana. Qualquer agente pode verificar a origem e integridade.' },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} className="rounded-2xl bg-white/[0.015] border border-white/[0.04] p-6 hover:border-white/[0.08] transition-all group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${color}12`, color }}>
                  {icon}
                </div>
                <h3 className="text-[13px] font-bold text-white/80 mb-2">{title}</h3>
                <p className="text-[11px] text-white/35 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison — neutral, informative */}
          <div className="mb-14">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20 mb-6 text-center">
              Comparação de Funcionalidades
            </p>
            <div className="rounded-2xl border border-white/[0.04] overflow-hidden">
              <div className="grid grid-cols-3 border-b border-white/[0.04] bg-white/[0.015]">
                <div className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Recurso</div>
                <div className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/40 border-l border-white/[0.04]">Pay.sh</div>
                <div className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest border-l border-white/[0.04]"
                  style={{ background: 'linear-gradient(90deg,rgba(153,69,255,0.08),transparent)', color: '#9945FF' }}>
                  CONGCHAIN
                </div>
              </div>
              {[
                ['Pagamento por API em SOL',       true,  true ],
                ['Uma linha de código',             true,  true ],
                ['Sem criação de conta',            true,  true ],
                ['Resultado salvo como memória',    false, true ],
                ['Hash verificável SHA-256',        false, true ],
                ['Ancoragem on-chain Solana',       false, true ],
                ['Agentes com inteligência real',   false, true ],
                ['Dashboard ao vivo (Office)',      false, true ],
                ['Cross-model — 8 modelos de IA',  false, true ],
                ['Catálogo de APIs Solana-native',  false, true ],
              ].map(([feature, paysh, cong]) => (
                <div key={String(feature)} className="grid grid-cols-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.01] transition-colors">
                  <div className="px-5 py-3 text-[12px] text-white/45">{String(feature)}</div>
                  <div className="px-5 py-3 border-l border-white/[0.03] flex items-center">
                    {paysh
                      ? <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white/50" /></div>
                      : <div className="w-4 h-px bg-white/10" />}
                  </div>
                  <div className="px-5 py-3 border-l border-white/[0.03] flex items-center"
                    style={{ background: cong && !paysh ? 'rgba(153,69,255,0.04)' : 'transparent' }}>
                    {cong
                      ? <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(153,69,255,0.2)' }}>
                          <Check className="w-2.5 h-2.5" style={{ color: '#9945FF' }} />
                        </div>
                      : <div className="w-4 h-px bg-white/10" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Catalog */}
          <div className="mb-14">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/20 mb-6 text-center">
              APIs Suportadas
            </p>
            {CATEGORIES.map(cat => (
              <div key={cat} className="mb-6">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/15 mb-3 px-1">{cat}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {API_CATALOG.filter(a => a.cat === cat).map(api => (
                    <div key={api.name}
                      className="group flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08] hover:bg-white/[0.025] transition-all cursor-default">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: api.color }} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white/65 truncate">{api.name}</div>
                        <div className="text-[9px] text-white/25 mt-0.5 font-mono">{api.cost}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] py-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L10.5 3.5V8.5L6 11L1.5 8.5V3.5L6 1Z" fill="white" fillOpacity="0.95"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold text-white/30 tracking-wider uppercase">CONGCHAIN</span>
            </div>
            <a href="/" className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 transition-colors">
              Voltar ao Chat <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
