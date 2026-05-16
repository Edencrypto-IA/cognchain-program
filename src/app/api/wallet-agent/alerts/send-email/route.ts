import { NextRequest, NextResponse } from 'next/server';
import type { WalletAgentAlertDelivery } from '@/features/wallet-agent';
import { checkRateLimit } from '@/lib/security';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isValidDelivery(value: unknown): value is WalletAgentAlertDelivery {
  const delivery = value as WalletAgentAlertDelivery;
  return !!delivery
    && typeof delivery.id === 'string'
    && typeof delivery.draftId === 'string'
    && typeof delivery.ruleId === 'string'
    && delivery.status === 'draft'
    && typeof delivery.title === 'string'
    && typeof delivery.message === 'string'
    && Array.isArray(delivery.channels)
    && !!delivery.safety
    && delivery.safety.canExecuteTransaction === false
    && delivery.safety.canSchedule === false;
}

function getReadyEmailTarget(delivery: WalletAgentAlertDelivery) {
  const emailChannel = delivery.channels.find(channel => channel.channel === 'email');
  if (!emailChannel || emailChannel.status !== 'ready' || !emailChannel.target) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailChannel.target)) return null;
  return emailChannel.target;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendAlertEmail(to: string, delivery: WalletAgentAlertDelivery) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, status: 503, error: 'Email provider nao configurado.' };
  }

  const safeTitle = escapeHtml(delivery.title);
  const safeMessage = escapeHtml(delivery.message).replace(/\n/g, '<br />');
  const safeId = escapeHtml(delivery.id);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `CongChain Alert: ${delivery.title}`,
      html: [
        '<div style="font-family:Inter,Arial,sans-serif;background:#050507;color:#f8f8ff;padding:24px;border-radius:18px">',
        '<p style="margin:0 0 10px;color:#14F195;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:800">CongChain Wallet Agent</p>',
        `<h1 style="margin:0 0 14px;font-size:22px">${safeTitle}</h1>`,
        `<p style="color:#c9c9d8;line-height:1.55">${safeMessage}</p>`,
        '<div style="margin-top:18px;padding:14px;border:1px solid rgba(20,241,149,.18);border-radius:14px;background:rgba(20,241,149,.06)">',
        '<p style="margin:0;color:#9fffd0;font-size:13px;line-height:1.5">Este alerta nao executou transacao, nao abriu carteira, nao assinou nada e nao criou agendamento automatico.</p>',
        '</div>',
        `<p style="margin-top:18px;color:#77778a;font-size:12px">Alert ID: ${safeId}</p>`,
        '</div>',
      ].join(''),
      text: [
        `CongChain Alert: ${delivery.title}`,
        '',
        delivery.message,
        '',
        `Alert ID: ${delivery.id}`,
        'Seguranca: este alerta nao executou transacao, nao abriu carteira, nao assinou nada e nao criou agendamento automatico.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    return { sent: false, status: 502, error: 'Falha ao enviar email pelo provider.' };
  }

  return { sent: true, status: 200, error: null };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alerts/send-email');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const delivery = body?.delivery;

  if (!isValidDelivery(delivery)) {
    return NextResponse.json({ error: 'Contrato de alerta invalido.' }, { status: 400 });
  }

  if (!delivery.safety.canSendEmail) {
    return NextResponse.json({ error: 'Este alerta nao possui email pronto para envio.' }, { status: 400 });
  }

  const target = getReadyEmailTarget(delivery);
  if (!target) {
    return NextResponse.json({ error: 'Email de destino invalido ou pendente.' }, { status: 400 });
  }

  const result = await sendAlertEmail(target, delivery);
  if (!result.sent) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const sentAt = new Date().toISOString();
  return NextResponse.json({
    ok: true,
    delivery: {
      ...delivery,
      status: 'sent',
      updatedAt: sentAt,
    },
    sentAt,
    provider: 'resend',
    message: 'Email de alerta enviado manualmente. Nenhuma wallet, scheduler ou transacao foi acionada.',
  });
}
