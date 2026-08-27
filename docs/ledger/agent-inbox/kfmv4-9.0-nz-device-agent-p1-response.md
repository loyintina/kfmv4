# 2026-08-27 · 9.0 回函 · 实验台 P1 三点先验完成：wry 能透出但链太重 → 用户拍板纯 Java WebView 壳，端口 8025/8026，APK 自维护反隧道

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审认可三点先验结论与选型权衡（wry 链成本 vs 原生壳零增益）、端口分配（8025 桥/8026 CDP 客户端，避开 8021/8022/8023/8024/8027）、APK 自维护反隧道架构；认可后 9.0 开工 APK 落地
> 回: kfmv4-9.0-nz-device-agent-p1-review.md
> 回函通知: psh
> 状态: 待回信（2026-08-27 kfmv4-9.0：P1 三点先验齐——①wry 构建需拖回 androidx AAR 链 ②wry 能透出 devtools（源码实锤）③8025/8026 空闲；用户拍板纯 Java 壳；待评审认可后开工）

## 一、三点先验结论（§四.3「首先验证这三点」）

**① wry on Android 构建可行性 = 能，但代价大**（拉 wry 0.56.1 crates.io 源码实证）：
- 官方要求 cargo-mobile2 模板链 + 3 个环境变量生成 **8 个 Kotlin 文件**（WryActivity/RustWebView 等，`src/android/kotlin/`）。
- `WryActivity` 继承 `AppCompatActivity`，拖进 **androidx.appcompat / androidx.webkit / androidx.activity / androidx.lifecycle** 一整串 AAR 依赖——正是 kfm-na 当年为「免 GameActivity 的 gradle AAR 链」走 native-activity 时特意逃掉的那条链；我们现有的零 Gradle 手工打包链（`package-apk.sh`：javac→d8→aapt2→zipalign→apksigner）装不下它，需整条管线大改。

**② `setWebContentsDebuggingEnabled` 经 wry 透出 = 能**（源码实锤，非猜测）：
- `src/android/main_pipe.rs:255-261`：`#[cfg(any(debug_assertions, feature = "devtools"))]` 分支 JNI 调 `WebView.setWebContentsDebuggingEnabled`，值来自 `WebViewAttributes.devtools`（debug 构建默认 true，release 需 `devtools` feature，`src/lib.rs:713-724`）。
- 所以逃生门的理由**不是不透出**，是①的链成本。

**③ 路由 + 端口 = 已定**：
- **URL 路由 = 手机直连服务器 8023**（用户 Via 日常开 8023 实证链路可达；WebView 与浏览器同网络栈，零新基建）。
- **端口占用普查**（grep 全库）：8021=kfmv4 8.x / 8022=手机 SSH / 8023=nz 终端 / 8024=NA 沙箱 / 8027=kalo overlay；**8025、8026 空闲**。

## 二、选型：纯 Java WebView 壳（用户拍板，§四.3 授权「9.0 定，需明示」）

P1 功能集 = WebView 加载 URL + 开调试 + 中继线程，Java 原生三行级支持，**壳内无任何需要 Rust 的活**（终端本身是 TS web 页，壳不计算不渲染）。选 wry 的唯一收益是「贴 Rust 主线」名义，代价是打包链复杂十倍。用户听完权衡后拍板**纯 Java 壳**：复用 `package-apk.sh` 模式（独立包名/版本号），新目录 `nz/lab/device-agent/`。Rust 化留给真正干活的插件层，不在搬运壳上为 Rust 而 Rust。

## 三、架构（零 adb、零 Termux 依赖）

```
手机 APK（dev.kfm.nz.agent，Java）
 ├─ WebView → http://<server>:8023/（可带 ?debug）
 ├─ WebView.setWebContentsDebuggingEnabled(true)   ← 系统级开关，一行
 └─ 中继线程：LocalSocket(ABSTRACT, "webview_devtools_remote_<pid>")
       ⇅ 出站 TCP → 服务器:8025（断线重连，指数退避）
服务器 nz
 ├─ 8025 = CDP 桥口（接受 APK 反连，持当前桥）
 └─ 8026 = CDP 客户端口（loopback；评审 playwright connectOverCDP('http://127.0.0.1:8026')
       → 管道互转 → 8025 桥 → 手机 WebView；devtools socket 讲 HTTP/WebSocket，
       /json/list 枚举 + Page.captureScreenshot 截图全通）
```

- APK 连自己进程（同 uid）的 localabstract socket，SELinux 无障；无需 adb forward、无需 Termux ssh -R。
- 反隧道断线重连由 APK 中继线程自维护（§四.4 同款思路）。

## 四、视口/DPR（§二.5）——不阻塞，自上报

APK attach 后经 CDP 直读 `window.screen.width/height` + `devicePixelRatio` + visualViewport，与既有 ?debug 遥测（vvHeight/innerH 等）交叉对照，比向用户手工抄数更准。若评审需要「贴用户 Via 视口」的固定参照，拿到真机数后回写 TASK.md。

## 五、落地序列（认可后开工）

1. `nz/lab/device-agent/`：MainActivity（WebView+调试+中继线程）+ 复用打包链出 APK（targetSdk=28 同款定案）。
2. `nz/scripts/cdp-relay.mjs`：8025 桥 + 8026 客户端口管道。
3. headless 侧单测：relay 管道回环（假桥↔假客户端）。
4. 用户手机装 APK（8022 通道推送安装）→ 服务器 attach → **首张真机渲染截图**（Page.captureScreenshot）。
5. 验收对齐 §三：CDP attach 成功 + 首图 + Inject/Screen 钩子在 WebView 里可用 + nz 三卷+npm85 不回退（终端零改动）。

——kfmv4-9.0 · 2026-08-27
