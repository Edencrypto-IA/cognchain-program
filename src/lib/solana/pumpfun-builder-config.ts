export type PumpfunBuilderReadinessState = 'ready' | 'review' | 'blocked';

export type PumpfunBuilderGate = {
  id: string;
  label: string;
  status: PumpfunBuilderReadinessState;
  detail: string;
};

export type PumpfunBuilderConfig = {
  provider: {
    configured: boolean;
    mode: 'disabled' | 'official_audit' | 'server_unsigned';
    source: string | null;
    officialDocsVerified: boolean;
    auditHash: string | null;
    reason: string;
  };
  program: {
    programId: string | null;
    feeRecipient: string | null;
    globalAccount: string | null;
    eventAuthority: string | null;
    accountSchemaVersion: string | null;
    instructionLayoutHash: string | null;
    accountSchemaVerified: boolean;
    instructionDiscriminatorVerified: boolean;
  };
  fees: {
    quoteProviderConfigured: boolean;
    rentQuoteConfigured: boolean;
  };
  metadata: {
    uploadProviderConfigured: boolean;
    acceptedUriSchemes: string[];
  };
  transaction: {
    unsignedBytesEnabled: boolean;
    localSerializerImplemented: boolean;
    walletSignatureRequired: true;
    submissionRequiresSeparateAction: true;
  };
  gates: PumpfunBuilderGate[];
};

function env(name: string) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function boolEnv(name: string) {
  return ['1', 'true', 'yes', 'enabled'].includes(env(name).toLowerCase());
}

function modeEnv(): PumpfunBuilderConfig['provider']['mode'] {
  const value = env('PUMPFUN_BUILDER_MODE').toLowerCase();
  if (value === 'official_audit' || value === 'server_unsigned') return value;
  return 'disabled';
}

function isLikelySolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function gate(
  id: string,
  label: string,
  status: PumpfunBuilderReadinessState,
  detail: string
): PumpfunBuilderGate {
  return { id, label, status, detail };
}

