import assert from 'node:assert/strict'
import { mkdtemp, mkdir, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  canonicalPath,
  findBridge,
  guardToolCall,
  isPathInside,
  parseArgs,
} from './vscode-mcp-client.mjs'

test('parseArgs 解析命令和选项', () => {
  const parsed = parseArgs(['call', 'read_file', '{"filePath":"/tmp/a"}', '--workspace', '/tmp', '--port', '3334'])
  assert.deepEqual(parsed.positional, ['call', 'read_file', '{"filePath":"/tmp/a"}'])
  assert.equal(parsed.options.workspace, '/tmp')
  assert.equal(parsed.options.port, 3334)
})

test('findBridge 按固定端口池探测并校验健康响应', async () => {
  const visited = []
  const fetchImpl = async url => {
    visited.push(url)
    const port = Number(new URL(url).port)
    return {
      ok: true,
      json: async () => port === 3334
        ? { status: 'ok', version: '0.2.5', port }
        : { status: 'other', version: '0.2.5', port },
    }
  }
  const result = await findBridge({ fetchImpl })
  assert.equal(result.port, 3334)
  assert.equal(visited.length, 2)
})

test('isPathInside 拒绝相邻目录', () => {
  assert.equal(isPathInside('/work/project', '/work/project/src/a.cpp'), true)
  assert.equal(isPathInside('/work/project', '/work/project-other/a.cpp'), false)
})

test('写工具必须显式提供工作区', async () => {
  await assert.rejects(
    guardToolCall('write_file', { filePath: '/tmp/a', content: 'x' }),
    /必须提供 --workspace/,
  )
})

test('路径保护识别通过符号链接逃逸到工作区外', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'vscode-mcp-client-'))
  const workspace = path.join(base, 'workspace')
  const outside = path.join(base, 'outside')
  await mkdir(workspace)
  await mkdir(outside)
  await symlink(outside, path.join(workspace, 'link'))

  const escaped = path.join(workspace, 'link', 'new.cpp')
  assert.equal((await canonicalPath(escaped)).startsWith(outside), true)
  await assert.rejects(
    guardToolCall('write_file', { filePath: escaped, content: 'x' }, workspace),
    /拒绝访问工作区外路径/,
  )
})
