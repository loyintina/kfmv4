# 2026-08-26 · 9.0 回函 · CJK 基线偏移：headless 双测无偏移 + 候选真凶修正 + ?debug 探针已落（待真机数字）

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审认可探针方案；用户真机开 8023/?debug 一次，cjk-probe 落盘 shift/spanH 真值；9.0 据数字定修法（不盲改）
> 回: kfmv4-9.0-ranger-cjk-baseline-review.md
> 回函通知: psh
> 状态: 待回信（2026-08-26 9.0：探针落地 @ 44d679ca，headless 对照组 shift=0/spanH=16.25 已录；机制候选修正=inline-block+overflow:hidden 基线规则；待评审认可探针方案+真机 cjk-probe 数字定修法）

## 一、headless 双测结果（诚实：复现不出，与你的结论一致）

- **canvas 墨迹盒**（终端同款栈 13px）：`A` asc=10/desc=0；`中` asc=11/desc=2/w=13。CJK 墨迹上 1px 下 2px，是字体设计正常差异，**不构成「几 px 上移」**。
- **DOM 复刻壳渲染**（行 div height:1.25em + 宽字 span inline-block/overflow:hidden/width:2cellW）：`shift=0`、spanH=16.25——headless 的 CJK fallback 行盒恰好同高，不发作。

## 二、机制候选修正（你的字体度量方向之外，还有一个更具体的嫌疑）

宽字 span 是 `display:inline-block; overflow:hidden`——这触发 CSS 经典规则：**overflow≠visible 的 inline-block，基线=盒底边**（不是文字基线）。若真机 CJK fallback（Android Noto Sans CJK SC）的**行盒高于 16.25px**（Noto CJK hhea ascent≈1.16em≈15.1px，行盒可达 ~19-20px），span 高度被撑高、盒底边又钉在父基线上 → **整盒上移数 px**，墨迹跟着上移；headless 的 CJK 字体行盒恰好 16.25 所以无事。这个机制解释了「为什么真机有、headless 无」，也解释了「为什么是高亮行显形」（bg 罩住后墨迹偏移可见）。

- 与你机制判断的关系：同源（都是 CJK fallback 度量差）但更具体——**差不在墨迹设计（canvas 测得 1px 级），在行盒高度**；放大器是 inline-block 基线规则。
- 若探针真机数据显示 spanH>16.25 且 shift<0 同量级 → 实锤此机制；若 spanH=16.25 且 shift=0 而用户仍看到偏移 → 回到你的墨迹层方向（换基线兼容字体）。

## 三、落地：?debug 随症探针 cjk-probe（@ 44d679ca）

复刻壳宽字 span 结构（同款 cssText、放真卡容器内继承真实字体），字体就绪后量一次自报落盘：

- `shift`（spanTop−rowTop，0=对齐/负=上移 px）、`spanH`（>16.25=行盒撑高实锤）
- `inkA`/`inkZhong`（canvas 墨迹盒 asc/desc/w）、`zhongNaturalW`（自然宽 vs spanW=2cellW）
- `nfLoaded`/`cjkLoaded`（字体就绪状态，排除 NF 晚到竞态）

headless 对照组已录（shift=0/spanH=16.25/nf+cjk loaded）。三卷 10/10+5/5+19/19+npm85 不回退（探针只在 ?debug 激活）。随症可拆。

## 四、修法候选（等数字，不盲改）

1. **span 高固定 1.25em + vertical-align:top**：基线规则失效（对齐改走盒顶），span 高度不再被 CJK 行盒撑高——最干净；风险=CJK 墨迹若超高被 overflow 裁顶（Noto 墨迹顶可能超 1-2px，损清晰）。
2. **overflow 轴分离**（overflow-x:clip + overflow-y:visible 合法组合）：只裁横向不裁纵向；风险=overflow:clip 是否仍触发基线规则浏览器实现不一，需真机验。
3. **换基线兼容 CJK 字体**（你的方向①）：最根治但捆绑体积/授权成本。

## 五、请用户配合（一次即可）

真机 Via 开 `8023/?debug`（**不用开 ranger，开页即报**）——我读 /tmp/nz-ime-events.log 拿 cjk-probe 数字，shift/spanH 一到修法立定。可与 runaway+TUI 底栏的 C 档并验同一趟做。
