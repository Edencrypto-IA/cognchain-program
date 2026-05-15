import { NextRequest, NextResponse } from 'next/server';
import { callModel } from '@/services/ai';
import {
  WALLET_AGENT_AI_PARSER_SYSTEM,
  createLocalParsedIntent,
  createWalletAgentParserPrompt,
  detectWalletAgentIntent,
  parseWalletAgentAiJson,
} from '@/features/wallet-agent';
import { Limits, checkRateLimit, safeErrorMessage, sanitizeString, validateModel } from '@/lib/security';

const PARSER_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Wallet Agent parser timeout')), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/wallet-agent/parse');

    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const prompt = sanitizeString(body.prompt, Limits.MAX_PROMPT_LENGTH, 'prompt');
    const model = validateModel(body.model || 'nvidia');
    const localDetection = detectWalletAgentIntent(prompt);
    const localParsedIntent = createLocalParsedIntent(localDetection);

    if (!localDetection.isFinancialCommand) {
      return NextResponse.json({
        parsedIntent: localParsedIntent,
        localDetection,
        parser: 'local',
        fallback: true,
      });
    }

    try {
      const parserPrompt = createWalletAgentParserPrompt(prompt, localDetection);
      const result = await withTimeout(
        callModel({
          model,
          messages: [{ role: 'user', content: parserPrompt }],
          systemPrompt: WALLET_AGENT_AI_PARSER_SYSTEM,
          useContext: false,
        }),
        PARSER_TIMEOUT_MS
      );
      const parsedIntent = parseWalletAgentAiJson(result.content, localDetection);

      return NextResponse.json({
        parsedIntent,
        localDetection,
        parser: 'ai',
        fallback: false,
      });
    } catch (error) {
      console.warn('[wallet-agent:parse] AI parser fallback', error);

      return NextResponse.json({
        parsedIntent: {
          ...localParsedIntent,
          source: 'fallback',
          notes: [...localParsedIntent.notes, 'AI parser unavailable; using local detector fallback.'],
        },
        localDetection,
        parser: 'fallback',
        fallback: true,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
