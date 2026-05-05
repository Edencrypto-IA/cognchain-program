'use client';
import { useEffect, useRef, useState } from 'react';
import type { CognitiveStream } from './types';
import CognitiveStepCard from './CognitiveStepCard';
import StreamTimeline from './StreamTimeline';
import StreamControls from './StreamControls';
import StreamSummary from './StreamSummary';

interface CognitiveStreamPanelProps {
  agentId: string;
  query: string;
  onComplete?: (stream: CognitiveStream) => void;
}

function elapsed(startedAt: string) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function CognitiveStreamPanel({ agentId, query, onComplete }: CognitiveStreamPanelProps) {
  const [stream, setStream] = useState<CognitiveStream | null>(null);
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    const url = `/api/agents/${agentId}/cognitive-stream?query=${encodeURIComponent(query)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      const data: Partial<CognitiveStream> = JSON.parse(e.data);
      setStream(prev => {
        const next = prev ? { ...prev, ...data, steps: data.steps ?? prev.steps } : data as CognitiveStream;
        if (next.overallStatus === 'completed' || next.overallStatus === 'aborted') {
          es.close();
          onComplete?.(next);
        }
        return next;
      });
    };

    es.onerror = () => { es.close(); };
    const timer = setInterval(() => setTick(t => t + 1), 1000);

    return () => { es.close(); clearInterval(timer); };
  }, [agentId, query, onComplete]);

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [stream?.steps.length]);

  const abort = () => {
    abortedRef.current = true;
    esRef.current?.close();
    setStream(s => s ? { ...s, overallStatus: 'aborted' } : s);
  };

  const pause = () => setStream(s => s ? { ...s, overallStatus: 'paused' } : s);
  const resume = () => setStream(s => s ? { ...s, overallStatus: 'running' } : s);

  if (!stream) {
    return (
      <div className="rounded-2xl border border-[#1e293b] bg-[#111118] p-6 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-[#64748b]">Iniciando Cognitive Stream...</p>
      </div>
    );
  }

  const current = stream.steps.find(s => s.id === stream.currentStepId);

  return (
    <div className="rounded-2xl border border-[#1e293b] bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] bg-[#111118]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#e2e8f0]">🤖 {stream.agentName}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20">
            {stream.agentModel}
          </span>
          {stream.overallStatus === 'running' && (
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#64748b] font-mono">
            ⏱️ {elapsed(stream.startedAt)} · Passo {stream.currentStepId}/{stream.steps.length}
          </span>
          <StreamControls status={stream.overallStatus} onPause={pause} onResume={resume} onAbort={abort} />
        </div>
      </div>

      <div className="flex">
        {/* Timeline sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-[#1e293b] px-2 py-2 hidden md:block">
          <StreamTimeline steps={stream.steps} currentId={stream.currentStepId} />
        </div>

        {/* Steps */}
        <div ref={scrollRef} className="flex-1 p-4 max-h-[560px] overflow-y-auto">
          {stream.steps.filter(s => s.status !== 'pending').map(step => (
            <CognitiveStepCard
              key={step.id}
              step={step}
              isActive={step.id === stream.currentStepId && stream.overallStatus === 'running'}
            />
          ))}
          {stream.overallStatus === 'completed' && <StreamSummary stream={stream} />}
          {stream.overallStatus === 'aborted' && (
            <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/5 p-4 text-[13px] text-[#ef4444]">
              🛑 Stream abortado pelo usuário.
            </div>
          )}
        </div>
      </div>

      {/* Query bar */}
      <div className="px-4 py-2 border-t border-[#1e293b] bg-[#111118]/50">
        <p className="text-[11px] text-[#475569] truncate">📝 {stream.query}</p>
      </div>
    </div>
  );
}
