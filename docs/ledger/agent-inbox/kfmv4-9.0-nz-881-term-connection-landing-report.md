# kfm-nz 8.8.1 落地通报：终端连接家族——纯会话管理（№1 连接层，传输无关）（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-21
> 日期: 2026-08-21
> 致: all
> 流型: 征集
> 预期表态方: 评审线（落地核实）
> 收敛判据: 评审核实通过或提出异议；无异议即生效
> 回: —（通报；nz 8.8.1 落地，DoD 全过。通报与落地 commit 同批——881 纪律首次执行）
> 状态: ✅ 已回（2026-08-21 评审：核实属实评优 + 观察两条知会——见 kfmv4-9.0-nz-881-term-connection-review.md）

## 落地内容

nz 8.8.1 终端连接家族完成（用户发话开工）：**`nz/src/server/
term-connection.ts`**——№1 连接层纯会话管理服务，挂服务端 cordis
根总线（8.8.1a 刚立的地基第一个真插件）。

- **传输无关（本步核心设计动作）**：切断 v8 PtyManager 把 WebSocket
  焊进 `spawn(ws, …)` 的耦合。会话只管进程，输出走两条通道：单会话
  `onOutput` 订阅 + 总线 `term/output` 事件——WS 桥/眼睛/审计将来
  各听各的，互不染指。
- **重连语义正解**：会话不绑定任何消费者。消费者退订（=网页刷新/
  断网的传输无关等价物）会话不死；新消费者 `attach(sessionId)` 复挂
  = 重连，`replayTail()` 捞 64KB 封顶回环尾迹补断档期输出。
- **五动作**：open（command 空则交互 shell）/ input / resize（真
  ioctl）/ close（exit 事件透传退出码）/ attach 重连。
- 后端 = `node-pty-prebuilt-multiarch`（v8 已验证依赖，本机 spawn
  实测）。**PTY 不 Rust 化**（用户问 NA 线 Rust 终端后对账三判据：
  非计算密集（I/O 薄胶水）/ node-pty 现成已验证 / napi 接入复杂度
  净增；Rust 化发生在 8.8.2 解析核 alacritty_terminal→WASM——与 NA
  同 crate，不在连接层。入 TASK 决策记录）。
- 8023 常驻服务已带新件重启，slog 在案。

## 范围声明

tmux 管理服务（TmuxService 六方法 + `tmux/windows-changed`）**不在
本步**——任务图 tmux 完整管理归 8.8.5，本步只交连接层五动作。
WASM 终端芯评估（alacritty vs rio-vt）挪 8.8.2 门口的提议**待用户
拍板**（渲染芯的事，不挡连接层）。

## 验证

- A 档：**70 钉全绿**（65 + 连接 5 钉，全真 PTY 不 mock）：
  open+input 回显双通道（订阅+总线事件）/ resize 真生效（交互 shell
  里 `stty size` 报 `30 100`）/ close+自然退出双路收口（`exit 7`
  透传）/ 重连 attach+尾迹补断档 / 服务卸载全杀（登记类逆序摘）；
- 双变异靶子声明在案：摘总线 emit → 双通道钉红；close 不摘表 →
  attach 钉红；
- `npm test` / `typecheck` / `smoke` / `build` 四件套全绿；
- TASK.md 登记已落（快照/双表 8.8.1 行 ✅/决策记录）。

## 下一步

8.8.2 终端渲染卡（解析核=alacritty_terminal→WASM，渲染壳 TS 自研）
——等用户发话。

——kfmv4 9.0 设计线 · 2026-08-21

---

## 讨论区

（待追加）
