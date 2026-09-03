# 9.0 通报：bold-is-bright 闭环（bold 不画粗改映射亮色，term-contract C6 登记）

> 日期: 2026-09-03
> 致: 主会话，评审，kfm-na
> 流型: 线程
> 预期表态方: kfm-na（C6 对齐跟进，非即时）
> 收敛判据: 用户/评审知悉 bold-is-bright 闭环与用户真机验收；na 知悉 C6 登记并待落地对齐；无需即时回函
> 回: 用户真机报告「bold 中文糊成毛边」
> 状态: 通报完毕（2026-09-03 用户真机验收通过；na 侧 C6 待跟进对齐）

**致**: 用户 + 评审 + na  
**来源**: nz 9.0 线  
**提交**: 57c6d9f0（palette.ts boldBrightToken + shell.ts 映射 + font-synthesis 双保险）  
**时间**: 2026-09-03

---

## 1. 病灶与拍板

用户真机报告：bold 中文糊。定罪：两线终端字体均**单字重**（nz
NaMain/NaCJK 只有 400），Chromium 合成加粗把像素 CJK 糊成 2px 毛边、
中文难认。**2026-09-03 用户拍板**：bold（SGR 1）不画粗，改映射亮一档
（ECMA-48 惯例），并全局禁合成加粗。

## 2. 实现（提交 57c6d9f0）

- **映射表**（只染前景，背景不受影响）：

| 输入 | 映射后 |
|---|---|
| 索引色 0-7（30-37） | bright 8-15 |
| 默认前景 | 亮白 #FFFFFF |
| 已是 bright（90-97） | 不变（不二次提亮） |
| 256 色 / RGB 直设 | 不变 |

- `palette.ts` 新增纯函数 `boldBrightToken()`；`shell.ts appendSeg` 删
  `fontWeight='bold'` 改走映射 + 渲染容器级 `font-synthesis:none`
  **双保险**（任何路径漏进来的 bold 字重也不被合成加粗）。
- 解析层/i/u/s/v/d/h/字格度量**零改动**——只动前景色映射一环。

## 3. 色值纪律：零新造

亮色系逐值取自 **NA ANSI_16 同源**（#FF5555 系），全程零色值新造；
考卷里埋同源硬钉——**「亮红必须 = #FF5555」**，谁改色值谁红。

## 4. 考卷数字

- 新钉 A 档 6 题（tests/palette-bold-bright.test.ts，纯函数判卷）——
  **npm test 110 全绿**。
- browser term-bold-bright 4/4：`1;31`→#FF5555 / `1m`→#FFFFFF /
  `1;94`→#60A5FA 不变 / computed fontWeight 均 400 + 容器
  fontSynthesis=none。
- **browser 15 卷全绿**，零回退。

## 5. term-contract C6 登记（两线首次定义 bold 语义）

已登记 docs/domains/term-contract.md **C6**：bold 语义 = bold-is-bright +
全局禁合成加粗，含完整映射表与双保险条款。**这是两线首次定义 bold
语义**——na 现状无 bold 消费点（src 无 BOLD 引用），**待跟进对齐**：
na 落地时须按 C6 表映射并各自落考题，防偷偷分叉。

## 6. 真机验收

**用户真机验收通过（2026-09-03）**——「效果不错」针对本条（bold 中文
不再糊、亮色强调可读）。与 keybar 迁皮的真机待验分开记账，互不贪功。
