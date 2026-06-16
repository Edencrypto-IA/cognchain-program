import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { callModel } from '@/services/ai';
import { checkRateLimit, Limits, safeErrorMessage, validateModel } from '@/lib/security';
import {
  extractWebUrls,
  formatWebReadContext,
  prepareWebMemoryRecords,
  readWebUrls,
} from '@/lib/mythos/web-reader';
import { logAgentShieldReport, scanPrompt } from '@/security/agentShield'; // ECC_INTEGRATION: warn-only Mythos gateway security scan.
import { listSkillSummaries } from '@/skills'; // ECC_INTEGRATION: expose catalog skills to TriggerEngine.
import { saveSession } from '@/store/sessionStore'; // ECC_INTEGRATION: persist TriggerReport beside existing memory flow.
import { analyzeIntent } from '@/trigger/triggerEngine'; // ECC_INTEGRATION: classify Mythos input before model call.

const MYTHOS_TEST_SYSTEM = [
  'Voce e Mythos, o primeiro agente externo oficial conectado ao Agent Memory Bridge da CongChain.',
  'Responda em portugues claro, natural e inteligente, como um assistente senior conversando com o usuario.',
  'Nao use markdown bruto: nao escreva asteriscos, cercas de codigo, titulos com hash, tabelas markdown ou marcadores decorativos.',
  'Nunca responda em formato robotico com Percepcao, Decisao, Skill provavel, Previsao, Limite seguro, Identidade Mythos ou Continuidade.',
  'Mesmo quando houver skill, memoria, rota de modelo ou web reader, esconda o jargao interno e responda como um assistente util.',
  'Explique direto: o que voce encontrou, por que importa, pontos principais e proximo passo util.',
  'Mostre a identidade do Mythos apenas quando fizer sentido, sem transformar toda resposta em relatorio operacional.',
  'Explique quando algo e demonstracao, contrato visual ou recurso real.',
  'Nao afirme que executou ferramentas externas, salvou memoria ou moveu fundos se isso nao aconteceu na chamada.',
  'Quando o usuario fornecer uma URL e o Mythos Web Reader trouxer conteudo, responda como ChatGPT/Claude/Codex responderiam: resumo claro, leitura critica, pontos principais, utilidade pratica e sugestoes.',
  'Para analise de site, nao liste o hash no corpo principal salvo se o usuario pedir prova; deixe a prova tecnica para o bloco Web Reader da interface.',
  'Se uma URL nao puder ser lida, diga isso claramente em vez de inventar o conteudo.',
  'Nunca solicite API keys, seed phrases, private keys, signed payloads ou wallet secrets.',
  'Quando o usuario pedir uma acao pratica, explique o proximo passo seguro dentro da CongChain.',
  'Mantenha respostas objetivas, mas completas o suficiente para serem uteis. Use pequenos blocos com titulos naturais quando ajudar.',
].join(' ');

const OPERATIONAL_LABELS = [
  'percepcao',
  'percepção',
  'decisao',
  'decisão',
  'skill provavel',
  'skill provável',
  'previsao',
  'previsão',
  'limite seguro',
  'proximo passo',
  'próximo passo',
  'identidade mythos',
  'continuidade',
  'memoria',
  'memória',
];

type MythosTestMessage = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{
    kind?: string;
    name?: string;
    type?: string;
    dataUrl?: string;
  }>;
};

