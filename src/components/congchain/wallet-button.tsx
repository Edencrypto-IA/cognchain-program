'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { WalletReadyState, type WalletName } from '@solana/wallet-adapter-base';
import { Wallet, LogOut, Copy, Check, ExternalLink, ChevronDown, X, Loader2, ShieldCheck, LockKeyhole, Eye, Gift, FlaskConical, Mail, UserCheck } from 'lucide-react';

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

const DEVNET_WALLET_STORAGE_KEY = 'congchain_devnet_wallet_v1';

type DevnetWalletSnapshot = {
  publicKey: string;
  secretKey: number[];
  createdAt: string;
  balance: number;
  airdropTx?: string;
};

type DevnetWalletCreatedDetail = {
  publicKey: string;
  createdAt: string;
  balance: number;
  airdropTx?: string;
  airdropStatus: 'success' | 'pending' | 'failed';
};

type EmailIdentitySession = {
  email: string;
  authLevel: 'email_local' | 'email_magic';
  verified: boolean;
  createdAt: string;
  expiresAt: string;
};

type EmailProviderStatus = {
  configured: boolean;
  provider: string;
  mode: 'email_delivery_ready' | 'setup_required';
  from: string | null;
};

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
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [airdropMessage, setAirdropMessage] = useState('');
  const [airdropTx, setAirdropTx] = useState('');
  const [devnetWallet, setDevnetWallet] = useState<DevnetWalletSnapshot | null>(null);
  const [emailSession, setEmailSession] = useState<EmailIdentitySession | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailProvider, setEmailProvider] = useState<EmailProviderStatus | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const activeAddress = connected ? publicKey?.toString() ?? null : devnetWallet?.publicKey ?? null;
  const activeBalance = connected ? balance : devnetWallet?.balance ?? null;
  const activeWalletName = connected ? wallet?.adapter.name ?? 'Wallet' : 'CongChain Devnet';
  const activeWalletIcon = connected ? wallet?.adapter.icon : null;
  const isDevnetSandbox = !connected && !!devnetWallet;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEVNET_WALLET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DevnetWalletSnapshot;
      if (parsed?.publicKey && Array.isArray(parsed.secretKey)) {
        setDevnetWallet(parsed);
      }
    } catch {
      window.localStorage.removeItem(DEVNET_WALLET_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/email/me')
      .then(res => res.json())
      .then(data => {
        if (data?.authenticated && data.user?.email) {
          setEmailSession(data.user);
          setEmailInput(data.user.email);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/auth/email/provider')
      .then(res => res.json())
      .then(data => {
        if (typeof data?.configured === 'boolean') {
          setEmailProvider({
            configured: data.configured,
            provider: data.provider || 'resend',
            mode: data.mode === 'email_delivery_ready' ? 'email_delivery_ready' : 'setup_required',
            from: data.from ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch { /* silent */ }
  }, [publicKey, connection]);

  const fetchDevnetBalance = useCallback(async (address: string) => {
    try {
      const lamports = await connection.getBalance(new PublicKey(address));
      const nextBalance = lamports / LAMPORTS_PER_SOL;
      setDevnetWallet(prev => {
        if (!prev || prev.publicKey !== address) return prev;
        const next = { ...prev, balance: nextBalance };
        window.localStorage.setItem(DEVNET_WALLET_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return nextBalance;
    } catch {
      return null;
    }
  }, [connection]);

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

  useEffect(() => {
    if (!devnetWallet || connected) return;
    void fetchDevnetBalance(devnetWallet.publicKey);
    const t = setInterval(() => void fetchDevnetBalance(devnetWallet.publicKey), 15_000);
    return () => clearInterval(t);
  }, [connected, devnetWallet, fetchDevnetBalance]);

  useEffect(() => {
    if (!open || !activeAddress || menuPosition || typeof window === 'undefined') return;
    const frame = window.requestAnimationFrame(() => {
      const rect = walletButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 256;
      const padding = 12;
      setMenuPosition({
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.left, padding), window.innerWidth - width - padding),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeAddress, menuPosition, open]);

  function truncate(addr: string) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  function copyAddress() {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function persistDevnetWallet(next: DevnetWalletSnapshot | null) {
    if (!next) {
      window.localStorage.removeItem(DEVNET_WALLET_STORAGE_KEY);
      setDevnetWallet(null);
      return;
    }

    window.localStorage.setItem(DEVNET_WALLET_STORAGE_KEY, JSON.stringify(next));
    setDevnetWallet(next);
  }

  function announceDevnetWallet(detail: DevnetWalletCreatedDetail) {
    window.dispatchEvent(new CustomEvent('congchain:devnet-wallet-created', { detail }));
  }

  async function requestAirdropForAddress(address: string) {
    const res = await fetch('/api/wallet/airdrop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: address }),
    });
    const data = await res.json();
    return { res, data };
  }

  async function requestDevnetAirdrop() {
    if (!activeAddress) return;
    setAirdropLoading(true);
    setAirdropMessage('');
    setAirdropTx('');

    try {
      const { res, data } = await requestAirdropForAddress(activeAddress);

      if (!res.ok) {
        setAirdropMessage(data.error || 'Airdrop indisponivel agora.');
        return;
      }

      const nextBalance = typeof data.balance === 'number' ? data.balance : activeBalance;
      if (connected) {
        setBalance(nextBalance);
      } else {
        setDevnetWallet(prev => {
          if (!prev) return prev;
          const next = { ...prev, balance: nextBalance ?? prev.balance, airdropTx: data.signature || prev.airdropTx };
          window.localStorage.setItem(DEVNET_WALLET_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
      setAirdropTx(data.signature || '');
      setAirdropMessage(`+${data.amount || 1} Devnet SOL recebido.`);
      if (connected) void fetchBalance();
      else void fetchDevnetBalance(activeAddress);
    } catch {
      setAirdropMessage('Nao foi possivel solicitar airdrop agora.');
    } finally {
      setAirdropLoading(false);
    }
  }

  async function createDevnetSandboxWallet() {
    setConnectError('');
    setAirdropMessage('');
    setAirdropTx('');
    setConnectingWallet('devnet');

    const keypair = Keypair.generate();
    const createdAt = new Date().toISOString();
    const snapshot: DevnetWalletSnapshot = {
      publicKey: keypair.publicKey.toString(),
      secretKey: Array.from(keypair.secretKey),
      createdAt,
      balance: 0,
    };

    persistDevnetWallet(snapshot);

    try {
      const { res, data } = await requestAirdropForAddress(snapshot.publicKey);
      if (!res.ok) {
        setAirdropMessage(data.error || 'Carteira criada. Airdrop indisponivel agora.');
        announceDevnetWallet({
          publicKey: snapshot.publicKey,
          createdAt,
          balance: 0,
          airdropStatus: 'failed',
        });
        return;
      }

      const next: DevnetWalletSnapshot = {
        ...snapshot,
        balance: typeof data.balance === 'number' ? data.balance : 1,
        airdropTx: data.signature || '',
      };
      persistDevnetWallet(next);
      setAirdropTx(next.airdropTx || '');
      setAirdropMessage(`+${data.amount || 1} Devnet SOL recebido.`);
      announceDevnetWallet({
        publicKey: next.publicKey,
        createdAt,
        balance: next.balance,
        airdropTx: next.airdropTx,
        airdropStatus: 'success',
      });
    } catch {
      setAirdropMessage('Carteira criada. Nao foi possivel solicitar airdrop agora.');
      announceDevnetWallet({
        publicKey: snapshot.publicKey,
        createdAt,
        balance: 0,
        airdropStatus: 'failed',
      });
    } finally {
      setConnectingWallet(null);
      setPickerOpen(false);
      setOpen(true);
    }
  }

  async function connectEmailIdentity() {
    const email = emailInput.trim();
    if (!email) {
      setEmailMessage('Informe um email para continuar.');
      return;
    }

    setEmailLoading(true);
    setEmailMessage('');

    try {
      const res = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setEmailMessage(data.error || 'Nao foi possivel conectar este email.');
        return;
      }

      setEmailSession(data.user);
      setEmailInput(data.user.email);
      setEmailMessage('Email conectado como identidade local. Nenhum email foi enviado.');
    } catch {
      setEmailMessage('Nao foi possivel conectar este email agora.');
    } finally {
      setEmailLoading(false);
    }
  }

  async function requestMagicLink() {
    const email = emailInput.trim();
    if (!email) {
      setEmailMessage('Informe um email para enviar o link.');
      return;
    }

    setMagicLinkLoading(true);
    setEmailMessage('');

    try {
      const res = await fetch('/api/auth/email/magic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setEmailMessage(data.error || 'Nao foi possivel preparar o link magico.');
        return;
      }

      setEmailMessage(data.delivery === 'email_sent'
        ? 'Link magico enviado. Confira seu email.'
        : 'Link magico preparado. Configure RESEND_API_KEY e AUTH_EMAIL_FROM para envio real.'
      );
    } catch {
      setEmailMessage('Nao foi possivel preparar o link magico agora.');
    } finally {
      setMagicLinkLoading(false);
    }
  }

  async function logoutEmailIdentity() {
    try {
      await fetch('/api/auth/email/logout', { method: 'POST' });
    } catch {
      // Keep logout local even if the network request fails.
    } finally {
      setEmailSession(null);
      setEmailInput('');
      setEmailMessage('Email desconectado desta sessao.');
    }
  }

  function openConnectedMenu() {
    const rect = walletButtonRef.current?.getBoundingClientRect();
    if (!rect || typeof window === 'undefined') {
      setOpen(o => !o);
      return;
    }

    const width = 256;
    const padding = 12;
    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(Math.max(rect.left, padding), window.innerWidth - width - padding),
    });
    setOpen(o => !o);
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

  if (!connected && !devnetWallet) {
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
            <div className="relative flex max-h-[min(720px,calc(100vh-32px))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#090914] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
              <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">Conectar carteira</p>
                  <p className="text-[11px] text-white/35">Escolha sua wallet Solana para usar a Devnet.</p>
                </div>
                <button
                  onClick={() => setPickerOpen(false)}
                  className="rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
                <div className="rounded-2xl border border-[#14F195]/18 bg-gradient-to-br from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/8 p-2.5">
                  <div className="mb-2 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#14F195]/20 bg-[#14F195]/10">
                      <ShieldCheck className="h-4 w-4 text-[#14F195]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14F195]/80">Read-only first</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/42">
                        Ao conectar, a CONGCHAIN le apenas dados publicos da sua carteira. Nenhum token pode ser movido sem uma aprovacao manual na sua wallet.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
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

                <div className="rounded-2xl border border-[#9945FF]/18 bg-[#9945FF]/[0.06] p-2.5">
                  <div className="mb-2 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#9945FF]/20 bg-[#9945FF]/10">
                      <Mail className="h-4 w-4 text-[#B58CFF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B58CFF]/85">Email Identity</p>
                        <span className="rounded-full bg-[#00D1FF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#7DE3FF]/75">
                          {emailSession?.verified ? 'verificado' : 'conta local'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/38">
                        Use email para identidade, preferencias e alertas futuros. Nao substitui a wallet.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={emailInput}
                      onChange={event => setEmailInput(event.target.value)}
                      placeholder="seu@email.com"
                      inputMode="email"
                      className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/24 px-3 py-2 text-xs text-white/72 outline-none transition-colors placeholder:text-white/25 focus:border-[#9945FF]/35"
                    />
                    <button
                      type="button"
                      onClick={connectEmailIdentity}
                      disabled={emailLoading || magicLinkLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#9945FF]/22 bg-[#9945FF]/10 px-3 py-2 text-xs font-semibold text-[#C4B5FD] transition-colors hover:bg-[#9945FF]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {emailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {emailSession ? 'Atualizar' : 'Entrar'}
                    </button>
                    <button
                      type="button"
                      onClick={requestMagicLink}
                      disabled={emailLoading || magicLinkLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00D1FF]/18 bg-[#00D1FF]/[0.06] px-3 py-2 text-xs font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {magicLinkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                      Link magico
                    </button>
                  </div>

                  {(emailSession || emailMessage) && (
                    <p className={`mt-2 text-[11px] leading-relaxed ${emailSession ? 'text-[#14F195]/70' : 'text-white/42'}`}>
                      {emailMessage || `Conectado como ${emailSession?.email}${emailSession?.verified ? ' (verificado)' : ' (local)'}`}
                    </p>
                  )}
                  {emailSession && (
                    <button
                      type="button"
                      onClick={logoutEmailIdentity}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-red-300/62 transition-colors hover:bg-red-500/5 hover:text-red-300"
                    >
                      <LogOut className="h-3 w-3" />
                      Sair do email
                    </button>
                  )}
                  <div className={`mt-2 rounded-xl border px-3 py-2 text-[10px] leading-relaxed ${
                    emailProvider?.configured
                      ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]/70'
                      : 'border-[#F5A524]/14 bg-[#F5A524]/[0.045] text-[#F5A524]/72'
                  }`}>
                    {emailProvider?.configured
                      ? `Envio real pronto via ${emailProvider.provider}${emailProvider.from ? ` (${emailProvider.from})` : ''}.`
                      : 'Envio real pendente: configure RESEND_API_KEY e AUTH_EMAIL_FROM no Railway.'}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-[#00D1FF]/16 bg-[#00D1FF]/7 p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#00D1FF]/18 bg-[#00D1FF]/10">
                    <FlaskConical className="h-4 w-4 text-[#00D1FF]" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00D1FF]/80">Solana Devnet Sandbox</p>
                      <span className="rounded-full bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#14F195]/75">
                        teste sem SOL real
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/38">
                      A CONGCHAIN vai ler saldo e enviar airdrops na Devnet. A sua conta Phantom continua a mesma, mas o app usa a rede de testes.
                    </p>
                  </div>
                </div>

                <button
                  onClick={createDevnetSandboxWallet}
                  disabled={!!connectingWallet}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#14F195]/18 bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/8 to-[#9945FF]/8 p-2.5 text-left transition-all hover:border-[#14F195]/35 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[#14F195]/20 bg-[#14F195]/10 shadow-[0_0_22px_rgba(20,241,149,0.12)]">
                    <span className="text-sm font-black text-[#14F195]">S</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white/78">Devnet Sandbox</p>
                      <span className="rounded-full bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#14F195]/70">
                        criar + airdrop
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-white/34">
                      Cria uma carteira local de testes e solicita 1 SOL Devnet automaticamente.
                    </p>
                  </div>
                  {connectingWallet === 'devnet' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#14F195]" />
                  ) : (
                    <FlaskConical className="h-4 w-4 text-[#14F195]/70" />
                  )}
                </button>

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
                      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 text-left transition-all hover:border-[#9945FF]/30 hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]">
                        {adapter?.icon ? (
                          <img src={adapter.icon} alt="" className="h-6 w-6 rounded-lg" />
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
        ref={walletButtonRef}
        onClick={openConnectedMenu}
        className="inline-flex items-center gap-2 rounded-xl border border-[#14F195]/20 bg-[#14F195]/[0.08] px-3 py-2 text-xs font-semibold text-[#14F195] transition-all hover:bg-[#14F195]/15"
      >
        <div className="h-2 w-2 rounded-full bg-[#14F195] animate-pulse" />
        <span>{activeAddress ? truncate(activeAddress) : 'Carteira'}</span>
        <span className="rounded-full bg-[#14F195]/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#14F195]/70">Devnet</span>
        {activeBalance !== null && activeBalance !== undefined && (
          <span className="text-[#14F195]/60">{activeBalance.toFixed(3)} SOL</span>
        )}
        <ChevronDown className={`h-3 w-3 text-[#14F195]/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[2147483647]">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1.5px]" onClick={() => setOpen(false)} />
          <div
            className="absolute w-[256px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f0f1e] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            style={{
              top: menuPosition?.top ?? 72,
              left: menuPosition?.left ?? 16,
            }}
          >
            {(activeWalletName || activeWalletIcon) && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                {activeWalletIcon ? (
                  <img src={activeWalletIcon} alt="" className="h-4 w-4 rounded" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#14F195]/15 text-[9px] font-black text-[#14F195]">S</span>
                )}
                <span className="text-[11px] font-semibold text-white/60">{activeWalletName}</span>
                {isDevnetSandbox && (
                  <span className="ml-auto rounded-full bg-[#14F195]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#14F195]/70">local</span>
                )}
              </div>
            )}

            <div className="border-b border-white/[0.06] p-4">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-white/30">Endereco</p>
              <p className="break-all font-mono text-[11px] text-white/60">{activeAddress}</p>
            </div>

            {activeBalance !== null && activeBalance !== undefined && (
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-white/30">Saldo Devnet</p>
                <p className="mt-0.5 text-lg font-bold text-white/80">{activeBalance.toFixed(4)} SOL</p>
              </div>
            )}

            <div className="p-2">
              <div className="mb-2 rounded-xl border border-[#9945FF]/16 bg-[#9945FF]/[0.055] p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#C4B5FD]/85">CongChain Account</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-white/30">
                      Email guarda identidade e alertas. Wallet guarda assinaturas e fundos.
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    emailSession?.verified
                      ? 'bg-[#14F195]/10 text-[#14F195]/75'
                      : emailSession
                        ? 'bg-[#00D1FF]/10 text-[#7DE3FF]/75'
                        : 'bg-white/[0.055] text-white/32'
                  }`}>
                    {emailSession?.verified ? 'verified' : emailSession ? 'local' : 'offline'}
                  </span>
                </div>

                {emailSession ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-white/[0.06] bg-black/18 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-white/28">Email</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-white/62">{emailSession.email}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-white/32">
                        {emailSession.verified ? 'Verificado por magic link.' : 'Sessao local. Use magic link para verificar.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={logoutEmailIdentity}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-red-300/62 transition-colors hover:bg-red-500/5 hover:text-red-300"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sair apenas do email
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] leading-relaxed text-white/34">
                    Nenhum email conectado. Abra Conectar Carteira para adicionar Email Identity.
                  </p>
                )}
              </div>

              <div className="mb-2 rounded-xl border border-[#14F195]/16 bg-[#14F195]/7 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[#14F195]/80">Solana Devnet Sandbox</p>
                    <p className="text-[10px] leading-relaxed text-white/30">Use SOL de teste para construir sem gastar fundos reais.</p>
                  </div>
                  <span className="rounded-full bg-[#14F195]/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#14F195]/70">safe</span>
                </div>
                <button
                  onClick={requestDevnetAirdrop}
                  disabled={airdropLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#14F195]/18 bg-[#14F195]/10 px-3 py-2 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/16 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {airdropLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                  {airdropLoading ? 'Solicitando...' : 'Receber 1 Devnet SOL'}
                </button>
                {airdropMessage && (
                  <p className="mt-2 text-[10px] leading-relaxed text-white/38">{airdropMessage}</p>
                )}
                {airdropTx && (
                  <a
                    href={`https://explorer.solana.com/tx/${airdropTx}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#00D1FF]/70 hover:text-[#00D1FF]"
                  >
                    Ver airdrop no Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                onClick={copyAddress}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#14F195]" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado!' : 'Copiar endereco'}
              </button>
              <a
                href={`https://explorer.solana.com/address/${activeAddress}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver no Explorer
              </a>
              <button
                onClick={() => {
                  if (isDevnetSandbox) {
                    persistDevnetWallet(null);
                  } else {
                    disconnect();
                  }
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-red-400/60 transition-colors hover:bg-red-500/5 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Desconectar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
