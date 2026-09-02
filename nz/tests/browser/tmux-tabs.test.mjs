/**
 * tests/browser/tmux-tabs.test.mjs — tmux 标签条 A 档考卷 v5（会话版，
 * 2026-09-02 用户四次仲裁：标签=服务器全部 tmux 会话）。
 * 状态机蓝本=docs/tmux-tabs-v2-state-machine.md（0902 会话化修订）。
 * 劣化网络纪律：actUntil=幂等动作+状态轮询直到确认（守卫式：动作可能
 * 非幂等时先读态再动）。观测：屏幕真话×钩子全机位×服务器 tmux ls 互证。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const URL = `${BASE}`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// 服务器真值：会话名单（互证用）
const serverSessions = () => String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean);
// 一次性 tmux 管理命令（夹具）
const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };

// 夹具：清残留探针会话 + 放开 status-left 截断（v4 教训：默认 10 字符
// 把 [kfm-exam-new] 截成 [kfm-exam-，断言永远不中）
for (const s of serverSessions()) if (s.startsWith('kfm-exam')) tmux(['kill-session', '-t', s]);
tmux(['set', '-g', 'status-left-length', '40']);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(
  () => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject,
  null, { timeout: 30000, polling: 250 },
).catch((e) => console.log('[HOOK-TIMEOUT]', String(e).slice(0, 120)));
await page.evaluate(() => { window.__fnProbe = window.__kfmNzTmuxTabs; }); // 二次挂载侦测基线
await page.waitForTimeout(1500);
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const screenText = () => page.evaluate(() => window.__kfmNzTermScreen());
const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return {
    state: r.state, attached: r.attachedSession,
    sessions: r.sessions?.map((s) => s.name), expanded: r.expanded,
  };
});
/** actUntil：动作→状态轮询至确认；未达则重做（守卫式：动作前先读态） */
const actUntil = async (act, pred, { tries = 3, settle = 6000, poll = 250 } = {}) => {
  for (let t = 0; t <= tries; t++) {
    await act();
    const end = Date.now() + settle;
    while (Date.now() < end) { if (await pred()) return { ok: true, tries: t }; await page.waitForTimeout(poll); }
  }
  return { ok: false };
};

// ① T1+会话表渲染：展开→标签含真实夹具会话（dsh 恒在）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const s1 = await rt();
const domHasDsh = await page.evaluate(() => !!document.querySelector('[data-tmux-id="dsh"]'));
check('①T1 展开→会话表含 dsh（真实夹具）+EXPANDED', s1.state === 'EXPANDED' && s1.sessions?.includes('dsh') && domHasDsh,
      `state=${s1.state} sessions=${JSON.stringify(s1.sessions)} domDsh=${domHasDsh}`);

// ② T4/T5 ＋建会话 kfm-exam-new：rt.sessions+服务器 tmux ls 双证+收起
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', 'kfm-exam-new');
await page.click('[data-tmux-confirm="1"]');
const ok2 = await actUntil(
  async () => {},
  async () => (await rt()).sessions?.includes('kfm-exam-new'),
  { tries: 1, settle: 6000, poll: 300 },
);
const s2 = await rt();
const srv2 = serverSessions().includes('kfm-exam-new');
check('②T5 ＋建会话→双证（rt.sessions+服务器）+收起 HANDLE',
      ok2.ok && srv2 && s2.state === 'HANDLE' && s2.attached === null,
      `rt=${JSON.stringify(s2.sessions)} srv=${srv2} state=${s2.state} attached=${s2.attached}`);

