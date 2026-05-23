use anchor_lang::prelude::*;
use crate::constants::MAX_METADATA_URI_LEN;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum JarType {
    Flexible,
    TimeLocked,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Asset {
    Sol,
    Usdc,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum JarStatus {
    Active,
    Withdrawn,
    Cancelled,
}

#[account]
pub struct Jar {
    pub version: u8,
    pub owner: Pubkey,
    pub id: u64,
    pub jar_type: JarType,
    pub asset: Asset,
    pub mint: Pubkey,
    pub goal_amount: u64,
    pub unlock_timestamp: i64,
    pub total_contributed: u64,
    pub total_contributors: u32,
    pub metadata_uri: String,
    pub metadata_hash: [u8; 32],
    pub status: JarStatus,
    pub created_at: i64,
    pub bump: u8,

    // Auto-stake state
    pub auto_stake: bool,
    pub stake_protocol: u8,         // 0 = None, 1 = MarginFiUsdc, 2 = MarinadeSol
    pub principal_total: u64,       // sum of contribution.amount (for goal/progress)
    pub shares_total: u64,          // sum of contribution.shares = asset_shares in bank (truncated to u64)
    pub marginfi_account: Pubkey,   // child PDA; Pubkey::default() when !auto_stake
}

impl Jar {
    pub const SIZE: usize = 8
        + 1
        + 32
        + 8
        + 1
        + 1
        + 32
        + 8
        + 8
        + 8
        + 4
        + 4 + MAX_METADATA_URI_LEN
        + 32
        + 1
        + 8
        + 1
        + 1     // auto_stake
        + 1     // stake_protocol
        + 8     // principal_total
        + 8     // shares_total
        + 32;   // marginfi_account
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StakeProtocol {
    None = 0,
    MarginFiUsdc = 1,
    MarinadeSol = 2,
}

impl Jar {
    pub fn stake_protocol_typed(&self) -> StakeProtocol {
        match self.stake_protocol {
            1 => StakeProtocol::MarginFiUsdc,
            2 => StakeProtocol::MarinadeSol,
            _ => StakeProtocol::None,
        }
    }
}
