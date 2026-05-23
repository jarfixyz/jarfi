use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::JarError;
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Config::SIZE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: PDA, no data deserialization — holds lamports as treasury.
    #[account(
        seeds = [TREASURY_SEED],
        bump
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    creation_fee_lamports: u64,
    withdraw_fee_bps: u16,
    allowed_usdc_mint: Pubkey,
) -> Result<()> {
    require!(withdraw_fee_bps <= MAX_WITHDRAW_FEE_BPS, JarError::FeeTooHigh);
    require!(
        creation_fee_lamports <= MAX_CREATION_FEE_LAMPORTS,
        JarError::CreationFeeTooHigh
    );

    let config = &mut ctx.accounts.config;
    config.version = STATE_VERSION;
    config.admin = ctx.accounts.admin.key();
    config.pending_admin = None;
    config.treasury_bump = ctx.bumps.treasury;
    config.creation_fee_lamports = creation_fee_lamports;
    config.withdraw_fee_bps = withdraw_fee_bps;
    config.fee_enabled = true;
    config.paused = false;
    config.bump = ctx.bumps.config;
    config.allowed_usdc_mint = allowed_usdc_mint;

    config.auto_stake_enabled = false;
    config.marginfi_program = Pubkey::default();
    config.marginfi_group = Pubkey::default();
    config.marginfi_usdc_bank = Pubkey::default();
    config.min_auto_stake_lock_days = DEFAULT_MIN_AUTO_STAKE_LOCK_DAYS;

    Ok(())
}
