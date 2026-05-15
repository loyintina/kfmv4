#!/usr/bin/env python3
"""Fix createDecoratedCorner to preserve input color alpha for symC."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

old_code = """  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.35)' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.4)' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.15)' : color;
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.9)' : color;"""

new_code = """  const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.35)' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.4)' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.15)' : color;
  const symA = m && m[4] !== undefined ? m[4] : '0.9';
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + symA + ')' : color;"""

if old_code not in s:
    print("ERROR: old_code not found!")
    print(s[s.find('const m = color'):s.find('const m = color')+500])
    exit(1)

s = s.replace(old_code, new_code)
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
