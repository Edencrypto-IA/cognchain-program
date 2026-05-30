import crypto from 'crypto';
import {
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import type { PumpfunBuilderConfig } from './pumpfun-builder-config';

const PUMPFUN_CREATE_DISCRIMINATOR = Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]);
const PUMPFUN_BUY_EXACT_SOL_IN_DISCRIMINATOR = Buffer.from([56, 252, 116, 8, 158, 223, 205, 95]);
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const PUMPFUN_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');
const MINT_ACCOUNT_SIZE = 82;
const TOKEN_ACCOUNT_SIZE = 165;
const LAMPORTS_PER_SOL_BIGINT = 1_000_000_000n;

export type PumpfunCreateUnsignedInput = {
  name: string;
  symbol: string;
  metadataUri: string;
  walletAddress: string;
  mintPublicKey: string;
  priorityFeeLamports: number;
};

export type PumpfunCreateUnsignedResult = {
  instructionName: 'create';
  recentBlockhash: string;
  lastValidBlockHeight: number;
  serializedUnsignedPayload: string;
  messageBase64: string;
  transactionHash: string;
  accounts: {
    mint: string;
    mintAuthority: string;
    bondingCurve: string;
    associatedBondingCurve: string;
    global: string;
    mplTokenMetadata: string;
    metadata: string;
    user: string;
    systemProgram: string;
    tokenProgram: string;
    associatedTokenProgram: string;
    rent: string;
    eventAuthority: string;
    program: string;
  };
  requiredSigners: string[];
  quote: {
    networkFeeLamports: number | null;
    mintRentLamports: number | null;
    tokenAccountRentLamports: number | null;
    priorityFeeLamports: number;
    totalKnownLamports: number | null;
    caveat: string;
  };
  audit: {
    discriminator: number[];
    accountOrder: string[];
    serverGeneratedSecrets: false;
    submitsTransaction: false;
    signsTransaction: false;
  };
};

export type PumpfunBuyUnsignedInput = {
  mint: string;
  walletAddress: string;
  spendSol: number;
  slippageBps: number;
  priorityFeeLamports: number;
};

export type PumpfunBuyUnsignedResult = {
  instructionName: 'buy_exact_sol_in';
  recentBlockhash: string;
  lastValidBlockHeight: number;
  serializedUnsignedPayload: string;
  messageBase64: string;
  transactionHash: string;
  quote: {
    spendLamports: string;
    expectedTokensOut: string;
    minTokensOut: string;
    slippageBps: number;
    priorityFeeLamports: number;
    networkFeeLamports: number | null;
    totalKnownLamports: number | null;
    caveat: string;
  };
  accounts: {
    global: string;
    feeRecipient: string;
    mint: string;
    bondingCurve: string;
    associatedBondingCurve: string;
    associatedUser: string;
    user: string;
    systemProgram: string;
    tokenProgram: string;
    creatorVault: string;
    eventAuthority: string;
    program: string;
    globalVolumeAccumulator: string;
    userVolumeAccumulator: string;
    feeConfig: string;
    feeProgram: string;
  };
  bondingCurve: {
    virtualTokenReserves: string;
    virtualQuoteReserves: string;
    realTokenReserves: string;
    realQuoteReserves: string;
    tokenTotalSupply: string;
    complete: boolean;
    creator: string;
  };
  audit: {
    discriminator: number[];
    accountOrder: string[];
    serverGeneratedSecrets: false;
    submitsTransaction: false;
    signsTransaction: false;
  };
};

function rpcUrl() {
  return process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
}

function encodeAnchorString(value: string) {
  const bytes = Buffer.from(value, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([length, bytes]);
}

function encodeCreateData(input: PumpfunCreateUnsignedInput, creator: PublicKey) {
  return Buffer.concat([
    PUMPFUN_CREATE_DISCRIMINATOR,
    encodeAnchorString(input.name),
    encodeAnchorString(input.symbol),
    encodeAnchorString(input.metadataUri),
    Buffer.from(creator.toBytes()),
  ]);
}

function encodeU64(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

function encodeBuyExactSolInData(spendLamports: bigint, minTokensOut: bigint) {
  return Buffer.concat([
    PUMPFUN_BUY_EXACT_SOL_IN_DISCRIMINATOR,
    encodeU64(spendLamports),
    encodeU64(minTokensOut),
    Buffer.from([1]),
  ]);
}

function encodeAssociatedTokenCreateIdempotentData() {
  return Buffer.from([1]);
}

function assertPublicKey(value: string, label: string) {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`${label} is not a valid Solana public key.`);
  }
}

