use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::JarError;
use crate::events::CreateJarEvent;
use crate::state::{Asset, Config, Jar, JarStatus, JarType, UserState};

#[derive(Accounts)]
#[instruction(jar_type: JarType, asset: Asset)]
pub struct CreateJar<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [USER_STATE_SEED, owner.key().as_ref()],
        bump = user_state.bump,
        has_one = owner,
    )]
    pub user_state: Account<'info, UserState>,

    #[account(
        init,
        payer = owner,
        space = Jar::SIZE,
        seeds = [JAR_SEED, owner.key().as_ref(), &user_state.jar_count.to_le_bytes()],
        bump
    )]
    pub jar: Account<'info, Jar>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = vault_mint,
        associated_token::authority = jar,
    )]
    pub jar_vault: Option<Account<'info, TokenAccount>>,

    pub vault_mint: Option<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: PDA holding treasury lamports.
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateJar<'info>>,
    jar_type: JarType,
    asset: Asset,
    goal_amount: u64,
    unlock_timestamp: i64,
    metadata_uri: String,
    metadata_hash: [u8; 32],
    auto_stake: bool,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, JarError::Paused);
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        JarError::MetadataUriTooLong
    );

    let clock = Clock::get()?;
    match jar_type {
        JarType::Flexible => {
            require!(unlock_timestamp == 0, JarError::UnlockNotAllowed);
        }
        JarType::TimeLocked => {
            require!(unlock_timestamp > clock.unix_timestamp, JarError::UnlockInPast);
            require!(
                unlock_timestamp - clock.unix_timestamp <= MAX_TIMELOCK_DURATION_SECS,
                JarError::UnlockTooFar
            );
        }
    }

    let jar_mint = match asset {
        Asset::Sol => {
            require!(
                ctx.accounts.jar_vault.is_none() && ctx.accounts.vault_mint.is_none(),
                JarError::WrongAsset
            );
            Pubkey::default()
        }
        Asset::Usdc => {
            require!(
                ctx.accounts.jar_vault.is_some() && ctx.accounts.vault_mint.is_some(),
                JarError::WrongAsset
            );
            let supplied_mint = ctx.accounts.vault_mint.as_ref().unwrap().key();
            require!(
                ctx.accounts.config.allowed_usdc_mint != Pubkey::default()
                    && supplied_mint == ctx.accounts.config.allowed_usdc_mint,
                JarError::DisallowedUsdcMint
            );
            supplied_mint
        }
    };

    let fee = ctx.accounts.config.creation_fee_lamports;
    if ctx.accounts.config.fee_enabled && fee > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fee)?;
    }

    let jar_id = ctx.accounts.user_state.jar_count;

    let jar = &mut ctx.accounts.jar;
    jar.version = STATE_VERSION;
    jar.owner = ctx.accounts.owner.key();
    jar.id = jar_id;
    jar.jar_type = jar_type;
    jar.asset = asset;
    jar.mint = jar_mint;
    jar.goal_amount = goal_amount;
    jar.unlock_timestamp = unlock_timestamp;
    jar.total_contributed = 0;
    jar.total_contributors = 0;
    jar.metadata_uri = metadata_uri.clone();
    jar.metadata_hash = metadata_hash;
    jar.status = JarStatus::Active;
    jar.created_at = clock.unix_timestamp;
    jar.bump = ctx.bumps.jar;

    jar.auto_stake = auto_stake;
    jar.principal_total = 0;
    jar.shares_total = 0;
    jar.marginfi_account = Pubkey::default();
    jar.stake_protocol = 0;

    if auto_stake {
        require!(ctx.accounts.config.auto_stake_enabled, JarError::AutoStakeDisabled);

        match jar.asset {
            Asset::Usdc => {
                jar.stake_protocol = 1;
                require_keys_eq!(jar.mint, ctx.accounts.config.allowed_usdc_mint, JarError::AutoStakeMintMismatch);

                // remaining_accounts expected order:
                // [0] marginfi_program, [1] marginfi_group, [2] marginfi_account (PDA), [3] system_program
                let rem = &ctx.remaining_accounts;
                require!(rem.len() >= 4, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[0].key, ctx.accounts.config.marginfi_program, JarError::MarginFiAccountMismatch);
                require_keys_eq!(*rem[1].key, ctx.accounts.config.marginfi_group, JarError::MarginFiAccountMismatch);

                let owner_key = jar.owner;
                let jar_id_bytes = jar.id.to_le_bytes();
                let jar_bump = jar.bump;
                let jar_key = jar.key();
                let jar_seeds: &[&[u8]] = &[
                    JAR_SEED,
                    owner_key.as_ref(),
                    &jar_id_bytes,
                    std::slice::from_ref(&jar_bump),
                ];

                let (expected_mfi_acc, mfi_bump) = Pubkey::find_program_address(
                    &[b"marginfi", jar_key.as_ref()],
                    ctx.program_id,
                );
                require_keys_eq!(*rem[2].key, expected_mfi_acc, JarError::MarginFiAccountMismatch);
                let mfi_bump_arr = [mfi_bump];
                let mfi_acc_seeds: &[&[u8]] = &[b"marginfi", jar_key.as_ref(), &mfi_bump_arr];

                crate::marginfi::account_initialize(
                    &crate::marginfi::InitializeAccounts {
                        marginfi_program: rem[0].clone(),
                        marginfi_group: rem[1].clone(),
                        marginfi_account: rem[2].clone(),
                        authority: jar.to_account_info(),
                        fee_payer: ctx.accounts.owner.to_account_info(),
                        system_program: rem[3].clone(),
                    },
                    &[jar_seeds, mfi_acc_seeds],
                )?;

                jar.marginfi_account = expected_mfi_acc;
            }
            Asset::Sol => {
                jar.stake_protocol = 2;
                require!(matches!(jar_type, JarType::TimeLocked), JarError::AutoStakeRequiresTimeLocked);
                let min_lock_secs = (ctx.accounts.config.min_auto_stake_lock_days as i64)
                    .checked_mul(86_400)
                    .ok_or(JarError::Overflow)?;
                let lock_secs = unlock_timestamp
                    .checked_sub(clock.unix_timestamp)
                    .ok_or(JarError::Overflow)?;
                require!(lock_secs >= min_lock_secs, JarError::AutoStakeLockTooShort);
                // No CPI here — the client pre-creates the jar mSOL ATA in this tx.
            }
        }
    }

    ctx.accounts.user_state.jar_count = ctx
        .accounts
        .user_state
        .jar_count
        .checked_add(1)
        .ok_or(JarError::Overflow)?;

    emit!(CreateJarEvent {
        jar: jar.key(),
        owner: jar.owner,
        jar_type: jar_type as u8,
        asset: asset as u8,
        mint: jar_mint,
        goal_amount,
        unlock_timestamp,
        metadata_uri,
        metadata_hash,
        created_at: jar.created_at,
    });

    Ok(())
}
