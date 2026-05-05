'use client';
import type { CognitiveAction } from './types';

const ICONS: Record<CognitiveAction['type'], string> = {
  api_call: '🌐', web_search: '🔍', calculation: '🧮',
  decision: '⚖️', render: '🎨', anchor: '⛓️',
};

export default function CognitiveActionItem({ action }: { action: CognitiveAction }) {
  const statusColor = action.status === 'success' ? 'text-[#00d4aa]'
    : action.status === 'failure' ? 'text-[#ef4444]'
    : 'text-[#f59e0b]';

  return (
    <div className="flex items-start gap-2 py-1 text-[12px]">
      <span className="flex-shrink-0 w-4 text-center">{ICONS[action.type]}</span>
      <span className="text-[#94a3b8] flex-1">
        {action.description}
        {action.source && (
          <span className="ml-1 text-[#475569]">({action.source})</span>
        )}
      </span>
      <span className={`flex-shrink-0 font-mono ${statusColor}`}>
        {action.status === 'pending' ? '⏳' : action.result ?? (action.status === 'success' ? '✅' : '❌')}
        {action.durationMs != null && action.status === 'success' && (
          <span className="text-[#475569] ml-1">{action.durationMs}ms</span>
        )}
      </span>
    </div>
  );
}
