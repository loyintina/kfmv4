/**
 * tests/fake-dom.ts — 最小 DOM stub
 *
 * nz 不引 jsdom/happy-dom：宿主/手势的 DOM 操作面只有
 * createElement / appendChild / remove / style / dataset / className / id /
 * contains / parentElement / closest，fake 覆盖即可。
 * 选择器匹配与真机手势行为归守视实拍（B/C 档）。
 */
export class FakeEl {
  children: FakeEl[] = [];
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  className = '';
  id = '';
  parentElement: FakeEl | null = null;

  appendChild(c: FakeEl): FakeEl {
    c.remove();
    c.parentElement = this;
    this.children.push(c);
    return c;
  }

  remove(): void {
    const p = this.parentElement;
    if (p) {
      const i = p.children.indexOf(this);
      if (i >= 0) p.children.splice(i, 1);
    }
    this.parentElement = null;
  }

  contains(o: FakeEl | null): boolean {
    let e: FakeEl | null = o;
    while (e) {
      if (e === this) return true;
      e = e.parentElement;
    }
    return false;
  }

  closest(_sel: string): FakeEl | null {
    return null; // 选择器路径不在 node 侧考（归 C 档实拍）
  }
}

export class FakeDoc {
  body = new FakeEl();
  createElement(_tag: string): FakeEl {
    return new FakeEl();
  }
}
