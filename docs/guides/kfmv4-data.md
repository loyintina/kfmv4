# kfmv4 数据区结构规范（~/.kfmv4）

> 数据区 = `$HOME/.kfmv4/`（或 KFM_DATA_HOME 覆写）：所有会话/角色/配置/实验
> 数据的家。2026-08-08 重构定稿（此前长期无规范，五类内容混放）。
> 机械执法：`scripts/check/check-kfmv4-data.mjs`（挂 chain，数据区缺席优雅跳过）。

## 分层总则

| 层 | 目录/文件 | 是什么 |
|---|---|---|
| 运行配置 | `.env` / `providers.json` / `active.json` | 密钥、provider、当前激活角色（根目录，引用面多，不动） |
| 人设与配置 | `roles/` / `configs/` / `prompts/` | 角色卡、配置卡、提示词（dynamic/ 说明） |
| 会话 | `sessions/` 根 + `script/` | 面板真实会话 / 脚本会话（脚本分流区） |
| 范式包池 | `paradigms/` | **只放正式包**——实验梯度档在实验区 paradigm-packs/ |
| 素材与实验 | `materials/` / `experiments/` | 素材库 / 实验数据区（arms.db 不入库） |
| 观测账本 | （待收拢 `ledger/`，HUD 收口后） | agent-calls / tool-exec / check-failures 等 jsonl，暂留根目录 |
| agent 工作区 | `workspaces/` | agent 可写沙箱区（2026-08-08 预立空位，机制下一阶段） |
| 日志与巡守 | `logs/` / `browser-relay/` | 运行日志、守视截图 |
| 考古素材 | `chat-backups/` | 历史会话全量，**增量不入库**（gitignore，本地保留） |

## 已定规则（机械门执法）

1. **sessions/ 根目录不得出现测试残留**：s1/s2/s3/s-err/s-buf/s-cancel/sess-ok/
   sess-x/s-basic 等 id 只属于测试套件（tests/run-manager.test.ts + server-routes
   .test.ts）。源头已根治（2026-08-08 env-test-isolation 首 import + smoke 数据根
   隔离），若再出现 = 隔离回归，机械门报红指向源头文档。
2. **paradigms/ 池不得混实验档**：metacognition-*k / meta-corpus-* / -dup 等
   梯度档是实验输入，归 `experiments/paradigm/paradigm-packs/`（loadParadigm
   已加回退路径，旧实验按名仍可复现）。
3. **workspaces/ 必须存在**：agent 工作区空位（目录规范的一部分）。

## 历史

- 2026-08-08 重构①：paradigms 分池（21 档梯度实验档移入 paradigm-packs/）；
  chat-backups 增量不入库。
- 2026-08-08 重构②：清除 9 个测试残留会话，源头根治（env-test-isolation）。
- 2026-08-08 重构③：本规范 + check-kfmv4-data 机械门 + workspaces/ 空位。
- 待办：观测账本收拢 `ledger/`（等 HUD 观测台线收口后动代码）。
