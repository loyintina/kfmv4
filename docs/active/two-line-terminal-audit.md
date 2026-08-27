# 两线终端横向审计 — na termview ⇄ nz 9.0 终端（2026-08-27 · 评审）

> 这是什么：跨线横向审计第一单。na（Rust 原生安卓）与 nz/9.0（TS WebView）
> 是同一套终端语义的两个实现物种，分家后各自长。本审计逐层对表，区分
> 「一致 / 有意分歧 / 无意漂移」三类，产出抄作业清单与趋同路线建议。
> 证据源：两线考卷 + 已结案案卷 + 源码注释契约（2026-08-27 快照）。
> 状态: 初稿——已发征集信（kfmv4-audit-term-parity-review.md）待双线核对。

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
| 滚轮 SGR 1006 上报 | 有（wheel up=64/down=65） | 待查——mouse report 未见于考卷 ⚠️ | **疑似 nz 缺口**：TUI 应用（htop/ranger）内滚轮上报未见考题。补证后归类 |

### C. 字体与 CJK

| 语义项 | na | nz | 判 |
|---|---|---|---|
| 主字体栈 | FONT_CANDIDATES 探针序（DroidSansMono 提首/体积闸） | TERM_FONT_STACK + NFM 内嵌（就绪门 fonts.load） | **有意分歧**（原生探文件 vs web 就绪门），行为等效目标：等宽可渲染 |
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
| 登录 shell 解析 | PTY -l 走 /etc/passwd（uid 解析） | resolveLoginShell() 同逻辑 | **一致** ✅ |
| 会话死亡观测 | session_deaths 计数 + conn 段毫秒戳 | ws-bridge 考卷 + 断线重连 | 形态不同，能力等效 |

## 二、抄作业清单（按价值排序）

1. **飞行记录仪 → 该抄给 nz**（价值最高）：na 的 flight-rec（环形事件流+host 回放+末屏 diff）让 ranger 类瞬态病「一次抓取永久复盘」。nz 的 ranger runaway 案抓了三轮才中、?debug 字段加了拆拆了加——根因就是没有这个。nz 版形态建议：壳侧环形缓冲最近 N 帧 renderFrame 参数+vv 快照，CDP 可 dump。
2. **趋势采样法 → 该抄给 nz**：na §六「连拍求差速率+斜率结案」判据可直接套用到 nz 的性能类问题（渲染耗、内存增长）。device-verify.mjs 里值得加一个 --trend 模式。
3. **stats 字段咬合闸 → 该抄给 nz**：na chain 第 3 步机械拦截 stats 结构改动忘同步测试的失配。nz 的 ?debug 字段同样有「加了拆、拆了加、消费端不知道」的历史。
4. **同入口原则 → 该抄给 nz**（半条）：na touch-in 强调「注入与真手指同一 handle_touch 入口」。nz 的 `__kfmNzTermInject` 走输入管线已达意，但 IME 合成路径（compositionend）是否有注入等价通道未明——真机 IME 病是 nz 重灾区，值得补一钩子。
5. **逃逸条款六栏案卷 → 双向已有**：nz 信箱流程有对应的 review-response 制度，不缺。

## 三、na 侧候选作业（从 nz 抄）

1. **零依赖像素测试**：nz browser 考卷（bottom-anchor 5 题/headless mock vv 扰动）证明纯 TS 可以造几何假象考几何真伪。na 侧 select_spec 的选区窗口逻辑复杂度高，可以借鉴「mock 几何扰动法」补变异考题。
2. **ADR 式的状态翻转留痕**：nz 信箱制度里 response 必须翻原信状态头，双向咬合机检。na 目前 state.md 单向记录，「谁承诺了什么、闭了没闭」要靠读全文。（注：na 若引入信箱镜像则自动获得，见第五节）

## 四、无意漂移清单（本轮唯一实锤）

| # | 漂移 | 风险 | 建议 |
|---|---|---|---|
| 1 | scrollback 容量未对表（na≈alacritty 默认 10k / nz 硬顶 1000） | 用户跨线体验不一致；千行长输出两端翻史深度不同 | 用户拍板统一值（建议都显式化，数量级对齐） |
| 2 | 鼠标报告（SGR 1006 等）nz 侧未见考卷（待 nz 确认是实现缺失还是考卷缺失） | TUI 应用鼠标交互 nz 可能静默不可用 | 征集信问询后归类 |
| 3 | na 的 ANSI_16 蓝系例外理由已随 palette.ts 移植到 nz——但该「为何不是 VGA 蓝」的知识只活在 na 注释里 | 未来任一方单独改色会打破两端一致且不知为何 | 第五节的共同契约文档收编 |

## 五、趋同路线建议

分层处理，不要一刀切：

- **冻结为共同契约**（拟新建 `docs/domains/` 下的 term-contract.md——文件待立，两线引用，改动需双向评审+两线各落考题）：ANSI_16 色表（含蓝系例外）、keymap 映射规则、APP_CURSOR 语义、宽字符 2cell 契约、登录 shell 解析、CJK 备字策略。
- **允许各奔东西**（平台本征差异，不强求一致）：视口防御层（nz 特有）、墨迹补偿（nz 特有）、触摸注入形态（协议 vs 钩子）、字体装载机制。
- **登记待办**：本次抄作业清单交两线 TASK 各自评估排期。

## 附：证据索引

- na 考卷：tests/{termview,scroll,select,keymap,touch,keybar,term_emu}_spec.rs
- nz 考卷：nz/tests/browser/{bottom-anchor,cjk-inktop,keybar-click,scrollback,term-hooks}、keymap.test.ts、cdp-relay.test.ts；npm 90 绿基线
- 关键案卷：BAR-040（resize 契约）、ranger runaway 三连（nz 无 flight-rec 的代价）、8.8.3b 五轮上浮案（vv 不可信）
