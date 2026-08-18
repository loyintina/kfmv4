/**
 * check-mechanism-registry.mjs — 注册表守卫 broker（契约 2 机械守卫四件）
 *
 * 背景：机制注册表曾自认「低频手工维护，无常驻自动化」——未机制化的机制。
 * 契约 2（nine-zero-phase2-contracts.md）扶正 = 注册表 + 守卫 + 退役协议。
 * 本脚本是四件守卫的机械执行体，只守「现实锚点」不验证机制有效性（递归终止）：
 *
 *   ① 完备性 MECH-GUARD-01：scripts/check/ 每个 check-*.mjs / gen-*.mjs
 *      必须在注册表正文（表行或豁免区）被点名——黑户脚本报红；
 *   ② 同名报错 MECH-GUARD-02：登记表两条机制名（首列）完全相同 = 红；
 *   ③ 规约出处真实存在 MECH-GUARD-03：每行「规约出处」列的 .md 路径必须
 *      真实存在于 DOCS_ROOT/项目根（文件系统是现实；路径提取容错 + 注记
 *      尾巴（全角括号注释）与「#锚点」）；
 *   ④ 死后访问 MECH-GUARD-04：状态列含「退役」的机制名仍被 docs 或
 *      scripts 下的 .mjs/.yaml/.ts 引用 = 红（僵尸引用）。
 *   ⑤ 链步数咬合 MECH-GUARD-05（2026-08-18 九零审计追加）：注册表正文中
 *      凡对检查链声称「N 步」（行内含 检查链/chain.mjs/STEPS 且带 N 步），
 *      N 必须等于 chain.mjs STEPS 数组实际条目数——读 chain.mjs 源码正则
 *      计数，不 import（import 有执行副作用风险）。审计当日 registry 曾写
 *      「59 步」而实测 60——活表数字必配机械主人。
 *
 * 豁免区：注册表文件末尾「## 豁免区」表格（| 脚本名 | 理由 |）。
 * 递归终止：broker 自身停滞不设守卫——降生发现 + 用户抽查（契约 2 拍板）。
 * KFM_PROBE_ROOT 注入（宪法探针条款）；规约出处：nine-zero-phase2-contracts.md 契约 2。
 * 2026-08-18 立（茉莉·本体线，A 组守卫四件）。
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const TRUE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ROOT = process.env.KFM_PROBE_ROOT || TRUE_ROOT;
const REG = join(ROOT, 'docs', 'active', 'mechanism-registry.md');

let errors = 0;
function error(msg) { console.error(`[check-mechanism-registry] ${msg}`); errors++; }

if (!existsSync(REG)) {
  console.error(`[check-mechanism-registry] 注册表不存在：${REG}`);
  process.exit(1);
}
const reg = readFileSync(REG, 'utf-8');

// ---------- ① 完备性：check/gen 脚本必须被点名（表行或豁免区） ----------
const checkDir = join(ROOT, 'scripts', 'check');
const scripts = readdirSync(checkDir).filter(f => /^(check|gen)-.*\.mjs$/.test(f));
const shortNames = new Map(scripts.map(f => [f, f.replace(/\.mjs$/, '')]));
// 表行/豁免区里出现的「check-foo.mjs 全名」或「check-foo 短名」都算点名
const mentioned = new Set();
for (const [full, short] of shortNames) {
  if (reg.includes(full) || reg.includes(short)) mentioned.add(full);
}
const unlisted = scripts.filter(f => !mentioned.has(f));
if (unlisted.length) {
  error(`① 完备性：${unlisted.length} 个黑户脚本未在注册表被点名：${unlisted.join(', ')}`);
  console.error(`    ⛔ MECH-GUARD-01：按机制群归行登记（契约 5），或进豁免区写理由——读 docs/active/mechanism-registry.md`);
}

// ---------- ② 同名报错：两条机制名完全相同 ----------
const tableRows = reg.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| 机制') && !l.startsWith('|---') && !l.startsWith('| 脚本'));
const names = tableRows.map(l => l.slice(1).split('|')[0].trim());
const dup = names.filter((n, i) => names.indexOf(n) !== i);
if (dup.length) {
  error(`② 同名报错：机制名重复登记：${[...new Set(dup)].join('；')}`);
  console.error(`    ⛔ MECH-GUARD-02：同名两行 = 引用随机指错——改名或合并（Cordis registry 提供集不相交纪律）`);
}

// ---------- ③ 规约出处真实存在 ----------
const PATH_RE = /[\w\-./\\]+\.md(?:#[\w\-一-龥]+)?/g;
for (const row of tableRows) {
  const cells = row.split('|').map(c => c.trim());
  const specCell = cells[6] ?? ''; // 第七列（0 起：cells[0] 空，机制=1 … 规约出处=6？——见下）
  // 列位置防御：找含 .md 路径最多的列当规约列（表头漂移容错）
  const candidate = cells.slice(1, 8).filter(c => /\.md/.test(c)).sort((a, b) => (b.match(PATH_RE)||[]).length - (a.match(PATH_RE)||[]).length)[0] || specCell;
  const mech = cells[1]?.slice(0, 24);
  const paths = candidate.match(PATH_RE) || [];
  for (const p of paths) {
    const clean = p.split('#')[0];
    const abs = [
      join(ROOT, clean),
      join(ROOT, 'docs', clean),
      join(ROOT, 'docs', 'active', 'nine-zero', clean),
      join(ROOT, 'docs', 'ledger', clean),
    ].find(x => existsSync(x));
    if (!abs) {
      error(`③ 规约出处：机制「${mech}」的出处路径不存在：${clean}`);
      console.error(`    ⛔ MECH-GUARD-03：文件系统是现实——重组文档后必须同步注册表出处列`);
    }
  }
}

// ---------- ④ 死后访问：退役机制仍被引用 ----------
const retiredRows = tableRows.filter(l => (l.split('|')[7] ?? '').includes('退役'));
if (retiredRows.length) {
  const retiredNames = retiredRows.map(l => l.split('|')[1].trim().split(/（|（/)[0].trim());
  const scanDirs = [join(ROOT, 'docs'), join(ROOT, 'scripts')];
  const victims = [];
  function scanDir(dir) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) scanDir(p);
      else if (/\.(md|mjs|yaml|ts)$/.test(e.name) && !p.includes('mechanism-registry')) {
        const txt = readFileSync(p, 'utf-8');
        for (const n of retiredNames) if (txt.includes(n)) victims.push(`${n} ← ${p}`);
      }
    }
  }
  scanDirs.forEach(scanDir);
  if (victims.length) {
    error(`④ 死后访问：退役机制仍被引用：${[...new Set(victims)].slice(0, 8).join('；')}`);
    console.error(`    ⛔ MECH-GUARD-04：退役 = 引用先清干净（两种红的删钉流程，契约 0）`);
  }
}

// ---------- ⑤ 链步数咬合：注册表「N 步」声称 = chain.mjs STEPS 实际条目数 ----------
// 读 chain.mjs 源码正则计数（不 import——检查器不该触发被检对象的执行面）
const chainSrc = readFileSync(join(ROOT, 'scripts', 'check', 'chain.mjs'), 'utf-8');
const stepsBlock = /export const STEPS = \[([\s\S]*?)\];/.exec(chainSrc);
if (!stepsBlock) {
  error('⑤ 链步数咬合：chain.mjs 找不到 export const STEPS 数组——唯一出处结构变了，本守卫需跟进');
} else {
  const stepsCount = (stepsBlock[1].match(/^\s*'/gm) || []).length;
  reg.split('\n').forEach((line, i) => {
    if (!/检查链|chain\.mjs|STEPS/.test(line)) return;
    for (const m of line.matchAll(/(\d+)\s*步/g)) {
      if (parseInt(m[1], 10) !== stepsCount) {
        error(`⑤ 链步数咬合：注册表第 ${i + 1} 行声称「${m[1]} 步」，chain.mjs STEPS 实际 ${stepsCount} 步`);
        console.error('    ⛔ MECH-GUARD-05：活表数字必须追平唯一出处——改注册表，或先确认链是否真的变了');
      }
    }
  });
}

// ---------- 收口 ----------
if (errors) {
  console.error(`\n[check-mechanism-registry] 检查失败，构建中断（守卫 ${errors} 处红）。`);
  process.exit(1);
}
console.log(`[check-mechanism-registry] ✅ 守卫五件通过：${scripts.length} 脚本全收编（黑户 0）/ 机制 ${names.length} 行无同名 / 规约出处无死链 / 退役引用 ${retiredRows.length ? '已清' : '（无退役条目）'} / 链步数声称咬合`);
