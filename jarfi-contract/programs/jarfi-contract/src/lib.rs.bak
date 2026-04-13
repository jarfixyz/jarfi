
use anchor_lang::prelude::*;

declare_id!("HtQt8P4pcF2X4D9oxWwsafj5KnwJsUPF148mvkZMQaFW");

#[program]
pub mod jarfi_contract {
    use super::*;

    pub fn create_jar(
        ctx: Context<CreateJar>,
        mode: u8,
        unlock_date: i64,
    ) -> Result<()> {
        let jar = &mut ctx.accounts.jar;
        let clock = Clock::get()?;

        jar.owner = ctx.accounts.owner.key();
        jar.mode = mode;
        jar.unlock_date = unlock_date;
        jar.balance = 0;
        jar.staking_shares = 0;
        jar.created_at = clock.unix_timestamp;
        jar.daily_limit = 0;
        jar.weekly_limit = 0;

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

        quest.last_paid = clock.unix_timestamp;
        jar.balance = jar
            .balance
            .checked_add(quest.amount)
            .ok_or(JarError::BalanceOverflow)?;

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

    pub fn unlock_jar(ctx: Context<UnlockJar>) -> Result<()> {
        let jar = &ctx.accounts.jar;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp >= jar.unlock_date,
            JarError::JarStillLocked
        );

        Ok(())
    }
}

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
pub struct Deposit<'info> {
    #[account(mut)]
    pub jar: Account<'info, Jar>,

    pub depositor: Signer<'info>,
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
    #[account(has_one = owner)]
    pub jar: Account<'info, Jar>,

    pub owner: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Jar {
    pub owner: Pubkey,
    pub mode: u8,
    pub unlock_date: i64,
    pub balance: u64,
    pub staking_shares: u64,
    pub created_at: i64,
    pub daily_limit: u64,
    pub weekly_limit: u64,
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
}
