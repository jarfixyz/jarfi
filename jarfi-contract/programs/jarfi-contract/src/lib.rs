use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, Transfer},
    token_interface::{Mint, TokenAccount},
};

declare_id!("HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW");

// USDC mint — devnet and mainnet share the same constant; pass the correct one
// at call time via the `usdc_mint` account.
// devnet:  4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
// mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

const VAULT_SEED: &[u8] = b"vault";

// jar_currency values
pub const CURRENCY_USDC: u8 = 0;
pub const CURRENCY_SOL: u8 = 1;

#[program]
pub mod jarfi_contract {
    use super::*;

    // -----------------------------------------------------------------------
    // SOL mode — unchanged for backward compatibility
    // -----------------------------------------------------------------------

    pub fn create_jar(
        ctx: Context<CreateJar>,
        mode: u8,
        unlock_date: i64,
        goal_amount: u64,
        child_wallet: Pubkey,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let clock = Clock::get()?;

        require!(mode <= 2, JarError::InvalidMode);
        if mode == 1 || mode == 2 {
            require!(goal_amount > 0, JarError::GoalAmountRequired);
        }

        jar.owner = ctx.accounts.owner.key();
        jar.mode = mode;
        jar.unlock_date = unlock_date;
        jar.goal_amount = goal_amount;
        jar.balance = 0;
        jar.staking_shares = 0;
        jar.created_at = clock.unix_timestamp;
        jar.daily_limit = 0;
        jar.weekly_limit = 0;
        jar.child_wallet = child_wallet;
        jar.child_spendable_balance = 0;
        jar.unlocked = false;
        jar.jar_currency = CURRENCY_SOL;
        jar.usdc_balance = 0;
        jar.usdc_vault = Pubkey::default();
        jar.kamino_obligation = Pubkey::default();

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let jar = &mut ctx.accounts.jar;

        require!(amount > 0, JarError::InvalidDepositAmount);

        jar.balance = jar
            .balance
            .checked_add(amount)
            .ok_or(JarError::BalanceOverflow)?;

        // Temporary mock until Marinade CPI is added
        jar.staking_shares = jar
            .staking_shares
            .checked_add(amount)
            .ok_or(JarError::BalanceOverflow)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // USDC mode
    // -----------------------------------------------------------------------

    pub fn create_usdc_jar(
        ctx: Context<CreateUsdcJar>,
        mode: u8,
        unlock_date: i64,
        goal_amount: u64,
        child_wallet: Pubkey,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let clock = Clock::get()?;

        require!(mode <= 2, JarError::InvalidMode);
        if mode == 1 || mode == 2 {
            require!(goal_amount > 0, JarError::GoalAmountRequired);
        }

        jar.owner = ctx.accounts.owner.key();
        jar.mode = mode;
        jar.unlock_date = unlock_date;
        jar.goal_amount = goal_amount;
        jar.balance = 0;
        jar.staking_shares = 0;
        jar.created_at = clock.unix_timestamp;
        jar.daily_limit = 0;
        jar.weekly_limit = 0;
        jar.child_wallet = child_wallet;
        jar.child_spendable_balance = 0;
        jar.unlocked = false;
        jar.jar_currency = CURRENCY_USDC;
        jar.usdc_balance = 0;
        jar.usdc_vault = ctx.accounts.jar_usdc_vault.key();
        jar.kamino_obligation = Pubkey::default();

        Ok(())
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        let jar = &mut ctx.accounts.jar;

        require!(amount > 0, JarError::InvalidDepositAmount);
        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);
        require!(jar.jar_currency == CURRENCY_USDC, JarError::WrongCurrency);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor_usdc_account.to_account_info(),
                    to: ctx.accounts.jar_usdc_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        jar.usdc_balance = jar
            .usdc_balance
            .checked_add(amount)
            .ok_or(JarError::BalanceOverflow)?;

        Ok(())
    }

