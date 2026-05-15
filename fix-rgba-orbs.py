#!/usr/bin/env python3
"""Fix RGBA color handling in createDecoratedCorner."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    src = f.read()

old = """  // 光球背景: radial-gradient + 柔光阴影
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%,' + color + 'cc,transparent 70%);box-shadow:0 0 8px 3px ' + color + '55"></div>' +
    svgInner;"""

new = """  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量
  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.6)' : color;
  const shadowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.3)' : color;
  // 光球背景: radial-gradient + 柔光阴影
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 35%,' + glowC + ',transparent 70%);box-shadow:0 0 8px 3px ' + shadowC + '"></div>' +
    svgInner;"""

if old not in src:
    print("ERROR: old string not found!")
    exit(1)

src = src.replace(old, new)
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(src)
print('OK')
