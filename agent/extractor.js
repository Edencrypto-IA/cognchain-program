// extractor.js — extrai memória de uma conversa (string ou array)

const TYPE_SIGNALS = {
  decision: ['decide','decision','commit','agreed','finalize','confirm','choose','final'],
  strategy: ['strategy','architecture','design','plan','approach','structure'],
  knowledge: ['learn','understand','found','discovered','realized','insight'],
};

function extractMemory(conversation) {
  // Aceita string ou array
  const text = Array.isArray(conversation)
    ? conversation.map(m => (m.role || '') + ': ' + (m.content || '')).join('\n')
    : String(conversation);

  const lines = text.trim().split('\n').filter(l => l.trim());
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);

  // Keywords por frequência
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(e => e[0]);

  // Tipo
  let type = 'knowledge';
  for (const [t, signals] of Object.entries(TYPE_SIGNALS)) {
    if (signals.some(s => text.toLowerCase().includes(s))) {
      type = t;
      break;
    }
  }

  // Summary e insight
  const summary = lines.slice(0, 2).join(' ').substring(0, 120);
  const insight = lines[lines.length - 1]
    .replace(/^(Agent:|User:|AI:|assistant:|user:)/i, '')
    .trim()
    .substring(0, 200);

  return { summary, insight, type, keywords };
}

module.exports = { extractMemory };