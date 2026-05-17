type WalletAgentProductionAuditStatus = 'ready' | 'action_required' | 'warning' | 'safe_default';
type WalletAgentFeatureFlagStatus = 'enabled' | 'disabled' | 'safe_default';

export type WalletAgentProductionAuditItem = {
  id: string;
  label: string;
  status: WalletAgentProductionAuditStatus;
  configured: boolean;
  requiredForProduction: boolean;
  publicDetail: string;
  requiredEnv: string[];
  safetyNotes: string[];
};

export type WalletAgentProductionAudit = {
  generatedAt: string;
  readyForProduction: boolean;
  summary: {
    ready: number;
    actionRequired: number;
    warnings: number;
    safeDefaults: number;
  };
  items: WalletAgentProductionAuditItem[];
  safety: {
    secretsRedacted: true;
    canExecuteTransactions: false;
    canSendFunds: false;
    notes: string[];
  };
};

export type WalletAgentFeatureFlag = {
  id: string;
  label: string;
  status: WalletAgentFeatureFlagStatus;
  envName: string;
  defaultStatus: WalletAgentFeatureFlagStatus;
  productionRisk: 'low' | 'medium' | 'high' | 'critical';
  publicDetail: string;
  safetyNotes: string[];
};

export type WalletAgentFeatureFlagSnapshot = {
  generatedAt: string;
  flags: WalletAgentFeatureFlag[];
  summary: {
    enabled: number;
    disabled: number;
    safeDefaults: number;
    criticalEnabled: number;
  };
  safety: {
    secretsRedacted: true;
    canExecuteTransactions: false;
    canSendFunds: false;
    notes: string[];
  };
};

export type WalletAgentProductionMonitoringStatus = {
  generatedAt: string;
  mode: 'read_only';
  health: 'ready' | 'attention_required' | 'unsafe';
  audit: WalletAgentProductionAudit;
  featureFlags: WalletAgentFeatureFlagSnapshot;
  operations: {
    durableHistoryReady: boolean;
    emailReady: boolean;
    sessionSecretReady: boolean;
    devnetConfigured: boolean;
    criticalFlagsEnabled: number;
  };
  safety: {
    adminOnlyRecommended: true;
    secretsRedacted: true;
    canExecuteTransactions: false;
    canSendFunds: false;
    notes: string[];
  };
};

type WalletAgentProductionAuditEnv = Record<string, string | undefined>;

function isEnabled(value: string | undefined) {
  return value === 'enabled' || value === 'true' || value === '1';
}

function isPostgresUrl(value: string | undefined) {
  return !!value && (value.startsWith('postgresql://') || value.startsWith('postgres://'));
}

function hasValue(value: string | undefined) {
  return !!value && value.trim().length > 0;
}

