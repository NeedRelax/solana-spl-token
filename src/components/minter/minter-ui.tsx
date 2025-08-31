'use client'; // 声明这是一个客户端组件，用于 Next.js 客户端渲染

import { PublicKey } from '@solana/web3.js'; // 导入 Solana web3.js 的 PublicKey 类型
import React, { useEffect, useState } from 'react'; // 导入 React 的核心模块和 hooks
import { ExplorerLink } from '../cluster/cluster-ui'; // 导入 ExplorerLink 组件，用于生成区块链浏览器链接
import { useMinterProgram, useMinterToken } from './minter-data-access'; // 导入自定义 hooks 获取 Minter 程序和代币相关功能
import { Button } from '@/components/ui/button'; // 导入 UI 组件库中的 Button 组件
import { // 导入 UI 组件库中的 Card 相关组件
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Input } from '@/components/ui/input'; // 导入 UI 组件库中的 Input 组件
import { toast } from 'sonner'; // 导入 sonner 库用于显示通知

export function MinterCreateForm({ // 定义 MinterCreateForm 组件，用于创建新代币
                                   onTokenCreated, // 接收一个回调函数，在代币创建成功时调用
                                 }: {
  onTokenCreated: (mint: PublicKey) => void; // 回调函数类型定义，接收新代币的公钥
}) {
  const { createTokenMutation } = useMinterProgram(); // 从 useMinterProgram hook 获取创建代币的 mutation
  const [decimals, setDecimals] = useState(9); // 定义状态 decimals，默认值为 9，表示代币精度
  const [amount, setAmount] = useState(1000); // 定义状态 amount，默认值为 1000，表示初始代币数量

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { // 定义表单提交处理函数
    e.preventDefault(); // 阻止表单默认提交行为
    if (decimals < 0 || decimals > 9) { // 验证代币精度是否在有效范围内
      toast.error('Decimals must be between 0 and 9'); // 显示错误通知
      return;
    }
    if (amount <= 0) { // 验证代币数量是否有效
      toast.error('Amount must be greater than 0'); // 显示错误通知
      return;
    }

    try {
      const newMint = await createTokenMutation.mutateAsync({ // 异步调用创建代币的 mutation
        decimals, // 传递代币精度
        amount, // 传递代币数量
      });
      if (newMint) { // 如果成功创建代币
        onTokenCreated(newMint); // 调用回调函数，传递新代币公钥
      }
    } catch (e) { // 捕获错误
      // Error is already handled by the mutation's onError callback
      // 错误已由 mutation 的 onError 回调处理，无需额外处理
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <label htmlFor="decimals" className="w-32">
          Decimals:
        </label>
        <Input // 精度输入框
          id="decimals" // 输入框 ID
          type="number" // 输入类型为数字
          value={decimals} // 绑定状态值
          onChange={(e) => setDecimals(parseInt(e.target.value, 10))} // 更新精度状态
          min="0" // 最小值
          max="9" // 最大值
          className="max-w-xs" // 设置最大宽度
        />
      </div>
      <div className="flex items-center gap-4">
        <label htmlFor="amount" className="w-32">
          Initial Amount:
        </label>
        <Input // 数量输入框
          id="amount" // 输入框 ID
          type="number" // 输入类型为数字
          value={amount} // 绑定状态值
          onChange={(e) => setAmount(parseFloat(e.target.value))} // 更新数量状态
          min="1" // 最小值
          className="max-w-xs" // 设置最大宽度
        />
      </div>
      <Button // 提交按钮
        type="submit" // 按钮类型为提交
        disabled={createTokenMutation.isPending} // 在 mutation 进行时禁用按钮
        className="w-full md:w-auto" // 设置按钮宽度
      >
        Create Token {createTokenMutation.isPending && '...'}
      </Button>
    </form>
  );
}

export function MinterTokenList() { // 定义 MinterTokenList 组件，用于显示和管理代币列表
  const { getProgramAccount } = useMinterProgram(); // 从 useMinterProgram hook 获取程序账户信息查询
  const [managedMints, setManagedMints] = useState<PublicKey[]>([]); // 定义状态 managedMints，存储管理的代币公钥列表
  const [manualMintAddress, setManualMintAddress] = useState(''); // 定义状态 manualMintAddress，存储手动输入的代币地址

  useEffect(() => { // 使用 useEffect 在组件挂载时加载代币列表
    const savedMintsStr = localStorage.getItem('managedMints'); // 从 localStorage 获取已保存的代币列表
    if (savedMintsStr) { // 如果存在保存的代币列表
      try {
        const mints = JSON.parse(savedMintsStr).map( // 解析并转换为 PublicKey 数组
          (addr: string) => new PublicKey(addr)
        );
        setManagedMints(mints); // 更新状态
      } catch (e) { // 捕获解析错误
        console.error('Failed to parse mints from localStorage', e); // 打印错误信息
        localStorage.removeItem('managedMints'); // 移除无效的 localStorage 数据
      }
    }
  }, []); // 空依赖数组，仅在组件挂载时运行

  const saveMints = (mints: PublicKey[]) => { // 定义保存代币列表的函数
    localStorage.setItem( // 将代币列表保存到 localStorage
      'managedMints',
      JSON.stringify(mints.map((m) => m.toBase58())) // 转换为 Base58 字符串
    );
    setManagedMints(mints); // 更新状态
  };

  const addMint = (mint: PublicKey) => { // 定义添加代币的函数
    if (managedMints.some((m) => m.equals(mint))) { // 检查代币是否已存在
      toast.info('This token is already in your list.'); // 显示提示信息
      return;
    }
    const newMints = [...managedMints, mint]; // 添加新代币到列表
    saveMints(newMints); // 保存更新后的列表
  };

  const removeMint = (mintToRemove: PublicKey) => { // 定义移除代币的函数
    const newMints = managedMints.filter((m) => !m.equals(mintToRemove)); // 过滤掉指定代币
    saveMints(newMints); // 保存更新后的列表
  };

  const handleManualAdd = () => { // 定义手动添加代币的处理函数
    if (!manualMintAddress) return; // 如果输入为空，直接返回
    try {
      const mintKey = new PublicKey(manualMintAddress); // 尝试将输入转换为 PublicKey
      addMint(mintKey); // 添加代币
      setManualMintAddress(''); // 清空输入框
    } catch (e) { // 捕获无效公钥错误
      toast.error('Invalid Mint Address'); // 显示错误通知
    }
  };

  if (getProgramAccount.isLoading) { // 如果程序账户信息正在加载
    return (
      <div className="w-full text-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  if (!getProgramAccount.data?.value) { // 如果程序账户不存在
    return (
      <div className="alert alert-info flex justify-center">
        <span>
          Program account not found. Make sure you have deployed the program and
          are on the correct cluster.
        </span>
      </div>
    );
  }

  return (
    <div className={'space-y-6 mt-8'}>
      <Card>
        <CardHeader>
          <CardTitle>Manage Existing Token</CardTitle>
          <CardDescription>
            Add a token mint address to manage its features.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input // 输入框用于手动输入代币地址
            placeholder="Enter Token Mint Address..." // 占位符
            value={manualMintAddress} // 绑定状态值
            onChange={(e) => setManualMintAddress(e.target.value)} // 更新输入状态
          />
          <Button onClick={handleManualAdd}>Add</Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <h2 className={'text-2xl'}>My Managed Tokens</h2>
      </div>

      {managedMints.length > 0 ? ( // 如果有管理的代币
        <div className="grid md:grid-cols-2 gap-4">
          {managedMints.map((mint) => ( // 遍历代币列表
            <MinterTokenCard // 渲染单个代币卡片
              key={mint.toString()} // 使用代币公钥作为唯一键
              mint={mint} // 传递代币公钥
              onRemove={() => removeMint(mint)} // 传递移除代币的回调
            />
          ))}
        </div>
      ) : ( // 如果没有管理的代币
        <div className="text-center py-8">
          <p>No tokens are being managed.</p>
          <p className="text-sm text-muted-foreground">
            Create a new token above or add an existing one to start.
          </p>
        </div>
      )}
    </div>
  );
}

function MinterTokenCard({ // 定义 MinterTokenCard 组件，用于显示单个代币的管理功能
                           mint, // 代币公钥
                           onRemove, // 移除代币的回调函数
 }: {
  mint: PublicKey;
  onRemove: () => void;
}) {
  const { freezeMutation, thawMutation, burnMutation } = useMinterToken({ // 从 useMinterToken hook 获取代币操作 mutation
    mint, // 传递代币公钥
  });

  const handleFreeze = () => { // 定义冻结账户的处理函数
    const target = window.prompt('Enter the token account address to freeze:'); // 弹出输入框获取目标账户地址
    if (target) { // 如果输入有效
      try {
        freezeMutation.mutateAsync(new PublicKey(target)); // 异步调用冻结 mutation
      } catch (e) { // 捕获无效公钥错误
        toast.error('Invalid Public Key'); // 显示错误通知
      }
    }
  };

  const handleThaw = () => { // 定义解冻账户的处理函数
    const target = window.prompt('Enter the token account address to thaw:'); // 弹出输入框获取目标账户地址
    if (target) { // 如果输入有效
      try {
        thawMutation.mutateAsync(new PublicKey(target)); // 异步调用解冻 mutation
      } catch (e) { // 捕获无效公钥错误
        toast.error('Invalid Public Key'); // 显示错误通知
      }
    }
  };

  const handleBurn = () => { // 定义销毁代币的处理函数
    const amountStr = window.prompt('Enter amount to burn:'); // 弹出输入框获取销毁数量
    const amount = Number(amountStr); // 转换为数字
    if (amountStr && !isNaN(amount) && amount > 0) { // 验证输入有效性
      burnMutation.mutateAsync(amount); // 异步调用销毁 mutation
    } else { // 如果输入无效
      toast.error('Invalid amount'); // 显示错误通知
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Managed Token</CardTitle>
            <CardDescription>
              <ExplorerLink path={`address/${mint}`} label={mint.toBase58()} />
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={onRemove} className="text-lg">
            &times;
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button // 冻结账户按钮
          variant="outline" // 按钮样式
          onClick={handleFreeze} // 点击触发冻结操作
          disabled={freezeMutation.isPending} // 在 mutation 进行时禁用
        >
          Freeze Acct {freezeMutation.isPending && '...'}
        </Button>
        <Button // 解冻账户按钮
          variant="outline" // 按钮样式
          onClick={handleThaw} // 点击触发解冻操作
          disabled={thawMutation.isPending} // 在 mutation 进行时禁用
        >
          Thaw Acct {thawMutation.isPending && '...'}
        </Button>
        <Button // 销毁代币按钮
          variant="destructive" // 按钮样式（红色警告样式）
          onClick={handleBurn} // 点击触发销毁操作
          disabled={burnMutation.isPending} // 在 mutation 进行时禁用
        >
          Burn My Tokens {burnMutation.isPending && '...'}
        </Button>
      </CardContent>
    </Card>
  );
}