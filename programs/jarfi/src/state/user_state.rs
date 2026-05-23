use anchor_lang::prelude::*;

#[account]
pub struct UserState {
    pub version: u8,
    pub owner: Pubkey,
    pub jar_count: u64,
    pub bump: u8,
}

impl UserState {
    pub const SIZE: usize = 8 // discriminator
        + 1                   // version
        + 32                  // owner
        + 8                   // jar_count
        + 1;                  // bump
}
