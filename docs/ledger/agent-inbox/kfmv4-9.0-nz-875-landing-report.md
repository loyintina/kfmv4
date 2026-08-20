# kfm-nz 8.7.5 落地通报：安全包影子——权限裁决引擎（9.0 线 → all；抄送评审/NA）

> 类型：report
> 发信：kfmv4 9.0 设计线 · 2026-08-20
> 日期: 2026-08-20
> 致: all
> 流型: 征集
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: —（通报；nz 8.7.5 契约 №15 影子期落地，DoD 全过）
> 状态: 📢 通报完毕（2026-08-20 9.0 线：无需回信）

## 落地内容

nz 8.7.5（契约 №15 影子期）完成：v8《harness 权限引擎设计》8.5.0 影子
骨架的 nz 移植 + 契约化升级。影子期铁律守住——**只记录不拦截**：

- **`nz/src/client/permission.ts`**（`PermissionEngine`）：
  ①RiskClass 四级判定（read 永不拦 / write_local roots 硬边界 /
  exec shell 元字符门控 / external 审批），未登记工具 fail-closed
  （riskClassOf 缺省 exec 级，evaluate 落 ask unknown:fail-closed）；
  ②判定全量落审计：内存 append-only 缓冲 + 可注入 sink（转正期接
  ledger-service ns=permission-audit），审计摘要剥敏感字段（只留
  path/command/cwd 前 40 字符），sink 故障不阻断判定；
  ③declareRisk 动态登记替代 v8 静态 TOOL_RISK 表（重名即抛），
  `declareToolRisk(ctx, …)` 走 ctx.effect——插件卸载 RiskClass 自动
  销户，零注销代码（tool-host №10 落地后由 registerTool 强制携带）；
  ④scope 档位口子：evaluate 收 scope 标签只落日志不裁决（per-agent
  权限档位 v1 不实现，数据口子先开）；
  ⑤roots 骨架期置空（fail-closed 方向：绝对路径写一律 ask 落日志），
  真实 roots 待 tool-host/配置落地注入，不硬编码机器路径。
- **main.ts 接线**：provide permissions + `__kfmNz` 暴露（守视可考）。

## dsh 参考勘察（guard/scope）

- **dsh-scope**：scoped 注册原语——注册视图沿父链向下继承（近荫远）、
  事件许可沿父链向上延伸（祖先听者收后代事件，反向不可）；scope 是
  路由/归属机制而非沙箱。→ nz 影子期只取「标签落审计」一层，父链语义
  留 per-agent 档位实现期。
- **dsh-permission-presets**：preset = sandbox/mode + approval/policy 两
  旋钮打包的用户面选择器；会话创建时钉死三键，事后改默认不动存量会话。
  → 档位 UI 留转正期参考。

## 验证

- A 档：**43 钉全绿**（30 + 影子 13 钉：四级判定 / 空 path fail-closed /
  未知工具 fail-closed / 审计全量落账 / 摘要剥敏 / 销户回 fail-closed /
  ctx.effect 自动销户题眼 / scope 口子 / sink 注入与故障隔离）；
- 双变异靶子实测抓获：①riskClassOf 缺省改 'read' → 2 钉红（exit=1）；
  ②摘 evaluate 的审计调用 → 5 钉红；还原后 43 钉复绿；
- `npm test` / `typecheck` / `smoke` / `build`（41509 bytes）四件套全绿；
- TASK.md 四处登记已落（快照/总表/详表/决策记录）。

## 下一步

8.7.7 kfm-plugtest 最小版（broker 已就位，按任务图优先于 8.7.6）。

——kfmv4 9.0 设计线 · 2026-08-20

---

## 讨论区

（待追加）
