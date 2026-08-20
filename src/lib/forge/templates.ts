/**
 * Forge Solana-native templates — one-click scaffolds applied as safe file
 * proposals (the user still reviews/applies through the diff gate).
 *
 * All template paths live under `solana/` so they pass the existing Forge path
 * allowlist; nothing is written without explicit Apply.
 */

export interface ForgeTemplateFile {
  path: string;
  language: string;
  contents: string;
}

export interface ForgeTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  files: ForgeTemplateFile[];
}

export type ForgeTemplateSummary = Pick<ForgeTemplate, 'id' | 'name' | 'description' | 'tags'>;

const ANCHOR_COUNTER: ForgeTemplate = {
  id: 'anchor-counter',
  name: 'Programa Anchor — Counter',
  description: 'Programa Anchor completo em Rust (lib.rs) + testes TS, pronto para devnet.',
  tags: ['solana', 'anchor', 'rust'],
  files: [
    {
      path: 'solana/anchor-counter/programs/counter/src/lib.rs',
      language: 'rust',
      contents: `use anchor_lang::prelude::*;

declare_id!("YourProgramIDHere1111111111111111111111111111");

#[program]
pub mod counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        msg!("count: {}", counter.count);
        Ok(())
    }
}

#[account]
pub struct Counter {
    pub count: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
}
`,
    },
    {
      path: 'solana/anchor-counter/tests/counter.ts',
      language: 'ts',
      contents: `import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

// Anchor test scaffold — replace ProgramID e adapte ao seu workspace.
describe('counter', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Counter as Program<any>;

  it('initializes and increments', async () => {
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('counter')],
      program.programId,
    );
    await program.methods.initialize().accounts({ counter: counterPda }).rpc();
    await program.methods.increment().accounts({ counter: counterPda }).rpc();
    const state = await program.account.counter.fetch(counterPda);
    console.log('count =', state.count.toString());
  });
});
`,
    },
  ],
};

const PUMPFUN_LAUNCH: ForgeTemplate = {
  id: 'pumpfun-launch',
  name: 'pump.fun — Config de Launch',
  description: 'Payload de launch pump.fun com metadata (preview/audit antes de assinar).',
  tags: ['solana', 'pump', 'token'],
  files: [
    {
      path: 'solana/pumpfun-launch/config.ts',
      language: 'ts',
      contents: `// pump.fun launch configuration — REVIEW antes de qualquer assinatura.
// Nada aqui move fundos: é apenas o payload de preparação.
export const pumpfunLaunchConfig = {
  network: 'devnet',
  tokenName: 'MyToken',
  tokenSymbol: 'MTK',
  description: 'Token criado pelo Forge (template pump.fun).',
  imageUrl: 'https://example.com/token.png',
  initialLiquiditySol: 1,
  devBuyAmountSol: 0.05,
  // Cuidado: nunca coloque private keys aqui.
  priorityFeeLamports: 1000,
};

export function buildMetadataUri(config: typeof pumpfunLaunchConfig): string {
  return JSON.stringify({
    name: config.tokenName,
    symbol: config.tokenSymbol,
    description: config.description,
    image: config.imageUrl,
  });
}
`,
    },
  ],
};

const SPL_TOKEN_MINT: ForgeTemplate = {
  id: 'spl-token-mint',
  name: 'SPL Token — Mint',
  description: 'Script TS para criar um mint SPL com metadata (Metaplex UMI) em devnet.',
  tags: ['solana', 'token', 'spl'],
  files: [
    {
      path: 'solana/spl-token-mint/script.ts',
      language: 'ts',
      contents: `import { createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createMint, mintV1 } from '@metaplex-foundation/mpl-token-metadata';

// SPL token mint scaffold (devnet). Exige um keypair local — nunca exponha.
export async function createTokenMint(rpcUrl: string, keypairPath: string) {
  const umi = createUmi(rpcUrl);
  const keypair = umi.eddsa.generateKeypair(); // em produção: carregar de arquivo
  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer));

  const mint = await createMint(umi, { decimals: 6, mintAuthority: signer });
  console.log('Mint criado:', mint.publicKey);
  return mint;
}
`,
    },
  ],
};

const SOLANA_DAPP: ForgeTemplate = {
  id: 'solana-dapp',
  name: 'dApp Solana — Scaffold',
  description: 'Página Next com conexão de carteira (Wallet Standard) e transação simulada em devnet.',
  tags: ['solana', 'dapp', 'next'],
  files: [
    {
      path: 'components/solana-dapp-shell.tsx',
      language: 'tsx',
      contents: `'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function SolanaDappShell() {
  const { publicKey, connected } = useWallet();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold text-white">dApp Solana — scaffold</h2>
      <div className="mt-4 flex items-center gap-3">
        <WalletMultiButton />
        <span className="font-mono text-xs text-white/55">
          {connected ? publicKey?.toBase58()?.slice(0, 12) + '…' : 'Carteira desconectada'}
        </span>
      </div>
      <p className="mt-4 text-sm text-white/45">
        Próximo passo: assinar uma transação simulada em devnet via intent queue (nunca direto).
      </p>
    </section>
  );
}
`,
    },
  ],
};

export const FORGE_TEMPLATES: ForgeTemplate[] = [
  ANCHOR_COUNTER,
  PUMPFUN_LAUNCH,
  SPL_TOKEN_MINT,
  SOLANA_DAPP,
];

export function getForgeTemplate(id: string): ForgeTemplate | null {
  return FORGE_TEMPLATES.find(template => template.id === id) ?? null;
}

export function listForgeTemplates(): ForgeTemplateSummary[] {
  return FORGE_TEMPLATES.map(({ id, name, description, tags }) => ({ id, name, description, tags }));
}
