import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security';
import {
  createUserEmailMagicLink,
  normalizeUserEmail,
  signUserEmailMagicLink,
} from '@/lib/user-email-auth';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function createMagicUrl(req: NextRequest, token: string) {
  const url = new URL('/api/auth/email/magic/verify', req.url);
  url.searchParams.set('token', token);
  url.searchParams.set('redirect', '/');
  return url.toString();
}

async function sendMagicLinkEmail(email: string, magicUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, reason: 'email_provider_not_configured' as const };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Seu link de acesso CongChain',
      html: [
        '<div style="font-family:Inter,Arial,sans-serif;background:#050507;color:#f8f8ff;padding:24px;border-radius:18px">',
        '<h1 style="margin:0 0 12px;font-size:22px">Entrar no CongChain</h1>',
        '<p style="color:#b8b8c8;line-height:1.5">Use o link abaixo para confirmar seu email e continuar sua sessao.</p>',
        `<p><a href="${magicUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:700">Confirmar email</a></p>`,
        '<p style="color:#7a7a8a;font-size:12px">Este link expira em 15 minutos. Nenhuma carteira sera conectada por este email.</p>',
        '</div>',
      ].join(''),
      text: `Entrar no CongChain: ${magicUrl}\n\nEste link expira em 15 minutos. Nenhuma carteira sera conectada por este email.`,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: 'email_provider_failed' as const };
  }

  return { sent: true, reason: 'sent' as const };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/auth/email/magic/start');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeUserEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: 'Informe um email valido.' }, { status: 400 });
  }

  const link = createUserEmailMagicLink(email);
  const token = signUserEmailMagicLink(link);
  const magicUrl = createMagicUrl(req, token);
  const delivery = await sendMagicLinkEmail(email, magicUrl);
  const includeDevelopmentLink = process.env.NODE_ENV !== 'production' || process.env.AUTH_EMAIL_DEV_LINK === 'true';

  return NextResponse.json({
    ok: true,
    email,
    delivery: delivery.sent ? 'email_sent' : delivery.reason,
    expiresAt: new Date(link.expiresAt).toISOString(),
    magicUrl: includeDevelopmentLink ? magicUrl : undefined,
    message: delivery.sent
      ? 'Link magico enviado para o email informado.'
      : 'Link magico preparado, mas o provedor de email ainda nao esta configurado.',
  });
}
