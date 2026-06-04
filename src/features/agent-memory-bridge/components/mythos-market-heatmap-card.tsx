import type { MythosHeatmapTile, MythosMarketHeatmap } from '@/lib/market/crypto-visuals';

function tileColor(change: number | null) {
  if (change === null || !Number.isFinite(change)) return 'rgba(255,255,255,0.055)';
  const strength = Math.min(0.82, Math.max(0.18, Math.abs(change) / 10));
  return change >= 0
    ? `rgba(20, 241, 149, ${strength})`
    : `rgba(255, 63, 94, ${strength})`;
}

function tileSpan(tile: MythosHeatmapTile, index: number) {
  if (index === 0) return 'md:col-span-3 md:row-span-2';
  if (index < 3) return 'md:col-span-2 md:row-span-2';
  if ((tile.sampleDominance ?? 0) > 0.045) return 'md:col-span-2';
  return '';
}

export function MythosMarketHeatmapCard({ heatmap }: { heatmap: MythosMarketHeatmap }) {
  return (
    <div className="mt-4 overflow-hidden rounded-[22px] border border-[#14F195]/18 bg-[radial-gradient(circle_at_top_left,rgba(20,241,149,0.12),transparent_38%),rgba(1,18,10,0.88)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8CFFD2]">Market Heatmap</p>
          <h3 className="mt-1 text-2xl font-black text-white">Mapa de calor crypto</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/54">{heatmap.summary}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/54">
          CoinGecko live
        </div>
      </div>

      <div className="grid auto-rows-[112px] grid-cols-2 gap-2 p-4 md:grid-cols-8">
        {heatmap.tiles.map((tile, index) => (
          <div
            key={tile.id}
            className={`${tileSpan(tile, index)} relative overflow-hidden rounded-2xl border border-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
            style={{
              background: `linear-gradient(135deg, ${tileColor(tile.change24h)}, rgba(0,0,0,0.32))`,
            }}
          >
            <div className="absolute right-2 top-2 rounded-full border border-white/14 bg-black/28 px-2 py-0.5 text-[9px] font-black text-white/70">
              #{tile.rank || index + 1}
            </div>
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="max-w-[80%] truncate text-[11px] font-black uppercase tracking-[0.08em] text-white/62">{tile.name}</p>
                <p className="mt-1 truncate text-2xl font-black uppercase text-white">{tile.symbol}</p>
              </div>
              <div>
                <p className="text-sm font-black text-white">{tile.priceLabel}</p>
                <p className={`text-xs font-black ${tile.change24h !== null && tile.change24h >= 0 ? 'text-[#06140C]' : 'text-white'}`}>
                  {tile.change24hLabel}
                </p>
                <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-white/58">{tile.marketCapLabel} cap</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/8 px-4 py-3 text-[11px] leading-5 text-white/42">
        Dados publicos da CoinGecko. Leitura de mercado, nao conselho financeiro. Mythos nao assina, nao envia transacao e nao move fundos.
      </div>
    </div>
  );
}
