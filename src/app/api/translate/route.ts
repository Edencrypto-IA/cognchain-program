import { NextResponse, NextRequest } from 'next/server';
import { checkRateLimit, Limits, safeErrorMessage } from '@/lib/security';
import { callModel } from '@/services/ai';

const LANG_MAP: Record<string, string> = {
  pt: 'Português (Brasil)',
  en: 'English',
  zh: 'Chinese (Simplified)',
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rate = checkRateLimit(ip, '/api/translate');
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
    }

    const { messages, targetLang } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }
    if (messages.length > Limits.MAX_TRANSLATE_MESSAGES) {
      return NextResponse.json({ error: `Max ${Limits.MAX_TRANSLATE_MESSAGES} messages` }, { status: 400 });
    }
    if (!targetLang || !LANG_MAP[targetLang]) {
      return NextResponse.json({ error: `targetLang must be: ${Object.keys(LANG_MAP).join(', ')}` }, { status: 400 });
    }

    const langName = LANG_MAP[targetLang];
    const batchText = messages
      .map((m: { role: string; content: string }, i: number) =>
        `[${i}] (${m.role === 'user' ? 'USER' : 'ASSISTANT'}): ${m.content}`
      )
      .join('\n---\n');

    const result = await callModel({
      model: 'gpt',
      messages: [{ role: 'user', content: batchText }],
      systemPrompt: `You are a professional translator. Translate ALL messages below to ${langName}.
Rules:
- Translate every message (USER and ASSISTANT).
- Preserve formatting, line breaks, and code blocks.
- Keep technical terms (CONGCHAIN, Solana, blockchain, hash, API) as-is.
- Return ONLY translated messages in the exact same format: [INDEX] (ROLE): translated content
- Separate entries with ---
- Do NOT add explanations or extra text.`,
    });

    const translated = result.content;

    const translatedMessages = messages.map((m: { role: string; content: string }, i: number) => {
      const roleLabel = m.role === 'user' ? 'USER' : 'ASSISTANT';
      const primary = new RegExp(
        `\\[${i}\\]\\s*\\(${roleLabel}\\):\\s*([\\s\\S]*?)(?=\\n---\\n|\\[\\d+\\]|$)`,
        'i'
      );
      const fallback = new RegExp(
        `\\[${i}\\]\\s*\\([^)]*\\):\\s*([\\s\\S]*?)(?=\\n---\\n|\\[\\d+\\]|$)`,
        'i'
      );
      const match = translated.match(primary) ?? translated.match(fallback);
      return { ...m, content: match ? match[1].trim() : m.content };
    });

    return NextResponse.json({ translatedMessages });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
