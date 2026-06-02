import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/app/api/auth/verify/route';
import {
  MYTHOS_HTML_SYSTEM_PROMPT,
  buildMythosHtmlGenerationPrompt,
} from '@/lib/mythos/html-artifact-prompts';
import {
  checkMythosHtmlSafety,
  extractMythosArtifactHtml,
  sanitizeMythosHtml,
} from '@/lib/mythos/html-artifact-safety';
import {
  extractFirstUrl,
  fetchWebsiteDnaBrief,
  formatWebsiteDnaForPrompt,
} from '@/lib/mythos/website-dna-extractor';
import {
  analyzeScreenshotDna,
  formatScreenshotDnaForPrompt,
  type MythosScreenshotInput,
} from '@/lib/mythos/screenshot-dna-analyzer';
import { checkRateLimit, safeErrorMessage } from '@/lib/security';

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
        { role: 'system', content: MYTHOS_HTML_SYSTEM_PROMPT },
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
      system: MYTHOS_HTML_SYSTEM_PROMPT,
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
    const referenceUrl = extractFirstUrl(prompt);
    const websiteDnaBrief = referenceUrl ? await fetchWebsiteDnaBrief(referenceUrl) : null;
    const screenshotInputs = Array.isArray(body.screenshots)
      ? body.screenshots.filter((item: unknown): item is MythosScreenshotInput => Boolean(item) && typeof item === 'object')
      : [];
    const screenshotDna = await analyzeScreenshotDna(screenshotInputs);
    const generationPrompt = buildMythosHtmlGenerationPrompt({
      userRequest: prompt,
      websiteDna: websiteDnaBrief ? formatWebsiteDnaForPrompt(websiteDnaBrief) : undefined,
      screenshotDna: screenshotDna.length ? formatScreenshotDnaForPrompt(screenshotDna) : undefined,
    });
    const generated = await generateArtifact(generationPrompt, provider);
    const artifact = extractMythosArtifactHtml(generated.text);

    if (artifact.html && hasSecretLikeContent(artifact.html)) {
      return NextResponse.json({
        error: 'Generated artifact was blocked because it appeared to contain sensitive content.',
      }, { status: 422 });
    }
    const sanitized = artifact.html ? sanitizeMythosHtml(artifact.html) : { html: '', removals: [] };
    const safetyCheck = sanitized.html ? checkMythosHtmlSafety(sanitized.html) : null;

    if (safetyCheck?.blockers.length) {
      return NextResponse.json({
        error: 'Generated artifact was blocked by the Mythos sandbox safety gate.',
        safety: {
          adminOnly: true,
          keyExposedToBrowser: false,
          canMoveFunds: false,
          canSignTransactions: false,
          blockers: safetyCheck.blockers.map(item => item.rule),
          warnings: safetyCheck.warnings.map(item => item.rule),
          removals: sanitized.removals,
        },
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
        html: sanitized.html,
      } : null,
      safety: {
        adminOnly: true,
        keyExposedToBrowser: false,
        canMoveFunds: false,
        canSignTransactions: false,
        websiteReferenceFetched: Boolean(websiteDnaBrief),
        websiteReferenceUrl: websiteDnaBrief?.url || null,
        screenshotReferenceAnalyzed: screenshotDna.length > 0,
        screenshotReferenceCount: screenshotDna.length,
        warnings: safetyCheck?.warnings.map(item => item.rule) || [],
        removals: sanitized.removals,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
