export type MythosExternalDataKind =
  | 'weather'
  | 'cep'
  | 'cnpj'
  | 'selic'
  | 'ipca'
  | 'dolar'
  | 'b3'
  | 'fed'
  | 'finance'
  | 'radar_brasil'
  | 'radar_politico'
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
const ANTHROPIC_MESSAGES_API = 'https://api.anthropic.com/v1/messages';

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

function findFact(report: MythosExternalDataReport, label: string) {
  return report.facts.find(fact => fact.label.toLowerCase() === label.toLowerCase())?.value || 'indisponivel';
}

function isUnavailableReport(report: MythosExternalDataReport) {
  return report.facts.some(fact => fact.label.toLowerCase() === 'status' && fact.value === 'indisponivel');
}

async function optionalReport(label: string, loader: () => Promise<MythosExternalDataReport>) {
  try {
    return await loader();
  } catch (error) {
    return {
      ok: true as const,
      kind: 'finance' as const,
      title: label,
      summary: error instanceof Error ? error.message : 'Fonte indisponivel agora.',
      facts: [{ label: 'Status', value: 'indisponivel' }],
      source: label,
      generatedAt: new Date().toISOString(),
      safety: 'Fonte opcional indisponivel. Nao preencher com estimativa.',
    };
  }
}

async function financeReport(query: string): Promise<MythosExternalDataReport> {
  const ticker = query.trim().replace(/^brasil\s*/i, '').replace(/^macro\s*/i, '').trim();
  const [selic, ipca, dolar, fed, b3] = await Promise.all([
    optionalReport('Banco Central - Selic', () => bcbSeriesReport('selic')),
    optionalReport('Banco Central - IPCA', () => bcbSeriesReport('ipca')),
    optionalReport('Banco Central - dolar PTAX', () => bcbSeriesReport('dolar')),
    optionalReport('FRED - Fed Funds', () => fedReport()),
    ticker ? optionalReport(`Brapi - ${ticker.toUpperCase()}`, () => b3Report(ticker)) : Promise.resolve(null),
  ]);

  const selicValue = findFact(selic, 'Valor');
  const ipcaValue = findFact(ipca, 'Valor');
  const dolarValue = findFact(dolar, 'Valor');
  const fedValue = findFact(fed, 'Valor');
  const b3Price = b3 ? findFact(b3, 'Preco') : '';
  const b3Change = b3 ? findFact(b3, 'Variacao') : '';

  const plainRead = [
    `Brasil: Selic ${selicValue}, IPCA ${ipcaValue}, dolar PTAX ${dolarValue}.`,
    fedValue !== 'indisponivel' ? `EUA: Fed Funds ${fedValue}.` : 'EUA: Fed Funds indisponivel nesta leitura.',
    b3 ? `B3: ${b3.title} em ${b3Price}, variacao ${b3Change}.` : '',
  ].filter(Boolean).join(' ');

  const notes = [
    'Juros altos favorecem caixa/renda fixa e deixam valuation de risco mais sensivel.',
    'Dolar e Fed ajudam a medir pressao externa sobre Brasil, crypto e bolsa.',
    'Use isso como contexto, nao como sinal automatico de compra ou venda.',
  ];

  return {
    ok: true,
    kind: 'finance',
    title: ticker ? `Radar financeiro com ${ticker.toUpperCase()}` : 'Radar financeiro Brasil + EUA',
    summary: plainRead,
    facts: [
      { label: 'Selic', value: `${selicValue} (${findFact(selic, 'Data-base')})` },
      { label: 'IPCA', value: `${ipcaValue} (${findFact(ipca, 'Data-base')})` },
      { label: 'Dolar PTAX', value: `${dolarValue} (${findFact(dolar, 'Data-base')})` },
      { label: 'Fed Funds', value: `${fedValue} (${findFact(fed, 'Data-base')})` },
      ...(b3 ? [
        { label: 'Ativo B3', value: b3.title },
        { label: 'Preco/variacao', value: `${b3Price} / ${b3Change}` },
      ] : []),
      { label: 'Leitura Mythos', value: notes.join(' ') },
    ],
    source: 'Banco Central do Brasil + FRED + Brapi',
    generatedAt: new Date().toISOString(),
    safety: 'Assistente financeiro somente leitura. Nao e recomendacao individual, ordem, promessa de retorno ou execucao.',
    nextStep: ticker
      ? 'Compare fundamentos, liquidez, noticias e risco antes de qualquer decisao.'
      : 'Passe um ticker para incluir B3: /financeiro petr4 ou /macro vale3.',
  };
}

