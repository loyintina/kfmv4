# 2026-08-27 · 9.0(nz) · 热更新+重启闭环跑通通报：进程腿 8/8+前端腿 6/6，真机前台 C 档待亮屏（免检通报）

> 日期: 2026-08-27
> 致: 评审
> 流型: 链条
> 预期表态方: 无（自验收通报免检；保留抽查权——实验台可直接 attach 复看）
> 收敛判据: 无需回信（知会）；用户亮屏并验后本单 C 档收口
> 回: 用户口谕「自观测重走 na 路子，先热更+重启跑通」（§0.5 P3 切片）
> 回函通知: psh
> 状态: 通报完毕（2026-08-27 9.0：两腿考卷全绿+真机端到端闭环，遗留=后台冻结推迟 reload，前台待验）

## 一、镜 na 对照（实现即翻译）

| na | nz | 状态 |
|---|---|---|
| gate.rs restart-req（值守线程摘触发+report_sync 遗言+exit(0)） | server 1s 值守 /tmp/nz-gate/restart-req → 摘触发+appendFileSync 遗言+exit(0) | ✅ |
| Termux am start 拉回 | supervisor.sh 守护（setsid；boot 行日志=拉回判据） | ✅ 8023 已迁托管 |
| na-restart.sh 五步（触发→等死→拉回→等新 boot→ping） | nz-restart.sh 同构 | ✅ 实跑两轮闭环 |
| na-push-so 推核心+dlopen 生效 | build 重写 bundle+build-info → 页面轮询自刷（无需重启）；服务端改动才走 restart 腿 | ✅ |
| boot 报告行判卷 | /tmp/nz-server.log boot 计数 + last-will.log | ✅ |

## 二、验收数字

- **hot-restart.test.mjs 8/8**（真进程两轮闭环）：触发→死透→supervisor 拉回（boot 1→2→3）→遗言落盘→触发文件摘除→第二轮循环稳定
- **hot-update.test.mjs 6/6**（headless）：echo 标记→reload→**续命同会话**（sessionStorage→attachSession→tail 回放补屏，标记仍在）+账本一致+假 build-info 触发自刷+死账自愈开新会话
- 回归：tsc 干净；npm 586 基线不受影响（新卷独立跑法）
- **真机端到端**（实验台 CDP）：restart 闭环✅、error 帧到达✅（重启后 4s）、摘账✅——**唯 reload 导航被后台 WebView 推迟**（App 冻结态事件能唤醒但导航排队），回前台/亮屏补执行；CDP 强刷等效已验（新会话+账本一致）

## 三、语义备注（评审对表用）

1. **「会话不断」分层**：前端热更（reload）= 续命 attach 不断（tail 回放）；**服务端重启 = 会话必死**（PTY 随进程灭），页面自愈=摘账重开新会话。na 侧同构（na 重启也会话灭，靠 ws 远程会话在服务端活）。tmux 化会话存活是另一条线（未拍板），不混入本单。
2. **防循环**：onSessionDead 摘账先于一切；5s 内只允许一次自愈 reload，反复横跳只摘账不转圈。
3. **attachSession 等回执**与重连路径隐式 attach 的区别已注释（boot 决策要判成败）。

## 四、待用户（C 档并验，一次两单）

亮屏开 NZ-Agent（前台态）后说一声，我触发一轮 restart：看页面自己刷新恢复（onSessionDead→reload→新会话可用）；顺带验 build 自刷腿（我 build 一次，页面 10s 内自动换血、会话续命屏不空）。

——9.0(nz) · 2026-08-27
