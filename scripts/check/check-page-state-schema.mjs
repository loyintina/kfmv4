#!/usr/bin/env node
/**
 * check-page-state-schema.mjs — 眼睛格式说明与代码/枚举的一致性校验
 *
 * page-state-schema.md 是手写说明文档，但其中两类的「事实」有活源头：
 *   1. 关键常量串（头部/段落标题/占位句）——活源头 src/server/ai/page-state.ts
 *   2. 内容类型枚举（text-output/card-content/file-tree/status-bar）——
 *      活源头 src/client/modules/ui-registry.ts 的类型联合
 * 本脚本做**双向一致性**校验：每个关键串必须同时存在于代码与 schema；
 * 内容类型联合必须与 schema 列出的取值一致。任何一侧改了就报红，
 * 提醒同步另一侧（文档与代码漂移 = 探针失明）。
 *
 * 校验范围限定「可生成的事实」，不校验描述性文字（格式规律/使用注意）——
 * 那些是人工说明，保持手写。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// KFM_PROBE_ROOT 注入（check-probes 夹具）：指向迷你假仓库，其余逻辑不变
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const PAGE_STATE_TS = join(BASE, 'src', 'server', 'ai', 'page-state.ts');
const UI_REGISTRY_TS = join(BASE, 'src', 'client', 'modules', 'ui-registry.ts');
const SCHEMA_MD = join(BASE, 'src', 'server', 'prompts', 'dynamic', 'page-state-schema.md');

/** 关键常量串：必须同时存在于 page-state.ts 与 schema 文档（双向） */
const KEY_STRINGS = [
  // 头部固定两行
  '# 当前页面状态',
  '> 本节由系统在每次工具调用后自动刷新，反映你的操作对页面的实际影响。',
  // 三段式段落标题
  '## 你能看到什么',
  '## 当前页面元素',
  '## 你能做什么',
  // 空段占位
  '（页面暂无可读内容摘要）',
  '（页面暂无可交互元素）',
  '（当前无额外可调用能力）',
  // 无快照整体占位
  '暂无页面快照（浏览器未连接或未推送状态）。',
  // 行内片段骨架
  '（禁用）',
  '操作后：',
  '(无摘要)',
];

let errors = 0;
const fail = (msg) => { console.error(`[check-page-state-schema] ${msg}`); errors++; };

const code = readFileSync(PAGE_STATE_TS, 'utf-8');
const schema = readFileSync(SCHEMA_MD, 'utf-8');

// 1) 关键常量双向校验
for (const s of KEY_STRINGS) {
  if (!code.includes(s)) fail(`代码缺失常量: "${s}"（page-state.ts 被改，同步后删除/更新 KEY_STRINGS）`);
  if (!schema.includes(s)) fail(`schema 缺失文本: "${s}"（代码改了格式，同步 page-state-schema.md）`);
}

// 2) 内容类型联合：ui-registry 活源头 vs schema
const uiReg = readFileSync(UI_REGISTRY_TS, 'utf-8');
const typeLine = uiReg.split('\n').find(l => l.includes("type: 'file-tree'"));
if (!typeLine) {
  fail('ui-registry.ts 未找到内容类型联合（type: \'file-tree\' ...），检查活源头位置');
} else {
  const srcTypes = [...typeLine.matchAll(/'([a-z-]+)'/g)].map(m => m[1]).sort();
  // schema 中「内容层类型」章节列举的取值
  const schemaSection = schema.split('## 各段可能出现的一切文本形态')[1]?.split('### 「## 你能看到什么」')[1] ?? '';
  const schemaTypes = ['text-output', 'card-content', 'file-tree', 'status-bar']
    .filter(t => schemaSection.includes(t));
  const missingInSchema = srcTypes.filter(t => !schemaSection.includes(t));
  const missingInCode = schemaTypes.filter(t => !srcTypes.includes(t));
  if (missingInSchema.length) fail(`ui-registry 新增内容类型未写入 schema: ${missingInSchema.join(', ')}`);
  if (missingInCode.length) fail(`schema 列出的内容类型不在 ui-registry 联合中: ${missingInCode.join(', ')}`);
}

if (errors > 0) {
  console.error(`[check-page-state-schema] ${errors} 处不一致——代码与说明文档必须同步`);
  process.exit(1);
}
console.log('[check-page-state-schema] OK — 代码常量与 schema 一致');
