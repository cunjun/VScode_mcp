---
name: connecting-vscode-bridge
description: Use when VS Code is open but code cannot be read or modified reliably, protected files expose encrypted bytes, VS Code MCP tools are missing or disconnected, or multiple VS Code projects need independent connections.
---

# Connecting VS Code Bridge

Connect only to the VS Code window that owns the current workspace. A live port is not proof of workspace identity.

## Workflow

1. Canonicalize the current workspace path. List VS Code windows and select the unique window for that path. If zero or multiple windows match, stop and ask the user; never guess from focus or port availability.
2. Run `scripts/plan_bridge.ps1 -WorkspacePath <path>`. It returns a deterministic MCP name and the first free port from 3333. Same-basename projects differ by path hash.
3. In the selected VS Code window, set workspace-scoped `mcpServer.port` to the planned port. Start or restart `VS Code MCP Bridge`. Do not reload other windows.
4. Verify `http://127.0.0.1:<port>/health` reports version and status `ok`.
5. Inspect existing Codex MCP entries. Reuse an exact name/endpoint match; update a stale same-name entry; never append duplicates. For this SSE server, register `codex mcp add <name> -- npx.cmd -y mcp-remote http://127.0.0.1:<port>/sse`.
6. Establish an actual SSE handshake. A health response alone is insufficient.
7. New MCP tools do not appear dynamically in the current Codex task. If the server was newly added, tell the user to open a new task or restart Codex, then continue there.
8. Before any write, call `get_workspace_info` and require its canonical root to equal the intended workspace. Require every target path to stay under that root. Use `show_diff`, then `write_file`; finish with `read_file` and `get_diagnostics`.

## Multiple Projects

- One VS Code window/workspace = one dedicated port and one deterministic MCP name.
- Do not share port 3333 merely because it responds.
- Do not modify through a Bridge whose workspace identity is missing or ambiguous.
- Do not fall back to raw shell rewrites when protected files cannot be read faithfully.

## Recovery

If the required extension or server is missing, read [references/install-recovery.md](references/install-recovery.md). Stop after two repeated failures with the same cause and report the exact blocker.

## Common Mistakes

| Mistake | Required response |
|---|---|
| Using the only live Bridge | Verify workspace identity first. |
| Changing user-level port | Use workspace scope so other windows remain independent. |
| Reusing basename-only MCP names | Include the normalized-path hash. |
| Claiming connection from `/health` | Verify the SSE handshake too. |
| Continuing in the same task after registration | Restart/new task to load the tool inventory. |
