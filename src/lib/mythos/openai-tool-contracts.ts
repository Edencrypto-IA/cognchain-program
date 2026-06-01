import { z } from 'zod';

export const MYTHOS_SENSITIVE_FIELDS = [
  'privateKey',
  'secretKey',
  'seedPhrase',
  'mnemonic',
  'signedTransaction',
  'signedPayload',
  'apiKey',
] as const;

export const MythosIntentSchema = z.enum([
  'wallet_analysis',
  'token_analysis',
  'transaction_analysis',
  'file_analysis',
  'market_research',
  'memecoin_creation',
  'transaction_simulation',
  'memory_store',
  'memory_retrieve',
  'general_assistance',
  'unsupported_high_risk',
]);

export type MythosOpenAIIntent = z.infer<typeof MythosIntentSchema>;

export const MythosPermissionClassSchema = z.enum([
  'read',
  'analyze',
  'memory',
  'simulation',
  'transaction_prepare',
  'transaction_signature_request',
  'transaction_submit',
]);

export type MythosToolPermission = z.infer<typeof MythosPermissionClassSchema>;

export const MythosEvidenceSourceSchema = z.object({
  type: z.enum(['rpc', 'indexer', 'user_upload', 'market_api', 'simulation', 'memory', 'manual_input']),
  source: z.string().min(1),
  timestamp: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export type MythosEvidenceSource = z.infer<typeof MythosEvidenceSourceSchema>;

export const MythosFinancialFactSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  source: MythosEvidenceSourceSchema,
});

export type MythosFinancialFact = z.infer<typeof MythosFinancialFactSchema>;

export const MythosFinancialEstimateSchema = z.object({
  label: z.string().min(1),
  estimatedValue: z.union([z.string(), z.number()]),
  confidence: z.number().min(0).max(1),
  methodology: z.string().optional(),
});

export type MythosFinancialEstimate = z.infer<typeof MythosFinancialEstimateSchema>;

export const MythosSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  requiresUserApproval: z.boolean(),
});

export type MythosSuggestion = z.infer<typeof MythosSuggestionSchema>;

export const MythosRiskReportSchema = z.object({
  overallRisk: z.enum(['low', 'medium', 'high', 'critical', 'unknown']),
  summary: z.string().min(1),
  facts: z.array(MythosFinancialFactSchema),
  estimates: z.array(MythosFinancialEstimateSchema),
  warnings: z.array(z.string()),
  suggestions: z.array(MythosSuggestionSchema),
  generatedAt: z.string().min(1),
});

export type MythosRiskReport = z.infer<typeof MythosRiskReportSchema>;

export const MythosTransactionBoundarySchema = z.object({
  canSign: z.literal(false),
  canMoveFunds: z.boolean(),
  canSubmit: z.boolean(),
  requiresUserApproval: z.boolean(),
});

export type MythosTransactionBoundary = z.infer<typeof MythosTransactionBoundarySchema>;

export const MythosFileAnalysisResultSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  fileType: z.string().min(1),
  extractedText: z.string().optional(),
  summary: z.string().optional(),
  detectedEntities: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sources: z.array(MythosEvidenceSourceSchema).optional(),
});

export type MythosFileAnalysisResult = z.infer<typeof MythosFileAnalysisResultSchema>;

export const MYTHOS_TOOL_ALLOWLIST = [
  'get_wallet_balances',
  'get_token_price',
  'analyze_transaction',
  'scan_token_risk',
  'read_uploaded_file',
  'generate_memecoin_metadata',
  'build_unsigned_pumpfun_create_tx',
  'simulate_transaction',
  'prepare_wallet_signature_request',
  'submit_signed_transaction',
  'store_memory',
  'retrieve_memory',
] as const;

export type MythosAllowedTool = (typeof MYTHOS_TOOL_ALLOWLIST)[number];