function parseRetentionDays(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function getFlagStatus(value: string | undefined, defaultStatus: WalletAgentFeatureFlagStatus): WalletAgentFeatureFlagStatus {
  if (isEnabled(value)) return 'enabled';
  if (value === 'disabled' || value === 'false' || value === '0') return 'disabled';
  return defaultStatus;
}

function createAuditItem(input: WalletAgentProductionAuditItem): WalletAgentProductionAuditItem {
  return input;
}

function createFeatureFlag(input: WalletAgentFeatureFlag): WalletAgentFeatureFlag {
  return input;
}

export function createWalletAgentFeatureFlagSnapshot(
  env: WalletAgentProductionAuditEnv = process.env,
  now: Date = new Date()
): WalletAgentFeatureFlagSnapshot {
  const flags = [
    createFeatureFlag({
      id: 'email-alerts',
      label: 'Email alerts',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_EMAIL_ALERTS, 'safe_default'),
      envName: 'WALLET_AGENT_FEATURE_EMAIL_ALERTS',
      defaultStatus: 'safe_default',
      productionRisk: 'medium',
      publicDetail: 'Controls whether future production UI should expose email alert delivery controls.',
      safetyNotes: [
        'This flag does not expose email provider secrets.',
        'Email delivery still requires provider configuration and rate limits.',
      ],
    }),
    createFeatureFlag({
      id: 'database-history',
      label: 'Database alert history',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_DATABASE_HISTORY, 'safe_default'),
      envName: 'WALLET_AGENT_FEATURE_DATABASE_HISTORY',
      defaultStatus: 'safe_default',
      productionRisk: 'medium',
      publicDetail: 'Controls whether future production UI should treat account alert history as durable.',
      safetyNotes: [
        'Durable writes still require database envs and adapter readiness.',
        'History remains metadata-only.',
      ],
    }),
    createFeatureFlag({
      id: 'devnet-wallet',
      label: 'Devnet wallet sandbox',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_DEVNET_WALLET, 'safe_default'),
      envName: 'WALLET_AGENT_FEATURE_DEVNET_WALLET',
      defaultStatus: 'safe_default',
      productionRisk: 'low',
      publicDetail: 'Controls whether future production UI should expose Solana Devnet sandbox onboarding.',
      safetyNotes: [
        'Devnet is sandbox-only and must not receive real funds.',
        'Airdrops must stay clearly labeled as test SOL.',
      ],
    }),
    createFeatureFlag({
      id: 'transaction-proposals',
      label: 'Transaction proposals',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_TRANSACTION_PROPOSALS, 'safe_default'),
      envName: 'WALLET_AGENT_FEATURE_TRANSACTION_PROPOSALS',
      defaultStatus: 'safe_default',
      productionRisk: 'high',
      publicDetail: 'Controls whether future production UI should expose transaction proposal surfaces.',
      safetyNotes: [
        'A proposal is not a signed transaction.',
        'Every value-moving step must remain separately reviewed and approved.',
      ],
    }),
    createFeatureFlag({
      id: 'scheduled-actions',
      label: 'Scheduled actions',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_SCHEDULED_ACTIONS, 'disabled'),
      envName: 'WALLET_AGENT_FEATURE_SCHEDULED_ACTIONS',
      defaultStatus: 'disabled',
      productionRisk: 'critical',
      publicDetail: 'Controls whether future production UI should expose scheduled action orchestration.',
      safetyNotes: [
        'Scheduled value-moving actions must remain disabled until audited.',
        'Future schedules must require user authentication and wallet approval at execution time.',
      ],
    }),
    createFeatureFlag({
      id: 'mainnet-execution',
      label: 'Mainnet execution',
      status: getFlagStatus(env.WALLET_AGENT_FEATURE_MAINNET_EXECUTION, 'disabled'),
      envName: 'WALLET_AGENT_FEATURE_MAINNET_EXECUTION',
      defaultStatus: 'disabled',
      productionRisk: 'critical',
      publicDetail: 'Controls whether future production code may expose mainnet execution paths.',
      safetyNotes: [
        'Mainnet execution must remain disabled until a full security review exists.',
        'This flag snapshot cannot sign, submit, buy, sell, pay, or move funds.',
      ],
    }),
  ];

  const summary = flags.reduce(
    (current, flag) => {
      if (flag.status === 'enabled') current.enabled += 1;
      if (flag.status === 'disabled') current.disabled += 1;
      if (flag.status === 'safe_default') current.safeDefaults += 1;
      if (flag.status === 'enabled' && flag.productionRisk === 'critical') current.criticalEnabled += 1;
      return current;
    },
    { enabled: 0, disabled: 0, safeDefaults: 0, criticalEnabled: 0 }
  );

  return {
    generatedAt: now.toISOString(),
    flags,
    summary,
    safety: {
      secretsRedacted: true,
      canExecuteTransactions: false,
      canSendFunds: false,
      notes: [
        'Feature flag snapshot reports requested exposure only.',
        'It does not modify runtime behavior by itself.',
        'It never returns secret values and cannot buy, sell, pay, schedule, sign, submit, or move funds.',
      ],
    },
  };
}

