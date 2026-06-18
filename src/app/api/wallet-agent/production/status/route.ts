import { NextRequest, NextResponse } from 'next/server';
import { createWalletAgentProductionMonitoringStatus } from '@/features/wallet-agent/production-readiness';
import { verifyAdminToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/security';

function getClientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

function isAdminRequest(req: NextRequest) {
  const token = req.cookies.get('cog_admin')?.value || req.headers.get('x-admin-token') || '';
  return token ? verifyAdminToken(token) : false;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(ip, '/api/wallet-agent/production/status');
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  if (!isAdminRequest(req)) {
    return NextResponse.json({
      error: 'Admin identity necessaria.',
      mode: 'read_only',
      safety: {
        secretsRedacted: true,
        canExecuteTransactions: false,
        canSendFunds: false,
      },
    }, { status: 401 });
  }

  const status = createWalletAgentProductionMonitoringStatus();

  return NextResponse.json({
    ok: true,
    status,
    message: 'Wallet Agent production monitoring status loaded in read-only redacted mode.',
  });
}
