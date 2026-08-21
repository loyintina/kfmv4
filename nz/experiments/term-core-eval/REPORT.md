# term-core-eval：终端解析核选型评估（alacritty_terminal vs rio-vt）

> kfm 9.0（nz 线）8.8.2 终端渲染卡 · 开工第一步：选 WASM 终端解析芯。
> 本报告数字全部来自本机实际运行输出（见「复现」一节），无编造数据。

## 0. 结论速览（初步倾向，非最终裁决）

- 吞吐：rio-vt 全面不慢，plain 语料快 ~4.9x，color ~2.1x，fullscreen ~1.25x，cjk 基本持平（~1.0x）。
- WASM：rio-vt 0.5.25（关默认 feature）开箱编译 wasm32-unknown-unknown 通过；
  alacritty_terminal 0.25.0 被非 target-gated 的 `polling` 依赖阻断，需 patch 才能上 wasm。
- 初步倾向 rio-vt 作为 WASM 解析芯；功能覆盖/迁移成本/维护面未评估，不下最终裁决。

## 1. 环境

| 项 | 值 |
|---|---|
| 机器 | 阿里云 ECS（`iZ0jl1wp0yifd805zqcb28Z`），4 vCPU Intel Xeon Platinum，7GiB RAM，Linux 6.8.0-100-generic x86_64 |
| rustc | 1.95.0 (59807616e 2026-04-14)，cargo 1.95.0 |
| alacritty_terminal | 0.25.0（与 /root/kfm-na/Cargo.toml 一致） |
| rio-vt | 0.5.25（crates.io 最新，`cargo search rio-vt` 实测） |
| rio-vt features | `default-features = false`（默认的 `pty` 拉 corcovado/teletypewriter，解析基准与 wasm 都用不上） |
| 构建 | `--release`（opt-level=3，默认 LTO 设置） |

## 2. 语料（corpus/，确定性生成，固定种子 xorshift64*）

| 语料 | 内容 | 字节数 |
|---|---|---|
| plain | 大段纯文本行（模拟 cat 日志滚动） | 2,097,210 |
| color | 密集 SGR（ls --color / git log / git diff 风格混合） | 2,097,236 |
| fullscreen | 全屏重绘流（htop 风格：CUP+EL+密集底色 SGR，进/退备用屏） | 2,098,567 |
| cjk | 中日韩宽字符混合（汉/假名/谚文/全角标点 + 少量 SGR） | 2,097,162 |

生成器在 `src/corpus.rs`；`cargo run --release -- gen` 可重新生成，输出逐字节可复现。

## 3. 解析层 API 形状（喂字节的入口）

### alacritty_terminal 0.25

```rust
let mut term = Term::new(config, &TermSize::new(cols, rows), VoidListener);
let mut processor = vte::ansi::Processor::new();
// vte 0.13 的 advance 是逐字节签名（byte: u8），不是 slice：
for &byte in bytes {
    processor.advance(&mut term, byte); // 字节 → vte 状态机 → Term 网格
}
```

`Term` 实现 `vte::ansi::Handler`，解析回调直接驱动网格写入/滚动/模式切换。
这是 alacritty 主程序 PTY 读循环的同款用法（event_loop.rs:155 同样逐字节喂）；
不含 `RenderableContent` 迭代与任何绘制。

### rio-vt 0.5

```rust
let mut term = Crosswords::new(size, CursorShape::Block, VoidListener, WindowId::from(0), 0, scrollback);
let mut processor = performer::handler::Processor::default();
processor.advance(&mut term, bytes); // 字节 → rio 自研 parser → Crosswords 网格
```

`Crosswords`（rio 的 Term 等价物）实现 `performer::handler::Handler`，语义与上面对齐。
注意 `Processor::advance` 内带 synchronized-update（BSU/ESU）缓冲分支，本语料不含该类序列，走直通路径。

## 4. 解析层吞吐（只计「字节流 → 解析器状态机 → 网格状态更新」）

方法：每轮重建 harness（相同初始状态），按 16KiB 块喂入，预热 2 轮，
计时 7 轮取最小耗时；两端 grid damage 标记均为写单元格的固有副作用，对比公平。
终端尺寸 80×24，scrollback 10000。

| 语料 | alacritty MB/s | rio-vt MB/s | rio/alac |
|---|---|---|---|
| plain | 60.6 | 298.1 | 4.92x |
| color | 67.9 | 142.9 | 2.11x |
| fullscreen | 96.1 | 120.4 | 1.25x |
| cjk | 79.3 | 76.6 | 0.97x |

连跑两轮验证稳定性（另一轮 59.9/295.0、67.9/142.0、95.8/119.6、75.5/75.8），波动 <5%。

