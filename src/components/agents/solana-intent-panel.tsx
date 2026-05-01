'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  ShieldAlert, ShieldCheck, ShieldX, Clock, ArrowRightLeft,
  Send, Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2,
  Wallet,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const WalletButton = dynamic(() => import('../congchain/wallet-button'), { ssr: false });

interface SolanaIntent {
  id: string;
  type: 'swap' | 'transfer';
  description: string;
  fromToken: string;
  toToken: string | null;
  amount: number;
  amountUsd: number | null;
  simulation: string | null;
  status: string;
  txHash: string | null;
  error: string | null;
  createdAt: string;
  expiresAt: string;
  executedAt: string | null;
}

interface SimResult {
  success: boolean;
  fee: number;
  logs?: string[];
  error?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', label: 'Aguardando' },
  approved: { bg: 'bg-blue-500/10 border-blue-500/20',    text: 'text-blue-400',   label: 'Aprovado' },
  executed: { bg: 'bg-[#14F195]/10 border-[#14F195]/20',  text: 'text-[#14F195]',  label: 'Executado' },
  rejected: { bg: 'bg-white/5 border-white/[0.06]',       text: 'text-white/30',   label: 'Rejeitado' },
  expired:  { bg: 'bg-white/5 border-white/[0.06]',       text: 'text-white/25',   label: 'Expirado' },
  failed:   { bg: 'bg-red-500/10 border-red-500/20',      text: 'text-red-400',    label: 'Falhou' },
};

function timeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function IntentCard({ intent, agentId, onUpdate }: { intent: SolanaIntent; agentId: string; onUpdate: () => void }) {
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; txHash?: string; error?: string } | null>(null);
  const [remaining, setRemaining] = useState(() => timeRemaining(intent.expiresAt));

  useEffect(() => {
    if (intent.status !== 'pending') return;
    const t = setInterval(() => setRemaining(timeRemaining(intent.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [intent.expiresAt, intent.status]);

  async function act(action: 'approve' | 'reject') {
    setActing(action);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/intents/${intent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setResult({ ok: res.ok && (action === 'reject' || data.ok), txHash: data.txHash, error: data.error });
      if (res.ok) setTimeout(() => onUpdate(), 1500);
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setActing(null);
    }
  }

  const sim: SimResult | null = intent.simulation ? JSON.parse(intent.simulation) : null;
  const style = STATUS_STYLES[intent.status] || STATUS_STYLES.pending;
  const isPending = intent.status === 'pending';
  const isExpired = remaining === 'Expirado';

  return (
    <div className={`rounded-xl border p-4 transition-all ${style.bg}`}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {intent.type === 'swap' ? (
            <ArrowRightLeft className={`h-4 w-4 ${style.text}`} />
          ) : (
            <Send className={`h-4 w-4 ${style.text}`} />
          )}
          <span className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
            {intent.type === 'swap' ? 'Swap' : 'Transfer'} · {style.label}
          </span>
        </div>
        {isPending && !isExpired && (
          <div className="flex items-center gap-1 text-yellow-400/70">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-mono">{remaining}</span>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-lg font-bold text-white/80">
          {intent.amount} {intent.fromToken}
        </span>
        {intent.type === 'swap' && intent.toToken && (
          <>
            <ArrowRightLeft className="h-3.5 w-3.5 text-white/30" />
            <span className="text-sm font-semibold text-white/60">{intent.toToken}</span>
          </>
        )}
        {intent.amountUsd && (
          <span className="text-xs text-white/30">≈ ${intent.amountUsd.toFixed(2)}</span>
        )}
      </div>

      {/* Description */}
      <p className="mb-3 text-xs leading-relaxed text-white/50">{intent.description}</p>

      {/* Simulation result */}
      {sim && (
        <div className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${sim.success ? 'bg-[#14F195]/5 text-[#14F195]/70' : 'bg-red-500/5 text-red-400/70'}`}>
          {sim.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{sim.success ? `Simulação OK · taxa ~${sim.fee} lamports` : `Simulação falhou: ${sim.error}`}</span>
        </div>
      )}

      {/* TX hash after execution */}
      {intent.txHash && (
        <a
          href={`https://explorer.solana.com/tx/${intent.txHash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex items-center gap-1.5 text-[10px] font-mono text-[#9945FF]/70 hover:text-[#9945FF] transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {intent.txHash.slice(0, 20)}…
        </a>
      )}

      {/* Error */}
      {intent.error && (
        <p className="mb-3 text-[10px] text-red-400/60">{intent.error}</p>
      )}

      {/* Execution result toast */}
      {result && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-[#14F195]/5 text-[#14F195]' : 'bg-red-500/5 text-red-400'}`}>
          {result.ok
            ? result.txHash
              ? `TX confirmada: ${result.txHash.slice(0, 16)}…`
              : 'Ação aplicada.'
            : `Erro: ${result.error}`}
        </div>
      )}

      {/* Action buttons — only for pending, non-expired intents */}
      {isPending && !isExpired && !result && (
        <div className="flex gap-2">
          <button
            onClick={() => act('reject')}
            disabled={!!acting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 disabled:opacity-40"
          >
            {acting === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
            Rejeitar
          </button>
          <button
            onClick={() => act('approve')}
            disabled={!!acting || !sim?.success}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#9945FF]/80 to-[#14F195]/80 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-[#9945FF] hover:to-[#14F195] disabled:opacity-40"
            title={!sim?.success ? 'Simulação falhou — não é possível aprovar' : ''}
          >
            {acting === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {acting === 'approve' ? 'Executando…' : 'Aprovar'}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props { agentId: string }

export default function SolanaIntentPanel({ agentId }: Props) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [intents, setIntents] = useState<SolanaIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<{ sol: number; prices: { symbol: string; price: number }[] } | null>(null);

  // Fetch user wallet balance when connected
  useEffect(() => {
    if (!connected || !publicKey) { setUserBalance(null); return; }
    const fetch = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setUserBalance(lamports / LAMPORTS_PER_SOL);
      } catch { /* silent */ }
    };
    fetch();
    const t = setInterval(fetch, 15_000);
    return () => clearInterval(t);
  }, [connected, publicKey, connection]);

  const fetchIntents = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/intents`);
      const data = await res.json();
      if (data.intents) setIntents(data.intents);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [agentId]);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/solana-snapshot');
      const data = await res.json();
      if (data.wallet) setSnapshot({ sol: data.wallet.sol, prices: data.prices || [] });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchIntents();
    fetchSnapshot();
    const t = setInterval(fetchIntents, 10_000);
    return () => clearInterval(t);
  }, [fetchIntents, fetchSnapshot]);

  const pending  = intents.filter(i => i.status === 'pending');
  const history  = intents.filter(i => i.status !== 'pending');
  const solPrice = snapshot?.prices.find(p => p.symbol === 'SOL')?.price;

  return (
    <div className="space-y-4">
      {/* User wallet status */}
      {connected && publicKey ? (
        <div className="flex items-center justify-between rounded-xl border border-[#14F195]/20 bg-[#14F195]/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#14F195]/15 p-1.5">
              <Wallet className="h-4 w-4 text-[#14F195]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Sua Carteira</p>
              <p className="font-mono text-[10px] text-white/35">{publicKey.toString().slice(0, 8)}…{publicKey.toString().slice(-6)}</p>
            </div>
          </div>
          {userBalance !== null && (
            <div className="text-right">
              <p className="text-sm font-bold text-[#14F195]/80">{userBalance.toFixed(4)} SOL</p>
              {solPrice && <p className="text-[10px] text-white/30">≈ ${(userBalance * solPrice).toFixed(2)}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-white/50">Conecte sua carteira</p>
            <p className="text-[10px] text-white/25">Veja seu saldo e assine transações com Phantom ou Solflare</p>
          </div>
          <WalletButton />
        </div>
      )}

      {/* Server wallet snapshot bar */}
      {snapshot && (
        <div className="flex items-center justify-between rounded-xl border border-[#9945FF]/15 bg-[#9945FF]/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#9945FF]/15 p-1.5">
              <ShieldAlert className="h-4 w-4 text-[#9945FF]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Carteira do Agente (Devnet)</p>
              <p className="text-[10px] text-white/35">Transações exigem sua aprovação</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white/80">{snapshot.sol.toFixed(4)} SOL</p>
            {solPrice && (
              <p className="text-[10px] text-white/35">≈ ${(snapshot.sol * solPrice).toFixed(2)}</p>
            )}
          </div>
        </div>
      )}

      {/* Price ticker */}
      {snapshot && snapshot.prices.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {snapshot.prices.map(p => (
            <div key={p.symbol} className="flex-shrink-0 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
              <span className="text-[10px] font-semibold text-white/40">{p.symbol}</span>
              <p className="text-xs font-bold text-white/70">${p.price < 0.01 ? p.price.toExponential(2) : p.price.toFixed(p.price < 1 ? 4 : 2)}</p>
            </div>
          ))}
          <button onClick={fetchSnapshot} className="flex-shrink-0 flex items-center rounded-lg border border-white/[0.06] px-2 text-white/20 hover:text-white/40 transition-colors">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Pending intents */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-white/25">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Carregando intents...</span>
        </div>
      ) : pending.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              {pending.length} Intent{pending.length > 1 ? 's' : ''} Aguardando Aprovação
            </h3>
          </div>
          {pending.map(i => (
            <IntentCard key={i.id} intent={i} agentId={agentId} onUpdate={fetchIntents} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] py-10">
          <ShieldCheck className="mb-3 h-8 w-8 text-white/10" />
          <p className="text-xs text-white/25">Nenhuma transação pendente</p>
          <p className="mt-1 text-[10px] text-white/15">O agente irá propor ações quando identificar oportunidades</p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">Histórico</h3>
          {history.slice(0, 10).map(i => (
            <IntentCard key={i.id} intent={i} agentId={agentId} onUpdate={fetchIntents} />
          ))}
        </div>
      )}
    </div>
  );
}
