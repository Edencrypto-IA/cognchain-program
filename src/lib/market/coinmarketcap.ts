/**
 * CoinMarketCap API client.
 *
 * Server-side only. Uses COINMARKETCAP_API_KEY from environment variables.
 * Read-only market metadata, quotes, and market-pair lookups.
 */

const DEFAULT_BASE_URL = 'https://pro-api.coinmarketcap.com';
const DEFAULT_TIMEOUT_MS = 12_000;

export type CoinMarketCapQuoteUsd = {
  price?: number;
  market_cap?: number;
  volume_24h?: number;
  percent_change_24h?: number;
  fully_diluted_market_cap?: number;
  last_updated?: string;
};

export type CoinMarketCapTokenInfo = {
  id?: number;
  name?: string;
  symbol?: string;
  slug?: string;
  logo?: string;
  description?: string;
  date_added?: string;
  urls?: Record<string, string[]>;
  platform?: {
    id?: number;
    name?: string;
    symbol?: string;
    token_address?: string;
  } | null;
  contract_address?: Array<{
    contract_address?: string;
    platform?: {
      id?: number;
      name?: string;
      symbol?: string;
      coin?: { id?: number; name?: string; symbol?: string; slug?: string };
    };
  }>;
};

export type CoinMarketCapQuote = {
  id?: number;
  name?: string;
  symbol?: string;
  slug?: string;
  cmc_rank?: number;
  num_market_pairs?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number | null;
  infinite_supply?: boolean;
  quote?: {
    USD?: CoinMarketCapQuoteUsd;
  };
};

export type CoinMarketCapMarketPair = {
  exchange?: {
    id?: number;
    name?: string;
    slug?: string;
  };
  market_pair?: string;
  market_url?: string;
  category?: string;
  fee_type?: string;
};

export class CoinMarketCapError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'CoinMarketCapError';
    this.statusCode = statusCode;
  }
}

function baseUrl(): string {
  return (process.env.COINMARKETCAP_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function apiKey(): string | undefined {
  return process.env.COINMARKETCAP_API_KEY;
}

async function cmcGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new CoinMarketCapError('COINMARKETCAP_API_KEY is not configured', 401);
  }

  const url = new URL(`${baseUrl()}${path}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, String(value)));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': key,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => null) as T | { status?: { error_message?: string } } | null;
  if (!response.ok || !data) {
    const message = data && 'status' in data && data.status?.error_message
      ? data.status.error_message
      : `CoinMarketCap ${path} failed with HTTP ${response.status}`;
    throw new CoinMarketCapError(message, response.status);
  }

  return data as T;
}

function firstRecord<T>(data: unknown): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as T | undefined) || null;
  if (typeof data === 'object') {
    const values = Object.values(data as Record<string, T | T[]>).flat();
    return (values[0] as T | undefined) || null;
  }
  return null;
}

export async function getCoinMarketCapInfoByAddress(address: string): Promise<CoinMarketCapTokenInfo | null> {
  const response = await cmcGet<{ data?: unknown }>('/v2/cryptocurrency/info', { address });
  return firstRecord<CoinMarketCapTokenInfo>(response.data);
}

export async function getCoinMarketCapQuoteById(id: number): Promise<CoinMarketCapQuote | null> {
  const response = await cmcGet<{ data?: unknown }>('/v2/cryptocurrency/quotes/latest', { id });
  return firstRecord<CoinMarketCapQuote>(response.data);
}

export async function getCoinMarketCapMarketPairsById(id: number, limit = 8): Promise<CoinMarketCapMarketPair[]> {
  const response = await cmcGet<{ data?: { market_pairs?: CoinMarketCapMarketPair[] } }>(
    '/v2/cryptocurrency/market-pairs/latest',
    { id, limit: Math.min(20, Math.max(1, limit)) },
  );
  return response.data?.market_pairs || [];
}
