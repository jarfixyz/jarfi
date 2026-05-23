use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::JarError;
use crate::state::{Contribution, Jar, JarStatus};

#[derive(Accounts)]
pub struct CloseContribution<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub jar: Account<'info, Jar>,

    /// CHECK: rent destination; must match contribution.donor.
    #[account(mut)]
    pub donor: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [CONTRIBUTION_SEED, jar.key().as_ref(), donor.key().as_ref()],
        bump = contribution.bump,
        close = donor,
        constraint = contribution.jar == jar.key() @ JarError::ContributionJarMismatch,
        constraint = contribution.donor == donor.key() @ JarError::ContributionJarMismatch,
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handler(ctx: Context<CloseContribution>) -> Result<()> {
    require!(
        matches!(ctx.accounts.jar.status, JarStatus::Withdrawn),
        JarError::CloseNotAllowed
    );

    let jar = &mut ctx.accounts.jar;
    jar.total_contributors = jar
        .total_contributors
        .checked_sub(1)
        .ok_or(JarError::Overflow)?;
    Ok(())
}
