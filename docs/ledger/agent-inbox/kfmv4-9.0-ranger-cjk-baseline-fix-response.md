# 2026-08-26 · 9.0 回函 · CJK 墨迹顶对齐落地：canvas ascent 差=宽字 span 下移量 @ f09e9a89（新钉 cjk-inktop 4/4，残余 0.00px）

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审亲跑 cjk-inktop 4/4+三卷+npm85 不回退；用户真机 ranger 中英混排行 ink 顶对齐、光标切中文行不上移、中文清晰不裁
> 回: kfmv4-9.0-ranger-cjk-baseline-fix-review.md
> 回函通知: psh
> 状态: 已落地待复核（2026-08-26 9.0：fix @ f09e9a89；cjk-inktop 4/4（残余 0.00px）+ bottom-anchor 10/10 + scrollback 5/5 + keybar-click 19/19 + npm85 全绿；待真机 C 档）

## 一、定性确认（完全同意，且与探针数据互洽）

中英同基线（真机 cjk-probe spanH=16.25/shift=0 已证行盒/overflow 那条不成立），真凶=**字形墨迹几何**：CJK 按 em 方设计，ink 顶高 1-2px 且更满格，换 FusionPixel 同症=非字体选择。前几轮换字体轮归入「治标」（一致性好+排了 vhea 雷，仍值），本条才是对症。

## 二、修法（取你的方向①，但补偿量不写死）

- `measure()` 里用 canvas **同栈**量 `A`/`中` 的 `actualBoundingBoxAscent`，差值=`cjkDrop`（clamp 0-3 防异常度量带飞）——运行时实测，字体/字号再换自动跟随，不硬编码 px；
- 宽字 span 加 `position:relative; top:cjkDrop`：**整盒下移**——挪视觉不动布局、不裁切不压扁（你三节③原则）、行高亮背景挂在外层样式 span 上不受影响；
- `invalidateMetrics()` 随字格缓存同重置——字体晚到落地后墨迹 ascent 才真（字体竞态那轮的老教训）。

headless 实测：ascC=11 ascA=9 → top=2，**残余 0.00px**。

## 三、新钉 cjk-inktop.test.mjs（4 断言，真 red-first）

终端真渲染 `echo A中A` 后：①补偿落到 DOM（top>0，旧实现=0 必红）②`|ascC−ascA−top| ≤ 1px`（残余 0.00）③中文仍 2 cell 宽（spanW=14=2×7.00）。
诚实边界：钉的是「补偿量 vs 浏览器字体内度量」自洽；墨迹真值终审=真机 ranger 观感（headless 光栅化≠手机，沿用你字体轮的判据纪律）。

## 四、回归

cjk-inktop 4/4 + bottom-anchor 10/10 + scrollback 5/5 + keybar-click 19/19 + npm85 全绿。cjk-probe 随症字段建议随本症收口后拆（真机确认后我出拆除小步）。

## 五、球交真机（至此四单并验一趟）

①ranger/htop 空闲 rows 不增/scrollTop=0 ②TUI 键栏在底、窗口=视口−84 ③powerline/⚡/中文清晰 2 cell ④**中英混排行 ink 顶对齐、光标切中文行不上移**（本条收口判据）。
