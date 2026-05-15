#!/usr/bin/env python3
"""V2: stronger glow (3-stop gradient, 2-layer shadow), symbols use tri color via currentColor."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    src = f.read()

# 1. Replace createDecoratedCorner innerHTML
old_fn_body = """  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.6)' : color;
  const shadowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.3)' : color;
  // 光球背景: radial-gradient + 柔光阴影
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%,' + glowC + ',transparent 70%);box-shadow:0 0 8px 3px ' + shadowC + '"></div>' +
    svgInner;"""

new_fn_body = """  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.35)' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.4)' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.15)' : color;
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.9)' : color;
  // 光球背景 + 符号（使用 tri 色系）
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 30%,' + glowC + ',' + glowM + ',transparent 70%);box-shadow:0 0 10px 4px ' + shadowC1 + ',0 0 20px 8px ' + shadowC2 + '"></div>' +
    '<div style="display:flex;align-items:center;justify-content:center;color:' + symC + '">' + svgInner + '</div>';"""

if old_fn_body not in src:
    print("ERROR: old_fn_body not found!")
    exit(1)
src = src.replace(old_fn_body, new_fn_body)

# 2. Replace SVG colors from rgba(255,255,255,0.75) to currentColor
src = src.replace(
    'stroke="rgba(255,255,255,0.75)"',
    'stroke="currentColor"')
src = src.replace(
    'fill="rgba(255,255,255,0.75)"',
    'fill="currentColor"')

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(src)
print('OK')
