use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::UserState;

#[derive(Accounts)]
pub struct InitUserState<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = UserState::SIZE,
        seeds = [USER_STATE_SEED, owner.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserState>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitUserState>) -> Result<()> {
    let user_state = &mut ctx.accounts.user_state;
    user_state.version = STATE_VERSION;
    user_state.owner = ctx.accounts.owner.key();
    user_state.jar_count = 0;
    user_state.bump = ctx.bumps.user_state;
    Ok(())
}