function deriveMetadataPda(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function deriveAssociatedTokenAddress(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

function readU64(data: Buffer, offset: number) {
  return data.readBigUInt64LE(offset);
}

function decodeBondingCurve(data: Buffer) {
  const discriminator = Buffer.from([23, 183, 248, 55, 96, 216, 172, 96]);
  if (data.length < 8 + (5 * 8) + 1 + 32) {
    throw new Error('Bonding curve account data is shorter than the audited layout.');
  }
  if (!data.subarray(0, 8).equals(discriminator)) {
    throw new Error('Bonding curve discriminator does not match the audited Pump.fun IDL.');
  }
  const virtualTokenReserves = readU64(data, 8);
  const virtualQuoteReserves = readU64(data, 16);
  const realTokenReserves = readU64(data, 24);
  const realQuoteReserves = readU64(data, 32);
  const tokenTotalSupply = readU64(data, 40);
  const complete = data[48] === 1;
  const creator = new PublicKey(data.subarray(49, 81));
  return {
    virtualTokenReserves,
    virtualQuoteReserves,
    realTokenReserves,
    realQuoteReserves,
    tokenTotalSupply,
    complete,
    creator,
  };
}

function quoteBuyExactSolIn(virtualTokenReserves: bigint, virtualQuoteReserves: bigint, spendLamports: bigint, slippageBps: number) {
  if (virtualTokenReserves <= 0n || virtualQuoteReserves <= 0n || spendLamports <= 0n) {
    throw new Error('Bonding curve reserves and spend amount must be positive.');
  }
  const expectedTokensOut = (spendLamports * virtualTokenReserves) / (virtualQuoteReserves + spendLamports);
  const minTokensOut = (expectedTokensOut * BigInt(Math.max(0, 10_000 - slippageBps))) / 10_000n;
  return { expectedTokensOut, minTokensOut };
}

function assertMatches(actual: PublicKey, expected: string | null, label: string) {
  if (!expected) throw new Error(`${label} is not configured.`);
  if (actual.toBase58() !== expected) {
    throw new Error(`${label} mismatch. Derived ${actual.toBase58()} but config has ${expected}.`);
  }
}

export async function buildPumpfunCreateUnsignedTransaction(
  input: PumpfunCreateUnsignedInput,
  config: PumpfunBuilderConfig
): Promise<PumpfunCreateUnsignedResult> {
  if (!config.transaction.unsignedBytesEnabled) {
    throw new Error('Pump.fun unsigned bytes are disabled by server readiness gates.');
  }
  if (!input.name || !input.symbol || !input.metadataUri) {
    throw new Error('Token name, symbol, and metadata URI are required.');
  }
  if (input.name.length > 32 || input.symbol.length > 10 || input.metadataUri.length > 240) {
    throw new Error('Token metadata fields exceed audited length limits.');
  }

  const programId = assertPublicKey(config.program.programId || '', 'Pump.fun program ID');
  const global = assertPublicKey(config.program.globalAccount || '', 'Pump.fun global account');
  const eventAuthority = assertPublicKey(config.program.eventAuthority || '', 'Pump.fun event authority');
  const user = assertPublicKey(input.walletAddress, 'Wallet signer');
  const mint = assertPublicKey(input.mintPublicKey, 'Mint public key');

  const [mintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId);
  const [derivedGlobal] = PublicKey.findProgramAddressSync([Buffer.from('global')], programId);
  const [derivedEventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], programId);
  const associatedBondingCurve = deriveAssociatedTokenAddress(bondingCurve, mint);
  const metadata = deriveMetadataPda(mint);

  assertMatches(derivedGlobal, config.program.globalAccount, 'Pump.fun global PDA');
  assertMatches(derivedEventAuthority, config.program.eventAuthority, 'Pump.fun event authority PDA');

  const accounts = {
    mint,
    mintAuthority,
    bondingCurve,
    associatedBondingCurve,
    global,
    mplTokenMetadata: MPL_TOKEN_METADATA_PROGRAM_ID,
    metadata,
    user,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    eventAuthority,
    program: programId,
  };

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: accounts.mint, isSigner: true, isWritable: true },
      { pubkey: accounts.mintAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.bondingCurve, isSigner: false, isWritable: true },
      { pubkey: accounts.associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: accounts.global, isSigner: false, isWritable: false },
      { pubkey: accounts.mplTokenMetadata, isSigner: false, isWritable: false },
      { pubkey: accounts.metadata, isSigner: false, isWritable: true },
      { pubkey: accounts.user, isSigner: true, isWritable: true },
      { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.associatedTokenProgram, isSigner: false, isWritable: false },
      { pubkey: accounts.rent, isSigner: false, isWritable: false },
      { pubkey: accounts.eventAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.program, isSigner: false, isWritable: false },
    ],
    data: encodeCreateData(input, user),
  });

  const connection = new Connection(rpcUrl(), 'confirmed');
  const blockhash = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash.blockhash,
    instructions: [instruction],
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  const serializedUnsigned = Buffer.from(transaction.serialize());
  const fee = await connection.getFeeForMessage(message, 'confirmed');
  const mintRentLamports = await connection.getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE, 'confirmed');
  const tokenAccountRentLamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE, 'confirmed');
  const networkFeeLamports = fee.value ?? null;
  const totalKnownLamports = networkFeeLamports === null
    ? null
    : networkFeeLamports + mintRentLamports + tokenAccountRentLamports + input.priorityFeeLamports;

  const accountStrings = Object.fromEntries(
    Object.entries(accounts).map(([key, value]) => [key, value.toBase58()])
  ) as PumpfunCreateUnsignedResult['accounts'];

  return {
    instructionName: 'create',
    recentBlockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    serializedUnsignedPayload: serializedUnsigned.toString('base64'),
    messageBase64: Buffer.from(message.serialize()).toString('base64'),
    transactionHash: crypto.createHash('sha256').update(serializedUnsigned).digest('hex'),
    accounts: accountStrings,
    requiredSigners: [user.toBase58(), mint.toBase58()],
    quote: {
      networkFeeLamports,
      mintRentLamports,
      tokenAccountRentLamports,
      priorityFeeLamports: input.priorityFeeLamports,
      totalKnownLamports,
      caveat: 'Known fee/rent quote excludes Pump.fun bonding curve program-internal account costs until an official quote provider is wired.',
    },
    audit: {
      discriminator: [...PUMPFUN_CREATE_DISCRIMINATOR],
      accountOrder: Object.keys(accounts),
      serverGeneratedSecrets: false,
      submitsTransaction: false,
      signsTransaction: false,
    },
  };
}

