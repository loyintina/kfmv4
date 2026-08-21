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
}
