import { NextRequest, NextResponse } from 'next/server';
import { markDeployed } from '@/services/agents';
import { safeErrorMessage } from '@/lib/security';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, target, botToken, phoneNumber } = body;

    if (!agentId || !target) {
      return NextResponse.json({ error: 'agentId and target are required' }, { status: 400 });
    }

    if (!['telegram', 'whatsapp'].includes(target)) {
      return NextResponse.json({ error: 'target must be telegram or whatsapp' }, { status: 400 });
    }

    const webhookUrl = `${BASE_URL}/api/webhook/telegram?agentId=${agentId}`;

    if (target === 'telegram' && !botToken) {
      return NextResponse.json({ error: 'botToken is required for Telegram' }, { status: 400 });
    }

    const isLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
    let webhookRegistered = false;

    // Register Telegram webhook — only works with public HTTPS URL
    if (target === 'telegram' && !isLocalhost) {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return NextResponse.json(
          { error: `Telegram rejeitou o token: ${tgData.description || 'token inválido'}` },
          { status: 400 }
        );
      }
      webhookRegistered = true;
    }

    const agent = await markDeployed(agentId, target, {
      botToken: botToken || null,
      phoneNumber: phoneNumber || null,
      webhookUrl: target === 'telegram' ? webhookUrl : null,
      deployedAt: new Date().toISOString(),
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const message = target === 'telegram'
      ? webhookRegistered
        ? 'Webhook registrado com sucesso! Seu agente está ativo no Telegram.'
        : `Agente salvo! Para ativar em produção, defina NEXT_PUBLIC_BASE_URL com sua URL HTTPS pública no .env e reimplante. Webhook manual: POST https://api.telegram.org/bot${botToken}/setWebhook com url=${webhookUrl}`
      : 'Agente configurado para WhatsApp.';

    return NextResponse.json({ success: true, target, agentId, webhookUrl, webhookRegistered, message });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
