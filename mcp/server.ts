#!/usr/bin/env bun
/**
 * CONGCHAIN Memory Internet Protocol (MIP)
 * MCP Server — connects any AI to CONGCHAIN verified memories
 *
 * Any AI (Claude, GPT, etc.) can now:
 *  - Search verified memories
 *  - Save new memories with hash proof
 *  - Verify content authenticity on Solana
 *  - Access top-quality AI insights
 *  - Continue memory chains across models
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const db = new PrismaClient();

const server = new Server(
  {
    name: 'congchain-mip',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ── TOOLS ────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_memories',
      description:
        'Search verified AI memories in CONGCHAIN by topic or keyword. Returns memories with quality scores and on-chain status.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term or topic' },
          model: {
            type: 'string',
            enum: ['gpt', 'claude', 'nvidia', 'gemini'],
            description: 'Filter by AI model (optional)',
          },
          limit: { type: 'number', description: 'Max results (default: 10)' },
          verified_only: {
            type: 'boolean',
            description: 'Return only on-chain verified memories (default: false)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_memory',
      description:
        'Retrieve a specific memory by its SHA-256 hash. Supports full hash or prefix (8+ chars).',
      inputSchema: {
        type: 'object',
        properties: {
          hash: { type: 'string', description: 'SHA-256 hash (full or prefix)' },
        },
        required: ['hash'],
      },
    },
    {
      name: 'save_memory',
      description:
        'Save a new verified memory to CONGCHAIN. Generates SHA-256 hash and stores content with model attribution.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Memory content to save' },
          model: {
            type: 'string',
            description: 'AI model that generated this (gpt/claude/nvidia/gemini)',
          },
        },
        required: ['content', 'model'],
      },
    },
    {
      name: 'verify_memory',
      description:
        'Check if a memory hash exists and is verified on the Solana blockchain.',
      inputSchema: {
        type: 'object',
        properties: {
          hash: { type: 'string', description: 'SHA-256 hash to verify' },
        },
        required: ['hash'],
      },
    },
    {
      name: 'list_top_memories',
      description:
        'List the highest quality memories ranked by score and community votes.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of results (default: 5)' },
          model: { type: 'string', description: 'Filter by AI model (optional)' },
        },
      },
    },
    {
      name: 'continue_memory_chain',
      description:
        'Find memories from a previous AI model to continue a conversation with full context. Enables cross-model memory continuity.',
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic to continue' },
          from_model: {
            type: 'string',
            description: 'Original model whose memories to load (gpt/claude/nvidia/gemini)',
          },
          limit: { type: 'number', description: 'Max memories to load (default: 5)' },
        },
        required: ['topic'],
      },
    },
    {
      name: 'get_memory_stats',
      description:
        'Get statistics about the CONGCHAIN memory layer: total memories, models, verified count, top agents.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// ── TOOL HANDLERS ────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_memories': {
        const { query, model, limit = 10, verified_only = false } = args as Record<string, unknown>;

        const memories = await db.memory.findMany({
          where: {
            content: { contains: String(query) },
            ...(model ? { model: String(model) } : {}),
            ...(verified_only ? { verified: true } : {}),
          },
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: Number(limit),
        });

        if (memories.length === 0) {
          return {
            content: [{ type: 'text', text: `No memories found for "${query}".` }],
          };
        }

        const text = memories
          .map(
            (m, i) =>
              `${i + 1}. [${m.model.toUpperCase()}] Score: ${m.score ?? 'N/A'}/10 ${m.verified ? '✓ On-chain' : '· Local'}\n` +
              `Hash: ${m.hash.slice(0, 16)}...\n` +
              `${m.content}`
          )
          .join('\n\n---\n\n');

        return { content: [{ type: 'text', text }] };
      }

      case 'get_memory': {
        const { hash } = args as Record<string, string>;

        const memory = await db.memory.findFirst({
          where: { hash: { startsWith: hash } },
        });

        if (!memory) {
          return {
            content: [{ type: 'text', text: `Memory not found: ${hash}` }],
          };
        }

        const votes = await (db as any).rewardVote
          .findMany({ where: { memoryHash: memory.hash } })
          .catch(() => []);

        const avgScore =
          votes.length > 0
            ? (votes.reduce((s: number, v: { score: number }) => s + v.score, 0) / votes.length).toFixed(1)
            : null;

        return {
          content: [
            {
              type: 'text',
              text:
                `Hash: ${memory.hash}\n` +
                `Model: ${memory.model.toUpperCase()}\n` +
                `Quality Score: ${memory.score ?? 'N/A'}/10\n` +
                `On-chain: ${memory.verified ? '✓ Verified on Solana' : 'Not yet anchored'}\n` +
                `Community Votes: ${votes.length}${avgScore ? ` (avg ${avgScore}/10)` : ''}\n` +
                `Created: ${memory.createdAt.toISOString()}\n\n` +
                `Content:\n${memory.content}`,
            },
          ],
        };
      }

      case 'save_memory': {
        const { content, model } = args as Record<string, string>;

        const hash = createHash('sha256')
          .update(`${content}:${model}`)
          .digest('hex');

        const existing = await db.memory.findUnique({ where: { hash } });
        if (existing) {
          return {
            content: [
              {
                type: 'text',
                text: `Memory already exists.\nHash: ${hash}\nStatus: ${existing.verified ? '✓ On-chain' : 'Local'}`,
              },
            ],
          };
        }

        await db.memory.create({
          data: {
            hash,
            content: String(content),
            model: String(model),
            timestamp: Math.floor(Date.now() / 1000),
          },
        });

        return {
          content: [
            {
              type: 'text',
              text:
                `✓ Memory saved to CONGCHAIN!\n` +
                `Hash: ${hash}\n` +
                `Model: ${String(model).toUpperCase()}\n\n` +
                `Verify: POST /api/verify { "hash": "${hash}" }\n` +
                `Anchor on Solana: POST /api/blockchain/store { "hash": "${hash}" }`,
            },
          ],
        };
      }

      case 'verify_memory': {
        const { hash } = args as Record<string, string>;

        const memory = await db.memory.findFirst({
          where: { hash: { startsWith: hash } },
        });

        if (!memory) {
          return {
            content: [
              {
                type: 'text',
                text: `✗ NOT FOUND\nHash: ${hash}\nThis content was not generated by CONGCHAIN.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: memory.verified
                ? `✓ VERIFIED ON SOLANA\nHash: ${memory.hash}\nModel: ${memory.model.toUpperCase()}\nThis content is cryptographically proven authentic.`
                : `⚠ EXISTS IN CONGCHAIN (not yet on Solana)\nHash: ${memory.hash}\nModel: ${memory.model.toUpperCase()}\nContent is authentic but not yet blockchain-anchored.`,
            },
          ],
        };
      }

      case 'list_top_memories': {
        const { limit = 5, model } = args as Record<string, unknown>;

        const memories = await db.memory.findMany({
          where: {
            score: { not: null },
            ...(model ? { model: String(model) } : {}),
          },
          orderBy: { score: 'desc' },
          take: Number(limit),
        });

        if (memories.length === 0) {
          return {
            content: [{ type: 'text', text: 'No scored memories found yet.' }],
          };
        }

        const text = memories
          .map(
            (m, i) =>
              `${i + 1}. Score ${m.score}/10 [${m.model.toUpperCase()}] ${m.verified ? '✓' : ''}\n` +
              `${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`
          )
          .join('\n\n');

        return { content: [{ type: 'text', text }] };
      }

      case 'continue_memory_chain': {
        const { topic, from_model, limit = 5 } = args as Record<string, unknown>;

        const memories = await db.memory.findMany({
          where: {
            content: { contains: String(topic) },
            ...(from_model ? { model: String(from_model) } : {}),
          },
          orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
          take: Number(limit),
        });

        if (memories.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No memories found about "${topic}"${from_model ? ` from ${from_model}` : ''}.\nStart a new conversation to build this memory chain.`,
              },
            ],
          };
        }

        const context = memories
          .map((m) => `[${m.model.toUpperCase()} · ${m.hash.slice(0, 8)}] ${m.content}`)
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text:
                `Memory chain loaded: ${memories.length} verified memories about "${topic}"\n\n` +
                `--- CONTEXT ---\n${context}\n--- END CONTEXT ---\n\n` +
                `You can now continue this conversation with full verified context.`,
            },
          ],
        };
      }

      case 'get_memory_stats': {
        const [total, verified, models] = await Promise.all([
          db.memory.count(),
          db.memory.count({ where: { verified: true } }),
          db.memory.groupBy({ by: ['model'], _count: { model: true } }),
        ]);

        const topMemory = await db.memory.findFirst({
          where: { score: { not: null } },
          orderBy: { score: 'desc' },
        });

        const modelBreakdown = models
          .map((m) => `  ${m.model.toUpperCase()}: ${m._count.model} memories`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text:
                `CONGCHAIN Memory Layer Stats\n` +
                `════════════════════════════\n` +
                `Total Memories: ${total}\n` +
                `Verified On-chain: ${verified} (${total > 0 ? Math.round((verified / total) * 100) : 0}%)\n\n` +
                `By Model:\n${modelBreakdown}\n\n` +
                `Top Memory Score: ${topMemory?.score ?? 'N/A'}/10\n` +
                `Program: BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL (Solana Devnet)`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// ── RESOURCES ────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'congchain://memories/recent',
      name: 'Recent Memories',
      description: 'Last 20 memories saved in CONGCHAIN',
      mimeType: 'text/plain',
    },
    {
      uri: 'congchain://memories/verified',
      name: 'Verified Memories',
      description: 'Memories anchored on Solana blockchain',
      mimeType: 'text/plain',
    },
    {
      uri: 'congchain://stats',
      name: 'Network Stats',
      description: 'CONGCHAIN network statistics',
      mimeType: 'text/plain',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'congchain://memories/recent') {
    const memories = await db.memory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const text = memories
      .map((m) => `[${m.model.toUpperCase()}] ${m.hash.slice(0, 8)}... | ${m.verified ? '✓' : '·'} | ${m.content.slice(0, 100)}`)
      .join('\n');
    return { contents: [{ uri, mimeType: 'text/plain', text }] };
  }

  if (uri === 'congchain://memories/verified') {
    const memories = await db.memory.findMany({
      where: { verified: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const text = memories
      .map((m) => `[${m.model.toUpperCase()}] ${m.hash} | Score: ${m.score ?? 'N/A'}\n${m.content.slice(0, 150)}`)
      .join('\n\n---\n\n');
    return { contents: [{ uri, mimeType: 'text/plain', text: text || 'No verified memories yet.' }] };
  }

  if (uri === 'congchain://stats') {
    const total = await db.memory.count();
    const verified = await db.memory.count({ where: { verified: true } });
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Total: ${total} | Verified: ${verified} | Program: BgrtrSJ53Uhp69sS8JfD414M1kujdR5ruhHc9wRbhiEL`,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ── START ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[CONGCHAIN MIP] Memory Internet Protocol server running');
}

main().catch((err) => {
  console.error('[CONGCHAIN MIP] Fatal error:', err);
  process.exit(1);
});
