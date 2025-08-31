import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  getMint,
  getAccount,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Minter } from '../target/types/minter';

describe('spl-token-minter', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .Minter as Program<Minter>;
  const signer = provider.wallet as anchor.Wallet;

  // 为新的 token mint 生成一个 keypair，这样我们就能在测试中引用它的地址
  const mintKeypair = Keypair.generate();
  const MINT_AUTHORITY_SEED = 'mint_authority';

  // 计算程序的 PDA，它将作为 mint authority 和 freeze authority
  const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_AUTHORITY_SEED)],
    program.programId
  );

  it('Is initialized and a new token is created!', async () => {
    // --- 1. 定义指令参数 ---
    const decimals = 9;
    const mintAmount = new anchor.BN(1000 * 10 ** decimals); // 铸造 1000 个代币

    // --- 2. 计算关联代币账户 (ATA) 的地址 ---
    const destinationATA = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      signer.publicKey
    );

    // --- 3. 调用 `create_token` 指令 ---
    const txSignature = await program.methods
      .createToken(decimals, mintAmount)
      .accounts({
        mint: mintKeypair.publicKey,
        mintAuthority: mintAuthorityPDA,
        destination: destinationATA,
        signer: signer.publicKey,
      })
      .signers([mintKeypair]) // 因为 `mint` 账户是新创建的，需要它的签名
      .rpc();

    console.log('`create_token` transaction signature:', txSignature);

    // --- 4. 验证链上状态 ---
    // 验证 Mint 账户
    const mintInfo = await getMint(provider.connection, mintKeypair.publicKey);

    // 使用 Jest 的 `expect` 进行断言
    expect(mintInfo.mintAuthority!.toString()).toBe(
      mintAuthorityPDA.toString()
    );
    expect(mintInfo.freezeAuthority!.toString()).toBe(
      mintAuthorityPDA.toString()
    );
    expect(mintInfo.decimals).toBe(decimals);
    expect(mintInfo.supply).toBe(BigInt(mintAmount.toString()));

    // 验证目标 Token 账户
    const destinationAccountInfo = await getAccount(
      provider.connection,
      destinationATA
    );
    expect(destinationAccountInfo.amount.toString()).toBe(
      mintAmount.toString()
    );
    expect(destinationAccountInfo.owner.toString()).toBe(
      signer.publicKey.toString()
    );
    expect(destinationAccountInfo.isFrozen).toBe(false);
  });

  it('Can freeze a token account', async () => {
    // --- 1. 获取需要被冻结的账户信息 ---
    const tokenAccountToFreeze = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      signer.publicKey
    );

    // --- 2. 调用 `freeze_account` 指令 ---
    const txSignature = await program.methods
      .freezeAccount()
      .accounts({
        mint: mintKeypair.publicKey,
        tokenAccount: tokenAccountToFreeze,
        freezeAuthority: mintAuthorityPDA,
      })
      .rpc();

    console.log('`freeze_account` transaction signature:', txSignature);

    // --- 3. 验证账户状态 ---
    const accountInfo = await getAccount(
      provider.connection,
      tokenAccountToFreeze
    );
    expect(accountInfo.isFrozen).toBe(true);
  });

  it('Can thaw a frozen token account', async () => {
    // --- 1. 获取需要被解冻的账户信息 ---
    const tokenAccountToThaw = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      signer.publicKey
    );

    // --- 2. 调用 `thaw_account` 指令 ---
    const txSignature = await program.methods
      .thawAccount()
      .accounts({
        mint: mintKeypair.publicKey,
        tokenAccount: tokenAccountToThaw,
        freezeAuthority: mintAuthorityPDA,
      })
      .rpc();

    console.log('`thaw_account` transaction signature:', txSignature);

    // --- 3. 验证账户状态 ---
    const accountInfo = await getAccount(
      provider.connection,
      tokenAccountToThaw
    );
    expect(accountInfo.isFrozen).toBe(false);
  });

  it('Allows a user to burn their own tokens', async () => {
    // --- 1. 准备工作 ---
    const burnAmount = new anchor.BN(100 * 10 ** 9); // 销毁 100 个代币
    const userTokenAccount = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      signer.publicKey
    );

    const initialAccountInfo = await getAccount(
      provider.connection,
      userTokenAccount
    );
    const initialSupply = await getMint(
      provider.connection,
      mintKeypair.publicKey
    ).then((mint) => mint.supply);

    // --- 2. 调用 `burn_tokens` 指令 ---
    const txSignature = await program.methods
      .burnTokens(burnAmount)
      .accounts({
        mint: mintKeypair.publicKey,
        from: userTokenAccount,
        authority: signer.publicKey,
      })
      .rpc();

    console.log('`burn_tokens` transaction signature:', txSignature);

    // --- 3. 验证状态变化 ---
    const finalAccountInfo = await getAccount(
      provider.connection,
      userTokenAccount
    );
    const finalSupply = await getMint(
      provider.connection,
      mintKeypair.publicKey
    ).then((mint) => mint.supply);

    const expectedFinalAmount =
      BigInt(initialAccountInfo.amount.toString()) -
      BigInt(burnAmount.toString());

    const expectedFinalSupply =
      BigInt(initialSupply.toString()) - BigInt(burnAmount.toString());

    expect(finalAccountInfo.amount).toBe(expectedFinalAmount);
    expect(finalSupply).toBe(expectedFinalSupply);
  });

  it('Fails to freeze if the authority is invalid', async () => {
    // --- 1. 准备一个错误的 authority ---
    const invalidAuthority = Keypair.generate();
    const tokenAccountToFreeze = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      signer.publicKey
    );

    // --- 2. 尝试调用并期望它失败 ---
    // 使用 `expect(...).rejects.toThrow()` 来测试异步函数的错误情况
    await expect(
      program.methods
        .freezeAccount()
        .accounts({
          mint: mintKeypair.publicKey,
          tokenAccount: tokenAccountToFreeze,
          freezeAuthority: invalidAuthority.publicKey, // 使用错误的 authority
        })
        .signers([invalidAuthority]) // 需要错误 authority 签名
        .rpc()
    ).rejects.toThrow();
    // toThrow() 会捕获任何类型的错误，这对于测试合约错误来说足够了。
    // 如果想更精确，可以 .toThrow(/AnchorError|The provided freeze authority is invalid/);
  });
});