export function createWalletAgentProductionReadinessAudit(
  env: WalletAgentProductionAuditEnv = process.env,
  now: Date = new Date()
): WalletAgentProductionAudit {
  const databaseUrl = env.WALLET_AGENT_ALERTS_DATABASE_URL || env.DATABASE_URL;
  const databaseRequested = env.WALLET_AGENT_ALERT_HISTORY_STORAGE === 'database'
    || isEnabled(env.WALLET_AGENT_ALERT_PERSISTENCE)
    || hasValue(env.WALLET_AGENT_ALERTS_DATABASE_URL);
  const databaseConfigured = isPostgresUrl(databaseUrl);
  const databaseAdapterEnabled = isEnabled(env.WALLET_AGENT_ALERT_DATABASE_ADAPTER);
  const resendConfigured = hasValue(env.RESEND_API_KEY);
  const emailFromConfigured = hasValue(env.AUTH_EMAIL_FROM) || hasValue(env.EMAIL_FROM);
  const sessionSecretConfigured = hasValue(env.USER_SESSION_SECRET) || hasValue(env.ADMIN_SESSION_SECRET);
  const retentionDays = parseRetentionDays(env.WALLET_AGENT_ALERT_HISTORY_RETENTION_DAYS);

  const items = [
    createAuditItem({
      id: 'database-history',
      label: 'Durable alert history',
      status: databaseRequested && databaseConfigured && databaseAdapterEnabled ? 'ready' : 'action_required',
      configured: databaseRequested && databaseConfigured && databaseAdapterEnabled,
      requiredForProduction: true,
      publicDetail: databaseRequested
        ? databaseConfigured
          ? databaseAdapterEnabled
            ? 'Database history is requested, configured, and adapter-enabled.'
            : 'Database URL is present, but the database adapter is not enabled.'
          : 'Database history is requested, but no valid Postgres URL is configured.'
        : 'Database history is not requested. The system will use bounded memory.',
      requiredEnv: [
        'WALLET_AGENT_ALERT_HISTORY_STORAGE=database',
        'WALLET_AGENT_ALERT_DATABASE_ADAPTER=enabled',
        'WALLET_AGENT_ALERTS_DATABASE_URL or DATABASE_URL',
      ],
      safetyNotes: [
        'This audit never returns database URLs.',
        'Alert history stores metadata only.',
      ],
    }),
    createAuditItem({
      id: 'email-provider',
      label: 'Email delivery provider',
      status: resendConfigured && emailFromConfigured ? 'ready' : 'action_required',
      configured: resendConfigured && emailFromConfigured,
      requiredForProduction: true,
      publicDetail: resendConfigured && emailFromConfigured
        ? 'Email delivery provider and sender are configured.'
        : 'Email delivery needs a provider API key and sender address.',
      requiredEnv: ['RESEND_API_KEY', 'AUTH_EMAIL_FROM or EMAIL_FROM'],
      safetyNotes: [
        'This audit never returns API keys.',
        'Email delivery must remain rate-limited before production.',
      ],
    }),
    createAuditItem({
      id: 'email-session-secret',
      label: 'Verified email session secret',
      status: sessionSecretConfigured ? 'ready' : 'warning',
      configured: sessionSecretConfigured,
      requiredForProduction: true,
      publicDetail: sessionSecretConfigured
        ? 'A session secret is configured for verified email identity.'
        : 'No explicit user/admin session secret was detected. Configure a strong production secret.',
      requiredEnv: ['USER_SESSION_SECRET or ADMIN_SESSION_SECRET'],
      safetyNotes: [
        'This audit only reports presence, never secret values.',
        'Production sessions should not rely on fallback secrets.',
      ],
    }),
    createAuditItem({
      id: 'devnet-rpc',
      label: 'Solana Devnet RPC',
      status: hasValue(env.SOLANA_RPC_URL) ? 'ready' : 'safe_default',
      configured: hasValue(env.SOLANA_RPC_URL),
      requiredForProduction: false,
      publicDetail: hasValue(env.SOLANA_RPC_URL)
        ? 'A Solana RPC URL is configured for wallet/devnet flows.'
        : 'No Solana RPC URL is configured. Devnet flows can fall back to public devnet RPC.',
      requiredEnv: ['SOLANA_RPC_URL'],
      safetyNotes: [
        'Devnet is sandbox only and must not receive real funds.',
        'This audit never returns RPC URLs or embedded keys.',
      ],
    }),
    createAuditItem({
      id: 'retention-window',
      label: 'Alert history retention window',
      status: retentionDays === null || (retentionDays >= 7 && retentionDays <= 3650) ? 'ready' : 'warning',
      configured: retentionDays !== null,
      requiredForProduction: true,
      publicDetail: retentionDays === null
        ? 'Retention is not set explicitly and will use the safe default.'
        : retentionDays >= 7 && retentionDays <= 3650
          ? 'Retention is configured inside the supported range.'
          : 'Retention is outside the supported range and will be clamped by runtime policy.',
      requiredEnv: ['WALLET_AGENT_ALERT_HISTORY_RETENTION_DAYS'],
      safetyNotes: [
        'Retention config does not trigger automatic purges yet.',
        'Manual deletion still requires verified email confirmation.',
      ],
    }),
    createAuditItem({
      id: 'mainnet-execution',
      label: 'Mainnet execution gate',
      status: 'safe_default',
      configured: false,
      requiredForProduction: true,
      publicDetail: 'No production mainnet execution flag is enabled by this audit layer.',
      requiredEnv: ['future audited execution flags'],
      safetyNotes: [
        'Wallet Agent cannot send production funds from this audit.',
        'Future value-moving phases must require explicit wallet approval.',
      ],
    }),
  ];

  const summary = items.reduce(
    (current, item) => {
      if (item.status === 'ready') current.ready += 1;
      if (item.status === 'action_required') current.actionRequired += 1;
      if (item.status === 'warning') current.warnings += 1;
      if (item.status === 'safe_default') current.safeDefaults += 1;
      return current;
    },
    { ready: 0, actionRequired: 0, warnings: 0, safeDefaults: 0 }
  );

  return {
    generatedAt: now.toISOString(),
    readyForProduction: summary.actionRequired === 0 && summary.warnings === 0,
    summary,
    items,
    safety: {
      secretsRedacted: true,
      canExecuteTransactions: false,
      canSendFunds: false,
      notes: [
        'Environment audit returns presence and mode information only.',
        'No secret values, private keys, seed phrases, wallet signatures, or database URLs are exposed.',
        'The audit cannot buy, sell, pay, schedule, sign, submit, or move funds.',
      ],
    },
  };
}