async function nextBrazilHolidayReport(): Promise<MythosExternalDataReport> {
  const now = new Date();
  const year = now.getFullYear();
  const holidays = asArray(await fetchJson(`https://brasilapi.com.br/api/feriados/v1/${year}`))
    .map(item => asRecord(item))
    .filter(item => typeof item.date === 'string');
  const next = holidays.find(item => new Date(`${asString(item.date)}T12:00:00Z`).getTime() >= now.getTime()) || holidays[holidays.length - 1] || {};
  return {
    ok: true,
    kind: 'radar_brasil',
    title: 'Proximo feriado nacional',
    summary: `${asString(next.name)} em ${asString(next.date)}.`,
    facts: [
      { label: 'Feriado', value: asString(next.name) },
      { label: 'Data', value: asString(next.date) },
      { label: 'Tipo', value: asString(next.type, 'national') },
    ],
    source: 'BrasilAPI Feriados',
    generatedAt: new Date().toISOString(),
    safety: 'Calendario publico nacional. Confirme feriados estaduais/municipais localmente.',
  };
}

async function radarBrasilReport(): Promise<MythosExternalDataReport> {
  const [finance, ibov, weather, holiday] = await Promise.all([
    financeReport(''),
    optionalReport('Brapi - Ibovespa', () => b3Report('^BVSP')),
    optionalReport('Open-Meteo - Brasilia', () => weatherReport('brasilia')),
    optionalReport('BrasilAPI - feriados', () => nextBrazilHolidayReport()),
  ]);

  const ibovText = isUnavailableReport(ibov)
    ? 'Ibovespa indisponivel na Brapi nesta leitura.'
    : `${ibov.title}: ${findFact(ibov, 'Preco')} / ${findFact(ibov, 'Variacao')}`;
  const weatherText = isUnavailableReport(weather)
    ? 'Clima de Brasilia indisponivel agora.'
    : `${weather.title}: ${weather.summary}`;
  const holidayText = isUnavailableReport(holiday)
    ? 'Calendario nacional indisponivel agora.'
    : `${findFact(holiday, 'Feriado')} em ${findFact(holiday, 'Data')}`;

  return {
    ok: true,
    kind: 'radar_brasil',
    title: 'Radar Brasil',
    summary: `${finance.summary} ${ibovText} ${weatherText}`,
    facts: [
      { label: 'Macro Brasil/EUA', value: finance.summary },
      { label: 'Bolsa brasileira', value: ibovText },
      { label: 'Clima institucional', value: weatherText },
      { label: 'Calendario publico', value: holidayText },
      { label: 'Dados publicos', value: 'Portal da Transparencia esta disponivel por identificador: orgao SIAFI, numero, processo ou CNPJ.' },
      { label: 'Leitura Mythos', value: 'Radar de contexto. Use para orientar pesquisa, risco e pauta do dia, nao para executar decisoes financeiras automaticamente.' },
    ],
    source: 'Banco Central do Brasil + FRED + Brapi + Open-Meteo + BrasilAPI',
    generatedAt: new Date().toISOString(),
    safety: 'Radar somente leitura. Nao compra, vende, assina, faz PIX, abre ordem, agenda pagamento ou movimenta fundos.',
    nextStep: 'Aprofunde um bloco com /financeiro petr4, /tempo brasilia, /transparencia contrato orgao 26298 ou /market report.',
  };
}

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

function cleanPoliticalRadarText(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2600);
}

function politicalRadarSourceMatrix(mode: string) {
  const base = [
    'TSE/TRE: candidaturas, partido, bens declarados, contas eleitorais e situacao eleitoral.',
    'Portal da Transparencia: CEIS, CNEP, contratos, convenios, licitacoes e fornecedores quando aplicavel.',
    'CGU: CEAF, punicoes, acordos de leniencia e dados de controle federal.',
    'Camara/Senado APIs: votacoes, presencas, proposicoes, emendas e atividade parlamentar quando aplicavel.',
    'IBGE: populacao, PIB municipal, territorio e indicadores do municipio quando aplicavel.',
    'SICONFI/Tesouro: orcamento municipal, execucao fiscal, receitas, despesas e endividamento quando aplicavel.',
    'Google News/web search: noticias recentes, investigacoes, escandalos alegados e contexto jornalistico.',
  ];
  if (mode === 'municipal') {
    return [
      ...base,
      'TCE estadual/municipal: contas municipais, obras, alertas, julgamentos e irregularidades apontadas. Exemplo: TCE-PE para Pernambuco, TCM-SP para Sao Paulo.',
      'Prefeitura/Camara municipal: portal da transparencia local, diario oficial, licitacoes e contratos.',
    ];
  }
  if (mode === 'eleitoral') {
    return [
      ...base,
      'TRE local: registro de candidatura, impugnacoes, prestacao de contas e contexto eleitoral estadual.',
      'TSE DivulgaCand/DivulgaContas: declaracao de bens, receitas, despesas e doadores quando disponivel.',
    ];
  }
  return [
    ...base,
    'Tribunais de contas e justica: somente citar processos, contas ou decisoes quando a busca encontrar fonte identificavel.',
  ];
}

