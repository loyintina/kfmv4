// tests/env-test-isolation.mjs — 测试数据目录隔离（BAR-TEST-ENV-01 补强，2026-08-08）
//
// 病灶：preload.mjs（npm test --import 注入）只覆盖包装入口；`tsx -e "import(...)"`、
// 自定义包装等入口绕过 --import，且 argv[1] 不是测试文件路径（path-utils 的 argv
// 检查同样失效）——测试会把 s1/s2/s3/s-basic/sess-ok 等垃圾会话写进生产
// ~/.kfmv4/sessions/（08-05 04:49 与 08-07 04:48 两批 9 文件实案，obs.ts 显示层
// 过滤只是兜底没治本）。
//
// 解法：本模块是**各测试文件的首个 import**。ESM 按 import 顺序执行副作用，
// 先于一切 src 被测模块加载——此处设置 KFM_ROOT，path-utils 加载时必然读到，
// 无论进程从哪个入口进来。preload 已设过 test-root 则不覆盖（保持同一临时根）。
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.KFM_ROOT || !process.env.KFM_ROOT.includes('kfmv4-test-root')) {
  process.env.KFM_ROOT = mkdtempSync(join(tmpdir(), 'kfmv4-test-root-'));
}
