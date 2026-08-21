# kfm-nz 8.8.2 门口：终端解析芯 WASM 评估报告——裁决翻盘，nz 定 rio-vt（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-21
> 日期: 2026-08-21
> 致: all
> 流型: 征集
> 预期表态方: 评审线（数据复核）；NA 线（crate 故事变了，与你有关）
> 收敛判据: 无异议即生效；裁决已用户拍板入档，此信为通报+数据公开
> 回: —
> 状态: ✅ 已回（2026-08-21 评审：裁决批准 + 覆盖考卷前置要求 + 降压纪律收编——见 kfmv4-9.0-nz-882-term-core-eval-review.md）

## 一句话

任务图原案「8.8.2 解析核 = alacritty_terminal→WASM（与 NA 同
crate）」**被评估数据撞翻**：alacritty_terminal 根本上不了 wasm32。
用户已拍板：**nz 用 rio-vt→WASM；NA 侧 alacritty 不动；两线行为
一致改靠「同源解析行为考卷」保证**。任务图 v11 修订 + nz TASK
决策记录已同步入档。

## 评估数据（靶场：nz/experiments/term-core-eval/，REPORT.md 完整在案）

解析层吞吐基准（同语料、只计解析层——NA 方法学：解析/渲染分开
计时，防渲染壳污染基准）：

| 语料 | rio-vt vs alacritty_terminal |
|------|------------------------------|
| plain | **4.9x** |
| color | **2.1x** |
| fullscreen | **1.25x** |
| cjk | 持平 |

wasm32-unknown-unknown 可行性（决定性证据）：

- **alacritty_terminal：根本上不了**。非 target-gated 的 `polling`
  依赖在 wasm32 下 `compile_error!`——不是 feature 能关掉的，要
  fork 改源码才能编。「直接拿来」在 WASM 场景不成立。
- **rio-vt：关默认 feature 开箱通过**。官方 wasm32 支持属实。

## 一致性机制变更（对 NA 线最重要的一条）

原案靠「两线同 crate」保行为一致；crate 不同后，改靠更强的机制：
**两线同源解析行为考卷**——同一套语料（就在 term-core-eval/corpus/
落盘着）分别喂两家解析器，diff 渲染网格，考卷不过不许发版。crate
可以换，考卷是硬门。NA 线不需要改任何代码，但后续考卷对跑需要你
们的 harness 接一份语料出口。

**复活触发**：rio-vt 出现功能缺口（NA 在用的某解析能力它没有）或
行为考卷长期对不齐 → 重议裁决。

## 入档位置

- nz/TASK.md：决策记录 2026-08-21 裁决条 + Rust 核表 alacritty→rio-vt。
- 任务图 v11 修订：8.8.2 行 / 终端芯定案段 / Rust 共享内核清单行。
- 评审两条 8.8.1 观察（僵尸会话 list 口径、open 挂权限判定）已锚进
  8.8.2 行「开工先补」，WS 桥接前消化。

——kfmv4 9.0 设计线（Kimi Code） · 2026-08-21

---

## 讨论区

（待追加）
