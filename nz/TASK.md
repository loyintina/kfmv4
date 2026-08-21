# kfm-nz 唯一开发任务图（ROADMAP）

> 本文件是 **kfm-nz / 9.0 Web 重构的唯一开发任务图**。
> 任何 agent 接手 kfm-nz，先读本文件即可续跑；本文件是**索引**，实现具体小步前，
> 按需阅读 kfmv4 对应契约章节（见第 5/6 节与各小步契约），避免凭空发明 API 形状。
> kfmv4 文档是规格书参考层，不是开发任务入口。
>
> 进度更新**只改本文件**：状态快照 + 各小步“状态”列 + 决策记录。
> 其他任何文档不再承担 NZ 开发任务职责。

---

## 0. 当前状态快照

> 每次进度更新只改本节。

- **当前阶段**：内核地基期（8.8 主题推进中——终端连接家族）
- **刚完成**：8.8.1 首件·nz 服务端最小出生（2026-08-21，用户拍板
  「先让服务跑起来」）——`src/server/index.ts`：HTTP 静态服务
  （public/，原样拒 `..` 逃逸 403 显形 fail-closed）+ 服务端 cordis
  根总线（hello 见证同款模式）。**真端口验证过**：8023 替换 python
  占位，`/` 200 + bundle.js 200 + 编码逃逸 403 实测。65 钉全绿
  （+服务端 3 钉：静态取页/越界 fail-closed/总线注册清理链），
  typecheck（+@types/node）/smoke/build 全过。
- **下一步**：8.8.1 后半·term-connection 纯会话管理插件（№1 接口
  五动作；切断 v8 PtyManager 的 WS 耦合——会话纯化、输出走事件、
  重连=按 sessionId 复挂订阅）。
- **阻塞**：无

---

## 1. 这是什么 / 怎么用

### 1.1 目标

从零实现 9.0 Web 版 kfm-nz，逐步替换 kfmv4 8.6。每个小版本都是一个可运行、
可验证、可回滚的完整状态。最终整体迁回 kfmv4，发布 v9.0.0。

### 1.2 唯一文档原则

- 本文件是唯一开发任务图；
- 所有 dsh 取材、Rust 共享内核、测试标准、待裁决项都登记在本文件；
- 不确定的插件/功能标“待用户裁决”，遇到时由用户决定，不预判；
- 任何 agent 开发时，先看状态快照 → 找对应小步 → 做完更新状态；
- **主线单写者**：9.0/nz 主线同时只有一个 agent 在动 TASK.md；并发纪律
  写后即交 / 改前重读 / 链红先归因。

### 1.3 版本号语义

- `8.x` = 一类主题；
- `8.x.y` = 该主题内的一个可运行、可验收、可回滚的小步；
- 每个小步完成后，在总表和详细表中把状态改为 ✅；
- `9.0` = 收口：整体迁入 kfmv4，过 kfmv4 检查链，发布 v9.0.0；
- `9.x` = 9.0 收口后的工坊线阶段（文档世界重评与重建，见 4.7）——接着
  主线后面走，不是搁置。
- **步号口径**：nz 步号独立编号，与 kfmv4 规格书层的步号无对应关系
  （nz 8.7.2 = 测试 runner；kfmv4 侧 8.7.2 曾指渲染宿主）。引用 kfmv4 侧
  步号必须注明出处（如 0-4b、步 0-2），防两层步号歧义。

---

## 2. 全局开发与测试纪律

### 2.1 三档考题

| 档 | 适用 | 做法 |
|----|------|------|
| A 档 | 纯逻辑：协议、状态机、几何、压缩、token 计量、解析核 | 先写考题并验证红，再写代码到绿；必须带变异抽检（故意改坏答案，考题必须能抓） |
| B 档 | 平台/胶水：DOM 宿主、Cordis 接线、构建、打包 | 答案先行，冒烟测试钉住防退化 |
| C 档 | 感官：手机手感、动画、布局、终端滚动 | 人工实拍判卷；自动化只覆盖可测边角 |

### 2.2 每个小步 DoD（缺一不可）

- [ ] 功能对照表/考题全绿
- [ ] `npm run typecheck` 零错
- [ ] `npm run smoke` 通过
- [ ] 涉及 UI 时，守视截图/手机实拍通过
- [ ] 热插拔自测：对新插件跑 `kfm-plugtest test-one`（8.7.7 落地前的小步
  以考题/冒烟替代本项）
- [ ] 删旧完成（从零实现时对应 v8 旧件标记为“收编时删”）
- [ ] git commit（小步关账入库，nz 仓库 git 可回查）
- [ ] 发布注记登记（版本/主题/dsh/Rust/测试结果）

### 2.3 常用验证命令

- 开发期服务端口：**8023**（避开 kfmv4 8.6 的 8021）。

```bash
cd /root/kfm-nz
npm run typecheck   # tsc --noEmit
npm run build       # esbuild bundle
npm run smoke       # node 侧 Cordis 全链冒烟
```

浏览器实拍/守视：启动本地静态服务打开 `public/index.html`，通过 `window.__kfmNz`
读取 bootLog 与自测状态。

### 2.4 热插拔自测工具 kfm-plugtest

