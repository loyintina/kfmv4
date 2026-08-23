# 2026-08-23 · 9.0 线回函 · 双光标+英文抖双修落地（@ f1de48db）——附两处根因的 deeper 定性

> 日期: 2026-08-23
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审收讫修法与自验数据；用户真机复测后拿 cb/sc/rp 对账
> 回: kfmv4-9.0-ime-doublecursor-jitter-review.md
> 状态: 已回（2026-08-23 9.0）

## 一、双光标：根因比你信的定性再深一层

你的实锤（cb 长度 2：shell@col5 + inverse@col6 相距 1 格）成立，但根因不在
「检测把 inverse 当光标块」——**检测是对的，渲染错了**：

rio-vt 核内部一直在记 DECTCEM `Mode::SHOW_CURSOR`（?25h/?25l），但我们的
wasm 包装从没把它暴露出来。tmux 里的 TUI（dsh 会话）会发 `?25l` 藏掉终端
光标、自绘反色块当自己的光标——**壳光标该跟着藏却没藏，变成灰鬼影，与程序
自绘的白反色块并排**。「一灰一白」完全对上：灰=我们的鬼影，白=程序的真光标。

**修法（已落地）**：
- `term-core/src/lib.rs` 新增 `cursor_visible()`（读 `term.mode().contains(SHOW_CURSOR)`）；
- 壳 renderFrame 光标分支加 `core.cursor_visible()` 条件，核说藏就藏；
- 探针/beacon 同步带 `vis`/`cv` 字段（对账用）。

这是「模拟器忠实度」问题而非「检测口径」问题——真终端此刻也只画一个光标。

## 二、英文抖：sc 口径回答 + 真根因（滚动拔河）

**你问 sc 计哪种滚动**：只计 renderFrame 里 nearest 兜底**实际改了 scrollTop**
的次数（光标行被遮才滚，两分支各 ++；能不滚就不滚）。不计 resize（那条路
上轮已砍）、不计浏览器自发滚动。

**sc 每键 +1 的真根因**：滚动拔河。隐藏 textarea 诱饵钉死在 `0,0`，而移动
浏览器**每次 input 都把聚焦元素滚进视野** → 容器 scrollTop 被拽回 0 →
renderFrame 兜底发现光标被遮又滚下去 → 每敲一字一次来回 = 从上到下闪烁。
rp 暴涨是拔河的次生灾害（滚动/可视区抖动链放大重绘）。

**修法（已落地，xterm 同款纪律）**：
- 诱饵 textarea **跟随光标格定位**（`placeKb()`：left=col×cellW, top=row×cellH，
  每帧后调用）——浏览器想滚去的位置正好是我们要的位置，拔河从根上消失；
- 聚焦改 `kb.focus({preventScroll:true})`，点击聚焦本身也不再抢滚动。

## 三、自验（守视 headless，真机口径等你复测）

typecheck 0 / npm test 76 passed / build OK（wasm 重编，bundle 64349B）。
守视开 `?debug` 实机打命令验证：

| 动作 | 结果 |
|------|------|
| 打 `printf '\e[?25l'` 回车 | `__kfmNzTermCursor().vis` → **false**（藏显传导成功） |
| 打 `printf '\e[?25h'` 回车 | `vis` → **true**（恢复） |
| 诱饵位置 | `kbLeft=250.5px = col32×7.828`，`kbTop=16.25px = row1×16.25`——**钉在光标格上** |
| beacon 记录 | `cv` 字段在位（指令执行前 true，与探针一致） |

headless 验不了的两点（老问题）：tmux 内双光标场景、真 IME 滚动拔河——
这两个本来就是真机字段，请你侧按同口径复验。

## 四、请用户复测（同口径对账）

手机 `?debug` 两轮：
1. **tmux 内打字**：`cb` 应恒 ==1（只剩 inverse 块或只剩 shell，不再成双）；
2. **有内容英文快打**：`sc` 应走平（不再每键 +1），`rp` 增幅应 ≈ 每键 1-2 行。

## 五、收尾承诺不变

`placeKb`/`cursor_visible` 是正式功能（收口保留）；角标、`cv`/`cb` 等诊断字段、
`?debug` 事件流仍属排查期常驻，**8.8.2 收口统一移除**。
