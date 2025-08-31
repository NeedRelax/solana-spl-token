'use client'; // 声明这是一个客户端组件，用于 Next.js 客户端渲染

import { useWallet } from '@solana/wallet-adapter-react'; // 导入 Solana 钱包适配器的 hook，用于获取钱包信息
import { WalletButton } from '../solana/solana-provider'; // 导入钱包连接按钮组件
import { ExplorerLink } from '../cluster/cluster-ui'; // 导入 ExplorerLink 组件，用于生成区块链浏览器链接
import { useMinterProgram } from './minter-data-access'; // 导入自定义 hook 获取 Minter 程序相关功能
import { MinterCreateForm, MinterTokenList } from './minter-ui'; // 导入代币创建表单和代币列表组件
import { AppHero } from '../app-hero'; // 导入 AppHero 组件，用于显示页面标题和描述
import { ellipsify } from '@/lib/utils'; // 导入 ellipsify 工具函数，用于截断字符串显示
import { useState } from 'react'; // 导入 React 的 useState hook，用于管理组件状态
import { PublicKey } from '@solana/web3.js'; // 导入 Solana web3.js 的 PublicKey 类型

export default function MinterFeature() { // 定义 MinterFeature 组件，作为代币管理功能的主入口
  const { publicKey } = useWallet(); // 获取当前钱包的公钥
  const { programId } = useMinterProgram(); // 从 useMinterProgram hook 获取 Minter 程序的公钥 ID
  const [refreshKey, setRefreshKey] = useState(0); // 定义状态 refreshKey，用于触发代币列表组件的重新渲染

  const handleTokenCreated = (mint: PublicKey) => { // 定义处理代币创建的回调函数，接收新创建的代币公钥

    const savedMintsStr = localStorage.getItem('managedMints') || '[]'; // 从 localStorage 获取已保存的代币列表，若不存在则返回空数组
    const mints = JSON.parse(savedMintsStr); // 解析存储的代币列表为数组
    if (!mints.includes(mint.toBase58())) { // 检查新代币是否已存在于列表中
      mints.push(mint.toBase58()); // 如果不存在，将新代币公钥添加到列表
      localStorage.setItem('managedMints', JSON.stringify(mints)); // 将更新后的代币列表保存到 localStorage
    }
    setRefreshKey((prev) => prev + 1); // 更新 refreshKey，触发代币列表组件重新渲染
  };

  return publicKey ? ( // 根据钱包是否连接，渲染不同的内容
    <div>
      <AppHero // 渲染页面标题和描述
        title="SPL Token Minter" // 设置标题为 "SPL Token Minter"
        subtitle="Create a new SPL Token by filling out the form below. Once created, it will appear in your 'Managed Tokens' list where you can interact with it." // 设置描述信息
      >
        <p className="mb-6">
          <ExplorerLink // 显示程序 ID 的链接
            path={`account/${programId}`} // 设置链接路径为程序账户
            label={ellipsify(programId.toString())} // 显示截断后的程序 ID
          />
        </p>
        <MinterCreateForm onTokenCreated={handleTokenCreated} />
      </AppHero>
      <MinterTokenList key={refreshKey} />
    </div>
  ) : ( // 未连接钱包时的渲染内容
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  );
}