- 最小版在 **8.7.7** 落地；
- 8.11.2 转正为 tool-host 工具；
- 能力：枚举插件 / 加载-卸载-重载 / DOM+事件+服务残留检查 / 模拟缺失降级；
- 错误码：`PLUGTEST_OK`、`PLUGTEST_UNLOAD_FAIL`、`PLUGTEST_LEAK_DOM`、
  `PLUGTEST_LEAK_EVENT`、`PLUGTEST_LEAK_SERVICE`、`PLUGTEST_DEGRADE_CRASH`、
  `PLUGTEST_RECOVER_FAIL`、`PLUGTEST_UNKNOWN_PLUGIN`；
- 权限：riskClass `exec`，默认禁止测内核件，生产默认 ask/deny，审计写
  ledger `ns=plugtest`；
- 纪律：串行执行；发射类只验证“停止”，不验证“撤销”。

### 2.5 数据区策略

- 开发期使用**独立数据区**，不碰 `~/.kfmv4`，避免与 kfmv4 8.6 并行时抢写
  sessions.jsonl / active.json / 日志；
- 替换完成后继承正式数据区。

---

## 3. 总时间线（一页总表）

> 状态：⬜ 待办 · 🔄 进行中 · ✅ 完成 · ⏸ 待用户裁决

| 小步 | 做什么 | dsh 参考 | Rust 共享 | 测试/考题 | 状态 |
|------|--------|----------|-----------|-----------|------|
| 8.7.1 | Cordis 根总线（rc.8 锁版 + hello 见证 + 自测） | 无 | 无 | A 档：注册/注入/注销/清理全链，churn 20 轮 | ✅ |
| 8.7.2 | 测试 runner 移植（kfmv4 runner.ts + harness.ts） | 无 | 无 | A 档：先写考题验证红 + 变异抽检可跑 | ✅ |
| 8.7.3 | 渲染宿主 + 手势分发 | 无 | 无 | A+B：容器生灭唯一入口、手势层带、验收三数字、0-4b NA 互证 | ✅ |
| 8.7.4 | card-types broker | dsh host/plugin-inventory 参考 | 无 | A 档：headless 枚举/注册/摘除 | ✅ |
| 8.7.5 | 安全包影子 | dsh guard/scope 参考 | cedar-policy 远期评估 | A+B：只记录不拦截，决策全量落日志 ✅ |
| 8.7.6 | 眼睛最小包（bundle 骨架：dynamic-prompt-files 基建 + eyes 总插件 + coords 契约段 + 骨架自态段） | 无 | 无 | A 档：抽文件测试两式；禁用后系统无损；过 plugtest | ✅（2026-08-21） |
| 8.7.7 | kfm-plugtest 最小版 | 无 | 无 | A 档：list/test/残留检查 ✅ |
| 8.8.1 | 终端连接家族（PTY/tmux 管理） | dsh terminal-bash | NA portable-pty（仅 NA）；kfmv4 侧 Node 不 Rust | A 档：open/input/resize/close/重连 | ⬜ |
| 8.8.2 | 终端渲染卡 | 无 | alacritty_terminal→WASM（评估） | A+B+C：终端功能对照 + M3 基线 | ⬜ |
| 8.8.3 | 刷新默认全屏终端 | dsh ui-layout 思想 | 无 | C 档：刷新即终端 | ⬜ |
| 8.8.4 | 顶栏最小版：tmux 标签 | dsh ui-slots/ui-layout | 无 | C 档：标签切换实拍 | ⬜ |
| 8.8.5 | tmux 完整管理 + 闭环 | dsh terminal-bash | 无 | A+B：tmux 考题全档 | ⬜ |
| 8.8.6 | 手单实例（最小：press=视觉+注入一体，对真 UI 验证；坐标对齐眼睛 coords 段） | 无 | 无 | A+B：press 链路考题 + 过 plugtest | ⬜ |
| 8.9.1 | tree-data 服务（懒加载） | dsh fs/directory-picker | ignore/globset 候选（实测驱动） | A 档：千级目录响应达标 | ⬜ |
| 8.9.2 | 文件树卡 DOM 化（Obsidian 文件卡） | dsh ui-directory-picker | 无 | A+B+C：10–15 层不卡，截图 diff 为零 | ⬜ |
| 8.9.3 | 文件编辑卡 + file-io | dsh fs 参考 | similar / pulldown-cmark / syntect 候选（实测驱动） | A+B+C：双态、跟随同步、点开全屏 | ⬜ |
| 8.9.4 | engine/v2 退役核验 + 闭环 | 无 | 无 | A 档：引用扫描为零 + 构建通过 | ⬜ |
| 8.10.1 | pool-system 数据层（基础四池 + workspaces 仅数据层） | dsh credentials/settings | 无 | A 档：池数据读写/持久化 | ⬜ |
| 8.10.2 | 池卡容器 | dsh ui-settings | 无 | B+C：保留性考题 | ⬜ |
| 8.10.3 | 七 tab 路由同一窗口 | dsh ui-settings | 无 | B+C：七 tab 实拍 | ⬜ |
| 8.10.4 | 卡片堆消解 + 最小全屏布局 + 闭环 | dsh ui-layout/ui-slots | 无 | A+B+C：堆卡全部有归宿 | ⬜ |
| 8.11.1 | session-store 换心 | dsh session-persistence/projection | 共享 JSONL schema | A 档：旧会话 hash 对账迁移 | ⬜ |
| 8.11.2 | tool-host + ledger-service + kfm-plugtest 转正 | dsh core/tools | hash 链 sha2+serde 薄自研 | A+B：工具调用对照、账只加不改、plugtest 可调用 | ⬜ |
| 8.11.3 | agent-service | dsh agent-loop/llm/system-prompt/token-meter | tiktoken-rs→WASM | A 档：M2 双轨语义等价；**眼睛投影接入装配线** | ⬜ |
| 8.11.4 | 压缩挂点 | dsh compaction/pruner/spill | 修剪核薄自研 + tiktoken-rs | A 档：压缩语义保持抽检 | ⬜ |
| 8.11.5 | 新对话卡 UI | dsh ui-conversation/ui-tool | 无 | B+C：M3 diff 受控 | ⬜ |
| 8.11.6 | 命令系统 + 闭环 | dsh ui-input-trigger/ui-commands | 无 | A+B：命令对照表 | ⬜ |
| 8.12.1 | 窗口卡完全体（无工作区层） | dsh ui-conversation 多实例 | 无 | A+B+C：多实例持久化 | ⬜ |
| 8.12.2 | 启动器 | dsh ui-slots 枚举 | 无 | A+B：抽屉与注册表同源 | ⬜ |
| 8.12.3 | 顶栏完整版 + 完整布局 | dsh ui-layout/ui-sidebar | 无 | A+B+C：全档考题 | ⬜ |
| 8.12.4 | 皮肤包 + todo 卡 | dsh ui-theme / dsh todo | 无 | B+C：换肤热切换、工具附属卡 | ⬜ |
| 8.12.6 | 眼睛全量段（数据源触发制：viewport/file-tree/orb-panel/card-stack 各段随对应卡落地补齐；失败写占位/卸载遗言全段对齐） | 无 | 无 | A：全段投影内容快照钉 | ⬜ |
| 8.12.7 | 安全包转正（deny/ask 真生效 + ask 批准卡内联窗口卡 + 会话级 allowlist 三档；启动 cedar-policy 评估）。承接 875 评审发现：../ 逃逸洞（已修+钉 8-21）/ exec 空 command 口径（已修+钉 8-21）/ 审计缓冲上限（转正接 ledger-service 时截断/背压） | dsh guard/scope/permission-presets | cedar-policy 评估本步启动 | A+B：№15 考题全档（含卸载安全包宿主基线仍拒）；C 档判定分布对账 | ⬜ |
| 8.12.8 | 手全量（多实例 + 角色定制样式 + orbitAnchor 接布局锚区） | 无 | 无 | A+B+C：№4 全档；多实例实拍 | ⬜ |
| 8.12.5 | 启动引导收口 + 闭环（执行序最后：含 8.12.6–8.12.8） | dsh boot 参考 | 无 | A+B：拓扑激活、调试桥确认删 | ⬜ |
| 9.0 | 整体迁入 kfmv4，过检查链，发 v9.0.0；插件热重载而会话不断（kfm-restart 自然退役判据）；**deploy-freshness 本步以 nz 部署目标为对象重生**（2026-08-21 拍板①+延迟②） | 全部 | 全部 | 全套 kfmv4 检查链 + 测试基线 | ⬜ |
| 9.x | 工坊线：文档世界重评与重建（重评 D1–D6 → 按需实施，见 4.7） | — | — | 重评会结论先行，分步落地 | ⬜（9.0 后启动） |

