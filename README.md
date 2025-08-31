# 全功能 SPL 代币铸造与管理平台 (Solana)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

这是一个基于 Solana 和 Anchor 框架构建的全栈 dApp 项目。它提供了一个完整的解决方案，用于创建、铸造、管理和销毁 SPL 代币。本项目的核心是一个 Anchor 智能合约，它使用程序派生地址 (PDA) 作为代币的铸造和冻结权限，确保了操作的安全性和中心化管理能力。配套的 React 前端界面为用户提供了直观、友好的交互体验。

## ✨ 功能特性

-   **创建 SPL 代币**: 用户可以通过 UI 表单轻松创建自定义的 SPL 代币，并设置精度和小数位数。
-   **初始铸造**: 在创建代币的同时，向创建者的钱包地址铸造指定数量的初始代币。
-   **冻结与解冻**: 程序管理员（即程序本身）可以冻结或解冻网络上的任意一个该代币的持有账户。
-   **销毁代币**: 用户可以销毁自己钱包中持有的代币，减少总供应量。
-   **响应式前端**: 使用 React 和 Next.js 构建，提供现代化的用户界面。
-   **客户端状态管理**: 通过 `localStorage` 持久化用户管理的代币列表，提升用户体验。
-   **实时的交易反馈**: 集成 `sonner` toast 通知，为用户的每一步操作提供清晰的成功或失败反馈。

## 🛠️ 技术栈

-   **智能合约**: Rust, Anchor Framework
-   **区块链**: Solana
-   **前端框架**: React, Next.js
-   **UI 组件库**: Shadcn/UI, Tailwind CSS
-   **状态管理**: TanStack Query (React Query) 用于管理链上数据状态
-   **钱包集成**: Solana Wallet Adapter
-   **测试**: TypeScript, Mocha, Chai

## 📂 项目结构

```
.
├── anchor/                  # Anchor 项目根目录
│   ├── programs/minter/     # Minter 智能合约源码
│   └── tests/minter.ts      # 集成测试脚本
├── app/                     # Next.js 前端应用目录
│   ├── components/
│   │   ├── minter/
│   │   │   ├── minter-data-access.ts  # 数据访问层 (React Hooks)
│   │   │   └── minter-ui.tsx          # UI 组件
│   │   └── ...
│   └── app/minter/page.tsx  # Minter 功能主页
├── package.json
└── README.md
```

## 🚀 快速开始

### 先决条件

在开始之前，请确保您已安装以下工具：
-   [Node.js v18 或更高版本](https://nodejs.org/en/)
-   [Rust 工具链](https://www.rust-lang.org/tools/install)
-   [Solana CLI](https://docs.solana.com/cli/install)
-   [Anchor CLI](https://www.anchor-lang.com/docs/installation)

### 安装与部署

1.  **克隆仓库**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```

2.  **安装前端依赖**
    ```bash
    npm install
    ```

3.  **构建 Anchor 智能合约**
    ```bash
    anchor build
    ```

4.  **启动本地 Solana 测试验证器**
    在一个新的终端窗口中运行：
    ```bash
    solana-test-validator
    ```

5.  **部署智能合约到本地网络**
    ```bash
    anchor deploy
    ```
    部署成功后，请复制输出的程序 ID (Program ID)，并更新前端代码中相应的位置（通常在 `@project/anchor` 或类似辅助库中）。

6.  **运行前端开发服务器**
    ```bash
    npm run dev
    ```
    现在，您可以在浏览器中打开 `http://localhost:3000` 访问应用。

## 🕹️ 如何使用

1.  **连接钱包**: 访问应用主页，点击 "Connect Wallet" 按钮并连接您的 Phantom 或其他兼容钱包（请确保钱包网络已切换到 "Localnet"）。
2.  **创建新代币**:
    -   在 "Create a new SPL Token" 表单中，输入您想要的代币精度 (Decimals) 和初始铸造数量 (Initial Amount)。
    -   点击 "Create Token" 按钮并发起交易。
    -   交易成功后，您将收到通知，新创建的代币会自动出现在下方的 "My Managed Tokens" 列表中。
3.  **管理代币**:
    -   **手动添加**: 如果您想管理一个已存在的代币，可以在 "Manage Existing Token" 输入框中粘贴代币的 Mint 地址，然后点击 "Add"。
    -   **冻结账户**: 点击 "Freeze Acct" 按钮，在弹出的提示框中输入目标用户的**代币账户地址**（非钱包地址），程序将冻结该账户。
    -   **解冻账户**: 点击 "Thaw Acct" 按钮，同样输入目标用户的代币账户地址以解冻。
    -   **销毁代币**: 点击 "Burn My Tokens" 按钮，输入您希望从自己账户中销毁的代币数量。

## ✅ 运行测试

要验证智能合约的逻辑是否正确，可以运行集成测试套件：

```bash
anchor test
```
该命令会自动启动测试验证器，部署合约，并执行 `tests/minter.ts` 文件中的所有测试用例。

## 📜 智能合约概览

Minter 智能合约 (`programs/minter/src/lib.rs`) 定义了代币生命周期的核心逻辑。

-   **核心设计**: 使用一个由种子 `"mint_authority"` 派生出的 **PDA** 同时作为新代币的 `mint_authority` 和 `freeze_authority`。这使得合约拥有了管理其创建的所有代币的最高权限。

-   **主要指令 (Instructions)**:
    -   `create_token`: 初始化一个新的 Mint 账户，设置 PDA 为权限，并向调用者铸造初始代币。
    -   `freeze_account`: 冻结一个指定的代币账户。只有 PDA 才能调用此指令。
    -   `thaw_account`: 解冻一个指定的代币账户。同样，只有 PDA 才能调用。
    -   `burn_tokens`: 允许代币持有者销毁自己账户中的代币。此操作由用户自己签名授权。

## 🖥️ 前端架构概览

前端应用采用分层架构，确保了代码的清晰和可维护性。

-   **数据访问层 (`minter-data-access.ts`)**:
    -   封装了所有与 Solana 链交互的逻辑。
    -   使用自定义 React Hooks (`useMinterProgram`, `useMinterToken`) 暴露功能。
    -   利用 `TanStack Query` 管理链上数据的请求、缓存和状态（加载中/成功/失败），极大地简化了异步逻辑。

-   **UI 组件层 (`minter-ui.tsx`)**:
    -   包含所有可复用的 React 组件，如创建表单 (`MinterCreateForm`) 和代币管理卡片 (`MinterTokenCard`)。
    -   这些组件是“哑”组件，只负责渲染和触发从 props 接收的回调函数。

-   **功能主页 (`minter-feature.tsx`)**:
    -   作为容器组件，它组合了数据访问 Hooks 和 UI 组件。
    -   管理页面级别的状态，如钱包连接状态和组件间的通信（例如，创建代币后刷新列表）。

## 📄 许可证

本项目采用 [MIT 许可证](https://opensource.org/licenses/MIT)。