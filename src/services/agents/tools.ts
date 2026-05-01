/**
 * Tool System — Operational capabilities for autonomous agents
 * 
 * Each tool represents a real action an agent can take.
 * Tools are the "hands" of the decision engine.
 */

export interface ToolContext {
  agentId: string;
  memories: { content: string; hash: string; score: number | null; timestamp: number }[];
  evidence?: string;
  ruleName?: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  memoryToSave?: string;
}

// Tool registry
const toolRegistry: Record<string, {
  name: string;
  description: string;
  category: 'analysis' | 'action' | 'communication' | 'blockchain' | 'memory';
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
}> = {};

/**
 * Register a tool.
 */
function registerTool(key: string, tool: typeof toolRegistry[string]) {
  toolRegistry[key] = tool;
}

// ============================================================
// Built-in Tools
// ============================================================

registerTool('notify', {
  name: 'Notify',
  description: 'Send a notification (logged decision)',
  category: 'communication',
  async execute(params, context) {
    const message = params.message || `Decision "${context.ruleName}" triggered`;
    return {
      success: true,
      output: `Notification: ${message}`,
      memoryToSave: `Notification sent: ${message}`,
    };
  },
});

registerTool('analyze', {
  name: 'Analyze',
  description: 'Analyze recent memories and produce a summary',
  category: 'analysis',
  async execute(params, context) {
    const topMemories = context.memories.slice(0, 5);
    const summary = topMemories
      .map((m, i) => `${i + 1}. [${m.hash.substring(0, 8)}] Score: ${m.score || 'N/A'} — ${m.content.substring(0, 100)}`)
      .join('\n');

    return {
      success: true,
      output: `Analysis of ${topMemories.length} memories:\n${summary}`,
      memoryToSave: `Analysis triggered by rule "${context.ruleName}": Reviewed ${topMemories.length} memories, top scores: ${topMemories.filter(m => m.score && m.score >= 7).length} high-quality entries found.`,
    };
  },
});

registerTool('save_preference', {
  name: 'Save Preference',
  description: 'Extract and save a user preference from memory',
  category: 'memory',
  async execute(params, context) {
    const preference = params.preference || 'auto-detected';
    const evidence = context.evidence || 'no-evidence';
    return {
      success: true,
      output: `Preference "${preference}" saved with evidence ${evidence.substring(0, 8)}`,
      memoryToSave: `User preference detected: ${preference}. Source: memory ${evidence.substring(0, 8)}. This preference will guide future decisions.`,
    };
  },
});

