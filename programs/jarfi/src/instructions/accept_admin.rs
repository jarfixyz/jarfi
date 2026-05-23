use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::JarError;
use crate::events::AdminAcceptedEvent;
use crate::state::Config;

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<AcceptAdmin>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(!config.paused, JarError::Paused);
    let pending = config.pending_admin.ok_or(JarError::NoPendingAdmin)?;
    require_keys_eq!(
        pending,
        ctx.accounts.new_admin.key(),
        JarError::NotPendingAdmin
    );

    let old_admin = config.admin;
    config.admin = ctx.accounts.new_admin.key();
    config.pending_admin = None;

    emit!(AdminAcceptedEvent {
        old_admin,
        new_admin: config.admin,
        ts: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