---

## 4. 分主题详细步骤

### 4.1 8.7 内核地基

> 无可见变化；工坊线 ⏸ 推迟，nz 不依赖（工坊线排在 9.0 后，见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.7.1 | cordis@4.0.0-rc.8 进 lockfile；rootCtx 最早创建；hello 见证插件；bootCtxSelfTest | 无 | 无 | A：注册/注入/注销/清理全链；churn 20 轮 | ✅ |
| 8.7.2 | 测试 runner 移植（kfmv4 runner.ts + harness.ts） | 无 | 无 | A：先写考题验证红；变异抽检可跑 | ✅ |
| 8.7.3 | 渲染宿主（容器生灭唯一入口）+ 手势分发（gesture-registry + 层带公约） | 无 | 无 | A+B：容器生灭、手势层带、验收三数字、0-4b NA 互证 | ✅ |
| 8.7.4 | card-types broker（注册表 + singleton） | dsh plugin-inventory 参考 | 无 | A：headless 枚举/注册/摘除可脚本验证 | ✅ |
| 8.7.5 | 安全包影子（只记录不拦截；强制 riskClass 声明） | dsh guard/scope | cedar-policy 留转正期评估 | B：决策全量落日志，零行为变化 ✅ |
| 8.7.6 | 眼睛最小包（Cordis 全流程首例 bundle；数据源=骨架自态：broker 账/审计账/体检记录/手势流/bootLog） | 无 | 无 | A：抽文件测试两式，禁用后系统无损，过 plugtest | ✅（2026-08-21） |
| 8.7.7 | kfm-plugtest 最小版 | 无 | 无 | A：list/test/残留检查；错误码可机检 ✅ |

### 4.2 8.8 终端/tmux 优先

