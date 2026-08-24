import { NextRequest, NextResponse } from 'next/server';
import { callModel } from '@/services/ai/ai.router';
import { saveMemory } from '@/services/memory/memory.service';
import { incrementInteraction } from '@/services/agents/agent.service';
import { runMythosForChannel } from '@/lib/mythos/agent-channel';
import { sendTelegramMessage } from '@/lib/mythos/notify';

/**
 * Telegram Webhook Handler
 * Receives messages from Telegram bot API and routes to CONGCHAIN agent.
 * 
 * Setup: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/webhook/telegram?agentId=<AGENT_ID>
 * 
 * Mythos mode: use ?mode=mythos — runs the autonomous Mythos agent (agentic
 * loop with tools) and replies with the summary. Chat authorization via
 * TELEGRAM_ALLOWED_CHAT_IDS (comma-separated); empty = allow all.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Telegram update format
    const message = body.message || body.edited_message;
    if (!message?.text) {
      return NextResponse.json({ ok: true }); // Ignore non-text messages
    }

    const chatId = message.chat.id;
    const text = message.text;
    const from = message.from?.username || message.from?.first_name || 'unknown';

    // Get agentId from query param
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // ── MYTHOS AUTONOMOUS MODE ──────────────────────────────────────────
    if (searchParams.get('mode') === 'mythos' || (!agentId && process.env.TELEGRAM_BOT_TOKEN)) {
      const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
        .split(',').map(value => value.trim()).filter(Boolean);
      if (allowed.length > 0 && !allowed.includes(String(chatId))) {
        return NextResponse.json({ ok: true }); // Chat não autorizado — ignora
      }

      const result = await runMythosForChannel(text);
      await sendTelegramMessage(chatId, result.text);
      return NextResponse.json({ ok: true, mode: 'mythos', response: result.text.slice(0, 200) });
    }

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    // Get agent config
    const { db } = await import('@/lib/db');
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Build messages for AI
    const messages = [{ role: 'user' as const, content: `[Telegram @${from}]: ${text}` }];

    // Get agent model
    const model = agent.model || 'gpt';

    // Call AI with agent context
    const systemPrompt = agent.systemPrompt || `Voce e o agente "${agent.name}" do CONGCHAIN. Responda em portugues.`;

    const result = await callModel({
      model,
      messages,
      systemPrompt,
      useContext: true,
      agentName: agent.name,
    });

    // Save interaction memory
    try {
      await saveMemory({
        content: `[Telegram @${from}]: ${text}\n[Agent ${agent.name}]: ${result.content}`,
        model,
      });
      await incrementInteraction(agentId);
    } catch {
      // Memory save is best-effort
    }

    // Send response back to Telegram (fire-and-forget)
    const botToken = agent.deployConfig ? JSON.parse(agent.deployConfig).botToken : null;
    if (botToken) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: result.content.substring(0, 4096), // Telegram max message length
          parse_mode: 'Markdown',
        }),
      }).catch(() => {}); // Fire-and-forget
    }

    return NextResponse.json({ ok: true, agentId, response: result.content });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
