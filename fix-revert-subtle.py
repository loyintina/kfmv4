#!/usr/bin/env python3
"""Revert subtle-symbol changes: restore 0.9 opacity, 1.2 stroke, glow 0.85, mask."""
with open('/root/kfmv4/src/client/modules/card-stack.ts', 'r') as f:
    s = f.read()

# symC: 0.3 -> 0.9
s = s.replace(
    "const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.3)' : color;",
    "const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.9)' : color;"
)

# glowC: 0.55 -> 0.85
s = s.replace(
    "const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.55)' : color;",
    "const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;"
)

# stroke-width: 0.8 -> 1.2
s = s.replace('stroke-width="0.8"', 'stroke-width="1.2"')

# Add mask back
s = s.replace(
    "symC + '\">' + svgInner",
    "symC + ';-webkit-mask:linear-gradient(135deg,#000 30%,transparent 100%);mask:linear-gradient(135deg,#000 30%,transparent 100%)\">' + svgInner"
)

with open('/root/kfmv4/src/client/modules/card-stack.ts', 'w') as f:
    f.write(s)
print('OK')