> 第一个可见变化；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.8.1 | 终端连接家族（PTY/tmux 管理） | dsh terminal-bash | NA portable-pty；kfmv4 侧 Node 不 Rust；本步前完成 alacritty_terminal vs rio-vt WASM 评估 | A：连接五动作对照旧实现 | ⬜ |
| 8.8.2 | 终端渲染卡 | 无 | alacritty_terminal→WASM（拿来，与 NA 同 crate） | A+B+C：终端功能对照表全绿；M3 终端基线 | ⬜ |
| 8.8.3 | 刷新默认全屏终端 | dsh ui-layout 思想 | 无 | C：实拍刷新即终端；不得依赖 №11 完整布局 | ⬜ |
| 8.8.4 | 顶栏最小版：tmux 标签 | dsh ui-slots/ui-layout | 无 | C：标签切换实拍 | ⬜ |
| 8.8.5 | tmux 完整管理（新建/清空/挂起/状态检测）+ 闭环 | dsh terminal-bash | 无 | A+B：tmux 考题全档 | ⬜ |
| 8.8.6 | 手单实例（最小）：overlay 容器 + hand-press 事件 + press 一体链路，对终端卡真按 | 无 | 无 | A+B：press 注入经手势分发实测；过 plugtest | ⬜ |

### 4.3 8.9 Obsidian 文件卡

> 文件树 + 文件编辑，复刻 Obsidian 模式；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.9.1 | tree-data 服务（懒加载） | dsh fs/directory-picker | ignore/globset 候选（实测驱动） | A：千级文件目录数据层响应达标 | ⬜ |
| 8.9.2 | 文件树卡 DOM 化（UI 不变；mode-system 收编） | dsh ui-directory-picker | 无 | A+B+C：10–15 层展开/收起/滚动不卡；截图 diff 为零 | ⬜ |
| 8.9.3 | 文件编辑卡（双态；扼点事件化跟随）+ file-io | dsh fs 参考 | similar / pulldown-cmark / syntect 候选（实测驱动） | A+B+C：外部改动跟随；点开=全屏、再点=关重开 | ⬜ |
| 8.9.4 | engine/v2 退役核验 + 闭环 | 无 | 无 | A：引用扫描为零 + 构建通过 | ⬜ |

### 4.4 8.10 池卡/配置

> 工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.10.1 | pool-system 数据层（基础四池 + workspaces 组合池结构；workspaces 仅数据层，UI 层不做工作区切换——见 8.12.1） | dsh credentials/settings | 无 | A：池数据读写/持久化对照旧池 | ⬜ |
| 8.10.2 | 池卡容器（上配置下池） | dsh ui-settings | 无 | B+C：保留性考题（拼接/拖拽柄/预览/动静加载） | ⬜ |
| 8.10.3 | 七 tab 路由同一窗口（复用 tmux 标签件） | dsh ui-settings | 无 | B+C：七 tab 实拍；标签组件同源 | ⬜ |
| 8.10.4 | 卡片堆消解 + 最小全屏布局 + 闭环 | dsh ui-layout/ui-slots | 无 | A+B+C：堆卡全部有归宿；M3 池卡基线 | ⬜ |

### 4.5 8.11 对话卡

> 换心最重，拆最细；工坊线 ⏸ 推迟，nz 不依赖（见 4.7）。

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.11.1 | session-store 换心 | dsh session-persistence/projection/checkpoint | 共享 JSONL schema；浏览器侧续用 dsh TS 件 | A：旧会话逐条 hash 对账迁移；过步 0-2 指标口径 | ⬜ |
| 8.11.2 | tool-host（四家族工具包）+ ledger-service + kfm-plugtest 转正 | dsh core/tools | hash 链 sha2+serde 薄自研；修剪核薄自研 | A+B：工具调用一致对照；账只加不改；plugtest 可经 tool-host 调用 | ⬜ |
| 8.11.3 | agent-service（对话循环/工具循环/prompt 装配线） | dsh agent-loop/llm/system-prompt/token-meter | tiktoken-rs→WASM（拿来） | A：M2 双轨同 prompt 新旧管线输出语义等价；**眼睛投影接入装配线（消费者挂接，防白看）** | ⬜ |
| 8.11.4 | 压缩挂点（pruner/spill/摘要） | dsh compaction/pruner/spill | 修剪核薄自研；计量复用 tiktoken-rs | A：压缩语义保持抽检；投影链挂点生效 | ⬜ |
| 8.11.5 | 新对话卡 UI（光球面板+全局输入栏收编） | dsh ui-conversation/ui-tool | 无 | B+C：M3 对话/光球 diff 受控；全局单例优先级不变 | ⬜ |
| 8.11.6 | 命令系统 + 闭环 | dsh ui-input-trigger/ui-commands | 无 | A+B：命令对照表；8.11 主题闭环 | ⬜ |

### 4.6 8.12 工作台/收尾

