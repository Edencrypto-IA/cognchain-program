export type MythosExternalConnectorDomain =
  | 'brasil'
  | 'weather'
  | 'maps'
  | 'finance_br'
  | 'finance_global'
  | 'crypto'
  | 'public_records'
  | 'science'
  | 'knowledge';

export type MythosExternalConnector = {
  id: string;
  name: string;
  domain: MythosExternalConnectorDomain;
  status: 'ready' | 'needs_key' | 'optional_key' | 'planned';
  envVars: string[];
  source: string;
  capabilities: string[];
  safety: string;
};

function hasAnyEnv(names: string[]) {
  return names.some(name => Boolean(process.env[name]?.trim()));
}

export const MYTHOS_EXTERNAL_CONNECTORS: MythosExternalConnector[] = [
  {
    id: 'brasil-api',
    name: 'BrasilAPI',
    domain: 'brasil',
    status: 'ready',
    envVars: [],
    source: 'https://brasilapi.com.br',
    capabilities: ['CEP', 'CNPJ', 'FIPE', 'bancos', 'feriados nacionais'],
    safety: 'Dados publicos. Nao usa conta privada, pagamento ou credencial do usuario.',
  },
  {
    id: 'ibge',
    name: 'IBGE',
    domain: 'brasil',
    status: 'ready',
    envVars: [],
    source: 'https://servicodados.ibge.gov.br',
    capabilities: ['estados', 'municipios', 'populacao', 'series SIDRA'],
    safety: 'Dados publicos estatisticos. Sempre citar periodo e fonte.',
  },
  {
    id: 'portal-transparencia',
    name: 'Portal da Transparencia',
    domain: 'public_records',
    status: hasAnyEnv(['TRANSPARENCIA_API_KEY', 'TRANSPARENCIA_KEY', 'PORTAL_TRANSPARENCIA_API_KEY']) ? 'ready' : 'needs_key',
    envVars: ['TRANSPARENCIA_KEY', 'TRANSPARENCIA_API_KEY'],
    source: 'https://api.portaldatransparencia.gov.br',
    capabilities: ['despesas', 'contratos', 'licitacoes', 'servidores', 'beneficios sociais'],
    safety: 'Exige fonte, data e cuidado com inferencias sobre pessoas ou orgaos publicos.',
  },
  {
    id: 'pncp',
    name: 'PNCP',
    domain: 'public_records',
    status: 'ready',
    envVars: [],
    source: 'https://pncp.gov.br',
    capabilities: ['contratacoes publicas', 'atas', 'contratos', 'orgaos compradores'],
    safety: 'Dados publicos de contratacoes. Nao deve acusar fraude sem fonte oficial.',
  },
  {
    id: 'bcb',
    name: 'Banco Central do Brasil',
    domain: 'finance_br',
    status: 'ready',
    envVars: [],
    source: 'https://api.bcb.gov.br',
    capabilities: ['SELIC', 'IPCA', 'CDI', 'IGP-M', 'PTAX dolar'],
    safety: 'Leitura macroeconomica, nao recomendacao financeira.',
  },
  {
    id: 'cvm',
    name: 'CVM Dados Abertos',
    domain: 'finance_br',
    status: 'ready',
    envVars: [],
    source: 'https://dados.cvm.gov.br',
    capabilities: ['cadastro de fundos', 'informes diarios de fundos', 'dados publicos CVM'],
    safety: 'Dados historicos/publicos. Confirmar data-base antes de concluir.',
  },
  {
    id: 'brapi',
    name: 'Brapi Bolsa Brasileira',
    domain: 'finance_br',
    status: hasAnyEnv(['BRAPI_API_KEY', 'BRAPI_KEY']) ? 'ready' : 'optional_key',
    envVars: ['BRAPI_KEY', 'BRAPI_API_KEY'],
    source: 'https://brapi.dev',
    capabilities: ['cotacoes B3', 'fundamentos', 'dividendos', 'lista de ativos'],
    safety: 'Pode ter atraso/limite. Nao executar ordens nem sugerir compra/venda como certeza.',
  },
  {
    id: 'fred',
    name: 'Federal Reserve Economic Data',
    domain: 'finance_global',
    status: hasAnyEnv(['FRED_API_KEY', 'FED_API_KEY']) ? 'ready' : 'needs_key',
    envVars: ['FED_API_KEY', 'FRED_API_KEY'],
    source: 'https://fred.stlouisfed.org',
    capabilities: ['juros EUA', 'CPI', 'DXY proxies', 'series macroeconomicas globais'],
    safety: 'Dados macro dos EUA. Sempre citar serie, periodo e ultima observacao.',
  },
  {
    id: 'alpha-vantage',
    name: 'Alpha Vantage',
    domain: 'finance_global',
    status: hasAnyEnv(['ALPHA_VANTAGE_API_KEY', 'ALPHA_VANTAGE_KEY']) ? 'ready' : 'needs_key',
    envVars: ['ALPHA_VANTAGE_KEY', 'ALPHA_VANTAGE_API_KEY'],
    source: 'https://www.alphavantage.co',
    capabilities: ['acoes globais', 'forex', 'indicadores tecnicos', 'series intraday'],
    safety: 'Plano free tem limite baixo. Usar para leitura, nao execucao.',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko',
    domain: 'crypto',
    status: hasAnyEnv(['COINGECKO_API_KEY', 'COINGECKO_DEMO_API_KEY', 'COINGECKO_PRO_API_KEY']) ? 'ready' : 'optional_key',
    envVars: ['COINGECKO_API_KEY'],
    source: 'https://www.coingecko.com',
    capabilities: ['precos crypto', 'market cap', 'trending', 'graficos', 'memecoins'],
    safety: 'Dados de mercado. Nao cria ordem, swap ou movimentacao de fundos.',
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo',
    domain: 'weather',
    status: 'ready',
    envVars: [],
    source: 'https://open-meteo.com',
    capabilities: ['tempo atual', 'previsao', 'temperatura', 'vento', 'chuva'],
    safety: 'Dados meteorologicos estimados. Citar local e horario.',
  },
  {
    id: 'nominatim',
    name: 'OpenStreetMap Nominatim',
    domain: 'maps',
    status: 'ready',
    envVars: [],
    source: 'https://nominatim.openstreetmap.org',
    capabilities: ['geocoding', 'cidade para latitude/longitude', 'enderecos publicos'],
    safety: 'Respeitar rate limits e User-Agent. Nao rastrear usuario sem consentimento.',
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    domain: 'maps',
    status: hasAnyEnv(['MAPBOX_API_KEY', 'MAPBOX_KEY', 'MAPBOX_TOKEN']) ? 'ready' : 'needs_key',
    envVars: ['MAPBOX_KEY', 'MAPBOX_API_KEY'],
    source: 'https://www.mapbox.com',
    capabilities: ['mapas premium', 'geocoding', 'rotas', 'visualizacao geoespacial'],
    safety: 'Token deve ter restricao de dominio e ficar no servidor quando possivel.',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia/Wikidata',
    domain: 'knowledge',
    status: 'ready',
    envVars: [],
    source: 'https://www.wikipedia.org',
    capabilities: ['resumos enciclopedicos', 'entidades', 'dados estruturados Wikidata'],
    safety: 'Fonte aberta. Confirmar em fontes primarias quando a decisao for sensivel.',
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    domain: 'science',
    status: hasAnyEnv(['OPENALEX_API_KEY', 'OPENALEX_KEY']) ? 'ready' : 'optional_key',
    envVars: ['OPENALEX_KEY', 'OPENALEX_API_KEY'],
    source: 'https://openalex.org',
    capabilities: ['papers', 'autores', 'instituicoes', 'citacoes'],
    safety: 'Pesquisa academica. Nao exagerar conclusoes de artigos.',
  },
  {
    id: 'gbif',
    name: 'GBIF',
    domain: 'science',
    status: 'ready',
    envVars: [],
    source: 'https://www.gbif.org',
    capabilities: ['biodiversidade', 'ocorrencias de especies', 'taxonomia'],
    safety: 'Dados cientificos publicos. Verificar taxonomia e data da ocorrencia.',
  },
  {
    id: 'nasa-eonet',
    name: 'NASA EONET',
    domain: 'science',
    status: 'ready',
    envVars: [],
    source: 'https://eonet.gsfc.nasa.gov',
    capabilities: ['eventos naturais', 'incendios', 'tempestades', 'vulcoes'],
    safety: 'Dados publicos de eventos naturais. Nao usar como alerta de emergencia sem fonte oficial local.',
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid Public Info',
    domain: 'crypto',
    status: 'ready',
    envVars: [],
    source: 'https://hyperliquid.xyz',
    capabilities: ['mercado perp', 'tickers publicos', 'estado de ativos'],
    safety: 'Somente leitura. Nao abrir posicao, alavancagem ou ordem.',
  },
];

export function getMythosExternalConnectorReadiness() {
  const counts = MYTHOS_EXTERNAL_CONNECTORS.reduce((acc, connector) => {
    acc[connector.status] = (acc[connector.status] || 0) + 1;
    return acc;
  }, {} as Record<MythosExternalConnector['status'], number>);

  return {
    ok: true as const,
    generatedAt: new Date().toISOString(),
    total: MYTHOS_EXTERNAL_CONNECTORS.length,
    counts,
    connectors: MYTHOS_EXTERNAL_CONNECTORS,
    safety: {
      noSecretsReturned: true,
      serverSideKeysOnly: true,
      noFinancialExecution: true,
      note: 'Este endpoint mostra readiness e nomes de variaveis, nunca valores de API keys.',
    },
  };
}

export type MythosExternalConnectorReadiness = ReturnType<typeof getMythosExternalConnectorReadiness>;
