'use client';
import type { FactSource } from '@/lib/grounding/types';

interface SourceBadgeProps {
  id: string;
  sources: FactSource[];
}

const SOURCE_COLORS: Record<string, string> = {
  binance:     'text-[#F0B90B] border-[#F0B90B]/30 bg-[#F0B90B]/10',
  bybit:       'text-[#F7A600] border-[#F7A600]/30 bg-[#F7A600]/10',
  kraken:      'text-[#5741D9] border-[#5741D9]/40 bg-[#5741D9]/10',
  okx:         'text-[#e2e8f0] border-white/20 bg-white/[0.05]',
  coingecko:   'text-[#8DC647] border-[#8DC647]/30 bg-[#8DC647]/10',
  jupiter:     'text-[#9945FF] border-[#9945FF]/30 bg-[#9945FF]/10',
  coinmarketcap:'text-[#00aff0] border-[#00aff0]/30 bg-[#00aff0]/10',
  cmc:         'text-[#00aff0] border-[#00aff0]/30 bg-[#00aff0]/10',
  defillama:   'text-[#00d4aa] border-[#00d4aa]/30 bg-[#00d4aa]/10',
  helius:      'text-[#FF6B35] border-[#FF6B35]/30 bg-[#FF6B35]/10',
  solanafm:    'text-[#9945FF] border-[#9945FF]/30 bg-[#9945FF]/10',
};

function getShortName(name: string): string {
  return name
    .replace(/\s*\([^)]+\)/g, '')
    .replace(/CoinMarketCap/i, 'CMC')
    .replace(/CoinGecko/i, 'CoinGecko')
    .replace(/DefiLlama/i, 'DefiLlama')
    .replace(/SolanaFM/i, 'SolanaFM')
    .replace(/^(Preço|Máxima\s*24h|Mínima\s*24h|Volume\s*24h|Market\s*Cap|Variação\s*\w*)\s*/i, '')
    .split(' ')[0]
    .trim()
    .slice(0, 12);
}

function getColorClass(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, cls] of Object.entries(SOURCE_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return 'text-[#00a8e8] border-[#00a8e8]/20 bg-[#00a8e8]/10';
}

export default function SourceBadge({ id, sources }: SourceBadgeProps) {
  const source = sources.find(s => s.id === id);
  if (!source) return null;

  const shortName = getShortName(source.name);
  const colorClass = getColorClass(source.name);
  const ago = Math.round((Date.now() - new Date(source.fetchedAt).getTime()) / 60000);

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.name} · ${source.credibilityScore}/100 · ${ago}min atrás`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all hover:opacity-80 hover:scale-105 cursor-pointer ${colorClass}`}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-70" />
      {shortName}
    </a>
  );
}
