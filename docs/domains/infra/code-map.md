> 这是什么：infra 域**代码现状**测绘（实然）——构建/部署/文档管线此刻到底是什么，含与契约的漂移。
> 应然去哪找：设计契约 → contract.md；检查设计宪法 → ../guides/doc-maintenance.md。
> 机械层对照：文件/行数/导出符号 → ../code-inventory.md（脚本生成，可重跑）。

# infra 代码地图（code-map）

## 测绘元数据

- 基准：commit 03da8c9 · 2026-07-29 · 域规模 68 文件 / 9510 行（机械清单口径）
- 派生真相实测：一律以 sync-counts 实时输出为准，本文不记快照值
  （2026-07-30 语义巡逻裁决：快照数字「28 check/456 测试」反复诱发假阳性——
  快照必有保质期，消灭来源，三档阶梯消灭档）
- 方法：subagent 七问侦察 + 主 agent 抽查核实（check 链漂移、tag-advisor exit 码已亲验）
- 注意：本域契约文件清单列了 scripts/deploy.sh、scripts/agent/、.githooks/、package.json，
  但测绘时 DOMAIN_SRC 的 infra 条目不含它们（已随本次测绘补登，见漂移 6）

## 一句话职责

构建产物链（check → sass → esbuild 双 bundle → 握手信息）、部署闭环
（build → restart → 握手断言）、31 个 check（含 check-checks 自身）组成的文档/代码管线、agent-runner 工具。

## 承重入口

| 入口 | 位置 | 调用方 |
|------|------|--------|
| build.mjs（无导出，顶层即入口） | chain.mjs 委托 + esbuild | package.json build/dev/watch、deploy.sh:11 |
| chain.mjs（check 链唯一出处，STEPS 36 步） | scripts/check/chain.mjs | package.json:11、build.mjs 委托 |
| 31 个 check-*.mjs（含 check-checks 自身，业务检查 30） | 全部顶层执行、exit 1 硬失败 | chain.mjs STEPS 统一调度 |
| DOCS_ROOT / DOMAIN_SRC 共享常量 | scripts/check/docs-root-const.mjs、domain-src.mjs | 11 个 check / freshness + 清单生成器 |
| sync-counts.mjs | 唯一会回写文档的 check | 链内 --check-only；无参回写 |
| scripts/agent/agent-runner.mjs | 导出 runAgent/extractJson | tag-advisor.mjs:13 |
| scripts/agent/semantic-chain.mjs | 语义巡逻总 runner（腿三：三态 verdict → ledger 信箱） | cron 每日 04:17 / 每周一 04:23（带基准） |
| scripts/deploy.sh | 三步部署闭环 | 人 + docs/workflows/bug-fix.yaml:17 |

薄门面：tests/runner.ts 纯 re-export tests/harness.ts；.githooks 两个壳。

## 状态所有权

- 域内脚本基本无状态（一次性进程）；errors 累加 → 末尾 exit 1 是统一模式
- dist/build-info.json 是跨进程状态：build.mjs:75 唯一写者；读者
  src/server/routes/files.ts（/api/system/info 暴露）+ deploy.sh 握手断言
- tests/preload.mjs 模块级 mock localStorage（全测试共享，reset-hooks 隔离）

## 核心流程

**构建链**：chain.mjs 全链（36 步，含 sass 编译与 npm test）→ 复制 stealth 脚本 →
esbuild server ESM + client IIFE（external 硬编码 build.mjs）→ checkFreshness
双产物 → 写 dist/build-info.json → index.html 注入 ?v=buildStamp → bundle 大小冒烟。

**部署闭环**：deploy.sh：npm run build → 读新包 buildTime → kfm-restart.sh（POST
/api/system/restart，服务端先回 200 再 spawn detached systemctl）→ 轮询
/api/system/info 至 200 → 断言运行 buildTime ≥ 新包，否则 exit 1。

## 持久化/外部边界

