# 2026-08-24 · 9.0 · 配色换 NA 板+Nerd Font 落地回函：headless 截图人审箭头成色、中文不塌

> 日期: 2026-08-24
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核落地；球交用户真机 C 档（配色比照 NA/U+E0B0 箭头/中文正常）随底锚定+oh-my-zsh C 档并验
> 回: kfmv4-9.0-palette-font-na-review.md
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：配色+字体落地 @ 1f1fb05a，三考卷不回退+npm 85 绿+headless 截图人审箭头成色中文不塌；待评审复核+用户真机 C 档）

## 一、落地内容（对应信二节）

1. **调色板 → NA 同款**：`palette.ts` NAMED_HEX 16 色逐值对齐 `kfm-na/src/termview.rs ANSI_16`（已对照源码 89-106 行核实，与信表格一致：黄 `#AA5500`/蓝 `#3B82F6`/亮蓝 `#60A5FA`）；`TERM_FG #ffffff`/`TERM_BG #000000`。256 色立方+灰阶两边本已一致，未动。
2. **字体 → 捆绑 Nerd Font**：`JetBrainsMonoNL Nerd Font Mono Regular`（v3.4.0，NoLigatures Mono 变体——图标严格单宽、无连字干扰等宽语义；2.4MB ttf 入仓 `nz/public/fonts/`，jsdelivr 路径 404 两轮后改 raw.githubusercontent 直链拿到）；`index.html` `@font-face` 声明（family 名用字体内 nameID=1 实测值 `JetBrainsMonoNL NFM`）。
3. **字体栈**：抽共享常量 `TERM_FONT_STACK`（shell.ts 导出）——NF 打头 + ui-monospace/Menlo/Consolas + 栈尾 CJK fallback（Noto Sans CJK SC/PingFang SC/微软雅黑）；壳渲染与 term/index.ts 量字格探针**同栈同源**。
4. **字体就绪门**（信未提、实现侧必须补的坑）：`open()` 量字格前 `await document.fonts.load('13px JetBrainsMonoNL NFM')`——@font-face 异步加载，不等会拿到 fallback 字宽、字体落地后渲染字宽突变而 cell 缓存不刷 = 光标/裁切错位。加载失败不挡路（回落系统 mono，度量与渲染仍同源）。

## 二、验证数字

- build + typecheck + npm 85 全绿；**三考卷不回退**：bottom-anchor 5/5（贴底断言天然覆盖字宽几何——换字体后度量自洽）、scrollback 5/5、keybar-click 17/17。
- **headless 截图人审**（900×620，printf SGR 黄/蓝/亮蓝粗+中文混排）：U+E0B0 箭头正常成色（`~` 两侧蓝色 powerline 箭头）、黑底白字、黄=棕/箭头=品牌蓝、中文混排对齐不塌、底锚定正常、光标块位置正确。
- 共享 `.zshrc` 未动（用户拍板：换字体让箭头渲染，不改主题）。

## 三、备注与遗留

- **M3 基线两图预期失效**（配色/字体即本次变更标的）——C 档真机收口后按口径重拍 `term-fresh.png`/`term-sgr-cjk.png`。
- headless 服务器无系统 CJK 字体（fc-list 0）但截图中文正常渲染（chromium fallback 兜住）；真机 CJK fallback 栈尾三件套按评审口径声明。
- 信四节降级分支未触发（系统 mono 栈无 U+E0B0 是实锤症因，捆绑为必经路）。

## 四、待办

- 评审复核（亲跑三卷 + 可 headless 截图比照）。
- 球交用户真机 C 档：配色比照 NA / `~` 两侧箭头正常 / 中文输入显示正常——与单区底锚定、oh-my-zsh 提示符三单并验，一次真机全收。

——9.0 · 2026-08-24
