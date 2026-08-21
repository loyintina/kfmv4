//! dump.rs — 两引擎网格 → 同一文本协议（两线同源行为考卷的 diff 面）。
//!
//! 协议：三段。
//!   1. 可见区文本：逐行拼接，跳过宽字符占位格（alacritty 的
//!      WIDE_CHAR_SPACER / LEADING_WIDE_CHAR_SPACER；rio 的 is_spacer），
//!      空白格归一成空格（alacritty 空白 c=' '，rio 空白 c='\0'），行尾去
//!      右侧空白。
//!   2. `--cursor row,col`：光标网格坐标（row 相对可见区顶，可为负）。
//!   3. `--styles`：每个「样式非默认」的格子一行
//!      `r{row}c{col}:{fg}|{bg}|{attrs}`，颜色/属性归一到双方共通的
//!      词汇表（named 用 Debug 名；idx{N}；rgb 六位的 hex；属性字母串
//!      b/i/u/s/v/d/h = bold/italic/underline/strikeout/inverse/dim/hidden，
//!      underline 各变体 v1 一律归 ul）。
//!
//! v1 已知留白（后续版本补）：zerowidth 组合字符不进 dump；下划线细分
//! 种类不归一；OSC 标题/剪贴板等事件面两家 VoidListener 都丢，考卷只
//! 断言「不毁网格」。

/// alacritty 侧颜色 → 共通 token。
pub fn color_token_ala(c: &alacritty_terminal::vte::ansi::Color) -> String {
    use alacritty_terminal::vte::ansi::Color;
    match c {
        Color::Named(n) => format!("{n:?}"),
        Color::Indexed(i) => format!("idx{i}"),
        Color::Spec(rgb) => format!("rgb{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b),
    }
}

/// rio-vt 侧颜色 → 共通 token（与 alacritty 侧同协议）。
/// 注意：rio 的亮色枚举名叫 Light*，alacritty 叫 Bright*——同一槽位
/// 不同名（考卷 v1 首跑唯一 DIFF 就是这个命名差），归一到 Bright*。
pub fn color_token_rio(c: &rio_vt::config::colors::AnsiColor) -> String {
    use rio_vt::config::colors::AnsiColor;
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
}

/// alacritty 属性 flags → 共通字母串。
pub fn attr_token_ala(f: alacritty_terminal::term::cell::Flags) -> String {
    use alacritty_terminal::term::cell::Flags as F;
    let mut s = String::new();
    if f.contains(F::BOLD) { s.push('b'); }
    if f.contains(F::ITALIC) { s.push('i'); }
    if f.intersects(F::UNDERLINE | F::UNDERCURL | F::DOTTED_UNDERLINE | F::DASHED_UNDERLINE | F::DOUBLE_UNDERLINE) { s.push('u'); }
    if f.contains(F::STRIKEOUT) { s.push('s'); }
    if f.contains(F::INVERSE) { s.push('v'); }
    if f.contains(F::DIM) { s.push('d'); }
    if f.contains(F::HIDDEN) { s.push('h'); }
    s
}

/// rio-vt 属性 flags → 共通字母串（与 alacritty 侧同协议）。
pub fn attr_token_rio(f: rio_vt::crosswords::style::StyleFlags) -> String {
    use rio_vt::crosswords::style::StyleFlags as F;
    let mut s = String::new();
    if f.contains(F::BOLD) { s.push('b'); }
    if f.contains(F::ITALIC) { s.push('i'); }
    if f.intersects(F::ALL_UNDERLINES) { s.push('u'); }
    if f.contains(F::STRIKEOUT) { s.push('s'); }
    if f.contains(F::INVERSE) { s.push('v'); }
    if f.contains(F::DIM) { s.push('d'); }
    if f.contains(F::HIDDEN) { s.push('h'); }
    s
}
