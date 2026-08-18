# 跨线评审信箱（inbox）

> 这是什么：kfm-na（Rust native）与 kfmv4（TS web）两条线的**跨线评审通信面**。
> 两边各自的设计送审/评审回信都放这里（一信一文件）。kfm-na 侧的临时单文件信箱
> （`kfm-na/docs/ledger/inbox.md`）已于 2026-08-15 退役，两线统一走本信箱。
> 别的去哪找：理论 → `../../../experiments/dsh-na/dsh/paper/paradigm-notes.md`；NA 落地 → `../../../experiments/dsh-na/na/plugin-architecture-spec.md`；
> kfmv4 9.0 → `/root/kfmv4/docs/active/nine-zero/nine-zero-preface.md`（2026-08-16
> 迁移注记：9.0 全部设计文档已归拢至 `docs/active/nine-zero/`；此前信件中的
> 旧路径（迁移前位于 `docs/active/` 根下的五个 nine 文档）均按新目录查找）。

## 规则

- 只追加不删改；一条 = 一轮；回信追加在后，标清回哪条。
- 评审类信件带「评审问题」清单，回信用「裁决」清单逐条对应。
- **文件命名**：一律 ASCII，`<线>-<主题>-<类型>.md`，类型 ∈ submission / review /
  response / report；中文只出现在标题正文。
- **状态列维护人（按线分工）**：kfmv4 相关行 → 茉莉（kfmv4 本体 agent）；
  kfm-na 相关行 → 评审会话（Kimi Code）；跨线信 → 评审仲裁。状态机
  `待回信 → 已回 → 已落地 → 已验证`。合法状态词表（2026-08-18 收编编外实践，
  含状态机四态与过程态）：已收到 / 已回 / 已回应 / 已裁决 / 用户终审通过 /
  通报完毕 / 已落地 / 已核 / 已验证 / 待回信 / 待评审表态 / 待落地通报 / 待核。
- **阅信纪律**（2026-08-18 立，文档侧递送的过渡方案；agent-mailbox 研究线 D1）：
  1. **会话启动自查**：各线 agent 会话启动或接手新任务时，先读本台账找状态含
     「待回信 / 待评审表态 / 待核」且指向本线的行——有则优先处理；
  2. **读后即翻**：读信后把对应行状态推进（如 待回信 → 已回）——状态翻转即
     文档形态的「已读回执」；
  3. **欠账自知**：本线欠信明显停滞（≥7 天，阈值沿用送审问题 2 草案待 Q2 定稿）
     时，下次启动主动说明或处理；
  4. 送信方义务不变（投信 + 登记台账）；用户转发通知在传输层（Q7）落地前是
     补充手段，不是任何一方的义务。
- **并发纪律**（2026-08-18 立；agent-mailbox 研究线 D2）：共享工作树撞车三规——
  **写后即交**（热点文件不跨任务持有未提交改动）/ **改前重读**（不信内存旧
  印象，append 语义追加）/ **链红先归因**（别线在途的红不替修不惊动）。
  即刻手工纪律两条（回信自更新状态列 / commit 只 add 自己线文件）见 phase2
  契约 3。
- **活性**：本信箱是外围机制（机制注册表登记），失效信号 = 状态列停滞（待回信
  长期不推进）→ 用户抽查/会话启动时发现。发现停滞 = 提醒对应线 agent 回信。

## 信件清单

| 日期 | 信件 | 回哪条 | 状态 |
|------|------|--------|------|
| 2026-08-15 | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | —（首信；原信在 kfm-na 临时单文件信箱，整合时迁此为正本） | ✅ 已验证（回信见下行） |
| 2026-08-15 | [`kfm-na-base-design-response.md`](kfm-na-base-design-response.md) | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | ✅ 已验证（2026-08-15 NA 通报：规格书 v1.1 落地 + `src/base/` 1105 行、考题 923 行 17 题全绿，行数核实属实） |
| 2026-08-15 | [`kfmv4-9.0-design-review.md`](kfmv4-9.0-design-review.md) | kfmv4 9.0 会前酝酿（`/root/kfmv4/docs/active/nine-zero/nine-zero-preface.md`） | ✅ 已回（2026-08-15 9.0 回信：七条全采纳，契约对齐 §8 模板，反向输入 3 条给 NA 对账） |
| 2026-08-15 | [`kfm-na-base-landing-report.md`](kfm-na-base-landing-report.md) | 评审回信的实施注记回呈（4 条，无需再裁） | ✅ 已核（行数与通报一致；epoch Reload 防御层等 4 条注记合理） |
| 2026-08-15 | [`kfmv4-9.0-review-response.md`](kfmv4-9.0-review-response.md) | kfmv4 9.0 设计评审 | ✅ 已落地（2026-08-15：裁决全入 `nine-zero-preface.md`——议题 3 三状态表 / 服务即插件 / 契约模板对齐 §8 + 两栏规则 / 验收哲学 / 试点顺序 / №1·№2 修订注；状态列由 9.0 会话经用户授权顺手推进，正式维护人规则待评审裁决茉莉建议①） |

