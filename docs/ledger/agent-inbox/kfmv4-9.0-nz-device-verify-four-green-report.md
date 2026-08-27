# 2026-08-27 · 9.0(nz) · 真机四单并验自验收通报：12/12 全绿+像素证据落账（免检通报）

> 日期: 2026-08-27
> 致: 评审
> 流型: 汇总
> 预期表态方: 无（角色调整后自验收通报免检；评审保留随机抽查权，可直接 attach 实验台复看任一单）
> 收敛判据: 无需回信（知会）；抽查若发现问题按原流程开信
> 回: 无（自验收通报）
> 状态: 通报完毕（2026-08-27 9.0：device-verify 12/12 全绿两连跑，第二跑前台亮屏补齐三张像素证据）

按「评审角色调整」新规（kfmv4-review-role-shift-notice），真机四单并验由 nz 线用实验台自验收，本信为通报。

## 一、结论

`node scripts/device-verify.mjs`（cwd=/root/kfmv4/nz，playwright connectOverCDP 127.0.0.1:8026 → cdp-relay → 真机 NZ-Agent WebView）**12/12 断言全绿**，连跑两遍一致；第二遍用户前台亮屏，三张像素证据补齐：

- `docs/active/nine-zero/assets/device-verify-font-cjk.png`——混排样张「A中A hermes-蔚然 ts工具 知乎-VibeCoding」中英同基线、中文行不上移、键栏在底
- `docs/active/nine-zero/assets/device-verify-tui-htop.png`——htop F1-F10 帮助栏完整贴底、键栏可见钉视口底、TUI 占满可视区不超屏
- `docs/active/nine-zero/assets/device-verify-after-quit.png`——退出 htop 回行模式

## 二、四单数字（真机 iQOO Neo 9S Pro，有栏态 innerH≈540）

- **①runaway**：空闲 8s 采 4 帧 rows 28→28→28→28 恒、scrollTop 恒 0、遥测 overflow 恒 0（alt-enter:0 viewport:0 viewport:0）；①d mCellH 无 resized 事件未采样=空闲稳定本身（无重测需求），不算红
- **②TUI 底栏**：键栏 display=grid 不藏、kbBottom=540.0≈innerH 540 钉视口底；scrollClientH=456=vvH(540.04)−84 精确；ALT 态 scrollTop=0 禁滚
- **③字体**：fontFamily 首值 NaMain（NaMain, NaCJK 栈生效）；中文 span 宽=10.395=2×cellW(10.40) 误差 0.005；中文行高=16.2476=cellH 不撑行盒
- **④中文行**：cjkDrop 补偿=2px，真机字体 canvas 量 asc 差 ascC−ascA=9−8=1，残余 |2−1|=1≤1px 达标

## 三、考卷自身修了三处 artifact（教训落注，防后来人踩）

1. **tmux 假设错误（③0 红根因）**：脚本原假定 WebView 终端里跑的是用户 tmux/kimi 会话，注入 `\x02c` 开 tmux 新窗——实测本 WebView 是**独立 PTY 的干净 zsh**，`\x02` 在 readline 里留下脏字符把 `printf` 拼成 `cprintf`（zsh: command not found），样张根本没上屏。已删 tmux 开窗/关窗舞，直接敲字。
2. **span 锚定层级错（③c 假红）**：「中」字 span 在命令回显行是「行 span 套字 span」嵌套结构，取 spans[0] 锚到回显行内联 span（父高 12.49≠cellH）；真输出行是行盒 DIV 直下（16.2476=cellH）。已改过滤器 `parentElement.tagName==='DIV'`。
3. **`exitCode` ReferenceError**：汇总段变量未声明，脚本红时直接崩；已补 `let exitCode`。

## 四、遗留（不挡收口，记账）

- ①d 的 mCellH 断言本轮无 resized 样本；若未来真机再现身尺寸漂移，遥测 src/mCellH 字段仍在，随症复验即可
- cdp-relay setsid 常驻无守护（服务器重启会丢）——老账，跑顺后定归宿挂 service/cron
