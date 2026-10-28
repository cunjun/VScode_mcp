#!/usr/bin/env node

import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

export const DEFAULT_PORTS = Object.freeze([3333, 3334, 3335, 3336, 3337])

const MUTATING_FILE_TOOLS = new Set([
  'write_file',
  'create_file',
  'delete_file',
  'apply_code_action',
  'rename_symbol',
])

const FILE_PATH_TOOLS = new Set([
  'read_file',
  'write_file',
  'create_file',
  'delete_file',
  'open_file',
  'close_file',
  'show_diff',
  'get_diagnostics',
  'find_references',
  'go_to_definition',
  'get_hover',
  'get_code_actions',
  'apply_code_action',
  'rename_symbol',
  'get_document_symbols',
])

function usage() {
  return `用法：
  node scripts/vscode-mcp-client.mjs check [--workspace <路径>] [--port <端口>]
  node scripts/vscode-mcp-client.mjs list [--workspace <路径>] [--port <端口>]
  node scripts/vscode-mcp-client.mjs call <工具名> [JSON参数] [--workspace <路径>] [--port <端口>]

选项：
  --workspace <路径>  校验 VS Code 工作区；写文件类工具必须提供
  --port <端口>       只连接指定端口；省略时依次探测 3333–3337
  --token <令牌>      Bearer Token，也可用 VSCODE_MCP_TOKEN 环境变量
  --help              显示帮助

示例：
  node scripts/vscode-mcp-client.mjs check --workspace /path/to/project
  node scripts/vscode-mcp-client.mjs call read_file '{"filePath":"/path/to/project/a.cpp"}' --workspace /path/to/project
  node scripts/vscode-mcp-client.mjs call write_file '{"filePath":"/path/to/project/a.cpp","content":"..."}' --workspace /path/to/project`
}

export function parseArgs(argv) {
  const positional = []
  const options = {
    workspace: undefined,
    port: undefined,
    token: process.env.VSCODE_MCP_TOKEN || undefined,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') return { help: true, positional, options }
    if (value === '--workspace' || value === '--port' || value === '--token') {
      const next = argv[index + 1]
      if (!next) throw new Error(`${value} 缺少参数`)
      index += 1
      if (value === '--workspace') options.workspace = next
      if (value === '--token') options.token = next
      if (value === '--port') {
        const port = Number(next)
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`端口无效：${next}`)
        options.port = port
      }
      continue
    }
    positional.push(value)
  }

  return { help: false, positional, options }
}

export async function findBridge({ port, token, fetchImpl = fetch } = {}) {
  const ports = port === undefined ? DEFAULT_PORTS : [port]
  for (const candidate of ports) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const response = await fetchImpl(`http://127.0.0.1:${candidate}/health`, { headers })
      if (!response.ok) continue
      const health = await response.json()
      if (health?.status === 'ok' && health?.port === candidate && typeof health?.version === 'string') {
        return { port: candidate, health }
      }
    } catch {
      // 端口未监听或响应并非 Bridge，继续探测固定端口池。
    }
  }
  throw new Error(`未找到可用的 VS Code MCP Bridge（已检查：${ports.join(', ')}）`)
}

async function canonicalExistingAncestor(inputPath) {
  let current = path.resolve(inputPath)
  while (true) {
    try {
      await stat(current)
      return { existing: await realpath(current), remainder: path.relative(current, path.resolve(inputPath)) }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      current = parent
    }
  }
}

export async function canonicalPath(inputPath) {
  const { existing, remainder } = await canonicalExistingAncestor(inputPath)
  return path.resolve(existing, remainder)
}

export function isPathInside(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function parseToolPayload(result) {
  const text = result?.content?.find(item => item.type === 'text')?.text
  if (typeof text !== 'string') throw new Error('Bridge 返回内容中没有文本结果')
  return JSON.parse(text)
}

export async function verifyWorkspace(client, expectedWorkspace) {
  const expected = await canonicalPath(expectedWorkspace)
  const result = await client.callTool({ name: 'get_workspace_info', arguments: {} })
  const info = parseToolPayload(result)
  const folders = Array.isArray(info?.folders) ? info.folders : []
  const canonicalFolders = await Promise.all(folders.map(folder => canonicalPath(folder.path)))
  if (!canonicalFolders.includes(expected)) {
    throw new Error(`工作区不匹配：期望 ${expected}，实际 ${canonicalFolders.join(', ') || '(无工作区)'}`)
  }
  return { expected, info }
}

export async function guardToolCall(toolName, args, workspaceRoot) {
  if (MUTATING_FILE_TOOLS.has(toolName) && !workspaceRoot) {
    throw new Error(`工具 ${toolName} 会修改文件，必须提供 --workspace`)
  }
  if (!workspaceRoot || !FILE_PATH_TOOLS.has(toolName) || args.filePath === undefined) return
  if (typeof args.filePath !== 'string' || !path.isAbsolute(args.filePath)) {
    throw new Error('filePath 必须是绝对路径')
  }
  const [root, target] = await Promise.all([canonicalPath(workspaceRoot), canonicalPath(args.filePath)])
  if (!isPathInside(root, target)) throw new Error(`拒绝访问工作区外路径：${target}`)
}

function authOptions(token) {
  if (!token) return undefined
  const authorization = `Bearer ${token}`
  return {
    eventSourceInit: {
      fetch: (input, init = {}) => fetch(input, {
        ...init,
        headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: authorization },
      }),
    },
    requestInit: { headers: { Authorization: authorization } },
  }
}

export async function run(argv) {
  const parsed = parseArgs(argv)
  if (parsed.help || parsed.positional.length === 0) {
    process.stdout.write(`${usage()}\n`)
    return 0
  }

  const [command, toolName, rawArgs = '{}'] = parsed.positional
  if (!['check', 'list', 'call'].includes(command)) throw new Error(`未知命令：${command}`)
  if (command === 'call' && !toolName) throw new Error('call 命令缺少工具名')

  let args = {}
  if (command === 'call') {
    try {
      args = JSON.parse(rawArgs)
    } catch (error) {
      throw new Error(`工具参数不是有效 JSON：${error.message}`)
    }
    if (args === null || Array.isArray(args) || typeof args !== 'object') throw new Error('工具参数必须是 JSON 对象')
    await guardToolCall(toolName, args, parsed.options.workspace)
  }

  const bridge = await findBridge(parsed.options)
  const client = new Client({ name: 'vscode-mcp-safe-client', version: '1.0.0' })
  const endpoint = new URL(`http://127.0.0.1:${bridge.port}/sse`)
  await client.connect(new SSEClientTransport(endpoint, authOptions(parsed.options.token)))

  try {
    let workspace
    if (parsed.options.workspace) workspace = await verifyWorkspace(client, parsed.options.workspace)
    if (command === 'check') {
      const tools = await client.listTools()
      process.stdout.write(`${JSON.stringify({ endpoint: endpoint.href, health: bridge.health, workspace: workspace?.info ?? null, toolCount: tools.tools.length }, null, 2)}\n`)
    } else if (command === 'list') {
      const tools = await client.listTools()
      process.stdout.write(`${JSON.stringify(tools, null, 2)}\n`)
    } else {
      const result = await client.callTool({ name: toolName, arguments: args })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    }
  } finally {
    await client.close()
  }
  return 0
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  run(process.argv.slice(2)).catch(error => {
    process.stderr.write(`错误：${error.message}\n`)
    process.exitCode = 1
  })
}
