'use client';

import React, { useState } from 'react';
import { Send, MessageCircle, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DeployDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
}

type DeployTarget = 'telegram' | 'whatsapp' | null;

export default function DeployDialog({ isOpen, onClose, agentId, agentName }: DeployDialogProps) {
  const [target, setTarget] = useState<DeployTarget>(null);
  const [botToken, setBotToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function resetAndClose() {
    setTarget(null);
    setBotToken('');
    setPhoneNumber('');
    setLoading(false);
    setSuccess(false);
    setError('');
    onClose();
  }

  async function handleDeploy() {
    if (!target) return;
    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = {
        agentId,
        target,
      };

      if (target === 'telegram') {
        if (!botToken.trim()) {
          setError('O token do bot é obrigatório para o Telegram.');
          setLoading(false);
          return;
        }
        if (!/^\d+:[\w-]{20,}$/.test(botToken.trim())) {
          setError('Token inválido. O formato deve ser 123456:ABC-DEF... (obtido via @BotFather).');
          setLoading(false);
          return;
        }
        body.botToken = botToken.trim();
      } else {
        if (!phoneNumber.trim()) {
          setError('O número de telefone é obrigatório para o WhatsApp.');
          setLoading(false);
          return;
        }
        const digitsOnly = phoneNumber.replace(/[\s\-().]/g, '');
        if (!/^\+\d{7,15}$/.test(digitsOnly)) {
          setError('Número inválido. Inclua o código do país (ex: +5511999999999).');
          setLoading(false);
          return;
        }
        body.phoneNumber = phoneNumber.trim();
      }

      const res = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao implantar o agente.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetAndClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f0f1e] p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={resetAndClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white/90">Implantar Agente</h2>
          <p className="mt-1 text-sm text-white/40">
            Escolha o canal para implantar <span className="text-white/60">{agentName}</span>
          </p>
        </div>

        {/* Success state */}
        {success && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-[#14F195]/20 bg-[#14F195]/5 p-6">
              <CheckCircle2 className="h-10 w-10 text-[#14F195]" />
              <p className="text-sm font-medium text-white/80">Agente implantado com sucesso!</p>
              <p className="text-center text-xs text-white/40">
                {target === 'telegram'
                  ? 'Seu agente agora está ativo no Telegram. As mensagens usarão a camada de memória CONGCHAIN.'
                  : 'Seu agente agora está ativo no WhatsApp. As mensagens usarão a camada de memória CONGCHAIN.'}
              </p>
            </div>
            <button
              onClick={resetAndClose}
              className="w-full rounded-xl bg-white/[0.06] py-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.1]"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Form state */}
        {!success && (
          <div className="space-y-5">
            {/* Target selection */}
            {!target && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTarget('telegram')}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all hover:border-[#00D1FF]/30 hover:bg-[#00D1FF]/5"
                >
                  <div className="rounded-xl bg-[#00D1FF]/10 p-3 transition-colors group-hover:bg-[#00D1FF]/20">
                    <Send className="h-6 w-6 text-[#00D1FF]" />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white/90">Telegram</span>
                </button>

                <button
                  onClick={() => setTarget('whatsapp')}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all hover:border-[#14F195]/30 hover:bg-[#14F195]/5"
                >
                  <div className="rounded-xl bg-[#14F195]/10 p-3 transition-colors group-hover:bg-[#14F195]/20">
                    <MessageCircle className="h-6 w-6 text-[#14F195]" />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white/90">WhatsApp</span>
                </button>
              </div>
            )}

            {/* Input fields */}
            {target === 'telegram' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Token do Bot (Telegram)
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#00D1FF]/40 focus:bg-white/[0.06]"
                  />
                  <p className="mt-1.5 text-[11px] text-white/30">
                    Obtenha o token via @BotFather no Telegram.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setTarget(null)}
                    className="flex-1 rounded-xl border border-white/[0.06] py-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00D1FF] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Implantando...' : 'Implantar'}
                  </button>
                </div>
              </div>
            )}

            {target === 'whatsapp' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Número de Telefone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/90 placeholder:text-white/20 outline-none transition-colors focus:border-[#14F195]/40 focus:bg-white/[0.06]"
                  />
                  <p className="mt-1.5 text-[11px] text-white/30">
                    Inclua o código do país (ex: +55 para Brasil).
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setTarget(null)}
                    className="flex-1 rounded-xl border border-white/[0.06] py-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#14F195] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? 'Implantando...' : 'Implantar'}
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
