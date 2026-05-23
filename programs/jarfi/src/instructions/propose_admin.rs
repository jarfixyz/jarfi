use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::JarError;
use crate::events::AdminProposedEvent;
use crate::state::Config;

#[derive(Accounts)]
pub struct ProposeAdmin<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ JarError::NotAdmin,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<ProposeAdmin>, new_admin: Pubkey) -> Result<()> {
    require!(!ctx.accounts.config.paused, JarError::Paused);
    require_keys_neq!(new_admin, Pubkey::default(), JarError::NotPendingAdmin);
    require_keys_neq!(new_admin, ctx.accounts.config.admin, JarError::NotPendingAdmin);

    ctx.accounts.config.pending_admin = Some(new_admin);

    emit!(AdminProposedEvent {
        admin: ctx.accounts.config.admin,
        pending_admin: new_admin,
        ts: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