export function createWalletAgentProductionMonitoringStatus(
  env: WalletAgentProductionAuditEnv = process.env,
  now: Date = new Date()
): WalletAgentProductionMonitoringStatus {
  const audit = createWalletAgentProductionReadinessAudit(env, now);
  const featureFlags = createWalletAgentFeatureFlagSnapshot(env, now);
  const getAuditItem = (id: string) => audit.items.find(item => item.id === id);
  const criticalFlagsEnabled = featureFlags.summary.criticalEnabled;
  const health = criticalFlagsEnabled > 0
    ? 'unsafe'
    : audit.readyForProduction
      ? 'ready'
      : 'attention_required';

  return {
    generatedAt: now.toISOString(),
    mode: 'read_only',
    health,
    audit,
    featureFlags,
    operations: {
      durableHistoryReady: getAuditItem('database-history')?.status === 'ready',
      emailReady: getAuditItem('email-provider')?.status === 'ready',
      sessionSecretReady: getAuditItem('email-session-secret')?.status === 'ready',
      devnetConfigured: getAuditItem('devnet-rpc')?.configured === true,
      criticalFlagsEnabled,
    },
    safety: {
      adminOnlyRecommended: true,
      secretsRedacted: true,
      canExecuteTransactions: false,
      canSendFunds: false,
      notes: [
        'Monitoring status is read-only and redacted.',
        'It is intended for admin/deployment checks, not public user display.',
        'It cannot change feature flags, send email, run migrations, sign, submit, buy, sell, pay, schedule, or move funds.',
      ],
    },
  };
}
