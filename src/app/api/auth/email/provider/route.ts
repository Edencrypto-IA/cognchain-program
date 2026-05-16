import { NextResponse } from 'next/server';

export async function GET() {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM || '';
  const configured = hasApiKey && !!from;

  return NextResponse.json({
    provider: 'resend',
    configured,
    hasApiKey,
    hasFrom: !!from,
    from: from ? from.replace(/^(.{2}).*(@.*)$/, '$1***$2') : null,
    requiredEnv: ['RESEND_API_KEY', 'AUTH_EMAIL_FROM or EMAIL_FROM'],
    mode: configured ? 'email_delivery_ready' : 'setup_required',
  });
}
