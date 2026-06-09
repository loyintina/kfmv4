# KFM v4 文档维护指南（AI 必读）

本文档说明 KFM v4 的文档体系结构及其维护规范。
改活跃文档前先通读本文。

---

## 一、文档分层

```
docs/
├── AGENTS.md                   ← 本文。AI 文档维护指南
├── HANDBOOK.md                 ← 工作手册：架构、调试、待办、测试（日常翻）
├── KFM_V4_INVARIANTS.md       ← 修改约束：心法 + 自查清单（改代码前读）
├── VISION_AND_ROADMAP.md      ← 远景：核心理念 + 演进路线（规划时参考）
├── ENGINE_ARCHITECTURE.md     ← 引擎层架构（改渲染逻辑前读）
├── design/                    ← 待实现的设计提案
│   └── WORKBENCH_SPEC.md      ← 卡片工作台（唯一 active 设计提案）
└── archive/                   ← 历史文档仓库
    ├── README.md              ← 子目录导览 + 每类什么时候值得翻
    ├── handoffs/              ← 版本交接记录
    ├── ui-registry/           ← UI Element Registry 设计/审计
    ├── card-system/           ← 浮卡统一化尝试记录
    ├── architecture-vision/   ← 原始愿景蓝图
    ├── engine/                ← 渲染引擎改造计划
    ├── standards/             ← 调试/Bug/测试规范
    ├── bugs/                  ← Bug 修复记录
    └── legacy/                ← 旧版本文档
```

## 二、根层文档职责（不可违反）

| 文档 | 职责 | 谁维护 |
|------|------|--------|
| `HANDBOOK.md` | 当前状态、待办、陷阱、架构速查、测试 | 每次改代码后同步 |
| `KFM_V4_INVARIANTS.md` | 心法原则、约束、补丁模式、自查清单 | 发现新约束时追加 |
| `VISION_AND_ROADMAP.md` | 核心理念、演进路线、开放问题 | 做重大决策时更新 |
| `ENGINE_ARCHITECTURE.md` | 引擎层 14 个文件的架构描述 | 改渲染逻辑后同步 |
| `design/WORKBENCH_SPEC.md` | 唯一待实现的设计提案 | 定了方案才改 |

### 根层文档维护规则

1. **`HANDBOOK.md` 是最容易过时的**。每次改完代码，检查：
   - 待办表是否需要标记✅
   - 陷阱是否需要新增/更新
   - 版本历史是否需要加一行

2. **`CLAUDE.md` 中的文档体系图**（第 35-52 行）。加了新文档或移动后必须同步更新。

3. **`VISION_AND_ROADMAP.md` 不追实现细节**。它是方向性文档，具体实现记录在 HANDBOOK 中。

## 三、archive 维护规则

### 3.1 什么文件放进 archive

- 已完成的设计提案（被代码实现或放弃的）
- 已完成的改造计划（推理链值得保留的）
- 版本交接记录（纯历史）
- 已被根层文档覆盖的旧规范

### 3.2 文件命名规范

- 使用 `kebab-case.md`
- 版本号优先：`v6.6.1-box-location-map.md`
- 避免泛称：不用 `README.md` 以外的不带版本/主题的名字

### 3.3 Frontmatter 规范（check-docs.mjs 验证）

每份归档文件必须以 `---` 开头，包含：

```yaml
---
status: superseded        # active / draft / superseded / completed / relocated / proposal
superseded_by: docs/HANDBOOK.md  # superseded 时必须指明被谁覆盖
archived_at: 2026-06-09          # 归档日期
---
```

### 3.4 新增归档流程

把文件放入对应子目录：

| 内容 | 目标目录 |
|------|---------|
| 版本交接 | `archive/handoffs/` |
| Registry 相关 | `archive/ui-registry/` |
| 卡片系统相关 | `archive/card-system/` |
| 架构/远景讨论 | `archive/architecture-vision/` |
| 引擎/渲染相关 | `archive/engine/` |
| 操作规范/流程 | `archive/standards/` |
| Bug 修复 | `archive/bugs/` |
| 旧版替换文档 | `archive/legacy/` |

## 四、check-docs.mjs 维护

`check-docs.mjs` 会自动扫描所有 `.md` 文件并检查：

1. **内部链接有效性**：所有 Markdown 链接 `text → path` 指向的文件必须存在
2. **Frontmatter 完整性**：archive 下文件必须有 status
3. **篇幅警告**：超 500 行提出 warning
4. **CLAUDE.md 引用存在性**：CLAUDE.md 中 `docs/xxx` 的引用必须指向真实文件

改目录结构或新增文件后，跑 `npm run check` 验证无错误。

## 五、设计提案生命周期

1. 初稿写在 `docs/design/` 下，status 标记为 `draft`
2. 讨论确认后进入实施
3. 实施完成后移入 `archive/` 下对应子目录，status 改为 `superseded`，加 `superseded_by` 指向代码或 HANDBOOK 对应章节
4. 如果设计被放弃，直接改为 `superseded` 注明原因
