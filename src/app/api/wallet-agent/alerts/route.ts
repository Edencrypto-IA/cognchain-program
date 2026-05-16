import { NextRequest, NextResponse } from 'next/server';
import { createWalletAgentAlertDeliveryContract } from '@/features/wallet-agent/alerts';
import type { WalletAgentLocalNotificationDraft, WalletAgentLocalRule } from '@/features/wallet-agent';
import { checkRateLimit } from '@/lib/security';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isValidDraft(value: unknown): value is WalletAgentLocalNotificationDraft {
  const draft = value as WalletAgentLocalNotificationDraft;
  return !!draft
    && typeof draft.id === 'string'
    && typeof draft.ruleId === 'string'
    && draft.status === 'draft_only'
    && Array.isArray(draft.channels)
    && typeof draft.title === 'string'
    && typeof draft.message === 'string';
}

function isValidRule(value: unknown): value is WalletAgentLocalRule {
  const rule = value as WalletAgentLocalRule;
  return !!rule
    && typeof rule.id === 'string'
    && typeof rule.type === 'string'
    && typeof rule.status === 'string'
    && !!rule.trigger
    && typeof rule.trigger.label === 'string'
    && !!rule.safety
    && typeof rule.safety.requiresWalletSignature === 'boolean';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/alerts');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const draft = body?.draft;
  const rule = body?.rule;

  if (!isValidDraft(draft) || !isValidRule(rule) || draft.ruleId !== rule.id) {
    return NextResponse.json({ error: 'Rascunho de alerta invalido.' }, { status: 400 });
  }

  const delivery = createWalletAgentAlertDeliveryContract(draft, rule);

  return NextResponse.json({
    ok: true,
    delivery,
    mode: 'draft_only',
    persisted: false,
    message: 'Entrega de alerta criada como contrato seguro. Nenhum email, scheduler, wallet ou transacao foi executado.',
  });
}
