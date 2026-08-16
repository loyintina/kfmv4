> 这是什么：9.0 大重构的**设计地图**——全部内容的功能台账 + 契约索引 + 依赖图 + 推进日志。
> 别的去哪找：拍板结论与决策史 → nine-zero-preface.md（会前酝酿记录）；组件契约正文
> → 同文档 №1~№9（转正时迁出分文件）；评审往来 → ../ledger/agent-inbox/；
> v8 功能总目录（机械生成）→ ../domains/capability-map.md。

# 9.0 设计地图

> 2026-08-16 立。组织方式：一点一点讨论，写一点、测试、论证审核复查审计、再推进
> （spec-driven 元工作流）。**台账先行，逐插件填充**——每行归宿拍板后，契约讨论
> 成熟一个定稿一个（正文暂记 nine-zero-preface.md，转正时迁出）。
>
> **全覆盖军规（2026-08-16 拍板）**：本台账 + 共享基础件表 + 域外表合计必须覆盖
> v8 src/ 全量 36,012 行 / 152 文件——每行要么有契约、要么有归宿、要么明确拍板
> 移除。防 7→8 跨版本信息丢失重演。基线盘点：已规划 22,681 行（63.0%，扣语料/
> 生成物后纯逻辑约 56%），未规划 13,331 行已全部登记入下表（带 Ⓟ 行数标注）。

## 设计原则（拍板于 nine-zero-preface.md，此处索引）

- 一切皆插件：内核只留 ctx 基座（事件总线 / inject 引擎 / 生命周期 / 渲染宿主）+
  手势分发；**服务即插件**（服务与卡片同为插件，仅 provide 内容不同）；
- **插件化的是"效果"不是代码**（2026-08-16）：纯函数库无注册/订阅/状态，import
  即用，是 lib 层不入插件体系；有状态、有注册表的件才做成服务插件；
- 三状态归属表：登记类逆序摘 / 发射类不撤 / 数据归数据管理器；插件只持私有草稿；
- 布局 = 卡片摆放管理（一种语义）；tmux 是全屏卡片；动画整体插件化，组件 v1 零动画；
- 池结构：agent = 组合（prompt × model × 工作区），箭头只向下，引用即 relied；
- 契约模板对齐 NA 规格书 §8 九字段 + apply/unload 两栏不得缺栏；卸载三相 +
  take-once + 观察等价；事件逐条标派发模式；
- 验收哲学：不用的干净消失，需要的随时召唤；**抽文件测试**判据（执行两式：
  变异抽检 / 配置禁用；恢复 = 重构建后）；
- 迁移法：绞杀者两步走（数据管道换心 → 搬进新容器）+ 功能一致对照表 +
  保留性考题三条。

## 组件台账（v8 全部内容 → 9.0 归宿）

### 内核（不可插拔，目标压到最小）

| 件 | 来源 | 状态 |
|----|------|------|
| ctx 基座（事件总线 / inject 引擎 / 生命周期） | 新建（参考 kfm-na `src/base/` 已验证实现） | 待设计 |
| 渲染宿主（DOM 容器 / 摘容器 API） | 新建 | 待设计 |
| 手势分发 | v8 gesture-registry 收编 | 待设计 |
| 启动引导 | main.ts 131 + app.ts 130 + app-lifecycle 20 + logger 57 + version-watch 59 Ⓟ397 | 待设计（压到最小） |
| ws 服务端对 | ws-server.ts + renderer-lifecycle.ts Ⓟ计入内核基线 | 待设计 |

### 服务插件（数据管理器阶层）

| 服务 | 收编 v8 内容 | 契约 | 状态 |
|------|--------------|------|------|
| card-types broker | 卡片注册表（155 行）+ singleton 声明（修订注） | №6 | ✅ 定稿 |
| tool-host 工具宿主 | tools/index.ts 170 + types.ts 109 框架；各工具插件：omp/browser Ⓟ2422 / omp/debug Ⓟ1274 / 小工具群 Ⓟ677 / 自指工具 Ⓟ323（含 kfm-hand-press、restart） | №10 | ✅ 定稿 |
| ledger-service 账本 | tool-exec.jsonl 机制提为通用 append-only 服务（执行账/裁决审计/操作审计） | №10 附属 | ✅ 定稿 |
| session-store | 会话存储与压缩（sessions/）+ routes/compact.ts Ⓟ126；落盘纪律自管（承重墙） | №12 | ✅ 定稿 |
| pool-system | API卡/角色卡/配置卡/会话卡的数据层 + routes/proxy Ⓟ93 + routes/providers Ⓟ65 + env-store Ⓟ102 + **workspaces/ 点亮**（agent 工作区维） | №3 附属 + №12 | ✅ 定稿 |
| agent-service | 流式对话 / 工具循环 / prompt 装配线 + **server 对话管线：chat.ts Ⓟ571 / run-manager Ⓟ239 / routes Ⓟ160** | №2 附属 + №12 | ✅ 定稿 |
| dynamic-prompt-files | prompts/dynamic/ 目录管理 | №5 附属 | 待设计 |
| tree-data | 懒加载（tree-loader / list-recursive） | №7 附属 | 待设计 |
| file-io | routes/files.ts 文件 CRUD Ⓟ457（池文件与通用读写走它） | №12 附属 | 待设计 |
| theme | theme.ts | — | 待设计 |
| permission-engine | 权限裁决 + 读写监狱（permissions.ts + path-utils.ts 路径监狱 Ⓟ171） | — | 待设计（已拍板提为服务插件 2026-08-16） |
| style-registry | 样式注册表 Ⓟ161（有状态注册表 → 服务插件） | — | 待设计 |
| tool-compaction | 工具 I/O 压缩注册表 Ⓟ369（shared，双端） | — | 待设计（或归 tool-host 附属） |

