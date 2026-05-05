import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../memory/memory.model';
import { buildSystemPrompt } from '../memory/context.service';
import { getMaxTokens, trackUsage, estimateTokens } from './token-economy';
export { classifyTask, selectModelForTask, getUsageSummary, isBudgetExceeded } from './token-economy';

export interface AIHandler {
  name: string;
  model: string;
  chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string>;
}

// ── GPT-4o via OpenAI ────────────────────────────────────────
class GPTHandler implements AIHandler {
  name = 'GPT-4o';
  model = 'gpt';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. Responda de forma direta, precisa e amigável em português. NUNCA invente dados, estatísticas, hashes, transaction IDs ou fatos sobre o CognChain que não foram fornecidos pelo usuário. Se não souber algo, diga claramente que não sabe. Seja conciso.';

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('gpt'),
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta do GPT.';
    trackUsage('gpt', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── Claude Opus via Anthropic ────────────────────────────────
class ClaudeHandler implements AIHandler {
  name = 'Claude Opus';
  model = 'claude';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. Responda em português com precisão e profundidade técnica. NUNCA invente dados, hashes, estatísticas ou fatos sobre o CognChain. Se não souber, diga que não sabe.';

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: getMaxTokens('claude'),
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const block = response.content.find(b => b.type === 'text');
    const content = block?.type === 'text' ? block.text : 'Sem resposta do Claude.';
    trackUsage('claude', response.usage.input_tokens, response.usage.output_tokens);
    return content;
  }
}

// ── NVIDIA Llama via API compatível com OpenAI ───────────────
class NVIDIAHandler implements AIHandler {
  name = 'NVIDIA Llama';
  model = 'nvidia';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. Responda em português de forma direta e eficiente. NUNCA invente dados, hashes ou fatos sobre o CognChain. Se não souber, diga claramente.';

