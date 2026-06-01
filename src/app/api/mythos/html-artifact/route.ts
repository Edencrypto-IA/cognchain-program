import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/app/api/auth/verify/route';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

const SYSTEM_PROMPT = `You are Mythos, the CongChain external agent interface.

Generate a clean self-contained HTML artifact only when the user asks for a visual interface, dashboard, report, card, chart, or interactive preview.

Rules:
- Return a short explanation first.
- Then wrap the HTML in: <artifact type="html" title="Short title">...</artifact>
- Use CongChain styling: black background, neon green accents, cyan highlights, compact terminal-grade UI, professional spacing.
- Keep the artifact self-contained with inline CSS and optional inline JavaScript.
- Do not ask for, render, or store API keys, seed phrases, private keys, wallet secrets, signed payloads, or hidden prompts.
- Do not create wallet-signing, buy, sell, pay, schedule, or fund-movement flows.
- The artifact is an admin-only preview layer and must stay read-only.`;

type AnthropicTextBlock = {
  type?: string;
  text?: string;
};

type ArtifactProviderResult = {
  text: string;
  model: string;
  provider: 'nvidia' | 'anthropic';
};

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isAdminRequest(req: NextRequest) {
  const token = req.cookies.get('cog_admin')?.value || req.headers.get('x-admin-token') || '';
  return token ? verifyAdminToken(token) : false;
}

function extractArtifact(text: string) {
  const match = text.match(/<artifact\s+type=["']html["'](?:\s+title=["']([^"']*)["'])?\s*>([\s\S]*?)<\/artifact>/i);
  if (!match) {
    const fenced = text.match(/```html\s*([\s\S]*?)```/i);
    if (fenced?.[1]?.trim()) {
      return {
        title: 'Mythos HTML Preview',
        html: fenced[1].trim(),
        text: text.replace(fenced[0], '').trim(),
      };
    }

    const rawHtml = text.match(/(<!doctype\s+html[\s\S]*|<html[\s\S]*<\/html>|<(?:main|section|div)\b[\s\S]*<\/(?:main|section|div)>)/i);
    if (rawHtml?.[1]?.trim()) {
      return {
        title: 'Mythos HTML Preview',
        html: rawHtml[1].trim(),
        text: text.replace(rawHtml[1], '').trim(),
      };
    }

    return {
      title: 'Mythos Artifact',
      html: '',
      text: text.trim(),
    };
  }

  return {
    title: match[1]?.trim() || 'Mythos Artifact',
    html: match[2]?.trim() || '',
    text: text.replace(match[0], '').trim(),
  };
}

function hasSecretLikeContent(value: string) {
  return /\b(seed phrase|private key|secret key|signed payload|mnemonic|api[_ -]?key)\b/i.test(value)
    || /\b(cog_live_[a-z0-9]{16,}|sk-ant-[a-z0-9_-]+|xox[baprs]-[a-z0-9-]+)\b/i.test(value);
}

async function callNvidiaArtifact(prompt: string): Promise<ArtifactProviderResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured.');
  }

  const model = process.env.MYTHOS_HTML_NVIDIA_MODEL
    || process.env.NVIDIA_MODEL_GPT_OSS_120B
    || process.env.NVIDIA_MODEL_NEMOTRON_SUPER
    || 'openai/gpt-oss-120b';
  const response = await fetch(`${process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 6000,
      temperature: 0.35,
      top_p: 0.9,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`NVIDIA artifact request failed with status ${response.status}.`);
  }

  return {
    text: data?.choices?.[0]?.message?.content?.trim() || '',
    model,
    provider: 'nvidia',
  };
}

async function callAnthropicArtifact(prompt: string): Promise<ArtifactProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const model = process.env.MYTHOS_ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Anthropic artifact request failed with status ${response.status}.`);
  }

  const text = Array.isArray(data.content)
    ? data.content
      .map((block: AnthropicTextBlock) => block?.type === 'text' ? block.text || '' : '')
      .join('\n')
      .trim()
    : '';

  return {
    text,
    model,
    provider: 'anthropic',
  };
}

async function generateArtifact(prompt: string, preferredProvider: string): Promise<ArtifactProviderResult> {
  const provider = preferredProvider.trim().toLowerCase();
  if (provider === 'anthropic' || provider === 'claude') {
    return callAnthropicArtifact(prompt);
  }

  try {
    return await callNvidiaArtifact(prompt);
  } catch (nvidiaError) {
    if (process.env.ANTHROPIC_API_KEY) {
      return callAnthropicArtifact(prompt);
    }
    throw nvidiaError;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/mythos/html-artifact');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many artifact requests. Try again shortly.' }, { status: 429 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({
      error: 'Admin identity required for Mythos HTML artifacts.',
      safety: {
        secretsRedacted: true,
        adminOnly: true,
      },
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 6000) {
      return NextResponse.json({ error: 'A prompt between 1 and 6000 characters is required.' }, { status: 400 });
    }

    if (hasSecretLikeContent(prompt)) {
      return NextResponse.json({
        error: 'The artifact prompt appears to contain a secret or sensitive payload. Remove it and try again.',
      }, { status: 400 });
    }

    const provider = typeof body.provider === 'string' ? body.provider : process.env.MYTHOS_HTML_ARTIFACT_PROVIDER || 'nvidia';
    const generated = await generateArtifact(prompt, provider);
    const artifact = extractArtifact(generated.text);

    if (artifact.html && hasSecretLikeContent(artifact.html)) {
      return NextResponse.json({
        error: 'Generated artifact was blocked because it appeared to contain sensitive content.',
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      model: generated.model,
      provider: generated.provider,
      text: artifact.text || 'Mythos generated a read-only HTML artifact.',
      artifact: artifact.html ? {
        type: 'html',
        title: artifact.title,
        html: artifact.html,
      } : null,
      safety: {
        adminOnly: true,
        keyExposedToBrowser: false,
        canMoveFunds: false,
        canSignTransactions: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
