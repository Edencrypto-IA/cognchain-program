'use client';
import { useState } from 'react';
import type { CognitiveStream } from './types';

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function StreamSummary({ stream }: { stream: CognitiveStream }) {
  const [copied, setCopied] = useState(false);
  const checkpoints = stream.steps.filter(s => s.checkpoint).length;
  const avgConf = stream.steps.filter(s => s.confidence != null).reduce((a, s) => a + (s.confidence ?? 0), 0)
    / Math.max(1, stream.steps.filter(s => s.confidence != null).length);
  const solscanUrl = stream.finalHash ? `https://solscan.io/tx/${stream.finalHash}?cluster=devnet` : null;

  return (
    <div className="mt-4 rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/5 p-4">
      <p className="text-[13px] font-bold text-[#00d4aa] mb-3">✅ Stream Concluído</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[
          ['⏱️ Tempo total', stream.totalDurationMs != null ? fmt(stream.totalDurationMs) : '—'],
          ['⛓️ Checkpoints', checkpoints],
          ['📊 Passos', stream.steps.length],
          ['🎯 Confiança', `${Math.round(avgConf)}%`],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-white/[0.03] rounded-lg p-2">
            <p className="text-[10px] text-[#64748b]">{label}</p>
            <p className="text-[14px] font-bold text-[#e2e8f0]">{val}</p>
          </div>
        ))}
      </div>
      {stream.finalHash && (
        <div className="flex items-center gap-2">
          <button onClick={() => { navigator.clipboard.writeText(stream.finalHash!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="font-mono text-[11px] text-[#00a8e8] hover:text-[#00d4aa] transition-colors">
            {stream.finalHash.slice(0, 12)}...{stream.finalHash.slice(-8)} {copied ? '✅' : '📋'}
          </button>
          {solscanUrl && (
            <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-[11px] text-[#00d4aa] hover:underline">Ver na Blockchain →</a>
          )}
        </div>
      )}
    </div>
  );
}
