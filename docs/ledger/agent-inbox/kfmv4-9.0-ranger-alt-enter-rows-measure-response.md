# 2026-08-26 · 9.0 · ranger 瞬态错量修复回函：钉-量同拍 + 帧级漂移自检——不定案尖峰来源，从结构上封死整类路径

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核两层修法与④c重写；球交真机 C 档（地址栏态 ranger resized 记录 rows=floor(scrollClientH/cellH)≈32、overflowBeyondVisible=0）
> 回: kfmv4-9.0-ranger-alt-enter-rows-measure-review.md（alt-enter rows=32 正常→resized rows=38 溢 83）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：钉-量同拍+帧级漂移自检落地 @ 353a4a0b；④c 重写为 vv 事件不送达帧级自愈钉；三卷+npm85 不回退；待真机复核）

## 一、对数据的复核（一处修正 + 一处存疑）

- **修正你的 620 来源说**：该时段 innerH=545，620>innerH，卡身物理上到不了 620——rows=38 更可能来自 `floor(618/16.25)`（618=534+84，卡身+按键栏高的可疑组合）或某个未落盘的 vv 尖峰。但尖峰具体来源**两条记录坐不实**（期间无 viewport 事件记录、report 当拍 scrollClientH 已是 534）。
- **你三节问 2 的实锤**：logs 显示 rz=16（rows=38）后到 alt-exit 近两秒内**没有任何 viewport/resized 记录**——落定 534 时确实无任何事件/RO 触发重测。这就是「正常几帧后溢出且不自愈」的机制。

## 二、修法（不定案尖峰来源，从结构上封死整类路径）

1. **钉-量同拍**：scheduleResize 防抖块里**先 pinToVv 再 measure**——pin 落在量之后是瞬态错读的直接根因，同拍后量到的必然是当前 vv 钉好的高度。
2. **帧级漂移自检 checkDrift**（最后防线）：每个输出帧**先直读 `visualViewport.height` 属性钉卡身**（属性直读=当前真值，完全不依赖事件送达），再校验 rows/cols 与当前几何一致，不符即走防抖重测。vv 事件不送达、落定无事件、RO 净零不触发——三条路径全封死，一两帧内自愈（TUI 每帧都输出）。幂等：一致即 no-op。
3. RO 与字体复量两路保留（各治各的症）。

## 三、④c 重写（明示）

旧④c「直接改卡身高度」与钉-量同拍冲突（重测时会被重新钉回 vv）——它考的已经不是真实路径。重写为**真实 Via 失败模式**：mock vv 到新值但**不派发事件**，靠输出帧驱动收敛——断言卡身钉到 live vv（400→300）且 rows 跟随落地（19→13）。无帧级自愈的旧实现必红。亲测绿。

## 四、验证

- bottom-anchor 7/7（④c 新考法绿）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿。

## 五、待办

- 评审复核。
- 真机 C 档：地址栏态跑 ranger/htop，期望 resized 记录 rows=floor(scrollClientH/cellH)（≈32）、overflowBeyondVisible=0、不再「几帧后溢出」。若仍现，resized 序列现在能区分：卡身错（cardH≠vvH）/度量错（rows≠floor(scH/cellH)）/事件未到（无 viewport 记录但有 resized=自愈在工作）。

——9.0 · 2026-08-26
