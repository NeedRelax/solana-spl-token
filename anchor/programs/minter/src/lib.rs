// 允许 Clippy 忽略 `result_large_err` 警告，可能是因为错误类型占用空间较大
#![allow(clippy::result_large_err)]

// 导入 Anchor 框架的核心模块，提供程序开发所需的工具和类型
use anchor_lang::prelude::*;
// 导入 Anchor 的 SPL 模块，用于与 SPL Token 程序进行交互（如铸造、冻结、销毁等）
use anchor_spl::{
    associated_token::AssociatedToken, // 用于处理关联代币账户 (ATA)
    token::{self, Burn, FreezeAccount, Mint, MintTo, ThawAccount, Token, TokenAccount}, // SPL Token 相关的结构体和 CPI 指令
};

// 定义程序的 ID，指定程序的部署地址（公钥）
declare_id!("5j3eyHDGueYHnRVEEQa29d5EaGmwbKZYgbzoHCXEjseY");

// 定义 PDA 的种子常量，避免在代码中硬编码字符串，提高可读性和维护性
const MINT_AUTHORITY_SEED: &[u8] = b"mint_authority";

#[program]
pub mod minter {
    use super::*; // 引入父模块的符号（如常量、错误类型等）
    use anchor_spl::token::SetAuthority; // 导入 SetAuthority
    use spl_token::instruction::AuthorityType; //  导入 AuthorityType

    /// 指令：创建一种新的 SPL Token，并向调用者铸造指定数量的代币。
    /// Freeze Authority 也被设置为同一个 PDA，使程序拥有冻结能力。
    pub fn create_token(
        ctx: Context<CreateToken>,
        _decimals: u8,
        mint_amount: u64,
    ) -> Result<()> {
        msg!("Creating new SPL Token...");
        // Anchor 的 `init` 宏已经处理了 Mint 账户的创建和 `mint_authority` 的设置。
        // `freeze_authority` 此时默认是 `mint_authority` (我们的 PDA)。
        // 为了绝对确保和展示如何操作，我们手动再设置一次。

        // 2. 手动设置 Freeze Authority
        msg!("Setting freeze authority to PDA...");

        let seeds = &[
            MINT_AUTHORITY_SEED,
            &[ctx.bumps.mint_authority],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = SetAuthority {
            current_authority: ctx.accounts.mint_authority.to_account_info(),
            account_or_mint: ctx.accounts.mint.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );

        token::set_authority(
            cpi_context,
            AuthorityType::FreezeAccount, // 冻结权限
            Some(ctx.accounts.mint_authority.key()), // 新的权限地址 (我们的 PDA)
        )?;

        msg!("Freeze authority set.");

        // 3. 铸币逻辑保持不变
        msg!("Minting {} tokens...", mint_amount);
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            mint_amount,
        )?;

        // 记录成功创建和铸造代币的日志
        msg!("Token created and minted successfully!");
        // 记录 Mint 账户的公钥
        msg!("Mint Address: {}", ctx.accounts.mint.key());
        // 记录接收代币的 ATA 账户公钥
        msg!("Recipient ATA: {}", ctx.accounts.destination.key());
        // 记录铸造的代币数量
        msg!("Amount Minted: {}", mint_amount);

        // 返回成功
        Ok(())
    }

    /// 指令：冻结一个指定的 Token Account。
    /// 只有当 Mint 的 Freeze Authority 是我们的 PDA 时才能成功。
    pub fn freeze_account(ctx: Context<UpdateTokenAccountState>) -> Result<()> {
        // 记录日志，提示正在冻结的 Token 账户
        msg!(
            "Freezing token account: {}",
            ctx.accounts.token_account.key()
        );
        // 检查 Mint 账户的 freeze_authority 是否存在（不是 COption::None）
        let freeze_authority_option = ctx.accounts.mint.freeze_authority;
        if freeze_authority_option.is_none() {
            // 如果 Freeze Authority 未设置，返回错误
            return err!(TokenMinterError::FreezeAuthorityNotSet);
        }

        // 解包 freeze_authority 并与 PDA 地址比较
        let expected_authority = freeze_authority_option.unwrap();
        if expected_authority != ctx.accounts.freeze_authority.key() {
            // 如果 Freeze Authority 不是我们的 PDA，返回错误
            return err!(TokenMinterError::InvalidFreezeAuthority);
        }
        // 构建 PDA 签名种子
        let seeds = &[
            MINT_AUTHORITY_SEED, // 使用常量种子
            &[ctx.bumps.freeze_authority], // 使用 Anchor 提供的 bump 值
        ];
        let signer = &[&seeds[..]]; // 将种子包装为签名者格式

        // 通过 CPI 调用 SPL Token 程序的 freeze_account 指令，冻结账户
        token::freeze_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), // SPL Token 程序
            FreezeAccount {
                account: ctx.accounts.token_account.to_account_info(), // 要冻结的 Token 账户
                mint: ctx.accounts.mint.to_account_info(), // 代币 Mint 账户
                authority: ctx.accounts.freeze_authority.to_account_info(), // 冻结权限 (PDA)
            },
            signer, // PDA 的签名种子
        ))?;

        // 记录成功冻结账户的日志
        msg!("Account frozen successfully.");
        // 返回成功
        Ok(())
    }

    /// 指令：解冻一个指定的 Token Account。
    pub fn thaw_account(ctx: Context<UpdateTokenAccountState>) -> Result<()> {
        // 记录日志，提示正在解冻的 Token 账户
        msg!(
            "Thawing token account: {}",
            ctx.accounts.token_account.key()
        );
        // 检查 Mint 账户的 freeze_authority 是否存在
        let freeze_authority_option = ctx.accounts.mint.freeze_authority;
        if freeze_authority_option.is_none() {
            // 如果 Freeze Authority 未设置，返回错误
            return err!(TokenMinterError::FreezeAuthorityNotSet);
        }

        // 解包 freeze_authority 并与 PDA 地址比较
        let expected_authority = freeze_authority_option.unwrap();
        if expected_authority != ctx.accounts.freeze_authority.key() {
            // 如果 Freeze Authority 不是我们的 PDA，返回错误
            return err!(TokenMinterError::InvalidFreezeAuthority);
        }
        // 构建 PDA 签名种子
        let seeds = &[
            MINT_AUTHORITY_SEED, // 使用常量种子
            &[ctx.bumps.freeze_authority], // 使用 Anchor 提供的 bump 值
        ];
        let signer = &[&seeds[..]]; // 将种子包装为签名者格式

        // 通过 CPI 调用 SPL Token 程序的 thaw_account 指令，解冻账户
        token::thaw_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(), // SPL Token 程序
            ThawAccount {
                account: ctx.accounts.token_account.to_account_info(), // 要解冻的 Token 账户
                mint: ctx.accounts.mint.to_account_info(), // 代币 Mint 账户
                authority: ctx.accounts.freeze_authority.to_account_info(), // 冻结权限 (PDA)
            },
            signer, // PDA 的签名种子
        ))?;

        // 记录成功解冻账户的日志
        msg!("Account thawed successfully.");
        // 返回成功
        Ok(())
    }

    /// 指令：销毁用户自己持有的代币。
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        // 记录日志，提示正在销毁的代币数量和账户
        msg!("Burning {} tokens from {}", amount, ctx.accounts.from.key());

        // 检查销毁数量是否为 0，若为 0 则返回错误
        if amount == 0 {
            return err!(TokenMinterError::ZeroBurnAmount);
        }

        // 通过 CPI 调用 SPL Token 程序的 burn 指令，销毁代币
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(), // SPL Token 程序
                Burn {
                    mint: ctx.accounts.mint.to_account_info(), // 代币 Mint 账户
                    from: ctx.accounts.from.to_account_info(), // 要销毁代币的账户
                    authority: ctx.accounts.authority.to_account_info(), // 销毁权限（签名者）
                },
            ),
            amount, // 销毁的代币数量
        )?;

        // 记录成功销毁代币的日志
        msg!("Tokens burned successfully.");
        // 返回成功
        Ok(())
    }
}

