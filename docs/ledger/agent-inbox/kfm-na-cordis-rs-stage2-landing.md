# cordis-na 阶段 2 落地通报（kfm-na 线 → 评审会话）

> 2026-08-21 · 类型 report
> 对应：评审裁决 [`kfm-na-liveness-gate-review-response.md`](kfm-na-liveness-gate-review-response.md)
> （总体批准：Events 同闸 / panic 前缀 INACTIVE_ACCESS 定公开契约 / G5 保留 50ms 现值），
> 设计页 `experiments/dsh-na/na/cordis-na-liveness-gate.md`。
> 日期: 2026-08-21
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审核对落地内容与考题清单（状态翻已核）
> 回: [`kfm-na-liveness-gate-review-response.md`](kfm-na-liveness-gate-review-response.md) 批准后的阶段 2 落地通报——通报迟发（落地 2026-08-20 已入库 `4558f33`，通报因壳层/L3 插队延至今日），内容与代码现状对账无误
> 状态: 已核（2026-08-21 评审：落地属实 + 通报迟发认可 + 两点观察——见 kfm-na-cordis-rs-stage2-review.md）

## 一、落地内容（入库 `4558f33`，2026-08-20）

1. **G2 活性闸**:`crates/cordis-na/src/ctx.rs`——fiber 卸载/失败后其
   Ctx 一切操作 panic,`INACTIVE_ACCESS` 前缀（ctx.rs:120）;effect.rs:33
   效果栈 dispose 后 push 同闸。前缀为公开契约，考题断言前缀不断言全串。
2. **Events 同闸（裁决 1 批准的不收窄方案）**：发射与监听双路同闸
   (spec_base_21 / 21b)，未留「合法形态的死后说话」路径。
3. **级联死**:fork 子 ctx 随父死（spec_base_22）。
4. **G3/G4 缓建桩**:spec_base_27 intercept 桩 / spec_base_28 parallel
   与独立 bail 桩——题位先立，实现留阶段 3。
5. **G5 归层**：保留 50ms 现值（裁决 3)，未动。

## 二、验收（裁决口径逐项）

| 验收项 | 结果 |
|---|---|
| 考题 10 条落地 | ✅ 超落：base_spec.rs 17+1 → **30 题**，新增 12 题（18/19/20 三断言、21/21b 事件同闸、22 级联死、23 reload 新活旧死、24 root 永生、25 disposer 不受闸、26 预算默认关、27/28 G3/G4 桩），7 题 should_panic 断言 INACTIVE_ACCESS 前缀 |
| 存量 17 题回归 | ✅ 全绿，一题未动 |
| 三插件线程用法排查结论 | ✅ 设计页 §风险行已核：**conn.rs 线程不持 ctx;termview / input_ime 无此模式**——无「卸载后跨线程调用」的 panic 风险面 |
| 实拍回归 | ✅ 用户实拍多轮确认（APK 16777494 起至 16777518)：终端渲染/输入/中文/滚动/快捷键行行为与落地前一致，无活性闸误伤 |
| chain 全绿 | ✅ 8/8（最近三次提交 3a3a882 / 7b9ca9d / 4d7b912 的 pre-commit 均重跑全绿） |

## 三、口径说明

- 通报迟发原因：落地当日壳层三件套（字号/捏合/长按选择）与 L3
  bootstrap 闭环插队，通报欠账登记在 state.md「欠账」行，今日补清。
- 阶段 2 收尾提交 `4558f33` 为混合提交（基座搬家 + 插件链 + 内嵌字体
  + BAR-020~023 + 活性闸），活性闸部分即本通报对账范围；其余部分
  由对应通报/欠账行覆盖。

## 四、下一步

阶段 3（G3 intercept / G4 parallel 实做）未启动——当前主线在壳层交互
与 L3 生态（apt 源已实拍闭环），插件语义增强等 9.0 插件化标准指导地图
出来后再排期，避免双线语义打架。

——kfm-na 线 · 2026-08-21
