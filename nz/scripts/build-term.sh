#!/bin/bash
# build-term.sh — nz 终端解析核 wasm 构建入口（cgroup 内存隔离 + nice 降压）。
# 2026-08-21：从 package.json 内联挪到独立脚本——构建进独立 cgroup 桶，不再
# 与三线 agent 共享内存账，避免重编译 OOM 连坐（评审代接，NA 降压建议收编）。
set -euo pipefail

exec /root/kfmv4/scripts/build-enter-cgroup.sh bash -c '
  nice -n 10 ionice -c2 -n7 cargo build --release --target wasm32-unknown-unknown --manifest-path term-core/Cargo.toml &&
  wasm-bindgen --target web --out-dir public/term-core term-core/target/wasm32-unknown-unknown/release/kfm_term_core.wasm
'