// extractor.js — CognChain Memory Extractor
// Extrai memória de uma conversa (string ou array)

const TYPE_SIGNALS = {
  decision:    ['decide', 'decision', 'commit', 'agreed', 'finalize', 'confirm', 'choose', 'final'],
  strategy:    ['strategy', 'architecture', 'design', 'plan', 'approach', 'structure', 'blueprint'],
  knowledge:   ['learn', 'understand', 'found', 'discovered', 'realized', 'insight', 'conclusion'],
  behavior:    ['behavior', 'pattern', 'habit', 'routine', 'preference', 'tendency'],
  observation: ['observed', 'noticed', 'detected', 'identified', 'measured', 'recorded'],
  security:    ['blocked', 'unsafe', 'suspicious', 'flagged', 'denied', 'paused', 'limit'],
  analysis:    ['analyzed', 'compared', 'evaluated', 'assessed', 'scored', 'verified'],
};

const STOPWORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'will', 'would', 'could', 'should',
  'their', 'there', 'been', 'about', 'which', 'when', 'what', 'your', 'were',
  'they', 'them', 'than', 'into', 'each', 'make', 'like', 'just', 'over',
  'such', 'after', 'also', 'some', 'very', 'only', 'then', 'more', 'most',
  'other', 'does', 'done', 'being', 'before', 'between', 'where', 'those',
  'these', 'every', 'through', 'during', 'without', 'because', 'however',
]);

function extractMemory(conversation) {
  if (!conversation) {
    return { summary: '', insight: '', type: 'knowledge', keywords: [] };
  }

  const text = Array.isArray(conversation)
    ? conversation.map(m => (m.role || '') + ': ' + (m.content || '')).join('\n')
    : String(conversation);

  if (text.trim().length === 0) {
    return { summary: '', insight: '', type: 'knowledge', keywords: [] };
  }

  const lines = text.trim().split('\n').filter(l => l.trim());
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOPWORDS.has(w));

  // Keywords por frequência (sem stopwords)
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .filter(e => e[1] >= 1)
    .slice(0, 8)
    .map(e => e[0]);

  // Tipo (verifica todos, pega o último match — mais específico)
  let type = 'knowledge';
  for (const [t, signals] of Object.entries(TYPE_SIGNALS)) {
    const matchCount = signals.filter(s => text.toLowerCase().includes(s)).length;
    if (matchCount >= 1) {
      type = t;
    }
  }

  // Summary e insight
  const summary = lines.slice(0, 2).join(' ').substring(0, 120);
  const insight = lines[lines.length - 1]
    .replace(/^(Agent:|User:|AI:|assistant:|user:)\s*/i, '')
    .trim()
    .substring(0, 200);

  return { summary, insight, type, keywords };
}

module.exports = { extractMemory };