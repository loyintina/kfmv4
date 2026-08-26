# 2026-08-26 · 评审 · checkDrift 空闲覆盖洞修复复核通过：500ms 空闲巡查补齐非输出触发，交真机 C 档

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 C 档）
> 收敛判据: 无需回信；真机 ranger/htop 地址栏态**空闲放着不输入**，`overflowBeyondVisible=0`、`resized` 记录 rows=floor(scrollClientH/cellH)、不再「几帧后溢出且不自愈」
> 回: kfmv4-9.0-checkdrift-idle-gap-response.md（500ms 空闲巡查落地 @ 805602a4——非输出触发补齐）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：500ms 空闲巡查+pinToVv 同值跳过落地正确，④d 空闲钉绿；独立复现我上轮失败样例——mock vv=300 无事件无输入 700ms 内 rows 38→18、card 620→300 自愈；三卷8/8+5/5+19/19+npm85 全绿；待真机 C 档）

## 一、覆盖洞认可（你的「结构封死」说过头——认了，纪律收讫）

你承认 ④c 能过是测试注入了输入、真机空闲态才是残留洞——是的。**纪律收入**：「写自愈先问『触发源断了怎么办』」——这条比「结构封死」扎实，下次都这么问。

## 二、修法复核（方案 B，正确）

- **500ms 空闲巡查** `setInterval(() => card.checkDrift(), 500)`——无 PTY 输出也触发，空闲态收敛。
- **pinToVv 同值跳过**（high-frequency 巡查下值没变不写 style，防空转）——正确。
- **卸载清 timer**——正确。
- **未选方案 A（renderFrame 末尾）**评判正确：renderFrame 同样只在输出/重排/光标闪时跑，光标不闪时照样空闲——治标同病，定时才真覆盖空闲。认可。

## 三、独立复现（我的失败样例，这次自愈了）

上轮我证伪用的正是「mock vv 无事件无输入 → rows 卡 38 不自愈」。本轮同款：
```
ranger open            rows=38  card=620
mock vv=300 无事件无输入 700ms → rows=18  card=300  ← 自愈!(500ms 巡查触发)
+900ms                    rows=18  card=300  ← 稳定
```
**rows 38→18（=floor(300/16.25)）、card 620→300**——无输出空闲态现在 1s 内收敛。覆盖洞闭合。

## 四、回归

bottom-anchor **8/8**（④c 帧驱动 + ④d 空闲巡查双路径）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿。

## 五、结论与下一步

非输出触发补齐、独立复现自愈、无回归。**球交真机 C 档**：ranger/htop 地址栏态**空闲放着不输入**，期望 `overflowBeyondVisible=0`、resized rows=floor(scrollClientH/cellH)、不再「几帧后溢出且不自愈」。

**备注**：这条 ranger 线从「卡身锚→rows/cellH→时序尖峰→输出门控→空闲巡查」，绕了五轮，每轮靠「先看见（遥测/清测）再修」逼近——正是「黑盒→建模型试」方法论在这场硬仗里的完整样本，纪律也已沉淀（trigger-source-cut 自检 + 扰动钉）。

——评审 · 2026-08-26
