import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InlineEditBody = {
  filePath?: unknown;
  selectedCode?: unknown;
  instruction?: unknown;
  fullFileContent?: unknown;
};

function clean(value: string, limit: number): string {
  return value.slice(0, limit).replace(/\0/g, '');
}

async function proposeWithAnthropic(system: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const models = ['claude-fable-5', 'claude-sonnet-4-6', 'claude-sonnet-4-20250514'];
  let lastError: unknown = null;
  for (const model of models) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1600,
        system,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Anthropic inline edit failed');
}

async function proposeWithOpenAI(system: string, prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.FORGE_INLINE_OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1600,
  });
  return response.choices[0]?.message?.content?.trim() ?? '';
}

export async function POST(request: NextRequest) {
  let body: InlineEditBody;
  try {
    body = await request.json() as InlineEditBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body.filePath !== 'string' ||
    typeof body.selectedCode !== 'string' ||
    typeof body.instruction !== 'string' ||
    typeof body.fullFileContent !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing inline edit payload' }, { status: 400 });
  }

  const filePath = clean(body.filePath, 180);
  const selectedCode = clean(body.selectedCode, 24_000);
  const instruction = clean(body.instruction, 2_000);
  const fullFileContent = clean(body.fullFileContent, 80_000);
  const system = 'Voce e um engenheiro senior. O usuario selecionou um trecho de codigo e quer modifica-lo. Retorne APENAS o codigo substituto, sem explicacao, sem markdown, sem delimitadores. So o codigo puro que substitui exatamente o trecho selecionado.';
  const prompt = `Arquivo: ${filePath}
Instrucao: ${instruction}

Trecho selecionado:
${selectedCode}

Contexto do arquivo completo:
${fullFileContent}`;

  try {
    const proposedCode = process.env.FORGE_INLINE_PROVIDER === 'openai'
      ? await proposeWithOpenAI(system, prompt)
      : await proposeWithAnthropic(system, prompt).catch(async () => proposeWithOpenAI(system, prompt));
    if (!proposedCode) return NextResponse.json({ error: 'Empty inline edit response' }, { status: 502 });
    return NextResponse.json({ proposedCode, originalCode: selectedCode, filePath });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Inline edit failed' }, { status: 500 });
  }
}
