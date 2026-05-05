'use client';

interface StreamControlsProps {
  status: 'running' | 'paused' | 'completed' | 'aborted';
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
}

export default function StreamControls({ status, onPause, onResume, onAbort }: StreamControlsProps) {
  if (status === 'completed' || status === 'aborted') return null;
  return (
    <div className="flex items-center gap-2">
      {status === 'running' ? (
        <button onClick={onPause}
          className="px-3 py-1 rounded text-[11px] font-semibold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25 hover:bg-[#f59e0b]/25 transition-all">
          ⏸ Pausar
        </button>
      ) : (
        <button onClick={onResume}
          className="px-3 py-1 rounded text-[11px] font-semibold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/25 hover:bg-[#00d4aa]/25 transition-all">
          ▶ Continuar
        </button>
      )}
      <button onClick={onAbort}
        className="px-3 py-1 rounded text-[11px] font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/20 transition-all">
        🛑 Abortar
      </button>
    </div>
  );
}