// 定义 CreateToken 指令的账户上下文
#[derive(Accounts)]
#[instruction(decimals: u8)] // 指令需要一个 decimals 参数，用于设置代币的小数位数
pub struct CreateToken<'info> {
    #[account(
        init,
        payer = signer,
        mint::decimals = decimals,
        mint::authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut, // 因为它要作为 current_authority 签名 set_authority，所以可能需要 mut
        seeds = [MINT_AUTHORITY_SEED],
        bump,
    )]
    /// CHECK: PDA used as mint and freeze authority.
    pub mint_authority: UncheckedAccount<'info>,

    // 接收铸造代币的关联代币账户 (ATA)
    /// CHECK: This is the PDA that will be the mint authority. We don't need to check it because we are creating it and setting it as the authority in the same instruction.
    #[account(
        init_if_needed, // 如果 ATA 不存在则初始化，存在则复用
        payer = signer, // 由签名者支付账户创建费用
        associated_token::mint = mint, // 关联到 Mint 账户
        associated_token::authority = signer, // 账户的权限归签名者
    )]
    pub destination: Account<'info, TokenAccount>,

    // 签名者账户，可变（支付费用）
    #[account(mut)]
    pub signer: Signer<'info>,

    // 系统程序，用于账户创建
    pub system_program: Program<'info, System>,
    // SPL Token 程序，用于代币操作
    pub token_program: Program<'info, Token>,
    // 关联代币程序，用于创建 ATA
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// 定义冻结和解冻指令的账户上下文，复用以减少代码重复
#[derive(Accounts)]
pub struct UpdateTokenAccountState<'info> {
    // 代币 Mint 账户，可变（可能更新状态）
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    // 要冻结或解冻的 Token 账户，可变
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    // 冻结权限的 PDA 账户
    /// CHECK: This is the PDA that is the freeze authority. We perform a manual check in the instruction logic to ensure it matches the mint's freeze authority.
    #[account(
        seeds = [MINT_AUTHORITY_SEED], // 使用常量种子生成 PDA
        bump // Anchor 自动计算 bump 值
    )]
    pub freeze_authority: UncheckedAccount<'info>,

    // SPL Token 程序，用于冻结/解冻操作
    pub token_program: Program<'info, Token>,
}

// 定义销毁代币指令的账户上下文
#[derive(Accounts)]
pub struct BurnTokens<'info> {
    // 代币 Mint 账户，可变（更新总供应量）
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    // 要销毁代币的 Token 账户，可变
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    // 签名者账户，拥有销毁权限
    #[account(mut)]
    pub authority: Signer<'info>,

    // SPL Token 程序，用于销毁操作
    pub token_program: Program<'info, Token>,
}

// 定义自定义错误类型
#[error_code]
pub enum TokenMinterError {
    // 铸造数量必须大于 0
    #[msg("Mint amount must be greater than zero.")]
    ZeroMintAmount,
    // 销毁数量必须大于 0
    #[msg("Burn amount must be greater than zero.")]
    ZeroBurnAmount,
    // 冻结权限无效
    #[msg("The provided freeze authority is invalid.")]
    InvalidFreezeAuthority,
    // 冻结权限未设置
    #[msg("Freeze authority is not set on the Mint account.")]
    FreezeAuthorityNotSet,
}