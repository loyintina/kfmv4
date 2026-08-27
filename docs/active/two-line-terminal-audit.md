# 两线终端横向审计 — na termview ⇄ nz 9.0 终端（2026-08-27 · 评审 · **已定稿**）

> 这是什么：跨线横向审计第一单。na（Rust 原生安卓）与 nz/9.0（TS WebView）
> 是同一套终端语义的两个实现物种，分家后各自长。本审计逐层对表，区分
> 「一致 / 有意分歧 / 无意漂移」三类，产出抄作业清单与趋同路线建议。
> 证据源：两线考卷 + 已结案案卷 + 源码注释契约（2026-08-27 快照）。
> 状态: **定稿**——双线核对回函（kfmv4-audit-term-parity-{na,nz}-response.md）
> 已收编：na 两处失实纠正+一处口径微修+scrollback 实锤 10000；漂移三案终裁见「四、漂移终裁」。

## 一、语义对照矩阵

### A. 输入与按键

| 语义项 | na | nz (9.0) | 判 |
|---|---|---|---|
| keymap 映射纯逻辑 | `keymap.rs` map_text/key_seq，keymap_spec 考卷 | `nz/src/client/term/keymap.ts` 语义逐行移植自 NA keymap.rs | **一致**（nz 显式声明移植源）✅ 已趋同 |
| APP_CURSOR (?1h) 方向键 SS3 vs CSI | 有（key_seq 分模式） | 有（核 app_cursor() 钉 ?1h/?1l 两向） | **一致** ✅ |
| 修饰键一次性粘滞 | Java 侧粘滞（四纪律①） | keybar ModifierState 同款粘滞 | **一致** ✅ |
| 触摸注入 | na-touch.sh 协议 tap/down/move/up/scroll/sleep | `__kfmNzTermInject` 钩子（走输入管线） | **有意分歧**：na 是闸门文件协议（可写脚本序列），nz 是页面钩子（CDP 可代调）。等价但形态不同 |
| 跟底判定 | alacritty display_offset==0 即在底 | atBottom 状态机：新输出仅 true 才跟底、输入即回底、IME 合成中不回底 | **有意分歧**（平台差异）：nz 要处理浏览器滚动容器+IME 时序；na 无此概念。行为上「用户上滑不拽回」两端一致 ✅ |

### B. 滚动与历史

| 语义项 | na | nz | 判 |
|---|---|---|---|
| scrollback 容量 | alacritty 默认回退区 | 核 1000 行封顶（B 档实测恒 1000） | **无意漂移**⚠️：容量值未对表（na 依赖 alacritty 默认 10k 行）。建议显式定同一数字或写明各自理由 |
| 滚动方向契约 | scroll.rs：Delta 正=看历史（手指下拖） | DOM scrollTop 语义+跟底状态机 | **一致**（方向手感同）✅ |
| 慢拖余数挂账 | 有（0.5 行×3=1 行+余数续挂，考题钉死） | 无此问题（浏览器原生像素滚动） | 平台差免比 |
| 滚轮 SGR 1006 上报 | 有（wheel up=64/down=65，BAR-016+scroll_spec 考题） | **实现缺失**（nz 回函实锤：全树 grep 零命中，无解析无编码无 DOM→PTY 通路） | **缺口定性**：功能从未实现。影响收窄为 TUI 内点击定位（触摸滚动由容器接管）。修复排期待用户拍板（nz 建议 tmux 线之后） |

### C. 字体与 CJK

| 语义项 | na | nz | 判 |
|---|---|---|---|
| 主字体栈 | **编译期内嵌零探测**（FactoryFonts::Vendored，BAR-021 销案方式=「不探了」；开源像素主字+商用字覆盖缝 assets/fonts/local/main.ttf；FONT_CANDIDATES 探针序仅存考题夹具）【na 回函纠正①】 | TERM_FONT_STACK + NFM 内嵌（就绪门 fonts.load） | **有意分歧**（内嵌 vs 就绪门），行为等效目标：等宽可渲染 |
| CJK 备用字体 | prefer_cjk()：主字缺字形才换备用（glyph 存在性为准） | 双字体栈同源 NA（NaMain/NaCJK.ttf 直接复用 na 的商用字） | **一致** ✅（nz 连字体文件都直接用 na 的） |
| CJK 墨迹顶对齐 | 未见专项处理（原生 canvas 无 baseline 补偿需求?） | cjkDrop 补偿 clamp 0-3px（canvas 量 asc 差）+ cjk-inktop 考卷 | **有意分歧**：web 渲染特有病。na 无需等价物 ✅ 合理 |
| 宽字符占格 | alacritty 网格自带双宽语义 | shell.ts 字格单源 measureCell | 行为一致性**未对表**⚠️：「中文恒 2cell」两端都有契约，但混排宽度计算（如表格对齐）无互验考题 |
| powerline/U+E0B0 | spec_bar028/032 考题 | palette 对齐 NA ANSI_16 + NFM 含 powerline（headless 截图人审） | **一致** ✅ |

