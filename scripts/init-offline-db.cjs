/**
 * Init offline SQLite database (fallback para ambientes sem o Prisma schema-engine,
 * ex.: CI/sandbox). Cria as mesmas tabelas do prisma/schema.sqlite.prisma.
 *
 * Uso oficial (recomendado): npm run db:push:sqlite
 * Fallback: node scripts/init-offline-db.cjs
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'db', 'congchain-offline.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const TABLES = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Post" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "published" BOOLEAN NOT NULL DEFAULT 0,
  "authorId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Memory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hash" TEXT NOT NULL UNIQUE,
  "content" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "parentHash" TEXT,
  "score" REAL,
  "verified" BOOLEAN NOT NULL DEFAULT 0,
  "zkProof" TEXT,
  "zkPublicSignals" TEXT,
  "zkVerified" BOOLEAN NOT NULL DEFAULT 0,
  "zkMode" TEXT,
  "zkProofVersion" TEXT,
  "zkHashAlgo" TEXT,
  "zkGeneratedAt" INTEGER,
  "poiTxHash" TEXT,
  "clientId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Memory_clientId_idx" ON "Memory"("clientId");

CREATE TABLE IF NOT EXISTS "InsightVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "memoryHash" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "voterIp" TEXT NOT NULL DEFAULT 'anonymous',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgentTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "skill" TEXT NOT NULL DEFAULT 'general',
  "solReward" REAL NOT NULL DEFAULT 0.01,
  "status" TEXT NOT NULL DEFAULT 'open',
  "posterId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "result" TEXT,
  "txHash" TEXT,
  "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME
);

CREATE TABLE IF NOT EXISTS "Agent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "personality" TEXT NOT NULL DEFAULT 'friendly and helpful',
  "model" TEXT NOT NULL DEFAULT 'gpt',
  "tools" TEXT NOT NULL DEFAULT '[]',
  "template" TEXT,
  "systemPrompt" TEXT,
  "isDeployed" BOOLEAN NOT NULL DEFAULT 0,
  "deployTarget" TEXT,
  "deployConfig" TEXT,
  "memoryCount" INTEGER NOT NULL DEFAULT 0,
  "totalInteractions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keyHash" TEXT NOT NULL UNIQUE,
  "keyPrefix" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "requestsToday" INTEGER NOT NULL DEFAULT 0,
  "requestsTotal" INTEGER NOT NULL DEFAULT 0,
  "memoriesSaved" INTEGER NOT NULL DEFAULT 0,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" DATETIME,
  "rateResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

CREATE TABLE IF NOT EXISTS "ResponseCache" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "questionHash" TEXT NOT NULL UNIQUE,
  "fuzzyHash" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "tokensSaved" INTEGER NOT NULL DEFAULT 0,
  "seeded" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME
);
CREATE INDEX IF NOT EXISTS "ResponseCache_fuzzyHash_idx" ON "ResponseCache"("fuzzyHash");

CREATE TABLE IF NOT EXISTS "WalletAgentAlertReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerEmail" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "receiptStatus" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "eventAt" DATETIME NOT NULL,
  "storageMode" TEXT NOT NULL DEFAULT 'database',
  "storageReason" TEXT NOT NULL,
  "safetyNotes" TEXT NOT NULL,
  "metadataOnly" BOOLEAN NOT NULL DEFAULT 1,
  "canStoreSecrets" BOOLEAN NOT NULL DEFAULT 0,
  "canExecuteTransaction" BOOLEAN NOT NULL DEFAULT 0,
  "canSchedule" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("ownerEmail", "receiptId")
);
CREATE INDEX IF NOT EXISTS "WalletAgentAlertReceipt_ownerEmail_eventAt_idx" ON "WalletAgentAlertReceipt"("ownerEmail", "eventAt");
CREATE INDEX IF NOT EXISTS "WalletAgentAlertReceipt_ownerEmail_receiptStatus_idx" ON "WalletAgentAlertReceipt"("ownerEmail", "receiptStatus");
CREATE INDEX IF NOT EXISTS "WalletAgentAlertReceipt_deliveryId_idx" ON "WalletAgentAlertReceipt"("deliveryId");
CREATE INDEX IF NOT EXISTS "WalletAgentAlertReceipt_ruleId_idx" ON "WalletAgentAlertReceipt"("ruleId");

CREATE TABLE IF NOT EXISTS "SolanaIntent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "fromToken" TEXT NOT NULL,
  "toToken" TEXT,
  "amount" REAL NOT NULL,
  "amountUsd" REAL,
  "simulation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "txHash" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  "executedAt" DATETIME
);
CREATE INDEX IF NOT EXISTS "SolanaIntent_agentId_status_idx" ON "SolanaIntent"("agentId", "status");

CREATE TABLE IF NOT EXISTS "DecisionRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "condition" TEXT NOT NULL DEFAULT '{}',
  "action" TEXT NOT NULL DEFAULT 'notify',
  "params" TEXT NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "lastTriggered" INTEGER,
  "triggerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DecisionRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "result" TEXT NOT NULL DEFAULT 'pending',
  "evidence" TEXT,
  "output" TEXT,
  "txHash" TEXT,
  "timestamp" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(TABLES);
const count = db.prepare('SELECT COUNT(*) AS n FROM sqlite_master WHERE type = ?').get('table');
db.close();
console.error(`Offline DB pronta: ${dbPath} (${count.n} tabelas)`);
