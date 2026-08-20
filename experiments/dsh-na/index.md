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
| `dsh/` | dsh 研究材料：Cordis 机制解剖笔记、dsh 架构对照、论文研究（随深挖增补） |
| `dsh/paper/` | 论文研究：《A Programming Paradigm for Spatiotemporal Composability》原文 + 精读笔记 |
| `na/` | NA 设计：插件架构规格书（内核边界 / 插件域清单 / 契约 / 测试标准 / 热插拔语义） |
| `inbox/` → 已迁出 | **跨线评审信箱**（2026-08-15 迁至 kfmv4 `docs/ledger/agent-inbox/`，见产物登记面） |

## 研究阶段

> **线分工（2026-08-15 用户拍板）**：本会话做**纯理论研究**——dsh 的概念与
> 实现原理，以论文为主、增进理解；NA 与 dsh 的结合（规格书 / kfm-na 落地）由
> 其他 agent 负责。

1. **阶段 1 · 规格书**：dsh 五机制深挖 → 《插件架构规格书》——内核边界 /
   插件域清单与优先级 / 每插件契约标准 / 热插拔语义（Rust 安卓现实）/ 测试四层。
   进度（2026-08-15）：五机制源码级解剖全部完成——①②③④⑥（笔记 §1-5）+
   ⑤ inject 依赖引擎（§7）+ profile/bundle 分层组合（§8）；规格书 §4.3 依赖
   激活语义已同步。**规格书 v1 定稿（2026-08-15）**——paper-digest 12 条修订
   全部落地（NA 线 agent 接续完成）；本线后续为阶段 2/3
2. **阶段 1T · 理论线**（当前）：dsh 论文级研究——Cordis 设计论文
   《A Programming Paradigm for Spatiotemporal Composability》精读（`dsh/paper/`），
   概念体系 + 数学结构 + 三层对照（论文 → cordis 源码 → dsh 强化）。待办方向：
   论文可交换性 vs dsh 实际注册、§6.4 对 Rust 的启示、§6.6 版本化对照、dsh
   scope 对应论文哪个机制（见笔记 §11）
3. **阶段 2 · 边界手术**：conn/session/protocol 抽成连接 provider 插件，
   行为不变、测试全绿，架构边界立起来（NA 线）
4. **阶段 3 · 基座落地**：插件基座最小核心 + 自然边界（终端/输入/覆盖层/连接）
   逐个注册成插件；此后新能力全是加插件文件，不再碰架构（NA 线）

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
| `na/plugin-architecture-spec.md` | 插件架构规格书（**v1 定稿 2026-08-15**，论文精读 12 条修订落地；此后改动走文末修订记录） |
| `dsh/cordis-mechanics.md` | Cordis 机制解剖笔记（源码级，file:line 出处；规格书证据层） |
| `dsh/paper/paper.pdf` | 论文原文 PDF（cordiverse/paper，2026-08-13 preprint） |
| `dsh/paper/paper.md` | 论文原文 Markdown（anydoc 转换，2171 行） |
| `dsh/paper/paradigm-notes.md` | 论文精读笔记（概念体系 + 数学结构 + 论文↔cordis↔dsh 三层对照） |
| `dsh/paper/paper.txt` | 论文文本提取（pymupdf，`paper/.venv` 隔离环境；与 paper.md 并存） |
| `dsh/paper/paper-digest.md` | 论文增量笔记（对照 cordis-mechanics 源码解剖的增量认知 19 条 + 规格书 v0 修订清单 12 条 + 不采用清单；与 paradigm-notes 互补：那份是论文内概念地图，这份是落地修订依据） |
| `/root/kfmv4/docs/ledger/agent-inbox/` | **跨线评审信箱**（2026-08-15 自本目录迁出，升为 kfmv4 通用 agent 信箱；README 含机制/规则/状态列） |
| `inbox/kfmv4-9.0-评审回信.md` | 9.0 会话回评审：七条全收裁决清单 + 对 NA 的反向输入（池结构/三者分离/headless 布局） |
| `na/connection-provider.md` | 连接 provider 设计页 v0（规格书 §8 九字段；阶段 2 边界手术第一刀；2026-08-15 已投 agent-inbox 送审） |
| `na/terminal-emulator.md` | 终端模拟器设计页 v0（§8 九字段；边界手术第二刀，termview 注册化；2026-08-16 已投 agent-inbox 送审） |
| `na/input-ime.md` | 输入/IME 域设计页 v0（§8 九字段；边界手术第三刀；含修饰键状态搬迁方案 A/B 分叉待评审拍板；2026-08-16 已投 agent-inbox 送审） |
| `na/cordis-rs-gap-audit.md` | cordis-na 差距审计与四阶段路线图（E3 十行对账 + G1~G7 清单；2026-08-16 送审、评审四条裁决全收落档；阶段 1 搬家 2026-08-17 闭环） |
| `na/cordis-na-liveness-gate.md` | cordis-na 阶段 2 设计页（G2 活性闸 panic 语义 + G3/G4 缓建桩 + G5 政策归层；2026-08-18 已投 agent-inbox 送审） |
| `na/multi-end-layering.md` | 多端分层设计页 v0（核心层平台中立 + 四薄壳 + L1 本地 PTY 抽层；2026-08-20 评审五问全裁总体批准，落地通报已回） |
| `na/l3-bootstrap.md` | L3 bootstrap/apt 生态设计+流水线页（fork termux-packages 换前缀源码重编；含复现手册与未来上游同步流程；2026-08-20 立项） |

> 实验族契约 9 登记状态（2026-08-17 契约定稿口径）：本线 = **现役结晶中**——
> kfm-na 已独立为产物项目（`/root/kfm-na`，走正常代码+文档世界），cordis-na
> 在长（`crates/cordis-na`）；本目录只留研究/设计/送审件，门内自由、门口登记。