type MythosTestBody = {
  model?: string;
  mode?: string;
  nvidiaModelRoute?: string;
  selectedSkill?: string;
  skillPath?: string;
  messages?: unknown;
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

const NVIDIA_LAB_MODEL_ROUTES = [
  {
    id: 'nemotron-super-120b',
    label: 'Nemotron Super 120B',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    envModel: 'NVIDIA_MODEL_NEMOTRON_SUPER',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    model: 'deepseek-ai/deepseek-v4-pro',
    envModel: 'NVIDIA_MODEL_DEEPSEEK_V4',
    apiKeyEnv: 'NVIDIA_KEY_DEEPSEEK_V4',
  },
  {
    id: 'seed-oss-36b',
    label: 'Seed OSS 36B',
    model: 'bytedance/seed-oss-36b-instruct',
    envModel: 'NVIDIA_MODEL_SEED',
  },
  {
    id: 'qwen35-122b',
    label: 'Qwen 3.5 122B',
    model: 'qwen/qwen3.5-122b-a10b',
    envModel: 'NVIDIA_MODEL_QWEN35',
  },
  {
    id: 'kimi-k26',
    label: 'Kimi K2.6',
    model: 'moonshotai/kimi-k2.6',
    envModel: 'NVIDIA_MODEL_KIMI',
  },
  {
    id: 'mixtral-8x22b',
    label: 'Mixtral 8x22B',
    model: 'mistralai/mixtral-8x22b-instruct',
    envModel: 'NVIDIA_MODEL_MIXTRAL',
  },
  {
    id: 'mistral-large',
    label: 'Mistral Large 3',
    model: 'mistralai/mistral-large-3-675b-instruct-2512',
    envModel: 'NVIDIA_MODEL_MISTRAL_LARGE',
  },
  {
    id: 'gpt-oss-120b',
    label: 'GPT-OSS 120B',
    model: 'openai/gpt-oss-120b',
    envModel: 'NVIDIA_MODEL_GPT_OSS_120B',
  },
  {
    id: 'gemma4-31b',
    label: 'Gemma 4 31B',
    model: 'google/gemma-4-31b-it',
    envModel: 'NVIDIA_MODEL_GEMMA4',
  },
  {
    id: 'gemma3n-e2b',
    label: 'Gemma 3N E2B',
    model: 'google/gemma-3n-e2b-it',
    envModel: 'NVIDIA_MODEL_GEMMA3N_E2B',
  },
  {
    id: 'phi4-mini',
    label: 'Phi-4 Mini',
    model: 'microsoft/phi-4-mini-instruct',
    envModel: 'NVIDIA_MODEL_PHI4',
  },
] as const;

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

function getNvidiaLabRoute(routeId?: string) {
  const normalized = (routeId || '').trim().toLowerCase();
  return NVIDIA_LAB_MODEL_ROUTES.find(route => route.id === normalized) || NVIDIA_LAB_MODEL_ROUTES[0];
}

async function callNvidiaLabRoute(routeId: string | undefined, messages: MythosTestMessage[], systemPrompt: string) {
  const route = getNvidiaLabRoute(routeId);
  const apiKey = ((route as any).apiKeyEnv ? process.env[(route as any).apiKeyEnv] : undefined) || process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY nao esta configurada para o Mythos Lab.');
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  });
  const model = process.env[route.envModel] || route.model;
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    ],
    max_tokens: 900,
    temperature: 0.45,
    top_p: 0.9,
  });

  return {
    content: response.choices[0]?.message?.content || 'Sem resposta da rota NVIDIA.',
    model: 'nvidia',
    modelLabel: `NVIDIA · ${route.label}`,
    providerModel: model,
    routeId: route.id,
  };
}

async function callOpenAIVisionRoute(messages: MythosTestMessage[], systemPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nao esta configurada para analise visual no Mythos Lab.');
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(message => {
        const images = (message.attachments || [])
          .filter(attachment => attachment.kind === 'image' && typeof attachment.dataUrl === 'string' && attachment.dataUrl.startsWith('data:image/'))
          .slice(0, 4);

        if (message.role === 'user' && images.length) {
          return {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: message.content },
              ...images.map(image => ({
                type: 'image_url' as const,
                image_url: {
                  url: image.dataUrl!,
                  detail: 'auto' as const,
                },
              })),
            ],
          };
        }

        return {
          role: message.role,
          content: message.content,
        };
      }),
    ],
    max_tokens: 1000,
    temperature: 0.35,
  });

  return {
    content: response.choices[0]?.message?.content || 'Sem resposta da rota visual OpenAI.',
    model: 'gpt',
    modelLabel: `OpenAI Vision · ${model}`,
    providerModel: model,
  };
}

