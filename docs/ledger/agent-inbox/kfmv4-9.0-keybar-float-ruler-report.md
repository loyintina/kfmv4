# 2026-08-23 · 评审 · keybar 上浮判尺结论：vm=真尺（vv 可靠），修的是 vv→bar 应用层

> 日期: 2026-08-23
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 按 vm 锚定修 bar/终端容器（去 cssText bottom:0 vs top 冲突），用户两状态验证 keybar+输入栏不盖
> 回: kfmv4-9.0-keybar-input-float-root-report.md（双轨校准探针 @ 47052cfc）
> 回函通知: psh
> 状态: 已回（2026-08-23 9.0：已按判尺修 @ 575a7eb2——barStrip 弃 bottom:0 只认 top 锚 vv；终端容器出生即钉 vv；bundle 内容哈希缓存破坏；守视基线 kbc=0 缝隙=0；待用户真机两态验收）

## 一、判尺结论（真机截图 + fx/vm/dch 数据）

**键盘弹起时（vh=226，键盘上方可视区 226px）**：
- **紫轨 `vm`（vv 底）= 226 = 键盘顶边** ✅ → **vm 是真尺**（vv.height 等于键盘顶）。
- **绿轨 `fx`（CSS 布局底 bottom:0）= 546 = 整页布局底** → 落在键盘下方，**不是**"贴键盘顶"的尺。

**故基准 = `vm`（vv）**，弃 `fx`（布局底）。截图 190126（键盘弹起）里 keybar 下排浮在键盘上方，也印证钉 vv 方向对。

## 二、重要修正（推翻上一轮判断）

数据**否定"vv 在 Via 有栏不可靠/多报 40px"**——**vv(vm) 是对的**（键盘顶=vv.height=226）。所以之前 182905"下排被盖"**不是 vv 尺度错**，而是**"把 vv 值应用到 bar 上"这一层的 bug**。

## 三、真正的修法点（vv 应用层）

9.0 的 keybar barStrip：cssText 是 `position:absolute;left:0;right:0;bottom:0;height:84`（**bottom:0**），updateBottom 又设 `top = vv.offsetTop+vv.height-栏高`——**两者冲突**（top 与 bottom 同设+height，CSS 里 top+height 赢、bottom 被忽略；但 barStrip 是独立 overlay 兄弟、其父可能不是 vv 锚定容器），**bar 实际落在布局底（键盘后面）而非 vv 底**。

**修法（二选一）**：
1. barStrip **去掉 `bottom:0`**，只用 `top`（vv.offsetTop+vv.height-栏高）定位，并确保它锚在 **vv 锚定的容器**里（不是布局底）；
2. 或把 barStrip 放进**终端卡那个 vv 锚定容器**（top=vv.offsetTop、高=vv.height-栏高）的**底部**，bar 作为容器内 `bottom:0` 子元素——容器按 vv 高裁剪，bar 自然在 vv 底。

**关键**：终端容器 + bar 都要以 **vv** 为锚（数据实锤），且**别让 `bottom:0` 的旧定位/布局底基准**跟 vv 的 `top` 打架——这正是"有栏时下排被盖"的真正来源。

## 四、验收

修后用户真机**两状态（全屏/有栏）**弹键盘，**keybar 两排 + 输入栏都不得被盖**（截图 + fx/vm/dch 校对）。评审核数字收口。

## 备注

8.x aux-bar 已查明=容器流内 flex 子元素、不依赖 vv/ih 数值（方向②活例）——9.0 可对照，但注意 8.x 输入栏仍盖，故其方案也不完整。

## 回函（9.0 线）

已按判尺修 @ 575a7eb2（修法① + 消除基准打架）：
- **barStrip 单基准**：cssText 弃 `bottom:0`，只留 `top:0` 初始 +
  `updateBottom()` 的 `top=vv.offsetTop+vv.height-栏高`——vv 唯一天尺，
  无 bottom 可打架；
- **终端容器出生即钉 vv**：open() 时立即 `top=vv.offsetTop /
  height=vv.height-栏高`（不再等首个 vv 事件）——有栏无键盘态布局底
  ≠可视底，默认 bottom 锚会把终端下部藏进 chrome 后；
- **附带排干扰**：build.mjs 加 bundle 内容哈希缓存破坏
  （`bundle.js?v=<sha8>`）——真机浏览器吃旧包会让「修复实测」测到
  旧代码，这类干扰此后杜绝。
- 守视基线（桌面）：栏 769-853 / 终端 0-769 / kbc=0 / 缝隙=0 /
  stripStyle top=769px bottom=auto；E2E 17/17 绿；chain OK。

用户真机两态（全屏/有栏）弹键盘验收后，双轨探针+ih/vh/ot/kbb/kbc/fx/vm
字段按裁决①随症收口移除。输入栏（对话窗口卡）落地时复用同一钉法，
不进本步。

——9.0 · 2026-08-23
