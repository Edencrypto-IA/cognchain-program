'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogOut, UserCheck } from 'lucide-react';
import { signOut } from 'next-auth/react';

type SocialIdentitySession = {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
};

function shortEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 10)}@${domain}`;
}

export default function SocialIdentityChip() {
  const [session, setSession] = useState<SocialIdentitySession | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data?.user?.email) {
        setSession({
          email: data.user.email,
          name: data.user.name ?? null,
          image: data.user.image ?? null,
          provider: data.user.provider || 'social',
        });
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function logout() {
    setLoading(true);
    try {
      await signOut({ redirect: false });
      setSession(null);
    } finally {
      setLoading(false);
      void refresh();
    }
  }

  if (!session) return null;

  return (
    <div className="hidden lg:flex max-w-[220px] items-center gap-2 rounded-full border border-[#14F195]/18 bg-[#14F195]/[0.06] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {session.image ? (
        <img src={session.image} alt="" className="h-6 w-6 shrink-0 rounded-full border border-white/[0.08]" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#14F195]/18 bg-[#14F195]/10">
          <UserCheck className="h-3.5 w-3.5 text-[#14F195]/75" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold leading-tight text-white/78">
          {session.name || shortEmail(session.email)}
        </p>
        <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#14F195]/60">
          {session.provider}
        </p>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={loading}
        className="ml-0.5 rounded-full p-1 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-red-300 disabled:opacity-45"
        title="Sair do login social"
        aria-label="Sair do login social"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
