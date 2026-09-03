# keybar v3 · 交互状态机清单（行为层规格 · 迁皮件）

> 这是什么：宪法 §6 Step 3——终端快捷键栏（keybar）从手写 DOM 皮迁到
> React 皮的行为层规格。**迁皮铁律：骨全保留，只换 DOM 生成与样式来源。**
> 骨 = keymap.ts（键序/序列映射，有 A 档题盯）+ ModifierState（一次性粘滞）
> + 方向键长按重复机（REPEAT_DELAY 400ms / INTERVAL 65ms）+ IME 四层防线
> （pointerdown preventDefault 保焦点 / 按钮 click stopPropagation /
> bar touchstart preventDefault 防原生 ShowImeIfNeeded / bar click 缝隙兜底）。
> 语义来源：现行实现 keybar.ts（2026-09-03 含方向键长按）+ NA keybar.rs
> 键表对齐纪律 + **0903 用户拍板（第七次仲裁）：两排键面/栏底背景透明化
> （与终端画布 #000000 一致，只留文字）；点亮色 #3d5a99 原色收编为 token
> （采纳实现方建议）**。
> 纪律：**清单用户签收 → 每条转换一颗考卷钉 → 实现 → 变异抽检**。
> 状态：**已签收（0903 用户拍板，装配方案 A）**。
> 考卷蓝本：tests/browser/keybar-click.test.mjs（现行 21 钉全保留不回退，
> 迁皮后原样跑绿）+ 新增迁皮专项钉（§六）。
> 参照体例：docs/tmux-tabs-v2-state-machine.md（试点件）。

## 〇、迁皮范围（什么动、什么不动）

| 层 | 现状 | 迁后 |
|---|---|---|
| 键表/键序 KEYS（两排七列，与 NA 逐格对齐） | keybar.ts | **原样不动**（骨） |
| keySeq 序列映射（appCursor 翻 SS3/CSI） | keymap.ts | **原样不动**（骨） |
| ModifierState 一次性粘滞 | keybar.ts | **原样不动**（骨，纯 TS 类，皮无关） |
| 方向键长按重复机（400/65ms，仅方向键） | keybar.ts | **原样不动**（骨，参数不变） |
| IME 四层防线 | keybar.ts | **原样不动**（骨，一个 Listener 都不许丢） |
| DOM 生成 | `document.createElement` + `style.cssText` 硬编码 | **React 组件**（tsx，reactMount 桥接） |
| 样式来源 | 十六进制字面量散在 cssText 里 | **tokens.css 语义变量**（§五映射表，零硬编码） |
| 装配点 | term/index.ts `mountKeybar(barStripEl, hooks)` | term/index.ts 改调 `reactMount(KeybarApp, barStripEl, {hooks})`（方案 A，见 §七） |

**不在本次范围**：键位增删、键序调整、IME 防线逻辑改写、term 插件输入
管线（send/inputToBottom/takeMods）——这些是骨，碰了就是事故不是迁皮。

## 一、状态枚举（组件层）

keybar 无显隐态（栏恒在，两区模型流内钉输入行上方）。状态全部在「键」上：

| 状态机 | 状态 | 含义 |
|---|---|---|
| 修饰键（CTRL/ALT/SHIFT 各一位，三机独立） | `OFF` | 未粘滞，按钮常规外观 |
| 〃 | `ARMED` | 一次性粘滞已点亮，按钮点亮外观；下一次落字读走清零 |
| 方向键重复机（↑↓←→ 各一机，四机独立） | `IDLE` | 未按下 |
| 〃 | `HELD` | 已按下（已即发一次），未到 400ms 重复门槛 |
| 〃 | `REPEATING` | 按住 ≥400ms，每 65ms 重发中 |
| 直发键（ESC/TAB/HOME/END/PGUP/PGDN/ENTER） | 无状态 | 按下即发，无后续 |

