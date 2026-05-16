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
  | 'unsigned_transaction_prepared'
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
  transactionProposal?: WalletAgentTransactionProposal | null;
  preparedTransaction?: WalletAgentPreparedTransaction | null;
  signedTransaction?: WalletAgentSignedTransaction | null;
  submittedTransaction?: WalletAgentSubmittedTransaction | null;
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
  transactionProposalStatus?: WalletAgentTransactionProposal['status'];
  preparedTransactionStatus?: WalletAgentPreparedTransaction['status'];
  signedTransactionStatus?: WalletAgentSignedTransaction['status'];
  submittedSignature?: string;
};

export type WalletAgentDevnetReceipt = {
  id: string;
  intentId: string;
  type: WalletAgentIntentType;
  network: 'solana-devnet';
  walletAddress: string | null;
  recipientAddress?: string;
  amountSol?: number;
  signature: string;
  explorerUrl: string;
  confirmationStatus: WalletAgentSubmittedTransaction['confirmationStatus'];
  submittedAt: string;
  confirmedAt?: string;
  slot?: number;
  savedAt: string;
  updatedAt: string;
  summary: string;
};

export type WalletAgentLocalRuleStatus = 'manual_review' | 'paused';

export type WalletAgentLocalRuleTrigger =
  | {
      kind: 'time';
      label: string;
      scheduledFor?: string;
    }
  | {
      kind: 'price';
      label: string;
      tokenSymbol?: string;
      targetPriceUsd?: number;
    }
  | {
      kind: 'risk';
      label: string;
      tokenSymbol?: string;
    }
  | {
      kind: 'batch_review';
      label: string;
      scheduledFor?: string;
      employeeCount?: number;
    };

export type WalletAgentLocalRule = {
  id: string;
  intentId: string;
  type: WalletAgentIntentType;
  status: WalletAgentLocalRuleStatus;
  network: WalletAgentIntentDraft['network'];
  walletAddress: string | null;
  summary: string;
  trigger: WalletAgentLocalRuleTrigger;
  action: {
    kind: 'notify_only' | 'prepare_for_manual_signature';
    label: string;
  };
  safety: {
    canAutoExecute: false;
    requiresWalletSignature: boolean;
    notes: string[];
  };
  createdAt: string;
  updatedAt: string;
  confirmationId?: string;
};

export type WalletAgentWalletSnapshot = {
  address: string;
  network: WalletAgentIntentDraft['network'];
  balanceSol: number | null;
  source: 'wallet-adapter' | 'devnet-sandbox';
  readAt: string;
};

export type WalletAgentTransactionProposalStatus =
  | 'blocked'
  | 'needs_more_details'
  | 'ready_for_wallet_signature';

export type WalletAgentTransactionProposal = {
  id: string;
  status: WalletAgentTransactionProposalStatus;
  kind: 'swap_intent' | 'transfer_intent' | 'payroll_intent' | 'privacy_transfer_intent';
  network: WalletAgentIntentDraft['network'];
  fromAddress: string;
  createdAt: string;
  summary: string;
  estimatedFeeSol: number;
  requiredWalletAction: string;
  missingFields: string[];
  checks: Array<{
    label: string;
    status: 'pass' | 'missing' | 'blocked' | 'review';
    detail: string;
  }>;
  unsignedPayloadStatus: 'not_created';
};

export type WalletAgentPreparedTransactionStatus =
  | 'prepared_unsigned'
  | 'blocked'
  | 'unsupported';

export type WalletAgentPreparedTransaction = {
  id: string;
  status: WalletAgentPreparedTransactionStatus;
  network: 'solana-devnet';
  kind: 'sol_transfer';
  fromAddress: string;
  toAddress: string;
  amountSol: number;
  latestBlockhash: string;
  lastValidBlockHeight: number;
  serializedTransactionBase64: string;
  createdAt: string;
  warnings: string[];
  nextStep: 'wallet_signature_required';
};

export type WalletAgentSignedTransaction = {
  id: string;
  status: 'signed_not_submitted';
  network: 'solana-devnet';
  signedTransactionBase64: string;
  signedAt: string;
  signerAddress: string;
  nextStep: 'submit_to_devnet';
  warnings: string[];
};

export type WalletAgentSubmittedTransaction = {
  id: string;
  status: 'submitted_to_devnet';
  network: 'solana-devnet';
  signature: string;
  explorerUrl: string;
  submittedAt: string;
  confirmationStatus: 'submitted' | 'processed' | 'confirmed' | 'finalized' | 'error' | 'not_found';
  confirmedAt?: string;
  slot?: number;
  errorMessage?: string;
  warnings: string[];
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
