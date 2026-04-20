use anchor_lang::prelude::*;

declare_id!("9eBY2Tezy2z2nYqUBHzDitQRDnMbPuHYz8qj25fTWCPD");

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const MAX_LABEL_LEN: usize = 64;
const MAX_RECORDS: u16 = 1_000;

// ─────────────────────────────────────────────
//  PROGRAM
// ─────────────────────────────────────────────
#[program]
pub mod cognchain {
    use super::*;

    /// Instruction 1 — Create a memory vault for the signer.
    /// One vault per user (PDA seed: ["vault", user]).
    pub fn create_vault(ctx: Context<CreateVault>, label: String) -> Result<()> {
        require!(label.len() <= MAX_LABEL_LEN, CognError::LabelTooLong);

        let vault = &mut ctx.accounts.vault;
        vault.authority   = ctx.accounts.authority.key();
        vault.label       = label;
        vault.record_count = 0;
        vault.bump        = ctx.bumps.vault;
        vault.created_at  = Clock::get()?.unix_timestamp;

        emit!(VaultCreated {
            authority: vault.authority,
            label:     vault.label.clone(),
        });

        Ok(())
    }

    /// Instruction 2 — Write a memory record into the vault.
    /// Each record is its own PDA (seed: ["record", vault, id]).
    pub fn write_memory(
        ctx:          Context<WriteMemory>,
        content_hash: [u8; 32],
        summary_hash: [u8; 32],
        importance:   u16,       // 0–10_000 bps
        agent_type:   u8,        // 0=Claude 1=GPT 2=Gemini 254=Custom
    ) -> Result<()> {
        require!(importance <= 10_000, CognError::InvalidImportance);

        let vault  = &mut ctx.accounts.vault;
        let record = &mut ctx.accounts.record;

        require!(vault.record_count < MAX_RECORDS, CognError::VaultFull);

        let id = vault.record_count;

        record.vault        = vault.key();
        record.id           = id;
        record.authority    = ctx.accounts.authority.key();
        record.content_hash = content_hash;
        record.summary_hash = summary_hash;
        record.importance   = importance;
        record.agent_type   = agent_type;
        record.bump         = ctx.bumps.record;
        record.created_at   = Clock::get()?.unix_timestamp;

        vault.record_count  = vault.record_count.checked_add(1)
            .ok_or(CognError::VaultFull)?;

        emit!(MemoryWritten {
            vault:        vault.key(),
            record_id:    id,
            content_hash,
            importance,
        });

        Ok(())
    }

    /// Instruction 3 — Read / verify a memory record (no-op on-chain,
    /// emits an event so off-chain indexers can react).
    pub fn read_memory(ctx: Context<ReadMemory>) -> Result<()> {
        let record = &ctx.accounts.record;

        emit!(MemoryRead {
            vault:        record.vault,
            record_id:    record.id,
            content_hash: record.content_hash,
            importance:   record.importance,
            read_at:      Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ─────────────────────────────────────────────
//  ACCOUNTS
// ─────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(label: String)]
pub struct CreateVault<'info> {
    #[account(
        init,
        payer  = authority,
        space  = Vault::SIZE,
        seeds  = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WriteMemory<'info> {
    #[account(
        mut,
        seeds  = [b"vault", authority.key().as_ref()],
        bump   = vault.bump,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer  = authority,
        space  = MemoryRecord::SIZE,
        seeds  = [b"record", vault.key().as_ref(), vault.record_count.to_le_bytes().as_ref()],
        bump
    )]
    pub record: Account<'info, MemoryRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct ReadMemory<'info> {
    #[account(
        seeds  = [b"vault", authority.key().as_ref()],
        bump   = vault.bump,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: record.vault is verified via constraint below
    #[account(
        constraint = record.vault == vault.key() @ CognError::WrongVault
    )]
    pub record: Account<'info, MemoryRecord>,

    pub authority: Signer<'info>,
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

#[account]
pub struct Vault {
    pub authority:    Pubkey,   // 32
    pub label:        String,   // 4 + 64
    pub record_count: u16,      // 2
    pub bump:         u8,       // 1
    pub created_at:   i64,      // 8
}

impl Vault {
    // discriminator(8) + authority(32) + label(4+64) + record_count(2) + bump(1) + created_at(8)
    pub const SIZE: usize = 8 + 32 + (4 + MAX_LABEL_LEN) + 2 + 1 + 8;
}

#[account]
pub struct MemoryRecord {
    pub vault:        Pubkey,   // 32
    pub id:           u16,      // 2
    pub authority:    Pubkey,   // 32
    pub content_hash: [u8; 32], // 32
    pub summary_hash: [u8; 32], // 32
    pub importance:   u16,      // 2
    pub agent_type:   u8,       // 1
    pub bump:         u8,       // 1
    pub created_at:   i64,      // 8
}

impl MemoryRecord {
    // discriminator(8) + vault(32) + id(2) + authority(32) + content_hash(32)
    // + summary_hash(32) + importance(2) + agent_type(1) + bump(1) + created_at(8)
    pub const SIZE: usize = 8 + 32 + 2 + 32 + 32 + 32 + 2 + 1 + 1 + 8;
}

// ─────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────

#[event]
pub struct VaultCreated {
    pub authority: Pubkey,
    pub label:     String,
}

#[event]
pub struct MemoryWritten {
    pub vault:        Pubkey,
    pub record_id:    u16,
    pub content_hash: [u8; 32],
    pub importance:   u16,
}

#[event]
pub struct MemoryRead {
    pub vault:        Pubkey,
    pub record_id:    u16,
    pub content_hash: [u8; 32],
    pub importance:   u16,
    pub read_at:      i64,
}

// ─────────────────────────────────────────────
//  ERRORS
// ─────────────────────────────────────────────

#[error_code]
pub enum CognError {
    #[msg("Label exceeds 64 characters.")]
    LabelTooLong,
    #[msg("Importance must be between 0 and 10000 bps.")]
    InvalidImportance,
    #[msg("Vault has reached the maximum number of records.")]
    VaultFull,
    #[msg("Record does not belong to this vault.")]
    WrongVault,
}