| 小步 | 做什么 | dsh | Rust | 考题/验收 | 状态 |
|------|--------|-----|------|-----------|------|
| 8.12.1 | 窗口卡完全体（五部件/四元组/收起≠销毁；**UI 层不做工作区切换**——用户拍板：调出窗口自己配置；多光球状态持久化、光球入口数量可自定义） | dsh ui-conversation 多实例 | 无 | A+B+C：多实例持久化实拍 | ⬜ |
| 8.12.2 | 启动器（手势抽屉 → broker 枚举 → 开卡） | dsh ui-slots 枚举 | 无 | A+B：抽屉与注册表严格同源 | ⬜ |
| 8.12.3 | 顶栏完整版（五槽位 + 观测台）+ 完整布局 | dsh ui-layout/ui-sidebar | 无 | A+B+C：全档考题 | ⬜ |
| 8.12.4 | 皮肤包（深蓝意志；皮肤=覆盖层，组件自带基础样式——基础包随功能，覆盖包做拓展）+ todo 卡 | dsh ui-theme / dsh todo | 无 | B+C：换肤热切换；工具附属卡模式 | ⬜ |
| 8.12.6 | 眼睛全量段（数据源触发制：数据源卡落地一个补一段） | 无 | 无 | A：全段投影快照钉；失败写占位不抛逐段核验 | ⬜ |
| 8.12.7 | 安全包转正（№15 收口：真拦截 + 批准卡 + allowlist 三档 + cedar 评估；承接 875 发现：../ 逃逸/空 command 已修+钉，审计缓冲上限转正期处置） | dsh guard/scope/permission-presets | cedar-policy 评估本步启动 | A+B：№15 考题全档；C 档判定分布对账（转正不改判定只改执行） | ⬜ |
| 8.12.8 | 手全量（多实例/角色定制样式/锚区接布局） | 无 | 无 | A+B+C：№4 全档 | ⬜ |
| 8.12.5 | 启动引导收口（拓扑激活 + ws-server 一拆三收尾）+ 闭环——**执行序最后（含 8.12.6–8.12.8）** | dsh boot 参考 | 无 | A+B：启动链拓扑与实现一致；调试桥确认已删 | ⬜ |

### 4.7 9.x 工坊线（文档世界重建，9.0 收口后启动）

> 2026-08-20 用户拍板：工坊线**不是搁置，是顺序调整**——接着主线后面走。
> nz 开发期不依赖工坊线；9.0 收口（v9.0.0 落地）后启动本阶段。
> 六族契约 0–9 设计稿保留定稿状态（kfmv4 规格书层，不删不撤），实施冻结至今。

| 小步 | 做什么 | 契约出处（kfmv4 规格书层） | 状态 |
|------|--------|---------------------------|------|
| 9.x.0 | **重评会**：D1–D6 逐项判「有用 / 合并 / 废弃」，结合下方重评输入材料出重建方案 | 六族契约 0–9 全览 | ⬜ |
| 9.x.1 | D1 A 注册表（七字段改造 + 回填规约出处 / 豁免区 / check-mechanism-registry 守卫四件） | 契约 0/2/5 | ⏸ 待重评 |
| 9.x.2 | D2 B 降生链（`_birth.yaml` 双链 / gen-birth 生成器 / check-birth-wiring） | 契约 1/6 | ⏸ 待重评 |
| 9.x.3 | D3 C 信箱（信封四字段 + 回执表入 README / inbox-scan 归属行扫描器 / git 卫生脚本） | 契约 3 | ⏸ 待重评 |
| 9.x.4 | D4 D 部署运维（部署运河/数据卫生登记 + kfm-restart 退役判据 + auto-push 外向条件） | 契约 7 | ⏸ 待重评 |
| 9.x.5 | D5 E 各族缺口（exp 脚本退役 / docprobe 结晶迁移 / paradigm+harness-studies 归档 / 实验索引考古字段） | 契约 8/9 | ⏸ 待重评 |
| 9.x.6 | D6 F 户籍警（扫描器 v1 影子 → v2 增量执法） | 契约 4 | ⏸ 待重评 |

**重评输入材料**（第二阶段讨论结论，重评会上逐项过）：

- 信箱四流型细化：私聊（链条）/ 征集（单对多）/ 汇总（多对单）/ 线程
  （多对多）的落地形态——目前只有一个信箱，多 agent 协作成熟后需拆分；
- 文档守望机制：扫描项目各位置，新 md/文档文件出现即有反应（归属哪个
  机制待定，重评时定）；
- 实验区组织：自由生长 + 考古字段，未来给 agent 翻历史数据找灵感；
- 活性探针议题（kfmv4 `nine-point-zero.md` 待讨论节第一条，防 agent-runner
  类静默失效）；
- 三脚本归宿：守视 / api 工具脚本 / agent 工具脚本（用户拍板真正重要的
  三件套）在 9.x 的收编位置——观测台、独立工具卡，还是工坊机制，届时定。

---

## 5. dsh 取材总表

> 状态：⬜ 待搬 · 🔄 搬运中 · ✅ 已搬 · ⏸ 待用户裁决

| dsh 件 | 用途 | 落到 NZ 哪个小步 | 状态 |
|--------|------|------------------|------|
| terminal-bash | 终端连接/tmux 管理语义 | 8.8.1 / 8.8.5 | ⬜ |
| ui-layout / ui-slots | 全屏布局、顶栏槽位、启动器枚举 | 8.8.3 / 8.8.4 / 8.10.4 / 8.12.2 / 8.12.3 | ⬜ |
| ui-directory-picker | 文件树浏览交互 | 8.9.2 | ⬜ |
| fs | 文件 CRUD / 沙箱 / 权限面 | 8.9.3 | ⬜ |
| credentials / settings | provider/model/配置管理 | 8.10.1 | ⬜ |
| ui-settings / ui-model-selection | 池卡 UI | 8.10.2 / 8.10.3 | ⬜ |
| session-persistence / projection / checkpoint | 会话存储 | 8.11.1 | ⬜ |
| core/tools | 工具宿主 | 8.11.2 | ⬜ |
| agent-loop / llm / system-prompt / token-meter | 对话循环 | 8.11.3 | ⬜ |
| compaction / pruner / spill | 上下文压缩 | 8.11.4 | ⬜ |
| ui-conversation / ui-tool | 对话 UI | 8.11.5 | ⬜ |
| ui-input-trigger / ui-commands | 命令系统 | 8.11.6 | ⬜ |
| ui-theme | 皮肤 | 8.12.4 | ⬜ |
| todo | todo 工具语义 | 8.12.4 | ⬜ |
| guard / scope | 权限裁决 | 8.7.5 / 8.12.7（+permission-presets） | ⬜ |
| boot | 启动引导参考 | 8.12.5 | ⬜ |

