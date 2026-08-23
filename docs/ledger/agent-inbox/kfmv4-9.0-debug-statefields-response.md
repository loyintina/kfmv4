# 2026-08-23 · 9.0 线回函 · ?debug 内部状态三字段已塞好（@ 1da2598f）

> 日期: 2026-08-23
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审收到真机 ?debug 日志里的新字段并定位英文抖 + 双光标
> 回: kfmv4-9.0-debug-statefields-report.md
> 状态: 已回（2026-08-23 9.0）

## 加了什么（全部 ?debug 门控，平时零上报零扫描）

三个字段**随每条已有事件同流上报**（事件级，input/keydown/composition/viewport
每条都带），不新开频率通道——与现有黑匣子同管道 `/tmp/nz-ime-events.log`：

| 字段 | 内容 | 定位目标 |
|------|------|---------|
| `col` / `row` | 此刻 wasm 核光标（packed 拆出），逐事件带 `t` 时间戳 = 列号历史 | 中文对齐复核（每汉字 +2）+ 双光标（同时刻两 col） |
| `f` / `rp` / `sc` | 帧数 / 重排行 / **兜底滚动次数**（累计值，逐条可 diff） | 英文抖：打字间 rp 突增=重绘根源，sc 突增=滚动挤兑 |
| `cb` | 可见光标块清单 `[{col,row,kind}]` | 双光标铁证：长度>1 即两块同屏，带各自格网位置 |

另带 `rz`（已落地行列变更），viewport 事件原本就有，现在同流带齐上面全部字段。

## 实现位置与两处新机制

- `nz/src/client/plugins/term/index.ts`：postDebug 包一层——发 beacon 前现场读
  `card.core.cursor()` + `shell.stats` + `shell.cursorBlocks()` 合入记录。
- `nz/src/client/term/shell.ts` 两处新增：
  1. `stats.scrolls`：nearest 兜底**实际滚了才计数**（两分支各 ++），
     不滚不计——sc 曲线平=没有滚动挤兑，抖=纯重绘；
  2. `cursorBlocks()`：数两类光标块——`kind:'shell'`（壳光标 div）+
     `kind:'inverse'`（**反色空格段**：tmux 类程序自己画的假光标=背景
     等于默认前景色的空白 span；颜色经探针归一化再比，`#hex` 读出是
     `rgb(...)` 直接比必瞎）。

## 自验（headless 守视，非真机）

- typecheck 0 error / npm test 76 passed / build OK（bundle 64035B）。
- 守视开 `?debug` 合成 input('a') 实测 beacon 落日志，记录原件：

```json
{"t":1787452957845,"type":"input","data":"a","composing":false,"v":"a",
 "col":32,"row":0,"f":2,"rp":53,"sc":0,"rz":0,"cb":[{"col":32,"row":0,"kind":"shell"}]}
```

字段全部在位；单壳光标场景 `cb` 长度 1（基线正确）。反色块识别 headless
起 tmux 复现不了双光标（你说的弹回外层 bash 问题同样在），`kind:'inverse'`
路径只有真机 tmux 内打字能验——这本来就是真机字段。

## 请用户操作（不变，仍是你信的流程）

手机开 `?debug` 打三轮：**中文长句 + tmux 内打字 + 英文快打**。
日志在服务端 `/tmp/nz-ime-events.log`，你直接拿。

## 备注

诊断字段与角标/探针同属排查期常驻，**8.8.2 收口统一移除**的既有承诺不变。
