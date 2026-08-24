/**
 * Mythos channel delivery — sends agent results to Telegram and WhatsApp.
 *
 * - Telegram: official Bot API (TELEGRAM_BOT_TOKEN env).
 * - WhatsApp: Twilio WhatsApp API when configured (TWILIO_ACCOUNT_SID,
 *   TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM). Returns not-configured otherwise.
 *
 * Never logs tokens. Only sends to targets the user configured.
 */

export type MythosChannel = 'telegram' | 'whatsapp';

export interface DeliveryResult {
  ok: boolean;
  channel: MythosChannel;
  reason?: string;
  messageId?: string;
}

const TELEGRAM_API = 'https://api.telegram.org';
const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

export function truncateForChannel(text: string, max = 3900): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}…`;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, channel: 'telegram', reason: 'TELEGRAM_BOT_TOKEN nao configurado.' };

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: truncateForChannel(text),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number } };
    if (!response.ok || data.ok !== true) {
      return { ok: false, channel: 'telegram', reason: `HTTP ${response.status}` };
    }
    return { ok: true, channel: 'telegram', messageId: data.result?.message_id ? String(data.result.message_id) : undefined };
  } catch (error) {
    return { ok: false, channel: 'telegram', reason: error instanceof Error ? error.message : 'falha de rede' };
  }
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<DeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !auth || !from) {
    return { ok: false, channel: 'whatsapp', reason: 'Twilio nao configurado (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM).' };
  }

  try {
    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${to}`,
      Body: truncateForChannel(text, 1500),
    });
    const basic = Buffer.from(`${sid}:${auth}`).toString('base64');
    const response = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({})) as { sid?: string; status?: string; message?: string };
    if (!response.ok) {
      return { ok: false, channel: 'whatsapp', reason: typeof data.message === 'string' ? data.message : `HTTP ${response.status}` };
    }
    return { ok: true, channel: 'whatsapp', messageId: data.sid };
  } catch (error) {
    return { ok: false, channel: 'whatsapp', reason: error instanceof Error ? error.message : 'falha de rede' };
  }
}

/** Dispatch to a channel; unknown/not-configured channels return ok:false. */
export async function deliverToChannel(
  channel: MythosChannel,
  target: string,
  text: string,
): Promise<DeliveryResult> {
  if (channel === 'telegram') return sendTelegramMessage(target, text);
  if (channel === 'whatsapp') return sendWhatsAppMessage(target, text);
  return { ok: false, channel, reason: `Canal desconhecido: ${channel}` };
}

export function channelLabel(channel: MythosChannel): string {
  return channel === 'telegram' ? 'Telegram' : 'WhatsApp';
}
