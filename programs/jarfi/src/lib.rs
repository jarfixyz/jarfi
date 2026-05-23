use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod marginfi;
pub mod marinade;
pub mod state;

use instructions::*;

declare_id!("GBqqB8ZfNDPRyUZczbUxkmU3UopQ1BFMPu4sXGd115yF");

#[program]
pub mod jarfi {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        creation_fee_lamports: u64,
        withdraw_fee_bps: u16,
        allowed_usdc_mint: Pubkey,
    ) -> Result<()> {
        instructions::initialize_config::handler(
            ctx,
            creation_fee_lamports,
            withdraw_fee_bps,
            allowed_usdc_mint,
        )
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_creation_fee: Option<u64>,
        new_withdraw_fee_bps: Option<u16>,
        fee_enabled: Option<bool>,
        paused: Option<bool>,
        new_allowed_usdc_mint: Option<Pubkey>,
        new_min_auto_stake_lock_days: Option<u16>,
    ) -> Result<()> {
        instructions::update_config::handler(
            ctx,
            new_creation_fee,
            new_withdraw_fee_bps,
            fee_enabled,
            paused,
            new_allowed_usdc_mint,
            new_min_auto_stake_lock_days,
        )
    }

    pub fn update_marginfi_config(
        ctx: Context<UpdateMarginFiConfig>,
        args: instructions::update_config::MarginFiConfigArgs,
    ) -> Result<()> {
        instructions::update_config::handle_update_marginfi_config(ctx, args)
    }

    pub fn propose_admin(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::propose_admin::handler(ctx, new_admin)
    }

    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::accept_admin::handler(ctx)
    }

    pub fn init_user_state(ctx: Context<InitUserState>) -> Result<()> {
        instructions::init_user_state::handler(ctx)
    }

    pub fn create_jar<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateJar<'info>>,
        jar_type: crate::state::JarType,
        asset: crate::state::Asset,
        goal_amount: u64,
        unlock_timestamp: i64,
        metadata_uri: String,
        metadata_hash: [u8; 32],
        auto_stake: bool,
    ) -> Result<()> {
        instructions::create_jar::handler(
            ctx,
            jar_type,
            asset,
            goal_amount,
            unlock_timestamp,
            metadata_uri,
            metadata_hash,
            auto_stake,
        )
    }

    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        new_uri: String,
        new_hash: [u8; 32],
    ) -> Result<()> {
        instructions::update_metadata::handler(ctx, new_uri, new_hash)
    }

    pub fn contribute_sol<'info>(
        ctx: Context<'_, '_, '_, 'info, ContributeSol<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::contribute_sol::handler(ctx, amount)
    }

    pub fn contribute_spl<'info>(
        ctx: Context<'_, '_, '_, 'info, ContributeSpl<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::contribute_spl::handler(ctx, amount)
    }

    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        amount: Option<u64>,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    pub fn cancel_jar<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelJar<'info>>,
    ) -> Result<()> {
        instructions::cancel_jar::handler(ctx)
    }

    pub fn refund<'info>(ctx: Context<'_, '_, '_, 'info, Refund<'info>>) -> Result<()> {
        instructions::refund::handler(ctx)
    }

    pub fn close_jar<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseJar<'info>>,
    ) -> Result<()> {
        instructions::close_jar::handler(ctx)
    }

    pub fn close_contribution(ctx: Context<CloseContribution>) -> Result<()> {
        instructions::close_contribution::handler(ctx)
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        instructions::withdraw_treasury::handler(ctx, amount)
    }

    pub fn migrate_config_v2(ctx: Context<MigrateConfigV2>) -> Result<()> {
        instructions::migrate_config_v2::handler(ctx)
    }
}
