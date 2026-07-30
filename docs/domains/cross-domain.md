> 这是什么：**跨域交互面**测绘——六个域之间的状态、协议、文件、依赖关系，单域 code-map 照不出来的那一层。
> 域内现状 → 各域 code-map.md；跨域 import 边（机械层）→ code-inventory.md 末节。
> 本图是六域测绘的第七件，由跨域专项侦察产出（每条附 file:line 证据）。

# 跨域交互地图（cross-domain）

## 测绘元数据

- 基准：commit 0cecc62 · 2026-07-29 · 机械层跨域 import 边（条数以 code-inventory.md
  生成值为准，此处不写字面数字——语义审计家规）
- 为什么单独存在：共享状态多写者、协议不对称、越域写入，这些问题的定义域就是
  「域与域之间」——任何单域地图都无法完整陈述它们

## 共享底座所有权矩阵

| 单例 | 名义所有者 | 实际写者 | 违规/风险 |
|------|-----------|---------|-----------|
| KFMState（state.ts:73） | client-shell | 方法写：canvas-tree 多文件；**裸 notify 4 处**（tree-render.ts:536、tree-loader.ts:104,137,146、sibling-switcher.ts:122） | ⚠ **直接字段写绕过 setter**：tree-render.ts processClickQueue 反转分支（同路径点击 → reverse，字段写+手动落盘同处）、tree-loader.ts:178（expandedPaths，绕过 beforeExpand 钩子）、sibling-switcher.ts:119-121 三字段直写、main.ts:99 |
| L（renderer-lifecycle.ts:171） | client-shell（事实 canvas-tree） | 写集中 canvas-tree；**私有字段直写泛滥**：canvas-scroll.ts 10+ 处 `_wheelRaf/_flingRaf` 等、canvas-utils.ts:36-47、tree-render.ts 多处 `L.renderer=` 直写 | ⚠ 跨域回调注入：L.setCardDismissHandler（tree-render.ts:381）挂的是 floating-card 域的 dismissFocusedCard |
| anim（animation-registry） | client-shell | scope 唯一租户 tree-render.ts:41 | ⚠ **scope 隔离形同虚设**：killTweensOf 直透 gsap 被三个域调用（mode-system.ts:218、floating-card.ts:491、card-stack.ts:210、tree-swipe/tree-render），全绕过 `_scopes` 台账 |
| Registry（ui-registry） | client-shell | 全部越域写（设计如此）：registerElement/notifyStateChange 四域都在调 | 重复注册仅 warn 覆盖 |
| ws-channel 命令注册表 | ai-chat（文件归属） | 四域注册 19 条命令：shell 8、canvas-tree 4、ai-chat 3、floating-card 4 | ⚠ onCommand 重复注册覆盖旧处理器仅 warn（ws-channel.ts:148-151），无冲突防护 |

## localStorage 协议登记表

| key | 写者 | 读者 | 风险 |
|-----|------|------|------|
| `expandedPaths` | **4 写者跨 2 域**（state.ts:128、tree-render.ts processClickQueue 反转分支、tree-loader.ts:179、sibling-switcher.ts:117 remove） | state.ts:76 | ⚠ 含绕过 setter 的直写后手动落盘 |
| `kfmv4_currentRoot` | **3 写者**（sibling-switcher.ts:61,116、main.ts:93） | 3 处 | ⚠ 多写者 |
| `kfm-fontsize-{typeId}` | gestures.ts:56（唯一，动态拼接） | **7 处散落 4 域** | ⚠ 未知 typeId 回落 file 配置（api/tools 卡错配，见 floating-card code-map 漂移 19） |
| `kfmv4_showHidden` | state.ts:139 | state.ts:78 | 干净 |
| `kfm-todo-dismissed` / `kfm-active-run` / `kfm-restart-count` | ai-chat 各自单写 | 同域 | 可接受（restart-count 有 1 处字面量未用常量 orb-chat-host.ts:272） |
| `kfm-no-compact` | **无写者** | orb-chat-run.ts:460 | ⚠ 灰度逃生门，协议上无生产者（设计如此，但未登记） |

**制度缺口**：全部 key 无统一登记表（本表即第一份），新增 key 无任何约束。

## .kfmv4/ 文件写入矩阵

| 文件 | 写者 | 风险 |
|------|------|------|
| `sessions/<id>.json` | **客户端 session-client.ts:134,456 + session.card.ts:91 × 服务端 session-store.ts:100,156** | ⚠⚠ **最危险：双端双写者无协调协议**（呼应 ai-chat 漂移 1 双轨残留） |
| `active.json` | **3 写者**（orb.ts:55、session-client.ts:123、config.card.ts:179,189），read-merge-write 无锁 | ⚠ 另有死声明：api.card.ts:21 ACTIVE_PATH、role.card.ts:28 ACTIVE_ROLE_PATH 定义未用 |
| `providers.json` | api.card.ts:79（唯一） | 干净；服务端 3 处读（chat.ts:106、proxy.ts:26、index.ts:145） |
| `roles/*.json` `configs/*.json` | role.card / config.card 各自单写 | 干净 |
| `page-state.md` | page-state.ts:118（服务端闭环） | 干净 |
| `restart-pending.json` | restart.ts:40 写、index.ts:157 读后删 | 干净 |

