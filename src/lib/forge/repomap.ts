/**
 * Forge repo map — lightweight, dependency-free repository understanding.
 *
 * Builds a keyword index per file (imports, identifiers, components, domain
 * terms) and scores files against a prompt so the agentic loop can inject the
 * most relevant files automatically — no @file selection needed.
 *
 * Pure functions only; the orchestration (reading files, caching) lives in
 * context-search.ts.
 */

export interface RepoFileEntry {
  path: string;
  language: string;
  size?: number;
}

export interface IndexedFile extends RepoFileEntry {
  keywords: Set<string>;
  head: string;
}

export interface RepoIndex {
  files: IndexedFile[];
  builtAt: number;
}

export const REPO_MAP_MAX_FILES = 80;
export const REPO_HEAD_CHARS = 600;
export const REPO_KEYWORD_SAMPLE_CHARS = 2_000;

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'que', 'uma', 'um', 'em', 'e', 'o', 'a', 'os', 'as',
  'se', 'na', 'no', 'nas', 'nos', 'por', 'ao', 'aos', 'pra', 'pro', 'the', 'and', 'for', 'with',
  'from', 'this', 'that', 'are', 'was', 'has', 'have', 'not', 'you', 'your', 'is', 'of', 'to', 'in',
  'on', 'it', 'as', 'at', 'be', 'or', 'an', 'we', 'our', 'but', 'can', 'will', 'all', 'if', 'then',
  'else', 'when', 'new', 'use', 'const', 'let', 'var', 'return', 'export', 'import', 'function',
]);

const DOMAIN_TERMS = [
  'api', 'route', 'page', 'layout', 'component', 'hook', 'service', 'model', 'store', 'agent',
  'memory', 'forge', 'solana', 'anchor', 'wallet', 'token', 'pump', 'jupiter', 'auth', 'user',
  'chat', 'pay', 'office', 'brain', 'mythos', 'zk', 'blockchain', 'prisma', 'db', 'security',
  'keys', 'market', 'nft', 'rpc', 'cache', 'grounding', 'skill',
];

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-zà-ú0-9_]{3,}/g) ?? [];
  return words
    .filter(word => !STOPWORDS.has(word))
    .map(word => SYNONYM_MAP[word] ?? word);
}

/** Common PT→EN synonyms so "botao" matches "button" in code keywords. */
const SYNONYM_MAP: Record<string, string> = {
  botao: 'button', botoes: 'button', pagina: 'page', paginas: 'page',
  carteira: 'wallet', usuario: 'user', usuarios: 'user', senha: 'password',
  mensagem: 'message', mensagens: 'message', arquivo: 'file', arquivos: 'file',
  login: 'login', trocar: 'swap', troca: 'swap', trocas: 'swap', preco: 'price',
  precos: 'price', mercado: 'market', agente: 'agent', agentes: 'agent',
  memoria: 'memory', memorias: 'memory', seguranca: 'security', autenticacao: 'auth',
  painel: 'dashboard', chave: 'key', chaves: 'key', ancorar: 'anchor', ancora: 'anchor',
  validar: 'verify', verificacao: 'verify', provar: 'proof', prova: 'proof',
  busca: 'search', pesquisar: 'search', chat: 'chat', enviar: 'send', receber: 'receive',
  pagar: 'pay', pagamento: 'pay', historico: 'history', alerta: 'alert', alertas: 'alert',
  formulario: 'form', form: 'form', listagem: 'list', lista: 'list', criar: 'create',
  criacao: 'create', editar: 'edit', edicao: 'edit', excluir: 'delete', remover: 'delete',
  conexao: 'connection', conectar: 'connect', assinatura: 'sign', assinar: 'sign',
  transacao: 'transaction', transacoes: 'transaction', notificacao: 'notification',
};

export function extractKeywords(content: string): Set<string> {
  const keywords = new Set<string>();

  // Import targets (last path segment, without extension).
  for (const match of content.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const segments = (match[1] ?? '').split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const cleaned = last.replace(/\.(tsx?|jsx?|json)$/, '');
    if (cleaned) keywords.add(cleaned.toLowerCase());
  }

  // Declared identifiers.
  for (const match of content.matchAll(/\b(function|const|class|interface|type|export default)\s+([A-Za-z_$][\w$]*)/g)) {
    keywords.add((match[2] ?? '').toLowerCase());
  }

  // PascalCase component names.
  for (const match of content.matchAll(/\b[A-Z][A-Za-z0-9]{2,}\b/g)) {
    keywords.add((match[0] ?? '').toLowerCase());
  }

  // Domain terms hint at responsibility.
  for (const term of DOMAIN_TERMS) {
    if (new RegExp(`\\b${term}\\b`, 'i').test(content)) keywords.add(term);
  }

  // General content tokens from the head of the file.
  tokenize(content.slice(0, REPO_KEYWORD_SAMPLE_CHARS)).forEach(token => keywords.add(token));

  return keywords;
}

export async function buildRepoIndex(
  files: RepoFileEntry[],
  readContent: (path: string) => Promise<string | null> | string | null,
): Promise<RepoIndex> {
  const indexed: IndexedFile[] = [];
  for (const file of files) {
    const content = await readContent(file.path);
    if (!content) continue;
    indexed.push({
      ...file,
      keywords: extractKeywords(content),
      head: content.slice(0, REPO_HEAD_CHARS),
    });
  }
  return { files: indexed, builtAt: Date.now() };
}

export interface ScoredPath {
  path: string;
  score: number;
}

export function scorePromptAgainstIndex(
  promptTokens: string[],
  index: RepoIndex,
  maxFiles: number,
): ScoredPath[] {
  const scored = index.files.map(file => {
    let score = 0;
    const pathLower = file.path.toLowerCase();
    const headLower = file.head.toLowerCase();
    for (const token of promptTokens) {
      if (file.keywords.has(token)) score += 2;
      if (pathLower.includes(token)) score += 3;
      if (headLower.includes(token)) score += 1;
    }
    // Slight preference for shallow paths (more likely core entry points).
    const depth = file.path.split('/').length;
    score += Math.max(0, 6 - depth) * 0.25;
    return { path: file.path, score };
  });
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);
}

/** Compact repository map: one path per line, capped. */
export function buildRepoMapLine(index: RepoIndex, maxFiles: number = REPO_MAP_MAX_FILES): string {
  return index.files
    .slice(0, maxFiles)
    .map(file => `- ${file.path}`)
    .join('\n');
}
