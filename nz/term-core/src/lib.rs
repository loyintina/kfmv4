//! nz 8.8.2 终端解析核 WASM 包装（rio-vt → JS）。
//!
//! 职责边界：只做「字节流 → 解析 → 网格状态」，不做任何渲染（渲染壳是
//! TS 侧的事——任务图 8.8.2：解析核 Rust/WASM，渲染壳 TS 自研）。
//! 解析入口与 term-core-eval 评估靶场的 rio harness 完全同款：
//! `performer::handler::Processor::advance(&mut Crosswords, bytes)`，
//! 保证「评估数字」与「线上行为」走的是同一条代码路径。
//!
//! 暴露面（№1 契约 TermRenderer 形状的最小子集，探针阶段）：
//! - `new(cols, rows, scrollback)` / `feed(bytes)` / `resize(cols, rows)`
//! - `text()`：可见区文本 dump（验证与两线行为考卷用）
//! - `cursor()`：光标位置 packed `row << 16 | col`
//! - `cursor_visible()`（?25h/?25l）/ `app_cursor()`（DECCKM ?1h/?1l，
//!   8.8.3b 按键栏方向键 SS3/CSI 映射的模式位）
//! serialize/restore（会话快照）留待渲染壳接入时补——探针不背。

use rio_vt::ansi::CursorShape;
use rio_vt::crosswords::grid::{Dimensions, Grid, Indexed};
use rio_vt::crosswords::pos::{Line, Pos};
use rio_vt::crosswords::square::Square;
use rio_vt::crosswords::Crosswords;
use rio_vt::event::{VoidListener, WindowId};
use rio_vt::performer::handler::Processor;
use wasm_bindgen::prelude::*;

struct Size {
    columns: usize,
    screen_lines: usize,
    scrollback: usize,
}

impl Dimensions for Size {
    fn total_lines(&self) -> usize {
        self.screen_lines + self.scrollback
    }
    fn screen_lines(&self) -> usize {
        self.screen_lines
    }
    fn columns(&self) -> usize {
        self.columns
    }
}

#[wasm_bindgen]
pub struct TermCore {
    term: Crosswords<VoidListener>,
    processor: Processor,
    scrollback: usize,
}

#[wasm_bindgen]
impl TermCore {
    #[wasm_bindgen(constructor)]
    pub fn new(columns: usize, screen_lines: usize, scrollback: usize) -> TermCore {
        let size = Size {
            columns,
            screen_lines,
            scrollback,
        };
        TermCore {
            term: Crosswords::new(
                size,
                CursorShape::Block,
                VoidListener,
                WindowId::from(0),
                0,
                scrollback,
            ),
            processor: Processor::default(),
            scrollback,
        }
    }

    /// 喂原始字节流（PTY 输出切片）。slice 批量入口，非逐字节。
    pub fn feed(&mut self, bytes: &[u8]) {
        self.processor.advance(&mut self.term, bytes);
    }

    pub fn resize(&mut self, columns: usize, screen_lines: usize) {
        self.term.resize(Size {
            columns,
            screen_lines,
            scrollback: self.scrollback,
        });
    }

    /// 可见区文本 dump：逐行拼接，跳过宽字符占位格，行尾去右侧空白。
    /// 空白格在 rio-vt 网格里 c = '\0'（非空格），dump 时归一成空格。
    /// 用途：①探针验证「解析真落了网格」；②两线同源行为考卷的 diff 面
    /// （同语料喂 rio-vt 与 alacritty harness，dump 比对）。
    pub fn text(&self) -> String {
        let mut out = String::new();
        let mut cur_row: Option<i32> = None;
        for indexed in self.term.grid.display_iter() {
            let sq = indexed.square;
            if sq.is_spacer() {
                continue; // 宽字符占位格：字形归前导格，dump 不重复出字
            }
            let row = indexed.pos.row.0;
            if cur_row != Some(row) {
                if cur_row.is_some() {
                    let trimmed = out.trim_end().len();
                    out.truncate(trimmed);
                    out.push('\n');
                }
                cur_row = Some(row);
            }
            let c = sq.c();
            out.push(if c == '\0' { ' ' } else { c });
        }
        let trimmed = out.trim_end().len();
        out.truncate(trimmed);
        out
    }