### D. 配色

| 语义项 | na | nz | 判 |
|---|---|---|---|
| ANSI 16 色 | ANSI_16 表（蓝系换品牌蓝因 VGA 黑底不可读，2026-08-23 实拍） | palette.ts 16 色逐值对齐 NA ANSI_16（对照 termview.rs 源码核实） | **一致** ✅ 已趋同（nz 显式抄 na，含蓝系例外理由） |

### E. resize 与重排

| 语义项 | na | nz | 判 |
|---|---|---|---|
| resize 重排折行 | BAR-040 契约：横幅必须首个真实 resize 后印；alacritty reflow 自带 | vv 钉卡身 + scheduleResize 行列同缩 + RO 直盯 + checkDrift 帧级/空闲巡查自愈 | **有意分歧**：nz 多了一整层「视口几何不可信」防御（vv 虚报/晚到/事件丢失是 WebView 特有病）。na 无此层**也不需要**——几何由系统可靠给 |
| 几何突变自愈 | 无（系统几何可信） | checkDrift 两级兜底 | nz 侧 Web 特有资产 |

### F. 会话与生命周期

| 语义项 | na | nz | 判 |
|---|---|---|---|
| 登录 shell 解析 | **na 无对应物**【na 回函纠正②】：shell 选择=本地静态决策（Android=/system/bin/sh，L3 有 prefix 换 bash，非 login 语义不读 .profile） | resolveLoginShell() 走 /etc/passwd uid 解析（web 侧服务端 shell 选择） | **平台形态差**（非一致）：na 交互非登录读 .bashrc；无实案出错，登记观察不立项 |
| 修饰键粘滞载体 | Rust keybar.rs ModifierState（Java 仅 JNI 翻位/清零）【na 回函口径微修】 | keybar ModifierState 同构 | **一致** ✅（na keymap.rs:4 注释旧话漂移已登记自清） |
| 会话死亡观测 | session_deaths 计数 + conn 段毫秒戳 | ws-bridge 考卷 + 断线重连 | 形态不同，能力等效 |

## 二、抄作业清单（按价值排序）

1. **飞行记录仪 → 该抄给 nz**（价值最高）：na 的 flight-rec（环形事件流+host 回放+末屏 diff）让 ranger 类瞬态病「一次抓取永久复盘」。nz 的 ranger runaway 案抓了三轮才中、?debug 字段加了拆拆了加——根因就是没有这个。nz 版形态建议：壳侧环形缓冲最近 N 帧 renderFrame 参数+vv 快照，CDP 可 dump。
2. **趋势采样法 → 该抄给 nz**：na §六「连拍求差速率+斜率结案」判据可直接套用到 nz 的性能类问题（渲染耗、内存增长）。device-verify.mjs 里值得加一个 --trend 模式。
3. **stats 字段咬合闸 → 该抄给 nz**：na chain 第 3 步机械拦截 stats 结构改动忘同步测试的失配。nz 的 ?debug 字段同样有「加了拆、拆了加、消费端不知道」的历史。
4. **同入口原则 → 核销**：nz 回函实锤 `__kfmNzTermInject` 与 IME 落字**已同入口**（compositionend 路径 index.ts:446-455 = takeMods → inputToBottom → bridge.input 与钩子逐行同路）；IME 拼音残影是浏览器-IME 私有层，注入语义=已上屏文本，无可注入中间态。**评审核销此条**。
5. **逃逸条款六栏案卷 → 双向已有**：nz 信箱流程有对应的 review-response 制度，不缺。
6. **飞行记录仪补一条（na 回函提醒）**：na 版价值一半在环形事件流，另一半在 **host 确定性回放+末屏 diff 判卷**（na-replay.sh）——nz 抄时必须连「判」一起抄，只抄环形缓冲=只抄到「存」。

## 三、na 侧候选作业（从 nz 抄）