注意接口形状差异：alacritty 的 `vte 0.13::Processor::advance` 是逐字节签名（alacritty 生产
事件循环也逐字节喂），rio 的 `Processor::advance` 是 slice 批量入口。逐字节循环在 alacritty 侧
引入了真实的每字节调用开销——这正是两条生产路径的真实形状，但解读倍率时应意识到其中一部分
来自接口批量度而非状态机本身。cjk 语料两边基本持平，也与「接口开销被 UTF-8 解码摊薄」一致。

## 5. WASM 可行性（wasm32-unknown-unknown）

| crate | 编译结果 | 阻断点 |
|---|---|---|
| alacritty_terminal 0.25.0 | ❌ 失败 | `polling` 3.11 不支持 wasm32-unknown-unknown（`compile_error!`，lib.rs:118）。polling 是 alacritty_terminal 的非 target-gated 硬依赖（`[dependencies] polling = "3.0.0"`，用于 `event_loop.rs` 的 PTY Poller），无法靠关 feature 绕开；需 fork/patch 把 tty/event_loop 模块 cfg 门控掉才可能在 wasm 上只用解析层。 |
| rio-vt 0.5.25 (no default features) | ✅ 通过（5.2s 增量构建） | 无。wasm32 路径有专门适配（`web-time` 依赖），pty/clipboard/renderer 等重依赖全部 optional 且默认关。 |

检查方式：`cargo build --target wasm32-unknown-unknown --lib`（lib target 依赖两 crate 并调用其解析入口）；另用 `cargo build -p <crate> --target wasm32-unknown-unknown` 分别隔离验证，rio-vt 独立通过、alacritty_terminal 独立失败于 polling。

## 6. 初步倾向

倾向 **rio-vt 0.5.25** 作为 kfm 9.0 的 WASM 终端解析芯，理由：

1. **WASM 是硬门槛**：kfm 9.0 的目标载体是 WASM，rio-vt 关默认 feature 后开箱编译通过；
   alacritty_terminal 需要 fork 并 cfg 门控 tty/event_loop/polling，维护一份私有补丁的长期成本不低。
2. **解析层吞吐不慢反快**：四类语料 plain 快 ~4.9x、color ~2.1x、fullscreen ~1.25x、cjk 持平。
   即便扣除逐字节 vs slice 接口差异（见 §4 注），rio-vt 在密集转义语料上的优势仍然实在。
3. rio-vt 本就是「可嵌入终端核心」定位（含 grid/selection/search），crate 边界与 kfm 的需求更贴合。

未评估、留待终裁的点：转义序列功能覆盖度对比（synchronized output、Kitty keyboard/graphics、
OSC 52 等 kfm 需要的具体序列）、CJK 路径为何两边持平（值得 profile 一次）、许可证与供应链、
kfm-na 现有 alacritty_terminal 代码的迁移成本、以及 alacritty_terminal 逐字节接口若自行加一层
批量缓冲后能追回多少差距。**本报告不下最终裁决。**

## 7. 复现

```bash
cd /root/kfmv4/nz/experiments/term-core-eval
cargo run --release          # 语料缺失则先生成，再跑基准
cargo run --release -- gen   # 只生成语料
```

## 8. 备注 / 坑

- 本机直连 crates.io 批量下载会停滞；本项目 `.cargo/config.toml` 配了 rsproxy 镜像。依赖全部落缓存后可用 `--offline` 规避网络。
- **rustix/std feature 坑**：alacritty_terminal 单独构建时编译失败——rustix-openpty 0.1.1 以
  `default-features = false` 依赖 rustix 0.38，无 `std` feature 时 rustix 的 `AsFd` 是 no_std
  polyfill，与 alacritty 代码里的 `std::os::fd::OwnedFd` 不匹配。alacritty 完整应用靠依赖图里其它
  crate 捎带打开 rustix/std。本项目在 Cargo.toml 里显式加
  `rustix = { version = "0.38", default-features = false, features = ["std"] }`（cfg(unix) 门控，
  避免拖累 wasm 构建）走 feature 统一修复。
- **vte 0.13 API 与前 agent 设想不符**：`ansi::Processor::advance` 是逐字节签名（`byte: u8`），
  不是 slice；alacritty 自己的 event_loop.rs:155 也是逐字节喂。harness 按真实生产用法改为字节循环。
- `Cursor` 的位置字段在 0.25 叫 `point`（`Point { line, column }`），不叫 `pos`。
- **wasm 构建首次很慢**（rio-vt 的 wasm 链会拉 web-time/js-sys/wasm-bindgen，全树重编），
  前台 600s 超时被杀过一次；落日志后台跑才拿到真实报错（polling 的 compile_error!）。
- `src/corpus.rs` 里 `used` 变量是死代码（只累加不读取），留着两个 warning 未清，不影响数字。
