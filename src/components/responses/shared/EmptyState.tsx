'use client';

interface EmptyStateProps {
  type: 'no-wallet' | 'no-data' | 'error';
}

const STATES = {
  'no-wallet': { icon: '🔗', title: 'Wallet não conectada', desc: 'Conecte sua carteira para ancorar memórias on-chain.', cta: 'Conectar Wallet' },
  'no-data':   { icon: '📭', title: 'Sem dados verificados', desc: 'Nenhum fato com confiança suficiente foi encontrado.', cta: 'Tentar novamente' },
  'error':     { icon: '⚠️', title: 'Erro na verificação', desc: 'Não foi possível verificar os dados. Tente reformular.', cta: 'Tentar novamente' },
};

export default function EmptyState({ type }: EmptyStateProps) {
  const s = STATES[type];
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <span className="text-4xl">{s.icon}</span>
      <p className="text-[14px] font-semibold text-[#e2e8f0]">{s.title}</p>
      <p className="text-[12px] text-[#64748b] max-w-xs">{s.desc}</p>
      <button className="mt-2 px-4 py-1.5 rounded-lg text-[12px] font-medium border border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#00d4aa]/10 transition-colors">
        {s.cta}
      </button>
    </div>
  );
}
