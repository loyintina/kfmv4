# 2026-08-24 · 9.0 · 8.8.3c scrollback 落地回函：实现全绿，考卷两处需修卷（附证据）

> 日期: 2026-08-24
> 致: 评审
> 流型: 链条
> 预期表态方: 评审（修卷裁决）
> 收敛判据: 评审裁决①b/②b 修卷方案 → 9.0 重跑 A 档全绿 → B/C 档收口
> 回: kfmv4-9.0-scrollback-review.md
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：实现落地 @ 6d261e15，A 档 3/5，两红均为考卷 artifact，附实锤证据+修卷建议）

## 一、实现（6d261e15，按验收契约照做）

- **核**：`history_len()` / `lines_evicted()` / `history_frame(from,to)` 三 API；dump_frame 与 render_frame 共体（协议严格一致）；GridIterator 先走一格再出账，从「目标行上一格」起跳。cargo 钉 6/6（攒行/区间切片/超上限截断丢最旧）。
- **壳**：历史 DOM 块（`.nz-term` 首子元素）增量渲染——首行绝对游标（evicted）对齐：截断摘顶、错位/resize/replay 整段重建、正常只 append 新滚出尾巴（每帧开销 ∝ 新行数，不全量）；光标 nearest 兜底加 `autoScroll` 闸门 + 历史块纵偏移。
- **集中状态机**（纪律照抄，一处实现）：atBottom 初始 true；新输出仅 true 跟底；scroll 事件双向翻转（±5px 容差）；打字/按键栏/IME 落字 = true+立即回底；**合成中不回底**（keydown/input 在 composing 时早退，compositionend 落字才回底）。
- **钩子**：`__kfmNzTermScroll()` → {scrollTop, scrollHeight, clientHeight, isAtBottom, getContainer}，已暴露。

## 二、A 档实测：3/5，两红都是考卷 artifact（非实现行为错）

```
✅ ①历史渲染+翻页 — sh=1658 ch=536
❌ ①上滑后可见历史行 — grid="root@…# seq 1 100   …"（无换行）
✅ ②a 在底+新输出→跟随底 — isAtBottom true→true
❌ ②b 上滑+新输出→不被拽回 — scrollTop 1154→1187 / max 1187
✅ ③打字→输入即回底 — isAtBottom true→true
```

**①b 病根**：grid() = `.nz-term` 的 `textContent`——div 拼接**不含 '\n'**，`/^[ \t]*5[0-9]\s*$/m` 的行锚正则无处命中。历史行其实已渲染（blob 开头就是历史区的 `seq 1 100` 命令行）。实现侧若往行 div 间塞 '\n' 文本节点，会让原生复制出双倍换行，得不偿失。**修卷建议**：grid() 改 `[...document.querySelectorAll('.nz-term div')].map(d=>d.textContent).join('\n')`，或钩子直出 gridText()。

**②b 与 ③ 互斥（实锤）**：两断言流程完全相同（滚到 1/3 → wait 300 → type('echo X\r') → wait 600），期望相反。纪律「打字→isAtBottom=true+立即 scrollToBottom」一旦实现（③ 因此绿），②b 的 scrollTop 必回 max（实测 1154→1187=max）。任何遵守纪律的实现都过不了 ②b；任何过 ②b 的实现都违反输入回底（③ 红）。**修卷建议**：②b 的「新输出」不该由打字产生——改在**在底时**先 type('(sleep 1; echo NO_YANK) &\r')（回底合法），再上滑，等后台输出到达，断言不拽回。这才是「上滑+新输出不拽回」的语义正解。

## 三、B 档千行冒烟（随落地，已绿）

灌 `seq 1 2000`（超 scrollback 上限 1000）：历史 DOM 恒 1000 行封顶、isAtBottom=true、视口在底、无崩溃；再灌 500 行截断稳定（evicted 游标摘顶路径走到）。

## 四、下一步

评审裁决修卷后 9.0 立即重跑；C 档真机上滑实拍/数字收口随修卷后一起。另 C 档观察点预埋：IME 合成中上滑时，浏览器原生「聚焦元素滚入视野」可能拽容器（诱饵钉光标格=底部），合成中不回底纪律 vs 浏览器原生行为的角力需真机确认。

——9.0 · 2026-08-24
