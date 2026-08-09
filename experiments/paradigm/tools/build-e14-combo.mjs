#!/usr/bin/env node
/**
 * build-e14-combo.mjs — e14 组合挂载实验的组合包构建器（2026-08-06）
 *
 * 拼接规则（design-roadmap-e14-e16.md 落档）：
 *   e14-bd-meta.md = behavior-discipline.md 全文 + "\n\n---\n\n" + metacognition.md 全文
 *   - 顺序固定 bd 在前 meta 在后（顺序本身是变量，e14 固定，记为已知局限）
 *   - 块间分隔符与各包内部一致（\n\n---\n\n），不加任何「这是两个包」的边界标记——
 *     与 W2 轻标记哲学一致：结构标记交给包内宣言，拼接层保持中性
 *   - 幂等：重复运行产出逐字节一致
 *
 * 用法：node experiments/paradigm/tools/build-e14-combo.mjs
 * 产出：~/.kfmv4/agents/paradigms/e14-bd-meta.md + 打印 token 估算（字符数 × 0.75，
 *       与 build-length-paradigms.py 同口径）
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DIR = join(homedir(), '.kfmv4', 'agents', 'paradigms');
const SEP = '\n\n---\n\n';
const SOURCES = ['behavior-discipline.md', 'metacognition.md'];
const OUT = join(DIR, 'e14-bd-meta.md');

const parts = SOURCES.map(f => readFileSync(join(DIR, f), 'utf-8').trim());
const combo = parts.join(SEP) + '\n';
writeFileSync(OUT, combo);

const est = Math.round(combo.length * 0.75);
console.log(`[build-e14-combo] ${OUT}`);
SOURCES.forEach((f, i) => console.log(`  源${i + 1} ${f}: ${parts[i].length} 字符 ≈ ${Math.round(parts[i].length * 0.75)} tok`));
console.log(`  合计 ${combo.length} 字符 ≈ ${est} tok`);