    /// 光标位置 packed：高 16 位 row（相对可见区，可为负——历史区），低 16 位 col。
    pub fn cursor(&self) -> u32 {
        let pos = self.term.grid.cursor.pos;
        ((pos.row.0 as u32) << 16) | (pos.col.0 as u32 & 0xffff)
    }

    /// 光标可见性（DECTCEM ?25h/?25l，rio-vt 内部 Mode::SHOW_CURSOR 本来
    /// 就在记账，此前没暴露）。TUI 程序（tmux 里的 agent TUI 等）会 ?25l
    /// 藏掉终端光标、自绘反色块当光标——渲染壳若不跟随，壳光标变鬼影，
    /// 与反色块并排 = 双光标（真机黑匣子 cb 实锤：shell+inverse 相距 1 格）。
    pub fn cursor_visible(&self) -> bool {
        self.term.mode().contains(rio_vt::crosswords::Mode::SHOW_CURSOR)
    }

    /// 应用光标模式（DECCKM ?1h/?1l，rio-vt Mode::APP_CURSOR 本来就在记账，
    /// 此前没暴露）。按键映射的命根：对端开 ?1h 时方向键/Home/End 要发
    /// SS3（ESC O A）不是 CSI（ESC [ A）——发错序列，tmux/vim 里方向键
    /// 全哑（8.8.3b 按键栏 keymap 按本位实时翻序列，NA keymap.rs 同款）。
    pub fn app_cursor(&self) -> bool {
        self.term.mode().contains(rio_vt::crosswords::Mode::APP_CURSOR)
    }

    /// 备用屏幕（ALT_SCREEN，vim/tmux/htop 等 TUI 整屏程序）。两区模型
    /// （固定输入行）只对行模式成立：TUI 光标满屏跑，剥光标行=毁布局。
    /// 渲染壳读本位切整屏渲染（输入行隐藏、历史块隐藏、全屏行进滚动区）。
    pub fn alt_screen(&self) -> bool {
        self.term.mode().contains(rio_vt::crosswords::Mode::ALT_SCREEN)
    }

    /// 渲染帧（渲染壳取数协议 v1）：可见区逐行，行间 '\n' 分隔；
    /// 每行 = `{text}\x1f{runs}`。text 是该行全部格子（占位格跳过、
    /// 空白 '\0'→空格，不裁尾——渲染要满宽）；runs 是同样式连续段的
    /// 起点表：`start,fg,bg,attrs;` 重复，start 是 text 的字符下标
    /// （非网格列——占位格已抽走），**样式回到默认也出边界**
    /// （空 token `N,,,;`——渲染壳靠它知道默认段的起点）。
    /// 颜色/属性 token 与考卷 dump 同协议（Foreground/Background/
    /// Bright 前缀/idx{N}/rgb 六位 hex；b/i/u/s/v/d/h），两线永不鸡同鸭讲。
    pub fn render_frame(&self) -> String {
        self.dump_frame(self.term.grid.display_iter())
    }

    /// 历史区行数（scrollback 已攒行数，8.8.3c）。
    pub fn history_len(&self) -> usize {
        self.term.grid.history_size()
    }

    /// 已被挤出缓冲区的总行数（单调递增）：历史行的绝对游标 = evicted +
    /// 相对下标。渲染壳靠它检测截断（超 1000 行丢最旧）与错位重建。
    /// u64 过 wasm 走 f64（JS number，2^53 内精确）。
    pub fn lines_evicted(&self) -> f64 {
        self.term.grid.lines_evicted() as f64
    }

    /// 历史区渲染帧（协议同 render_frame）：dump 相对区间 [from, to)
    /// （0=现存最旧一行）。渲染壳增量维护历史 DOM——正常追加只取新滚出
    /// 的尾巴（from=已渲染行数），截断/resize 重排时整段 [0, len) 重取。
    pub fn history_frame(&self, from: usize, to: usize) -> String {
        let h = self.term.grid.history_size();
        let from = from.min(h);
        let to = to.min(h).max(from);
        if from >= to {
            return String::new();
        }
        let base = -(h as i32);
        // GridIterator 先走一格再出账（display_iter 从视口上一格起跳同款）：
        // 要拿 (base+from, 0)，游标得摆在该行上一格。
        let start = Pos::new(Line(base + from as i32 - 1), self.term.grid.last_column());
        let end_row = base + to as i32;
        let iter = self.term.grid.iter_from(start);
        self.dump_frame(iter.take_while(move |indexed| indexed.pos.row.0 < end_row))
    }
}

