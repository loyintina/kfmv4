# 2026-08-24 · 评审 · 配色换 NA 板 + Nerd Font 落地复核通过：守视实证箭头成色、中文不塌，交用户真机 C 档

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在用户真机 C 档）
> 收敛判据: 无需回信；用户真机 C 档（配色比照 NA / `~` 两侧箭头正常 / 中文输入显示正常）+ 单区底锚定 + oh-my-zsh 提示符三单并验一次全收
> 回: kfmv4-9.0-palette-font-na-response.md（配色+字体落地 @ 1f1fb05a，headless 截图箭头成色中文不塌）
> 回函通知: psh
> 状态: 已核（2026-08-24 评审：palette 16 色逐值对齐 NA + NF 捆绑 + 字体就绪门，守视截图实证黄蓝亮蓝成色/U+E0B0 箭头/中文不塌，三卷+npm85 全绿；待用户真机 C 档）

## 一、复核：落地正确（代码层逐值 + 守视实证）

- **调色板**：`palette.ts` NAMED_HEX 16 色逐值对齐 `kfm-na/src/termview.rs ANSI_16`（黄 `#AA5500`/蓝 `#3B82F6`/亮蓝 `#60A5FA`/品红·青·白等全对其），`TERM_FG #ffffff`/`TERM_BG #000000`（NA DEFAULT_FG/BG）。@ff 无漂移。
- **字体**：`JetBrainsMonoNLNerdFontMono-Regular.ttf`（2.4MB）入仓 `public/fonts/`，`index.html @font-face`（family `JetBrainsMonoNL NFM`）；`TERM_FONT_STACK` 抽成共享常量（NF 打头 + ui-monospace/Menlo/Consolas + 栈尾 CJK fallback），壳渲染与量字格探针同栈同源。
- **字体就绪门**：`open()` 量格前 `await document.fonts.load('13px JetBrainsMonoNL NFM')`——防 @font-face 异步加载拿 fallback 字宽、落地后字宽突变 cell 不刷的错位坑；加载失败回落系统 mono，度量与渲染仍同源。**这个坑 9.0 主动补上，正确。**

## 二、守视实证（我亲自截屏，900×620 headless）

`printf '\033[33m黄\033[34m蓝\033[94m亮蓝\033[0m 你好world'` 输出渲染：
- **黄=琥珀 `#AA5500`、蓝=品牌正蓝 `#3B82F6`、亮蓝=`#60A5FA`**——三种色值与 NA 板逐一对上，不再是旧 xterm 刺眼黄/深蓝。
- **黑底白字**：`你好world` 白字、容器纯黑底。
- **`~` 两侧 U+E0B0 powerline 箭头**：全部提示符行渲染成蓝色箭头（不再是色块/空白）。**字形缺失根治。**
- **中文不塌**：黄/蓝/亮蓝/你好world 全部正常渲染（headless 服务器 fc-list 0，chromium fallback 兜住；真机栈尾三件套声明兜底）。

## 三、回归

- **A 档三卷**：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 17/17（贴底断言天然覆盖字宽几何——换字体后度量自洽，无误伤）。
- **npm test 85 全过**；build + typecheck 全绿。

## 四、结论与遗留

落地正确、无回归、守视实证符合 NA 观感。**球交用户真机 C 档**：配色比照 NA / `~` 两侧箭头正常 / 中文输入显示正常，与单区底锚定、oh-my-zsh 提示符**三单并验一次全收**。

**遗留登记**：M3 基线两图（`term-fresh.png`/`term-sgr-cjk.png`）因配色/字体即本次变更标的**预期失效**，C 档真机收口后按口径重拍。

**备注**：9.0 帮我补了我原信里 `palette.ts` 裸路径的 `nz/` 前缀（check-docs broken-ref 修复，98101434），已核验落地，感谢。

——评审 · 2026-08-24
