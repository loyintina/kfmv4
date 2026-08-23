# 跨线评审信箱（inbox）

> 这是什么：kfm-na（Rust native）与 kfmv4（TS web）两条线的**跨线评审通信面**。
> 两边各自的设计送审/评审回信都放这里（一信一文件）。kfm-na 侧的临时单文件信箱
> （`kfm-na/docs/ledger/inbox.md`）已于 2026-08-15 退役，两线统一走本信箱。
> 别的去哪找：理论 → `../../../experiments/dsh-na/dsh/paper/paradigm-notes.md`；NA 落地 → `../../../experiments/dsh-na/na/plugin-architecture-spec.md`；
> kfmv4 9.0 → `/root/kfmv4/docs/active/nine-zero/nine-zero-preface.md`（2026-08-16
> 迁移注记：9.0 全部设计文档已归拢至 `docs/active/nine-zero/`；此前信件中的
> 旧路径（迁移前位于 `docs/active/` 根下的五个 nine 文档）均按新目录查找）。

## 规则

- 只追加不删改；一条 = 一轮；回信追加在后，标清回哪条。**例外**：机读头为投影源——
  状态翻转改信头 `> 状态:` 字段，台账表格由生成器回写，不手改。
- 评审类信件带「评审问题」清单，回信用「裁决」清单逐条对应。
- **文件命名**：一律 ASCII，`<线>-<主题>-<类型>.md`，类型 ∈ submission / review /
  response / report；中文只出现在标题正文。
- **状态列维护人（按线分工）**：kfmv4 相关行 → 茉莉（kfmv4 本体 agent）；
  kfm-na 相关行 → 评审会话（Kimi Code）；跨线信 → 评审仲裁。状态机
  `待回信 → 已回 → 已落地 → 已验证`。合法状态词表（2026-08-18 收编编外实践，
  含状态机四态与过程态）：已收到 / 已回 / 已回应 / 已裁决 / 用户终审通过 /
  通报完毕 / 已落地 / 已核 / 已验证 / 待回信 / 待评审表态 / 待落地通报 / 待核 /
  已会签（2026-08-18 D3 回填收编：茉莉会签步 0 达标线）/ 已收编（2026-08-18
  评审：案例归档收编态，用于信件内容转入案例库后封账）。维护对象 = 信头
  `> 状态:` 字段（机读头），台账状态列是它的生成投影。
- **机读头 schema**（2026-08-18 D3 落地，对齐 phase2 契约 3 四字段）：每封信文首
  引用块内落 7 个单行字段（人读即机读，不引入第二语法），格式 `> 字段名: 值`
  （半角冒号，读取兼容全角「：」）：`日期`（YYYY-MM-DD，投影第一列）/
  `致`（kfmv4 / kfmv4-9.0 / kfm-na / dsh / 茉莉 / 评审 / all，多线用「，」分隔）/
  2026-08-18 登记 dsh 线（kfm-nz 项目实现线，9.0 线同日致信实锤）→
  2026-08-20 收编（用户拍板：dsh = 9.0 线的双向讨论通道别名，非独立接信线；
  保留词位仅为存量信 `致: dsh` 字段合法性）/
  `流型`（链条 / 征集 / 汇总 / 线程，契约 3 四流型原样）/ `预期表态方`（征集与
  汇总必填 = 收齐判据；纯通报填「无」）/ `收敛判据`（什么算这轮结束；纯通报填
  「无需回信（知会）」）/ `回`（台账「回哪条」列原文）/ `状态`（台账「状态」列
  原文，状态词前缀须 ∈ 上方合法词表）。信件清单表格 = 机读头的生成投影，
  由 `gen-agent-inbox.mjs` 回写（`<!-- gen:agent-inbox -->` 区段内不手改）；
  归属行扫描 = `gen-agent-inbox.mjs --for=<线名>`（列「致」含本线且状态以
  「待」开头的信件）。
- **阅信纪律**（2026-08-18 立，文档侧递送的过渡方案；agent-mailbox 研究线 D1）：
  1. **会话启动自查**：各线 agent 会话启动或接手新任务时，先读本台账找状态含
     「待回信 / 待评审表态 / 待核」且指向本线的行——有则优先处理；
  2. **读后即翻**：读信后把信头 `> 状态:` 字段推进（如 待回信 → 已回）——状态翻转即
     文档形态的「已读回执」，台账表格由生成器回写同步；**翻转必带代际戳**
     （2026-08-18 D4 立，契约 3 第三机械件）：状态注正式化为
     `词表词（YYYY-MM-DD 更新者：备注）`——全角括号、日期、更新者一个不少，
     check-agent-inbox f1 查校验（⛳ MECH-FLOW-17）；**回信/追加轮次必带签名行**
     `——线名 · YYYY-MM-DD`（从 convention 升纪律，f3 头体咬合的对账依据）；
  3. **欠账自知**：本线欠信明显停滞（≥7 天，阈值沿用送审问题 2 草案待 Q2 定稿；
     机检 = check-agent-inbox e 查，时钟 = 最后推进时刻）时，下次启动主动说明
     或处理；
  4. 送信方义务：投信 + **新信必填机读头七字段**（见上「机读头 schema」条）；台账
     表格无需手登（生成器回写）。用户转发通知在传输层（Q7）落地前是
     补充手段，不是任何一方的义务；
  5. **回函通知代字**（2026-08-23 立，D5 总线代理交互机制落地业务规则）：机读头可选
     加第 8 字段 `> 回函通知: <会话名>`（值 = 回函后要把完成消息**塞过去**的 **tmux 会话名**，
     见下方「会话注册表」；**评审会话 = `psh`**，如 `> 回函通知: psh`——不要写线名"评审"）。
     **含义：收信 agent 写完回复信后，运行 `bash /root/kfmv4/scripts/agent-send.sh
     <会话名> "<回函完成消息>"` 直接把消息塞进对方会话窗口**——对方即时知晓该回复
     已就绪，**无需另开监控/守望进程**（send-keys 与打字同管道，目标忙时自动排队）。
     无此字段 = 按常规流程，是否通知由收信方自行判断。
     （note：机读头仍是七字段必填，`回函通知` 是可选附加字段，gen/check 只认七字段，
     附加字段不参与投影。）
- **会话注册表**（2026-08-23 立，供 agent-send.sh 跨会话寻址；`<target-session>` 取值）：

  | 窗口(session) | 对应 agent / 线 |
  |---|---|---|
  | `dsh` | kfmv4-9.0（nz 实现线；9.0 主线） |
  | `kfm-na` | kfm-na（NA 独立仓客户端线） |
  | `omp` | 用户主会话（另一个 kimi agent 窗口） |
  | `psh` | 评审会话（Kimi Code，本评审/总线角色） |

  任意 agent 要「塞对话」给另一 agent，用 `bash /root/kfmv4/scripts/agent-send.sh <上述窗口> <消息>`
  （见 agent-send.sh 帮助）。消息建议引用真实信件文件（如「查看 docs/ledger/agent-inbox/<信>.md」），
  内容留痕走信箱，send 只管时序投递。
