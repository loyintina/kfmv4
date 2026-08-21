//! 确定性语料生成器：四类真实感终端字节流，每类 ≥ 1MiB。
//!
//! 全部使用固定种子 xorshift64* PRNG，输出逐字节可复现；
//! 落盘到 corpus/ 后 bench 直接读盘，不重复生成。

/// xorshift64* 确定性 PRNG（不引外部 rand 依赖，保持轻）。
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed ^ 0x9E3779B97F4A7C15)
    }

    #[inline]
    pub fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    #[inline]
    pub fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

/// 每类语料目标大小：2 MiB（超过 1MiB 的硬要求，也让计时更稳）。
pub const TARGET_SIZE: usize = 2 * 1024 * 1024;

const WORDS: &[&str] = &[
    "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "terminal", "render",
    "parser", "escape", "sequence", "buffer", "scrollback", "grid", "cell", "glyph", "kernel",
    "syscall", "daemon", "socket", "packet", "thread", "mutex", "cache", "branch", "compile",
    "linker", "module", "crate", "token", "stream", "cursor", "window", "viewport", "latency",
    "throughput", "benchmark", "profile", "flame", "trace", "alloc", "heap", "stack", "frame",
];

const FILES: &[&str] = &[
    "main.rs", "lib.rs", "Cargo.toml", "README.md", "build.rs", "parser.c", "grid.cpp",
    "render.go", "server.ts", "style.css", "index.html", "Makefile", "Dockerfile",
    "config.yaml", "schema.sql", "test_spec.rb", "deploy.sh", "notes.txt", "data.bin",
];

fn push_line(out: &mut Vec<u8>, line: &str) {
    out.extend_from_slice(line.as_bytes());
    out.push(b'\n');
}

/// plain：大段纯文本输出（模拟 cat 日志 / 编译输出滚动）。
pub fn plain() -> Vec<u8> {
    let mut rng = Rng::new(0x9A1A);
    let mut out = Vec::with_capacity(TARGET_SIZE + 4096);
    let mut lineno = 0u64;
    while out.len() < TARGET_SIZE {
        let words = 8 + rng.below(8);
        let mut line = String::with_capacity(96);
        line.push_str(&format!("{:>6}  ", lineno));
        for i in 0..words {
            if i > 0 {
                line.push(' ');
            }
            line.push_str(WORDS[rng.below(WORDS.len())]);
            if rng.below(16) == 0 {
                line.push(',');
            }
        }
        line.push('.');
        push_line(&mut out, &line);
        lineno += 1;
    }
    out
}

/// color：密集 SGR 转义（模拟 ls --color=always 与 git log/diff --color）。
pub fn color() -> Vec<u8> {
    let mut rng = Rng::new(0xC010);
    let mut out = Vec::with_capacity(TARGET_SIZE + 4096);
    while out.len() < TARGET_SIZE {
        match rng.below(3) {
            // ls --color=always 风格：每个文件名片段都被 SGR 包裹。
            0 => {
                let mut line = String::with_capacity(256);
                for _ in 0..(4 + rng.below(4)) {
                    let name = FILES[rng.below(FILES.len())];
                    match rng.below(4) {
                        0 => line.push_str(&format!("\x1b[0m\x1b[01;34m{}\x1b[0m/  ", name)),
                        1 => line.push_str(&format!("\x1b[0m\x1b[01;32m{}\x1b[0m*  ", name)),
                        2 => line.push_str(&format!("\x1b[0m\x1b[00;36m{}\x1b[0m@  ", name)),
                        _ => line.push_str(&format!("\x1b[0m{}  ", name)),
                    }
                }
                push_line(&mut out, &line);
            }
            // git log --color 风格。
            1 => {
                let hash: u64 = rng.next();
                push_line(&mut out, &format!("\x1b[33mcommit {:040x}\x1b[m", hash));
                push_line(&mut out, &format!("Author: dev <dev@example.com>"));
                push_line(
                    &mut out,
                    &format!(
                        "    \x1b[1m{}\x1b[m the {} in {}",
                        WORDS[rng.below(WORDS.len())],
                        WORDS[rng.below(WORDS.len())],
                        WORDS[rng.below(WORDS.len())]
                    ),
                );
            }
            // git diff --color 风格。
            _ => {
                push_line(&mut out, "\x1b[1mdiff --git a/main.rs b/main.rs\x1b[m");
                push_line(&mut out, "\x1b[36m@@ -10,6 +10,7 @@\x1b[m");
                for _ in 0..6 {
                    let body = format!(
                        "let {} = parse_{}({});",
                        WORDS[rng.below(WORDS.len())],
                        WORDS[rng.below(WORDS.len())],
                        rng.below(100)
                    );
                    match rng.below(3) {
                        0 => push_line(&mut out, &format!("\x1b[32m+{}\x1b[m", body)),
                        1 => push_line(&mut out, &format!("\x1b[31m-{}\x1b[m", body)),
                        _ => push_line(&mut out, &format!(" {}", body)),
                    }
                }
            }
        }
    }
    out
}

