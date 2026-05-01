'use client';

import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, Shield, GitBranch, BarChart3, Loader2 } from 'lucide-react';

interface CognitiveProfile {
  totalMemories: number;
  verifiedMemories: number;
  avgScore: number;
  topTopics: { topic: string; count: number }[];
  modelDistribution: { model: string; count: number }[];
  memoryTimeline: { date: string; count: number }[];
  evolutionChains: number;
  cognitiveStyle: string;
  engagementScore: number;
}

const MODEL_COLORS: Record<string, string> = {
  gpt: '#14F195',
  claude: '#00D1FF',
  nvidia: '#9945FF',
  gemini: '#FF6B6B',
  default: '#ffffff',
};

function getEngagementColor(score: number): string {
  if (score >= 70) return '#14F195';
  if (score >= 40) return '#00D1FF';
  if (score >= 20) return '#9945FF';
  return '#ffffff';
}

function CircularIndicator({ value, size = 64, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = getEngagementColor(value);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <span className="absolute text-sm font-bold text-white/90">{value}</span>
    </div>
  );
}

export default function CognitiveProfileCard() {
  const [profile, setProfile] = useState<CognitiveProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/cognitive-profile');
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const top5Topics = profile.topTopics.slice(0, 5);
  const maxModelCount = Math.max(...profile.modelDistribution.map(m => m.count), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
      {/* Gradient header */}
      <div className="relative bg-gradient-to-r from-[#9945FF]/10 via-[#00D1FF]/5 to-[#14F195]/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-[#9945FF] to-[#00D1FF] p-2">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90">Perfil Cognitivo</h3>
              <p className="text-xs text-white/40">{profile.cognitiveStyle}</p>
            </div>
          </div>
          <CircularIndicator value={profile.engagementScore} size={56} strokeWidth={3} />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-white/30" />
              <span className="text-[10px] uppercase tracking-wider text-white/30">Memórias</span>
            </div>
            <span className="text-lg font-bold text-white/80">{profile.totalMemories}</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield className="h-3 w-3 text-white/30" />
              <span className="text-[10px] uppercase tracking-wider text-white/30">Verificadas</span>
            </div>
            <span className="text-lg font-bold text-[#14F195]">{profile.verifiedMemories}</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <GitBranch className="h-3 w-3 text-white/30" />
              <span className="text-[10px] uppercase tracking-wider text-white/30">Cadeias</span>
            </div>
            <span className="text-lg font-bold text-[#00D1FF]">{profile.evolutionChains}</span>
          </div>
        </div>

        {/* Avg score */}
        <div className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
          <span className="text-xs text-white/40">Score médio</span>
          <span className="text-sm font-semibold text-white/70">{profile.avgScore}</span>
        </div>

        {/* Top topics */}
        {top5Topics.length > 0 && (
          <div>
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-white/30">
              Tópicos Principais
            </span>
            <div className="flex flex-wrap gap-1.5">
              {top5Topics.map((t) => (
                <span
                  key={t.topic}
                  className="rounded-full border border-[#9945FF]/20 bg-[#9945FF]/10 px-2.5 py-1 text-[11px] font-medium text-[#9945FF]"
                >
                  {t.topic}
                  <span className="ml-1 text-[#9945FF]/50">({t.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Model distribution */}
        {profile.modelDistribution.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-white/30" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                Distribuição de Modelos
              </span>
            </div>
            <div className="space-y-1.5">
              {profile.modelDistribution.map((m) => (
                <div key={m.model} className="flex items-center gap-2">
                  <span className="w-16 text-[11px] text-white/40 capitalize">{m.model}</span>
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(m.count / maxModelCount) * 100}%`,
                        backgroundColor: MODEL_COLORS[m.model] || MODEL_COLORS.default,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[11px] text-white/40">{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
