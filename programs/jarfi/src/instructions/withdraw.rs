use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::*;
use crate::errors::JarError;
use crate::events::WithdrawEvent;
use crate::state::{Asset, Config, Jar, JarStatus, JarType};

// Token accounts are declared as `UncheckedAccount` rather than
// `Option<Account<TokenAccount>>`. Anchor's expansion of `associated_token::*`
// constraints on optional typed accounts calls `find_program_address` for each
// constraint even when the account is None, which exhausts the BPF bump
// allocator (heap never shrinks) and OOMs on SOL-path withdraws. We validate
// the SPL accounts manually inside the USDC branch only.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ JarError::NotOwner,
    )]
    pub jar: Account<'info, Jar>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: treasury PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: validated manually in the USDC branch; unused for SOL.
    #[account(mut)]
    pub jar_vault: Option<UncheckedAccount<'info>>,

    /// CHECK: validated manually in the USDC branch; unused for SOL.
    #[account(mut)]
    pub owner_token_account: Option<UncheckedAccount<'info>>,

    /// CHECK: validated manually in the USDC branch; unused for SOL.
    #[account(mut)]
    pub treasury_token_account: Option<UncheckedAccount<'info>>,

    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    amount: Option<u64>,
) -> Result<()> {
    let clock = Clock::get()?;

    {
        let jar = &ctx.accounts.jar;
        require!(matches!(jar.status, JarStatus::Active), JarError::JarNotActive);
        if matches!(jar.jar_type, JarType::TimeLocked) {
            require!(clock.unix_timestamp >= jar.unlock_timestamp, JarError::StillLocked);
        }
    }

    let mut shares_redeemed: u64 = 0;
    if ctx.accounts.jar.auto_stake {
        match ctx.accounts.jar.stake_protocol {
            1 => {
                // ─── MarginFi/USDC (existing path, byte-identical) ─────────────
                let rem = &ctx.remaining_accounts;
                require!(rem.len() >= 6, JarError::MarginFiAccountMismatch);
                let cfg = &ctx.accounts.config;
                require_keys_eq!(*rem[0].key, cfg.marginfi_program, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[1].key, cfg.marginfi_group, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[2].key, ctx.accounts.jar.marginfi_account, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[3].key, cfg.marginfi_usdc_bank, JarError::MarginFiAccountMismatch);

                let token_program = ctx.accounts.token_program.as_ref().ok_or(JarError::WrongAsset)?;
                let vault = ctx.accounts.jar_vault.as_ref().ok_or(JarError::WrongAsset)?;

                shares_redeemed = ctx.accounts.jar.shares_total;

                let owner_key = ctx.accounts.jar.owner;
                let id_bytes = ctx.accounts.jar.id.to_le_bytes();
                let jar_bump = ctx.accounts.jar.bump;
                let signer_seeds: &[&[u8]] = &[
                    JAR_SEED,
                    owner_key.as_ref(),
                    id_bytes.as_ref(),
                    std::slice::from_ref(&jar_bump),
                ];

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
                    0,
                    true, // withdraw_all
                    &[signer_seeds],
                    &rem[6..],
                )?;
                ctx.accounts.jar.shares_total = 0;
                let vault_balance = token::accessor::amount(&vault.to_account_info())?;
                ctx.accounts.jar.total_contributed = vault_balance;
            }
            2 => {
                // ─── Marinade/SOL ──────────────────────────────────────────────
                let rem = &ctx.remaining_accounts;
                require!(rem.len() >= 8, JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[0].key, crate::marinade::MARINADE_PROGRAM_ID, JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[1].key, crate::marinade::MARINADE_STATE,      JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[2].key, crate::marinade::MSOL_MINT,           JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[3].key, crate::marinade::LIQ_POOL_SOL_LEG_PDA, JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[4].key, crate::marinade::LIQ_POOL_MSOL_LEG,    JarError::MarinadeAccountMismatch);
                require_keys_eq!(*rem[5].key, crate::marinade::TREASURY_MSOL_ACCOUNT, JarError::MarinadeAccountMismatch);
                // rem[6] = jar mSOL ATA — checked implicitly via Marinade's mint authority constraint.
                require_keys_eq!(*rem[7].key, anchor_spl::token::ID, JarError::MarinadeAccountMismatch);

                shares_redeemed = ctx.accounts.jar.shares_total;
                if shares_redeemed > 0 {
                    let owner_key = ctx.accounts.jar.owner;
                    let id_bytes = ctx.accounts.jar.id.to_le_bytes();
                    let jar_bump = ctx.accounts.jar.bump;
                    let signer_seeds: &[&[u8]] = &[
                        JAR_SEED,
                        owner_key.as_ref(),
                        id_bytes.as_ref(),
                        std::slice::from_ref(&jar_bump),
                    ];

                    let owner_before = ctx.accounts.owner.lamports();
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
                            transfer_sol_to:         ctx.accounts.owner.to_account_info(),
                            system_program:          ctx.accounts.system_program.to_account_info(),
                            token_program:           rem[7].clone(),
                        },
                        shares_redeemed,
                        &[signer_seeds],
                    )?;
                    let owner_after = ctx.accounts.owner.lamports();
                    let sol_out = owner_after.checked_sub(owner_before).ok_or(JarError::Overflow)?;
                    require!(sol_out > 0, JarError::InsufficientBalance);

                    let fee_bps = if ctx.accounts.config.fee_enabled {
                        ctx.accounts.config.withdraw_fee_bps as u64
                    } else {
                        0
                    };
                    let treasury_cut = sol_out.checked_mul(fee_bps).ok_or(JarError::Overflow)? / BPS_DENOMINATOR;
                    let net_to_owner = sol_out.checked_sub(treasury_cut).ok_or(JarError::Overflow)?;

                    if treasury_cut > 0 {
                        let cpi_ctx = CpiContext::new(
                            ctx.accounts.system_program.to_account_info(),
                            anchor_lang::system_program::Transfer {
                                from: ctx.accounts.owner.to_account_info(),
                                to: ctx.accounts.treasury.to_account_info(),
                            },
                        );
                        anchor_lang::system_program::transfer(cpi_ctx, treasury_cut)?;
                    }

                    ctx.accounts.jar.total_contributed = 0;
                    ctx.accounts.jar.shares_total = 0;
                    ctx.accounts.jar.status = JarStatus::Withdrawn;

                    let owner_pub = ctx.accounts.jar.owner;
                    emit!(WithdrawEvent {
                        jar: ctx.accounts.jar.key(),
                        owner: owner_pub,
                        amount: net_to_owner,
                        fee: treasury_cut,
                        ts: clock.unix_timestamp,
                        shares_redeemed,
                        gross_underlying: sol_out,
                        protocol: ctx.accounts.jar.stake_protocol,
                    });
                    return Ok(());
                }
                // shares_redeemed == 0: nothing to unstake; fall through to plain SOL payout
                // (the jar PDA has whatever SOL was directly sent or recovered).
            }
            _ => return err!(JarError::WrongAsset), // auto_stake with stake_protocol 0 is invalid state
        }
    }

    let current_balance = match ctx.accounts.jar.asset {
        Asset::Sol => {
            let rent = Rent::get()?;
            let min_rent = rent.minimum_balance(Jar::SIZE);
            let free = ctx
                .accounts
                .jar
                .to_account_info()
                .lamports()
                .saturating_sub(min_rent);
            free.min(ctx.accounts.jar.total_contributed)
        }
        Asset::Usdc => {
            let vault = ctx.accounts.jar_vault.as_ref().ok_or(JarError::WrongAsset)?;
            token::accessor::amount(&vault.to_account_info())?
                .min(ctx.accounts.jar.total_contributed)
        }
    };

    let gross = match amount {
        None => current_balance,
        Some(x) => {
            require!(x <= current_balance, JarError::InsufficientBalance);
            if matches!(ctx.accounts.jar.jar_type, JarType::TimeLocked) {
                require!(x == current_balance, JarError::PartialWithdrawNotAllowed);
            }
            x
        }
    };

    let fee_bps = if ctx.accounts.config.fee_enabled {
        ctx.accounts.config.withdraw_fee_bps as u64
    } else {
        0
    };
    let fee = gross.checked_mul(fee_bps).ok_or(JarError::Overflow)? / BPS_DENOMINATOR;
    let net = gross.checked_sub(fee).ok_or(JarError::Overflow)?;

    match ctx.accounts.jar.asset {
        Asset::Sol => {
            let jar_info = ctx.accounts.jar.to_account_info();
            let owner_info = ctx.accounts.owner.to_account_info();
            let treasury_info = ctx.accounts.treasury.to_account_info();

            **jar_info.try_borrow_mut_lamports()? = jar_info
                .lamports()
                .checked_sub(gross)
                .ok_or(JarError::InsufficientBalance)?;
            **owner_info.try_borrow_mut_lamports()? = owner_info
                .lamports()
                .checked_add(net)
                .ok_or(JarError::Overflow)?;
            if fee > 0 {
                **treasury_info.try_borrow_mut_lamports()? = treasury_info
                    .lamports()
                    .checked_add(fee)
                    .ok_or(JarError::Overflow)?;
            }
        }
        Asset::Usdc => {
            let bump = ctx.accounts.jar.bump;
            let id_bytes = ctx.accounts.jar.id.to_le_bytes();
            let owner_key = ctx.accounts.jar.owner;
            let jar_key = ctx.accounts.jar.key();
            let mint_key = ctx.accounts.jar.mint;
            let seeds: &[&[u8]] = &[
                JAR_SEED,
                owner_key.as_ref(),
                id_bytes.as_ref(),
                &[bump],
            ];
            let signer = &[&seeds[..]];

            let token_program = ctx.accounts.token_program.as_ref().ok_or(JarError::WrongAsset)?;
            let vault = ctx.accounts.jar_vault.as_ref().ok_or(JarError::WrongAsset)?;
            let owner_ta = ctx.accounts.owner_token_account.as_ref().ok_or(JarError::WrongAsset)?;

            // Manual validation (replaces Anchor's `associated_token::*` macros).
            let token_program_id = token_program.key();
            let expected_vault = get_associated_token_address(&jar_key, &mint_key);
            require_keys_eq!(vault.key(), expected_vault, JarError::WrongAsset);
            require_keys_eq!(*vault.owner, token_program_id, JarError::WrongAsset);
            require_keys_eq!(
                token::accessor::mint(&vault.to_account_info())?,
                mint_key,
                JarError::WrongAsset
            );

            let expected_owner_ta =
                get_associated_token_address(&ctx.accounts.owner.key(), &mint_key);
            require_keys_eq!(owner_ta.key(), expected_owner_ta, JarError::WrongAsset);
            require_keys_eq!(*owner_ta.owner, token_program_id, JarError::WrongAsset);
            require_keys_eq!(
                token::accessor::mint(&owner_ta.to_account_info())?,
                mint_key,
                JarError::WrongAsset
            );
            require_keys_eq!(
                token::accessor::authority(&owner_ta.to_account_info())?,
                ctx.accounts.owner.key(),
                JarError::WrongAsset
            );

            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: vault.to_account_info(),
                        to: owner_ta.to_account_info(),
                        authority: ctx.accounts.jar.to_account_info(),
                    },
                    signer,
                ),
                net,
            )?;

            if fee > 0 {
                let treasury_ta = ctx
                    .accounts
                    .treasury_token_account
                    .as_ref()
                    .ok_or(JarError::WrongAsset)?;
                let expected_treasury_ta =
                    get_associated_token_address(&ctx.accounts.treasury.key(), &mint_key);
                require_keys_eq!(treasury_ta.key(), expected_treasury_ta, JarError::WrongAsset);
                require_keys_eq!(*treasury_ta.owner, token_program_id, JarError::WrongAsset);

                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        Transfer {
                            from: vault.to_account_info(),
                            to: treasury_ta.to_account_info(),
                            authority: ctx.accounts.jar.to_account_info(),
                        },
                        signer,
                    ),
                    fee,
                )?;
            }
        }
    }

    ctx.accounts.jar.total_contributed = ctx
        .accounts
        .jar
        .total_contributed
        .saturating_sub(gross);

    if amount.is_none() || gross == current_balance {
        ctx.accounts.jar.status = JarStatus::Withdrawn;
    }

    let owner_pub = ctx.accounts.jar.owner;
    emit!(WithdrawEvent {
        jar: ctx.accounts.jar.key(),
        owner: owner_pub,
        amount: net,
        fee,
        ts: clock.unix_timestamp,
        gross_underlying: gross,
        shares_redeemed,
        protocol: ctx.accounts.jar.stake_protocol,
    });

    Ok(())
}
