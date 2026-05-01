// ============================================================
// Cognitive Profile — Aggregate memory patterns for user insight
// ============================================================

import { db } from '@/lib/db';

export interface CognitiveProfile {
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

/**
 * Build a cognitive profile by aggregating all memories.
 * Uses existing memory data — no new collection.
 */
export async function buildCognitiveProfile(_sessionId?: string): Promise<CognitiveProfile> {
  // sessionId parameter kept for API compatibility — Memory model uses global scope
  const memories = await db.memory.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const total = memories.length;
  const verified = memories.filter(m => m.verified).length;
  const scored = memories.filter(m => m.score != null);
  const avgScore = scored.length > 0
    ? scored.reduce((sum, m) => sum + (m.score || 0), 0) / scored.length
    : 0;

  // Model distribution
  const modelMap = new Map<string, number>();
  for (const m of memories) {
    modelMap.set(m.model, (modelMap.get(m.model) || 0) + 1);
  }
  const modelDistribution = [...modelMap.entries()].map(([model, count]) => ({ model, count }));

  // Top topics — extract from content
  const topicMap = new Map<string, number>();
  const stopWords = new Set(['que', 'nao', 'com', 'uma', 'para', 'dos', 'das', 'nos', 'tem', 'seu', 'sua', 'mas', 'como', 'mais', 'ao', 'ele', 'ela', 'este', 'essa', 'todo', 'toda', 'cada', 'qual', 'quando', 'onde', 'porque', 'ainda', 'tambem', 'entre', 'sobre', 'this', 'that', 'with', 'from', 'they', 'have', 'are', 'was', 'the', 'and', 'for', 'not']);
  for (const m of memories) {
    const words = m.content.toLowerCase().replace(/[^\w\s\u00C0-\u024F]/g, ' ').split(/\s+/).filter(w => w.length >= 5 && !stopWords.has(w));
    const unique = new Set(words);
    for (const word of unique) {
      topicMap.set(word, (topicMap.get(word) || 0) + 1);
    }
  }
  const topTopics = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  // Timeline (last 7 days grouped by date)
  const timelineMap = new Map<string, number>();
  for (const m of memories) {
    const date = m.createdAt?.toISOString().split('T')[0] || 'unknown';
    timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
  }
  const memoryTimeline = [...timelineMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([date, count]) => ({ date, count }));

  // Evolution chains
  const evolutionChains = memories.filter(m => m.parentHash).length;

  // Cognitive style detection
  const cognitiveStyle = detectCognitiveStyle(memories, modelDistribution);

  // Engagement score (0-100)
  const engagementScore = Math.min(100, Math.round(
    (total * 2) +
    (verified * 10) +
    (avgScore * 5) +
    (evolutionChains * 8) +
    (modelDistribution.length * 5)
  ));

  return {
    totalMemories: total,
    verifiedMemories: verified,
    avgScore: Math.round(avgScore * 10) / 10,
    topTopics,
    modelDistribution,
    memoryTimeline,
    evolutionChains,
    cognitiveStyle,
    engagementScore,
  };
}

function detectCognitiveStyle(memories: any[], modelDist: { model: string; count: number }[]): string {
  if (memories.length === 0) return 'Novo explorador';

  const avgLength = memories.reduce((s, m) => s + m.content.length, 0) / memories.length;
  const hasEvolution = memories.some(m => m.parentHash);

  const topModel = modelDist.length > 0 ? modelDist[0].model : 'gpt';

  if (avgLength > 500 && hasEvolution) return 'Pesquisador profundo';
  if (avgLength > 300 && modelDist.length >= 3) return 'Explorador multilateral';
  if (avgLength > 300) return 'Pensador analitico';
  if (topModel === 'claude') return 'Estrategista metódico';
  if (topModel === 'gpt') return 'Inovador pratico';
  if (topModel === 'gemini') return 'Sintetizador criativo';
  if (topModel === 'nvidia') return 'Otimizador de performance';
  if (modelDist.length >= 3) return 'Versatil curioso';
  return 'Explorador ativo';
}
