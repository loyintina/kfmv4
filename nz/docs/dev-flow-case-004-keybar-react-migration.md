# 开发流程案例 004 · keybar 迁皮（手写 DOM → React）——插件档案

> 2026-09-03 归档。定位：term 域 keybar 组件（nz/src/client/term/KeybarApp.tsx +
> keybar.ts）。宪法 §6 Step 3——终端快捷键栏从手写 DOM 皮迁到 React 皮的完整
> 实录。行为规格在 docs/keybar-v3-state-machine.md（已签收基线，装配方案 A），
> 功能账本在 nz/TASK.md，本文是流程经验与教训的沉淀。提交 3bdcdfb1。
>
> **活文档纪律（沿用 case-001 用户拍板）：本文档随 keybar 组件持续生长——
> 未来对键栏/修饰键粘滞/长按重复/IME 防线的任何修改、事故、调参，都追加到
> 「闭环后迭代」一节**，写清：为什么改（谁拍板）、改了什么、验收数字、
> 产出的纪律。不许只改代码不记账。

## 起点：一次「只换皮不换骨」的架构试点

keybar 是 tokens 化的破口——颜色 #1a1a20/#26262e/#3d5a99 硬编码在
`style.cssText` 里；同时它是宪法 §6「逻辑皮分离」路线的第三个试点件
（前两个是 tmux-tabs 试点与组件化方向），迁皮目标单一：**骨全保留，只换
DOM 生成与样式来源**。

## 流程段（每段：产物 / 坑 / 纪律产出）

### ① 状态机清单用户签收制（迁皮第一步不是写代码）

- 产物：docs/keybar-v3-state-machine.md——先清骨/皮边界：
  - **骨**（原样不动，碰了就是事故不是迁皮）：KEYS 键表（两排七列，与 NA
    逐格对齐）/ keymap.ts（keySeq 序列映射，appCursor 翻 SS3/CSI）/
    ModifierState 一次性粘滞 / 方向键长按重复机（400ms+65ms）/
    **IME 四层防线**（pointerdown preventDefault 保焦点 / 按钮 click
    stopPropagation / bar touchstart preventDefault 防原生
    ShowImeIfNeeded / bar click 缝隙兜底）。
  - **皮**（本次换）：DOM 生成（createElement+cssText → React tsx）+
    样式来源（十六进制字面量 → tokens.css 语义变量）。
- 转换表 K1-K8 + 禁止条款 P1-P6（P5 迁皮新规：皮内出现硬编码色值=钉红；
  P6 禁止皮内自备第二份修饰键状态，单向数据流，骨唯一真源）。
- **0903 用户拍板（第七次仲裁）**：两排键面/栏底背景透明化（与终端画布
  #000000 一致，只留文字）；点亮色 #3d5a99 原色收编为 token
  `--kfm-key-on-bg`；装配方案 A（term 域内 reactMount）。
- 纪律产出：**迁皮类工作的第一份产物是「什么动、什么不动」的清单，
  签收前一行代码都不写**；清单里「不在本次范围」一节和正面清单同样重要。

### ② 每条转换一颗考卷钉 + 「21 钉原样跑绿」证明法

- 考卷双轨：**现行 keybar-click.test.mjs 21 钉一字未改**（可点达/点即有果/
  焦点保持/不召唤 IME/touchstart 防线/长按重复⑥行为钉等），迁皮后原样
  跑绿——**这就是「骨零改动」的机器证明**：钉断言的是行为不是实现，皮换
  了钉还绿，说明行为语义逐条保住。对照证据：keymap.ts 零 diff；keybar.ts
  纯逻辑原样（仅 REPEAT 三常量加 export 值不变 + mountKeybar DOM 皮摘除）。
- 新增迁皮专项三钉（keybar-skin.test.mjs）：㉒ P5 零硬编码（皮源文件
  grep 无十六进制色值/无 style.cssText + DOM computed style 关键色 =
  tokens 解析值）/ ㉓ 观测钩 `__kfmNzKeybar()`（K1/K3 序列经 ring 断言）/
  ㉔ 视觉白名单几何比对。
- 纪律产出：**「现行断言一字未改、原样跑绿」是迁移类工作最便宜的骨零改动
  证明**——比 diff 人审硬，因为它证明的是行为等价而非文本等价。

### ③ 实现 + 变异抽检