// ③ T2 未附点标签→attach（状态行出现+附着指示落位+停 EXPANDED）
// 守卫式：点标签=attach/detach 拨动非幂等——已附则只等屏幕，不点。
const t03 = Date.now();
const ok3 = await actUntil(
  async () => {
    const r0 = await rt();
    if (r0.attached === 'kfm-exam-new') return; // 已附未确认：不点（点了=detach）
    const kind = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs'));
    if (kind === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
    try { await page.click('[data-tmux-id="kfm-exam-new"]', { timeout: 5000 }); } catch (e) {
      const dump = await page.evaluate(() => JSON.stringify({
        kind: document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs'),
        rt: window.__kfmNzTmuxTabs?.(),
      }));
      console.log('[CLICK-ERR-DUMP]', dump.slice(0, 600));
    }
  },
  async () => { const s = await screenText(); const r = await rt(); return s.includes('[kfm-exam-new]') && r.attached === 'kfm-exam-new'; },
  { tries: 2, settle: 6000, poll: 300 },
);
const ms3 = Date.now() - t03;
const s3 = await rt();
check('③T2 未附点标签→attach 进会话（状态行+attachedSession）≤8s+停 EXPANDED',
      ok3.ok && s3.attached === 'kfm-exam-new' && s3.state === 'EXPANDED' && ms3 <= 8000,
      `attach ${ms3}ms attached=${s3.attached} state=${s3.state}`);

// ④ T3 点聚焦标签→detach 回终端态
await page.click('[data-tmux-id="kfm-exam-new"]');
const ok4 = await actUntil(
  async () => {},
  async () => { const s = await screenText(); const r = await rt(); return !s.includes('[kfm-exam-new]') && r.attached === null; },
  { tries: 1, settle: 5000, poll: 300 },
);
const s4 = await rt();
check('④T3 点聚焦→detach 回终端态（状态行消失+attached=null）',
      ok4.ok && s4.attached === null, `attached=${s4.attached}`);

// ⑤ T2s 已附切换：附 kfm-exam-a → 点 kfm-exam-new → detach+attach 换名
tmux(['new-session', '-d', '-s', 'kfm-exam-a']);
const ok5a = await actUntil(
  async () => {},
  async () => (await rt()).sessions?.includes('kfm-exam-a'),
  { tries: 1, settle: 6000, poll: 300 },
);
const kindPre5 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
if (kindPre5 === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
await page.click('[data-tmux-id="kfm-exam-a"]');
await page.waitForFunction(
  () => window.__kfmNzTmuxTabs?.().attachedSession === 'kfm-exam-a'
        && window.__kfmNzTermScreen().includes('[kfm-exam-a]'),
  null, { timeout: 8000, polling: 300 },
).catch(() => {});
const attachedA = (await rt()).attached === 'kfm-exam-a';
await page.evaluate(() => {
  window.__chipClicks = 0;
  document.querySelector('[data-tmux-id="kfm-exam-new"]')?.addEventListener('click', () => { window.__chipClicks++; });
});
await page.click('[data-tmux-id="kfm-exam-new"]');
console.log('[T2s clicks]', await page.evaluate(() => window.__chipClicks),
            await page.evaluate(() => JSON.stringify(window.__kfmNzTmuxTabs?.().attachedSession)));
const ok5 = await actUntil(
  async () => {},
  async () => { const s = await screenText(); const r = await rt(); return s.includes('[kfm-exam-new]') && r.attached === 'kfm-exam-new'; },
  { tries: 1, settle: 6000, poll: 300 },
);
const s5 = await rt();
check('⑤T2s 已附点他签→先 detach 再 attach（状态行换名+attachedSession 翻转）',
      ok5a.ok && attachedA && ok5.ok && s5.attached === 'kfm-exam-new',
      `attachedA=${attachedA} attached=${s5.attached}`);

// ⑥ T8/T9 ×杀会话：确认页拦截（确认前会话还活着）→确认→双证消失
await page.click('[data-tmux-close="kfm-exam-new"]');
await page.waitForTimeout(300);
const ovShown = await page.evaluate(() => document.querySelector('[data-tmux-overlay]') !== null);
const aliveBefore = serverSessions().includes('kfm-exam-new');
await page.click('[data-tmux-confirm="1"]');
const ok6 = await actUntil(
  async () => {},
  async () => !(await rt()).sessions?.includes('kfm-exam-new'),
  { tries: 1, settle: 6000, poll: 300 },
);
const srv6 = serverSessions().includes('kfm-exam-new');
check('⑥T9 ×杀会话：确认页拦截+确认后双证消失',
      ovShown && aliveBefore && ok6.ok && !srv6,
      `确认页=${ovShown} 确认前在=${aliveBefore} 确认后服务器在=${srv6}`);

// ⑦ T9 变体：杀掉附着会话→塌回 HANDLE（attachedSession 清零）
try {
  const kind7 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs'));
  if (kind7 === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
  await page.click('[data-tmux-id="kfm-exam-a"]', { timeout: 8000 });
} catch (e) {
  const dump = await page.evaluate(() => JSON.stringify({
    kind: document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs'),
    domIds: [...document.querySelectorAll('[data-tmux-id]')].map((el) => el.getAttribute('data-tmux-id')),
    rt: window.__kfmNzTmuxTabs?.(),
  }));
  console.log('[⑦-CLICK-ERR-DUMP]', dump.slice(0, 900));
}
// 硬证据：附着指示+状态行都在，才算附着成功（否则⑦的塌回断言天然假绿）
const attached7 = await page.waitForFunction(
  () => window.__kfmNzTmuxTabs?.().attachedSession === 'kfm-exam-a'
        && window.__kfmNzTermScreen().includes('[kfm-exam-a]'),
  null, { timeout: 8000, polling: 300 },
).then(() => true, () => false);
check('⑦前置 附着 exam-a 成功（硬证据）', attached7, `attached=${(await rt()).attached}`);
await inject('tmux kill-session -t kfm-exam-a\r');
await inject('tmux kill-session -t kfm-exam-a\r');
const ok7 = await actUntil(
  async () => {},
  async () => { const r = await rt(); return r.attached === null && r.state === 'HANDLE'; },
  { tries: 1, settle: 7000, poll: 300 },
);
const s7 = await rt();
check('⑦杀附着会话→附着清零+塌回 HANDLE', ok7.ok && s7.attached === null && s7.state === 'HANDLE',
      `attached=${s7.attached} state=${s7.state}`);

// ⑧ kernel 注册表 + 自观测环词汇表 + 末拍互证
const reg = await page.evaluate(() => window.__kfmNzKernel?.list?.() ?? null);
const s8 = await rt();
const hist = await page.evaluate(() => window.__kfmNzTmuxTabs?.().history ?? []);
const states = hist.map((h) => h.state);
const domNow = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('⑧kernel 注册表+自观测环词汇表统一+末拍互证',
      Array.isArray(reg) && reg.includes('tmux-tabs') && states.length > 0
        && states.every((st) => ['HANDLE', 'EXPANDED', 'OVERLAY_NEW', 'OVERLAY_CLOSE'].includes(st))
        && states[states.length - 1] === domNow,
      `reg=${JSON.stringify(reg)} states=${JSON.stringify(states.slice(-5))} dom=${domNow}`);

// 清理
for (const s of serverSessions()) if (s.startsWith('kfm-exam')) tmux(['kill-session', '-t', s]);
try { await browser.close(); } catch { /* 已闭即达意 */ }
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
if (fails.length > 0) process.exit(1);
