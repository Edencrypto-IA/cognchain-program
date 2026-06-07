import type { MythosExternalConnectorReadiness } from '@/lib/mythos/external-data-connectors';

const STATUS_LABELS: Record<string, string> = {
  ready: 'pronta',
  needs_key: 'precisa chave',
  optional_key: 'chave opcional',
  planned: 'planejada',
};

const STATUS_STYLES: Record<string, string> = {
  ready: 'border-[#00FFA3]/20 bg-[#00FFA3]/10 text-[#8CFFD1]',
  needs_key: 'border-[#FF5C8A]/22 bg-[#FF5C8A]/10 text-[#FF9FBA]',
  optional_key: 'border-[#FFD166]/22 bg-[#FFD166]/10 text-[#FFE08A]',
  planned: 'border-white/15 bg-white/[0.05] text-white/55',
};

const DOMAIN_LABELS: Record<string, string> = {
  brasil: 'Brasil',
  weather: 'Tempo',
  maps: 'Mapas',
  finance_br: 'Financeiro BR',
  finance_global: 'Financeiro Global',
  crypto: 'Crypto',
  public_records: 'Dados Publicos',
  science: 'Ciencia',
  knowledge: 'Conhecimento',
};

type Props = {
  readiness: MythosExternalConnectorReadiness;
};

export function MythosDataConnectorsCard({ readiness }: Props) {
  const ready = readiness.counts.ready || 0;
  const needsKey = readiness.counts.needs_key || 0;
  const optionalKey = readiness.counts.optional_key || 0;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#00FFA3]/18 bg-[#03150F]/82">
      <div className="border-b border-white/10 bg-white/[0.035] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00FFA3]">Mythos Data Network</p>
            <h3 className="mt-2 text-2xl font-black text-white">Fontes externas e assistente financeiro</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/58">
              Mapa seguro das APIs que o Mythos pode usar para pesquisas, mercado, clima, dados publicos,
              macroeconomia, bolsa brasileira e crypto. Valores das chaves nunca aparecem no navegador.
            </p>
          </div>
          <div className="rounded-2xl border border-[#76FF03]/18 bg-black/35 px-4 py-3 text-right">
            <p className="text-2xl font-black text-[#76FF03]">{ready}/{readiness.total}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">prontas agora</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[#00FFA3]/14 bg-black/25 p-3">
            <p className="text-xl font-black text-white">{ready}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8CFFD1]">online sem acao</p>
          </div>
          <div className="rounded-xl border border-[#FFD166]/14 bg-black/25 p-3">
            <p className="text-xl font-black text-white">{optionalKey}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FFE08A]">chave opcional</p>
          </div>
          <div className="rounded-xl border border-[#FF5C8A]/14 bg-black/25 p-3">
            <p className="text-xl font-black text-white">{needsKey}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FF9FBA]">precisa configurar</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        {readiness.connectors.map(connector => (
          <div key={connector.id} className="rounded-2xl border border-white/10 bg-black/28 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{connector.name}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                  {DOMAIN_LABELS[connector.domain] || connector.domain}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${STATUS_STYLES[connector.status] || STATUS_STYLES.planned}`}>
                {STATUS_LABELS[connector.status] || connector.status}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/58">{connector.capabilities.join(' · ')}</p>
            {connector.envVars.length ? (
              <p className="mt-3 break-words rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-[11px] font-bold text-white/48">
                Railway: {connector.envVars.join(' ou ')}
              </p>
            ) : (
              <p className="mt-3 rounded-xl border border-[#00FFA3]/10 bg-[#00FFA3]/[0.04] px-3 py-2 text-[11px] font-bold text-[#8CFFD1]/80">
                Sem API key obrigatoria.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-5 text-white/45">
        Segurança: somente leitura. Nenhuma compra, venda, assinatura, PIX, ordem, pagamento ou movimentacao de fundos e executada por este painel.
      </div>
    </div>
  );
}