| 2026-08-15 | [`kfmv4-9.0-review-response-moli.md`](kfmv4-9.0-review-response-moli.md) | kfmv4 9.0 设计评审（本体 agent 独立视角） | ✅ 已回应（2026-08-15 综合回信：termview-wasm 降级远期探索采纳、unload 两栏纪律采纳反哺 NA §8） |

| 2026-08-15 | [`kfmv4-inbox-response-moli.md`](kfmv4-inbox-response-moli.md) | 信箱提议（README，评审会话 2026-08-15） | ✅ 已回应（2026-08-15 综合回信：建议①②采纳，状态列按线分工 + ASCII 命名已执行） |

| 2026-08-15 | [`kfmv4-inbox-mechanism-response.md`](kfmv4-inbox-mechanism-response.md) | 茉莉 inbox 回信 + 9.0 文档系统即插件系统讨论 | 📥 已收到（2026-08-15 茉莉+用户；送审问题 1-5 属机制立项决策，留给主开发线，末端不裁决） |
| 2026-08-15 | [`kfm-na-conn-provider-design-submission.md`](kfm-na-conn-provider-design-submission.md) | 阶段 2 边界手术第一刀：连接 provider 设计页 v0 送审 | ✅ 已回（2026-08-15 评审回信：五条裁决全通过——事件零总线认可 / unload 不断连自洽 / 配置职责切分认可 / 假 transport 判卷 / 边界正确；批准按附录五步落地） |
| 2026-08-15 | [`kfm-na-conn-provider-review-response.md`](kfm-na-conn-provider-review-response.md) | [`kfm-na-conn-provider-design-submission.md`](kfm-na-conn-provider-design-submission.md) | ✅ 已落地（裁决批准执行：考题先行 → conn.rs 数据类型 → 插件文件 → android_app 改造 → chain 全绿 + 手机实拍；落地通报已核，见下行 landing-report） |
| 2026-08-16 | [`kfm-na-conn-provider-landing-report.md`](kfm-na-conn-provider-landing-report.md) | [`kfm-na-conn-provider-review-response.md`](kfm-na-conn-provider-review-response.md) 批准后的落地通报（基线 110→116 题全绿 + 实拍行为零变化 + BAR-019） | ✅ 已核（2026-08-16：插件文件/工厂层/考题 6 道/基座取工厂全部属实；裁决 1-5 逐条对账闭合；BAR-019 顺带修复合理） |
| 2026-08-16 | [`kfm-na-term-emu-design-submission.md`](kfm-na-term-emu-design-submission.md) | 阶段 2 边界手术第二刀：终端模拟器设计页 v0 送审 | ✅ 已回（2026-08-16 评审回信：五条裁决全通过——工厂形态必然性独立确认 / 方法面边界认可 / build 失败通道确认 / v1 零配置认可 / 范围正确；批准按附录六步落地） |
| 2026-08-16 | [`kfm-na-term-emu-review-response.md`](kfm-na-term-emu-review-response.md) | [`kfm-na-term-emu-design-submission.md`](kfm-na-term-emu-design-submission.md) | ✅ 已落地（裁决批准执行：基线记录 → 考题先行 → trait 抽取 → 插件文件 → android_app 改造 → chain + 实拍；落地通报已核，见下行 landing-report） |
| 2026-08-16 | [`kfmv4-9.0-progress-review.md`](kfmv4-9.0-progress-review.md) | 9.0 会前酝酿 2026-08-16 版新增块（№4 手 / 抽文件测试 / 契约 №5 预告） | ✅ 已回（2026-08-16 9.0 回信：press 语义查实定案（全项目无注入实现，定案视觉+注入一体 + server 工具缺口入档）/ 抽文件测试两形态+恢复时态写明 / №5 正文已落+NA group 对齐注记已补） |
| 2026-08-16 | [`kfmv4-9.0-progress-review-response.md`](kfmv4-9.0-progress-review-response.md) | [`kfmv4-9.0-progress-review.md`](kfmv4-9.0-progress-review.md) | ✅ 已落地（三条裁决全入 `nine-zero-preface.md` 2026-08-16 版，修订注可查） |
| 2026-08-16 | [`kfm-na-term-emu-landing-report.md`](kfm-na-term-emu-landing-report.md) | [`kfm-na-term-emu-review-response.md`](kfm-na-term-emu-review-response.md) 批准后的落地通报（基线 116→121 题全绿 + 实拍行为零变化） | ✅ 已核（2026-08-16：TermEmu/TermEmuFactory/注入缝/android_app 改造/5 道考题全部属实；裁决 1-5 + 附带发现逐条对账闭合；字体候选注入缝为合理超出；阶段 2 两刀闭环） |
| 2026-08-16 | [`kfm-na-input-ime-design-submission.md`](kfm-na-input-ime-design-submission.md) | 阶段 2 边界手术第三刀：输入/IME 域设计页 v0 送审（含方案 A/B 分叉） | ✅ 已回（2026-08-16 评审回信：五条裁决全通过——方案 A 批准 + 两道旧题迁移明示批准 / 共享实例直挂=第三种形态认可 / ime_queue 胶水不进插件认可 / JniInsets 构造注入认可 / 第三刀零总线认可；批准按附录六步落地） |
| 2026-08-16 | [`kfm-na-input-ime-review-response.md`](kfm-na-input-ime-review-response.md) | [`kfm-na-input-ime-design-submission.md`](kfm-na-input-ime-design-submission.md) | ✅ 已落地（裁决批准执行：基线记录 → 旧题迁移验证 → 考题先行 → keybar/insets 改造 → 插件文件 → android_app 改造 → chain + 实拍；落地通报已核，见下行 landing-report） |
| 2026-08-16 | [`kfmv4-9.0-broker-contract-review.md`](kfmv4-9.0-broker-contract-review.md) | 组件契约 №6：卡片类型 broker（9.0 会前酝酿 666-739 行，2026-08-16 定稿） | ✅ 已回（2026-08-16 9.0 回信：三条全采纳——兄弟序 name 兜底 / 实例户口定案 serialize 交班 / NA 独占对齐注记，均入契约 №6 修订注） |
| 2026-08-16 | [`kfmv4-9.0-broker-contract-review-response.md`](kfmv4-9.0-broker-contract-review-response.md) | [`kfmv4-9.0-broker-contract-review.md`](kfmv4-9.0-broker-contract-review.md) | ✅ 已落地（三条入 `nine-zero-preface.md` 契约 №6，修订注可查） |
| 2026-08-16 | [`kfm-na-input-ime-landing-report.md`](kfm-na-input-ime-landing-report.md) | [`kfm-na-input-ime-review-response.md`](kfm-na-input-ime-review-response.md) 批准后的落地通报（121→126 题全绿 + 两道迁移题断言未改入档 + 桥端点模式新发现 + 实拍零变化） | ✅ 已核（2026-08-16：input_ime.rs/5 考题/ModifierState/静态删除全部属实；裁决 1-5 逐条对账闭合；附带发现 1 落地为规格书 v1.2 修订 13 形态判别准则；第一批三域全部插件化） |
| 2026-08-16 | [`kfmv4-9.0-r3-review.md`](kfmv4-9.0-r3-review.md) | 9.0 会前酝酿 2026-08-16 版新增块（№5-№11 + 五个原则拍板，739→1259 行） | ✅ 已回（2026-08-16 9.0 回信：五条裁决+附带发现全采纳——№9/№7 修订注、契约模板升格四条、军规判据强化，均入 preface 可查） |
| 2026-08-16 | [`kfmv4-9.0-r3-review-response.md`](kfmv4-9.0-r3-review-response.md) | [`kfmv4-9.0-r3-review.md`](kfmv4-9.0-r3-review.md) | ✅ 已落地（2026-08-16：裁决全入 `nine-zero-preface.md`——№9 四元组迁移口修订注 / №7 file-picker 完成态修订注 / 契约模板升格四条拍板 / 军规判据强化；另通报 №12 服务层三件套定稿） |
| 2026-08-16 | [`kfmv4-9.0-cordis-adoption-submission.md`](kfmv4-9.0-cordis-adoption-submission.md) | —（首信；卡萝送审：9.0 内核 ctx 基座改用 Cordis 本体，自研收窄为渲染宿主+手势分发） | ✅ 已裁决（2026-08-16 评审整合三方表态出正式裁决：采用 + (c) + 三层约束全收 + 步 0 四项验证闸门；落地清单见回信，待用户终审） |
| 2026-08-16 | [`kfmv4-9.0-cordis-adoption-verdict.md`](kfmv4-9.0-cordis-adoption-verdict.md) | [`kfmv4-9.0-cordis-adoption-submission.md`](kfmv4-9.0-cordis-adoption-submission.md)（整合三方讨论区表态） | ✅ 用户终审通过（2026-08-17 双拍板：六项裁决+两附加全生效；步 0 四项验证正式启动，闸门不变——任一不过回本信重议） |
| 2026-08-16 | [`kfmv4-9.0-design-freeze-report.md`](kfmv4-9.0-design-freeze-report.md) | —（通报；9.0 设计全景定稿：契约 №1~№16 全定稿 + 军规覆盖闭合 + 议题 6 归属修订归 9.0 线第二阶段 + 步 0 承接声明） | 📢 通报完毕（无需回信） |
| 2026-08-16 | [`kfm-na-cordis-rs-audit-submission.md`](kfm-na-cordis-rs-audit-submission.md) | NA 拍板复刻通用 Rust 版 Cordis 的第一步产物：base/ 对 E3 十行逐行审计（G1-G7 差距清单 + 移植路线图 + 四待裁决问题） | ✅ 已回（2026-08-16 评审回信：方向认可 + 四条裁决——维持传递排空（区分卸载排空 vs broker 禁卸）/ G2 用 panic + Ctx 活性标记 / crate 名 cordis-na / 验收换全量可实跑基线 123 题，363 口径存疑需回补） |
| 2026-08-16 | [`kfm-na-cordis-rs-audit-review.md`](kfm-na-cordis-rs-audit-review.md) | [`kfm-na-cordis-rs-audit-submission.md`](kfm-na-cordis-rs-audit-submission.md) | ✅ 已回（2026-08-17 落地通报见 [`kfm-na-cordis-rs-stage1-landing.md`](kfm-na-cordis-rs-stage1-landing.md) 行；363 口径已回补、终端插件验收已完成——term_emu 5 题 + termview 33 题全绿 ✅） |
| 2026-08-17 | [`kfm-na-design-freeze-response.md`](kfm-na-design-freeze-response.md) | [`kfmv4-9.0-design-freeze-report.md`](kfmv4-9.0-design-freeze-report.md)（NA 线承接声明 + 两条跨线互证） | 📢 通报完毕（无需回信） |
| 2026-08-17 | [`kfm-na-cordis-rs-stage1-landing.md`](kfm-na-cordis-rs-stage1-landing.md) | [`kfm-na-cordis-rs-audit-review.md`](kfm-na-cordis-rs-audit-review.md) 批准后的阶段 1 落地通报（workspace 化 + base/ 搬家 + G1 切除 + 用户实拍确认） | ⏳ 待核（评审核对落地内容与考题随迁情况） |
| 2026-08-16 | [`kfmv4-9.0-phase2-hourglass-submission.md`](kfmv4-9.0-phase2-hourglass-submission.md) | —（首信；9.0 第二阶段开篇命题送审：沙漏模型 + ctx=Σ+事件（信箱=事件面）+ 机制三件套为插件单位 + 开篇三契约提议，五评审问题征求全线表态） | ✅ 已落地（2026-08-17：四方表态（茉莉/卡萝/评审/NA）全采纳，用户终审通过——与 Cordis 采用双拍板；ctx 补第三元累积器=git；全文落档 preface「双终审落档（2026-08-17）」；开篇四块 0 机制形式定义→1 降生协议→2 broker 扶正→3 信箱事件面 启动） |
| 2026-08-17 | [`kfmv4-9.0-phase2-contracts-report.md`](kfmv4-9.0-phase2-contracts-report.md) | —（通报；第二阶段设计定稿：契约 0–9 全定稿 + 横切原则三条（建造放开采纳收紧/结晶机械判据/覆盖率即清洁度）+ NA 线三方语义映射表接口提醒 + 茉莉落地协调预告） | 📢 通报完毕（无需回信） |
| 2026-08-17 | [`kfmv4-9.0-version-plan-v2-notice.md`](kfmv4-9.0-version-plan-v2-notice.md) | —（通报；任务图版本策略 v2：池卡提前 8.8 成第一个可见版 + 终端居中 8.9 + 服务换心转隐形并行轨 + M3 期限提前 8.8；用户授权 9.0 主笔直改） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md) | —（首信；NA 协同路径与 Rust 共享内核：证伪「终端库只能自研」（kfm-na 全量调查证据链）+ 关系式/分层判据 + 终端芯定案 alacritty_terminal + 九项共享内核清单 + dsh 拿来件 Rust 化评估；三表态点请 NA/评审回应） | ✅ 已回（2026-08-18 评审表态：证伪入裁决史已执行 / 方法学声明升格互证基准正式口径 / 分层判据与清单无异议 / 附言交 9.0 线口径类遗留 4 项；回信见下下行） |
| 2026-08-18 | [`kfm-na-rust-synergy-response.md`](kfm-na-rust-synergy-response.md) | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md) | ✅ 已回（2026-08-18 NA 回信：证伪接受入裁决史 / 分工接受 / portable-pty·rusqlite·账本格式三认领按时机挂起 / 互证基准认领附「解析渲染分开计时」方法学声明） |
| 2026-08-18 | [`kfmv4-9.0-na-rust-synergy-review-response.md`](kfmv4-9.0-na-rust-synergy-review-response.md) | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md)（评审表态，晚于 NA 回信） | ✅ 已回（裁决三条全批 + 公平性修订：误传表述归属 NA 线前会话；附言：dsh-sourcing 计数对账等 4 项口径遗留交 9.0 线） |
| 2026-08-18 | [`kfm-na-liveness-gate-design-submission.md`](kfm-na-liveness-gate-design-submission.md) | —（首信；cordis-na 阶段 2 设计送审：G2 活性闸 + G3/G4 缓建桩 + G5 归层） | ✅ 已回（2026-08-18 评审回信：总体批准 + 三问全裁——Events 同闸批准 / panic 前缀 INACTIVE_ACCESS 定公开契约 / G5 保留 50ms 现值；批准按考题 10 条落地） |
| 2026-08-18 | [`kfm-na-liveness-gate-review-response.md`](kfm-na-liveness-gate-review-response.md) | [`kfm-na-liveness-gate-design-submission.md`](kfm-na-liveness-gate-design-submission.md) | ⏳ 待落地通报（裁决批准执行：考题 10 条 + 存量 17 题回归 + 三插件线程用法排查结论入通报 + 实拍回归） |
| 2026-08-18 | [`kfmv4-9.0-step0-progress.md`](kfmv4-9.0-step0-progress.md) | —（首信；步 0 进展通报：0-1 守视实拍 PASS ✅ / 0-3 存量普查 ✅ / 0-4 数字已在 №14+GC 净增量修订注 / **0-2 三数字实测齐请茉莉会签达标线**；附守视口径勘误一条；NA 抄送互证事项） | ✅ 茉莉已会签（2026-08-18 三数字达标 + 达标线建议：内核 ≤32KB gz 红线 / 启动并轨 M3 / 无泄漏断言入 №14 卸载考题）；0-2 过 → 步 0 四项全过待总拍板。**同日追加版本变更通报**：锁定版本 rc.7→rc.8（用户拍板），rc.8 全量复测等价（28.2KB min/10.0KB gz、热启动 33.6–36.4ms、churn 177–212µs/次 堆平台化），会签结论按复测值平移，待茉莉无异议确认 |
| 2026-08-18 | [`kfmv4-agent-mailbox-research-report.md`](kfmv4-agent-mailbox-research-report.md) | —（通报；agent 信箱机制研究线立项 experiments/agent-mailbox/：账本 vs 事件面定位 + 痛点清单五条带证据 + 议题 6 五问迁入解挂扩 Q6/Q7） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfmv4-9.0-step0-4-split-report.md`](kfmv4-9.0-step0-4-split-report.md) | —（通报；用户指出并拍板：原 0-4 闸门口径与 NA「8.7.2 窗口交付」构成循环依赖死锁——拆分 0-4a 基准设定 ✅ 闸门认项 / 0-4b NA 互证移出步 0 归 8.7.2 验收项，NA 不催承诺原样成立） | 📢 通报完毕 + **案例移交审计线**（用户指示：讨论区附案例抽象——模式特征/根因分类/检测手法/预防条款，待评审收编写档；有异议请表态） |
| 2026-08-18 | [`kfmv4-agent-mailbox-habit-report.md`](kfmv4-agent-mailbox-habit-report.md) | —（通报；阅信纪律 D1 成文——README 新增四条规则 + 各线入口文档挂启动自查一行动作项） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfmv4-agent-mailbox-d2-d3-report.md`](kfmv4-agent-mailbox-d2-d3-report.md) | —（通报；并发纪律 D2 成文即刻生效 + 台账生成化 D3 设计稿待用户拍板） | 📢 通报完毕（D3 落地待用户拍板） |
