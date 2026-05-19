'use client';

import { useState, useEffect } from 'react';
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
  LogIn,
  LogOut,
  ShieldCheck,
  Zap,
  Hammer,
  Orbit,
} from 'lucide-react';

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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/verify').then(r => r.json()).then(d => setIsAdmin(d.admin)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAdmin(false);
    window.location.reload();
  };

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
          bg-[#07070f]/96 backdrop-blur-2xl
          border-r border-white/[0.055]
          shadow-[inset_-1px_0_0_rgba(255,255,255,0.025)]
          transition-all duration-300 ease-in-out
          ${isOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:w-0 md:-translate-x-full'}
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
                bg-gradient-to-r from-[#8B5CF6]/18 to-[#14F195]/10
                border border-[#8B5CF6]/24
                hover:from-[#8B5CF6]/25 hover:to-[#14F195]/16
                hover:border-[#5AD7FF]/25
                transition-all duration-200 group"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#5AD7FF] to-[#14F195] flex items-center justify-center shadow-sm shadow-[#8B5CF6]/20">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                Novo Chat
              </span>
            </button>
          </div>

          {/* Primary Navigation */}
          <nav className="px-3 pb-2 space-y-0.5">
            <a
              href="/pay"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#F59E0B]/25">
                <Zap className="w-3.5 h-3.5 text-white/55 group-hover:text-[#F59E0B]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                CONGCHAIN Pay
              </span>
            </a>

            <a
              href="/marketplace"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#14F195]/25">
                <Sparkles className="w-3.5 h-3.5 text-white/55 group-hover:text-[#14F195]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                Marketplace
              </span>
            </a>

            <a
              href="/brain"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#9945FF]/25">
                <Brain className="w-3.5 h-3.5 text-white/55 group-hover:text-[#9945FF]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                Memory Brain
              </span>
            </a>

            <a
              href="/mythos"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#76FF03]/25">
                <Orbit className="w-3.5 h-3.5 text-white/55 group-hover:text-[#76FF03]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                Mythos Bridge
              </span>
              <span className="ml-auto text-[8px] font-black text-[#76FF03]/60 bg-[#76FF03]/10 border border-[#76FF03]/15 px-1.5 py-0.5 rounded-full tracking-widest">1st</span>
            </a>

            <a
              href="/office"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#9945FF]/25">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-white/55 group-hover:text-[#9945FF]">
                  <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" fill="currentColor" fillOpacity="0.9"/>
                </svg>
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                Agent Office
              </span>
              <span className="ml-auto text-[8px] font-black text-[#14F195]/60 bg-[#14F195]/10 border border-[#14F195]/15 px-1.5 py-0.5 rounded-full tracking-widest">LIVE</span>
            </a>

            <a
              href="/forge"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#14F195]/25">
                <Hammer className="w-3.5 h-3.5 text-white/55 group-hover:text-[#14F195]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                CongChain Forge
              </span>
              <span className="ml-auto text-[8px] font-black text-[#9945FF]/60 bg-[#9945FF]/10 border border-[#9945FF]/15 px-1.5 py-0.5 rounded-full tracking-widest">MVP</span>
            </a>

            <a
              href="/dashboard/keys"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#9945FF]/25">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white/55 group-hover:text-[#9945FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                API Keys
              </span>
            </a>

            <a
              href="/agents"
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl
                bg-transparent border border-transparent
                hover:bg-white/[0.04] hover:border-white/[0.055]
                transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:border-[#00D1FF]/25">
                <Bot className="w-3.5 h-3.5 text-white/55 group-hover:text-[#00D1FF]" />
              </div>
              <span className="text-[13px] font-medium text-white/60 group-hover:text-white/88 transition-colors">
                Agent Builder
              </span>
            </a>
          </nav>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/24" />
              <input
                type="text"
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.022] border border-white/[0.055] rounded-2xl
                  pl-9 pr-3 py-2 text-sm text-white/75 placeholder-white/25
                  focus:outline-none focus:border-[#5AD7FF]/26 focus:bg-white/[0.04]
                  transition-all duration-200"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 min-h-[150px] overflow-y-auto px-2 pb-2 scrollbar-thin">
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
                  <span className="text-[10px] font-semibold text-white/24 uppercase tracking-[0.2em]">
                    {group.label === 'Hoje' ? 'Recent chats' : group.label}
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
                        ? 'bg-white/[0.075] border border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]'
                        : 'hover:bg-white/[0.035] border border-transparent'
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

          {/* Bottom section */}
          <div className="p-3 border-t border-white/[0.055]">
            {isAdmin ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#8B5CF6]/[0.08] border border-[#8B5CF6]/15">
                <ShieldCheck className="w-4 h-4 text-[#9945FF] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#9945FF]">Admin · Pro</p>
                  <p className="text-[10px] text-white/25">Modelos liberados</p>
                </div>
                <button onClick={handleLogout} title="Sair" className="p-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-red-400 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <a href="/login"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.022] border border-white/[0.055] hover:bg-white/[0.045] hover:border-[#8B5CF6]/22 transition-all group">
                <LogIn className="w-4 h-4 text-[#9945FF]/70" />
                <span className="text-xs font-medium text-white/55 group-hover:text-white/85 transition-colors">Login Admin</span>
                <span className="ml-auto text-[9px] text-white/25">Pro</span>
              </a>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
