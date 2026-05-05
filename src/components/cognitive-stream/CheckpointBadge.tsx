'use client';
import { useState } from 'react';
import type { CognitiveCheckpoint } from './types';

export default function CheckpointBadge({ checkpoint }: { checkpoint: CognitiveCheckpoint }) {
  const [copied, setCopied] = useState(false);
  const short = `${checkpoint.hash.slice(0, 8)}...${checkpoint.hash.slice(-8)}`;
  const solscanUrl = `https://solscan.io/tx/${checkpoint.hash}?cluster=devnet`;
  const copy = () => { navigator.clipboard.writeText(checkpoint.hash); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00d4aa]/8 border border-[#00d4aa]/20 text-[11px] mt-2">
      <span>⛓️</span>
      <button onClick={copy} className="font-mono text-[#00d4aa] hover:text-white transition-colors">
        {short} {copied ? '✅' : '📋'}
      </button>
      <span className="text-[#64748b]">Block {checkpoint.blockNumber.toLocaleString()}</span>
      <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
        className="ml-auto text-[#00a8e8] hover:text-[#00d4aa] transition-colors">↗</a>
    </div>
  );
}