- 实现：KeybarApp.tsx（229 行）经 reactMount 桥接挂 term 域装配点；
  IME 四层防线/长按重复机 listener 语义**逐行随皮**（一个 Listener 不丢）。
- 变异抽检（清单纪律的收官步）：随机挑一钉做反例注入——**皮内偷偷塞一个
  硬编码色值 → ㉒精确变红 → 还原**。考卷没经过变异抽检，等于没证明钉能红。
- 验收数字：21 钉原样全绿 + 新三钉所在卷 18/18；browser 15 卷 +
  npm test 104 全绿。
- 纪律产出：变异抽检入流程闭环（签收→钉→实现→抽检），抽检记录写进
  提交消息，不许只口头说「测过了」。

### ④ 视觉白名单制（迁皮视觉纪律的定型）

- 规则（0903 修订，替代原「视觉零变化」）：迁皮**无意图变更**时，前后截图
  必须逐格相同，不同=事故；**有意图变更**（0903 用户拍板键面/栏底透明化）
  改成白名单豁免，比对钉照样成立——豁免项写死在 ㉔ 钉里，不许口头豁免。
- 载体：迁前基线 tests/assets/keybar-baseline.png（+ 几何清单
  keybar-baseline.json，capture 脚本 keybar-baseline-capture.mjs）；
  迁后 keybar-after.png 对照。
- **诚实申报案例——字色漂移**：现行字色 #c8c8d4 收编到 `--kfm-key-ink`
  时对齐到 `--kfm-ink-2` 档，存在轻微色值漂移。实现方没有悄悄蒙混，
  申报后**用户仲裁拍板：接受现状并入全局色阶**（drift 变 token 语义，
  一次性收口）。
- 纪律产出：**视觉比对不是「零变化」教条，是「意图内/意图外」分类学**——
  意图内的差走白名单+用户拍板，意图外的差=事故；发现的漂移诚实申报，
  仲裁权在用户。

## 观测手段库（本插件沉淀的基建）

| 手段 | 路径 | 用途 |
|---|---|---|
| 行为考卷 | tests/browser/keybar-click.test.mjs | 21 钉（骨的行为规格，迁皮零改动凭证） |
| 迁皮专项钉 | tests/browser/keybar-skin.test.mjs | ㉒ 零硬编码 / ㉓ 观测钩 / ㉔ 视觉白名单 |
| 观测钩 | `__kfmNzKeybar()` | mods 三机位 + repeat 相位（IDLE/HELD/REPEATING）+ 40 拍 ring |
| 迁前基线 | tests/assets/keybar-baseline.png/.json | 视觉比对锚点（capture 脚本可重采） |
| 变异抽检 | 皮内注入硬编码色值 | 验证 ㉒ 钉能红（反例即证据） |

## 纪律产出汇总（通用，不限本组件）

1. 迁皮先列骨/皮清单并用户签收；「不动清单」与「动清单」同权。
2. 「现行断言一字未改、原样跑绿」= 骨零改动的机器证明。
3. 流程四步闭环：清单签收 → 每转换一钉 → 实现 → 变异抽检（钉必须证明能红）。
4. React 皮的 DOM 契约（class `kfm-term-keybar` + 按钮直子 div 结构）是
   考卷生命线——21 钉按 DOM 结构断言，皮的 DOM 形状就是隐性规格，
   改 DOM 形状前先看考卷咬在哪。
5. IME 四层防线一个 Listener 不许丢，迁皮后逐层有钉盯（P3）。
6. 样式全走 tokens（P5：皮内十六进制=钉红）；视觉差按意图分类，
   白名单豁免写进钉，漂移诚实申报交用户仲裁。
7. 装配方案 A：term 域内 reactMount，不预造空壳（不提前为「未来插件化」
   造 PluginCtx 字段）——架构跃迁和换皮分开做，一次只跃一步。

## 闭环后迭代（活文档生长区）

- 2026-09-03 归档基线（3bdcdfb1）：清单签收（方案 A + 透明化拍板）→
  KeybarApp.tsx 落地 → 21 钉原样绿 + 新三钉 18/18 → 变异抽检通过 →
  browser 15 卷 + npm test 104 全绿。透明键面+点亮色块真机观感
  **待用户过目**（用户 09-03「效果不错」针对的是 bold-is-bright，
  不挂到 keybar 账上）。
