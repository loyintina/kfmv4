# 2026-08-27 · 评审 · 实验台 P1：wry WebView 壳 + WebView 调试反隧道——首张真机渲染终端截图（设备代理的「像素眼」）

> 日期: 2026-08-27
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 做出 wry WebView 壳 APK（Rust），加载 nz 终端 + `setWebContentsDebuggingEnabled(true)` + 反隧道（nz 自己的端口）；服务器（评审）能从 CDP attach 到该 WebView；**取得第一张真机渲染（Android Chromium 光栅化）的终端截图**；A 档三卷+npm85 不回退
> 回: nz/TASK.md §0.5（实验台 P1，用户拍板逐步执行）；P0 已核（Inject/Screen 两钩子就绪）
> 回函通知: psh
> 状态: 已回函待评审（2026-08-27 kfmv4-9.0：三点先验齐——wry 链成本大但确能透出、8025/8026 空闲；用户拍板纯 Java 壳+APK 自维护反隧道）· 见 kfmv4-9.0-nz-device-agent-p1-response.md · 代际戳 gen-2026-08-27-P1选型-已回函

## 一、P1 目标（设备代理的「像素眼」）

P0 给了「手（Inject）+ 文字眼（Screen）」。P1 装第二只眼：**真机渲染的像素截图**——APK 的 WebView（Android 系统 WebView=Chromium）加载 nz 终端，**真机光栅化**下截图，**中文居上/居中等像素级渲染问题直接现形**（headless 永远做不到）。同时拿到 **CDP 控制面**（后续 evaluate/注入/截图都用它）。

## 二、请 9.0 落地

1. **wry WebView 壳 APK**（Rust，Tauri 的 wry：host Android 系统 WebView）——很瘦：只一个 surface + WebView。用 `kfm-na-toolchain`（JDK/SDK）build。
2. **加载 nz 终端**：WebView 加载 nz 终端 URL（`http://<server>:8023/…`，手机经既有隧道/代理可达服务器——**路由方式 9.0 定**：直连服务器 or 经反隧道，选稳的；URL 可带 `?debug`）。
3. **`setWebContentsDebuggingEnabled(true)`**（关键）：让 WebView 暴露 CDP 调试口，服务器才能 attach。
4. **反隧道**：把 WebView 调试端口挂到服务器（**nz 自己的端口**，避开 NA 的 8021/8024/8027）——SSH 反隧或 APK 自维护反向连接，9.0 按 NA 同款「文件信号/隧道」路子选。
5. **视口/DPR**：P1 先取一个**你手机的真实视口 + DPR**（`screen.width/height` + `devicePixelRatio`，用户可提供；APK 的 WebView 视口设成它）——这能让「真机渲染」尽量贴你手机，也是 headless 校准的参照。

## 三、验收

- **CDP attach 成功**（服务器从反隧道端口连 WebView 调试口；`chrome://inspect` 同款 WebView 能列出来）。
- **首张真机渲染终端截图**：CDP `Page.captureScreenshot`（或壳侧截图）拿到 nz 终端在 WebView 里的渲染图——**真机 Android Chromium 光栅化**（不再 headless/浏览器冒牌）。
- 终端具备真实会话（Inject/Screen 钩子在 WebView 里可用——P0 承接地验证）。
- A 档三卷（bottom-anchor 10/10 + scrollback 5/5 + keybar 19/19）+ npm85 不回退（nz 终端本身没动，P1 独立 APK）。

## 四、关键决策 / 风险（9.0 定，需明示）

1. **终端 URL 路由**：手机 APK 怎么到服务器 8023（直连 vs 反隧道）——影响稳定。
2. **调试端口映射**：WebView 调试口 → 服务器哪个端口（nz 自选，别撞 NA）。
3. **wry on Android 可行性**：wry/Tauri 在 Android 构建、`setWebContentsDebuggingEnabled` 经 wry 能不能开（若 wry 不透出，可能需小改或用原生 WebView 壳）——**P1 首先验证这三点，再往下做全**。
4. **反隧道自维护**：手机侧 APK/守护进程维持反向连接（断线重连），跟 NA 的隧道一套思路。

## 五、备注

- P1 是「设备代理的像素眼 + CDP 控制面」，**独立于 nz 终端**（nz 不动，APK 是壳）。做出来就等于**真机 oracle 就位**——之后所有像素级/渲染问题都能真机截图量化，且 headless 可拿 APK 的 WebView 视口/DPR 做校准参照。
- P2（文件信号闸门）/ P3（report 遥测/插件热更）/ P4（启动器化）按 §0.5 在此之后。

——评审 · 2026-08-27
