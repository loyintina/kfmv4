// ==========================================================================
// tests/session-invalidate.test.ts — 串档 bug 回归钉子
//
// bug（2026-08-01 冷启动实验实测实锤）：删除会话只删磁盘文件，
// session-store._sessions 内存缓存不失效——同名新会话 appendUserMessage
// 接续旧 ctx：
//   ① 旧消息全量发给 API（串档臂 turn1 载荷 ~114KB/49,512 tokens，
//      vs 干净基线 ~20KB/9,042，5.7× 膨胀）；
//   ② flush 以旧 meta 落盘，两段历史合并一个文件（createdAt=旧会话）；
//   ③ 客户端新建会话本地状态为空，面板显示干净——污染全在服务端，
//      肉眼测试不可见，刷新面板后旧消息「复活」。
//
// 修复：session-store 新增 invalidateSession()；files.ts 的
// delete/rename/move 三路由对 sessions/*.json 目标同步失效缓存。
//
// revert 验证：「bug 机理复现」钉在不调 invalidateSession 时天然 2 条合并——
// 若 _get 缓存机制被破坏（每次都从磁盘重载），该钉会红。
// ==========================================================================

import assert from 'assert';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { group, regression, test } from './runner.js';
import { appendUserMessage, flushSync, invalidateSession } from '../src/server/ai/session-store.js';
import { KFM_DATA_DIR } from '../src/server/path-utils.js';

group('串档修复 — 会话删除后内存缓存必须同步失效');

const SESSIONS_DIR = join(KFM_DATA_DIR, 'sessions');
const SID_FIX = '__test_chuandang_fix__';
const SID_BUG = '__test_chuandang_bug__';

function _file(sid: string): string { return join(SESSIONS_DIR, `${sid}.json`); }

function _cleanup(sid: string): void {
  invalidateSession(sid);
  try { rmSync(_file(sid), { force: true }); } catch { /* 已清理 */ }
}

function _readMessages(sid: string): Array<{ role: string; content: Array<{ text?: string }> }> {
  const raw = JSON.parse(readFileSync(_file(sid), 'utf-8'));
  return raw.messages;
}

test('修复验证：删除会话文件 + invalidateSession 后，同名新会话从零开始', () => {
  _cleanup(SID_FIX);
  try {
    // 旧段：模拟 flash-3 臂的消息
    appendUserMessage(SID_FIX, '旧段消息——来自被删除的会话');
    flushSync(SID_FIX);
    assert(existsSync(_file(SID_FIX)), '旧段应已落盘');

    // 删除会话（等价于 /files/delete 路由行为：删文件 + 失效缓存）
    rmSync(_file(SID_FIX));
    invalidateSession(SID_FIX);

    // 新段：同名新会话的第一条消息
    appendUserMessage(SID_FIX, '新段消息——同名新会话');
    flushSync(SID_FIX);

    const msgs = _readMessages(SID_FIX);
    assert(msgs.length === 1, `新会话应只有 1 条消息，实际 ${msgs.length} 条（串档未修复）`);
    assert(msgs[0].content[0]?.text === '新段消息——同名新会话', '新会话首条消息应是新段');
  } finally {
    _cleanup(SID_FIX);
  }
});

test('bug 机理复现：不失效缓存时，同名 append 接续旧 ctx（两段合并）', () => {
  _cleanup(SID_BUG);
  try {
    appendUserMessage(SID_BUG, '旧段消息');
    flushSync(SID_BUG);
    rmSync(_file(SID_BUG)); // 只删文件，故意不失效缓存——复现串档
    appendUserMessage(SID_BUG, '新段消息');
    flushSync(SID_BUG);
    const msgs = _readMessages(SID_BUG);
    assert(msgs.length === 2, `缓存接续应产生 2 条合并消息，实际 ${msgs.length} 条`);
  } finally {
    _cleanup(SID_BUG);
  }
});

regression('BAR-SESSION-01', 'files-route-invalidate', 'files.ts delete/rename/move 三路由均接线 _invalidateIfSessionFile', () => {
  const src = readFileSync(new URL('../src/server/routes/files.ts', import.meta.url), 'utf-8');
  assert(src.includes("import { invalidateSession } from '../ai/session-store.js'"), 'files.ts 未 import invalidateSession');
  const calls = (src.match(/_invalidateIfSessionFile\(/g) || []).length;
  // 1 处定义 + 3 处调用（delete/rename/move）
  assert(calls === 4, `_invalidateIfSessionFile 应出现 4 次（1 定义 + 3 路由），实际 ${calls} 次`);
});

regression('BAR-SESSION-01', 'invalidate-no-flush', 'invalidateSession 不 flush 脏数据（避免把已删会话重新写出）', () => {
  const src = readFileSync(new URL('../src/server/ai/session-store.ts', import.meta.url), 'utf-8');
  const fnBody = src.slice(src.indexOf('export function invalidateSession'));
  const fnEnd = fnBody.indexOf('\n}');
  const body = fnBody.slice(0, fnEnd);
  assert(!body.includes('_writeToDisk'), 'invalidateSession 不应调用 _writeToDisk');
  assert(body.includes('_sessions.delete(sessionId)'), 'invalidateSession 必须删除缓存项');
});
