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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
      configured: false,
    }, { status: 503 });
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
      return NextResponse.json({
        error: 'Anthropic artifact request failed.',
        status: response.status,
      }, { status: response.status });
    }

    const text = Array.isArray(data.content)
      ? data.content
        .map((block: AnthropicTextBlock) => block?.type === 'text' ? block.text || '' : '')
        .join('\n')
        .trim()
      : '';
    const artifact = extractArtifact(text);

    if (artifact.html && hasSecretLikeContent(artifact.html)) {
      return NextResponse.json({
        error: 'Generated artifact was blocked because it appeared to contain sensitive content.',
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      model,
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
