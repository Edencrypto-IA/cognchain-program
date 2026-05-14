'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import { Wallet, LogOut, Copy, Check, ExternalLink, ChevronDown, X, Loader2, ShieldCheck, LockKeyhole, Eye } from 'lucide-react';

const WALLET_OPTIONS = [
  {
    key: 'phantom',
    name: 'Phantom',
    description: 'Carteira Solana principal para browser e mobile.',
    installUrl: 'https://phantom.app/download',
    mobileUrl: (url: string, ref: string) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
  },
  {
    key: 'solflare',
    name: 'Solflare',
    description: 'Carteira Solana com suporte web e app mobile.',
    installUrl: 'https://solflare.com/download',
    mobileUrl: (url: string, ref: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
  },
];

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export default function WalletButton() {
  const { publicKey, connected, disconnect, connecting, wallet, wallets, select } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
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
      setPickerOpen(false);
      setConnectingWallet(null);
      setConnectError('');
      fetchBalance();
      const t = setInterval(fetchBalance, 15_000);
      return () => clearInterval(t);
    }

    setBalance(null);
  }, [connected, publicKey, fetchBalance]);

  function truncate(addr: string) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toString()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWalletFallback(option: typeof WALLET_OPTIONS[number]) {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    const ref = window.location.origin;
    window.location.href = isMobileBrowser()
      ? option.mobileUrl(currentUrl, ref)
      : option.installUrl;
  }

  async function connectWallet(option: typeof WALLET_OPTIONS[number]) {
    setConnectError('');
    setConnectingWallet(option.key);

    const candidate = wallets.find(item =>
      item.adapter.name.toLowerCase().includes(option.name.toLowerCase())
    );

    if (!candidate) {
      openWalletFallback(option);
      setConnectingWallet(null);
      return;
    }

    const readyState = candidate.adapter.readyState;
    const canConnect =
      readyState === WalletReadyState.Installed ||
      readyState === WalletReadyState.Loadable;

    if (!canConnect && !isMobileBrowser()) {
      openWalletFallback(option);
      setConnectingWallet(null);
      return;
    }

    try {
      select(candidate.adapter.name as WalletName);
      await Promise.race([
        candidate.adapter.connected ? Promise.resolve() : candidate.adapter.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('wallet_timeout')), 15_000)),
      ]);
      setPickerOpen(false);
    } catch (error) {
      if (isMobileBrowser()) {
        openWalletFallback(option);
      } else {
        setConnectError(
          error instanceof Error && error.message === 'wallet_timeout'
            ? `${option.name} abriu, mas nao concluiu a conexao. Desbloqueie a carteira e aprove a conexao.`
            : `${option.name} nao respondeu. Verifique se a extensao esta instalada e desbloqueada.`
        );
      }
    } finally {
      setConnectingWallet(null);
    }
  }

  if (!connected) {
    return (
      <>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={connecting || !!connectingWallet}
          className="inline-flex items-center gap-2 rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/10 px-3 py-2 text-xs font-semibold text-[#9945FF] transition-all hover:bg-[#9945FF]/20 disabled:opacity-50"
        >
          <Wallet className="h-3.5 w-3.5" />
          {connecting || connectingWallet ? 'Conectando...' : 'Conectar Carteira'}
        </button>

        {pickerOpen && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setPickerOpen(false)} />
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.09] bg-[#090914] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">Conectar carteira</p>
                  <p className="text-[11px] text-white/35">Escolha sua wallet Solana.</p>
                </div>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 p-3">
                <div className="rounded-2xl border border-[#14F195]/18 bg-gradient-to-br from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/8 p-3">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#14F195]/20 bg-[#14F195]/10">
                      <ShieldCheck className="h-4.5 w-4.5 text-[#14F195]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14F195]/80">Read-only first</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/42">
                        Ao conectar, a CONGCHAIN le apenas dados publicos da sua carteira. Nenhum token pode ser movido sem uma aprovacao manual na sua wallet.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {[
                      { icon: Eye, label: 'Leitura publica', text: 'Endereco e saldo publico.' },
                      { icon: LockKeyhole, label: 'Sem custodia', text: 'Suas chaves ficam na wallet.' },
                      { icon: Check, label: 'Assinatura manual', text: 'Toda acao aparece para revisar.' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/[0.055] bg-black/20 px-3 py-2">
                        <item.icon className="h-3.5 w-3.5 text-[#00D1FF]/70" />
                        <div>
                          <p className="text-[10px] font-semibold text-white/65">{item.label}</p>
                          <p className="text-[10px] text-white/28">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {WALLET_OPTIONS.map(option => {
                  const adapter = wallets.find(item =>
                    item.adapter.name.toLowerCase().includes(option.name.toLowerCase())
                  )?.adapter;
                  const busy = connectingWallet === option.key;

                  return (
                    <button
                      key={option.key}
                      onClick={() => connectWallet(option)}
                      disabled={!!connectingWallet}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-left transition-all hover:border-[#9945FF]/30 hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]">
                        {adapter?.icon ? (
                          <img src={adapter.icon} alt="" className="h-7 w-7 rounded-lg" />
                        ) : (
                          <Wallet className="h-5 w-5 text-[#9945FF]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white/75">{option.name}</p>
                        <p className="text-[11px] leading-relaxed text-white/32">{option.description}</p>
                      </div>
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#14F195]" />
                      ) : (
                        <ExternalLink className="h-4 w-4 text-white/22" />
                      )}
                    </button>
                  );
                })}

                {connectError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-300/80">
                    {connectError}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/[0.08] px-3 py-2 text-xs font-semibold text-[#14F195] transition-all hover:bg-[#14F195]/15"
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
            {wallet && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                {wallet.adapter.icon && (
                  <img src={wallet.adapter.icon} alt="" className="h-4 w-4 rounded" />
                )}
                <span className="text-[11px] font-semibold text-white/60">{wallet.adapter.name}</span>
              </div>
            )}

            <div className="border-b border-white/[0.06] p-4">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Endereco</p>
              <p className="break-all font-mono text-[11px] text-white/60">{publicKey!.toString()}</p>
            </div>

            {balance !== null && (
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/30">Saldo</p>
                <p className="mt-0.5 text-lg font-bold text-white/80">{balance.toFixed(4)} SOL</p>
              </div>
            )}

            <div className="p-2">
              <button
                onClick={copyAddress}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#14F195]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar endereco'}
              </button>
              <a
                href={`https://explorer.solana.com/address/${publicKey!.toString()}`}
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
