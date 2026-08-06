# 根因报告：脚本会话泄漏到面板区（2026-08-06，只读调查）

> 现象：跑实验判卷/px 实验期间，`~/.kfmv4/sessions/` 根目录（面板区）持续出现
> judge-* / px-* 会话副本，挤占面板会话卡与文件树。
> 本报告为只读调查结论；**客户端兜底修复已落地**（session-runner.mjs），
> **服务端根治属主线域，需与主线 agent 协调**（见 §4-1）。

## 1. 写路径真相：服务端只有一个，永远写根目录

- `src/server/ai/session-store.ts:22` — `SESSIONS_DIR = join(KFM_DATA_DIR, 'sessions')`
- `src/server/ai/session-store.ts:42-48` — `_sessionFilePath()` 是所有落盘的唯一
  路径构造点，**无任何条件分支**
- `src/server/ai/routes.ts:29,54` — `/ai/chat/start` 收的 `sessionClass` 只用于
  工具白名单，完全不参与落盘路径决策
- `sessions/script/` 分流是**客户端事后搬运**：`session-runner.mjs` runSession
  成功后 copy 到 script/ 再 rm 根目录副本（commit 913f177e 引入）
- 面板可见性：`src/server/routes/files.ts:147-151` 只 readdir 根目录 `*.json`

## 2. 泄漏 = runSession 在 copy+rm 之前抛错的所有路径

服务端在 chat/start 时就调度 flush（run-manager.ts:165/180），此刻副本已在根目录。
随后 runSession 失败的每条路径都 stranded 一个副本：

- **judge-llm.mjs:158-167**：失败重试用**新 sessionId**（`${sid}-r${retry}`），
  第 0 次失败的根目录残骸永远无人清理
- **plugin-exam.mjs / wrapper 重试**：同机制（`${id}-rt`）
- 失败诱因：waitRun 600s 超时、重连 >6 次、kfm-restart 掐断在途 run
  （status exists:false → 抛错）、**主线部署硬杀进程**（2026-08-06 实测：
  px-ft-c46-1/g25-1 被中止于 12:26/12:31，根目录各留半成品）
- 早前「s 开头测试会话」出现在面板区 = 同一根因

## 3. 与早前修复的关系

913f177e 的客户端 copy+rm 只覆盖 happy path；本次泄漏是**同一根因的残留**。
b5ab2f02（断连重连）、afb7b12f（flush 写锁）是韧性修复，不改变这个结构。

## 4. 修法与落地状态

1. **根治——服务端分流（主线域，待协调）**：`/ai/chat/start` 收
   `sessionClass: 'script'` 时 session-store 直接写 `sessions/script/`
   （startRun 入口登记 per-session 目录标记，`_sessionFilePath` 据此选目录；
   保持 BAR-SEC-14 白名单 + containment 复查）。客户端 copy+rm 整段可删。
   读取侧：`loadSessionMessages`（session-runner.mjs:91）已把 script/ 列为候选，
   兼容成本低；`/sessions/messages`（files.ts:227）需同样分流。
2. **客户端兜底（已落地，本批提交）**：runSession 改 try/catch——失败路径把
   根目录副本搬到 `script/<id>.stranded-<ts>.json` 残卷区（保留供尸检，
   .stranded 后缀防断点续跑误当完成臂），不再滞留面板区。
3. **运维清扫（建议，未做）**：kfm-restart.sh 定期把根目录中在 script/ 已有
   同名归档、或无活跃 run 的已知脚本前缀文件移走——治标，回收存量泄漏。

## 5. 残留风险（客户端兜底方案未覆盖的边）

兜底方案下，若 waitRun 抛错但 run 在服务端其实还活着（慢而非死），副本被搬走后
服务端下次 flush 会重建根目录文件——泄漏从「永久滞留」降为「短暂出现」，
由运维清扫（§4-3）或服务端根治（§4-1）最终消灭。
