use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};
use std::mem::size_of;

declare_id!("Br1dgE1111111111111111111111111111111111111");

#[program]
pub mod native_bridge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, validators: Vec<Pubkey>, validator_threshold: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.validators = validators;
        require!(validator_threshold > 0 && validator_threshold <= validators.len() as u64, BridgeError::InvalidThreshold);
        state.validator_threshold = validator_threshold;
        Ok(())
    }

    pub fn set_validators(ctx: Context<SetValidators>, validators: Vec<Pubkey>, validator_threshold: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require_keys_eq!(ctx.accounts.authority.key(), state.authority, BridgeError::Unauthorized);
        require!(validator_threshold > 0 && validator_threshold <= validators.len() as u64, BridgeError::InvalidThreshold);
        state.validators = validators;
        state.validator_threshold = validator_threshold;
        Ok(())
    }

    pub fn mint_wrapped(ctx: Context<MintWrapped>, transfer_id: [u8; 32], amount: u64, source_chain: u64) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(state.validators.contains(&ctx.accounts.validator.key()), BridgeError::Unauthorized);

        let mint_record = &mut ctx.accounts.mint_record;
        mint_record.transfer_id = transfer_id;
        mint_record.amount = amount;
        mint_record.source_chain = source_chain;
        mint_record.recipient = ctx.accounts.recipient.key();
        mint_record.mint = ctx.accounts.wrapped_mint.key();
        mint_record.redeemed = false;

        let state_key = ctx.accounts.state.key();
        let seeds = &[b"state".as_ref(), &[ctx.bumps.state]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.wrapped_mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::mint_to(cpi_ctx, amount)?;

        emit!(WrappedMinted {
            transfer_id,
            recipient: ctx.accounts.recipient.key(),
            mint: ctx.accounts.wrapped_mint.key(),
            amount,
            source_chain,
            state: state_key,
        });

        Ok(())
    }

    pub fn burn_wrapped(
        ctx: Context<BurnWrapped>,
        release_id: [u8; 32],
        destination_recipient: [u8; 32],
        amount: u64,
        destination_chain: u64
    ) -> Result<()> {
        let burn_record = &mut ctx.accounts.burn_record;
        burn_record.release_id = release_id;
        burn_record.amount = amount;
        burn_record.destination_chain = destination_chain;
        burn_record.destination_recipient = destination_recipient;
        burn_record.owner = ctx.accounts.owner.key();
        burn_record.mint = ctx.accounts.wrapped_mint.key();

        let cpi_accounts = Burn {
            mint: ctx.accounts.wrapped_mint.to_account_info(),
            from: ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        emit!(WrappedBurned {
            release_id,
            burn_record: ctx.accounts.burn_record.key(),
            owner: ctx.accounts.owner.key(),
            mint: ctx.accounts.wrapped_mint.key(),
            amount,
            destination_chain,
            destination_recipient,
        });

        Ok(())
    }
}

#[account]
pub struct BridgeState {
    pub authority: Pubkey,
    pub validator_threshold: u64,
    pub validators: Vec<Pubkey>,
}

#[account]
pub struct MintRecord {
    pub transfer_id: [u8; 32],
    pub amount: u64,
    pub source_chain: u64,
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub redeemed: bool,
}

#[account]
pub struct BurnRecord {
    pub release_id: [u8; 32],
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_recipient: [u8; 32],
    pub owner: Pubkey,
    pub mint: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + 32 + 8 + 4 + 32 * 32, seeds = [b"state"], bump)]
    pub state: Account<'info, BridgeState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetValidators<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, BridgeState>,
}

#[derive(Accounts)]
#[instruction(transfer_id: [u8; 32])]
pub struct MintWrapped<'info> {
    #[account(mut)]
    pub validator: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, BridgeState>,
    #[account(init, payer = validator, space = 8 + size_of::<MintRecord>(), seeds = [b"mint-record", &transfer_id], bump)]
    pub mint_record: Account<'info, MintRecord>,
    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(release_id: [u8; 32])]
pub struct BurnWrapped<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + size_of::<BurnRecord>(), seeds = [b"burn-record", &release_id], bump)]
    pub burn_record: Account<'info, BurnRecord>,
    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,
    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct WrappedMinted {
    pub transfer_id: [u8; 32],
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub source_chain: u64,
    pub state: Pubkey,
}

#[event]
pub struct WrappedBurned {
    pub release_id: [u8; 32],
    pub burn_record: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub destination_chain: u64,
    pub destination_recipient: [u8; 32],
}

#[error_code]
pub enum BridgeError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid threshold")]
    InvalidThreshold,
}