### 卡片插件

| 卡 | 收编 v8 内容 | 契约 | 状态 |
|----|--------------|------|------|
| 对话卡（渲染壳）→ 窗口卡（完全体） | 光球面板 + 会话聊天面板 + 全局输入栏收编 | №2 + №9 | ✅ 定稿 |
| 终端卡 / tmux 卡 | terminal-card-04 + tmux-card | №1 | ✅ 定稿 |
| 池卡（七 tab） | API/角色/配置/会话/工具/脚本卡 | №3 | ✅ 定稿 |
| 文件树卡 | Canvas 文件树重写（DOM 化，UI 不变）+ mode-system Ⓟ446（copy/move/delete 模式工具栏，读码消解归此） | №7 | ✅ 定稿 |
| 手 | hand.ts（通用多实例） | №4 | ✅ 定稿 |
| todo 卡 | todo 工具的面板呈现 | — | ✅ 已拍板：工具附属 UI 卡（工具经 №6 注册卡类型，todo 为首例） |
| apk 卡 | apk.card Ⓟ71（KFM-NA 安装包下载卡） | — | 待定归属（保留为小卡 or 移除） |
| file.card stub | Ⓟ18 空壳 | — | 待定（建议移除） |
| 日志卡 | debug.card Ⓟ110 | — | ❌ 已拍板移除 |

### 包（bundle）

| 包 | 内容 | 契约 | 状态 |
|----|------|------|------|
| 眼睛包 | 总插件 + 六段 | №5 | ✅ 定稿 |
| 池卡 | 容器 + 七 pool-page | №3 | ✅ 定稿 |
| UI 皮肤包 | 主题/配色/质感/theme.ts/style-registry 归包内；默认包=v8 深蓝意志 | — | 待设计（已拍板皮肤可插拔 2026-08-16） |
| 动画插件 | v8 交互动画收编：GSAP / 双树 overlay / 字符雨 / 徽标引擎 Ⓟ493 / 光标液体粒子 liquid-geometry Ⓟ108 / canvas-cursor Ⓟ392 / animation-registry Ⓟ75 | — | 远期（v1 组件零动画） |
| 多端适配包 | 浮卡工作台（桌面端布局插件，未来新写，v8 代码留仓参考） | — | 远期（2026-08-16 拍板降级） |

### 布局与壳

| 件 | 说明 | 状态 |
|----|------|------|
| 全屏层叠布局（默认，手机优先） | 启动器点卡直接全屏；保留全屏关闭 UI；取消浮卡切换 UI | №11 ✅ 定稿 |
| headless 布局 | 同接口不渲染（A 档测试 / AI 无头自测） | №11 ✅ 定稿 |
| 卡片堆 → 启动器插件 | 手势唤出抽屉（UI 保留）→ broker 枚举 → 开卡；摆放归布局 | №11 ✅ 定稿 |
| tmux 全屏卡 | 全屏层叠语境下的全屏卡（议题 1 下钻语义不变） | №11 语境 ✅ |
| 浮卡工作台 | v8 floating-card Ⓟ810 + fullscreen Ⓟ213 + shared Ⓟ172 不迁移留仓 | → 多端适配远期包（用户拍板 2026-08-16） |
| 顶栏（槽位 broker + tmux 管理） | 徽标/余额/系统三格/光球/tmux 五槽位；tmux 逻辑归 server 服务 | №8 ✅ 定稿（含 slot-sys 修订注） |
| OBS HUD / 徽标 | ✅ 消解：HUD=顶栏本体（归 №8）；徽标动画引擎归动画插件；坐标注册归 №5 | — |

### 共享基础件（lib 层，非插件——"效果非代码"原则 2026-08-16）

