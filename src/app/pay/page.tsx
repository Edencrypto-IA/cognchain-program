'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: string; name: string; description: string;
  priceSol: number; priceUsd: string; model: string;
  category: string; example: string;
  inputs: { key: string; label: string; placeholder: string; required: boolean }[];
}

interface PurchaseResult {
  success: boolean; analysis: string;
  service: { id: string; name: string };
  payment: { txHash: string; simulated: boolean; amountSol: number; explorerUrl?: string };
  memoryHash: string; proof: string; duration: number; steps: string[];
}

interface Stats { totalPurchases: number; totalSolCollected: number; }

// ─── Design tokens (CSS vars) ─────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  :root {
    --bg:#050608; --bg-elev:#0b0d12; --bg-card:#0f1218;
    --line:rgba(255,255,255,0.06); --line2:rgba(255,255,255,0.10); --line3:rgba(255,255,255,0.18);
    --t:#f5f6fa; --t2:#a8acb8; --t3:#6b6f7c; --t4:#3f434e;
    --pu:#b794ff; --or:#ff9e3d; --gr:#3ddb88; --cy:#5ce3ff; --go:#f5c952;
  }
  .mono { font-family:'JetBrains Mono',ui-monospace,monospace !important; }
  .serif { font-family:'Instrument Serif',Georgia,serif !important; font-style:italic; font-weight:400; }
  @keyframes blink  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes marquee{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes mFade  { from{opacity:0} to{opacity:1} }
  @keyframes mSlide { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes glow   { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
`;

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_HEX: Record<string, string> = {
  Trade:'#ff9e3d', DeFi:'#3ddb88', 'On-Chain':'#b794ff',
  Pesquisa:'#4285F4', Sentimento:'#5ce3ff', Segurança:'#FF6B35',
};

const MODEL_LABEL: Record<string, string> = {
  nvidia:'Llama 3.3', glm:'GLM-4.7', minimax:'MiniMax',
  qwen:'Qwen3', gpt:'GPT-4o', claude:'Claude',
};

// ─── Small components ─────────────────────────────────────────────────────────

function Dot({ c }: { c: string }) {
  return <span style={{ width:10,height:10,borderRadius:'50%',background:c,display:'inline-block' }} />;
}
function Spinner() {
  return <span style={{ width:12,height:12,border:'2px solid rgba(183,148,255,0.3)',borderTopColor:'#b794ff',borderRadius:'50%',display:'inline-block',animation:'spin 0.7s linear infinite' }} />;
}
function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs><linearGradient id="ccLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7c5cff"/><stop offset="100%" stopColor="#3ddb88"/></linearGradient></defs>
      <circle cx="12" cy="12" r="10" stroke="url(#ccLg)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="3.5" fill="url(#ccLg)"/>
    </svg>
  );
}
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).catch(()=>{}); setOk(true); setTimeout(()=>setOk(false),1400); }}
      style={{ background:'transparent',border:'none',color:ok?'var(--gr)':'var(--t3)',cursor:'pointer',fontSize:15,padding:0,display:'flex',alignItems:'center',justifyContent:'center',width:22,height:22,marginLeft:4 }}>
      {ok ? '✓' : '⧉'}
    </button>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({ stats }: { stats: Stats }) {
  return (
    <div style={{ borderBottom:'1px solid var(--line)',background:'rgba(5,6,8,0.8)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:50 }}>
      <div style={{ maxWidth:1240,margin:'0 auto',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:24 }}>
        <div style={{ display:'flex',alignItems:'center',gap:24 }}>
          <a href="/" className="mono" style={{ fontSize:12,color:'var(--t3)',textDecoration:'none',display:'flex',alignItems:'center',gap:6 }}>
            <span>←</span><span>Chat</span>
          </a>
          <div style={{ width:1,height:16,background:'var(--line2)' }} />
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <Logo />
            <span style={{ fontSize:14,fontWeight:600,letterSpacing:'-0.01em' }}>CONGCHAIN</span>
            <span className="mono" style={{ fontSize:9.5,color:'var(--t3)',padding:'3px 7px',border:'1px solid var(--line2)',borderRadius:4,letterSpacing:'0.12em' }}>INTELLIGENCE PAY</span>
          </div>
        </div>
        <div className="mono" style={{ display:'flex',alignItems:'center',gap:28,fontSize:11,color:'var(--t3)' }}>
          <span><span style={{ color:'var(--pu)',fontWeight:600 }}>{stats.totalPurchases}</span> análises</span>
          <span><span style={{ color:'var(--or)',fontWeight:600 }}>{stats.totalSolCollected.toFixed(3)}</span> SOL coletados</span>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ maxWidth:980,margin:'0 auto',padding:'100px 28px 40px',textAlign:'center',position:'relative' }}>
      <div className="mono" style={{ fontSize:11,color:'var(--t3)',letterSpacing:'0.25em',marginBottom:28,display:'flex',alignItems:'center',justifyContent:'center',gap:10 }}>
        <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--pu)',display:'inline-block',animation:'glow 2s ease-in-out infinite' }} />
        INTELIGÊNCIA VERIFICÁVEL COM SOL
      </div>

      <h1 style={{ fontSize:'clamp(52px,8.5vw,108px)',lineHeight:0.92,fontWeight:600,letterSpacing:'-0.045em',margin:0 }}>
        Compre análises de IA.<br />
        <span style={{ background:'linear-gradient(95deg,#b794ff 0%,#7c5cff 35%,#5ce3ff 70%,#3ddb88 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>
          Pague em <span className="serif">SOL.</span>
        </span>
      </h1>

      <p style={{ fontSize:18,color:'var(--t2)',lineHeight:1.5,margin:'32px auto 0',maxWidth:540 }}>
        Sem conta. Sem assinatura. Sem cartão de crédito.<br />
        <span style={{ color:'var(--t)' }}>Dados reais + IA + prova na blockchain.</span>
      </p>

      {/* Pay.sh comparison strip */}
      <div style={{ display:'flex',justifyContent:'center',alignItems:'stretch',gap:0,margin:'44px auto 0',maxWidth:460,border:'1px solid var(--line)',borderRadius:12,overflow:'hidden' }}>
        <div style={{ flex:1,padding:'16px 20px',textAlign:'center' }}>
          <div className="mono" style={{ fontSize:9.5,color:'var(--t3)',letterSpacing:'0.18em',marginBottom:6 }}>PAY.SH</div>
          <div style={{ fontSize:12.5,color:'var(--t2)' }}>paga · recebe dados</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',color:'var(--t4)',fontSize:18,padding:'0 6px',borderLeft:'1px solid var(--line)',borderRight:'1px solid var(--line)' }}>›</div>
        <div style={{ flex:1,padding:'16px 20px',textAlign:'center',background:'linear-gradient(180deg,rgba(124,92,255,0.06),transparent)' }}>
          <div className="mono" style={{ fontSize:9.5,color:'var(--pu)',letterSpacing:'0.18em',marginBottom:6,fontWeight:700 }}>CONGCHAIN PAY</div>
          <div style={{ fontSize:12.5,color:'var(--t)' }}>
            paga · recebe · <span style={{ color:'var(--gr)' }}>salva</span> · <span style={{ color:'var(--pu)' }}>verifica</span>
          </div>
        </div>
      </div>

      {/* CLI chip */}
      <div style={{ display:'inline-flex',alignItems:'center',gap:14,padding:'12px 18px',marginTop:32,background:'var(--bg-elev)',border:'1px solid var(--line2)',borderRadius:10 }}>
        <span className="mono" style={{ color:'var(--gr)',fontSize:13,flexShrink:0 }}>$</span>
        <span className="mono" style={{ fontSize:13,color:'var(--t)' }}>
          npx congchain pay <span style={{ color:'var(--pu)' }}>market-signal</span>
        </span>
        <CopyBtn text="npx congchain pay market-signal" />
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <section style={{ maxWidth:1080,margin:'60px auto 0',padding:'0 28px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
      {[
        { n: stats.totalPurchases,                        l:'ANÁLISES VENDIDAS',   c:'var(--pu)' },
        { n: `${stats.totalSolCollected.toFixed(3)} SOL`, l:'SOL COLETADOS',       c:'var(--or)' },
        { n: '5 fontes',                                  l:'ROUTER DE PREÇOS',    c:'var(--gr)' },
      ].map(({ n, l, c }) => (
        <div key={l} style={{ background:'linear-gradient(180deg,var(--bg-elev),var(--bg-card))',border:'1px solid var(--line)',borderRadius:14,padding:'32px 28px',textAlign:'center',position:'relative',overflow:'hidden' }}>
          <div style={{ position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',width:'60%',height:1,background:`linear-gradient(90deg,transparent,${c},transparent)`,opacity:0.5 }} />
          <div className="mono" style={{ fontSize:34,fontWeight:700,color:c,letterSpacing:'-0.02em',lineHeight:1,marginBottom:12 }}>{n}</div>
          <div className="mono" style={{ fontSize:10,color:'var(--t3)',letterSpacing:'0.2em' }}>{l}</div>
        </div>
      ))}
    </section>
  );
}

// ─── Live Terminal ────────────────────────────────────────────────────────────

const SCRIPTS = [
  {
    label: 'market-signal', color: '#ff9e3d', price: '0.005 SOL',
    lines: [
      { t:0,    k:'cmd',  v:'$ congchain pay market-signal --tokens SOL,BONK,PENGU' },
      { t:500,  k:'info', v:'⚡ Pagamento: 0.005 SOL → CONGCHAIN vault' },
      { t:1100, k:'ok',   v:'  TX: 3xKmB7pQ9r... · confirmado em 89ms' },
      { t:1700, k:'info', v:'[1/4] Binance + Bybit + OKX + CoinGecko consultados...' },
      { t:2400, k:'ok',   v:'  SOL: $148.23 (+4.2%) · 3/5 fontes · mediana' },
      { t:2900, k:'info', v:'[2/4] NVIDIA Llama 3.3 70B processando...' },
      { t:3600, k:'info', v:'[3/4] Gerando sinal de trade...' },
      { t:4300, k:'',     v:'' },
      { t:4500, k:'res',  v:'▶ SINAL: COMPRA | Confiança: 87%' },
      { t:5000, k:'dim',  v:'  Entrada: $145–149 · Stop: $139.50 · Target: $158' },
      { t:5500, k:'info', v:'[4/4] Salvando memória verificável na Solana...' },
      { t:6100, k:'ok',   v:'◆ Hash: a3f9b2c1d7e8... · SHA-256 · on-chain ✓' },
    ],
  },
  {
    label: 'defi-yield', color: '#3ddb88', price: '0.008 SOL',
    lines: [
      { t:0,    k:'cmd',  v:'$ congchain pay defi-yield --chain solana' },
      { t:500,  k:'info', v:'⚡ Pagamento: 0.008 SOL → confirmado · 71ms' },
      { t:1100, k:'info', v:'[1/3] DeFiLlama yields.llama.fi/pools...' },
      { t:1800, k:'ok',   v:'  23 protocolos · TVL $8.41B · 12 pools Solana' },
      { t:2400, k:'info', v:'[2/3] GLM-4.7 Flash analisando...' },
      { t:3200, k:'info', v:'[3/3] Ranking risco/retorno...' },
      { t:3800, k:'',     v:'' },
      { t:4000, k:'res',  v:'▶ TOP YIELDS SOLANA' },
      { t:4500, k:'dim',  v:'  Kamino USDC/SOL: 34.2% APY · TVL $89M' },
      { t:5000, k:'dim',  v:'  Meteora JitoSOL: 28.7% APY · IL mínimo' },
      { t:5500, k:'dim',  v:'  Raydium USDC/USDT: 18.4% · stablecoin' },
      { t:6000, k:'ok',   v:'◆ Memória ancorada · Hash: c8d2e1f3... ✓' },
    ],
  },
];

function LiveTerminal() {
  const [idx, setIdx] = useState(0);
  const [lines, setLines] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const play = useCallback((i: number) => {
    clearAll(); setLines(0);
    const sc = SCRIPTS[i];
    sc.lines.forEach((ln, li) => {
      const t = setTimeout(() => setLines(l => l + 1), ln.t);
      timers.current.push(t);
    });
    const last = sc.lines[sc.lines.length - 1].t + 2500;
    const adv = setTimeout(() => { const nx = (i+1) % SCRIPTS.length; setIdx(nx); play(nx); }, last);
    timers.current.push(adv);
  }, []);

  useEffect(() => { play(0); return clearAll; }, [play]);

  const sc = SCRIPTS[idx];
  const kColor = (k: string) => k==='ok'?'var(--gr)':k==='res'?'var(--pu)':k==='cmd'?'var(--t)':k==='dim'?'var(--t2)':'var(--t3)';

  return (
    <section style={{ maxWidth:1080,margin:'60px auto 0',padding:'0 28px' }}>
      <div style={{ background:'var(--bg-elev)',border:'1px solid var(--line2)',borderRadius:14,overflow:'hidden',boxShadow:'0 24px 60px -20px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.02) inset' }}>
        {/* Title bar */}
        <div style={{ padding:'12px 16px',borderBottom:'1px solid var(--line)',display:'flex',alignItems:'center',gap:10,background:'rgba(0,0,0,0.2)' }}>
          <div style={{ display:'flex',gap:6 }}><Dot c="#ff5f56"/><Dot c="#ffbd2e"/><Dot c="#27c93f"/></div>
          <span className="mono" style={{ fontSize:11.5,color:'var(--t3)',marginLeft:8 }}>congchain pay — terminal</span>
          <div style={{ flex:1 }} />
          <span className="mono" style={{ fontSize:9.5,padding:'2px 8px',borderRadius:4,border:'1px solid var(--line2)',color:sc.color }}>
            {sc.label} · {sc.price}
          </span>
          <button onClick={() => { setIdx(0); play(0); }}
            style={{ background:'transparent',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:14,padding:'0 6px' }}>↺</button>
        </div>

        {/* Lines */}
        <div className="mono" style={{ padding:'20px 24px',minHeight:220,fontSize:13,lineHeight:1.75 }}>
          {sc.lines.slice(0, lines).map((ln, i) => (
            <div key={`${idx}-${i}`} style={{ color: kColor(ln.k), animation:'fadeUp 0.15s ease-out' }}>
              {ln.v || <span>&nbsp;</span>}
            </div>
          ))}
          {lines < sc.lines.length && (
            <span style={{ display:'inline-block',width:7,height:14,background:'var(--gr)',verticalAlign:'middle',animation:'blink 1s infinite' }} />
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

const TONE: Record<string, { bg:string; border:string; glow:string }> = {
  '#ff9e3d': { bg:'rgba(255,158,61,0.04)',  border:'rgba(255,158,61,0.22)',  glow:'rgba(255,158,61,0.14)' },
  '#3ddb88': { bg:'rgba(61,219,136,0.04)',  border:'rgba(61,219,136,0.22)',  glow:'rgba(61,219,136,0.14)' },
  '#b794ff': { bg:'rgba(183,148,255,0.04)', border:'rgba(183,148,255,0.22)', glow:'rgba(183,148,255,0.14)' },
  '#4285F4': { bg:'rgba(66,133,244,0.04)',  border:'rgba(66,133,244,0.22)',  glow:'rgba(66,133,244,0.14)' },
  '#5ce3ff': { bg:'rgba(92,227,255,0.04)',  border:'rgba(92,227,255,0.22)',  glow:'rgba(92,227,255,0.14)' },
  '#FF6B35': { bg:'rgba(255,107,53,0.04)',  border:'rgba(255,107,53,0.22)',  glow:'rgba(255,107,53,0.14)' },
};

function ServiceCard({ svc, onSelect }: { svc: Service; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const hex = CAT_HEX[svc.category] ?? '#b794ff';
  const tone = TONE[hex] ?? TONE['#b794ff'];

  return (
    <article onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background:hover?tone.bg:'var(--bg-card)',border:'1px solid '+(hover?tone.border:'var(--line)'),borderRadius:12,padding:20,cursor:'pointer',transition:'all 0.2s',transform:hover?'translateY(-2px)':'none',boxShadow:hover?`0 16px 40px -10px ${tone.glow}`:'none' }}>

      {/* Header */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14 }}>
        <div>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
            <span className="mono" style={{ fontSize:9,fontWeight:700,letterSpacing:'0.2em',padding:'2px 7px',borderRadius:5,background:`${hex}18`,color:hex,border:`1px solid ${hex}28` }}>
              {svc.category.toUpperCase()}
            </span>
            <span className="mono" style={{ fontSize:9.5,color:'var(--t3)' }}>{MODEL_LABEL[svc.model] ?? svc.model}</span>
          </div>
          <h3 style={{ fontSize:15,fontWeight:600,margin:0,color:'var(--t)',letterSpacing:'-0.01em' }}>{svc.name}</h3>
        </div>
        <div style={{ textAlign:'right',flexShrink:0,marginLeft:12 }}>
          <div className="mono" style={{ fontSize:18,fontWeight:700,color:hex,lineHeight:1 }}>{svc.priceSol} SOL</div>
          <div className="mono" style={{ fontSize:10,color:'var(--t3)',marginTop:3 }}>{svc.priceUsd}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize:12.5,color:'var(--t2)',lineHeight:1.55,margin:'0 0 14px',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' }}>
        {svc.description}
      </p>

      {/* Example */}
      <div style={{ padding:'10px 12px',borderRadius:8,background:'rgba(255,255,255,0.02)',border:'1px solid var(--line)' }}>
        <div className="mono" style={{ fontSize:9,color:'var(--t4)',letterSpacing:'0.2em',marginBottom:5 }}>EXEMPLO</div>
        <p className="mono" style={{ fontSize:11,color:'var(--t3)',lineHeight:1.5,margin:0,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',fontStyle:'italic' }}>
          {svc.example}
        </p>
      </div>

      {/* CTA */}
      <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:14,color:hex }}>
        <span style={{ fontSize:10 }}>▶</span>
        <span className="mono" style={{ fontSize:11 }}>Comprar análise</span>
      </div>
    </article>
  );
}

// ─── Services Grid ────────────────────────────────────────────────────────────

function ServicesSection({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  const [filter, setFilter] = useState('Todos');
  const cats = [...new Set(services.map(s => s.category))];
  const visible = filter === 'Todos' ? services : services.filter(s => s.category === filter);

  return (
    <section style={{ maxWidth:1240,margin:'100px auto 0',padding:'0 28px' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:32,flexWrap:'wrap',gap:12 }}>
        <h2 className="mono" style={{ fontSize:12,color:'var(--t3)',letterSpacing:'0.22em',fontWeight:500,margin:0 }}>
          SERVIÇOS DE INTELIGÊNCIA · PAGUE EM SOL
        </h2>
        <span className="mono" style={{ fontSize:11,color:'var(--t4)' }}>{services.length} serviços · dados ao vivo</span>
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:28 }}>
        {['Todos', ...cats].map(f => {
          const active = filter === f;
          const hex = f === 'Todos' ? '#b794ff' : (CAT_HEX[f] ?? '#b794ff');
          return (
            <button key={f} onClick={() => setFilter(f)} className="mono"
              style={{ background:active?`${hex}18`:'transparent',border:`1px solid ${active?hex+'40':'var(--line2)'}`,color:active?hex:'var(--t3)',padding:'5px 14px',borderRadius:100,fontSize:10.5,fontWeight:active?700:500,cursor:'pointer',letterSpacing:'0.12em',transition:'all 0.15s',boxShadow:active?`0 0 16px ${hex}18`:'none' }}>
              {f.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14 }}>
        {visible.map(s => <ServiceCard key={s.id} svc={s} onSelect={() => onSelect(s)} />)}
      </div>
    </section>
  );
}

// ─── Brand Marquee ────────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  { name:'Binance',    color:'#f5c952' },
  { name:'Bybit',      color:'#ff9e3d' },
  { name:'OKX',        color:'#f5f6fa' },
  { name:'CoinGecko',  color:'#8dc63f' },
  { name:'Crypto.com', color:'#4285F4' },
  { name:'DeFiLlama',  color:'#5ce3ff' },
  { name:'Helius',     color:'#9945FF' },
  { name:'Llama 3.3',  color:'#76b900' },
  { name:'GLM-4.7',    color:'#5ce3ff' },
  { name:'MiniMax',    color:'#ff6b9d' },
  { name:'Qwen3 80B',  color:'#a855f7' },
  { name:'GPT-4o',     color:'#10a37f' },
  { name:'Claude',     color:'#D97757' },
];

function BrandMarquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <section style={{ margin:'80px 0 0',padding:'28px 0',borderTop:'1px solid var(--line)',borderBottom:'1px solid var(--line)',background:'linear-gradient(180deg,transparent,rgba(124,92,255,0.03),transparent)',overflow:'hidden',position:'relative' }}>
      <div className="mono" style={{ position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',fontSize:9.5,color:'var(--t4)',letterSpacing:'0.25em',background:'var(--bg)',padding:'0 12px',whiteSpace:'nowrap' }}>
        5 EXCHANGES · 8 MODELOS DE IA · 1 PAGAMENTO SOL
      </div>
      <div style={{ display:'flex',gap:40,animation:'marquee 45s linear infinite',width:'fit-content',marginTop:16 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 20px',background:'var(--bg-card)',border:'1px solid var(--line)',borderRadius:100,flexShrink:0 }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:it.color,display:'inline-block',boxShadow:`0 0 8px ${it.color}60` }} />
            <span style={{ fontSize:13,fontWeight:500,color:'var(--t)',whiteSpace:'nowrap' }}>{it.name}</span>
          </div>
        ))}
      </div>
      <div style={{ position:'absolute',top:0,left:0,bottom:0,width:120,background:'linear-gradient(90deg,var(--bg),transparent)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',top:0,right:0,bottom:0,width:120,background:'linear-gradient(270deg,var(--bg),transparent)',pointerEvents:'none' }} />
    </section>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    { k:'Paga por serviço em SOL',                  ps:true,  cc:true  },
    { k:'Sem conta / sem cadastro',                 ps:true,  cc:true  },
    { k:'Dados de mercado em tempo real',           ps:false, cc:true  },
    { k:'Router 5 exchanges (mediana de preço)',    ps:false, cc:true  },
    { k:'Análise com IA integrada',                 ps:false, cc:true  },
    { k:'Hash SHA-256 verificável',                 ps:false, cc:true  },
    { k:'Resultado ancorado na Solana blockchain',  ps:false, cc:true  },
    { k:'Memória salva entre sessões de IA',        ps:false, cc:true  },
    { k:'Visível no Agent Office ao vivo',          ps:false, cc:true  },
    { k:'Suporte a 8 modelos de IA',               ps:false, cc:true  },
  ];
  return (
    <section style={{ maxWidth:860,margin:'80px auto 0',padding:'0 28px' }}>
      <h2 className="mono" style={{ fontSize:11,color:'var(--t3)',letterSpacing:'0.25em',textAlign:'center',marginBottom:24 }}>
        CONGCHAIN PAY VS PAY.SH — COMPARAÇÃO
      </h2>
      <div style={{ background:'var(--bg-elev)',border:'1px solid var(--line)',borderRadius:14,overflow:'hidden' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 130px 130px',padding:'14px 24px',borderBottom:'1px solid var(--line)',background:'rgba(0,0,0,0.2)' }}>
          <div className="mono" style={{ fontSize:11,color:'var(--t3)' }}>Funcionalidade</div>
          <div className="mono" style={{ fontSize:11,color:'var(--t3)',textAlign:'center' }}>Pay.sh</div>
          <div className="mono" style={{ fontSize:11,color:'var(--pu)',textAlign:'center',fontWeight:700 }}>CONGCHAIN</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display:'grid',gridTemplateColumns:'1fr 130px 130px',padding:'13px 24px',borderBottom:i<rows.length-1?'1px solid var(--line)':'none',transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.015)')}
            onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
            <div style={{ fontSize:13.5,color:'var(--t)' }}>{r.k}</div>
            <div style={{ textAlign:'center' }}>
              {r.ps ? <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7L6 11L12 3" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
                    : <span style={{ color:'var(--t4)',fontSize:14 }}>—</span>}
            </div>
            <div style={{ textAlign:'center' }}>
              {r.cc ? <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7L6 11L12 3" stroke="var(--gr)" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
                    : <span style={{ color:'var(--t4)',fontSize:14 }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Pillars ──────────────────────────────────────────────────────────────────

function Pillars() {
  return (
    <section style={{ maxWidth:1080,margin:'80px auto 0',padding:'0 28px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16 }}>
      {[
        { title:'Paga',   color:'var(--or)', desc:'Micropagamento SOL instantâneo. Sem conta, sem assinatura, sem cartão.',
          icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14H11L10 22L19 10H12L13 2Z" stroke="var(--or)" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
        { title:'Analisa', color:'var(--pu)', desc:'5 exchanges consultadas em paralelo. Mediana de preço. IA especializada com dados reais.',
          icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--pu)" strokeWidth="1.8"/><path d="M8 12h8M12 8v8" stroke="var(--pu)" strokeWidth="1.8" strokeLinecap="round"/></svg> },
        { title:'Prova',  color:'var(--gr)', desc:'Resultado salvo com SHA-256 ancorado na Solana. Qualquer IA pode verificar a origem.',
          icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 6V12C4 16.5 7.5 20 12 21C16.5 20 20 16.5 20 12V6L12 3Z" stroke="var(--gr)" strokeWidth="1.8" strokeLinejoin="round"/></svg> },
      ].map(it => (
        <div key={it.title} style={{ background:'var(--bg-card)',border:'1px solid var(--line)',borderRadius:14,padding:'32px 28px',textAlign:'center',transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--line2)'; e.currentTarget.style.transform='translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--line)'; e.currentTarget.style.transform='translateY(0)'; }}>
          <div style={{ width:44,height:44,borderRadius:11,background:'var(--bg-elev)',border:'1px solid var(--line2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>{it.icon}</div>
          <h3 style={{ fontSize:18,fontWeight:600,margin:'0 0 8px',color:it.color,letterSpacing:'-0.01em' }}>{it.title}</h3>
          <p style={{ fontSize:13,color:'var(--t2)',margin:0,lineHeight:1.55 }}>{it.desc}</p>
        </div>
      ))}
    </section>
  );
}

// ─── Purchase Modal ───────────────────────────────────────────────────────────

function PurchaseModal({ svc, onClose }: { svc: Service | null; onClose: () => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form'|'running'|'done'>('form');
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svc) return;
    setInputs({}); setStep('form'); setResult(null); setLogs([]); setError('');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [svc, onClose]);

  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [logs]);

  if (!svc) return null;
  const hex = CAT_HEX[svc.category] ?? '#b794ff';

  const handlePurchase = async () => {
    setStep('running'); setLogs([]); setError('');
    try {
      const res = await fetch('/api/pay/intelligence', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ serviceId: svc.id, inputs }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro'); setStep('form'); return; }
      data.steps?.forEach((s: string, i: number) => setTimeout(() => setLogs(l => [...l, s]), i * 600));
      setTimeout(() => { setResult(data); setStep('done'); }, (data.steps?.length ?? 3) * 600 + 400);
    } catch (e) { setError(String(e)); setStep('form'); }
  };

  return (
    <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24,animation:'mFade 0.2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg-elev)',border:'1px solid var(--line2)',borderRadius:16,width:'100%',maxWidth:520,animation:'mSlide 0.25s ease',boxShadow:'0 40px 100px -20px rgba(0,0,0,0.85)' }}>

        {/* Header */}
        <div style={{ padding:'18px 24px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <span className="mono" style={{ fontSize:9,fontWeight:700,letterSpacing:'0.2em',padding:'3px 8px',borderRadius:5,background:`${hex}18`,color:hex,border:`1px solid ${hex}28` }}>{svc.category.toUpperCase()}</span>
            <span style={{ fontSize:14,fontWeight:600,color:'var(--t)' }}>{svc.name}</span>
          </div>
          <button onClick={onClose} style={{ background:'transparent',border:'none',color:'var(--t3)',fontSize:22,cursor:'pointer',width:28,height:28,padding:0,lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:24 }}>
          {step === 'form' && (
            <>
              <p style={{ fontSize:13,color:'var(--t2)',lineHeight:1.55,marginBottom:20 }}>{svc.description}</p>

              {svc.inputs.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  {svc.inputs.map(inp => (
                    <div key={inp.key} style={{ marginBottom:12 }}>
                      <label className="mono" style={{ display:'block',fontSize:9.5,color:'var(--t3)',letterSpacing:'0.18em',marginBottom:7 }}>{inp.label.toUpperCase()}{inp.required?' *':''}</label>
                      <input value={inputs[inp.key]??''} onChange={e => setInputs(p=>({...p,[inp.key]:e.target.value}))}
                        placeholder={inp.placeholder}
                        style={{ width:'100%',background:'var(--bg-card)',border:'1px solid var(--line2)',color:'var(--t)',padding:'11px 14px',borderRadius:9,fontSize:13,outline:'none',transition:'border 0.15s',boxSizing:'border-box' }}
                        onFocus={e => (e.target.style.borderColor='var(--line3)')}
                        onBlur={e => (e.target.style.borderColor='var(--line2)')} />
                    </div>
                  ))}
                </div>
              )}

              {/* Price box */}
              <div style={{ padding:'14px 18px',marginBottom:20,borderRadius:10,background:`${hex}08`,border:`1px solid ${hex}22` }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:12.5,color:'var(--t2)' }}>Você paga</span>
                  <div style={{ textAlign:'right' }}>
                    <div className="mono" style={{ fontSize:22,fontWeight:700,color:hex,lineHeight:1 }}>{svc.priceSol} SOL</div>
                    <div className="mono" style={{ fontSize:10,color:'var(--t3)',marginTop:3 }}>{svc.priceUsd} · sem assinatura</div>
                  </div>
                </div>
                <div className="mono" style={{ marginTop:10,paddingTop:10,borderTop:'1px solid var(--line)',fontSize:11,color:'var(--t3)',display:'flex',alignItems:'center',gap:6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 3L4 6V12C4 16.5 7.5 20 12 21C16.5 20 20 16.5 20 12V6L12 3Z" stroke="var(--gr)" strokeWidth="1.8"/></svg>
                  Resultado salvo como memória verificável na Solana
                </div>
              </div>

              {error && <p className="mono" style={{ fontSize:11,color:'#ff6b6b',marginBottom:12 }}>{error}</p>}

              <button onClick={handlePurchase}
                style={{ width:'100%',background:`linear-gradient(180deg,${hex}cc,${hex}88)`,border:`1px solid ${hex}60`,color:'#000',padding:'13px',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                ⚡ Comprar por {svc.priceSol} SOL
              </button>
            </>
          )}

          {step === 'running' && (
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
                <Spinner />
                <span style={{ fontSize:13,color:'var(--t2)' }}>Consultando exchanges e processando com IA...</span>
              </div>
              <div ref={logsRef} className="mono" style={{ fontSize:11.5,lineHeight:1.8,maxHeight:160,overflowY:'auto' }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ color:i===0?'var(--pu)':i===logs.length-1?'var(--gr)':'var(--t3)',animation:'fadeUp 0.2s ease' }}>→ {l}</div>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div>
              <div style={{ padding:'14px 16px',background:'var(--bg-card)',border:'1px solid var(--line)',borderRadius:10,maxHeight:220,overflowY:'auto',fontSize:13,color:'var(--t2)',lineHeight:1.65,whiteSpace:'pre-wrap',marginBottom:16 }}>
                {result.analysis}
              </div>
              <div className="mono" style={{ fontSize:10.5,lineHeight:2,borderTop:'1px solid var(--line)',paddingTop:12 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ color:'var(--t4)',width:14 }}>TX</span>
                  <span style={{ color:'var(--t3)' }}>{result.payment.txHash.slice(0,22)}…</span>
                  {result.payment.simulated && <span style={{ fontSize:9,color:'var(--t4)',background:'var(--bg-elev)',padding:'1px 6px',borderRadius:4 }}>simulado</span>}
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <span style={{ color:'var(--t4)',width:14 }}>◆</span>
                  <span style={{ color:'var(--gr)' }}>{result.memoryHash.slice(0,22)}… · on-chain ✓</span>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8,justifyContent:'space-between' }}>
                  <span style={{ color:'var(--gr)' }}>✓ {result.duration}ms · {result.payment.amountSol} SOL</span>
                  <button onClick={onClose} style={{ background:'var(--bg-card)',border:'1px solid var(--line2)',color:'var(--t2)',padding:'6px 14px',borderRadius:7,fontSize:12,cursor:'pointer' }}>Fechar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ padding:'60px 28px 40px',marginTop:100,textAlign:'center' }}>
      <div className="mono" style={{ display:'inline-flex',alignItems:'center',gap:10,fontSize:11,color:'var(--t4)',letterSpacing:'0.15em' }}>
        <span>CONGCHAIN</span><span>·</span>
        <span>Verifiable AI Memory Layer</span><span>·</span>
        <span style={{ display:'inline-flex',alignItems:'center',gap:6 }}>
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
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<Stats>({ totalPurchases: 0, totalSolCollected: 0 });
  const [selected, setSelected] = useState<Service | null>(null);

  useEffect(() => {
    fetch('/api/pay/intelligence').then(r => r.json()).then(d => {
      setServices(d.services ?? []);
      setStats(d.stats ?? { totalPurchases: 0, totalSolCollected: 0 });
    }).catch(() => {});
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        background:'radial-gradient(1200px 700px at 50% -200px,rgba(124,92,255,0.10),transparent 60%),radial-gradient(900px 500px at 90% 30%,rgba(255,158,61,0.04),transparent 60%),radial-gradient(700px 400px at 10% 60%,rgba(61,219,136,0.04),transparent 60%),#050608',
        minHeight:'100vh', color:'var(--t)',
        fontFamily:'"Geist",system-ui,-apple-system,sans-serif',
        WebkitFontSmoothing:'antialiased',
      }}>
        <TopBar stats={stats} />
        <Hero />
        <StatsGrid stats={stats} />
        <LiveTerminal />
        <ServicesSection services={services} onSelect={setSelected} />
        <BrandMarquee />
        <ComparisonTable />
        <Pillars />
        <Footer />
        <PurchaseModal svc={selected} onClose={() => setSelected(null)} />
      </div>
    </>
  );
}