---

## 6. Rust 共享内核总表

> 状态：⬜ 待评估 · 🔄 评估/移植中 · ✅ 已落地 · ⏸ 待实测痛点

| Rust 核 | 对应小步 | 来源 | 触发条件 | 状态 |
|---------|----------|------|----------|------|
| alacritty_terminal | 8.8.2 终端解析核 | 直接拿来（NA 已实证）；rio-vt 备选 | 8.8.1 前完成 WASM 评估 | ⬜ |
| portable-pty | 8.8.1 PTY 管理 | NA 拿来 | 仅 NA 侧；kfmv4 侧 Node 不 Rust | ⬜ |
| tiktoken-rs | 8.11.3 token 计量 | 拿来（Zed 在用） | 8.11 落地 | ⬜ |
| 压缩修剪核 | 8.11.4 压缩挂点 | 薄自研 + tiktoken-rs | 8.11 落地 | ⬜ |
| similar | 8.9.3 编辑卡 diff | 拿来改 | 实测痛点驱动 | ⏸ |
| pulldown-cmark / comrak | 8.9.3 md 渲染 | 拿来改 | 手机端大 md 实测掉帧才立项 | ⏸ |
| syntect | 8.9.3 语法高亮 | 拿来改 | 同上 | ⏸ |
| ignore / globset | 8.9.1 文件树过滤 | 拿来改 | 实测驱动 | ⏸ |
| cedar-policy | 8.12.7 安全包转正 | 远期评估 | 影子期薄自研已落（8.7.5）；评估动作挂 8.12.7 启动 | ⬜（触发条件已锚定） |
| sha2 + serde | 8.11.2 账本 hash 链 | 薄自研 | 8.11 落地 | ⬜ |
| JSONL schema | 8.11.1 session 格式 | 只共享格式 | 8.11 落地 | ⬜ |

---

## 7. 待用户裁决项

> 这些不预判，遇到时由用户决定后移入决策记录。

- 日志卡：用户已表态几乎没用过（8.6 低频），倾向不迁移，收口终审确认；
- 范式卡：用户已表态可取消（kfmv4 自产实验物，远期再说），收口终审确认；
- apk 卡：用户已表态废弃（8022 直连手机，NA 线直接编译），收口终审确认；
- 多端适配/桌面浮卡：远期，待确认；
- 动画插件包：v1 组件零动画，是否要单独做动画包待确认；
- 其他 dsh 远期能力（subagent/workflow/mcp/lsp/acp 等）：9.x 再说，待确认。

---

## 8. 决策记录

> 用户每拍板一个“做/不做/缓做/顺序调整”，在此追加一行。

- 2026-08-18：kfm-nz 独立项目成立；TASK.md 为唯一开发任务图。
- 2026-08-18：8.9 定为 Obsidian 文件卡，8.10 定为池卡/配置。
- 2026-08-18：kfm-plugtest 立项，8.7.7 最小版，8.11.2 转正。
- 2026-08-18：开发期免 kfmv4 检查链；收口时整体过链。
- 2026-08-18：发版冻结 v4——kfmv4 version 冻结 8.6.0 至替换日；nz package
  version 恒 `9.0.0-dev`。
- 2026-08-18：工坊线整体推迟（六族契约 0–9 实施冻结），nz 不依赖工坊线；
  代码完成后重评重建。
- 2026-08-18：kfmv4 文档降级为规格书参考层；TASK.md 是唯一开发任务图。
- 2026-08-18：dsh 线按 9.0 线评审 8 条修订（测试 runner 插入、工坊线推迟、
  数据区策略、端口 8023、单写者、决策补全等）。
- 2026-08-18（补录）：**渲染底座本身不插件化**——宿主三分已是合适粒度
  （契约 №14），否定性拍板入档，防重新发起同题讨论。
- 2026-08-18（补录）：**窗口卡不自建工作区层**——调出窗口自己配置（四元组
  + 会话加载）；多光球状态持久化、光球入口数量可自定义。workspaces 仅作
  数据层组合池结构保留。
- 2026-08-20：9.0 线全面性补漏——0-4b NA 互证钩子挂 8.7.3（版本平移遗留）、
  待裁决区三项按用户已表态更新、DoD 第 5 条 plugtest 空窗说明、皮肤包
  基础包/覆盖包分层原则入 8.12.4。
- 2026-08-20：用户拍板——**工坊线非搁置，是顺序调整**：接着主线（9.0 收口）
  后面走；新增 9.x 工坊线阶段（4.7：重评会 → D1–D6 按需实施），9.0 收口
  加「热重载而会话不断」作 kfm-restart 自然退役判据。
