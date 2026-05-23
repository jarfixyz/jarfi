use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub version: u8,
    pub admin: Pubkey,
    pub pending_admin: Option<Pubkey>,
    pub treasury_bump: u8,
    pub creation_fee_lamports: u64,
    pub withdraw_fee_bps: u16,
    pub fee_enabled: bool,
    pub paused: bool,
    pub bump: u8,
    pub allowed_usdc_mint: Pubkey,

    // Auto-stake (MarginFi USDC)
    pub auto_stake_enabled: bool,
    pub marginfi_program: Pubkey,
    pub marginfi_group: Pubkey,
    pub marginfi_usdc_bank: Pubkey,

    // Marinade SOL auto-stake — gate threshold (TimeLocked-only requirement).
    pub min_auto_stake_lock_days: u16,
}

impl Config {
    pub const SIZE: usize = 8
        + 1
        + 32
        + 1 + 32
        + 1
        + 8
        + 2
        + 1
        + 1
        + 1
        + 32
        + 1               // auto_stake_enabled
        + 32              // marginfi_program
        + 32              // marginfi_group
        + 32              // marginfi_usdc_bank
        + 2;              // min_auto_stake_lock_days
}