function buildCognitiveTrace(messages: MythosTestMessage[], model: string, selectedSkillInput?: string, modelLabel?: string): MythosCognitiveTrace {
  const latest = messages[messages.length - 1]?.content || '';
  const selectedSkill = selectedSkillInput?.trim() || inferSkill(latest);
  const routeLabel = modelLabel || model;

  return {
    perception:
      `User asked: "${latest.slice(0, 180)}${latest.length > 180 ? '...' : ''}". Runtime model route: ${routeLabel}.`,
    memoryContext:
      'This Lab request does not read private vault memory automatically. It only uses the current conversation, selected skill, and visible request context.',
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

function humanizeOperationalResponse(content: string) {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const parsed: Record<string, string> = {};
  const normalLines: string[] = [];
  let operationalLabelCount = 0;

  for (const line of lines) {
    const match = line.match(/^([A-Za-zÀ-ÿ\s]+):\s*(.+)$/);
    if (!match) {
      normalLines.push(line);
      continue;
    }

    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const knownLabel = OPERATIONAL_LABELS.find(item => label === item);

    if (knownLabel) {
      operationalLabelCount += 1;
      parsed[knownLabel] = value;
    } else {
      normalLines.push(line);
    }
  }

  if (operationalLabelCount < 2) return content;

  const perception = parsed.percepcao || parsed['percepção'] || '';
  const decision = parsed.decisao || parsed['decisão'] || '';
  const prediction = parsed.previsao || parsed['previsão'] || '';
  const nextStep = parsed['proximo passo'] || parsed['próximo passo'] || '';
  const safeLimit = parsed['limite seguro'] || '';

  return [
    perception || normalLines[0] || 'Analisei o pedido com base no contexto disponível.',
    decision ? `O ponto principal: ${decision}` : '',
    prediction ? `O que isso indica: ${prediction}` : '',
    nextStep ? `Um bom próximo passo é ${nextStep.replace(/^\s*(o\s+)?/i, '')}` : '',
    safeLimit ? `Observação: ${safeLimit}` : '',
    ...normalLines.slice(perception ? 0 : 1),
  ].filter(Boolean).join('\n\n');
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
    const attachments = Array.isArray(item.attachments)
      ? item.attachments.slice(0, 4).map(attachment => {
        const raw = attachment as Partial<NonNullable<MythosTestMessage['attachments']>[number]>;
        return {
          kind: typeof raw.kind === 'string' ? raw.kind : '',
          name: typeof raw.name === 'string' ? raw.name.slice(0, 160) : '',
          type: typeof raw.type === 'string' ? raw.type.slice(0, 120) : '',
          dataUrl: typeof raw.dataUrl === 'string' && raw.dataUrl.length <= 8_500_000 ? raw.dataUrl : undefined,
        };
      })
      : undefined;

    if (!content.trim()) {
      throw new Error('Mensagem vazia nao pode ser enviada ao terminal Mythos.');
    }

    return { role, content, attachments };
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

    const body = await request.json() as MythosTestBody;
    const model = validateModel(body.model || 'nvidia');
    const messages = sanitizeMessages(body.messages);
    // ECC_INTEGRATION: AgentShield runs warn-only and never blocks current Mythos responses.
    const shieldReport = scanPrompt(messages.map(message => message.content).join('\n'));
    logAgentShieldReport('/api/mythos/test-chat', shieldReport);
    const latestUserMessage = [...messages].reverse().find(message => message.role === 'user');
    // ECC_INTEGRATION: TriggerEngine runs after AgentShield and before model execution.
    const availableSkillSummaries = await listSkillSummaries().catch((error: unknown) => {
      console.warn('[TriggerEngine] skill catalog unavailable', error);
      return [];
    });
    const triggerReport = await analyzeIntent(latestUserMessage?.content || '', availableSkillSummaries);
    const triggerSessionId = `mythos:test-chat:${ip}:${triggerReport.timestamp}`;
    try {
      saveSession(triggerSessionId, {
        kind: 'mythos-trigger-report',
        triggerReport: {
          skill: triggerReport.skill,
          risk: triggerReport.risk,
          source: triggerReport.source,
          reason: triggerReport.reason,
          timestamp: triggerReport.timestamp,
        },
        model,
        selectedSkill: typeof body.selectedSkill === 'string' ? body.selectedSkill : null,
      });
    } catch (error: unknown) {
      console.warn('[TriggerEngine] session persistence skipped', error);
    }
    const detectedWebUrls = latestUserMessage ? extractWebUrls(latestUserMessage.content) : [];
    const webResults = detectedWebUrls.length ? await readWebUrls(detectedWebUrls) : [];
    const webContext = webResults.length ? formatWebReadContext(webResults) : '';
    const webMemoryRecords = prepareWebMemoryRecords(webResults);
    const nvidiaRoute = model === 'nvidia' ? getNvidiaLabRoute(body.nvidiaModelRoute) : undefined;
    const modelLabel = nvidiaRoute ? `NVIDIA · ${nvidiaRoute.label}` : model;
    const cognitiveTrace = buildCognitiveTrace(messages, model, body.selectedSkill, modelLabel);
    const skillContext = body.selectedSkill
      ? `Selected Mythos skill: ${body.selectedSkill}${body.skillPath ? ` (${body.skillPath})` : ''}. Lab mode: ${body.mode || 'demo'}.`
      : `No explicit Mythos skill selected. Lab mode: ${body.mode || 'demo'}.`;

    const modelMessages = [
        {
          role: 'user',
          content: webContext
            ? [
              skillContext,
              `// [TriggerEngine] ${JSON.stringify({ skill: triggerReport.skill, risk: triggerReport.risk, source: triggerReport.source })}`,
              '',
              webContext,
              '',
              'Use the web reader context above only when relevant to the user request. Do not invent facts outside it.',
              'Answer naturally. For a site analysis, summarize what the site is, what content/structure matters, who it helps, and what the user should do next. Do not output Percepcao/Decisao/Previsao labels.',
              'Do not put SHA-256 hashes in the main answer unless the user asks for proof; the interface will show Web Reader metadata separately.',
            ].join('\n')
            : [
              skillContext,
              `// [TriggerEngine] ${JSON.stringify({ skill: triggerReport.skill, risk: triggerReport.risk, source: triggerReport.source })}`,
            ].join('\n'),
        },
        ...messages,
      ];

    const hasImageAttachment = messages.some(message =>
      message.attachments?.some(attachment => attachment.kind === 'image' && attachment.dataUrl?.startsWith('data:image/'))
    );

    const result = hasImageAttachment
      ? await callOpenAIVisionRoute(modelMessages as any, `Voce e o agente "Mythos". ${MYTHOS_TEST_SYSTEM} Analise imagens anexadas apenas pelo que for visualmente observavel; se algo nao estiver claro, diga que nao consegue confirmar.`)
      : model === 'nvidia'
        ? await callNvidiaLabRoute(body.nvidiaModelRoute, modelMessages as any, `Voce sao o agente "Mythos". ${MYTHOS_TEST_SYSTEM}`)
        : await callModel({
          model,
          messages: modelMessages as any,
          systemPrompt: MYTHOS_TEST_SYSTEM,
          useContext: false,
          agentName: 'Mythos',
        });
    const responseContent = humanizeOperationalResponse(result.content);

    return NextResponse.json({
      ok: true,
      response: responseContent,
      model: result.model,
      modelLabel: result.modelLabel,
      nvidiaModelRoute: 'routeId' in result ? result.routeId : undefined,
      providerModel: 'providerModel' in result ? result.providerModel : undefined,
      mode: 'mythos_test_terminal',
      cognitiveTrace,
      cognitiveTraceSchema: 'mythos_decision_trace_v1',
      safety: {
        storesSecrets: false,
        movesFunds: false,
        writesMemoryAutomatically: false,
      },
      triggerReport,
      webReader: webResults.length ? {
        read: webResults.length,
        successful: webResults.filter(result => result.success).length,
        failed: webResults.filter(result => !result.success).length,
        sources: webResults.map(result => ({
          url: result.normalizedUrl,
          title: result.title,
          contentHash: result.contentHash || null,
          readAt: result.readAt,
          success: result.success,
          error: result.error,
        })),
        memoryRecords: webMemoryRecords,
      } : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
