# NA 插件架构研究（一切皆插件 → kfm-na）

> 2026-08-14 立（用户动议）。研究产物 = 项目：`/root/kfm-na`（Kaf Fee Meo Native，
> kfmv4 的 Rust 原生安卓客户端）——**kfm-na 是这条研究线的产物，产物恰好是一个项目**。

## 研究命题

dsh（DeepSeek Harness，`deepseek-ai/deepseek-harness`）的「一切皆插件」是比传统
harness（核心 + 扩展点）更进一层的**组合式架构**：agent loop / 模型 / 工具 / 会话 /
存储 / UI 全是插件，没有特权核心，任何部件可从配置替换。本线研究：把这套范式落到
kfm-na——Rust 驱动的安卓端从出生期就按「插件基座 + 插件填充」架构生长，
kfmv4 的「一切皆卡片」与 dsh 的「一切皆插件」在 NA 统一。

## 缘起（2026-08-14）

- 用户动议：dsh 是深度求索的新 harness，提出「一切皆插件」，比 harness 更进一层，
  是前沿研究素材；kfmv4 方向类似，适合做研究实现
- 本机情报：dsh 源码在 `/opt/dsh-src`（2026-08-13 更新，monorepo 50+ 包），
  3080 服务活着（nginx `/dsh/` 子路径反代），此前会话已实测；dsh 由 Cordis 驱动
  （vendor 进 `@deepseek-ai/cordis`，设计论文《A Programming Paradigm for
  Spatiotemporal Composability》）
- 关键转折（同日用户拍板）：kfm-na **不做「kfmv4 服务端转发瘦客户端」**——那是
  上一个决策 agent 怕重构的保守方案（SSH 隧道回环直连 8021，协议只读复用）。
  方向改为：完全 Rust 驱动的高性能安卓端，**先立基础架构（dsh 式），再往里填插件
  实现内容**。重构成本低：尖刺 1 资产（termview/IME/keybar/insets 等）几乎全与
  「连谁」无关，只有 protocol/session/conn 三个文件需要重构
- 定位确认：本研究文档落 kfmv4 `experiments/`（研究线）；kfm-na 是研究产物

## 参照系（只读引用，不复制）

| 来源 | 位置 | 用途 |
|------|------|------|
| dsh 源码 | `/opt/dsh-src` | Cordis 五机制解剖（plugin+ctx / inject / 事件四派发 / 可逆效果 / profile 分层） |
| dsh 架构文档 | `/opt/dsh-src/docs/`（architecture / cordis-primer / capability-seams / cookbook） | 设计对照 |
| kfmv4 眼睛与手 | `kfmv4/docs/active/眼睛与手.md` | NA 落地为网格眼睛 + 按键注入的手 |
| kfm-na 立项 | `/root/kfm-na/docs/active/立项.md` | NA 架构三层 / 尖刺五条验收 / 切片路线 |
| kfm-na 工具卡设计 | `/root/kfm-na/docs/active/工具卡.md` | 工具即卡，四个待拍板项未定 |

## 目录地图

| 目录 | 是什么 |
|------|--------|
| `dsh/` | dsh 研究材料：Cordis 机制解剖笔记、dsh 架构对照（随深挖增补） |
| `na/` | NA 设计：插件架构规格书（内核边界 / 插件域清单 / 契约 / 测试标准 / 热插拔语义） |

## 研究阶段

1. **阶段 1 · 规格书**（当前）：dsh 五机制深挖 → 《插件架构规格书》——内核边界 /
   插件域清单与优先级 / 每插件契约标准 / 热插拔语义（Rust 安卓现实）/ 测试四层
2. **阶段 2 · 边界手术**：conn/session/protocol 抽成连接 provider 插件，
   行为不变、测试全绿，架构边界立起来
3. **阶段 3 · 基座落地**：插件基座最小核心 + 自然边界（终端/输入/覆盖层/连接）
   逐个注册成插件；此后新能力全是加插件文件，不再碰架构

## 已定架构决策（2026-08-14 用户拍板）

- **插件域分层**：内核（插件基座 + 渲染底座）/ 第一批（终端 / 连接 provider / 输入
  IME）/ 第二批（卡片堆 + 工具操作系统 / AI 会话 / 交互可视）/ 远期（本地 Linux
  系统——**单独可行性研究章**，Termux 是发行版不是插件；无头浏览器插件——内嵌
  webview 加载 kfmv4 服务，旧资产新壳）
- **热插拔语义**：配置级启停 + 可逆卸载回滚（RAII guard）；运行时 dlopen 仅远期
  候选（NDK 符号/ABI/崩溃隔离成本高，规格书必须钉死定义，不承诺做不到的事）
- **ctx 类型化**：内核服务类型化 struct（编译期全检查）+ 插件服务 registry +
  trait downcast（兼得安全与扩展；Rust 无 TS declaration merging，此为真设计点）
- **测试四层**：契约测试（A 档，注册/卸载回滚/事件顺序，变异抽检咬人）/
  互操作组合矩阵（inject 依赖图生成）/ 回归钉（BAR 编号）/ C 档实拍（飞鸽传书）

## 产物登记面

> 防孤儿文件（DOC-FLOW-11 同族）：`dsh/`、`na/` 下每份产物文件在此登记一行。
> 新增产物先登记后提交。

| 文件 | 说明 |
|------|------|
| `na/plugin-architecture-spec.md` | 插件架构规格书（v0 草案，随 dsh 深挖迭代） |
| `dsh/cordis-mechanics.md` | Cordis 机制解剖笔记（源码级，file:line 出处；规格书证据层） |
