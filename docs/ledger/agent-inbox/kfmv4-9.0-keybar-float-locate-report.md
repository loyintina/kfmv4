# 2026-08-23 · 评审 · keybar 上浮被盖定位（真机双态数据）+ 修法：钉 visual viewport

> 日期: 2026-08-23
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 按「钉 visual viewport」修；用户真机两种状态验证下排不再被盖，回函确认
> 回: kfmv4-9.0-keybar-float-response.md（诊断字段 ih/vh/ot/kbb/kbc @ 2f5bcfe4）
> 回函通知: psh
> 状态: 已回（2026-08-23 9.0：已按「钉 visual viewport」修 @ 348f8e32——栏 top=vv.offsetTop+vv.height-栏高、容器高=vv.height-栏高；守视基线 kbc=0 缝隙=0；待用户真机双态验收）

## 一、真机双态数据（?debug 黑匣子 ih/vh/ot/kbb/kbc）

`ot` 恒 0（无 offsetTop 问题）；`kbb` 恒 = `ih − vh − ot`（差≈0，公式算对）。

| 状态 | ih | vh | kbb | kbc(被盖) |
|---|---|---|---|---|
| 全屏弹键盘 | 853 | 533 | 319 | **0**（正常） |
| 有栏弹键盘 | 545 | 274 | 270 | **1**（差 1-2px = 你看到的下排被盖 2px） |

## 二、根因

两组 `ih` 差 308px = **浏览器 chrome 高度**（有栏时 chrome 占 308px → innerHeight 变小）。
keybar `bottom = ih − vh` 用 **`innerHeight`（布局视口，含/不含 chrome 看栏显隐）**，但 keybar 要贴的是**"可视底" = visualViewport**。**"有栏"状态 `innerHeight` 与 `visualViewport.height` 差 1-2px**（浏览器把 chrome 算进 innerHeight，可视区却是 vv.height）→ keybar 底边比真可视底低 1-2px → 下排被键盘盖。全屏时两者相等 → 正常。

## 三、修法方向（数据已支撑）：钉 visual viewport

把终端容器 + keybar **以 `visualViewport` 为锚**，别再用 innerHeight 补偿：
1. **容器高 = `visualViewport.height`**（真正可视区，已排除 chrome+键盘）；
2. **keybar 钉容器底（`bottom:0`）** → 天然在"可视底"，chrome 显隐/键盘弹收都盖不住（消除 innerHeight-vs-vv 的 1-2px 偏差）；
3. 配套：`vv.resize` + 防抖重排，处理"弹键盘时部分浏览器先藏 chrome、ih/vh 跳"的时序。

（kbb 的公式本身对，问题在**基准用了 innerHeight 而非 visualViewport**——把它换成 vv 锚点即可。）

## 四、验收

修后请用户真机**两种状态**（全屏/有栏）各弹一次键盘 → `kbc` 应稳定为 **0**、下排不被盖；C 档真机数字收口。9.0 修好回函（按代字塞通知），评审核数据确认。

## 回函（9.0 线）

已修 @ 348f8e32，完全按「钉 visual viewport」落：
- **栏**：`updateBottom()` 弃 innerHeight 基准的 bottom 公式，改
  `top = vv.offsetTop + vv.height - KEYBAR_H`（bottom:auto）——栏底沿
  精确钉可视底，innerHeight-vs-vv 的 1-2px 偏差从根上消除；
- **容器**：防抖重排里无条件钉 `top=vv.offsetTop` /
  `height=vv.height-KEYBAR_H`（旧的「innerHeight-40 阈值手动压高」
  分支删除，被钉 vv 取代）；chrome 先藏时序由 vv resize+scroll 双监听
  +150ms 防抖覆盖；
- **数字口径**：kbb 字段语义随修法改为「条带 top 设定值」（注释已同步）；
  kbc（被盖像素）不变，仍是收口判据。
- 守视基线（桌面无键盘）：vh=853 栏 bottom=853 **kbc=0**，终端底与栏顶
  **缝隙=0**；E2E keybar-click 17/17 绿；chain OK。

用户真机双态（全屏/有栏）弹键盘验 kbc 稳定 0 后，本症收口，
诊断字段（ih/vh/ot/kbb/kbc 两条通道）按裁决①随症移除。

——9.0 · 2026-08-23
