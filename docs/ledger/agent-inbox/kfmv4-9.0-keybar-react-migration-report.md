# 9.0 通报：keybar 迁皮 React 闭环（骨零改动 + 新三钉 + 变异抽检）

> 日期: 2026-09-03
> 致: 主会话，评审，kfm-na
> 流型: 线程
> 预期表态方: 无
> 收敛判据: 用户/评审/na 知悉 keybar 迁皮（宪法 §6 Step 3）闭环；透明键面真机观感待用户过目；无需回函
> 回: keybar-v3-state-machine 清单签收（0903 用户拍板，装配方案 A）
> 状态: 通报完毕（2026-09-03 nz：考卷全绿+变异抽检通过；透明键面真机待用户过目）

**致**: 用户 + 评审 + na  
**来源**: nz 9.0 线  
**提交**: 3bdcdfb1（KeybarApp.tsx + tokens keybar 专用段 + 迁皮考卷链）  
**时间**: 2026-09-03

---

## 1. 闭环事实（提交 3bdcdfb1）

宪法 §6 Step 3：终端快捷键栏从手写 DOM 皮迁到 React 皮，**骨零改动**：

- **骨全保留**：keymap.ts 零 diff；keybar.ts 纯逻辑原样（仅 REPEAT 三常量
  加 export 值不变 + mountKeybar DOM 皮摘除）；IME 四层防线/方向键长按
  重复机 listener 语义逐行随皮，一个 Listener 不丢。
- **皮全换**：DOM 生成 → KeybarApp.tsx（reactMount 桥接，装配方案 A，
  term 域内挂载不预造空壳）；样式全走 tokens keybar 专用段
  （`--kfm-key-ink/on-bg/on-ink`），皮内零硬编码。
- **0903 用户拍板入皮**：两排键面/栏底背景透明化（与终端画布 #000000
  一致）；点亮色 #3d5a99 收编 token，点亮时色块从黑底浮现。

## 2. 骨零改动的机器证明与考卷数字

- **现行 21 钉（keybar-click.test.mjs）断言一字未改、原样跑绿**——钉
  断言行为而非实现，皮换钉绿 = 行为等价，这是骨零改动最硬的凭证。
- 新增迁皮专项三钉（keybar-skin.test.mjs）：㉒ P5 零硬编码（grep 无
  十六进制色值/cssText + computed style = tokens 解析值）/ ㉓ 观测钩
  `__kfmNzKeybar()`（mods/repeat/40 拍 ring）/ ㉔ 视觉白名单几何比对。
  新三钉所在卷 **18/18**。
- **browser 15 卷 + npm test 104 全绿**，零回退。
- **变异抽检通过**：皮内偷偷塞硬编码色值 → ㉒精确变红 → 还原（钉能红
  才配叫钉）。

## 3. 视觉纪律：白名单制 + 字色漂移诚实申报

- 迁皮无意图变更 = 前后截图逐格相同（迁前基线
  tests/assets/keybar-baseline.png 已采）；有意图变更（0903 拍板透明化）
  走白名单豁免，写死在 ㉔ 钉里。
- 字色 #c8c8d4 收编 `--kfm-key-ink` 时向 `--kfm-ink-2` 档有轻微漂移，
  已申报；**用户仲裁：接受现状并入全局色阶**。

## 4. 真机状态（诚实栏）

**透明键面 + 点亮色块的真机观感待用户过目。** 用户 09-03 的「效果不错」
验收明确针对的是 bold-is-bright（见 bold 通报信），keybar 不挂这笔账。
C 档请验：常态黑底只浮文字、点 CTRL/ALT/SHIFT 点亮色块浮现、落字即灭。

## 5. 档案与纪律沉淀

流程档案已落 nz/docs/dev-flow-case-004-keybar-react-migration.md：
骨/皮分层方法论、「21 钉原样绿 = 骨零改动机器证明」证明法、视觉白名单
制、React 皮 DOM 契约是考卷生命线、IME 四层防线一个不丢、装配方案 A
不预造空壳。观测手段库新增 `__kfmNzKeybar()` 与迁前基线截图链。
