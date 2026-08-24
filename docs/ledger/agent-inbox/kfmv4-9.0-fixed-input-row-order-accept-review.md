# 2026-08-24 · 评审 · 8.8.3d 布局更正①锚点修卷裁决：采纳 isAtBottom 语义锚，修卷后 5/5 绿

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无
> 收敛判据: 无需回信（纯裁决；8.8.3d A 档修正通过，待用户真机 C 档——命令行在上/按钮在下 + 上滑+键盘弹起逐帧收口）
> 回: kfmv4-9.0-fixed-input-row-order-response.md（布局更正 5e3dd75c，①红=旧锚点，评审修卷裁决）
> 回函通知: psh
> 状态: 已裁决（2026-08-24 评审：①红=考卷 artifact 属实，采纳 isAtBottom 语义锚，修卷后 5/5 绿，实现正确；待用户真机 C 档）

## 一、裁决：①红=考卷 artifact，采纳语义锚（你方案 b）

9.0 判读正确：布局互换后输入行 `bottom=536=innerHeight−84=按键栏正上方`，**正是本次更正的设计位**——数字本身证明布局改对了，①红是考卷锚点停在旧布局（「输入行垫底」时代 anchor `≈innerHeight`）。

**二选一采用 b（改断 `isAtBottom===true`），不采用 a（锚 `innerHeight−KEYBAR_H` 像素）**。理由：键栏高度未来可调（?kbOff 已是常驻入口），锚像素必定随布局碎；锚语义=「输入行贴住按键栏上方」最稳，语义位随钩子走，考卷不再关心键栏具体高多少。

## 二、修卷（已提交 1d68bf2d）

①块断言由 `Math.abs(bottom - innerHeight) < 20` 改为：

```
const atBottom = row1 && row1.isAtBottom === true
  && (row1.bottom > vhBefore - 200) && (row1.bottom < vhBefore + 20);
```

即**语义真（isAtBottom） + 底部区域区间判**（垫在按键栏上方、非视口像素底），不再锚单像素。

## 三、重跑 5/5 全绿

```
✅ 钩子存在（输入行可读） — bottom=536（=innerHeight−84，按键栏上方）
✅ ①输入行始终在底/可见（语义 isAtBottom + 底部区域） — bottom=536 vh=620 isAtBottom=true
✅ ②输出只进滚动区、输入行不动 — before=536 after=536
✅ ③滚动区可滚（上滑看历史） — sh=1365 ch=520
✅ ④键盘占位→输入行同步上移 — before=536 after=316
=== fixed-input-row A 档：5/5 通过 ===
```

scrollback 5/5 + keybar 17/17 前轮已绿不回退，二轮本地复核亦绿。

## 四、结论

8.8.3d 两区模型 **A 档修正通过、实现正确**（①锚点修正 + ②③④ + scrollback + keybar 全绿）；B 千行前轮绿。**待用户真机 C 档**（命令行在上、按钮在下 + 上滑/键盘弹起逐帧 + 数字收口）后完整关账。

## 五、教训（记录）

「**锚语义不锚像素**」：当输入行垫在按键栏上方（非视口底）时，其 `bottom≠innerHeight`（=innerHeight−键栏高），考卷断言若锚像素必然碎。应锚**语义位（isAtBottom/贴住键栏上方）+ 底部区域区间**，键栏高度可调不碎——与 scrollback 修卷「锚语义、锚区域、不锚单像素」同一教训，两案例互证。
