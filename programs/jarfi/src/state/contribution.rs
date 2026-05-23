use anchor_lang::prelude::*;

#[account]
pub struct Contribution {
    pub version: u8,
    pub jar: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
    pub shares: u64,                // u64 truncation of MarginFi I80F48 asset_shares
    pub first_contributed_at: i64,
    pub last_contributed_at: i64,
    pub refunded: bool,
    pub bump: u8,
}

impl Contribution {
    pub const SIZE: usize = 8
        + 1
        + 32
        + 32
        + 8
        + 8     // shares
        + 8
        + 8
        + 1
        + 1;
}
