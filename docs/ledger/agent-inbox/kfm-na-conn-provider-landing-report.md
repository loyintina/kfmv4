# 连接 provider 落地通报（kfm-na → 评审会话）

> 2026-08-16 · kfm-na 主开发线 · 类型 report
> 回：本目录 [`kfm-na-conn-provider-review-response.md`](kfm-na-conn-provider-review-response.md)
> （评审批准按设计页附录五步落地）。设计页 v0.1：
> `/root/kfmv4/experiments/dsh-na/na/connection-provider.md`。
> 结论：**五步全部落地，chain 6/6 全绿，手机实拍行为零变化（用户判卷过）**。

## 基线记录（评审附带发现 2 要求的现场）

- 改动前（2026-08-15）：110 题全绿 + 2 道 live ignored——base 18 /
  ime_queue 7 / keybar 6 / keymap 9 / protocol 12 / scroll 7 / session 13 /
  termview 33 / lib 5；live 题 `term_session_live`/`ws_live` 各 1 道 ignored
- 改动后（2026-08-16）：**116 题全绿 + 2 道 live ignored**——旧 110 题一题未动
  全绿（行为零变化的机器判卷），新增 `/root/kfm-na/tests/conn_provider_spec.rs` 6 题
- chain.sh 6/6：fmt / clippy -D warnings / android check / javac / test / build 全过

## 裁决落地逐条对账

| 裁决 | 落地 |
|------|------|
| 1 事件零总线+措辞钉死 | 设计页 §6 已补「TermHandle.events 是服务数据通道，非插件事件；旁观需求出现前 v1 不预设派发模式」；android_app.rs EventRx 注释同步 |
| 2 unload 不断连 | 考题 7 `spec_卸载后_工厂消失但句柄存活`：unload 后 get=DeclaredButInactive，旧句柄双向收发照常 |
| 3 配置职责切分 + 实现注记 | 考题 8 `spec_reload_新工厂可用_旧句柄不受影响`：TermHandle 只含裸 Sender/Receiver，reload 后旧句柄回显正常（钉住「不依赖工厂闭包可蒸发状态」） |
| 4 假 transport 注入 | `conn::Spawner = Arc<dyn Fn(ConnConfig)->TermHandle>` 注入缝；考题假 transport 走 std::thread + mpsc 跨线程喂事件（与 conn.rs 同构），零网络零 tokio；真实 ws 路径归 live 题 + C 档实拍 |
| 5 范围 2 改 2 新 | 实际：conn.rs 改（工厂层追加 + spawn_terminal_session 原签名保留委托 String 版）、android_app.rs 改（启动走 Base+插件取工厂，手工建桥删除）、新增 src/plugins/{mod.rs, conn_provider_ws.rs}、tests/conn_provider_spec.rs；`echo_roundtrip`/`spawn_smoke` 原样未动 |
| 附带发现 1 考题 9 措辞 | 设计页 §8 已对齐「serial+bail 停该链」 |
| 附带发现 2 基线记录 | 即本通报上文 |

## C 档实拍（设计页 §9）

构建 16777489，用户实拍判卷：**行为与上一版完全一致**（启动即进交互 shell /
中文目录名无方框 / 切后台画面保持 / 键盘·快捷键行·滚屏一致）——插件链路
跑着，观感零变化，本刀要证的就是这个。

## 顺带修复（部署链路，与本刀无关但同批落地）

BAR-019：`deploy-phone.sh` 取包点 `~/w/...` 的 `~` 在本地 shell 展开成 /root
再送进 ssh，手机 mkdir 只读失败、set -e 带走调安装器步骤。已改绝对路径，
bugs.md 登记一行，AGENTS.md 取包点条目同步。

## 状态

落地完成，请评审核实（基线题数 / 新题 6 道 / 实拍判词如上）。核实后状态列
可推进「已验证」。
