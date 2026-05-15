export type WalletAgentIntentType =
  | 'BUY_TOKEN'
  | 'SELL_TOKEN'
  | 'SCHEDULE_PAYMENT'
  | 'PAYROLL_BATCH'
  | 'PRICE_ALERT'
  | 'RISK_CHECK'
  | 'PRIVACY_PAYMENT';

export type WalletAgentRiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export type WalletAgentLanguageHint = 'pt' | 'en' | 'es' | 'fr' | 'mixed' | 'unknown';

export type WalletAgentIntentDetection = {
  type: WalletAgentIntentType;
  confidence: number;
  matchedKeywords: string[];
  languageHint: WalletAgentLanguageHint;
  isFinancialCommand: boolean;
};

export type WalletAgentParserSource = 'local' | 'ai' | 'fallback';

export type WalletAgentParsedIntent = {
  source: WalletAgentParserSource;
  type: WalletAgentIntentType;
  confidence: number;
  entities: Partial<WalletAgentIntentEntities>;
  missingFields: string[];
  notes: string[];
};

export type WalletAgentApprovalStep =
  | 'intent_preview'
  | 'user_confirmed_in_app'
  | 'wallet_signature_required'
  | 'wallet_signed'
  | 'executed';

export type WalletAgentSafetyStatus =
  | 'draft_only'
  | 'needs_user_review'
  | 'ready_for_wallet_signature'
  | 'blocked';

export type WalletAgentIntentDraft = {
  id: string;
  type: WalletAgentIntentType;
  userPrompt: string;
  createdAt: string;
  network: 'solana-devnet' | 'solana-mainnet';
  walletAddress?: string | null;
  walletSnapshot?: WalletAgentWalletSnapshot | null;
  summary: string;
  entities: WalletAgentIntentEntities;
  estimatedValueSol?: number;
  riskLevel: WalletAgentRiskLevel;
  approvalStep: WalletAgentApprovalStep;
  requiresWalletSignature: boolean;
  requiresInAppConfirmation: boolean;
  canAutoExecute: false;
  sources: string[];
  warnings: string[];
  internalConfirmation?: WalletAgentInternalConfirmation;
};

export type WalletAgentInternalConfirmation = {
  confirmed: boolean;
  confirmedAt: string;
  confirmationId: string;
  nextApprovalStep: WalletAgentApprovalStep;
};

export type WalletAgentHistoryStatus = 'previewed' | 'confirmed' | 'wallet_signature_required';

export type WalletAgentHistoryEntry = {
  id: string;
  status: WalletAgentHistoryStatus;
  type: WalletAgentIntentType;
  network: WalletAgentIntentDraft['network'];
  summary: string;
  tokenSymbol?: string;
  amountSol?: number;
  targetPriceUsd?: number;
  riskLevel: WalletAgentRiskLevel;
  createdAt: string;
  updatedAt: string;
  confirmationId?: string;
  walletAddress?: string | null;
  walletSource?: WalletAgentWalletSnapshot['source'];
  walletBalanceSol?: number | null;
};

export type WalletAgentWalletSnapshot = {
  address: string;
  network: WalletAgentIntentDraft['network'];
  balanceSol: number | null;
  source: 'wallet-adapter' | 'devnet-sandbox';
  readAt: string;
};

export type WalletAgentIntentEntities = {
  tokenSymbol?: string;
  quoteTokenSymbol?: string;
  amountSol?: number;
  recipientAddress?: string;
  scheduledFor?: string;
  targetPriceUsd?: number;
  employeeCount?: number;
};

export type WalletAgentSafetyResult = {
  status: WalletAgentSafetyStatus;
  allowed: boolean;
  reason: string;
  requiredSteps: WalletAgentApprovalStep[];
  warnings: string[];
};

export type WalletAgentCommandInput = {
  prompt: string;
  network?: 'solana-devnet' | 'solana-mainnet';
  walletAddress?: string | null;
  walletSnapshot?: WalletAgentWalletSnapshot | null;
  now?: Date;
  parsedIntent?: WalletAgentParsedIntent;
};

export type WalletAgentPreview = {
  title: string;
  description: string;
  networkLabel: string;
  primaryActionLabel: string;
  nextStep: string;
  checklist: string[];
  disclosures: string[];
};

export type WalletAgentReviewItem = {
  label: string;
  value: string;
  status: 'ready' | 'missing' | 'review';
};

export type WalletAgentReviewDetails = {
  title: string;
  subtitle: string;
  intentLabel: string;
  custodyLabel: string;
  items: WalletAgentReviewItem[];
  requiredBeforeExecution: string[];
  blockedActions: string[];
};

export type WalletAgentCoreResult = {
  draft: WalletAgentIntentDraft;
  safety: WalletAgentSafetyResult;
  preview: WalletAgentPreview;
  review: WalletAgentReviewDetails;
};
