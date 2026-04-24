// scorer.js — CognChain Memory Scorer
// Pontua importância da memória (0–10000 bps)

const TYPE_SCORES = {
  strategy:   4000,
  decision:   3500,
  knowledge:  3000,
  behavior:   3000,
  observation: 2000,
  security:   3500,
  analysis:   2500,
};

const THRESHOLD = 4000;

function scoreMemory(extracted) {
  if (!extracted || typeof extracted !== 'object') {
    return { score: 0, approved: false };
  }

  let score = TYPE_SCORES[extracted.type] || 2000;
  score += Math.min((extracted.keywords?.length || 0) * 400, 2000);
  score += (extracted.insight?.length || 0) > 50 ? 1500 : 500;
  score = Math.min(score, 10000);
  return { score, approved: score >= THRESHOLD };
}

const scoreImportance = scoreMemory;

module.exports = { scoreMemory, scoreImportance };