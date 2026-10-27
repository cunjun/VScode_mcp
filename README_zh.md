# VS Code MCP Bridge — 为 AI 编程智能体提供实时 IDE 上下文

[English](README.md) | [中文](README_zh.md)

通过模型上下文协议（MCP）把 AI 编程智能体连接到正在运行的 Visual Studio Code 工作区。该桥接扩展通过本地 MCP 服务提供实时编辑器上下文、语言服务器能力、可视化 Diff、受管终端和可控的文件操作。

> 本仓库保存了 VS Code Bridge 源码、安装产物和集成说明，用于将 Codex 及其他兼容 MCP 的智能体连接到 VS Code。

## 为什么需要这个项目

命令行智能体能够读取文件，但通常无法感知编辑器中已经存在的状态，例如当前文件、光标选区、已打开标签页、实时诊断、符号信息和原生 Diff 视图。VS Code MCP Bridge 在 VS Code 内运行 MCP 服务，将智能体请求转换为具备编辑器上下文的操作，从而补齐这部分能力。

典型工作闭环如下：

1. 智能体读取当前编辑器和工作区上下文。
2. VS Code 提供诊断信息及语言服务器分析结果。
3. 修改前通过原生 Diff 界面检查差异。
4. 应用确认后的修改，并再次检查诊断结果。

## 主要特性

- **实时编辑器上下文**：读取当前文件、选区、已打开标签页、工作区信息和诊断结果。
- **语言服务器导航**：查找引用、跳转定义、查看悬浮信息、列出符号、重命名符号和执行代码操作。
- **可视化修改审查**：写入文件前打开 VS Code 原生 Diff。
- **编辑器集成的文件操作**：读取、创建、修改、打开、关闭和安全删除工作区文件。
- **受管终端**：执行短命令，或让长时间运行的进程跨工具调用持续存在。
- **上下文主动推送**：当前文件、选区或诊断变化时通知已连接的智能体。
- **本地优先安全设计**：默认仅监听 `127.0.0.1`，支持 Bearer Token 验证和 VS Code 命令白名单。
- **兼容 MCP 客户端**：可连接任何支持 MCP SSE 传输的客户端。

## 工作原理

```text
AI 编程智能体
      │  MCP over SSE
      ▼
http://127.0.0.1:3333/sse
      │
      ▼
VS Code MCP Bridge 扩展
      ├── 编辑器与工作区上下文
      ├── 语言服务器能力
      ├── 原生 Diff 与文件操作
      └── 受管终端进程
```

扩展在 VS Code 启动完成后运行本地 HTTP 服务，默认连接地址为：

```text
http://127.0.0.1:3333/sse
```

健康检查地址：

```bash
curl http://127.0.0.1:3333/health
```

## 快速开始

### 1. 找到扩展源码

本仓库保存的上游源码位于：

```text
bridge-setup-20260824/
└── vscode-mcp-bridge-src/
    └── vscode-mcp-bridge-main/
```

### 2. 安装依赖并构建

```bash
cd bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main
npm install
npm run build
```

如需生成可安装的 VSIX：

```bash
npm run package
```

在 VS Code 中安装生成的 VSIX，然后重新加载编辑器。扩展会在 VS Code 启动完成后自动启动服务。

### 3. 连接 MCP 客户端

将客户端的 SSE 地址配置为：

```text
http://127.0.0.1:3333/sse
```

具体配置格式取决于使用的 MCP 客户端。本仓库还保存了 Codex 工作流使用的 `connecting-vscode-bridge` 技能及安装说明。

## 可用能力

| 分类 | 示例 |
|---|---|
| 上下文 | 当前文件、选区、标签页、工作区信息 |
| 文件 | 读取、创建、写入、删除、打开、关闭、可视化 Diff |
| 诊断与 LSP | 诊断、引用、定义、悬浮信息、符号、代码操作、重命名 |
| 终端 | 执行命令、启动进程、读取输出、发送输入、终止进程 |
| VS Code | 执行明确加入白名单的编辑器命令 |

完整工具表和命令说明请参阅[扩展 README](bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main/README.md)。

## VS Code 命令

打开命令面板并搜索 `VS Code MCP Bridge`：

| 命令 | 用途 |
|---|---|
| `Start Server` | 启动本地 MCP 服务 |
| `Stop Server` | 停止服务并断开客户端 |
| `Restart Server` | 修改配置后重启服务 |
| `Show Status / Options` | 查看连接状态和服务选项 |
| `Copy Connection URL` | 复制 SSE 连接地址 |

状态栏项目会显示当前端口和连接数量。

## 配置项

| 配置 | 默认值 | 说明 |
|---|---:|---|
| `mcpServer.port` | `3333` | 本地 HTTP 服务端口 |
| `mcpServer.enableContextPush` | `true` | 向智能体推送编辑器和诊断变化 |
| `mcpServer.authToken` | 空 | HTTP 客户端使用的可选 Bearer Token |
| `mcpServer.allowedCommands` | `[]` | 允许智能体执行的 VS Code 命令 ID |
| `mcpServer.terminalStrategy` | `childProcess` | 终端执行及输出捕获策略 |

## 仓库结构

```text
.
├── README.md                         # 英文项目介绍
├── README_zh.md                      # 中文项目介绍
├── bridge-setup-20260824/
│   ├── skill-update-3337/            # Bridge 连接技能源码
│   ├── skills-output/                # 生成的技能产物
│   ├── vscode-mcp-bridge-src/        # VS Code 扩展源码
│   └── vscode-mcp-bridge-main.zip    # 保留的源码压缩包
```

## 安全说明

- 服务默认绑定 `127.0.0.1`，不会暴露给局域网中的其他设备。
- 如果不希望本机其他进程直接访问，请设置 `mcpServer.authToken`。
- `mcpServer.allowedCommands` 应保持最小范围；空列表会禁止远程执行 VS Code 命令。
- 执行可能产生明显影响的修改前，应检查 Diff 和终端命令。
- 不要向仓库提交密码、API Key、访问令牌或机器专用凭据。

## 上游项目与许可证

本仓库保存的扩展源码来自 [jhamama/vscode-mcp-bridge](https://github.com/jhamama/vscode-mcp-bridge)。许可证信息请参阅上游项目及仓库内的 [LICENSE](bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main/LICENSE)。