**全局语境**：修饰键三机位掩码 = ModifierState.bits（MOD_CTRL=1 /
MOD_ALT=2 / MOD_SHIFT=4，与 NA 同值）；点亮外观 = bits 的纯函数，
皮不自备第二份状态（单向数据流：骨改 bits → syncMods → 皮重渲染）。

## 二、转换表（手势 → 转换）

| # | 起点 | 手势 | 终点 | 底层动作 |
|---|---|---|---|---|
| K1 | 修饰键 `OFF` | 点修饰键 | `ARMED` | `mods.toggle(bit)` + 点亮 |
| K2 | 修饰键 `ARMED` | 再点同一修饰键 | `OFF` | `mods.toggle(bit)` + 灭灯 |
| K3 | 任意修饰键 `ARMED` | 落字（keybar 直发键 / IME 输入 / inject，全汇入 term 层 takeMods） | 全部 `OFF` | term 层 `mods.take()` 读走位掩码 → mapText 变换落字 → `syncMods()` 灭灯 |
| K4 | 直发键 | 点（pointerdown） | 无状态 | `keySeq(id, appCursor())` 实时读 ?1h → `send(seq)`；按下即发不等抬手 |
| K5 | 方向键 `IDLE` | 按下（pointerdown） | `HELD` | 即发一次（同 K4）+ 启动 400ms 延迟定时器 |
| K6 | 方向键 `HELD` | 400ms 到仍按住 | `REPEATING` | 启动 65ms 步进定时器，每拍重发（appCursor 每拍实时读） |
| K7 | 方向键 `HELD`/`REPEATING` | 抬手 / pointercancel / pointerleave | `IDLE` | 清两个定时器（防御：先清再设，同键异常重按不叠定时器） |
| K8 | 任意 | 组件卸载（父容器摘） | — | 清全部定时器 + 摘 DOM（reactMount unmount 兜） |

**粘滞与直发键的交互**（K3 细化）：点直发键时若 bits≠0，本次发送经
mapText 变换（如 CTRL+→ = 按词跳转），发送后三机全回 `OFF`——一次性
粘滞，联动一次自动灭（Termux 同款语义，NA 对齐）。

## 三、可观测性（实现约束）

- **单向数据流**：ModifierState 仍是唯一真源；皮的点亮 = bits 的渲染结果，
  禁止皮内 useState 镜像一份修饰键状态（双真源=漂移温床）。
- **同步查询钩子**：`__kfmNzKeybar()` 报
  `{ mods: { ctrl, alt, shift }, repeat: { up|down|left|right: 'IDLE'|'HELD'|'REPEATING' }, history }`。
- **事件环形缓冲**：≥20 拍 `{ t, kind: 'press'|'release'|'take'|'toggle', key, mods }`，
  供考卷/后台观测断言转换序列。
- **词汇表强制统一**：`OFF`/`ARMED`/`IDLE`/`HELD`/`REPEATING`，
  清单外状态名=规格外状态≈bug 候选。

## 四、禁止条款

- **P1** 禁止：粘滞位跨落字存活（一次性粘滞，take 后必全 `OFF`）；
- **P2** 禁止：按键抢焦点（pointerdown preventDefault 保诱饵 textarea 持焦，
  焦点走=软键盘收）；
- **P3** 禁止：点按钮/缝隙召唤 IME——四层防线（pointerdown preventDefault /
  按钮 click stopPropagation / bar touchstart preventDefault 防原生
  ShowImeIfNeeded / bar click 缝隙兜底）**一个 Listener 都不许丢**，
  迁皮后逐层有钉盯；
- **P4** 禁止：非方向键重复（REPEAT_KEYS 仅 ↑↓←→，ESC/ENTER 等重复有副作用）；
- **P5**（迁皮新规）禁止：皮内任何硬编码样式字面量——颜色/圆角/字体/
  时长全部经 tokens.css 语义变量，皮文件出现十六进制色值=钉红；
- **P6** 禁止：皮内自备修饰键/重复机第二份状态（单向数据流，骨唯一真源）。

