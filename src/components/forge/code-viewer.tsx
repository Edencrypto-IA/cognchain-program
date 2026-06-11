'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Edit3, FileCode2, Loader2, Save, WandSparkles, X } from 'lucide-react';
import type { ForgeDiffProposal, ForgeFile } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

type CodeMirrorView = {
  state: {
    doc: { toString: () => string; sliceString: (from: number, to: number) => string };
    selection: { main: { from: number; to: number } };
  };
  coordsAtPos?: (pos: number) => { left: number; right: number; top: number; bottom: number } | null;
  dispatch: (spec: { effects?: unknown }) => void;
  destroy: () => void;
};

type CodeMirrorCompartment = {
  reconfigure: (extension: unknown) => unknown;
};

type CodeMirrorModule = {
  basicSetup: unknown;
  EditorState: {
    create: (config: { doc: string; extensions: unknown[] }) => unknown;
    readOnly: { of: (value: boolean) => unknown };
  };
  EditorView: {
    new(config: { state: unknown; parent: HTMLElement }): CodeMirrorView;
    theme: (rules: Record<string, Record<string, string>>, options?: { dark?: boolean }) => unknown;
    lineWrapping: unknown;
    updateListener: {
      of: (listener: (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) => unknown;
    };
  };
  Compartment: { new(): CodeMirrorCompartment };
  keymap: { of: (bindings: Array<{ key: string; preventDefault?: boolean; run: () => boolean }>) => unknown };
  lineNumbers: () => unknown;
  highlightActiveLine: () => unknown;
};

const CODEMIRROR_CDN = 'https://cdn.jsdelivr.net/npm/codemirror@6/dist/index.js';

const LANGUAGE_LOADERS: Array<{ test: (path: string) => boolean; load: () => Promise<unknown> }> = [
  {
    test: path => path.endsWith('.tsx'),
    load: async () => {
      const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-javascript@6.2.4/+esm');
      return (mod as { javascript: (config?: { typescript?: boolean; jsx?: boolean }) => unknown }).javascript({ typescript: true, jsx: true });
    },
  },
  {
    test: path => path.endsWith('.ts'),
    load: async () => {
      const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-javascript@6.2.4/+esm');
      return (mod as { javascript: (config?: { typescript?: boolean }) => unknown }).javascript({ typescript: true });
    },
  },
  {
    test: path => path.endsWith('.json'),
    load: async () => {
      const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-json@6.0.2/+esm');
      return (mod as { json: () => unknown }).json();
    },
  },
  {
    test: path => path.endsWith('.md'),
    load: async () => {
      const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-markdown@6.3.4/+esm');
      return (mod as { markdown: () => unknown }).markdown();
    },
  },
  {
    test: path => path.endsWith('.rs'),
    load: async () => {
      const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@codemirror/lang-rust@6.0.2/+esm');
      return (mod as { rust: () => unknown }).rust();
    },
  },
];

async function loadCodeMirror(): Promise<CodeMirrorModule> {
  const mod = await import(/* webpackIgnore: true */ CODEMIRROR_CDN);
  return mod as CodeMirrorModule;
}

async function loadLanguage(path: string): Promise<unknown[]> {
  const loader = LANGUAGE_LOADERS.find(item => item.test(path));
  if (!loader) return [];
  try {
    return [await loader.load()];
  } catch {
    return [];
  }
}

function CodeViewerComponent({
  files,
  selectedFile,
  onSelectFile,
  onFileSaved,
  onInlineDiff,
}: {
  files: ForgeFile[];
  selectedFile: string;
  onSelectFile: (path: string) => void;
  onFileSaved: (path: string, contents: string) => void;
  onInlineDiff: (proposal: ForgeDiffProposal) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<CodeMirrorView | null>(null);
  const readOnlyRef = useRef<CodeMirrorCompartment | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const cmRef = useRef<CodeMirrorModule | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineInstruction, setInlineInstruction] = useState('');
  const [inlineSelection, setInlineSelection] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineTop, setInlineTop] = useState(96);

  const file = useMemo(
    () => files.find(item => item.path === selectedFile) ?? files[0],
    [files, selectedFile],
  );

  const saveDraft = useCallback(async () => {
    if (!file || saving) return;
    setSaving(true);
    setSaveState('idle');
    try {
      const content = viewRef.current?.state.doc.toString() ?? draft;
      const response = await fetch('/api/forge/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: file.path, content }),
      });
      if (!response.ok) throw new Error('save failed');
      onFileSaved(file.path, content);
      setDraft(content);
      setEditing(false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      setSaving(false);
    }
  }, [draft, file, onFileSaved, saving]);

  useEffect(() => {
    saveRef.current = () => {
      void saveDraft();
    };
  }, [saveDraft]);

  useEffect(() => {
    setDraft(file?.contents ?? '');
    setEditing(false);
    setSaveState('idle');
  }, [file?.contents, file?.path]);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !file) return undefined;

    viewRef.current?.destroy();
    viewRef.current = null;
    host.innerHTML = '';
    setEditorReady(false);

    void (async () => {
      try {
        const cm = await loadCodeMirror();
        cmRef.current = cm;
        if (cancelled || !hostRef.current) return;

        const readOnly = new cm.Compartment();
        readOnlyRef.current = readOnly;
        const language = await loadLanguage(file.path);
        if (cancelled || !hostRef.current) return;

        const forgeTheme = cm.EditorView.theme({
          '&': {
            height: '100%',
            minHeight: '100%',
            backgroundColor: '#0d120d',
            color: 'rgba(255,255,255,0.76)',
            fontSize: '12px',
          },
          '.cm-scroller': { fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace' },
          '.cm-content': { caretColor: '#00FF9C', padding: '16px 0' },
          '.cm-cursor': { borderLeftColor: '#00FF9C' },
          '.cm-activeLine': { backgroundColor: 'rgba(0,255,156,0.06)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(0,255,156,0.07)', color: '#00FF9C' },
          '.cm-gutters': { backgroundColor: '#0d120d', color: 'rgba(255,255,255,0.28)', borderRightColor: 'rgba(255,255,255,0.07)' },
          '.cm-selectionBackground': { backgroundColor: 'rgba(0,212,255,0.22) !important' },
        }, { dark: true });

        const state = cm.EditorState.create({
          doc: file.contents,
          extensions: [
            cm.basicSetup,
            cm.lineNumbers(),
            cm.highlightActiveLine(),
            cm.EditorView.lineWrapping,
            forgeTheme,
            readOnly.of(true),
            cm.EditorView.updateListener.of(update => {
              if (update.docChanged) setDraft(update.state.doc.toString());
            }),
            cm.keymap.of([{
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                saveRef.current();
                return true;
              },
            }, {
              key: 'Mod-l',
              preventDefault: true,
              run: () => {
                const view = viewRef.current;
                if (!view) return true;
                const { from, to } = view.state.selection.main;
                if (from === to) return true;
                const selectedCode = view.state.doc.sliceString(from, to);
                setInlineSelection(selectedCode);
                setInlineInstruction('');
                setInlineError('');
                const coords = view.coordsAtPos?.(to);
                setInlineTop(Math.max(54, Math.min(360, (coords?.bottom ?? 96) - (hostRef.current?.getBoundingClientRect().top ?? 0) + 8)));
                setInlineOpen(true);
                return true;
              },
            }, {
              key: 'Escape',
              run: () => {
                setInlineOpen(false);
                return false;
              },
            }]),
            ...language,
          ],
        });

        viewRef.current = new cm.EditorView({ state, parent: hostRef.current });
        setEditorReady(true);
      } catch {
        setEditorReady(false);
      }
    })();

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const view = viewRef.current;
    const readOnly = readOnlyRef.current;
    const cm = cmRef.current;
    if (!view || !readOnly || !cm) return;
    view.dispatch({ effects: readOnly.reconfigure(cm.EditorState.readOnly.of(!editing)) });
  }, [editing]);

  const runInlineEdit = useCallback(async () => {
    if (!file || !inlineSelection.trim() || !inlineInstruction.trim()) return;
    setInlineLoading(true);
    setInlineError('');
    try {
      const fullFileContent = viewRef.current?.state.doc.toString() ?? draft;
      const response = await fetch('/api/forge/inline-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filePath: file.path,
          selectedCode: inlineSelection,
          instruction: inlineInstruction,
          fullFileContent,
        }),
      });
      const data = await response.json() as { proposedCode?: unknown; originalCode?: unknown; filePath?: unknown; error?: unknown };
      if (!response.ok || typeof data.proposedCode !== 'string' || typeof data.originalCode !== 'string' || typeof data.filePath !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : 'inline-edit failed');
      }
      const originalLines = data.originalCode.split('\n');
      const proposedLines = data.proposedCode.split('\n');
      const diff = [
        `--- ${data.filePath}`,
        `+++ ${data.filePath}`,
        '@@ selected code @@',
        ...originalLines.map(line => `-${line}`),
        ...proposedLines.map(line => `+${line}`),
      ].join('\n');
      onInlineDiff({
        action: 'edit',
        path: data.filePath,
        diff,
        originalCode: data.originalCode,
        proposedCode: data.proposedCode,
        createdAt: new Date().toISOString(),
      });
      setInlineOpen(false);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'inline-edit failed');
    } finally {
      setInlineLoading(false);
    }
  }, [draft, file, inlineInstruction, inlineSelection, onInlineDiff]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-44 shrink-0 border-r border-white/[0.07] p-2 md:block">
          <div className="space-y-1">
            {files.map(item => (
              <button
                key={item.path}
                type="button"
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-white/70">{file?.path}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/25">
                {file?.language} · {file?.status} · {editing ? 'editing' : 'read-only'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'hidden rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex',
                  saveState === 'saved' && 'border-[#14F195]/20 bg-[#14F195]/10 text-[#14F195]',
                  saveState === 'error' && 'border-red-400/20 bg-red-500/10 text-red-300',
                  saveState === 'idle' && 'border-white/[0.07] bg-white/[0.03] text-white/28',
                )}
              >
                {saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : editorReady ? 'CodeMirror 6' : 'Fallback'}
              </span>
              <button
                type="button"
                disabled={!file}
                onClick={() => setEditing(value => !value)}
                className={cn(
                  'flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                  editing ? 'border-[#00FF9C]/25 bg-[#00FF9C]/10 text-[#00FF9C]' : 'border-white/[0.08] bg-white/[0.03] text-white/48 hover:text-white/80',
                )}
              >
                {editing ? <Check className="size-3.5" /> : <Edit3 className="size-3.5" />}
                {editing ? 'Editing' : 'Edit'}
              </button>
              <button
                type="button"
                disabled={!file || saving}
                onClick={() => void saveDraft()}
                className="flex min-h-8 items-center gap-1.5 rounded-lg border border-[#14F195]/25 bg-[#14F195]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#14F195] transition-colors hover:bg-[#14F195]/15 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </button>
              <button
                type="button"
                disabled={!file}
                onClick={() => file && navigator.clipboard?.writeText(draft || file.contents).catch(() => {})}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-white/35 transition-colors hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Copy code"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="relative h-[min(440px,50vh)] overflow-hidden bg-[#0d120d]">
            {/* FORGE_UPGRADE: CodeMirror is loaded from CDN with a textarea fallback for offline/dev cases. */}
            <div ref={hostRef} className={cn('h-full', !editorReady && 'hidden')} />
            {inlineOpen ? (
              <div
                className="absolute left-4 z-[100] w-[min(600px,calc(100%-2rem))] rounded-lg border border-[#1f3a1f] bg-[#0d120d] p-3 shadow-2xl shadow-black/60"
                style={{ top: inlineTop }}
              >
                <div className="mb-2 max-h-28 overflow-auto rounded-md border border-white/[0.06] bg-white/[0.035] p-2 font-mono text-[11px] leading-5 text-white/42">
                  {inlineSelection}
                </div>
                <div className="flex items-center gap-2">
                  <WandSparkles className="size-4 shrink-0 text-[#00FF9C]" />
                  <input
                    value={inlineInstruction}
                    onChange={event => setInlineInstruction(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setInlineOpen(false);
                      if (event.key === 'Enter') void runInlineEdit();
                    }}
                    autoFocus
                    placeholder="O que fazer com esse trecho?"
                    className="min-h-9 flex-1 bg-transparent text-sm text-white/82 outline-none placeholder:text-white/24"
                  />
                  <button
                    type="button"
                    onClick={() => void runInlineEdit()}
                    disabled={inlineLoading || !inlineInstruction.trim()}
                    className="rounded-md border border-[#14F195]/25 bg-[#14F195]/10 px-3 py-2 text-[11px] font-semibold text-[#14F195] disabled:opacity-40"
                  >
                    {inlineLoading ? '...' : 'Aplicar'}
                  </button>
                  <button type="button" onClick={() => setInlineOpen(false)} className="rounded-md border border-white/[0.08] p-2 text-white/35">
                    <X className="size-3.5" />
                  </button>
                </div>
                {inlineError ? <p className="mt-2 text-[11px] text-red-300">[FORGE] inline-edit falhou: {inlineError}</p> : null}
              </div>
            ) : null}
            {!editorReady && (
              <textarea
                value={draft}
                readOnly={!editing}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault();
                    void saveDraft();
                  }
                }}
                className="h-full w-full resize-none bg-[#0d120d] p-4 font-mono text-[12px] leading-6 text-white/65 outline-none caret-[#00FF9C] selection:bg-cyan-400/20"
                spellCheck={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const CodeViewer = memo(CodeViewerComponent);
