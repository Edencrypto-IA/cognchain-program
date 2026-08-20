/**
 * Forge repo context — build the file-context block injected into the agentic
 * loop prompts. Kept pure so it can be unit-tested without a server.
 */

export const FORGE_MAX_CONTEXT_FILES = 5;
export const FORGE_MAX_CONTEXT_FILE_CHARS = 24_000;
export const FORGE_MAX_CONTEXT_TOTAL_CHARS = 60_000;

export interface ForgeContextFile {
  path: string;
  content: string;
}

/** Sanitize the raw `contextFiles` body field into at most 5 clean path strings. */
export function validateContextFiles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const item of input) {
    if (paths.length >= FORGE_MAX_CONTEXT_FILES) break;
    if (typeof item !== 'string') continue;
    const clean = item.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!clean || clean.length > 180 || clean.includes('\0') || clean.includes('..') || clean.startsWith('/') || seen.has(clean)) continue;
    seen.add(clean);
    paths.push(clean);
  }
  return paths;
}

/** Build the markdown context block prepended to the user prompt. */
export function buildForgeContextBlock(files: ForgeContextFile[]): string {
  const usable = files
    .filter(file => file.path && typeof file.content === 'string' && file.content.length > 0)
    .slice(0, FORGE_MAX_CONTEXT_FILES);
  if (!usable.length) return '';
  let total = 0;
  const blocks: string[] = [];
  for (const file of usable) {
    const content = file.content.slice(0, FORGE_MAX_CONTEXT_FILE_CHARS);
    if (total + content.length > FORGE_MAX_CONTEXT_TOTAL_CHARS) break;
    total += content.length;
    blocks.push(`--- FILE: ${file.path} ---\n${content}\n--- END FILE ---`);
  }
  if (!blocks.length) return '';
  return `Contexto de arquivos do repositório:\n${blocks.join('\n\n')}\n\n`;
}

/** Extract [FILE:path] mentions from a composer prompt (used by the agentic submit). */
export function extractFileMentions(prompt: string): string[] {
  const mentions: string[] = [];
  const pattern = /\[FILE:([^\]]+)]/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = pattern.exec(prompt))) {
    const path = (match[1] ?? '').trim();
    if (path && !seen.has(path)) {
      seen.add(path);
      mentions.push(path);
    }
    if (mentions.length >= FORGE_MAX_CONTEXT_FILES) break;
  }
  return mentions;
}

/** Strip [FILE:path] tokens from a composer prompt. */
export function stripFileMentions(prompt: string): string {
  return prompt.replace(/\[FILE:[^\]]+]/g, '').replace(/\s{2,}/g, ' ').trim();
}
