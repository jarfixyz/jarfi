use anchor_lang::prelude::*;

#[error_code]
pub enum JarError {
    #[msg("Fee basis points exceed the 5% hard cap")]
    FeeTooHigh,
    #[msg("Creation fee exceeds hard cap")]
    CreationFeeTooHigh,
    #[msg("Metadata URI exceeds maximum length")]
    MetadataUriTooLong,
    #[msg("Unlock timestamp must be in the future")]
    UnlockInPast,
    #[msg("Unlock timestamp exceeds maximum duration")]
    UnlockTooFar,
    #[msg("Unlock timestamp must be zero for Flexible jars")]
    UnlockNotAllowed,
    #[msg("Signer is not the jar owner")]
    NotOwner,
    #[msg("Signer is not the admin")]
    NotAdmin,
    #[msg("No pending admin transfer in progress")]
    NoPendingAdmin,
    #[msg("Signer is not the pending admin")]
    NotPendingAdmin,
    #[msg("Jar is not in Active status")]
    JarNotActive,
    #[msg("Jar is not in Cancelled status")]
    JarNotCancelled,
    #[msg("Jar is not in Withdrawn status")]
    JarNotWithdrawn,
    #[msg("Time-locked jar cannot be withdrawn before unlock")]
    StillLocked,
    #[msg("Partial withdraw is only allowed for Flexible jars")]
    PartialWithdrawNotAllowed,
    #[msg("Cancel is only valid for Time-locked jars before unlock")]
    CancelNotAllowed,
    #[msg("Refund is only valid for Cancelled jars")]
    RefundNotAllowed,
    #[msg("Program is paused")]
    Paused,
    #[msg("Jar still has active contributors; cannot close")]
    ContributorsRemain,
    #[msg("Amount overflow")]
    Overflow,
    #[msg("Contribution amount must be greater than zero")]
    ZeroAmount,
    #[msg("Wrong asset type for this instruction")]
    WrongAsset,
    #[msg("Contribution does not belong to this jar")]
    ContributionJarMismatch,
    #[msg("Contribution has already been refunded")]
    AlreadyRefunded,
    #[msg("Insufficient jar balance")]
    InsufficientBalance,
    #[msg("Jar cannot be closed in its current state")]
    CloseNotAllowed,
    #[msg("USDC jar uses a mint that is not the admin-approved canonical mint")]
    DisallowedUsdcMint,
    #[msg("Config migration is not needed (already at current version)")]
    MigrationNotNeeded,
    #[msg("Auto-staking is disabled in config")]
    AutoStakeDisabled,
    #[msg("Auto-stake jars must use the configured USDC mint")]
    AutoStakeMintMismatch,
    #[msg("Auto-stake not supported for this asset")]
    AutoStakeUnsupportedAsset,
    #[msg("MarginFi account does not match jar or config")]
    MarginFiAccountMismatch,
    #[msg("Auto-stake on SOL requires a TimeLocked jar")]
    AutoStakeRequiresTimeLocked,
    #[msg("Time-lock duration is below configured minimum for auto-stake")]
    AutoStakeLockTooShort,
    #[msg("Marinade account does not match pinned program constants")]
    MarinadeAccountMismatch,
    #[msg("Shares accounting underflow")]
    SharesUnderflow,
    #[msg("Principal accounting underflow")]
    PrincipalUnderflow,
}
