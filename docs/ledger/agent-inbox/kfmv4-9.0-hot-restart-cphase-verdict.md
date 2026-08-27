# 2026-08-27 · 9.0(nz) · 热更前台 C 档收口通报：真根因=壳缺 WebViewClient（reload「被吞」假象破案），两幕终验全绿（免检通报）

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 无（自验收通报免检；抽查权保留——实验台可 attach 复看）
> 收敛判据: 无需回信（知会）。热更+重启闭环（§0.5 P3 切片）全链收口
> 回: kfmv4-9.0-hot-restart-landing-report.md（C 档遗留项销账）
> 回函通知: psh
> 状态: 通报完毕（2026-08-27 9.0：C 档两幕终验全绿，遗留清零）· 已读（评审：三点赞——归因跟读数不跟面子/navigation 计数钉入库/最小干预；壳完整性裁决=WebChromeClient 现不加，console 落盘需求出现再加 onConsoleMessage；**P3 全链收口认可**）

## 一、破案（C 档用户读数直接定性）

无观测判卷轮用户读数：**「NZ-Agent 保持前台，但 3 次跳到了浏览器页面开 8023」**——自愈链一直在跑，`location.reload()` 导航被 Android **ActionView 外部化到系统浏览器**，WebView 内页面纹丝不动＝此前「reload 被吞」假象真凶。

- **根因**：壳 MainActivity 从未 `setWebViewClient`——无 Client 时 JS 发起的导航交系统处理（初始 `loadUrl` 是壳调的不走此路，故平时不跳）。
- **修复**：`setWebViewClient(new WebViewClient())` 一行（空 Client=导航自持），重打 APK（versionCode=1787830418）用户覆盖安装。
- **诚实修正**：我此前「CDP 观测扰动致 reload 被吞」的推测**被证伪**——headless 绿 / CDP 直刷绿 / 页面内刷被外部化，三读数合指 WebViewClient 缺失，与观测者无关。观测扰动论废弃，归因以用户实拍读数为准。

## 二、终验数字（真机前台，实验台 CDP 只读判卷）

- **restart 自愈幕**：触发 nz-restart.sh → WebView 内自愈刷新（timeOrigin 变）✅ → 新会话可用（sid f771751f→4c97e697）✅ → 注入通（标记上屏）✅
- **build 自刷幕**：build → 页面 10s 内自动换血（timeOrigin 变）✅ → **续命同会话**（sid1==sid0=4c97e697）✅ → **屏幕内容不空**（tail 回放，标记还在）✅
- 判据方法钉：reload 后 `performance.getEntriesByType('navigation')` 条目数**恒 1**（reload 替换当前条目）——文档换血判据用 `performance.timeOrigin` 变更，navigation 计数是坑。

## 三、闭环全景（本单收口后的热更体系）

| 腿 | 触发 | 动作 | 判卷 |
|---|---|---|---|
| 服务端重启 | `/tmp/nz-gate/restart-req` | 遗言+exit(0) → supervisor 拉回（systemd 守 supervisor，单守护分层） | hot-restart 8/8 + 亲跑多轮 |
| 前端热更 | `build.mjs` 重写 build-info | 页面 10s 轮询自刷 + 续命 attach（会话不断+tail 回放） | hot-update 6/6 + C 档幕2 |
| 重启自愈 | WS 重连 attach 撞死 | onSessionDead → 摘账+防循环 reload | C 档幕1 |
| 壳侧自持 | — | setWebViewClient（本次） | C 档用户读数 |

日常用法：改服务端代码 → `bash nz/nz-restart.sh`；改前端 → `node build.mjs`（页面自己换血）。用户手机页面全程不用手动刷新。

——9.0(nz) · 2026-08-27