- **写 git 跟踪文件**：build.mjs 改写 tracked 的 public/index.html（:131）+
  public/css/*.css（sass）——每次构建让工作区变脏（见漂移 10）；sync-counts 回写
  README/CLAUDE/contract/testing.md；gen-code-inventory 写 code-inventory.md
- 网络：agent-runner fetch OpenAI 兼容端点（120s 超时，runAgent timeoutMs 可配）；deploy/kfm-restart curl 本机
- 仓库外：~/.kfmv4/providers.json（agent-runner 读 key；src/server/index.ts:145-149
  另有权限检查——server 域越界读 agent 配置）

## 强制不变量（附证据）

- check 链唯一出处：每个 check-*.mjs 必须挂入 chain.mjs STEPS、链上脚本必须存在、
  package.json 与 build.mjs 必须委托且不得回潮手写单个 check（check-checks 执法）
- 构建产物新鲜度：产物不得旧于任何 src/*.ts（build.mjs:20-32）
- 计数漂移中断：sync-counts --check-only 漂移 exit 1；版本三方一致（check-versions）
- 钩子健康：core.hooksPath + 可执行位 + 薄壳引用（check-hooks）
- 探针负例必须报红且病因字串匹配（check-probes）；as any 白名单制（check-as-any）
- 部署握手：运行 buildTime 早于新包即 exit 1（deploy.sh:24-27）

## 漂移清单（实然 ≠ 应然）

1. **【已结案 2026-07-30】check 链双份实现已漂移 → 单源化消灭**：package.json:11 与 build.mjs 曾是同一链
   的两份手写拷贝（顺序不同、阻断语义不同）。修复：唯一出处 scripts/check/chain.mjs（STEPS 数组），
   package.json "check" 与 build.mjs 均委托；build 的 check-uncommitted 降级改为显式 --soft 声明。
   check-checks 升级为唯一出处执法者（每 check 必挂链/链上脚本必存在/禁回潮手写）。
2. **【已结案 2026-07-29】契约硬规则 1「新 check 一律 hard fail」曾有未登记例外**：check-release-radar
   设计性 warning-only、exit 0；check-uncommitted ≤3 也只警告。例外清单已登记
   contract.md 硬规则 1 + workflows/discipline-mechanize.yaml（语义审计 B1）。
3. **【已结案 2026-07-29】tag-advisor exit 1 语义曾是幽灵**：头注释与 guides/agent-runner.md
   曾声称「exit 1 = 模糊输出交调用方」，代码只有 exit 0 与 exit 2。修复：协议改为
   exit 0（可机械消费）/ exit 2（重试耗尽或异常，交调用方），头注释与
   agent-runner.md 已对齐（语义审计 B2）。
4. **【已结案 2026-07-29】tag-advisor 机械下限注释曾 ≠ 代码**：头注释曾写「有 feat → minor」，
   代码 floor = breaking>0 ? major : total>0 ? patch : none（:33）。修复：头注释改为
   与代码一致（feat 不抬下限，级别归语义层）（语义审计 B2 附带）。
5. **死代码**：renderTemplate（agent-runner.mjs:32）全仓库无调用，尽管头注释把
   「{{var}} 模板注入」列为设计支柱。
6. **infra 域映射残缺（本次测绘已修）**：DOMAIN_SRC 的 infra 条目原只有
   build.mjs/scripts/check//tests//public/css/，契约文件清单声称的 scripts/deploy.sh、
   scripts/agent/、.githooks/、package.json 全部不在映射内 → contract-freshness 对
   这些文件的提交永久失明，code-inventory 也不含 scripts/agent/*。映射盲区检查只扫
   src/，所以自洽地报不出来。**已随本次测绘补登 domain-src.mjs 并重生成清单**。
7. **contract 样式节失真**：只提 base.scss → base.css，实际 sass 编译 base+sidebar
   两份；5 个 css 中 tmux-card/xterm/z-index 无 scss 源，陷阱 1 对它们不适用。
8. **check-test-patterns 注释指向错误**：头注释称计数模式在 check-consistency.mjs，
   实际在 sync-counts.mjs:37；check-consistency 是 CLAUDE.md 路由表检查。
9. **smoke.mjs:4 注释硬编码「287 个测试」**，实测 456——sync-counts 的 TARGETS
   不覆盖 smoke.mjs。
10. **构建制造未提交改动**：build.mjs 改写 tracked 的 index.html + css，每次构建让
    工作区变脏，与 check-uncommitted 的心法 14 形成张力——chain.mjs 的 --soft 降级
    或许正是 workaround（存疑）。
11. **【已结案 2026-07-30】gen-code-inventory 无管线挂接**：已移入 scripts/check/ 并加
    --check-only 挂 check 链（sync-counts 后、tsc 前）+ 探针负例——清单不新鲜即中断，
    不再靠人记得重跑。
12. **【已结案 2026-07-30】Kimi provider temperature 1**：providers.config.json 的 params 覆盖
    默认 0.2 系端点硬性要求——但语义审计首轮实测该端点对大 prompt 连续空响应，用户拍板
    将 Kimi 撤下链首（撤下当日链为 deepseek → 阶跃星辰，同日再重排；现链以
    guides/agent-runner.md「provider 兜底链」节为准），配置已不含此项。
13. **进程管理双路径**：npm start 用 lsof kill（package.json:15），生产走 systemctl；
    dev/prod 语义不同，文档未对齐。
14. 次要：tests/runner.ts 与 harness.ts 双门面冗余；public/css/base.css.map 是
    gitignored 陈旧残留；npm 上下文裸 sass、build.mjs 上下文 npx sass（单源化后统一
    走 chain.mjs 的 npx 形态）。

## 陷阱指针

已定型陷阱见 contract.md #陷阱 + ../constraints/diagnostics.md（构建/Bundle 节）。
测绘新捕获：漂移 1 说明「同一链两份拷贝」必然漂移——已按编译方向升档消灭
（chain.mjs 唯一出处，2026-07-30），同类「双份手写」设计一律禁止，改单一出处+生成。
