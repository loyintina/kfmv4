# 2026-08-26 · 9.0 回函 · 字体切栈 NA 同款落地：NaMain+NaCJK @ eece8681（+排雷 vhea 表非法版本 OTS 整字体重拒）

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审亲跑三卷+npm85 不回退、切栈与规格吻合；用户真机 ranger 中文行与 ASCII 同基线（收口判据）、2 cell 宽、清晰、powerline/符号正常
> 回: kfmv4-9.0-nz-font-adapt-review.md
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：切栈落地正确、vhea 排雷关键（商用字体加载不上的真因）、NaMain 等宽/E0B0 命中/cellH 不变、三卷+npm85 绿、headless 混排对齐）· 见 kfmv4-9.0-nz-font-adapt-verify-review.md · 代际戳 gen-2026-08-26-字体切栈-已核

## 一、落地清单

1. **@font-face**：index.html 加 `NaMain`(na-main.ttf)+`NaCJK`(na-cjk.ttf)，NFM face 退役（文件留在 public/fonts 未删，不在栈中浏览器不拉取）。
2. **TERM_FONT_STACK** = `'NaMain', 'NaCJK', ui-monospace, Menlo, Consolas, monospace`（shell.ts 同源注释已翻案）。
3. **字体就绪门**：`fonts.load` 两个打头字体并行（主 '0' + CJK '中'）——几何两边都吃；onFontsSettled/1s/3s 幂等复量机制字体名无关、原样保留。
4. **cjk-probe 检查项同步换名**（mainLoaded/cjkLoaded 对新栈）。

## 二、排雷（评审/后续 BUILD 必知）

**na-main.ttf 直接挂上会被 Chromium 整字体重拒**：`OTS parsing error: vhea: Unsupported table version: 0x10001`——vhea 表版本字段 0x00010001 非法（合法 0x00010000/0x00011000），OTS 消毒器拒载整字（mainLoaded=false 实锤）。NA 原生端的 Rust 字体栈不查 vhea 所以一直能用——web 端独有坑。

修法：`nz/scripts/sanitize-na-main.py`——修版本号 + 重算表校验和 + head.checkSumAdjustment，幂等原地修。**BUILD 从 kfm-na 拷入字体后必跑一次**（拷一次修一次；脚本已进库，字体本体不进）。

## 三、实测（headless，消毒后）

- `mainLoaded=true / cjkLoaded=true`，OTS 错误消失；
- **NaMain 严格等宽**：0/A/i/W/l/j/|/space/m/. 全 7.00px（栅格对齐无隐忧）；
- NaCJK 覆盖实锤：`E0B0=true`（NaMain 无→逐字 fallback 命中）、`⚡=true`；中=13px≈2cell（宽字 span 裁切路径不变）；
- `cellH=16.25` 不变（line-height 1.25 驱动，字体无关）——**④e/④f rows 期望不需要改**，亲跑三卷 10/10+5/5+19/19+npm85 全绿确认。

## 四、诚实边界

headless 光栅化≠手机（你五节原话）：换字体后 headless shift=0 仍只是参照组，**收口判据=真机 ranger 中文行与 ASCII 同基线**。若 FusionPixel 换后仍错位，则是光栅化层，走真机截图对比再议。cjk-probe 随症字段暂留（真机换字体后可再报一组对照数字，收口后拆）。

## 五、球交真机（三单并验一趟）

Via 开 8023（可加 ?debug 顺带录 cjk-probe 对照）：①ranger/htop 空闲 rows 不增/scrollTop=0 ②TUI 键栏在底、窗口=视口−84 ③**ranger 中文文件名行不上移**、powerline 箭头/⚡ 正常、中文清晰 2 cell 宽。
