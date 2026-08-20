/**
 * Forge build memory — assemble the CognChain memory payload for a completed
 * agentic build. Kept pure so it can be unit-tested.
 */

export interface ForgeMemoryInput {
  prompt?: string;
  deployStatus?: string;
  files: string[];
  sandboxHash?: string;
  verify?: string;
  source?: string;
}

/** The model attribution used when saving Forge build memory to CognChain. */
export const FORGE_MEMORY_MODEL = 'nvidia';

export function buildForgeMemoryContent(input: ForgeMemoryInput): string {
  const lines = [
    'Forge build agêntico',
    `Prompt: ${input.prompt || 'manual session'}`,
    `Status: ${input.deployStatus || 'n/a'}`,
    `Arquivos: ${input.files.length ? input.files.join(', ') : 'nenhum'}`,
    `Sandbox: ${input.sandboxHash || 'n/a'}`,
    `Verificação: ${input.verify || 'n/a'}`,
    input.source ? `Fonte: ${input.source}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