export async function buildPumpfunBuyUnsignedTransaction(
  input: PumpfunBuyUnsignedInput,
  config: PumpfunBuilderConfig
): Promise<PumpfunBuyUnsignedResult> {
  if (!config.transaction.unsignedBytesEnabled) {
    throw new Error('Pump.fun unsigned bytes are disabled by server readiness gates.');
  }
  const spendLamports = BigInt(Math.round(input.spendSol * Number(LAMPORTS_PER_SOL_BIGINT)));
  if (spendLamports <= 0n) throw new Error('Buy spend amount must be greater than 0 SOL.');
  if (input.slippageBps < 50 || input.slippageBps > 3000) {
    throw new Error('Slippage must be between 0.5% and 30%.');
  }

  const programId = assertPublicKey(config.program.programId || '', 'Pump.fun program ID');
  const feeRecipient = assertPublicKey(config.program.feeRecipient || '', 'Pump.fun fee recipient');
  const global = assertPublicKey(config.program.globalAccount || '', 'Pump.fun global account');
  const eventAuthority = assertPublicKey(config.program.eventAuthority || '', 'Pump.fun event authority');
  const mint = assertPublicKey(input.mint, 'Mint');
  const user = assertPublicKey(input.walletAddress, 'Wallet signer');

  const [derivedGlobal] = PublicKey.findProgramAddressSync([Buffer.from('global')], programId);
  const [derivedEventAuthority] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], programId);
  const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], programId);
  const associatedBondingCurve = deriveAssociatedTokenAddress(bondingCurve, mint);
  const associatedUser = deriveAssociatedTokenAddress(user, mint);
  const [globalVolumeAccumulator] = PublicKey.findProgramAddressSync([Buffer.from('global_volume_accumulator')], programId);
  const [userVolumeAccumulator] = PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'), user.toBuffer()], programId);
  const [feeConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('fee_config'), programId.toBuffer()],
    PUMPFUN_FEE_PROGRAM_ID
  );

  assertMatches(derivedGlobal, config.program.globalAccount, 'Pump.fun global PDA');
  assertMatches(derivedEventAuthority, config.program.eventAuthority, 'Pump.fun event authority PDA');

  const connection = new Connection(rpcUrl(), 'confirmed');
  const bondingCurveAccount = await connection.getAccountInfo(bondingCurve, 'confirmed');
  if (!bondingCurveAccount) {
    throw new Error('Bonding curve account does not exist yet. Submit and confirm create before preparing buy.');
  }
  if (!bondingCurveAccount.owner.equals(programId)) {
    throw new Error('Bonding curve account is not owned by the configured Pump.fun program.');
  }
  const decodedCurve = decodeBondingCurve(Buffer.from(bondingCurveAccount.data));
  if (decodedCurve.complete) {
    throw new Error('Bonding curve is complete. Buy should use the migrated pool path, not Pump.fun curve buy.');
  }
  const [creatorVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('creator-vault'), decodedCurve.creator.toBuffer()],
    programId
  );
  const { expectedTokensOut, minTokensOut } = quoteBuyExactSolIn(
    decodedCurve.virtualTokenReserves,
    decodedCurve.virtualQuoteReserves,
    spendLamports,
    input.slippageBps
  );
  if (minTokensOut <= 0n) throw new Error('Buy quote produced zero minimum tokens out.');

  const createAssociatedUserInstruction = new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeAssociatedTokenCreateIdempotentData(),
  });

  const buyInstruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: global, isSigner: false, isWritable: false },
      { pubkey: feeRecipient, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedUser, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: creatorVault, isSigner: false, isWritable: true },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
      { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: false },
      { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
      { pubkey: feeConfig, isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeBuyExactSolInData(spendLamports, minTokensOut),
  });

  const blockhash = await connection.getLatestBlockhash('confirmed');
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash.blockhash,
    instructions: [createAssociatedUserInstruction, buyInstruction],
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);
  const serializedUnsigned = Buffer.from(transaction.serialize());
  const fee = await connection.getFeeForMessage(message, 'confirmed');
  const networkFeeLamports = fee.value ?? null;
  const totalKnownLamports = networkFeeLamports === null
    ? null
    : Number(spendLamports) + networkFeeLamports + input.priorityFeeLamports;

  const accounts = {
    global,
    feeRecipient,
    mint,
    bondingCurve,
    associatedBondingCurve,
    associatedUser,
    user,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    creatorVault,
    eventAuthority,
    program: programId,
    globalVolumeAccumulator,
    userVolumeAccumulator,
    feeConfig,
    feeProgram: PUMPFUN_FEE_PROGRAM_ID,
  };
  const accountStrings = Object.fromEntries(
    Object.entries(accounts).map(([key, value]) => [key, value.toBase58()])
  ) as PumpfunBuyUnsignedResult['accounts'];

  return {
    instructionName: 'buy_exact_sol_in',
    recentBlockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    serializedUnsignedPayload: serializedUnsigned.toString('base64'),
    messageBase64: Buffer.from(message.serialize()).toString('base64'),
    transactionHash: crypto.createHash('sha256').update(serializedUnsigned).digest('hex'),
    quote: {
      spendLamports: spendLamports.toString(),
      expectedTokensOut: expectedTokensOut.toString(),
      minTokensOut: minTokensOut.toString(),
      slippageBps: input.slippageBps,
      priorityFeeLamports: input.priorityFeeLamports,
      networkFeeLamports,
      totalKnownLamports,
      caveat: 'Quote is computed from the current bonding curve reserves at build time. Market movement before submit can make the transaction fail.',
    },
    accounts: accountStrings,
    bondingCurve: {
      virtualTokenReserves: decodedCurve.virtualTokenReserves.toString(),
      virtualQuoteReserves: decodedCurve.virtualQuoteReserves.toString(),
      realTokenReserves: decodedCurve.realTokenReserves.toString(),
      realQuoteReserves: decodedCurve.realQuoteReserves.toString(),
      tokenTotalSupply: decodedCurve.tokenTotalSupply.toString(),
      complete: decodedCurve.complete,
      creator: decodedCurve.creator.toBase58(),
    },
    audit: {
      discriminator: [...PUMPFUN_BUY_EXACT_SOL_IN_DISCRIMINATOR],
      accountOrder: Object.keys(accounts),
      serverGeneratedSecrets: false,
      submitsTransaction: false,
      signsTransaction: false,
    },
  };
}
