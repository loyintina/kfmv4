# 2026-09-02 · nz 报告 · tmux-tabs v2 四步纪律试点收口：考卷 v4 10/10+回归 12 卷零红+node 104/0；三案定罪含一真产品 bug

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无（结果回填；amp 可据此更新笔记验证记录节）
> 收敛判据: 无（试点闭环通报）
> 回: kfmv4-session-registry-amp-notice.md（四步纪律采纳条）
> 回函通知: psh
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：四步纪律试点收口，考卷 v4 10/10+回归 12 卷零红）

## 一、四步纪律执行对账

| 步 | 执行 |
|---|---|
| ①清单用户签收 | ✅ docs/tmux-tabs-v2-state-machine.md（2026-09-01 用户签收；HIDDEN 词汇经用户仲裁移除，0 窗=HANDLE 变体） |
| ②考题先行 | ✅ 考卷 v3→v4：每 transition 一钉（T1/T2/T2a/T3/T3b/T4-T11）+actUntil 劣化网络韧性框架 |
| ③实现 | ✅ 附窗接线+把手重构（图标常在/从其后展开/＋固定右端） |
| ④变异抽检 | ✅ 终验三案定罪全走探针族+dbg 逐环读数+服务器真值互证，零猜测 |

**最终：考卷 v4 10/10 全绿。**

## 二、终验三案（两考卷病+一真产品 bug）

1. **考卷病·非幂等重试**：仲裁语义下「点聚焦芯片」=attach/detach 拨动，actUntil 无脑重试把第一拍的 attach 拆掉（前轮「④ id 错位」假象真身）。修=守卫式 act：只在 `attached=false` 时点；已附未确认=纯等并单列 `attNoScr` 状态。
2. **考卷病·tmux 截断陷阱**：默认 `status-left-length=10` 把 `[kfm-exam-browser]` 截成 `[kfm-exam-`——attach 本身完全成功（`TMUXVAR` 已设/RC=0/状态行在屏底，probe-attach 实证），断言却永远读不到全名。修=夹具自设 40。**教训入册：夹具断言前先验被测系统默认值**。
3. **真产品 bug（考卷立功）**：把手重构时 `OVERLAY_NEW/OVERLAY_CLOSE` 两个渲染分支被整体删除——点＋状态机进 OVERLAY_NEW 但毛玻璃页永不渲染。修=覆盖层归位（z=60 盖标签排，毛玻璃后保留实景，比旧版整页替换更合理）。**这案是「考题先行」价值的活证：若非考卷 ⑤ 的 fill 超时，这 bug 会活着上真机。**
4. 附带修产品病：拖动收尾点击穿透（换序重渲染挪动芯片，松手合成 click 落别的芯片=重排却附带切窗）——拖动完成后 400ms 内抑制芯片点选。

## 三、回归与登记

- 浏览器 12 卷零红：bottom-anchor 10/10、scrollback 5/5、scrollback-cap、keybar-click 20/20、term-hooks 6/6、kernel 4/4、cjk-inktop 4/4、cjk-width-c4 12、render-throttle 3/3、ime-pan 19/19、hot-update 6、mouse-report 9/9。
- node 套件 104 passed / 0 failed。
- §2.7 新登记两行：tmux-tabs 判卷钩子（`__kfmNzTmuxTabs/DbgGet/Snap.ring`）+单症探针族（probe-{click,collapse,attach,drag,push}.mjs）。
- 工作树一并收口：`mountTmuxConnection` server 侧接线（HEAD 悬空欠账）+build.mjs server-hash 看门狗。

## 四、悬置（不挡收口）

- 真机手感 C 档（点聚焦=detach 的拇指实感）待用户；transferSize 数字仍欠（隧道窗口每吞）。
- gamma 建窗后 `set -w automatic-rename off` 与 zsh 首绘改名存在竞态（本次实测组件赢，命名保住；长期归 term-contract 的 tmux 语义夹缝）。

——kfmv4-9.0（nz）· 2026-09-02
