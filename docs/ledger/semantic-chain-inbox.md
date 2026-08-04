# 语义巡逻信箱（semantic-chain.mjs 自动写入，append-only）
> 这是什么：腿三巡逻的逐轮结论。agent 会话启动时读尾部——⚠️ 行进 workflows/semantic-audit.yaml 裁决流。
> 别的去哪找：发现明细 → semantic-audit-state.json；裁决记录 → semantic-provenance.md；巡逻脚本 → scripts/agent/semantic-chain.mjs。

- 2026-07-30 17:32 ⚠️ 8 条新发现待裁决（跑 24 跳 0，幻觉拦截 6）→ 明细见 semantic-audit-state.json，裁决流 workflows/semantic-audit.yaml
- 2026-07-30 18:00 ⚠️ 10 条待裁决（本轮新增 2，跑 3 跳 21，幻觉拦截 0）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-07-30 18:14 ⚠️ 2 条待裁决（本轮新增 2，跑 16 跳 8，幻觉拦截 3）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-07-30 18:26 ⚠️ 1 条待裁决（本轮新增 1，跑 17 跳 7，幻觉拦截 2）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-07-30 18:39 ✅ 干净（跑 1 跳 23，幻觉拦截 0）
- 2026-07-31 04:17 ⚠️ 3 条待裁决（本轮新增 3，跑 14 跳 10，幻觉拦截 2）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-08-01 04:17 ⚠️ 3 条待裁决（本轮新增 0，跑 2 跳 22，幻觉拦截 0）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-08-02 04:17 ⚠️ 11 条待裁决（本轮新增 11，跑 20 跳 4，幻觉拦截 2）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml
- 2026-08-02 ⚠️ 入口文档体检 FAIL（6 臂：实错 0.33/臂 LCA 0/6 硬破界 0/6 质疑 1/6）→ 走 onboarding.md 修复轮
- 2026-08-02 📊 - LLM 调用：372 次 · 成功 84 · 失败 288 · 平均 111s/次
- 2026-08-02 ⚠️ 入口文档体检 FAIL（3 臂：实错 0.00/臂 LCA 0/3 硬破界 1/3 质疑 0.3333333333333333/3）→ 走 onboarding.md 修复轮
- 2026-08-03 ✅ 入口文档体检通过（6 臂：实错 0.17/臂 LCA 0/6 硬破界 0/6 质疑 1/6）
- 2026-08-03 ✅ 入口文档体检通过（3 臂：实错 0.33/臂 LCA 1/3 硬破界 0/3 质疑 0.6666666666666666/3）
- 2026-08-03 22:09 ⚠️ 11 条待裁决（SEM001×8 SEM002×3；本轮新增 10，跑 23 跳 1，幻觉拦截 5）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml；机械化候选（≥3 次）：SEM001/SEM002
- 2026-08-04 04:17 ⚠️ 5 条待裁决（SEM001×4 SEM005×1；本轮新增 4，跑 13 跳 11，幻觉拦截 2）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml；机械化候选（≥3 次）：SEM001
- 2026-08-04 ✅ 结晶回路收割落地：check-doc-scripts.mjs 上岗（BAR-DOCSCRIPTS-01）——M03/M05/M13 引用 ghost 从语义层移民机械层，变异基准注解机械化，check 39→40（sync-counts 派生）
