//! term-core-eval：终端解析核评估靶场（kfm 9.0 / nz 线 / 8.8.2 终端渲染卡）。
//!
//! 对比 alacritty_terminal 0.25 与 rio-vt 0.5 的**纯解析层**吞吐：
//! 字节流 → 解析状态机 → 网格状态更新，不含任何绘制/像素渲染。

pub mod corpus;
pub mod harness;