export const MythosToolDefinitionSchema = z.object({
  name: z.enum(MYTHOS_TOOL_ALLOWLIST),
  description: z.string().min(1),
  permissionClass: MythosPermissionClassSchema,
  requiresWallet: z.boolean(),
  requiresUserApproval: z.boolean(),
  canMoveFunds: z.boolean(),
  canSign: z.literal(false),
  canSubmit: z.boolean(),
  allowedInAutopilot: z.boolean(),
});

export type MythosToolDefinition = z.infer<typeof MythosToolDefinitionSchema>;

export const MythosToolCallSchema = z.object({
  tool: z.enum(MYTHOS_TOOL_ALLOWLIST),
  input: z.unknown(),
  requestId: z.string().min(1),
  createdAt: z.string().min(1),
});

export type MythosToolCall<TInput = unknown> = Omit<z.infer<typeof MythosToolCallSchema>, 'input'> & {
  input: TInput;
};

export const MythosToolResultSchema = z.object({
  success: z.boolean(),
  tool: z.enum(MYTHOS_TOOL_ALLOWLIST),
  output: z.unknown().optional(),
  error: z.string().optional(),
  sources: z.array(MythosEvidenceSourceSchema).optional(),
});

export type MythosToolResult<TOutput = unknown> = Omit<z.infer<typeof MythosToolResultSchema>, 'output'> & {
  output?: TOutput;
};

export const MythosUserIntentSchema = z.object({
  intent: MythosIntentSchema,
  userMessage: z.string().min(1),
  walletConnected: z.boolean().default(false),
  requiresFreshData: z.boolean().default(false),
});

export type MythosUserIntent = z.infer<typeof MythosUserIntentSchema>;

export const MythosToolPlanSchema = z.object({
  intent: MythosIntentSchema,
  tools: z.array(z.object({
    tool: z.enum(MYTHOS_TOOL_ALLOWLIST),
    reason: z.string().min(1),
  })),
  safetyNotes: z.array(z.string()).default([]),
});

export type MythosToolPlan = z.infer<typeof MythosToolPlanSchema>;

export const MythosTransactionPreviewSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedNetworkFee: z.string().min(1),
  estimatedChanges: z.array(z.object({
    asset: z.string().min(1),
    delta: z.string().min(1),
  })),
  sources: z.array(MythosEvidenceSourceSchema).default([]),
  requiresUserApproval: z.literal(true),
  canSign: z.literal(false),
  canSubmit: z.boolean(),
  canMoveFunds: z.boolean(),
});

export type MythosTransactionPreview = z.infer<typeof MythosTransactionPreviewSchema>;

