export type MythosExternalDataKind =
  | 'weather'
  | 'cep'
  | 'cnpj'
  | 'selic'
  | 'ipca'
  | 'dolar'
  | 'b3'
  | 'fed'
  | 'transparencia';

export type MythosExternalDataReport = {
  ok: true;
  kind: MythosExternalDataKind;
  title: string;
  summary: string;
  facts: Array<{ label: string; value: string }>;
  source: string;
  generatedAt: string;
  safety: string;
  nextStep?: string;
};

type JsonRecord = Record<string, unknown>;

const DATA_TIMEOUT_MS = 12_000;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = 'indisponivel') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function getEnv(names: string[]) {
  return names.map(name => process.env[name]?.trim()).find(Boolean) || '';
}

function onlyDigits(input: string) {
  return input.replace(/\D/g, '');
}

function normalizeTicker(input: string) {
  const ticker = input.trim().replace(/^\//, '').toUpperCase();
  return ticker.endsWith('.SA') ? ticker.replace('.SA', '') : ticker;
}

function formatNumber(value: unknown, locale = 'pt-BR', options: Intl.NumberFormatOptions = {}) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 'indisponivel';
  return new Intl.NumberFormat(locale, options).format(number);
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATA_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CongChain-Mythos/1.0 data-readonly',
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      const message = asString(asRecord(payload).message || asRecord(payload).error, `Provider returned HTTP ${response.status}`);
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function weatherReport(city: string): Promise<MythosExternalDataReport> {
  if (!city.trim()) throw new Error('Use /tempo <cidade>. Exemplo: /tempo sao paulo');
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`;
  const geo = asRecord(await fetchJson(geoUrl));
  const location = asRecord(asArray(geo.results)[0]);
  if (!Object.keys(location).length) throw new Error(`Nao encontrei a cidade "${city}" no Open-Meteo.`);

  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&timezone=auto`;
  const data = asRecord(await fetchJson(weatherUrl));
  const current = asRecord(data.current);
  const place = [location.name, location.admin1, location.country].map(item => asString(item, '')).filter(Boolean).join(', ');

  return {
    ok: true,
    kind: 'weather',
    title: `Tempo agora em ${place || city}`,
    summary: `${formatNumber(current.temperature_2m, 'pt-BR', { maximumFractionDigits: 1 })} C, umidade ${formatNumber(current.relative_humidity_2m)}%, vento ${formatNumber(current.wind_speed_10m, 'pt-BR', { maximumFractionDigits: 1 })} km/h.`,
    facts: [
      { label: 'Temperatura', value: `${formatNumber(current.temperature_2m, 'pt-BR', { maximumFractionDigits: 1 })} C` },
      { label: 'Umidade', value: `${formatNumber(current.relative_humidity_2m)}%` },
      { label: 'Chuva agora', value: `${formatNumber(current.precipitation, 'pt-BR', { maximumFractionDigits: 1 })} mm` },
      { label: 'Vento', value: `${formatNumber(current.wind_speed_10m, 'pt-BR', { maximumFractionDigits: 1 })} km/h` },
    ],
    source: 'Open-Meteo Geocoding + Forecast',
    generatedAt: new Date().toISOString(),
    safety: 'Leitura meteorologica. Nao e alerta oficial de emergencia.',
  };
}

async function cepReport(cepInput: string): Promise<MythosExternalDataReport> {
  const cep = onlyDigits(cepInput);
  if (cep.length !== 8) throw new Error('Use /cep com 8 digitos. Exemplo: /cep 01001000');
  const data = asRecord(await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`));
  const cityState = `${asString(data.city)} - ${asString(data.state)}`;
  return {
    ok: true,
    kind: 'cep',
    title: `CEP ${cep}`,
    summary: `${asString(data.street)} - ${asString(data.neighborhood)} - ${cityState}`,
    facts: [
      { label: 'Rua', value: asString(data.street) },
      { label: 'Bairro', value: asString(data.neighborhood) },
      { label: 'Cidade/UF', value: cityState },
      { label: 'Coordenadas', value: `${asString(asRecord(data.location).coordinates && asRecord(asRecord(data.location).coordinates).latitude)} / ${asString(asRecord(data.location).coordinates && asRecord(asRecord(data.location).coordinates).longitude)}` },
    ],
    source: 'BrasilAPI CEP v2',
    generatedAt: new Date().toISOString(),
    safety: 'Dado publico de endereco. Nao rastreia usuario nem confirma residencia.',
  };
}

async function cnpjReport(cnpjInput: string): Promise<MythosExternalDataReport> {
  const cnpj = onlyDigits(cnpjInput);
  if (cnpj.length !== 14) throw new Error('Use /cnpj com 14 digitos. Exemplo: /cnpj 00000000000191');
  const data = asRecord(await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`));
  return {
    ok: true,
    kind: 'cnpj',
    title: asString(data.razao_social, `CNPJ ${cnpj}`),
    summary: `${asString(data.nome_fantasia, 'Sem nome fantasia informado')} - ${asString(data.descricao_situacao_cadastral)} - ${asString(data.municipio)}/${asString(data.uf)}`,
    facts: [
      { label: 'CNPJ', value: cnpj },
      { label: 'Situacao', value: asString(data.descricao_situacao_cadastral) },
      { label: 'Abertura', value: asString(data.data_inicio_atividade) },
      { label: 'Atividade principal', value: asString(data.cnae_fiscal_descricao) },
      { label: 'Cidade/UF', value: `${asString(data.municipio)}/${asString(data.uf)}` },
    ],
    source: 'BrasilAPI CNPJ v1',
    generatedAt: new Date().toISOString(),
    safety: 'Dado cadastral publico. Nao conclui idoneidade sem verificacoes adicionais.',
  };
}

