import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// 2026-08-04 语义审计收割（结晶回路，变体 ≥3 → 移民确定区）：文档脚本/源码引用
// ghost（变异基准 M03/M05/M13 家族）历来靠 LLM 探针读 code-map 才可逮，收归
// 机械层 check-doc-scripts 三通道（P 路径/Z 文件名/C 裸 check-* 名）。
// 探针夹具 tests/probes/doc-scripts/ 同钉（check-probes 自检）。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-DOCSCRIPTS-01', 'doc-scripts-existence', 'check-doc-scripts 三通道必须对幽灵引用报红：P 反引号完整路径（M05 tag-adviser 族）、Z 反引号纯文件名（M13 bundle.mjs 族）、C workflows 面裸 check-* 名（M03 check-desc-freshness 族）', async () => {
  const check = src('../scripts/check/check-doc-scripts.mjs');
  assert(/PATH_REF_RE/.test(check), 'P 通道（反引号完整路径存在性）缺席——M05 族回归');
  assert(/NAME_REF_RE/.test(check), 'Z 通道（反引号纯文件名存在性）缺席——M13 族回归');
  assert(/workflows/.test(check) && /checkScripts/.test(check), 'C 通道（workflows 面裸 check-* 名）缺席——M03 族回归');

  // 负例夹具：三通道各埋一幽灵引用，check 必须全报（旧实现全绿即失效）
  const root = mkdtempSync(join(tmpdir(), 'kfm-docscripts-'));
  try {
    mkdirSync(join(root, 'docs', 'guides'), { recursive: true });
    mkdirSync(join(root, 'docs', 'workflows'), { recursive: true });
    mkdirSync(join(root, 'scripts', 'check'), { recursive: true });
    writeFileSync(join(root, 'docs', 'guides', 'probe.md'), '真引用 `scripts/check/check-real.mjs`；幽灵 `scripts/check/check-ghost.mjs` 与 `ghost-file.ts`\n');
    writeFileSync(join(root, 'docs', 'workflows', 'probe.yaml'), 'steps:\n  1. 跑 check-real（现役，应过）\n  2. 跑 check-ghost-name（幽灵，应逮）\n');
    writeFileSync(join(root, 'scripts', 'check', 'check-real.mjs'), 'export const STEPS = [];\n');
    let out = '';
    try {
      execFileSync('node', [url('../scripts/check/check-doc-scripts.mjs')], {
        encoding: 'utf-8',
        env: { ...process.env, KFM_PROBE_ROOT: root },
        stdio: 'pipe',
      });
      assert.fail('幽灵引用夹具竟然绿——check-doc-scripts 检查失效');
    } catch (e) {
      out = String((e as { stderr?: string }).stderr || '');
    }
    assert(out.includes('check-ghost.mjs'), `P 通道应报路径幽灵，实得：${out.slice(0, 200)}`);
    assert(out.includes('ghost-file.ts'), `Z 通道应报文件名幽灵，实得：${out.slice(0, 200)}`);
    assert(out.includes('check-ghost-name'), `C 通道应报 check 名幽灵，实得：${out.slice(0, 200)}`);
    assert(!out.includes('check-real.mjs'), `真引用被误报：${out.slice(0, 200)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
