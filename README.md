# VS Code MCP Bridge — Live IDE Context for AI Coding Agents

[English](README.md) | [中文](README_zh.md)

Connect AI coding agents to a running Visual Studio Code workspace through the Model Context Protocol (MCP). The bridge exposes live editor context, language-server intelligence, visual diffs, managed terminals, and controlled file operations through a local MCP server.

> This repository preserves the bridge source, setup artifacts, and integration notes used to connect Codex and other MCP-compatible agents to VS Code.

## Why this project

Command-line agents can read files, but they normally cannot see the state that already exists inside the editor: the active file, current selection, open tabs, diagnostics, symbol information, or native diff views. VS Code MCP Bridge closes that gap by running an MCP server inside VS Code and translating agent requests into editor-aware operations.

The result is a tighter feedback loop:

1. The agent reads the current editor and workspace context.
2. VS Code provides diagnostics and language-server results.
3. Proposed changes can be reviewed in a native visual diff.
4. The agent applies the approved edit and checks diagnostics again.

## Key features

- **Live editor context** — read the active file, selection, open tabs, workspace information, and diagnostics.
- **Language-server navigation** — find references, go to definitions, inspect hover information, list symbols, rename symbols, and use code actions.
- **Visual change review** — open a native VS Code diff before writing a file.
- **Editor-integrated file operations** — read, create, update, open, close, and safely delete workspace files.
- **Managed terminals** — run short commands or keep long-running processes available across tool calls.
- **Context push** — notify connected agents when the active file, selection, or diagnostics change.
- **Local-first security** — listen on `127.0.0.1` by default, with optional bearer-token authentication and an allowlist for VS Code commands.
- **MCP compatibility** — connect any client that supports MCP over SSE.

## How it works

```text
AI coding agent
      │  MCP over SSE
      ▼
http://127.0.0.1:3333/sse
      │
      ▼
VS Code MCP Bridge extension
      ├── Editor and workspace context
      ├── Language Server Protocol features
      ├── Native diff and file operations
      └── Managed terminal processes
```

The extension starts an HTTP server when VS Code finishes loading. The default endpoint is:

```text
http://127.0.0.1:3333/sse
```

Health check:

```bash
curl http://127.0.0.1:3333/health
```

## Quick start

### 1. Locate the extension source

The preserved upstream source is stored at:

```text
bridge-setup-20260824/
└── vscode-mcp-bridge-src/
    └── vscode-mcp-bridge-main/
```

### 2. Install dependencies and build

```bash
cd bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main
npm install
npm run build
```

To create an installable VSIX package:

```bash
npm run package
```

Install the generated VSIX in VS Code, then reload the editor. The server starts automatically after VS Code startup.

### 3. Connect an MCP client

Configure the client to use the SSE endpoint:

```text
http://127.0.0.1:3333/sse
```

The exact configuration format depends on the MCP client. This repository also contains the `connecting-vscode-bridge` skill and setup notes used by Codex-based workflows.

## Available capabilities

| Area | Examples |
|---|---|
| Context | Active file, selection, open tabs, workspace information |
| Files | Read, create, write, delete, open, close, visual diff |
| Diagnostics and LSP | Diagnostics, references, definitions, hover, symbols, code actions, rename |
| Terminals | Run commands, spawn processes, read output, send input, terminate processes |
| VS Code | Execute explicitly allowlisted editor commands |

For the complete tool table and command reference, see the [extension README](bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main/README.md).

## VS Code commands

Open the Command Palette and search for `VS Code MCP Bridge`:

| Command | Purpose |
|---|---|
| `Start Server` | Start the local MCP server |
| `Stop Server` | Stop the server and disconnect clients |
| `Restart Server` | Restart after changing settings |
| `Show Status / Options` | Inspect connections and server options |
| `Copy Connection URL` | Copy the SSE endpoint |

The status-bar item shows the active port and current connection count.

## Configuration

| Setting | Default | Description |
|---|---:|---|
| `mcpServer.port` | `3333` | Local HTTP server port |
| `mcpServer.enableContextPush` | `true` | Push editor and diagnostic changes to connected agents |
| `mcpServer.authToken` | Empty | Optional bearer token required by HTTP clients |
| `mcpServer.allowedCommands` | `[]` | VS Code command IDs agents may execute |
| `mcpServer.terminalStrategy` | `childProcess` | Terminal execution and output-capture strategy |

## Repository layout

```text
.
├── README.md                         # English project overview
├── README_zh.md                      # Chinese project overview
├── bridge-setup-20260824/
│   ├── skill-update-3337/            # Bridge connection skill source
│   ├── skills-output/                # Generated skill output
│   ├── vscode-mcp-bridge-src/        # VS Code extension source
│   └── vscode-mcp-bridge-main.zip    # Preserved source archive
```

## Security notes

- The server binds to `127.0.0.1` by default and is not exposed to other machines on the network.
- Set `mcpServer.authToken` when local processes should not have unrestricted access.
- Keep `mcpServer.allowedCommands` minimal; an empty list disables remote VS Code command execution.
- Review diffs and terminal commands before allowing an agent to make consequential changes.
- Do not commit passwords, API keys, access tokens, or machine-specific credentials.

## Upstream and license

The extension source preserved here originates from [jhamama/vscode-mcp-bridge](https://github.com/jhamama/vscode-mcp-bridge). Refer to the upstream project and the bundled [LICENSE](bridge-setup-20260824/vscode-mcp-bridge-src/vscode-mcp-bridge-main/LICENSE) for licensing details.
