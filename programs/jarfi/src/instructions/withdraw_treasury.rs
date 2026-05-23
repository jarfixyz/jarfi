use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::{CONFIG_SEED, TREASURY_SEED};
use crate::errors::JarError;
use crate::events::TreasuryWithdrawEvent;
use crate::state::Config;

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ JarError::NotAdmin,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: PDA treasury, seeds validated
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: destination receives lamports.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, JarError::Paused);
    require!(amount > 0, JarError::ZeroAmount);

    require!(
        ctx.accounts.treasury.lamports() >= amount,
        JarError::InsufficientBalance
    );

    let treasury_bump = ctx.accounts.config.treasury_bump;
    let seeds: &[&[u8]] = &[TREASURY_SEED, &[treasury_bump]];
    let signer = &[&seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    emit!(TreasuryWithdrawEvent {
        admin: ctx.accounts.admin.key(),
        destination: ctx.accounts.destination.key(),
        amount,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
