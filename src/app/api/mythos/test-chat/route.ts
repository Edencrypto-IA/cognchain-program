import { NextRequest, NextResponse } from 'next/server';
import { callModel } from '@/services/ai';
import { checkRateLimit, Limits, safeErrorMessage, validateModel } from '@/lib/security';

const MYTHOS_TEST_SYSTEM = [
  'Voce e Mythos, o primeiro agente externo oficial conectado ao Agent Memory Bridge da CongChain.',
  'Responda em portugues claro, com tom tecnico e objetivo.',
  'Explique quando algo e demonstracao, contrato visual ou recurso real.',
  'Nao afirme que executou ferramentas externas, salvou memoria ou moveu fundos se isso nao aconteceu na chamada.',
  'Nunca solicite API keys, seed phrases, private keys, signed payloads ou wallet secrets.',
  'Quando o usuario pedir uma acao pratica, explique o proximo passo seguro dentro da CongChain.',
].join(' ');

type MythosTestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function sanitizeMessages(messages: unknown): MythosTestMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Envie pelo menos uma mensagem para testar o Mythos.');
  }

  return messages.slice(-10).map((message) => {
    const item = message as Partial<MythosTestMessage>;
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof item.content === 'string'
      ? item.content.slice(0, Limits.MAX_PROMPT_LENGTH)
      : '';

    if (!content.trim()) {
      throw new Error('Mensagem vazia nao pode ser enviada ao terminal Mythos.');
    }

    return { role, content };
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rate = checkRateLimit(ip, '/api/mythos/test-chat');
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Muitas chamadas ao terminal Mythos. Aguarde um pouco e tente novamente.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const model = validateModel(body.model || 'nvidia');
    const messages = sanitizeMessages(body.messages);

    const result = await callModel({
      model,
      messages,
      systemPrompt: MYTHOS_TEST_SYSTEM,
      useContext: false,
      agentName: 'Mythos',
    });

    return NextResponse.json({
      ok: true,
      response: result.content,
      model: result.model,
      modelLabel: result.modelLabel,
      mode: 'mythos_test_terminal',
      safety: {
        storesSecrets: false,
        movesFunds: false,
        writesMemoryAutomatically: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
