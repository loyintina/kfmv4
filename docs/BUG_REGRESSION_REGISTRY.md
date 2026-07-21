---
status: active
created_at: 2026-07-21
maintainer: AI agent
---

# KFM v4 — Bug 回归登记表（Regression Registry）

> **把 687 个历史 `fix` 蒸馏成「该不该测 / 测了没」的追踪地图。**
>
> 配套设计文档：`docs/design/REGRESSION_TESTING_SYSTEM.md`（方法论与实施步骤）。
> 编号体系复用 `docs/archive/standards/BUG_AUDIT_REGISTRY.md` 的 B.A.R. 命名空间。
> 隐性契约相关条目与 `docs/DIAGNOSTICS.md` §一 一一呼应。

---

## 分类图例

| 标 | 含义 | 处置 |
|----|------|------|
| `L` | 逻辑：有明确对错、纯函数可测 | 写回归钉子 |
| `I` | 集成：跨模块时序/协作 | 写集成测试 |
| `V` | 视觉：观感，无对错 | 不测，冒烟层兜底 |
| `S` | 叠加：被后续 fix 覆盖的中间态 | 只测最终形态，合并计 |
| `D` | 死：涉及已删除/重写的代码 | 跳过 |

**状态**：`待钉` / `已钉` / `兜底`（冒烟覆盖）/ `跳过`。

---

## 登记表

> **分批滚动填充**，按实施批次推进，不要求一次填满 687 条。
> 表结构：`BAR编号 | commit | 一句话症状 | 类别 | 状态 | 测试位置`

### 第一批：AI 对话运行时（run-manager / chat / 重连）

| BAR | commit | 症状 | 类别 | 状态 | 测试位置 |
|-----|--------|------|------|------|---------|
| BAR-101 | `a5bf0c4` | 生成结束后 `__end__` 不发，发送按钮卡死 + 残留等待框（run.done finally 时序） | I | 待钉 | — |
| BAR-102 | `f46a551` | 推理模型等待提示留白 + 删会话后再发送 400（空 sessionId） | I | 待钉 | — |
| BAR-103 | `1d9fdbc` | 删最后一个会话后统计行不更新 + 光球面板不清空 | L | 待钉 | — |
| BAR-104 | `d4a60f7` | 挂机重连三处：切后台/杀浏览器/发送竞态 | I | 待钉 | — |
| BAR-105 | `da39891` | 取消时未完成工具卡卡在「忙碌中」 | L | 待钉 | — |
| BAR-106 | `7ac8f47` | Claude 工具块非零起始 index → content 空洞 → `reading type` 崩溃 | L | 待钉 | — |

### 第二批：服务端 + 安全边界

> 待步骤 3 填充（path-utils 路径逃逸、files 路由校验等）。

### 第三批：客户端逻辑

> 待步骤 4 填充（滚动约束过滤折叠节点、tree-model 边界、消息计数、mode-system 着色回调 `427c960` 等）。

### 渲染剥离批：canvas-cursor / canvas-scroll

| BAR | commit | 症状 | 类别 | 状态 | 测试位置 |
|-----|--------|------|------|------|---------|
| BAR-201 | `d4f658a` | 液体粒子不跟随光标右滑回弹（坐标系不含 transform.translateX） | L | 待钉（需先剥离纯函数） | — |
| BAR-202 | `9cb6622` | 右滑临时卡组 z-index 埋在文件树之下 | L | 待钉 | — |

---

> 新 bug 修复后：补一个回归钉子 → 在此登记 → 状态置「已钉」。见
> `docs/design/REGRESSION_TESTING_SYSTEM.md` §3 微循环。
