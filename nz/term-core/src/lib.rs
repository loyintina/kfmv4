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
use rio_vt::crosswords::Crosswords;
use rio_vt::crosswords::grid::Dimensions;
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

    /// 渲染帧（渲染壳取数协议 v1）：可见区逐行，行间 '\n' 分隔；
    /// 每行 = `{text}\x1f{runs}`。text 是该行全部格子（占位格跳过、
    /// 空白 '\0'→空格，不裁尾——渲染要满宽）；runs 是同样式连续段的
    /// 起点表：`start,fg,bg,attrs;` 重复，start 是 text 的字符下标
    /// （非网格列——占位格已抽走），**样式回到默认也出边界**
    /// （空 token `N,,,;`——渲染壳靠它知道默认段的起点）。
    /// 颜色/属性 token 与考卷 dump 同协议（Foreground/Background/
    /// Bright 前缀/idx{N}/rgb 六位 hex；b/i/u/s/v/d/h），两线永不鸡同鸭讲。
    pub fn render_frame(&self) -> String {
        let grid = &self.term.grid;
        let mut out = String::new();
        let mut cur_row: Option<i32> = None;
        let mut cur_runs = String::new();
        let mut last_style = String::new();
        for indexed in grid.display_iter() {
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
}
