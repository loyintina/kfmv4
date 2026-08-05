import assert from 'assert';
import { regression, test } from './runner.js';
import { readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { appendUserMessage, flush, flushSync, invalidateSession } from '../src/server/ai/session-store.js';
import { KFM_DATA_DIR } from '../src/server/path-utils.js';

// BAR-SESSION-FLUSH-01（2026-08-04 并发标定实验实锤）：session-store 落盘无写锁——
// 防抖 flush 与强制 flush（tool_result/done/abort）可并发 writeFile 同一文件，
// 大文件多块写交错 → 会话文件拼接损坏（bi-r2-t0p0m0r5.json「Extra data」实案）。
// 2026-08-05 复发根治：首版修复是 async writeFile + writing/pendingWrite 锁，但锁只挡得住
// 同层调用——flushSync 的 writeFileSync 不与在途异步写互斥（异步 fd 线程池滞后，把旧快照头
// 覆盖在新快照上 → 完整旧档+新档尾巴交错，e9c-t0p0m0r3.json 尸检实锤）。
// 根治：_writeToDisk 全面同步化（writeFileSync），事件循环单线程下同步写天然串行。

const SESSIONS_DIR = join(KFM_DATA_DIR, 'sessions');
const SID = '__test_flush_race__';
const _file = (sid: string) => join(SESSIONS_DIR, `${sid}.json`);
const _cleanup = (sid: string) => { invalidateSession(sid); try { rmSync(_file(sid), { force: true }); } catch { /* 已清理 */ } };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

regression('BAR-SESSION-FLUSH-01', 'flush-sync-write', 'session-store 落盘必须全面同步 writeFileSync——异步 writeFile 与 writeFileSync 不互斥，在途异步写会把旧快照头盖到新快照上（会话文件交错损坏根因）', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/server/ai/session-store.ts', import.meta.url)), 'utf-8');
  assert(!/writeFile\(/.test(src.replace(/writeFileSync\(/g, '')), '异步 writeFile( 残留——与同步写不互斥，在途写可交错（回 BAR-SESSION-FLUSH-01 病根）');
  assert(/writeFileSync\(filePath/.test(src), '_writeToDisk 必须同步 writeFileSync 落盘');
  assert(!/s\.writing|pendingWrite\s*[=:]/.test(src), 'writing/pendingWrite 锁残留——全面同步化后锁已无意义，残留即未根治');
});

test('密集追加 + 强制 flush 交错后，会话文件必须仍是合法完整 JSON（写锁串行化不破坏正常路径）', async () => {
  _cleanup(SID);
  try {
    const big = 'x'.repeat(200_000); // 大内容：writeFile 内部多块写，旧实现交错概率高
    for (let i = 0; i < 8; i++) {
      appendUserMessage(SID, `msg-${i}-${big}`, 'deepseek-v4-flash', 'test');
      flush(SID); // 强制写与防抖写交错（修复前同一时刻两个 writeFile 在途）
      await sleep(5); // 让 writeFile 回调有机会完成/交错
    }
    flushSync(SID);
    const raw = JSON.parse(readFileSync(_file(SID), 'utf-8')); // 文件损坏 → JSON.parse 抛
    const texts = raw.messages.filter((m: any) => m.role === 'user').map((m: any) => (m.content || [])[0]?.text || '');
    assert(texts.length >= 8, `应含全部 8 条消息，实得 ${texts.length}——消息丢失（串行化续写失效）`);
    assert(texts.every((t: string) => t.startsWith('msg-')), '消息内容被交错污染');
  } finally {
    _cleanup(SID);
  }
});