export const MYTHOS_TOOL_DEFINITIONS: Record<MythosAllowedTool, MythosToolDefinition> = {
  get_wallet_balances: {
    name: 'get_wallet_balances',
    description: 'Read public wallet balances and SPL token positions.',
    permissionClass: 'read',
    requiresWallet: true,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  get_token_price: {
    name: 'get_token_price',
    description: 'Read market pricing data from configured providers.',
    permissionClass: 'read',
    requiresWallet: false,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  analyze_transaction: {
    name: 'analyze_transaction',
    description: 'Analyze a public transaction signature and explain risk.',
    permissionClass: 'analyze',
    requiresWallet: false,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  scan_token_risk: {
    name: 'scan_token_risk',
    description: 'Analyze token mint, authorities, holders, liquidity, and metadata risk.',
    permissionClass: 'analyze',
    requiresWallet: false,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  read_uploaded_file: {
    name: 'read_uploaded_file',
    description: 'Analyze a user-provided image, PDF, text file, or document.',
    permissionClass: 'analyze',
    requiresWallet: false,
    requiresUserApproval: true,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  generate_memecoin_metadata: {
    name: 'generate_memecoin_metadata',
    description: 'Generate draft memecoin metadata and branding copy.',
    permissionClass: 'transaction_prepare',
    requiresWallet: false,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  build_unsigned_pumpfun_create_tx: {
    name: 'build_unsigned_pumpfun_create_tx',
    description: 'Build an unsigned Pump.fun create transaction after all builder gates pass.',
    permissionClass: 'transaction_prepare',
    requiresWallet: true,
    requiresUserApproval: true,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: false,
  },
  simulate_transaction: {
    name: 'simulate_transaction',
    description: 'Simulate a transaction or quote before any wallet approval.',
    permissionClass: 'simulation',
    requiresWallet: false,
    requiresUserApproval: true,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  prepare_wallet_signature_request: {
    name: 'prepare_wallet_signature_request',
    description: 'Prepare a browser-only wallet signature request after explicit user action.',
    permissionClass: 'transaction_signature_request',
    requiresWallet: true,
    requiresUserApproval: true,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: false,
  },
  submit_signed_transaction: {
    name: 'submit_signed_transaction',
    description: 'Submit an already signed transaction after a separate explicit user action.',
    permissionClass: 'transaction_submit',
    requiresWallet: true,
    requiresUserApproval: true,
    canMoveFunds: true,
    canSign: false,
    canSubmit: true,
    allowedInAutopilot: false,
  },
  store_memory: {
    name: 'store_memory',
    description: 'Store approved non-secret Mythos memory.',
    permissionClass: 'memory',
    requiresWallet: false,
    requiresUserApproval: true,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
  retrieve_memory: {
    name: 'retrieve_memory',
    description: 'Retrieve allowed Mythos memory context.',
    permissionClass: 'memory',
    requiresWallet: false,
    requiresUserApproval: false,
    canMoveFunds: false,
    canSign: false,
    canSubmit: false,
    allowedInAutopilot: true,
  },
};

export const MYTHOS_OPENAI_SECURITY_RULES = {
  NEVER_SEND_PRIVATE_KEYS: true,
  NEVER_SEND_SEED_PHRASES: true,
  NEVER_SEND_SIGNED_PAYLOADS: true,
  NEVER_SEND_API_KEYS: true,
  NEVER_AUTO_SIGN: true,
  NEVER_MOVE_FUNDS_AUTOMATICALLY: true,
  ALWAYS_REQUIRE_USER_APPROVAL_FOR_SIGNATURE: true,
  ALWAYS_REQUIRE_USER_APPROVAL_FOR_SUBMISSION: true,
} as const;

export function isAllowedTool(tool: string): tool is MythosAllowedTool {
  return MYTHOS_TOOL_ALLOWLIST.includes(tool as MythosAllowedTool);
}

export function getToolDefinition(tool: MythosAllowedTool): MythosToolDefinition {
  return MYTHOS_TOOL_DEFINITIONS[tool];
}

export function isAutopilotSafeTool(tool: MythosAllowedTool): boolean {
  const definition = getToolDefinition(tool);
  return definition.allowedInAutopilot
    && !definition.canMoveFunds
    && !definition.canSubmit
    && !definition.canSign;
}

export function assertMythosToolContractsAreSafe() {
  for (const definition of Object.values(MYTHOS_TOOL_DEFINITIONS)) {
    if (definition.canSign) {
      throw new Error(`Unsafe Mythos tool contract: ${definition.name} can sign.`);
    }
    if (definition.canMoveFunds && definition.name !== 'submit_signed_transaction') {
      throw new Error(`Unsafe Mythos tool contract: ${definition.name} can move funds.`);
    }
    if ((definition.canMoveFunds || definition.canSubmit || definition.permissionClass === 'transaction_signature_request') && definition.allowedInAutopilot) {
      throw new Error(`Unsafe Mythos tool contract: ${definition.name} is allowed in autopilot.`);
    }
    if ((definition.canMoveFunds || definition.canSubmit) && !definition.requiresUserApproval) {
      throw new Error(`Unsafe Mythos tool contract: ${definition.name} lacks user approval.`);
    }
  }
}

assertMythosToolContractsAreSafe();
