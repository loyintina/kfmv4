#!/usr/bin/env python3
"""Refactor: move corner orb hardcoded values into ThemeConfig.cornerOrb.

Steps:
  1. Add cornerOrb interface block to ThemeConfig in theme.ts
  2. Add nebula cornerOrb values to the nebula theme object in theme.ts
  3. In card-stack.ts: add orbT alias, replace all hardcoded values
"""

import sys

THEME_PATH = '/root/kfmv4/src/client/modules/theme.ts'
CARD_STACK_PATH = '/root/kfmv4/src/client/modules/card-stack.ts'

# ============================================================
# 1. theme.ts — interface
# ============================================================
with open(THEME_PATH, 'r') as f:
    theme = f.read()

interface_block = """  /** 浮卡四角光球装饰 */
  cornerOrb: {
    size: number;               // 26 光球直径
    cornerOff: number;          // -13 光球超出卡片边缘的距离（负值=向外突出）
    rightOffAdj: number;        // +1 右侧光球偏移调整量（cornerOff + rightOffAdj）
    bottomOffAdj: number;       // -1 底部光球偏移调整量（cornerOff + bottomOffAdj）
    glowCenterAlpha: number;    // 0.85 光晕中心透明度
    glowMidAlpha: number;       // 0.35 光晕中层透明度
    glowPos: string;            // "30% 30%" 渐变中心位置
    shadow1Blur: string;        // "10px 4px" 主阴影扩散
    shadow1Alpha: number;       // 0.4 主阴影透明度
    shadow2Blur: string;        // "20px 8px" 次阴影扩散
    shadow2Alpha: number;       // 0.15 次阴影透明度
    symAlpha: number;           // 0.9 符号默认透明度
    symStroke: number;          // 1.2 符号线条宽度(SVG stroke-width)
    symScale: number;           // 0.92 3D球面缩放
    symShift: number;           // 1.0 3D球面向外位移(viewBox单位)
    symMaskAngle: string;       // "135deg" 光照渐变角度
    symMaskCutoff: string;      // "#000 30%" 光照截止点
    tlAlpha: number;            // 0.5 左上角透明度覆盖值
  };

  /** 文件扩展名 -> 颜色映射 */
  extColors: Record<string, string>;
}"""

old_interface_end = """  /** 文件扩展名 -> 颜色映射 */
  extColors: Record<string, string>;
}"""

if old_interface_end not in theme:
    print("ERROR: theme.ts interface end not found!")
    sys.exit(1)
theme = theme.replace(old_interface_end, interface_block)

# ============================================================
# 2. theme.ts — nebula values
# ============================================================
nebula_block = """  /** 浮卡四角光球装饰 */
  cornerOrb: {
    size: 26,
    cornerOff: -13,
    rightOffAdj: 1,
    bottomOffAdj: -1,
    glowCenterAlpha: 0.85,
    glowMidAlpha: 0.35,
    glowPos: '30% 30%',
    shadow1Blur: '10px 4px',
    shadow1Alpha: 0.4,
    shadow2Blur: '20px 8px',
    shadow2Alpha: 0.15,
    symAlpha: 0.9,
    symStroke: 1.2,
    symScale: 0.92,
    symShift: 1.0,
    symMaskAngle: '135deg',
    symMaskCutoff: '#000 30%',
    tlAlpha: 0.5,
  },

  extColors: {"""

if "  extColors: {" not in theme:
    print("ERROR: theme.ts nebula extColors not found!")
    sys.exit(1)
theme = theme.replace("  extColors: {", nebula_block)

with open(THEME_PATH, 'w') as f:
    f.write(theme)
print('theme.ts OK')

# ============================================================
# 3. card-stack.ts — add orbT alias
# ============================================================
with open(CARD_STACK_PATH, 'r') as f:
    cs = f.read()

cs = cs.replace(
    "import { currentTheme as theme } from './theme.js';",
    "import { currentTheme as theme } from './theme.js';\nconst orbT = theme.cornerOrb;"
)

# ============================================================
# 4. card-stack.ts — replace createDecoratedCorner body
# ============================================================
old_fn_body = """  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量
  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.35)' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.4)' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.15)' : color;
  const symA = m && m[4] !== undefined ? m[4] : '0.9';
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + symA + ')' : color;
  // 光球背景 + 符号（使用 tri 色系）
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 30%,' + glowC + ',' + glowM + ',transparent 70%);box-shadow:0 0 10px 4px ' + shadowC1 + ',0 0 20px 8px ' + shadowC2 + '"></div>' +
    '<div style="display:flex;align-items:center;justify-content:center;color:' + symC + ';-webkit-mask:linear-gradient(135deg,#000 30%,transparent 100%);mask:linear-gradient(135deg,#000 30%,transparent 100%)">' + svgInner + '</div>';
  return box;"""

