// NOTE: jar.marginfi_account is left in place after close_jar. MarginFi v2 has no
// public close-account instruction at time of writing; rent (~0.001 SOL) stays parked
// at the marginfi_account address. Revisit if MarginFi adds a close ix.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::JarError;
use crate::events::CloseJarEvent;
use crate::state::{Asset, Jar, JarStatus};

#[derive(Accounts)]
pub struct CloseJar<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ JarError::NotOwner,
        close = owner,
    )]
    pub jar: Account<'info, Jar>,

    #[account(
        mut,
        associated_token::mint = jar.mint,
        associated_token::authority = jar,
    )]
    pub jar_vault: Option<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = jar.mint,
        token::authority = owner,
    )]
    pub owner_token_account: Option<Account<'info, TokenAccount>>,

    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseJar<'info>>,
) -> Result<()> {
    let jar = &ctx.accounts.jar;
    let terminal = matches!(jar.status, JarStatus::Withdrawn | JarStatus::Cancelled)
        && jar.total_contributors == 0;
    require!(terminal, JarError::CloseNotAllowed);

    match jar.asset {
        Asset::Usdc => {
            let vault = ctx.accounts.jar_vault.as_ref().ok_or(JarError::WrongAsset)?;
            let token_program = ctx.accounts.token_program.as_ref().ok_or(JarError::WrongAsset)?;

            let bump = jar.bump;
            let id_bytes = jar.id.to_le_bytes();
            let owner_key = jar.owner;
            let seeds: &[&[u8]] = &[JAR_SEED, owner_key.as_ref(), id_bytes.as_ref(), &[bump]];
            let signer = &[&seeds[..]];

            if vault.amount > 0 {
                let owner_ta = ctx.accounts.owner_token_account.as_ref().ok_or(JarError::WrongAsset)?;
                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        Transfer {
                            from: vault.to_account_info(),
                            to: owner_ta.to_account_info(),
                            authority: jar.to_account_info(),
                        },
                        signer,
                    ),
                    vault.amount,
                )?;
            }

            token::close_account(CpiContext::new_with_signer(
                token_program.to_account_info(),
                CloseAccount {
                    account: vault.to_account_info(),
                    destination: ctx.accounts.owner.to_account_info(),
                    authority: jar.to_account_info(),
                },
                signer,
            ))?;
        }
        Asset::Sol => {
            // Marinade jar: close jar mSOL ATA via remaining_accounts.
            //
            // remaining_accounts layout:
            //   [0] jar_msol_ata (mut)  — must exist; balance may be 0 or dust
            //   [1] token_program       — SPL Token program
            //
            // Optionally, if mSOL dust remains (e.g. rounding from a partial unstake):
            //   [2] marinade_program
            //   [3] marinade_state
            //   [4] msol_mint
            //   [5] liq_pool_sol_leg_pda
            //   [6] liq_pool_msol_leg
            //   [7] treasury_msol_account
            //
            // The client passes 2 accounts (no dust → just close) or 8 (dust → unstake then close).
            //
            // Plain SOL jars (no auto_stake) just skip the entire branch — no ATA to close.
            if jar.auto_stake && jar.stake_protocol == 2 {
                let rem = &ctx.remaining_accounts;
                require!(rem.len() >= 2, JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[1].key, anchor_spl::token::ID, JarError::MarinadeAccountMismatch);

                let dust = crate::marinade::read_token_amount(&rem[0])?;

                let bump = jar.bump;
                let id_bytes = jar.id.to_le_bytes();
                let owner_key = jar.owner;
                let seeds: &[&[u8]] = &[JAR_SEED, owner_key.as_ref(), id_bytes.as_ref(), &[bump]];
                let signer = &[&seeds[..]];

                if dust > 0 {
                    require!(rem.len() >= 8, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[2].key, crate::marinade::MARINADE_PROGRAM_ID, JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[3].key, crate::marinade::MARINADE_STATE,      JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[4].key, crate::marinade::MSOL_MINT,           JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[5].key, crate::marinade::LIQ_POOL_SOL_LEG_PDA,JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[6].key, crate::marinade::LIQ_POOL_MSOL_LEG,   JarError::MarinadeAccountMismatch);
                    require_keys_eq!(*rem[7].key, crate::marinade::TREASURY_MSOL_ACCOUNT, JarError::MarinadeAccountMismatch);

                    crate::marinade::liquid_unstake(
                        &crate::marinade::LiquidUnstakeAccounts {
                            marinade_program:        rem[2].clone(),
                            state:                   rem[3].clone(),
                            msol_mint:               rem[4].clone(),
                            liq_pool_sol_leg_pda:    rem[5].clone(),
                            liq_pool_msol_leg:       rem[6].clone(),
                            treasury_msol_account:   rem[7].clone(),
                            get_msol_from:           rem[0].clone(),
                            get_msol_from_authority: jar.to_account_info(),
                            transfer_sol_to:         ctx.accounts.owner.to_account_info(),
                            system_program:          ctx.accounts.system_program.to_account_info(),
                            token_program:           rem[1].clone(),
                        },
                        dust,
                        signer,
                    )?;
                }

                // Close the (now zero-balance) ATA.
                token::close_account(CpiContext::new_with_signer(
                    rem[1].clone(),
                    CloseAccount {
                        account: rem[0].clone(),
                        destination: ctx.accounts.owner.to_account_info(),
                        authority: jar.to_account_info(),
                    },
                    signer,
                ))?;
            }
            // else: plain SOL jar — no ATA to close. SOL refund + jar close handles the rest.
        }
    }

    let clock = Clock::get()?;
    emit!(CloseJarEvent {
        jar: jar.key(),
        owner: jar.owner,
        ts: clock.unix_timestamp,
    });
    Ok(())
}
