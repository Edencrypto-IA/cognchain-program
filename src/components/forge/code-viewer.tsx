'use client';

import { Copy, FileCode2 } from 'lucide-react';
import type { ForgeFile } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

export function CodeViewer({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: ForgeFile[];
  selectedFile: string;
  onSelectFile: (path: string) => void;
}) {
  const file = files.find(item => item.path === selectedFile) ?? files[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-44 shrink-0 border-r border-white/[0.07] p-2 md:block">
          <div className="space-y-1">
            {files.map(item => (
              <button
                key={item.path}
                onClick={() => onSelectFile(item.path)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] text-white/42 transition-colors',
                  item.path === file?.path && 'bg-white/[0.06] text-white/80',
                )}
              >
                <FileCode2 className="size-3 shrink-0 text-[#14F195]/70" />
                <span className="truncate">{item.path}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-white/70">{file?.path}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/25">{file?.language} · {file?.status}</p>
            </div>
            <button
              onClick={() => file && navigator.clipboard?.writeText(file.contents).catch(() => {})}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-white/35 transition-colors hover:text-white/75"
              aria-label="Copy code"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <pre className="h-[440px] overflow-auto p-4 text-[12px] leading-6 text-white/65">
            <code>{file?.contents}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
