use anchor_lang::prelude::*;
use crate::errors::JarError;
use crate::events::CancelEvent;
use crate::state::{Jar, JarStatus, JarType};

#[derive(Accounts)]
pub struct CancelJar<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ JarError::NotOwner,
    )]
    pub jar: Account<'info, Jar>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelJar<'info>>,
) -> Result<()> {
    let clock = Clock::get()?;
    let jar = &mut ctx.accounts.jar;
    require!(matches!(jar.status, JarStatus::Active), JarError::JarNotActive);
    require!(matches!(jar.jar_type, JarType::TimeLocked), JarError::CancelNotAllowed);
    require!(clock.unix_timestamp < jar.unlock_timestamp, JarError::CancelNotAllowed);

    jar.status = JarStatus::Cancelled;

    emit!(CancelEvent {
        jar: jar.key(),
        owner: jar.owner,
        ts: clock.unix_timestamp,
    });
    Ok(())
}