registerTool('webhook_trigger', {
  name: 'Webhook Trigger',
  description: 'Trigger an external webhook (e.g., Telegram, custom endpoint)',
  category: 'communication',
  async execute(params, context) {
    const url = params.url;
    if (!url) {
      return { success: false, output: 'No webhook URL provided' };
    }

    try {
      const payload = {
        agentId: context.agentId,
        ruleName: context.ruleName,
        evidence: context.evidence,
        timestamp: Date.now() / 1000,
        message: params.message || 'Autonomous decision triggered',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return {
        success: res.ok,
        output: `Webhook ${res.ok ? 'sent' : 'failed'} to ${url}`,
        memoryToSave: res.ok ? `Webhook triggered to ${url} from rule "${context.ruleName}"` : undefined,
      };
    } catch (error) {
      return { success: false, output: `Webhook error: ${String(error)}` };
    }
  },
});

registerTool('blockchain_anchor', {
  name: 'Blockchain Anchor',
  description: 'Anchor a decision proof on Solana blockchain',
  category: 'blockchain',
  async execute(params, context) {
    try {
      const { storeOnSolana } = await import('../blockchain/blockchain.service');
      const content = params.content || `Decision: ${context.ruleName} — triggered at ${new Date().toISOString()}`;
      const { generateHash } = await import('../memory/hash.utils');
      const hash = generateHash(content, 'decision');

      const result = await storeOnSolana(hash);
      return {
        success: result.success,
        output: result.success
          ? `Decision anchored on Solana. TX: ${result.txHash?.substring(0, 12)}...`
          : `Anchor failed: ${result.message}`,
        memoryToSave: result.success
          ? `Decision "${context.ruleName}" anchored on Solana. TX: ${result.txHash}`
          : undefined,
      };
    } catch (error) {
      return { success: false, output: `Blockchain anchor error: ${String(error)}` };
    }
  },
});

registerTool('memory_query', {
  name: 'Memory Query',
  description: 'Query specific memories by keyword or score',
  category: 'memory',
  async execute(params, context) {
    const keyword = params.keyword || '';
    const minScore = Number(params.minScore) || 0;

    const matches = context.memories.filter(m => {
      const hasKeyword = !keyword || m.content.toLowerCase().includes(keyword.toLowerCase());
      const hasScore = !minScore || (m.score || 0) >= minScore;
      return hasKeyword && hasScore;
    });

    const output = matches.length > 0
      ? `Found ${matches.length} matching memories:\n${matches.map(m => `- [${m.hash.substring(0, 8)}] ${m.content.substring(0, 80)}`).join('\n')}`
      : 'No matching memories found.';

    return {
      success: true,
      output,
      memoryToSave: `Memory query "${keyword}" (min score: ${minScore}): ${matches.length} results.`,
    };
  },
});

// ============================================================
// #2 NEW: AI Decision Tool — Intelligent autonomous decisions
// Uses AI model to analyze memories and produce actionable insights
// This is what transforms rules from "static IF" to "intelligent IF"
// ============================================================
registerTool('ai_decision', {
  name: 'AI Decision',
  description: 'Use AI to analyze memories and make an intelligent decision with actionable output',
  category: 'analysis',
  async execute(params, context) {
    try {
      const { callModel } = await import('../ai/ai.router');
      const topMemories = context.memories.slice(0, 5);
      const question = params.question || `Based on the recent memories, what action should be taken?`;
      const agentGoal = params.goal || '';

      // Build a focused analysis prompt for the AI
      const analysisPrompt = `Voce e um motor de decisao autonoma do CONGCHAIN. Analise as memorias abaixo e decida qual acao tomar.

${agentGoal ? `OBJETIVO DO AGENTE: ${agentGoal}\n` : ''}
PERGUNTA: ${question}

MEMORIAS RECENTES:
${topMemories.map((m, i) => `${i + 1}. [Score: ${m.score || 'N/A'}] ${m.content.substring(0, 200)}`).join('\n')}

Responda em formato estruturado:
1. ANALISE: Resumo breve da situacao (1-2 frases)
2. DECISAO: A acao recomendada (1 frase clara)
3. CONFIANCA: Alta/Media/Baixa
4. ACAO: O que executar agora (comando especifico)

Seja direto e pragmatico. Responda em portugues.`;

      const result = await callModel({
        model: params.model || 'gemini',
        messages: [{ role: 'user', content: analysisPrompt }],
        systemPrompt: 'Voce e um motor de decisao do CONGCHAIN. Analise memorias e produza decisoes acionaveis. Seja direto e estruturado.',
        useContext: false,
      });

      return {
        success: true,
        output: `AI Decision Analysis:\n${result.content}`,
        memoryToSave: `[Autonomous AI Decision] ${result.content.substring(0, 300)}`,
      };
    } catch (error) {
      return { success: false, output: `AI Decision error: ${String(error).substring(0, 200)}` };
    }
  },
});

// ============================================================
// NEW: Condition type for AI-based decisions
// ============================================================
export function getConditionTypes(): { type: string; label: string; description: string; placeholder: string }[] {
  return [
    { type: 'memory_contains', label: 'Memory Contains', description: 'Trigger when a memory contains a keyword', placeholder: 'Ex: Arweave, Solana, comprar...' },
    { type: 'memory_score_above', label: 'Score Above', description: 'Trigger when a memory has score above threshold', placeholder: 'Ex: 7, 8, 9...' },
    { type: 'memory_newer_than', label: 'Newer Than', description: 'Trigger when memory is newer than X hours', placeholder: 'Ex: 24 (hours)...' },
    { type: 'model_equals', label: 'Model Equals', description: 'Trigger when memory was generated by a specific model', placeholder: 'Ex: gpt, claude, gemini, nvidia...' },
  ];
}

/**
 * Execute a tool by name.
 */
export async function executeTool(toolName: string, params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
  const tool = toolRegistry[toolName];
  if (!tool) {
    return {
      success: false,
      output: `Unknown tool: ${toolName}. Available: ${Object.keys(toolRegistry).join(', ')}`,
    };
  }

  try {
    return await tool.execute(params, context);
  } catch (error) {
    console.error(`[Tool] ${toolName} execution error:`, error);
    return {
      success: false,
      output: `Tool "${toolName}" error: ${String(error).substring(0, 200)}`,
    };
  }
}

/**
 * Get all registered tools.
 */
export function getRegisteredTools(): { key: string; name: string; description: string; category: string }[] {
  return Object.entries(toolRegistry).map(([key, tool]) => ({
    key,
    name: tool.name,
    description: tool.description,
    category: tool.category,
  }));
}
