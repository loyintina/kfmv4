# 9.0 决策索引（跨线评审信箱 74 封信 → 决策一张表）

> 这是什么：`docs/ledger/agent-inbox/` 74 封信的**决策级索引**——信箱是
> ledger（只追加不删改），裁决史散在信里；本表把**已拍板决策**提取成一张表，
> 「为什么这么定」从这里查、细节回信里读。信仍在，本表只索引不替代。
> 别的去哪找：契约全文 → `nine-zero-phase1-contracts.md` / `nine-zero-phase2-contracts.md`；
> 拍板史 → `nine-zero-preface.md`；NA 线规格书 → `../../../experiments/dsh-na/na/plugin-architecture-spec.md`。

## 索引表

| 决策 | 内容一句话 | 出处信 | 状态 | 入档位置 |
|------|-----------|--------|------|---------|
| 9.0 总体评审 | 组件契约缺可逆插拔/事件派发模式；与 NA 规格书对齐 | `kfmv4-9.0-design-review.md` | ✅ 采纳 | preface 契约模板对齐 §8 |
| 9.0 回信 | 七条全采纳；契约对齐 §8 模板；反向输入 3 条给 NA | `kfmv4-9.0-review-response.md` | ✅ 落地 | preface 修订注 |
| 茉莉本体评审 | termview-wasm 降级远期探索；unload 两栏不许缺栏；验收哲学「不用的干净消失」 | `kfmv4-9.0-review-response-moli.md` | ✅ 采纳 | preface 验收哲学 + №1 修订注 |
| 信箱机制建立 | 跨线评审信箱（agent-inbox）建立；ASCII 命名；状态列按线分工 | `kfmv4-inbox-response-moli.md` / `kfmv4-inbox-mechanism-response.md` | ✅ 落地 | inbox README |
| 通用多 agent 信箱送审 | 六块观察 + 送审问题 1-5（通用化/停滞检查/契约头/回执/结晶） | `kfmv4-inbox-mechanism-response.md` | 📥 收进议题 6 | preface 待讨论议题 6 |
| 进度评审 r2 | №4 手 press 语义查实定案；抽文件测试两形态；№5 正文+NA 对齐 | `kfmv4-9.0-progress-review.md` / `kfmv4-9.0-progress-review-response.md` | ✅ 落地 | preface №4 修订注 |
| broker 契约评审 | 兄弟序 name 兜底；实例户口 serialize 交班；NA 独占对齐注记 | `kfmv4-9.0-broker-contract-review.md` / `kfmv4-9.0-broker-contract-review-response.md` | ✅ 落地 | phase1 №6 修订注 |
| 进度评审 r3 | №5-№11 + 五原则拍板；契约模板升格四条；性能硬指标推广 | `kfmv4-9.0-r3-review.md` / `kfmv4-9.0-r3-review-response.md` | ✅ 落地 | phase1 + phase2 契约模板 |
| 设计冻结 | 契约 №1~№16 全定稿；军规覆盖闭合；二阶段归属 9.0 线 | `kfmv4-9.0-design-freeze-report.md` | ✅ 通报 | nine-point-zero 台账 |
| 二阶段开篇 | 沙漏模型；文档世界 ctx=Σ+事件+累积器(git)；机制三件套；契约 0-9 | `kfmv4-9.0-phase2-hourglass-submission.md` | 💬 讨论完 | phase2-contracts |
| 二阶段收口 | 契约 0-9 定稿；横切原则（建造放开/采纳收紧/结晶判据） | `kfmv4-9.0-phase2-contracts-report.md` | ✅ 通报 | phase2-contracts |
| Cordis 采用 | 9.0 web 端内核采用 Cordis 本体；(c) 上游+按需移植；步 0 四项验证闸门 | `kfmv4-9.0-cordis-adoption-submission.md` / `kfmv4-9.0-cordis-adoption-verdict.md` | ✅ 用户终审 | preface 双终审落档 |
| NA 基座设计 | 六条裁决（同步化/瞬时返回/serial+bail 合并/考题 17/五态/体量） | `kfm-na-base-design-submission.md` / `kfm-na-base-design-response.md` / `kfm-na-base-landing-report.md` | ✅ 落地 | NA 规格书 v1.1 + src/base |
| 连接 provider | 五条裁决（事件零总线/unload 不断连/假 transport/边界） | `kfm-na-conn-provider-design-submission.md` / `kfm-na-conn-provider-review-response.md` / `kfm-na-conn-provider-landing-report.md` | ✅ 落地 | NA 规格书 + src/plugins |
| 终端模拟器 | 工厂形态必然性/方法面边界/零配置/范围；考题 5 道 | `kfm-na-term-emu-design-submission.md` / `kfm-na-term-emu-review-response.md` / `kfm-na-term-emu-landing-report.md` | ✅ 落地 | NA 规格书 + src/plugins |
| 输入/IME | 方案 A 批准（状态进服务）；共享实例直挂=第三种形态；规格书 v1.2 判别准则 | `kfm-na-input-ime-design-submission.md` / `kfm-na-input-ime-review-response.md` / `kfm-na-input-ime-landing-report.md` | ✅ 落地 | NA 规格书 v1.2 |
| cordis-rs 审计 | 复刻通用 Rust 版 Cordis；维持传递排空；G2=panic；crate 名 cordis-na；验收换实测基线 | `kfm-na-cordis-rs-audit-submission.md` / `-review.md` | ✅ 裁决 | NA 规格书 v1.3 |
| cordis-na 阶段 1 | workspace 化 + G1 切除 + 消费侧零改动 + chain workspace 化 | `kfm-na-cordis-rs-stage1-landing.md` | ✅ 已核 | crates/cordis-na |
| NA 设计冻结响应 | NA 线对 9.0 冻结的响应（休眠期约定） | `kfm-na-design-freeze-response.md` | ✅ 通报 | NA 规格书 §6 阶段 4 |
| 版本策略 v2 | 池卡提前 8.8 成首个可见版；终端居中 8.9；服务换心转隐形并行轨；M3 期限提前 8.8 | `kfmv4-9.0-version-plan-v2-notice.md` | ✅ 通报（用户授权主笔直改） | dev-task-map 版本策略节 |
| 步 0-4 拆分 | 循环依赖死锁（8.7.1↔0-4↔NA↔8.7.2）解锁：0-4a 基准设定=闸门认项 ✅；0-4b NA 互证移出步 0 归 8.7.2 验收项 | `kfmv4-9.0-step0-4-split-report.md` | ✅ 用户拍板（评审已收编案例 001） | dev-task-map 第 0 层 0-4 行 + agent-mailbox cases/ |
| NA 协同与 Rust 共享内核 | 「终端库只能自研」证伪入裁决史；NA=下游收编位关系式；终端芯 alacritty_terminal 定案；互证基准解析/渲染分开计时方法学 | `kfmv4-9.0-na-rust-synergy.md` / `kfm-na-rust-synergy-response.md` / `kfmv4-9.0-na-rust-synergy-review-response.md` | ✅ 全线表态完毕（NA + 评审全采纳） | dev-task-map NA 协同节 |
| cordis-na 阶段 2 | G2 活性闸（入口先查活性；Events 同闸；panic 前缀 INACTIVE_ACCESS 定公开契约）；G3/G4 缓建桩；G5 政策归层保留 50ms | `kfm-na-liveness-gate-design-submission.md` / `kfm-na-liveness-gate-review-response.md` | ✅ 批准（待落地通报） | crates/cordis-na（落地后） |
| 发版冻结 v4（2026-08-18） | 9.0 完成前 8.x.y 只作进度标记，不发版不 tag，全部完成一次性 v9.0.0；tag-advisor 系挂起；check-versions 零改动兼容 | 会话拍板（用户） | ✅ 用户拍板 | dev-task-map 版本策略节 |
| kfm-nz 另起炉灶（2026-08-18） | 9.0 代码实现另立外置纯代码项目 kfm-nz（kfmv4 不动照住；不建新文档系统，nine-zero 文档即规格书；独立端口；Cordis 起步逐插件做/移植；成功整体迁入 kfmv4 正名发 v9.0.0） | 会话拍板（用户） | ✅ 用户拍板 | dev-task-map 版本策略节 + 审计记录 |
| 工坊线整体推迟（2026-08-18） | 六族契约 0–9 实施冻结推迟到代码完成后重评重建（设计稿保留定稿）；kfmv4 文档世界维持现状 | 会话拍板（用户） | ✅ 用户拍板 | dev-task-map 工坊线节 |
| 工坊线顺序调整（2026-08-20 修订上行） | 工坊线非搁置系顺序调整：接着主线（9.0 收口）后面走；nz TASK.md 新增 9.x 阶段（4.7：重评会 → D1–D6 按需实施 + 五条重评输入材料） | 会话拍板（用户） | ✅ 用户拍板 | kfm-nz/TASK.md 4.7 |
| nz TASK.md 重构评审闭环（2026-08-18/20） | 9.0 线评 dsh 重构 8 条（4 必修+4 补强）全落实；发起方核验处置位置：数据区 2.5 / 端口 8023 在 2.3 / 单写者 1.2 | `kfmv4-9.0-nz-taskmap-review.md` | ✅ 已验证 | kfm-nz/TASK.md |
| nz 落地评审 5 条处置（2026-08-20） | nz 补 git 仓库（首个 commit a0e37ce）+ DoD 追加「小步关账必 commit」；步号口径入 1.3；dsh=9.0 线双向讨论通道（非独立线）明文固定；package version 对齐 9.0.0-dev | `kfmv4-9.0-nz-landing-review.md` / `kfmv4-9.0-nz-landing-review-response.md` | ✅ 已回 | kfm-nz/TASK.md 决策记录 + nz 仓库 |
| kfmv4 仓内提交纪律（2026-08-20） | 8.7.4 commit 6b1ba5ce 混入事故整改：nz 提交只 `git add nz/...` 白名单式路径、提交前 `git status` 全量核对、禁用 `git add -A`；混入无数据丢失，他线 WIP 已入仓周知 | `kfmv4-9.0-nz-874-landing-report.md` 第四节 / `kfmv4-9.0-nz-874-review.md` | ✅ 已验证（追加两条：链红入仓教训 + git 卫生 v0 评审认领） | kfm-nz/TASK.md 决策记录 |

