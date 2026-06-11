'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Edit3, FileCode2, Loader2, Save } from 'lucide-react';
import type { ForgeFile } from '@/lib/forge/types';
import { cn } from '@/lib/utils';

type CodeMirrorView = {
  state: { doc: { toString: () => string } };
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
}: {
  files: ForgeFile[];
  selectedFile: string;
  onSelectFile: (path: string) => void;
  onFileSaved: (path: string, contents: string) => void;
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
          <div className="h-[min(440px,50vh)] overflow-hidden bg-[#0d120d]">
            {/* FORGE_UPGRADE: CodeMirror is loaded from CDN with a textarea fallback for offline/dev cases. */}
            <div ref={hostRef} className={cn('h-full', !editorReady && 'hidden')} />
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