1. **零依赖像素测试**：nz browser 考卷（bottom-anchor 5 题/headless mock vv 扰动）证明纯 TS 可以造几何假象考几何真伪。na 侧 select_spec 的选区窗口逻辑复杂度高，可以借鉴「mock 几何扰动法」补变异考题。
2. **ADR 式的状态翻转留痕**：nz 信箱制度里 response 必须翻原信状态头，双向咬合机检。na 目前 state.md 单向记录，「谁承诺了什么、闭了没闭」要靠读全文。（注：na 若引入信箱镜像则自动获得，见第五节）

## 四、漂移终裁（双线表态收编 + 评审裁决）

| # | 漂移 | 双线表态 | **终裁** |
|---|---|---|---|
| 1 | scrollback 容量 | na 实锤 **=10000**（alacritty 0.25.0 Default 纯继承，na 从未决策）；nz **=1000** 三处散写字面量（无常量无理由无压帽考题）。na 主张保持 1 万（编译/长日志场景 1000 是截肢；惰性分配内存可控），nz 主张保持 1000（DOM 节点内存/重排线性涨是平台成本本征） | **各钉各的 + 显式化 + 注明理由**（na 回函方案采纳）：na 落 `SCROLLBACK_LINES=10000` 常量+容量考题；nz 落 `SCROLLBACK_LINES=1000` 三处单源+理由注+压帽考题（nz 已承诺同款 na@6ae00c8 三件套）。跨线体验差登记为**有意分歧**（成本结构本征），不许再有人继承默认而不自知。统一与否无需用户拍板——双方理由都成立，这题没有「统一」的正确答案 |
| 2 | 鼠标报告 SGR 1006 | nz 实锤**实现缺失**（非考卷缺失）：全树 grep 零命中；影响面收窄为 TUI 内点击定位；na 侧有实现有考题（BAR-016） | **nz 功能缺口，登记 TASK 挂单**，排期交用户拍板（nz 自评：手机触屏主场景下价值密度低于 tmux 线，建议挂 tmux 之后；若未来接桌面浏览器场景权重上调——评审认可此排序逻辑） |
| 3 | 蓝系例外知识载体 | 双线均支持收编共同契约；na 表态「色表冻结后 na 改色走双向评审制」 | **term-contract.md 立项获双线授权**，冻结名单定稿：ANSI_16 色表（含蓝系例外理由）、keymap 映射规则、APP_CURSOR 语义、宽字符 2cell 契约、CJK 备字策略（登录 shell 行经纠正后**移出**冻结名单——两线形态不同非同一语义）。文档待立，交用户拍板后两线各落考题 |

## 五、抄作业清单表态汇总（双线回函收编）

**na → nz**：飞行记录仪（nz 接受，进 TASK 评估；na 提醒连回放判卷一起抄）/ 趋势采样 --trend（nz 接受，夹缝落）/ stats 咬合闸（nz 接受）/ IME 注入通道（nz 实证已同入口，**核销**）。
**nz → na**：mock 几何扰动法（na 接受，select 域插件化后第一批，不插队）/ ADR 状态翻转（na 部分已有——通信本走 kfmv4 信箱台账，state.md 维持单向速读定位，**不再另立**，评审认可）。

## 六、趋同路线建议（定稿）

分层处理，不要一刀切：

- **冻结为共同契约**（拟新建 term-contract.md——文件待立交用户拍板，两线引用，改动需双向评审+两线各落考题）：ANSI_16 色表（含蓝系例外）、keymap 映射规则、APP_CURSOR 语义、宽字符 2cell 契约、CJK 备字策略。
- **允许各奔东西**（平台本征差异，不强求一致）：视口防御层（nz 特有）、墨迹补偿（nz 特有）、触摸注入形态（协议 vs 钩子）、字体装载机制（内嵌 vs 就绪门）、scrollback 容量值（各钉各的）、shell 选择（静态 vs 解析）。
- **登记待办**：抄作业清单表态汇总见第五节，两线 TASK 各自挂单排期。

## 附：证据索引

- na 考卷：tests/{termview,scroll,select,keymap,touch,keybar,term_emu}_spec.rs
- nz 考卷：nz/tests/browser/{bottom-anchor,cjk-inktop,keybar-click,scrollback,term-hooks}、keymap.test.ts、cdp-relay.test.ts；npm 90 绿基线
- 关键案卷：BAR-040（resize 契约）、ranger runaway 三连（nz 无 flight-rec 的代价）、8.8.3b 五轮上浮案（vv 不可信）
