'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Database, FileCode2, Folder, Loader2, Upload } from 'lucide-react';
import type { ForgeBuildStep, ForgeFile } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

const EXPLORER_COLLAPSE_KEY = 'forge:explorer:collapsed:v1';

type ExplorerSection = {
  id: string;
  label: string;
  prefix: string;
};

const EXPLORER_SECTIONS: ExplorerSection[] = [
  { id: 'app', label: '📄 App', prefix: 'src/app/' },
  { id: 'components', label: '🧩 Components', prefix: 'src/components/' },
  { id: 'lib', label: '📦 Lib', prefix: 'src/lib/' },
  { id: 'hooks', label: '🪝 Hooks', prefix: 'src/hooks/' },
  { id: 'solana', label: '⬡ Solana', prefix: 'src/solana/' },
  { id: 'uploads', label: '⬆ Uploads', prefix: 'src/forge-uploads/' },
  { id: 'core', label: 'Core', prefix: 'src/' },
];

function shortFileName(filePath: string): string {
  return filePath.split('/').at(-1) ?? filePath;
}

export interface ForgeUploadedFile {
  path: string;
  name: string;
  language: string;
  size: number;
}

function ForgeFileExplorerComponent({
  files,
  selectedFile,
  buildSteps,
  busy,
  onSelectFile,
  onUploaded,
  onUploadError,
  onSaveAsMemory,
}: {
  files: ForgeFile[];
  selectedFile: string;
  buildSteps: ForgeBuildStep[];
  busy: boolean;
  onSelectFile: (path: string) => void;
  onUploaded: (files: ForgeUploadedFile[]) => void;
  onUploadError: (message: string) => void;
  onSaveAsMemory?: (path: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFiles = useCallback(async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (!incoming.length || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      incoming.forEach(file => form.append('files', file));
      const response = await fetch('/api/forge/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const data = await response.json() as {
        ok?: boolean;
        files?: ForgeUploadedFile[];
        errors?: string[];
        error?: string;
      };
      if (!response.ok || data.ok !== true || !Array.isArray(data.files)) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Upload falhou');
      }
      if (data.files.length) onUploaded(data.files);
      if (data.errors?.length) onUploadError(data.errors.join(' · '));
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Upload falhou');
    } finally {
      setUploading(false);
    }
  }, [uploading, onUploaded, onUploadError]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPLORER_COLLAPSE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setCollapsed(parsed);
    } catch {
      setCollapsed({});
    }
  }, []);

  const sections = useMemo(() => {
    const used = new Set<string>();
    return EXPLORER_SECTIONS.map(section => {
      const sectionFiles = files
        .filter(file => {
          if (used.has(file.path)) return false;
          if (section.id === 'core') {
            return ['src/skills/', 'src/store/', 'src/trigger/', 'src/security/'].some(prefix => file.path.startsWith(prefix));
          }
          return file.path.startsWith(section.prefix);
        })
        .sort((a, b) => a.path.localeCompare(b.path));
      sectionFiles.forEach(file => used.add(file.path));
      return { ...section, files: sectionFiles };
    }).filter(section => section.files.length > 0);
  }, [files]);

  const toggleSection = (sectionId: string) => {
    setCollapsed(current => {
      const next = { ...current, [sectionId]: !current[sectionId] };
      try {
        window.localStorage.setItem(EXPLORER_COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Show progress only while a run actually has something to show.
  const hasActiveTasks = buildSteps.some(step => step.status !== 'pending');

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-white/[0.07] bg-[#0a0a0c]/82 transition-shadow',
        dragOver && 'shadow-[inset_0_0_0_2px_rgba(20,241,149,0.5)]',
      )}
      onDragOver={event => { event.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.07] px-3">
        <Folder className="size-3.5 text-white/35" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Explorer</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={event => {
            if (event.target.files?.length) void uploadFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || busy}
          title="Carregar arquivos do seu computador (máx 1MB cada, até 10)"
          className="ml-auto flex h-6 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 text-[10px] text-white/45 transition-colors hover:border-[#14F195]/30 hover:text-[#14F195] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
          <span className="hidden sm:inline">Carregar</span>
        </button>
      </div>
      {dragOver ? (
        <div className="pointer-events-none flex flex-1 items-center justify-center border-2 border-dashed border-[#14F195]/40 m-2 rounded-xl text-[11px] text-[#14F195]/70">
          Solte os arquivos para carregar no sandbox
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        <div className="space-y-1">
          {sections.map(section => {
            const isCollapsed = collapsed[section.id] ?? false;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36 transition-colors hover:bg-white/[0.035] hover:text-white/62"
                >
                  {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  <span className="font-mono text-[9px] text-white/22">{section.files.length}</span>
                </button>
                {!isCollapsed ? (
                  <div className="space-y-0.5">
                    {section.files.map(file => {
                      const isUpload = file.path.startsWith('src/forge-uploads/');
                      return (
                        <div
                          key={file.path}
                          role="button"
                          tabIndex={0}
                          title={file.path}
                          onClick={() => onSelectFile(file.path)}
                          onKeyDown={event => { if (event.key === 'Enter') onSelectFile(file.path); }}
                          className={cn(
                            'flex w-full min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-white/46 transition-colors hover:bg-white/[0.045] hover:text-white/80',
                            file.path === selectedFile && 'bg-white/[0.06] text-white/85',
                          )}
                        >
                          <FileCode2 className="size-3.5 shrink-0 text-[#14F195]/55" />
                          <span className="min-w-0 flex-1 truncate font-mono">{shortFileName(file.path)}</span>
                          {isUpload && onSaveAsMemory ? (
                            <button
                              type="button"
                              onClick={event => { event.stopPropagation(); onSaveAsMemory(file.path); }}
                              title="Salvar como memória verificável (hash)"
                              className="grid size-5 shrink-0 place-items-center rounded border border-white/[0.07] bg-white/[0.03] text-white/30 transition-colors hover:border-[#00D4FF]/40 hover:text-[#5EEAD4]"
                            >
                              <Database className="size-3" />
                            </button>
                          ) : null}
                          <span className="hidden rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase text-white/22 xl:inline">
                            {file.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {hasActiveTasks && (
          <>
            <p className="mt-4 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Progresso</p>
            <div className="space-y-0.5">
              {buildSteps.map(step => {
                const Icon = step.status === 'complete' ? CheckCircle2 : step.status === 'running' ? Loader2 : Circle;
                return (
                  <div key={step.id} className="rounded-lg px-2 py-1.5 text-[11px] text-white/42">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('size-3.5 shrink-0', step.status === 'complete' && 'text-[#14F195]', step.status === 'running' && 'animate-spin text-[#38BDF8]', step.status === 'pending' && 'text-white/18')} />
                      <span className="min-w-0 flex-1 truncate">{step.label}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 pl-5 text-[10px] leading-4 text-white/26">{step.result || step.detail}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export const ForgeFileExplorer = memo(ForgeFileExplorerComponent);
