'use client'; // 声明这是一个客户端组件，用于 Next.js 客户端渲染

import { // 导入 Anchor 相关函数，用于与 Solana 程序交互
  getMinterProgram, // 获取 Minter 程序实例
  getMinterProgramId, // 获取 Minter 程序的公钥 ID
} from '@project/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react'; // 导入 Solana 钱包适配器的 hooks，用于获取连接和钱包信息
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'; // 导入 Solana web3.js 的类型和工具
import { useMutation, useQuery } from '@tanstack/react-query'; // 导入 TanStack Query 的 hooks，用于管理异步数据请求
import { useMemo } from 'react'; // 导入 React 的 useMemo hook，用于性能优化
import { useCluster } from '../cluster/cluster-data-access'; // 导入自定义 hook 获取当前集群信息
import { useAnchorProvider } from '../solana/solana-provider'; // 导入自定义 hook 获取 Anchor 提供者
import { useTransactionToast } from '../use-transaction-toast'; // 导入自定义 hook 显示交易提示
import { toast } from 'sonner'; // 导入 sonner 库用于显示通知
import { BN } from '@coral-xyz/anchor'; // 导入 Anchor 的 BN 类处理大整数
import { getAssociatedTokenAddressSync } from '@solana/spl-token'; // 导入函数获取关联代币账户地址

export function useMinterProgram() { // 定义 useMinterProgram hook，提供与 Minter 程序交互的功能
  const { connection } = useConnection(); // 获取 Solana 区块链连接对象
  const { cluster } = useCluster(); // 获取当前集群信息（如 mainnet、devnet）
  const transactionToast = useTransactionToast(); // 获取交易提示函数
  const provider = useAnchorProvider(); // 获取 Anchor 提供者，包含连接和签名者信息
  const { publicKey } = useWallet(); // 获取当前钱包的公钥

  const programId = useMemo( // 使用 useMemo 缓存程序 ID，避免重复计算
    () => getMinterProgramId(cluster.network as Cluster), // 根据集群网络获取 Minter 程序的公钥 ID
    [cluster] // 依赖 cluster，当 cluster 变化时重新计算
  );
  const program = useMemo( // 使用 useMemo 缓存程序实例，避免重复创建
    () => getMinterProgram(provider, programId), // 根据提供者和程序 ID 创建 Minter 程序实例
    [provider, programId] // 依赖 provider 和 programId
  );

  const getProgramAccount = useQuery({ // 使用 TanStack Query 获取程序账户信息
    queryKey: ['get-program-account', { cluster }], // 定义查询键，包含集群信息
    queryFn: () => connection.getParsedAccountInfo(programId), // 查询函数，获取程序账户的解析信息
  });

  const createTokenMutation = useMutation({ // 定义创建代币的 mutation
    mutationKey: ['minter', 'createToken', { cluster }], // 定义 mutation 键
    mutationFn: async (input: { decimals: number; amount: number }) => { // 定义异步 mutation 函数，接收代币精度和数量
      if (!publicKey) throw new Error('Wallet not connected'); // 检查钱包是否连接

      const mintKeypair = Keypair.generate(); // 生成新的代币账户密钥对
      const mintAuthorityPDA = PublicKey.findProgramAddressSync( // 计算代币权限的 PDA（程序派生地址）
        [Buffer.from('mint_authority')], // 使用 'mint_authority' 作为种子
        programId // 程序 ID
      )[0];
      const destinationATA = getAssociatedTokenAddressSync( // 计算接收者的关联代币账户地址
        mintKeypair.publicKey, // 代币账户公钥
        publicKey // 用户公钥
      );
      const mintAmount = new BN(input.amount * 10 ** input.decimals); // 将代币数量转换为链上单位（考虑精度）

      await program.methods // 调用程序的 createToken 方法
        .createToken(input.decimals, mintAmount) // 设置代币精度和数量
        .accounts({ // 指定交易账户
          mint: mintKeypair.publicKey, // 代币账户
          mintAuthority: mintAuthorityPDA, // 代币权限 PDA
          destination: destinationATA, // 接收者的关联代币账户
          signer: publicKey, // 签名者（用户公钥）
        })
        .signers([mintKeypair]) // 指定代币账户密钥对作为签名者
        .rpc(); // 执行远程过程调用（RPC）提交交易

      return mintKeypair.publicKey; // 返回新创建的代币账户公钥
    },
    onSuccess: (mintPublicKey) => { // 成功时的回调
      transactionToast(`Token ${mintPublicKey.toBase58()} created!`); // 显示交易成功提示
      toast.success('Token created successfully!'); // 显示成功通知
    },
    onError: (err: Error) => { // 失败时的回调
      toast.error(`Failed to create token: ${err.message}`); // 显示错误通知
    },
  });

  return { // 返回 hook 的结果
    program, // Minter 程序实例
    programId, // 程序公钥 ID
    getProgramAccount, // 获取程序账户信息的查询
    createTokenMutation, // 创建代币的 mutation
  };
}

