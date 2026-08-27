# 2026-08-26 · 评审 · 字体切栈 NA 同款复核通过：NaMain+NaCJK + vhea 排雷，交真机 ranger 中文行收口

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 C 档）
> 收敛判据: 无需回信；真机 ranger/htop 中文文件名行**与 ASCII 同基线、不上移**（收口判据）+ 中文 2 cell 宽清晰 + powerline/⚡/符号正常 + TUI 键栏在底/窗口=视口−84 + 空闲 rows 不增（三单并验一趟）
> 回: kfmv4-9.0-nz-font-adapt-response.md（字体切栈 + vhea 排雷 @ eece8681）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：NaMain+NaCJK 双栈+就绪门 load 双字体落地；vhea 0x10001 非法致 Chromium OTS 整字重拒=web 独有坑, sanitize-na-main.py 幂等修复(私有字体为何加载不上的真因)；NaMain 严格等宽 7px/E0B0 命中 NaCJK/cellH 不变 ④e④f 不动；三卷 10/10+5/5+19/19+npm85 全绿；headless fontFamily=NaMain,NaCJK 生效、混排对齐；待真机 ranger 中文行收口） → 真机C档已收口（2026-08-27 nz自验收 device-verify 12/12绿+像素证据，见 kfmv4-9.0-nz-device-verify-four-green-report）

## 一、落地复核（与规格吻合）

1. **@font-face** `NaMain`/`NaCJK` + **TERM_FONT_STACK** = `'NaMain','NaCJK',…`（NFM face 退役不拉取）；**字体就绪门 load 两个打头字体**（主 '0' + CJK '中'，几何两边都吃）；cjk-probe 检查项同步换名（mainLoaded/cjkLoaded）。✅
2. **排雷（关键，web 独有）**：na-main.ttf 的 **vhea 表版本 0x00010001 非法**（合法 0x00010000/0x00011000），Chromium OTS **整字体重拒**（`mainLoaded=false` 实锤）。NA 原生 Rust 栈不查 vhea，所以 NA 一直能用——web 端独有的坑。**这正是「商用字体加载不上」的真因**（不只是「没切栈」）。修法 `sanitize-na-main.py`：修版本号+重算表校验和+checkSumAdjustment，幂等原地修；BUILD 拷入后必跑。✅ 已入库、字体本体不进库。

## 二、实测

- **headless 双字体 loaded**、`mainLoaded/cjkLoaded=true`（OTS 错误消失）；`fontFamily=NaMain, NaCJK,…`（**切栈生效**）。
- **NaMain 严格等宽 7px**（0/A/i/W/l/j|space 全 7.00px，栅格对齐）；**E0B0/⚡ 命中 NaCJK**（逐字 fallback）；`cellH=16.25` 不变（line-height 驱动）→ **④e/④f 期望不动**。
- **headless 混排行** `hermes-蔚然 ts工具 知乎-VibeCoding理论-images`：中英文**对齐**（FusionPixel 中文不再往上顶，比系统 Noto 好）——截图人审。
- **三卷**：bottom-anchor **10/10** + scrollback 5/5 + keybar-click 19/19 + **npm85** 全绿。

## 三、诚实边界（你五节原话认同）

headless 光栅化 ≠ 手机，headless 对齐只是参照组。**收口判据 = 真机 ranger 中文行与 ASCII 同基线**。若 FusionPixel 换后真机仍错位 → 光栅化层，走真机截图再议。cjk-probe 随症字段暂留（换字体后再报一组对照，收口拆）。

## 四、结论与下一步

字体切栈 NA 同款 + vhea 排雷落地正确、无回归；headless 显现对齐改善。**球交真机 C 档（三单并验一趟）**：①ranger/htop 空闲 rows 不增/scrollTop=0 ②TUI 键栏在底、窗口=视口−84 ③**ranger 中文文件名行不上移**、powerline 箭头/⚡ 正常、中文清晰 2 cell 宽。

**备注**：`na-main.ttf` 私有商用字体已 gitignore（未入库），`sanitize-na-main.py` 入库；web 端用商业字体需先消毒 vhea（这个坑挺典型——**同一字体 NA 原生能用、web 被拒**，跨栈一致性 vs 消毒的活教材）。

——评审 · 2026-08-26
