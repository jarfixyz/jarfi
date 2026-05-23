use anchor_lang::prelude::*;

#[event]
pub struct CreateJarEvent {
    pub jar: Pubkey,
    pub owner: Pubkey,
    pub jar_type: u8,
    pub asset: u8,
    pub mint: Pubkey,
    pub goal_amount: u64,
    pub unlock_timestamp: i64,
    pub metadata_uri: String,
    pub metadata_hash: [u8; 32],
    pub created_at: i64,
}

#[event]
pub struct ContributeEvent {
    pub jar: Pubkey,
    pub donor: Pubkey,
    pub amount_delta: u64,
    pub total_after: u64,
    pub contributors_after: u32,
    pub is_first: bool,
    pub ts: i64,
    pub shares_delta: u64,   // 0 when not auto-staked
}

#[event]
pub struct WithdrawEvent {
    pub jar: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub ts: i64,
    pub shares_redeemed: u64,
    pub gross_underlying: u64, // SOL lamports for Marinade, USDC base units for MarginFi
    pub protocol: u8,          // 0 None, 1 MarginFiUsdc, 2 MarinadeSol
}

#[event]
pub struct CancelEvent {
    pub jar: Pubkey,
    pub owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct RefundEvent {
    pub jar: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
    pub ts: i64,
    pub shares_redeemed: u64,
    pub gross_underlying: u64, // SOL lamports for Marinade, USDC base units for MarginFi
    pub protocol: u8,          // 0 None, 1 MarginFiUsdc, 2 MarinadeSol
}

#[event]
pub struct MetadataUpdatedEvent {
    pub jar: Pubkey,
    pub old_hash: [u8; 32],
    pub new_hash: [u8; 32],
    pub new_uri: String,
    pub ts: i64,
}

#[event]
pub struct CloseJarEvent {
    pub jar: Pubkey,
    pub owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct ConfigUpdatedEvent {
    pub admin: Pubkey,
    pub creation_fee_lamports: u64,
    pub withdraw_fee_bps: u16,
    pub fee_enabled: bool,
    pub paused: bool,
    pub ts: i64,
}

#[event]
pub struct AdminProposedEvent {
    pub admin: Pubkey,
    pub pending_admin: Pubkey,
    pub ts: i64,
}

#[event]
pub struct AdminAcceptedEvent {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub ts: i64,
}

#[event]
pub struct TreasuryWithdrawEvent {
    pub admin: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub ts: i64,
}
