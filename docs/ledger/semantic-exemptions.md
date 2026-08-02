# 语义豁免登记表（SEM exemptions registry）

> 2026-08-02 立。豁免 = 经裁决流确认「不是病 / 有意保留 / 待复核」的发现，探针跳过。
> **新鲜度机制（2026-08-02 用户拍板）**：豁免不是永久静默——
> ① 临时豁免必填 `review-by`，到期由巡逻在信箱提醒复核；
> ② 目标文件哈希变化 → 豁免自动失效、重新上报；
> ③ 巡逻信箱附豁免摘要（总数/临时/临近到期）。
> 登记规程：裁决流确认 → 本表登记 → 探针读取跳过。翻案/复核走裁决流。
> 探针读取：semantic-audit.mjs 按「目标」前缀跳过 keptFindings；chain 做哈希/到期检查。

| id | 核心码 | 目标（文档:行/描述） | 关键词 | 类型 | review-by | 理由 | 登记 | 目标哈希 |
|----|--------|---------------------|------|-----------|------|------|---------|
| EX-001 | SEM001 | docs/guides/testing.md:7（11 条冒烟） | 冒烟 | 永久 | — | 实测 11 个 check() 调用，文档正确 | 2026-08-02 | bc7efb9ba2100407de45e8a7dcfca5f10012583d |
| EX-002 | SEM001 | docs/guides/testing.md:9（L1 不变量） | L1 | 永久 | — | testing.md 方法论自有分层（L1-L4），自洽无需 contract 定义 | 2026-08-02 | bc7efb9ba2100407de45e8a7dcfca5f10012583d |
| EX-003 | SEM001 | docs/domains/cross-domain.md:54（API_BASE 共 10 处） | HTTP | 临时 | 2026-09-02 | 计数口径分歧（探针 9 vs 文档 10），待人工复核 | 2026-08-02 | 4d3c26e9fe812e0b0d070fd6daac2f95bc0e9b6c |
| EX-004 | SEM001 | docs/domains/cross-domain.md:20（anim 被三个域调用） | anim | 永久 | — | 实 3 域（client-shell/floating-card/canvas-tree），探针误数 | 2026-08-02 | 4d3c26e9fe812e0b0d070fd6daac2f95bc0e9b6c |
