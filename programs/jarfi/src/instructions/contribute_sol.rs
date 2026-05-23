use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::JarError;
use crate::events::ContributeEvent;
use crate::state::{Asset, Config, Contribution, Jar, JarStatus};

#[derive(Accounts)]
pub struct ContributeSol<'info> {
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

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ContributeSol<'info>>,
    amount: u64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, JarError::Paused);
    require!(amount > 0, JarError::ZeroAmount);

    let jar = &mut ctx.accounts.jar;
    require!(matches!(jar.asset, Asset::Sol), JarError::WrongAsset);
    require!(matches!(jar.status, JarStatus::Active), JarError::JarNotActive);

    let is_marinade = jar.auto_stake && jar.stake_protocol == 2;

    if !is_marinade {
        // Plain SOL jar: park donor SOL on jar PDA for the duration.
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.donor.to_account_info(),
                to: jar.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;
    }

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

    if is_marinade {
        // remaining_accounts (Marinade deposit_sol):
        // [0] marinade_program
        // [1] state
        // [2] msol_mint
        // [3] liq_pool_sol_leg_pda
        // [4] liq_pool_msol_leg
        // [5] liq_pool_msol_leg_authority
        // [6] reserve_pda
        // [7] msol_mint_authority
        // [8] jar mSOL ATA  (mint_to; jar-owned)
        // [9] token_program
        let rem = &ctx.remaining_accounts;
        require!(rem.len() >= 10, JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[0].key, crate::marinade::MARINADE_PROGRAM_ID, JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[1].key, crate::marinade::MARINADE_STATE,      JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[2].key, crate::marinade::MSOL_MINT,           JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[3].key, crate::marinade::LIQ_POOL_SOL_LEG_PDA, JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[4].key, crate::marinade::LIQ_POOL_MSOL_LEG,    JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[5].key, crate::marinade::LIQ_POOL_MSOL_LEG_AUTH, JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[6].key, crate::marinade::RESERVE_PDA,         JarError::MarinadeAccountMismatch);
        require_keys_eq!(*rem[7].key, crate::marinade::MSOL_MINT_AUTHORITY, JarError::MarinadeAccountMismatch);
        // rem[8] = jar mSOL ATA — validated by being writable target of mint_to;
        //         Marinade itself rejects a mismatch on the SPL mint check.
        require_keys_eq!(*rem[9].key, anchor_spl::token::ID, JarError::MarinadeAccountMismatch);

        let before = crate::marinade::read_token_amount(&rem[8])?;

        crate::marinade::deposit_sol(
            &crate::marinade::DepositSolAccounts {
                marinade_program:            rem[0].clone(),
                state:                       rem[1].clone(),
                msol_mint:                   rem[2].clone(),
                liq_pool_sol_leg_pda:        rem[3].clone(),
                liq_pool_msol_leg:           rem[4].clone(),
                liq_pool_msol_leg_authority: rem[5].clone(),
                reserve_pda:                 rem[6].clone(),
                transfer_from:               ctx.accounts.donor.to_account_info(),
                mint_to:                     rem[8].clone(),
                msol_mint_authority:         rem[7].clone(),
                system_program:              ctx.accounts.system_program.to_account_info(),
                token_program:               rem[9].clone(),
            },
            amount,
            &[],
        )?;

        let after = crate::marinade::read_token_amount(&rem[8])?;
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
