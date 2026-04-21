// scorer.js — pontua importância da memória (0–10000 bps)

const TYPE_SCORES = {
  strategy: 4000,
  decision: 3500,
  knowledge: 3000,
};

const THRESHOLD = 4000;

function scoreMemory(extracted) {
  let score = TYPE_SCORES[extracted.type] || 2000;
  score += Math.min((extracted.keywords?.length || 0) * 400, 2000);
  score += (extracted.insight?.length || 0) > 50 ? 1500 : 500;
  score = Math.min(score, 9000);
  return { score, approved: score >= THRESHOLD };
}

// alias para compatibilidade
const scoreImportance = scoreMemory;

module.exports = { scoreMemory, scoreImportance };