# 2026-08-26 · 评审 · ranger 中文行「上移」对症修法：CJK 字形 ink 比英文高——改基线/vertical-align 对齐，非换字体

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 把中英混排行里 CJK 字形 ink 顶对齐到英文（~1px 内）；真机 ranger 光标切到中文行不再「整行上移几 px」；中文仍 2 cell 宽、清晰、不裁切；A 档三卷+npm85 不回退
> 回: kfmv4-9.0-nz-font-adapt-verify-review.md（字体切栈已核；本条为字形垂直对齐的对症修法，说明换字体治不了）
> 回函通知: psh
> 状态: 待回信（2026-08-26 评审：像素+读图双证——中字形 ink 顶比英文高(13px:中13 vs A14;40px:中18 vs A20),且中更高更满格;换 FusionPixel 也一样=字形 ink vs 固定 cell 几何差,非字体选择;对症修法=CJK span 基线/vertical-align 对齐英文)

## 一、根因确认（像素 + 读图双证，你的理解对）

把 `A`(NaMain)/`中`(NaCJK) 渲染进终端 cell（13px/1.25em），PIL 像素量 ink 顶 + ReadMediaFile 亲眼对比：

- **13px**：`A inkTop=14`、`中 inkTop=13`——中高 1px；中 ink 高 11px vs A 8px（更满格）。
- **40px 放大**：`A inkTop=20`、`中 inkTop=18`——中高 2px；读图**中字顶边明显高于 A**。
- **结论**：中文/一些字符的 ink 在固定格里**比英文高、更满**。**换 FusionPixel 也一样**——这是**字形 ink 几何 vs 固定 cell 高**的差异，**不是字体选择能解决的**。（前几轮盯换字体是治标，本条的「字形垂直对齐」才对症。）

## 二、对症修法方向（请 9.0 定实现）

把 CJK/宽字 span 的字形**垂直位置对齐到英文字形**，使中英混排行里两者 ink 顶平齐（~1px 内）。方向（任选，9.0 按 DOM 结构定）：

1. **CJK span `vertical-align` 微调**：把中文字形下移几 px，让 ink 顶与英文平齐（inline-block 的基线规则下，调 vertical-align/或给行底偏移）。
2. **CJK span 独立 `line-height`/baseline 校准**：让中文基线跟英文共用同一 ink-top 参考。
3. **对齐原则**：中文天然比英文满格，**别为了对齐把中文裁切/压扁**——目标是「ink 顶对齐」，优先对齐上沿；若中文过高导致裁顶风险，9.0 平衡（对齐中心/核心区 vs 顶满）。

**注意**：9.0 之前怀疑的「inline-block+overflow:hidden 触发 baseline=盒底边」与「CJK 行盒撑高」——真机 cjk-probe `spanH=16.25/shift=0` 已表明行盒没撑高；本条是**字形 ink 本身偏高**（不是行盒），修的是字形垂直定位，别跟行盒/overflow 那条混淆。

## 三、验收

- **A 档新钉（建议）**：headless 渲染「A中A」，断言**中与 A 的 ink 顶差 ≤1px**（像素量 or canvas actualBoundingBox 对齐判据）——把「中文偏高」钉成阈值断言。
- 三卷（bottom-anchor 10/10 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。
- **真机 ranger**：中英混排行（`hermes-蔚然`/`ts工具`/`知乎-VibeCoding理论-images`）里中文与英文**ink 顶对齐**；光标切到中文行**不再整行上移**；中文仍 2 cell 宽、清晰、不裁切；powerline/⚡ 正常。

## 四、备注

- 修法对平台中立（CSS 层），headless 验证方向 + 真机确认。headless 已能复现 ink 顶偏（像素+读图），可作为验收依据，不必再等真机才动。
- 若你想先看看「到底偏多少/值不值得修」，可先开一次 `?debug` 看真机是否也偏（cjk-probe 或截图）——但方向已定，建议直接修（这是 CSS 一行级调试，成本低）。

——评审 · 2026-08-26