export function useMinterToken({ mint }: { mint: PublicKey }) { // 定义 useMinterToken hook，处理特定代币的操作
  const { cluster } = useCluster(); // 获取当前集群信息
  const transactionToast = useTransactionToast(); // 获取交易提示函数
  const { program, programId } = useMinterProgram(); // 获取 Minter 程序和程序 ID
  const { publicKey } = useWallet(); // 获取当前钱包公钥

  const mintAuthorityPDA = useMemo( // 使用 useMemo 缓存代币权限 PDA
    () =>
      PublicKey.findProgramAddressSync( // 计算代币权限的 PDA
        [Buffer.from('mint_authority')], // 使用 'mint_authority' 作为种子
        programId // 程序 ID
      )[0],
    [programId] // 依赖 programId
  );

  const freezeMutation = useMutation({ // 定义冻结账户的 mutation
    mutationKey: ['minter', 'freeze', { cluster, mint }], // 定义 mutation 键
    mutationFn: async (targetAccount: PublicKey) => { // 定义异步 mutation 函数，接收目标账户
      return program.methods // 调用程序的 freezeAccount 方法
        .freezeAccount() // 无参数方法
        .accounts({ // 指定交易账户
          mint: mint, // 代币账户
          tokenAccount: targetAccount, // 目标代币账户
          freezeAuthority: mintAuthorityPDA, // 冻结权限 PDA
        })
        .rpc(); // 执行 RPC 提交交易
    },
    onSuccess: (tx) => { // 成功时的回调
      transactionToast(tx); // 显示交易成功提示
      toast.success('Account frozen successfully!'); // 显示成功通知
    },
    onError: (err: Error) => toast.error(`Freeze failed: ${err.message}`), // 失败时显示错误通知
  });

  const thawMutation = useMutation({ // 定义解冻账户的 mutation
    mutationKey: ['minter', 'thaw', { cluster, mint }], // 定义 mutation 键
    mutationFn: async (targetAccount: PublicKey) => { // 定义异步 mutation 函数，接收目标账户
      return program.methods // 调用程序的 thawAccount 方法
        .thawAccount() // 无参数方法
        .accounts({ // 指定交易账户
          mint: mint, // 代币账户
          tokenAccount: targetAccount, // 目标代币账户
          freezeAuthority: mintAuthorityPDA, // 冻结权限 PDA
        })
        .rpc(); // 执行 RPC 提交交易
    },
    onSuccess: (tx) => { // 成功时的回调
      transactionToast(tx); // 显示交易成功提示
      toast.success('Account thawed successfully!'); // 显示成功通知
    },
    onError: (err: Error) => toast.error(`Thaw failed: ${err.message}`), // 失败时显示错误通知
  });

  const burnMutation = useMutation({
    mutationKey: ['minter', 'burn', { cluster, mint }],
    mutationFn: async (amount: number) => {
      if (!publicKey) throw new Error('Wallet not connected');
      const userAta = getAssociatedTokenAddressSync(mint, publicKey);

      // 1. 获取账户信息
      const mintInfo = await program.provider.connection.getParsedAccountInfo(
        mint
      );

      // 2. 检查账户是否存在
      if (!mintInfo.value) {
        throw new Error('Mint account not found.');
      }

      const data = mintInfo.value.data;

      // 3. [核心修复] 使用类型守卫
      // 检查 'parsed' 属性是否存在于 data 对象中，并且 data 不是 Buffer 的实例
      // 这样 TypeScript 在 if 块内部就能确定 data 是 ParsedAccountData 类型
      if (!('parsed' in data)) {
        throw new Error('Failed to parse mint account data.');
      }

      // 4. 安全地访问 decimals
      const decimals = data.parsed.info.decimals as number;
      const burnAmount = new BN(amount * 10 ** decimals);

      return program.methods
        .burnTokens(burnAmount)
        .accounts({
          mint: mint,
          from: userAta,
          authority: publicKey,
        })
        .rpc();
    },
    onSuccess: (tx) => {
      transactionToast(tx);
      toast.success('Tokens burned successfully!');
    },
    onError: (err: Error) => toast.error(`Burn failed: ${err.message}`),
  });

  return {
    freezeMutation,
    thawMutation,
    burnMutation,
  };
}