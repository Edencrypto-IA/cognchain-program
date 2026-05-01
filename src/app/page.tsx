'use client';

import { useState, useCallback, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/congchain/sidebar';
import ChatArea from '@/components/congchain/chat-area';
import { type OrbMode } from '@/components/congchain/orb';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  category?: string;
  memoryCount?: number;
}

const SESSIONS_KEY = 'congchain_sessions_list';

function loadStoredSessions(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  } catch { return []; }
}

function saveStoredSessions(sessions: Conversation[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 30)));
  } catch { /* ignore */ }
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [orbMode, setOrbMode] = useState<OrbMode>('idle');
  const [chatKey, setChatKey] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Load sessions from localStorage on mount
  useEffect(() => {
    setConversations(loadStoredSessions());
  }, []);

  // Called by ChatArea whenever a message exchange happens
  const handleSessionUpdate = useCallback((session: Conversation) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === session.id);
      const updated = idx >= 0
        ? [session, ...prev.filter((_, i) => i !== idx)]
        : [session, ...prev];
      saveStoredSessions(updated);
      return updated;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    try { localStorage.removeItem('congchain_session'); } catch { /* ignore */ }
    setChatKey(prev => prev + 1);
    setActiveConvId(null);
    setSidebarOpen(false);
    setOrbMode('idle');
  }, []);

  const handleSelectConv = useCallback((id: string) => {
    setActiveConvId(id);
    setSidebarOpen(false);
  }, []);

  const handleDeleteConv = useCallback((id: string) => {
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
        localStorage.removeItem(`congchain_msg_${id}`);
      } catch { /* ignore */ }
      return updated;
    });
    if (activeConvId === id) {
      setActiveConvId(null);
      setChatKey(prev => prev + 1);
    }
  }, [activeConvId]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#06060e]">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConv}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConv}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile menu button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-3 left-3 z-30 p-2 rounded-xl
              bg-white/[0.05] border border-white/[0.08]
              hover:bg-white/[0.08] transition-colors
              md:hidden backdrop-blur-xl"
          >
            <Menu className="w-5 h-5 text-white/70" />
          </button>
        )}

        <ChatArea key={`${chatKey}-${activeConvId ?? 'new'}`} orbMode={orbMode} setOrbMode={setOrbMode} onSessionUpdate={handleSessionUpdate} activeConvId={activeConvId} />
      </main>
    </div>
  );
}
