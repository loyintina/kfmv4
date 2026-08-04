import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// F3（2026-08-04）：STACK 编号碰撞——插入序乱号 + 研究参考区 0./0b./9./10.
// 与主列表撞号、check-stack-status 旧切分连研究参考条目一起吞。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-STACKNUM-01', 'numbering-discipline', 'check-stack-status 必须在研究参考区前截断切分，且对主列表断号/撞号报错（旧切分吞研究参考条目、编号乱序无人管）', async () => {
  const check = src('../scripts/check/check-stack-status.mjs');
  assert(/研究参考/.test(check) && /break/.test(check), '切分必须在「## 研究参考」前截断——否则又吞 R 区条目');
  assert(/编号断裂/.test(check), '断号检查缺席——插入序乱号会再来一次');

  // 负例夹具：编号 1→3 断裂 + 撞号，check 必须红
  const root = mkdtempSync(join(tmpdir(), 'kfm-stacknum-'));
  try {
    const dir = join(root, 'docs', 'active');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'STACK.md'), [
      '# 工作栈',
      '1. 条目一（正常）',
      '3. 条目二（编号断裂）',
      '3. 条目三（还撞号）',
      '',
      '## 研究参考',
      '9. 旧式 R 区条目（不该被吞进主列表计数）',
    ].join('\n'));
    let out = '';
    try {
      execFileSync('node', [url('../scripts/check/check-stack-status.mjs')], {
        encoding: 'utf-8',
        env: { ...process.env, KFM_PROBE_ROOT: root },
        stdio: 'pipe',
      });
      assert.fail('断号/撞号夹具竟然绿——编号纪律检查失效');
    } catch (e) {
      out = String((e as { stderr?: string }).stderr || '');
    }
    assert(out.includes('编号断裂'), `输出应报编号断裂，实得：${out.slice(0, 200)}`);
    assert(out.includes('重复'), `输出应报撞号，实得：${out.slice(0, 200)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
