#!/usr/bin/env python3
"""Reduce symbol prominence: opacity 0.9->0.3, remove mask, thinner stroke."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

# 1. symC alpha: 0.9 -> 0.3
s = s.replace(
    "const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.9)' : color;",
    "const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.3)' : color;"
)

# 2. Remove lighting mask from wrapper (revert to plain wrapper)
s = s.replace(
    "symC + ';-webkit-mask:linear-gradient(135deg,#000 30%,transparent 100%);mask:linear-gradient(135deg,#000 30%,transparent 100%)\">' + svgInner",
    "symC + '\">' + svgInner"
)

# 3. stroke-width: 1.2 -> 0.8
s = s.replace('stroke-width="1.2"', 'stroke-width="0.8"')

# 4. glow center opacity: 0.85 -> 0.55 (more subtle glow too)
s = s.replace(
    "const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;",
    "const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.55)' : color;"
)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
