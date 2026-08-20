/**
 * Forge cost router — classify the task and pick the cheapest model that can
 * handle it, respecting the user tier (free vs pro).
 *
 * Philosophy (the "China playbook"): don't spend frontier-model tokens on
 * simple refactors. Simple tasks go to cheap models (Qwen free-tier,
 * DeepSeek pro-tier); complex/architecture/Solana work goes to the strongest
 * model the tier allows (Llama/NVIDIA free, Claude pro).
 */

export type ForgeTaskComplexity = 'simple' | 'complex';

const SIMPLE_SIGNALS = [
  /\b(refactor|refatorar|rename|renomear|fix|corrigir|corrige|bug|typo|format\w*|lint|traduz\w*|translat\w*|coment[áa]rio|comment|ajustar|ajuste|tweak|simplif\w*|small|pequen\w*|limpar|cleanup|clean up|tipagem|type fix|estilo|style)\b/i,
];

const COMPLEX_SIGNALS = [
  /\b(arquitetura|architecture|dapp|dApps|programa anchor|anchor|program|solana|wallet|carteira|security|seguran[çc]a|migra[çc][ãa]o|migration|multi-?file|multi-?arquivo|end-?to-?end|completo|full|design system|autentica[çc][ãa]o|auth|jupiter|pump|token|deploy|microservi[çc]os|escalab\w*|performance|otimiza[çc][ãa]o de arquitetura|novo projeto|create a|construir|build a)\b/i,
];

export function classifyForgeTask(prompt: string): ForgeTaskComplexity {
  if (COMPLEX_SIGNALS.some(pattern => pattern.test(prompt))) return 'complex';
  if (SIMPLE_SIGNALS.some(pattern => pattern.test(prompt))) return 'simple';
  // Default to the strongest model when unsure: a wrong cheap guess costs a
  // wasted loop; a wrong expensive guess only costs a few cents.
  return 'complex';
}

/** Pick the cheapest model that fits the task and the user's tier. */
export function selectForgeModel(
  prompt: string,
  userPlan: 'free' | 'pro',
  opts?: { preferLocal?: boolean },
): string {
  if (opts?.preferLocal) return 'ollama';
  const complexity = classifyForgeTask(prompt);
  if (userPlan === 'pro') {
    return complexity === 'simple' ? 'deepseek' : 'claude';
  }
  return complexity === 'simple' ? 'qwen' : 'nvidia';
}
