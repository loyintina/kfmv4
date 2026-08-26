# 2026-08-26 · 评审 · ranger「先正常几帧后溢出」确诊：alt-enter 重测 rows 用了瞬态高度(620)非钉后真高(534)——遥测实锤

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 定位并修「alt-enter(及任何视口收缩)时 rows 重测用瞬态全高(620)而非钉后真高(534)」→ rows=floor(settled scrollEl.clientHeight/cellH)；真机 ranger/htop 地址栏态 rows≈32、overflowBeyondVisible=0
> 回: kfmv4-9.0-ranger-rows-not-shrink-response.md（10ad116b 两路自愈，未堵住本条）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：钉-量同拍+帧级漂移自检落地 @ 353a4a0b——不定案尖峰来源，结构封死整类路径；④c 重写为 vv 事件不送达帧级自愈钉；三卷+npm85 绿；待评审复核+真机 C 档）· 代际戳 gen-2026-08-26-帧级自愈

## 一、真机遥测实锤（用户 ranger，agent 直读日志）

用户反馈「输入 ranger/htop 后先是正常，维持几帧后开始往上超视口」——日志精确捕获这一时序：

```
alt-enter { vvHeight=534 innerH=545 cardH=534 layoutMinusVisual=11
            rows=32  scrollH=534  scrollClientH=534  overflowBeyondVisible=0   ← 正常（填满534）
        }  rz=15
resized   { vvHeight=534 innerH=545 cardH=534 layoutMinusVisual=11
            rows=38  scrollH=617  scrollClientH=534  overflowBeyondVisible=83  ← 溢出（几帧后）
        }  rz=16
```

**数学**：rows=38 = floor(**620**/16.25)；而可视区 `scrollClientH=534` 只装得下 floor(534/16.25)=**32** 行。ranger 以 38 行渲染 → 38×16.25=617=scrollH > 534 → 溢 83。**这就是用户看到的「正常(32行)→几帧后(38行→溢)」。**

## 二、根因（与 10ad116b 不同路）

10ad116b 修的是「cellH 落到 fallback 值」+「vv 事件不送达」。本条**不是**：
- `cellH=16.25`（正确 NF 值，非 fallback）；
- vv 事件到了（viewport/resized 记录都在、rz 递增）。

**真凶 = resized 重测 rows 用了一个瞬态高度 620，而不是卡身钉好后的真高 534**：
- alt-enter 时 keybar 收起 → scrollEl 变全高（container 此刻仍是**开页时的 620**，vv 还没钉到 534）→ measure 读 `scrollEl.clientHeight≈620` → rows=floor(620/16.25)=**38**；
- 随后 `cardH` 被 vv 钉到 534、`scrollEl=534`（scrollClientH=534），**但 rows 没再重测成 32**（RO/ResizeObserver 没在这次 620→534 收缩时触发 rows 重测，或触发了但读到的高度仍错）。

**即：卡身（vv 当拍即钉）与 rows（measure）两条路不同步，且 rows 读到了钉前的瞬态高度。**

## 三、请 9.0 定位

1. **alt-enter 触发 resized 重测时，`scrollEl.clientHeight`（或 measure 用的高度）为何是 620 而非 534？** —— 是卡身 vv-pin 与 rows 重测的**时序**问题（pin 在 rows 之后落地），还是 measure 读的是 `container`（620）而非实际 `scrollEl`（534）？
2. **为何 rows 在 620→534 收缩后没再重测回 32？** ResizeObserver 是否对「container 高度 620→534」这条路径触发？触发后 measure 是否又读到了错高度？
3. 期望：**任一次卡身高变化（vv 钉/keybar 收/ALT）后，最终 rows = floor(settled scrollEl.clientHeight / cellH)**，resized 记录即终值（32），不再有「38 vs 534」的错配。

## 四、验收

- 真机 ranger/htop：地址栏可见态（layoutMinusVisual≈11~48）`resized` 记录 `rows==floor(scrollClientH/cellH)(≈32/49 )`、`overflowBeyondVisible=0`。
- headless 若能复现（模拟 address-bar-pin 与 keybar 收起时序）更好，加一条「alt-enter 后 resize 收缩 rows 应跟随」的扰动钉。
- A 档三卷（bottom-anchor 7/7 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。

## 五、备注

- 这次完全靠 Stage① 遥测抓到「几帧后」这本来看不见的时序——正是「黑盒→建模」路线该有的样子：不改代码、只读日志，就定位到真机专属的瞬时 bug。

——评审 · 2026-08-26
