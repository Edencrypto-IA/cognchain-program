import path from 'node:path';

/**
 * Forge path safety — single source of truth for path validation.
 *
 * Two layers exist on purpose:
 *  - `isSafeForgePath` / `normalizeForgePath`: validates paths that a MODEL proposes
 *    (prefix allowlist, no traversal). Used by chat + agent loop extraction.
 *  - `resolveForgePath`: resolves a client-provided path to a real file inside
 *    `src/` (root + extension allowlist + containment check). Used by file
 *    read/save/apply routes and anything that touches the filesystem.
 *
 * NEVER relax these: they are the only boundary between model output and disk.
 */

export const FORGE_SAFE_FILE_PREFIXES = ['app/', 'components/', 'lib/', 'hooks/', 'solana/'];

export const FORGE_FILE_ROOTS = [
  'app/',
  'components/',
  'lib/',
  'hooks/',
  'solana/',
  'src/app/',
  'src/components/',
  'src/lib/',
  'src/hooks/',
  'src/solana/',
  'src/forge-uploads/',
];

export const FORGE_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.rs',
  '.py', '.sol', '.toml', '.yaml', '.yml', '.sh', '.html', '.sql', '.txt',
]);

export const FORGE_EXPLORER_ROOTS = [
  'src/app',
  'src/components',
  'src/lib',
  'src/hooks',
  'src/solana',
  'src/skills',
  'src/store',
  'src/trigger',
  'src/security',
  'src/forge-uploads',
];

export const FORGE_MAX_FILE_PATH = 180;

export function normalizeForgePath(input: string): string {
  return input
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

/** Model-proposed path guard: relative, no traversal, safe prefix, sane length. */
export function isSafeForgePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= FORGE_MAX_FILE_PATH &&
    !path.startsWith('/') &&
    !path.includes('..') &&
    FORGE_SAFE_FILE_PREFIXES.some(prefix => path.startsWith(prefix))
  );
}

export function inferLanguage(path: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim().slice(0, 20);
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'md';
  if (path.endsWith('.rs')) return 'rs';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.sol')) return 'sol';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.toml')) return 'toml';
  if (path.endsWith('.sh')) return 'bash';
  if (path.endsWith('.sql')) return 'sql';
  return 'txt';
}

export interface ResolvedForgePath {
  relativePath: string;
  absolutePath: string;
}

/**
 * Resolve a client input path to a real file under `src/`.
 * Returns null for anything outside the allowlist or the src root.
 */
export function resolveForgePath(input: string): ResolvedForgePath | null {
  const clean = normalizeForgePath(input);
  if (!clean || clean.includes('\0') || clean.includes('..') || clean.startsWith('/') || clean.length > FORGE_MAX_FILE_PATH) return null;
  if (!FORGE_FILE_ROOTS.some(prefix => clean.startsWith(prefix))) return null;

  const extension = clean.slice(clean.lastIndexOf('.')).toLowerCase();
  if (!FORGE_FILE_EXTENSIONS.has(extension)) return null;

  const relativePath = clean.startsWith('src/') ? clean : `src/${clean}`;
  const projectRoot = process.cwd();
  const absolutePath = path.resolve(projectRoot, relativePath);
  const srcRoot = path.resolve(projectRoot, 'src');
  if (absolutePath !== srcRoot && !absolutePath.startsWith(`${srcRoot}${path.sep}`)) return null;
  return { relativePath, absolutePath };
}