async function bcbSeriesReport(kind: 'selic' | 'ipca' | 'dolar'): Promise<MythosExternalDataReport> {
  const config = {
    selic: { code: '11', title: 'Taxa Selic diaria', unit: '% a.d.', source: 'Banco Central do Brasil SGS serie 11' },
    ipca: { code: '433', title: 'IPCA mensal', unit: '% no mes', source: 'Banco Central do Brasil SGS serie 433' },
    dolar: { code: '1', title: 'Dolar PTAX venda', unit: 'BRL', source: 'Banco Central do Brasil SGS serie 1' },
  }[kind];
  const rows = asArray(await fetchJson(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${config.code}/dados/ultimos/1?formato=json`));
  const latest = asRecord(rows[0]);
  const value = asString(latest.valor);
  return {
    ok: true,
    kind,
    title: config.title,
    summary: `${config.title}: ${kind === 'dolar' ? `R$ ${value}` : `${value}${config.unit.includes('%') ? '%' : ''}`} em ${asString(latest.data)}.`,
    facts: [
      { label: 'Valor', value: kind === 'dolar' ? `R$ ${value}` : `${value} ${config.unit}` },
      { label: 'Data-base', value: asString(latest.data) },
      { label: 'Serie SGS', value: config.code },
    ],
    source: config.source,
    generatedAt: new Date().toISOString(),
    safety: 'Dado macroeconomico oficial. Nao e recomendacao financeira.',
  };
}

async function b3Report(tickerInput: string): Promise<MythosExternalDataReport> {
  const ticker = normalizeTicker(tickerInput);
  if (!ticker) throw new Error('Use /b3 <ticker>. Exemplo: /b3 petr4');
  const token = getEnv(['BRAPI_KEY', 'BRAPI_API_KEY']);
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const data = asRecord(await fetchJson(url));
  const item = asRecord(asArray(data.results)[0]);
  if (!Object.keys(item).length) throw new Error(`Nao encontrei cotacao para ${ticker} na Brapi.`);
  const price = formatNumber(item.regularMarketPrice, 'pt-BR', { style: 'currency', currency: 'BRL' });
  const change = formatNumber(item.regularMarketChangePercent, 'pt-BR', { maximumFractionDigits: 2 });
  return {
    ok: true,
    kind: 'b3',
    title: `${asString(item.shortName, ticker)} (${asString(item.symbol, ticker)})`,
    summary: `${asString(item.symbol, ticker)} esta em ${price}, variacao de ${change}% no dado mais recente da Brapi.`,
    facts: [
      { label: 'Preco', value: price },
      { label: 'Variacao', value: `${change}%` },
      { label: 'Volume', value: formatNumber(item.regularMarketVolume) },
      { label: 'Moeda', value: asString(item.currency, 'BRL') },
    ],
    source: 'Brapi quote API',
    generatedAt: new Date().toISOString(),
    safety: 'Cotacao de mercado somente leitura. Nao executa ordem e nao recomenda compra/venda.',
  };
}

async function fedReport(): Promise<MythosExternalDataReport> {
  const key = getEnv(['FED_API_KEY', 'FRED_API_KEY']);
  if (!key) throw new Error('Configure FED_API_KEY ou FRED_API_KEY no Railway para usar /fed rates.');
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=1`;
  const data = asRecord(await fetchJson(url));
  const latest = asRecord(asArray(data.observations)[0]);
  return {
    ok: true,
    kind: 'fed',
    title: 'Federal Funds Effective Rate',
    summary: `Fed Funds: ${asString(latest.value)}% na observacao de ${asString(latest.date)}.`,
    facts: [
      { label: 'Serie', value: 'FEDFUNDS' },
      { label: 'Valor', value: `${asString(latest.value)}%` },
      { label: 'Data-base', value: asString(latest.date) },
    ],
    source: 'Federal Reserve Economic Data (FRED)',
    generatedAt: new Date().toISOString(),
    safety: 'Dado macroeconomico dos EUA. Nao e recomendacao financeira.',
  };
}

async function transparenciaReport(query: string): Promise<MythosExternalDataReport> {
  if (!query.trim()) throw new Error('Use /transparencia contrato <termo>. Exemplo: /transparencia contrato tecnologia');
  const key = getEnv(['TRANSPARENCIA_KEY', 'TRANSPARENCIA_API_KEY', 'PORTAL_TRANSPARENCIA_API_KEY']);
  if (!key) throw new Error('Configure TRANSPARENCIA_KEY no Railway para usar o Portal da Transparencia.');
  const term = query.replace(/^contrato\s+/i, '').trim();
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?termo=${encodeURIComponent(term)}&pagina=1&tamanhoPagina=5`;
  const rows = asArray(await fetchJson(url, { headers: { 'chave-api-dados': key } }));
  const first = asRecord(rows[0]);
  return {
    ok: true,
    kind: 'transparencia',
    title: rows.length ? `Contratos encontrados para "${term}"` : `Nenhum contrato encontrado para "${term}"`,
    summary: rows.length
      ? `Encontrei ${rows.length} resultado(s) iniciais. Primeiro registro: ${asString(first.objeto || first.descricao || first.numero, 'sem descricao no retorno')}.`
      : 'O Portal da Transparencia respondeu sem contratos para esse termo nesta consulta.',
    facts: [
      { label: 'Termo', value: term },
      { label: 'Resultados lidos', value: String(rows.length) },
      { label: 'Primeiro orgao/fornecedor', value: asString(first.orgao || first.fornecedor || first.nomeFornecedor) },
      { label: 'Valor', value: asString(first.valor || first.valorInicialCompra || first.valorContrato) },
    ],
    source: 'Portal da Transparencia API',
    generatedAt: new Date().toISOString(),
    safety: 'Dado publico. Nao acusa irregularidade sem auditoria, documento oficial e contexto.',
    nextStep: 'Para uma auditoria real, refine por orgao, periodo, CNPJ ou numero do contrato.',
  };
}

export function parseMythosExternalDataCommand(command: string): { kind: MythosExternalDataKind; query: string } | null {
  const trimmed = command.trim();
  const lower = trimmed.toLowerCase();
  const matchers: Array<[RegExp, MythosExternalDataKind]> = [
    [/^\/tempo\s+(.+)/i, 'weather'],
    [/^\/cep\s+(.+)/i, 'cep'],
    [/^\/cnpj\s+(.+)/i, 'cnpj'],
    [/^\/b3\s+(.+)/i, 'b3'],
    [/^\/fed(?:\s+rates)?\s*$/i, 'fed'],
    [/^\/transparencia\s+(.+)/i, 'transparencia'],
  ];
  for (const [regex, kind] of matchers) {
    const match = trimmed.match(regex);
    if (match) return { kind, query: match[1] || '' };
  }
  if (lower === '/selic') return { kind: 'selic', query: '' };
  if (lower === '/ipca') return { kind: 'ipca', query: '' };
  if (lower === '/dolar') return { kind: 'dolar', query: '' };
  return null;
}

export async function runMythosExternalDataQuery(kind: MythosExternalDataKind, query: string): Promise<MythosExternalDataReport> {
  if (kind === 'weather') return weatherReport(query);
  if (kind === 'cep') return cepReport(query);
  if (kind === 'cnpj') return cnpjReport(query);
  if (kind === 'selic' || kind === 'ipca' || kind === 'dolar') return bcbSeriesReport(kind);
  if (kind === 'b3') return b3Report(query);
  if (kind === 'fed') return fedReport();
  if (kind === 'transparencia') return transparenciaReport(query);
  throw new Error('Comando de dados nao suportado.');
}
