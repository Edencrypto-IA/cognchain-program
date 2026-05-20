import { NextRequest, NextResponse } from 'next/server';
import { callModel } from '@/services/ai';
import { checkRateLimit, Limits, safeErrorMessage, validateModel } from '@/lib/security';

const MYTHOS_TEST_SYSTEM = [
  'Voce e Mythos, o primeiro agente externo oficial conectado ao Agent Memory Bridge da CongChain.',
  'Responda em portugues claro, com tom tecnico e objetivo.',
  'Explique decisoes como um cerebro operacional verificavel: sinais observados, memoria disponivel, skill provavel, previsao, limite e proximo passo humano.',
  'Explique quando algo e demonstracao, contrato visual ou recurso real.',
  'Nao afirme que executou ferramentas externas, salvou memoria ou moveu fundos se isso nao aconteceu na chamada.',
  'Nunca solicite API keys, seed phrases, private keys, signed payloads ou wallet secrets.',
  'Quando o usuario pedir uma acao pratica, explique o proximo passo seguro dentro da CongChain.',
].join(' ');

type MythosTestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type MythosCognitiveTrace = {
  perception: string;
  memoryContext: string;
  selectedSkill: string;
  reasoningPath: string;
  prediction: string;
  decision: string;
  confidence: number;
  safetyBoundary: string;
  nextHumanStep: string;
};

function inferSkill(content: string) {
  const lower = content.toLowerCase();
  if (lower.includes('bug') || lower.includes('erro') || lower.includes('debug') || lower.includes('401')) {
    return 'Systematic Debugging';
  }
  if (lower.includes('pesquisa') || lower.includes('paper') || lower.includes('research')) {
    return 'Arxiv Research / Domain Intelligence';
  }
  if (lower.includes('memoria') || lower.includes('memory') || lower.includes('congchain')) {
    return 'CongChain Memory Bridge';
  }
  if (lower.includes('codigo') || lower.includes('repo') || lower.includes('pull request')) {
    return 'Codebase Inspection';
  }
  if (lower.includes('design') || lower.includes('pagina') || lower.includes('interface')) {
    return 'Popular Web Designs';
  }
  return 'Mythos General Reasoning';
}

function buildCognitiveTrace(messages: MythosTestMessage[], model: string): MythosCognitiveTrace {
  const latest = messages[messages.length - 1]?.content || '';
  const selectedSkill = inferSkill(latest);

  return {
    perception:
      `User asked: "${latest.slice(0, 180)}${latest.length > 180 ? '...' : ''}". Runtime model route: ${model}.`,
    memoryContext:
      'This terminal test does not read private vault memory automatically. It only uses the current conversation sent in this request.',
    selectedSkill,
    reasoningPath:
      `Mythos maps the request to ${selectedSkill}, checks whether the answer needs external tools or memory writes, and keeps the response in safe demo mode.`,
    prediction:
      'The safest next state is a human-reviewed recommendation. Real memory writes, provider calls, or agent actions should be triggered only through explicit CongChain controls.',
    decision:
      'Answer with an explanation, identify what is real versus demo, and avoid claiming hidden execution.',
    confidence: selectedSkill === 'Mythos General Reasoning' ? 0.66 : 0.78,
    safetyBoundary:
      'No API keys, wallet secrets, signed payloads, fund movement, or automatic memory writes are requested or performed.',
    nextHumanStep:
      'If the answer should become durable knowledge, use the authenticated Mythos memory write flow with a CongChain key.',
  };
}

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
    const cognitiveTrace = buildCognitiveTrace(messages, model);

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
      cognitiveTrace,
      cognitiveTraceSchema: 'mythos_decision_trace_v1',
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
