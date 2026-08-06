import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// F3（2026-08-04）：STACK 编号碰撞——插入序乱号 + 研究参考区 0./0b./9./10.
// 与主列表撞号、check-stack-status 旧切分连研究参考条目一起吞。
// 二代（2026-08-06 用户拍板）：废 STACK.md → stack.yaml，状态从散文标记升级为
// status 字段——R1/R2 散文矛盾类从构造上消失，门升级为 schema 枚举 + 编号纪律。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-STACKNUM-01', 'numbering-discipline', 'check-stack-status 二代（yaml）：schema 枚举/必填 + 主列表断号/撞号报错（编号纪律不失效）', async () => {
  const check = src('../scripts/check/check-stack-status.mjs');
  assert(/编号断裂/.test(check), '断号检查缺席——插入序乱号会再来一次');
  assert(/status 非法/.test(check), 'status 枚举检查缺席——「无标记黑户」会以自由文本还魂');
  assert(/stack\.yaml/.test(check), '目标文件必须是 stack.yaml（一代 STACK.md 已废）');

  // 负例夹具：编号 1→3 断裂 + 撞号 + 非法 status，check 必须红
  const root = mkdtempSync(join(tmpdir(), 'kfm-stacknum-'));
  try {
    const dir = join(root, 'docs', 'active');
    mkdirSync(dir, { recursive: true });
    const entry = (id: number, status: string) => [
      `  - id: ${id}`,
      `    title: 条目${id}`,
      `    status: ${status}`,
      `    created: '2026-08-01'`,
      `    note: 注记`,
    ].join('\n');
    writeFileSync(join(dir, 'stack.yaml'), [
      'entries:',
      entry(1, 'todo'),
      entry(3, 'todo'), // 编号断裂（缺 2）
      entry(3, 'done'), // 还撞号
      entry(4, 'doing'), // 非法 status
      'research: []',
    ].join('\n'));
    let out = '';
    try {
      execFileSync('node', [url('../scripts/check/check-stack-status.mjs')], {
        encoding: 'utf-8',
        env: { ...process.env, KFM_PROBE_ROOT: root },
        stdio: 'pipe',
      });
      assert.fail('断号/撞号/非法 status 夹具竟然绿——schema+编号纪律检查失效');
    } catch (e) {
      out = String((e as { stderr?: string }).stderr || '');
    }
    assert(out.includes('编号断裂'), `输出应报编号断裂，实得：${out.slice(0, 300)}`);
    assert(out.includes('重复'), `输出应报撞号，实得：${out.slice(0, 300)}`);
    assert(out.includes('status 非法'), `输出应报非法 status，实得：${out.slice(0, 300)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
