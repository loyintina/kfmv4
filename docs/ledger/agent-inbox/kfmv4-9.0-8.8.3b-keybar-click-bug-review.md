# 2026-08-23 · 评审 · 8.8.3b keybar 点击不可达：红测已立 + 根因方向（请修绿）

> 日期: 2026-08-23
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 修 keybar 布局，让 tests/browser/keybar-click.test.mjs 转绿（3 断言全过）
> 回: 8.8.3b 落地 ba1a953a（用户实测点按钮无响应、反召唤/关闭键盘）
> 回函通知: psh
> 状态: 待修（2026-08-23 评审：红测立 + 根因定位 + 请 9.0 修布局转绿）

## 一、用户实测 + 评审复现（headless 真浏览器）

用户：点 keybar 按钮**没内容响应，反而召唤/关闭键盘**。评审 headless 复现确认：

- 点 keybar ENTER/Ctrl → 终端**无内容响应**、Ctrl 灯不亮（onPress 没触发）；
- **但直接 `dispatchEvent(pointerdown)` 给按钮 → Ctrl 灯亮**（onPress 绑定是对的）；
- `document.elementFromPoint(按钮中心)` **命中 `root@...`（终端行/容器），不是按钮**——
  **每个按钮都被终端内容盖住**。

## 二、根因

keybar 按钮**被终端内容/容器盖住**（点不到）。虽看似布局区隔开（.nz-term 0..520 / 容器 0..536 /
keybar 536..620），但 elementFromPoint 在 keybar 区命中终端 `root@...`——说明**终端卡片 el
（含 shell 内容）的层级/位置盖过了 keybar**。要么终端容器没在下方预留区被正确裁剪，要么
z-order 上终端在 keybar 之上。这是布局/层叠 bug，不是事件/映射问题（那两样都对）。

## 三、红测已立（考题先行）

`nz/tests/browser/keybar-click.test.mjs`（playwright E2E，3 断言，**当前 0/3 红**）：
1. 命中：每个按钮中心 elementFromPoint 必须命中按钮自身（抓重叠）——**全红**；
2. 点击 ENTER → 终端内容变化（`\r` 已送）——红；
3. 点击 CTRL → 灯亮（粘滞 syncMods）——红。

## 四、请 9.0 修（转绿）

方向一二选一（或组合）：① 终端容器真正裁剪到 `bottom:KEYBAR_H` 上方（内容别溢到下 84px）；
② keybar barStrip 给更高层叠（z-index）确保按钮在终端之上可点；③ barStrip 与终端不做兄弟
重叠。修法以你为准，**让 3 断言全过即可**。C 档（上浮真机实拍）照旧待真机。

## 备注

本测试是独立浏览器 E2E（`tests/browser/*.mjs`），不占 node 单测；跑法 = 起 8023 dev +
`node tests/browser/keybar-click.test.mjs`（需 playwright，chromium 已装）。nz 若要进 CI，
把 playwright 加 devDependency + 建 browser-test runner（你定）。此条同时登记为方法库
case-003。
