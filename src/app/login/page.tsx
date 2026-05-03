'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        router.push('/');
        router.refresh();
      } else {
        const d = await r.json();
        setError(d.error || 'Erro ao fazer login');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060610] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9945FF]/30 to-[#14F195]/20 border border-[#9945FF]/30 flex items-center justify-center mb-4 shadow-xl shadow-[#9945FF]/10">
            <Brain className="w-7 h-7 text-[#9945FF]" />
          </div>
          <h1 className="text-xl font-bold text-white">CognChain</h1>
          <p className="text-sm text-white/30 mt-1">Acesso Admin — Modo Pro</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-[#9945FF]/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Senha</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none focus:border-[#9945FF]/50 focus:bg-white/[0.06] transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-[#9945FF]/20 hover:opacity-90 transition-opacity">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-white/20 mt-6">
          Modo Pro · Todos os modelos de IA liberados
        </p>
      </div>
    </div>
  );
}
