/**
 * tests/hot-restart.test.mjs — 热更新闭环·重启腿 A 档考卷（2026-08-27）
 *
 * 镜 na-restart.sh 判卷：触发 restart-req → server 值守摘触发+遗言+exit(0)
 * → supervisor 拉回（boot 计数增）→ 探活恢复。全真进程，无 mock。
 *
 * 断言：
 *   ① 触发后旧进程死透（探活断）
 *   ② supervisor 拉回新进程（boot 计数增 + 探活恢复）
 *   ③ 遗言落盘（last-will.log 含「restart-req 收到」）
 *   ④ 触发文件被摘除（不残留=不会连环重启）
 *   ⑤ 第二轮重启仍闭环（循环稳定性，不是一次性运气）
 *
 * 跑法：node tests/hot-restart.test.mjs（nz 目录下；自带随机端口，不碰 8023）
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';

const PORT = 8177 + Math.floor(Math.random() * 100);
const DIR = `/tmp/nz-hot-restart-${PORT}`;
const LOG = `${DIR}/server.log`;
const GATE = `${DIR}/gate`;
const BASE = `http://127.0.0.1:${PORT}/`;

const results = [];
const check = (name, ok, detail) => { results.push({ ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = () => fetch(BASE).then((r) => r.ok).catch(() => false);
const bootCount = () => { try { return (readFileSync(LOG, 'utf8').match(/^\[boot\]/gm) ?? []).length; } catch { return 0; } };

mkdirSync(GATE, { recursive: true });
rmSync(LOG, { force: true });

// 起 supervisor（ detached=独立进程组，finally 一锅端）
const sup = spawn('bash', ['supervisor.sh'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, NZ_PORT: String(PORT), NZ_SUPER_LOG: LOG, NZ_GATE_DIR: GATE },
  detached: true,
  stdio: 'ignore',
});

try {
  // 等首活（上限 15s）
  let up = false;
  for (let i = 0; i < 30; i++) { if (await alive()) { up = true; break; } await sleep(500); }
  check('⓪ server 首活（supervisor 拉起）', up, `port=${PORT}`);
  if (!up) throw new Error('server 没起来，后续无意义');
  await sleep(1200); // 留值守 interval 一拍

  const restartOnce = async (tag) => {
    const before = bootCount();
    writeFileSync(`${GATE}/restart-req`, String(Date.now()));
    // ① 等死（10s）
    let dead = false;
    for (let i = 0; i < 20; i++) { if (!(await alive())) { dead = true; break; } await sleep(500); }
    check(`${tag}① 触发后旧进程死透`, dead);
    // ② 等拉回（20s：boot 行增 + 探活恢复）
    let revived = false;
    for (let i = 0; i < 40; i++) {
      if (bootCount() > before && (await alive())) { revived = true; break; }
      await sleep(500);
    }
    check(`${tag}② supervisor 拉回新进程`, revived, `boot ${before}→${bootCount()}`);
  };

  await restartOnce('第一轮');
  // ③④ 遗言 + 摘除
  const will = existsSync(`${GATE}/last-will.log`) ? readFileSync(`${GATE}/last-will.log`, 'utf8') : '';
  check('③ 遗言落盘（last-will.log）', will.includes('restart-req 收到'), will.trim().split('\n').pop() ?? '空');
  check('④ 触发文件被摘除', !existsSync(`${GATE}/restart-req`));

  await restartOnce('第二轮');
  check('⑤ 第二轮仍闭环（循环稳定性）', results.filter((r) => r.ok).length === results.length,
    `${results.filter((r) => r.ok).length}/${results.length} 绿`);
} finally {
  try { process.kill(-sup.pid, 'SIGKILL'); } catch { /* 已死 */ }
  try { execSync(`fuser -k ${PORT}/tcp 2>/dev/null`); } catch { /* 端口已空 */ }
}

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${bad === 0 ? '✅ hot-restart 全绿' : `❌ ${bad} 项红`}（${results.length} 断言）`);
process.exit(bad === 0 ? 0 : 1);