## HTTP 端点面

- 挂载：`/api` + `/kfmv4/api` 双前缀（index.ts:50-51 等），但 **/api/system/restart 只挂
  /api**（index.ts:131，与其余三组双挂载不一致）⚠
- **孤儿端点**：GET /system/info（仓内无调用，读者是 deploy.sh 外部）。
  （ai-tools.ts 全部 9 个端点仓内零调用——已整删，ADR-004。）
- **API_BASE 三套风格共 10 处**：动态拼接公式重复 8 处（orb.ts×2、orb-panel、config/api/
  role/session/tools 卡）+ state.ts:6 硬编码 /kfmv4/api + ws-channel.ts:409 硬编码
  /api/files/list——靠服务端双前缀挂载才不出错 ⚠
- 客户端调用但无定义：无 ✅

## WS 协议面

- 客户端→服务端 9 类消息与服务端处理**完全对称** ✅；服务端→客户端 11 类中
  **`error` 无任何 onMessage 注册者，静默丢弃**（ws-channel.ts:233）⚠
- `command` 通道（ADR-004 追加裁决：保留为「AI 之手」预留基础设施，非债）——
  唯一服务端触发（POST /ui/command → ws-server.ts sendCommand）已随整删消失，
  客户端 19 个 handler（shell 8 / canvas-tree 4 / ai-chat 3 / floating-card 4）
  现无生产者属预期空转；action 字串无静态校验的约束缺口待 AI 之手重建时一并补。
- terminal-open/terminal-close 两写者跨两域（terminal-card-04 × tmux-card）——
  即 floating-card code-map 漂移 17 双开 PTY 嫌疑的协议层成因 ⚠
- 应用层 'ping' 客户端不回，纯喂看门狗——协议残留

## 跨域 import 图（机械层，边数以 code-inventory.md 为准）

详见 code-inventory.md 末节（机械生成，唯一计数出处——字面拷贝已实测漂移两轮，家训：转述引用式）。要点：

- **client-shell 是被依赖枢纽**（canvas-tree、floating-card 两域指向它的边最多）——底座定位属实
- **ai-chat ↔ client-shell 双向边显著**——orb.ts 域归属漂移（两域 code-map 均已立案）
  的边级证据
- canvas-tree → ai-chat 仅 1 边（tree-render → ws-channel）——比想象中干净
- infra → 各域边全部是 tests/ 引用——测试跨域是常态，不算耦合

## 跨域不变量（现有代码实际维持的）

- 客户端无直接文件系统写：一切落盘经 /files/* 且 verifyLocalOrigin 门控 ✅
- WS 消息收发对称（除 error）✅；terminal-open 必须 tag 匹配认领 ✅
- 会话文件全量真相源在服务端（双写者是漂移不是设计）⚠

## 跨域漂移清单（本层独有立案）

1. **sessions/*.json 双端双写者无协调**（最危险，见写入矩阵）
2. **active.json 三写者 read-merge-write 无锁**
3. **API_BASE 三套风格 10 处重复**
4. **【已结案】anim scope 机制形同虚设**（1 租户 + 三域绕过）——ADR-004 裁决二：
   废弃泛化声称，定位改为「直透为官方用法、scope 按需（tree-render 单租户）」，
   注释契约已重写，不再是漂移
5. **KFMState/L 私有字段直写泛滥**，setter 与钩子被绕过
6. **ws error 消息无人接收**；command action 无静态约束 + 无生产者（ADR-004 后）
7. **/api/system/restart 单挂载不一致**
8. **kfm-no-compact 无写者**（协议无生产者）
9. **localStorage 无登记制度**（本表之前零约束）
10. **ai-chat 直读 canvas-tree 状态**（orb-chat-run.ts:184、role.card.ts:187,195 读
    KFMState.currentRoot 喂 loadFileTree）——无接口层
11. **【已结案】KFMState 孤儿 API 死协议面**（cart*/openCards 等）——已随死代码
    批次二删除（client-shell 漂移 11 同案）
12. **terminal-open/close 跨域两写者**（双开 PTY 的协议层成因——BAR-RECONNECT-01
    已修客户端双发，两写者结构本身保留：terminal-card 与 tmux-card 各有合法打开路径）

## 指针

- 域内漂移 → 六份 code-map.md 漂移清单（共 87 条）
- 安全面（origin 防护、PTY 所有权）→ server/code-map.md 漂移 7-9
- 后续动作统一登记 → ../active/STACK.md
