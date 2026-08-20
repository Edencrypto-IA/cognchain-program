import { readFile, writeFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { resolveForgePath } from '@/lib/forge/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DIFF_LENGTH = 260_000;

type ApplyBody = {
  path?: unknown;
  diff?: unknown;
  originalCode?: unknown;
  proposedCode?: unknown;
};

function parseHunkStart(header: string): number | null {
  const match = /^@@\s+-(\d+)(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/.exec(header);
  if (!match) return null;
  return Math.max(0, Number(match[1]) - 1);
}

function applyUnifiedDiff(original: string, diff: string): string {
  const originalLines = original.split('\n');
  const diffLines = diff.replace(/\r\n/g, '\n').split('\n');
  const next: string[] = [];
  let originalIndex = 0;
  let sawHunk = false;

  for (const line of diffLines) {
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('@@')) {
      sawHunk = true;
      const hunkStart = parseHunkStart(line);
      if (hunkStart == null) continue;
      while (originalIndex < hunkStart && originalIndex < originalLines.length) {
        next.push(originalLines[originalIndex] ?? '');
        originalIndex += 1;
      }
      continue;
    }
    if (!sawHunk) continue;
    if (line.startsWith('+')) {
      next.push(line.slice(1));
      continue;
    }
    if (line.startsWith('-')) {
      originalIndex += 1;
      continue;
    }
    if (line.startsWith(' ')) {
      next.push(line.slice(1));
      originalIndex += 1;
    }
  }

  if (!sawHunk) {
    const rebuilt = diffLines
      .filter(line => !line.startsWith('---') && !line.startsWith('+++'))
      .filter(line => !line.startsWith('-'))
      .map(line => line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line)
      .join('\n')
      .trimEnd();
    if (rebuilt) return `${rebuilt}\n`;
    throw new Error('Diff did not contain applicable hunks');
  }

  while (originalIndex < originalLines.length) {
    next.push(originalLines[originalIndex] ?? '');
    originalIndex += 1;
  }

  return next.join('\n');
}

function applyExactReplacement(original: string, originalCode: string, proposedCode: string): string {
  const index = original.indexOf(originalCode);
  if (index < 0) throw new Error('Selected code was not found in the current file');
  return `${original.slice(0, index)}${proposedCode}${original.slice(index + originalCode.length)}`;
}

export async function POST(request: NextRequest) {
  let body: ApplyBody;
  try {
    body = await request.json() as ApplyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.path !== 'string' || typeof body.diff !== 'string') {
    return NextResponse.json({ error: 'Missing path or diff' }, { status: 400 });
  }
  if (body.diff.length > MAX_DIFF_LENGTH) {
    return NextResponse.json({ error: 'Diff is too large' }, { status: 413 });
  }

  const target = resolveForgePath(body.path);
  if (!target) {
    return NextResponse.json({ error: 'Unsafe or unsupported Forge path' }, { status: 400 });
  }

  const original = await readFile(target.absolutePath, 'utf8').catch(() => '');
  const content = typeof body.originalCode === 'string' && typeof body.proposedCode === 'string'
    ? applyExactReplacement(original, body.originalCode, body.proposedCode)
    : applyUnifiedDiff(original, body.diff);
  await writeFile(target.absolutePath, content, 'utf8');

  return NextResponse.json({
    ok: true,
    path: target.relativePath,
    content,
    bytes: Buffer.byteLength(content, 'utf8'),
  });
}
