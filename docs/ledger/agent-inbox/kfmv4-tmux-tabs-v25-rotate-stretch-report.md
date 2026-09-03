# tmux-tabs v2.5 闭环通报：把手顺转 90 度 + 标签排伸出/收回，修 strip 选择器双 bug

> 日期: 2026-09-02
> 致: 主会话，评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报；tmux-tabs v2.2→v2.5 迭代链）
> 状态: 通报完毕（2026-09-02 kfmv4-9.0：迭代通报初投）



**致**: 用户 + 评审  
**来源**: nz 9.0 线  
**提交**: `49549275` (`tmux-tabs v2.5: 把手顺转90度+标签排伸出收回，修 strip 选择器双 bug`)  
**时间**: 2026-09-02

---

## 1. 用户要求

1. 把手本身不淡入淡出——它一直存在，与标签排分离处置；展开时**顺转 90 度**，收回时**逆转 90 度**。
2. 标签排要有真正的**伸出/收回**动画，v2.4 只有淡入不够。

## 2. 实现方式

把手/标签排/backdrop 三者全部**常驻 DOM**，用 class 切换驱动 CSS transition：

| 元素 | 收起态 | 展开态 | 过渡 |
|---|---|---|---|
| 把手 `[data-tmux-orb]` | 无旋转 | `.kfm-expanded`→`rotate(90deg)` | transform 250ms `--kfm-ease-out` |
| 标签排 `[data-tmux-strip]` | `.kfm-collapsed`→`scaleX(0)`+`opacity:0` | 无变换 | transform/opacity 250ms，`transform-origin: left center`（从把手右缘伸出） |
| backdrop | `.kfm-collapsed`→`opacity:0` | 可见 | opacity 150ms |

毛玻璃页保留 v2.4 的 `kfm-tmux-overlay-in` animation 不变。

## 3. 自测抓出并修复的两个选择器 bug（本封通报的重点）

v2.5 初版实现后，**加强动画检查脚本时亲测抓出两个真 bug**，旧实现下用户必见：

### bug ①：strip 收起态规则整体失效（strip 常显）

初版 CSS 把 transition 和 `scaleX(0)` 都挂在 `[data-tmux-tabs="EXPANDED"]` 选择器上，但组件收起时该属性值变为 `COLLAPSED`——**收起态下两条规则全不匹配**：strip 没有 scaleX(0)/opacity:0（视觉上永远常显），也无 transition（收回无动画）。

### bug ②：orb 旋转原点被污染

把手展开时也带 `data-tmux-tabs="EXPANDED"` 属性，被 strip 的规则误加 `transform-origin: left center`——`rotate(90deg)` 会绕**左边中点**而非圆心旋转，视觉错位。

### 修法

strip 加独立标识 `data-tmux-strip="1"`，CSS 规则改挂 `[data-tmux-strip]` / `[data-tmux-strip].kfm-collapsed`，与 orb 彻底解耦。`data-tmux-tabs` 的 HANDLE/EXPANDED/COLLAPSED 语义保留（多份考卷依赖），不受影响。

**教训记录**：属性选择器同时承载「状态语义」和「样式钩子」是隐患——状态翻转时样式规则跟着失效，还会误伤共享同一属性值的兄弟元素。样式钩子用独立 data 属性。

## 4. 验证结果（观测手段声明）

| 路径 | 考卷 | 结果 |
|---|---|---|
| L1 状态机 | tmux-tabs.test.mjs | 11/11 绿 |
| L2 服务端交叉 | tmux-tabs-l2-crosscheck.mjs | 5/5 绿 |
| L3 控制台交叉 | tmux-tabs-l3-console-crosscheck.mjs | 3/3 绿 |
| L4 渲染截图（最贴近用户体验路） | tmux-tabs-render-shot.mjs | 6/6 绿 |
| 动画专项（本次加强） | tmux-tabs-animation-check.mjs | 全断言绿 |
| 回归 | bottom-anchor 10/10 · scrollback 5/5 · keybar 20/20 · term-hooks 6/6 · cjk-inktop 4/4 | 全绿 |
| 单测 | `npm test` | 104 通过 / 0 失败 |

动画专项四断言（本次新增，旧实现必红）：

1. **收起基线**：strip `matrix(0,0,0,1,0,0)`=scaleX(0)、opacity 0、transition 在 —— bug ① 的钉
2. **把手收起态**：transform none、`transform-origin: 17px 17px`（圆心，非 left center）—— bug ② 的钉
3. **展开终态**：strip opacity 1；把手 `matrix(0,1,-1,0,0,0)`=rotate(90deg)
4. **收回链路**：再收后 strip 回到 scaleX(0)+opacity 0（伸出↔收回双向完整）

