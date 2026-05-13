'use client';

import { Files, GitCompareArrows, MonitorPlay, PanelsTopLeft } from 'lucide-react';
import type { ForgeBuildStep, ForgeFile, ForgeMemoryNode, ForgePanelTab, ForgePhase } from '@/lib/forge/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlassPanel } from './glass-panel';
import { ForgePreview } from './forge-preview';
import { CodeViewer } from './code-viewer';
import { cn } from '@/lib/utils';

export function ForgeRightPanel({
  phase,
  files,
  selectedFile,
  tab,
  onTabChange,
  onSelectFile,
  onRunPrompt,
}: {
  phase: ForgePhase;
  files: ForgeFile[];
  selectedFile: string;
  buildSteps?: ForgeBuildStep[];
  memoryNodes?: ForgeMemoryNode[];
  deployStatus?: string;
  tab: ForgePanelTab;
  onTabChange: (tab: ForgePanelTab) => void;
  onSelectFile: (path: string) => void;
  onRunPrompt?: (prompt: string) => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#111113]/40">
      <GlassPanel className="min-h-0 flex-1 rounded-none border-0 bg-transparent p-0 shadow-none">
        <Tabs value={tab} onValueChange={value => onTabChange(value as ForgePanelTab)} className="h-full gap-0">
          <div className="flex h-10 items-center justify-between border-b border-white/[0.07] px-3">
            <TabsList className="h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
              {[
                ['preview', MonitorPlay],
                ['code', PanelsTopLeft],
                ['files', Files],
                ['diff', GitCompareArrows],
              ].map(([value, Icon]) => (
                <TabsTrigger
                  key={value as string}
                  value={value as string}
                  className="h-6 rounded-md px-2 text-[11px] text-white/38 data-[state=active]:bg-white/[0.08] data-[state=active]:text-white/78"
                >
                  <Icon className="size-3" />
                  <span className="hidden sm:inline">{value as string}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="preview" className="min-h-0">
            <ForgePreview phase={phase} onRunPrompt={onRunPrompt} />
          </TabsContent>
          <TabsContent value="code" className="min-h-0">
            <CodeViewer files={files} selectedFile={selectedFile} onSelectFile={onSelectFile} />
          </TabsContent>
          <TabsContent value="files" className="min-h-0 p-3">
            <div className="space-y-2">
              {files.map(file => (
                <button
                  key={file.path}
                  onClick={() => onSelectFile(file.path)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]',
                    file.path === selectedFile && 'border-[#9945FF]/25 bg-[#9945FF]/10',
                  )}
                >
                  <span className="min-w-0 truncate font-mono text-xs text-white/65">{file.path}</span>
                  <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] text-white/35">{file.status}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="diff" className="min-h-0 p-3">
            <pre className="h-[430px] overflow-auto rounded-2xl border border-white/[0.07] bg-black/25 p-4 text-[12px] leading-6 text-white/55">
{`+ create features/generated/agent-console.tsx
+ Agent collaboration feed
+ Verified memory handoff props
+ Safe UI-only execution boundary

~ update generated preview shell
+ Add Solana proof capsule status
+ Add cinematic glass surface

No production files are changed by the Forge MVP simulation.`}
            </pre>
          </TabsContent>
        </Tabs>
      </GlassPanel>
    </aside>
  );
}
