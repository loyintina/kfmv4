# nz C 线产出：终端核考卷覆盖审计（nz ⇄ na 矩阵 + 一处跨线缺口）

> 日期: 2026-09-13 深夜
> 从: nz 探坑场 C 线（轻量盘点，用户拍板「只补缺的钉，不铺摊子」）
> 致: na 线（终端实现参考）+ kfmv4 服务端线（缺口行动项）
> 流型: 链条
> 预期表态方: kfmv4 服务端线（是否立项移植模式位账本）；na（矩阵勘误/补充）
> 收敛判据: 双方表态收讫；若立项，8021 模式位账本排期落账即收敛
> 回: 无前信（C 线主动产出）
> 状态: 已发（审计矩阵+缺口定位；无代码变更）

## 一、覆盖矩阵（ pit → 双线覆盖 → 缺口）

| # | 坑 | nz 覆盖 | na 覆盖 | 缺口 |
|---|---|---|---|---|
| 1 | 网格喂入/SGR/宽字落地 | term-core cargo `feed_plain_lands_on_grid` `feed_sgr_and_cjk` | alacritty_terminal 0.25 上游承载 + termview_spec 渲染像素钉 | 无 |
| 2 | resize 保内容 | cargo `resize_keeps_content` | termview_spec `spec_渲染_resize后正常` | 无 |
| 3 | APP_CURSOR（C3） | cargo `app_cursor_tracks_decckm` + keymap.ts | keymap_spec（C2/C3 契约钉） | 无 |
| 4 | ALT 屏跟踪 | cargo `alt_screen_tracks_mode` | alacritty 上游承载（termview 不自管 ALT） | 无 |
| 5 | 鼠标模式跟踪 | cargo `mouse_mode_tracks_sgr` + 壳 mouse-report 8/8（真 tmux 判卷） | scroll_spec SGR 1006 滚轮编码 | 无 |
| 6 | 宽字符占格/行尾整字换行（C4） | cargo `c4_wide_char_at_row_end_wraps_whole` + cjk-width-c4 卷 | spec_c4_*（判卷尺 dump_text） | 无（契约对拍已过） |
| 7 | scrollback 压帽 | cargo `history_frame_appends_and_truncates` + SCROLLBACK_LINES=1000 单源 | termview_spec `spec_scrollback_容量钉死显式值`（10000） | 无（容量值有意分歧，契约登记在案） |
| 8 | **模式位账本+核重建回放** | ✅ 全链：服务端逐管道账（scanModes carry 防劈开）+ attach 帧带 modes + 客户端先回放位再喂屏面（term-modes 3 钉 + organ 卷） | ❌ **双缺**：kfmv4 8021 服务端无账本（grep scanModes/1049 零命中）；na 重连路径无回放语义 | **真缺口** |

## 二、缺口 #8 定性（与 nz 半屏案同根）

na 是 kfmv4 8021 的客户端。8021 的 terminal-pty 断线重连只回放 tail 不回放
模式位 → WS 重连后 mouse/ALT 位丢失，鼠标手感随机复活（与 nz 滚轮手感案
同机制、同 lottery：位随窗格应用重启随机在场）。nz 已于 2026-09-13 全链修好
（a68c59b1 + 今日 B 线延伸），实现可直接抄：

- 账本纯函数：`nz/src/server/term-connection.ts` `scanModes` / `serializeModes`
  （MODE_TRACKED = {1000,1002,1003,1006,1049,2004}；carry 首尾拼接治序列跨
  chunk 劈开；Set 幂等）
- 回放时机：attach/重连帧先带 modes，客户端**先回放位再喂 tail**（1049h
  先进 ALT 再画屏面才语义正确）
- 考卷：`nz/tests/term-modes.test.ts` 3 钉可直接镜像为 kfmv4 侧考卷

工作量估计：8021 服务端 ~100 行 + 3 钉 + na 客户端回放消费 ~30 行。

## 三、结论

- C 线原拟「补三钉」：两钉（ALT 边界/压帽）双线已有覆盖，**无需新考卷**；
  第三钉（模式位回放）不是考卷缺口而是 kfmv4 服务端功能缺口。
- **建议**：kfmv4 服务端另立项移植模式位账本（抄 nz 现成实现），na 同步加
  回放消费；在此之前 na 重连后鼠标失灵属已知 lottery，勿当新 bug 排查。
- nz 侧考卷资产（term-core cargo 9 钉 + term-modes 3 钉）与本文矩阵即为
  「na 抄答案」C 线交付物；后续两线语义漂移仍走 two-line audit 流。
