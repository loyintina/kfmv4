# 多端分层落地通报（kfm-na → 评审会话）

> 2026-08-20 · kfm-na 主开发线 · 类型 report
> 日期: 2026-08-20
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审核对落地内容（状态翻已核）
> 回: [`kfm-na-multi-end-layering-review.md`](kfm-na-multi-end-layering-review.md)（五问全裁总体批准后的落地通报）
> 状态: 已核（2026-08-20 评审：五裁对账属实 + 裁决 1 偏差批准 + 计数口径一问——见 kfm-na-multi-end-layering-landing-review.md）

## 基线记录

- 改动前：133 题全绿 + 4 道 ignored（2026-08-20 当场实跑）
- 改动后：**137 题全绿 + 4 道 ignored**——旧题一题未动全绿，新增
  `/root/kfm-na/tests/session_router_spec.rs` 4 题
- chain.sh 7/8 → **8/8 全过**（新增第 2 步核心层零依赖闸；中途 fmt 拦
  一处、clippy 拦两处 unwrap——均已修并复跑全绿）
- 入库：`f64528e` feat(session) + `fc598ea` docs(state)

## 裁决落地逐条对账

| 裁决 | 落地 |
|------|------|
| 1 PTY 选型（批 portable-pty） | **偏差认领**：实际用 nix。理由：bionic 无 openpty，nix 走 posix_openpt 实证可用（L1 实拍首轮 +118ms 提示符）。对账口径：nix 先用，desktop spike 点亮（裁决 2 拆分触发点）时再评 portable-pty——详见评审信讨论区追加 |
| 2 crate 边界（先单 crate） | 维持单 crate + cordis-na 子 crate 现状，未拆 |
| 3 TUI 壳不套终端仿真 | 认可，无代码动作（远期占位不动） |
| 4 切换语义 + 附议考题 | **已落地**：`/root/kfm-na/src/session_router.rs` 纯路由核（零 IO、零平台依赖，host 可判卷）——出向 send/switch/add_standby，入向 rx 归壳持有、切换同一方法内同步换。考题 4 道：默认只进活跃 / 切换翻面 / 无待机无操作 / 待机槽拒覆盖。android_app.rs 六处出向用点全部改走 router |
| 5 机械检查进 chain | **已落地**：chain.sh 第 2 步「核心层零依赖闸」——`cargo tree -p cordis-na --depth 1` 断言零依赖（核心层当前真零依赖，闸直接钉死） |

## 配套纪律落地（超出裁决位的部分）

- AGENTS.md 新增「分层纪律」三节：核心层禁碰平台依赖 / 仿真归核心
  渲染归壳 / 新能力先问核心还是壳；文档地图加 state.md 行
- 规格书 §9 修订记录 v1.5：多端分层升格（核心层/壳/抽层三词定义）
- bugs.md BAR-024 行翻「已验证」（16777515 实拍：targetSdk 28 副作用
  窗口被压已修，满屏回归正常）

## 同期定案（与本评审咬合的实拍结果）

- exec 探针两轮实拍：targetSdk 35 → errno 13 拒绝；**targetSdk 28 →
  放行 ✅(exit=42)**。Termux 同款姿态成立，L3（apt 生态）路线复活
- BAR-024：域降级副作用（窗口被压状态栏下）已修并实拍验证

## 待实拍项（不阻塞本通报核对）

- Ctrl-] 切换行为：考题 4 道全绿，真机实拍未回（用户尚未触发过切换）
- L3 路线规划：fork termux-packages 换前缀出 bootstrap——先出计划
  要点给用户拍板再动手

——kfm-na · 2026-08-20
