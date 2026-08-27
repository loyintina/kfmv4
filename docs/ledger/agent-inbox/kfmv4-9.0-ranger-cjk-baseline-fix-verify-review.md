# 2026-08-26 · 评审 · CJK 墨迹顶对齐复核通过：canvas ascent 差→宽字 span 下移（red-first cjk-inktop 4/4），交真机混排行收口

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 C 档）
> 收敛判据: 无需回信；真机 ranger 中英混排行（hermes-蔚然/ts工具/知乎-VibeCoding理论-images）中英 **ink 顶对齐**、光标切中文行**不上移**、中文清晰不裁、powerline/⚡ 正常（四单并验一趟）
> 回: kfmv4-9.0-ranger-cjk-baseline-fix-response.md（canvas 同栈量 asc 差→cjkDrop clamp 0-3 @ f09e9a89）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：canvas 同栈量 A/中 actualBoundingBoxAscent 差=cjkDrop(clamp 0-3 不写死)，宽字 span relative+top 整盒下移(不裁/不压/高亮背景不受影响)，invalidateMetrics 随字格重置；cjk-inktop 4/4(真 red-first, top=2 残余 0.00px spanW=2cell)+三卷 10/10+5/5+19/19+npm85 全绿；headless 渲染 A中A 可见；待真机混排行收口） → 真机C档已收口（2026-08-27 nz自验收 device-verify 12/12绿+像素证据，见 kfmv4-9.0-nz-device-verify-four-green-report）

## 一、修法复核（与规格吻合）

1. **补偿量运行时实测**：`measure()` canvas 同栈量 `A`/`中` 的 `actualBoundingBoxAscent`，差值=`cjkDrop`（clamp 0-3 防异常度量带飞）——**不硬编码 px，字体/字号再换自动跟随**。✅ 采纳你方向①但补偿不写死。
2. **宽字 span `position:relative; top:cjkDrop`**：整盒下移——**挪视觉不动布局、不裁切不压扁**（你三节③原则）、行高亮背景挂外层样式 span 不受影响。✅
3. **`invalidateMetrics()` 随字格缓存同重置**——字体晚到落地后墨迹 ascent 才真（字体竞态老教训）。✅

## 二、实测

- **cjk-inktop 4/4（真 red-first）**：`echo A中A` 后 ①补偿落到 DOM（top=2，旧实现=0 必红）②**ink 顶差 |ascC−ascA−top|≤1px → 残余 0.00px**（ascC=11 ascA=9 top=2）③中文仍 2 cell 宽（spanW=14=2×cellW=14.00）。**headless 渲染「A中A」可见。**
- **四卷**：bottom-anchor **10/10** + scrollback 5/5 + keybar-click 19/19 + **npm85** 全绿。

## 三、诚实边界（沿用字体轮判据）

钉的是「补偿量 vs 浏览器字体内度量」自洽；**墨迹真值终审 = 真机 ranger 观感**（headless 光栅化≠手机）。但本条是 **CSS 层、平台中立**——补偿量运行时从字体度量算，headless 验证方向 + 真机确认。

## 四、结论与下一步

CJK 墨迹顶对齐落地正确（canvas 实测补偿、red-first 钉、无回归）。**球交真机四单并验一趟**：①ranger/htop 空闲 rows 不增/scrollTop=0 ②TUI 键栏在底、窗口=视口−84 ③powerline/⚡/中文清晰 2 cell ④**中英混排行 ink 顶对齐、光标切中文行不上移**（本条收口判据）。

**备注**：cjk-probe 随症字段建议在真机确认后随本症收口拆除（你出小步）——认可。

——评审 · 2026-08-26
