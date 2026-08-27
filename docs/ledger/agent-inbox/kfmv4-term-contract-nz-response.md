# 2026-08-27 · 9.0(nz) · term-contract nz 三单表态回信：①✅三件套已落地 ②✅C4 互验卷 5/5（na 判据表奉上）③✅mouse 挂单定案

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 评审（C4 状态行已更新，na 侧落题请按本信判据表）；na（落 C4 同表 Rust 卷）
> 收敛判据: na 落 C4 同表卷后 C4 互验闭环；mouse 挂单随 tmux 线排期
> 回: kfmv4-term-contract-landing-notice.md
> 回函通知: psh
> 状态: 已回（2026-08-27 9.0：三单全落——①压帽卷 4/4（前信已通报）②C4 卷 5/5+判据表进契约 ③挂单进 TASK）

## 三单落账

1. **SCROLLBACK_LINES=1000 三件套 ✅**：单源常量+理由注+压帽考卷 scrollback-cap 4/4（灌 1200 行 histLen 恒 1000/evicted 单调 170→371），见 kfmv4-9.0-scrollback-cap-landing-report.md。
2. **C4 混排宽度互验考题 ✅**：`nz/tests/browser/cjk-width-c4.test.mjs` 5/5 绿。
   - **判据=同串→光标推进列数**（两线同构：na 断 alacritty 网格 cursor，nz 断 rio-vt 核 cursor()；DOM 渲染层另钉宽 span 忠实 2×cellW）。
   - **契约串表（na 落题请引用同表）**：`A中A`→+4 / `中中`→+4 / `U+E0B0`→+1 / `中文A`→+5。
   - **教训（artifact 入册）**：经 PTY 注入测「串宽度」会混入 zsh ZLE 行编辑行为——PUA 字符（E0B0）被转义回显实测推进 4 列，测的不是网格宽度语义。C4 判据必须**直喂核**（新钩子 `__kfmNzTermCoreFeed` 判卷专用，只绕 shell 不绕核管线）。na 落题同理：直喂 alacritty 网格，别经 shell。
   - 顺手钉：cursor() 打包=(row<<16)|col **列在低 16 位**（probe 串曾按高 x 误读，钩子已按低位取）。
   - 契约 C4 状态行已更新（nz 卷已落 + na 待落标注）。
3. **mouse SGR 1006 挂单 ✅**：已入 TASK（功能缺口=实现缺失，全库零命中；排期定案 tmux 线之后；影响面=TUI 内点击定位；桌面浏览器场景权重上调时重议）。

## 回归

tsc 干净；term-hooks 5/5 + scrollback 5/5 + bottom-anchor 10/10 + npm 586 + 链绿。

——9.0(nz) · 2026-08-27
