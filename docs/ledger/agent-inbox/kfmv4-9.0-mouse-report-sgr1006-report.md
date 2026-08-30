# 通报：鼠标报告 SGR 1006 转正（term-contract 挂单核销）

发：dsh（9.0 线） 收：psh（评审） 日期：2026-08-30 状态：收口（A 档 8/8 + 真机 C 档 4/4，自验收通报免检制）

## 起因

用户痛点：nz 终端里 `tmux attach` 后上下滚动无效。双堵定罪（复现实锤，脚本 nz/experiments/dbg-tmux-scroll.mjs）：①tmux 走 alt screen → ALT 态三路禁滚（runaway 对策）histLen=0 无回滚区；②滚轮→SGR 1006 未实现 → tmux（mouse on）收不到滚轮、进不了 copy-mode。

## 实现

- 核：`mouse_mode()` 位图（bit0=MOUSE_MODE 任一/bit1=SGR_MOUSE；rio-vt 的 MOUSE_MODE 组合掩码不含编码位，故两位分报），rust 单测 9 绿。
- 壳（plugins/term/index.ts + shell.ts）：wheel(passive:false) 激活时 preventDefault 发 `\x1b[<64/65;col;rowM`；触摸拖拽合成滚轮（2 行 px=1 notch，上滑=64）；tap=左键 press+release；touchmove 兜底拦本地滚动；坐标换算 shell.cellAtPoint（历史区/越界 null 不上报）。未激活时行为全照旧。
- 边界：编码一律 SGR（X10/UTF8 旧编码不覆盖）、拖拽选择 motion 未实现——均已记档。

## 验收数字

- A 档 `nz/tests/browser/mouse-report.test.mjs` **8/8**：真 PTY+真 tmux scrtest（服务端 pane_in_mode/scroll_position 判）、WS 帧字节断言（坐标 1 基）、行模式/ALT 无鼠标零鼠标帧、触摸合成。
- 真机 C 档 `nz/experiments/verify-mouse-device.mjs` **4/4**：实验台 attach，滚轮上→copy-mode scroll_position=20、触摸拖拽→20→55、滚轮下→回底；截图取证 docs/active/nine-zero/assets/mouse-device-copymode.png（copy-mode 指示 [55/259] 可见）。
- 回退：五卷 10+5+19+6+4 + npm 90 + rust 9 + typecheck 全绿。
- term-contract 挂单已转正入账，nz/TASK.md 已记。

## 顺手两条真机实锤修复（C 档的实证价值）

1. **热更断腿**：term-core glue/wasm 走 immutable 一年缓存但 URL 无 hash——wasm 重编函数表移位，真机抱旧 wasm 配新 glue = `null pointer passed to rust`。已改 no-cache（协商 304，变更才全量），与 splash-core.js 同款先例。
2. **锈指针钩子**：`__kfmNzTermScroll` 闭包裸抓 `core` const，replay 重连 free 换新核后全钩抛锈错（服务器重启即触发）。已改 `card.core` 活引用，全库裸 `core.` 已扫净。

## 实验台边界记档（待 relay 排查）

CDP `Input.dispatchMouseEvent/dispatchTouchEvent` 经 cdp-relay 首 send 即挂起无应答（实测两次），`Page.captureScreenshot` 超时——引擎级输入/截图暂不可用。本期绕行：页内合成事件（同一监听链）+ canvasShot 像素眼。最终手感球交用户真指。

## 球

用户真机手感验收：nz 终端里 `tmux attach -t dsh` 后手指上滑翻历史。
