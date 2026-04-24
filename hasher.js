// hasher.js — CognChain Hash Engine
// Gera hashes SHA-256 para armazenamento on-chain

const crypto = require('crypto');

function sha256(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('sha256 requires a non-empty string input');
  }
  return crypto.createHash('sha256').update(text, 'utf8').digest();
}

// Returns { contentHash: Buffer(32), summaryHash: Buffer(32) }
function hashMemory(memory) {
  if (!memory || typeof memory !== 'object') {
    throw new Error('hashMemory requires a memory object');
  }
  if (!memory.insight || typeof memory.insight !== 'string') {
    throw new Error('hashMemory requires memory.insight (non-empty string)');
  }
  if (!memory.summary || typeof memory.summary !== 'string') {
    throw new Error('hashMemory requires memory.summary (non-empty string)');
  }

  const contentHash = sha256(memory.insight);
  const summaryHash = sha256(memory.summary);
  return { contentHash, summaryHash };
}

module.exports = { hashMemory, sha256 };