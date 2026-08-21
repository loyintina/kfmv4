//! exam.rs — 两线同源解析行为考卷 v1（nz 8.8.2 收口硬门）。
//!
//! 题面来源：①REPORT「未评估」清单（synchronized output / kitty keyboard /
//! OSC 52 等）；②NA 实际消费清单（2026-08-21 源码核查：网格数据全拿、
//! 模式位只读 1000/1002/1003+?1h、事件面 VoidListener 全丢、样式渲染只
//! 做颜色+反色）；③xterm 常规能力面（游标/擦除/滚动区/备选屏/宽字符）。
//!
//! 方法：同一题面字节串分别喂 alacritty_terminal 与 rio-vt 的 harness
//! （80×24 + 1000 滚动回退），dump 同一文本协议（dump.rs），全等比对。
//! DIFF 题把两侧 dump 落盘 exam-out/ 供人工研判。
//!
//! 判读纪律：DIFF ≠ rio-vt 错——也可能是 alacritty 的怪癖。每道 DIFF
//! 要人工研判「谁是 xterm 标准行为」，再记进差异清单。
//!
//! 运行：cargo run --release --bin exam；退出码 = DIFF 题数（0 = 全过）。

use term_core_eval::harness::{alacritty, rio};

/// 题面：(题号, 字节串)。每题独立新终端，互不污染。
const VECTORS: &[(&str, &[u8])] = &[
    // ---- 基础文本 ----
    ("plain_crlf", b"hello\r\nworld"),
    ("lf_no_cr", b"a\nb"), // LNM 默认关：\n 只下移不回车
    // ---- SGR 颜色（NA 渲染的面）----
    ("sgr_fg8", b"\x1b[31mR\x1b[32mG\x1b[39m-"),
    ("sgr_bg8", b"\x1b[41mB\x1b[49m-"),
    ("sgr_bright", b"\x1b[91mHi\x1b[101mBG\x1b[0m"),
    ("sgr_256", b"\x1b[38;5;196mX\x1b[48;5;17mY\x1b[0m"),
    ("sgr_truecolor", b"\x1b[38;2;10;20;30mT\x1b[48;2;200;100;50mU\x1b[0m"),
    ("sgr_reset_mid", b"\x1b[31;1mAB\x1b[mC"),
    // ---- SGR 属性（NA 只渲染 inverse，其余不渲染但网格要带对 flag）----
    ("sgr_attrs", b"\x1b[1;3;4;9mA\x1b[0m\x1b[7mV\x1b[27m\x1b[2mD\x1b[22m\x1b[8mH\x1b[28m"),
    ("sgr_inverse_only", b"\x1b[7mINV\x1b[0m"),
    // ---- 游标 ----
    ("cursor_cup", b"\x1b[5;10H@"),
    ("cursor_hvp", b"\x1b[3;4f#"),
    ("cursor_moves", b"ab\x1b[2D+\x1b[3C-"),
    ("cursor_cnl_cpl", b"line1\x1b[2E*\x1b[1F#"),
    ("cursor_cha", b"abcdef\x1b[3G$"),
    ("dec_save_restore", b"pos1\x1b7\x1b[10;10Hmark\x1b8back"),
    // ---- 擦除 ----
    ("erase_el0", b"abcdef\r\x1b[3G\x1b[K"),
    ("erase_el1", b"abcdef\r\x1b[4G\x1b[1K"),
    ("erase_el2", b"abcdef\x1b[2K"),
    ("erase_ed2_home", b"r1\r\nr2\r\nr3\x1b[2J\x1b[H"),
    ("erase_ed0", b"aaa\r\nbbb\r\nccc\x1b[2;2H\x1b[J"),
    ("erase_ed1", b"aaa\r\nbbb\r\nccc\x1b[2;2H\x1b[1J"),
    // ---- 插入/删除 ----
    ("dch", b"abcdef\r\x1b[2G\x1b[2P"),
    ("ich", b"abcdef\r\x1b[2G\x1b[2@"),
    ("il_dl", b"l1\r\nl2\r\nl3\x1b[2;1H\x1b[1L\x1b[3;1H\x1b[1M"),
    // ---- 滚动 ----
    ("scroll_region", b"top\r\nmid\r\nbot\x1b[2;3r\x1b[3;1H\r\nSCROLL"),
    ("su", b"l1\r\nl2\r\nl3\x1b[1S"),
    ("sd", b"l1\r\nl2\r\nl3\x1b[H\x1b[1T"),
    ("scrollback_overflow", b"01\r\n02\r\n03\r\n04\r\n05\r\n06\r\n07\r\n08\r\n09\r\n10\r\n11\r\n12\r\n13\r\n14\r\n15\r\n16\r\n17\r\n18\r\n19\r\n20\r\n21\r\n22\r\n23\r\n24\r\n25\r\n26\r\n27\r\n28\r\n29\r\n30"),
    // ---- 备选屏（tmux/vim 的命根子）----
    ("alt_screen_1049", b"main\x1b[?1049hALT\x1b[?1049lback"),
    ("alt_screen_47", b"main\x1b[?47hALT\x1b[?47lback"),
    // ---- 换行模式 ----
    ("decawm_off_nowrap", b"\x1b[?7lxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxTAIL"),
    ("decawm_on_wrap", b"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxTAIL"),
    // ---- 宽字符 ----
    ("cjk_wide", "\u{7ea2}\u{7eff}\u{84dd}".as_bytes()), // 红绿蓝
    ("cjk_wrap_edge", "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\u{7ea2}Z".as_bytes()), // 79 列 + 宽字符
    // ---- Tab ----
    ("tabs", b"a\tb\tc"),
    // ---- REPORT 未评估清单（事件面：VoidListener 两侧都丢，只断言不毁网格）----
    ("sync_2026", b"before\x1b[?2026h SYNC \x1b[?2026l after"),
    ("kitty_keyboard", b"\x1b[>1uK\x1b[<u back"),
    ("osc52_clipboard", b"\x1b]52;c;aGk=\x07after"),
    ("osc_title", b"\x1b]2;my title\x07shown"),
    ("osc8_hyperlink", b"\x1b]8;;https://kfm\x07LINK\x1b]8;;\x07 done"),
    // ---- 模式开关（不毁网格即可）----
    ("mouse_modes_toggle", b"\x1b[?1002h\x1b[?1006hS\x1b[?1002l\x1b[?1006l"),
    ("app_cursor_toggle", b"\x1b[?1hA\x1b[?1l"),
    ("dectcem_cursor_hide", b"\x1b[?25lH\x1b[?25hS"),
    // ---- 复位 ----
    ("ris_reset", b"\x1b[31mcolored\x1bcplain"),
];