function politicalRadarMode(query: string) {
  if (/\b(prefeitura|municipio|munic[ií]pio|cidade|vereador|camara|c[âa]mara)\b/i.test(query)) return 'municipal';
  if (/\b(eleicao|elei[cç][aã]o|eleicoes|elei[cç][oõ]es|2026|candidato|campanha)\b/i.test(query)) return 'eleitoral';
  if (/\b(deputado|senador|governador|ministro|presidente|partido|politico|pol[ií]tico)\b/i.test(query)) return 'perfil_publico';
  return 'radar_publico';
}

async function anthropicPoliticalRadar(query: string) {
  const apiKey = getEnv(['ANTHROPIC_API_KEY']);
  if (!apiKey) throw new Error('Configure ANTHROPIC_API_KEY no Railway para usar o Radar Politico com busca web.');

  const response = await fetch(ANTHROPIC_MESSAGES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MYTHOS_RADAR_POLITICO_MODEL?.trim() || 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        },
      ],
      system: [
        'Voce e o Radar Politico BR dentro do Mythos.',
        'Use web search puro para analisar apenas informacoes publicas e verificaveis.',
        'Responda em portugues brasileiro, com tom claro e util.',
        'Nao acuse crime, corrupcao ou irregularidade sem fonte oficial e linguagem cautelosa.',
        'Quando falar de risco, use termos como "ponto de atencao", "precisa verificar" e "sinal publico", nunca condenacao.',
        'Dados de web search podem ter defasagem de horas ou dias. Avise isso no limite.',
        'Matriz obrigatoria de fontes a tentar, conforme aplicavel:',
        ...politicalRadarSourceMatrix(politicalRadarMode(query)),
        'Formato obrigatorio sem markdown pesado, sem tabela e sem emoji:',
        'Resumo: uma leitura curta.',
        'Identidade publica: cargo, partido, localidade, periodo ou entidade analisada quando encontrado.',
        'Historico eleitoral: candidatura, resultado, bens declarados, contas ou fonte TSE/TRE quando aplicavel.',
        'Patrimonio e declaracoes: bens declarados, evolucao aparente ou "nao encontrado nesta busca".',
        'Contratos e licitacoes: CEIS/CNEP/Portal da Transparencia/portal local; diga se nao encontrou ligacao direta.',
        'Contas publicas e obras: TCE/TCU/SICONFI/Tesouro/IBGE; destaque apenas sinais publicos.',
        'Noticias recentes: fatos recentes, investigacoes ou controversias com linguagem cautelosa.',
        'Riscos e limites: o que ainda precisa checar e onde pode haver defasagem.',
        'Fontes a verificar: liste 5 a 8 fontes especificas ou tipos de fonte.',
        'Proximo passo: uma acao segura de pesquisa.',
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `Analise este tema politico brasileiro com fontes publicas: ${query}`,
        },
      ],
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({})) as AnthropicMessageResponse;
  const text = (data.content || [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim();

  if (!response.ok || !text) {
    throw new Error(data.error?.message || `Radar Politico web search failed with HTTP ${response.status}.`);
  }
  return cleanPoliticalRadarText(text);
}

async function radarPoliticoReport(query: string): Promise<MythosExternalDataReport> {
  const target = query.trim().replace(/^politico\s+/i, '').replace(/^pol[ií]tico\s+/i, '').trim();
  if (!target) {
    throw new Error('Use /radar politico <nome, cidade, prefeitura, candidato ou tema>. Exemplo: /radar politico prefeitura de sao paulo');
  }

  const mode = politicalRadarMode(target);
  const analysis = await anthropicPoliticalRadar(target);
  const firstLine = analysis.split('\n').map(line => line.trim()).find(Boolean) || `Radar publico para ${target}.`;

  return {
    ok: true,
    kind: 'radar_politico',
    title: `Radar Politico BR: ${target}`,
    summary: analysis,
    facts: [
      { label: 'Consulta', value: target },
      { label: 'Modo', value: mode },
      { label: 'Fonte principal', value: 'Anthropic web_search com fontes publicas' },
      { label: 'Resumo curto', value: firstLine.replace(/^Resumo:\s*/i, '') },
      { label: 'Padrao de seguranca', value: 'Nao acusa irregularidade sem fonte oficial, documento e contexto.' },
    ],
    source: 'Radar Politico BR model + Anthropic web_search + fontes publicas brasileiras',
    generatedAt: new Date().toISOString(),
    safety: 'Analise politica somente leitura. Pode conter informacoes publicas recentes, mas exige verificacao em fonte oficial antes de conclusao, publicacao ou decisao.',
    nextStep: 'Aprofunde com TSE, Portal da Transparencia, TCU/CGU, camara/senado, prefeitura/governo estadual ou imprensa reconhecida.',
  };
}

async function transparenciaReport(query: string): Promise<MythosExternalDataReport> {
  if (!query.trim()) throw new Error('Use /transparencia contrato <orgao|numero|processo|cnpj>. Exemplo: /transparencia contrato orgao 26298');
  const key = getEnv(['TRANSPARENCIA_KEY', 'TRANSPARENCIA_API_KEY', 'PORTAL_TRANSPARENCIA_API_KEY']);
  if (!key) throw new Error('Configure TRANSPARENCIA_KEY no Railway para usar o Portal da Transparencia.');
  const term = query.replace(/^contrato\s+/i, '').trim();

  let url = '';
  let mode = 'parametro';
  const cnpj = onlyDigits(term);
  const orgao = term.match(/\borgao\s+(\d{4,10})\b/i)?.[1] || term.match(/\borgao[:=]\s*(\d{4,10})\b/i)?.[1];
  const numero = term.match(/\bnumero\s+([a-z0-9./-]{3,40})\b/i)?.[1] || term.match(/\bcontrato\s+([a-z0-9./-]{3,40})\b/i)?.[1];
  const processo = term.match(/\bprocesso\s+([a-z0-9./-]{3,60})\b/i)?.[1];

  if (cnpj.length === 14) {
    mode = 'cpf/cnpj fornecedor';
    url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/cpf-cnpj?cpfCnpj=${encodeURIComponent(cnpj)}&pagina=1`;
  } else if (processo) {
    mode = 'processo';
    url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/processo?processo=${encodeURIComponent(processo)}&pagina=1`;
  } else if (numero) {
    mode = 'numero do contrato';
    url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos/numero?numero=${encodeURIComponent(numero)}&pagina=1`;
  } else if (orgao) {
    mode = 'codigoOrgao SIAFI';
    url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?codigoOrgao=${encodeURIComponent(orgao)}&pagina=1`;
  } else {
    return {
      ok: true,
      kind: 'transparencia',
      title: 'Portal da Transparencia precisa de um identificador',
      summary: 'A API oficial de contratos nao pesquisa por palavra solta. Ela exige codigoOrgao SIAFI, numero do contrato, numero do processo ou CPF/CNPJ do fornecedor.',
      facts: [
        { label: 'Consulta recebida', value: term || 'vazia' },
        { label: 'Exemplo por orgao', value: '/transparencia contrato orgao 26298' },
        { label: 'Exemplo por CNPJ', value: '/transparencia contrato 00000000000191' },
        { label: 'Exemplo por processo', value: '/transparencia contrato processo 00190.000000/2024-00' },
      ],
      source: 'Portal da Transparencia API - Swagger oficial',
      generatedAt: new Date().toISOString(),
      safety: 'Dado publico. O Mythos nao acusa irregularidade sem documento, periodo e contexto.',
      nextStep: 'Informe codigoOrgao, numero, processo ou CNPJ para a consulta real de contratos.',
    };
  }

  const rows = asArray(await fetchJson(url, { headers: { 'chave-api-dados': key } }));
  const first = asRecord(rows[0]);
  return {
    ok: true,
    kind: 'transparencia',
    title: rows.length ? `Contratos encontrados por ${mode}` : `Nenhum contrato encontrado por ${mode}`,
    summary: rows.length
      ? `Encontrei ${rows.length} resultado(s) iniciais. Primeiro registro: ${asString(first.objeto || first.descricao || first.numero, 'sem descricao no retorno')}.`
      : 'O Portal da Transparencia respondeu sem contratos para esse termo nesta consulta.',
    facts: [
      { label: 'Parametro', value: term },
      { label: 'Modo', value: mode },
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
    [/^\/(?:financeiro|macro|radar financeiro)(?:\s+(.+))?$/i, 'finance'],
    [/^\/(?:radar brasil|brasil radar|radar br)\s*$/i, 'radar_brasil'],
    [/^\/(?:radar politico|radar pol[ií]tico|politica|pol[ií]tica)\s+(.+)/i, 'radar_politico'],
    [/^\/transparencia\s+(.+)/i, 'transparencia'],
  ];
  for (const [regex, kind] of matchers) {
    const match = trimmed.match(regex);
    if (match) return { kind, query: match[1] || '' };
  }

  const naturalWeather = trimmed.match(/\b(?:tempo|clima|previs[aã]o)\s+(?:(?:em|de|para)\s+)?(.{2,80})$/i);
  if (naturalWeather) return { kind: 'weather', query: naturalWeather[1].trim() };

  const naturalCep = trimmed.match(/\bcep\s+(\d{5}-?\d{3})\b/i);
  if (naturalCep) return { kind: 'cep', query: naturalCep[1] };

  const naturalCnpj = trimmed.match(/\bcnpj\s+([\d./-]{14,20})\b/i);
  if (naturalCnpj) return { kind: 'cnpj', query: naturalCnpj[1] };

  const naturalB3 = trimmed.match(/\b(?:b3|acao|a[cç][aã]o|bolsa)\s+(?:da|de|do)?\s*([a-z]{4}\d{1,2})\b/i);
  if (naturalB3) return { kind: 'b3', query: naturalB3[1].toUpperCase() };

  const naturalTransparencia = trimmed.match(/\b(?:transparencia|transpar[êe]ncia|contrato publico|contrato p[úu]blico)\s+(?:(?:sobre|de|do|da|por)\s+)?(.{3,100})$/i);
  if (naturalTransparencia) return { kind: 'transparencia', query: naturalTransparencia[1].trim() };

  const naturalPoliticalRadar = trimmed.match(/\b(?:radar politico|radar pol[ií]tico|analise politica|an[aá]lise pol[ií]tica|risco politico|risco pol[ií]tico)\s+(?:(?:sobre|de|do|da|para)\s+)?(.{3,120})$/i);
  if (naturalPoliticalRadar) return { kind: 'radar_politico', query: naturalPoliticalRadar[1].trim() };

  const naturalPublicOffice = trimmed.match(/\b(?:analise|an[aá]lise|pesquise|investigue|verifique)\s+(?:a|o|sobre)?\s*(prefeitura|camara|c[aâ]mara|vereador|deputado|senador|governador|candidato|elei[cç][aã]o|elei[cç][oõ]es|politico|pol[ií]tico)\s+(.{2,120})$/i);
  if (naturalPublicOffice) return { kind: 'radar_politico', query: `${naturalPublicOffice[1]} ${naturalPublicOffice[2]}`.trim() };

  if (/\b(selic|taxa selic)\b/i.test(trimmed)) return { kind: 'selic', query: '' };
  if (/\b(ipca|inflacao|infla[cç][aã]o)\b/i.test(trimmed)) return { kind: 'ipca', query: '' };
  if (/\b(dolar|d[oó]lar|usd|cambio|c[âa]mbio)\b/i.test(trimmed)) return { kind: 'dolar', query: '' };
  if (/\b(fed|federal reserve|juros americanos|taxa americana)\b/i.test(trimmed)) return { kind: 'fed', query: '' };
  if (/\b(radar brasil|brasil radar|macro brasil)\b/i.test(trimmed)) return { kind: 'radar_brasil', query: '' };
  if (/\b(radar financeiro|cenario financeiro|cen[aá]rio financeiro|macro)\b/i.test(trimmed)) return { kind: 'finance', query: '' };

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
  if (kind === 'finance') return financeReport(query);
  if (kind === 'radar_brasil') return radarBrasilReport();
  if (kind === 'radar_politico') return radarPoliticoReport(query);
  if (kind === 'transparencia') return transparenciaReport(query);
  throw new Error('Comando de dados nao suportado.');
}
