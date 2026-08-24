/**
 * Mythos channel adapter — runs the agentic loop for a chat/task command and
 * returns a compact deliverable text (used by Telegram webhook + scheduler).
 */

import { runMythosAgenticLoop } from './agentic-run';

export interface MythosChannelRunResult {
  text: string;
  ok: boolean;
  proposals: number;
  toolsUsed: number;
  error?: string;
}

/** Run the Mythos agent for a channel command and build the reply text. */
export async function runMythosForChannel(command: string, options?: { model?: string }): Promise<MythosChannelRunResult> {
  let summary = '';
  let proposals = 0;
  let toolsUsed = 0;
  let errorMessage = '';

  await runMythosAgenticLoop(
    command.slice(0, 2000),
    (event) => {
      if (event.type === 'done') {
        summary = event.summary;
        proposals = event.proposals.length;
        toolsUsed = event.tools.length;
      }
      if (event.type === 'error') errorMessage = event.message;
    },
    { model: options?.model },
  );

  if (errorMessage) {
    return { text: `🧠 Mythos · ${command.slice(0, 120)}\n\n⚠️ Erro: ${errorMessage}`, ok: false, proposals: 0, toolsUsed, error: errorMessage };
  }

  const base = `🧠 Mythos · ${command.slice(0, 120)}${toolsUsed ? ` (${toolsUsed} ferramentas)` : ''}\n\n${summary}`;
  const tail = proposals > 0
    ? `\n\n⚠️ ${proposals} proposta(s) aguardando aprovacao no console (/mythos/agent).`
    : '';
  return { text: `${base}${tail}`, ok: true, proposals, toolsUsed };
}