## 待决/进行中

| 决策 | 现状 | 下一步 |
|------|------|--------|
| 通用多 agent 信箱（送审 1-5） | 收进 9.0 待讨论议题 6 | 主开发线裁决（已挂起待定） |
| 9.0 步 0 四项验证 | 用户终审 2026-08-17 已通过，🔶 验证中 | 9.0 线执行 |
| provider contextWindow 精确化（2026-08-18 洛拍板交 9.0） | v8 遗留：providers.json contextWindow 曾整表批量 131072 占位（只有 k3/k3-256k/deepseek-v4-flash 验证过），预检误压缩深坑（119k 触发 1M 模型）；v8 已修「未登记窗口跳过预检」兜底（宁漏勿错），但精确窗口登记仍是硬编码猜测 | 9.0 从源头解决：窗口值从 provider 元数据/API 错误信息动态获取，不再手填猜测；遗留信源：2026-08-18 会话（茉莉·洛） |
| agent 信箱 D4 代际戳落地（2026-08-18 补登，MECH-FLOW-14 机检抓漏） | 代际戳防过期回执覆盖新状态：载体骑状态字段 + f3 签名行扫描可行 + 软告警建议 + LEGACY 豁免接受；v2 序位对账（暂存区对账+序位倒退拦截）支持立项但不并 D4；收敛判据达成待用户终审 | `kfmv4-agent-mailbox-d4-design-submission.md` | ✅ 茉莉已回（待用户终审） | experiments/agent-mailbox/design/d4-epoch-stamp.md（研究线 index 已登记） |

---

> 维护注：本索引随信箱新信追加（只追加不删改）；新决策落定时加一行，出处信
> 必填。索引与信的对应由 agent-inbox 状态列（README）共同维护。
