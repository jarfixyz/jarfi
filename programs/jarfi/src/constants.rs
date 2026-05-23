use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const USER_STATE_SEED: &[u8] = b"user";
pub const JAR_SEED: &[u8] = b"jar";
pub const JAR_VAULT_SEED: &[u8] = b"jar_vault";
pub const CONTRIBUTION_SEED: &[u8] = b"contrib";

pub const MAX_WITHDRAW_FEE_BPS: u16 = 500; // 5% hard cap
pub const MAX_CREATION_FEE_LAMPORTS: u64 = 100_000_000; // 0.1 SOL hard cap
pub const MAX_METADATA_URI_LEN: usize = 200;
pub const MAX_TIMELOCK_DURATION_SECS: i64 = 315_360_000; // 10 years
pub const BPS_DENOMINATOR: u64 = 10_000;

#[constant]
pub const STATE_VERSION: u8 = 1;

pub const DEFAULT_MIN_AUTO_STAKE_LOCK_DAYS: u16 = 30;