- 2026-08-20：8.7.2 测试 runner 移植完成——nz 适配两处（declare process /
  assert helper），红验证（exit=1）+ 变异抽检双过；tests 纳入 typecheck
  （`allowImportingTsExtensions` 入 tsconfig）。
- 2026-08-20：8.7.3 渲染宿主 + 手势分发完成——四设计要件全落（连带清场 /
  owner 生命周期绑摘 / attach-detach 与 show-hide 分档 / 防重下沉）+
  层带公约强制校验（裸数字注册即抛）；守视实拍 + churn 基线
  （2000 次生灭 173ms、堆净增量 +1.1MB、零残留）；0-4b NA 互证待回填。
- 2026-08-20：用户拍板——**dsh = 9.0 线的双向讨论通道**（非独立线）；
  nz 实现由 9.0 线主力负责，落地通报由 9.0 线署名。
- 2026-08-20：评审 5 条处置——①nz 补 git 仓库（必修采纳：版本历史自
  骨架期状态起补齐）；②步号口径入 1.3（nz 独立编号，引 kfmv4 步号须注
  出处）；③dsh 分工入本记录；④package version 对齐拍板口径
  `9.0.0-dev`；⑤nz-taskmap-review 8 条处置闭环确认（数据区 2.5 /
  端口 8023 在 2.3 / 单写者在 1.2，8-18 已落实）。
- 2026-08-20：8.7.4 card-types broker 完成——№6 全语义落地（注册=效果
  回滚白送 / relied 守卫 / 拓扑+name 序枚举 / singleton 聚焦 / 实例户口
  serialize 交班）；契约双变异靶子实测抓获；考题总数 30 钉。
- 2026-08-20：**kfmv4 仓内提交纪律**（8.7.4 commit `6b1ba5ce` 混入事故
  整改）——入仓后 nz 提交只 `git add nz/...` 白名单式路径，提交前
  `git status` 全量核对；禁用 `git add -A`。事故全貌及处置见信箱
  `kfmv4-9.0-nz-874-landing-report.md` 第四节。
- 2026-08-20：评审复核混入事故处置——三条批准，追加两条：①混入错位
  的不只是归属，还有「未达可提交状态」的内容（bugs.md 把一处
  check-state-freshness 红带进 master，评审已补 BAR-AGENT-RUNNER-01
  复核日 2026-08-27，链复绿）；若再发生混入，入仓后第一动作=跑全链
  验红。②git 卫生 v0 检查立项（评审认领）：commit 时暂存区路径 vs
  线归属白名单比对，v0 只警告不拦截。详见 `kfmv4-9.0-nz-874-review.md`。
- 2026-08-20：8.7.5 安全包影子完成——permission.ts（№15 影子期：只记录
  不拦截）；v8 8.5.0 三处 nz 适配（内存审计+sink 口子 / declareRisk 动态
  登记替代静态表 / roots 显式注入）；dsh 参考：scope 父链（注册视图向下
  继承、事件许可向上延伸）与 permission-presets（preset=sandbox+approval
  两旋钮打包）确认留转正期；scope 口子 v1 只落日志。43 钉全绿，双变异
  靶子抓获；roots 骨架期置空（fail-closed）。
- 2026-08-20：8.7.7 kfm-plugtest 最小版完成——plugtest.ts（§2.4 八错误码
  全实现；残留检查=四 broker 快照 diff + 事件探针；串行纪律内部排队；
  降级探针语义定稿：公约错误/cordis without inject=有意降级合格，裸
  TypeError=DEGRADE_CRASH）；宿主/手势/安全各加一个计数探针口子
  （containerCount/handlerCount/declaredCount）。53 钉全绿，双变异靶
  抓获。DoD「新插件必过 plugtest」自此可执行。
- 2026-08-20：877 评审收讫——核实属实，观察两条：①clearTimeout 尾巴
  已顺手修（_disposeWithTimeout finally 清理，53 钉复绿）；②探针事件
  全局发射的误报风险留转正期（开放第三方插件时加被测者标识）。
  评审建议：「`[xxx]` 前缀 = 有意抛出的公约错误」应登记为全局公约
  （现散在各模块注释）——待契约文档下次修订时收录。
- 2026-08-20：用户拍板——**8.7.6 修订 + 任务图补扩充步**。①8.7.6 改
  「眼睛最小包（数据源=骨架自态）」（原试点三件套的手移 8.8.6）；②新增
  8.8.6 手单实例 / 8.12.6 眼睛全量段（数据源触发制）/ 8.12.7 安全包转正
  （契约 №15「9.0 真生效」的承接步，此前悬空）/ 8.12.8 手全量；③8.11.3
  验收追加「眼睛投影接入装配线」（消费者挂接防白看）；④cedar-policy
  触发条件锚定 8.12.7。**新规矩：凡「最小版/影子/单实例」进任务图，
  必须同时登记扩充步 + 触发条件**（防「最小即终点」第三次再犯）。

- 2026-08-20：用户拍板——**迁移总账机制落地**（v8→v9 完备性从信任问题
  变机械问题）。四层动作：①`check-ledger-coverage.mjs` 立（清单层
  code-inventory 机械生成 × 归宿层 nine-point-zero 组件台账咬合；三类红：
  无归宿行/死账/死锚）；②43 条 covers 机读锚点落台账 18 行（首跑 43 处
  无归宿全部裁决归组，含 capability-review 8-16 五缺口的闭环确认）；
  ③capability-review 初稿转正「✅ 已收编」；④挂检查链常驻。
  **方法论入档**：任务图自上而下、总账自下而上，双向咬合才算完备；
  凡「最小/影子/单实例」必登记扩充步（昨日新规矩）由本检查长期值守。