impl TermCore {
    /// 帧序列化（render_frame/history_frame 共用）：把迭代器走过的格子
    /// 按「行间 \n、行内 {text}\x1f{runs}」协议拼帧。
    fn dump_frame<'a, I>(&'a self, iter: I) -> String
    where
        I: Iterator<Item = Indexed<&'a Square>>,
    {
        let grid: &Grid<Square> = &self.term.grid;
        let mut out = String::new();
        let mut cur_row: Option<i32> = None;
        let mut cur_runs = String::new();
        let mut last_style = String::new();
        for indexed in iter {
            let sq = indexed.square;
            if sq.is_spacer() {
                continue; // 宽字符占位格：字形归前导格，不下标
            }
            let row = indexed.pos.row.0;
            if cur_row != Some(row) {
                if cur_row.is_some() {
                    out.push('\x1f');
                    out.push_str(&cur_runs);
                    out.push('\n');
                }
                cur_row = Some(row);
                cur_runs.clear();
                last_style.clear();
            }
            // text 下标 = 当前行已收字符数（先算后 push）
            let st = grid.style_of(&sq);
            let style = style_token(&st);
            // 行起始列：该行 text 长度 = out 尾段长度。用行内计数更稳：
            // 重新起行后 out 里最后一个 '\n' 之后即本行 text。
            let line_start = out.rfind('\n').map(|i| i + 1).unwrap_or(0);
            let idx = out.len() - line_start; // 字节下标≈字符下标（ASCII 区成立；
            // 非 ASCII 字符字节数>1——runs 下标以字节计，TS 侧用 TextEncoder
            // 对齐 slicing。BMP 字符在 JS 是 1 个 UTF-16 单元但 3 字节 UTF-8，
            // 故协议定为**字节下标**，TS 侧按字节切。
            if style != *last_style {
                // 样式边界（含「回到默认」——空 token `N,,,;` 也是合法 run，
                // 渲染壳靠它知道默认段从哪开始；四个字段一个不能少，
                // JS split(',') 少字段会拿到 undefined 串进样式）
                if style.is_empty() {
                    cur_runs.push_str(&format!("{idx},,,;"));
                } else {
                    cur_runs.push_str(&format!("{idx},{style};"));
                }
                last_style = style.to_string();
            }
            let c = sq.c();
            out.push(if c == '\0' { ' ' } else { c });
        }
        if cur_row.is_some() {
            out.push('\x1f');
            out.push_str(&cur_runs);
        }
        out
    }
}

