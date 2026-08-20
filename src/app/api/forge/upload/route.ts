import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { FORGE_FILE_EXTENSIONS, inferLanguage } from '@/lib/forge/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES_PER_REQUEST = 10;
const MAX_FILE_BYTES = 1_000_000;

function sanitizeUploadName(input: string): string | null {
  const base = path.basename(input).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base.startsWith('.') || base.length > 120) return null;
  const ext = path.extname(base).toLowerCase();
  if (!FORGE_FILE_EXTENSIONS.has(ext)) return null;
  return base;
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form' }, { status: 400 });
  }

  const entries = form.getAll('files').filter(item => item instanceof File) as File[];
  if (!entries.length) {
    return NextResponse.json({ error: 'No files uploaded (field: files)' }, { status: 400 });
  }
  if (entries.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ error: `Max ${MAX_FILES_PER_REQUEST} files per request` }, { status: 413 });
  }

  const uploadDir = path.resolve(process.cwd(), 'src/forge-uploads');
  const saved: Array<{ path: string; name: string; language: string; size: number }> = [];
  const errors: string[] = [];

  await mkdir(uploadDir, { recursive: true });
  for (const file of entries) {
    const name = sanitizeUploadName(file.name);
    if (!name) {
      errors.push(`Arquivo rejeitado (nome ou extensão não permitida): ${file.name}`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`Arquivo muito grande (máx 1MB): ${name}`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!buffer.length) {
      errors.push(`Arquivo vazio: ${name}`);
      continue;
    }
    const absolutePath = path.join(uploadDir, name);
    await writeFile(absolutePath, buffer);
    saved.push({ path: `src/forge-uploads/${name}`, name, language: inferLanguage(name), size: buffer.length });
  }

  if (!saved.length && errors.length) {
    return NextResponse.json({ ok: false, files: [], errors }, { status: 422 });
  }

  return NextResponse.json({ ok: true, files: saved, errors });
}
