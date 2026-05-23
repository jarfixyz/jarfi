use anchor_lang::prelude::*;
use crate::constants::MAX_METADATA_URI_LEN;
use crate::errors::JarError;
use crate::events::MetadataUpdatedEvent;
use crate::state::Jar;

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ JarError::NotOwner,
    )]
    pub jar: Account<'info, Jar>,
}

pub fn handler(
    ctx: Context<UpdateMetadata>,
    new_uri: String,
    new_hash: [u8; 32],
) -> Result<()> {
    require!(new_uri.len() <= MAX_METADATA_URI_LEN, JarError::MetadataUriTooLong);

    let jar = &mut ctx.accounts.jar;
    let old_hash = jar.metadata_hash;
    jar.metadata_uri = new_uri.clone();
    jar.metadata_hash = new_hash;

    let clock = Clock::get()?;
    emit!(MetadataUpdatedEvent {
        jar: jar.key(),
        old_hash,
        new_hash,
        new_uri,
        ts: clock.unix_timestamp,
    });

    Ok(())
}