export function getPumpfunBuilderConfig(): PumpfunBuilderConfig {
  const mode = modeEnv();
  const source = env('PUMPFUN_BUILDER_SOURCE') || null;
  const officialDocsVerified = boolEnv('PUMPFUN_OFFICIAL_DOCS_VERIFIED');
  const auditHash = env('PUMPFUN_BUILDER_AUDIT_HASH') || null;
  const programId = env('PUMPFUN_PROGRAM_ID') || null;
  const feeRecipient = env('PUMPFUN_FEE_RECIPIENT') || null;
  const globalAccount = env('PUMPFUN_GLOBAL_ACCOUNT') || null;
  const eventAuthority = env('PUMPFUN_EVENT_AUTHORITY') || null;
  const accountSchemaVersion = env('PUMPFUN_ACCOUNT_SCHEMA_VERSION') || null;
  const instructionLayoutHash = env('PUMPFUN_INSTRUCTION_LAYOUT_HASH') || null;
  const quoteProviderConfigured = boolEnv('PUMPFUN_FEE_QUOTE_PROVIDER_ENABLED');
  const rentQuoteConfigured = boolEnv('PUMPFUN_RENT_QUOTE_PROVIDER_ENABLED');
  const uploadProviderConfigured = boolEnv('PUMPFUN_METADATA_UPLOAD_PROVIDER_ENABLED');
  const unsignedBytesRequested = boolEnv('PUMPFUN_ENABLE_UNSIGNED_BYTES');

  const programReady = Boolean(programId && isLikelySolanaAddress(programId));
  const fixedAccountsReady = [feeRecipient, globalAccount, eventAuthority]
    .every(value => Boolean(value && isLikelySolanaAddress(value)));
  const accountSchemaVerified = Boolean(accountSchemaVersion && auditHash && officialDocsVerified);
  const instructionDiscriminatorVerified = Boolean(instructionLayoutHash && auditHash && officialDocsVerified);
  const providerConfigured = mode !== 'disabled' && Boolean(source && officialDocsVerified && auditHash);
  const localSerializerImplemented = false;
  const unsignedBytesEnabled = Boolean(
    unsignedBytesRequested
    && mode === 'server_unsigned'
    && providerConfigured
    && programReady
    && fixedAccountsReady
    && accountSchemaVerified
    && instructionDiscriminatorVerified
    && quoteProviderConfigured
    && rentQuoteConfigured
    && uploadProviderConfigured
    && localSerializerImplemented
  );

  const gates = [
    gate(
      'builder_mode',
      'Builder mode',
      mode === 'disabled' ? 'blocked' : 'review',
      mode === 'disabled'
        ? 'Set PUMPFUN_BUILDER_MODE=official_audit first. Use server_unsigned only after serializer review.'
        : `Mode ${mode} is configured and still requires the remaining gates.`
    ),
    gate(
      'official_source',
      'Official source',
      providerConfigured ? 'ready' : 'blocked',
      providerConfigured
        ? 'A server-side source, docs verification flag, and audit hash are present.'
        : 'Missing PUMPFUN_BUILDER_SOURCE, PUMPFUN_OFFICIAL_DOCS_VERIFIED=true, or PUMPFUN_BUILDER_AUDIT_HASH.'
    ),
    gate(
      'program_id',
      'Program ID',
      programReady ? 'ready' : 'blocked',
      programReady ? 'Program ID shape is valid.' : 'Missing valid PUMPFUN_PROGRAM_ID.'
    ),
    gate(
      'fixed_accounts',
      'Fixed accounts',
      fixedAccountsReady ? 'ready' : 'blocked',
      fixedAccountsReady
        ? 'Fee recipient, global account, and event authority are configured.'
        : 'Missing PUMPFUN_FEE_RECIPIENT, PUMPFUN_GLOBAL_ACCOUNT, or PUMPFUN_EVENT_AUTHORITY.'
    ),
    gate(
      'account_schema',
      'Account schema',
      accountSchemaVerified ? 'ready' : 'blocked',
      accountSchemaVerified
        ? `Schema ${accountSchemaVersion} is tied to audit hash.`
        : 'Set account schema version and audit hash after official review.'
    ),
    gate(
      'instruction_layout',
      'Instruction layout',
      instructionDiscriminatorVerified ? 'ready' : 'blocked',
      instructionDiscriminatorVerified
        ? 'Instruction layout hash is tied to audit hash.'
        : 'Set PUMPFUN_INSTRUCTION_LAYOUT_HASH only after discriminator/layout review.'
    ),
    gate(
      'fee_rent_quote',
      'Fee and rent quote',
      quoteProviderConfigured && rentQuoteConfigured ? 'ready' : 'blocked',
      quoteProviderConfigured && rentQuoteConfigured
        ? 'Fee and rent quote providers are configured.'
        : 'Fee and rent quote providers must be enabled before bytes are generated.'
    ),
    gate(
      'metadata_upload',
      'Metadata upload',
      uploadProviderConfigured ? 'ready' : 'blocked',
      uploadProviderConfigured
        ? 'Metadata upload provider is configured server-side.'
        : 'A server-side metadata upload provider must return the final URI.'
    ),
    gate(
      'local_serializer',
      'Local serializer',
      localSerializerImplemented ? 'ready' : 'blocked',
      'The local VersionedTransaction serializer is intentionally not implemented until every previous gate is audited.'
    ),
  ];

  return {
    provider: {
      configured: providerConfigured,
      mode,
      source,
      officialDocsVerified,
      auditHash,
      reason: providerConfigured
        ? 'Official/audited builder metadata is configured, but transaction bytes still require serializer implementation.'
        : 'Official Pump.fun builder metadata is not fully configured server-side.',
    },
    program: {
      programId,
      feeRecipient,
      globalAccount,
      eventAuthority,
      accountSchemaVersion,
      instructionLayoutHash,
      accountSchemaVerified,
      instructionDiscriminatorVerified,
    },
    fees: {
      quoteProviderConfigured,
      rentQuoteConfigured,
    },
    metadata: {
      uploadProviderConfigured,
      acceptedUriSchemes: ['ipfs://', 'ar://', 'https://'],
    },
    transaction: {
      unsignedBytesEnabled,
      localSerializerImplemented,
      walletSignatureRequired: true,
      submissionRequiresSeparateAction: true,
    },
    gates,
  };
}
