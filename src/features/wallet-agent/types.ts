export type WalletAgentIntentType =
  | 'BUY_TOKEN'
  | 'SELL_TOKEN'
  | 'SCHEDULE_PAYMENT'
  | 'PAYROLL_BATCH'
  | 'PRICE_ALERT'
  | 'RISK_CHECK'
  | 'PRIVACY_PAYMENT';

export type WalletAgentRiskLevel = 'low' | 'medium' | 'high' | 'blocked';

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
  summary: string;
  estimatedValueSol?: number;
  riskLevel: WalletAgentRiskLevel;
  approvalStep: WalletAgentApprovalStep;
  requiresWalletSignature: boolean;
  requiresInAppConfirmation: boolean;
  canAutoExecute: false;
  sources: string[];
  warnings: string[];
};

export type WalletAgentSafetyResult = {
  status: WalletAgentSafetyStatus;
  allowed: boolean;
  reason: string;
  requiredSteps: WalletAgentApprovalStep[];
  warnings: string[];
};
