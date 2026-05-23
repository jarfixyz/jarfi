use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::JarError;
use crate::events::ContributeEvent;
use crate::state::{Asset, Config, Contribution, Jar, JarStatus};

#[derive(Accounts)]
pub struct ContributeSpl<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(mut)]
    pub jar: Account<'info, Jar>,

    #[account(
        init_if_needed,
        payer = donor,
        space = Contribution::SIZE,
        seeds = [CONTRIBUTION_SEED, jar.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        token::mint = jar.mint,
        token::authority = donor,
    )]
    pub donor_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = jar.mint,
        associated_token::authority = jar,
    )]
    pub jar_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ContributeSpl<'info>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, JarError::ZeroAmount);
    require!(!ctx.accounts.config.paused, JarError::Paused);

    let jar = &mut ctx.accounts.jar;
    require!(matches!(jar.asset, Asset::Usdc), JarError::WrongAsset);
    require!(matches!(jar.status, JarStatus::Active), JarError::JarNotActive);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.donor_token_account.to_account_info(),
            to: ctx.accounts.jar_vault.to_account_info(),
            authority: ctx.accounts.donor.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    let clock = Clock::get()?;
    let contribution = &mut ctx.accounts.contribution;
    let is_first = contribution.amount == 0 && !contribution.refunded && contribution.version == 0;

    if is_first {
        contribution.version = STATE_VERSION;
        contribution.jar = jar.key();
        contribution.donor = ctx.accounts.donor.key();
        contribution.first_contributed_at = clock.unix_timestamp;
        contribution.bump = ctx.bumps.contribution;
        contribution.refunded = false;
        jar.total_contributors = jar
            .total_contributors
            .checked_add(1)
            .ok_or(JarError::Overflow)?;
    }

    contribution.amount = contribution
        .amount
        .checked_add(amount)
        .ok_or(JarError::Overflow)?;
    contribution.last_contributed_at = clock.unix_timestamp;

    jar.total_contributed = jar
        .total_contributed
        .checked_add(amount)
        .ok_or(JarError::Overflow)?;
    jar.principal_total = jar
        .principal_total
        .checked_add(amount)
        .ok_or(JarError::Overflow)?;

    let mut shares_delta: u64 = 0;

    if jar.auto_stake {
        // remaining_accounts:
        // [0] marginfi_program, [1] marginfi_group, [2] marginfi_account,
        // [3] usdc_bank, [4] bank_liquidity_vault
        let rem = &ctx.remaining_accounts;
        require!(rem.len() >= 5, JarError::MarginFiAccountMismatch);
        let cfg = &ctx.accounts.config;
        require_keys_eq!(*rem[0].key, cfg.marginfi_program, JarError::MarginFiAccountMismatch);
        require_keys_eq!(*rem[1].key, cfg.marginfi_group, JarError::MarginFiAccountMismatch);
        require_keys_eq!(*rem[2].key, jar.marginfi_account, JarError::MarginFiAccountMismatch);
        require_keys_eq!(*rem[3].key, cfg.marginfi_usdc_bank, JarError::MarginFiAccountMismatch);

        let before = crate::marginfi::read_asset_shares_u64(&rem[2], &cfg.marginfi_usdc_bank)?;

        let owner_key = jar.owner;
        let jar_id_bytes = jar.id.to_le_bytes();
        let jar_bump = jar.bump;
        let signer_seeds: &[&[u8]] = &[
            JAR_SEED,
            owner_key.as_ref(),
            &jar_id_bytes,
            std::slice::from_ref(&jar_bump),
        ];

        crate::marginfi::deposit(
            &crate::marginfi::DepositAccounts {
                marginfi_program: rem[0].clone(),
                marginfi_group: rem[1].clone(),
                marginfi_account: rem[2].clone(),
                authority: jar.to_account_info(),
                bank: rem[3].clone(),
                signer_token_account: ctx.accounts.jar_vault.to_account_info(),
                bank_liquidity_vault: rem[4].clone(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            amount,
            &[signer_seeds],
        )?;

        let after = crate::marginfi::read_asset_shares_u64(&rem[2], &cfg.marginfi_usdc_bank)?;
        shares_delta = after.checked_sub(before).ok_or(JarError::Overflow)?;
        contribution.shares = contribution
            .shares
            .checked_add(shares_delta)
            .ok_or(JarError::Overflow)?;
        jar.shares_total = jar
            .shares_total
            .checked_add(shares_delta)
            .ok_or(JarError::Overflow)?;
    }

    emit!(ContributeEvent {
        jar: jar.key(),
        donor: contribution.donor,
        amount_delta: amount,
        total_after: jar.total_contributed,
        contributors_after: jar.total_contributors,
        is_first,
        ts: clock.unix_timestamp,
        shares_delta,
    });

    Ok(())
}