    pub fn gift_deposit_usdc(
        ctx: Context<GiftDepositUsdc>,
        amount: u64,
        comment: String,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let contribution = &mut ctx.accounts.contribution;
        let clock = Clock::get()?;

        require!(comment.len() <= 120, JarError::CommentTooLong);
        require!(amount > 0, JarError::InvalidDepositAmount);
        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);
        require!(jar.jar_currency == CURRENCY_USDC, JarError::WrongCurrency);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.contributor_usdc_account.to_account_info(),
                    to: ctx.accounts.jar_usdc_vault.to_account_info(),
                    authority: ctx.accounts.contributor.to_account_info(),
                },
            ),
            amount,
        )?;

        jar.usdc_balance = jar
            .usdc_balance
            .checked_add(amount)
            .ok_or(JarError::BalanceOverflow)?;

        contribution.jar = jar.key();
        contribution.contributor = ctx.accounts.contributor.key();
        contribution.amount = amount;
        contribution.comment = comment;
        contribution.created_at = clock.unix_timestamp;

        Ok(())
    }

    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, amount: u64) -> Result<()> {
        let jar_key = ctx.accounts.jar.key();
        let jar = &mut ctx.accounts.jar;

        require!(amount > 0, JarError::InvalidDepositAmount);
        require!(jar.unlocked, JarError::JarStillLocked);
        require!(jar.jar_currency == CURRENCY_USDC, JarError::WrongCurrency);
        require!(
            jar.usdc_balance >= amount,
            JarError::InsufficientJarBalance
        );

        let bump = ctx.bumps.vault_authority;
        let seeds: &[&[u8]] = &[VAULT_SEED, jar_key.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.jar_usdc_vault.to_account_info(),
                    to: ctx.accounts.owner_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        jar.usdc_balance = jar
            .usdc_balance
            .checked_sub(amount)
            .ok_or(JarError::InsufficientJarBalance)?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Quests / spending limits (unchanged)
    // -----------------------------------------------------------------------

    pub fn create_quest(
        ctx: Context<CreateQuest>,
        name: String,
        amount: u64,
        frequency: u8,
    ) -> Result<()> {
        let quest = &mut ctx.accounts.quest;

        require!(name.len() <= 64, JarError::QuestNameTooLong);

        quest.jar = ctx.accounts.jar.key();
        quest.name = name;
        quest.amount = amount;
        quest.frequency = frequency;
        quest.last_paid = 0;
        quest.active = true;

        Ok(())
    }

    pub fn approve_quest(ctx: Context<ApproveQuest>) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let quest = &mut ctx.accounts.quest;
        let clock = Clock::get()?;

        require!(quest.active, JarError::QuestInactive);
        require!(quest.jar == jar.key(), JarError::QuestJarMismatch);
        require!(jar.balance >= quest.amount, JarError::InsufficientJarBalance);
        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);

        jar.balance = jar
            .balance
            .checked_sub(quest.amount)
            .ok_or(JarError::InsufficientJarBalance)?;

        jar.child_spendable_balance = jar
            .child_spendable_balance
            .checked_add(quest.amount)
            .ok_or(JarError::BalanceOverflow)?;

        quest.last_paid = clock.unix_timestamp;

        Ok(())
    }

    pub fn set_spending_limit(
        ctx: Context<SetSpendingLimit>,
        daily_limit: u64,
        weekly_limit: u64,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;

        jar.daily_limit = daily_limit;
        jar.weekly_limit = weekly_limit;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Gift deposit (SOL mode — kept for backward compat)
    // -----------------------------------------------------------------------

    pub fn gift_deposit(
        ctx: Context<GiftDeposit>,
        amount: u64,
        comment: String,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let contribution = &mut ctx.accounts.contribution;
        let clock = Clock::get()?;

        require!(comment.len() <= 120, JarError::CommentTooLong);
        require!(amount > 0, JarError::InvalidDepositAmount);
        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);

        jar.balance = jar
            .balance
            .checked_add(amount)
            .ok_or(JarError::BalanceOverflow)?;

        contribution.jar = jar.key();
        contribution.contributor = ctx.accounts.contributor.key();
        contribution.amount = amount;
        contribution.comment = comment;
        contribution.created_at = clock.unix_timestamp;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Unlock & emergency (updated for USDC)
    // -----------------------------------------------------------------------

    pub fn unlock_jar(ctx: Context<UnlockJar>) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let clock = Clock::get()?;

        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);

        let date_reached = clock.unix_timestamp >= jar.unlock_date;

        // Goal check uses the correct balance depending on currency
        let current_balance = if jar.jar_currency == CURRENCY_USDC {
            jar.usdc_balance
        } else {
            jar.balance
        };
        let goal_reached = jar.goal_amount > 0 && current_balance >= jar.goal_amount;

        let can_unlock = match jar.mode {
            0 => date_reached,
            1 => goal_reached,
            2 => date_reached || goal_reached,
            _ => return Err(JarError::InvalidMode.into()),
        };

        require!(can_unlock, JarError::JarStillLocked);

        // For SOL mode: move balance to child_spendable_balance
        if jar.jar_currency == CURRENCY_SOL {
            jar.child_spendable_balance = jar
                .child_spendable_balance
                .checked_add(jar.balance)
                .ok_or(JarError::BalanceOverflow)?;
            jar.balance = 0;
        }
        // For USDC mode: withdraw_usdc handles the actual transfer after unlock

        jar.unlocked = true;

        Ok(())
    }

    // Called by the backend after successfully depositing into Kamino
    pub fn set_kamino_obligation(
        ctx: Context<SetKaminoObligation>,
        obligation: Pubkey,
    ) -> Result<()> {
        ctx.accounts.jar.kamino_obligation = obligation;
        Ok(())
    }

    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        let jar = &mut ctx.accounts.jar;

        require!(!jar.unlocked, JarError::JarAlreadyUnlocked);

        jar.balance = 0;
        jar.staking_shares = 0;
        jar.unlocked = true;

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CreateJar<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Jar::INIT_SPACE
    )]
    pub jar: Account<'info, Jar>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateUsdcJar<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Jar::INIT_SPACE
    )]
    pub jar: Account<'info, Jar>,

    /// CHECK: PDA used as signing authority for the jar's token vault
    #[account(
        seeds = [VAULT_SEED, jar.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub jar_usdc_vault: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub jar: Account<'info, Jar>,

    pub depositor: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(mut)]
    pub jar: Account<'info, Jar>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub jar_usdc_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority, verified via seeds
    #[account(
        seeds = [VAULT_SEED, jar.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct GiftDepositUsdc<'info> {
    #[account(mut)]
    pub jar: Account<'info, Jar>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub jar_usdc_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority, verified via seeds
    #[account(
        seeds = [VAULT_SEED, jar.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = contributor,
        space = 8 + Contribution::INIT_SPACE,
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = contributor,
    )]
    pub contributor_usdc_account: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub contributor: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub jar_usdc_vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA vault authority, verified via seeds
    #[account(
        seeds = [VAULT_SEED, jar.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = owner,
    )]
    pub owner_usdc_account: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct CreateQuest<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    #[account(
        init,
        payer = owner,
        space = 8 + Quest::INIT_SPACE
    )]
    pub quest: Account<'info, Quest>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveQuest<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    #[account(mut)]
    pub quest: Account<'info, Quest>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetSpendingLimit<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GiftDeposit<'info> {
    #[account(mut)]
    pub jar: Account<'info, Jar>,

    #[account(
        init,
        payer = contributor,
        space = 8 + Contribution::INIT_SPACE
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(mut)]
    pub contributor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlockJar<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetKaminoObligation<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(mut, has_one = owner)]
    pub jar: Account<'info, Jar>,

    pub owner: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Account types
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Jar {
    pub owner: Pubkey,
    pub mode: u8,               // 0 = date, 1 = goal, 2 = either/first
    pub unlock_date: i64,
    pub goal_amount: u64,       // lamports (SOL) or USDC micro-units (6 dec)
    pub balance: u64,           // SOL lamports (jar_currency = 1)
    pub staking_shares: u64,    // mSOL shares mock (SOL mode)
    pub created_at: i64,
    pub daily_limit: u64,
    pub weekly_limit: u64,
    pub child_wallet: Pubkey,
    pub child_spendable_balance: u64,
    pub unlocked: bool,
    pub jar_currency: u8,        // 0 = USDC, 1 = SOL
    pub usdc_balance: u64,       // USDC micro-units (jar_currency = 0)
    pub usdc_vault: Pubkey,      // jar's USDC ATA (zero if SOL mode)
    pub kamino_obligation: Pubkey, // Kamino obligation account (zero if not staked)
}

#[account]
#[derive(InitSpace)]
pub struct Quest {
    pub jar: Pubkey,
    #[max_len(64)]
    pub name: String,
    pub amount: u64,
    pub frequency: u8,
    pub last_paid: i64,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub jar: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    #[max_len(120)]
    pub comment: String,
    pub created_at: i64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum JarError {
    #[msg("Quest name is too long")]
    QuestNameTooLong,
    #[msg("Jar is still locked")]
    JarStillLocked,
    #[msg("Quest is inactive")]
    QuestInactive,
    #[msg("Quest does not belong to this jar")]
    QuestJarMismatch,
    #[msg("Balance overflow")]
    BalanceOverflow,
    #[msg("Comment is too long")]
    CommentTooLong,
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    #[msg("Insufficient jar balance")]
    InsufficientJarBalance,
    #[msg("Jar already unlocked")]
    JarAlreadyUnlocked,
    #[msg("Invalid unlock mode — must be 0 (date), 1 (goal), or 2 (either)")]
    InvalidMode,
    #[msg("Goal amount required for goal-based and combined unlock modes")]
    GoalAmountRequired,
    #[msg("Operation not supported for this jar currency")]
    WrongCurrency,
}