fn main() {
    let out_dir = std::path::Path::new("exam-out");
    std::fs::create_dir_all(out_dir).expect("建 exam-out/ 失败");

    let mut pass = 0u32;
    let mut diffs: Vec<&str> = Vec::new();
    for (name, bytes) in VECTORS {
        let mut a = alacritty::Harness::new(80, 24, 1000);
        let mut r = rio::Harness::new(80, 24, 1000);
        a.feed(bytes);
        r.feed(bytes);
        let da = a.dump();
        let dr = r.dump();
        if da == dr {
            pass += 1;
            println!("PASS {name}");
        } else {
            diffs.push(name);
            std::fs::write(out_dir.join(format!("{name}.ala.txt")), &da).unwrap();
            std::fs::write(out_dir.join(format!("{name}.rio.txt")), &dr).unwrap();
            // 行内给第一处差异做快速定位
            let first = da
                .lines()
                .zip(dr.lines())
                .enumerate()
                .find(|(_, (x, y))| x != y)
                .map(|(i, (x, y))| format!("行{i}: ala={x:?} rio={y:?}"))
                .unwrap_or_else(|| "行数不同".to_string());
            println!("DIFF {name} —— {first}");
        }
    }
    println!(
        "\n== 考卷 v1：{} 题，PASS {}，DIFF {} ==",
        VECTORS.len(),
        pass,
        diffs.len()
    );
    if !diffs.is_empty() {
        println!("DIFF 清单：{}", diffs.join(", "));
        println!("两侧 dump 已落盘 exam-out/，逐题人工研判谁是标准行为。");
        std::process::exit(diffs.len().min(255) as i32);
    }
}
