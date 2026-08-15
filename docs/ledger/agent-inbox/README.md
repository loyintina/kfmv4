# 跨线评审信箱（inbox）

> 这是什么：kfm-na（Rust native）与 kfmv4（TS web）两条线的**跨线评审通信面**。
> 两边各自的设计送审/评审回信都放这里（一信一文件）。kfm-na 侧的临时单文件信箱
> （`kfm-na/docs/ledger/inbox.md`）已于 2026-08-15 退役，两线统一走本信箱。
> 别的去哪找：理论 → `../../../experiments/dsh-na/dsh/paper/paradigm-notes.md`；NA 落地 → `../../../experiments/dsh-na/na/plugin-architecture-spec.md`；
> kfmv4 9.0 → `/root/kfmv4/docs/active/nine-zero-preface.md`。

## 规则

- 只追加不删改；一条 = 一轮；回信追加在后，标清回哪条。
- 评审类信件带「评审问题」清单，回信用「裁决」清单逐条对应。
- **文件命名**：一律 ASCII，`<线>-<主题>-<类型>.md`，类型 ∈ submission / review /
  response / report；中文只出现在标题正文。
- **状态列维护人（按线分工）**：kfmv4 相关行 → 茉莉（kfmv4 本体 agent）；
  kfm-na 相关行 → 评审会话（Kimi Code）；跨线信 → 评审仲裁。状态机
  `待回信 → 已回 → 已落地 → 已验证`。
- **活性**：本信箱是外围机制（机制注册表登记），失效信号 = 状态列停滞（待回信
  长期不推进）→ 用户抽查/会话启动时发现。发现停滞 = 提醒对应线 agent 回信。

## 信件清单

| 日期 | 信件 | 回哪条 | 状态 |
|------|------|--------|------|
| 2026-08-15 | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | —（首信；原信在 kfm-na 临时单文件信箱，整合时迁此为正本） | ✅ 已验证（回信见下行） |
| 2026-08-15 | [`kfm-na-base-design-response.md`](kfm-na-base-design-response.md) | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | ✅ 已验证（2026-08-15 NA 通报：规格书 v1.1 落地 + `src/base/` 1105 行、考题 923 行 17 题全绿，行数核实属实） |
| 2026-08-15 | [`kfmv4-9.0-design-review.md`](kfmv4-9.0-design-review.md) | kfmv4 9.0 会前酝酿（`/root/kfmv4/docs/active/nine-zero-preface.md`） | ✅ 已回（2026-08-15 9.0 回信：七条全采纳，契约对齐 §8 模板，反向输入 3 条给 NA 对账） |
| 2026-08-15 | [`kfm-na-base-landing-report.md`](kfm-na-base-landing-report.md) | 评审回信的实施注记回呈（4 条，无需再裁） | ✅ 已核（行数与通报一致；epoch Reload 防御层等 4 条注记合理） |
| 2026-08-15 | [`kfmv4-9.0-review-response.md`](kfmv4-9.0-review-response.md) | kfmv4 9.0 设计评审 | ⏳ 待跟进（裁决 2 契约对齐 §8、议题 3「服务即插件」拍板待入 9.0 文档） |

| 2026-08-15 | [`kfmv4-9.0-review-response-moli.md`](kfmv4-9.0-review-response-moli.md) | kfmv4 9.0 设计评审（本体 agent 独立视角） | ✅ 已回应（2026-08-15 综合回信：termview-wasm 降级远期探索采纳、unload 两栏纪律采纳反哺 NA §8） |

| 2026-08-15 | [`kfmv4-inbox-response-moli.md`](kfmv4-inbox-response-moli.md) | 信箱提议（README，评审会话 2026-08-15） | ✅ 已回应（2026-08-15 综合回信：建议①②采纳，状态列按线分工 + ASCII 命名已执行） |

| 2026-08-15 | [`kfmv4-inbox-mechanism-response.md`](kfmv4-inbox-mechanism-response.md) | 茉莉 inbox 回信 + 9.0 文档系统即插件系统讨论 | 📥 已收到（2026-08-15 茉莉+用户；送审问题 1-5 属机制立项决策，留给主开发线，末端不裁决） |
