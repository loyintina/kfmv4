# 2026-08-24 · 评审 · web 终端配色换 NA 同款 + U+E0B0 字形缺失（agnoster powerline 箭头）：请 9.0 改

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 把 nz 终端调色板换成 NA 同款 ANSI_16+f/bg，并捆绑 Nerd Font 使 U+E0B0(powerline 箭头) 正常渲染且 CJK 不塌；A 档三卷+字宽几何不回退；真机/headless 看配色与 NA 一致、`~` 两边箭头正常、中文正常
> 回: —（首信；用户守视 web 终端提示符后拍板）
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：配色+字体落地 @ 1f1fb05a，三考卷不回退+npm 85 绿+headless 截图人审箭头成色中文不塌；附字体就绪门坑说明；球交用户真机 C 档三单并验）· 代际戳 gen-2026-08-24-配色字体

## 一、问题与证据

用户守视 web 终端提示符（oh-my-zsh agnoster 主题，`ZSH_THEME=agnoster`）发现两点：

1. **配色丑**：`root@host`（agnoster 上黄）用 `#cdcd00` 刺眼、蓝 `#0000ee`、底 `#0a0a0f`。nz 调色板在 `nz/src/client/term/palette.ts`，16 色是 xterm classic。NA 用精修板（`kfm-na/src/termview.rs ANSI_16`）。
2. **`~` 两边符号不对**：提示符行实为 `⚡ root@iZ0...Z ⏷ ~ ⏷ `，`~` 两侧各一个 **U+E0B0**（powerline 私有区箭头）——**web 终端字体没有该字形**，渲染成错位色块/空白。根因：`shell.ts:66` / `term/index.ts:176` 用系统 mono 栈（`ui-monospace,Menlo,Consolas,monospace`），**无捆绑字体、无显式 CJK**。

## 二、请 9.0 改

### 1. 调色板 → NA 同款（`palette.ts`）
`NAMED_HEX` 16 色替换为 NA `ANSI_16`（kfm-na/src/termview.rs:89，注释即值）：

| 色名 | NA 值 | | 色名 | NA 值 |
|---|---|---|---|---|
| Black | `#000000` | | BrightBlack | `#555555` |
| Red | `#AA0000` | | BrightRed | `#FF5555` |
| Green | `#00AA00` | | BrightGreen | `#55FF55` |
| Yellow | `#AA5500` | | BrightYellow | `#FFFF55` |
| Blue | `#3B82F6` | | BrightBlue | `#60A5FA` |
| Magenta | `#AA00AA` | | BrightMagenta | `#FF55FF` |
| Cyan | `#00AAAA` | | BrightCyan | `#55FFFF` |
| White | `#AAAAAA` | | BrightWhite | `#FFFFFF` |

`TERM_FG` → `#ffffff`、`TERM_BG` → `#000000`（NA `DEFAULT_FG=0xFFFFFF`/`DEFAULT_BG=0`）。256 色立方（0,95,135,175,215,255）+ 232-255 灰阶两边已一致，不用动。

### 2. 字体 → 捆绑 Nerd Font（放 U+E0B0）+ 保留 CJK fallback
- 给终端渲染层（term 插件/shell.ts 的 font 栈）**捆绑一个含 U+E0B0 的 Nerd Font**（建议 `JetBrainsMono Nerd Font` / `Cascadia Code NF`，具体由 9.0 选，注意体积）+ `@font-face` 引用，**放在字体栈最前**：`'<NF>', ui-monospace, Menlo, Consolas, monospace`。
- **CJK 必须不塌**：中文（小鹤音形）是核心场景，栈尾保留 CJK fallback（`'Noto Sans CJK SC', system-ui, sans-serif` 或系统 CJK）——NF 无 CJK，靠 fallback 兜住；真机（手机浏览器）系统字体兜底，headless 需显式声明。
- **字宽几何必须一致**：换字体后 cell 度量变化，确认 shell.ts 的 cell_w/cell_h 从**实际渲染字体**取（不要硬编码），A 档三卷（bottom-anchor/scrollback/keybar）+ 任意字宽相关断言**不回退**。

## 三、验收

- **A 档**：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 17/17 不回退；palette 单测（若）绿；cell 布局稳定。
- **C 档（headless 可视 + 真机）**：
  - 配色与 NA 一致（黄=棕 `#AA5500`、蓝=品牌蓝 `#3B82F6`、前景白/背景黑，逐色比照）。
  - `~` 两边 **U+E0B0 箭头正常渲染**（不再是色块/空白），agnoster 提示符观感正常。
  - **中文输入/显示正常**（CJK fallback 生效，无豆腐块）。

## 四、备注

- 只改 nz 终端渲染（palette.ts + 字体栈），**不动共享 `.zshrc`**（agnoster 主题连手机，改主题会连手机一起变）——用户拍板走「换 Nerd Font 让箭头渲染」，不改主题。
- 若系统 mono 栈在某环境已含 U+E0B0，则字体改动可降级为「栈前优先 NF」，9.0 判断。

——评审 · 2026-08-24
