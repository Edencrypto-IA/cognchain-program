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
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MINT_ACCOUNT_SIZE = 82;
const TOKEN_ACCOUNT_SIZE = 165;

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
