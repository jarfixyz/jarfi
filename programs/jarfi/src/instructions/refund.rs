use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::JarError;
use crate::events::RefundEvent;
use crate::state::{Asset, Contribution, Jar, JarStatus};

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub jar: Account<'info, Jar>,

    /// CHECK: donor wallet receives refund / rent; must match contribution.donor.
    #[account(mut)]
    pub donor: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, jar.key().as_ref(), donor.key().as_ref()],
        bump = contribution.bump,
        close = donor,
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(
        mut,
        associated_token::mint = jar.mint,
        associated_token::authority = jar,
    )]
    pub jar_vault: Option<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = jar.mint,
        token::authority = donor,
    )]
    pub donor_token_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(ctx: Context<'_, '_, '_, 'info, Refund<'info>>) -> Result<()> {
    let clock = Clock::get()?;

    require!(
        matches!(ctx.accounts.jar.status, JarStatus::Cancelled),
        JarError::RefundNotAllowed
    );
    require!(!ctx.accounts.contribution.refunded, JarError::AlreadyRefunded);
    require!(ctx.accounts.contribution.amount > 0, JarError::AlreadyRefunded);
    require_keys_eq!(
        ctx.accounts.contribution.jar,
        ctx.accounts.jar.key(),
        JarError::ContributionJarMismatch
    );
    require_keys_eq!(
        ctx.accounts.contribution.donor,
        ctx.accounts.donor.key(),
        JarError::ContributionJarMismatch
    );

    let amount = ctx.accounts.contribution.amount;
    let mut payout: u64 = amount;
    let mut shares_redeemed: u64 = 0;

    match ctx.accounts.jar.asset {
        Asset::Sol => {
            let mut paid_via_marinade = false;
            if ctx.accounts.jar.auto_stake && ctx.accounts.jar.stake_protocol == 2 {
                let contribution_shares = ctx.accounts.contribution.shares;
                if contribution_shares > 0 {
                    let rem = &ctx.remaining_accounts;
                    require!(rem.len() >= 8, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[0].key, crate::marinade::MARINADE_PROGRAM_ID, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[1].key, crate::marinade::MARINADE_STATE,      JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[2].key, crate::marinade::MSOL_MINT,           JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[3].key, crate::marinade::LIQ_POOL_SOL_LEG_PDA, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[4].key, crate::marinade::LIQ_POOL_MSOL_LEG,    JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[5].key, crate::marinade::TREASURY_MSOL_ACCOUNT, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[7].key, anchor_spl::token::ID,                JarError::MarinadeAccountMismatch);

                    let owner_key = ctx.accounts.jar.owner;
                    let id_bytes = ctx.accounts.jar.id.to_le_bytes();
                    let jar_bump = ctx.accounts.jar.bump;
                    let signer_seeds: &[&[u8]] = &[
                        JAR_SEED,
                        owner_key.as_ref(),
                        id_bytes.as_ref(),
                        std::slice::from_ref(&jar_bump),
                    ];

                    let donor_before = ctx.accounts.donor.lamports();
                    crate::marinade::liquid_unstake(
                        &crate::marinade::LiquidUnstakeAccounts {
                            marinade_program:        rem[0].clone(),
                            state:                   rem[1].clone(),
                            msol_mint:               rem[2].clone(),
                            liq_pool_sol_leg_pda:    rem[3].clone(),
                            liq_pool_msol_leg:       rem[4].clone(),
                            treasury_msol_account:   rem[5].clone(),
                            get_msol_from:           rem[6].clone(),
                            get_msol_from_authority: ctx.accounts.jar.to_account_info(),
                            transfer_sol_to:         ctx.accounts.donor.to_account_info(),
                            system_program:          ctx.accounts.system_program.to_account_info(),
                            token_program:           rem[7].clone(),
                        },
                        contribution_shares,
                        &[signer_seeds],
                    )?;
                    let donor_after = ctx.accounts.donor.lamports();
                    payout = donor_after.checked_sub(donor_before).ok_or(JarError::Overflow)?;
                    require!(payout > 0, JarError::InsufficientBalance);
                    shares_redeemed = contribution_shares;

                    ctx.accounts.jar.shares_total = ctx.accounts.jar.shares_total
                        .checked_sub(contribution_shares).ok_or(JarError::SharesUnderflow)?;
                    paid_via_marinade = true;
                }
            }

            if !paid_via_marinade {
                // Non-Marinade SOL OR shares == 0 (cancel_jar pre-unstake already handled).
                let jar_info = ctx.accounts.jar.to_account_info();
                let donor_info = ctx.accounts.donor.to_account_info();
                **jar_info.try_borrow_mut_lamports()? = jar_info
                    .lamports()
                    .checked_sub(payout)
                    .ok_or(JarError::InsufficientBalance)?;
                **donor_info.try_borrow_mut_lamports()? = donor_info
                    .lamports()
                    .checked_add(payout)
                    .ok_or(JarError::Overflow)?;
            }
        }
        Asset::Usdc => {
            let bump = ctx.accounts.jar.bump;
            let id_bytes = ctx.accounts.jar.id.to_le_bytes();
            let owner_key = ctx.accounts.jar.owner;
            let seeds: &[&[u8]] = &[
                JAR_SEED,
                owner_key.as_ref(),
                id_bytes.as_ref(),
                &[bump],
            ];
            let signer = &[&seeds[..]];

            let token_program = ctx.accounts.token_program.as_ref().ok_or(JarError::WrongAsset)?;
            let vault = ctx.accounts.jar_vault.as_ref().ok_or(JarError::WrongAsset)?;
            let donor_ta = ctx.accounts.donor_token_account.as_ref().ok_or(JarError::WrongAsset)?;

            if ctx.accounts.jar.auto_stake {
                // remaining_accounts (same order as withdraw):
                // [0] marginfi_program, [1] marginfi_group, [2] marginfi_account,
                // [3] usdc_bank, [4] bank_liquidity_vault_authority, [5] bank_liquidity_vault
                let rem = &ctx.remaining_accounts;
                require!(rem.len() >= 6, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[2].key, ctx.accounts.jar.marginfi_account, JarError::MarginFiAccountMismatch);

                let contribution_shares = ctx.accounts.contribution.shares;

                let usdc_before = vault.amount;

                // Compute share-priced amount = (shares << 48) * asset_share_value_raw >> 96.
                let withdraw_amount: u64 = if contribution_shares == 0 {
                    0
                } else {
                    use std::convert::TryInto;
                    let bank_data = rem[3].try_borrow_data()?;
                    let raw_bytes: [u8; 16] = bank_data
                        [crate::marginfi::ASSET_SHARE_VALUE_OFFSET
                            ..crate::marginfi::ASSET_SHARE_VALUE_OFFSET + 16]
                        .try_into()
                        .map_err(|_| error!(JarError::MarginFiAccountMismatch))?;
                    let asset_share_value_raw = i128::from_le_bytes(raw_bytes);
                    drop(bank_data);
                    require!(asset_share_value_raw > 0, JarError::MarginFiAccountMismatch);

                    let shares_full = (contribution_shares as i128) << 48;
                    let product = shares_full
                        .checked_mul(asset_share_value_raw)
                        .ok_or(JarError::Overflow)?;
                    let amount_i128 = product >> 96;
                    if amount_i128 < 0 {
                        0
                    } else {
                        amount_i128.min(u64::MAX as i128) as u64
                    }
                };

                shares_redeemed = contribution_shares;

                if withdraw_amount > 0 {
                    crate::marginfi::withdraw(
                        &crate::marginfi::WithdrawAccounts {
                            marginfi_program: rem[0].clone(),
                            marginfi_group: rem[1].clone(),
                            marginfi_account: rem[2].clone(),
                            authority: ctx.accounts.jar.to_account_info(),
                            bank: rem[3].clone(),
                            destination_token_account: vault.to_account_info(),
                            bank_liquidity_vault_authority: rem[4].clone(),
                            bank_liquidity_vault: rem[5].clone(),
                            token_program: token_program.to_account_info(),
                        },
                        withdraw_amount,
                        false,
                        &[seeds],
                        &rem[6..],
                    )?;
                }

                // shares_total -= contribution.shares (saturating zero)
                ctx.accounts.jar.shares_total = ctx
                    .accounts
                    .jar
                    .shares_total
                    .checked_sub(contribution_shares)
                    .ok_or(JarError::SharesUnderflow)?;

                // Reload vault to get latest amount.
                let vault_after = {
                    let acct_info = vault.to_account_info();
                    token::accessor::amount(&acct_info)?
                };
                payout = vault_after
                    .checked_sub(usdc_before)
                    .ok_or(JarError::Overflow)?;
            }

            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: vault.to_account_info(),
                        to: donor_ta.to_account_info(),
                        authority: ctx.accounts.jar.to_account_info(),
                    },
                    signer,
                ),
                payout,
            )?;
        }
    }

    let jar = &mut ctx.accounts.jar;
    jar.total_contributed = jar
        .total_contributed
        .checked_sub(amount)
        .ok_or(JarError::Overflow)?;
    jar.total_contributors = jar
        .total_contributors
        .checked_sub(1)
        .ok_or(JarError::Overflow)?;
    jar.principal_total = jar
        .principal_total
        .checked_sub(amount)
        .ok_or(JarError::PrincipalUnderflow)?;

    emit!(RefundEvent {
        jar: jar.key(),
        donor: ctx.accounts.donor.key(),
        amount,
        ts: clock.unix_timestamp,
        gross_underlying: payout,
        shares_redeemed,
        protocol: jar.stake_protocol,
    });

    Ok(())
}
