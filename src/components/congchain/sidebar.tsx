'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  ChevronLeft,
  MoreHorizontal,
  Bot,
  RefreshCw,
  Sparkles,
  Brain,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const WalletButton = dynamic(() => import('./wallet-button'), { ssr: false });

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  category?: string;
  memoryCount?: number;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

export default function Sidebar({ isOpen, onToggle, conversations, activeId, onSelect, onNewChat, onDelete, loading }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayConvs = filtered.filter(c =>
    c.timestamp === 'Agora' ||
    c.timestamp.includes(':') ||
    c.timestamp.includes('min') ||
    c.timestamp.includes('hour')
  );
  const yesterdayConvs = filtered.filter(c => c.timestamp.includes('Yesterday') || c.timestamp.includes('Ontem'));
  const olderConvs = filtered.filter(c =>
    !todayConvs.includes(c) &&
    !yesterdayConvs.includes(c)
  );

  const grouped = [
    ...(todayConvs.length ? [{ label: 'Hoje', items: todayConvs }] : []),
    ...(yesterdayConvs.length ? [{ label: 'Ontem', items: yesterdayConvs }] : []),
    ...(olderConvs.length ? [{ label: 'Mais antigos', items: olderConvs }] : []),
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed md:relative z-50 h-full flex flex-col
          bg-[#0a0a14]/95 backdrop-blur-xl
          border-r border-white/[0.06]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-[280px]'}
          overflow-hidden
        `}
      >
        <div className="flex flex-col h-full w-[280px] min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={onNewChat}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/60 hover:text-white"
                title="Novo Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-white/60 hover:text-white"
                title="Configuracoes"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="px-3 pb-2">
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/10
                border border-[#9945FF]/30
                hover:from-[#9945FF]/30 hover:to-[#14F195]/20
                hover:border-[#9945FF]/50
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Novo Chat
              </span>
            </button>
          </div>

          {/* Marketplace Link */}
          <div className="px-3 pb-1">
            <a
              href="/marketplace"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-white/[0.03] border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-[#14F195]/30
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#14F195]/10 border border-[#14F195]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#14F195]" />
              </div>
              <span className="text-sm font-medium text-white/60 group-hover:text-white/90 transition-colors">
                Marketplace
              </span>
            </a>
          </div>

          {/* API Keys Link */}
          <div className="px-3 pb-1">
            <a
              href="/dashboard/keys"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-white/[0.03] border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-[#9945FF]/30
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#9945FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <span className="text-sm font-medium text-white/60 group-hover:text-white/90 transition-colors">
                API Keys
              </span>
            </a>
          </div>

          {/* Memory Brain Link */}
          <div className="px-3 pb-1">
            <a
              href="/brain"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-white/[0.03] border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-[#9945FF]/30
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-[#9945FF]" />
              </div>
              <span className="text-sm font-medium text-white/60 group-hover:text-white/90 transition-colors">
                Memory Brain
              </span>
            </a>
          </div>

          {/* Agent Builder Link */}
          <div className="px-3 pb-3">
            <a
              href="/agents"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                bg-white/[0.03] border border-white/[0.06]
                hover:bg-white/[0.06] hover:border-[#00D1FF]/30
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#00D1FF]/10 border border-[#00D1FF]/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#00D1FF]" />
              </div>
              <span className="text-sm font-medium text-white/60 group-hover:text-white/90 transition-colors">
                Agent Builder
              </span>
            </a>
          </div>

          {/* Search */}
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg
                  pl-9 pr-3 py-2 text-sm text-white/80 placeholder-white/30
                  focus:outline-none focus:border-[#9945FF]/40 focus:bg-white/[0.06]
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 text-white/20 animate-spin mb-2" />
                <p className="text-xs text-white/30">Carregando sessoes...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-xs text-white/30">Nenhuma sessao ainda</p>
                <p className="text-[10px] text-white/20 mt-1">Comece uma conversa para ver aqui</p>
              </div>
            ) : (
            <>
            {grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <div className="px-2 py-1.5">
                  <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`
                      w-full flex items-start gap-3 px-3 py-2.5 rounded-xl mb-0.5
                      transition-all duration-150 text-left group cursor-pointer
                      ${activeId === conv.id
                        ? 'bg-white/[0.08] border border-white/[0.08]'
                        : 'hover:bg-white/[0.04] border border-transparent'
                      }
                    `}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <MessageSquare className={`w-4 h-4 ${activeId === conv.id ? 'text-[#9945FF]' : 'text-white/25'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${activeId === conv.id ? 'text-white font-medium' : 'text-white/70'}`}>
                          {conv.title}
                        </p>
                        {hoveredId === conv.id && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete?.(conv.id); }}
                              className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-red-400/60 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-white/30 truncate mt-0.5">{conv.lastMessage}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            </>
            )}
          </div>

          {/* Bottom section — Wallet connect */}
          <div className="p-3 border-t border-white/[0.06] space-y-2">
            <WalletButton />
          </div>
        </div>
      </aside>
    </>
  );
}
