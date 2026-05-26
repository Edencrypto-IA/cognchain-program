const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';

export type JupiterKnownToken = {
  symbol: string;
  mint: string;
  decimals: number;
};

export type JupiterQuoteRequest = {
  inputSymbol: string;
  outputSymbol: string;
  amountUi: number;
  slippageBps?: number;
};

export type JupiterQuoteSummary = {
  inputSymbol: string;
  outputSymbol: string;
  inputMint: string;
  outputMint: string;
  amountUi: number;
  amountRaw: string;
  outAmountRaw: string;
  otherAmountThresholdRaw?: string;
  slippageBps: number;
  priceImpactPct?: string;
  routePlanCount: number;
  swapMode?: string;
  contextSlot?: number;
  timeTaken?: number;
  safety: {
    readOnlyQuote: true;
    transactionPayloadCreated: false;
    walletSignatureRequested: false;
    submittedToSolana: false;
  };
};

type JupiterQuoteResponse = {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  swapMode?: string;
  slippageBps?: number;
  priceImpactPct?: string;
  routePlan?: unknown[];
  contextSlot?: number;
  timeTaken?: number;
  error?: string;
};

export const JUPITER_KNOWN_TOKENS: Record<string, JupiterKnownToken> = {
  SOL: {
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  USDC: {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY9P5n1r5M9h8nA',
    decimals: 6,
  },
  JUP: {
    symbol: 'JUP',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
  },
  BONK: {
    symbol: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3ymDMPKQZV1YBzZkK3M4n3FQV7R',
    decimals: 5,
  },
};

function toRawAmount(amountUi: number, decimals: number) {
  if (!Number.isFinite(amountUi) || amountUi <= 0) {
    throw new Error('Amount must be a positive number.');
  }

  return String(Math.round(amountUi * 10 ** decimals));
}

function tokenFor(symbol: string) {
  const token = JUPITER_KNOWN_TOKENS[symbol.toUpperCase()];
  if (!token) throw new Error(`Unsupported Jupiter token: ${symbol}`);
  return token;
}

export async function getJupiterQuote(input: JupiterQuoteRequest): Promise<JupiterQuoteSummary> {
  const inputToken = tokenFor(input.inputSymbol);
  const outputToken = tokenFor(input.outputSymbol);
  const slippageBps = Math.min(500, Math.max(1, Math.round(input.slippageBps ?? 50)));
  const amountRaw = toRawAmount(input.amountUi, inputToken.decimals);
  const url = new URL(JUPITER_QUOTE_URL);

  url.searchParams.set('inputMint', inputToken.mint);
  url.searchParams.set('outputMint', outputToken.mint);
  url.searchParams.set('amount', amountRaw);
  url.searchParams.set('slippageBps', String(slippageBps));

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json().catch(() => ({})) as JupiterQuoteResponse;

  if (!response.ok || data.error || !data.outAmount) {
    throw new Error(data.error || `Jupiter quote failed with status ${response.status}.`);
  }

  return {
    inputSymbol: inputToken.symbol,
    outputSymbol: outputToken.symbol,
    inputMint: data.inputMint || inputToken.mint,
    outputMint: data.outputMint || outputToken.mint,
    amountUi: input.amountUi,
    amountRaw: data.inAmount || amountRaw,
    outAmountRaw: data.outAmount,
    otherAmountThresholdRaw: data.otherAmountThreshold,
    slippageBps: data.slippageBps ?? slippageBps,
    priceImpactPct: data.priceImpactPct,
    routePlanCount: Array.isArray(data.routePlan) ? data.routePlan.length : 0,
    swapMode: data.swapMode,
    contextSlot: data.contextSlot,
    timeTaken: data.timeTaken,
    safety: {
      readOnlyQuote: true,
      transactionPayloadCreated: false,
      walletSignatureRequested: false,
      submittedToSolana: false,
    },
  };
}
