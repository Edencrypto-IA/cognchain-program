const crypto = require('crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest();
}

// Returns { contentHash: Buffer(32), summaryHash: Buffer(32) }
function hashMemory(memory) {
  const contentHash = sha256(memory.insight);
  const summaryHash = sha256(memory.summary);
  return { contentHash, summaryHash };
}

module.exports = { hashMemory, sha256 };
