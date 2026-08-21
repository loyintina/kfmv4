//! bench：语料生成（落盘 corpus/，可复现）+ 解析层吞吐基准。
//!
//! 用法：
//!   cargo run --release -- gen    # 只生成语料
//!   cargo run --release           # 语料缺失则生成，然后跑基准
//!
//! 计时口径：每轮重新构造 harness（相同初始状态），只给 feed 循环计时，
//! 每类语料跑 ROUNDS 轮取最小耗时（最稳值），输出 MB/s 与相对倍率。

use std::fs;
use std::hint::black_box;
use std::path::{Path, PathBuf};
use std::time::Instant;

use term_core_eval::corpus::CORPORA;
use term_core_eval::harness::{alacritty, rio};

const COLS: usize = 80;
const ROWS: usize = 24;
const SCROLLBACK: usize = 10_000;
/// 模拟 PTY 读缓冲的分块大小。
const CHUNK: usize = 16 * 1024;
const WARMUP: usize = 2;
const ROUNDS: usize = 7;

fn corpus_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("corpus")
}

fn ensure_corpus() {
    let dir = corpus_dir();
    fs::create_dir_all(&dir).unwrap();
    for (name, gen) in CORPORA {
        let path = dir.join(format!("{name}.bin"));
        if path.exists() {
            continue;
        }
        let data = gen();
        fs::write(&path, &data).unwrap();
        println!("generated {} ({} bytes)", path.display(), data.len());
    }
}

struct Row {
    corpus: String,
    bytes: usize,
    alacritty_mbs: f64,
    rio_mbs: f64,
}

fn bench<F>(mut make_harness: impl FnMut() -> F, mut feed: impl FnMut(&mut F, &[u8]), data: &[u8]) -> f64 {
    // 预热。
    for _ in 0..WARMUP {
        let mut h = make_harness();
        for chunk in data.chunks(CHUNK) {
            feed(&mut h, chunk);
        }
    }
    let mut best = f64::MAX;
    for _ in 0..ROUNDS {
        let mut h = make_harness();
        let t0 = Instant::now();
        for chunk in data.chunks(CHUNK) {
            feed(black_box(&mut h), chunk);
        }
        let elapsed = t0.elapsed().as_secs_f64();
        if elapsed < best {
            best = elapsed;
        }
    }
    // MB/s（按 1MB = 1_000_000 字节）。
    data.len() as f64 / best / 1_000_000.0
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    ensure_corpus();
    if args.get(1).map(|s| s.as_str()) == Some("gen") {
        return;
    }

    println!();
    println!("terminal: {}x{} scrollback={}  chunk={}B  warmup={} rounds={} (取最小耗时)", COLS, ROWS, SCROLLBACK, CHUNK, WARMUP, ROUNDS);
    println!();
    println!("{:<12} {:>10} {:>18} {:>18} {:>10}", "corpus", "bytes", "alacritty MB/s", "rio-vt MB/s", "rio/alac");
    println!("{}", "-".repeat(72));

    let mut rows: Vec<Row> = Vec::new();
    for (name, _) in CORPORA {
        let data = fs::read(corpus_dir().join(format!("{name}.bin"))).unwrap();

        let alacritty_mbs = bench(
            || alacritty::Harness::new(COLS, ROWS, SCROLLBACK),
            |h, chunk| {
                h.feed(chunk);
            },
            &data,
        );
        let rio_mbs = bench(
            || rio::Harness::new(COLS, ROWS, SCROLLBACK),
            |h, chunk| {
                h.feed(chunk);
            },
            &data,
        );

        // 防优化：各跑一遍把网格状态读出来消费掉。
        let mut ha = alacritty::Harness::new(COLS, ROWS, SCROLLBACK);
        ha.feed(&data);
        black_box(ha.checksum());
        let mut hr = rio::Harness::new(COLS, ROWS, SCROLLBACK);
        hr.feed(&data);
        black_box(hr.checksum());

        let ratio = rio_mbs / alacritty_mbs;
        println!(
            "{:<12} {:>10} {:>18.1} {:>18.1} {:>9.2}x",
            name,
            data.len(),
            alacritty_mbs,
            rio_mbs,
            ratio
        );
        rows.push(Row {
            corpus: name.to_string(),
            bytes: data.len(),
            alacritty_mbs,
            rio_mbs,
        });
    }

    // 机读摘要（供报告摘录）。
    println!();
    println!("--- summary (csv) ---");
    println!("corpus,bytes,alacritty_mbs,rio_mbs,ratio");
    for r in &rows {
        println!(
            "{},{},{:.1},{:.1},{:.2}",
            r.corpus,
            r.bytes,
            r.alacritty_mbs,
            r.rio_mbs,
            r.rio_mbs / r.alacritty_mbs
        );
    }
}
