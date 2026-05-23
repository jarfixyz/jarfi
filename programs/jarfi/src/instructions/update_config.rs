use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::JarError;
use crate::events::ConfigUpdatedEvent;
use crate::state::Config;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ JarError::NotAdmin,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    new_creation_fee: Option<u64>,
    new_withdraw_fee_bps: Option<u16>,
    fee_enabled: Option<bool>,
    paused: Option<bool>,
    new_allowed_usdc_mint: Option<Pubkey>,
    new_min_auto_stake_lock_days: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(fee) = new_creation_fee {
        require!(fee <= MAX_CREATION_FEE_LAMPORTS, JarError::CreationFeeTooHigh);
        config.creation_fee_lamports = fee;
    }
    if let Some(bps) = new_withdraw_fee_bps {
        require!(bps <= MAX_WITHDRAW_FEE_BPS, JarError::FeeTooHigh);
        config.withdraw_fee_bps = bps;
    }
    if let Some(enabled) = fee_enabled {
        config.fee_enabled = enabled;
    }
    if let Some(p) = paused {
        config.paused = p;
    }
    if let Some(mint) = new_allowed_usdc_mint {
        config.allowed_usdc_mint = mint;
    }
    if let Some(days) = new_min_auto_stake_lock_days {
        config.min_auto_stake_lock_days = days;
    }

    emit!(ConfigUpdatedEvent {
        admin: config.admin,
        creation_fee_lamports: config.creation_fee_lamports,
        withdraw_fee_bps: config.withdraw_fee_bps,
        fee_enabled: config.fee_enabled,
        paused: config.paused,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateMarginFiConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ JarError::NotAdmin,
    )]
    pub config: Account<'info, Config>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MarginFiConfigArgs {
    pub auto_stake_enabled: bool,
    pub marginfi_program: Pubkey,
    pub marginfi_group: Pubkey,
    pub marginfi_usdc_bank: Pubkey,
}

pub fn handle_update_marginfi_config(
    ctx: Context<UpdateMarginFiConfig>,
    args: MarginFiConfigArgs,
) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.auto_stake_enabled = args.auto_stake_enabled;
    c.marginfi_program = args.marginfi_program;
    c.marginfi_group = args.marginfi_group;
    c.marginfi_usdc_bank = args.marginfi_usdc_bank;
    Ok(())
}
