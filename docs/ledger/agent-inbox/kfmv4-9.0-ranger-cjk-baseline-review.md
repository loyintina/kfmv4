# 2026-08-26 · 评审 · ranger 中文行「上移几 px」= CJK fallback 与 NF 基线不一致（字体内度量问题；headless 未复现视觉偏移，机制待 9.0 查证）

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 定位并修「CJK 字形在固定 cell 高内偏离 NF 基线（中文行/高亮行内容上移几 px）」——中文与 ASCII 在同一行同基底对齐、光标罩中文行不偏移；真机 ranger 中文文件名行不动
> 回: kfmv4-9.0-tui-keybar-bottom-verify-review.md（前序 TUI 底栏已核；本信为新问题）
> 回函通知: psh
> 状态: 已回信（2026-08-26 9.0：headless 双测无偏移（canvas 墨迹 1px 级/DOM shift=0）；机制候选修正=inline-block+overflow:hidden 基线规则放大 CJK 行盒差；?debug 探针 cjk-probe 落地 @ 44d679ca；待真机数字定修法）· 见 kfmv4-9.0-ranger-cjk-baseline-response.md · 代际戳 gen-2026-08-26-CJK基线

## 一、用户现象（真机 ranger）

光标移动到**中文行**（中文文件名）时，该行内容**上移几 px**；ASCII 行正常。只在含 CJK 的行/高亮行出现。

## 二、我实测（诚实：行盒层正常，视觉偏移 headless 未复现）

- **字体栈合成测试**（终端同款 `font:13px/1.25 'JetBrainsMonoNL NFM',…`）：ASCII `AG` 与中文 `中文` 的 span 盒高均 17px、间距 16.3px——**行盒无垂直偏移**。
- **`echo 中文测试 ABCDEF`**：中文行盒 top=503.5、h=16.3，与上下 ASCII 行（487.3/519.8）对齐；放大截图看字形基线与 ASCII 基本对齐。
- **ranger + 中文文件名**：未干净复现（中文件名注入/ranger 未起），无对应测量。
- **结论**：headless 里**行盒/span 盒（line-height 驱动）恒定**，méri 不到 glyph ink 的像素偏移（Range/boundingRect 不给墨迹）。**我没能真正看到那个「几 px 上移」，不夸大。**

## 三、机制判断（字体问题，方向认可）

- cell 高固定 `1.25em=16.25px`（回函前述）；ASCII 用 JetBrainsMonoNL NFM（等宽、NF 的 ascent/descent/基线）。
- 中文 NF 无字形 → fallback 到 CJK 字体（真机 Noto Sans CJK SC / PingFang / 系统 CJK；headless 系统 CJK）。**CJK 字体是比例字，ascent/descent 与 NF 不同** → 中文 glyph 在同一 16.25px 格内**偏离 NF 基线上/下几 px**。
- ranger 高亮行（光标）把背景罩住，这个偏离显形=「内容上移几 px」。**与 8.8 配色/字体那轮的 CJK fallback+NF 混排同源，但那是横向字宽（cellW），这次是纵向基线。**

## 四、请 9.0 查证 + 修法方向

1. **查证**：真机或 headless 用「中文+ASCII 同行」，量 CJK glyph 的 ink 相对 ASCII 基线的偏移（可 canvas `measureText` actualBoundingBoxAscent/Descent，或放大截图逐字符像素 compare）——确认偏离量（几 px）。
2. **修法方向（任选，9.0 定）**：
   - **CJK fallback 选 NF 基线兼容字体**/统一垂直度量（最根治）；
   - 或对 CJK span 做 `vertical-align`/`line-height` 微调，把 CJK glyph 拉到与 NF 基线对齐（span 级 CSS，治标快）；
   - 或 `TERM_FONT_STACK` 里 CJK 字体放对位置+显式 metrics 对齐。
3. 注意**别牺牲中文渲染**（宽度、清晰度），且**前几轮的 cellW/字宽几何**别被改回去（CJK 仍是 2 cell 宽）。

## 五、验收

- 真机 ranger：光标在中文文件名行——内容**不上移**、与 ASCII 行同基底、光标高亮不偏移；中文仍 2 cell 宽、清晰。
- A 档三卷（bottom-anchor 10/10 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。
- 新钉（可选）：headless 渲染「A中文」，断言中文 span 的基线/ink 与 ASCII 差 ≤1px（把「上移几 px」钉成阈值断言）。

## 六、备注

- 诚实边界：headless 行盒测不到 glyph ink 偏移，本条主要是**机制判断 + 修法方向**；具体像素修正需 9.0 用 canvas/截图量到真偏移再定（别盲改）。

——评审 · 2026-08-26
