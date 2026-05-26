/**
 * Solscan API Client
 *
 * Authenticated helper for the Solscan Pro REST API (v2.0).
 * Uses SOLSCAN_API_KEY from environment variables.
 *
 * Base URL: https://pro-api.solscan.io/v2.0
 * Auth:     `token` request header
 *
 * All functions are read-only and safe to call from server-side
 * Next.js routes or services. No wallet signing, no fund movement.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SolscanAccountDetail {
  sol_balance?: number;
  lamports?: number;
  token_count?: number;
  total_value?: number;
  type?: string;
  owner_program?: string;
  is_oncurve?: boolean;
}

export interface SolscanTokenEntry {
  token_address?: string;
  token_name?: string;
  token_symbol?: string;
  amount?: number | string;
  value?: number;
}

export interface SolscanAccountPortfolio {
  total_value?: number;
  tokens?: SolscanTokenEntry[];
}

export interface SolscanTransactionEntry {
  trans_id?: string;
  block_time?: number;
  activity_type?: string;
  token_address?: string;
  amount?: number | string;
  value?: number;
}

export interface SolscanTokenMeta {
  symbol?: string;
  name?: string;
  icon?: string;
  website?: string;
  twitter?: string;
  decimals?: number;
  holder?: number;
  supply?: string;
  price?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change_24h?: number;
}

export interface SolscanTokenHolder {
  address?: string;
  amount?: string;
  decimals?: number;
  owner?: string;
  rank?: number;
}

export interface SolscanTransactionDetail {
  trans_id?: string;
  block_time?: number;
  slot?: number;
  fee?: number;
  status?: string;
  signer?: string[];
  token_balances?: Array<{
    token_address?: string;
    token_symbol?: string;
    pre_balance?: string;
    post_balance?: string;
    change_type?: string;
    change_amount?: string;
  }>;
  sol_bal_change?: Array<{
    address?: string;
    pre_balance?: number;
    post_balance?: number;
    change_amount?: number;
  }>;
  parsed_instructions?: Array<{
    type?: string;
    program?: string;
    program_id?: string;
  }>;
}

export interface SolscanApiError {
  success: false;
  errors?: {
    code?: number;
    message?: string;
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://pro-api.solscan.io/v2.0';
const DEFAULT_TIMEOUT_MS = 12_000;

function baseUrl(): string {
  return (process.env.SOLSCAN_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function apiKey(): string | undefined {
  return process.env.SOLSCAN_API_KEY;
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

/**
 * Make an authenticated GET request to the Solscan Pro API.
 *
 * @param path    API path, e.g. `/account/detail`
 * @param params  Query parameters as a key→string|number record
 * @returns       Parsed JSON response typed as `T`
 * @throws        `SolscanError` on HTTP errors, timeouts, or missing API key
 */
export async function solscanGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new SolscanError('SOLSCAN_API_KEY is not configured', 401);
  }

  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      token: key,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SolscanError(
      `Solscan ${path} returned non-JSON response (HTTP ${response.status})`,
      response.status,
    );
  }

  if (!response.ok) {
    const errData = data as SolscanApiError | null;
    const message =
      errData?.errors?.message ||
      `Solscan ${path} failed with HTTP ${response.status}`;
    throw new SolscanError(message, response.status);
  }

  return data as T;
}

// ── Custom error ──────────────────────────────────────────────────────────────

export class SolscanError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'SolscanError';
    this.statusCode = statusCode;
  }
}

// ── Account helpers ───────────────────────────────────────────────────────────

/**
 * Fetch account detail for a Solana address.
 * Returns SOL balance, token count, total portfolio value, and account type.
 */
export async function getAccountDetail(
  address: string,
): Promise<{ success: boolean; data?: SolscanAccountDetail }> {
  return solscanGet('/account/detail', { address });
}

/**
 * Fetch the token portfolio for a Solana address.
 * Returns a list of SPL tokens with balances and USD values.
 */
export async function getAccountPortfolio(
  address: string,
): Promise<{ success: boolean; data?: SolscanAccountPortfolio | SolscanTokenEntry[] }> {
  return solscanGet('/account/portfolio', { address });
}

/**
 * Fetch recent transactions for a Solana address.
 *
 * @param address   Solana public key (base58)
 * @param page      Page number (1-based, default 1)
 * @param pageSize  Results per page (default 10, max 40)
 */
export async function getAccountTransactions(
  address: string,
  page = 1,
  pageSize = 10,
): Promise<{ success: boolean; data?: SolscanTransactionEntry[] }> {
  return solscanGet('/account/transactions', {
    address,
    page,
    page_size: pageSize,
    sort_by: 'block_time',
    sort_order: 'desc',
  });
}

// ── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch metadata for a token mint address.
 * Returns symbol, name, price, market cap, volume, and social links.
 */
export async function getTokenMeta(
  address: string,
): Promise<{ success: boolean; data?: SolscanTokenMeta }> {
  return solscanGet('/token/meta', { address });
}

/**
 * Fetch the top token holders for a mint address.
 *
 * @param address   Token mint address (base58)
 * @param page      Page number (1-based, default 1)
 * @param pageSize  Results per page (default 10, max 40)
 */
export async function getTokenHolders(
  address: string,
  page = 1,
  pageSize = 10,
): Promise<{ success: boolean; data?: SolscanTokenHolder[] }> {
  return solscanGet('/token/holders', {
    address,
    page,
    page_size: pageSize,
  });
}

// ── Transaction helpers ───────────────────────────────────────────────────────

/**
 * Fetch the detail of a single transaction by signature.
 * Returns fee, status, signers, token balance changes, and parsed instructions.
 */
export async function getTransactionDetail(
  signature: string,
): Promise<{ success: boolean; data?: SolscanTransactionDetail }> {
  return solscanGet('/transaction/detail', { tx: signature });
}

// ── Composite snapshot ────────────────────────────────────────────────────────

export interface SolscanAccountSnapshot {
  address: string;
  detail: SolscanAccountDetail | null;
  portfolio: SolscanAccountPortfolio | SolscanTokenEntry[] | null;
  recentTransactions: SolscanTransactionEntry[];
  fetchedAt: string;
}

/**
 * Fetch a combined account snapshot: detail + portfolio + recent transactions.
 * All three requests run in parallel. Individual failures are swallowed so a
 * partial result is always returned.
 */
export async function getAccountSnapshot(
  address: string,
): Promise<SolscanAccountSnapshot> {
  const [detail, portfolio, transactions] = await Promise.allSettled([
    getAccountDetail(address),
    getAccountPortfolio(address),
    getAccountTransactions(address, 1, 10),
  ]);

  return {
    address,
    detail:
      detail.status === 'fulfilled' ? (detail.value.data ?? null) : null,
    portfolio:
      portfolio.status === 'fulfilled' ? (portfolio.value.data ?? null) : null,
    recentTransactions:
      transactions.status === 'fulfilled'
        ? (transactions.value.data ?? [])
        : [],
    fetchedAt: new Date().toISOString(),
  };
}
