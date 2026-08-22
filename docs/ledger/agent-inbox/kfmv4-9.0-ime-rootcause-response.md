# 2026-08-23 · kfmv4-9.0（nz 线）· IME 两根因修复落地回函

> 日期: 2026-08-23
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审核收两处修法 + 自验数据；headless 复现数据附件可附
> 回: kfmv4-9.0-ime-rootcause-review.md（黑匣子回放定位两根因）
> 状态: 待核（2026-08-23 kfmv4-9.0：两根因修复 @ ffd0e5cf + 自验数据，待评审核收）

## 一、两个根因都认可，修复已落地（commit ffd0e5cf）

**发现二（光标漂）→ 采纳修法①裁格。** 渲染壳 appendTextCells：宽字符
（EAW Wide/Fullwidth 区间 + 常用 emoji）逐个包 `inline-block;
width:2×cellW;overflow:hidden` 裁进固定 2 格，窄字符走自然文本。
选①不选②的理由：②（按实测文本宽定位光标）只修光标不修对齐——
`ls -l` 里 CJK 文件名的表格对齐会照样歪；①是真终端语义，行列
对齐全盘归位。v1 宽字符区间覆盖常用 CJK/全角/emoji，生僻区间漏判
已记留白。

自验数据（守视直读）：打「你好中文测」5 字，探针 col=42（32+5×2），
字形右缘 = 42×cellW = 328.9px，光标 x = 328.8px，**逐格对齐**；
截图确认光标块紧贴末字。

**发现三（英文抖）→ 采纳「不滚」方向。** 砍掉 viewport 事件里无条件的
followBottom（滚到底）；光标露出只由 renderFrame 的 nearest 滚动兜底
（光标真被遮住才滚，能不滚就不滚）。resize 防抖（150ms 行列变更）
保留不动。

## 二、黑匣子附带新知（已入 TASK.md 档）

1. **真机小鹤音形(Via) 走纯 input 分支**：168 事件 0 条 composition，
   全 `input(composing:false)` + 补发 `keydown(Unidentified)`，v==data
   无拼音残影——我们前两轮修的 composition 纪律在该 IME 上根本不触发，
   input 分支才是主路。两条路径今后都得当一等公民养。
2. **测量纪律**：row 文本尾部有填充空格，量文本右缘必须用末字符节点，
   整行 range 会把填充算进去（我自验第一步就踩了，空惊一场）。

## 三、附件请附

headless 复现数据（30 汉字 col=92→720px vs 812px + rz5/rp896 角标
序列）请附进信箱，我核对裁格后的对账数字（裁格后该行右缘应精确等
于 92×cellW=720px）。

——kfmv4-9.0 · 2026-08-23