    const response = await client.chat.completions.create({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('nvidia'),
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta da NVIDIA.';
    trackUsage('nvidia', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── DeepSeek via API compatível com OpenAI ───────────────────
class DeepSeekHandler implements AIHandler {
  name = 'DeepSeek V3';
  model = 'deepseek';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. NUNCA invente dados sobre o CognChain. Responda em portugues de forma precisa e eficiente.';

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('deepseek'),
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta do DeepSeek.';
    trackUsage('deepseek', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── Gemini via Google Generative AI ─────────────────────────
class GeminiHandler implements AIHandler {
  name = 'Gemini Pro';
  model = 'gemini';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. Responda em português com precisão e criatividade. NUNCA invente dados, hashes ou fatos sobre o CognChain. Se não souber, diga claramente.';

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: systemPrompt,
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage?.content || '');

    const content = result.response.text() || 'Sem resposta do Gemini.';
    trackUsage('gemini', estimateTokens(systemPrompt), estimateTokens(content));
    return content;
  }
}

// ── GLM-4.7 via NVIDIA NIM (free endpoint) ──────────────────
class GLMHandler implements AIHandler {
  name = 'GLM-4.7';
  model = 'glm';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.NVIDIA_GLM_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. NUNCA invente dados sobre o CognChain. Responda em portugues de forma precisa e eficiente.';

    const response = await client.chat.completions.create({
      model: 'z-ai/glm4.7',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('glm'),
      temperature: 0.7,
      top_p: 1,
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta do GLM.';
    trackUsage('glm', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── MiniMax M2.7 via NVIDIA NIM (free endpoint) ─────────────
class MiniMaxHandler implements AIHandler {
  name = 'MiniMax M2.7';
  model = 'minimax';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.NVIDIA_MINIMAX_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. NUNCA invente dados sobre o CognChain. Responda em portugues de forma precisa e eficiente.';

    const response = await client.chat.completions.create({
      model: 'minimaxai/minimax-m2.7',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('minimax'),
      temperature: 0.7,
      top_p: 0.95,
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta do MiniMax.';
    trackUsage('minimax', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── Qwen3 80B via NVIDIA NIM (free endpoint) ────────────────
class QwenHandler implements AIHandler {
  name = 'Qwen3 80B';
  model = 'qwen';

  async chat(messages: ChatMessage[], systemPromptOverride?: string): Promise<string> {
    const client = new OpenAI({
      apiKey: process.env.NVIDIA_QWEN_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    const systemPrompt = systemPromptOverride ||
      'Você é um assistente de IA integrado ao CognChain. NUNCA invente dados sobre o CognChain. Responda em portugues de forma precisa e eficiente.';

    const response = await client.chat.completions.create({
      model: 'qwen/qwen3-next-80b-a3b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: getMaxTokens('qwen'),
      temperature: 0.6,
      top_p: 0.7,
    });

    const content = response.choices[0]?.message?.content || 'Sem resposta do Qwen.';
    trackUsage('qwen', response.usage?.prompt_tokens ?? estimateTokens(systemPrompt), response.usage?.completion_tokens ?? estimateTokens(content));
    return content;
  }
}

// ── Handlers singleton ───────────────────────────────────────
const handlers: Record<string, AIHandler> = {
  gpt:      new GPTHandler(),
  claude:   new ClaudeHandler(),
  nvidia:   new NVIDIAHandler(),
  gemini:   new GeminiHandler(),
  deepseek: new DeepSeekHandler(),
  glm:      new GLMHandler(),
  minimax:  new MiniMaxHandler(),
  qwen:     new QwenHandler(),
};

export function getHandler(model: string): AIHandler {
  const handler = handlers[model.toLowerCase()];
  if (!handler) {
    throw new Error(`Modelo nao suportado: ${model}. Disponiveis: ${Object.keys(handlers).join(', ')}`);
  }
  return handler;
}

export async function routeChat(model: string, messages: ChatMessage[], previousModel?: string): Promise<string> {
  const handler = getHandler(model);
  const systemPrompt = await buildSystemPrompt(model, messages, previousModel);
  return handler.chat(messages, systemPrompt);
}

export interface CallModelOptions {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  useContext?: boolean;
  sessionId?: string;
  agentName?: string;
}

export interface CallModelResult {
  content: string;
  model: string;
  modelLabel: string;
  contextMemories?: number;
}

export async function callModel(options: CallModelOptions): Promise<CallModelResult> {
  const { model, messages, systemPrompt: customSystemPrompt, useContext = true, agentName } = options;
  const handler = getHandler(model);

  let systemPrompt: string;
  if (customSystemPrompt) {
    systemPrompt = customSystemPrompt;
  } else if (useContext) {
    systemPrompt = await buildSystemPrompt(model, messages, undefined);
  } else {
    systemPrompt = 'Você é um assistente de IA integrado ao CognChain. NUNCA invente dados sobre o CognChain.';
  }

  if (agentName) {
    const safeName = String(agentName).replace(/[^a-zA-Z0-9\s\-_.]/g, '').substring(0, 50);
    if (safeName) systemPrompt = `Voce sao o agente "${safeName}". ${systemPrompt}`;
  }

  let content: string;
  try {
    content = await handler.chat(messages, systemPrompt);
  } catch (error) {
    console.error(`[AI Router] ${model} call failed:`, error);
    throw new Error(`Erro ao comunicar com o modelo ${model}. Tente novamente.`);
  }

  return { content, model, modelLabel: handler.name, contextMemories: 0 };
}

export function getAvailableModels(): { key: string; name: string }[] {
  return Object.values(handlers).map(h => ({ key: h.model, name: h.name }));
}

export function getSpecializedModel(taskType: 'creative' | 'analytical' | 'execution' | 'general'): string {
  return { creative: 'gpt', analytical: 'claude', execution: 'deepseek', general: 'gpt' }[taskType] || 'gpt';
}

export function getModelCapabilities(): Record<string, { specialty: string; description: string; color: string }> {
  return {
    gpt:      { specialty: 'Criatividade', description: 'Geracao de conteudo criativo, brainstorming, escrita',    color: '#22C55E' },
    claude:   { specialty: 'Analise',      description: 'Analise profunda, raciocinio logico, pesquisa',           color: '#F97316' },
    nvidia:   { specialty: 'Performance',  description: 'Otimizacao, eficiencia, processamento rapido',            color: '#A855F7' },
    gemini:   { specialty: 'Execucao',     description: 'Sintese, execucao de tarefas, multimodal',               color: '#3B82F6' },
    deepseek: { specialty: 'Raciocinio',   description: 'Raciocinio avancado, codigo, custo-beneficio superior',  color: '#00C4FF' },
  };
}
