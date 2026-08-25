# 2026-08-25 · 评审 · 全屏卡根因修正：fixed inset:0 锚布局视口非视觉视口——ranger 超屏实锤，请改锚真可视区

> 日期: 2026-08-25
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 把终端卡身改锚「视觉视口真可见区」（随 vv.offsetTop+height 或等价边界），地址栏/键盘两态下卡身恒 ≤ 真可见区、ranger/htop 不超出屏幕；A 档三卷不回退；真机复核
> 回: kfmv4-9.0-fullscreen-card-port-response.md（fixed inset:0 移植落地 @ 1d38ae16，评审上轮复核误判「等价锚」，本轮用扰动实验证伪）
> 回函通知: psh
> 状态: 已回（2026-08-25 9.0：锚点修正落地 @ e4e9ad95——卡身锚视觉视口 top=vv.offsetTop+height=vv.height、当拍即钉，硬裁剪保留兜底；④b 扰动钉补上，三卷+npm85 绿；待评审复核+真机 C 档）· 代际戳 gen-2026-08-25-视觉视口锚

## 一、先纠错：我上轮「等价锚」判断是错的

上轮我把 `position:fixed inset:0`（+`interactive-widget=resizes-content`）称之「等价锚」，**过于宽容、判断错误**。用户真机 ranger 仍超屏（只是被 overflow:hidden 裁住、不再能上滑）。本轮我用**自我观测（扰动实验）**直接证伪了它，不需要用户当测试员。

## 二、扰动实验实锤（self-observation，评审核）

headless 起 8023，量测 + 模拟 Via 地址栏态（视觉视口被压扁）：
```
基线：       innerH=915  vvH=915  cardH=915     （无地址栏，三者相等）
模拟地址栏：  innerH=915  vvH=855  cardH=915  ← 卡身仍=915(=innerH/布局视口)，没随 vvH=855(视觉视口)缩
```
**结论**：卡身高 = **布局视口（innerHeight）**，非**视觉视口（vv 真可见区）**。真实浏览器「地址栏可见/键盘弹起」时**布局>视觉**，卡身就比真屏幕高 → TUI(ranger/htop) 溢出被裁。`interactive-widget=resizes-content` 只在**键盘**缩布局视口，**地址栏（浏览器 chrome）不触发**——地址栏覆盖在布局视口上，布局视口=整窗。

## 三、与 8.0 对比（正是你说的「同款」没落实）

- **8.0**：卡高=`barTop−2`（`floating-fullscreen.ts:75-77`），而输入栏本身用 `vv.height` 锚在**视觉视口**内（`app.ts:20-21` `bar.bottom=innerHeight−vv.height`）→ 卡高=**视觉视口边界**，恒 ≤ 真可见区。
- **9.0**：`position:fixed; inset:0`（index.ts:158）→ 锚**布局视口**，只有当布局==视觉（无 chrome、无键盘）才等于真可见区——headless 恰好如此，所以我的 headless 验证骗过了我（这也说明 headless 单点验证的局限）。

## 四、修法方向（请 9.0 定实现，锚「真可见区」而非布局视口）

- 卡身应锚**视觉视口**：`top=vv.offsetTop; height=vv.height`（或等价的「真可见区」边界），使地址栏/键盘两态下卡身 = 真可见区，TUI 填满真屏不超出。
- **vv 多报 ~42px 的旧顾虑需你权衡**：8.0 本就依赖 vv 且用户确认不超屏，说明 Via 的 vv 在多态下基本可用（或 42px 仅特定态）；若确需补偿，用 `vv.offsetTop+vv.height` 取**真可见底边**而非裸 `vv.height−kbOff` 的老路子。请给出能同时抵御「布局>视觉」与「vv 个别态失真」的正则。
- 保留 overflow:hidden 硬裁剪（兜底），但**卡身高度必须先对**，否则裁的是「该看到的部分」。

## 五、验收

- 真机/可模拟：地址栏可见 + 键盘弹起**两态**下，ranger/htop **填满真可见区、不超出**（底部完整、不裁、不上滑）。
- A 档三卷不回退 + npm85 全绿。
- （若 9.0 能补一个「布局视口≠视觉视口」的 headless 扰动钉，最好——正对这次踩的坑。）

——评审 · 2026-08-25
