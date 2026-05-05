'use client';
import { useState } from 'react';

interface OnChainProofProps {
  hash: string;
  blockNumber: number;
  programId?: string;
}

export default function OnChainProof({ hash, blockNumber, programId = 'BgrtrSJ53...RbhiEL' }: OnChainProofProps) {
  const [copied, setCopied] = useState(false);
  const hasProof = hash && hash.length > 10;
  const short = hasProof ? `${hash.slice(0,8)}...${hash.slice(-6)}` : null;
  const solscanUrl = hasProof && hash.length > 40
    ? `https://solscan.io/tx/${hash}?cluster=devnet`
    : null;

  const copy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!hasProof) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>⏳</span>
        <span>Aguardando confirmação on-chain</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748b]">
      <button onClick={copy} title="Copiar hash" className="flex items-center gap-1 hover:text-[#00d4aa] transition-colors">
        <span>🔗</span>
        <code className="font-mono text-[#00a8e8]">{short}</code>
        <span>{copied ? '✅' : '📋'}</span>
      </button>
      {blockNumber > 0 && (
        <span>⛓️ Block <span className="text-[#e2e8f0]">{blockNumber.toLocaleString()}</span></span>
      )}
      <span>🛡️ <code className="font-mono text-[#64748b]/60">{programId}</code></span>
      {solscanUrl && (
        <a href={solscanUrl} target="_blank" rel="noopener noreferrer"
          className="text-[#00d4aa] hover:underline">
          Ver no Solscan →
        </a>
      )}
    </div>
  );
}