/// fullscreen：全屏重绘流（模拟 vim/htop：CUP 归位 + 逐行 EL + 颜色，整屏整屏刷）。
pub fn fullscreen() -> Vec<u8> {
    const COLS: usize = 80;
    const ROWS: usize = 24;
    let mut rng = Rng::new(0xF011);
    let mut out = Vec::with_capacity(TARGET_SIZE + 8192);
    // 进备用屏幕、隐藏光标（真实 fullscreen 应用的开场）。
    out.extend_from_slice(b"\x1b[?1049h\x1b[?25l");
    let mut frame = 0u64;
    while out.len() < TARGET_SIZE {
        // 每帧：光标回左上角。
        out.extend_from_slice(b"\x1b[H");
        for row in 0..ROWS {
            // 定位到行首 + 整行擦除（htop 风格逐行重绘）。
            out.extend_from_slice(format!("\x1b[{};1H\x1b[2K", row + 1).as_bytes());
            let mut line = String::with_capacity(200);
            if row == 0 {
                // 顶栏：反色标题栏。
                line.push_str("\x1b[7m htop - node01 ");
                line.push_str(&" ".repeat(COLS.saturating_sub(20)));
                line.push_str("\x1b[27m");
            } else if row < 5 {
                // CPU 进度条：密集底色 SGR 切换。
                line.push_str(&format!("  {} [", row));
                let mut used = 0usize;
                for _ in 0..30 {
                    let seg = 1 + rng.below(3);
                    used += seg;
                    let sgr = match rng.below(3) {
                        0 => "\x1b[42m",
                        1 => "\x1b[44m",
                        _ => "\x1b[43m",
                    };
                    line.push_str(sgr);
                    line.push_str(&" ".repeat(seg));
                }
                line.push_str(&format!("\x1b[0m] {:>5.1}%", rng.below(10000) as f64 / 100.0));
            } else {
                // 进程列表行：列上色。
                line.push_str(&format!(
                    "\x1b[36m{:>7}\x1b[0m \x1b[33m{:>5.1}\x1b[0m \x1b[32m{:>5.1}\x1b[0m {}",
                    rng.below(30000),
                    rng.below(1000) as f64 / 10.0,
                    rng.below(1000) as f64 / 10.0,
                    FILES[rng.below(FILES.len())],
                ));
            }
            out.extend_from_slice(line.as_bytes());
        }
        // 偶发 CUU/CUD 光标移动（模拟局部修补）。
        if frame % 3 == 0 {
            out.extend_from_slice(b"\x1b[3A\x1b[10C\x1b[31mWARN\x1b[0m\x1b[3B");
        }
        frame += 1;
    }
    out.extend_from_slice(b"\x1b[?25h\x1b[?1049l");
    out
}

/// cjk：中日韩宽字符混合文本（测宽字符/UTF-8 解码路径），掺少量 SGR 颜色。
pub fn cjk() -> Vec<u8> {
    let mut rng = Rng::new(0xCC1A);
    // 各文种采样池。
    let han: Vec<char> = (0x4E00u32..0x5100).filter_map(char::from_u32).collect();
    let kana: Vec<char> = (0x3041u32..0x30FF).filter_map(char::from_u32).collect();
    let hangul: Vec<char> = (0xAC00u32..0xAD00).filter_map(char::from_u32).collect();
    let fullwidth_punct: &[char] = &['。', '，', '、', '！', '？', '「', '」', '（', '）'];
    let mut out = Vec::with_capacity(TARGET_SIZE + 4096);
    while out.len() < TARGET_SIZE {
        let mut line = String::with_capacity(128);
        let cells = 34 + rng.below(8);
        for i in 0..cells {
            match rng.below(20) {
                0..=9 => line.push(han[rng.below(han.len())]),
                10..=13 => line.push(kana[rng.below(kana.len())]),
                14..=16 => line.push(hangul[rng.below(hangul.len())]),
                17 => {
                    if i > 0 {
                        line.push(' ');
                    }
                    line.push_str(WORDS[rng.below(WORDS.len())]);
                }
                18 => line.push(fullwidth_punct[rng.below(fullwidth_punct.len())]),
                _ => {
                    // 少量内联颜色标记（聊天/日志高亮风格）。
                    line.push_str(&format!(
                        "\x1b[3{}m{}\x1b[0m",
                        1 + rng.below(7),
                        han[rng.below(han.len())]
                    ));
                }
            }
        }
        push_line(&mut out, &line);
    }
    out
}

/// 全部语料：(名称, 生成函数)。
pub const CORPORA: &[(&str, fn() -> Vec<u8>)] = &[
    ("plain", plain),
    ("color", color),
    ("fullscreen", fullscreen),
    ("cjk", cjk),
];