new_fn_body = """  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量
  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.glowCenterAlpha + ')' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.glowMidAlpha + ')' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.shadow1Alpha + ')' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.shadow2Alpha + ')' : color;
  const symA = m && m[4] !== undefined ? m[4] : String(orbT.symAlpha);
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + symA + ')' : color;
  // 光球背景 + 符号（使用 tri 色系）
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at ' + orbT.glowPos + ',' + glowC + ',' + glowM + ',transparent 70%);box-shadow:0 0 ' + orbT.shadow1Blur + ' ' + shadowC1 + ',0 0 ' + orbT.shadow2Blur + ' ' + shadowC2 + '"></div>' +
    '<div style="display:flex;align-items:center;justify-content:center;color:' + symC + ';-webkit-mask:linear-gradient(' + orbT.symMaskAngle + ',' + orbT.symMaskCutoff + ',transparent 100%);mask:linear-gradient(' + orbT.symMaskAngle + ',' + orbT.symMaskCutoff + ',transparent 100%)">' + svgInner + '</div>';
  return box;"""

if old_fn_body not in cs:
    print("ERROR: createDecoratedCorner body not found in card-stack.ts!")
    # Debug: show what's around there
    idx = cs.find('const m = color.match')
    if idx >= 0:
        print("Found at", idx, "showing context:")
        print(cs[idx:idx+800])
    sys.exit(1)

cs = cs.replace(old_fn_body, new_fn_body)

# ============================================================
# 5. card-stack.ts — replace launchFocusedCard hardcoded values
# ============================================================

# 5a. Replace variable block
old_vars = """  const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);
  const tlDim = triPrev.replace(/,\\s*1\\)$/, ',0.5)');

  // 四角光球 — 置于顶层（类似主光球在面板之上的逻辑）
  const cornerSize = 26;
  const cornerOff = -13;
  const rightOff = cornerOff + 1;
  const bottomOff = cornerOff - 1;"""

new_vars = """  const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);
  const tlColor = triPrev.replace(/,\\s*1\\)$/, ',' + orbT.tlAlpha + ')');

  // 四角光球 — 置于顶层（类似主光球在面板之上的逻辑）
  const cornerSize = orbT.size;
  const cornerOff = orbT.cornerOff;
  const rightOff = cornerOff + orbT.rightOffAdj;
  const bottomOff = cornerOff + orbT.bottomOffAdj;
  const s = orbT.symScale, c = 6 * (1 - s), sh = orbT.symShift;"""

if old_vars not in cs:
    print("ERROR: launchFocusedCard variable block not found!")
    idx = cs.find('getTriple(_focusIndex')
    if idx >= 0:
        print("Found at", idx, "showing context:")
        print(cs[idx:idx+400])
    sys.exit(1)
cs = cs.replace(old_vars, new_vars)

# 5b. Replace tlDim reference in TL call with tlColor
cs = cs.replace(
    "createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlDim,",
    "createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,"
)

# 5c. Replace the 4 SVG strings — each is unique
# TL SVG
old_tl_svg = "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(-0.52,-0.52) scale(0.92)\"><path d=\"M6,10 L6,2 M6,2 L3,5 M6,2 L9,5\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>'"

new_tl_svg = "`<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c-sh},${c-sh}) scale(${s})\"><path d=\"M6,10 L6,2 M6,2 L3,5 M6,2 L9,5\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>`"

if old_tl_svg not in cs:
    print("ERROR: TL SVG not found!")
    sys.exit(1)
cs = cs.replace(old_tl_svg, new_tl_svg)

# TR SVG
old_tr_svg = "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(1.48,-0.52) scale(0.92)\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\"/></g></svg>'"

new_tr_svg = "`<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c+sh},${c-sh}) scale(${s})\"><line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/><line x1=\"10\" y1=\"2\" x2=\"4\" y2=\"8\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\"/></g></svg>`"

if old_tr_svg not in cs:
    print("ERROR: TR SVG not found!")
    sys.exit(1)
cs = cs.replace(old_tr_svg, new_tr_svg)

# BL SVG
old_bl_svg = "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(-0.52,1.48) scale(0.92)\"><path d=\"M6,2 L6,10 M6,10 L3,7 M6,10 L9,7\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>'"

new_bl_svg = "`<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c-sh},${c+sh}) scale(${s})\"><path d=\"M6,2 L6,10 M6,10 L3,7 M6,10 L9,7\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>`"

if old_bl_svg not in cs:
    print("ERROR: BL SVG not found!")
    sys.exit(1)
cs = cs.replace(old_bl_svg, new_bl_svg)

# BR SVG
old_br_svg = "'<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(1.48,1.48) scale(0.92)\"><path d=\"M6,2 L6,10 M2,6 L10,6\" stroke=\"currentColor\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>'"

new_br_svg = "`<svg width=\"14\" height=\"14\" viewBox=\"0 0 12 12\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(${c+sh},${c+sh}) scale(${s})\"><path d=\"M6,2 L6,10 M2,6 L10,6\" stroke=\"currentColor\" stroke-width=\"${orbT.symStroke}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></g></svg>`"

if old_br_svg not in cs:
    print("ERROR: BR SVG not found!")
    sys.exit(1)
cs = cs.replace(old_br_svg, new_br_svg)

with open(CARD_STACK_PATH, 'w') as f:
    f.write(cs)
print('card-stack.ts OK')