## 五、视觉规格（token 收编映射 + 0903 透明化拍板）

现行硬编码 → tokens.css 语义变量（keybar 专用段，学 tmux-tabs 专用段先例）：

| 现行字面量 | 语义 | 收编目标 |
|---|---|---|
| 栏 `background:#1a1a20` | 栏底 | **透明**（0903 拍板：与终端画布 `TERM_BG #000000` 一致——栏融进终端，不再是一个灰色条块） |
| 按钮 `background:#26262e` | 键面 | **透明**（0903 拍板：常态无键面，黑底上只浮文字；触摸目标仍是 grid 格不变） |
| 按钮 `color:#c8c8d4` | 键字 | `--kfm-key-ink` ≈ `--kfm-ink-2` 档 |
| 点亮 `background:#3d5a99` | 粘滞点亮面 | `--kfm-key-on-bg: #3d5a99`（原色收编为 token；点亮时色块从黑底浮现=唯一可见键面，状态可读性反而更强） |
| 点亮 `color:#ffffff` | 粘滞点亮字 | `--kfm-key-on-ink` ≈ `--kfm-ink` 档 |
| `border-radius:6px` | 键圆角 | `--kfm-radius-sm`（常态不可见，点亮色块的圆角） |
| `font:12px ui-monospace…` | 键字体 | `--kfm-font-mono` |
| 栏布局 grid/gap/padding | 结构 | 结构尺寸留皮内（非颜色不受 P5 管；gap 2px/padding 2px 原样——透明后 gap 不可见，仅作触摸间隔） |

**视觉白名单制**（0903 修订，替代原「视觉零变化」）：迁皮**意图内**的
视觉差只有一处——键面/栏底背景透明化（本表前两行）；除此之外键位几何、
键序、字号、字色、点亮色逐格一致。视觉零变化的来源与方法论见
「迁皮纪律」：无意图变更时前后截图必须逐格相同，不同=事故；有意图变更
时改成白名单豁免，比对钉照样成立。

## 六、考卷映射

| 钉 | 验证 | 手段 |
|---|---|---|
| ①–㉑ | 现行 keybar-click.test.mjs 21 钉（可点达/点即有果/焦点保持/不召唤 IME/touchstart 防线/长按重复⑥行为钉等） | **原样保留**，迁皮后全绿不回退——这就是「骨没动」的机器证明 |
| ㉒（新） | P5 零硬编码 | 皮源文件 grep 无十六进制色值/无 `style.cssText`；DOM computed style 关键色 = tokens 解析值 |
| ㉓（新） | §三可观测钩子 | `__kfmNzKeybar()` 报 mods/repeat/history；点 CTRL→mods.ctrl=true→落字→全 false（K1/K3 序列经 ring 断言） |
| ㉔（新） | 视觉白名单 | 迁前基线截图 vs 迁后截图：豁免键面/栏底背景透明化（0903 拍板项），其余键位几何+字色逐格比对（真机或 headless 同链） |

变异抽检：实现后随机挑一钉做反例注入（如皮内偷偷硬编码一个色值 → ㉒必红）。

## 七、装配方案（签收时拍板）

| | A（推荐） | B |
|---|---|---|
| 挂法 | term 插件装配点内 `reactMount(KeybarApp, barStripEl, {hooks})` | 注册为 kernel 独立插件（id `keybar`） |
| hooks（send/appCursor） | term 直接注入（现状通道原样） | 需经 PluginCtx 传递——ctx 现在没有这两个字段，要预造 |
| 与契约关系 | 不违反（keybar 逻辑本就属 term 域，皮是域内组件） | 更「纯」，但违反「不预造空壳」纪律 |
| 未来平移 | ctx 随契约 §2 扩充后，A→B 一行迁移 | — |

**推荐 A**：最小侵入、零预造；keybar 的「插件化」在逻辑域上早已成立
（term/keybar.ts 独立模块+纯逻辑可测），本次只换皮，不顺手做架构跃迁。
