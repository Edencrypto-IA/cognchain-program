import { NextRequest, NextResponse } from 'next/server';
import { getForgeTemplate, listForgeTemplates } from '@/lib/forge/templates';
import { isSafeForgePath, normalizeForgePath, inferLanguage } from '@/lib/forge/paths';
import type { ForgeFile } from '@/lib/forge/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ templates: listForgeTemplates() });
}

export async function POST(request: NextRequest) {
  let body: { templateId?: unknown };
  try {
    body = await request.json() as { templateId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.templateId !== 'string' || !body.templateId.trim()) {
    return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
  }

  const template = getForgeTemplate(body.templateId);
  if (!template) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 404 });
  }

  // Apply the same path allowlist used by model proposals — never trust input.
  const files: ForgeFile[] = [];
  for (const file of template.files) {
    const path = normalizeForgePath(file.path);
    if (!isSafeForgePath(path)) continue;
    files.push({
      path,
      language: inferLanguage(path, file.language),
      status: 'created',
      contents: file.contents,
    });
  }

  if (!files.length) {
    return NextResponse.json({ error: 'Template has no applicable files' }, { status: 422 });
  }

  return NextResponse.json({
    template: { id: template.id, name: template.name, description: template.description },
    files,
  });
}
