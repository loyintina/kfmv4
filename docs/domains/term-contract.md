# term-contract.md — 两线终端共同契约（2026-08-27 立项 · 用户拍板）

> 这是什么：na（Rust 原生）与 nz/9.0（TS WebView）共用的终端行为契约。
> 本表冻结的语义项，任一线改动须经**双向评审**（改方发信、对方表态、评审核）
> 并在两线**各落考题**。出处：横向审计第一单
> （docs/active/two-line-terminal-audit.md，双线核对定稿）。
> 维护方：kfm-na + kfmv4-9.0 双维护；评审仲裁。

## 冻结契约清单

### C1. ANSI_16 色表（含蓝系例外）

| # | 色 | 值 (RGB) | 注 |
|---|---|---|---|
| 0 | 黑 | 000000 | |
| 1 | 红 | AA0000 | |
| 2 | 绿 | 00AA00 | |
| 3 | 黄 | AA5500 | VGA 棕 |
| 4 | 蓝 | **3B82F6** | **例外项**：原 VGA #0000AA 纯黑底不可读（2026-08-23 用户实拍 ssh ls 目录名/标题看不清），换 kfmv4 品牌正蓝——两线各自实现此值时**必须**连带本理由 |
| 5 | 品红 | AA00AA | |
| 6 | 青 | 00AAAA | |
| 7 | 白 | AAAAAA | |
| 8 | 亮黑 | 555555 | |
| 9 | 亮红 | FF5555 | |
| 10 | 亮绿 | 55FF55 | |
| 11 | 亮黄 | FFFF55 | |
| 12 | 亮蓝 | **60A5FA** | 例外项亮档（原 #5555FF 同病） |
| 13 | 亮品红 | FF55FF | |
| 14 | 亮青 | 55FFFF | |
| 15 | 亮白 | FFFFFF | |

- na 实现：`ANSI_16`（termview.rs，XRGB 高字节空）
- nz 实现：`palette.ts`（逐值对齐，已对照 termview.rs 核实）

### C2. keymap 映射规则

- **map_text**：修饰键（Ctrl/Alt/Shift，一次性粘滞）× commitText 文本的组合变换——Ctrl+ASCII→控制字节；Alt+X=ESC x；多字符不转
- **key_seq**：Android 键码→终端字节序列；方向键/Home/End 按 APP_CURSOR 模式位分流（?1h → SS3 `ESC O A`；否则 CSI `ESC [ A`）
- na 实现：`keymap.rs`（keymap_spec 考卷）；nz 实现：`keymap.ts`（语义移植自 na，keymap.test.ts）

### C3. APP_CURSOR 语义

对端发 `?1h` 进应用光标模式，方向键/Home/End 发 SS3；`?1l` 退回 CSI。
na：key_seq 分模式；nz：核 `app_cursor()` 钉 ?1h/?1l 两向（cargo 考题）。

### C4. 宽字符占格

CJK 表意字符恒占 2 cell（含行内混排宽度计算）；powerline/符号区（U+E0B0 等）
占 1 cell。na：alacritty 网格双宽语义；nz：字格单源 measureCell + 双宽
span。互验考题（审计 C 表遗留）：**判据=同串→光标推进列数**，契约串表——
`A中A`→+4 / `中中`→+4 / `U+E0B0`→+1 / `中文A`→+5。nz 卷已落
（cjk-width-c4.test.mjs，核层直喂判卷；教训：经 PTY 测宽度会混入
zsh ZLE 转义回显，必须直喂核）。

**对拍样例表（2026-08-28 双线对拍通过，C4 契约机械载体）**：

| 输入串 | 占格（双线一致） | 拆账 |
|---|---|---|
| `中文AB` | **6** | 汉×2 + 文×2 + A×1 + B×1 |
|  English | **7** | 全 ASCII ×1 |
| `あいui` | **6** | 平假名 WideChar 2+2+1+1 |
| `中A中B` | **6** | 2+1+2+1 |
| `┌─┐` | **3** | 制表符 U+2500 区单宽（BAR-028 家族边界） |

na 判卷尺：`dump_text()` 跳 WIDE_CHAR_SPACER（spec_c4_*）；nz 判卷尺：
核 cursor 推进直喂（cjk-width-c4.test.mjs C4-na1..5）。
**原子性附约**：行尾剩 1 格灌宽字→整字换行，上行不留孤儿半格——
na spec_c4_宽字符劈格防御；nz 判卷归 Rust 层（term-core cargo test
c4_wide_char_at_row_end_wraps_whole（nz/term-core） 绿；浏览器层不钉——CoreFeed 与
活体 PTY 共享核，zsh 重绘竞态会污染定位类序列，可打印宽度串表不受
影响，定位类必须 Rust 层判）。

### C5. CJK 备字策略

主字体缺字形（glyph_index=0）且备用字体有（≠0）才换备字——**以字形存在性
为准，不以墨迹为准**（DejaVu 缺字也画 tofu 的教训）。盲文 U+2800 区靠此链救。
na：`prefer_cjk()`；nz：双字体栈 NaMain/NaCJK（文件直接复用 na 的）。

## 非冻结（登记为有意分歧，勿强求一致）

视口防御层（nz 特有）/ 墨迹顶对齐补偿 cjkDrop（nz 特有）/ 触摸注入形态
（na 协议 vs nz 钩子）/ 字体装载（na 内嵌 vs nz 就绪门）/ scrollback 容量
（na 10000 vs nz 1000，各钉常量+理由）/ shell 选择（na 静态 vs nz 解析）。

## 挂单联动

- na：SCROLLBACK_LINES=10000 显式常量+容量考题（终裁 #1 配套）
- nz：SCROLLBACK_LINES=1000 三处单源+理由注+压帽考题；鼠标报告 SGR 1006
  缺口挂单（排期已定：tmux 线之后）
- 双线：keymap.rs:4 式「注释旧话」清理教训——注释描述的行为与实现同步是
  契约维护的一部分

## 变更流程

改方发信（agent-inbox，命名 term-contract-C{n}-change-…）→ 另一线表态 →
评审核 → 双线各落考题 → 本表更新。冻结项无双方书面同意不得改。