| 件 | 行数 | 说明 |
|----|------|------|
| md 渲染器集群 | Ⓟ740 | renderers/：handler-factory / math-diagram / code-highlight / md-* / 预览回退 |
| 通用 UI 件 | Ⓟ549 | custom-select 245 / confirm-dialog 191（=各契约引用的 showConfirm）/ card-toast 52 / color-utils 45 / debug-assert 16 |
| canvas 交互件 | Ⓟ476 | canvas-scroll 358 / canvas-utils 60 / click-queue 38 / interaction-constants 20 |
| shared 协议层 | Ⓟ571 | chat-protocol 542（to-openai-messages / reducer）+ message-normalize 29 |
| 数据语料 | Ⓟ1107 | waiting-hints.ts（等待提示语料，归窗口卡包内数据，不是逻辑） |
| 生成物 | Ⓟ1354 | scripts-catalog.ts（构建期生成，归池卡包数据源） |

### 域外（不进 9.0 插件体系）

| 内容 | 处置 |
|------|------|
| 运维 10 项（检查链/文档系统/错误码/agent-runner/守视/语义审计/部署/回归） | 项目基建，留在 server/scripts，非运行时插件 |
| 研究 4 项（paradigm/coldstart/docprobe/session-runner） | experiments/ 不动；paradigm 池卡已拍板取消 |
| tests/ Ⓟ8090 | 测试基建，随重构整体重写（绞杀者两步走的对照基） |
| server/index.ts Ⓟ187 入口 | 服务端引导，归 server 壳（同客户端启动引导待遇） |

## 依赖图（已定稿部分）

```
内核 ctx ── 手势分发 / 渲染宿主
  └─ card-types broker(№6, +singleton)
       ├─ 终端卡(№1) ← term-renderer / term-connection
       ├─ 对话卡(№2)/窗口卡(№9) ← agent-service / session-store / 基础四池(读)
       ├─ 池卡包(№3) ← pool-system ← persistence
       ├─ 文件树卡(№7) ← tree-data
       └─ 手(№4) ← render-host / gestures / events
  └─ dynamic-prompt-files ← 眼睛包(№5)（段 ← 布局服务直读几何）
  └─ 布局插件（全屏层叠默认 / headless；浮卡 → 多端适配远期）← 渲染宿主
  └─ 顶栏(№8) ← 槽位插件（徽标/余额/系统三格/光球/tmux标签）；tmux 服务归 №1 连接家族
  └─ tool-host(№10) ← 工具插件包（core-tools / kfm-tools / browser / debug）
       ← permission-engine（闸①②裁决）/ ledger-service（闸④账本）
  └─ agent-service(№12) ← tool-host / session-store(№12) / pool-system(№12)
       ← file-io；workspaces/ = agent 工作区维（pool-system 管）
```

## 推进日志

- 2026-08-15：会前酝酿立档（nine-zero-preface.md）；议题 1 / 议题 1 下钻 /
  议题 3 / 服务即插件 / 契约模板 / 验收哲学 / 试点顺序拍板；契约 №1~№3 定稿；
  评审七条 + 茉莉本体视角全采纳落档。
- 2026-08-16：契约 №4~№7 定稿；动画整体插件化拍板；抽文件测试判据化；
  评审两轮（进度评审 3 条 / broker 契约评审 3 条）全采纳闭环；**设计地图立档**；
  契约 №8 顶栏定稿（槽位 broker + tmux 管理服务，事件驱动，清空需确认+审计）+
  slot-sys 修订注；零碎裁决轮：权限引擎提为服务插件 / todo 卡=工具附属 UI 卡首例 /
  OBS HUD 消解归 №8；契约 №9 窗口卡定稿（五部件/挂点/四元组自配置不命名/
  启动器统一入口/收起≠销毁）+ №6 singleton 修订注；**全覆盖盘点**：src/ 36,012 行
  基线，已规划 63%，未规划 13,331 行全部登记入台账（工具宿主列为 №10 候选）；
  "效果非代码"原则 + 全覆盖军规拍板；
  契约 №10 工具宿主定稿（骨架固定+闸可插拔+只收不放 / 四家族归堆 /
  重子系统懒加载 / ledger-service 同稿）；UI 皮肤包拍板（默认=深蓝意志）；
  契约 №11 布局壳定稿（全屏层叠默认+headless / 浮卡降多端适配远期包 /
  点卡直接全屏）+ №9 几何户口简化修订注；mode-system 读码消解归 №7；
  契约 №12 服务层三件套定稿（persistence 不新建 / workspaces 点亮 /
  active.json 葬礼）；r3 评审五条全采纳（№9/№7 修订注 + 契约模板升格四条 +
  军规判据强化：归宿=可执行迁移路径）。

## 待讨论

- apk 卡 / file.card stub 归宿；
- 窗口卡完全体的剩余工程细节（№9 已定骨架 + 几何户口简化修订注）；
- 议题 5（termview-wasm 远期）/ 议题 6（协作基建，归主开发线）/ wechat 模式
  （远期，9.0 只打地基）——见 nine-zero-preface.md。