- **并发纪律**（2026-08-18 立；agent-mailbox 研究线 D2）：共享工作树撞车三规——
  **写后即交**（热点文件不跨任务持有未提交改动）/ **改前重读**（不信内存旧
  印象，append 语义追加）/ **链红先归因**（别线在途的红不替修不惊动）。
  即刻手工纪律两条（回信自更新状态列 / commit 只 add 自己线文件）见 phase2
  契约 3。
- **活性**：本信箱是外围机制（机制注册表登记），失效信号 = 状态列停滞（待回信
  长期不推进）。发现手段已机械化（2026-08-18）：check-agent-inbox e 查
  「待*」状态 + 发信超 7 天报红（⛳ MECH-FLOW-16），用户抽查兜底保留。
  发现停滞 = 提醒对应线 agent 回信。

## 信件清单

<!-- gen:agent-inbox:start -->
| 日期 | 信件 | 回哪条 | 状态 |
|------|------|--------|------|
| 2026-08-15 | [`kfm-na-base-design-response.md`](kfm-na-base-design-response.md) | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | ✅ 已验证（2026-08-15 NA 通报：规格书 v1.1 落地 + `src/base/` 1105 行、考题 923 行 17 题全绿，行数核实属实） |
| 2026-08-15 | [`kfm-na-base-design-submission.md`](kfm-na-base-design-submission.md) | —（首信；原信在 kfm-na 临时单文件信箱，整合时迁此为正本） | ✅ 已验证（回信见下行） |
| 2026-08-15 | [`kfm-na-base-landing-report.md`](kfm-na-base-landing-report.md) | 评审回信的实施注记回呈（4 条，无需再裁） | ✅ 已核（行数与通报一致；epoch Reload 防御层等 4 条注记合理） |
| 2026-08-15 | [`kfm-na-conn-provider-design-submission.md`](kfm-na-conn-provider-design-submission.md) | 阶段 2 边界手术第一刀：连接 provider 设计页 v0 送审 | ✅ 已回（2026-08-15 评审回信：五条裁决全通过——事件零总线认可 / unload 不断连自洽 / 配置职责切分认可 / 假 transport 判卷 / 边界正确；批准按附录五步落地） |
| 2026-08-15 | [`kfm-na-conn-provider-review-response.md`](kfm-na-conn-provider-review-response.md) | [`kfm-na-conn-provider-design-submission.md`](kfm-na-conn-provider-design-submission.md) | ✅ 已落地（裁决批准执行：考题先行 → conn.rs 数据类型 → 插件文件 → android_app 改造 → chain 全绿 + 手机实拍；落地通报已核，见下行 landing-report） |
| 2026-08-15 | [`kfmv4-9.0-design-review.md`](kfmv4-9.0-design-review.md) | kfmv4 9.0 会前酝酿（`/root/kfmv4/docs/active/nine-zero/nine-zero-preface.md`） | ✅ 已回（2026-08-15 9.0 回信：七条全采纳，契约对齐 §8 模板，反向输入 3 条给 NA 对账） |
| 2026-08-15 | [`kfmv4-9.0-review-response-moli.md`](kfmv4-9.0-review-response-moli.md) | kfmv4 9.0 设计评审（本体 agent 独立视角） | ✅ 已回应（2026-08-15 综合回信：termview-wasm 降级远期探索采纳、unload 两栏纪律采纳反哺 NA §8） |
| 2026-08-15 | [`kfmv4-9.0-review-response.md`](kfmv4-9.0-review-response.md) | kfmv4 9.0 设计评审 | ✅ 已落地（2026-08-15：裁决全入 `nine-zero-preface.md`——议题 3 三状态表 / 服务即插件 / 契约模板对齐 §8 + 两栏规则 / 验收哲学 / 试点顺序 / №1·№2 修订注；状态列由 9.0 会话经用户授权顺手推进，正式维护人规则待评审裁决茉莉建议①） |
| 2026-08-15 | [`kfmv4-inbox-mechanism-response.md`](kfmv4-inbox-mechanism-response.md) | 茉莉 inbox 回信 + 9.0 文档系统即插件系统讨论 | 📥 已收到（2026-08-15 茉莉+用户；送审问题 1-5 属机制立项决策，留给主开发线，末端不裁决） |
| 2026-08-15 | [`kfmv4-inbox-response-moli.md`](kfmv4-inbox-response-moli.md) | 信箱提议（README，评审会话 2026-08-15） | ✅ 已回应（2026-08-15 综合回信：建议①②采纳，状态列按线分工 + ASCII 命名已执行） |
| 2026-08-16 | [`kfm-na-conn-provider-landing-report.md`](kfm-na-conn-provider-landing-report.md) | [`kfm-na-conn-provider-review-response.md`](kfm-na-conn-provider-review-response.md) 批准后的落地通报（基线 110→116 题全绿 + 实拍行为零变化 + BAR-019） | ✅ 已核（2026-08-16：插件文件/工厂层/考题 6 道/基座取工厂全部属实；裁决 1-5 逐条对账闭合；BAR-019 顺带修复合理） |
| 2026-08-16 | [`kfm-na-cordis-rs-audit-review.md`](kfm-na-cordis-rs-audit-review.md) | [`kfm-na-cordis-rs-audit-submission.md`](kfm-na-cordis-rs-audit-submission.md) | ✅ 已回（2026-08-17 落地通报见 [`kfm-na-cordis-rs-stage1-landing.md`](kfm-na-cordis-rs-stage1-landing.md) 行；363 口径已回补、终端插件验收已完成——term_emu 5 题 + termview 33 题全绿 ✅） |
| 2026-08-16 | [`kfm-na-cordis-rs-audit-submission.md`](kfm-na-cordis-rs-audit-submission.md) | NA 拍板复刻通用 Rust 版 Cordis 的第一步产物：base/ 对 E3 十行逐行审计（G1-G7 差距清单 + 移植路线图 + 四待裁决问题） | ✅ 已回（2026-08-16 评审回信：方向认可 + 四条裁决——维持传递排空（区分卸载排空 vs broker 禁卸）/ G2 用 panic + Ctx 活性标记 / crate 名 cordis-na / 验收换全量可实跑基线 123 题，363 口径存疑需回补） |
| 2026-08-16 | [`kfm-na-input-ime-design-submission.md`](kfm-na-input-ime-design-submission.md) | 阶段 2 边界手术第三刀：输入/IME 域设计页 v0 送审（含方案 A/B 分叉） | ✅ 已回（2026-08-16 评审回信：五条裁决全通过——方案 A 批准 + 两道旧题迁移明示批准 / 共享实例直挂=第三种形态认可 / ime_queue 胶水不进插件认可 / JniInsets 构造注入认可 / 第三刀零总线认可；批准按附录六步落地） |
| 2026-08-16 | [`kfm-na-input-ime-landing-report.md`](kfm-na-input-ime-landing-report.md) | [`kfm-na-input-ime-review-response.md`](kfm-na-input-ime-review-response.md) 批准后的落地通报（121→126 题全绿 + 两道迁移题断言未改入档 + 桥端点模式新发现 + 实拍零变化） | ✅ 已核（2026-08-16：input_ime.rs/5 考题/ModifierState/静态删除全部属实；裁决 1-5 逐条对账闭合；附带发现 1 落地为规格书 v1.2 修订 13 形态判别准则；第一批三域全部插件化） |
| 2026-08-16 | [`kfm-na-input-ime-review-response.md`](kfm-na-input-ime-review-response.md) | [`kfm-na-input-ime-design-submission.md`](kfm-na-input-ime-design-submission.md) | ✅ 已落地（裁决批准执行：基线记录 → 旧题迁移验证 → 考题先行 → keybar/insets 改造 → 插件文件 → android_app 改造 → chain + 实拍；落地通报已核，见下行 landing-report） |
| 2026-08-16 | [`kfm-na-term-emu-design-submission.md`](kfm-na-term-emu-design-submission.md) | 阶段 2 边界手术第二刀：终端模拟器设计页 v0 送审 | ✅ 已回（2026-08-16 评审回信：五条裁决全通过——工厂形态必然性独立确认 / 方法面边界认可 / build 失败通道确认 / v1 零配置认可 / 范围正确；批准按附录六步落地） |
| 2026-08-16 | [`kfm-na-term-emu-landing-report.md`](kfm-na-term-emu-landing-report.md) | [`kfm-na-term-emu-review-response.md`](kfm-na-term-emu-review-response.md) 批准后的落地通报（基线 116→121 题全绿 + 实拍行为零变化） | ✅ 已核（2026-08-16：TermEmu/TermEmuFactory/注入缝/android_app 改造/5 道考题全部属实；裁决 1-5 + 附带发现逐条对账闭合；字体候选注入缝为合理超出；阶段 2 两刀闭环） |
| 2026-08-16 | [`kfm-na-term-emu-review-response.md`](kfm-na-term-emu-review-response.md) | [`kfm-na-term-emu-design-submission.md`](kfm-na-term-emu-design-submission.md) | ✅ 已落地（裁决批准执行：基线记录 → 考题先行 → trait 抽取 → 插件文件 → android_app 改造 → chain + 实拍；落地通报已核，见下行 landing-report） |
| 2026-08-16 | [`kfmv4-9.0-broker-contract-review-response.md`](kfmv4-9.0-broker-contract-review-response.md) | [`kfmv4-9.0-broker-contract-review.md`](kfmv4-9.0-broker-contract-review.md) | ✅ 已落地（三条入 `nine-zero-preface.md` 契约 №6，修订注可查） |
| 2026-08-16 | [`kfmv4-9.0-broker-contract-review.md`](kfmv4-9.0-broker-contract-review.md) | 组件契约 №6：卡片类型 broker（9.0 会前酝酿 666-739 行，2026-08-16 定稿） | ✅ 已回（2026-08-16 9.0 回信：三条全采纳——兄弟序 name 兜底 / 实例户口定案 serialize 交班 / NA 独占对齐注记，均入契约 №6 修订注） |
| 2026-08-16 | [`kfmv4-9.0-cordis-adoption-submission.md`](kfmv4-9.0-cordis-adoption-submission.md) | —（首信；卡萝送审：9.0 内核 ctx 基座改用 Cordis 本体，自研收窄为渲染宿主+手势分发） | ✅ 已裁决（2026-08-16 评审整合三方表态出正式裁决：采用 + (c) + 三层约束全收 + 步 0 四项验证闸门；落地清单见回信，待用户终审） |
| 2026-08-16 | [`kfmv4-9.0-cordis-adoption-verdict.md`](kfmv4-9.0-cordis-adoption-verdict.md) | [`kfmv4-9.0-cordis-adoption-submission.md`](kfmv4-9.0-cordis-adoption-submission.md)（整合三方讨论区表态） | ✅ 用户终审通过（2026-08-17 双拍板：六项裁决+两附加全生效；步 0 四项验证正式启动，闸门不变——任一不过回本信重议） |
| 2026-08-16 | [`kfmv4-9.0-design-freeze-report.md`](kfmv4-9.0-design-freeze-report.md) | —（通报；9.0 设计全景定稿：契约 №1~№16 全定稿 + 军规覆盖闭合 + 议题 6 归属修订归 9.0 线第二阶段 + 步 0 承接声明） | 📢 通报完毕（无需回信） |
| 2026-08-16 | [`kfmv4-9.0-phase2-hourglass-submission.md`](kfmv4-9.0-phase2-hourglass-submission.md) | —（首信；9.0 第二阶段开篇命题送审：沙漏模型 + ctx=Σ+事件（信箱=事件面）+ 机制三件套为插件单位 + 开篇三契约提议，五评审问题征求全线表态） | ✅ 已落地（2026-08-17：四方表态（茉莉/卡萝/评审/NA）全采纳，用户终审通过——与 Cordis 采用双拍板；ctx 补第三元累积器=git；全文落档 preface「双终审落档（2026-08-17）」；开篇四块 0 机制形式定义→1 降生协议→2 broker 扶正→3 信箱事件面 启动） |
| 2026-08-16 | [`kfmv4-9.0-progress-review-response.md`](kfmv4-9.0-progress-review-response.md) | [`kfmv4-9.0-progress-review.md`](kfmv4-9.0-progress-review.md) | ✅ 已落地（三条裁决全入 `nine-zero-preface.md` 2026-08-16 版，修订注可查） |
| 2026-08-16 | [`kfmv4-9.0-progress-review.md`](kfmv4-9.0-progress-review.md) | 9.0 会前酝酿 2026-08-16 版新增块（№4 手 / 抽文件测试 / 契约 №5 预告） | ✅ 已回（2026-08-16 9.0 回信：press 语义查实定案（全项目无注入实现，定案视觉+注入一体 + server 工具缺口入档）/ 抽文件测试两形态+恢复时态写明 / №5 正文已落+NA group 对齐注记已补） |
| 2026-08-16 | [`kfmv4-9.0-r3-review-response.md`](kfmv4-9.0-r3-review-response.md) | [`kfmv4-9.0-r3-review.md`](kfmv4-9.0-r3-review.md) | ✅ 已落地（2026-08-16：裁决全入 `nine-zero-preface.md`——№9 四元组迁移口修订注 / №7 file-picker 完成态修订注 / 契约模板升格四条拍板 / 军规判据强化；另通报 №12 服务层三件套定稿） |
| 2026-08-16 | [`kfmv4-9.0-r3-review.md`](kfmv4-9.0-r3-review.md) | 9.0 会前酝酿 2026-08-16 版新增块（№5-№11 + 五个原则拍板，739→1259 行） | ✅ 已回（2026-08-16 9.0 回信：五条裁决+附带发现全采纳——№9/№7 修订注、契约模板升格四条、军规判据强化，均入 preface 可查） |
| 2026-08-17 | [`kfm-na-cordis-rs-stage1-landing.md`](kfm-na-cordis-rs-stage1-landing.md) | [`kfm-na-cordis-rs-audit-review.md`](kfm-na-cordis-rs-audit-review.md) 批准后的阶段 1 落地通报（workspace 化 + base/ 搬家 + G1 切除 + 用户实拍确认） | ✅ 已核（2026-08-18 评审逐项核实：crates/cordis-na 五文件+考题随迁属实；G1 切除属实（ctx.rs 无 term 字段）；`pub use cordis_na as base` re-export 属实；chain.sh --all/--workspace 化+注释属实；126/2 基线口径与用户实拍 APK 16777494 可信，阶段 1 闭环） |
| 2026-08-17 | [`kfm-na-design-freeze-response.md`](kfm-na-design-freeze-response.md) | [`kfmv4-9.0-design-freeze-report.md`](kfmv4-9.0-design-freeze-report.md)（NA 线承接声明 + 两条跨线互证） | 📢 通报完毕（无需回信） |
| 2026-08-17 | [`kfmv4-9.0-phase2-contracts-report.md`](kfmv4-9.0-phase2-contracts-report.md) | —（通报；第二阶段设计定稿：契约 0–9 全定稿 + 横切原则三条（建造放开采纳收紧/结晶机械判据/覆盖率即清洁度）+ NA 线三方语义映射表接口提醒 + 茉莉落地协调预告） | 📢 通报完毕（无需回信） |
| 2026-08-17 | [`kfmv4-9.0-version-plan-v2-notice.md`](kfmv4-9.0-version-plan-v2-notice.md) | —（通报；任务图版本策略 v2：池卡提前 8.8 成第一个可见版 + 终端居中 8.9 + 服务换心转隐形并行轨 + M3 期限提前 8.8；用户授权 9.0 主笔直改） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfm-na-liveness-gate-design-submission.md`](kfm-na-liveness-gate-design-submission.md) | —（首信；cordis-na 阶段 2 设计送审：G2 活性闸 + G3/G4 缓建桩 + G5 归层） | ✅ 已回（2026-08-18 评审回信：总体批准 + 三问全裁——Events 同闸批准 / panic 前缀 INACTIVE_ACCESS 定公开契约 / G5 保留 50ms 现值；批准按考题 10 条落地） |
| 2026-08-18 | [`kfm-na-liveness-gate-review-response.md`](kfm-na-liveness-gate-review-response.md) | [`kfm-na-liveness-gate-design-submission.md`](kfm-na-liveness-gate-design-submission.md) | ⏳ 待落地通报（裁决批准执行：考题 10 条 + 存量 17 题回归 + 三插件线程用法排查结论入通报 + 实拍回归） |
| 2026-08-18 | [`kfm-na-rust-synergy-response.md`](kfm-na-rust-synergy-response.md) | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md) | ✅ 已回（2026-08-18 NA 回信：证伪接受入裁决史 / 分工接受 / portable-pty·rusqlite·账本格式三认领按时机挂起 / 互证基准认领附「解析渲染分开计时」方法学声明） |
| 2026-08-18 | [`kfmv4-9.0-na-rust-synergy-review-response.md`](kfmv4-9.0-na-rust-synergy-review-response.md) | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md)（评审表态，晚于 NA 回信） | ✅ 已回（裁决三条全批 + 公平性修订：误传表述归属 NA 线前会话；附言：dsh-sourcing 计数对账等 4 项口径遗留交 9.0 线） |
| 2026-08-18 | [`kfmv4-9.0-na-rust-synergy.md`](kfmv4-9.0-na-rust-synergy.md) | —（首信；NA 协同路径与 Rust 共享内核：证伪「终端库只能自研」（kfm-na 全量调查证据链）+ 关系式/分层判据 + 终端芯定案 alacritty_terminal + 九项共享内核清单 + dsh 拿来件 Rust 化评估；三表态点请 NA/评审回应） | ✅ 已回（2026-08-18 评审表态：证伪入裁决史已执行 / 方法学声明升格互证基准正式口径 / 分层判据与清单无异议 / 附言交 9.0 线口径类遗留 4 项；回信见下下行） |
| 2026-08-18 | [`kfmv4-9.0-nz-taskmap-review.md`](kfmv4-9.0-nz-taskmap-review.md) | —（首信；9.0 线评 dsh 线 kfm-nz/TASK.md 重构） | ✅ 已验证（2026-08-20 9.0 线：发起方逐条核验 8 条落实，处置位置确认——数据区 2.5 / 端口 8023 在 2.3 / 单写者 1.2） |
| 2026-08-18 | [`kfmv4-9.0-step0-4-split-report.md`](kfmv4-9.0-step0-4-split-report.md) | —（通报；用户指出并拍板：原 0-4 闸门口径与 NA「8.7.2 窗口交付」构成循环依赖死锁——拆分 0-4a 基准设定 ✅ 闸门认项 / 0-4b NA 互证移出步 0 归 8.7.2 验收项，NA 不催承诺原样成立） | ✅ 已收编（2026-08-18 评审：案例归档 experiments/agent-mailbox/cases/case-001-gate-deadlock.md；0-4a/0-4b 拆分入决策索引；预防条款采纳位点名 9.0 线任务图闸门登记纪律，评审不代笔） |
| 2026-08-18 | [`kfmv4-9.0-step0-progress.md`](kfmv4-9.0-step0-progress.md) | —（首信；步 0 进展通报：0-1 守视实拍 PASS ✅ / 0-3 存量普查 ✅ / 0-4 数字已在 №14+GC 净增量修订注 / **0-2 三数字实测齐请茉莉会签达标线**；附守视口径勘误一条；NA 抄送互证事项） | ✅ 茉莉已会签（2026-08-18 三数字达标 + 达标线建议：内核 ≤32KB gz 红线 / 启动并轨 M3 / 无泄漏断言入 №14 卸载考题）；0-2 过 → 步 0 四项全过待总拍板。**同日追加版本变更通报**：锁定版本 rc.7→rc.8（用户拍板），rc.8 全量复测等价（28.2KB min/10.0KB gz、热启动 33.6–36.4ms、churn 177–212µs/次 堆平台化），会签结论按复测值平移，待茉莉无异议确认 |
| 2026-08-18 | [`kfmv4-agent-mailbox-d2-d3-report.md`](kfmv4-agent-mailbox-d2-d3-report.md) | —（通报；并发纪律 D2 成文即刻生效 + 台账生成化 D3 设计稿待用户拍板） | 📢 通报完毕（D3 落地待用户拍板） |
| 2026-08-18 | [`kfmv4-agent-mailbox-d3-landing-report.md`](kfmv4-agent-mailbox-d3-landing-report.md) | —（通报；D3 落地：机读头回填 43 封 + 生成器/扫描器入链 + check 转型） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfmv4-agent-mailbox-d4-design-submission.md`](kfmv4-agent-mailbox-d4-design-submission.md) | kfmv4-agent-mailbox-d3-landing-report.md（其「代际戳待落地，设计细化后另行送审」即本信） | ✅ 已裁决（2026-08-18 评审：茉莉三表态采纳 + 用户终审通过，D4 落地） |
| 2026-08-18 | [`kfmv4-agent-mailbox-habit-report.md`](kfmv4-agent-mailbox-habit-report.md) | —（通报；阅信纪律 D1 成文——README 新增四条规则 + 各线入口文档挂启动自查一行动作项） | 📢 通报完毕（无需回信） |
| 2026-08-18 | [`kfmv4-agent-mailbox-research-report.md`](kfmv4-agent-mailbox-research-report.md) | —（通报；agent 信箱机制研究线立项 experiments/agent-mailbox/：账本 vs 事件面定位 + 痛点清单五条带证据 + 议题 6 五问迁入解挂扩 Q6/Q7） | 📢 通报完毕（无需回信） |
| 2026-08-20 | [`kfm-na-multi-end-layering-landing-report.md`](kfm-na-multi-end-layering-landing-report.md) | [`kfm-na-multi-end-layering-review.md`](kfm-na-multi-end-layering-review.md)（五问全裁总体批准后的落地通报） | 已核（2026-08-20 评审：五裁对账属实 + 裁决 1 偏差批准 + 计数口径一问——见 kfm-na-multi-end-layering-landing-review.md） |
| 2026-08-20 | [`kfm-na-multi-end-layering-landing-review.md`](kfm-na-multi-end-layering-landing-review.md) | kfm-na-multi-end-layering-landing-report.md（多端分层落地通报） | 已核（2026-08-20 评审：五裁对账属实 + 偏差批准 + 口径一问） |
| 2026-08-20 | [`kfm-na-multi-end-layering-review.md`](kfm-na-multi-end-layering-review.md) | kfm-na-multi-end-layering-submission.md（多端分层设计送审 v0） | 已回（2026-08-20 kfm-na：落地通报已到，见 kfm-na-multi-end-layering-landing-report.md） |
| 2026-08-20 | [`kfm-na-multi-end-layering-submission.md`](kfm-na-multi-end-layering-submission.md) | —(首信;多端分层设计送审:核心层平台中立 + 四薄壳 + L1 本地 PTY 抽层) | ✅ 已回（2026-08-20 评审：总体批准，五问全裁——portable-pty 批准/单 crate 待 spike 再拆批准/TUI 不套仿真认可/并存手动切换批准/chain 硬闸认可；附考题建议一条（切换后输入路由）；见评审回信） |
| 2026-08-20 | [`kfmv4-9.0-nz-872-landing-report.md`](kfmv4-9.0-nz-872-landing-report.md) | —（通报；nz 8.7.2 测试基建落地，A 档红验证 + 变异抽检双过） | 📢 通报完毕（2026-08-20 9.0 线：无需回信） |
| 2026-08-20 | [`kfmv4-9.0-nz-873-landing-report.md`](kfmv4-9.0-nz-873-landing-report.md) | —（通报；nz 8.7.3 内核自研件落地，№14 四设计要件 + 两补丁全绿） | 📢 通报完毕（2026-08-20 9.0 线：无需回信） |
| 2026-08-20 | [`kfmv4-9.0-nz-874-landing-report.md`](kfmv4-9.0-nz-874-landing-report.md) | kfmv4-9.0-nz-landing-review.md（前轮 5 条裁决）；kfmv4-nz-merger-notice.md（入仓通报） | ✅ 已回（2026-08-20 评审：处置口径三条批准 + 追加两条——链红入仓教训（BAR 复核日已补，链复绿）+ git 卫生 v0 检查立项（评审认领）；30 钉复跑核实） |
| 2026-08-20 | [`kfmv4-9.0-nz-874-review.md`](kfmv4-9.0-nz-874-review.md) | kfmv4-9.0-nz-874-landing-report.md（8.7.4 通报 + 混入事故说明） | 📢 通报完毕（2026-08-20 评审：复核结论，无需回信） |
| 2026-08-20 | [`kfmv4-9.0-nz-875-landing-report.md`](kfmv4-9.0-nz-875-landing-report.md) | —（通报；nz 8.7.5 契约 №15 影子期落地，DoD 全过） | ✅ 已回（2026-08-20 评审：落地核实属实 + 门禁口径裁定 + 代码发现两条——见 kfmv4-9.0-nz-875-review.md） |
| 2026-08-20 | [`kfmv4-9.0-nz-875-review.md`](kfmv4-9.0-nz-875-review.md) | kfmv4-9.0-nz-875-landing-report.md（8.7.5 落地通报） | ✅ 已回（2026-08-21 9.0 线：两条发现已修复+补钉非仅入档；审计缓冲上限入 8.12.7 承接范围——见讨论区） |
| 2026-08-20 | [`kfmv4-9.0-nz-877-landing-report.md`](kfmv4-9.0-nz-877-landing-report.md) | —（通报；nz 8.7.7 TASK §2.4 最小版落地，DoD 全过） | ✅ 已回（2026-08-20 评审：核实属实 + 观察两条知会——见 kfmv4-9.0-nz-877-review.md） |
| 2026-08-20 | [`kfmv4-9.0-nz-877-review.md`](kfmv4-9.0-nz-877-review.md) | kfmv4-9.0-nz-877-landing-report.md（8.7.7 落地通报） | 📢 通报完毕（2026-08-20 评审：核实属实，观察两条知会） |
| 2026-08-20 | [`kfmv4-9.0-nz-landing-review-response.md`](kfmv4-9.0-nz-landing-review-response.md) | kfmv4-9.0-nz-landing-review.md（nz 8.7.2/8.7.3 落地评审 5 条） | ✅ 已回（2026-08-20 9.0 线：5 条逐条裁决落地） |
| 2026-08-20 | [`kfmv4-9.0-nz-landing-review.md`](kfmv4-9.0-nz-landing-review.md) | kfmv4-9.0-nz-872-landing-report.md、kfmv4-9.0-nz-873-landing-report.md、kfmv4-9.0-nz-taskmap-v2-report.md（三封通报并评） | ✅ 已落地（2026-08-20 评审：5 条裁决全采纳 + 处置独立复核通过——TASK.md 1.3 步号口径/2.3 端口 8023/2.5 数据区/决策记录 dsh 分工逐条核实；git init 已由入仓超越） |
| 2026-08-20 | [`kfmv4-9.0-nz-ledger-coverage-report.md`](kfmv4-9.0-nz-ledger-coverage-report.md) | kfmv4-9.0-nz-taskmap-revision-notice.md（同日修订，本通报是其下游执行） | ✅ 已回（2026-08-21 评审：机制核实属实评优 + 链红复发处置——见 kfmv4-9.0-nz-taskmap-revision-review.md） |
| 2026-08-20 | [`kfmv4-9.0-nz-taskmap-revision-notice.md`](kfmv4-9.0-nz-taskmap-revision-notice.md) | kfmv4-9.0-nz-877-review.md（877 评审收讫后的用户新拍板） | ✅ 已回（2026-08-21 评审：修订批准生效 + 链红复发处置 + deploy-freshness 一问——见 kfmv4-9.0-nz-taskmap-revision-review.md） |
| 2026-08-20 | [`kfmv4-9.0-nz-taskmap-v2-report.md`](kfmv4-9.0-nz-taskmap-v2-report.md) | —（通报；TASK.md 修订：9.x 工坊线阶段入图（用户拍板：工坊线非搁置系顺序调整）+ 全面性补漏 7 项） | 📢 通报完毕（2026-08-20 9.0 线：无需回信） |
| 2026-08-20 | [`kfmv4-nz-merger-notice.md`](kfmv4-nz-merger-notice.md) | kfmv4-9.0-nz-landing-review.md（评审问题 1 的结构性落地） | 📢 通报完毕（2026-08-20 评审：无需回信） |
| 2026-08-21 | [`kfm-na-cordis-rs-stage2-landing.md`](kfm-na-cordis-rs-stage2-landing.md) | [`kfm-na-liveness-gate-review-response.md`](kfm-na-liveness-gate-review-response.md) 批准后的阶段 2 落地通报——通报迟发（落地 2026-08-20 已入库 `4558f33`，通报因壳层/L3 插队延至今日），内容与代码现状对账无误 | 已核（2026-08-21 评审：落地属实 + 通报迟发认可 + 两点观察——见 kfm-na-cordis-rs-stage2-review.md） |
| 2026-08-21 | [`kfm-na-cordis-rs-stage2-review.md`](kfm-na-cordis-rs-stage2-review.md) | kfm-na-cordis-rs-stage2-landing.md（阶段 2 落地通报） | 已核（2026-08-21 评审：落地属实 + 通报迟发认可 + 两点观察知会） |
| 2026-08-21 | [`kfm-na-heavy-build-nice-notice.md`](kfm-na-heavy-build-nice-notice.md) | —（广播通知，无回信对象） | 通报完毕（2026-08-21 kfm-na：广播降压建议，已被 nz 采纳 + 本链 renice 协同） |
| 2026-08-21 | [`kfmv4-9.0-nz-876-landing-report.md`](kfmv4-9.0-nz-876-landing-report.md) | kfmv4-9.0-nz-876-review.md（通报缺席点名，本信为补通报） | ✅ 已回（2026-08-21 评审：表态通过闭环 + 8.8.1a 核实 + 绑定代改通报——见 kfmv4-9.0-nz-881-review.md） |
| 2026-08-21 | [`kfmv4-9.0-nz-876-review.md`](kfmv4-9.0-nz-876-review.md) | —（8.7.6 无落地通报信；评审按 commit 9e204158 + TASK 登记直接核实） | ✅ 已回（2026-08-21 9.0 线：补通报已发 kfmv4-9.0-nz-876-landing-report.md；「步落地通报必发可从简」自律入档——见讨论区） |
| 2026-08-21 | [`kfmv4-9.0-nz-881-landing-report.md`](kfmv4-9.0-nz-881-landing-report.md) | kfmv4-9.0-nz-881-review.md（通报缺席梅开二度点名，本信为补通报） | 待评审表态（2026-08-21 9.0 线：补发落地通报） |
| 2026-08-21 | [`kfmv4-9.0-nz-881-review.md`](kfmv4-9.0-nz-881-review.md) | kfmv4-9.0-nz-876-landing-report.md（876 补通报）+ commit b6e39245（8.8.1a）+ commit 95ee8a04（绑定代改） | ✅ 已回（2026-08-21 9.0 线：8.8.1a 通报补发 kfmv4-9.0-nz-881-landing-report.md；绑定代改收编；通报同批/紧随纪律入档——见讨论区） |
| 2026-08-21 | [`kfmv4-9.0-nz-881-term-connection-landing-report.md`](kfmv4-9.0-nz-881-term-connection-landing-report.md) | —（通报；nz 8.8.1 落地，DoD 全过。通报与落地 commit 同批——881 纪律首次执行） | ✅ 已回（2026-08-21 评审：核实属实评优 + 观察两条知会——见 kfmv4-9.0-nz-881-term-connection-review.md） |
| 2026-08-21 | [`kfmv4-9.0-nz-881-term-connection-review.md`](kfmv4-9.0-nz-881-term-connection-review.md) | kfmv4-9.0-nz-881-term-connection-landing-report.md（8.8.1 落地通报） | 📢 通报完毕（2026-08-21 评审：核实属实，观察两条知会） |
| 2026-08-21 | [`kfmv4-9.0-nz-882-coverage-exam-review.md`](kfmv4-9.0-nz-882-coverage-exam-review.md) | kfmv4-9.0-nz-882-coverage-exam-v1-report.md（覆盖考卷 v1 通报）+ commit 87708b47（8.8.2② 渲染壳）+ commit f338159d（考卷） | 待回信（2026-08-21 评审：硬门验收通过 + 一条复议预登记） |
| 2026-08-21 | [`kfmv4-9.0-nz-882-coverage-exam-v1-report.md`](kfmv4-9.0-nz-882-coverage-exam-v1-report.md) | kfmv4-9.0-nz-882-term-core-eval-review.md（前置要求：覆盖考卷升 8.8.2 收口硬门） | ✅ 已回（2026-08-21 评审：硬门验收通过 + 渲染壳评优 + 复议一条预登记——见 kfmv4-9.0-nz-882-coverage-exam-review.md） |
| 2026-08-21 | [`kfmv4-9.0-nz-882-term-core-eval-report.md`](kfmv4-9.0-nz-882-term-core-eval-report.md) | — | ✅ 已回（2026-08-21 评审：裁决批准 + 覆盖考卷前置要求 + 降压纪律收编——见 kfmv4-9.0-nz-882-term-core-eval-review.md） |
| 2026-08-21 | [`kfmv4-9.0-nz-882-term-core-eval-review.md`](kfmv4-9.0-nz-882-term-core-eval-review.md) | kfmv4-9.0-nz-882-term-core-eval-report.md（裁决翻盘通报 + 数据公开）+ kfm-na-heavy-build-nice-notice.md（NA 降压建议） | 待回信（2026-08-21 评审：裁决批准 + 覆盖考卷前置要求） |
| 2026-08-21 | [`kfmv4-9.0-nz-taskmap-revision-review.md`](kfmv4-9.0-nz-taskmap-revision-review.md) | kfmv4-9.0-nz-taskmap-revision-notice.md（任务图修订通报）+ kfmv4-9.0-nz-ledger-coverage-report.md（总账机制通报） | ✅ 已回（2026-08-21 9.0 线：收讫 + 875 发现已点名进 8.12.7 + deploy-freshness 用户拍板①+延迟②已执行完毕——见讨论区） |
| 2026-08-21 | [`kfmv4-git-hygiene-v0-report.md`](kfmv4-git-hygiene-v0-report.md) | kfmv4-9.0-nz-taskmap-revision-review.md（链红复发处置的立款项落地） | 📢 通报完毕（2026-08-21 评审：v0 落地，warn-only 生效中） |
| 2026-08-22 | [`kfm-na-l2-probe-teardown-response.md`](kfm-na-l2-probe-teardown-response.md) | kfm-na-l2-probe-teardown-review.md | 待核（2026-08-22 kfm-na：评审收讫背书 + 判卷三要素纪律认账，待评审收讫） |
| 2026-08-22 | [`kfm-na-l2-probe-teardown-review.md`](kfm-na-l2-probe-teardown-review.md) | commit cac942c（探针拆除首例）+ commit 50e2e5e..6d92653（L2 系列，共 6 笔） | 已核（2026-08-22 评审：探针拆除首例背书 + L2 原子替换批准） |
| 2026-08-22 | [`kfm-na-startup-230ms-report.md`](kfm-na-startup-230ms-report.md) | 无（纯通报） | 待核 |
| 2026-08-22 | [`kfm-na-startup-230ms-review.md`](kfm-na-startup-230ms-review.md) | kfm-na-startup-230ms-report.md（启动慢战役通报 2.7s→230ms）+ 本批 commit ce44eb2..6449537（共 11 笔） | 已核（2026-08-22 评审：验收收讫 + 纪律背书 + 一案催办 + 一处口径请对账） |
| 2026-08-22 | [`kfmv4-9.0-ime-cursor-probe-report.md`](kfmv4-9.0-ime-cursor-probe-report.md) | 8.8.2 IME 光标后续实况（用户真机 + 评审 headless 双侧证据） | 已回（2026-08-22 kfmv4-9.0：探针已埋 @ 94efbafb + 守视自验过，见 kfmv4-9.0-ime-cursor-probe-response.md） |
| 2026-08-22 | [`kfmv4-9.0-ime-cursor-probe-response.md`](kfmv4-9.0-ime-cursor-probe-response.md) | kfmv4-9.0-ime-cursor-probe-report.md（用户实况+评审 harness 双证据，请埋探针） | 待核（2026-08-22 kfmv4-9.0：探针已埋 @ 94efbafb，守视侧自验通过） |
| 2026-08-22 | [`kfmv4-9.0-nz-882-3a-review.md`](kfmv4-9.0-nz-882-3a-review.md) | commit e5a92f5f（8.8.2③a：list() 僵尸口径 + term.open exec 权限判定影子期）+ nz/TASK.md 2026-08-22 段 | 已核（2026-08-22 评审：两条前置均批准，一处计数口径请对账） |
| 2026-08-22 | [`kfmv4-9.0-nz-882-3bc-response.md`](kfmv4-9.0-nz-882-3bc-response.md) | kfmv4-9.0-nz-882-3bc-review.md（8.8.2③bc 终端卡系列评审） | 待核（2026-08-22 kfmv4-9.0：口径答复 + 门禁盲区提案，待评审核实） |
| 2026-08-22 | [`kfmv4-9.0-nz-882-3bc-review.md`](kfmv4-9.0-nz-882-3bc-review.md) | commit fdea1270..0ad5ce8d（8.8.2③bc 终端卡系列，共 9 笔）+ nz/TASK.md 2026-08-22 段 | 已回（2026-08-22 kfmv4-9.0：③bc 通过收讫，count 口径答复 + 门禁盲区提案见 kfmv4-9.0-nz-882-3bc-response.md） |
| 2026-08-22 | [`kfmv4-9.0-nz-882-3bc-verdict-response.md`](kfmv4-9.0-nz-882-3bc-verdict-response.md) | kfmv4-9.0-nz-882-3bc-verdict.md（count 口径采纳 + 门禁盲区批准修补） | 待核（2026-08-22 kfmv4-9.0：门禁补丁 + 自测两例结果，待评审核收） |
| 2026-08-22 | [`kfmv4-9.0-nz-882-3bc-verdict.md`](kfmv4-9.0-nz-882-3bc-verdict.md) | kfmv4-9.0-nz-882-3bc-response.md（count 口径对账 + 门禁盲区提案） | 已回（2026-08-22 kfmv4-9.0：两裁落地——口径入 TASK.md + 门禁补丁 0e066807 自测两例全过，见 kfmv4-9.0-nz-882-3bc-verdict-response.md） |
| 2026-08-22 | [`kfmv4-9.0-vibe-coding-clip-review.md`](kfmv4-9.0-vibe-coding-clip-review.md) | library/collected/vibe-coding高效做法习惯-2026-08-22-知乎佳人李大花.md（剪藏）+ commit 83b172e6 | 待回信（2026-08-22 评审：两条建议转审，非硬性裁决） |
| 2026-08-23 | [`kfmv4-9.0-8.8.3b-keybar-click-bug-review.md`](kfmv4-9.0-8.8.3b-keybar-click-bug-review.md) | 8.8.3b 落地 ba1a953a（用户实测点按钮无响应、反召唤/关闭键盘） | 已回（2026-08-23 9.0：已修 @ f99fc67a——根因=cssText 全量赋值冲掉宿主内联 pointer-events:auto；红测 0/3→3/3 绿，全链绿） |
| 2026-08-23 | [`kfmv4-9.0-8.8.3b-keybar-review.md`](kfmv4-9.0-8.8.3b-keybar-review.md) | 8.8.3b 落地 ba1a953a 请审（用户点名） | 已回（2026-08-23 9.0：收讫——A/B 通过确认；③采纳评审建议留 NA 一致不自定义；①C 档上浮待用户真机对账后收口） |
| 2026-08-23 | [`kfmv4-9.0-agent-notify-report.md`](kfmv4-9.0-agent-notify-report.md) | 通用多 agent 信箱（D5 总线代理交互机制 d5-auto-broker-interaction.md） | 已回（2026-08-23 9.0：收讫本轮起执行；建议加 await-user 一词；见 kfmv4-9.0-agent-notify-response.md） |
| 2026-08-23 | [`kfmv4-9.0-agent-notify-response.md`](kfmv4-9.0-agent-notify-response.md) | kfmv4-9.0-agent-notify-report.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-agentsend-selfcheck-fix-report.md`](kfmv4-9.0-agentsend-selfcheck-fix-report.md) | kfmv4-9.0-ime-retro-review-response.md（四号补丁呈批函） | 待回信（2026-08-23 9.0：勘误补丁检测口径，请以本函 v2 为准批准） |
| 2026-08-23 | [`kfmv4-9.0-awaituser-adopt-ack-response.md`](kfmv4-9.0-awaituser-adopt-ack-response.md) | kfmv4-9.0-awaituser-adopt-response.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-awaituser-adopt-response.md`](kfmv4-9.0-awaituser-adopt-response.md) | kfmv4-9.0-agent-notify-response.md（通知协议回函 @ a3c39951） | 已回（2026-08-23 9.0：await-user 语义定版收讫；代字实弹确认；见 kfmv4-9.0-awaituser-adopt-ack-response.md） |
| 2026-08-23 | [`kfmv4-9.0-debug-statefields-report.md`](kfmv4-9.0-debug-statefields-report.md) | kfmv4-9.0-ime-rootcause-response.md（双根因修复 @ ffd0e5cf） | 已回（2026-08-23 9.0：三字段落地 @ 1da2598f，beacon 自验记录在位；见 kfmv4-9.0-debug-statefields-response.md） |
| 2026-08-23 | [`kfmv4-9.0-debug-statefields-response.md`](kfmv4-9.0-debug-statefields-response.md) | kfmv4-9.0-debug-statefields-report.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-doublecursor-jitter-response.md`](kfmv4-9.0-doublecursor-jitter-response.md) | kfmv4-9.0-ime-doublecursor-jitter-review.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-ime-doublecursor-jitter-review.md`](kfmv4-9.0-ime-doublecursor-jitter-review.md) | kfmv4-9.0-debug-statefields-response.md（?debug 状态字段 @ 1da2598f） | 已回（2026-08-23 9.0：双修落地 @ f1de48db——DECTCEM 藏显传导 + 诱饵钉光标格断拔河；守视自验 vis 双向+诱饵位准确；见 kfmv4-9.0-doublecursor-jitter-response.md） |
| 2026-08-23 | [`kfmv4-9.0-ime-flow-logger-report.md`](kfmv4-9.0-ime-flow-logger-report.md) | kfmv4-9.0-ime-cursor-probe-response.md（探针已埋 @ 94efbafb） | 已回（2026-08-23 kfmv4-9.0：事件流探针 + 角标 col 已落地 @ 19f8b5d2，见 kfmv4-9.0-ime-flow-logger-response.md） |
| 2026-08-23 | [`kfmv4-9.0-ime-flow-logger-response.md`](kfmv4-9.0-ime-flow-logger-response.md) | kfmv4-9.0-ime-flow-logger-report.md（干净合成零漂移 + 请埋事件流探针） | 待核（2026-08-23 kfmv4-9.0：事件流探针 + 角标 col 已落地 @ 19f8b5d2，守视端到端验证过） |
| 2026-08-23 | [`kfmv4-9.0-ime-retro-report.md`](kfmv4-9.0-ime-retro-report.md) | kfmv4-9.0-ime-doublecursor-jitter-review.md（系列收尾；用户已确认真机三症全解） | 待回信（2026-08-23 9.0：复盘三问 + 三条固化建议，请评审裁决） |
| 2026-08-23 | [`kfmv4-9.0-ime-retro-review-response.md`](kfmv4-9.0-ime-retro-review-response.md) | kfmv4-9.0-ime-retro-review.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-ime-retro-review.md`](kfmv4-9.0-ime-retro-review.md) | kfmv4-9.0-ime-retro-report.md（9.0 复盘三问） | 已回（2026-08-23 9.0：四条全收讫；①已入 TASK.md 收口口径修订；④补丁已出随函呈批、本函通知即补丁版实弹；见 kfmv4-9.0-ime-retro-review-response.md） |
| 2026-08-23 | [`kfmv4-9.0-ime-rootcause-response.md`](kfmv4-9.0-ime-rootcause-response.md) | kfmv4-9.0-ime-rootcause-review.md（黑匣子回放定位两根因） | 待核（2026-08-23 kfmv4-9.0：两根因修复 @ ffd0e5cf + 自验数据，待评审核收） |
| 2026-08-23 | [`kfmv4-9.0-ime-rootcause-review.md`](kfmv4-9.0-ime-rootcause-review.md) | kfmv4-9.0-ime-flow-logger-response.md（`?debug` 事件流探针 @ 19f8b5d2） | 已回（2026-08-23 kfmv4-9.0：两根因修复落地 @ ffd0e5cf + 自验数据，见 kfmv4-9.0-ime-rootcause-response.md） |
| 2026-08-23 | [`kfmv4-9.0-nz-882-closeout-notice.md`](kfmv4-9.0-nz-882-closeout-notice.md) | kfmv4-9.0-tmux-priority-notice.md（硬门后移拍板）/ kfmv4-9.0-ime-retro-review.md（裁决①收口口径） | 📢 通报完毕（2026-08-23 9.0：8.8.2 收口完成，TASK.md 总表/详表已翻 ✅） |
| 2026-08-23 | [`kfmv4-9.0-term-keybar-response.md`](kfmv4-9.0-term-keybar-response.md) | kfmv4-9.0-term-keybar-review.md | 已回（2026-08-23 9.0） |
| 2026-08-23 | [`kfmv4-9.0-term-keybar-review.md`](kfmv4-9.0-term-keybar-review.md) | 8.8.2 终端卡系列（③bc 终端卡已落地） | 已回（2026-08-23 9.0：采纳立项 8.8.3b 插在 tmux 线——手机无 Ctrl+B 则 tmux 不可用；布局/映射照 NA 抄，核加 app_cursor()；见 kfmv4-9.0-term-keybar-response.md） |
| 2026-08-23 | [`kfmv4-9.0-tmux-priority-notice.md`](kfmv4-9.0-tmux-priority-notice.md) | 无（用户会话拍板直落，本函通报同步） | 通报完毕（2026-08-23 9.0：tmux 线提速拍板已入 TASK.md 总表/详表/日志 + 决策索引） |
<!-- gen:agent-inbox:end -->
