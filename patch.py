with open('src/client/modules/card-stack.ts') as f:
    c = f.read()
print('Read', len(c))

# Step 1: insert orb creation before anim.to
anchor = '      anim.to(el, {\n        left: targetLeft,'
idx = c.find(anchor)
if idx < 0:
    print('ERR: anchor not found'); exit(1)

insert = """      // TL/TR/BL: create at BR position, opacity=0
      const brX0 = curW - rightOff - cornerSize;
      const brY0 = curH - bottomOff - cornerSize;
      const tlColor = hexToRgba(cc.color1, orbT.tlAlpha);
      const tlOrb = createDecoratedCorner(brX0, brY0, cornerSize, cornerSize, tlColor,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c - sh) + ') scale(' + s + ')"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
      tlOrb.style.pointerEvents = 'auto'; tlOrb.style.cursor = 'pointer'; tlOrb.style.opacity = '0';
      el.appendChild(tlOrb); item.tlOrb = tlOrb;
      const trOrb = createDecoratedCorner(brX0, brY0, cornerSize, cornerSize, rightRgba,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c + sh) + ',' + (c - sh) + ') scale(' + s + ')"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></g></svg>');
      trOrb.style.pointerEvents = 'auto'; trOrb.style.cursor = 'pointer'; trOrb.style.opacity = '0';
      el.appendChild(trOrb); item.trOrb = trOrb;
      const blOrb = createDecoratedCorner(brX0, brY0, cornerSize, cornerSize, leftRgba,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c + sh) + ') scale(' + s + ')"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
      blOrb.style.pointerEvents = 'auto'; blOrb.style.cursor = 'pointer'; blOrb.style.opacity = '0';
      el.appendChild(blOrb); item.blOrb = blOrb;

"""
c = c[:idx] + insert + c[idx:]
print('Step 1 done')

with open('src/client/modules/card-stack.ts', 'w') as f:
    f.write(c)
print('Written', len(c))