/// 样式 token：`fg,bg,attrs`（attrs 字母串 b/i/u/s/v/d/h，可空）。
/// 供 render_frame 的 runs 用；与考卷 dump.rs 的词汇表同源。
fn style_token(st: &rio_vt::crosswords::style::Style) -> String {
    use rio_vt::config::colors::AnsiColor;
    let color = |c: &AnsiColor| -> String {
        match c {
            AnsiColor::Named(n) => {
                let name = format!("{n:?}");
                match name.strip_prefix("Light") {
                    Some(rest) => format!("Bright{rest}"),
                    None => name,
                }
            }
            AnsiColor::Indexed(i) => format!("idx{i}"),
            AnsiColor::Spec(rgb) => format!("rgb{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b),
        }
    };
    let fg = color(&st.fg);
    let bg = color(&st.bg);
    let mut attrs = String::new();
    let f = st.flags;
    use rio_vt::crosswords::style::StyleFlags as F;
    if f.contains(F::BOLD) { attrs.push('b'); }
    if f.contains(F::ITALIC) { attrs.push('i'); }
    if f.intersects(F::ALL_UNDERLINES) { attrs.push('u'); }
    if f.contains(F::STRIKEOUT) { attrs.push('s'); }
    if f.contains(F::INVERSE) { attrs.push('v'); }
    if f.contains(F::DIM) { attrs.push('d'); }
    if f.contains(F::HIDDEN) { attrs.push('h'); }
    if fg == "Foreground" && bg == "Background" && attrs.is_empty() {
        String::new() // 默认样式：不出 run
    } else {
        format!("{fg},{bg},{attrs}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feed_plain_lands_on_grid() {
        let mut t = TermCore::new(80, 24, 1000);
        t.feed(b"hello nz\r\n$ ");
        let text = t.text();
        assert!(text.contains("hello nz"), "text={text:?}");
        assert_eq!(t.cursor() & 0xffff, 2, "光标应在 `$ ` 之后");
    }

    #[test]
    fn feed_sgr_and_cjk() {
        let mut t = TermCore::new(80, 24, 1000);
        t.feed("\x1b[31m红\x1b[0m蓝".as_bytes());
        let text = t.text();
        assert!(text.contains("红蓝"), "text={text:?}");
        // 宽字符占两格：光标在 1 + 2*1 + ... 红(2) 蓝(2) = col 4
        assert_eq!(t.cursor() & 0xffff, 4);
    }

    #[test]
    fn resize_keeps_content() {
        let mut t = TermCore::new(80, 24, 1000);
        t.feed(b"before resize");
        t.resize(40, 10);
        assert!(t.text().contains("before resize"));
    }

    #[test]
    fn app_cursor_tracks_decckm() {
        let mut t = TermCore::new(80, 24, 1000);
        assert!(!t.app_cursor(), "默认普通光标模式");
        t.feed(b"\x1b[?1h");
        assert!(t.app_cursor(), "?1h 后应为应用光标模式（SS3）");
        t.feed(b"\x1b[?1l");
        assert!(!t.app_cursor(), "?1l 后应回普通模式（CSI）");
    }

    #[test]
    fn render_frame_runs() {
        let mut t = TermCore::new(80, 24, 1000);
        t.feed(b"ab\x1b[31mcd\x1b[0mef");
        let frame = t.render_frame();
        let line0 = frame.split('\n').next().unwrap();
        let (text, runs) = line0.split_once('\x1f').expect("行要有 text/runs 分隔符");
        assert!(text.starts_with("abcdef"), "text={text:?}");
        // 样式段从第 2 格（字节下标）开始：Red fg + 默认 bg + 无属性；
        // 第 4 格回默认——空 token 边界必须出全字段 `4,,,;`
        assert!(runs.starts_with("2,Red,Background,;4,,,;"), "runs={runs:?}");
        // 24 行满帧（默认挂载无滚动偏移时可见区=screen_lines）
        assert_eq!(frame.matches('\n').count(), 23, "frame={frame:?}");
    }

    #[test]
    fn alt_screen_tracks_mode() {
        let mut t = TermCore::new(80, 24, 1000);
        assert!(!t.alt_screen(), "默认主屏幕");
        t.feed(b"\x1b[?1049h");
        assert!(t.alt_screen(), "?1049h 后应进备用屏幕");
        t.feed(b"\x1b[?1049l");
        assert!(!t.alt_screen(), "?1049l 后应回主屏幕");
    }

    #[test]
    fn history_frame_appends_and_truncates() {
        // 8.8.3c 钉：超屏行滚入历史区；超 scrollback 上限丢最旧行（截断）。
        let mut t = TermCore::new(80, 5, 10);
        assert_eq!(t.history_len(), 0);
        // 灌 8 行：屏幕 5 行，3 行滚入历史
        for i in 1..=8 {
            t.feed(format!("line{i}\r\n").as_bytes());
        }
        let h = t.history_len();
        assert!(h >= 3, "8 行进 5 行屏，历史区应≥3 行，实={h}");
        let frame = t.history_frame(0, h);
        assert!(frame.contains("line1"), "最旧历史行应在帧里，frame={frame:?}");
        // 区间切片：跳过最旧 1 行后 line1 不在、line2 在
        let tail = t.history_frame(1, h);
        assert!(!tail.contains("line1") && tail.contains("line2"), "tail={tail:?}");
        // 截断：再灌 20 行，历史区超 10 行上限，最旧行被挤出
        for i in 9..=28 {
            t.feed(format!("line{i}\r\n").as_bytes());
        }
        assert_eq!(t.history_len(), 10, "历史区封顶 scrollback=10");
        assert!(t.lines_evicted() > 0.0, "截断后 evicted 应>0");
        let frame = t.history_frame(0, 10);
        assert!(!frame.contains("line1\x1f"), "最旧行应已被截掉，frame={frame:?}");
        assert!(frame.contains("line19"), "次旧行应还在，frame={frame:?}");
    }
}
