'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useCallback } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Wallet, LogOut, ChevronDown, Copy, ExternalLink, Check } from 'lucide-react';

export default function WalletButton() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch { /* silent */ }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
      const t = setInterval(fetchBalance, 15_000);
      return () => clearInterval(t);
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, fetchBalance]);

  function truncate(addr: string) {
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Not connected ────────────────────────────────────────────
  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/10 px-3 py-2 text-xs font-semibold text-[#9945FF] transition-all hover:bg-[#9945FF]/20 disabled:opacity-50"
      >
        <Wallet className="h-3.5 w-3.5" />
        {connecting ? 'Conectando…' : 'Conectar Carteira'}
      </button>
    );
  }

  // ── Connected ────────────────────────────────────────────────
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/8 px-3 py-2 text-xs font-semibold text-[#14F195] transition-all hover:bg-[#14F195]/15"
      >
        <div className="h-2 w-2 rounded-full bg-[#14F195] animate-pulse" />
        <span>{truncate(publicKey!.toString())}</span>
        {balance !== null && (
          <span className="text-[#14F195]/60">{balance.toFixed(3)} SOL</span>
        )}
        <ChevronDown className={`h-3 w-3 text-[#14F195]/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f0f1e] shadow-xl shadow-black/40">
            {/* Address */}
            <div className="border-b border-white/[0.06] p-4">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Carteira Conectada</p>
              <p className="break-all font-mono text-[11px] text-white/60">{publicKey!.toString()}</p>
            </div>

            {/* Balance */}
            {balance !== null && (
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/30">Saldo</p>
                <p className="mt-0.5 text-lg font-bold text-white/80">{balance.toFixed(4)} SOL</p>
                <p className="text-[10px] text-white/25">Rede: devnet</p>
              </div>
            )}

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={copyAddress}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#14F195]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar endereço'}
              </button>
              <a
                href={`https://explorer.solana.com/address/${publicKey!.toString()}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver no Explorer
              </a>
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-red-400/60 transition-colors hover:bg-red-500/5 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Desconectar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
