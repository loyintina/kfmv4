//! 两个 crate 的「喂字节进解析器」harness。
//!
//! 方法学：只测解析层（字节流 → 解析状态机 → 网格状态更新），不触碰任何
//! 渲染路径。两个 harness 选择的都是「公开解析入口 + 真实网格 Term」的最小
//! 路径——解析结果落到真实 grid 上（含宽字符处理、滚动、SGR 状态），但不做
//! damage 收集之外的任何绘制准备（两边 damage 都只是网格副作用标记，非渲染）。

pub mod alacritty {
    use alacritty_terminal::event::VoidListener;
    use alacritty_terminal::term::{Config, Term, test::TermSize};
    use alacritty_terminal::vte::ansi::Processor;

    /// 解析路径选择说明：
    /// `vte::ansi::Processor::advance(&mut Term, bytes)`。
    /// 这是 alacritty 主程序 PTY 读循环里实际使用的入口（event.rs 中
    /// `processor.advance(&mut *terminal, &buf[..])` 的同款）：字节进 vte
    /// 状态机，performer 回调直接驱动 `Term`（grid 写入/滚动/模式切换）。
    /// 它覆盖「解析 + 网格状态更新」，不含 RenderableContent 迭代与任何
    /// 绘制——属于解析层。grid 的 damage 标记是写单元格的固有副作用，
    /// 两个 harness 都有同等性质的开销，对比公平。
    pub struct Harness {
        term: Term<VoidListener>,
        processor: Processor,
    }

    impl Harness {
        pub fn new(columns: usize, screen_lines: usize, scrollback: usize) -> Self {
            let config = Config {
                scrolling_history: scrollback,
                ..Config::default()
            };
            let size = TermSize::new(columns, screen_lines);
            Self {
                term: Term::new(config, &size, VoidListener),
                processor: Processor::new(),
            }
        }

        #[inline]
        pub fn feed(&mut self, bytes: &[u8]) {
            // vte 0.13 的 advance 是逐字节入口；alacritty event_loop.rs
            // 的 PTY 读循环同样按字节喂（`advance(&mut **terminal, *byte)`）。
            for &byte in bytes {
                self.processor.advance(&mut self.term, byte);
            }
        }

        /// 防优化锚点：读一点网格状态，证明解析确实落了盘。
        pub fn checksum(&self) -> usize {
            let point = self.term.grid().cursor.point;
            point.column.0 + point.line.0 as usize
        }

        /// 考卷 dump：网格文本 + 光标 + 非默认样式格（协议见 dump.rs）。
        pub fn dump(&self) -> String {
            use alacritty_terminal::term::cell::Flags;
            let grid = self.term.grid();
            let mut out = String::new();
            let mut cur_row: Option<i32> = None;
            let mut styles: Vec<String> = Vec::new();
            for indexed in grid.display_iter() {
                let cell = indexed.cell;
                if cell
                    .flags
                    .intersects(Flags::WIDE_CHAR_SPACER | Flags::LEADING_WIDE_CHAR_SPACER)
                {
                    continue;
                }
                let row = indexed.point.line.0;
                if cur_row != Some(row) {
                    if cur_row.is_some() {
                        let t = out.trim_end().len();
                        out.truncate(t);
                        out.push('\n');
                    }
                    cur_row = Some(row);
                }
                out.push(cell.c);
                let fg = crate::dump::color_token_ala(&cell.fg);
                let bg = crate::dump::color_token_ala(&cell.bg);
                let at = crate::dump::attr_token_ala(cell.flags);
                if fg != "Foreground" || bg != "Background" || !at.is_empty() {
                    styles.push(format!("r{row}c{}:{fg}|{bg}|{at}", indexed.point.column.0));
                }
            }
            let t = out.trim_end().len();
            out.truncate(t);
            let p = grid.cursor.point;
            format!("{out}\n--cursor {},{}\n--styles\n{}", p.line.0, p.column.0, styles.join("\n"))
        }
    }
}

pub mod rio {
    use rio_vt::ansi::CursorShape;
    use rio_vt::crosswords::Crosswords;
    use rio_vt::crosswords::grid::Dimensions;
    use rio_vt::event::{VoidListener, WindowId};
    use rio_vt::performer::handler::Processor;

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

    /// 解析路径选择说明：
    /// `performer::handler::Processor::advance(&mut Crosswords, bytes)`。
    /// 这是 rio-backend PTY 事件循环实际使用的入口：`Processor` 内含
    /// rio 自己的 VT 解析器（`performer::parser`），`Crosswords`（rio 的
    /// Term 等价物）实现 `Handler`，解析回调直接驱动网格。
    /// 与 alacritty harness 语义对齐：解析 + 网格状态更新，无渲染。
    pub struct Harness {
        term: Crosswords<VoidListener>,
        processor: Processor,
    }

    impl Harness {
        pub fn new(columns: usize, screen_lines: usize, scrollback: usize) -> Self {
            let size = Size {
                columns,
                screen_lines,
                scrollback,
            };
            let term = Crosswords::new(
                size,
                CursorShape::Block,
                VoidListener,
                WindowId::from(0),
                0,
                scrollback,
            );
            Self {
                term,
                processor: Processor::default(),
            }
        }

        #[inline]
        pub fn feed(&mut self, bytes: &[u8]) {
            self.processor.advance(&mut self.term, bytes);
        }

        /// 防优化锚点。
        pub fn checksum(&self) -> usize {
            let pos = self.term.grid.cursor.pos;
            pos.col.0 + pos.row.0.max(0) as usize
        }

        /// 考卷 dump：网格文本 + 光标 + 非默认样式格（协议见 dump.rs）。
        /// 注意 rio 的两个网格事实：空白格 c='\0'（归一成空格）；宽字符
        /// 占位格 is_spacer（跳过，字形归前导格）。
        pub fn dump(&self) -> String {
            let grid = &self.term.grid;
            let mut out = String::new();
            let mut cur_row: Option<i32> = None;
            let mut styles: Vec<String> = Vec::new();
            for indexed in grid.display_iter() {
                let sq = indexed.square;
                if sq.is_spacer() {
                    continue;
                }
                let row = indexed.pos.row.0;
                if cur_row != Some(row) {
                    if cur_row.is_some() {
                        let t = out.trim_end().len();
                        out.truncate(t);
                        out.push('\n');
                    }
                    cur_row = Some(row);
                }
                let c = sq.c();
                out.push(if c == '\0' { ' ' } else { c });
                let st = grid.style_of(&sq);
                let fg = crate::dump::color_token_rio(&st.fg);
                let bg = crate::dump::color_token_rio(&st.bg);
                let at = crate::dump::attr_token_rio(st.flags);
                if fg != "Foreground" || bg != "Background" || !at.is_empty() {
                    styles.push(format!("r{row}c{}:{fg}|{bg}|{at}", indexed.pos.col.0));
                }
            }
            let t = out.trim_end().len();
            out.truncate(t);
            let p = grid.cursor.pos;
            format!("{out}\n--cursor {},{}\n--styles\n{}", p.row.0, p.col.0, styles.join("\n"))
        }
    }
}
