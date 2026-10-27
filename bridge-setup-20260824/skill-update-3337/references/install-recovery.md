# Extension Installation Recovery

Use only when `jhamama.vscode-mcp-bridge-ext` is absent or the selected window cannot start its server.

1. Confirm the target project is `https://github.com/jhamama/vscode-mcp-bridge` and inspect its current README/package metadata before installation.
2. Prefer an official VSIX or Marketplace package. If none is available, download the official source archive, install dependencies, and run the repository's package script.
3. If `esbuild` returns `spawn EBUSY` in a protected workspace, build in a unique Windows temporary directory; do not weaken security settings.
4. Install the resulting VSIX with VS Code, then start/restart only the selected window's server.
5. Verify both `/health` and an SSE handshake through `mcp-remote`.

Expected Codex registration for an SSE endpoint:

```text
codex mcp add <deterministic-name> -- npx.cmd -y mcp-remote http://127.0.0.1:<port>/sse
```

Do not claim the current Codex task gained tools after editing configuration. Tool inventory refresh requires a new task or Codex restart.
