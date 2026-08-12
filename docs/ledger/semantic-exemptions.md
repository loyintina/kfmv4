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
| EX-003 | SEM001 | docs/domains/cross-domain.md:54（API_BASE 共 10 处） | HTTP | 临时 | 2026-09-02 | 计数口径分歧（探针 9 vs 文档 10），待人工复核 | 2026-08-02 | e55da744a686fa096050774f30b9a8f59882dcf4 |
| EX-004 | SEM001 | docs/domains/cross-domain.md:20（anim 被三个域调用） | anim | 永久 | — | 实 3 域（client-shell/floating-card/canvas-tree），探针误数 | 2026-08-02 | e55da744a686fa096050774f30b9a8f59882dcf4 |
| EX-005 | SEM001 | docs/ledger/history.md:v8.1.0条目 | v8.1 | 永久 | — | 误报：release.md 判例行自带「v8.1.0 实为混装窗口」内联注，与 history 无冲突（2026-08-03 裁决流取证） | 2026-08-03 | 52ab3496974bffc80f7d3da19c899508090c3395 |
| EX-006 | SEM001 | docs/guides/release.md（minor 加冕定义各行） |  | 永久 | — | 误报（两发两拦）：v8.5.1 即 8.5 主题加冕版，history「8.5 主题继续」指后续 v8.5.2 patch 收尾，正合节奏节「主题闭环打中版本、后续 fix 轮升小版本」；claim 为裸 file:行号故关键词留空按文件豁免，哈希守门（2026-08-03/04 裁决流取证） | 2026-08-03 | 839faf887f691b06e5f1ba3db18804521a26aaa9 |
| EX-007 | SEM001 | docs/domains/infra/contract.md:15（39 脚本） | 39 | 永久 | — | 误报：39 = check-* 脚本数，chain:auto 枚举含 gen-* 验证步/sass/sync-counts/npm test/tsc，紧随的括号注已说明口径（2026-08-03 裁决流取证） | 2026-08-03 | db6cd23fc9b22ab69d7196716ae13e48ccc237aa |
| EX-008 | SEM001 | docs/guides/testing.md（N 个测试行） |  | 永久 | — | 误报：testing.md 测试总数由 sync-counts 自动回写（subs 登记在案），非手写死数、无漂移面；claim 为裸 file:行号故按文件豁免，哈希守门（2026-08-04 裁决流取证） | 2026-08-04 | fb8c2ac08311fb49b9b7d34aef615a2c1ed3fecb |
| EX-009 | SEM002 | docs/domains/infra/contract.md:8（40 脚本） | 40 | 永久 | — | 误报（口径）：40 = check-*.mjs 文件数，链上 38 个以 check- 前缀书写（deploy-freshness/doc-coverage 在链上省前缀），与 EX-007 同根「探针不知口径有机械主人」；口径注已补（2026-08-05 裁决流取证） | 2026-08-05 | f34a211675be521d0cc7a97dcf6b8f1538639e42 |
| EX-010 | SEM002 | README.md（check 脚本计数行） |  | 永久 | — | 误报：README check 数由 sync-counts 机械回写（现 42 = 脚本实数），发现基于同步前旧计数；与 EX-008 同判例「计数有机械主人」，claim 为裸 file:行号故按文件豁免，哈希守门（2026-08-06 裁决流取证） | 2026-08-06 | 099e419192c463bc8b752d11cc79342b52f2828b |
| EX-011 | SEM001 | README.md（回归测试计数行） |  | 永久 | — | 误报：README 测试数由 sync-counts 从实跑结果机械回写（现 524 = build 实测），探针「实测 456」为自身计数口径误；同 EX-008 判例，按文件豁免，哈希守门（2026-08-06 裁决流取证） | 2026-08-06 | 099e419192c463bc8b752d11cc79342b52f2828b |
| EX-012 | SEM002 | docs/domains/infra/contract.md（chain:auto 'checks' 步） | checks | 永久 | — | 误报：chain:auto 短名 `checks` 即 check-checks.mjs（链枚举剥 check- 前缀，sync-counts 从 chain.mjs STEPS 生成），gen:contract-list 实含该文件——探针不知短名映射；同 EX-009 家族「生成区事实有机械主人」（2026-08-12 裁决流取证） | 2026-08-12 | e194dcbfe4253933e21d4abc2eea53e99ee3b983 |
