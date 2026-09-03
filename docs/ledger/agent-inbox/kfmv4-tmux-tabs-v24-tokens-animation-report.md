# tmux-tabs v2.4 闭环通报：tokens 单源 + 默认动画落地

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报；tmux-tabs v2.2→v2.5 迭代链）
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：迭代通报初投）



**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `d767c084` (`tmux-tabs v2.4: 接入 tokens 单源，落地 4 个核心默认动画（BeautifulUI 逻辑）`)  
**时间**: 2026-09-02

---

## 1. 本次落地内容

### 1.1 设计 tokens 单源

新增 `nz/src/client/tokens.css`，作为所有 UI 插件的颜色/字体/动画/间距单源：

```css
:root {
  /* 颜色 */
  --kfm-page: #17181a; --kfm-surface: #232427; --kfm-ink: #f2f3f4;
  --kfm-accent: #0a84ff; --kfm-line: #3a3b3f;
  /* 动画时长 */
  --kfm-dur-instant: 80ms; --kfm-dur-fast: 150ms;
  --kfm-dur-normal: 250ms; --kfm-dur-slow: 350ms;
  /* 缓动曲线 */
  --kfm-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --kfm-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --kfm-ease-sharp: cubic-bezier(0.22, 0.61, 0.25, 1);
}
```

- `build.mjs` 已加拷贝逻辑：`tokens.css` → `public/tokens.css`
- `index.html` 已通过 `<link rel="stylesheet">` 引入
- 未来主题切换只需加 `:root[data-theme="light"]` 覆盖，不改组件

### 1.2 tmux-tabs 硬编码迁移

tmux-tabs 所有硬编码颜色/圆角已替换为 tokens 变量：

| 原硬编码 | 现变量 |
|---|---|
| `rgba(10,16,32,0.92)` | `var(--kfm-bar-bg)` |
| `#3B82F6` | `var(--kfm-accent)` |
| `#232833` | `var(--kfm-line)` |
| `rgba(51,65,85,0.85)` | `var(--kfm-chip-bg)` |
| `#F5F7FA` | `var(--kfm-ink)` |
| `#8A93A3` | `var(--kfm-ink-3)` |
| `#cbd5e1` | `var(--kfm-ink-2)` |

### 1.3 四个核心默认动画

按 BeautifulUI「动效即解释、克制 100-350ms」逻辑落地：

| 动画项 | 实现 | 时长/曲线 |
|---|---|---|
| **标签排展开** | `kfm-tmux-strip-in`：opacity 0→1 + translateX(-8px→0) | 250ms `--kfm-ease-out` |
| **标签高亮切换** | `transition: background-color/color` | 100ms `--kfm-ease-sharp` |
| **把手 hover/active** | `filter: brightness(1.1)` / `transform: scale(.96)` | 80ms `--kfm-ease-out` |
| **毛玻璃页弹出** | `kfm-tmux-overlay-in`：opacity 0→1 + scale(.95→1) | 250ms `--kfm-ease-spring` |

---

## 2. 验证结果

| 考卷 | 结果 |
|---|---|
| L1 tmux-tabs 状态/attach/detach | 11/11 绿 |
| L2 服务端交叉验证 | 5/5 绿 |
| L3 清屏重绘 | 3/3 绿 |
| L4 渲染截图断言 | 6/6 绿 |
| bottom-anchor | 10/10 绿 |
| scrollback | 5/5 绿 |
| keybar-click | 20/20 绿 |
| term-hooks | 6/6 绿 |
| `npm test` | 104 通过 / 0 失败 |

动画专项检查 `tests/browser/tmux-tabs-animation-check.mjs`：
- tokens.css 已加载 ✅
- `kfm-tmux-*` keyframes 已加载 ✅
- 把手 transition 已生效 ✅
- 标签排展开 animation 已生效 ✅

截图落盘：`/tmp/nz-tmux-tabs-animation/expanded.png`

---

## 3. 后续纪律

1. **所有新 UI 插件必须引用 tokens**：颜色、动画时长、曲线、圆角禁止硬编码。
2. **动画时长只能在 tokens 里调**：组件里不允许出现 `150ms`、`200ms` 等字面量。
3. **主题切换二期再做**：现在只埋变量层，未来加 `:root[data-theme="xxx"]` 即可。

---

## 4. 待用户 C 档验收

请在真机上：

1. 点击左上角把手，观察标签排是否从把手右侧滑入（约 250ms），不是硬切。
2. 点击不同会话标签，观察高亮背景色是否有过渡（约 100ms），不是瞬间变色。
3. 点击把手图标，观察按压时是否有轻微缩小（scale .96）。
4. 点击 `+` 新建会话，观察毛玻璃页是否轻微弹性放大出现。

如动画未生效，请刷新页面或重启 nz App。
