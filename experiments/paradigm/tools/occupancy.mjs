#!/usr/bin/env node
/**
 * occupancy.mjs — 真实占用率口径（2026-08-06）
 *
 * 背景：arms.occupancy 列由 fullTokenCount（增量计数）算出，不反映真实上下文，
 * 实测 <8k 带挤进 1232 臂（其中大量 90k 包臂）。本模块提供正确口径：
 *   occ_ratio = 范式包标称尺寸 ÷ 模型窗口
 * 两个登记表都是**手工维护**的——新包/新模型入场时必须同步登记：
 *   1. 范式包尺寸：以 tools/build-length-paradigms.py 产出（或 wc -c/3.2）为准
 *   2. 模型窗口：与 experiments/model-econ.md 的窗口列保持一致（该文档有登记入口）
 * 登记缺失 → occ_ratio = NULL（宁缺毋假，分析时按缺失处理）。
 */

/** 范式包标称尺寸（k tokens）。'无' = 对照组 0。 */
export const PACK_TOKENS_K = {
  '无': 0,
  'metacognition': 8.1,
  'metacognition-32k': 30.1,
  'metacognition-48k': 47.4,
  'metacognition-64k': 64.5,
  'metacognition-96k': 89.8,
  'metacognition-h4k-x2': 8.0,
  'metacognition-h15k-x2': 31.0,
  'metacognition-h24k-x2': 48.7,
  'metacognition-h32k-x2': 65.1,
  'metacognition-h45k-x2': 91.5,
  'metacognition-8k-dup': 16.3,
  'metacognition-32k-dup': 60.2,
  'metacognition-48k-dup': 94.9,
  'metacognition-64k-dup': 129.0,
  'metacognition-96k-dup': 179.5,
  'e12-w1-seamless': 29.0,
  'e12-w2-lightmark': 29.0,
  'e12-w3-declaration': 29.0,
  'e12-w4-boundary': 29.0,
  'measured-decision': 2.9,
  'measured-decision-full': 4.1,
  'root-cause-first': 7.8,
  'behavior-discipline': 7.2,
  'e16-s6-retro': 7.8,
};

/** 模型窗口（k tokens）。键为模型名片段（includes 匹配，长片段优先）。 */
export const MODEL_WINDOWS_K = {
  'MiniMax-M2.5': 197,
  'DeepSeek-R1': 164,
  'DeepSeek-V3': 164,
  'Qwen3.5-27B': 262,
  'Qwen3.5-9B': 262,
  'Qwen3.6-35B': 262,
  'GLM-Z1': 131,
  'GLM-4.5-Air': 131,
  'Ling-min': 131,
  'Step-3.5': 262,
  'gemini-3': 1000,
  'gemini-2.5': 1000,
  'gpt-5.6-luna': 272,
  'gpt-5.4-mini': 400,
  'gpt-5-mini': 400,
  'gpt-5': 400,
  'claude-opus': 200,
  'claude-sonnet': 200,
  'claude-haiku': 200,
  'deepseek-v4-flash': 1024, // DS 官方 1M（api-docs.deepseek.com 2026-08-07；hermes-agent#15983 亦记 1M）
  'deepseek-v4-pro': 1024, // 同上
  // 未登记（窗口未核实，occ_ratio 计 NULL）：glm-5 /
  // kimi-k2.5 / mimo-v2.5 / minimax-m2.5|m2.7|m3（聚光按次版）/ qwen3.5-plus
};

/** 真实占用率（0-1+ 小数）；包或窗口未登记返回 null。 */
export function occRatio(paradigm, model) {
  const pack = PACK_TOKENS_K[paradigm];
  if (pack === undefined) return null;
  if (pack === 0) return 0;
  const frag = Object.keys(MODEL_WINDOWS_K)
    .sort((a, b) => b.length - a.length)
    .find(f => model.includes(f));
  if (!frag) return null;
  return pack / MODEL_WINDOWS_K[frag];
}