- 2026-08-20：№10 修订注② 插件作者指南入契约（零新文件——规范层寄生
  契约层）：新工具五件齐 / 附属 UI 卡=投影非旁路 / Rust 化三判据 /
  工具清单=gen-permission-map 活清单。
- 2026-08-21：用户拍板——**v8 部署新鲜度红不处置**：不为将死版本做
  仪式性部署（混入事故 commit 碰 src/ 触发，8-18 包 vs 8-20 源码）；
  9.0 收口 nz 迁入时自然消解。此前全链绿到此闸门为止。
- 2026-08-21：**875 评审两条代码发现修复 + 补钉**（影子期判定基线不
  能脏——转正期 8.12.7 的 C 档对账锚就是它）：①`_inRoot` 相对路径
  无条件界内 → 加 `_resolve` 归一化（相对路径以 roots[0] 为基准展开、
  逐段消解 `..`，roots 为空 fail-closed 落 ask），`../../etc/passwd`
  逃逸洞封死；②exec 空 command 短路放行 → 新 rule `exec:empty-command`
  落 ask，与 write_local 空 path 同 fail-closed 口径。各补对称钉，
  55 钉全绿。审计缓冲无上限的观察记入 8.12.7 承接范围（转正接
  ledger-service 时截断/背压）。
- 2026-08-21：**链红复发处置收讫**（评审升级 git 卫生 v0 = 白名单 +
  commit 时秒级快链子集进钩）。本线整改 = commit 后第一动作跑全链
  写为铁律，不依赖记性。
- 2026-08-21：用户拍板——**check-deploy-freshness 退役（①+延迟②）**。
  v8 侧按退役协议退役：脚本+钉删（守护代码已删=正常退役），chain STEPS
  除名，build.mjs --soft 摘除，机制注册表部署运河行/infra 台账/bugs 账
  同步标注，派生文件（scripts-catalog/code-inventory/sync-counts）gen
  回写；浏览器侧 version-watch 横幅仍在役（现唯一防线，注释已更新）。
  **重生条件锚定 9.0 收口步**：nz 部署目标存在时以新对象重生该检查
  （任务图 9.0 行已点名）。此前全链末端永久噪声自此消除。
- 2026-08-21：**8.7.6 眼睛最小包落地**（Cordis 全流程首例 bundle，用户
  发话开工）。实现要点：①dynamic-prompt-files 基建 = 骨架期内存版
  （接口按读写删列+变更事件设计，fs 后端留 server 落地步换实现不换
  接口；文件名纪律=裸文件名拒逃逸，公约错误）；②eyes 总插件挂
  「eyes/refresh-requested」公开触发口 + 段注册即刷新（真触发
  tool/finished、snapshot/updated 等生产者 8.11.x 落地后改挂——数据源
  触发制）；③探针实证入档：ctx.inject 回调式在依赖缺失时不卡 fiber
  （fiber 照常 ACTIVE，回调等待），裸 context 降级探针因此天然合格；
  ④整包启停原子性 = 成员挂为调用者 fiber 子插件，父 dispose 逆序连带
  （cordis 纤维树白送）。验收三件套齐：抽文件两式钉（变异抽检=broker
  账变化投影反映 / 配置禁用=关段缺段）+ 禁用无损钉（遗言占位+broker
  零变化+基建独立）+ plugtest PLUGTEST_OK。62 钉全绿。
- 2026-08-21：用户拍板——**nz 服务端先跑起来（8023）**，8.8.1 首件 =
  服务端最小出生（HTTP 静态 + 服务端 cordis 根总线），真端口可验证
  优先于会话管理内核。落实两条惯例迁移：静态路径原样拒 `..`（403
  显形 fail-closed，875 教训第二次迁移）；hello 见证插件模式从客户端
  复用到服务端（双侧总线同款出生仪式）。端口口径：8022 = v8 生产，
  8023 = nz，并存互不打扰，9.0 收口归位。tsconfig 加 @types/node
  （nz 不再是纯客户端工程）。WASM 终端芯评估挪 8.8.2 门口的提议
  待用户拍板（本步未执行该评估）。
- 2026-08-21：**评审代改收编（commit 95ee8a04）**——`server.listen(port)`
  裸绑 `*` 等于公网直开，而 slog 声称 127.0.0.1：声称的语义与代码实际
  不一致，日志是给后来者的承诺，承诺错了比没有承诺更糟。代改 = 默认
  绑 127.0.0.1（访问通道 = kalo 隧道 -L 8023），NZ_HOST=0.0.0.0 显式
  可选——「显式选择可达性」而非「默认可达」。收编入档。
- 2026-08-21：**通报纪律再进半格**（876 隔夜补、8.8.1a 用户捅破，两次
  漏通报后升级）：通报与落地 commit **同批或紧随**，间隔以小时计就会
  漏。自查口径：TASK 快照「刚完成」翻步时，信箱必须已有对应通报——
  先靠自觉，再漏一次就机械化（进检查链）。
