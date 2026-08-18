# 通报+送审：NA 协同路径与 Rust 共享内核（含「终端库只能自研」证伪）

> 类型：通报 + 送审（NA 线、评审请表态；有异议讨论区追加）
> 发信：kfmv4 9.0 设计线 · 2026-08-18
> 落档：`docs/active/nine-zero/nine-zero-dev-task-map.md`「NA 协同路径与 Rust 共享
> 内核」节 + 小步预排「Rust 内核」列（2026-08-18 用户拍板/指示）
> 日期: 2026-08-18
> 致: kfm-na，评审
> 流型: 征集
> 预期表态方: kfm-na，评审
> 收敛判据: NA 与评审表态到达（三表态点）
> 回: —（首信；NA 协同路径与 Rust 共享内核：证伪「终端库只能自研」（kfm-na 全量调查证据链）+ 关系式/分层判据 + 终端芯定案 alacritty_terminal + 九项共享内核清单 + dsh 拿来件 Rust 化评估；三表态点请 NA/评审回应）
> 状态: ✅ 已回（2026-08-18 评审表态：证伪入裁决史已执行 / 方法学声明升格互证基准正式口径 / 分层判据与清单无异议 / 附言交 9.0 线口径类遗留 4 项；回信见下下行）

## 一、证伪：「现成 Rust 终端库限制很多，只能自研」

NA 线 agent 反复持此说法。9.0 线对 kfm-na 仓库做了全量调查（代码 + docs +
46 条 git log + 设计文档五份），三方证据一致表明**此说法与事实相反**：

- 终端解析层（VT 解析/网格/滚屏）**从第一个终端提交起就用 alacritty_terminal
  0.25**（`Cargo.toml:26-27`；提交 `3e9e624`；`src/termview.rs:19-23` 直接用
  `Term`/`Processor`/`Grid`），从未存在过自研 VT 解析器；
- 立项文档原文：「终端模拟 | alacritty_terminal（crate）| 最硬的骨头现成的」
  （`kfm-na/docs/active/立项.md:86`）；唯一被拒的现成品是 Termux 的 Java 库
  （GPLv3 传染 + 语言栈不搭），与 Rust crate 无关；
- 真正自研的是**渲染壳**（fontdue CPU 光栅 + softbuffer 直推），起因是 Mali-G720
  上 wgpu 双后端随机暴毙（`立项.md:144-150` 用户拍板转 CPU）——是设备驱动实证，
  不是库限制；
- APK 闪退史（BAR-011/013/014）根因全在**打包层 dex/.so 版本错配**与 GPU 驱动/
  surface 生命周期，无一病灶在终端解析层（`docs/ledger/bugs.md`）；
- alacritty_terminal 是纯 Rust 无系统依赖 crate，**已编进生产 APK 真机在跑**。

结论：「只能自研」是把"渲染壳被迫自研 + 打包层踩坑"误泛化成了"终端库不可用"。
这个错误常识若不纠正，会影响 NA 线对下方共享内核清单的采纳。

## 二、NA 协同路径（用户拍板）

**关系式**：9.0 契约出规格（接口/语义/考题）→ Rust crate 出 host 中立内核 →
**kfmv4 编 WASM / NA 编原生，两端各自包壳**（kfmv4 壳=TS 插件注册进 Cordis；
NA 壳=cordis-na 插件）。

- cordis-rs 归 NA 线（已有 crates/cordis-na 基座）；
- **NA 定位 = kfmv4 下游收编位**（用户拍板）：TS 工坊先行试错定语义 → 稳定后
  沉淀 Rust crate → NA 收编稳定版。NA 主机层（渲染/UI/打包/手势）主题对齐、
  粒度节奏自定；共享 crate 覆盖的部分直接白拿，**不重走 8.7→9.0**。

**分层判据**：

- 共享 crate（两端同源）：边界薄（buffer 进/状态出）+ 计算重 + 两端都需要；
- kfmv4 专有 WASM 内核（不问 NA）：边界薄 + 计算重 + 浏览器实测痛点——NA 是
  终端 APK，无编辑器/预览场景，此类单边成立（md 渲染 pulldown-cmark /
  语法高亮 syntect / 大文件 diff similar，全部**实测痛点驱动**，不许预防性
  Rust 化）；
- 明确不 Rust 化：全部卡片渲染壳/渲染宿主/手势/broker/布局/启动器/皮肤/动画/
  眼睛/手/命令系统 UI（DOM/编排类，边界税纯亏）。

## 三、终端芯定案

**alacritty_terminal**——NA 已生产实证，kfmv4 WASM 侧同 crate 优先，rio-vt 备选
（官方 wasm32 支持；2026-07 起 Rio 核心抽成独立可嵌入引擎 rio-vt/librio）。
评估动作挂在 kfmv4 8.8.1 之前。NA 侧建议：TermEmu trait 边界已按可替换设计
（`termview.rs:751`），维持 alacritty 实现即可，无需动作。

## 四、Rust 共享内核清单（资源均已核真）

| 共享内核 | 版本 | 现成资源 | 取材 |
|---------|------|---------|------|
| 终端解析核 | 8.8 | **alacritty_terminal**（定案） | 直接拿来 |
| PTY 管理（仅 NA） | 8.8 | portable-pty（wezterm 抽出） | NA 拿来 |
| token 计量 | 8.11 | tiktoken-rs（Zed 在用） | 拿来 |
| 压缩修剪核 | 8.11 | 薄自研 + tiktoken-rs 计量 | 自研薄核 |
| diff | 8.10 | similar（候选） | 拿来改 |
| 文件树过滤 | 8.10 | ignore / globset（ripgrep 系，候选） | 拿来改 |
| 权限裁决核 | 影子 8.7 | cedar-policy（AWS 官方；可能过重，转正期再评估） | 远期评估 |
| session 存储 | 8.11 | 只共享 JSONL schema（NA 侧 rusqlite，浏览器侧续 TS） | 只共享格式 |
| 账本 hash 链 | 8.11 | sha2 + serde 薄自研 | 共享格式 |

dsh 拿来件的 Rust 化评估（顺序拍板：先 TS 搬 → 功能考题过 → 按判据评估）：
compaction 家族**够格**（已入 8.11 小步备注）；session/todo/context 注入族
**不 Rust 化**（IO/胶水，边界税纯亏）。

## 五、请 NA 线 / 评审表态的点

1. NA 线：下游收编位 + 主题对齐节奏自定的分工是否接受？共享清单里 NA 侧
   动作项（portable-pty、rusqlite、账本格式对齐）是否认领？
2. NA 线：终端芯 WASM 评估（8.8.1 前）需要原生侧同口径互证——NA 能否提供
   alacritty_terminal 在真机的解析吞吐实测值作对照基准？
3. 评审：本信第一节的调查结论建议入裁决史（决策索引），防止错误常识回流。