截图落盘：`/tmp/nz-tmux-tabs-animation/expanded.png`（把手居左、标签排右侧伸出、加号固右端）。

## 5. 待用户 C 档验收

真机请验：

1. 点把手：把手图标**原地顺转 90 度**，标签排从把手右缘**伸出**（非淡入）。
2. 再点把手（或点屏幕/滚动/按键）：标签排**收回**，把手**逆转 90 度**回正。
3. 收起后原标签排位置**完全干净**，无残留条影（bug ① 的用户可见判据）。

## 6. 顺带入账

- `bb64ed1a` kfm-v4 shell 端口直配（8021→8032/current.html）补提交——上轮真机验收通过但漏了「改动即提交」，本次补上。

---

## 7. 真机 C 档跟进（2026-09-02 晚，实验台自验）：缓存破坏漏网抓出现行

**经过**：用户开 NZ-Agent 后走 8026 实验台自验。第一读就不对——收起态 strip 实测 `transform:none / opacity:1`（应为 scaleX(0)/0），但 DOM 类名 `kfm-collapsed` 在、`[data-tmux-strip]` 元素在（新 JS）、bundle 哈希 `d973b495`（新包）。**JS 新 + CSS 旧 = tokens.css 缓存漏网铁证**：`build.mjs` 只给 bundle.js 盖内容哈希，tokens.css 是裸 `./tokens.css` 引用，WebView 按启发式缓存留了今晨 v2.4 的旧 CSS。

**判读路径**：真机读数异常 → 对比 DOM 类名与 stylesheet 规则（扫 `document.styleSheets` 无任何 `[data-tmux-strip]` 规则）→ 看 link href 无哈希 → 定性缓存而非实现。全程没动用户活会话（只读 evaluate）。

**修法**：`build.mjs` 给 tokens.css 同盖内容哈希（`tokens.css?v=6bf734db`），与 bundle 同机制（`nz@263e2353`）。回归 animation-check 全断言绿 + tmux-tabs 11/11。

**教训入账**：
1. **新增静态资源引用时，缓存破坏必须与引用同天落地**——bundle 有哈希 tokens 没有，就是「机制存在但覆盖面靠记忆」的破口。以后 index.html 新增任何 `<link>/<script>` 静态引用，先问一句「它有哈希吗」。
2. **真机 C 档价值实证**：headless 全绿照样真机红（headless 每次全新无缓存，永远测不到这类）。「多路验证必有一路最贴近用户体验」的纪律再次兑现。
3. 排障顺序对：先读数（transform/opacity 实测）再分层（DOM 新/CSS 旧）后定性（href 无哈希），没走「再重启试试」的弯路。

**待用户**：重开一次 NZ-Agent（划掉再开，让 WebView 拉新 index.html），我再走 8026 把三条 C 档判据（把手旋转/伸出收回/收起无残留）实测收口。

---

## 8. 真机 C 档收口（2026-09-02 晚，8026 实验台实测，全绿）

用户重开 NZ-Agent 后，全部判据在真机实测通过（cdp-device eval 只读读数 + 真实 click 驱动）：

| 判据 | 真机读数 | 结果 |
|---|---|---|
| 新 CSS 生效 | `tokens.css?v=6bf734db`、`[data-tmux-strip]` 规则在 | ✅ |
| 收起基线（无残留） | strip `matrix(0,0,0,1,0,0)`=scaleX(0)、opacity 0 | ✅ |
| 展开·把手旋转 | orb `matrix(0,1,-1,0,0,0)`=rotate(90°)，origin 圆心 `16.91px 16.91px` | ✅ |
| 展开·标签排伸出 | strip opacity 1、transform none（scaleX 回到 1） | ✅ |
| 收回·逆转回正 | orb transform none | ✅ |
| 收回·无残留 | strip 回 `matrix(0,0,0,1,0,0)`、opacity 0 | ✅ |

**遗憾一笔**：真机截图存证未获——`Page.captureScreenshot` 默认与 `fromSurface:false` 两路均 35s 无返回，设备不产帧（屏幕熄灭/App 退后台的典型特征，与 P1 首睁时 App 新前台截图即成的对照吻合）。不挡收口：三条判据的真机读数已足证，截图下次亮屏补拍。

**排障插曲入账**：8026 初查不通时走 8022 逐段体检——服务器 relay ✅、kalo 隧道 ✅（手机 curl 8028 收到 DIAL）、断点=NZ-Agent 进程死亡（uptime 15h 排除重启；Termux hidepid 下排除法结论）。另有自知噪音两笔：探针 curl 被 relay 当控制信道白发一次 DIAL、`waitingClients` 留过我两个排队客户端——relay 控制口来者不拒+客户端无超时，记账不挡路。
