// node_modules/@leafer/core/lib/core.esm.min.js
var t;
!(function(t2) {
  t2[t2.No = 0] = "No", t2[t2.Yes = 1] = "Yes", t2[t2.NoAndSkip = 2] = "NoAndSkip", t2[t2.YesAndSkip = 3] = "YesAndSkip";
})(t || (t = {}));
var e = {};
function s(t2) {
  return void 0 === t2;
}
function r(t2) {
  return null == t2;
}
function i(t2) {
  return "string" == typeof t2;
}
var { isFinite: n } = Number;
function o(t2) {
  return "number" == typeof t2;
}
var { isArray: l } = Array;
function d(t2) {
  return t2 && "object" == typeof t2;
}
function u(t2) {
  return "{}" === JSON.stringify(t2);
}
var _ = { default: (t2, e2) => (p(e2, t2), p(t2, e2), t2), assign(t2, e2, s2) {
  let r2;
  Object.keys(e2).forEach((i2) => {
    var n2, o2;
    if (r2 = e2[i2], (null == r2 ? void 0 : r2.constructor) === Object && (null === (n2 = t2[i2]) || void 0 === n2 ? void 0 : n2.constructor) === Object) return p(t2[i2], e2[i2], s2 && s2[i2]);
    s2 && i2 in s2 ? (null === (o2 = s2[i2]) || void 0 === o2 ? void 0 : o2.constructor) === Object && p(t2[i2] = {}, e2[i2], s2[i2]) : t2[i2] = e2[i2];
  });
}, copyAttrs: (t2, e2, r2) => (r2.forEach((r3) => {
  s(e2[r3]) || (t2[r3] = e2[r3]);
}), t2), clone: (t2) => JSON.parse(JSON.stringify(t2)), toMap(t2) {
  const e2 = {};
  for (let s2 = 0, r2 = t2.length; s2 < r2; s2++) e2[t2[s2]] = true;
  return e2;
}, stintSet(t2, e2, s2) {
  s2 || (s2 = void 0), t2[e2] !== s2 && (t2[e2] = s2);
} };
var { assign: p } = _;
var f = class {
  get __useNaturalRatio() {
    return true;
  }
  get __isLinePath() {
    const { path: t2 } = this;
    return t2 && 6 === t2.length && 1 === t2[0];
  }
  get __usePathBox() {
    return this.__pathInputed;
  }
  get __blendMode() {
    if (this.eraser && "path" !== this.eraser) return "destination-out";
    const { blendMode: t2 } = this;
    return "pass-through" === t2 ? null : t2;
  }
  constructor(t2) {
    this.__leaf = t2;
  }
  __get(t2) {
    if (this.__input) {
      const e2 = this.__input[t2];
      if (!s(e2)) return e2;
    }
    return this[t2];
  }
  __getData() {
    const t2 = { tag: this.__leaf.tag }, { __input: e2 } = this;
    let r2;
    for (let i2 in this) "_" !== i2[0] && (r2 = e2 ? e2[i2] : void 0, t2[i2] = s(r2) ? this[i2] : r2);
    return t2;
  }
  __setInput(t2, e2) {
    this.__input || (this.__input = {}), this.__input[t2] = e2;
  }
  __getInput(t2) {
    if (this.__input) {
      const e2 = this.__input[t2];
      if (!s(e2)) return e2;
    }
    if ("path" !== t2 || this.__pathInputed) return this["_" + t2];
  }
  __removeInput(t2) {
    this.__input && !s(this.__input[t2]) && (this.__input[t2] = void 0);
  }
  __getInputData(t2, e2) {
    const r2 = {};
    if (t2) if (l(t2)) for (let e3 of t2) r2[e3] = this.__getInput(e3);
    else for (let e3 in t2) r2[e3] = this.__getInput(e3);
    else {
      let t3, e3, { __input: i2 } = this;
      r2.tag = this.__leaf.tag;
      for (let n2 in this) if ("_" !== n2[0] && (t3 = this["_" + n2], !s(t3))) {
        if ("path" === n2 && !this.__pathInputed) continue;
        e3 = i2 ? i2[n2] : void 0, r2[n2] = s(e3) ? t3 : e3;
      }
    }
    if (e2 && e2.matrix) {
      const { a: t3, b: e3, c: s2, d: i2, e: n2, f: o2 } = this.__leaf.__localMatrix;
      r2.matrix = { a: t3, b: e3, c: s2, d: i2, e: n2, f: o2 };
    }
    return r2;
  }
  __setMiddle(t2, e2) {
    this.__middle || (this.__middle = {}), this.__middle[t2] = e2;
  }
  __getMiddle(t2) {
    return this.__middle && this.__middle[t2];
  }
  __checkSingle() {
    const t2 = this;
    if ("pass-through" === t2.blendMode) {
      const e2 = this.__leaf;
      t2.opacity < 1 && (e2.isBranch || t2.__hasMultiPaint) || e2.__hasEraser || t2.eraser || t2.filter ? t2.__single = true : t2.__single && (t2.__single = false);
    } else t2.__single = true;
  }
  __removeNaturalSize() {
    this.__naturalWidth = this.__naturalHeight = void 0;
  }
  destroy() {
    this.__input = this.__middle = null, this.__complexData && this.__complexData.destroy();
  }
};
var g = { RUNTIME: "runtime", LEAF: "leaf", TASK: "task", CNAVAS: "canvas", IMAGE: "image", types: {}, create(t2) {
  const { types: e2 } = y;
  return e2[t2] ? e2[t2]++ : (e2[t2] = 1, 0);
} };
var y = g;
var m;
var x;
var w;
var { max: b } = Math;
var B = [0, 0, 0, 0];
var v = { zero: [...B], tempFour: B, set: (t2, e2, s2, r2, i2) => (void 0 === s2 && (s2 = r2 = i2 = e2), t2[0] = e2, t2[1] = s2, t2[2] = r2, t2[3] = i2, t2), setTemp: (t2, e2, s2, r2) => k(B, t2, e2, s2, r2), toTempAB(t2, e2, s2) {
  w = s2 ? o(t2) ? e2 : t2 : [], o(t2) ? (m = O(t2), x = e2) : o(e2) ? (m = t2, x = O(e2)) : (m = t2, x = e2), 4 !== m.length && (m = C(m)), 4 !== x.length && (x = C(x));
}, get(t2, e2) {
  let r2;
  if (!o(t2)) switch (t2.length) {
    case 4:
      r2 = s(e2) ? t2 : [...t2];
      break;
    case 2:
      r2 = [t2[0], t2[1], t2[0], t2[1]];
      break;
    case 3:
      r2 = [t2[0], t2[1], t2[2], t2[1]];
      break;
    case 1:
      t2 = t2[0];
      break;
    default:
      t2 = 0;
  }
  if (r2 || (r2 = [t2, t2, t2, t2]), !s(e2)) for (let t3 = 0; t3 < 4; t3++) r2[t3] > e2 && (r2[t3] = e2);
  return r2;
}, max: (t2, e2, s2) => o(t2) && o(e2) ? b(t2, e2) : (T(t2, e2, s2), k(w, b(m[0], x[0]), b(m[1], x[1]), b(m[2], x[2]), b(m[3], x[3]))), add: (t2, e2, s2) => o(t2) && o(e2) ? t2 + e2 : (T(t2, e2, s2), k(w, m[0] + x[0], m[1] + x[1], m[2] + x[2], m[3] + x[3])), swapAndScale(t2, e2, s2, r2) {
  if (o(t2)) return e2 === s2 ? t2 * e2 : [t2 * s2, t2 * e2];
  const i2 = r2 ? t2 : [], [n2, a, h, l2] = 4 === t2.length ? t2 : C(t2);
  return k(i2, h * s2, l2 * e2, n2 * s2, a * e2);
} };
var { set: k, get: C, setTemp: O, toTempAB: T } = v;
var { round: P, pow: S, max: L, floor: R, PI: E } = Math;
var I = {};
var M = { within: (t2, e2, r2) => (d(e2) && (r2 = e2.max, e2 = e2.min), !s(e2) && t2 < e2 && (t2 = e2), !s(r2) && t2 > r2 && (t2 = r2), t2), fourNumber: v.get, formatRotation: (t2, e2) => (t2 %= 360, e2 ? t2 < 0 && (t2 += 360) : (t2 > 180 && (t2 -= 360), t2 < -180 && (t2 += 360)), M.float(t2)), getGapRotation(t2, e2, s2 = 0) {
  let r2 = t2 + s2;
  if (e2 > 1) {
    const t3 = Math.abs(r2 % e2);
    (t3 < 1 || t3 > e2 - 1) && (r2 = Math.round(r2 / e2) * e2);
  }
  return r2 - s2;
}, float(t2, e2) {
  const r2 = s(e2) ? 1e12 : S(10, e2);
  return -0 === (t2 = P(t2 * r2) / r2) ? 0 : t2;
}, sign: (t2) => t2 < 0 ? -1 : 1, getScaleData(t2, e2, s2, r2) {
  if (r2 || (r2 = {}), e2) {
    const t3 = (o(e2) ? e2 : e2.width || 0) / s2.width, i2 = (o(e2) ? e2 : e2.height || 0) / s2.height;
    r2.scaleX = t3 || i2 || 1, r2.scaleY = i2 || t3 || 1;
  } else t2 && M.assignScale(r2, t2);
  return r2;
}, getScaleFixedData(t2, e2, s2, r2, i2) {
  let { scaleX: n2, scaleY: a } = t2;
  if ((r2 || e2) && (n2 < 0 && (n2 = -n2), a < 0 && (a = -a)), e2) if (true === e2) n2 = a = s2 ? 1 : 1 / n2;
  else {
    let t3;
    o(e2) ? t3 = e2 : "zoom-in" === e2 && (t3 = 1), t3 && (n2 = a = n2 > t3 || a > t3 ? s2 ? 1 : 1 / n2 : s2 ? 1 : 1 / t3);
  }
  return I.scaleX = n2, I.scaleY = a, I;
}, assignScale(t2, e2) {
  o(e2) ? t2.scaleX = t2.scaleY = e2 : (t2.scaleX = e2.x, t2.scaleY = e2.y);
}, getFloorScale: (t2, e2 = 1) => L(R(t2), e2) / t2, randInt: A, randColor: (t2) => `rgba(${A(255)},${A(255)},${A(255)},${t2 || 1})` };
function A(t2) {
  return Math.round(Math.random() * t2);
}
var W = E / 180;
var N = 2 * E;
var D = E / 2;
function Y() {
  return { x: 0, y: 0 };
}
function X() {
  return { x: 0, y: 0, width: 0, height: 0 };
}
function z() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}
var { sin: F, cos: U, acos: j, sqrt: V } = Math;
var { float: H } = M;
var G = {};
function q() {
  return Object.assign(Object.assign(Object.assign({}, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), { x: 0, y: 0, width: 0, height: 0 }), { scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 });
}
var Q = { defaultMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, defaultWorld: q(), tempMatrix: {}, set(t2, e2 = 1, s2 = 0, r2 = 0, i2 = 1, n2 = 0, o2 = 0) {
  t2.a = e2, t2.b = s2, t2.c = r2, t2.d = i2, t2.e = n2, t2.f = o2;
}, get: z, getWorld: q, copy(t2, e2) {
  t2.a = e2.a, t2.b = e2.b, t2.c = e2.c, t2.d = e2.d, t2.e = e2.e, t2.f = e2.f;
}, translate(t2, e2, s2) {
  t2.e += e2, t2.f += s2;
}, translateInner(t2, e2, s2, r2) {
  t2.e += t2.a * e2 + t2.c * s2, t2.f += t2.b * e2 + t2.d * s2, r2 && (t2.e -= e2, t2.f -= s2);
}, scale(t2, e2, s2 = e2) {
  t2.a *= e2, t2.b *= e2, t2.c *= s2, t2.d *= s2;
}, pixelScale(t2, e2, s2) {
  s2 || (s2 = t2), s2.a = t2.a * e2, s2.b = t2.b * e2, s2.c = t2.c * e2, s2.d = t2.d * e2, s2.e = t2.e * e2, s2.f = t2.f * e2;
}, scaleOfOuter(t2, e2, s2, r2) {
  J.toInnerPoint(t2, e2, G), J.scaleOfInner(t2, G, s2, r2);
}, scaleOfInner(t2, e2, s2, r2 = s2) {
  J.translateInner(t2, e2.x, e2.y), J.scale(t2, s2, r2), J.translateInner(t2, -e2.x, -e2.y);
}, rotate(t2, e2) {
  const { a: s2, b: r2, c: i2, d: n2 } = t2, o2 = U(e2 *= W), a = F(e2);
  t2.a = s2 * o2 - r2 * a, t2.b = s2 * a + r2 * o2, t2.c = i2 * o2 - n2 * a, t2.d = i2 * a + n2 * o2;
}, rotateOfOuter(t2, e2, s2) {
  J.toInnerPoint(t2, e2, G), J.rotateOfInner(t2, G, s2);
}, rotateOfInner(t2, e2, s2) {
  J.translateInner(t2, e2.x, e2.y), J.rotate(t2, s2), J.translateInner(t2, -e2.x, -e2.y);
}, skew(t2, e2, s2) {
  const { a: r2, b: i2, c: n2, d: o2 } = t2;
  s2 && (s2 *= W, t2.a = r2 + n2 * s2, t2.b = i2 + o2 * s2), e2 && (e2 *= W, t2.c = n2 + r2 * e2, t2.d = o2 + i2 * e2);
}, skewOfOuter(t2, e2, s2, r2) {
  J.toInnerPoint(t2, e2, G), J.skewOfInner(t2, G, s2, r2);
}, skewOfInner(t2, e2, s2, r2 = 0) {
  J.translateInner(t2, e2.x, e2.y), J.skew(t2, s2, r2), J.translateInner(t2, -e2.x, -e2.y);
}, multiply(t2, e2) {
  const { a: s2, b: r2, c: i2, d: n2, e: o2, f: a } = t2;
  t2.a = e2.a * s2 + e2.b * i2, t2.b = e2.a * r2 + e2.b * n2, t2.c = e2.c * s2 + e2.d * i2, t2.d = e2.c * r2 + e2.d * n2, t2.e = e2.e * s2 + e2.f * i2 + o2, t2.f = e2.e * r2 + e2.f * n2 + a;
}, multiplyParent(t2, e2, r2, i2, n2) {
  const { e: o2, f: a } = t2;
  if (r2 || (r2 = t2), s(i2) && (i2 = 1 !== t2.a || t2.b || t2.c || 1 !== t2.d), i2) {
    const { a: s2, b: i3, c: o3, d: a2 } = t2;
    r2.a = s2 * e2.a + i3 * e2.c, r2.b = s2 * e2.b + i3 * e2.d, r2.c = o3 * e2.a + a2 * e2.c, r2.d = o3 * e2.b + a2 * e2.d, n2 && (r2.scaleX = e2.scaleX * n2.scaleX, r2.scaleY = e2.scaleY * n2.scaleY);
  } else r2.a = e2.a, r2.b = e2.b, r2.c = e2.c, r2.d = e2.d, n2 && (r2.scaleX = e2.scaleX, r2.scaleY = e2.scaleY);
  r2.e = o2 * e2.a + a * e2.c + e2.e, r2.f = o2 * e2.b + a * e2.d + e2.f;
}, divide(t2, e2) {
  J.multiply(t2, J.tempInvert(e2));
}, divideParent(t2, e2) {
  J.multiplyParent(t2, J.tempInvert(e2));
}, tempInvert(t2) {
  const { tempMatrix: e2 } = J;
  return J.copy(e2, t2), J.invert(e2), e2;
}, invert(t2) {
  const { a: e2, b: s2, c: r2, d: i2, e: n2, f: o2 } = t2;
  if (s2 || r2) {
    const a = 1 / (e2 * i2 - s2 * r2);
    t2.a = i2 * a, t2.b = -s2 * a, t2.c = -r2 * a, t2.d = e2 * a, t2.e = -(n2 * i2 - o2 * r2) * a, t2.f = -(o2 * e2 - n2 * s2) * a;
  } else if (1 === e2 && 1 === i2) t2.e = -n2, t2.f = -o2;
  else {
    const s3 = 1 / (e2 * i2);
    t2.a = i2 * s3, t2.d = e2 * s3, t2.e = -n2 * i2 * s3, t2.f = -o2 * e2 * s3;
  }
}, toOuterPoint(t2, e2, s2, r2) {
  const { x: i2, y: n2 } = e2;
  s2 || (s2 = e2), s2.x = i2 * t2.a + n2 * t2.c, s2.y = i2 * t2.b + n2 * t2.d, r2 || (s2.x += t2.e, s2.y += t2.f);
}, toInnerPoint(t2, e2, s2, r2) {
  const { a: i2, b: n2, c: o2, d: a } = t2, h = 1 / (i2 * a - n2 * o2), { x: l2, y: d2 } = e2;
  if (s2 || (s2 = e2), s2.x = (l2 * a - d2 * o2) * h, s2.y = (d2 * i2 - l2 * n2) * h, !r2) {
    const { e: e3, f: r3 } = t2;
    s2.x -= (e3 * a - r3 * o2) * h, s2.y -= (r3 * i2 - e3 * n2) * h;
  }
}, setLayout(t2, e2, r2, i2, n2) {
  const { x: o2, y: a, scaleX: h, scaleY: l2 } = e2;
  if (s(n2) && (n2 = e2.rotation || e2.skewX || e2.skewY), n2) {
    const { rotation: s2, skewX: r3, skewY: i3 } = e2, n3 = s2 * W, o3 = U(n3), a2 = F(n3);
    if (r3 || i3) {
      const e3 = r3 * W, s3 = i3 * W;
      t2.a = (o3 + s3 * -a2) * h, t2.b = (a2 + s3 * o3) * h, t2.c = (e3 * o3 - a2) * l2, t2.d = (o3 + e3 * a2) * l2;
    } else t2.a = o3 * h, t2.b = a2 * h, t2.c = -a2 * l2, t2.d = o3 * l2;
  } else t2.a = h, t2.b = 0, t2.c = 0, t2.d = l2;
  t2.e = o2, t2.f = a, (r2 = r2 || i2) && J.translateInner(t2, -r2.x, -r2.y, !i2);
}, getLayout(t2, e2, s2, r2) {
  const { a: i2, b: n2, c: o2, d: a, e: h, f: l2 } = t2;
  let d2, c, u2, _2, p2, f2 = h, g2 = l2;
  if (n2 || o2) {
    const t3 = i2 * a - n2 * o2;
    if (o2 && !r2) {
      d2 = V(i2 * i2 + n2 * n2), c = t3 / d2;
      const e4 = i2 / d2;
      u2 = n2 > 0 ? j(e4) : -j(e4);
    } else {
      c = V(o2 * o2 + a * a), d2 = t3 / c;
      const e4 = o2 / c;
      u2 = D - (a > 0 ? j(-e4) : -j(e4));
    }
    const e3 = H(U(u2)), s3 = F(u2);
    d2 = H(d2), c = H(c), _2 = e3 ? H((o2 / c + s3) / e3 / W, 9) : 0, p2 = e3 ? H((n2 / d2 - s3) / e3 / W, 9) : 0, u2 = H(u2 / W);
  } else d2 = i2, c = a, u2 = _2 = p2 = 0;
  return (e2 = s2 || e2) && (f2 += e2.x * i2 + e2.y * o2, g2 += e2.x * n2 + e2.y * a, s2 || (f2 -= e2.x, g2 -= e2.y)), { x: f2, y: g2, scaleX: d2, scaleY: c, rotation: u2, skewX: _2, skewY: p2 };
}, withScale(t2, e2, s2 = e2) {
  const r2 = t2;
  if (!e2 || !s2) {
    const { a: r3, b: i2, c: n2, d: o2 } = t2;
    i2 || n2 ? s2 = (r3 * o2 - i2 * n2) / (e2 = V(r3 * r3 + i2 * i2)) : (e2 = r3, s2 = o2);
  }
  return r2.scaleX = e2, r2.scaleY = s2, r2;
}, reset(t2) {
  J.set(t2);
} };
var J = Q;
var { float: Z } = M;
var { toInnerPoint: $, toOuterPoint: K } = Q;
var { sin: tt, cos: et, abs: st, sqrt: rt, atan2: it, min: nt, round: ot } = Math;
var at = { defaultPoint: { x: 0, y: 0 }, tempPoint: {}, tempRadiusPoint: {}, set(t2, e2 = 0, s2 = 0) {
  t2.x = e2, t2.y = s2;
}, setRadius(t2, e2, r2) {
  t2.radiusX = e2, t2.radiusY = s(r2) ? e2 : r2;
}, copy(t2, e2) {
  t2.x = e2.x, t2.y = e2.y;
}, copyFrom(t2, e2, s2) {
  t2.x = e2, t2.y = s2;
}, round(t2, e2) {
  t2.x = e2 ? ot(t2.x - 0.5) + 0.5 : ot(t2.x), t2.y = e2 ? ot(t2.y - 0.5) + 0.5 : ot(t2.y);
}, move(t2, e2, s2) {
  d(e2) ? (t2.x += e2.x, t2.y += e2.y) : (t2.x += e2, t2.y += s2);
}, scale(t2, e2, s2 = e2) {
  t2.x && (t2.x *= e2), t2.y && (t2.y *= s2);
}, scaleOf(t2, e2, s2, r2 = s2) {
  t2.x += (t2.x - e2.x) * (s2 - 1), t2.y += (t2.y - e2.y) * (r2 - 1);
}, rotate(t2, e2, s2) {
  s2 || (s2 = ht.defaultPoint);
  const r2 = et(e2 *= W), i2 = tt(e2), n2 = t2.x - s2.x, o2 = t2.y - s2.y;
  t2.x = s2.x + n2 * r2 - o2 * i2, t2.y = s2.y + n2 * i2 + o2 * r2;
}, tempToInnerOf(t2, e2) {
  const { tempPoint: s2 } = ht;
  return dt(s2, t2), $(e2, s2, s2), s2;
}, tempToOuterOf(t2, e2) {
  const { tempPoint: s2 } = ht;
  return dt(s2, t2), K(e2, s2, s2), s2;
}, tempToInnerRadiusPointOf(t2, e2) {
  const { tempRadiusPoint: s2 } = ht;
  return dt(s2, t2), ht.toInnerRadiusPointOf(t2, e2, s2), s2;
}, copyRadiusPoint: (t2, e2, s2, r2) => (dt(t2, e2), ct(t2, s2, r2), t2), toInnerRadiusPointOf(t2, e2, s2) {
  s2 || (s2 = t2), $(e2, t2, s2), s2.radiusX = Math.abs(t2.radiusX / e2.scaleX), s2.radiusY = Math.abs(t2.radiusY / e2.scaleY);
}, toInnerOf(t2, e2, s2) {
  $(e2, t2, s2);
}, toOuterOf(t2, e2, s2) {
  K(e2, t2, s2);
}, getCenter: (t2, e2) => ({ x: t2.x + (e2.x - t2.x) / 2, y: t2.y + (e2.y - t2.y) / 2 }), getCenterX: (t2, e2) => t2 + (e2 - t2) / 2, getCenterY: (t2, e2) => t2 + (e2 - t2) / 2, getDistance: (t2, e2) => lt(t2.x, t2.y, e2.x, e2.y), getDistanceFrom(t2, e2, s2, r2) {
  const i2 = st(s2 - t2), n2 = st(r2 - e2);
  return rt(i2 * i2 + n2 * n2);
}, getMinDistanceFrom: (t2, e2, s2, r2, i2, n2) => nt(lt(t2, e2, s2, r2), lt(s2, r2, i2, n2)), getAngle: (t2, e2) => ut(t2, e2) / W, getRotation: (t2, e2, s2, r2) => (r2 || (r2 = e2), ht.getRadianFrom(t2.x, t2.y, e2.x, e2.y, s2.x, s2.y, r2.x, r2.y) / W), getRadianFrom(t2, e2, r2, i2, n2, o2, a, h) {
  s(a) && (a = r2, h = i2);
  const l2 = t2 - r2, d2 = e2 - i2, c = n2 - a, u2 = o2 - h;
  return Math.atan2(l2 * u2 - d2 * c, l2 * c + d2 * u2);
}, getAtan2: (t2, e2) => it(e2.y - t2.y, e2.x - t2.x), getDistancePoint(t2, e2, s2, r2, i2) {
  const n2 = ut(t2, e2);
  return i2 && (t2 = e2), r2 || (e2 = {}), e2.x = t2.x + et(n2) * s2, e2.y = t2.y + tt(n2) * s2, e2;
}, toNumberPoints(t2) {
  let e2 = t2;
  return d(t2[0]) && (e2 = [], t2.forEach((t3) => e2.push(t3.x, t3.y))), e2;
}, isSame: (t2, e2, s2) => s2 ? t2.x === e2.x && t2.y === e2.y : Z(t2.x) === Z(e2.x) && Z(t2.y) === Z(e2.y), reset(t2) {
  ht.reset(t2);
} };
var ht = at;
var { getDistanceFrom: lt, copy: dt, setRadius: ct, getAtan2: ut } = ht;
var _t = class __t {
  constructor(t2, e2) {
    this.set(t2, e2);
  }
  set(t2, e2) {
    return d(t2) ? at.copy(this, t2) : at.set(this, t2, e2), this;
  }
  get() {
    const { x: t2, y: e2 } = this;
    return { x: t2, y: e2 };
  }
  clone() {
    return new __t(this);
  }
  move(t2, e2) {
    return at.move(this, t2, e2), this;
  }
  scale(t2, e2) {
    return at.scale(this, t2, e2), this;
  }
  scaleOf(t2, e2, s2) {
    return at.scaleOf(this, t2, e2, s2), this;
  }
  rotate(t2, e2) {
    return at.rotate(this, t2, e2), this;
  }
  rotateOf(t2, e2) {
    return at.rotate(this, e2, t2), this;
  }
  getRotation(t2, e2, s2) {
    return at.getRotation(this, t2, e2, s2);
  }
  toInnerOf(t2, e2) {
    return at.toInnerOf(this, t2, e2), this;
  }
  toOuterOf(t2, e2) {
    return at.toOuterOf(this, t2, e2), this;
  }
  getCenter(t2) {
    return new __t(at.getCenter(this, t2));
  }
  getDistance(t2) {
    return at.getDistance(this, t2);
  }
  getDistancePoint(t2, e2, s2, r2) {
    return new __t(at.getDistancePoint(this, t2, e2, s2, r2));
  }
  getAngle(t2) {
    return at.getAngle(this, t2);
  }
  getAtan2(t2) {
    return at.getAtan2(this, t2);
  }
  isSame(t2, e2) {
    return at.isSame(this, t2, e2);
  }
  reset() {
    return at.reset(this), this;
  }
};
var pt = new _t();
var ft = class _ft {
  constructor(t2, e2, s2, r2, i2, n2) {
    this.set(t2, e2, s2, r2, i2, n2);
  }
  set(t2, e2, s2, r2, i2, n2) {
    return d(t2) ? Q.copy(this, t2) : Q.set(this, t2, e2, s2, r2, i2, n2), this;
  }
  setWith(t2) {
    return Q.copy(this, t2), this.scaleX = t2.scaleX, this.scaleY = t2.scaleY, this;
  }
  get() {
    const { a: t2, b: e2, c: s2, d: r2, e: i2, f: n2 } = this;
    return { a: t2, b: e2, c: s2, d: r2, e: i2, f: n2 };
  }
  clone() {
    return new _ft(this);
  }
  translate(t2, e2) {
    return Q.translate(this, t2, e2), this;
  }
  translateInner(t2, e2) {
    return Q.translateInner(this, t2, e2), this;
  }
  scale(t2, e2) {
    return Q.scale(this, t2, e2), this;
  }
  scaleWith(t2, e2) {
    return Q.scale(this, t2, e2), this.scaleX *= t2, this.scaleY *= e2 || t2, this;
  }
  pixelScale(t2) {
    return Q.pixelScale(this, t2), this;
  }
  scaleOfOuter(t2, e2, s2) {
    return Q.scaleOfOuter(this, t2, e2, s2), this;
  }
  scaleOfInner(t2, e2, s2) {
    return Q.scaleOfInner(this, t2, e2, s2), this;
  }
  rotate(t2) {
    return Q.rotate(this, t2), this;
  }
  rotateOfOuter(t2, e2) {
    return Q.rotateOfOuter(this, t2, e2), this;
  }
  rotateOfInner(t2, e2) {
    return Q.rotateOfInner(this, t2, e2), this;
  }
  skew(t2, e2) {
    return Q.skew(this, t2, e2), this;
  }
  skewOfOuter(t2, e2, s2) {
    return Q.skewOfOuter(this, t2, e2, s2), this;
  }
  skewOfInner(t2, e2, s2) {
    return Q.skewOfInner(this, t2, e2, s2), this;
  }
  multiply(t2) {
    return Q.multiply(this, t2), this;
  }
  multiplyParent(t2) {
    return Q.multiplyParent(this, t2), this;
  }
  divide(t2) {
    return Q.divide(this, t2), this;
  }
  divideParent(t2) {
    return Q.divideParent(this, t2), this;
  }
  invert() {
    return Q.invert(this), this;
  }
  invertWith() {
    return Q.invert(this), this.scaleX = 1 / this.scaleX, this.scaleY = 1 / this.scaleY, this;
  }
  toOuterPoint(t2, e2, s2) {
    Q.toOuterPoint(this, t2, e2, s2);
  }
  toInnerPoint(t2, e2, s2) {
    Q.toInnerPoint(this, t2, e2, s2);
  }
  setLayout(t2, e2, s2) {
    return Q.setLayout(this, t2, e2, s2), this;
  }
  getLayout(t2, e2, s2) {
    return Q.getLayout(this, t2, e2, s2);
  }
  withScale(t2, e2) {
    return Q.withScale(this, t2, e2);
  }
  reset() {
    Q.reset(this);
  }
};
var gt = new ft();
var yt = { tempPointBounds: {}, setPoint(t2, e2, s2) {
  t2.minX = t2.maxX = e2, t2.minY = t2.maxY = s2;
}, addPoint(t2, e2, s2) {
  t2.minX = e2 < t2.minX ? e2 : t2.minX, t2.minY = s2 < t2.minY ? s2 : t2.minY, t2.maxX = e2 > t2.maxX ? e2 : t2.maxX, t2.maxY = s2 > t2.maxY ? s2 : t2.maxY;
}, addBounds(t2, e2, s2, r2, i2) {
  mt(t2, e2, s2), mt(t2, e2 + r2, s2 + i2);
}, copy(t2, e2) {
  t2.minX = e2.minX, t2.minY = e2.minY, t2.maxX = e2.maxX, t2.maxY = e2.maxY;
}, addPointBounds(t2, e2) {
  t2.minX = e2.minX < t2.minX ? e2.minX : t2.minX, t2.minY = e2.minY < t2.minY ? e2.minY : t2.minY, t2.maxX = e2.maxX > t2.maxX ? e2.maxX : t2.maxX, t2.maxY = e2.maxY > t2.maxY ? e2.maxY : t2.maxY;
}, toBounds(t2, e2) {
  e2.x = t2.minX, e2.y = t2.minY, e2.width = t2.maxX - t2.minX, e2.height = t2.maxY - t2.minY;
} };
var { addPoint: mt } = yt;
var xt;
var wt;
!(function(t2) {
  t2[t2.top = 0] = "top", t2[t2.right = 1] = "right", t2[t2.bottom = 2] = "bottom", t2[t2.left = 3] = "left";
})(xt || (xt = {})), (function(t2) {
  t2[t2.topLeft = 0] = "topLeft", t2[t2.top = 1] = "top", t2[t2.topRight = 2] = "topRight", t2[t2.right = 3] = "right", t2[t2.bottomRight = 4] = "bottomRight", t2[t2.bottom = 5] = "bottom", t2[t2.bottomLeft = 6] = "bottomLeft", t2[t2.left = 7] = "left", t2[t2.center = 8] = "center", t2[t2["top-left"] = 0] = "top-left", t2[t2["top-right"] = 2] = "top-right", t2[t2["bottom-right"] = 4] = "bottom-right", t2[t2["bottom-left"] = 6] = "bottom-left";
})(wt || (wt = {}));
var bt = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }];
bt.forEach((t2) => t2.type = "percent");
var Bt = { directionData: bt, tempPoint: {}, get: vt, toPoint(t2, e2, s2, r2, i2, n2) {
  const o2 = vt(t2);
  s2.x = o2.x, s2.y = o2.y, "percent" === o2.type && (s2.x *= e2.width, s2.y *= e2.height, i2 && (n2 || (s2.x -= i2.x, s2.y -= i2.y), o2.x && (s2.x -= 1 === o2.x ? i2.width : 0.5 === o2.x ? o2.x * i2.width : 0), o2.y && (s2.y -= 1 === o2.y ? i2.height : 0.5 === o2.y ? o2.y * i2.height : 0))), r2 || (s2.x += e2.x, s2.y += e2.y);
}, getPoint: (t2, e2, s2, r2 = true) => (s2 || (s2 = {}), Bt.toPoint(t2, e2, s2, r2), s2) };
function vt(t2) {
  return i(t2) ? bt[wt[t2]] : t2;
}
var { toPoint: kt } = Bt;
var Ct = { toPoint(t2, e2, s2, r2, i2, n2) {
  kt(t2, s2, r2, i2, e2, n2);
} };
var { tempPointBounds: Ot, setPoint: Tt, addPoint: Pt, toBounds: St } = yt;
var { toOuterPoint: Lt } = Q;
var { float: Rt, fourNumber: Et } = M;
var { floor: It, ceil: Mt } = Math;
var At;
var Wt;
var Nt;
var Dt;
var Yt = {};
var Xt = {};
var zt = {};
var Ft = { tempBounds: zt, set(t2, e2 = 0, s2 = 0, r2 = 0, i2 = 0) {
  t2.x = e2, t2.y = s2, t2.width = r2, t2.height = i2;
}, copy(t2, e2) {
  t2.x = e2.x, t2.y = e2.y, t2.width = e2.width, t2.height = e2.height;
}, copyAndSpread(t2, e2, s2, r2, i2) {
  const { x: n2, y: o2, width: a, height: h } = e2;
  if (l(s2)) {
    const e3 = Et(s2);
    r2 ? Ut.set(t2, n2 + e3[3], o2 + e3[0], a - e3[1] - e3[3], h - e3[2] - e3[0]) : Ut.set(t2, n2 - e3[3], o2 - e3[0], a + e3[1] + e3[3], h + e3[2] + e3[0]);
  } else r2 && (s2 = -s2), Ut.set(t2, n2 - s2, o2 - s2, a + 2 * s2, h + 2 * s2);
  i2 && ("width" === i2 ? (t2.y = o2, t2.height = h) : (t2.x = n2, t2.width = a));
}, minX: (t2) => t2.width > 0 ? t2.x : t2.x + t2.width, minY: (t2) => t2.height > 0 ? t2.y : t2.y + t2.height, maxX: (t2) => t2.width > 0 ? t2.x + t2.width : t2.x, maxY: (t2) => t2.height > 0 ? t2.y + t2.height : t2.y, move(t2, e2, s2) {
  t2.x += e2, t2.y += s2;
}, scroll(t2, e2) {
  t2.x += e2.scrollX, t2.y += e2.scrollY;
}, getByMove: (t2, e2, s2) => (t2 = Object.assign({}, t2), Ut.move(t2, e2, s2), t2), toOffsetOutBounds(t2, e2, s2) {
  e2 ? Vt(e2, t2) : e2 = t2, s2 || (s2 = t2), e2.offsetX = Ut.maxX(s2), e2.offsetY = Ut.maxY(s2), Ut.move(e2, -e2.offsetX, -e2.offsetY);
}, scale(t2, e2, s2 = e2, r2) {
  r2 || at.scale(t2, e2, s2), t2.width *= e2, t2.height *= s2;
}, scaleOf(t2, e2, s2, r2 = s2) {
  at.scaleOf(t2, e2, s2, r2), t2.width *= s2, t2.height *= r2;
}, tempToOuterOf: (t2, e2) => (Ut.copy(zt, t2), Ut.toOuterOf(zt, e2), zt), getOuterOf: (t2, e2) => (t2 = Object.assign({}, t2), Ut.toOuterOf(t2, e2), t2), toOuterOf(t2, e2, s2) {
  if (s2 || (s2 = t2), 0 === e2.b && 0 === e2.c) {
    const { a: r2, d: i2, e: n2, f: o2 } = e2;
    r2 > 0 ? (s2.width = t2.width * r2, s2.x = n2 + t2.x * r2) : (s2.width = t2.width * -r2, s2.x = n2 + t2.x * r2 - s2.width), i2 > 0 ? (s2.height = t2.height * i2, s2.y = o2 + t2.y * i2) : (s2.height = t2.height * -i2, s2.y = o2 + t2.y * i2 - s2.height);
  } else Yt.x = t2.x, Yt.y = t2.y, Lt(e2, Yt, Xt), Tt(Ot, Xt.x, Xt.y), Yt.x = t2.x + t2.width, Lt(e2, Yt, Xt), Pt(Ot, Xt.x, Xt.y), Yt.y = t2.y + t2.height, Lt(e2, Yt, Xt), Pt(Ot, Xt.x, Xt.y), Yt.x = t2.x, Lt(e2, Yt, Xt), Pt(Ot, Xt.x, Xt.y), St(Ot, s2);
}, toInnerOf(t2, e2, s2) {
  s2 || (s2 = t2), Ut.move(s2, -e2.e, -e2.f), Ut.scale(s2, 1 / e2.a, 1 / e2.d);
}, getFitMatrix(t2, e2, s2 = 1) {
  const r2 = Math.min(s2, Ut.getFitScale(t2, e2));
  return new ft(r2, 0, 0, r2, -e2.x * r2, -e2.y * r2);
}, getFitScale(t2, e2, s2) {
  const r2 = t2.width / e2.width, i2 = t2.height / e2.height;
  return s2 ? Math.max(r2, i2) : Math.min(r2, i2);
}, put(t2, e2, s2 = "center", r2 = 1, n2 = true, o2) {
  o2 || (o2 = e2), i(r2) && (r2 = Ut.getFitScale(t2, e2, "cover" === r2)), zt.width = n2 ? e2.width *= r2 : e2.width * r2, zt.height = n2 ? e2.height *= r2 : e2.height * r2, Ct.toPoint(s2, zt, t2, o2, true, true);
}, getSpread(t2, e2, s2) {
  const r2 = {};
  return Ut.copyAndSpread(r2, t2, e2, false, s2), r2;
}, spread(t2, e2, s2) {
  Ut.copyAndSpread(t2, t2, e2, false, s2);
}, shrink(t2, e2, s2) {
  Ut.copyAndSpread(t2, t2, e2, true, s2);
}, ceil(t2) {
  const { x: e2, y: s2 } = t2;
  t2.x = It(t2.x), t2.y = It(t2.y), t2.width = e2 > t2.x ? Mt(t2.width + e2 - t2.x) : Mt(t2.width), t2.height = s2 > t2.y ? Mt(t2.height + s2 - t2.y) : Mt(t2.height);
}, unsign(t2) {
  t2.width < 0 && (t2.x += t2.width, t2.width = -t2.width), t2.height < 0 && (t2.y += t2.height, t2.height = -t2.height);
}, float(t2, e2) {
  t2.x = Rt(t2.x, e2), t2.y = Rt(t2.y, e2), t2.width = Rt(t2.width, e2), t2.height = Rt(t2.height, e2);
}, add(t2, e2, s2) {
  At = t2.x + t2.width, Wt = t2.y + t2.height, Nt = e2.x, Dt = e2.y, s2 || (Nt += e2.width, Dt += e2.height), At = At > Nt ? At : Nt, Wt = Wt > Dt ? Wt : Dt, t2.x = t2.x < e2.x ? t2.x : e2.x, t2.y = t2.y < e2.y ? t2.y : e2.y, t2.width = At - t2.x, t2.height = Wt - t2.y;
}, addList(t2, e2) {
  Ut.setListWithFn(t2, e2, void 0, true);
}, setList(t2, e2, s2 = false) {
  Ut.setListWithFn(t2, e2, void 0, s2);
}, addListWithFn(t2, e2, s2) {
  Ut.setListWithFn(t2, e2, s2, true);
}, setListWithFn(t2, e2, s2, r2 = false) {
  let i2, n2 = true;
  for (let o2 = 0, a = e2.length; o2 < a; o2++) i2 = s2 ? s2(e2[o2], o2) : e2[o2], i2 && (i2.width || i2.height) && (n2 ? (n2 = false, r2 || Vt(t2, i2)) : jt(t2, i2));
  n2 && Ut.reset(t2);
}, setPoints(t2, e2) {
  e2.forEach((t3, e3) => 0 === e3 ? Tt(Ot, t3.x, t3.y) : Pt(Ot, t3.x, t3.y)), St(Ot, t2);
}, setPoint(t2, e2) {
  Ut.set(t2, e2.x, e2.y);
}, addPoint(t2, e2) {
  jt(t2, e2, true);
}, getPoints(t2) {
  const { x: e2, y: s2, width: r2, height: i2 } = t2;
  return [{ x: e2, y: s2 }, { x: e2 + r2, y: s2 }, { x: e2 + r2, y: s2 + i2 }, { x: e2, y: s2 + i2 }];
}, getPoint: (t2, e2, s2 = false, r2) => Bt.getPoint(e2, t2, r2, s2), hitRadiusPoint: (t2, e2, s2) => (s2 && (e2 = at.tempToInnerRadiusPointOf(e2, s2)), e2.x >= t2.x - e2.radiusX && e2.x <= t2.x + t2.width + e2.radiusX && e2.y >= t2.y - e2.radiusY && e2.y <= t2.y + t2.height + e2.radiusY), hitPoint: (t2, e2, s2) => (s2 && (e2 = at.tempToInnerOf(e2, s2)), e2.x >= t2.x && e2.x <= t2.x + t2.width && e2.y >= t2.y && e2.y <= t2.y + t2.height), hit: (t2, e2, s2) => (s2 && (e2 = Ut.tempToOuterOf(e2, s2)), !(t2.y + t2.height < e2.y || e2.y + e2.height < t2.y || t2.x + t2.width < e2.x || e2.x + e2.width < t2.x)), includes: (t2, e2, s2) => (s2 && (e2 = Ut.tempToOuterOf(e2, s2)), t2.x <= e2.x && t2.y <= e2.y && t2.x + t2.width >= e2.x + e2.width && t2.y + t2.height >= e2.y + e2.height), getIntersectData(t2, e2, s2) {
  if (s2 && (e2 = Ut.tempToOuterOf(e2, s2)), !Ut.hit(t2, e2)) return { x: 0, y: 0, width: 0, height: 0 };
  let { x: r2, y: i2, width: n2, height: o2 } = e2;
  return At = r2 + n2, Wt = i2 + o2, Nt = t2.x + t2.width, Dt = t2.y + t2.height, r2 = r2 > t2.x ? r2 : t2.x, i2 = i2 > t2.y ? i2 : t2.y, At = At < Nt ? At : Nt, Wt = Wt < Dt ? Wt : Dt, n2 = At - r2, o2 = Wt - i2, { x: r2, y: i2, width: n2, height: o2 };
}, intersect(t2, e2, s2) {
  Ut.copy(t2, Ut.getIntersectData(t2, e2, s2));
}, isSame: (t2, e2) => t2.x === e2.x && t2.y === e2.y && t2.width === e2.width && t2.height === e2.height, isEmpty: (t2) => 0 === t2.x && 0 === t2.y && 0 === t2.width && 0 === t2.height, hasSize: (t2) => t2.width && t2.height, reset(t2) {
  Ut.set(t2);
} };
var Ut = Ft;
var { add: jt, copy: Vt } = Ut;
var Ht = class _Ht {
  get minX() {
    return Ft.minX(this);
  }
  get minY() {
    return Ft.minY(this);
  }
  get maxX() {
    return Ft.maxX(this);
  }
  get maxY() {
    return Ft.maxY(this);
  }
  constructor(t2, e2, s2, r2) {
    this.set(t2, e2, s2, r2);
  }
  set(t2, e2, s2, r2) {
    return d(t2) ? Ft.copy(this, t2) : Ft.set(this, t2, e2, s2, r2), this;
  }
  get() {
    const { x: t2, y: e2, width: s2, height: r2 } = this;
    return { x: t2, y: e2, width: s2, height: r2 };
  }
  clone() {
    return new _Ht(this);
  }
  move(t2, e2) {
    return Ft.move(this, t2, e2), this;
  }
  scale(t2, e2, s2) {
    return Ft.scale(this, t2, e2, s2), this;
  }
  scaleOf(t2, e2, s2) {
    return Ft.scaleOf(this, t2, e2, s2), this;
  }
  toOuterOf(t2, e2) {
    return Ft.toOuterOf(this, t2, e2), this;
  }
  toInnerOf(t2, e2) {
    return Ft.toInnerOf(this, t2, e2), this;
  }
  getFitMatrix(t2, e2) {
    return Ft.getFitMatrix(this, t2, e2);
  }
  put(t2, e2, s2) {
    Ft.put(this, t2, e2, s2);
  }
  spread(t2, e2) {
    return Ft.spread(this, t2, e2), this;
  }
  shrink(t2, e2) {
    return Ft.shrink(this, t2, e2), this;
  }
  ceil() {
    return Ft.ceil(this), this;
  }
  unsign() {
    return Ft.unsign(this), this;
  }
  float(t2) {
    return Ft.float(this, t2), this;
  }
  add(t2) {
    return Ft.add(this, t2), this;
  }
  addList(t2) {
    return Ft.setList(this, t2, true), this;
  }
  setList(t2) {
    return Ft.setList(this, t2), this;
  }
  addListWithFn(t2, e2) {
    return Ft.setListWithFn(this, t2, e2, true), this;
  }
  setListWithFn(t2, e2) {
    return Ft.setListWithFn(this, t2, e2), this;
  }
  setPoint(t2) {
    return Ft.setPoint(this, t2), this;
  }
  setPoints(t2) {
    return Ft.setPoints(this, t2), this;
  }
  addPoint(t2) {
    return Ft.addPoint(this, t2), this;
  }
  getPoints() {
    return Ft.getPoints(this);
  }
  getPoint(t2, e2, s2) {
    return Ft.getPoint(this, t2, e2, s2);
  }
  hitPoint(t2, e2) {
    return Ft.hitPoint(this, t2, e2);
  }
  hitRadiusPoint(t2, e2) {
    return Ft.hitRadiusPoint(this, t2, e2);
  }
  hit(t2, e2) {
    return Ft.hit(this, t2, e2);
  }
  includes(t2, e2) {
    return Ft.includes(this, t2, e2);
  }
  intersect(t2, e2) {
    return Ft.intersect(this, t2, e2), this;
  }
  getIntersect(t2, e2) {
    return new _Ht(Ft.getIntersectData(this, t2, e2));
  }
  isSame(t2) {
    return Ft.isSame(this, t2);
  }
  isEmpty() {
    return Ft.isEmpty(this);
  }
  reset() {
    Ft.reset(this);
  }
};
var Gt = new Ht();
var qt = class {
  constructor(t2, e2, s2, r2, i2, n2) {
    d(t2) ? this.copy(t2) : this.set(t2, e2, s2, r2, i2, n2);
  }
  set(t2 = 0, e2 = 0, s2 = 0, r2 = 0, i2 = 0, n2 = 0) {
    this.top = t2, this.right = e2, this.bottom = s2, this.left = r2, this.width = i2, this.height = n2;
  }
  copy(t2) {
    const { top: e2, right: s2, bottom: r2, left: i2, width: n2, height: o2 } = t2;
    this.set(e2, s2, r2, i2, n2, o2);
  }
  getBoundsFrom(t2) {
    const { top: e2, right: s2, bottom: r2, left: i2, width: n2, height: o2 } = this;
    return new Ht(i2, e2, n2 || t2.width - i2 - s2, o2 || t2.height - e2 - r2);
  }
};
var Qt = { number: (t2, e2) => d(t2) ? "percent" === t2.type ? t2.value * e2 : t2.value : t2 };
var Jt = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, ".": 1, e: 1, E: 1 };
var { floor: Zt, max: $t } = Math;
var Kt = { toURL(t2, e2) {
  let s2 = encodeURIComponent(t2);
  return "text" === e2 ? s2 = "data:text/plain;charset=utf-8," + s2 : "svg" === e2 && (s2 = "data:image/svg+xml," + s2), s2;
}, image: { hitCanvasSize: 100, maxCacheSize: 4096e3, maxPatternSize: 8847360, crossOrigin: "anonymous", isLarge: (t2, e2, s2, r2) => t2.width * t2.height * (e2 ? e2 * s2 : 1) > (r2 || te.maxCacheSize), isSuperLarge: (t2, e2, s2) => te.isLarge(t2, e2, s2, te.maxPatternSize), getRealURL(t2) {
  const { prefix: e2, suffix: s2 } = te;
  return !s2 || t2.startsWith("data:") || t2.startsWith("blob:") || (t2 += (t2.includes("?") ? "&" : "?") + s2), e2 && "/" === t2[0] && (t2 = e2 + t2), t2;
}, resize(t2, e2, s2, r2, i2, n2, o2, a, h, l2) {
  const d2 = $t(Zt(e2 + (r2 || 0)), 1), c = $t(Zt(s2 + (i2 || 0)), 1);
  let u2, _2, p2;
  l2 && (p2 = Qt.number(l2.offset, "x" === l2.type ? e2 : s2)) && ("x" === l2.type ? u2 = true : _2 = true);
  const f2 = Kt.origin.createCanvas(_2 ? 2 * d2 : d2, u2 ? 2 * c : c), g2 = f2.getContext("2d");
  if (a && (g2.globalAlpha = a), g2.imageSmoothingEnabled = false !== o2, te.canUse(t2)) {
    if (n2) {
      const r3 = e2 / n2.width, i3 = s2 / n2.height;
      g2.setTransform(r3, 0, 0, i3, -n2.x * r3, -n2.y * i3), g2.drawImage(t2, 0, 0, t2.width, t2.height);
    } else g2.drawImage(t2, 0, 0, e2, s2);
    p2 && (g2.drawImage(f2, 0, 0, d2, c, u2 ? p2 - d2 : d2, u2 ? c : p2 - c, d2, c), g2.drawImage(f2, 0, 0, d2, c, u2 ? p2 : d2, u2 ? c : p2, d2, c));
  }
  return f2;
}, canUse: (t2) => t2 && t2.width && !t2.__closed, setPatternTransform(t2, e2, s2) {
  try {
    e2 && t2.setTransform && (t2.setTransform(e2), e2 = void 0);
  } catch (t3) {
  }
  s2 && _.stintSet(s2, "transform", e2);
} } };
var { image: te } = Kt;
var { randColor: ee } = M;
var se = class _se {
  constructor(t2) {
    this.repeatMap = {}, this.name = t2;
  }
  static get(t2) {
    return new _se(t2);
  }
  static set filter(t2) {
    this.filterList = re(t2);
  }
  static set exclude(t2) {
    this.excludeList = re(t2);
  }
  static drawRepaint(t2, e2) {
    const s2 = ee();
    t2.fillWorld(e2, s2.replace("1)", ".1)")), t2.strokeWorld(e2, s2);
  }
  static drawBounds(t2, e2, s2) {
    const r2 = "hit" === _se.showBounds, i2 = t2.__nowWorld, n2 = ee();
    r2 && (e2.setWorld(i2), t2.__drawHitPath(e2), e2.fillStyle = n2.replace("1)", ".2)"), e2.fill()), e2.resetTransform(), e2.setStroke(n2, 2), r2 ? e2.stroke() : e2.strokeWorld(i2, n2);
  }
  log(...t2) {
    if (ie.enable) {
      if (ie.filterList.length && ie.filterList.every((t3) => t3 !== this.name)) return;
      if (ie.excludeList.length && ie.excludeList.some((t3) => t3 === this.name)) return;
      console.log("%c" + this.name, "color:#21ae62", ...t2);
    }
  }
  tip(...t2) {
    ie.enable && this.warn(...t2);
  }
  warn(...t2) {
    ie.showWarn && console.warn(this.name, ...t2);
  }
  repeat(t2, ...e2) {
    this.repeatMap[t2] || (this.warn("repeat:" + t2, ...e2), this.repeatMap[t2] = true);
  }
  error(...t2) {
    try {
      throw new Error();
    } catch (e2) {
      console.error(this.name, ...t2, e2);
    }
  }
};
function re(t2) {
  return t2 ? i(t2) && (t2 = [t2]) : t2 = [], t2;
}
se.filterList = [], se.excludeList = [], se.showWarn = true;
var ie = se;
var ne = se.get("RunTime");
var oe = { currentId: 0, currentName: "", idMap: {}, nameMap: {}, nameToIdMap: {}, start(t2, e2) {
  const s2 = g.create(g.RUNTIME);
  return ae.currentId = ae.idMap[s2] = e2 ? performance.now() : Date.now(), ae.currentName = ae.nameMap[s2] = t2, ae.nameToIdMap[t2] = s2, s2;
}, end(t2, e2) {
  const s2 = ae.idMap[t2], r2 = ae.nameMap[t2], i2 = e2 ? (performance.now() - s2) / 1e3 : Date.now() - s2;
  ae.idMap[t2] = ae.nameMap[t2] = ae.nameToIdMap[r2] = void 0, ne.log(r2, i2, "ms");
}, endOfName(t2, e2) {
  const r2 = ae.nameToIdMap[t2];
  s(r2) || ae.end(r2, e2);
} };
var ae = oe;
var he = [];
var le = { list: {}, add(t2, ...e2) {
  this.list[t2] = true, he.push(...e2);
}, has(t2, e2) {
  const s2 = this.list[t2];
  return !s2 && e2 && this.need(t2), s2;
}, need(t2) {
  console.error("please install and import plugin: " + (t2.includes("-x") ? "" : "@leafer-in/") + t2);
} };
setTimeout(() => he.forEach((t2) => le.has(t2, true)));
var de = { editor: (t2) => le.need("editor") };
var ce = se.get("UICreator");
var ue = { list: {}, register(t2) {
  const { __tag: e2 } = t2.prototype;
  _e[e2] && ce.repeat(e2), _e[e2] = t2;
}, get(t2, e2, r2, i2, n2, o2) {
  if (!_e[t2]) return void ce.warn("not register " + t2);
  const a = new _e[t2](e2);
  return s(r2) || (a.x = r2, i2 && (a.y = i2), n2 && (a.width = n2), o2 && (a.height = o2)), a;
} };
var { list: _e } = ue;
var pe = se.get("EventCreator");
var fe = { nameList: {}, register(t2) {
  let e2;
  Object.keys(t2).forEach((s2) => {
    e2 = t2[s2], i(e2) && (ge[e2] && pe.repeat(e2), ge[e2] = t2);
  });
}, changeName(t2, e2) {
  const s2 = ge[t2];
  if (s2) {
    const r2 = Object.keys(s2).find((e3) => s2[e3] === t2);
    r2 && (s2[r2] = e2, ge[e2] = s2);
  }
}, has(t2) {
  return !!this.nameList[t2];
}, get: (t2, ...e2) => new ge[t2](...e2) };
var { nameList: ge } = fe;
var ye = class {
  constructor() {
    this.list = [];
  }
  add(t2) {
    t2.manager = this, this.list.push(t2);
  }
  get(t2) {
    let e2;
    const { list: s2 } = this;
    for (let r3 = 0, i2 = s2.length; r3 < i2; r3++) if (e2 = s2[r3], e2.recycled && e2.isSameSize(t2)) return e2.recycled = false, e2.manager || (e2.manager = this), e2;
    const r2 = de.canvas(t2);
    return this.add(r2), r2;
  }
  recycle(t2) {
    t2.recycled = true;
  }
  clearRecycled() {
    let t2;
    const e2 = [];
    for (let s2 = 0, r2 = this.list.length; s2 < r2; s2++) t2 = this.list[s2], t2.recycled ? t2.destroy() : e2.push(t2);
    this.list = e2;
  }
  clear() {
    this.list.forEach((t2) => {
      t2.destroy();
    }), this.list.length = 0;
  }
  destroy() {
    this.clear();
  }
};
function me(t2, e2, s2, r2) {
  var i2, n2 = arguments.length, o2 = n2 < 3 ? e2 : null === r2 ? r2 = Object.getOwnPropertyDescriptor(e2, s2) : r2;
  if ("object" == typeof Reflect && "function" == typeof Reflect.decorate) o2 = Reflect.decorate(t2, e2, s2, r2);
  else for (var a = t2.length - 1; a >= 0; a--) (i2 = t2[a]) && (o2 = (n2 < 3 ? i2(o2) : n2 > 3 ? i2(e2, s2, o2) : i2(e2, s2)) || o2);
  return n2 > 3 && o2 && Object.defineProperty(e2, s2, o2), o2;
}
function xe(t2, e2, s2, r2) {
  return new (s2 || (s2 = Promise))(function(i2, n2) {
    function o2(t3) {
      try {
        h(r2.next(t3));
      } catch (t4) {
        n2(t4);
      }
    }
    function a(t3) {
      try {
        h(r2.throw(t3));
      } catch (t4) {
        n2(t4);
      }
    }
    function h(t3) {
      var e3;
      t3.done ? i2(t3.value) : (e3 = t3.value, e3 instanceof s2 ? e3 : new s2(function(t4) {
        t4(e3);
      })).then(o2, a);
    }
    h((r2 = r2.apply(t2, e2 || [])).next());
  });
}
function we(t2) {
  return (e2, s2) => {
    t2 || (t2 = s2);
    const r2 = { get() {
      return this.context[t2];
    }, set(e3) {
      this.context[t2] = e3;
    } };
    "strokeCap" === s2 && (r2.set = function(e3) {
      this.context[t2] = "none" === e3 ? "butt" : e3;
    }), Object.defineProperty(e2, s2, r2);
  };
}
var be = [];
function Be() {
  return (t2, e2) => {
    be.push(e2);
  };
}
var ve = [];
var ke = class {
  set blendMode(t2) {
    "normal" === t2 && (t2 = "source-over"), this.context.globalCompositeOperation = t2;
  }
  get blendMode() {
    return this.context.globalCompositeOperation;
  }
  set dashPattern(t2) {
    this.context.setLineDash(t2 || ve);
  }
  get dashPattern() {
    return this.context.getLineDash();
  }
  __bindContext() {
    let t2;
    be.forEach((e2) => {
      t2 = this.context[e2], t2 && (this[e2] = t2.bind(this.context));
    }), this.textBaseline = "alphabetic";
  }
  setTransform(t2, e2, s2, r2, i2, n2) {
  }
  resetTransform() {
  }
  getTransform() {
  }
  save() {
  }
  restore() {
  }
  transform(t2, e2, s2, r2, i2, n2) {
    d(t2) ? this.context.transform(t2.a, t2.b, t2.c, t2.d, t2.e, t2.f) : this.context.transform(t2, e2, s2, r2, i2, n2);
  }
  translate(t2, e2) {
  }
  scale(t2, e2) {
  }
  rotate(t2) {
  }
  fill(t2, e2) {
  }
  stroke(t2) {
  }
  clip(t2, e2) {
  }
  fillRect(t2, e2, s2, r2) {
  }
  strokeRect(t2, e2, s2, r2) {
  }
  clearRect(t2, e2, s2, r2) {
  }
  drawImage(t2, e2, s2, r2, i2, n2, o2, a, h) {
    switch (arguments.length) {
      case 9:
        if (e2 < 0) {
          const t3 = -e2 / r2 * a;
          r2 += e2, e2 = 0, n2 += t3, a -= t3;
        }
        if (s2 < 0) {
          const t3 = -s2 / i2 * h;
          i2 += s2, s2 = 0, o2 += t3, h -= t3;
        }
        this.context.drawImage(t2, e2, s2, r2, i2, n2, o2, a, h);
        break;
      case 5:
        this.context.drawImage(t2, e2, s2, r2, i2);
        break;
      case 3:
        this.context.drawImage(t2, e2, s2);
    }
  }
  beginPath() {
  }
  moveTo(t2, e2) {
  }
  lineTo(t2, e2) {
  }
  bezierCurveTo(t2, e2, s2, r2, i2, n2) {
  }
  quadraticCurveTo(t2, e2, s2, r2) {
  }
  closePath() {
  }
  arc(t2, e2, s2, r2, i2, n2) {
  }
  arcTo(t2, e2, s2, r2, i2) {
  }
  ellipse(t2, e2, s2, r2, i2, n2, o2, a) {
  }
  rect(t2, e2, s2, r2) {
  }
  roundRect(t2, e2, s2, r2, i2) {
  }
  createConicGradient(t2, e2, s2) {
  }
  createLinearGradient(t2, e2, s2, r2) {
  }
  createPattern(t2, e2) {
  }
  createRadialGradient(t2, e2, s2, r2, i2, n2) {
  }
  fillText(t2, e2, s2, r2) {
  }
  measureText(t2) {
  }
  strokeText(t2, e2, s2, r2) {
  }
  destroy() {
    this.context = null;
  }
};
me([we("imageSmoothingEnabled")], ke.prototype, "smooth", void 0), me([we("imageSmoothingQuality")], ke.prototype, "smoothLevel", void 0), me([we("globalAlpha")], ke.prototype, "opacity", void 0), me([we()], ke.prototype, "fillStyle", void 0), me([we()], ke.prototype, "strokeStyle", void 0), me([we("lineWidth")], ke.prototype, "strokeWidth", void 0), me([we("lineCap")], ke.prototype, "strokeCap", void 0), me([we("lineJoin")], ke.prototype, "strokeJoin", void 0), me([we("lineDashOffset")], ke.prototype, "dashOffset", void 0), me([we()], ke.prototype, "miterLimit", void 0), me([we()], ke.prototype, "shadowBlur", void 0), me([we()], ke.prototype, "shadowColor", void 0), me([we()], ke.prototype, "shadowOffsetX", void 0), me([we()], ke.prototype, "shadowOffsetY", void 0), me([we()], ke.prototype, "filter", void 0), me([we()], ke.prototype, "font", void 0), me([we()], ke.prototype, "fontKerning", void 0), me([we()], ke.prototype, "fontStretch", void 0), me([we()], ke.prototype, "fontVariantCaps", void 0), me([we()], ke.prototype, "textAlign", void 0), me([we()], ke.prototype, "textBaseline", void 0), me([we()], ke.prototype, "textRendering", void 0), me([we()], ke.prototype, "wordSpacing", void 0), me([we()], ke.prototype, "letterSpacing", void 0), me([we()], ke.prototype, "direction", void 0), me([Be()], ke.prototype, "setTransform", null), me([Be()], ke.prototype, "resetTransform", null), me([Be()], ke.prototype, "getTransform", null), me([Be()], ke.prototype, "save", null), me([Be()], ke.prototype, "restore", null), me([Be()], ke.prototype, "translate", null), me([Be()], ke.prototype, "scale", null), me([Be()], ke.prototype, "rotate", null), me([Be()], ke.prototype, "fill", null), me([Be()], ke.prototype, "stroke", null), me([Be()], ke.prototype, "clip", null), me([Be()], ke.prototype, "fillRect", null), me([Be()], ke.prototype, "strokeRect", null), me([Be()], ke.prototype, "clearRect", null), me([Be()], ke.prototype, "beginPath", null), me([Be()], ke.prototype, "moveTo", null), me([Be()], ke.prototype, "lineTo", null), me([Be()], ke.prototype, "bezierCurveTo", null), me([Be()], ke.prototype, "quadraticCurveTo", null), me([Be()], ke.prototype, "closePath", null), me([Be()], ke.prototype, "arc", null), me([Be()], ke.prototype, "arcTo", null), me([Be()], ke.prototype, "ellipse", null), me([Be()], ke.prototype, "rect", null), me([Be()], ke.prototype, "roundRect", null), me([Be()], ke.prototype, "createConicGradient", null), me([Be()], ke.prototype, "createLinearGradient", null), me([Be()], ke.prototype, "createPattern", null), me([Be()], ke.prototype, "createRadialGradient", null), me([Be()], ke.prototype, "fillText", null), me([Be()], ke.prototype, "measureText", null), me([Be()], ke.prototype, "strokeText", null);
var { copy: Ce, multiplyParent: Oe, pixelScale: Te } = Q;
var { round: Pe } = Math;
var Se = new Ht();
var Le = new Ht();
var Re = { width: 1, height: 1, pixelRatio: 1 };
var Ee = ["width", "height", "pixelRatio"];
var Ie = class extends ke {
  get width() {
    return this.size.width;
  }
  get height() {
    return this.size.height;
  }
  get pixelRatio() {
    return this.size.pixelRatio;
  }
  get pixelWidth() {
    return this.width * this.pixelRatio || 0;
  }
  get pixelHeight() {
    return this.height * this.pixelRatio || 0;
  }
  get pixelSnap() {
    return this.config.pixelSnap;
  }
  set pixelSnap(t2) {
    this.config.pixelSnap = t2;
  }
  get allowBackgroundColor() {
    return this.view && this.parentView;
  }
  constructor(t2, e2) {
    super(), this.size = {}, this.worldTransform = {}, t2 || (t2 = Re), this.manager = e2, this.innerId = g.create(g.CNAVAS);
    const { width: s2, height: r2, pixelRatio: i2 } = t2;
    this.autoLayout = !s2 || !r2, this.size.pixelRatio = i2 || Kt.devicePixelRatio, this.config = t2, this.init();
  }
  init() {
  }
  __createContext() {
    const { view: t2 } = this, { contextSettings: e2 } = this.config;
    this.context = e2 ? t2.getContext("2d", e2) : t2.getContext("2d"), this.__bindContext();
  }
  export(t2, e2) {
  }
  toBlob(t2, e2) {
  }
  toDataURL(t2, e2) {
  }
  saveAs(t2, e2) {
  }
  resize(t2, e2 = true) {
    if (this.isSameSize(t2)) return;
    let s2;
    this.context && !this.unreal && e2 && this.width && (s2 = this.getSameCanvas(), s2.copyWorld(this));
    const r2 = this.size;
    _.copyAttrs(r2, t2, Ee), Ee.forEach((t3) => r2[t3] || (r2[t3] = 1)), this.bounds = new Ht(0, 0, this.width, this.height), this.updateViewSize(), this.updateClientBounds(), this.context && (this.smooth = this.config.smooth, !this.unreal && s2 && (this.clearWorld(s2.bounds), this.copyWorld(s2), s2.recycle()));
  }
  updateViewSize() {
  }
  updateClientBounds() {
  }
  getClientBounds(t2) {
    return t2 && this.updateClientBounds(), this.clientBounds || this.bounds;
  }
  startAutoLayout(t2, e2) {
  }
  stopAutoLayout() {
  }
  setCursor(t2) {
  }
  setWorld(t2, e2) {
    const { pixelRatio: s2, pixelSnap: r2 } = this, i2 = this.worldTransform;
    e2 && Oe(t2, e2, i2), Te(t2, s2, i2), r2 && !t2.ignorePixelSnap && (t2.half && t2.half * s2 % 2 ? (i2.e = Pe(i2.e - 0.5) + 0.5, i2.f = Pe(i2.f - 0.5) + 0.5) : (i2.e = Pe(i2.e), i2.f = Pe(i2.f))), this.setTransform(i2.a, i2.b, i2.c, i2.d, i2.e, i2.f);
  }
  useWorldTransform(t2) {
    t2 && (this.worldTransform = t2);
    const e2 = this.worldTransform;
    e2 && this.setTransform(e2.a, e2.b, e2.c, e2.d, e2.e, e2.f);
  }
  setStroke(t2, e2, s2, r2) {
    e2 && (this.strokeWidth = e2), t2 && (this.strokeStyle = t2), s2 && this.setStrokeOptions(s2, r2);
  }
  setStrokeOptions(t2, e2) {
    let { strokeCap: r2, strokeJoin: i2, dashPattern: n2, dashOffset: o2, miterLimit: a } = t2;
    e2 && (e2.strokeCap && (r2 = e2.strokeCap), e2.strokeJoin && (i2 = e2.strokeJoin), s(e2.dashPattern) || (n2 = e2.dashPattern), s(e2.dashOffset) || (o2 = e2.dashOffset), e2.miterLimit && (a = e2.miterLimit)), this.strokeCap = r2, this.strokeJoin = i2, this.dashPattern = n2, this.dashOffset = o2, this.miterLimit = a;
  }
  saveBlendMode(t2) {
    this.savedBlendMode = this.blendMode, this.blendMode = t2;
  }
  restoreBlendMode() {
    this.blendMode = this.savedBlendMode;
  }
  hitFill(t2, e2) {
    return true;
  }
  hitStroke(t2, e2) {
    return true;
  }
  hitPixel(t2, e2, s2 = 1) {
    return true;
  }
  setWorldShadow(t2, e2, s2, r2) {
    const { pixelRatio: i2 } = this;
    this.shadowOffsetX = t2 * i2, this.shadowOffsetY = e2 * i2, this.shadowBlur = s2 * i2, this.shadowColor = r2 || "black";
  }
  setWorldBlur(t2) {
    const { pixelRatio: e2 } = this;
    this.filter = `blur(${t2 * e2}px)`;
  }
  copyWorld(t2, e2, s2, r2, i2) {
    r2 && (this.blendMode = r2), e2 ? (this.setTempPixelBounds(e2, i2), s2 ? (this.setTempPixelBounds2(s2, i2), s2 = Le) : s2 = Se, this.drawImage(t2.view, Se.x, Se.y, Se.width, Se.height, s2.x, s2.y, s2.width, s2.height)) : this.drawImage(t2.view, 0, 0), r2 && (this.blendMode = "source-over");
  }
  copyWorldToInner(t2, e2, s2, r2, i2) {
    e2.b || e2.c ? (this.save(), this.resetTransform(), this.copyWorld(t2, e2, Ft.tempToOuterOf(s2, e2), r2, i2), this.restore()) : (r2 && (this.blendMode = r2), this.setTempPixelBounds(e2, i2), this.drawImage(t2.view, Se.x, Se.y, Se.width, Se.height, s2.x, s2.y, s2.width, s2.height), r2 && (this.blendMode = "source-over"));
  }
  copyWorldByReset(t2, e2, s2, r2, i2, n2) {
    this.resetTransform(), this.copyWorld(t2, e2, s2, r2, n2), i2 || this.useWorldTransform();
  }
  useGrayscaleAlpha(t2) {
    let e2, s2;
    this.setTempPixelBounds(t2, true, true);
    const { context: r2 } = this, i2 = r2.getImageData(Se.x, Se.y, Se.width, Se.height), { data: n2 } = i2;
    for (let t3 = 0, r3 = n2.length; t3 < r3; t3 += 4) s2 = 0.299 * n2[t3] + 0.587 * n2[t3 + 1] + 0.114 * n2[t3 + 2], (e2 = n2[t3 + 3]) && (n2[t3 + 3] = 255 === e2 ? s2 : e2 * (s2 / 255));
    r2.putImageData(i2, Se.x, Se.y);
  }
  useMask(t2, e2, s2) {
    this.copyWorld(t2, e2, s2, "destination-in");
  }
  useEraser(t2, e2, s2) {
    this.copyWorld(t2, e2, s2, "destination-out");
  }
  fillWorld(t2, e2, s2, r2) {
    s2 && (this.blendMode = s2), this.fillStyle = e2, this.setTempPixelBounds(t2, r2), this.fillRect(Se.x, Se.y, Se.width, Se.height), s2 && (this.blendMode = "source-over");
  }
  strokeWorld(t2, e2, s2, r2) {
    s2 && (this.blendMode = s2), this.strokeStyle = e2, this.setTempPixelBounds(t2, r2), this.strokeRect(Se.x, Se.y, Se.width, Se.height), s2 && (this.blendMode = "source-over");
  }
  clipWorld(t2, e2 = true) {
    this.beginPath(), this.setTempPixelBounds(t2, e2), this.rect(Se.x, Se.y, Se.width, Se.height), this.clip();
  }
  clipUI(t2) {
    t2.windingRule ? this.clip(t2.windingRule) : this.clip();
  }
  clearWorld(t2, e2 = true) {
    this.setTempPixelBounds(t2, e2), this.clearRect(Se.x, Se.y, Se.width, Se.height);
  }
  clear() {
    const { pixelRatio: t2 } = this;
    this.clearRect(0, 0, this.width * t2 + 2, this.height * t2 + 2);
  }
  setTempPixelBounds(t2, e2, s2) {
    this.copyToPixelBounds(Se, t2, e2, s2);
  }
  setTempPixelBounds2(t2, e2, s2) {
    this.copyToPixelBounds(Le, t2, e2, s2);
  }
  copyToPixelBounds(t2, e2, s2, r2) {
    t2.set(e2), r2 && t2.intersect(this.bounds), t2.scale(this.pixelRatio), s2 && t2.ceil();
  }
  isSameSize(t2) {
    return this.width === t2.width && this.height === t2.height && (!t2.pixelRatio || this.pixelRatio === t2.pixelRatio);
  }
  getSameCanvas(t2, e2) {
    const { size: s2, pixelSnap: r2 } = this, i2 = this.manager ? this.manager.get(s2) : de.canvas(Object.assign({}, s2));
    return i2.save(), t2 && (Ce(i2.worldTransform, this.worldTransform), i2.useWorldTransform()), e2 && (i2.smooth = this.smooth), i2.pixelSnap !== r2 && (i2.pixelSnap = r2), i2;
  }
  recycle(t2) {
    this.recycled || (this.restore(), t2 ? this.clearWorld(t2) : this.clear(), this.manager ? this.manager.recycle(this) : this.destroy());
  }
  updateRender(t2) {
  }
  unrealCanvas() {
  }
  destroy() {
    this.manager = this.view = this.parentView = null;
  }
};
var Me = { creator: {}, parse(t2, e2) {
}, convertToCanvasData(t2, e2) {
} };
var Ae = { N: 21, D: 22, X: 23, G: 24, F: 25, O: 26, P: 27, U: 28 };
var We = Object.assign({ M: 1, m: 10, L: 2, l: 20, H: 3, h: 30, V: 4, v: 40, C: 5, c: 50, S: 6, s: 60, Q: 7, q: 70, T: 8, t: 80, A: 9, a: 90, Z: 11, z: 11, R: 12 }, Ae);
var Ne = { M: 3, m: 3, L: 3, l: 3, H: 2, h: 2, V: 2, v: 2, C: 7, c: 7, S: 5, s: 5, Q: 5, q: 5, T: 3, t: 3, A: 8, a: 8, Z: 1, z: 1, N: 5, D: 9, X: 6, G: 9, F: 5, O: 7, P: 4, U: 6 };
var De = { m: 10, l: 20, H: 3, h: 30, V: 4, v: 40, c: 50, S: 6, s: 60, q: 70, T: 8, t: 80, A: 9, a: 90 };
var Ye = Object.assign(Object.assign({}, De), Ae);
var Xe = We;
var ze = {};
for (let t2 in Xe) ze[Xe[t2]] = t2;
var Fe = {};
for (let t2 in Xe) Fe[Xe[t2]] = Ne[t2];
var Ue = { drawRoundRect(t2, e2, s2, r2, i2, n2) {
  const o2 = M.fourNumber(n2, Math.min(r2 / 2, i2 / 2)), a = e2 + r2, h = s2 + i2;
  o2[0] ? t2.moveTo(e2 + o2[0], s2) : t2.moveTo(e2, s2), o2[1] ? t2.arcTo(a, s2, a, h, o2[1]) : t2.lineTo(a, s2), o2[2] ? t2.arcTo(a, h, e2, h, o2[2]) : t2.lineTo(a, h), o2[3] ? t2.arcTo(e2, h, e2, s2, o2[3]) : t2.lineTo(e2, h), o2[0] ? t2.arcTo(e2, s2, a, s2, o2[0]) : t2.lineTo(e2, s2);
} };
var { sin: je, cos: Ve, hypot: He, atan2: Ge, ceil: qe, abs: Qe, PI: Je, sqrt: Ze, pow: $e } = Math;
var { setPoint: Ke, addPoint: ts } = yt;
var { set: es, toNumberPoints: ss } = at;
var { M: rs, L: is, C: ns, Q: os, Z: as } = We;
var hs = {};
var ls = { points(t2, e2, s2, r2) {
  let i2 = ss(e2);
  if (t2.push(rs, i2[0], i2[1]), s2 && i2.length > 5) {
    let e3, n2, o2, a, h, l2, d2, c, u2, _2, p2, f2, g2, y3, m2, x2 = i2.length;
    const w2 = true === s2 ? 0.5 : s2;
    r2 && (i2 = [i2[x2 - 2], i2[x2 - 1], ...i2, i2[0], i2[1], i2[2], i2[3]], x2 = i2.length);
    for (let s3 = 2; s3 < x2 - 2; s3 += 2) e3 = i2[s3 - 2], n2 = i2[s3 - 1], o2 = i2[s3], a = i2[s3 + 1], h = i2[s3 + 2], l2 = i2[s3 + 3], p2 = o2 - e3, f2 = a - n2, g2 = Ze($e(p2, 2) + $e(f2, 2)), y3 = Ze($e(h - o2, 2) + $e(l2 - a, 2)), (g2 || y3) && (m2 = g2 + y3, g2 = w2 * g2 / m2, y3 = w2 * y3 / m2, h -= e3, l2 -= n2, d2 = o2 - g2 * h, c = a - g2 * l2, 2 === s3 ? r2 || t2.push(os, d2, c, o2, a) : (p2 || f2) && t2.push(ns, u2, _2, d2, c, o2, a), u2 = o2 + y3 * h, _2 = a + y3 * l2);
    r2 || t2.push(os, u2, _2, i2[x2 - 2], i2[x2 - 1]);
  } else for (let e3 = 2, s3 = i2.length; e3 < s3; e3 += 2) t2.push(is, i2[e3], i2[e3 + 1]);
  r2 && t2.push(as);
}, rect(t2, e2, s2, r2, i2) {
  Me.creator.path = t2, Me.creator.moveTo(e2, s2).lineTo(e2 + r2, s2).lineTo(e2 + r2, s2 + i2).lineTo(e2, s2 + i2).lineTo(e2, s2);
}, roundRect(t2, e2, s2, r2, i2, n2) {
  Me.creator.path = [], Ue.drawRoundRect(Me.creator, e2, s2, r2, i2, n2), t2.push(...Me.convertToCanvasData(Me.creator.path, true));
}, arcTo(t2, e2, s2, r2, i2, n2, o2, a, h, l2, d2) {
  const c = r2 - e2, u2 = i2 - s2, _2 = n2 - r2, p2 = o2 - i2;
  let f2 = Ge(u2, c), g2 = Ge(p2, _2);
  const y3 = He(c, u2), m2 = He(_2, p2);
  let x2 = g2 - f2;
  if (x2 < 0 && (x2 += N), y3 < 1e-12 || m2 < 1e-12 || x2 < 1e-12 || Qe(x2 - Je) < 1e-12) return t2 && t2.push(is, r2, i2), h && (Ke(h, e2, s2), ts(h, r2, i2)), d2 && es(d2, e2, s2), void (l2 && es(l2, r2, i2));
  const w2 = c * p2 - _2 * u2 < 0, b2 = w2 ? -1 : 1, B2 = a / Ve(x2 / 2), v2 = r2 + B2 * Ve(f2 + x2 / 2 + D * b2), k2 = i2 + B2 * je(f2 + x2 / 2 + D * b2);
  return f2 -= D * b2, g2 -= D * b2, us(t2, v2, k2, a, a, 0, f2 / W, g2 / W, w2, h, l2, d2);
}, arc: (t2, e2, s2, r2, i2, n2, o2, a, h, l2) => us(t2, e2, s2, r2, r2, 0, i2, n2, o2, a, h, l2), ellipse(t2, e2, s2, r2, i2, n2, o2, a, h, l2, d2, c) {
  const u2 = n2 * W, _2 = je(u2), p2 = Ve(u2);
  let f2 = o2 * W, g2 = a * W;
  f2 > Je && (f2 -= N), g2 < 0 && (g2 += N);
  let y3 = g2 - f2;
  y3 < 0 ? y3 += N : y3 > N && (y3 -= N), h && (y3 -= N);
  const m2 = qe(Qe(y3 / D)), x2 = y3 / m2, w2 = je(x2 / 4), b2 = 8 / 3 * w2 * w2 / je(x2 / 2);
  g2 = f2 + x2;
  let B2, v2, k2, C3, O2, T2, P2, S2, L2 = Ve(f2), R2 = je(f2), E2 = k2 = p2 * r2 * L2 - _2 * i2 * R2, I3 = C3 = _2 * r2 * L2 + p2 * i2 * R2, M2 = e2 + k2, A2 = s2 + C3;
  t2 && t2.push(t2.length ? is : rs, M2, A2), l2 && Ke(l2, M2, A2), c && es(c, M2, A2);
  for (let n3 = 0; n3 < m2; n3++) B2 = Ve(g2), v2 = je(g2), k2 = p2 * r2 * B2 - _2 * i2 * v2, C3 = _2 * r2 * B2 + p2 * i2 * v2, O2 = e2 + E2 - b2 * (p2 * r2 * R2 + _2 * i2 * L2), T2 = s2 + I3 - b2 * (_2 * r2 * R2 - p2 * i2 * L2), P2 = e2 + k2 + b2 * (p2 * r2 * v2 + _2 * i2 * B2), S2 = s2 + C3 + b2 * (_2 * r2 * v2 - p2 * i2 * B2), t2 && t2.push(ns, O2, T2, P2, S2, e2 + k2, s2 + C3), l2 && cs(e2 + E2, s2 + I3, O2, T2, P2, S2, e2 + k2, s2 + C3, l2, true), E2 = k2, I3 = C3, L2 = B2, R2 = v2, f2 = g2, g2 += x2;
  d2 && es(d2, e2 + k2, s2 + C3);
}, quadraticCurveTo(t2, e2, s2, r2, i2, n2, o2) {
  t2.push(ns, (e2 + 2 * r2) / 3, (s2 + 2 * i2) / 3, (n2 + 2 * r2) / 3, (o2 + 2 * i2) / 3, n2, o2);
}, toTwoPointBoundsByQuadraticCurve(t2, e2, s2, r2, i2, n2, o2, a) {
  cs(t2, e2, (t2 + 2 * s2) / 3, (e2 + 2 * r2) / 3, (i2 + 2 * s2) / 3, (n2 + 2 * r2) / 3, i2, n2, o2, a);
}, toTwoPointBounds(t2, e2, s2, r2, i2, n2, o2, a, h, l2) {
  const d2 = [];
  let c, u2, _2, p2, f2, g2, y3, m2, x2 = t2, w2 = s2, b2 = i2, B2 = o2;
  for (let t3 = 0; t3 < 2; ++t3) if (1 == t3 && (x2 = e2, w2 = r2, b2 = n2, B2 = a), c = -3 * x2 + 9 * w2 - 9 * b2 + 3 * B2, u2 = 6 * x2 - 12 * w2 + 6 * b2, _2 = 3 * w2 - 3 * x2, Math.abs(c) < 1e-12) {
    if (Math.abs(u2) < 1e-12) continue;
    p2 = -_2 / u2, 0 < p2 && p2 < 1 && d2.push(p2);
  } else y3 = u2 * u2 - 4 * _2 * c, m2 = Math.sqrt(y3), y3 < 0 || (f2 = (-u2 + m2) / (2 * c), 0 < f2 && f2 < 1 && d2.push(f2), g2 = (-u2 - m2) / (2 * c), 0 < g2 && g2 < 1 && d2.push(g2));
  l2 ? ts(h, t2, e2) : Ke(h, t2, e2), ts(h, o2, a);
  for (let l3 = 0, c2 = d2.length; l3 < c2; l3++) ds(d2[l3], t2, e2, s2, r2, i2, n2, o2, a, hs), ts(h, hs.x, hs.y);
}, getPointAndSet(t2, e2, s2, r2, i2, n2, o2, a, h, l2) {
  const d2 = 1 - t2, c = d2 * d2 * d2, u2 = 3 * d2 * d2 * t2, _2 = 3 * d2 * t2 * t2, p2 = t2 * t2 * t2;
  l2.x = c * e2 + u2 * r2 + _2 * n2 + p2 * a, l2.y = c * s2 + u2 * i2 + _2 * o2 + p2 * h;
}, getPoint(t2, e2, s2, r2, i2, n2, o2, a, h) {
  const l2 = {};
  return ds(t2, e2, s2, r2, i2, n2, o2, a, h, l2), l2;
}, getDerivative(t2, e2, s2, r2, i2) {
  const n2 = 1 - t2;
  return 3 * n2 * n2 * (s2 - e2) + 6 * n2 * t2 * (r2 - s2) + 3 * t2 * t2 * (i2 - r2);
}, cut(t2, e2, s2, r2, i2, n2, o2, a, h) {
  if (t2 <= 0) return { left: null, right: [r2, i2, n2, o2, a, h] };
  if (t2 >= 1) return { left: [r2, i2, n2, o2, a, h], right: null };
  const l2 = 1 - t2, d2 = e2 * l2 + r2 * t2, c = s2 * l2 + i2 * t2, u2 = r2 * l2 + n2 * t2, _2 = i2 * l2 + o2 * t2, p2 = n2 * l2 + a * t2, f2 = o2 * l2 + h * t2, g2 = d2 * l2 + u2 * t2, y3 = c * l2 + _2 * t2, m2 = u2 * l2 + p2 * t2, x2 = _2 * l2 + f2 * t2;
  return { left: [d2, c, g2, y3, g2 * l2 + m2 * t2, y3 * l2 + x2 * t2], right: [m2, x2, p2, f2, a, h] };
} };
var { getPointAndSet: ds, toTwoPointBounds: cs, ellipse: us } = ls;
var { sin: _s, cos: ps, sqrt: fs, atan2: gs } = Math;
var { ellipse: ys } = ls;
var ms = { ellipticalArc(t2, e2, s2, r2, i2, n2, o2, a, h, l2, d2) {
  const c = (h - e2) / 2, u2 = (l2 - s2) / 2, _2 = n2 * W, p2 = _s(_2), f2 = ps(_2), g2 = -f2 * c - p2 * u2, y3 = -f2 * u2 + p2 * c, m2 = r2 * r2, x2 = i2 * i2, w2 = y3 * y3, b2 = g2 * g2, B2 = m2 * x2 - m2 * w2 - x2 * b2;
  let v2 = 0;
  if (B2 < 0) {
    const t3 = fs(1 - B2 / (m2 * x2));
    r2 *= t3, i2 *= t3;
  } else v2 = (o2 === a ? -1 : 1) * fs(B2 / (m2 * w2 + x2 * b2));
  const k2 = v2 * r2 * y3 / i2, C3 = -v2 * i2 * g2 / r2, O2 = gs((y3 - C3) / i2, (g2 - k2) / r2), T2 = gs((-y3 - C3) / i2, (-g2 - k2) / r2);
  let P2 = T2 - O2;
  0 === a && P2 > 0 ? P2 -= N : 1 === a && P2 < 0 && (P2 += N);
  const S2 = e2 + c + f2 * k2 - p2 * C3, L2 = s2 + u2 + p2 * k2 + f2 * C3, R2 = P2 < 0 ? 1 : 0;
  d2 || Kt.ellipseToCurve ? ys(t2, S2, L2, r2, i2, n2, O2 / W, T2 / W, R2) : r2 !== i2 || n2 ? t2.push(We.G, S2, L2, r2, i2, n2, O2 / W, T2 / W, R2) : t2.push(We.O, S2, L2, r2, O2 / W, T2 / W, R2);
} };
var xs = { toCommand: (t2) => [], toNode: (t2) => [] };
var { M: ws, m: bs, L: Bs, l: vs, H: ks, h: Cs, V: Os, v: Ts, C: Ps, c: Ss, S: Ls, s: Rs, Q: Es, q: Is, T: Ms, t: As, A: Ws, a: Ns, Z: Ds, z: Ys, N: Xs, D: zs, X: Fs, G: Us, F: js, O: Vs, P: Hs, U: Gs } = We;
var { rect: qs, roundRect: Qs, arcTo: Js, arc: Zs, ellipse: $s, quadraticCurveTo: Ks } = ls;
var { ellipticalArc: tr } = ms;
var er = se.get("PathConvert");
var sr = {};
var rr = { current: { dot: 0 }, stringify(t2, e2) {
  let s2, r2, i2, n2 = 0, o2 = t2.length, a = "";
  for (; n2 < o2; ) {
    r2 = t2[n2], s2 = Fe[r2], a += r2 === i2 ? " " : ze[r2];
    for (let r3 = 1; r3 < s2; r3++) a += M.float(t2[n2 + r3], e2), r3 === s2 - 1 || (a += " ");
    i2 = r2, n2 += s2;
  }
  return a;
}, parse(t2, e2) {
  let s2, r2, i2, n2 = "";
  const o2 = [], a = e2 ? Ye : De;
  for (let e3 = 0, h = t2.length; e3 < h; e3++) r2 = t2[e3], Jt[r2] ? ("." === r2 && (ir.dot && (nr(o2, n2), n2 = ""), ir.dot++), "0" === n2 && "." !== r2 && (nr(o2, n2), n2 = ""), n2 += r2) : We[r2] ? (n2 && (nr(o2, n2), n2 = ""), ir.name = We[r2], ir.length = Ne[r2], ir.index = 0, nr(o2, ir.name), !s2 && a[r2] && (s2 = true)) : "-" === r2 || "+" === r2 ? "e" === i2 || "E" === i2 ? n2 += r2 : (n2 && nr(o2, n2), n2 = r2) : n2 && (nr(o2, n2), n2 = ""), i2 = r2;
  return n2 && nr(o2, n2), s2 ? rr.toCanvasData(o2, e2) : o2;
}, toCanvasData(t2, e2) {
  let s2, r2, i2, n2, o2, a = 0, h = 0, l2 = 0, d2 = 0, c = 0, u2 = t2.length;
  const _2 = [];
  for (; c < u2; ) {
    switch (i2 = t2[c], i2) {
      case bs:
        t2[c + 1] += a, t2[c + 2] += h;
      case ws:
        a = t2[c + 1], h = t2[c + 2], _2.push(ws, a, h), c += 3;
        break;
      case Cs:
        t2[c + 1] += a;
      case ks:
        a = t2[c + 1], _2.push(Bs, a, h), c += 2;
        break;
      case Ts:
        t2[c + 1] += h;
      case Os:
        h = t2[c + 1], _2.push(Bs, a, h), c += 2;
        break;
      case vs:
        t2[c + 1] += a, t2[c + 2] += h;
      case Bs:
        a = t2[c + 1], h = t2[c + 2], _2.push(Bs, a, h), c += 3;
        break;
      case Rs:
        t2[c + 1] += a, t2[c + 2] += h, t2[c + 3] += a, t2[c + 4] += h, i2 = Ls;
      case Ls:
        o2 = n2 === Ps || n2 === Ls, l2 = o2 ? 2 * a - s2 : t2[c + 1], d2 = o2 ? 2 * h - r2 : t2[c + 2], s2 = t2[c + 1], r2 = t2[c + 2], a = t2[c + 3], h = t2[c + 4], _2.push(Ps, l2, d2, s2, r2, a, h), c += 5;
        break;
      case Ss:
        t2[c + 1] += a, t2[c + 2] += h, t2[c + 3] += a, t2[c + 4] += h, t2[c + 5] += a, t2[c + 6] += h, i2 = Ps;
      case Ps:
        s2 = t2[c + 3], r2 = t2[c + 4], a = t2[c + 5], h = t2[c + 6], _2.push(Ps, t2[c + 1], t2[c + 2], s2, r2, a, h), c += 7;
        break;
      case As:
        t2[c + 1] += a, t2[c + 2] += h, i2 = Ms;
      case Ms:
        o2 = n2 === Es || n2 === Ms, s2 = o2 ? 2 * a - s2 : t2[c + 1], r2 = o2 ? 2 * h - r2 : t2[c + 2], e2 ? Ks(_2, a, h, s2, r2, t2[c + 1], t2[c + 2]) : _2.push(Es, s2, r2, t2[c + 1], t2[c + 2]), a = t2[c + 1], h = t2[c + 2], c += 3;
        break;
      case Is:
        t2[c + 1] += a, t2[c + 2] += h, t2[c + 3] += a, t2[c + 4] += h, i2 = Es;
      case Es:
        s2 = t2[c + 1], r2 = t2[c + 2], e2 ? Ks(_2, a, h, s2, r2, t2[c + 3], t2[c + 4]) : _2.push(Es, s2, r2, t2[c + 3], t2[c + 4]), a = t2[c + 3], h = t2[c + 4], c += 5;
        break;
      case Ns:
        t2[c + 6] += a, t2[c + 7] += h;
      case Ws:
        tr(_2, a, h, t2[c + 1], t2[c + 2], t2[c + 3], t2[c + 4], t2[c + 5], t2[c + 6], t2[c + 7], e2), a = t2[c + 6], h = t2[c + 7], c += 8;
        break;
      case Ys:
      case Ds:
        _2.push(Ds), c++;
        break;
      case Xs:
        a = t2[c + 1], h = t2[c + 2], e2 ? qs(_2, a, h, t2[c + 3], t2[c + 4]) : or(_2, t2, c, 5), c += 5;
        break;
      case zs:
        a = t2[c + 1], h = t2[c + 2], e2 ? Qs(_2, a, h, t2[c + 3], t2[c + 4], [t2[c + 5], t2[c + 6], t2[c + 7], t2[c + 8]]) : or(_2, t2, c, 9), c += 9;
        break;
      case Fs:
        a = t2[c + 1], h = t2[c + 2], e2 ? Qs(_2, a, h, t2[c + 3], t2[c + 4], t2[c + 5]) : or(_2, t2, c, 6), c += 6;
        break;
      case Us:
        $s(e2 ? _2 : or(_2, t2, c, 9), t2[c + 1], t2[c + 2], t2[c + 3], t2[c + 4], t2[c + 5], t2[c + 6], t2[c + 7], t2[c + 8], null, sr), a = sr.x, h = sr.y, c += 9;
        break;
      case js:
        e2 ? $s(_2, t2[c + 1], t2[c + 2], t2[c + 3], t2[c + 4], 0, 0, 360, false) : or(_2, t2, c, 5), a = t2[c + 1] + t2[c + 3], h = t2[c + 2], c += 5;
        break;
      case Vs:
        Zs(e2 ? _2 : or(_2, t2, c, 7), t2[c + 1], t2[c + 2], t2[c + 3], t2[c + 4], t2[c + 5], t2[c + 6], null, sr), a = sr.x, h = sr.y, c += 7;
        break;
      case Hs:
        e2 ? Zs(_2, t2[c + 1], t2[c + 2], t2[c + 3], 0, 360, false) : or(_2, t2, c, 4), a = t2[c + 1] + t2[c + 3], h = t2[c + 2], c += 4;
        break;
      case Gs:
        Js(e2 ? _2 : or(_2, t2, c, 6), a, h, t2[c + 1], t2[c + 2], t2[c + 3], t2[c + 4], t2[c + 5], null, sr), a = sr.x, h = sr.y, c += 6;
        break;
      default:
        return er.error(`command: ${i2} [index:${c}]`, t2), _2;
    }
    n2 = i2;
  }
  return _2;
}, objectToCanvasData(t2) {
  if (t2[0].name.length > 1) return xs.toCommand(t2);
  {
    const e2 = [];
    return t2.forEach((t3) => {
      switch (t3.name) {
        case "M":
          e2.push(ws, t3.x, t3.y);
          break;
        case "L":
          e2.push(Bs, t3.x, t3.y);
          break;
        case "C":
          e2.push(Ps, t3.x1, t3.y1, t3.x2, t3.y2, t3.x, t3.y);
          break;
        case "Q":
          e2.push(Es, t3.x1, t3.y1, t3.x, t3.y);
          break;
        case "Z":
          e2.push(Ds);
      }
    }), e2;
  }
}, copyData(t2, e2, s2, r2) {
  for (let i2 = s2, n2 = s2 + r2; i2 < n2; i2++) t2.push(e2[i2]);
}, pushData(t2, e2) {
  ir.index === ir.length && (ir.index = 1, t2.push(ir.name)), t2.push(Number(e2)), ir.index++, ir.dot = 0;
} };
var { current: ir, pushData: nr, copyData: or } = rr;
var { M: ar, L: hr, C: lr, Q: dr, Z: cr, N: ur, D: _r, X: pr, G: fr, F: gr, O: yr, P: mr, U: xr } = We;
var { getMinDistanceFrom: wr, getRadianFrom: br } = at;
var { tan: Br, min: vr, abs: kr } = Math;
var Cr = {};
var Or = { beginPath(t2) {
  t2.length = 0;
}, moveTo(t2, e2, s2) {
  t2.push(ar, e2, s2);
}, lineTo(t2, e2, s2) {
  t2.push(hr, e2, s2);
}, bezierCurveTo(t2, e2, s2, r2, i2, n2, o2) {
  t2.push(lr, e2, s2, r2, i2, n2, o2);
}, quadraticCurveTo(t2, e2, s2, r2, i2) {
  t2.push(dr, e2, s2, r2, i2);
}, closePath(t2) {
  t2.push(cr);
}, rect(t2, e2, s2, r2, i2) {
  t2.push(ur, e2, s2, r2, i2);
}, roundRect(t2, e2, s2, r2, i2, n2) {
  if (o(n2)) t2.push(pr, e2, s2, r2, i2, n2);
  else {
    const o2 = M.fourNumber(n2);
    o2 ? t2.push(_r, e2, s2, r2, i2, ...o2) : t2.push(ur, e2, s2, r2, i2);
  }
}, ellipse(t2, e2, s2, i2, n2, o2, a, h, l2) {
  if (i2 === n2) return Pr(t2, e2, s2, i2, a, h, l2);
  r(o2) ? t2.push(gr, e2, s2, i2, n2) : (r(a) && (a = 0), r(h) && (h = 360), t2.push(fr, e2, s2, i2, n2, o2, a, h, l2 ? 1 : 0));
}, arc(t2, e2, s2, i2, n2, o2, a) {
  r(n2) ? t2.push(mr, e2, s2, i2) : (r(n2) && (n2 = 0), r(o2) && (o2 = 360), t2.push(yr, e2, s2, i2, n2, o2, a ? 1 : 0));
}, arcTo(t2, e2, r2, i2, n2, o2, a, h, l2) {
  if (!s(a)) {
    const t3 = wr(a, h, e2, r2, i2, n2) / (l2 ? 1 : 2);
    o2 = vr(o2, vr(t3, t3 * kr(Br(br(a, h, e2, r2, i2, n2) / 2))));
  }
  t2.push(xr, e2, r2, i2, n2, o2);
}, drawEllipse(t2, e2, s2, i2, n2, o2, a, h, l2) {
  ls.ellipse(null, e2, s2, i2, n2, r(o2) ? 0 : o2, r(a) ? 0 : a, r(h) ? 360 : h, l2, null, null, Cr), t2.push(ar, Cr.x, Cr.y), Tr(t2, e2, s2, i2, n2, o2, a, h, l2);
}, drawArc(t2, e2, s2, i2, n2, o2, a) {
  ls.arc(null, e2, s2, i2, r(n2) ? 0 : n2, r(o2) ? 360 : o2, a, null, null, Cr), t2.push(ar, Cr.x, Cr.y), Pr(t2, e2, s2, i2, n2, o2, a);
}, drawPoints(t2, e2, s2, r2) {
  ls.points(t2, e2, s2, r2);
} };
var { ellipse: Tr, arc: Pr } = Or;
var { moveTo: Sr, lineTo: Lr, quadraticCurveTo: Rr, bezierCurveTo: Er, closePath: Ir, beginPath: Mr, rect: Ar, roundRect: Wr, ellipse: Nr, arc: Dr, arcTo: Yr, drawEllipse: Xr, drawArc: zr, drawPoints: Fr } = Or;
var Ur = class {
  set path(t2) {
    this.__path = t2;
  }
  get path() {
    return this.__path;
  }
  constructor(t2) {
    this.set(t2);
  }
  set(t2) {
    return this.__path = t2 ? i(t2) ? Me.parse(t2) : t2 : [], this;
  }
  beginPath() {
    return Mr(this.__path), this.paint(), this;
  }
  moveTo(t2, e2) {
    return Sr(this.__path, t2, e2), this.paint(), this;
  }
  lineTo(t2, e2) {
    return Lr(this.__path, t2, e2), this.paint(), this;
  }
  bezierCurveTo(t2, e2, s2, r2, i2, n2) {
    return Er(this.__path, t2, e2, s2, r2, i2, n2), this.paint(), this;
  }
  quadraticCurveTo(t2, e2, s2, r2) {
    return Rr(this.__path, t2, e2, s2, r2), this.paint(), this;
  }
  closePath() {
    return Ir(this.__path), this.paint(), this;
  }
  rect(t2, e2, s2, r2) {
    return Ar(this.__path, t2, e2, s2, r2), this.paint(), this;
  }
  roundRect(t2, e2, s2, r2, i2) {
    return Wr(this.__path, t2, e2, s2, r2, i2), this.paint(), this;
  }
  ellipse(t2, e2, s2, r2, i2, n2, o2, a) {
    return Nr(this.__path, t2, e2, s2, r2, i2, n2, o2, a), this.paint(), this;
  }
  arc(t2, e2, s2, r2, i2, n2) {
    return Dr(this.__path, t2, e2, s2, r2, i2, n2), this.paint(), this;
  }
  arcTo(t2, e2, s2, r2, i2) {
    return Yr(this.__path, t2, e2, s2, r2, i2), this.paint(), this;
  }
  drawEllipse(t2, e2, s2, r2, i2, n2, o2, a) {
    return Xr(this.__path, t2, e2, s2, r2, i2, n2, o2, a), this.paint(), this;
  }
  drawArc(t2, e2, s2, r2, i2, n2) {
    return zr(this.__path, t2, e2, s2, r2, i2, n2), this.paint(), this;
  }
  drawPoints(t2, e2, s2) {
    return Fr(this.__path, t2, e2, s2), this.paint(), this;
  }
  clearPath() {
    return this.beginPath();
  }
  paint() {
  }
};
var { M: jr, L: Vr, C: Hr, Q: Gr, Z: qr, N: Qr, D: Jr, X: Zr, G: $r, F: Kr, O: ti, P: ei, U: si } = We;
var ri = se.get("PathDrawer");
var ii = { drawPathByData(t2, e2) {
  if (!e2) return;
  let s2, r2 = 0, i2 = e2.length;
  for (; r2 < i2; ) switch (s2 = e2[r2], s2) {
    case jr:
      t2.moveTo(e2[r2 + 1], e2[r2 + 2]), r2 += 3;
      break;
    case Vr:
      t2.lineTo(e2[r2 + 1], e2[r2 + 2]), r2 += 3;
      break;
    case Hr:
      t2.bezierCurveTo(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], e2[r2 + 5], e2[r2 + 6]), r2 += 7;
      break;
    case Gr:
      t2.quadraticCurveTo(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4]), r2 += 5;
      break;
    case qr:
      t2.closePath(), r2 += 1;
      break;
    case Qr:
      t2.rect(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4]), r2 += 5;
      break;
    case Jr:
      t2.roundRect(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], [e2[r2 + 5], e2[r2 + 6], e2[r2 + 7], e2[r2 + 8]]), r2 += 9;
      break;
    case Zr:
      t2.roundRect(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], e2[r2 + 5]), r2 += 6;
      break;
    case $r:
      t2.ellipse(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], e2[r2 + 5] * W, e2[r2 + 6] * W, e2[r2 + 7] * W, e2[r2 + 8]), r2 += 9;
      break;
    case Kr:
      t2.ellipse(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], 0, 0, N, false), r2 += 5;
      break;
    case ti:
      t2.arc(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4] * W, e2[r2 + 5] * W, e2[r2 + 6]), r2 += 7;
      break;
    case ei:
      t2.arc(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], 0, N, false), r2 += 4;
      break;
    case si:
      t2.arcTo(e2[r2 + 1], e2[r2 + 2], e2[r2 + 3], e2[r2 + 4], e2[r2 + 5]), r2 += 6;
      break;
    default:
      return void ri.error(`command: ${s2} [index:${r2}]`, e2);
  }
} };
var { M: ni, L: oi, C: ai, Q: hi, Z: li, N: di, D: ci, X: ui, G: _i, F: pi, O: fi, P: gi, U: yi } = We;
var { toTwoPointBounds: mi, toTwoPointBoundsByQuadraticCurve: xi, arcTo: wi, arc: bi, ellipse: Bi } = ls;
var { addPointBounds: vi, copy: ki, addPoint: Ci, setPoint: Oi, addBounds: Ti, toBounds: Pi } = yt;
var Si = se.get("PathBounds");
var Li;
var Ri;
var Ei;
var Ii = {};
var Mi = {};
var Ai = {};
var Wi = { toBounds(t2, e2) {
  Wi.toTwoPointBounds(t2, Mi), Pi(Mi, e2);
}, toTwoPointBounds(t2, e2) {
  if (!t2 || !t2.length) return Oi(e2, 0, 0);
  let s2, r2, i2, n2, o2, a = 0, h = 0, l2 = 0;
  const d2 = t2.length;
  for (; a < d2; ) switch (o2 = t2[a], 0 === a && (o2 === li || o2 === ai || o2 === hi ? Oi(e2, h, l2) : Oi(e2, t2[a + 1], t2[a + 2])), o2) {
    case ni:
    case oi:
      h = t2[a + 1], l2 = t2[a + 2], Ci(e2, h, l2), a += 3;
      break;
    case ai:
      i2 = t2[a + 5], n2 = t2[a + 6], mi(h, l2, t2[a + 1], t2[a + 2], t2[a + 3], t2[a + 4], i2, n2, Ii), vi(e2, Ii), h = i2, l2 = n2, a += 7;
      break;
    case hi:
      s2 = t2[a + 1], r2 = t2[a + 2], i2 = t2[a + 3], n2 = t2[a + 4], xi(h, l2, s2, r2, i2, n2, Ii), vi(e2, Ii), h = i2, l2 = n2, a += 5;
      break;
    case li:
      a += 1;
      break;
    case di:
      h = t2[a + 1], l2 = t2[a + 2], Ti(e2, h, l2, t2[a + 3], t2[a + 4]), a += 5;
      break;
    case ci:
    case ui:
      h = t2[a + 1], l2 = t2[a + 2], Ti(e2, h, l2, t2[a + 3], t2[a + 4]), a += o2 === ci ? 9 : 6;
      break;
    case _i:
      Bi(null, t2[a + 1], t2[a + 2], t2[a + 3], t2[a + 4], t2[a + 5], t2[a + 6], t2[a + 7], t2[a + 8], Ii, Ai), 0 === a ? ki(e2, Ii) : vi(e2, Ii), h = Ai.x, l2 = Ai.y, a += 9;
      break;
    case pi:
      h = t2[a + 1], l2 = t2[a + 2], Ri = t2[a + 3], Ei = t2[a + 4], Ti(e2, h - Ri, l2 - Ei, 2 * Ri, 2 * Ei), h += Ri, a += 5;
      break;
    case fi:
      bi(null, t2[a + 1], t2[a + 2], t2[a + 3], t2[a + 4], t2[a + 5], t2[a + 6], Ii, Ai), 0 === a ? ki(e2, Ii) : vi(e2, Ii), h = Ai.x, l2 = Ai.y, a += 7;
      break;
    case gi:
      h = t2[a + 1], l2 = t2[a + 2], Li = t2[a + 3], Ti(e2, h - Li, l2 - Li, 2 * Li, 2 * Li), h += Li, a += 4;
      break;
    case yi:
      wi(null, h, l2, t2[a + 1], t2[a + 2], t2[a + 3], t2[a + 4], t2[a + 5], Ii, Ai), 0 === a ? ki(e2, Ii) : vi(e2, Ii), h = Ai.x, l2 = Ai.y, a += 6;
      break;
    default:
      return void Si.error(`command: ${o2} [index:${a}]`, t2);
  }
} };
var { M: Ni, L: Di, Z: Yi } = We;
var { getCenterX: Xi, getCenterY: zi } = at;
var { arcTo: Fi } = Or;
var Ui = { smooth(t2, e2, s2) {
  let r2, i2, n2, o2 = 0, a = 0, h = 0, d2 = 0, c = 0, u2 = 0, _2 = 0, p2 = 0, f2 = 0;
  l(e2) && (e2 = e2[0] || 0);
  const g2 = t2.length, y3 = 9 === g2, m2 = [];
  for (; o2 < g2; ) {
    switch (r2 = t2[o2], r2) {
      case Ni:
        d2 = p2 = t2[o2 + 1], c = f2 = t2[o2 + 2], o2 += 3, t2[o2] === Di ? (u2 = t2[o2 + 1], _2 = t2[o2 + 2], y3 ? m2.push(Ni, d2, c) : m2.push(Ni, Xi(d2, u2), zi(c, _2))) : m2.push(Ni, d2, c);
        break;
      case Di:
        switch (a = t2[o2 + 1], h = t2[o2 + 2], o2 += 3, t2[o2]) {
          case Di:
            Fi(m2, a, h, t2[o2 + 1], t2[o2 + 2], e2, p2, f2, y3);
            break;
          case Yi:
            Fi(m2, a, h, d2, c, e2, p2, f2, y3);
            break;
          default:
            m2.push(Di, a, h);
        }
        p2 = a, f2 = h;
        break;
      case Yi:
        i2 !== Yi && (Fi(m2, d2, c, u2, _2, e2, p2, f2, y3), m2.push(Yi)), o2 += 1;
        break;
      default:
        n2 = Fe[r2];
        for (let e3 = 0; e3 < n2; e3++) m2.push(t2[o2 + e3]);
        o2 += n2;
    }
    i2 = r2;
  }
  return r2 !== Yi && (m2[1] = d2, m2[2] = c), m2;
} };
function ji(t2) {
  return new Ur(t2);
}
var Vi = ji();
Me.creator = ji(), Me.parse = rr.parse, Me.convertToCanvasData = rr.toCanvasData;
var { drawRoundRect: Hi } = Ue;
function Gi(t2) {
  !(function(t3) {
    t3 && !t3.roundRect && (t3.roundRect = function(t4, e2, s2, r2, i2) {
      Hi(this, t4, e2, s2, r2, i2);
    });
  })(t2);
}
var qi = { alphaPixelTypes: ["png", "webp", "svg"], upperCaseTypeMap: {}, mimeType: (t2, e2 = "image") => !t2 || t2.startsWith(e2) ? t2 : ("jpg" === t2 && (t2 = "jpeg"), e2 + "/" + t2), fileType(t2) {
  const e2 = t2.split(".");
  return e2[e2.length - 1];
}, isOpaqueImage(t2) {
  const e2 = Qi.fileType(t2);
  return ["jpg", "jpeg"].some((t3) => t3 === e2);
}, getExportOptions(t2) {
  switch (typeof t2) {
    case "object":
      return t2;
    case "number":
      return { quality: t2 };
    case "boolean":
      return { blob: t2 };
    default:
      return {};
  }
} };
var Qi = qi;
Qi.mineType = Qi.mimeType, Qi.alphaPixelTypes.forEach((t2) => Qi.upperCaseTypeMap[t2] = t2.toUpperCase());
var Ji = se.get("TaskProcessor");
var Zi = class {
  constructor(t2) {
    this.parallel = true, this.time = 1, this.id = g.create(g.TASK), this.task = t2;
  }
  run() {
    return xe(this, void 0, void 0, function* () {
      try {
        if (this.isComplete || this.runing) return;
        if (this.runing = true, this.canUse && !this.canUse()) return this.cancel();
        this.task && (yield this.task());
      } catch (t2) {
        Ji.error(t2);
      }
    });
  }
  complete() {
    this.isComplete = true, this.parent = this.task = this.canUse = null;
  }
  cancel() {
    this.isCancel = true, this.complete();
  }
};
var $i = class {
  get total() {
    return this.list.length + this.delayNumber;
  }
  get finishedIndex() {
    return this.isComplete ? 0 : this.index + this.parallelSuccessNumber;
  }
  get remain() {
    return this.isComplete ? this.total : this.total - this.finishedIndex;
  }
  get percent() {
    const { total: t2 } = this;
    let e2 = 0, s2 = 0;
    for (let r2 = 0; r2 < t2; r2++) r2 <= this.finishedIndex ? (s2 += this.list[r2].time, r2 === this.finishedIndex && (e2 = s2)) : e2 += this.list[r2].time;
    return this.isComplete ? 1 : s2 / e2;
  }
  constructor(t2) {
    this.config = { parallel: 6 }, this.list = [], this.running = false, this.isComplete = true, this.index = 0, this.delayNumber = 0, t2 && _.assign(this.config, t2), this.empty();
  }
  add(t2, e2, r2) {
    let i2, n2, a, h;
    const l2 = new Zi(t2);
    return l2.parent = this, o(e2) ? h = e2 : e2 && (n2 = e2.parallel, i2 = e2.start, a = e2.time, h = e2.delay, r2 || (r2 = e2.canUse)), a && (l2.time = a), false === n2 && (l2.parallel = false), r2 && (l2.canUse = r2), s(h) ? this.push(l2, i2) : (this.delayNumber++, setTimeout(() => {
      this.delayNumber && (this.delayNumber--, this.push(l2, i2));
    }, h)), this.isComplete = false, l2;
  }
  push(t2, e2) {
    this.list.push(t2), false === e2 || this.timer || (this.timer = setTimeout(() => this.start()));
  }
  empty() {
    this.index = 0, this.parallelSuccessNumber = 0, this.list = [], this.parallelList = [], this.delayNumber = 0;
  }
  start() {
    this.running || (this.running = true, this.isComplete = false, this.run());
  }
  pause() {
    clearTimeout(this.timer), this.timer = null, this.running = false;
  }
  resume() {
    this.start();
  }
  skip() {
    this.index++, this.resume();
  }
  stop() {
    this.isComplete = true, this.list.forEach((t2) => {
      t2.isComplete || t2.run();
    }), this.pause(), this.empty();
  }
  run() {
    this.running && (this.setParallelList(), this.parallelList.length > 1 ? this.runParallelTasks() : this.remain ? this.runTask() : this.onComplete());
  }
  runTask() {
    const t2 = this.list[this.index];
    t2 ? t2.run().then(() => {
      this.onTask(t2), this.index++, t2.isCancel ? this.runTask() : this.nextTask();
    }).catch((t3) => {
      this.onError(t3);
    }) : this.timer = setTimeout(() => this.nextTask());
  }
  runParallelTasks() {
    this.parallelList.forEach((t2) => this.runParallelTask(t2));
  }
  runParallelTask(t2) {
    t2.run().then(() => {
      this.onTask(t2), this.fillParallelTask();
    }).catch((t3) => {
      this.onParallelError(t3);
    });
  }
  nextTask() {
    this.total === this.finishedIndex ? this.onComplete() : this.timer = setTimeout(() => this.run());
  }
  setParallelList() {
    let t2;
    const { config: e2, list: s2, index: r2 } = this;
    this.parallelList = [], this.parallelSuccessNumber = 0;
    let i2 = r2 + e2.parallel;
    if (i2 > s2.length && (i2 = s2.length), e2.parallel > 1) for (let e3 = r2; e3 < i2 && (t2 = s2[e3], t2.parallel); e3++) this.parallelList.push(t2);
  }
  fillParallelTask() {
    let t2;
    const e2 = this.parallelList;
    this.parallelSuccessNumber++, e2.pop();
    const s2 = e2.length, r2 = this.finishedIndex + s2;
    if (e2.length) {
      if (!this.running) return;
      r2 < this.total && (t2 = this.list[r2], t2 && t2.parallel && (e2.push(t2), this.runParallelTask(t2)));
    } else this.index += this.parallelSuccessNumber, this.parallelSuccessNumber = 0, this.nextTask();
  }
  onComplete() {
    this.stop(), this.config.onComplete && this.config.onComplete();
  }
  onTask(t2) {
    t2.complete(), this.config.onTask && this.config.onTask();
  }
  onParallelError(t2) {
    this.parallelList.forEach((t3) => {
      t3.parallel = false;
    }), this.parallelList.length = 0, this.parallelSuccessNumber = 0, this.onError(t2);
  }
  onError(t2) {
    this.pause(), this.config.onError && this.config.onError(t2);
  }
  destroy() {
    this.stop();
  }
};
var Ki = se.get("Resource");
var tn = { tasker: new $i(), queue: new $i({ parallel: 1 }), map: {}, get isComplete() {
  return en.tasker.isComplete;
}, set(t2, e2) {
  en.map[t2] && Ki.repeat(t2), en.map[t2] = e2;
}, get: (t2) => en.map[t2], remove(t2) {
  const e2 = en.map[t2];
  e2 && (e2.destroy && e2.destroy(), delete en.map[t2]);
}, loadImage(t2, e2) {
  return new Promise((s2, r2) => {
    const i2 = this.setImage(t2, t2, e2);
    i2.load(() => s2(i2), (t3) => r2(t3));
  });
}, setImage(t2, e2, s2) {
  let r2;
  return i(e2) ? r2 = { url: e2 } : e2.url || (r2 = { url: t2, view: e2 }), r2 && (s2 && (r2.format = s2), e2 = de.image(r2)), en.set(t2, e2), e2;
}, loadFilm(t2, e2) {
}, loadVideo(t2, e2) {
}, destroy() {
  en.map = {};
} };
var en = tn;
var sn = { maxRecycled: 10, recycledList: [], patternTasker: tn.queue, get(t2, e2) {
  let s2 = tn.get(t2.url);
  return s2 || tn.set(t2.url, s2 = "film" === e2 ? de.film(t2) : de.image(t2)), s2.use++, s2;
}, recycle(t2) {
  t2.parent && (t2 = t2.parent), t2.use--, setTimeout(() => {
    t2.use || (Kt.image.isLarge(t2) ? t2.url && tn.remove(t2.url) : (t2.clearLevels(), rn.recycledList.push(t2)));
  });
}, recyclePaint(t2) {
  rn.recycle(t2.image);
}, clearRecycled(t2) {
  const e2 = rn.recycledList;
  (e2.length > rn.maxRecycled || t2) && (e2.forEach((e3) => (!e3.use || t2) && e3.url && tn.remove(e3.url)), e2.length = 0);
}, clearLevels() {
}, hasAlphaPixel: (t2) => qi.alphaPixelTypes.some((e2) => rn.isFormat(e2, t2)), isFormat(t2, e2) {
  if (e2.format) return e2.format === t2;
  const { url: s2 } = e2;
  if (s2.startsWith("data:")) {
    if (s2.startsWith("data:" + qi.mimeType(t2))) return true;
  } else {
    if (s2.includes("." + t2) || s2.includes("." + qi.upperCaseTypeMap[t2])) return true;
    if ("png" === t2 && !s2.includes(".")) return true;
  }
  return false;
}, destroy() {
  this.clearRecycled(true);
} };
var rn = sn;
var { IMAGE: nn, create: on } = g;
var an = class {
  get tag() {
    return "Image";
  }
  get url() {
    return this.config.url;
  }
  get crossOrigin() {
    const { crossOrigin: t2 } = this.config;
    return s(t2) ? Kt.image.crossOrigin : t2;
  }
  get completed() {
    return this.ready || !!this.error;
  }
  constructor(t2) {
    if (this.use = 0, this.waitComplete = [], this.innerId = on(nn), this.config = t2 || (t2 = { url: "" }), t2.view) {
      const { view: e2 } = t2;
      this.setView(e2.config ? e2.view : e2);
    }
    sn.isFormat("svg", t2) && (this.isSVG = true), sn.hasAlphaPixel(t2) && (this.hasAlphaPixel = true);
  }
  load(t2, e2, s2) {
    return this.loading || (this.loading = true, tn.tasker.add(() => xe(this, void 0, void 0, function* () {
      return yield Kt.origin["load" + this.tag](this.getLoadUrl(s2), this.crossOrigin, this).then((t3) => {
        s2 && this.setThumbView(t3), this.setView(t3);
      }).catch((t3) => {
        this.error = t3, this.onComplete(false);
      });
    }))), this.waitComplete.push(t2, e2), this.waitComplete.length - 2;
  }
  unload(t2, e2) {
    const s2 = this.waitComplete;
    if (e2) {
      const e3 = s2[t2 + 1];
      e3 && e3({ type: "stop" });
    }
    s2[t2] = s2[t2 + 1] = void 0;
  }
  setView(t2) {
    this.ready = true, this.width || (this.width = t2.width, this.height = t2.height, this.view = t2), this.onComplete(true);
  }
  onComplete(t2) {
    let e2;
    this.waitComplete.forEach((s2, r2) => {
      e2 = r2 % 2, s2 && (t2 ? e2 || s2(this) : e2 && s2(this.error));
    }), this.waitComplete.length = 0, this.loading = false;
  }
  getFull(t2) {
    return this.view;
  }
  getCanvas(t2, e2, s2, r2, i2, n2, o2, a) {
    if (t2 || (t2 = this.width), e2 || (e2 = this.height), this.cache) {
      let { params: t3, data: e3 } = this.cache;
      for (let s3 in t3) if (t3[s3] !== arguments[s3]) {
        e3 = null;
        break;
      }
      if (e3) return e3;
    }
    const h = Kt.image.resize(this.view, t2, e2, i2, n2, void 0, o2, s2, r2, a);
    return this.cache = this.use > 1 ? { data: h, params: arguments } : null, h;
  }
  getPattern(t2, e2, s2, r2) {
    const i2 = Kt.canvas.createPattern(t2, e2);
    return Kt.image.setPatternTransform(i2, s2, r2), i2;
  }
  render(t2, e2, s2, r2, i2, n2, o2, a, h) {
    t2.drawImage(this.view, e2, s2, r2, i2);
  }
  getLoadUrl(t2) {
    return this.url;
  }
  setThumbView(t2) {
  }
  getThumbSize(t2) {
  }
  getMinLevel() {
  }
  getLevelData(t2, e2, s2) {
  }
  clearLevels(t2) {
  }
  destroyFilter() {
  }
  destroy() {
    this.clearLevels(), this.destroyFilter();
    const { view: t2 } = this;
    t2 && t2.close && t2.close(), this.config = { url: "" }, this.cache = this.view = null, this.waitComplete.length = 0;
  }
};
function dn(t2, e2, s2, r2) {
  r2 || (s2.configurable = s2.enumerable = true), Object.defineProperty(t2, e2, s2);
}
function cn(t2, e2) {
  return Object.getOwnPropertyDescriptor(t2, e2);
}
function un(t2, e2) {
  const s2 = "_" + t2;
  return { get() {
    const t3 = this[s2];
    return null == t3 ? e2 : t3;
  }, set(t3) {
    this[s2] = t3;
  } };
}
function _n(t2, e2) {
  return (s2, r2) => fn(s2, r2, t2, e2 && e2(r2));
}
function pn(t2) {
  return t2;
}
function fn(t2, e2, s2, r2) {
  const i2 = { get() {
    return this.__getAttr(e2);
  }, set(t3) {
    this.__setAttr(e2, t3);
  } };
  dn(t2, e2, Object.assign(i2, r2 || {})), jn(t2, e2, s2);
}
function gn(t2) {
  return _n(t2);
}
function yn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2, e2) && (this.__layout.matrixChanged || this.__layout.matrixChange());
  } }));
}
function mn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2, e2) && (this.__layout.matrixChanged || this.__layout.matrixChange(), this.__scrollWorld || (this.__scrollWorld = {}));
  } }));
}
function xn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (this.__hasAutoLayout = !!(this.origin || this.around || this.flow), this.__local || this.__layout.createLocal(), kn(this));
  } }));
}
function wn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2, e2) && (this.__layout.scaleChanged || this.__layout.scaleChange());
  } }));
}
function bn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2, e2) && (this.__layout.rotationChanged || this.__layout.rotationChange());
  } }));
}
function Bn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2, e2) && kn(this);
  } }));
}
function vn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (kn(this), this.__.__removeNaturalSize());
  } }));
}
function kn(t2) {
  t2.__layout.boxChanged || t2.__layout.boxChange(), t2.__hasAutoLayout && (t2.__layout.matrixChanged || t2.__layout.matrixChange());
}
function Cn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    const s2 = this.__;
    2 !== s2.__pathInputed && (s2.__pathInputed = e2 ? 1 : 0), e2 || (s2.__pathForRender = void 0), this.__setAttr(t3, e2), kn(this);
  } }));
}
var On = Bn;
function Tn(t2, e2) {
  return _n(t2, (t3) => ({ set(s2) {
    this.__setAttr(t3, s2) && (Pn(this), e2 && (this.__.__useStroke = true));
  } }));
}
function Pn(t2) {
  t2.__layout.strokeChanged || t2.__layout.strokeChange(), t2.__.__useArrow && kn(t2);
}
var Sn = Tn;
function Ln(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2), this.__layout.renderChanged || this.__layout.renderChange();
  } }));
}
function Rn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (this.__layout.surfaceChanged || this.__layout.surfaceChange());
  } }));
}
function En(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    if (this.__setAttr(t3, e2)) {
      const t4 = this.__;
      _.stintSet(t4, "__useDim", t4.dim || t4.bright || t4.dimskip);
    }
  } }));
}
function In(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (this.__layout.opacityChanged || this.__layout.opacityChange()), this.mask && An(this);
  } }));
}
function Mn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    const s2 = this.visible;
    if (true === s2 && 0 === e2) {
      if (this.animationOut) return this.__runAnimation("out", () => Wn(this, t3, e2, s2));
    } else 0 === s2 && true === e2 && this.animation && this.__runAnimation("in");
    Wn(this, t3, e2, s2), this.mask && An(this);
  } }));
}
function An(t2) {
  const { parent: e2 } = t2;
  if (e2) {
    const { __hasMask: t3 } = e2;
    e2.__updateMask(), t3 !== e2.__hasMask && e2.forceUpdate();
  }
}
function Wn(t2, e2, s2, r2) {
  t2.__setAttr(e2, s2) && (t2.__layout.opacityChanged || t2.__layout.opacityChange(), 0 !== r2 && 0 !== s2 || kn(t2));
}
function Nn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && this.waitParent(() => {
      this.parent.__layout.childrenSortChange();
    });
  } }));
}
function Dn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (this.__layout.boxChanged || this.__layout.boxChange(), this.waitParent(() => {
      this.parent.__updateMask(e2);
    }));
  } }));
}
function Yn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && this.waitParent(() => {
      this.parent.__updateEraser(e2);
    });
  } }));
}
function Xn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2) && (this.__layout.hitCanvasChanged = true, this.leafer && this.leafer.updateCursor());
  } }));
}
function zn(t2) {
  return _n(t2, (t3) => ({ set(e2) {
    this.__setAttr(t3, e2), this.leafer && this.leafer.updateCursor();
  } }));
}
function Fn(t2) {
  return (e2, s2) => {
    dn(e2, "__DataProcessor", { get: () => t2 });
  };
}
function jn(t2, e2, r2) {
  const i2 = t2.__DataProcessor.prototype, n2 = "_" + e2, o2 = (function(t3) {
    return "set" + t3.charAt(0).toUpperCase() + t3.slice(1);
  })(e2), a = un(e2, r2);
  if (s(r2)) a.get = function() {
    return this[n2];
  };
  else if ("function" == typeof r2) a.get = function() {
    const t3 = this[n2];
    return null == t3 ? r2(this.__leaf) : t3;
  };
  else if (d(r2)) {
    const t3 = u(r2);
    a.get = function() {
      const e3 = this[n2];
      return null == e3 ? this[n2] = t3 ? {} : _.clone(r2) : e3;
    };
  }
  const h = t2.isBranchLeaf;
  "width" === e2 ? a.get = function() {
    const t3 = this[n2];
    if (null == t3) {
      const t4 = this, e3 = t4.__naturalWidth, s2 = t4.__leaf;
      return !r2 || s2.pathInputed ? s2.boxBounds.width : e3 ? t4._height && t4.__useNaturalRatio ? t4._height * e3 / t4.__naturalHeight : e3 : h && s2.children.length ? s2.boxBounds.width : r2;
    }
    return t3;
  } : "height" === e2 && (a.get = function() {
    const t3 = this[n2];
    if (null == t3) {
      const t4 = this, e3 = t4.__naturalHeight, s2 = t4.__leaf;
      return !r2 || s2.pathInputed ? s2.boxBounds.height : e3 ? t4._width && t4.__useNaturalRatio ? t4._width * e3 / t4.__naturalWidth : e3 : h && s2.children.length ? s2.boxBounds.height : r2;
    }
    return t3;
  });
  let l2, c = i2;
  for (; !l2 && c; ) l2 = cn(c, e2), c = c.__proto__;
  l2 && l2.set && (a.set = l2.set), i2[o2] && (a.set = i2[o2], delete i2[o2]), dn(i2, e2, a);
}
var Vn = new se("rewrite");
var Hn = [];
var Gn = ["destroy", "constructor"];
function qn(t2) {
  return (e2, s2) => {
    Hn.push({ name: e2.constructor.name + "." + s2, run: () => {
      e2[s2] = t2;
    } });
  };
}
function Qn() {
  return (t2) => {
    Jn();
  };
}
function Jn(t2) {
  Hn.length && (Hn.forEach((e2) => {
    t2 && Vn.error(e2.name, "\u9700\u5728Class\u4E0A\u88C5\u9970@rewriteAble()"), e2.run();
  }), Hn.length = 0);
}
function Zn(t2, e2) {
  return (s2) => {
    var r2;
    (t2.prototype ? (r2 = t2.prototype, Object.getOwnPropertyNames(r2)) : Object.keys(t2)).forEach((r3) => {
      if (!(Gn.includes(r3) || e2 && e2.includes(r3))) if (t2.prototype) {
        cn(t2.prototype, r3).writable && (s2.prototype[r3] = t2.prototype[r3]);
      } else s2.prototype[r3] = t2[r3];
    });
  };
}
function $n() {
  return (t2) => {
    ue.register(t2);
  };
}
function Kn() {
  return (t2) => {
    fe.register(t2);
  };
}
setTimeout(() => Jn(true));
var { copy: to, toInnerPoint: eo, toOuterPoint: so, scaleOfOuter: ro, rotateOfOuter: io, skewOfOuter: no, multiplyParent: oo, divideParent: ao, getLayout: ho } = Q;
var lo = {};
var { round: co } = Math;
var uo = { updateAllMatrix(t2, e2, s2) {
  if (e2 && t2.__hasAutoLayout && t2.__layout.matrixChanged && (s2 = true), fo(t2, e2, s2), t2.isBranch) {
    const { children: r2 } = t2;
    for (let t3 = 0, i2 = r2.length; t3 < i2; t3++) po(r2[t3], e2, s2);
  }
}, updateMatrix(t2, e2, s2) {
  const r2 = t2.__layout;
  e2 ? s2 && (r2.waitAutoLayout = true, t2.__hasAutoLayout && (r2.matrixChanged = false)) : r2.waitAutoLayout && (r2.waitAutoLayout = false), r2.matrixChanged && t2.__updateLocalMatrix(), r2.waitAutoLayout || t2.__updateWorldMatrix();
}, updateBounds(t2) {
  const e2 = t2.__layout;
  e2.boundsChanged && t2.__updateLocalBounds(), e2.waitAutoLayout || t2.__updateWorldBounds();
}, updateAllWorldOpacity(t2) {
  if (t2.__updateWorldOpacity(), t2.isBranch) {
    const { children: e2 } = t2;
    for (let t3 = 0, s2 = e2.length; t3 < s2; t3++) go(e2[t3]);
  }
}, updateChange(t2) {
  const e2 = t2.__layout;
  e2.stateStyleChanged && t2.updateState(), e2.opacityChanged && go(t2), t2.__updateChange(), e2.surfaceChanged && (t2.__hasComplex && _o.updateComplex(t2), e2.surfaceChanged = false);
}, updateAllChange(t2) {
  if (mo(t2), t2.isBranch) {
    const { children: e2 } = t2;
    for (let t3 = 0, s2 = e2.length; t3 < s2; t3++) yo(e2[t3]);
  }
}, worldHittable(t2) {
  for (; t2; ) {
    if (!t2.__.hittable) return false;
    t2 = t2.parent;
  }
  return true;
}, draggable: (t2) => (t2.draggable || t2.editable) && t2.hitSelf && !t2.locked, copyCanvasByWorld(t2, e2, s2, r2, i2, n2) {
  r2 || (r2 = t2.__nowWorld), t2.__worldFlipped || Kt.fullImageShadow ? e2.copyWorldByReset(s2, r2, t2.__nowWorld, i2, n2) : e2.copyWorldToInner(s2, r2, t2.__layout.renderBounds, i2);
}, renderComplex(t2, e2, s2) {
}, updateComplex(t2) {
}, checkComplex(t2) {
}, moveWorld(t2, e2, s2 = 0, r2, i2) {
  const n2 = d(e2) ? Object.assign({}, e2) : { x: e2, y: s2 };
  r2 ? so(t2.localTransform, n2, n2, true) : t2.parent && eo(t2.parent.scrollWorldTransform, n2, n2, true), _o.moveLocal(t2, n2.x, n2.y, i2);
}, moveLocal(t2, e2, s2 = 0, r2) {
  d(e2) && (s2 = e2.y, e2 = e2.x), e2 += t2.x, s2 += t2.y, t2.leafer && t2.leafer.config.pointSnap && (e2 = co(e2), s2 = co(s2)), r2 ? t2.animate({ x: e2, y: s2 }, r2) : (t2.x = e2, t2.y = s2);
}, zoomOfWorld(t2, e2, s2, r2, i2, n2) {
  _o.zoomOfLocal(t2, xo(t2, e2), s2, r2, i2, n2);
}, zoomOfLocal(t2, e2, s2, r2 = s2, i2, n2) {
  const a = t2.__localMatrix;
  if (o(r2) || (r2 && (n2 = r2), r2 = s2), to(lo, a), ro(lo, e2, s2, r2), _o.hasHighPosition(t2)) _o.setTransform(t2, lo, i2, n2);
  else {
    const e3 = t2.x + lo.e - a.e, o2 = t2.y + lo.f - a.f;
    n2 && !i2 ? t2.animate({ x: e3, y: o2, scaleX: t2.scaleX * s2, scaleY: t2.scaleY * r2 }, n2) : (t2.x = e3, t2.y = o2, t2.scaleResize(s2, r2, true !== i2));
  }
}, rotateOfWorld(t2, e2, s2, r2) {
  _o.rotateOfLocal(t2, xo(t2, e2), s2, r2);
}, rotateOfLocal(t2, e2, s2, r2) {
  const i2 = t2.__localMatrix;
  to(lo, i2), io(lo, e2, s2), _o.hasHighPosition(t2) ? _o.setTransform(t2, lo, false, r2) : t2.set({ x: t2.x + lo.e - i2.e, y: t2.y + lo.f - i2.f, rotation: M.formatRotation(t2.rotation + s2) }, r2);
}, skewOfWorld(t2, e2, s2, r2, i2, n2) {
  _o.skewOfLocal(t2, xo(t2, e2), s2, r2, i2, n2);
}, skewOfLocal(t2, e2, s2, r2 = 0, i2, n2) {
  to(lo, t2.__localMatrix), no(lo, e2, s2, r2), _o.setTransform(t2, lo, i2, n2);
}, transformWorld(t2, e2, s2, r2) {
  to(lo, t2.worldTransform), oo(lo, e2), t2.parent && ao(lo, t2.parent.scrollWorldTransform), _o.setTransform(t2, lo, s2, r2);
}, transform(t2, e2, s2, r2) {
  to(lo, t2.localTransform), oo(lo, e2), _o.setTransform(t2, lo, s2, r2);
}, setTransform(t2, e2, s2, r2) {
  const i2 = t2.__, n2 = i2.origin && _o.getInnerOrigin(t2, i2.origin), o2 = ho(e2, n2, i2.around && _o.getInnerOrigin(t2, i2.around));
  if (_o.hasOffset(t2) && (o2.x -= i2.offsetX, o2.y -= i2.offsetY), s2) {
    const e3 = o2.scaleX / t2.scaleX, s3 = o2.scaleY / t2.scaleY;
    if (delete o2.scaleX, delete o2.scaleY, n2) {
      Ft.scale(t2.boxBounds, Math.abs(e3), Math.abs(s3));
      const r3 = _o.getInnerOrigin(t2, i2.origin);
      at.move(o2, n2.x - r3.x, n2.y - r3.y);
    }
    t2.set(o2), t2.scaleResize(e3, s3, false);
  } else t2.set(o2, r2);
}, getFlipTransform(t2, e2) {
  const s2 = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, r2 = "x" === e2 ? 1 : -1;
  return ro(s2, _o.getLocalOrigin(t2, "center"), -1 * r2, 1 * r2), s2;
}, getLocalOrigin: (t2, e2) => at.tempToOuterOf(_o.getInnerOrigin(t2, e2), t2.localTransform), getInnerOrigin(t2, e2) {
  const s2 = {};
  return Bt.toPoint(e2, t2.boxBounds, s2), s2;
}, getRelativeWorld: (t2, e2, s2) => (to(lo, t2.worldTransform), ao(lo, e2.scrollWorldTransform), s2 ? lo : Object.assign({}, lo)), updateScaleFixedWorld(t2) {
}, updateOuterBounds(t2) {
}, cacheId(t2) {
}, drop(t2, e2, s2, r2) {
  t2.setTransform(_o.getRelativeWorld(t2, e2, true), r2), e2.add(t2, s2);
}, hasHighPosition: (t2) => t2.origin || t2.around || _o.hasOffset(t2), hasOffset: (t2) => t2.offsetX || t2.offsetY, hasParent(t2, e2) {
  if (!e2) return false;
  for (; t2; ) {
    if (e2 === t2) return true;
    t2 = t2.parent;
  }
}, animateMove(t2, e2, s2 = 0.3) {
  if (e2.x || e2.y) if (Math.abs(e2.x) < 1 && Math.abs(e2.y) < 1) t2.move(e2);
  else {
    const r2 = e2.x * s2, i2 = e2.y * s2;
    e2.x -= r2, e2.y -= i2, t2.move(r2, i2), Kt.requestRender(() => _o.animateMove(t2, e2, s2));
  }
} };
var _o = uo;
var { updateAllMatrix: po, updateMatrix: fo, updateAllWorldOpacity: go, updateAllChange: yo, updateChange: mo } = _o;
function xo(t2, e2) {
  return t2.updateLayout(), t2.parent ? at.tempToInnerOf(e2, t2.parent.scrollWorldTransform) : e2;
}
var wo = { worldBounds: (t2) => t2.__world, localBoxBounds: (t2) => t2.__.eraser || 0 === t2.__.visible ? null : t2.__local || t2.__layout, localStrokeBounds: (t2) => t2.__.eraser || 0 === t2.__.visible ? null : t2.__layout.localStrokeBounds, localRenderBounds(t2) {
  const { __: e2, __layout: s2 } = t2;
  return e2.eraser || 0 === e2.visible ? null : s2.localOuterBounds || s2.localRenderBounds;
}, maskLocalBoxBounds: (t2, e2) => Bo(t2, e2) && t2.__localBoxBounds, maskLocalStrokeBounds: (t2, e2) => Bo(t2, e2) && t2.__layout.localStrokeBounds, maskLocalRenderBounds(t2, e2) {
  const { __layout: s2 } = t2;
  return Bo(t2, e2) && (s2.localOuterBounds || s2.localRenderBounds);
}, excludeRenderBounds: (t2, e2) => !(!e2.bounds || e2.bounds.hit(t2.__world, e2.matrix)) || !(!e2.hideBounds || !e2.hideBounds.includes(t2.__world, e2.matrix)) };
var bo;
function Bo(t2, e2) {
  return e2 || (bo = 0), t2.__.mask && (bo = 1), bo < 0 ? null : (bo && (bo = -1), true);
}
var { updateBounds: vo } = uo;
var ko = { sort: (t2, e2) => t2.__.zIndex === e2.__.zIndex ? t2.__tempNumber - e2.__tempNumber : t2.__.zIndex - e2.__.zIndex, pushAllChildBranch(t2, e2) {
  if (t2.__tempNumber = 1, t2.__.__childBranchNumber) {
    const { children: s2 } = t2;
    for (let r2 = 0, i2 = s2.length; r2 < i2; r2++) (t2 = s2[r2]).isBranch && (t2.__tempNumber = 1, e2.add(t2), Co(t2, e2));
  }
}, pushAllParent(t2, e2) {
  const { keys: r2 } = e2;
  if (r2) for (; t2.parent && s(r2[t2.parent.innerId]); ) e2.add(t2.parent), t2 = t2.parent;
  else for (; t2.parent; ) e2.add(t2.parent), t2 = t2.parent;
}, pushAllBranchStack(t2, e2) {
  let s2 = e2.length;
  const { children: r2 } = t2;
  for (let t3 = 0, s3 = r2.length; t3 < s3; t3++) r2[t3].isBranch && e2.push(r2[t3]);
  for (let t3 = s2, r3 = e2.length; t3 < r3; t3++) Oo(e2[t3], e2);
}, updateBounds(t2, e2) {
  const s2 = [t2];
  Oo(t2, s2), To(s2, e2);
}, updateBoundsByBranchStack(t2, e2) {
  let s2, r2;
  for (let i2 = t2.length - 1; i2 > -1; i2--) {
    s2 = t2[i2], r2 = s2.children;
    for (let t3 = 0, e3 = r2.length; t3 < e3; t3++) vo(r2[t3]);
    e2 && e2 === s2 || vo(s2);
  }
}, move(t2, e2, s2) {
  let r2;
  const { children: i2 } = t2;
  for (let n2 = 0, o2 = i2.length; n2 < o2; n2++) r2 = (t2 = i2[n2]).__world, r2.e += e2, r2.f += s2, r2.x += e2, r2.y += s2, t2.isBranch && Po(t2, e2, s2);
}, scale(t2, e2, s2, r2, i2, n2, o2) {
  let a;
  const { children: h } = t2, l2 = r2 - 1, d2 = i2 - 1;
  for (let c = 0, u2 = h.length; c < u2; c++) a = (t2 = h[c]).__world, a.a *= r2, a.d *= i2, (a.b || a.c) && (a.b *= r2, a.c *= i2), a.e === a.x && a.f === a.y ? (a.x = a.e += (a.e - n2) * l2 + e2, a.y = a.f += (a.f - o2) * d2 + s2) : (a.e += (a.e - n2) * l2 + e2, a.f += (a.f - o2) * d2 + s2, a.x += (a.x - n2) * l2 + e2, a.y += (a.y - o2) * d2 + s2), a.width *= r2, a.height *= i2, a.scaleX *= r2, a.scaleY *= i2, t2.isBranch && So(t2, e2, s2, r2, i2, n2, o2);
} };
var { pushAllChildBranch: Co, pushAllBranchStack: Oo, updateBoundsByBranchStack: To, move: Po, scale: So } = ko;
var Lo = { run(t2) {
  if (t2 && t2.length) {
    const e2 = t2.length;
    for (let s2 = 0; s2 < e2; s2++) t2[s2]();
    t2.length === e2 ? t2.length = 0 : t2.splice(0, e2);
  }
} };
var { getRelativeWorld: Ro, updateBounds: Eo } = uo;
var { toOuterOf: Io, getPoints: Mo, copy: Ao } = Ft;
var Wo = "_localContentBounds";
var No = "_worldContentBounds";
var Do = "_worldBoxBounds";
var Yo = "_worldStrokeBounds";
var Xo = class {
  get contentBounds() {
    return this._contentBounds || this.boxBounds;
  }
  set contentBounds(t2) {
    this._contentBounds = t2;
  }
  get strokeBounds() {
    return this._strokeBounds || this.boxBounds;
  }
  get renderBounds() {
    return this._renderBounds || this.boxBounds;
  }
  set renderBounds(t2) {
    this._renderBounds = t2;
  }
  get localContentBounds() {
    return Io(this.contentBounds, this.leaf.__localMatrix, this[Wo] || (this[Wo] = {})), this[Wo];
  }
  get localStrokeBounds() {
    return this._localStrokeBounds || this;
  }
  get localRenderBounds() {
    return this._localRenderBounds || this;
  }
  get worldContentBounds() {
    return Io(this.contentBounds, this.leaf.__world, this[No] || (this[No] = {})), this[No];
  }
  get worldBoxBounds() {
    return Io(this.boxBounds, this.leaf.__world, this[Do] || (this[Do] = {})), this[Do];
  }
  get worldStrokeBounds() {
    return Io(this.strokeBounds, this.leaf.__world, this[Yo] || (this[Yo] = {})), this[Yo];
  }
  get a() {
    return 1;
  }
  get b() {
    return 0;
  }
  get c() {
    return 0;
  }
  get d() {
    return 1;
  }
  get e() {
    return this.leaf.__.x;
  }
  get f() {
    return this.leaf.__.y;
  }
  get x() {
    return this.e + this.boxBounds.x;
  }
  get y() {
    return this.f + this.boxBounds.y;
  }
  get width() {
    return this.boxBounds.width;
  }
  get height() {
    return this.boxBounds.height;
  }
  constructor(t2) {
    this.leaf = t2, this.leaf.__local && (this._localRenderBounds = this._localStrokeBounds = this.leaf.__local), t2.__world && (this.boxBounds = { x: 0, y: 0, width: 0, height: 0 }, this.boxChange(), this.matrixChange());
  }
  createLocal() {
    const t2 = this.leaf.__local = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, x: 0, y: 0, width: 0, height: 0 };
    this._localStrokeBounds || (this._localStrokeBounds = t2), this._localRenderBounds || (this._localRenderBounds = t2);
  }
  update() {
    const { leaf: t2 } = this, { leafer: e2 } = t2;
    if (t2.isApp) return Eo(t2);
    if (e2) e2.ready ? e2.watcher.changed && e2.layouter.layout() : e2.start();
    else {
      let e3 = t2;
      for (; e3.parent && !e3.parent.leafer; ) e3 = e3.parent;
      const s2 = e3;
      if (s2.__fullLayouting) return;
      s2.__fullLayouting = true, Kt.layout(s2), delete s2.__fullLayouting;
    }
  }
  getTransform(t2 = "world") {
    this.update();
    const { leaf: e2 } = this;
    switch (t2) {
      case "world":
        return e2.__world;
      case "local":
        return e2.__localMatrix;
      case "inner":
        return Q.defaultMatrix;
      case "page":
        t2 = e2.zoomLayer;
      default:
        return Ro(e2, t2);
    }
  }
  getBounds(t2, e2 = "world") {
    switch (this.update(), e2) {
      case "world":
        return this.getWorldBounds(t2);
      case "local":
        return this.getLocalBounds(t2);
      case "inner":
        return this.getInnerBounds(t2);
      case "page":
        e2 = this.leaf.zoomLayer;
      default:
        return new Ht(this.getInnerBounds(t2)).toOuterOf(this.getTransform(e2));
    }
  }
  getInnerBounds(t2 = "box") {
    switch (t2) {
      case "render":
        return this.renderBounds;
      case "content":
        if (this.contentBounds) return this.contentBounds;
      case "box":
        return this.boxBounds;
      case "stroke":
        return this.strokeBounds;
    }
  }
  getLocalBounds(t2 = "box") {
    switch (t2) {
      case "render":
        return this.localRenderBounds;
      case "stroke":
        return this.localStrokeBounds;
      case "content":
        if (this.contentBounds) return this.localContentBounds;
      case "box":
        return this.leaf.__localBoxBounds;
    }
  }
  getWorldBounds(t2 = "box") {
    switch (t2) {
      case "render":
        return this.leaf.__world;
      case "stroke":
        return this.worldStrokeBounds;
      case "content":
        if (this.contentBounds) return this.worldContentBounds;
      case "box":
        return this.worldBoxBounds;
    }
  }
  getLayoutBounds(t2, e2 = "world", s2) {
    const { leaf: r2 } = this;
    let i2, n2, o2, a = this.getInnerBounds(t2);
    switch (e2) {
      case "world":
        i2 = r2.getWorldPoint(a), n2 = r2.__world;
        break;
      case "local":
        const { scaleX: t3, scaleY: s3, rotation: h, skewX: l2, skewY: d2 } = r2.__;
        o2 = { scaleX: t3, scaleY: s3, rotation: h, skewX: l2, skewY: d2 }, i2 = r2.getLocalPointByInner(a);
        break;
      case "inner":
        i2 = a, n2 = Q.defaultMatrix;
        break;
      case "page":
        e2 = r2.zoomLayer;
      default:
        i2 = r2.getWorldPoint(a, e2), n2 = Ro(r2, e2, true);
    }
    if (o2 || (o2 = Q.getLayout(n2)), Ao(o2, a), at.copy(o2, i2), s2) {
      const { scaleX: t3, scaleY: e3 } = o2, s3 = Math.abs(t3), r3 = Math.abs(e3);
      1 === s3 && 1 === r3 || (o2.scaleX /= s3, o2.scaleY /= r3, o2.width *= s3, o2.height *= r3);
    }
    return o2;
  }
  getLayoutPoints(t2, e2 = "world") {
    const { leaf: r2 } = this, i2 = Mo(this.getInnerBounds(t2));
    let n2;
    switch (e2) {
      case "world":
        n2 = null;
        break;
      case "local":
        n2 = r2.parent;
        break;
      case "inner":
        break;
      case "page":
        e2 = r2.zoomLayer;
      default:
        n2 = e2;
    }
    return s(n2) || i2.forEach((t3) => r2.innerToWorld(t3, null, false, n2)), i2;
  }
  shrinkContent() {
    const { x: t2, y: e2, width: s2, height: r2 } = this.boxBounds;
    this._contentBounds = { x: t2, y: e2, width: s2, height: r2 };
  }
  spreadStroke() {
    const { x: t2, y: e2, width: s2, height: r2 } = this.strokeBounds;
    this._strokeBounds = { x: t2, y: e2, width: s2, height: r2 }, this._localStrokeBounds = { x: t2, y: e2, width: s2, height: r2 }, this.renderSpread || this.spreadRenderCancel();
  }
  spreadRender() {
    const { x: t2, y: e2, width: s2, height: r2 } = this.renderBounds;
    this._renderBounds = { x: t2, y: e2, width: s2, height: r2 }, this._localRenderBounds = { x: t2, y: e2, width: s2, height: r2 };
  }
  shrinkContentCancel() {
    this._contentBounds = void 0;
  }
  spreadStrokeCancel() {
    const t2 = this.renderBounds === this.strokeBounds;
    this._strokeBounds = this.boxBounds, this._localStrokeBounds = this.leaf.__localBoxBounds, t2 && this.spreadRenderCancel();
  }
  spreadRenderCancel() {
    this._renderBounds = this._strokeBounds, this._localRenderBounds = this._localStrokeBounds;
  }
  boxChange() {
    this.boxChanged = true, this.localBoxChanged ? this.boundsChanged || (this.boundsChanged = true) : this.localBoxChange(), this.hitCanvasChanged = true;
  }
  localBoxChange() {
    this.localBoxChanged = true, this.boundsChanged = true;
  }
  strokeChange() {
    this.strokeChanged = true, this.strokeSpread || (this.strokeSpread = 1), this.boundsChanged = true, this.hitCanvasChanged = true;
  }
  renderChange() {
    this.renderChanged = true, this.renderSpread || (this.renderSpread = 1), this.boundsChanged = true;
  }
  scaleChange() {
    this.scaleChanged = true, this._scaleOrRotationChange();
  }
  rotationChange() {
    this.rotationChanged = true, this.affectRotation = true, this._scaleOrRotationChange();
  }
  _scaleOrRotationChange() {
    this.affectScaleOrRotation = true, this.matrixChange(), this.leaf.__local || this.createLocal();
  }
  matrixChange() {
    this.matrixChanged = true, this.localBoxChanged ? this.boundsChanged || (this.boundsChanged = true) : this.localBoxChange();
  }
  surfaceChange() {
    this.surfaceChanged = true;
  }
  opacityChange() {
    this.opacityChanged = true;
  }
  childrenSortChange() {
    this.childrenSortChanged || (this.childrenSortChanged = this.affectChildrenSort = true, this.leaf.forceUpdate("surface"));
  }
  destroy() {
  }
};
var zo = class {
  constructor(t2, e2) {
    this.bubbles = false, this.type = t2, e2 && (this.target = e2);
  }
  stopDefault() {
    this.isStopDefault = true, this.origin && Kt.event.stopDefault(this.origin);
  }
  stopNow() {
    this.isStopNow = true, this.isStop = true, this.origin && Kt.event.stopNow(this.origin);
  }
  stop() {
    this.isStop = true, this.origin && Kt.event.stop(this.origin);
  }
};
var Fo = class extends zo {
  constructor(t2, e2, s2) {
    super(t2, e2), this.parent = s2, this.child = e2;
  }
};
Fo.ADD = "child.add", Fo.REMOVE = "child.remove", Fo.CREATED = "created", Fo.MOUNTED = "mounted", Fo.UNMOUNTED = "unmounted", Fo.DESTROY = "destroy";
var Uo = "property.scroll";
var jo = class extends zo {
  constructor(t2, e2, s2, r2, i2) {
    super(t2, e2), this.attrName = s2, this.oldValue = r2, this.newValue = i2;
  }
};
jo.CHANGE = "property.change", jo.LEAFER_CHANGE = "property.leafer_change", jo.SCROLL = Uo;
var Vo = { scrollX: Uo, scrollY: Uo };
var Ho = class extends zo {
  constructor(t2, e2) {
    super(t2), Object.assign(this, e2);
  }
};
Ho.LOAD = "image.load", Ho.LOADED = "image.loaded", Ho.ERROR = "image.error";
var Go = class extends zo {
  static checkHas(t2, e2, s2) {
    "on" === s2 ? e2 === Zo ? t2.__hasWorldEvent = true : t2.__hasLocalEvent = true : (t2.__hasLocalEvent = t2.hasEvent(qo) || t2.hasEvent(Qo) || t2.hasEvent(Jo), t2.__hasWorldEvent = t2.hasEvent(Zo));
  }
  static emitLocal(t2) {
    if (t2.leaferIsReady) {
      const { resized: e2 } = t2.__layout;
      "local" !== e2 && (t2.emit(qo, t2), "inner" === e2 && t2.emit(Qo, t2)), t2.emit(Jo, t2);
    }
  }
  static emitWorld(t2) {
    t2.leaferIsReady && t2.emit(Zo, t2);
  }
};
Go.RESIZE = "bounds.resize", Go.INNER = "bounds.inner", Go.LOCAL = "bounds.local", Go.WORLD = "bounds.world";
var { RESIZE: qo, INNER: Qo, LOCAL: Jo, WORLD: Zo } = Go;
var $o = {};
[qo, Qo, Jo, Zo].forEach((t2) => $o[t2] = 1);
var Ko = class _Ko extends zo {
  get bigger() {
    if (!this.old) return true;
    const { width: t2, height: e2 } = this.old;
    return this.width >= t2 && this.height >= e2;
  }
  get smaller() {
    return !this.bigger;
  }
  get samePixelRatio() {
    return !this.old || this.pixelRatio === this.old.pixelRatio;
  }
  constructor(t2, e2) {
    d(t2) ? (super(_Ko.RESIZE), Object.assign(this, t2)) : super(t2), this.old = e2;
  }
  static isResizing(t2) {
    return this.resizingKeys && !s(this.resizingKeys[t2.innerId]);
  }
};
Ko.RESIZE = "resize";
var ta = class extends zo {
  constructor(t2, e2) {
    super(t2), this.data = e2;
  }
};
ta.REQUEST = "watch.request", ta.DATA = "watch.data";
var ea = class extends zo {
  constructor(t2, e2, s2) {
    super(t2), e2 && (this.data = e2, this.times = s2);
  }
};
ea.REQUEST = "layout.request", ea.START = "layout.start", ea.BEFORE = "layout.before", ea.LAYOUT = "layout", ea.AFTER = "layout.after", ea.AGAIN = "layout.again", ea.END = "layout.end";
var sa = class extends zo {
  constructor(t2, e2, s2, r2) {
    super(t2), e2 && (this.times = e2), s2 && (this.renderBounds = s2, this.renderOptions = r2);
  }
};
sa.REQUEST = "render.request", sa.CHILD_START = "render.child_start", sa.CHILD_END = "render.child_end", sa.START = "render.start", sa.BEFORE = "render.before", sa.RENDER = "render", sa.AFTER = "render.after", sa.AGAIN = "render.again", sa.END = "render.end", sa.NEXT = "render.next";
var ra = class extends zo {
};
ra.START = "leafer.start", ra.BEFORE_READY = "leafer.before_ready", ra.READY = "leafer.ready", ra.AFTER_READY = "leafer.after_ready", ra.VIEW_READY = "leafer.view_ready", ra.VIEW_COMPLETED = "leafer.view_completed", ra.STOP = "leafer.stop", ra.RESTART = "leafer.restart", ra.END = "leafer.end", ra.UPDATE_MODE = "leafer.update_mode", ra.TRANSFORM = "leafer.transform", ra.MOVE = "leafer.move", ra.SCALE = "leafer.scale", ra.ROTATE = "leafer.rotate", ra.SKEW = "leafer.skew";
var { MOVE: ia, SCALE: na, ROTATE: oa, SKEW: aa } = ra;
var ha = { x: ia, y: ia, scaleX: na, scaleY: na, rotation: oa, skewX: aa, skewY: aa };
var la = {};
var da = class {
  set event(t2) {
    this.on(t2);
  }
  on(t2, e2, s2) {
    if (!e2) {
      let e3;
      if (l(t2)) t2.forEach((t3) => this.on(t3[0], t3[1], t3[2]));
      else for (let s3 in t2) l(e3 = t2[s3]) ? this.on(s3, e3[0], e3[1]) : this.on(s3, e3);
      return;
    }
    let r2, n2, o2;
    s2 && ("once" === s2 ? n2 = true : "boolean" == typeof s2 ? r2 = s2 : (r2 = s2.capture, n2 = s2.once));
    const a = ca(this, r2, true), h = i(t2) ? t2.split(" ") : t2, d2 = n2 ? { listener: e2, once: n2 } : { listener: e2 };
    h.forEach((t3) => {
      t3 && (o2 = a[t3], o2 ? -1 === o2.findIndex((t4) => t4.listener === e2) && o2.push(d2) : a[t3] = [d2], $o[t3] && Go.checkHas(this, t3, "on"));
    });
  }
  off(t2, e2, s2) {
    if (t2) {
      const r2 = i(t2) ? t2.split(" ") : t2;
      if (e2) {
        let t3, i2, n2;
        s2 && (t3 = "boolean" == typeof s2 ? s2 : "once" !== s2 && s2.capture);
        const o2 = ca(this, t3);
        r2.forEach((t4) => {
          t4 && (i2 = o2[t4], i2 && (n2 = i2.findIndex((t5) => t5.listener === e2), n2 > -1 && i2.splice(n2, 1), i2.length || delete o2[t4], $o[t4] && Go.checkHas(this, t4, "off")));
        });
      } else {
        const { __bubbleMap: t3, __captureMap: e3 } = this;
        r2.forEach((s3) => {
          t3 && delete t3[s3], e3 && delete e3[s3];
        });
      }
    } else this.__bubbleMap = this.__captureMap = void 0;
  }
  on_(t2, e2, s2, r2) {
    return e2 ? this.on(t2, s2 ? e2 = e2.bind(s2) : e2, r2) : l(t2) && t2.forEach((t3) => this.on(t3[0], t3[2] ? t3[1] = t3[1].bind(t3[2]) : t3[1], t3[3])), { type: t2, current: this, listener: e2, options: r2 };
  }
  off_(t2) {
    if (!t2) return;
    const e2 = l(t2) ? t2 : [t2];
    e2.forEach((t3) => {
      t3 && (t3.listener ? t3.current.off(t3.type, t3.listener, t3.options) : l(t3.type) && t3.type.forEach((e3) => t3.current.off(e3[0], e3[1], e3[3])));
    }), e2.length = 0;
  }
  once(t2, e2, s2, r2) {
    if (!e2) return l(t2) && t2.forEach((t3) => this.once(t3[0], t3[1], t3[2], t3[3]));
    d(s2) ? e2 = e2.bind(s2) : r2 = s2, this.on(t2, e2, { once: true, capture: r2 });
  }
  emit(t2, e2, s2) {
    !e2 && fe.has(t2) && (e2 = fe.get(t2, { type: t2, target: this, current: this }));
    const r2 = ca(this, s2)[t2];
    if (r2) {
      let i2;
      for (let n2 = 0, o2 = r2.length; n2 < o2 && !((i2 = r2[n2]) && (i2.listener(e2), i2.once && (this.off(t2, i2.listener, s2), n2--, o2--), e2 && e2.isStopNow)); n2++) ;
    }
    this.syncEventer && this.syncEventer.emitEvent(e2, s2);
  }
  emitEvent(t2, e2) {
    t2.current = this, this.emit(t2.type, t2, e2);
  }
  hasEvent(t2, e2) {
    if (this.syncEventer && this.syncEventer.hasEvent(t2, e2)) return true;
    const { __bubbleMap: r2, __captureMap: i2 } = this, n2 = r2 && r2[t2], o2 = i2 && i2[t2];
    return !!(s(e2) ? n2 || o2 : e2 ? o2 : n2);
  }
  destroy() {
    this.__captureMap = this.__bubbleMap = this.syncEventer = null;
  }
};
function ca(t2, e2, s2) {
  if (e2) {
    const { __captureMap: e3 } = t2;
    return e3 || (s2 ? t2.__captureMap = {} : la);
  }
  {
    const { __bubbleMap: e3 } = t2;
    return e3 || (s2 ? t2.__bubbleMap = {} : la);
  }
}
var { on: ua, on_: _a, off: pa, off_: fa, once: ga, emit: ya, emitEvent: ma, hasEvent: xa, destroy: wa } = da.prototype;
var ba = { on: ua, on_: _a, off: pa, off_: fa, once: ga, emit: ya, emitEvent: ma, hasEvent: xa, destroyEventer: wa };
var Ba = se.get("setAttr");
var va = { __setAttr(t2, e2, r2) {
  if (this.leaferIsCreated) {
    const i2 = this.__.__getInput(t2);
    if (!r2 || n(e2) || s(e2) || (Ba.warn(this.innerName, t2, e2), e2 = void 0), d(e2) || i2 !== e2) {
      if (this.__realSetAttr(t2, e2), this.isLeafer) {
        this.emitEvent(new jo(jo.LEAFER_CHANGE, this, t2, i2, e2));
        const s3 = ha[t2];
        s3 && (this.emitEvent(new ra(s3, this)), this.emitEvent(new ra(ra.TRANSFORM, this)));
      }
      this.emitPropertyEvent(jo.CHANGE, t2, i2, e2);
      const s2 = Vo[t2];
      return s2 && this.emitPropertyEvent(s2, t2, i2, e2), true;
    }
    return false;
  }
  return this.__realSetAttr(t2, e2), true;
}, emitPropertyEvent(t2, e2, s2, r2) {
  const i2 = new jo(t2, this, e2, s2, r2);
  this.isLeafer || this.hasEvent(t2) && this.emitEvent(i2), this.leafer.emitEvent(i2);
}, __realSetAttr(t2, e2) {
  const r2 = this.__;
  r2[t2] = e2, this.__proxyData && this.setProxyAttr(t2, e2), r2.normalStyle && (this.lockNormalStyle || s(r2.normalStyle[t2]) || (r2.normalStyle[t2] = e2));
}, __getAttr(t2) {
  return this.__proxyData ? this.getProxyAttr(t2) : this.__.__get(t2);
} };
var { setLayout: ka, multiplyParent: Ca, translateInner: Oa, defaultWorld: Ta } = Q;
var { toPoint: Pa, tempPoint: Sa } = Bt;
var La = { __updateWorldMatrix() {
  const { parent: t2, __layout: e2, __world: s2, __scrollWorld: r2, __: i2 } = this;
  Ca(this.__local || e2, t2 ? t2.__scrollWorld || t2.__world : Ta, s2, !!e2.affectScaleOrRotation, i2), r2 && Oa(Object.assign(r2, s2), i2.scrollX, i2.scrollY), e2.scaleFixed && uo.updateScaleFixedWorld(this);
}, __updateLocalMatrix() {
  if (this.__local) {
    const t2 = this.__layout, e2 = this.__local, s2 = this.__;
    t2.affectScaleOrRotation && (t2.scaleChanged && (t2.resized || (t2.resized = "scale")) || t2.rotationChanged) && (ka(e2, s2, null, null, t2.affectRotation), t2.scaleChanged = t2.rotationChanged = void 0), e2.e = s2.x + s2.offsetX, e2.f = s2.y + s2.offsetY, (s2.around || s2.origin) && (Pa(s2.around || s2.origin, t2.boxBounds, Sa), Oa(e2, -Sa.x, -Sa.y, !s2.around));
  }
  this.__layout.matrixChanged = void 0;
} };
var { updateMatrix: Ra, updateAllMatrix: Ea } = uo;
var { updateBounds: Ia } = ko;
var { toOuterOf: Ma, copyAndSpread: Aa, copy: Wa } = Ft;
var { toBounds: Na } = Wi;
var Da = { __updateWorldBounds() {
  const { __layout: t2, __world: e2 } = this;
  Ma(t2.renderBounds, e2, e2), this.__hasComplex && uo.checkComplex(this), t2.resized && ("inner" === t2.resized && this.__onUpdateSize(), this.__hasLocalEvent && Go.emitLocal(this), t2.resized = void 0), this.__hasWorldEvent && Go.emitWorld(this);
}, __updateLocalBounds() {
  const t2 = this.__layout;
  t2.boxChanged && (this.__.__pathInputed || this.__updatePath(), this.__updateRenderPath(), this.__updateBoxBounds(), t2.resized = "inner"), t2.localBoxChanged && (this.__local && this.__updateLocalBoxBounds(), t2.localBoxChanged = void 0, t2.strokeSpread && (t2.strokeChanged = true), t2.renderSpread && (t2.renderChanged = true), this.parent && this.parent.__layout.boxChange()), t2.boxChanged = void 0, t2.strokeChanged && (t2.strokeSpread = this.__updateStrokeSpread(), t2.strokeSpread ? (t2.strokeBounds === t2.boxBounds && t2.spreadStroke(), this.__updateStrokeBounds(), this.__updateLocalStrokeBounds()) : t2.spreadStrokeCancel(), t2.strokeChanged = void 0, (t2.renderSpread || t2.strokeSpread !== t2.strokeBoxSpread) && (t2.renderChanged = true), this.parent && this.parent.__layout.strokeChange(), t2.resized = "inner"), t2.renderChanged && (t2.renderSpread = this.__updateRenderSpread(), t2.renderSpread ? (t2.renderBounds !== t2.boxBounds && t2.renderBounds !== t2.strokeBounds || t2.spreadRender(), this.__updateRenderBounds(), this.__updateLocalRenderBounds()) : t2.spreadRenderCancel(), t2.renderChanged = void 0, this.parent && this.parent.__layout.renderChange()), t2.outerScale && uo.updateOuterBounds(this), t2.resized || (t2.resized = "local"), t2.boundsChanged = void 0;
}, __updateLocalBoxBounds() {
  this.__hasMotionPath && this.__updateMotionPath(), this.__hasAutoLayout && this.__updateAutoLayout(), Ma(this.__layout.boxBounds, this.__local, this.__local);
}, __updateLocalStrokeBounds() {
  Ma(this.__layout.strokeBounds, this.__localMatrix, this.__layout.localStrokeBounds);
}, __updateLocalRenderBounds() {
  Ma(this.__layout.renderBounds, this.__localMatrix, this.__layout.localRenderBounds);
}, __updateBoxBounds(t2, e2) {
  const s2 = this.__layout.boxBounds, r2 = this.__;
  r2.__usePathBox ? Na(r2.path, s2) : (s2.x = 0, s2.y = 0, s2.width = r2.width, s2.height = r2.height);
}, __updateAutoLayout() {
  this.__layout.matrixChanged = true, this.isBranch ? (this.__extraUpdate(), this.__.flow ? (this.__layout.boxChanged && this.__updateFlowLayout(), Ea(this), Ia(this, this), this.__.__autoSide && this.__updateBoxBounds(true)) : (Ea(this), Ia(this, this))) : Ra(this);
}, __updateNaturalSize() {
  const { __: t2, __layout: e2 } = this;
  t2.__naturalWidth = e2.boxBounds.width, t2.__naturalHeight = e2.boxBounds.height;
}, __updateStrokeBounds(t2) {
  const e2 = this.__layout;
  Aa(e2.strokeBounds, e2.boxBounds, e2.strokeBoxSpread);
}, __updateRenderBounds(t2) {
  const e2 = this.__layout, { renderSpread: s2 } = e2;
  o(s2) && s2 <= 0 ? Wa(e2.renderBounds, e2.strokeBounds) : Aa(e2.renderBounds, e2.boxBounds, s2);
} };
var Ya = { __render(t2, e2) {
  if (e2.shape) return this.__renderShape(t2, e2);
  if ((!e2.cellList || e2.cellList.has(this)) && this.__worldOpacity) {
    const s2 = this.__;
    if (s2.bright && !e2.topRendering) return e2.topList.add(this);
    if (t2.setWorld(this.__nowWorld = this.__getNowWorld(e2)), t2.opacity = e2.ignoreOpacity ? 1 : e2.dimOpacity && !s2.dimskip ? s2.opacity * e2.dimOpacity : s2.opacity, this.__.__single) {
      if ("path" === s2.eraser) return this.__renderEraser(t2, e2);
      const r2 = t2.getSameCanvas(true, true);
      this.__draw(r2, e2, t2), uo.copyCanvasByWorld(this, t2, r2, this.__nowWorld, s2.__blendMode, true), r2.recycle(this.__nowWorld);
    } else this.__draw(t2, e2);
    se.showBounds && se.drawBounds(this, t2, e2);
  }
}, __renderShape(t2, e2) {
  this.__worldOpacity && (t2.setWorld(this.__nowWorld = this.__getNowWorld(e2)), this.__drawShape(t2, e2));
}, __clip(t2, e2) {
  this.__worldOpacity && (t2.setWorld(this.__nowWorld = this.__getNowWorld(e2)), this.__drawRenderPath(t2), t2.clipUI(this));
}, __updateWorldOpacity() {
  this.__worldOpacity = this.__.visible ? this.parent ? this.parent.__worldOpacity * this.__.opacity : this.__.opacity : 0, this.__layout.opacityChanged && (this.__layout.opacityChanged = false);
} };
var { excludeRenderBounds: Xa } = wo;
var { hasSize: za } = Ft;
var Fa = { __updateChange() {
  const { __layout: t2 } = this;
  t2.childrenSortChanged && (this.__updateSortChildren(), t2.childrenSortChanged = false), this.__.__checkSingle();
}, __render(t2, e2) {
  const s2 = this.__nowWorld = this.__getNowWorld(e2);
  if (this.__worldOpacity && za(s2)) {
    const r2 = this.__;
    if (r2.__useDim) if (r2.dim) e2.dimOpacity = true === r2.dim ? 0.2 : r2.dim;
    else {
      if (r2.bright && !e2.topRendering) return e2.topList.add(this);
      r2.dimskip && e2.dimOpacity && (e2.dimOpacity = 0);
    }
    if (r2.__single && !this.isBranchLeaf) {
      if ("path" === r2.eraser) return this.__renderEraser(t2, e2);
      const i2 = t2.getSameCanvas(false, true);
      this.__renderBranch(i2, e2), t2.opacity = e2.ignoreOpacity ? 1 : e2.dimOpacity ? r2.opacity * e2.dimOpacity : r2.opacity, t2.copyWorldByReset(i2, s2, s2, r2.__blendMode, true), i2.recycle(s2);
    } else this.__renderBranch(t2, e2);
  }
}, __renderBranch(t2, e2) {
  if (this.__hasMask) this.__renderMask(t2, e2);
  else {
    let s2;
    const { children: r2 } = this;
    for (let i2 = 0, n2 = r2.length; i2 < n2; i2++) s2 = r2[i2], Xa(s2, e2) || (s2.__hasComplex ? uo.renderComplex(s2, t2, e2) : s2.__render(t2, e2));
  }
}, __clip(t2, e2) {
  if (this.__worldOpacity) {
    const { children: s2 } = this;
    for (let r2 = 0, i2 = s2.length; r2 < i2; r2++) Xa(s2[r2], e2) || s2[r2].__clip(t2, e2);
  }
} };
var { LEAF: Ua, create: ja } = g;
var { stintSet: Va } = _;
var { toInnerPoint: Ha, toOuterPoint: Ga, multiplyParent: qa } = Q;
var { toOuterOf: Qa } = Ft;
var { copy: Ja, move: Za } = at;
var { getScaleFixedData: $a } = M;
var { moveLocal: Ka, zoomOfLocal: th, rotateOfLocal: eh, skewOfLocal: sh, moveWorld: rh, zoomOfWorld: ih, rotateOfWorld: nh, skewOfWorld: oh, transform: ah, transformWorld: hh, setTransform: lh, getFlipTransform: dh, getLocalOrigin: ch, getRelativeWorld: uh, drop: _h } = uo;
var ph = class {
  get tag() {
    return this.__tag;
  }
  set tag(t2) {
  }
  get __tag() {
    return "Leaf";
  }
  get innerName() {
    return this.__.name || this.tag + this.innerId;
  }
  get __DataProcessor() {
    return f;
  }
  get __LayoutProcessor() {
    return Xo;
  }
  get leaferIsCreated() {
    return this.leafer && this.leafer.created;
  }
  get leaferIsReady() {
    return this.leafer && this.leafer.ready;
  }
  get isLeafer() {
    return false;
  }
  get isBranch() {
    return false;
  }
  get isBranchLeaf() {
    return false;
  }
  get __localMatrix() {
    return this.__local || this.__layout;
  }
  get __localBoxBounds() {
    return this.__local || this.__layout;
  }
  get worldTransform() {
    return this.__layout.getTransform("world");
  }
  get localTransform() {
    return this.__layout.getTransform("local");
  }
  get scrollWorldTransform() {
    return this.updateLayout(), this.__scrollWorld || this.__world;
  }
  get boxBounds() {
    return this.getBounds("box", "inner");
  }
  get renderBounds() {
    return this.getBounds("render", "inner");
  }
  get worldBoxBounds() {
    return this.getBounds("box");
  }
  get worldStrokeBounds() {
    return this.getBounds("stroke");
  }
  get worldRenderBounds() {
    return this.getBounds("render");
  }
  get worldOpacity() {
    return this.updateLayout(), this.__worldOpacity;
  }
  get __worldFlipped() {
    return this.__world.scaleX < 0 || this.__world.scaleY < 0;
  }
  get __onlyHitMask() {
    return this.__hasMask && !this.__.hitChildren;
  }
  get __ignoreHitWorld() {
    return (this.__hasMask || this.__hasEraser) && this.__.hitChildren;
  }
  get __inLazyBounds() {
    return this.leaferIsCreated && this.leafer.lazyBounds.hit(this.__world);
  }
  get pathInputed() {
    return this.__.__pathInputed;
  }
  set event(t2) {
    this.on(t2);
  }
  constructor(t2) {
    this.innerId = ja(Ua), this.reset(t2), this.__bubbleMap && this.__emitLifeEvent(Fo.CREATED);
  }
  reset(t2) {
    this.leafer && this.leafer.forceRender(this.__world), 0 !== t2 && (this.__world = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1 }, null !== t2 && (this.__local = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, x: 0, y: 0, width: 0, height: 0 })), this.__worldOpacity = 1, this.__ = new this.__DataProcessor(this), this.__layout = new this.__LayoutProcessor(this), this.__level && this.resetCustom(), t2 && (t2.__ && (t2 = t2.toJSON()), t2.children ? this.set(t2) : Object.assign(this, t2));
  }
  resetCustom() {
    this.__hasMask = this.__hasEraser = null, this.forceUpdate();
  }
  waitParent(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.parent ? t2() : this.on(Fo.ADD, t2, "once");
  }
  waitLeafer(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.leafer ? t2() : this.on(Fo.MOUNTED, t2, "once");
  }
  nextRender(t2, e2, s2) {
    this.leafer ? this.leafer.nextRender(t2, e2, s2) : this.waitLeafer(() => this.leafer.nextRender(t2, e2, s2));
  }
  removeNextRender(t2) {
    this.nextRender(t2, null, "off");
  }
  __bindLeafer(t2) {
    if (this.isLeafer && null !== t2 && (t2 = this), this.leafer && !t2 && this.leafer.leafs--, this.leafer = t2, t2 ? (t2.leafs++, this.__level = this.parent ? this.parent.__level + 1 : 1, this.animation && this.__runAnimation("in"), this.__bubbleMap && this.__emitLifeEvent(Fo.MOUNTED), t2.cacheId && uo.cacheId(this)) : this.__emitLifeEvent(Fo.UNMOUNTED), this.isBranch) {
      const { children: e2 } = this;
      for (let s2 = 0, r2 = e2.length; s2 < r2; s2++) e2[s2].__bindLeafer(t2);
    }
  }
  set(t2, e2) {
  }
  get(t2) {
  }
  setAttr(t2, e2) {
    this[t2] = e2;
  }
  getAttr(t2) {
    return this[t2];
  }
  getComputedAttr(t2) {
    return this.__[t2];
  }
  toJSON(t2) {
    return t2 && this.__layout.update(), this.__.__getInputData(null, t2);
  }
  toString(t2) {
    return JSON.stringify(this.toJSON(t2));
  }
  toSVG() {
  }
  __SVG(t2) {
  }
  toHTML() {
  }
  __setAttr(t2, e2) {
    return true;
  }
  __getAttr(t2) {
  }
  setProxyAttr(t2, e2) {
  }
  getProxyAttr(t2) {
  }
  find(t2, e2) {
  }
  findTag(t2) {
  }
  findOne(t2, e2) {
  }
  findId(t2) {
  }
  focus(t2) {
  }
  updateState() {
  }
  updateLayout() {
    this.__layout.update();
  }
  forceUpdate(t2) {
    s(t2) ? t2 = "width" : "surface" === t2 && (t2 = "blendMode");
    const e2 = this.__.__getInput(t2);
    this.__[t2] = s(e2) ? null : void 0, this[t2] = e2;
  }
  forceRender(t2, e2) {
    this.forceUpdate("surface");
  }
  __extraUpdate() {
    this.leaferIsReady && this.leafer.layouter.addExtra(this);
  }
  __updateWorldMatrix() {
  }
  __updateLocalMatrix() {
  }
  __updateWorldBounds() {
  }
  __updateLocalBounds() {
  }
  __updateLocalBoxBounds() {
  }
  __updateLocalStrokeBounds() {
  }
  __updateLocalRenderBounds() {
  }
  __updateBoxBounds(t2, e2) {
  }
  __updateContentBounds() {
  }
  __updateStrokeBounds(t2) {
  }
  __updateRenderBounds(t2) {
  }
  __updateAutoLayout() {
  }
  __updateFlowLayout() {
  }
  __updateNaturalSize() {
  }
  __updateStrokeSpread() {
    return 0;
  }
  __updateRenderSpread() {
    return 0;
  }
  __onUpdateSize() {
  }
  __updateEraser(t2) {
    this.__hasEraser = !!t2 || this.children.some((t3) => t3.__.eraser);
  }
  __renderEraser(t2, e2) {
    t2.save(), this.__clip(t2, e2);
    const { renderBounds: s2 } = this.__layout;
    t2.clearRect(s2.x, s2.y, s2.width, s2.height), t2.restore();
  }
  __updateMask(t2) {
    this.__hasMask = this.children.some((t3) => t3.__.mask && t3.__.visible && t3.__.opacity);
  }
  __renderMask(t2, e2) {
  }
  __getNowWorld(t2) {
    if (t2.matrix) {
      this.__cameraWorld || (this.__cameraWorld = {});
      const e2 = this.__cameraWorld, s2 = this.__world;
      return qa(s2, t2.matrix, e2, void 0, s2), Qa(this.__layout.renderBounds, e2, e2), Va(e2, "half", s2.half), Va(e2, "ignorePixelSnap", s2.ignorePixelSnap), e2;
    }
    return this.__world;
  }
  getClampRenderScale() {
    let { scaleX: t2 } = this.__nowWorld || this.__world;
    return t2 < 0 && (t2 = -t2), t2 > 1 ? t2 : 1;
  }
  getRenderScaleData(t2, e2, s2 = true) {
    return $a(sn.patternLocked ? this.__world : this.__nowWorld || this.__world, e2, s2, t2);
  }
  getTransform(t2) {
    return this.__layout.getTransform(t2 || "local");
  }
  getBounds(t2, e2) {
    return this.__layout.getBounds(t2, e2);
  }
  getLayoutBounds(t2, e2, s2) {
    return this.__layout.getLayoutBounds(t2, e2, s2);
  }
  getLayoutPoints(t2, e2) {
    return this.__layout.getLayoutPoints(t2, e2);
  }
  getWorldBounds(t2, e2, s2) {
    const r2 = e2 ? uh(this, e2) : this.worldTransform, i2 = s2 ? t2 : {};
    return Qa(t2, r2, i2), i2;
  }
  worldToLocal(t2, e2, s2, r2) {
    this.parent ? this.parent.worldToInner(t2, e2, s2, r2) : e2 && Ja(e2, t2);
  }
  localToWorld(t2, e2, s2, r2) {
    this.parent ? this.parent.innerToWorld(t2, e2, s2, r2) : e2 && Ja(e2, t2);
  }
  worldToInner(t2, e2, s2, r2) {
    r2 && (r2.innerToWorld(t2, e2, s2), t2 = e2 || t2), Ha(this.worldTransform, t2, e2, s2);
  }
  innerToWorld(t2, e2, s2, r2) {
    Ga(this.worldTransform, t2, e2, s2), r2 && r2.worldToInner(e2 || t2, null, s2);
  }
  getBoxPoint(t2, e2, s2, r2) {
    const i2 = this.getInnerPoint(t2, e2, s2, r2);
    return s2 ? i2 : this.getBoxPointByInner(i2, null, null, true);
  }
  getBoxPointByInner(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : Object.assign({}, t2), { x: n2, y: o2 } = this.boxBounds;
    return Za(i2, -n2, -o2), i2;
  }
  getInnerPoint(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : {};
    return this.worldToInner(t2, i2, s2, e2), i2;
  }
  getInnerPointByBox(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : Object.assign({}, t2), { x: n2, y: o2 } = this.boxBounds;
    return Za(i2, n2, o2), i2;
  }
  getInnerPointByLocal(t2, e2, s2, r2) {
    return this.getInnerPoint(t2, this.parent, s2, r2);
  }
  getLocalPoint(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : {};
    return this.worldToLocal(t2, i2, s2, e2), i2;
  }
  getLocalPointByInner(t2, e2, s2, r2) {
    return this.getWorldPoint(t2, this.parent, s2, r2);
  }
  getPagePoint(t2, e2, s2, r2) {
    return (this.leafer ? this.leafer.zoomLayer : this).getInnerPoint(t2, e2, s2, r2);
  }
  getWorldPoint(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : {};
    return this.innerToWorld(t2, i2, s2, e2), i2;
  }
  getWorldPointByBox(t2, e2, s2, r2) {
    return this.getWorldPoint(this.getInnerPointByBox(t2, null, null, r2), e2, s2, true);
  }
  getWorldPointByLocal(t2, e2, s2, r2) {
    const i2 = r2 ? t2 : {};
    return this.localToWorld(t2, i2, s2, e2), i2;
  }
  getWorldPointByPage(t2, e2, s2, r2) {
    return (this.leafer ? this.leafer.zoomLayer : this).getWorldPoint(t2, e2, s2, r2);
  }
  setTransform(t2, e2, s2) {
    lh(this, t2, e2, s2);
  }
  transform(t2, e2, s2) {
    ah(this, t2, e2, s2);
  }
  move(t2, e2, s2) {
    Ka(this, t2, e2, s2);
  }
  moveInner(t2, e2, s2) {
    rh(this, t2, e2, true, s2);
  }
  scaleOf(t2, e2, s2, r2, i2) {
    th(this, ch(this, t2), e2, s2, r2, i2);
  }
  rotateOf(t2, e2, s2) {
    eh(this, ch(this, t2), e2, s2);
  }
  skewOf(t2, e2, s2, r2, i2) {
    sh(this, ch(this, t2), e2, s2, r2, i2);
  }
  transformWorld(t2, e2, s2) {
    hh(this, t2, e2, s2);
  }
  moveWorld(t2, e2, s2) {
    rh(this, t2, e2, false, s2);
  }
  scaleOfWorld(t2, e2, s2, r2, i2) {
    ih(this, t2, e2, s2, r2, i2);
  }
  rotateOfWorld(t2, e2) {
    nh(this, t2, e2);
  }
  skewOfWorld(t2, e2, s2, r2, i2) {
    oh(this, t2, e2, s2, r2, i2);
  }
  flip(t2, e2) {
    ah(this, dh(this, t2), false, e2);
  }
  scaleResize(t2, e2 = t2, s2) {
    this.scaleX *= t2, this.scaleY *= e2;
  }
  __scaleResize(t2, e2) {
  }
  resizeWidth(t2) {
  }
  resizeHeight(t2) {
  }
  hit(t2, e2) {
    return true;
  }
  __hitWorld(t2, e2) {
    return true;
  }
  __hit(t2, e2) {
    return true;
  }
  __hitFill(t2) {
    return true;
  }
  __hitStroke(t2, e2) {
    return true;
  }
  __hitPixel(t2) {
    return true;
  }
  __drawHitPath(t2) {
  }
  __updateHitCanvas() {
  }
  __render(t2, e2) {
  }
  __drawFast(t2, e2) {
  }
  __draw(t2, e2, s2) {
  }
  __clip(t2, e2) {
  }
  __renderShape(t2, e2) {
  }
  __drawShape(t2, e2) {
  }
  __updateWorldOpacity() {
  }
  __updateChange() {
  }
  __drawPath(t2) {
  }
  __drawRenderPath(t2) {
  }
  __updatePath() {
  }
  __updateRenderPath(t2) {
  }
  getMotionPathData() {
    return le.need("path");
  }
  getMotionPoint(t2) {
    return le.need("path");
  }
  getMotionTotal() {
    return 0;
  }
  __updateMotionPath() {
  }
  __runAnimation(t2, e2) {
  }
  __updateSortChildren() {
  }
  add(t2, e2) {
  }
  remove(t2, e2) {
    this.parent && this.parent.remove(this, e2);
  }
  dropTo(t2, e2, s2) {
    _h(this, t2, e2, s2);
  }
  on(t2, e2, s2) {
  }
  off(t2, e2, s2) {
  }
  on_(t2, e2, s2, r2) {
  }
  off_(t2) {
  }
  once(t2, e2, s2, r2) {
  }
  emit(t2, e2, s2) {
  }
  emitEvent(t2, e2) {
  }
  hasEvent(t2, e2) {
    return false;
  }
  static changeAttr(t2, e2, s2) {
    s2 ? this.addAttr(t2, e2, s2) : jn(this.prototype, t2, e2);
  }
  static addAttr(t2, e2, s2, r2) {
    s2 || (s2 = Bn), s2(e2, r2)(this.prototype, t2);
  }
  __emitLifeEvent(t2) {
    this.hasEvent(t2) && this.emitEvent(new Fo(t2, this, this.parent));
  }
  destroy() {
    this.destroyed || (this.parent && this.remove(), this.children && this.clear(), this.__emitLifeEvent(Fo.DESTROY), this.__.destroy(), this.__layout.destroy(), this.destroyEventer(), this.destroyed = true);
  }
};
ph = me([Zn(va), Zn(La), Zn(Da), Zn(ba), Zn(Ya)], ph);
var { setListWithFn: fh } = Ft;
var { sort: gh } = ko;
var { localBoxBounds: yh, localStrokeBounds: mh, localRenderBounds: xh, maskLocalBoxBounds: wh, maskLocalStrokeBounds: bh, maskLocalRenderBounds: Bh } = wo;
var vh = new se("Branch");
var kh = class extends ph {
  __updateStrokeSpread() {
    const { children: t2 } = this;
    for (let e2 = 0, s2 = t2.length; e2 < s2; e2++) if (t2[e2].__layout.strokeSpread) return 1;
    return 0;
  }
  __updateRenderSpread() {
    let t2;
    const { children: e2 } = this;
    for (let s2 = 0, r2 = e2.length; s2 < r2; s2++) if (t2 = e2[s2].__layout, t2.renderSpread || t2.localOuterBounds) return 1;
    return 0;
  }
  __updateBoxBounds(t2, e2) {
    fh(e2 || this.__layout.boxBounds, this.children, this.__hasMask ? wh : yh);
  }
  __updateStrokeBounds(t2) {
    fh(t2 || this.__layout.strokeBounds, this.children, this.__hasMask ? bh : mh);
  }
  __updateRenderBounds(t2) {
    fh(t2 || this.__layout.renderBounds, this.children, this.__hasMask ? Bh : xh);
  }
  __updateSortChildren() {
    let t2;
    const { children: e2 } = this;
    if (e2.length > 1) {
      for (let s2 = 0, r2 = e2.length; s2 < r2; s2++) e2[s2].__tempNumber = s2, e2[s2].__.zIndex && (t2 = true);
      e2.sort(gh), this.__layout.affectChildrenSort = t2;
    }
  }
  add(t2, e2) {
    if (t2 === this || t2.destroyed) return vh.warn("add self or destroyed");
    const r2 = s(e2);
    if (!t2.__) {
      if (l(t2)) return t2.forEach((t3) => {
        this.add(t3, e2), r2 || e2++;
      });
      if (!(t2 = ue.get(t2.tag, t2))) return;
    }
    t2.parent && t2.parent.remove(t2), t2.parent = this, r2 ? this.children.push(t2) : this.children.splice(e2, 0, t2), t2.isBranch && (this.__.__childBranchNumber = (this.__.__childBranchNumber || 0) + 1);
    const i2 = t2.__layout;
    i2.boxChanged || i2.boxChange(), i2.matrixChanged || i2.matrixChange(), t2.__bubbleMap && t2.__emitLifeEvent(Fo.ADD), this.leafer && (t2.__bindLeafer(this.leafer), this.leafer.created && this.__emitChildEvent(Fo.ADD, t2)), this.__layout.affectChildrenSort && this.__layout.childrenSortChange();
  }
  addMany(...t2) {
    this.add(t2);
  }
  remove(t2, e2) {
    t2 ? t2.__ ? t2.animationOut ? t2.__runAnimation("out", () => this.__remove(t2, e2)) : this.__remove(t2, e2) : this.find(t2).forEach((t3) => this.remove(t3, e2)) : s(t2) && super.remove(null, e2);
  }
  removeAll(t2) {
    const { children: e2 } = this;
    e2.length && (this.children = [], this.__preRemove(), this.__.__childBranchNumber = 0, e2.forEach((e3) => {
      this.__realRemoveChild(e3), t2 && e3.destroy();
    }));
  }
  clear() {
    this.removeAll(true);
  }
  __remove(t2, e2) {
    const s2 = this.children.indexOf(t2);
    s2 > -1 && (this.children.splice(s2, 1), t2.isBranch && (this.__.__childBranchNumber = (this.__.__childBranchNumber || 1) - 1), this.__preRemove(), this.__realRemoveChild(t2), e2 && t2.destroy());
  }
  __preRemove() {
    this.__hasMask && this.__updateMask(), this.__hasEraser && this.__updateEraser(), this.__layout.boxChange(), this.__layout.affectChildrenSort && this.__layout.childrenSortChange();
  }
  __realRemoveChild(t2) {
    t2.__emitLifeEvent(Fo.REMOVE), t2.parent = null, this.leafer && (t2.__bindLeafer(null), this.leafer.created && (this.__emitChildEvent(Fo.REMOVE, t2), this.leafer.hitCanvasManager && this.leafer.hitCanvasManager.clear()));
  }
  __emitChildEvent(t2, e2) {
    const s2 = new Fo(t2, e2, this);
    this.hasEvent(t2) && !this.isLeafer && this.emitEvent(s2), this.leafer.emitEvent(s2);
  }
};
kh = me([Zn(Fa)], kh);
var Ch = class _Ch {
  get length() {
    return this.list.length;
  }
  constructor(t2) {
    this.reset(), t2 && (l(t2) ? this.addList(t2) : this.add(t2));
  }
  has(t2) {
    return t2 && !s(this.keys[t2.innerId]);
  }
  indexAt(t2) {
    return this.list[t2];
  }
  indexOf(t2) {
    const e2 = this.keys[t2.innerId];
    return s(e2) ? -1 : e2;
  }
  add(t2) {
    const { list: e2, keys: r2 } = this;
    s(r2[t2.innerId]) && (e2.push(t2), r2[t2.innerId] = e2.length - 1);
  }
  addAt(t2, e2 = 0) {
    const { keys: r2 } = this;
    if (s(r2[t2.innerId])) {
      const { list: s2 } = this;
      for (let t3 = e2, i2 = s2.length; t3 < i2; t3++) r2[s2[t3].innerId]++;
      0 === e2 ? s2.unshift(t2) : (e2 > s2.length && (e2 = s2.length), s2.splice(e2, 0, t2)), r2[t2.innerId] = e2;
    }
  }
  addList(t2) {
    for (let e2 = 0; e2 < t2.length; e2++) this.add(t2[e2]);
  }
  remove(t2) {
    const { list: e2 } = this;
    let r2;
    for (let i2 = 0, n2 = e2.length; i2 < n2; i2++) s(r2) ? e2[i2].innerId === t2.innerId && (r2 = i2, delete this.keys[t2.innerId]) : this.keys[e2[i2].innerId] = i2 - 1;
    s(r2) || e2.splice(r2, 1);
  }
  sort(t2) {
    const { list: e2 } = this;
    t2 ? e2.sort((t3, e3) => e3.__level - t3.__level) : e2.sort((t3, e3) => t3.__level - e3.__level);
  }
  forEach(t2) {
    this.list.forEach(t2);
  }
  clone() {
    const t2 = new _Ch();
    return t2.list = [...this.list], t2.keys = Object.assign({}, this.keys), t2;
  }
  update() {
    this.keys = {};
    const { list: t2, keys: e2 } = this;
    for (let s2 = 0, r2 = t2.length; s2 < r2; s2++) e2[t2[s2].innerId] = s2;
  }
  reset() {
    this.list = [], this.keys = {};
  }
  destroy() {
    this.reset();
  }
};
var Oh = class {
  get length() {
    return this._length;
  }
  constructor(t2) {
    this._length = 0, this.reset(), t2 && (l(t2) ? this.addList(t2) : this.add(t2));
  }
  has(t2) {
    return !s(this.keys[t2.innerId]);
  }
  without(t2) {
    return s(this.keys[t2.innerId]);
  }
  sort(t2) {
    const { levels: e2 } = this;
    t2 ? e2.sort((t3, e3) => e3 - t3) : e2.sort((t3, e3) => t3 - e3);
  }
  addList(t2) {
    t2.forEach((t3) => {
      this.add(t3);
    });
  }
  add(t2) {
    const { keys: e2, levelMap: s2 } = this;
    e2[t2.innerId] || (e2[t2.innerId] = 1, s2[t2.__level] ? s2[t2.__level].push(t2) : (s2[t2.__level] = [t2], this.levels.push(t2.__level)), this._length++);
  }
  forEach(t2) {
    let e2;
    this.levels.forEach((s2) => {
      e2 = this.levelMap[s2];
      for (let s3 = 0, r2 = e2.length; s3 < r2; s3++) t2(e2[s3]);
    });
  }
  reset() {
    this.levelMap = {}, this.keys = {}, this.levels = [], this._length = 0;
  }
  destroy() {
    this.levelMap = null;
  }
};

// node_modules/@leafer-ui/draw/lib/draw.esm.min.js
function mt2(t2, e2, i2, s2) {
  var o2, r2 = arguments.length, a = r2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2;
  if ("object" == typeof Reflect && "function" == typeof Reflect.decorate) a = Reflect.decorate(t2, e2, i2, s2);
  else for (var n2 = t2.length - 1; n2 >= 0; n2--) (o2 = t2[n2]) && (a = (r2 < 3 ? o2(a) : r2 > 3 ? o2(e2, i2, a) : o2(e2, i2)) || a);
  return r2 > 3 && a && Object.defineProperty(e2, i2, a), a;
}
function kt2(t2) {
  return _n(t2, (t3) => pn({ set(e2) {
    this.__setAttr(t3, e2), e2 && (this.__.__useEffect = true);
    const i2 = this.__layout;
    i2.renderChanged || i2.renderChange(), i2.surfaceChange();
  } }));
}
function Rt2(t2) {
  return _n(t2, (t3) => pn({ set(e2) {
    this.__setAttr(t3, e2), this.__layout.boxChanged || this.__layout.boxChange(), this.__updateSize();
  } }));
}
function At2() {
  return (e2, i2) => {
    const s2 = "_" + i2;
    dn(e2, i2, { set(t2) {
      this.isLeafer && (this[s2] = t2);
    }, get() {
      return this.isApp ? this.tree.zoomLayer : this.isLeafer ? this[s2] || this : this.leafer && this.leafer.zoomLayer;
    } });
  };
}
var Ct2 = {};
var bt2 = { hasTransparent: function(t2) {
  if (!t2 || 7 === t2.length || 4 === t2.length) return false;
  if ("transparent" === t2) return true;
  const e2 = t2[0];
  if ("#" === e2) switch (t2.length) {
    case 5:
      return "f" !== t2[4] && "F" !== t2[4];
    case 9:
      return "f" !== t2[7] && "F" !== t2[7] || "f" !== t2[8] && "F" !== t2[8];
  }
  else if (("r" === e2 || "h" === e2) && "a" === t2[3]) {
    const e3 = t2.lastIndexOf(",");
    if (e3 > -1) return parseFloat(t2.slice(e3 + 1)) < 1;
  }
  return false;
} };
var Pt2 = Qt;
var Ft2 = {};
var Wt2 = {};
var Dt2 = {};
var Tt2 = {};
var Et2 = {};
var It2 = { apply() {
  le.need("filter");
} };
var Lt2 = {};
var zt2 = { setStyleName: () => le.need("state"), set: () => le.need("state") };
var { parse: Ot2, objectToCanvasData: Nt2 } = rr;
var { stintSet: Vt2 } = _;
var { hasTransparent: Ht2 } = bt2;
var Yt2 = { originPaint: {} };
var Ut2 = se.get("UIData");
var Xt2 = class extends f {
  get scale() {
    const { scaleX: t2, scaleY: e2 } = this;
    return t2 !== e2 ? { x: t2, y: e2 } : t2;
  }
  get __strokeWidth() {
    return this.__getRealStrokeWidth();
  }
  get __maxStrokeWidth() {
    const t2 = this, e2 = t2.__hasStrokeSides || t2.strokeWidth;
    return t2.__hasMultiStrokeStyle ? Math.max(t2.__hasMultiStrokeStyle, e2) : e2;
  }
  get __hasMultiPaint() {
    const t2 = this;
    return t2.fill && this.__useStroke || t2.__isFills && t2.fill.length > 1 || t2.__isStrokes && t2.stroke.length > 1 || t2.__useEffect;
  }
  get __clipAfterFill() {
    const t2 = this;
    return t2.cornerRadius || t2.innerShadow || t2.__pathInputed;
  }
  get __hasSurface() {
    return this.fill || this.stroke;
  }
  get __autoWidth() {
    return null == this._width;
  }
  get __autoHeight() {
    return null == this._height;
  }
  get __autoSide() {
    return null == this._width || null == this._height;
  }
  get __autoSize() {
    return null == this._width && null == this._height;
  }
  setVisible(t2) {
    this._visible = t2;
    const { leafer: e2 } = this.__leaf;
    e2 && (e2.watcher.hasVisible = true);
  }
  setWidth(t2) {
    t2 < 0 ? (this._width = -t2, this.__leaf.scaleX *= -1, Ut2.warn("width < 0, instead -scaleX ", this)) : this._width = t2;
  }
  setHeight(t2) {
    t2 < 0 ? (this._height = -t2, this.__leaf.scaleY *= -1, Ut2.warn("height < 0, instead -scaleY", this)) : this._height = t2;
  }
  setFill(t2) {
    this.__naturalWidth && this.__removeNaturalSize(), i(t2) || !t2 ? (Vt2(this, "__isTransparentFill", Ht2(t2)), this.__isFills && this.__removePaint("fill", true), this._fill = t2) : d(t2) && this.__setPaint("fill", t2);
  }
  setStroke(t2) {
    i(t2) || !t2 ? (Vt2(this, "__isTransparentStroke", Ht2(t2)), this.__isStrokes && this.__removePaint("stroke", true), this._stroke = t2) : d(t2) && this.__setPaint("stroke", t2);
  }
  setPath(t2) {
    const e2 = i(t2);
    e2 || t2 && d(t2[0]) ? (this.__setInput("path", t2), this._path = e2 ? Ot2(t2) : Nt2(t2)) : (this.__input && this.__removeInput("path"), this._path = t2);
  }
  setShadow(t2) {
    jt2(this, "shadow", t2);
  }
  setInnerShadow(t2) {
    jt2(this, "innerShadow", t2);
  }
  setFilter(t2) {
    jt2(this, "filter", t2);
  }
  __computePaint() {
    const { fill: t2, stroke: e2 } = this.__input;
    t2 && Wt2.compute("fill", this.__leaf), e2 && Wt2.compute("stroke", this.__leaf), this.__needComputePaint = void 0;
  }
  __getRealStrokeWidth(t2) {
    let { strokeWidth: e2, strokeScaleFixed: i2 } = this;
    if (t2 && (t2.strokeWidth && (e2 = t2.strokeWidth), s(t2.strokeScaleFixed) || (i2 = t2.strokeScaleFixed)), i2) {
      const { scaleX: t3 } = this.__leaf.getRenderScaleData(true, i2, false);
      if (1 !== t3) return e2 * t3;
    }
    return e2;
  }
  __checkComplex() {
    const t2 = this;
    Vt2(t2, "__complex", t2.__isFills || t2.__isStrokes || t2.cornerRadius || t2.__useEffect);
  }
  __setPaint(t2, e2) {
    this.__setInput(t2, e2);
    const i2 = this.__leaf.__layout;
    i2.boxChanged || i2.boxChange(), l(e2) && !e2.length ? this.__removePaint(t2) : "fill" === t2 ? (this.__isFills = true, this._fill || (this._fill = Yt2)) : (this.__isStrokes = true, this._stroke || (this._stroke = Yt2));
  }
  __removePaint(t2, e2) {
    e2 && this.__removeInput(t2), Dt2.recycleImage(t2, this), "fill" === t2 ? (Vt2(this, "__isAlphaPixelFill", void 0), this._fill = this.__isFills = void 0) : (Vt2(this, "__isAlphaPixelStroke", void 0), Vt2(this, "__hasMultiStrokeStyle", void 0), this._stroke = this.__isStrokes = void 0);
  }
};
function jt2(t2, e2, i2) {
  t2.__setInput(e2, i2), l(i2) ? (i2.some((t3) => false === t3.visible) && (i2 = i2.filter((t3) => false !== t3.visible)), i2.length || (i2 = void 0)) : i2 = i2 && false !== i2.visible ? [i2] : void 0, t2["_" + e2] = i2;
}
var Jt2 = class extends Xt2 {
};
var qt2 = class extends Jt2 {
  get __boxStroke() {
    return !this.__pathInputed;
  }
  get __drawAfterFill() {
    return this.__single || this.__clipAfterFill;
  }
  get __clipAfterFill() {
    const t2 = this;
    return "show" !== t2.overflow && t2.__leaf.children.length && (t2.__leaf.isOverflow || super.__clipAfterFill);
  }
};
var Gt2 = class extends Jt2 {
  __getInputData(t2, e2) {
    const i2 = super.__getInputData(t2, e2);
    return Ee.forEach((t3) => delete i2[t3]), i2;
  }
};
var $t2 = class extends qt2 {
};
var Kt2 = class extends Xt2 {
  get __usePathBox() {
    return this.points || this.__pathInputed;
  }
};
var Qt2 = class extends Xt2 {
  get __boxStroke() {
    return !this.__pathInputed;
  }
};
var Zt2 = class extends Xt2 {
  get __boxStroke() {
    return !this.__pathInputed;
  }
};
var te2 = class extends Kt2 {
};
var ee2 = class extends Xt2 {
  get __boxStroke() {
    return !this.__pathInputed;
  }
};
var ie2 = class extends Xt2 {
  get __pathInputed() {
    return 2;
  }
};
var se2 = class extends Jt2 {
};
var oe2 = { thin: 100, "extra-light": 200, light: 300, normal: 400, medium: 500, "semi-bold": 600, bold: 700, "extra-bold": 800, black: 900 };
var re2 = class extends Xt2 {
  get __useNaturalRatio() {
    return false;
  }
  setFontWeight(t2) {
    i(t2) ? (this.__setInput("fontWeight", t2), t2 = oe2[t2] || 400) : this.__input && this.__removeInput("fontWeight"), this._fontWeight = t2;
  }
  setBoxStyle(t2) {
    let e2 = this.__leaf, i2 = e2.__box;
    if (t2) {
      const { boxStyle: s2 } = this;
      if (i2) for (let t3 in s2) i2[t3] = void 0;
      else i2 = e2.__box = ue.get("Rect", 0);
      const o2 = e2.__layout, r2 = i2.__layout;
      s2 || (i2.parent = e2, i2.__world = e2.__world, r2.boxBounds = o2.boxBounds), i2.set(t2), r2.strokeChanged && o2.strokeChange();
    } else i2 && (e2.__box = i2.parent = null, i2.destroy());
    this._boxStyle = t2;
  }
  __getInputData(t2, e2) {
    const i2 = super.__getInputData(t2, e2);
    return i2.textEditing && delete i2.textEditing, i2;
  }
};
var ae2 = class extends Qt2 {
  get __urlType() {
    return "image";
  }
  setUrl(t2) {
    this.__setImageFill(t2), this._url = t2;
  }
  __setImageFill(t2) {
    this.fill = t2 ? { type: this.__urlType, mode: "stretch", url: t2 } : void 0;
  }
  __getData() {
    const t2 = super.__getData();
    return t2.url && delete t2.fill, t2;
  }
  __getInputData(t2, e2) {
    const i2 = super.__getInputData(t2, e2);
    return i2.url && delete i2.fill, i2;
  }
};
var ne2 = class extends Qt2 {
  get __isCanvas() {
    return true;
  }
  get __drawAfterFill() {
    return true;
  }
  __getInputData(t2, e2) {
    const i2 = super.__getInputData(t2, e2);
    return i2.url = this.__leaf.canvas.toDataURL("image/png"), i2;
  }
};
var { max: _e2, add: he2 } = v;
var de2 = { __updateStrokeSpread() {
  let t2 = 0, e2 = 0;
  const i2 = this.__, { strokeAlign: s2, __maxStrokeWidth: o2 } = i2, r2 = this.__box;
  if ((i2.stroke || "all" === i2.hitStroke) && o2 && "inside" !== s2 && (e2 = t2 = "center" === s2 ? o2 / 2 : o2, !i2.__boxStroke || i2.__useArrow)) {
    const e3 = i2.__isLinePath ? 0 : 10 * t2, s3 = "none" === i2.strokeCap ? 0 : o2;
    t2 += Math.max(e3, s3);
  }
  return i2.__useArrow && (t2 += 5 * o2), r2 && (t2 = _e2(t2, r2.__layout.strokeSpread = r2.__updateStrokeSpread()), e2 = Math.max(e2, r2.__layout.strokeBoxSpread)), this.__layout.strokeBoxSpread = e2, t2;
}, __updateRenderSpread() {
  let t2 = 0;
  const { shadow: e2, innerShadow: i2, blur: s2, backgroundBlur: o2, filter: r2, renderSpread: a } = this.__, { strokeSpread: n2 } = this.__layout, _2 = this.__box;
  e2 && (t2 = Et2.getShadowRenderSpread(this, e2)), s2 && (t2 = _e2(t2, s2)), r2 && (t2 = he2(t2, It2.getSpread(r2))), a && (t2 = he2(t2, a)), n2 && (t2 = he2(t2, n2));
  let h = t2;
  return i2 && (h = _e2(h, Et2.getInnerShadowSpread(this, i2))), o2 && (h = _e2(h, o2)), this.__layout.renderShapeSpread = h, _2 ? _e2(_2.__updateRenderSpread(), t2) : t2;
} };
var { stintSet: le2 } = _;
var pe2 = { __updateChange() {
  const t2 = this.__;
  if (t2.__useStroke) {
    const e2 = t2.__useStroke = !(!t2.stroke || !t2.strokeWidth);
    le2(this.__world, "half", e2 && "center" === t2.strokeAlign && t2.strokeWidth % 2), le2(t2, "__fillAfterStroke", e2 && "outside" === t2.strokeAlign && t2.fill && !t2.__isTransparentFill);
  }
  if (t2.__useEffect) {
    const { shadow: e2, fill: i2, stroke: s2 } = t2, o2 = t2.innerShadow || t2.blur || t2.backgroundBlur || t2.filter;
    le2(t2, "__isFastShadow", e2 && !o2 && e2.length < 2 && !e2[0].spread && !Et2.isTransformShadow(e2[0]) && i2 && !t2.__isTransparentFill && !(l(i2) && i2.length > 1) && (this.useFastShadow || !s2 || s2 && "inside" === t2.strokeAlign)), t2.__useEffect = !(!e2 && !o2);
  }
  t2.__checkSingle(), t2.__checkComplex();
}, __drawFast(t2, e2) {
  ue2(this, t2, e2);
}, __draw(t2, e2, i2) {
  const s2 = this.__;
  if (s2.__complex) {
    s2.__needComputePaint && s2.__computePaint();
    const { fill: o2, stroke: r2, __drawAfterFill: a, __fillAfterStroke: n2, __isFastShadow: _2 } = s2;
    if (this.__drawRenderPath(t2), s2.__useEffect && !_2) {
      const _3 = Wt2.shape(this, t2, e2);
      this.__nowWorld = this.__getNowWorld(e2);
      const { shadow: h, innerShadow: d2, filter: l2 } = s2;
      h && Et2.shadow(this, t2, _3), n2 && (s2.__isStrokes ? Wt2.strokes(r2, this, t2, e2) : Wt2.stroke(r2, this, t2, e2)), o2 && (s2.__isFills ? Wt2.fills(o2, this, t2, e2) : Wt2.fill(o2, this, t2, e2)), a && this.__drawAfterFill(t2, e2), d2 && Et2.innerShadow(this, t2, _3), r2 && !n2 && (s2.__isStrokes ? Wt2.strokes(r2, this, t2, e2) : Wt2.stroke(r2, this, t2, e2)), l2 && It2.apply(l2, this, this.__nowWorld, t2, i2, _3), _3.worldCanvas && _3.worldCanvas.recycle(), _3.canvas.recycle();
    } else {
      if (n2 && (s2.__isStrokes ? Wt2.strokes(r2, this, t2, e2) : Wt2.stroke(r2, this, t2, e2)), _2) {
        const e3 = s2.shadow[0], { scaleX: i3, scaleY: o3 } = this.getRenderScaleData(true, e3.scaleFixed);
        t2.save(), t2.setWorldShadow(e3.x * i3, e3.y * o3, e3.blur * i3, bt2.string(e3.color));
      }
      o2 && (s2.__isFills ? Wt2.fills(o2, this, t2, e2) : Wt2.fill(o2, this, t2, e2)), _2 && t2.restore(), a && this.__drawAfterFill(t2, e2), r2 && !n2 && (s2.__isStrokes ? Wt2.strokes(r2, this, t2, e2) : Wt2.stroke(r2, this, t2, e2));
    }
  } else s2.__pathForRender ? ue2(this, t2, e2) : this.__drawFast(t2, e2);
}, __drawShape(t2, e2) {
  this.__drawRenderPath(t2);
  const i2 = this.__, { fill: s2, stroke: o2 } = i2;
  s2 && !e2.ignoreFill && (i2.__isAlphaPixelFill ? Wt2.fills(s2, this, t2, e2) : Wt2.fill("#000000", this, t2, e2)), i2.__isCanvas && this.__drawAfterFill(t2, e2), o2 && !e2.ignoreStroke && (i2.__isAlphaPixelStroke ? Wt2.strokes(o2, this, t2, e2) : Wt2.stroke("#000000", this, t2, e2));
}, __drawAfterFill(t2, e2) {
  this.__.__clipAfterFill ? (t2.save(), t2.clipUI(this), this.__drawContent(t2, e2), t2.restore()) : this.__drawContent(t2, e2);
} };
function ue2(t2, e2, i2) {
  const { fill: s2, stroke: o2, __drawAfterFill: r2, __fillAfterStroke: a } = t2.__;
  t2.__drawRenderPath(e2), a && Wt2.stroke(o2, t2, e2, i2), s2 && Wt2.fill(s2, t2, e2, i2), r2 && t2.__drawAfterFill(e2, i2), o2 && !a && Wt2.stroke(o2, t2, e2, i2);
}
var ce2 = { __drawFast(t2, e2) {
  let { x: i2, y: s2, width: o2, height: r2 } = this.__layout.boxBounds;
  const { fill: a, stroke: n2, __drawAfterFill: _2 } = this.__;
  if (a && (t2.fillStyle = a, t2.fillRect(i2, s2, o2, r2)), _2 && this.__drawAfterFill(t2, e2), n2) {
    const { strokeAlign: a2, __strokeWidth: _3 } = this.__;
    if (!_3) return;
    t2.setStroke(n2, _3, this.__);
    const h = _3 / 2;
    switch (a2) {
      case "center":
        t2.strokeRect(0, 0, o2, r2);
        break;
      case "inside":
        o2 -= _3, r2 -= _3, o2 < 0 || r2 < 0 ? (t2.save(), this.__clip(t2, e2), t2.strokeRect(i2 + h, s2 + h, o2, r2), t2.restore()) : t2.strokeRect(i2 + h, s2 + h, o2, r2);
        break;
      case "outside":
        t2.strokeRect(i2 - h, s2 - h, o2 + _3, r2 + _3);
    }
  }
} };
var ge2;
var ye2 = ge2 = class extends ph {
  get app() {
    return this.leafer && this.leafer.app;
  }
  get isFrame() {
    return false;
  }
  set strokeWidthFixed(t2) {
    this.strokeScaleFixed = t2;
  }
  get strokeWidthFixed() {
    return this.strokeScaleFixed;
  }
  set scale(t2) {
    M.assignScale(this, t2);
  }
  get scale() {
    return this.__.scale;
  }
  get isAutoWidth() {
    const t2 = this.__;
    return t2.__autoWidth || t2.autoWidth;
  }
  get isAutoHeight() {
    const t2 = this.__;
    return t2.__autoHeight || t2.autoHeight;
  }
  get pen() {
    const { path: t2 } = this.__;
    return Vi.set(this.path = t2 || []), t2 || this.__drawPathByBox(Vi), Vi;
  }
  reset(t2) {
  }
  set(t2, e2) {
    t2 && Object.assign(this, t2);
  }
  get(t2) {
    return i(t2) ? this.__.__getInput(t2) : this.__.__getInputData(t2);
  }
  createProxyData() {
  }
  clearProxyData() {
  }
  find(t2, e2) {
    return le.need("find");
  }
  findTag(t2) {
    return this.find({ tag: t2 });
  }
  findOne(t2, e2) {
    return le.need("find");
  }
  findId(t2) {
    return this.findOne({ id: t2 });
  }
  getPath(t2, e2) {
    this.__layout.update();
    let i2 = e2 ? this.__.__pathForRender : this.__.path;
    return i2 || (Vi.set(i2 = []), this.__drawPathByBox(Vi, !e2)), t2 ? rr.toCanvasData(i2, true) : i2;
  }
  getPathString(t2, e2, i2) {
    return rr.stringify(this.getPath(t2, e2), i2);
  }
  asPath(t2, e2) {
    this.path = this.getPath(t2, e2);
  }
  load() {
    this.__.__computePaint();
  }
  __onUpdateSize() {
    if (this.__.__input) {
      const t2 = this.__;
      !t2.lazy || this.__inLazyBounds || Lt2.running ? t2.__computePaint() : t2.__needComputePaint = true;
    }
  }
  __updateRenderPath(t2) {
    const e2 = this.__;
    e2.path ? (e2.__pathForRender = e2.cornerRadius || e2.path.radius ? Ui.smooth(e2.path, e2.cornerRadius, e2.cornerSmoothing) : e2.path, e2.__useArrow && Ft2.addArrows(this, t2)) : e2.__pathForRender && (e2.__pathForRender = void 0);
  }
  __drawRenderPath(t2) {
    const e2 = this.__;
    t2.beginPath(), e2.__useArrow && Ft2.updateArrow(this), this.__drawPathByData(t2, e2.__pathForRender);
  }
  __drawPath(t2) {
    t2.beginPath(), this.__drawPathByData(t2, this.__.path, true);
  }
  __drawPathByData(t2, e2, i2) {
    e2 ? ii.drawPathByData(t2, e2) : this.__drawPathByBox(t2, i2);
  }
  __drawPathByBox(t2, e2) {
    const { x: i2, y: s2, width: o2, height: r2 } = this.__layout.boxBounds;
    if (this.__.cornerRadius && !e2) {
      const { cornerRadius: e3 } = this.__;
      t2.roundRect(i2, s2, o2, r2, o(e3) ? [e3] : e3);
    } else t2.rect(i2, s2, o2, r2);
    t2.closePath();
  }
  drawImagePlaceholder(t2, e2, i2) {
    Wt2.fill(this.__.placeholderColor, this, e2, i2);
  }
  animate(t2, e2, i2, s2) {
    return this.set(t2), le.need("animate");
  }
  killAnimate(t2, e2) {
  }
  export(t2, e2) {
    return le.need("export");
  }
  syncExport(t2, e2) {
    return le.need("export");
  }
  clone(t2) {
    const e2 = _.clone(this.toJSON());
    return t2 && Object.assign(e2, t2), ge2.one(e2);
  }
  static one(t2, e2, i2, s2, o2) {
    return ue.get(t2.tag || this.prototype.__tag, t2, e2, i2, s2, o2);
  }
  static registerUI() {
    $n()(this);
  }
  static registerData(t2) {
    Fn(t2)(this.prototype);
  }
  static setEditConfig(t2) {
  }
  static setEditOuter(t2) {
  }
  static setEditInner(t2) {
  }
  destroy() {
    this.__.__willDestroy = true, this.fill = this.stroke = null, this.__animate && this.killAnimate(), super.destroy();
  }
};
mt2([Fn(Xt2)], ye2.prototype, "__", void 0), mt2([At2()], ye2.prototype, "zoomLayer", void 0), mt2([gn("")], ye2.prototype, "id", void 0), mt2([gn("")], ye2.prototype, "name", void 0), mt2([gn("")], ye2.prototype, "className", void 0), mt2([Rn("pass-through")], ye2.prototype, "blendMode", void 0), mt2([In(1)], ye2.prototype, "opacity", void 0), mt2([Mn(true)], ye2.prototype, "visible", void 0), mt2([Rn(false)], ye2.prototype, "locked", void 0), mt2([En(false)], ye2.prototype, "dim", void 0), mt2([En(false)], ye2.prototype, "dimskip", void 0), mt2([Nn(0)], ye2.prototype, "zIndex", void 0), mt2([Dn(false)], ye2.prototype, "mask", void 0), mt2([Yn(false)], ye2.prototype, "eraser", void 0), mt2([yn(0, true)], ye2.prototype, "x", void 0), mt2([yn(0, true)], ye2.prototype, "y", void 0), mt2([Bn(100, true)], ye2.prototype, "width", void 0), mt2([Bn(100, true)], ye2.prototype, "height", void 0), mt2([wn(1, true)], ye2.prototype, "scaleX", void 0), mt2([wn(1, true)], ye2.prototype, "scaleY", void 0), mt2([bn(0, true)], ye2.prototype, "rotation", void 0), mt2([bn(0, true)], ye2.prototype, "skewX", void 0), mt2([bn(0, true)], ye2.prototype, "skewY", void 0), mt2([yn(0, true)], ye2.prototype, "offsetX", void 0), mt2([yn(0, true)], ye2.prototype, "offsetY", void 0), mt2([mn(0, true)], ye2.prototype, "scrollX", void 0), mt2([mn(0, true)], ye2.prototype, "scrollY", void 0), mt2([xn()], ye2.prototype, "origin", void 0), mt2([xn()], ye2.prototype, "around", void 0), mt2([gn(false)], ye2.prototype, "lazy", void 0), mt2([vn(1)], ye2.prototype, "pixelRatio", void 0), mt2([Ln(0)], ye2.prototype, "renderSpread", void 0), mt2([Cn()], ye2.prototype, "path", void 0), mt2([On()], ye2.prototype, "windingRule", void 0), mt2([On(true)], ye2.prototype, "closed", void 0), mt2([Bn(0)], ye2.prototype, "padding", void 0), mt2([Bn(false)], ye2.prototype, "lockRatio", void 0), mt2([Bn()], ye2.prototype, "widthRange", void 0), mt2([Bn()], ye2.prototype, "heightRange", void 0), mt2([gn(false)], ye2.prototype, "draggable", void 0), mt2([gn()], ye2.prototype, "dragBounds", void 0), mt2([gn("auto")], ye2.prototype, "dragBoundsType", void 0), mt2([gn(false)], ye2.prototype, "editable", void 0), mt2([Xn(true)], ye2.prototype, "hittable", void 0), mt2([Xn("path")], ye2.prototype, "hitFill", void 0), mt2([Sn("path")], ye2.prototype, "hitStroke", void 0), mt2([Xn(false)], ye2.prototype, "hitBox", void 0), mt2([Xn(true)], ye2.prototype, "hitChildren", void 0), mt2([Xn(true)], ye2.prototype, "hitSelf", void 0), mt2([Xn()], ye2.prototype, "hitRadius", void 0), mt2([zn("")], ye2.prototype, "cursor", void 0), mt2([Rn()], ye2.prototype, "fill", void 0), mt2([Sn(void 0, true)], ye2.prototype, "stroke", void 0), mt2([Sn("inside")], ye2.prototype, "strokeAlign", void 0), mt2([Sn(1, true)], ye2.prototype, "strokeWidth", void 0), mt2([Sn(false)], ye2.prototype, "strokeScaleFixed", void 0), mt2([Sn("none")], ye2.prototype, "strokeCap", void 0), mt2([Sn("miter")], ye2.prototype, "strokeJoin", void 0), mt2([Sn()], ye2.prototype, "dashPattern", void 0), mt2([Sn(0)], ye2.prototype, "dashOffset", void 0), mt2([Sn(10)], ye2.prototype, "miterLimit", void 0), mt2([On(0)], ye2.prototype, "cornerRadius", void 0), mt2([On()], ye2.prototype, "cornerSmoothing", void 0), mt2([kt2()], ye2.prototype, "shadow", void 0), mt2([kt2()], ye2.prototype, "innerShadow", void 0), mt2([kt2()], ye2.prototype, "blur", void 0), mt2([kt2()], ye2.prototype, "backgroundBlur", void 0), mt2([kt2()], ye2.prototype, "grayscale", void 0), mt2([kt2()], ye2.prototype, "filter", void 0), mt2([Rn()], ye2.prototype, "placeholderColor", void 0), mt2([gn(100)], ye2.prototype, "placeholderDelay", void 0), mt2([gn({})], ye2.prototype, "data", void 0), mt2([qn(ph.prototype.reset)], ye2.prototype, "reset", null), ye2 = ge2 = mt2([Zn(de2), Zn(pe2), Qn()], ye2);
var ve2 = class extends ye2 {
  get __tag() {
    return "Group";
  }
  get isBranch() {
    return true;
  }
  reset(t2) {
    this.__setBranch(), super.reset(t2);
  }
  __setBranch() {
    this.children || (this.children = []);
  }
  set(t2, e2) {
    if (t2) if (t2.children) {
      const { children: i2 } = t2;
      delete t2.children, this.children ? this.clear() : this.__setBranch(), super.set(t2, e2), i2.forEach((t3) => this.add(t3)), t2.children = i2;
    } else super.set(t2, e2);
  }
  toJSON(t2) {
    const e2 = super.toJSON(t2);
    if (!this.childlessJSON) {
      const i2 = e2.children = [];
      this.children.forEach((e3) => e3.skipJSON || i2.push(e3.toJSON(t2)));
    }
    return e2;
  }
  pick(t2, e2) {
  }
  addAt(t2, e2) {
    this.add(t2, e2);
  }
  addAfter(t2, e2) {
    this.add(t2, this.children.indexOf(e2) + 1);
  }
  addBefore(t2, e2) {
    this.add(t2, this.children.indexOf(e2));
  }
  add(t2, e2) {
  }
  addMany(...t2) {
  }
  remove(t2, e2) {
  }
  removeAll(t2) {
  }
  clear() {
  }
};
var fe2;
mt2([Fn(Jt2)], ve2.prototype, "__", void 0), mt2([Bn(0)], ve2.prototype, "width", void 0), mt2([Bn(0)], ve2.prototype, "height", void 0), ve2 = mt2([Zn(kh), $n()], ve2);
var we2 = se.get("Leafer");
var xe2 = fe2 = class extends ve2 {
  get __tag() {
    return "Leafer";
  }
  get isApp() {
    return false;
  }
  get app() {
    return this.parent || this;
  }
  get isLeafer() {
    return true;
  }
  get imageReady() {
    return this.viewReady && tn.isComplete;
  }
  get layoutLocked() {
    return !this.layouter.running;
  }
  get view() {
    return this.canvas && this.canvas.view;
  }
  get FPS() {
    return this.renderer ? this.renderer.FPS : 60;
  }
  get cursorPoint() {
    return this.interaction && this.interaction.hoverData || { x: this.width / 2, y: this.height / 2 };
  }
  get clientBounds() {
    return this.canvas && this.canvas.getClientBounds(true) || X();
  }
  constructor(t2, e2) {
    super(e2), this.config = { start: true, hittable: true, smooth: true, lazySpeard: 100 }, this.leafs = 0, this.__eventIds = [], this.__controllers = [], this.__readyWait = [], this.__viewReadyWait = [], this.__viewCompletedWait = [], this.__nextRenderWait = [], this.userConfig = t2, t2 && (t2.view || t2.width) && this.init(t2), fe2.list.add(this);
  }
  init(t2, e2) {
    if (this.canvas) return;
    let i2;
    const { config: s2 } = this;
    this.__setLeafer(this), e2 && (this.parentApp = e2, this.__bindApp(e2), i2 = e2.running), t2 && (this.parent = e2, this.initType(t2.type), this.parent = void 0, _.assign(s2, t2));
    const o2 = this.canvas = de.canvas(s2);
    this.__controllers.push(this.renderer = de.renderer(this, o2, s2), this.watcher = de.watcher(this, s2), this.layouter = de.layouter(this, s2)), this.isApp && this.__setApp(), this.__checkAutoLayout(), e2 || (this.selector = de.selector(this), this.interaction = de.interaction(this, o2, this.selector, s2), this.interaction && (this.__controllers.unshift(this.interaction), this.hitCanvasManager = de.hitCanvasManager()), this.canvasManager = new ye(), i2 = s2.start), this.hittable = s2.hittable, this.fill = s2.fill, this.canvasManager.add(o2), this.__listenEvents(), i2 && (this.__startTimer = setTimeout(this.start.bind(this))), Lo.run(this.__initWait), this.onInit();
  }
  onInit() {
  }
  initType(t2) {
  }
  set(t2, e2) {
    this.waitInit(() => {
      super.set(t2, e2);
    });
  }
  start() {
    clearTimeout(this.__startTimer), !this.running && this.canvas && (this.running = true, this.ready ? this.emitLeafer(ra.RESTART) : this.emitLeafer(ra.START), this.__controllers.forEach((t2) => t2.start()), this.isApp || this.renderer.render());
  }
  stop() {
    clearTimeout(this.__startTimer), this.running && this.canvas && (this.__controllers.forEach((t2) => t2.stop()), this.running = false, this.emitLeafer(ra.STOP));
  }
  unlockLayout(t2 = true) {
    this.layouter.start(), t2 && this.updateLayout();
  }
  lockLayout(t2 = true) {
    t2 && this.updateLayout(), this.layouter.stop();
  }
  resize(t2) {
    const e2 = _.copyAttrs({}, t2, Ee);
    Object.keys(e2).forEach((t3) => this[t3] = e2[t3]);
  }
  forceRender(t2, e2) {
    const { renderer: i2 } = this;
    i2 && (i2.addBlock(t2 ? new Ht(t2) : this.canvas.bounds), this.viewReady && (e2 ? i2.render() : i2.update()));
  }
  requestRender(t2 = false) {
    this.renderer && this.renderer.update(t2);
  }
  updateCursor(t2) {
    const e2 = this.interaction;
    e2 && (t2 ? e2.setCursor(t2) : e2.updateCursor());
  }
  updateLazyBounds() {
    this.lazyBounds = this.canvas.bounds.clone().spread(this.config.lazySpeard);
  }
  __doResize(t2) {
    const { canvas: e2 } = this;
    if (!e2 || e2.isSameSize(t2)) return;
    const i2 = _.copyAttrs({}, this.canvas, Ee);
    e2.resize(t2), this.updateLazyBounds(), this.__onResize(new Ko(t2, i2));
  }
  __onResize(t2) {
    this.emitEvent(t2), _.copyAttrs(this.__, t2, Ee), setTimeout(() => {
      this.canvasManager && this.canvasManager.clearRecycled();
    }, 0);
  }
  __setApp() {
  }
  __bindApp(t2) {
    this.selector = t2.selector, this.interaction = t2.interaction, this.canvasManager = t2.canvasManager, this.hitCanvasManager = t2.hitCanvasManager;
  }
  __setLeafer(t2) {
    this.leafer = t2, this.__level = 1;
  }
  __checkAutoLayout() {
    const { config: t2, parentApp: e2 } = this;
    e2 || (t2.width && t2.height || (this.autoLayout = new qt(t2)), this.canvas.startAutoLayout(this.autoLayout, this.__onResize.bind(this)));
  }
  __setAttr(t2, e2) {
    return this.canvas && (Ee.includes(t2) ? this.__changeCanvasSize(t2, e2) : "fill" === t2 ? this.__changeFill(e2) : "hittable" === t2 ? this.parent || (this.canvas.hittable = e2) : "zIndex" === t2 ? (this.canvas.zIndex = e2, setTimeout(() => this.parent && this.parent.__updateSortChildren())) : "mode" === t2 && this.emit(ra.UPDATE_MODE, { mode: e2 })), super.__setAttr(t2, e2);
  }
  __getAttr(t2) {
    return this.canvas && Ee.includes(t2) ? this.canvas[t2] : super.__getAttr(t2);
  }
  __changeCanvasSize(t2, e2) {
    const { config: i2, canvas: s2 } = this, o2 = _.copyAttrs({}, s2, Ee);
    o2[t2] = i2[t2] = e2, i2.width && i2.height ? s2.stopAutoLayout() : this.__checkAutoLayout(), this.__doResize(o2);
  }
  __changeFill(t2) {
    this.config.fill = t2, this.canvas.allowBackgroundColor ? this.canvas.backgroundColor = t2 : this.forceRender();
  }
  __onCreated() {
    this.created = true;
  }
  __onReady() {
    this.ready = true, this.emitLeafer(ra.BEFORE_READY), this.emitLeafer(ra.READY), this.emitLeafer(ra.AFTER_READY), Lo.run(this.__readyWait);
  }
  __onViewReady() {
    this.viewReady || (this.viewReady = true, this.emitLeafer(ra.VIEW_READY), Lo.run(this.__viewReadyWait));
  }
  __onLayoutEnd() {
    const { grow: t2, width: e2, height: i2 } = this.config;
    if (t2) {
      let { width: s2, height: o2, pixelRatio: r2 } = this;
      const a = "box" === t2 ? this.worldBoxBounds : this.__world;
      e2 || (s2 = Math.max(1, a.x + a.width)), i2 || (o2 = Math.max(1, a.y + a.height)), this.__doResize({ width: s2, height: o2, pixelRatio: r2 });
    }
    this.ready || this.__onReady();
  }
  __onNextRender() {
    if (this.viewReady) {
      Lo.run(this.__nextRenderWait);
      const { imageReady: t2 } = this;
      t2 && !this.viewCompleted && this.__checkViewCompleted(), t2 || (this.viewCompleted = false, this.requestRender());
    } else this.requestRender();
  }
  __checkViewCompleted(t2 = true) {
    this.nextRender(() => {
      this.imageReady && (t2 && this.emitLeafer(ra.VIEW_COMPLETED), Lo.run(this.__viewCompletedWait), this.viewCompleted = true);
    });
  }
  __onWatchData() {
    this.watcher.childrenChanged && this.interaction && this.nextRender(() => this.interaction.updateCursor());
  }
  waitInit(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.__initWait || (this.__initWait = []), this.canvas ? t2() : this.__initWait.push(t2);
  }
  waitReady(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.ready ? t2() : this.__readyWait.push(t2);
  }
  waitViewReady(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.viewReady ? t2() : this.__viewReadyWait.push(t2);
  }
  waitViewCompleted(t2, e2) {
    e2 && (t2 = t2.bind(e2)), this.__viewCompletedWait.push(t2), this.viewCompleted ? this.__checkViewCompleted(false) : this.running || this.start();
  }
  nextRender(t2, e2, i2) {
    e2 && (t2 = t2.bind(e2));
    const s2 = this.__nextRenderWait;
    if (i2) {
      for (let e3 = 0; e3 < s2.length; e3++) if (s2[e3] === t2) {
        s2.splice(e3, 1);
        break;
      }
    } else s2.push(t2);
    this.requestRender();
  }
  zoom(t2, e2, i2, s2) {
    return le.need("view");
  }
  getValidMove(t2, e2, i2) {
    return { x: t2, y: e2 };
  }
  getValidScale(t2) {
    return t2;
  }
  getWorldPointByClient(t2, e2) {
    return this.interaction && this.interaction.getLocal(t2, e2);
  }
  getPagePointByClient(t2, e2) {
    return this.getPagePoint(this.getWorldPointByClient(t2, e2));
  }
  getClientPointByWorld(t2) {
    const { x: e2, y: i2 } = this.clientBounds;
    return { x: e2 + t2.x, y: i2 + t2.y };
  }
  updateClientBounds() {
    this.canvas && this.canvas.updateClientBounds();
  }
  receiveEvent(t2) {
  }
  emitLeafer(t2) {
    this.emitEvent(new ra(t2, this));
  }
  __listenEvents() {
    const t2 = oe.start("FirstCreate " + this.innerName);
    this.once([[ra.START, () => oe.end(t2)], [ea.START, this.updateLazyBounds, this], [sa.START, this.__onCreated, this], [sa.END, this.__onViewReady, this]]), this.__eventIds.push(this.on_([[ta.DATA, this.__onWatchData, this], [ea.END, this.__onLayoutEnd, this], [sa.NEXT, this.__onNextRender, this]]));
  }
  __removeListenEvents() {
    this.off_(this.__eventIds);
  }
  destroy(t2) {
    const e2 = () => {
      if (!this.destroyed) {
        fe2.list.remove(this);
        try {
          this.stop(), this.emitLeafer(ra.END), this.__removeListenEvents(), this.__controllers.forEach((t3) => !(this.parent && t3 === this.interaction) && t3.destroy()), this.__controllers.length = 0, this.parent || (this.selector && this.selector.destroy(), this.hitCanvasManager && this.hitCanvasManager.destroy(), this.canvasManager && this.canvasManager.destroy()), this.canvas && this.canvas.destroy(), this.config.view = this.parentApp = null, this.userConfig && (this.userConfig.view = null), super.destroy(), setTimeout(() => {
            sn.clearRecycled();
          }, 100);
        } catch (t3) {
          we2.error(t3);
        }
      }
    };
    t2 ? e2() : setTimeout(e2);
  }
};
xe2.list = new Ch(), mt2([Fn(Gt2)], xe2.prototype, "__", void 0), mt2([Bn()], xe2.prototype, "pixelRatio", void 0), mt2([gn("normal")], xe2.prototype, "mode", void 0), xe2 = fe2 = mt2([$n()], xe2);
var Se2 = class extends ye2 {
  get __tag() {
    return "Rect";
  }
};
mt2([Fn(Qt2)], Se2.prototype, "__", void 0), Se2 = mt2([Zn(ce2), Qn(), $n()], Se2);
var { add: me2, includes: ke2, scroll: Re2 } = Ft;
var Ae2 = Se2.prototype;
var Be2 = ve2.prototype;
var Ce2 = class extends ve2 {
  get __tag() {
    return "Box";
  }
  get isBranchLeaf() {
    return true;
  }
  get __useSelfBox() {
    return this.pathInputed;
  }
  constructor(t2) {
    super(t2), this.__layout.renderChanged || this.__layout.renderChange();
  }
  __updateStrokeSpread() {
    return 0;
  }
  __updateRectRenderSpread() {
    return 0;
  }
  __updateRenderSpread() {
    return this.__updateRectRenderSpread() || -1;
  }
  __updateRectBoxBounds() {
  }
  __updateBoxBounds(t2) {
    if (this.children.length && !this.__useSelfBox) {
      const t3 = this.__;
      if (t3.__autoSide) {
        t3.__hasSurface && this.__extraUpdate(), super.__updateBoxBounds();
        const { boxBounds: e2 } = this.__layout;
        t3.__autoSize || (t3.__autoWidth ? (e2.width += e2.x, e2.x = 0, e2.height = t3.height, e2.y = 0) : (e2.height += e2.y, e2.y = 0, e2.width = t3.width, e2.x = 0)), this.__updateNaturalSize();
      } else this.__updateRectBoxBounds();
    } else this.__updateRectBoxBounds();
  }
  __updateStrokeBounds() {
  }
  __updateRenderBounds() {
    let t2, e2;
    if (this.children.length) {
      const i2 = this.__, s2 = this.__layout, { renderBounds: o2, boxBounds: r2 } = s2, { overflow: a } = i2, n2 = s2.childrenRenderBounds || (s2.childrenRenderBounds = X());
      super.__updateRenderBounds(n2), (e2 = a && a.includes("scroll")) && (me2(n2, r2), Re2(n2, i2)), this.__updateRectRenderBounds(), t2 = !ke2(r2, n2), t2 && "show" === a && me2(o2, n2);
    } else this.__updateRectRenderBounds();
    _.stintSet(this, "isOverflow", t2), this.__checkScroll(e2);
  }
  __updateRectRenderBounds() {
  }
  __checkScroll(t2) {
  }
  __updateRectChange() {
  }
  __updateChange() {
    super.__updateChange(), this.__updateRectChange();
  }
  __renderRect(t2, e2) {
  }
  __renderGroup(t2, e2) {
  }
  __render(t2, e2) {
    this.__.__drawAfterFill ? this.__renderRect(t2, e2) : (this.__renderRect(t2, e2), this.children.length && this.__renderGroup(t2, e2)), this.hasScroller && this.scroller.__render(t2, e2);
  }
  __drawContent(t2, e2) {
    this.__renderGroup(t2, e2), (this.__.__useStroke || this.__.__useEffect) && (t2.setWorld(this.__nowWorld), this.__drawRenderPath(t2));
  }
};
mt2([Fn(qt2)], Ce2.prototype, "__", void 0), mt2([Bn(100)], Ce2.prototype, "width", void 0), mt2([Bn(100)], Ce2.prototype, "height", void 0), mt2([gn(false)], Ce2.prototype, "resizeChildren", void 0), mt2([Ln("show")], Ce2.prototype, "overflow", void 0), mt2([qn(Ae2.__updateStrokeSpread)], Ce2.prototype, "__updateStrokeSpread", null), mt2([qn(Ae2.__updateRenderSpread)], Ce2.prototype, "__updateRectRenderSpread", null), mt2([qn(Ae2.__updateBoxBounds)], Ce2.prototype, "__updateRectBoxBounds", null), mt2([qn(Ae2.__updateStrokeBounds)], Ce2.prototype, "__updateStrokeBounds", null), mt2([qn(Ae2.__updateRenderBounds)], Ce2.prototype, "__updateRectRenderBounds", null), mt2([qn(Ae2.__updateChange)], Ce2.prototype, "__updateRectChange", null), mt2([qn(Ae2.__render)], Ce2.prototype, "__renderRect", null), mt2([qn(Be2.__render)], Ce2.prototype, "__renderGroup", null), Ce2 = mt2([Qn(), $n()], Ce2);
var be2 = class extends Ce2 {
  get __tag() {
    return "Frame";
  }
  get isFrame() {
    return true;
  }
};
mt2([Fn($t2)], be2.prototype, "__", void 0), mt2([Rn("#FFFFFF")], be2.prototype, "fill", void 0), mt2([Ln("hide")], be2.prototype, "overflow", void 0), be2 = mt2([$n()], be2);
var { moveTo: Pe2, closePath: Fe2, ellipse: We2 } = Or;
var De2 = class extends ye2 {
  get __tag() {
    return "Ellipse";
  }
  __updatePath() {
    const t2 = this.__, { width: e2, height: i2, innerRadius: s2, startAngle: o2, endAngle: r2 } = t2, a = e2 / 2, n2 = i2 / 2, _2 = t2.path = [];
    let h;
    s2 ? o2 || r2 ? (s2 < 1 ? We2(_2, a, n2, a * s2, n2 * s2, 0, o2, r2, false) : h = true, We2(_2, a, n2, a, n2, 0, r2, o2, true)) : (s2 < 1 && (We2(_2, a, n2, a * s2, n2 * s2), Pe2(_2, e2, n2)), We2(_2, a, n2, a, n2, 0, 360, 0, true)) : o2 || r2 ? (Pe2(_2, a, n2), We2(_2, a, n2, a, n2, 0, o2, r2, false)) : We2(_2, a, n2, a, n2), h || Fe2(_2), (Kt.ellipseToCurve || t2.__useArrow || t2.cornerRadius) && (t2.path = this.getPath(true));
  }
};
mt2([Fn(Zt2)], De2.prototype, "__", void 0), mt2([On(0)], De2.prototype, "innerRadius", void 0), mt2([On(0)], De2.prototype, "startAngle", void 0), mt2([On(0)], De2.prototype, "endAngle", void 0), De2 = mt2([$n()], De2);
var { sin: Te2, cos: Ee2, PI: Ie2 } = Math;
var { moveTo: Le2, lineTo: ze2, closePath: Me2, drawPoints: Oe2 } = Or;
var Ne2 = class extends ye2 {
  get __tag() {
    return "Polygon";
  }
  __updatePath() {
    const t2 = this.__, e2 = t2.path = [];
    if (t2.points) Oe2(e2, t2.points, t2.curve, t2.closed);
    else {
      const { width: i2, height: s2, sides: o2, startAngle: r2 } = t2, a = i2 / 2, n2 = s2 / 2;
      let _2, h = 0;
      r2 ? (h = r2 * W, Le2(e2, a + a * Te2(h), n2 - n2 * Ee2(h))) : Le2(e2, a, 0);
      for (let t3 = 1; t3 < o2; t3++) _2 = 2 * t3 * Ie2 / o2 + h, ze2(e2, a + a * Te2(_2), n2 - n2 * Ee2(_2));
      Me2(e2);
    }
  }
};
mt2([Fn(te2)], Ne2.prototype, "__", void 0), mt2([On(3)], Ne2.prototype, "sides", void 0), mt2([On(0)], Ne2.prototype, "startAngle", void 0), mt2([On()], Ne2.prototype, "points", void 0), mt2([On(0)], Ne2.prototype, "curve", void 0), Ne2 = mt2([Qn(), $n()], Ne2);
var { sin: Ve2, cos: He2, PI: Ye2 } = Math;
var { moveTo: Ue2, lineTo: Xe2, closePath: je2 } = Or;
var Je2 = class extends ye2 {
  get __tag() {
    return "Star";
  }
  __updatePath() {
    const { width: t2, height: e2, corners: i2, innerRadius: s2, startAngle: o2 } = this.__, r2 = t2 / 2, a = e2 / 2, n2 = this.__.path = [];
    let _2, h = 0;
    o2 ? (h = o2 * W, Ue2(n2, r2 + r2 * Ve2(h), a - a * He2(h))) : Ue2(n2, r2, 0);
    for (let t3 = 1; t3 < 2 * i2; t3++) _2 = t3 * Ye2 / i2 + h, Xe2(n2, r2 + (t3 % 2 == 0 ? r2 : r2 * s2) * Ve2(_2), a - (t3 % 2 == 0 ? a : a * s2) * He2(_2));
    je2(n2);
  }
};
mt2([Fn(ee2)], Je2.prototype, "__", void 0), mt2([On(5)], Je2.prototype, "corners", void 0), mt2([On(0.382)], Je2.prototype, "innerRadius", void 0), mt2([On(0)], Je2.prototype, "startAngle", void 0), Je2 = mt2([$n()], Je2);
var { moveTo: qe2, lineTo: Ge2, drawPoints: $e2 } = Or;
var { rotate: Ke2, getAngle: Qe2, getDistance: Ze2, defaultPoint: ti2 } = at;
var ei2 = class extends ye2 {
  get __tag() {
    return "Line";
  }
  get toPoint() {
    const { width: t2, rotation: e2 } = this.__, i2 = Y();
    return t2 && (i2.x = t2), e2 && Ke2(i2, e2), i2;
  }
  set toPoint(t2) {
    this.width = Ze2(ti2, t2), this.rotation = Qe2(ti2, t2), this.height && (this.height = 0);
  }
  __updatePath() {
    const t2 = this.__, e2 = t2.path = [];
    t2.points ? $e2(e2, t2.points, t2.curve, t2.closed) : (qe2(e2, 0, 0), Ge2(e2, this.width, 0));
  }
};
mt2([Fn(Kt2)], ei2.prototype, "__", void 0), mt2([Tn("center")], ei2.prototype, "strokeAlign", void 0), mt2([Bn(0)], ei2.prototype, "height", void 0), mt2([On()], ei2.prototype, "points", void 0), mt2([On(0)], ei2.prototype, "curve", void 0), mt2([On(false)], ei2.prototype, "closed", void 0), ei2 = mt2([$n()], ei2);
var ii2 = class extends Se2 {
  get __tag() {
    return "Image";
  }
  get ready() {
    const { image: t2 } = this;
    return t2 && t2.ready;
  }
  get image() {
    const { fill: t2 } = this.__;
    return l(t2) && t2[0].image;
  }
};
mt2([Fn(ae2)], ii2.prototype, "__", void 0), mt2([Bn("")], ii2.prototype, "url", void 0), ii2 = mt2([$n()], ii2);
var oi2 = class extends Se2 {
  get __tag() {
    return "Canvas";
  }
  get context() {
    return this.canvas.context;
  }
  get ready() {
    return !this.url;
  }
  constructor(t2) {
    super(t2), this.canvas = de.canvas(this.__), t2 && t2.url && this.drawImage(t2.url);
  }
  drawImage(t2) {
    new an({ url: t2 }).load((t3) => {
      this.context.drawImage(t3.view, 0, 0), this.url = void 0, this.paint(), this.emitEvent(new Ho(Ho.LOADED, { image: t3 }));
    });
  }
  draw(t2, e2, i2, s2) {
    const o2 = new ft(t2.worldTransform).invert(), r2 = new ft();
    e2 && r2.translate(e2.x, e2.y), i2 && (o(i2) ? r2.scale(i2) : r2.scale(i2.x, i2.y)), s2 && r2.rotate(s2), o2.multiplyParent(r2), t2.__render(this.canvas, { matrix: o2.withScale() }), this.paint();
  }
  paint() {
    this.forceRender();
  }
  __drawContent(t2, e2) {
    const { width: i2, height: s2 } = this.__, { view: o2 } = this.canvas;
    t2.drawImage(o2, 0, 0, o2.width, o2.height, 0, 0, i2, s2);
  }
  __updateSize() {
    const { canvas: t2 } = this;
    if (t2) {
      const { smooth: e2, safeResize: i2 } = this.__;
      t2.resize(this.__, i2), t2.smooth !== e2 && (t2.smooth = e2);
    }
  }
  destroy() {
    this.canvas && (this.canvas.destroy(), this.canvas = null), super.destroy();
  }
};
mt2([Fn(ne2)], oi2.prototype, "__", void 0), mt2([Rt2(100)], oi2.prototype, "width", void 0), mt2([Rt2(100)], oi2.prototype, "height", void 0), mt2([Rt2(1)], oi2.prototype, "pixelRatio", void 0), mt2([Rt2(true)], oi2.prototype, "smooth", void 0), mt2([gn(false)], oi2.prototype, "safeResize", void 0), mt2([Rt2()], oi2.prototype, "contextSettings", void 0), oi2 = mt2([$n()], oi2);
var { copyAndSpread: ri2, includes: ai2, spread: ni2, setList: _i2 } = Ft;
var { stintSet: hi2 } = _;
var di2 = class extends ye2 {
  get __tag() {
    return "Text";
  }
  get textDrawData() {
    return this.updateLayout(), this.__.__textDrawData;
  }
  __updateTextDrawData() {
    const t2 = this.__, { lineHeight: e2, letterSpacing: i2, fontFamily: s2, fontSize: o2, fontWeight: r2, italic: a, textCase: n2, textOverflow: _2, padding: h, width: d2, height: l2 } = t2;
    t2.__lineHeight = Pt2.number(e2, o2), t2.__letterSpacing = Pt2.number(i2, o2), t2.__baseLine = t2.__lineHeight - (t2.__lineHeight - 0.7 * o2) / 2, t2.__font = `${a ? "italic " : ""}${"small-caps" === n2 ? "small-caps " : ""}${"normal" !== r2 ? r2 + " " : ""}${o2 || 12}px ${s2 || "caption"}`, hi2(t2, "__padding", h && M.fourNumber(h)), hi2(t2, "__clipText", "show" !== _2 && !t2.__autoSize), hi2(t2, "__isCharMode", d2 || l2 || t2.__letterSpacing || "none" !== n2), t2.__textDrawData = Ct2.getDrawData((t2.__isPlacehold = t2.placeholder && "" === t2.text) ? t2.placeholder : t2.text, this.__);
  }
  __updateBoxBounds() {
    const t2 = this.__, e2 = this.__layout, { fontSize: i2, italic: s2, padding: o2, __autoWidth: r2, __autoHeight: a } = t2;
    this.__updateTextDrawData();
    const { bounds: _2 } = t2.__textDrawData, h = e2.boxBounds;
    if (e2.contentBounds = _2, t2.__lineHeight < i2 && ni2(_2, i2 / 2), r2 || a) {
      if (h.x = r2 ? _2.x : 0, h.y = a ? _2.y : 0, h.width = r2 ? _2.width : t2.width, h.height = a ? _2.height : t2.height, o2) {
        const [e3, i3, s3, o3] = t2.__padding;
        r2 && (h.x -= o3, h.width += i3 + o3), a && (h.y -= e3, h.height += s3 + e3);
      }
      this.__updateNaturalSize();
    } else super.__updateBoxBounds();
    s2 && (h.width += 0.16 * i2), _.stintSet(this, "isOverflow", !ai2(h, _2)), this.isOverflow ? (_i2(t2.__textBoxBounds = {}, [h, _2]), e2.renderChanged = true) : t2.__textBoxBounds = h;
  }
  __updateRenderSpread() {
    let t2 = super.__updateRenderSpread();
    return t2 || (t2 = this.isOverflow ? 1 : 0), t2;
  }
  __updateRenderBounds() {
    const { renderBounds: t2, renderSpread: e2 } = this.__layout;
    ri2(t2, this.__.__textBoxBounds, e2), this.__box && (this.__box.__layout.renderBounds = t2);
  }
  __updateChange() {
    super.__updateChange();
    const t2 = this.__box;
    t2 && (t2.__onUpdateSize(), t2.__updateChange());
  }
  __drawRenderPath(t2) {
    t2.font = this.__.__font;
  }
  __draw(t2, e2, i2) {
    const s2 = this.__box;
    s2 && (s2.__nowWorld = this.__nowWorld, s2.__draw(t2, e2, i2)), this.textEditing && !e2.exporting || super.__draw(t2, e2, i2);
  }
  __drawShape(t2, e2) {
    e2.shape && this.__box && this.__box.__drawShape(t2, e2), super.__drawShape(t2, e2);
  }
  destroy() {
    this.boxStyle && (this.boxStyle = null), super.destroy();
  }
};
mt2([Fn(re2)], di2.prototype, "__", void 0), mt2([Bn(0)], di2.prototype, "width", void 0), mt2([Bn(0)], di2.prototype, "height", void 0), mt2([Rn()], di2.prototype, "boxStyle", void 0), mt2([gn(false)], di2.prototype, "resizeFontSize", void 0), mt2([Rn("#000000")], di2.prototype, "fill", void 0), mt2([Tn("outside")], di2.prototype, "strokeAlign", void 0), mt2([Xn("all")], di2.prototype, "hitFill", void 0), mt2([Bn("")], di2.prototype, "text", void 0), mt2([Bn("")], di2.prototype, "placeholder", void 0), mt2([Bn("caption")], di2.prototype, "fontFamily", void 0), mt2([Bn(12)], di2.prototype, "fontSize", void 0), mt2([Bn("normal")], di2.prototype, "fontWeight", void 0), mt2([Bn(false)], di2.prototype, "italic", void 0), mt2([Bn("none")], di2.prototype, "textCase", void 0), mt2([Bn("none")], di2.prototype, "textDecoration", void 0), mt2([Bn(0)], di2.prototype, "letterSpacing", void 0), mt2([Bn({ type: "percent", value: 1.5 })], di2.prototype, "lineHeight", void 0), mt2([Bn(0)], di2.prototype, "paraIndent", void 0), mt2([Bn(0)], di2.prototype, "paraSpacing", void 0), mt2([Bn("x")], di2.prototype, "writingMode", void 0), mt2([Bn("left")], di2.prototype, "textAlign", void 0), mt2([Bn("top")], di2.prototype, "verticalAlign", void 0), mt2([Bn(true)], di2.prototype, "autoSizeAlign", void 0), mt2([Bn("normal")], di2.prototype, "textWrap", void 0), mt2([Bn("show")], di2.prototype, "textOverflow", void 0), mt2([Rn(false)], di2.prototype, "textEditing", void 0), di2 = mt2([$n()], di2);
var li2 = class extends ye2 {
  get __tag() {
    return "Path";
  }
};
mt2([Fn(ie2)], li2.prototype, "__", void 0), mt2([Tn("center")], li2.prototype, "strokeAlign", void 0), li2 = mt2([$n()], li2);
var pi2 = class extends ve2 {
  get __tag() {
    return "Pen";
  }
  setStyle(t2) {
    const e2 = this.pathElement = new li2(t2);
    return this.pathStyle = t2, this.__path = e2.path || (e2.path = []), this.add(e2), this;
  }
  beginPath() {
    return this;
  }
  moveTo(t2, e2) {
    return this;
  }
  lineTo(t2, e2) {
    return this;
  }
  bezierCurveTo(t2, e2, i2, s2, o2, r2) {
    return this;
  }
  quadraticCurveTo(t2, e2, i2, s2) {
    return this;
  }
  closePath() {
    return this;
  }
  rect(t2, e2, i2, s2) {
    return this;
  }
  roundRect(t2, e2, i2, s2, o2) {
    return this;
  }
  ellipse(t2, e2, i2, s2, o2, r2, a, n2) {
    return this;
  }
  arc(t2, e2, i2, s2, o2, r2) {
    return this;
  }
  arcTo(t2, e2, i2, s2, o2) {
    return this;
  }
  drawEllipse(t2, e2, i2, s2, o2, r2, a, n2) {
    return this;
  }
  drawArc(t2, e2, i2, s2, o2, r2) {
    return this;
  }
  drawPoints(t2, e2, i2) {
    return this;
  }
  clearPath() {
    return this;
  }
  paint() {
    const { pathElement: t2 } = this;
    t2.__layout.boxChanged || t2.forceUpdate("path");
  }
};
mt2([Fn(se2)], pi2.prototype, "__", void 0), mt2([(e2, i2) => {
  dn(e2, i2, { get() {
    return this.__path;
  } });
}], pi2.prototype, "path", void 0), pi2 = mt2([Zn(Ur, ["set", "path", "paint"]), $n()], pi2);

// node_modules/@leafer-ui/core/lib/core.esm.min.js
function I2(t2, e2, i2, s2) {
  var a, n2 = arguments.length, r2 = n2 < 3 ? e2 : null === s2 ? s2 = Object.getOwnPropertyDescriptor(e2, i2) : s2;
  if ("object" == typeof Reflect && "function" == typeof Reflect.decorate) r2 = Reflect.decorate(t2, e2, i2, s2);
  else for (var h = t2.length - 1; h >= 0; h--) (a = t2[h]) && (r2 = (n2 < 3 ? a(r2) : n2 > 3 ? a(e2, i2, r2) : a(e2, i2)) || r2);
  return n2 > 3 && r2 && Object.defineProperty(e2, i2, r2), r2;
}
var N2 = class extends xe2 {
  get __tag() {
    return "App";
  }
  get isApp() {
    return true;
  }
  constructor(t2, e2) {
    super(t2, e2);
  }
  init(t2, e2) {
    if (super.init(t2, e2), t2) {
      const { ground: e3, tree: i2, sky: s2, editor: a } = t2;
      e3 && (this.ground = this.addLeafer(e3)), (i2 || a) && (this.tree = this.addLeafer(i2 || { type: t2.type || "design" })), (s2 || a) && (this.sky = this.addLeafer(s2)), a && de.editor(a, this);
    }
  }
  __setApp() {
    const { canvas: t2 } = this, { realCanvas: e2, view: i2 } = this.config;
    e2 || i2 === this.canvas.view || !t2.parentView ? this.realCanvas = true : t2.unrealCanvas(), this.leafer = this, this.watcher.disable(), this.layouter.disable();
  }
  __updateLocalBounds() {
    this.forEach((t2) => t2.updateLayout()), super.__updateLocalBounds();
  }
  start() {
    super.start(), this.forEach((t2) => t2.start());
  }
  stop() {
    this.forEach((t2) => t2.stop()), super.stop();
  }
  unlockLayout() {
    super.unlockLayout(), this.forEach((t2) => t2.unlockLayout());
  }
  lockLayout() {
    super.lockLayout(), this.forEach((t2) => t2.lockLayout());
  }
  forceRender(t2, e2) {
    this.forEach((i2) => i2.forceRender(t2, e2));
  }
  addLeafer(e2) {
    const i2 = new xe2(e2);
    return this.add(i2), i2;
  }
  add(t2, e2) {
    if (!t2.view) {
      if (this.realCanvas && !this.canvas.bounds) return void setTimeout(() => this.add(t2, e2), 10);
      t2.init(this.__getChildConfig(t2.userConfig), this);
    }
    super.add(t2, e2), s(e2) || (t2.canvas.childIndex = e2), this.__listenChildEvents(t2);
  }
  forEach(t2) {
    this.children.forEach(t2);
  }
  __onCreated() {
    this.created = this.children.every((t2) => t2.created);
  }
  __onReady() {
    this.children.every((t2) => t2.ready) && super.__onReady();
  }
  __onViewReady() {
    this.children.every((t2) => t2.viewReady) && super.__onViewReady();
  }
  __onChildRenderEnd(t2) {
    this.renderer.addBlock(t2.renderBounds), this.viewReady && this.renderer.update();
  }
  __render(t2, e2) {
    t2.context && this.forEach((i2) => e2.matrix ? i2.__render(t2, e2) : t2.copyWorld(i2.canvas, e2.bounds, void 0, void 0, true));
  }
  __onResize(t2) {
    this.forEach((e2) => e2.resize(t2)), super.__onResize(t2);
  }
  updateLayout() {
    this.forEach((t2) => t2.updateLayout());
  }
  __getChildConfig(t2) {
    const e2 = Object.assign({}, this.config);
    return e2.hittable = e2.realCanvas = void 0, t2 && _.assign(e2, t2), this.autoLayout && _.copyAttrs(e2, this, Ee), e2.view = this.realCanvas ? void 0 : this.view, e2.fill = void 0, e2;
  }
  __listenChildEvents(t2) {
    t2.once([[ea.END, this.__onReady, this], [sa.START, this.__onCreated, this], [sa.END, this.__onViewReady, this]]), this.realCanvas && this.__eventIds.push(t2.on_(sa.END, this.__onChildRenderEnd, this));
  }
};
N2 = I2([$n()], N2);
var F2 = {};
var W2 = { isHoldSpaceKey: () => W2.isHold("Space"), isHold: (t2) => F2[t2], isHoldKeys: (t2, e2) => e2 ? t2(e2) : void 0, setDownCode(t2) {
  F2[t2] || (F2[t2] = true);
}, setUpCode(t2) {
  F2[t2] = false;
} };
var K2 = { LEFT: 1, RIGHT: 2, MIDDLE: 4, defaultLeft(t2) {
  t2.buttons || (t2.buttons = 1);
}, left: (t2) => 1 === t2.buttons, right: (t2) => 2 === t2.buttons, middle: (t2) => 4 === t2.buttons };
var V2 = class extends zo {
  get spaceKey() {
    return W2.isHoldSpaceKey();
  }
  get left() {
    return K2.left(this);
  }
  get right() {
    return K2.right(this);
  }
  get middle() {
    return K2.middle(this);
  }
  constructor(t2) {
    super(t2.type), this.bubbles = true, Object.assign(this, t2);
  }
  isHoldKeys(t2) {
    return W2.isHoldKeys(t2, this);
  }
  getBoxPoint(t2) {
    return (t2 || this.current).getBoxPoint(this);
  }
  getInnerPoint(t2) {
    return (t2 || this.current).getInnerPoint(this);
  }
  getLocalPoint(t2) {
    return (t2 || this.current).getLocalPoint(this);
  }
  getPagePoint() {
    return this.current.getPagePoint(this);
  }
  getInner(t2) {
    return this.getInnerPoint(t2);
  }
  getLocal(t2) {
    return this.getLocalPoint(t2);
  }
  getPage() {
    return this.getPagePoint();
  }
  static changeName(t2, e2) {
    fe.changeName(t2, e2);
  }
};
var { min: U2, max: j2, abs: X2 } = Math;
var { float: Y2, sign: z2 } = M;
var { minX: G2, maxX: Z2, minY: q2, maxY: J2 } = Ft;
var Q2 = new Ht();
var $2 = new Ht();
var tt2 = { limitMove(t2, e2) {
  const { dragBounds: i2, dragBoundsType: s2 } = t2;
  i2 && et2.getValidMove(t2.__localBoxBounds, et2.getDragBounds(t2), s2, e2, true), et2.axisMove(t2, e2);
}, limitScaleOf(t2, e2, i2, s2) {
  const { dragBounds: a, dragBoundsType: n2 } = t2;
  a && et2.getValidScaleOf(t2.__localBoxBounds, et2.getDragBounds(t2), n2, t2.getLocalPointByInner(t2.getInnerPointByBox(e2)), i2, s2, true);
}, axisMove(t2, e2) {
  const { draggable: i2 } = t2;
  "x" === i2 && (e2.y = 0), "y" === i2 && (e2.x = 0);
}, getDragBounds(t2) {
  const { dragBounds: e2 } = t2;
  return "parent" === e2 ? t2.parent.boxBounds : e2;
}, isInnerMode: (t2, e2, i2, s2) => "inner" === i2 || "auto" === i2 && Y2(t2[s2]) > Y2(e2[s2]), getValidMove(t2, e2, i2, s2, a) {
  const n2 = t2.x + s2.x, r2 = t2.y + s2.y, h = n2 + t2.width, o2 = r2 + t2.height, d2 = e2.x + e2.width, g2 = e2.y + e2.height;
  return a || (s2 = Object.assign({}, s2)), et2.isInnerMode(t2, e2, i2, "width") ? n2 > e2.x ? s2.x += e2.x - n2 : h < d2 && (s2.x += d2 - h) : n2 < e2.x ? s2.x += e2.x - n2 : h > d2 && (s2.x += d2 - h), et2.isInnerMode(t2, e2, i2, "height") ? r2 > e2.y ? s2.y += e2.y - r2 : o2 < g2 && (s2.y += g2 - o2) : r2 < e2.y ? s2.y += e2.y - r2 : o2 > g2 && (s2.y += g2 - o2), s2.x = Y2(s2.x), s2.y = Y2(s2.y), s2;
}, getValidScaleOf(t2, e2, i2, s2, a, n2, r2) {
  r2 || (a = Object.assign({}, a)), $2.set(e2), Q2.set(t2).scaleOf(s2, a.x, a.y);
  const h = (s2.x - t2.x) / t2.width, o2 = 1 - h, d2 = (s2.y - t2.y) / t2.height, g2 = 1 - d2;
  let l2, c, u2, p2, _2 = 1, m2 = 1;
  return et2.isInnerMode(t2, e2, i2, "width") ? (a.x < 0 && Q2.scaleOf(s2, _2 = 1 / a.x, 1), u2 = Y2(Q2.minX - $2.minX), p2 = Y2($2.maxX - Q2.maxX), l2 = h && u2 > 0 ? 1 + u2 / (h * Q2.width) : 1, c = o2 && p2 > 0 ? 1 + p2 / (o2 * Q2.width) : 1, _2 *= j2(l2, c)) : (a.x < 0 && ((Y2(G2(t2) - G2(e2)) <= 0 || Y2(Z2(e2) - Z2(t2)) <= 0) && Q2.scaleOf(s2, _2 = 1 / a.x, 1), Q2.unsign()), u2 = Y2($2.minX - Q2.minX), p2 = Y2(Q2.maxX - $2.maxX), l2 = h && u2 > 0 ? 1 - u2 / (h * Q2.width) : 1, c = o2 && p2 > 0 ? 1 - p2 / (o2 * Q2.width) : 1, _2 *= U2(l2, c)), et2.isInnerMode(t2, e2, i2, "height") ? (a.y < 0 && Q2.scaleOf(s2, 1, m2 = 1 / a.y), u2 = Y2(Q2.minY - $2.minY), p2 = Y2($2.maxY - Q2.maxY), l2 = d2 && u2 > 0 ? 1 + u2 / (d2 * Q2.height) : 1, c = g2 && p2 > 0 ? 1 + p2 / (g2 * Q2.height) : 1, m2 *= j2(l2, c), n2 && (l2 = j2(X2(_2), X2(m2)), _2 = z2(_2) * l2, m2 = z2(m2) * l2)) : (a.y < 0 && ((Y2(q2(t2) - q2(e2)) <= 0 || Y2(J2(e2) - J2(t2)) <= 0) && Q2.scaleOf(s2, 1, m2 = 1 / a.y), Q2.unsign()), u2 = Y2($2.minY - Q2.minY), p2 = Y2(Q2.maxY - $2.maxY), l2 = d2 && u2 > 0 ? 1 - u2 / (d2 * Q2.height) : 1, c = g2 && p2 > 0 ? 1 - p2 / (g2 * Q2.height) : 1, m2 *= U2(l2, c)), a.x *= n(_2) ? _2 : 1, a.y *= n(m2) ? m2 : 1, a;
} };
var et2 = tt2;
var it2 = class extends V2 {
};
it2.POINTER = "pointer", it2.BEFORE_DOWN = "pointer.before_down", it2.BEFORE_MOVE = "pointer.before_move", it2.BEFORE_UP = "pointer.before_up", it2.DOWN = "pointer.down", it2.MOVE = "pointer.move", it2.UP = "pointer.up", it2.OVER = "pointer.over", it2.OUT = "pointer.out", it2.ENTER = "pointer.enter", it2.LEAVE = "pointer.leave", it2.TAP = "tap", it2.DOUBLE_TAP = "double_tap", it2.CLICK = "click", it2.DOUBLE_CLICK = "double_click", it2.LONG_PRESS = "long_press", it2.LONG_TAP = "long_tap", it2.MENU = "pointer.menu", it2.MENU_TAP = "pointer.menu_tap", it2 = I2([Kn()], it2);
var at2 = {};
var nt2 = class extends it2 {
  static setList(t2) {
    this.list = t2 instanceof Ch ? t2 : new Ch(t2);
  }
  static setData(t2) {
    this.data = t2;
  }
  static getValidMove(t2, e2, i2, s2 = true) {
    const a = t2.getLocalPoint(i2, null, true);
    return at.move(a, e2.x - t2.x, e2.y - t2.y), s2 && this.limitMove(t2, a), tt2.axisMove(t2, a), a;
  }
  static limitMove(t2, e2) {
    tt2.limitMove(t2, e2);
  }
  getPageMove(t2) {
    return this.assignMove(t2), this.current.getPagePoint(at2, null, true);
  }
  getInnerMove(t2, e2) {
    return t2 || (t2 = this.current), this.assignMove(e2), t2.getInnerPoint(at2, null, true);
  }
  getLocalMove(t2, e2) {
    return t2 || (t2 = this.current), this.assignMove(e2), t2.getLocalPoint(at2, null, true);
  }
  getPageTotal() {
    return this.getPageMove(true);
  }
  getInnerTotal(t2) {
    return this.getInnerMove(t2, true);
  }
  getLocalTotal(t2) {
    return this.getLocalMove(t2, true);
  }
  getPageBounds() {
    const t2 = this.getPageTotal(), e2 = this.getPagePoint(), i2 = {};
    return Ft.set(i2, e2.x - t2.x, e2.y - t2.y, t2.x, t2.y), Ft.unsign(i2), i2;
  }
  assignMove(t2) {
    at2.x = t2 ? this.totalX : this.moveX, at2.y = t2 ? this.totalY : this.moveY;
  }
};
nt2.BEFORE_DRAG = "drag.before_drag", nt2.START = "drag.start", nt2.DRAG = "drag", nt2.END = "drag.end", nt2.OVER = "drag.over", nt2.OUT = "drag.out", nt2.ENTER = "drag.enter", nt2.LEAVE = "drag.leave", nt2 = I2([Kn()], nt2);
var ht2 = class extends it2 {
  static setList(t2) {
    nt2.setList(t2);
  }
  static setData(t2) {
    nt2.setData(t2);
  }
};
ht2.DROP = "drop", ht2 = I2([Kn()], ht2);
var ot2 = class extends nt2 {
};
ot2.BEFORE_MOVE = "move.before_move", ot2.START = "move.start", ot2.MOVE = "move", ot2.DRAG_ANIMATE = "move.drag_animate", ot2.END = "move.end", ot2.PULL_DOWN = "move.pull_down", ot2.REACH_BOTTOM = "move.reach_bottom", ot2 = I2([Kn()], ot2);
var dt2 = class extends V2 {
};
dt2 = I2([Kn()], dt2);
var lt2 = class extends it2 {
};
lt2.BEFORE_ROTATE = "rotate.before_rotate", lt2.START = "rotate.start", lt2.ROTATE = "rotate", lt2.END = "rotate.end", lt2 = I2([Kn()], lt2);
var ct2 = class extends nt2 {
};
ct2.SWIPE = "swipe", ct2.LEFT = "swipe.left", ct2.RIGHT = "swipe.right", ct2.UP = "swipe.up", ct2.DOWN = "swipe.down", ct2 = I2([Kn()], ct2);
var ut2 = class extends it2 {
};
ut2.BEFORE_ZOOM = "zoom.before_zoom", ut2.START = "zoom.start", ut2.ZOOM = "zoom", ut2.END = "zoom.end", ut2 = I2([Kn()], ut2);
var pt2 = class extends V2 {
};
pt2.BEFORE_DOWN = "key.before_down", pt2.BEFORE_UP = "key.before_up", pt2.DOWN = "key.down", pt2.HOLD = "key.hold", pt2.UP = "key.up", pt2 = I2([Kn()], pt2);
var _t2 = { getDragEventData: (t2, e2, i2) => Object.assign(Object.assign({}, i2), { x: i2.x, y: i2.y, moveX: i2.x - e2.x, moveY: i2.y - e2.y, totalX: i2.x - t2.x, totalY: i2.y - t2.y }), getDropEventData: (t2, e2, i2) => Object.assign(Object.assign({}, t2), { list: e2, data: i2 }), getSwipeDirection: (t2) => t2 < -45 && t2 > -135 ? ct2.UP : t2 > 45 && t2 < 135 ? ct2.DOWN : t2 <= 45 && t2 >= -45 ? ct2.RIGHT : ct2.LEFT, getSwipeEventData: (t2, e2, i2) => Object.assign(Object.assign({}, i2), { moveX: e2.moveX, moveY: e2.moveY, totalX: i2.x - t2.x, totalY: i2.y - t2.y, type: mt3.getSwipeDirection(at.getAngle(t2, i2)) }), getBase(t2) {
  const e2 = 1 === t2.button ? 4 : t2.button;
  return { altKey: t2.altKey, ctrlKey: t2.ctrlKey, shiftKey: t2.shiftKey, metaKey: t2.metaKey, time: Date.now(), buttons: s(t2.buttons) ? 1 : 0 === t2.buttons ? e2 : t2.buttons, origin: t2 };
}, pathHasEventType(t2, e2) {
  const { list: i2 } = t2;
  for (let t3 = 0, s2 = i2.length; t3 < s2; t3++) if (i2[t3].hasEvent(e2)) return true;
  return false;
}, filterPathByEventType(t2, e2) {
  const i2 = new Ch(), { list: s2 } = t2;
  for (let t3 = 0, a = s2.length; t3 < a; t3++) s2[t3].hasEvent(e2) && i2.add(s2[t3]);
  return i2;
}, pathCanDrag: (t2) => t2 && t2.list.some((t3) => uo.draggable(t3) || !t3.isLeafer && t3.hasEvent(nt2.DRAG)), pathHasOutside: (t2) => t2 && t2.list.some((t3) => t3.isOutside) };
var mt3 = _t2;
var vt2 = new Ch();
var { getDragEventData: ft2, getDropEventData: yt2, getSwipeEventData: Dt3 } = _t2;
var Et3 = class {
  constructor(t2) {
    this.dragDataList = [], this.interaction = t2;
  }
  setDragData(t2) {
    this.animateWait && this.dragEndReal(), this.downData = this.interaction.downData, this.dragData = ft2(t2, t2, t2), this.canAnimate = this.canDragOut = true;
  }
  getList(t2, e2) {
    const { proxy: i2 } = this.interaction.selector, s2 = i2 && i2.list.length, a = nt2.list || this.draggableList || vt2;
    return this.dragging && (s2 ? t2 ? vt2 : new Ch(e2 ? [...i2.list, ...i2.dragHoverExclude] : i2.list) : a);
  }
  checkDrag(t2, e2) {
    const { interaction: i2 } = this;
    if (this.moving && t2.buttons < 1) return this.canAnimate = false, void i2.pointerCancel();
    !this.moving && e2 && (this.moving = i2.canMove(this.downData) || i2.isHoldRightKey || i2.isMobileDragEmpty) && (this.dragData.moveType = "drag", i2.emit(ot2.START, this.dragData)), this.moving || this.dragStart(t2, e2), this.drag(t2);
  }
  dragStart(t2, e2) {
    this.dragging || (this.dragging = e2 && K2.left(t2), this.dragging && (this.interaction.emit(nt2.START, this.dragData), this.getDraggableList(this.dragData.path), this.setDragStartPoints(this.realDraggableList = this.getList(true))));
  }
  setDragStartPoints(t2) {
    this.dragStartPoints = {}, t2.forEach((t3) => this.dragStartPoints[t3.innerId] = { x: t3.x, y: t3.y });
  }
  getDraggableList(t2) {
    let e2;
    for (let i2 = 0, s2 = t2.length; i2 < s2; i2++) if (e2 = t2.list[i2], uo.draggable(e2)) {
      this.draggableList = new Ch(e2);
      break;
    }
  }
  drag(t2) {
    const { interaction: e2, dragData: i2, downData: s2 } = this, { path: a, throughPath: n2 } = s2;
    this.dragData = ft2(s2, i2, t2), n2 && (this.dragData.throughPath = n2), this.dragData.path = a, this.dragDataList.push(this.dragData), this.moving ? (t2.moving = true, this.dragData.moveType = "drag", e2.emit(ot2.BEFORE_MOVE, this.dragData), e2.emit(ot2.MOVE, this.dragData)) : this.dragging && (t2.dragging = true, this.dragReal(), e2.emit(nt2.BEFORE_DRAG, this.dragData), e2.emit(nt2.DRAG, this.dragData));
  }
  dragReal(t2) {
    const { interaction: e2 } = this, { running: i2 } = e2, s2 = this.realDraggableList;
    if (s2.length && i2) {
      const { totalX: i3, totalY: a } = this.dragData, { dragLimitAnimate: n2 } = e2.p, r2 = !n2 || !!t2;
      s2.forEach((e3) => {
        if (e3.draggable) {
          const s3 = i(e3.draggable), h = nt2.getValidMove(e3, this.dragStartPoints[e3.innerId], { x: i3, y: a }, r2 || s3);
          n2 && !s3 && t2 ? uo.animateMove(e3, h, o(n2) ? n2 : 0.3) : e3.move(h);
        }
      });
    }
  }
  dragOverOrOut(t2) {
    const { interaction: e2 } = this, { dragOverPath: i2 } = this, { path: s2 } = t2;
    this.dragOverPath = s2, i2 ? s2.indexAt(0) !== i2.indexAt(0) && (e2.emit(nt2.OUT, t2, i2), e2.emit(nt2.OVER, t2, s2)) : e2.emit(nt2.OVER, t2, s2);
  }
  dragEnterOrLeave(t2) {
    const { interaction: e2 } = this, { dragEnterPath: i2 } = this, { path: s2 } = t2;
    e2.emit(nt2.LEAVE, t2, i2, s2), e2.emit(nt2.ENTER, t2, s2, i2), this.dragEnterPath = s2;
  }
  dragEnd(t2) {
    (this.dragging || this.moving) && (this.checkDragEndAnimate(t2) || this.dragEndReal(t2));
  }
  dragEndReal(t2) {
    const { interaction: e2, downData: i2, dragData: s2 } = this;
    t2 || (t2 = s2);
    const { path: a, throughPath: n2 } = i2, r2 = ft2(i2, t2, t2);
    if (n2 && (r2.throughPath = n2), r2.path = a, this.moving && (this.moving = false, r2.moveType = "drag", e2.emit(ot2.END, r2)), this.dragging) {
      const a2 = this.getList();
      this.dragging = false, e2.p.dragLimitAnimate && this.dragReal(true), e2.emit(nt2.END, r2), this.swipe(t2, i2, s2, r2), this.drop(t2, a2, this.dragEnterPath);
    }
    this.autoMoveCancel(), this.dragReset(), this.animate(null, "off");
  }
  swipe(t2, e2, i2, s2) {
    const { interaction: a } = this;
    if (at.getDistance(e2, t2) > a.config.pointer.swipeDistance) {
      const t3 = Dt3(e2, i2, s2);
      this.interaction.emit(t3.type, t3);
    }
  }
  drop(t2, e2, i2) {
    const s2 = yt2(t2, e2, nt2.data);
    s2.path = i2, this.interaction.emit(ht2.DROP, s2), this.interaction.emit(nt2.LEAVE, t2, i2);
  }
  dragReset() {
    nt2.list = nt2.data = this.draggableList = this.dragData = this.downData = this.dragOverPath = this.dragEnterPath = null, this.dragDataList = [];
  }
  checkDragEndAnimate(t2, e2) {
    return false;
  }
  animate(t2, e2) {
  }
  stopAnimate() {
  }
  checkDragOut(t2) {
  }
  autoMoveOnDragOut(t2) {
  }
  autoMoveCancel() {
  }
  destroy() {
    this.dragReset();
  }
};
var Pt3 = se.get("emit");
var wt2 = ["move", "zoom", "rotate", "key"];
function xt2(t2, e2, i2, s2, a) {
  if (wt2.some((t3) => e2.startsWith(t3)) && t2.__.hitChildren && !Tt3(t2, a)) {
    let n2;
    for (let r2 = 0, h = t2.children.length; r2 < h; r2++) n2 = t2.children[r2], !i2.path.has(n2) && n2.__.hittable && Ot3(n2, e2, i2, s2, a);
  }
}
function Ot3(t2, i2, s2, a, n2) {
  if (t2.destroyed) return false;
  if (t2.__.hitSelf && !Tt3(t2, n2) && (zt2.updateEventStyle && !a && zt2.updateEventStyle(t2, i2), t2.hasEvent(i2, a))) {
    s2.phase = a ? 1 : t2 === s2.target ? 2 : 3;
    const e2 = fe.get(i2, s2);
    if (t2.emitEvent(e2, a), e2.isStop) return true;
  }
  return false;
}
function Tt3(t2, e2) {
  return e2 && e2.has(t2);
}
var Lt3 = { wheel: { zoomSpeed: 0.5, moveSpeed: 0.5, rotateSpeed: 0.5, delta: { x: 20, y: 8 } }, pointer: { type: "pointer", snap: true, hitRadius: 5, tapTime: 120, longPressTime: 800, transformTime: 500, hover: true, dragHover: true, dragDistance: 2, swipeDistance: 20 }, touch: { preventDefault: "auto" }, multiTouch: {}, move: { autoDistance: 2 }, zoom: {}, cursor: true, keyEvent: true };
var { pathHasEventType: Rt3, pathCanDrag: Ct3, pathHasOutside: bt3 } = _t2;
var Mt2 = class {
  get dragging() {
    return this.dragger.dragging;
  }
  get transforming() {
    return this.transformer.transforming;
  }
  get moveMode() {
    return true === this.m.drag || this.isHoldSpaceKey || this.isHoldMiddleKey || this.isHoldRightKey && this.dragger.moving || this.isDragEmpty;
  }
  get canHover() {
    return this.p.hover && !this.config.mobile;
  }
  get isDragEmpty() {
    return this.m.dragEmpty && this.isRootPath(this.hoverData) && (!this.downData || this.isRootPath(this.downData));
  }
  get isMobileDragEmpty() {
    return this.m.dragEmpty && !this.canHover && this.downData && this.isTreePath(this.downData);
  }
  get isHoldMiddleKey() {
    return this.m.holdMiddleKey && this.downData && K2.middle(this.downData);
  }
  get isHoldRightKey() {
    return this.m.holdRightKey && this.downData && K2.right(this.downData);
  }
  get isHoldSpaceKey() {
    return this.m.holdSpaceKey && W2.isHoldSpaceKey();
  }
  get m() {
    return this.config.move;
  }
  get p() {
    return this.config.pointer;
  }
  get hitRadius() {
    return this.p.hitRadius;
  }
  constructor(t2, e2, i2, s2) {
    this.config = _.clone(Lt3), this.tapCount = 0, this.downKeyMap = {}, this.target = t2, this.canvas = e2, this.selector = i2, this.defaultPath = new Ch(t2), this.createTransformer(), this.dragger = new Et3(this), s2 && (this.config = _.default(s2, this.config)), this.__listenEvents();
  }
  start() {
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  receive(t2) {
  }
  pointerDown(t2, e2) {
    t2 || (t2 = this.hoverData), t2 && (K2.defaultLeft(t2), this.updateDownData(t2), this.checkPath(t2, e2), this.downTime = Date.now(), this.emit(it2.BEFORE_DOWN, t2), t2.path.needUpdate && this.updateDownData(t2), this.emit(it2.DOWN, t2), K2.left(t2) && (this.tapWait(), this.longPressWait(t2)), this.waitRightTap = K2.right(t2), this.dragger.setDragData(t2), this.isHoldRightKey || this.updateCursor(t2));
  }
  pointerMove(t2) {
    if (t2 || (t2 = this.hoverData), !t2) return;
    const { downData: e2 } = this;
    e2 && K2.defaultLeft(t2);
    (this.canvas.bounds.hitPoint(t2) || e2) && (this.pointerMoveReal(t2), e2 && this.dragger.checkDragOut(t2));
  }
  pointerMoveReal(t2) {
    if (this.emit(it2.BEFORE_MOVE, t2, this.defaultPath), this.downData) {
      const e2 = at.getDistance(this.downData, t2) > this.p.dragDistance;
      e2 && (this.pointerWaitCancel(), this.waitRightTap = false), this.dragger.checkDrag(t2, e2);
    }
    this.dragger.moving || (this.updateHoverData(t2), this.checkPath(t2), this.emit(it2.MOVE, t2), this.pointerHover(t2), this.dragging && (this.dragger.dragOverOrOut(t2), this.dragger.dragEnterOrLeave(t2))), this.updateCursor(this.downData || t2);
  }
  pointerUp(t2) {
    const { downData: e2 } = this;
    if (t2 || (t2 = e2), !e2) return;
    K2.defaultLeft(t2), t2.multiTouch = e2.multiTouch, this.findPath(t2);
    const i2 = Object.assign(Object.assign({}, t2), { path: t2.path.clone() });
    t2.path.addList(e2.path.list), this.checkPath(t2), this.downData = null, this.emit(it2.BEFORE_UP, t2), this.emit(it2.UP, t2), this.touchLeave(t2), t2.isCancel || (this.tap(t2), this.menuTap(t2)), this.dragger.dragEnd(t2), this.updateCursor(i2);
  }
  pointerCancel() {
    const t2 = Object.assign({}, this.dragger.dragData);
    t2.isCancel = true, this.pointerUp(t2);
  }
  menu(t2) {
    this.findPath(t2), this.emit(it2.MENU, t2), this.waitMenuTap = true, !this.downData && this.waitRightTap && this.menuTap(t2);
  }
  menuTap(t2) {
    this.waitRightTap && this.waitMenuTap && (this.emit(it2.MENU_TAP, t2), this.waitRightTap = this.waitMenuTap = false);
  }
  createTransformer() {
  }
  move(t2) {
  }
  zoom(t2) {
  }
  rotate(t2) {
  }
  transformEnd() {
  }
  wheel(t2) {
  }
  multiTouch(t2, e2) {
  }
  keyDown(t2) {
    if (!this.config.keyEvent) return;
    this.emit(pt2.BEFORE_DOWN, t2, this.defaultPath);
    const { code: e2 } = t2;
    this.downKeyMap[e2] || (this.downKeyMap[e2] = true, W2.setDownCode(e2), this.emit(pt2.HOLD, t2, this.defaultPath), this.moveMode && (this.cancelHover(), this.updateCursor())), this.emit(pt2.DOWN, t2, this.defaultPath);
  }
  keyUp(t2) {
    if (!this.config.keyEvent) return;
    this.emit(pt2.BEFORE_UP, t2, this.defaultPath);
    const { code: e2 } = t2;
    this.downKeyMap[e2] = false, W2.setUpCode(e2), this.emit(pt2.UP, t2, this.defaultPath), "grab" === this.cursor && this.updateCursor();
  }
  pointerHover(t2) {
    !this.canHover || this.dragging && !this.p.dragHover || (t2.path || (t2.path = new Ch()), this.pointerOverOrOut(t2), this.pointerEnterOrLeave(t2));
  }
  pointerOverOrOut(t2) {
    const { path: e2 } = t2, { overPath: i2 } = this;
    this.overPath = e2, i2 ? e2.indexAt(0) !== i2.indexAt(0) && (this.emit(it2.OUT, t2, i2), this.emit(it2.OVER, t2, e2)) : this.emit(it2.OVER, t2, e2);
  }
  pointerEnterOrLeave(t2) {
    let { path: e2 } = t2;
    this.downData && !this.moveMode && (e2 = e2.clone(), this.downData.path.forEach((t3) => e2.add(t3)));
    const { enterPath: i2 } = this;
    this.enterPath = e2, this.emit(it2.LEAVE, t2, i2, e2), this.emit(it2.ENTER, t2, e2, i2);
  }
  touchLeave(t2) {
    "touch" === t2.pointerType && this.enterPath && (this.emit(it2.LEAVE, t2), this.dragger.dragging && this.emit(ht2.LEAVE, t2));
  }
  tap(t2) {
    const { pointer: e2 } = this.config, i2 = this.longTap(t2);
    if (!e2.tapMore && i2) return;
    if (!this.waitTap) return;
    e2.tapMore && this.emitTap(t2);
    const s2 = Date.now() - this.downTime, a = [it2.DOUBLE_TAP, it2.DOUBLE_CLICK].some((e3) => Rt3(t2.path, e3));
    s2 < e2.tapTime + 50 && a ? (this.tapCount++, 2 === this.tapCount ? (this.tapWaitCancel(), this.emitDoubleTap(t2)) : (clearTimeout(this.tapTimer), this.tapTimer = setTimeout(() => {
      e2.tapMore || (this.tapWaitCancel(), this.emitTap(t2));
    }, e2.tapTime))) : e2.tapMore || (this.tapWaitCancel(), this.emitTap(t2));
  }
  findPath(t2, e2) {
    const { hitRadius: i2, through: s2 } = this.p, { bottomList: a, target: n2 } = this;
    Kt.backgrounder || t2.origin || n2 && n2.updateLayout();
    const r2 = this.selector.getByPoint(t2, i2, Object.assign({ bottomList: a, name: t2.type }, e2 || { through: s2 }));
    return r2.throughPath && (t2.throughPath = r2.throughPath), t2.path = r2.path, r2.path;
  }
  isRootPath(t2) {
    return t2 && t2.path.list[0].isLeafer;
  }
  isTreePath(t2) {
    const e2 = this.target.app;
    return !(!e2 || !e2.isApp) && (e2.editor && !t2.path.has(e2.editor) && t2.path.has(e2.tree) && !t2.target.syncEventer);
  }
  checkPath(t2, e2) {
    (e2 || this.moveMode && !bt3(t2.path)) && (t2.path = this.defaultPath);
  }
  canMove(t2) {
    return t2 && (this.moveMode || "auto" === this.m.drag && !Ct3(t2.path)) && !bt3(t2.path);
  }
  isDrag(t2) {
    return this.dragger.getList().has(t2);
  }
  isPress(t2) {
    return this.downData && this.downData.path.has(t2);
  }
  isHover(t2) {
    return this.enterPath && this.enterPath.has(t2);
  }
  isFocus(t2) {
    return this.focusData === t2;
  }
  cancelHover() {
    const { hoverData: t2 } = this;
    t2 && (t2.path = this.defaultPath, this.pointerHover(t2));
  }
  stopDragAnimate() {
    this.dragger.stopAnimate();
  }
  replaceDownTarget(t2) {
    const { downData: e2 } = this;
    if (e2 && t2) {
      const { path: i2 } = e2;
      i2.remove(i2.list[0]), i2.addAt(t2, 0);
    }
  }
  updateDownData(t2, e2, i2) {
    const { downData: s2 } = this;
    !t2 && s2 && (t2 = s2), t2 && (this.findPath(t2, e2), i2 && s2 && t2.path.addList(s2.path.list), this.downData = t2);
  }
  updateHoverData(t2) {
    t2 || (t2 = this.hoverData), t2 && (this.findPath(t2, { exclude: this.dragger.getList(false, true), name: it2.MOVE }), this.hoverData = t2);
  }
  updateCursor(t2) {
    if (!this.config.cursor || !this.canHover) return;
    if (t2 || (this.updateHoverData(), t2 = this.downData || this.hoverData), this.dragger.moving) return this.setCursor("grabbing");
    if (this.canMove(t2)) return this.setCursor(this.downData ? "grabbing" : "grab");
    if (!t2) return;
    let e2, i2;
    const { path: s2 } = t2;
    for (let t3 = 0, a = s2.length; t3 < a && (e2 = s2.list[t3], i2 = e2.syncEventer && e2.syncEventer.cursor || e2.cursor, !i2); t3++) ;
    this.setCursor(i2);
  }
  setCursor(t2) {
    this.cursor = t2;
  }
  getLocal(t2, e2) {
    const i2 = this.canvas.getClientBounds(e2), s2 = { x: t2.clientX - i2.x, y: t2.clientY - i2.y }, { bounds: a } = this.canvas;
    return s2.x *= a.width / i2.width, s2.y *= a.height / i2.height, this.p.snap && at.round(s2), s2;
  }
  emitTap(t2) {
    this.emit(it2.TAP, t2), this.emit(it2.CLICK, t2);
  }
  emitDoubleTap(t2) {
    this.emit(it2.DOUBLE_TAP, t2), this.emit(it2.DOUBLE_CLICK, t2);
  }
  pointerWaitCancel() {
    this.tapWaitCancel(), this.longPressWaitCancel();
  }
  tapWait() {
    clearTimeout(this.tapTimer), this.waitTap = true;
  }
  tapWaitCancel() {
    this.waitTap && (clearTimeout(this.tapTimer), this.waitTap = false, this.tapCount = 0);
  }
  longPressWait(t2) {
    clearTimeout(this.longPressTimer), this.longPressTimer = setTimeout(() => {
      this.longPressed = true, this.emit(it2.LONG_PRESS, t2);
    }, this.p.longPressTime);
  }
  longTap(t2) {
    let e2;
    return this.longPressed && (this.emit(it2.LONG_TAP, t2), (Rt3(t2.path, it2.LONG_TAP) || Rt3(t2.path, it2.LONG_PRESS)) && (e2 = true)), this.longPressWaitCancel(), e2;
  }
  longPressWaitCancel() {
    this.longPressTimer && (clearTimeout(this.longPressTimer), this.longPressed = false);
  }
  __onResize() {
    const { dragOut: t2 } = this.m;
    this.shrinkCanvasBounds = new Ht(this.canvas.bounds), this.shrinkCanvasBounds.spread(-(o(t2) ? t2 : 2));
  }
  __listenEvents() {
    const { target: t2 } = this;
    this.__eventIds = [t2.on_(Ko.RESIZE, this.__onResize, this)], t2.once(ra.READY, () => this.__onResize());
  }
  __removeListenEvents() {
    this.target.off_(this.__eventIds), this.__eventIds.length = 0;
  }
  emit(t2, e2, i2, s2) {
    this.running && (function(t3, e3, i3, s3) {
      if (!i3 && !e3.path) return;
      let a;
      e3.type = t3, i3 ? e3 = Object.assign(Object.assign({}, e3), { path: i3 }) : i3 = e3.path, e3.target = i3.indexAt(0);
      try {
        for (let n2 = i3.length - 1; n2 > -1; n2--) {
          if (a = i3.list[n2], Ot3(a, t3, e3, true, s3)) return;
          a.isApp && xt2(a, t3, e3, true, s3);
        }
        for (let n2 = 0, r2 = i3.length; n2 < r2; n2++) if (a = i3.list[n2], a.isApp && xt2(a, t3, e3, false, s3), Ot3(a, t3, e3, false, s3)) return;
      } catch (t4) {
        Pt3.error(t4);
      }
    })(t2, e2, i2, s2);
  }
  destroy() {
    this.__eventIds.length && (this.stop(), this.__removeListenEvents(), this.dragger.destroy(), this.transformer && this.transformer.destroy(), this.downData = this.overPath = this.enterPath = null);
  }
};
var St2 = class {
  static set(t2, e2) {
    this.custom[t2] = e2;
  }
  static get(t2) {
    return this.custom[t2];
  }
};
St2.custom = {};
var At3 = class extends ye {
  constructor() {
    super(...arguments), this.maxTotal = 1e3, this.pathList = new Ch(), this.pixelList = new Ch();
  }
  getPixelType(t2, e2) {
    return this.__autoClear(), this.pixelList.add(t2), de.hitCanvas(e2);
  }
  getPathType(t2) {
    return this.__autoClear(), this.pathList.add(t2), de.hitCanvas();
  }
  clearImageType() {
    this.__clearLeafList(this.pixelList);
  }
  clearPathType() {
    this.__clearLeafList(this.pathList);
  }
  __clearLeafList(t2) {
    t2.length && (t2.forEach((t3) => {
      t3.__hitCanvas && (t3.__hitCanvas.destroy(), t3.__hitCanvas = null);
    }), t2.reset());
  }
  __autoClear() {
    this.pathList.length + this.pixelList.length > this.maxTotal && this.clear();
  }
  clear() {
    this.clearPathType(), this.clearImageType();
  }
};
Kt.getSelector = function(t2) {
  return t2.leafer ? t2.leafer.selector : Kt.selector || (Kt.selector = de.selector());
};
var { toInnerRadiusPointOf: Bt2, copyRadiusPoint: kt3 } = at;
var { hitRadiusPoint: Ht3, hitPoint: It3 } = Ft;
var Nt3 = {};
var Ft3 = {};
var Wt3 = ph.prototype;
Wt3.hit = function(t2, e2 = 0) {
  this.updateLayout(), kt3(Ft3, t2, e2);
  const i2 = this.__world;
  return !!(e2 ? Ht3(i2, Ft3) : It3(i2, Ft3)) && (this.isBranch ? Kt.getSelector(this).hitPoint(Object.assign({}, Ft3), e2, { target: this }) : this.__hitWorld(Ft3));
}, Wt3.__hitWorld = function(t2, e2) {
  const i2 = this.__;
  if (!i2.hitSelf) return false;
  const s2 = this.__world, a = this.__layout, n2 = s2.width < 10 && s2.height < 10;
  if (i2.hitRadius && (kt3(Nt3, t2, i2.hitRadius), t2 = Nt3), Bt2(t2, s2, Nt3), i2.hitBox || n2) {
    if (Ft.hitRadiusPoint(a.boxBounds, Nt3)) return true;
    if (n2) return false;
  }
  return !a.hitCanvasChanged && this.__hitCanvas || (this.__updateHitCanvas(), a.boundsChanged || (a.hitCanvasChanged = false)), this.__hit(Nt3, e2);
}, Wt3.__hitFill = function(t2) {
  const e2 = this.__hitCanvas;
  return e2 && e2.hitFill(t2, this.__.windingRule);
}, Wt3.__hitStroke = function(t2, e2) {
  const i2 = this.__hitCanvas;
  return i2 && i2.hitStroke(t2, e2);
}, Wt3.__hitPixel = function(t2) {
  const e2 = this.__hitCanvas;
  return e2 && e2.hitPixel(t2, this.__layout.renderBounds, e2.hitScale);
}, Wt3.__drawHitPath = function(t2) {
  t2 && this.__drawRenderPath(t2);
};
var Kt3 = new ft();
var Vt3 = ye2.prototype;
Vt3.__updateHitCanvas = function() {
  this.__box && this.__box.__updateHitCanvas();
  const { hitCanvasManager: t2 } = this.leafer || this.parent && this.parent.leafer || {};
  if (!t2) return;
  const e2 = this.__, i2 = (e2.__isAlphaPixelFill || e2.__isCanvas) && "pixel" === e2.hitFill, s2 = e2.__isAlphaPixelStroke && "pixel" === e2.hitStroke, a = i2 || s2;
  this.__hitCanvas || (this.__hitCanvas = a ? t2.getPixelType(this, { contextSettings: { willReadFrequently: true } }) : t2.getPathType(this));
  const n2 = this.__hitCanvas;
  if (a) {
    const { renderBounds: t3 } = this.__layout, a2 = Kt.image.hitCanvasSize, r2 = n2.hitScale = Gt.set(0, 0, a2, a2).getFitMatrix(t3).a, { x: h, y: o2, width: d2, height: g2 } = Gt.set(t3).scale(r2);
    n2.resize({ width: d2, height: g2, pixelRatio: 1 }), n2.clear(), sn.patternLocked = true, this.__renderShape(n2, { matrix: Kt3.setWith(this.__world).scaleWith(1 / r2).invertWith().translate(-h, -o2), snapshot: true, ignoreFill: !i2, ignoreStroke: !s2 }), sn.patternLocked = false, n2.resetTransform(), e2.__isHitPixel = true;
  } else e2.__isHitPixel && (e2.__isHitPixel = false);
  this.__drawHitPath(n2), n2.setStrokeOptions(e2);
}, Vt3.__hit = function(t2, e2) {
  if (this.__box && this.__box.__hit(t2)) return true;
  const i2 = this.__;
  if (i2.__isHitPixel && this.__hitPixel(t2)) return true;
  const { hitFill: s2 } = i2, a = (i2.fill || i2.__isCanvas) && ("path" === s2 || "pixel" === s2 && !(i2.__isAlphaPixelFill || i2.__isCanvas)) || "all" === s2 || e2;
  if (a && this.__hitFill(t2)) return true;
  const { hitStroke: n2, __maxStrokeWidth: r2 } = i2, h = i2.stroke && ("path" === n2 || "pixel" === n2 && !i2.__isAlphaPixelStroke) || "all" === n2;
  if (!a && !h) return false;
  const o2 = 2 * t2.radiusX;
  let d2 = o2;
  if (h) switch (i2.strokeAlign) {
    case "inside":
      if (d2 += 2 * r2, !a && this.__hitFill(t2) && this.__hitStroke(t2, d2)) return true;
      d2 = o2;
      break;
    case "center":
      d2 += r2;
      break;
    case "outside":
      if (d2 += 2 * r2, !a) {
        if (!this.__hitFill(t2) && this.__hitStroke(t2, d2)) return true;
        d2 = o2;
      }
  }
  return !!d2 && this.__hitStroke(t2, d2);
};
var Ut3 = ye2.prototype;
var jt3 = Se2.prototype;
var Xt3 = Ce2.prototype;
jt3.__updateHitCanvas = Xt3.__updateHitCanvas = function() {
  this.stroke || this.cornerRadius || (this.fill || this.__.__isCanvas) && "pixel" === this.hitFill || "all" === this.hitStroke ? Ut3.__updateHitCanvas.call(this) : this.__hitCanvas && (this.__hitCanvas = null);
}, jt3.__hitFill = Xt3.__hitFill = function(t2) {
  return this.__hitCanvas ? Ut3.__hitFill.call(this, t2) : Ft.hitRadiusPoint(this.__layout.boxBounds, t2);
}, di2.prototype.__drawHitPath = function(t2) {
  const { __lineHeight: e2, fontSize: i2, __baseLine: s2, __letterSpacing: a, __textDrawData: n2 } = this.__;
  t2.beginPath(), a < 0 ? this.__drawPathByBox(t2) : n2.rows.forEach((a2) => t2.rect(a2.x, a2.y - s2, a2.width, e2 < i2 ? i2 : e2));
}, ve2.prototype.pick = function(t2, e2) {
  return e2 || (e2 = e), this.updateLayout(), Kt.getSelector(this).getByPoint(t2, e2.hitRadius || 0, Object.assign(Object.assign({}, e2), { target: this }));
};
var Yt3 = Ie.prototype;
Yt3.hitFill = function(t2, e2) {
  return e2 ? this.context.isPointInPath(t2.x, t2.y, e2) : this.context.isPointInPath(t2.x, t2.y);
}, Yt3.hitStroke = function(t2, e2) {
  return this.strokeWidth = e2, this.context.isPointInStroke(t2.x, t2.y);
}, Yt3.hitPixel = function(t2, e2, i2 = 1) {
  let { x: s2, y: a, radiusX: n2, radiusY: r2 } = t2;
  e2 && (s2 -= e2.x, a -= e2.y), Gt.set(s2 - n2, a - r2, 2 * n2, 2 * r2).scale(i2).ceil();
  const { data: h } = this.context.getImageData(Gt.x, Gt.y, Gt.width || 1, Gt.height || 1);
  for (let t3 = 0, e3 = h.length; t3 < e3; t3 += 4) if (h[t3 + 3] > 0) return true;
  return h[3] > 0;
};

// node_modules/leafer-ui/dist/web.esm.min.js
var J3;
function tt3(t2, e2, i2, s2) {
  return new (i2 || (i2 = Promise))(function(n2, o2) {
    function r2(t3) {
      try {
        h(s2.next(t3));
      } catch (t4) {
        o2(t4);
      }
    }
    function a(t3) {
      try {
        h(s2.throw(t3));
      } catch (t4) {
        o2(t4);
      }
    }
    function h(t3) {
      var e3;
      t3.done ? n2(t3.value) : (e3 = t3.value, e3 instanceof i2 ? e3 : new i2(function(t4) {
        t4(e3);
      })).then(r2, a);
    }
    h((s2 = s2.apply(t2, e2 || [])).next());
  });
}
!(function(t2) {
  t2[t2.none = 1] = "none", t2[t2.free = 2] = "free", t2[t2.mirrorAngle = 3] = "mirrorAngle", t2[t2.mirror = 4] = "mirror";
})(J3 || (J3 = {})), "function" == typeof SuppressedError && SuppressedError;
var et3 = se.get("LeaferCanvas");
var it3 = class extends Ie {
  set zIndex(t2) {
    const { style: e2 } = this.view;
    e2.zIndex = t2, this.setAbsolute(this.view);
  }
  set childIndex(t2) {
    const { view: e2, parentView: i2 } = this;
    if (e2 && i2) {
      const s2 = i2.children[t2];
      s2 ? (this.setAbsolute(s2), i2.insertBefore(e2, s2)) : i2.appendChild(s2);
    }
  }
  init() {
    const { config: t2 } = this, e2 = t2.view || t2.canvas;
    e2 ? this.__createViewFrom(e2) : this.__createView();
    const { style: s2 } = this.view;
    if (s2.display || (s2.display = "block"), this.parentView = this.view.parentElement, this.parentView) {
      const t3 = this.parentView.style;
      t3.webkitUserSelect = t3.userSelect = "none", this.view.classList.add("leafer-canvas-view");
    }
    Kt.syncDomFont && !this.parentView && (s2.display = "none", document.body && document.body.appendChild(this.view)), this.__createContext(), this.autoLayout || this.resize(t2);
  }
  set backgroundColor(t2) {
    this.view.style.backgroundColor = t2;
  }
  get backgroundColor() {
    return this.view.style.backgroundColor;
  }
  set hittable(t2) {
    this.view.style.pointerEvents = t2 ? "auto" : "none";
  }
  get hittable() {
    return "none" !== this.view.style.pointerEvents;
  }
  __createView() {
    this.view = document.createElement("canvas");
  }
  __createViewFrom(t2) {
    let e2 = i(t2) ? document.getElementById(t2) : t2;
    if (e2) if (e2 instanceof HTMLCanvasElement) this.view = e2;
    else {
      let t3 = e2;
      if (e2 === window || e2 === document) {
        const e3 = document.createElement("div"), { style: i3 } = e3;
        i3.position = "absolute", i3.top = i3.bottom = i3.left = i3.right = "0px", document.body.appendChild(e3), t3 = e3;
      }
      this.__createView();
      const i2 = this.view;
      t3.hasChildNodes() && (this.setAbsolute(i2), t3.style.position || (t3.style.position = "relative")), t3.appendChild(i2);
    }
    else et3.error(`no id: ${t2}`), this.__createView();
  }
  setAbsolute(t2) {
    const { style: e2 } = t2;
    e2.position = "absolute", e2.top = e2.left = "0px";
  }
  updateViewSize() {
    const { width: t2, height: e2, pixelRatio: i2 } = this, { style: s2 } = this.view;
    s2.width = t2 + "px", s2.height = e2 + "px", this.unreal || (this.view.width = Math.ceil(t2 * i2), this.view.height = Math.ceil(e2 * i2));
  }
  updateClientBounds() {
    this.view.parentElement && (this.clientBounds = this.view.getBoundingClientRect());
  }
  startAutoLayout(t2, e2) {
    if (this.resizeListener = e2, t2) {
      if (this.autoBounds = t2, this.resizeObserver) return;
      try {
        this.resizeObserver = new ResizeObserver((t4) => {
          this.updateClientBounds();
          for (const e3 of t4) this.checkAutoBounds(e3.contentRect);
        });
        const t3 = this.parentView;
        t3 ? (this.resizeObserver.observe(t3), this.checkAutoBounds(t3.getBoundingClientRect())) : (this.checkAutoBounds(this.view), et3.warn("no parent"));
      } catch (t3) {
        this.imitateResizeObserver();
      }
      this.stopListenPixelRatio();
    } else this.listenPixelRatio(), this.unreal && this.updateViewSize();
  }
  imitateResizeObserver() {
    this.autoLayout && (this.parentView && this.checkAutoBounds(this.parentView.getBoundingClientRect()), Kt.requestRender(this.imitateResizeObserver.bind(this)));
  }
  listenPixelRatio() {
    this.windowListener || window.addEventListener("resize", this.windowListener = () => {
      const t2 = Kt.devicePixelRatio;
      if (!this.config.pixelRatio && this.pixelRatio !== t2) {
        const { width: e2, height: i2 } = this;
        this.emitResize({ width: e2, height: i2, pixelRatio: t2 });
      }
    });
  }
  stopListenPixelRatio() {
    this.windowListener && (window.removeEventListener("resize", this.windowListener), this.windowListener = null);
  }
  checkAutoBounds(t2) {
    const e2 = this.view, { x: s2, y: n2, width: o2, height: r2 } = this.autoBounds.getBoundsFrom(t2), a = { width: o2, height: r2, pixelRatio: this.config.pixelRatio ? this.pixelRatio : Kt.devicePixelRatio };
    if (!this.isSameSize(a)) {
      const { style: t3 } = e2;
      t3.marginLeft = s2 + "px", t3.marginTop = n2 + "px", this.emitResize(a);
    }
  }
  stopAutoLayout() {
    this.autoLayout = false, this.resizeObserver && this.resizeObserver.disconnect(), this.resizeListener = this.resizeObserver = null;
  }
  emitResize(t2) {
    const e2 = {};
    _.copyAttrs(e2, this, Ee), this.resize(t2), this.resizeListener && !s(this.width) && this.resizeListener(new Ko(t2, e2));
  }
  unrealCanvas() {
    if (!this.unreal && this.parentView) {
      let t2 = this.view;
      t2 && t2.remove(), t2 = this.view = document.createElement("div"), this.parentView.appendChild(this.view), t2.classList.add("leafer-app-view"), this.unreal = true;
    }
  }
  destroy() {
    const { view: t2 } = this;
    t2 && (this.stopAutoLayout(), this.stopListenPixelRatio(), t2.parentElement && t2.remove(), super.destroy());
  }
};
function st2(t2, e2) {
  Kt.origin = { createCanvas(t3, e3) {
    const i2 = document.createElement("canvas");
    return i2.width = t3, i2.height = e3, i2;
  }, canvasToDataURL: (t3, e3, i2) => {
    const s2 = qi.mimeType(e3), n2 = t3.toDataURL(s2, i2);
    return "image/bmp" === s2 ? n2.replace("image/png;", "image/bmp;") : n2;
  }, canvasToBolb: (t3, e3, i2) => new Promise((s2) => t3.toBlob(s2, qi.mimeType(e3), i2)), canvasSaveAs: (t3, e3, s2) => {
    const n2 = t3.toDataURL(qi.mimeType(qi.fileType(e3)), s2);
    return Kt.origin.download(n2, e3);
  }, download(t3, e3) {
    return tt3(this, void 0, void 0, function* () {
      let i2 = document.createElement("a");
      i2.href = t3, i2.download = e3, document.body.appendChild(i2), i2.click(), document.body.removeChild(i2);
    });
  }, loadImage: (t3, e3, s2) => new Promise((s3, n2) => {
    const o2 = new Kt.origin.Image();
    e3 && (o2.setAttribute("crossOrigin", e3), o2.crossOrigin = e3), o2.onload = () => {
      s3(o2);
    }, o2.onerror = (t4) => {
      n2(t4);
    }, o2.src = Kt.image.getRealURL(t3);
  }), loadContent(t3) {
    return tt3(this, arguments, void 0, function* (t4, e3 = "text") {
      const i2 = yield fetch(t4);
      if (!i2.ok) throw new Error(`${i2.status}`);
      return yield i2[e3]();
    });
  }, Image, PointerEvent, DragEvent }, Kt.event = { stopDefault(t3) {
    t3.preventDefault();
  }, stopNow(t3) {
    t3.stopImmediatePropagation();
  }, stop(t3) {
    t3.stopPropagation();
  } }, Kt.canvas = de.canvas(), Kt.conicGradientSupport = !!Kt.canvas.context.createConicGradient;
}
Gi(CanvasRenderingContext2D.prototype), Gi(Path2D.prototype), Object.assign(de, { canvas: (t2, e2) => new it3(t2, e2), image: (t2) => new an(t2) }), Kt.name = "web", Kt.isMobile = "ontouchstart" in window, Kt.requestRender = function(t2) {
  window.requestAnimationFrame(t2);
}, dn(Kt, "devicePixelRatio", { get: () => devicePixelRatio });
var { userAgent: nt3 } = navigator;
nt3.indexOf("Firefox") > -1 ? (Kt.intWheelDeltaY = true, Kt.syncDomFont = true) : (/iPhone|iPad|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && /Version\/[\d.]+.*Safari/.test(navigator.userAgent)) && (Kt.fullImageShadow = true), nt3.indexOf("Windows") > -1 ? (Kt.os = "Windows", Kt.intWheelDeltaY = true) : nt3.indexOf("Mac") > -1 ? Kt.os = "Mac" : nt3.indexOf("Linux") > -1 && (Kt.os = "Linux");
var ot3 = class {
  get childrenChanged() {
    return this.hasAdd || this.hasRemove || this.hasVisible;
  }
  get updatedList() {
    if (this.hasRemove && this.config.usePartLayout) {
      const t2 = new Ch();
      return this.__updatedList.list.forEach((e2) => {
        e2.leafer && t2.add(e2);
      }), t2;
    }
    return this.__updatedList;
  }
  constructor(t2, e2) {
    this.totalTimes = 0, this.config = {}, this.__updatedList = new Ch(), this.target = t2, e2 && (this.config = _.default(e2, this.config)), this.__listenEvents();
  }
  start() {
    this.disabled || (this.running = true);
  }
  stop() {
    this.running = false;
  }
  disable() {
    this.stop(), this.__removeListenEvents(), this.disabled = true;
  }
  update() {
    this.changed = true, this.running && this.target.emit(sa.REQUEST);
  }
  __onAttrChange(t2) {
    this.config.usePartLayout && this.__updatedList.add(t2.target), this.update();
  }
  __onChildEvent(t2) {
    this.config.usePartLayout && (t2.type === Fo.ADD ? (this.hasAdd = true, this.__pushChild(t2.child)) : (this.hasRemove = true, this.__updatedList.add(t2.parent))), this.update();
  }
  __pushChild(t2) {
    this.__updatedList.add(t2), t2.isBranch && this.__loopChildren(t2);
  }
  __loopChildren(t2) {
    const { children: e2 } = t2;
    for (let t3 = 0, i2 = e2.length; t3 < i2; t3++) this.__pushChild(e2[t3]);
  }
  __onRquestData() {
    this.target.emitEvent(new ta(ta.DATA, { updatedList: this.updatedList })), this.__updatedList = new Ch(), this.totalTimes++, this.changed = this.hasVisible = this.hasRemove = this.hasAdd = false;
  }
  __listenEvents() {
    this.__eventIds = [this.target.on_([[jo.CHANGE, this.__onAttrChange, this], [[Fo.ADD, Fo.REMOVE], this.__onChildEvent, this], [ta.REQUEST, this.__onRquestData, this]])];
  }
  __removeListenEvents() {
    this.target.off_(this.__eventIds);
  }
  destroy() {
    this.target && (this.stop(), this.__removeListenEvents(), this.target = this.__updatedList = null);
  }
};
var { updateAllMatrix: rt2, updateBounds: at3, updateChange: ht3 } = uo;
var { pushAllChildBranch: lt3, pushAllParent: ct3 } = ko;
var { worldBounds: dt3 } = wo;
var ut3 = class {
  constructor(t2) {
    this.updatedBounds = new Ht(), this.beforeBounds = new Ht(), this.afterBounds = new Ht(), l(t2) && (t2 = new Ch(t2)), this.updatedList = t2;
  }
  setBefore() {
    this.beforeBounds.setListWithFn(this.updatedList.list, dt3);
  }
  setAfter() {
    this.afterBounds.setListWithFn(this.updatedList.list, dt3), this.updatedBounds.setList([this.beforeBounds, this.afterBounds]);
  }
  merge(t2) {
    this.updatedList.addList(t2.updatedList.list), this.beforeBounds.add(t2.beforeBounds), this.afterBounds.add(t2.afterBounds), this.updatedBounds.add(t2.updatedBounds);
  }
  destroy() {
    this.updatedList = null;
  }
};
var { updateAllMatrix: ft3, updateAllChange: pt3 } = uo;
var gt2 = se.get("Layouter");
var wt3 = class _wt {
  constructor(t2, e2) {
    this.totalTimes = 0, this.config = { usePartLayout: true }, this.__levelList = new Oh(), this.target = t2, e2 && (this.config = _.default(e2, this.config)), this.__listenEvents();
  }
  start() {
    this.disabled || (this.running = true);
  }
  stop() {
    this.running = false;
  }
  disable() {
    this.stop(), this.__removeListenEvents(), this.disabled = true;
  }
  layout() {
    if (this.layouting || !this.running) return;
    const { target: t2 } = this;
    this.times = 0;
    try {
      t2.emit(ea.START), this.layoutOnce(), t2.emitEvent(new ea(ea.END, this.layoutedBlocks, this.times));
    } catch (t3) {
      gt2.error(t3);
    }
    this.layoutedBlocks = null;
  }
  layoutAgain() {
    this.layouting ? this.waitAgain = true : this.layoutOnce();
  }
  layoutOnce() {
    return this.layouting ? gt2.warn("layouting") : this.times > 3 ? gt2.warn("layout max times") : (this.times++, this.totalTimes++, this.layouting = true, this.target.emit(ta.REQUEST), this.totalTimes > 1 && this.config.usePartLayout ? this.partLayout() : this.fullLayout(), this.layouting = false, void (this.waitAgain && (this.waitAgain = false, this.layoutOnce())));
  }
  partLayout() {
    var t2;
    if (!(null === (t2 = this.__updatedList) || void 0 === t2 ? void 0 : t2.length)) return;
    const e2 = oe.start("PartLayout"), { target: i2, __updatedList: s2 } = this, { BEFORE: n2, LAYOUT: o2, AFTER: r2 } = ea, a = this.getBlocks(s2);
    a.forEach((t3) => t3.setBefore()), i2.emitEvent(new ea(n2, a, this.times)), this.extraBlock = null, s2.sort(), (function(t3, e3) {
      let i3;
      t3.list.forEach((t4) => {
        i3 = t4.__layout, e3.without(t4) && !i3.proxyZoom && (i3.matrixChanged ? (rt2(t4, true), e3.add(t4), t4.isBranch && lt3(t4, e3), ct3(t4, e3)) : i3.boundsChanged && (e3.add(t4), t4.isBranch && (t4.__tempNumber = 0), ct3(t4, e3)));
      });
    })(s2, this.__levelList), (function(t3) {
      let e3, i3, s3;
      t3.sort(true), t3.levels.forEach((n3) => {
        e3 = t3.levelMap[n3];
        for (let t4 = 0, n4 = e3.length; t4 < n4; t4++) {
          if (i3 = e3[t4], i3.isBranch && i3.__tempNumber) {
            s3 = i3.children;
            for (let t5 = 0, e4 = s3.length; t5 < e4; t5++) s3[t5].isBranch || at3(s3[t5]);
          }
          at3(i3);
        }
      });
    })(this.__levelList), (function(t3) {
      t3.list.forEach(ht3);
    })(s2), this.extraBlock && a.push(this.extraBlock), a.forEach((t3) => t3.setAfter()), i2.emitEvent(new ea(o2, a, this.times)), i2.emitEvent(new ea(r2, a, this.times)), this.addBlocks(a), this.__levelList.reset(), this.__updatedList = null, oe.end(e2);
  }
  fullLayout() {
    const t2 = oe.start("FullLayout"), { target: e2 } = this, { BEFORE: i2, LAYOUT: s2, AFTER: n2 } = ea, o2 = this.getBlocks(new Ch(e2));
    e2.emitEvent(new ea(i2, o2, this.times)), _wt.fullLayout(e2), o2.forEach((t3) => {
      t3.setAfter();
    }), e2.emitEvent(new ea(s2, o2, this.times)), e2.emitEvent(new ea(n2, o2, this.times)), this.addBlocks(o2), oe.end(t2);
  }
  static fullLayout(t2) {
    ft3(t2, true), t2.isBranch ? ko.updateBounds(t2) : uo.updateBounds(t2), pt3(t2);
  }
  addExtra(t2) {
    if (!this.__updatedList.has(t2)) {
      const { updatedList: e2, beforeBounds: i2 } = this.extraBlock || (this.extraBlock = new ut3([]));
      e2.length ? i2.add(t2.__world) : i2.set(t2.__world), e2.add(t2);
    }
  }
  createBlock(t2) {
    return new ut3(t2);
  }
  getBlocks(t2) {
    return [this.createBlock(t2)];
  }
  addBlocks(t2) {
    this.layoutedBlocks ? this.layoutedBlocks.push(...t2) : this.layoutedBlocks = t2;
  }
  __onReceiveWatchData(t2) {
    this.__updatedList = t2.data.updatedList;
  }
  __listenEvents() {
    this.__eventIds = [this.target.on_([[ea.REQUEST, this.layout, this], [ea.AGAIN, this.layoutAgain, this], [ta.DATA, this.__onReceiveWatchData, this]])];
  }
  __removeListenEvents() {
    this.target.off_(this.__eventIds);
  }
  destroy() {
    this.target && (this.stop(), this.__removeListenEvents(), this.target = this.config = null);
  }
};
var _t3 = se.get("Renderer");
var mt4 = class _mt {
  get needFill() {
    return !(this.canvas.allowBackgroundColor || !this.config.fill);
  }
  constructor(t2, e2, i2) {
    this.FPS = 60, this.totalTimes = 0, this.times = 0, this.config = { usePartRender: true, ceilPartPixel: true, maxFPS: 120 }, this.frames = [], this.target = t2, this.canvas = e2, i2 && (this.config = _.default(i2, this.config)), this.__listenEvents();
  }
  start() {
    this.running = true, this.update(false);
  }
  stop() {
    this.running = false;
  }
  update(t2 = true) {
    this.changed || (this.changed = t2), this.requestTime || this.__requestRender();
  }
  requestLayout() {
    this.target.emit(ea.REQUEST);
  }
  checkRender() {
    if (this.running) {
      const { target: t2 } = this;
      t2.isApp && (t2.emit(sa.CHILD_START, t2), t2.children.forEach((t3) => {
        t3.renderer.FPS = this.FPS, t3.renderer.checkRender();
      }), t2.emit(sa.CHILD_END, t2)), this.changed && this.canvas.view && this.render(), this.target.emit(sa.NEXT);
    }
  }
  render(t2) {
    if (!this.running || !this.canvas.view) return this.update();
    const { target: e2 } = this;
    this.times = 0, this.totalBounds = new Ht(), _t3.log(e2.innerName, "--->");
    try {
      this.emitRender(sa.START), this.renderOnce(t2), this.emitRender(sa.END, this.totalBounds), sn.clearRecycled();
    } catch (t3) {
      this.rendering = false, _t3.error(t3);
    }
    _t3.log("-------------|");
  }
  renderAgain() {
    this.rendering ? this.waitAgain = true : this.renderOnce();
  }
  renderOnce(t2) {
    if (this.rendering) return _t3.warn("rendering");
    if (this.times > 3) return _t3.warn("render max times");
    if (this.times++, this.totalTimes++, this.rendering = true, this.changed = false, this.renderBounds = new Ht(), this.renderOptions = {}, t2) this.emitRender(sa.BEFORE), t2();
    else {
      if (this.requestLayout(), this.ignore) return void (this.ignore = this.rendering = false);
      this.emitRender(sa.BEFORE), this.config.usePartRender && this.totalTimes > 1 ? this.partRender() : this.fullRender();
    }
    this.emitRender(sa.RENDER, this.renderBounds, this.renderOptions), this.emitRender(sa.AFTER, this.renderBounds, this.renderOptions), this.updateBlocks = null, this.rendering = false, this.waitAgain && (this.waitAgain = false, this.renderOnce());
  }
  partRender() {
    const { canvas: t2, updateBlocks: e2 } = this;
    e2 && (this.mergeBlocks(), e2.forEach((e3) => {
      t2.bounds.hit(e3) && !e3.isEmpty() && this.clipRender(e3);
    }));
  }
  clipRender(t2) {
    const e2 = oe.start("PartRender"), { canvas: i2 } = this, s2 = t2.getIntersect(i2.bounds), n2 = new Ht(s2);
    i2.save(), s2.spread(_mt.clipSpread).ceil();
    const { ceilPartPixel: o2 } = this.config;
    i2.clipWorld(s2, o2), i2.clearWorld(s2, o2), this.__render(s2, n2), i2.restore(), oe.end(e2);
  }
  fullRender() {
    const t2 = oe.start("FullRender"), { canvas: e2 } = this;
    e2.save(), e2.clear(), this.__render(e2.bounds), e2.restore(), oe.end(t2);
  }
  __render(e2, s2) {
    const { canvas: n2, target: o2 } = this, r2 = e2.includes(o2.__world), a = r2 ? { includes: r2 } : { bounds: e2, includes: r2 };
    this.needFill && n2.fillWorld(e2, this.config.fill), se.showRepaint && se.drawRepaint(n2, e2), this.config.useCellRender && (a.cellList = this.getCellList()), Kt.render(o2, n2, a), this.renderBounds = s2 = s2 || e2, this.renderOptions = a, this.totalBounds.isEmpty() ? this.totalBounds = s2 : this.totalBounds.add(s2), n2.updateRender(s2);
  }
  getCellList() {
  }
  addBlock(t2, e2) {
    this.updateBlocks || (this.updateBlocks = []), this.updateBlocks.push(t2);
  }
  mergeBlocks() {
    const { updateBlocks: t2 } = this;
    if (t2) {
      const e2 = new Ht();
      e2.setList(t2), t2.length = 0, t2.push(e2);
    }
  }
  __requestRender() {
    const t2 = this.target;
    if (this.requestTime || !t2) return;
    if (t2.parentApp) return t2.parentApp.requestRender(false);
    this.requestTime = this.frameTime || Date.now();
    const e2 = () => {
      const t3 = 1e3 / ((this.frameTime = Date.now()) - this.requestTime), { maxFPS: s2 } = this.config;
      if (s2 && t3 > s2) return Kt.requestRender(e2);
      const { frames: n2 } = this;
      n2.length > 30 && n2.shift(), n2.push(t3), this.FPS = Math.round(n2.reduce((t4, e3) => t4 + e3, 0) / n2.length), this.requestTime = 0, this.checkRender();
    };
    Kt.requestRender(e2);
  }
  __onResize(t2) {
    if (!this.canvas.unreal) {
      if (t2.bigger || !t2.samePixelRatio) {
        const { width: e2, height: i2 } = t2.old;
        if (!new Ht(0, 0, e2, i2).includes(this.target.__world) || this.needFill || !t2.samePixelRatio) return this.addBlock(this.canvas.bounds), void this.target.forceUpdate("surface");
      }
      this.addBlock(new Ht(0, 0, 1, 1)), this.update();
    }
  }
  __onLayoutEnd(t2) {
    t2.data && t2.data.map((t3) => {
      let e2;
      const { updatedList: i2 } = t3;
      i2 && i2.list.some((t4) => (e2 = !t4.__world.width || !t4.__world.height, e2 && (t4.isLeafer || _t3.tip(t4.innerName, ": empty"), e2 = !t4.isBranch || t4.isBranchLeaf), e2)), this.addBlock(e2 ? this.canvas.bounds : t3.updatedBounds, i2);
    });
  }
  emitRender(t2, e2, i2) {
    this.target.emitEvent(new sa(t2, this.times, e2, i2));
  }
  __listenEvents() {
    this.__eventIds = [this.target.on_([[sa.REQUEST, this.update, this], [ea.END, this.__onLayoutEnd, this], [sa.AGAIN, this.renderAgain, this], [Ko.RESIZE, this.__onResize, this]])];
  }
  __removeListenEvents() {
    this.target.off_(this.__eventIds);
  }
  destroy() {
    this.target && (this.stop(), this.__removeListenEvents(), this.config = {}, this.target = this.canvas = null);
  }
};
mt4.clipSpread = 10;
var vt3 = {};
var { copyRadiusPoint: yt3 } = at;
var { hitRadiusPoint: xt3 } = Ft;
var bt4 = class {
  constructor(t2, e2) {
    this.target = t2, this.selector = e2;
  }
  getByPoint(t2, e2, i2) {
    e2 || (e2 = 0), i2 || (i2 = {});
    const s2 = i2.through || false, n2 = i2.ignoreHittable || false, o2 = i2.target || this.target;
    this.exclude = i2.exclude || null, this.point = { x: t2.x, y: t2.y, radiusX: e2, radiusY: e2 }, this.findList = new Ch(i2.findList), i2.findList || this.hitBranch(o2.isBranchLeaf ? { children: [o2] } : o2);
    const { list: r2 } = this.findList, a = this.getBestMatchLeaf(r2, i2.bottomList, n2, !!i2.findList), h = n2 ? this.getPath(a) : this.getHitablePath(a);
    return this.clear(), s2 ? { path: h, target: a, throughPath: r2.length ? this.getThroughPath(r2) : h } : { path: h, target: a };
  }
  hitPoint(t2, e2, i2) {
    return !!this.getByPoint(t2, e2, i2).target;
  }
  getBestMatchLeaf(t2, e2, i2, s2) {
    const n2 = this.findList = new Ch();
    if (t2.length) {
      let e3;
      const { x: s3, y: o2 } = this.point, r2 = { x: s3, y: o2, radiusX: 0, radiusY: 0 };
      for (let s4 = 0, o3 = t2.length; s4 < o3; s4++) if (e3 = t2[s4], (i2 || uo.worldHittable(e3)) && (this.hitChild(e3, r2), n2.length)) {
        if (e3.isBranchLeaf && t2.some((t3) => t3 !== e3 && uo.hasParent(t3, e3))) {
          n2.reset();
          break;
        }
        return n2.list[0];
      }
    }
    if (e2) {
      for (let t3 = 0, i3 = e2.length; t3 < i3; t3++) if (this.hitChild(e2[t3].target, this.point, e2[t3].proxy), n2.length) return n2.list[0];
    }
    return s2 ? null : i2 ? t2[0] : t2.find((t3) => uo.worldHittable(t3));
  }
  getPath(t2) {
    const e2 = new Ch(), i2 = [], { target: s2 } = this;
    for (; t2 && (t2.syncEventer && i2.push(t2.syncEventer), e2.add(t2), (t2 = t2.parent) !== s2); ) ;
    return i2.length && i2.forEach((t3) => {
      for (; t3 && (t3.__.hittable && e2.add(t3), (t3 = t3.parent) !== s2); ) ;
    }), s2 && e2.add(s2), e2;
  }
  getHitablePath(t2) {
    const e2 = this.getPath(t2 && t2.hittable ? t2 : null);
    let i2, s2 = new Ch();
    for (let t3 = e2.list.length - 1; t3 > -1 && (i2 = e2.list[t3], i2.__.hittable) && (s2.addAt(i2, 0), i2.__.hitChildren && (!i2.isLeafer || "draw" !== i2.mode)); t3--) ;
    return s2;
  }
  getThroughPath(t2) {
    const e2 = new Ch(), i2 = [];
    for (let e3 = t2.length - 1; e3 > -1; e3--) i2.push(this.getPath(t2[e3]));
    let s2, n2, o2;
    for (let t3 = 0, r2 = i2.length; t3 < r2; t3++) {
      s2 = i2[t3], n2 = i2[t3 + 1];
      for (let t4 = 0, i3 = s2.length; t4 < i3 && (o2 = s2.list[t4], !n2 || !n2.has(o2)); t4++) e2.add(o2);
    }
    return e2;
  }
  hitBranch(t2) {
    this.eachFind(t2.children, t2.__onlyHitMask);
  }
  eachFind(t2, e2) {
    let i2, s2, n2;
    const { point: o2 } = this;
    for (let r2 = t2.length - 1; r2 > -1; r2--) if (i2 = t2[r2], n2 = i2.__, n2.visible && (!e2 || n2.mask)) if (s2 = xt3(i2.__world, n2.hitRadius ? yt3(vt3, o2, n2.hitRadius) : o2), i2.isBranch) {
      if (s2 || i2.__ignoreHitWorld) {
        if (i2.isBranchLeaf && n2.__clipAfterFill && !i2.__hitWorld(o2, true)) continue;
        i2.topChildren && this.eachFind(i2.topChildren, false), this.eachFind(i2.children, i2.__onlyHitMask), i2.isBranchLeaf && this.hitChild(i2, o2);
      }
    } else s2 && this.hitChild(i2, o2);
  }
  hitChild(t2, e2, i2) {
    if ((!this.exclude || !this.exclude.has(t2)) && t2.__hitWorld(e2)) {
      const { parent: s2 } = t2;
      if (s2 && s2.__hasMask && !t2.__.mask) {
        let i3, n2 = [];
        const { children: o2 } = s2;
        for (let s3 = 0, r2 = o2.length; s3 < r2; s3++) if (i3 = o2[s3], i3.__.mask && n2.push(i3), i3 === t2) {
          if (n2 && !n2.every((t3) => t3.__hitWorld(e2))) return;
          break;
        }
      }
      this.findList.add(i2 || t2);
    }
  }
  clear() {
    this.point = null, this.findList = null, this.exclude = null;
  }
  destroy() {
    this.clear();
  }
};
var St3 = class {
  constructor(t2, e2) {
    this.config = {}, e2 && (this.config = _.default(e2, this.config)), this.picker = new bt4(this.target = t2, this), this.finder = de.finder && de.finder(t2, this.config);
  }
  getByPoint(t2, e2, s2) {
    const { target: n2, picker: o2 } = this;
    return Kt.backgrounder && n2 && n2.updateLayout(), o2.getByPoint(t2, e2, s2);
  }
  hitPoint(t2, e2, i2) {
    return this.picker.hitPoint(t2, e2, i2);
  }
  getBy(t2, e2, i2, s2) {
    return this.finder ? this.finder.getBy(t2, e2, i2, s2) : le.need("find");
  }
  destroy() {
    this.picker.destroy(), this.finder && this.finder.destroy();
  }
};
Object.assign(de, { watcher: (t2, e2) => new ot3(t2, e2), layouter: (t2, e2) => new wt3(t2, e2), renderer: (t2, e2, i2) => new mt4(t2, e2, i2), selector: (t2, e2) => new St3(t2, e2) }), Kt.layout = wt3.fullLayout, Kt.render = function(t2, e2, i2) {
  const s2 = Object.assign(Object.assign({}, i2), { topRendering: true });
  i2.topList = new Ch(), t2.__render(e2, i2), i2.topList.length && i2.topList.forEach((t3) => t3.__render(e2, s2));
};
var kt4 = { convert(t2, e2) {
  const i2 = _t2.getBase(t2), { x: s2, y: n2 } = e2, o2 = Object.assign(Object.assign({}, i2), { x: s2, y: n2, width: t2.width, height: t2.height, pointerType: t2.pointerType, pressure: t2.pressure });
  return "pen" === o2.pointerType && (o2.tangentialPressure = t2.tangentialPressure, o2.tiltX = t2.tiltX, o2.tiltY = t2.tiltY, o2.twist = t2.twist), o2;
}, convertMouse(t2, e2) {
  const i2 = _t2.getBase(t2), { x: s2, y: n2 } = e2;
  return Object.assign(Object.assign({}, i2), { x: s2, y: n2, width: 1, height: 1, pointerType: "mouse", pressure: 0.5 });
}, convertTouch(t2, e2) {
  const i2 = kt4.getTouch(t2), s2 = _t2.getBase(t2), { x: n2, y: o2 } = e2;
  return Object.assign(Object.assign({}, s2), { x: n2, y: o2, width: 1, height: 1, pointerType: "touch", multiTouch: t2.touches.length > 1, pressure: i2.force });
}, getTouch: (t2) => t2.targetTouches[0] || t2.changedTouches[0] };
var Lt4 = { convert(t2) {
  const e2 = _t2.getBase(t2);
  return Object.assign(Object.assign({}, e2), { code: t2.code, key: t2.key });
} };
var { pathCanDrag: Tt4 } = _t2;
var Bt3 = class extends Mt2 {
  get windowTarget() {
    const { view: t2 } = this;
    return t2 && t2.ownerDocument || window;
  }
  get notPointer() {
    const { p: t2 } = this;
    return "pointer" !== t2.type || t2.touch || this.useMultiTouch;
  }
  get notTouch() {
    const { p: t2 } = this;
    return "mouse" === t2.type || this.usePointer;
  }
  get notMouse() {
    return this.usePointer || this.useTouch;
  }
  __listenEvents() {
    super.__listenEvents();
    const t2 = this.view = this.canvas.view;
    this.viewEvents = { pointerdown: this.onPointerDown, mousedown: this.onMouseDown, touchstart: this.onTouchStart, pointerleave: this.onPointerLeave, contextmenu: this.onContextMenu, wheel: this.onWheel, gesturestart: this.onGesturestart, gesturechange: this.onGesturechange, gestureend: this.onGestureend }, this.windowEvents = { pointermove: this.onPointerMove, pointerup: this.onPointerUp, pointercancel: this.onPointerCancel, mousemove: this.onMouseMove, mouseup: this.onMouseUp, touchmove: this.onTouchMove, touchend: this.onTouchEnd, touchcancel: this.onTouchCancel, keydown: this.onKeyDown, keyup: this.onKeyUp, scroll: this.onScroll };
    const { viewEvents: e2, windowEvents: i2 } = this;
    for (let i3 in e2) e2[i3] = e2[i3].bind(this), t2.addEventListener(i3, e2[i3]);
    for (let t3 in i2) i2[t3] = i2[t3].bind(this), this.windowTarget.addEventListener(t3, i2[t3]);
  }
  __removeListenEvents() {
    super.__removeListenEvents();
    const { viewEvents: t2, windowEvents: e2 } = this;
    for (let e3 in t2) this.view.removeEventListener(e3, t2[e3]), this.viewEvents = {};
    for (let t3 in e2) this.windowTarget.removeEventListener(t3, e2[t3]), this.windowEvents = {};
  }
  getTouches(t2) {
    const e2 = [];
    for (let i2 = 0, s2 = t2.length; i2 < s2; i2++) e2.push(t2[i2]);
    return e2;
  }
  preventDefaultPointer(t2) {
    const { pointer: e2 } = this.config;
    e2.preventDefault && t2.preventDefault();
  }
  preventDefaultWheel(t2) {
    const { wheel: e2 } = this.config;
    e2.preventDefault && t2.preventDefault();
  }
  preventWindowPointer(t2) {
    return !this.downData && t2.target !== this.view && (!this.config.shadowDOM || !t2.composedPath || !t2.composedPath().includes(this.view));
  }
  onKeyDown(t2) {
    this.keyDown(Lt4.convert(t2));
  }
  onKeyUp(t2) {
    this.keyUp(Lt4.convert(t2));
  }
  onContextMenu(t2) {
    this.config.pointer.preventDefaultMenu && t2.preventDefault(), this.menu(kt4.convert(t2, this.getLocal(t2)));
  }
  onScroll() {
    this.canvas.updateClientBounds();
  }
  onPointerDown(t2) {
    this.preventDefaultPointer(t2), this.notPointer || (this.usePointer || (this.usePointer = true), this.pointerDown(kt4.convert(t2, this.getLocal(t2))));
  }
  onPointerMove(t2, e2) {
    if (this.notPointer || this.preventWindowPointer(t2)) return;
    this.usePointer || (this.usePointer = true);
    const i2 = kt4.convert(t2, this.getLocal(t2, true));
    e2 ? this.pointerHover(i2) : this.pointerMove(i2);
  }
  onPointerLeave(t2) {
    this.onPointerMove(t2, true);
  }
  onPointerUp(t2) {
    this.downData && this.preventDefaultPointer(t2), this.notPointer || this.preventWindowPointer(t2) || this.pointerUp(kt4.convert(t2, this.getLocal(t2)));
  }
  onPointerCancel() {
    this.useMultiTouch || this.pointerCancel();
  }
  onMouseDown(t2) {
    this.preventDefaultPointer(t2), this.notMouse || this.pointerDown(kt4.convertMouse(t2, this.getLocal(t2)));
  }
  onMouseMove(t2) {
    this.notMouse || this.preventWindowPointer(t2) || this.pointerMove(kt4.convertMouse(t2, this.getLocal(t2, true)));
  }
  onMouseUp(t2) {
    this.downData && this.preventDefaultPointer(t2), this.notMouse || this.preventWindowPointer(t2) || this.pointerUp(kt4.convertMouse(t2, this.getLocal(t2)));
  }
  onMouseCancel() {
    this.notMouse || this.pointerCancel();
  }
  onTouchStart(t2) {
    const e2 = kt4.getTouch(t2), i2 = this.getLocal(e2, true), { preventDefault: s2 } = this.config.touch;
    (true === s2 || "auto" === s2 && Tt4(this.findPath(i2))) && t2.preventDefault(), this.multiTouchStart(t2), this.notTouch || (this.touchTimer && (window.clearTimeout(this.touchTimer), this.touchTimer = 0), this.useTouch = true, this.pointerDown(kt4.convertTouch(t2, i2)));
  }
  onTouchMove(t2) {
    if (this.multiTouchMove(t2), this.notTouch || this.preventWindowPointer(t2)) return;
    const e2 = kt4.getTouch(t2);
    this.pointerMove(kt4.convertTouch(t2, this.getLocal(e2)));
  }
  onTouchEnd(t2) {
    if (this.multiTouchEnd(), this.notTouch || this.preventWindowPointer(t2)) return;
    this.touchTimer && clearTimeout(this.touchTimer), this.touchTimer = setTimeout(() => {
      this.useTouch = false;
    }, 500);
    const e2 = kt4.getTouch(t2);
    this.pointerUp(kt4.convertTouch(t2, this.getLocal(e2)));
  }
  onTouchCancel() {
    this.notTouch || this.pointerCancel();
  }
  multiTouchStart(t2) {
    this.useMultiTouch = t2.touches.length > 1, this.touches = this.useMultiTouch ? this.getTouches(t2.touches) : void 0, this.useMultiTouch && this.pointerCancel();
  }
  multiTouchMove(t2) {
    if (this.useMultiTouch && t2.touches.length > 1) {
      const e2 = this.getTouches(t2.touches), i2 = this.getKeepTouchList(this.touches, e2);
      i2.length > 1 && (this.multiTouch(_t2.getBase(t2), i2), this.touches = e2);
    }
  }
  multiTouchEnd() {
    this.touches = null, this.useMultiTouch = false, this.transformEnd();
  }
  getKeepTouchList(t2, e2) {
    let i2;
    const s2 = [];
    return t2.forEach((t3) => {
      i2 = e2.find((e3) => e3.identifier === t3.identifier), i2 && s2.push({ from: this.getLocal(t3), to: this.getLocal(i2) });
    }), s2;
  }
  getLocalTouchs(t2) {
    return t2.map((t3) => this.getLocal(t3));
  }
  onWheel(t2) {
    this.preventDefaultWheel(t2), this.wheel(Object.assign(Object.assign(Object.assign({}, _t2.getBase(t2)), this.getLocal(t2)), { deltaX: t2.deltaX, deltaY: t2.deltaY }));
  }
  onGesturestart(t2) {
    this.useMultiTouch || (this.preventDefaultWheel(t2), this.lastGestureScale = 1, this.lastGestureRotation = 0);
  }
  onGesturechange(t2) {
    if (this.useMultiTouch) return;
    this.preventDefaultWheel(t2);
    const e2 = _t2.getBase(t2);
    Object.assign(e2, this.getLocal(t2));
    const i2 = t2.scale / this.lastGestureScale, s2 = (t2.rotation - this.lastGestureRotation) / Math.PI * 180 * (M.within(this.config.wheel.rotateSpeed, 0, 1) / 4 + 0.1);
    this.zoom(Object.assign(Object.assign({}, e2), { scale: i2 * i2 })), this.rotate(Object.assign(Object.assign({}, e2), { rotation: s2 })), this.lastGestureScale = t2.scale, this.lastGestureRotation = t2.rotation;
  }
  onGestureend(t2) {
    this.useMultiTouch || (this.preventDefaultWheel(t2), this.transformEnd());
  }
  setCursor(t2) {
    super.setCursor(t2);
    const e2 = [];
    this.eachCursor(t2, e2), d(e2[e2.length - 1]) && e2.push("default"), this.canvas.view.style.cursor = e2.map((t3) => d(t3) ? `url(${t3.url}) ${t3.x || 0} ${t3.y || 0}` : t3).join(",");
  }
  eachCursor(t2, e2, i2 = 0) {
    if (i2++, l(t2)) t2.forEach((t3) => this.eachCursor(t3, e2, i2));
    else {
      const n2 = i(t2) && St2.get(t2);
      n2 && i2 < 2 ? this.eachCursor(n2, e2, i2) : e2.push(t2);
    }
  }
  destroy() {
    this.view && (super.destroy(), this.view = null, this.touches = null);
  }
};
function Et4(t2, e2, i2) {
  t2.__.__font ? Wt2.fillText(t2, e2, i2) : t2.__.windingRule ? e2.fill(t2.__.windingRule) : e2.fill();
}
function Pt4(t2, e2, i2, s2, n2) {
  const o2 = i2.__;
  d(t2) ? Wt2.drawStrokesStyle(t2, e2, false, i2, s2, n2) : (s2.setStroke(t2, o2.__strokeWidth * e2, o2), s2.stroke()), o2.__useArrow && Wt2.strokeArrow(t2, i2, s2, n2);
}
function Rt4(t2, e2, i2, s2, n2) {
  const o2 = i2.__;
  d(t2) ? Wt2.drawStrokesStyle(t2, e2, true, i2, s2, n2) : (s2.setStroke(t2, o2.__strokeWidth * e2, o2), Wt2.drawTextStroke(i2, s2, n2));
}
function Mt3(t2, e2, i2, s2, n2) {
  const o2 = s2.getSameCanvas(true, true);
  o2.font = i2.__.__font, Rt4(t2, 2, i2, o2, n2), o2.blendMode = "outside" === e2 ? "destination-out" : "destination-in", Wt2.fillText(i2, o2, n2), o2.blendMode = "normal", uo.copyCanvasByWorld(i2, s2, o2), o2.recycle(i2.__nowWorld);
}
var { getSpread: Ct4, copyAndSpread: At4, toOuterOf: Dt4, getOuterOf: Ot4, getByMove: Wt4, move: It4, getIntersectData: Ft4 } = Ft;
var zt3 = {};
var jt4;
var { stintSet: Ut4 } = _;
var { hasTransparent: Yt4 } = bt2;
function Gt3(t2, e2, i2) {
  if (!d(e2) || false === e2.visible || 0 === e2.opacity) return;
  let n2;
  const { boxBounds: o2 } = i2.__layout, { type: a } = e2;
  switch (a) {
    case "image":
    case "film":
    case "video":
      if (!e2.url) return;
      n2 = Dt2.image(i2, t2, e2, o2, !jt4 || !jt4[e2.url]), "image" !== a && Dt2[a](n2);
      break;
    case "linear":
      n2 = Tt2.linearGradient(e2, o2);
      break;
    case "radial":
      n2 = Tt2.radialGradient(e2, o2);
      break;
    case "angular":
      n2 = Tt2.conicGradient(e2, o2);
      break;
    case "solid":
      const { color: s2, opacity: h } = e2;
      n2 = { type: a, style: bt2.string(s2, h) };
      break;
    default:
      s(e2.r) || (n2 = { type: "solid", style: bt2.string(e2) });
  }
  if (n2 && (n2.originPaint = e2, i(n2.style) && Yt4(n2.style) && (n2.isTransparent = true), e2.style)) {
    if (0 === e2.style.strokeWidth) return;
    n2.strokeStyle = e2.style;
  }
  return n2;
}
var Xt4 = { compute: function(t2, e2) {
  const i2 = e2.__, s2 = [];
  let n2, o2, r2, a = i2.__input[t2];
  l(a) || (a = [a]), jt4 = Dt2.recycleImage(t2, i2);
  for (let i3, n3 = 0, o3 = a.length; n3 < o3; n3++) (i3 = Gt3(t2, a[n3], e2)) && (s2.push(i3), i3.strokeStyle && (r2 || (r2 = 1), i3.strokeStyle.strokeWidth && (r2 = Math.max(r2, i3.strokeStyle.strokeWidth))));
  i2["_" + t2] = s2.length ? s2 : void 0, s2.length ? (s2.every((t3) => t3.isTransparent) && (s2.some((t3) => t3.image) && (n2 = true), o2 = true), "fill" === t2 ? (Ut4(i2, "__isAlphaPixelFill", n2), Ut4(i2, "__isTransparentFill", o2)) : (Ut4(i2, "__isAlphaPixelStroke", n2), Ut4(i2, "__isTransparentStroke", o2), Ut4(i2, "__hasMultiStrokeStyle", r2))) : i2.__removePaint(t2, false);
}, fill: function(t2, e2, i2, s2) {
  i2.fillStyle = t2, Et4(e2, i2, s2);
}, fills: function(t2, e2, i2, s2) {
  let n2, o2, r2;
  for (let a = 0, h = t2.length; a < h; a++) {
    if (n2 = t2[a], o2 = n2.originPaint, n2.image) {
      if (r2 ? r2++ : r2 = 1, Dt2.checkImage(n2, !e2.__.__font, e2, i2, s2)) continue;
      if (!n2.style) {
        1 === r2 && n2.image.isPlacehold && e2.drawImagePlaceholder(n2, i2, s2);
        continue;
      }
    }
    if (i2.fillStyle = n2.style, n2.transform || o2.scaleFixed) {
      if (i2.save(), n2.transform && i2.transform(n2.transform), o2.scaleFixed) {
        const { scaleX: t3, scaleY: s3 } = e2.getRenderScaleData(true, o2.scaleFixed, false);
        1 !== t3 && i2.scale(t3, s3);
      }
      o2.blendMode && (i2.blendMode = o2.blendMode), Et4(e2, i2, s2), i2.restore();
    } else o2.blendMode ? (i2.saveBlendMode(o2.blendMode), Et4(e2, i2, s2), i2.restoreBlendMode()) : Et4(e2, i2, s2);
  }
}, fillPathOrText: Et4, fillText: function(t2, e2, i2) {
  const s2 = t2.__, { rows: n2, decorationY: o2 } = s2.__textDrawData;
  let r2;
  s2.__isPlacehold && s2.placeholderColor && (e2.fillStyle = s2.placeholderColor);
  for (let t3 = 0, i3 = n2.length; t3 < i3; t3++) r2 = n2[t3], r2.text ? e2.fillText(r2.text, r2.x, r2.y) : r2.data && r2.data.forEach((t4) => {
    e2.fillText(t4.char, t4.x, r2.y);
  });
  if (o2) {
    const { decorationColor: t3, decorationHeight: i3 } = s2.__textDrawData;
    t3 && (e2.fillStyle = t3), n2.forEach((t4) => o2.forEach((s3) => e2.fillRect(t4.x, t4.y + s3, t4.width, i3)));
  }
}, stroke: function(t2, e2, i2, s2) {
  const n2 = e2.__;
  if (n2.__strokeWidth) if (n2.__font) Wt2.strokeText(t2, e2, i2, s2);
  else if (n2.__pathForStroke) Wt2.fillStroke(t2, e2, i2, s2);
  else switch (n2.strokeAlign) {
    case "center":
      Pt4(t2, 1, e2, i2, s2);
      break;
    case "inside":
      !(function(t3, e3, i3, s3) {
        i3.save(), i3.clipUI(e3), Pt4(t3, 2, e3, i3, s3), i3.restore();
      })(t2, e2, i2, s2);
      break;
    case "outside":
      !(function(t3, e3, i3, s3) {
        const n3 = e3.__;
        if (n3.__fillAfterStroke) Pt4(t3, 2, e3, i3, s3);
        else {
          const { renderBounds: o2 } = e3.__layout, r2 = i3.getSameCanvas(true, true);
          e3.__drawRenderPath(r2), Pt4(t3, 2, e3, r2, s3), r2.clipUI(n3), r2.clearWorld(o2), uo.copyCanvasByWorld(e3, i3, r2), r2.recycle(e3.__nowWorld);
        }
      })(t2, e2, i2, s2);
  }
}, strokes: function(t2, e2, i2, s2) {
  Wt2.stroke(t2, e2, i2, s2);
}, strokeText: function(t2, e2, i2, s2) {
  switch (e2.__.strokeAlign) {
    case "center":
      Rt4(t2, 1, e2, i2, s2);
      break;
    case "inside":
      Mt3(t2, "inside", e2, i2, s2);
      break;
    case "outside":
      e2.__.__fillAfterStroke ? Rt4(t2, 2, e2, i2, s2) : Mt3(t2, "outside", e2, i2, s2);
  }
}, drawTextStroke: function(t2, e2, i2) {
  let s2, n2 = t2.__.__textDrawData;
  const { rows: o2, decorationY: r2 } = n2;
  for (let t3 = 0, i3 = o2.length; t3 < i3; t3++) s2 = o2[t3], s2.text ? e2.strokeText(s2.text, s2.x, s2.y) : s2.data && s2.data.forEach((t4) => {
    e2.strokeText(t4.char, t4.x, s2.y);
  });
  if (r2) {
    const { decorationHeight: t3 } = n2;
    o2.forEach((i3) => r2.forEach((s3) => e2.strokeRect(i3.x, i3.y + s3, i3.width, t3)));
  }
}, drawStrokesStyle: function(t2, e2, i2, s2, n2, o2) {
  let r2;
  const a = s2.__, { __hasMultiStrokeStyle: h } = a;
  h || n2.setStroke(void 0, a.__strokeWidth * e2, a);
  for (let l2 = 0, c = t2.length; l2 < c; l2++) if (r2 = t2[l2], (!r2.image || !Dt2.checkImage(r2, false, s2, n2, o2)) && r2.style) {
    if (h) {
      const { strokeStyle: t3 } = r2;
      t3 ? n2.setStroke(r2.style, a.__getRealStrokeWidth(t3) * e2, a, t3) : n2.setStroke(r2.style, a.__strokeWidth * e2, a);
    } else n2.strokeStyle = r2.style;
    r2.originPaint.blendMode ? (n2.saveBlendMode(r2.originPaint.blendMode), i2 ? Wt2.drawTextStroke(s2, n2, o2) : n2.stroke(), n2.restoreBlendMode()) : i2 ? Wt2.drawTextStroke(s2, n2, o2) : n2.stroke();
  }
}, shape: function(t2, e2, s2) {
  const n2 = e2.getSameCanvas(), o2 = e2.bounds, r2 = t2.__nowWorld, a = t2.__layout, h = t2.__nowWorldShapeBounds || (t2.__nowWorldShapeBounds = {});
  let l2, c, d2, u2, f2, p2;
  Dt4(a.strokeSpread ? (At4(zt3, a.boxBounds, a.strokeSpread), zt3) : a.boxBounds, r2, h);
  let { scaleX: g2, scaleY: w2 } = t2.getRenderScaleData(true);
  if (o2.includes(h)) p2 = n2, l2 = f2 = h, c = r2;
  else {
    let n3;
    if (Kt.fullImageShadow) n3 = h;
    else {
      const t3 = a.renderShapeSpread ? Ct4(o2, v.swapAndScale(a.renderShapeSpread, g2, w2)) : o2;
      n3 = Ft4(t3, h);
    }
    u2 = o2.getFitMatrix(n3);
    let { a: _2, d: m2 } = u2;
    u2.a < 1 && (p2 = e2.getSameCanvas(), t2.__renderShape(p2, s2), g2 *= _2, w2 *= m2), f2 = Ot4(h, u2), l2 = Wt4(f2, -u2.e, -u2.f), c = Ot4(r2, u2), It4(c, -u2.e, -u2.f);
    const v2 = s2.matrix;
    v2 ? (d2 = new ft(u2), d2.multiply(v2), _2 *= v2.scaleX, m2 *= v2.scaleY) : d2 = u2, d2.withScale(_2, m2), s2 = Object.assign(Object.assign({}, s2), { matrix: d2 });
  }
  return t2.__renderShape(n2, s2), { canvas: n2, matrix: d2, fitMatrix: u2, bounds: l2, renderBounds: c, worldCanvas: p2, shapeBounds: f2, scaleX: g2, scaleY: w2 };
} };
var Vt4;
var Nt4 = new Ht();
var { isSame: Ht4 } = Ft;
function qt3(t2, e2, i2, s2, n2, o2) {
  let r2 = true;
  const a = t2.__;
  if ("fill" !== e2 || a.__naturalWidth || (a.__naturalWidth = s2.width / a.pixelRatio, a.__naturalHeight = s2.height / a.pixelRatio, a.__autoSide && (t2.forceUpdate("width"), uo.updateBounds(t2), t2.__proxyData && (t2.setProxyAttr("width", a.width), t2.setProxyAttr("height", a.height)), r2 = false)), !n2.data) {
    Dt2.createData(n2, s2, i2, o2);
    const { transform: t3 } = n2.data, { opacity: e3, blendMode: r3 } = i2, h = t3 && !t3.onlyScale || a.path || a.cornerRadius;
    (h || e3 && e3 < 1 || r3) && (n2.complex = !h || 2);
  }
  return i2.filter && Dt2.applyFilter(n2, s2, i2.filter, t2), r2;
}
function Kt4(t2, e2) {
  Zt3(t2, Ho.LOAD, e2);
}
function Qt3(t2, e2) {
  Zt3(t2, Ho.LOADED, e2);
}
function $t3(t2, e2, i2) {
  e2.error = i2, t2.forceUpdate("surface"), Zt3(t2, Ho.ERROR, e2);
}
function Zt3(t2, e2, i2) {
  t2.hasEvent(e2) && t2.emitEvent(new Ho(e2, i2));
}
function Jt3(t2, e2) {
  const { leafer: i2 } = t2;
  i2 && i2.viewReady && (i2.renderer.ignore = e2);
}
var { get: te3, translate: ee3 } = Q;
var ie3 = new Ht();
var se3 = {};
var ne3 = {};
function oe3(t2, e2, i2, n2) {
  const o2 = i(t2) || n2 ? (n2 ? i2 - n2 * e2 : i2 % e2) / ((n2 || Math.floor(i2 / e2)) - 1) : t2;
  return "auto" === t2 && o2 < 0 ? 0 : o2;
}
var re3 = {};
var ae3 = z();
var { get: he3, set: le3, rotateOfOuter: ce3, translate: de3, scaleOfOuter: ue3, multiplyParent: fe3, scale: pe3, rotate: ge3, skew: we3 } = Q;
function _e3(t2, e2, i2, s2, n2, o2, r2, a) {
  r2 && ge3(t2, r2), a && we3(t2, a.x, a.y), n2 && pe3(t2, n2, o2), de3(t2, e2.x + i2, e2.y + s2);
}
var { get: me3, scale: ve3, copy: ye3 } = Q;
var { getFloorScale: xe3 } = M;
var { abs: be3 } = Math;
var Se3 = { image: function(t2, e2, i2, s2, n2) {
  let o2, r2;
  const a = sn.get(i2, i2.type);
  return Vt4 && i2 === Vt4.paint && Ht4(s2, Vt4.boxBounds) ? o2 = Vt4.leafPaint : (o2 = { type: i2.type, image: a }, a.hasAlphaPixel && (o2.isTransparent = true), Vt4 = a.use > 1 ? { leafPaint: o2, paint: i2, boxBounds: Nt4.set(s2) } : null), (n2 || a.loading) && (r2 = { image: a, attrName: e2, attrValue: i2 }), a.ready ? (qt3(t2, e2, i2, a, o2, s2), n2 && (Kt4(t2, r2), Qt3(t2, r2))) : a.error ? n2 && $t3(t2, r2, a.error) : (n2 && (Jt3(t2, true), Kt4(t2, r2)), o2.loadId = a.load(() => {
    Jt3(t2, false), t2.destroyed || (qt3(t2, e2, i2, a, o2, s2) && (a.hasAlphaPixel && (t2.__layout.hitCanvasChanged = true), t2.forceUpdate("surface")), Qt3(t2, r2)), o2.loadId = void 0;
  }, (e3) => {
    Jt3(t2, false), $t3(t2, r2, e3), o2.loadId = void 0;
  }, i2.lod && a.getThumbSize(i2.lod)), t2.placeholderColor && (t2.placeholderDelay ? setTimeout(() => {
    a.ready || (a.isPlacehold = true, t2.forceUpdate("surface"));
  }, t2.placeholderDelay) : a.isPlacehold = true)), o2;
}, checkImage: function(t2, e2, s2, n2, o2) {
  const { scaleX: r2, scaleY: a } = Dt2.getImageRenderScaleData(t2, s2, n2, o2), h = t2.film ? t2.nowIndex : r2 + "-" + a, { image: l2, data: c, originPaint: d2 } = t2, { exporting: u2, snapshot: f2 } = o2;
  return !(!c || t2.patternId === h && !u2 || f2) && (e2 && (c.repeat ? e2 = false : d2.changeful || t2.film || "miniapp" === Kt.name || u2 || (e2 = Kt.image.isLarge(l2, r2, a) || l2.width * r2 > 8096 || l2.height * a > 8096)), e2 ? (s2.__.__isFastShadow && (n2.fillStyle = t2.style || "#000", n2.fill()), Dt2.drawImage(t2, r2, a, s2, n2, o2), true) : (!t2.style || d2.sync || u2 ? Dt2.createPattern(t2, s2, n2, o2) : Dt2.createPatternTask(t2, s2, n2, o2), false));
}, drawImage: function(t2, e2, i2, s2, n2, o2) {
  const { data: r2, image: a, complex: h } = t2;
  let { width: l2, height: c } = a;
  if (h) {
    const { blendMode: o3, opacity: d2 } = t2.originPaint, { transform: u2 } = r2;
    n2.save(), 2 === h && n2.clipUI(s2), o3 && (n2.blendMode = o3), d2 && (n2.opacity *= d2), u2 && n2.transform(u2), a.render(n2, 0, 0, l2, c, s2, t2, e2, i2), n2.restore();
  } else r2.scaleX && (l2 *= r2.scaleX, c *= r2.scaleY), a.render(n2, 0, 0, l2, c, s2, t2, e2, i2);
}, getImageRenderScaleData: function(t2, e2, i2, s2) {
  const n2 = e2.getRenderScaleData(true, t2.originPaint.scaleFixed), { data: o2 } = t2;
  if (i2) {
    const { pixelRatio: t3 } = i2;
    n2.scaleX *= t3, n2.scaleY *= t3;
  }
  return o2 && o2.scaleX && (n2.scaleX *= Math.abs(o2.scaleX), n2.scaleY *= Math.abs(o2.scaleY)), n2;
}, recycleImage: function(t2, e2) {
  const i2 = e2["_" + t2];
  if (l(i2)) {
    let s2, n2, o2, r2, a;
    for (let h = 0, l2 = i2.length; h < l2; h++) s2 = i2[h], n2 = s2.image, a = n2 && n2.url, a && (o2 || (o2 = {}), o2[a] = true, sn.recyclePaint(s2), e2.__willDestroy && n2.parent && Dt2.recycleFilter(n2, e2.__leaf), n2.loading && (r2 || (r2 = e2.__input && e2.__input[t2] || [], l(r2) || (r2 = [r2])), n2.unload(i2[h].loadId, !r2.some((t3) => t3.url === a))));
    return o2;
  }
  return null;
}, createPatternTask: function(t2, e2, i2, s2) {
  t2.patternTask || (t2.patternTask = sn.patternTasker.add(() => tt3(this, void 0, void 0, function* () {
    Dt2.createPattern(t2, e2, i2, s2), e2.forceUpdate("surface");
  }), 0, () => (t2.patternTask = null, i2.bounds.hit(e2.__nowWorld))));
}, createPattern: function(t2, e2, s2, n2) {
  let { scaleX: o2, scaleY: r2 } = Dt2.getImageRenderScaleData(t2, e2, s2, n2), a = t2.film ? t2.nowIndex : o2 + "-" + r2;
  if (t2.patternId !== a && !e2.destroyed && (!Kt.image.isLarge(t2.image, o2, r2) || t2.data.repeat)) {
    const { image: s3, data: n3 } = t2, { opacity: h } = t2.originPaint, { transform: l2, gap: c } = n3, d2 = Dt2.getPatternFixScale(t2, o2, r2);
    let u2, f2, p2, { width: g2, height: w2 } = s3;
    d2 && (o2 *= d2, r2 *= d2), g2 *= o2, w2 *= r2, c && (f2 = c.x * o2 / be3(n3.scaleX || 1), p2 = c.y * r2 / be3(n3.scaleY || 1)), (l2 || 1 !== o2 || 1 !== r2) && (o2 *= xe3(g2 + (f2 || 0)), r2 *= xe3(w2 + (p2 || 0)), u2 = me3(), l2 && ye3(u2, l2), ve3(u2, 1 / o2, 1 / r2));
    const _2 = s3.getCanvas(g2, w2, h, void 0, f2, p2, e2.leafer && e2.leafer.config.smooth, n3.interlace), m2 = s3.getPattern(_2, n3.repeat || Kt.origin.noRepeat || "no-repeat", u2, t2);
    t2.style = m2, t2.patternId = a;
  }
}, getPatternFixScale: function(t2, e2, s2) {
  const { image: n2 } = t2;
  let o2, r2 = Kt.image.maxPatternSize, a = n2.width * n2.height;
  return n2.isSVG ? e2 > 1 && (o2 = Math.ceil(e2) / e2) : r2 > a && (r2 = a), (a *= e2 * s2) > r2 && (o2 = Math.sqrt(r2 / a)), o2;
}, createData: function(t2, e2, i2, s2) {
  t2.data = Dt2.getPatternData(i2, s2, e2);
}, getPatternData: function(t2, e2, i2) {
  t2.padding && (e2 = ie3.set(e2).shrink(t2.padding)), "strench" === t2.mode && (t2.mode = "stretch");
  const { width: n2, height: o2 } = i2, { mode: r2, align: a, offset: h, scale: l2, size: c, rotation: d2, skew: u2, clipSize: f2, repeat: p2, gap: g2, interlace: w2 } = t2, _2 = e2.width === n2 && e2.height === o2, m2 = { mode: r2 }, v2 = "center" !== a && (d2 || 0) % 180 == 90;
  let y3, x2;
  switch (Ft.set(ne3, 0, 0, v2 ? o2 : n2, v2 ? n2 : o2), r2 && "cover" !== r2 && "fit" !== r2 ? ((l2 || c) && (M.getScaleData(l2, c, i2, se3), y3 = se3.scaleX, x2 = se3.scaleY), (a || g2 || p2) && (y3 && Ft.scale(ne3, y3, x2, true), a && Ct.toPoint(a, ne3, e2, ne3, true, true))) : _2 && !d2 || (y3 = x2 = Ft.getFitScale(e2, ne3, "fit" !== r2), Ft.put(e2, i2, a, y3, false, ne3), Ft.scale(ne3, y3, x2, true)), h && at.move(ne3, h), r2) {
    case "stretch":
      _2 ? y3 && (y3 = x2 = void 0) : (y3 = e2.width / n2, x2 = e2.height / o2, Dt2.stretchMode(m2, e2, y3, x2));
      break;
    case "normal":
    case "clip":
      if (ne3.x || ne3.y || y3 || f2 || d2 || u2) {
        let t3, i4;
        f2 && (t3 = e2.width / f2.width, i4 = e2.height / f2.height), Dt2.clipMode(m2, e2, ne3.x, ne3.y, y3, x2, d2, u2, t3, i4), t3 && (y3 = y3 ? y3 * t3 : t3, x2 = x2 ? x2 * i4 : i4);
      }
      break;
    case "repeat":
      (!_2 || y3 || d2 || u2) && Dt2.repeatMode(m2, e2, n2, o2, ne3.x, ne3.y, y3, x2, d2, u2, a, t2.freeTransform), p2 || (m2.repeat = "repeat");
      const i3 = d(p2);
      (g2 || i3) && (m2.gap = (function(t3, e3, i4, s2, n3) {
        let o3, r3;
        d(t3) ? (o3 = t3.x, r3 = t3.y) : o3 = r3 = t3;
        return { x: oe3(o3, i4, n3.width, e3 && e3.x), y: oe3(r3, s2, n3.height, e3 && e3.y) };
      })(g2, i3 && p2, ne3.width, ne3.height, e2));
      break;
    default:
      y3 && Dt2.fillOrFitMode(m2, e2, ne3.x, ne3.y, y3, x2, d2);
  }
  return m2.transform || (e2.x || e2.y) && ee3(m2.transform = te3(), e2.x, e2.y), y3 && (m2.scaleX = y3, m2.scaleY = x2), p2 && (m2.repeat = i(p2) ? "x" === p2 ? "repeat-x" : "repeat-y" : "repeat"), w2 && (m2.interlace = o(w2) || "percent" === w2.type ? { type: "x", offset: w2 } : w2), m2;
}, stretchMode: function(t2, e2, i2, s2) {
  const n2 = he3(), { x: o2, y: r2 } = e2;
  o2 || r2 ? de3(n2, o2, r2) : i2 > 0 && s2 > 0 && (n2.onlyScale = true), pe3(n2, i2, s2), t2.transform = n2;
}, fillOrFitMode: function(t2, e2, i2, s2, n2, o2, r2) {
  const a = he3();
  de3(a, e2.x + i2, e2.y + s2), pe3(a, n2, o2), r2 && ce3(a, { x: e2.x + e2.width / 2, y: e2.y + e2.height / 2 }, r2), t2.transform = a;
}, clipMode: function(t2, e2, i2, s2, n2, o2, r2, a, h, l2) {
  const c = he3();
  _e3(c, e2, i2, s2, n2, o2, r2, a), h && (r2 || a ? (le3(ae3), ue3(ae3, e2, h, l2), fe3(c, ae3)) : ue3(c, e2, h, l2)), t2.transform = c;
}, repeatMode: function(t2, e2, i2, s2, n2, o2, r2, a, h, l2, c, d2) {
  const u2 = he3();
  if (d2) _e3(u2, e2, n2, o2, r2, a, h, l2);
  else {
    if (h) if ("center" === c) ce3(u2, { x: i2 / 2, y: s2 / 2 }, h);
    else switch (ge3(u2, h), h) {
      case 90:
        de3(u2, s2, 0);
        break;
      case 180:
        de3(u2, i2, s2);
        break;
      case 270:
        de3(u2, 0, i2);
    }
    re3.x = e2.x + n2, re3.y = e2.y + o2, de3(u2, re3.x, re3.y), r2 && ue3(u2, re3, r2, a);
  }
  t2.transform = u2;
} };
var { toPoint: ke3 } = Bt;
var { hasTransparent: Le3 } = bt2;
var Te3 = {};
var Be3 = {};
function Ee3(t2, e2, i2, n2) {
  if (i2) {
    let o2, r2, a, h;
    for (let t3 = 0, l2 = i2.length; t3 < l2; t3++) o2 = i2[t3], i(o2) ? (a = t3 / (l2 - 1), r2 = bt2.string(o2, n2)) : (a = o2.offset, r2 = bt2.string(o2.color, n2)), e2.addColorStop(a, r2), !h && Le3(r2) && (h = true);
    h && (t2.isTransparent = true);
  }
}
var { getAngle: Pe3, getDistance: Re3 } = at;
var { get: Me3, rotateOfOuter: Ce3, scaleOfOuter: Ae3 } = Q;
var { toPoint: De3 } = Bt;
var Oe3 = {};
var We3 = {};
function Ie3(t2, e2, i2, s2, n2) {
  let o2;
  const { width: r2, height: a } = t2;
  if (r2 !== a || s2) {
    const t3 = Pe3(e2, i2);
    o2 = Me3(), n2 ? (Ae3(o2, e2, r2 / a * (s2 || 1), 1), Ce3(o2, e2, t3 + 90)) : (Ae3(o2, e2, 1, r2 / a * (s2 || 1)), Ce3(o2, e2, t3));
  }
  return o2;
}
var { getDistance: Fe3 } = at;
var { toPoint: ze3 } = Bt;
var je3 = {};
var Ue3 = {};
var Ye3 = { linearGradient: function(t2, e2) {
  let { from: s2, to: n2, type: o2, opacity: r2 } = t2;
  ke3(s2 || "top", e2, Te3), ke3(n2 || "bottom", e2, Be3);
  const a = Kt.canvas.createLinearGradient(Te3.x, Te3.y, Be3.x, Be3.y), h = { type: o2, style: a };
  return Ee3(h, a, t2.stops, r2), h;
}, radialGradient: function(t2, e2) {
  let { from: s2, to: n2, type: o2, opacity: r2, stretch: a } = t2;
  De3(s2 || "center", e2, Oe3), De3(n2 || "bottom", e2, We3);
  const h = Kt.canvas.createRadialGradient(Oe3.x, Oe3.y, 0, Oe3.x, Oe3.y, Re3(Oe3, We3)), l2 = { type: o2, style: h };
  Ee3(l2, h, t2.stops, r2);
  const c = Ie3(e2, Oe3, We3, a, true);
  return c && (l2.transform = c), l2;
}, conicGradient: function(t2, e2) {
  let { from: s2, to: n2, type: o2, opacity: r2, rotation: a, stretch: h } = t2;
  ze3(s2 || "center", e2, je3), ze3(n2 || "bottom", e2, Ue3);
  const l2 = Kt.conicGradientSupport ? Kt.canvas.createConicGradient(a ? a * W : 0, je3.x, je3.y) : Kt.canvas.createRadialGradient(je3.x, je3.y, 0, je3.x, je3.y, Fe3(je3, Ue3)), c = { type: o2, style: l2 };
  Ee3(c, l2, t2.stops, r2);
  const d2 = Ie3(e2, je3, Ue3, h || 1, Kt.conicGradientRotate90);
  return d2 && (c.transform = d2), c;
}, getTransform: Ie3 };
var { copy: Ge3, move: Xe3, toOffsetOutBounds: Ve3 } = Ft;
var { max: Ne3, abs: He3 } = Math;
var qe3 = {};
var Ke3 = new ft();
var Qe3 = {};
function $e3(t2, e2) {
  let i2, s2, n2, o2, r2 = 0, a = 0, h = 0, l2 = 0;
  return e2.forEach((t3) => {
    i2 = t3.x || 0, s2 = t3.y || 0, o2 = 1.5 * (t3.blur || 0), n2 = He3(t3.spread || 0), r2 = Ne3(r2, n2 + o2 - s2), a = Ne3(a, n2 + o2 + i2), h = Ne3(h, n2 + o2 + s2), l2 = Ne3(l2, n2 + o2 - i2);
  }), r2 === a && a === h && h === l2 ? r2 : [r2, a, h, l2];
}
function Ze3(t2, e2, s2) {
  const { shapeBounds: n2 } = s2;
  let o2, r2;
  Kt.fullImageShadow ? (Ge3(qe3, t2.bounds), Xe3(qe3, e2.x - n2.x, e2.y - n2.y), o2 = t2.bounds, r2 = qe3) : (o2 = n2, r2 = e2), t2.copyWorld(s2.canvas, o2, r2);
}
var { toOffsetOutBounds: Je3 } = Ft;
var ti3 = {};
var ei3 = $e3;
var ii3 = { shadow: function(t2, e2, i2) {
  let s2, n2;
  const { __nowWorld: o2 } = t2, { shadow: r2 } = t2.__, { worldCanvas: a, bounds: h, renderBounds: l2, shapeBounds: c, scaleX: d2, scaleY: u2 } = i2, f2 = e2.getSameCanvas(), p2 = r2.length - 1;
  Ve3(h, Qe3, l2), r2.forEach((r3, g2) => {
    let w2 = 1;
    if (r3.scaleFixed) {
      const t3 = Math.abs(o2.scaleX);
      t3 > 1 && (w2 = 1 / t3);
    }
    f2.setWorldShadow(Qe3.offsetX + (r3.x || 0) * d2 * w2, Qe3.offsetY + (r3.y || 0) * u2 * w2, (r3.blur || 0) * d2 * w2, bt2.string(r3.color)), n2 = Et2.getShadowTransform(t2, f2, i2, r3, Qe3, w2), n2 && f2.setTransform(n2), Ze3(f2, Qe3, i2), n2 && f2.resetTransform(), s2 = l2, r3.box && (f2.restore(), f2.save(), a && (f2.copyWorld(f2, l2, o2, "copy"), s2 = o2), a ? f2.copyWorld(a, o2, o2, "destination-out") : f2.copyWorld(i2.canvas, c, h, "destination-out")), uo.copyCanvasByWorld(t2, e2, f2, s2, r3.blendMode), p2 && g2 < p2 && f2.clearWorld(s2);
  }), f2.recycle(s2);
}, innerShadow: function(t2, e2, i2) {
  let s2, n2;
  const { __nowWorld: o2 } = t2, { innerShadow: r2 } = t2.__, { worldCanvas: a, bounds: h, renderBounds: l2, shapeBounds: c, scaleX: d2, scaleY: u2 } = i2, f2 = e2.getSameCanvas(), p2 = r2.length - 1;
  Je3(h, ti3, l2), r2.forEach((r3, g2) => {
    let w2 = 1;
    if (r3.scaleFixed) {
      const t3 = Math.abs(o2.scaleX);
      t3 > 1 && (w2 = 1 / t3);
    }
    f2.save(), f2.setWorldShadow(ti3.offsetX + (r3.x || 0) * d2 * w2, ti3.offsetY + (r3.y || 0) * u2 * w2, (r3.blur || 0) * d2 * w2), n2 = Et2.getShadowTransform(t2, f2, i2, r3, ti3, w2, true), n2 && f2.setTransform(n2), Ze3(f2, ti3, i2), f2.restore(), a ? (f2.copyWorld(f2, l2, o2, "copy"), f2.copyWorld(a, o2, o2, "source-out"), s2 = o2) : (f2.copyWorld(i2.canvas, c, h, "source-out"), s2 = l2), f2.fillWorld(s2, bt2.string(r3.color), "source-in"), uo.copyCanvasByWorld(t2, e2, f2, s2, r3.blendMode), p2 && g2 < p2 && f2.clearWorld(s2);
  }), f2.recycle(s2);
}, blur: function(t2, e2, i2) {
  const { blur: s2 } = t2.__;
  i2.setWorldBlur(s2 * t2.__nowWorld.a), i2.copyWorldToInner(e2, t2.__nowWorld, t2.__layout.renderBounds), i2.filter = "none";
}, backgroundBlur: function(t2, e2, i2) {
}, getShadowRenderSpread: $e3, getShadowTransform: function(t2, e2, i2, s2, n2, o2, r2) {
  if (s2.spread) {
    const i3 = 2 * s2.spread * o2 * (r2 ? -1 : 1), { width: a, height: h } = t2.__layout.strokeBounds;
    return Ke3.set().scaleOfOuter({ x: (n2.x + n2.width / 2) * e2.pixelRatio, y: (n2.y + n2.height / 2) * e2.pixelRatio }, 1 + i3 / a, 1 + i3 / h), Ke3;
  }
}, isTransformShadow(t2) {
}, getInnerShadowSpread: ei3 };
var { excludeRenderBounds: si2 } = wo;
var ni3;
function oi3(t2, e2, i2, s2, n2, o2, r2, a) {
  switch (e2) {
    case "grayscale":
      ni3 || (ni3 = true, n2.useGrayscaleAlpha(t2.__nowWorld));
    case "alpha":
      !(function(t3, e3, i3, s3, n3, o3) {
        const r3 = t3.__nowWorld;
        i3.resetTransform(), i3.opacity = 1, i3.useMask(s3, r3), o3 && s3.recycle(r3);
        ai3(t3, e3, i3, 1, n3, o3);
      })(t2, i2, s2, n2, r2, a);
      break;
    case "opacity-path":
      ai3(t2, i2, s2, o2, r2, a);
      break;
    case "path":
      a && i2.restore();
  }
}
function ri3(t2) {
  return t2.getSameCanvas(false, true);
}
function ai3(t2, e2, i2, s2, n2, o2) {
  const r2 = t2.__nowWorld;
  e2.resetTransform(), e2.opacity = s2, e2.copyWorld(i2, r2, void 0, n2), o2 ? i2.recycle(r2) : i2.clearWorld(r2);
}
ve2.prototype.__renderMask = function(t2, e2) {
  let i2, s2, n2, o2, r2, a;
  const { children: h } = this;
  for (let l2 = 0, c = h.length; l2 < c; l2++) {
    if (i2 = h[l2], a = i2.__.mask, a) {
      r2 && (oi3(this, r2, t2, n2, s2, o2, void 0, true), s2 = n2 = null), "clipping" !== a && "clipping-path" !== a || si2(i2, e2) || i2.__render(t2, e2), o2 = i2.__.opacity, ni3 = false, "path" === a || "clipping-path" === a ? (o2 < 1 ? (r2 = "opacity-path", n2 || (n2 = ri3(t2))) : (r2 = "path", t2.save()), i2.__clip(n2 || t2, e2)) : (r2 = "grayscale" === a ? "grayscale" : "alpha", s2 || (s2 = ri3(t2)), n2 || (n2 = ri3(t2)), i2.__render(s2, e2));
      continue;
    }
    const c2 = 1 === o2 && i2.__.__blendMode;
    c2 && oi3(this, r2, t2, n2, s2, o2, void 0, false), si2(i2, e2) || i2.__render(n2 || t2, e2), c2 && oi3(this, r2, t2, n2, s2, o2, c2, false);
  }
  oi3(this, r2, t2, n2, s2, o2, void 0, true);
};
var hi3 = `>)]}%!?,.:;'"\u300B\uFF09\u300D\u3009\u300F\u3017\u3011\u3015\uFF5D\u2510\uFF1E\u2019\u201D\uFF01\uFF1F\uFF0C\u3001\u3002\uFF1A\uFF1B\u2030`;
var li3 = hi3 + "_#~&*+\\=|\u226E\u226F\u2248\u2260\uFF1D\u2026";
var ci2 = new RegExp([[19968, 40959], [13312, 19903], [131072, 173791], [173824, 177983], [177984, 178207], [178208, 183983], [183984, 191471], [196608, 201551], [201552, 205743], [11904, 12031], [12032, 12255], [12272, 12287], [12288, 12351], [12736, 12783], [12800, 13055], [13056, 13311], [63744, 64255], [65072, 65103], [127488, 127743], [194560, 195103]].map(([t2, e2]) => `[\\u${t2.toString(16)}-\\u${e2.toString(16)}]`).join("|"));
function di3(t2) {
  const e2 = {};
  return t2.split("").forEach((t3) => e2[t3] = true), e2;
}
var ui2 = di3("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz");
var fi2 = di3(`{[(<'"\u300A\uFF08\u300C\u3008\u300E\u3016\u3010\u3014\uFF5B\u250C\uFF1C\u2018\u201C\uFF1D\xA5\uFFE5\uFF04\u20AC\xA3\uFFE1\xA2\uFFE0`);
var pi3 = di3(hi3);
var gi2 = di3(li3);
var wi2 = di3("- \u2014\uFF0F\uFF5E\uFF5C\u2506\xB7");
var _i3;
!(function(t2) {
  t2[t2.Letter = 0] = "Letter", t2[t2.Single = 1] = "Single", t2[t2.Before = 2] = "Before", t2[t2.After = 3] = "After", t2[t2.Symbol = 4] = "Symbol", t2[t2.Break = 5] = "Break";
})(_i3 || (_i3 = {}));
var { Letter: mi2, Single: vi2, Before: yi2, After: xi2, Symbol: bi2, Break: Si2 } = _i3;
function ki2(t2) {
  return ui2[t2] ? mi2 : wi2[t2] ? Si2 : fi2[t2] ? yi2 : pi3[t2] ? xi2 : gi2[t2] ? bi2 : ci2.test(t2) ? vi2 : mi2;
}
var Li2 = { trimRight(t2) {
  const { words: e2 } = t2;
  let i2, s2 = 0, n2 = e2.length;
  for (let o2 = n2 - 1; o2 > -1 && (i2 = e2[o2].data[0], " " === i2.char); o2--) s2++, t2.width -= i2.width;
  s2 && e2.splice(n2 - s2, s2);
} };
function Ti2(t2, e2, i2) {
  switch (e2) {
    case "title":
      return i2 ? t2.toUpperCase() : t2;
    case "upper":
      return t2.toUpperCase();
    case "lower":
      return t2.toLowerCase();
    default:
      return t2;
  }
}
var { trimRight: Bi2 } = Li2;
var { Letter: Ei2, Single: Pi2, Before: Ri2, After: Mi2, Symbol: Ci2, Break: Ai2 } = _i3;
var Di2;
var Oi2;
var Wi2;
var Ii2;
var Fi2;
var zi2;
var ji2;
var Ui2;
var Yi2;
var Gi2;
var Xi2;
var Vi2;
var Ni2;
var Hi2;
var qi2;
var Ki2;
var Qi2;
var $i2 = [];
function Zi2(t2, e2) {
  Yi2 && !Ui2 && (Ui2 = Yi2), Di2.data.push({ char: t2, width: e2 }), Wi2 += e2;
}
function Ji2() {
  Ii2 += Wi2, Di2.width = Wi2, Oi2.words.push(Di2), Di2 = { data: [] }, Wi2 = 0;
}
function ts2() {
  Hi2 && (qi2.paraNumber++, Oi2.paraStart = true, Hi2 = false), Yi2 && (Oi2.startCharSize = Ui2, Oi2.endCharSize = Yi2, Ui2 = 0), Oi2.width = Ii2, Ki2.width ? Bi2(Oi2) : Qi2 && es2(), $i2.push(Oi2), Oi2 = { words: [] }, Ii2 = 0;
}
function es2() {
  Ii2 > (qi2.maxWidth || 0) && (qi2.maxWidth = Ii2);
}
var { top: is2, right: ss2, bottom: ns2, left: os2 } = xt;
function rs2(t2, e2, i2) {
  const { bounds: s2, rows: n2 } = t2;
  s2[e2] += i2;
  for (let t3 = 0; t3 < n2.length; t3++) n2[t3][e2] += i2;
}
var as2 = { getDrawData: function(t2, e2) {
  i(t2) || (t2 = String(t2));
  let n2 = 0, o2 = 0, r2 = e2.__getInput("width") || 0, a = e2.__getInput("height") || 0;
  const { __padding: h } = e2;
  h && (r2 ? (n2 = h[os2], r2 -= h[ss2] + h[os2], !r2 && (r2 = 0.01)) : e2.autoSizeAlign || (n2 = h[os2]), a ? (o2 = h[is2], a -= h[is2] + h[ns2], !a && (a = 0.01)) : e2.autoSizeAlign || (o2 = h[is2]));
  const l2 = { bounds: { x: n2, y: o2, width: r2, height: a }, rows: [], paraNumber: 0, font: Kt.canvas.font = e2.__font };
  return (function(t3, e3, s2) {
    qi2 = t3, $i2 = t3.rows, Ki2 = t3.bounds, Qi2 = !Ki2.width && !s2.autoSizeAlign;
    const { __letterSpacing: n3, paraIndent: o3, textCase: r3 } = s2, { canvas: a2 } = Kt, { width: h2 } = Ki2;
    if (s2.__isCharMode) {
      const t4 = "none" !== s2.textWrap, i2 = "break" === s2.textWrap;
      Hi2 = true, Xi2 = null, Ui2 = ji2 = Yi2 = Wi2 = Ii2 = 0, Di2 = { data: [] }, Oi2 = { words: [] };
      for (let s3 = 0, l3 = (e3 = [...e3]).length; s3 < l3; s3++) zi2 = e3[s3], "\n" === zi2 ? (Wi2 && Ji2(), Oi2.paraEnd = true, ts2(), Hi2 = true) : (Gi2 = ki2(zi2), Gi2 === Ei2 && "none" !== r3 && (zi2 = Ti2(zi2, r3, !Wi2)), ji2 = a2.measureText(zi2).width, n3 && (n3 < 0 && (Yi2 = ji2), ji2 += n3), Vi2 = Gi2 === Pi2 && (Xi2 === Pi2 || Xi2 === Ei2) || Xi2 === Pi2 && Gi2 !== Mi2, Ni2 = !(Gi2 !== Ri2 && Gi2 !== Pi2 || Xi2 !== Ci2 && Xi2 !== Mi2), Fi2 = Hi2 && o3 ? h2 - o3 : h2, t4 && h2 && Ii2 + Wi2 + ji2 > Fi2 && (i2 ? (Wi2 && Ji2(), Ii2 && ts2()) : (Ni2 || (Ni2 = Gi2 === Ei2 && Xi2 == Mi2), Vi2 || Ni2 || Gi2 === Ai2 || Gi2 === Ri2 || Gi2 === Pi2 || Wi2 + ji2 > Fi2 ? (Wi2 && Ji2(), Ii2 && ts2()) : Ii2 && ts2())), " " === zi2 && true !== Hi2 && Ii2 + Wi2 === 0 || (Gi2 === Ai2 ? (" " === zi2 && Wi2 && Ji2(), Zi2(zi2, ji2), Ji2()) : Vi2 || Ni2 ? (Wi2 && Ji2(), Zi2(zi2, ji2)) : Zi2(zi2, ji2)), Xi2 = Gi2);
      Wi2 && Ji2(), Ii2 && ts2(), $i2.length > 0 && ($i2[$i2.length - 1].paraEnd = true);
    } else e3.split("\n").forEach((t4) => {
      qi2.paraNumber++, Ii2 = a2.measureText(t4).width, $i2.push({ x: o3 || 0, text: t4, width: Ii2, paraStart: true }), Qi2 && es2();
    });
  })(l2, t2, e2), h && (function(t3, e3, i2, s2, n3) {
    if (!s2 && i2.autoSizeAlign) switch (i2.textAlign) {
      case "left":
        rs2(e3, "x", t3[os2]);
        break;
      case "right":
        rs2(e3, "x", -t3[ss2]);
    }
    if (!n3 && i2.autoSizeAlign) switch (i2.verticalAlign) {
      case "top":
        rs2(e3, "y", t3[is2]);
        break;
      case "bottom":
        rs2(e3, "y", -t3[ns2]);
    }
  })(h, l2, e2, r2, a), (function(t3, e3) {
    const { rows: i2, bounds: s2 } = t3, n3 = i2.length, { __lineHeight: o3, __baseLine: r3, __letterSpacing: a2, __clipText: h2, textAlign: l3, verticalAlign: c, paraSpacing: d2, autoSizeAlign: u2 } = e3;
    let { x: f2, y: p2, width: g2, height: w2 } = s2, _2 = o3 * n3 + (d2 ? d2 * (t3.paraNumber - 1) : 0), m2 = r3;
    if (h2 && _2 > w2) _2 = Math.max(e3.__autoHeight ? _2 : w2, o3), n3 > 1 && (t3.overflow = n3);
    else if (w2 || u2) switch (c) {
      case "middle":
        p2 += (w2 - _2) / 2;
        break;
      case "bottom":
        p2 += w2 - _2;
    }
    m2 += p2;
    let v2, y3, x2, b2 = g2 || u2 ? g2 : t3.maxWidth;
    for (let r4 = 0, c2 = n3; r4 < c2; r4++) {
      if (v2 = i2[r4], v2.x = f2, v2.width < g2 || v2.width > g2 && !h2) switch (l3) {
        case "center":
          v2.x += (b2 - v2.width) / 2;
          break;
        case "right":
          v2.x += b2 - v2.width;
      }
      v2.paraStart && d2 && r4 > 0 && (m2 += d2), v2.y = m2, m2 += o3, t3.overflow > r4 && m2 > _2 && (v2.isOverflow = true, t3.overflow = r4 + 1), y3 = v2.x, x2 = v2.width, a2 < 0 && (v2.width < 0 ? (x2 = -v2.width + e3.fontSize + a2, y3 -= x2, x2 += e3.fontSize) : x2 -= a2), y3 < s2.x && (s2.x = y3), x2 > s2.width && (s2.width = x2), h2 && g2 && g2 < x2 && (v2.isOverflow = true, t3.overflow || (t3.overflow = i2.length));
    }
    s2.y = p2, s2.height = _2;
  })(l2, e2), e2.__isCharMode && (function(t3, e3, i2) {
    const { rows: s2 } = t3, { textAlign: n3, paraIndent: o3, __letterSpacing: r3 } = e3, a2 = i2 && n3.includes("both"), h2 = a2 || i2 && n3.includes("justify"), l3 = h2 && n3.includes("letter");
    let c, d2, u2, f2, p2, g2, w2, _2, m2, v2;
    s2.forEach((t4) => {
      t4.words && (p2 = o3 && t4.paraStart ? o3 : 0, _2 = t4.words.length, h2 && (v2 = !t4.paraEnd || a2, d2 = i2 - t4.width - p2, l3 ? f2 = d2 / (t4.words.reduce((t5, e4) => t5 + e4.data.length, 0) - 1) : u2 = _2 > 1 ? d2 / (_2 - 1) : 0), g2 = r3 || t4.isOverflow || l3 ? 0 : u2 ? 1 : 2, t4.isOverflow && !r3 && (t4.textMode = true), 2 === g2 ? (t4.x += p2, (function(t5) {
        t5.text = "", t5.words.forEach((e4) => {
          e4.data.forEach((e5) => {
            t5.text += e5.char;
          });
        });
      })(t4)) : (t4.x += p2, c = t4.x, t4.data = [], t4.words.forEach((e4, i3) => {
        1 === g2 ? (w2 = { char: "", x: c }, c = (function(t5, e5, i4) {
          return t5.forEach((t6) => {
            i4.char += t6.char, e5 += t6.width;
          }), e5;
        })(e4.data, c, w2), (t4.isOverflow || " " !== w2.char) && t4.data.push(w2)) : c = (function(t5, e5, i4, s3, n4) {
          return t5.forEach((t6) => {
            (s3 || " " !== t6.char) && (t6.x = e5, i4.push(t6)), e5 += t6.width, n4 && (e5 += n4);
          }), e5;
        })(e4.data, c, t4.data, t4.isOverflow, v2 && f2), v2 && (m2 = i3 === _2 - 1, u2 ? m2 || (c += u2, t4.width += u2) : f2 && (t4.width += f2 * (e4.data.length - (m2 ? 1 : 0))));
      })), t4.words = null);
    });
  })(l2, e2, r2), l2.overflow && (function(t3, e3, s2, n3) {
    const { rows: o3, overflow: r3 } = t3;
    let { textOverflow: a2 } = e3;
    if (r3 && o3.splice(r3), n3 && a2 && "show" !== a2) {
      let t4, h2;
      "hide" === a2 ? a2 = "" : "ellipsis" === a2 && (a2 = "...");
      const l3 = a2 ? Kt.canvas.measureText(a2).width : 0, c = s2 + n3 - l3;
      ("none" === e3.textWrap ? o3 : [o3[r3 - 1]]).forEach((e4) => {
        if (e4.isOverflow && e4.data) {
          let i2 = e4.data.length - 1;
          for (let s3 = i2; s3 > -1 && (t4 = e4.data[s3], h2 = t4.x + t4.width, !(s3 === i2 && h2 < c)); s3--) {
            if (h2 < c && " " !== t4.char || !s3) {
              e4.data.splice(s3 + 1), e4.width -= t4.width;
              break;
            }
            e4.width -= t4.width;
          }
          e4.width += l3, e4.data.push({ char: a2, x: h2 }), e4.textMode && (function(t5) {
            t5.text = "", t5.data.forEach((e5) => {
              t5.text += e5.char;
            }), t5.data = null;
          })(e4);
        }
      });
    }
  })(l2, e2, n2, r2), "none" !== e2.textDecoration && (function(t3, e3) {
    let i2, s2 = 0;
    const { fontSize: n3, textDecoration: o3 } = e3;
    switch (t3.decorationHeight = n3 / 11, d(o3) ? (i2 = o3.type, o3.color && (t3.decorationColor = bt2.string(o3.color)), o3.offset && (s2 = Math.min(0.3 * n3, Math.max(o3.offset, 0.15 * -n3)))) : i2 = o3, i2) {
      case "under":
        t3.decorationY = [0.15 * n3 + s2];
        break;
      case "delete":
        t3.decorationY = [0.35 * -n3];
        break;
      case "under-delete":
        t3.decorationY = [0.15 * n3 + s2, 0.35 * -n3];
    }
  })(l2, e2), l2;
} };
var hs2 = { string: function(t2, e2) {
  if (!t2) return "#000";
  const i2 = o(e2) && e2 < 1;
  if (i(t2)) {
    if (!i2 || !bt2.object) return t2;
    t2 = bt2.object(t2);
  }
  let n2 = s(t2.a) ? 1 : t2.a;
  i2 && (n2 *= e2);
  const o2 = t2.r + "," + t2.g + "," + t2.b;
  return 1 === n2 ? "rgb(" + o2 + ")" : "rgba(" + o2 + "," + n2 + ")";
} };
Object.assign(Ct2, as2), Object.assign(bt2, hs2), Object.assign(Wt2, Xt4), Object.assign(Dt2, Se3), Object.assign(Tt2, Ye3), Object.assign(Et2, ii3), Object.assign(de, { interaction: (t2, e2, i2, s2) => new Bt3(t2, e2, i2, s2), hitCanvas: (t2, e2) => new it3(t2, e2), hitCanvasManager: () => new At3() }), st2();

// node_modules/gsap/gsap-core.js
function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self;
}
function _inheritsLoose(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  subClass.__proto__ = superClass;
}
var _config = {
  autoSleep: 120,
  force3D: "auto",
  nullTargetWarn: 1,
  units: {
    lineHeight: ""
  }
};
var _defaults = {
  duration: 0.5,
  overwrite: false,
  delay: 0
};
var _suppressOverwrites;
var _reverting;
var _context;
var _bigNum = 1e8;
var _tinyNum = 1 / _bigNum;
var _2PI = Math.PI * 2;
var _HALF_PI = _2PI / 4;
var _gsID = 0;
var _sqrt = Math.sqrt;
var _cos = Math.cos;
var _sin = Math.sin;
var _isString = function _isString2(value) {
  return typeof value === "string";
};
var _isFunction = function _isFunction2(value) {
  return typeof value === "function";
};
var _isNumber = function _isNumber2(value) {
  return typeof value === "number";
};
var _isUndefined = function _isUndefined2(value) {
  return typeof value === "undefined";
};
var _isObject = function _isObject2(value) {
  return typeof value === "object";
};
var _isNotFalse = function _isNotFalse2(value) {
  return value !== false;
};
var _windowExists = function _windowExists2() {
  return typeof window !== "undefined";
};
var _isFuncOrString = function _isFuncOrString2(value) {
  return _isFunction(value) || _isString(value);
};
var _isTypedArray = typeof ArrayBuffer === "function" && ArrayBuffer.isView || function() {
};
var _isArray = Array.isArray;
var _randomExp = /random\([^)]+\)/g;
var _commaDelimExp = /,\s*/g;
var _strictNumExp = /(?:-?\.?\d|\.)+/gi;
var _numExp = /[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/g;
var _numWithUnitExp = /[-+=.]*\d+[.e-]*\d*[a-z%]*/g;
var _complexStringNumExp = /[-+=.]*\d+\.?\d*(?:e-|e\+)?\d*/gi;
var _relExp = /[+-]=-?[.\d]+/;
var _delimitedValueExp = /[^,'"\[\]\s]+/gi;
var _unitExp = /^[+\-=e\s\d]*\d+[.\d]*([a-z]*|%)\s*$/i;
var _globalTimeline;
var _win;
var _coreInitted;
var _doc;
var _globals = {};
var _installScope = {};
var _coreReady;
var _install = function _install2(scope) {
  return (_installScope = _merge(scope, _globals)) && gsap;
};
var _missingPlugin = function _missingPlugin2(property, value) {
  return console.warn("Invalid property", property, "set to", value, "Missing plugin? gsap.registerPlugin()");
};
var _warn = function _warn2(message, suppress) {
  return !suppress && console.warn(message);
};
var _addGlobal = function _addGlobal2(name, obj) {
  return name && (_globals[name] = obj) && _installScope && (_installScope[name] = obj) || _globals;
};
var _emptyFunc = function _emptyFunc2() {
  return 0;
};
var _startAtRevertConfig = {
  suppressEvents: true,
  isStart: true,
  kill: false
};
var _revertConfigNoKill = {
  suppressEvents: true,
  kill: false
};
var _revertConfig = {
  suppressEvents: true
};
var _reservedProps = {};
var _lazyTweens = [];
var _lazyLookup = {};
var _lastRenderedFrame;
var _plugins = {};
var _effects = {};
var _nextGCFrame = 30;
var _harnessPlugins = [];
var _callbackNames = "";
var _harness = function _harness2(targets) {
  var target = targets[0], harnessPlugin, i2;
  _isObject(target) || _isFunction(target) || (targets = [targets]);
  if (!(harnessPlugin = (target._gsap || {}).harness)) {
    i2 = _harnessPlugins.length;
    while (i2-- && !_harnessPlugins[i2].targetTest(target)) {
    }
    harnessPlugin = _harnessPlugins[i2];
  }
  i2 = targets.length;
  while (i2--) {
    targets[i2] && (targets[i2]._gsap || (targets[i2]._gsap = new GSCache(targets[i2], harnessPlugin))) || targets.splice(i2, 1);
  }
  return targets;
};
var _getCache = function _getCache2(target) {
  return target._gsap || _harness(toArray(target))[0]._gsap;
};
var _getProperty = function _getProperty2(target, property, v2) {
  return (v2 = target[property]) && _isFunction(v2) ? target[property]() : _isUndefined(v2) && target.getAttribute && target.getAttribute(property) || v2;
};
var _forEachName = function _forEachName2(names, func) {
  return (names = names.split(",")).forEach(func) || names;
};
var _round = function _round2(value) {
  return Math.round(value * 1e5) / 1e5 || 0;
};
var _roundPrecise = function _roundPrecise2(value) {
  return Math.round(value * 1e7) / 1e7 || 0;
};
var _parseRelative = function _parseRelative2(start, value) {
  var operator = value.charAt(0), end = parseFloat(value.substr(2));
  start = parseFloat(start);
  return operator === "+" ? start + end : operator === "-" ? start - end : operator === "*" ? start * end : start / end;
};
var _arrayContainsAny = function _arrayContainsAny2(toSearch, toFind) {
  var l2 = toFind.length, i2 = 0;
  for (; toSearch.indexOf(toFind[i2]) < 0 && ++i2 < l2; ) {
  }
  return i2 < l2;
};
var _lazyRender = function _lazyRender2() {
  var l2 = _lazyTweens.length, a = _lazyTweens.slice(0), i2, tween;
  _lazyLookup = {};
  _lazyTweens.length = 0;
  for (i2 = 0; i2 < l2; i2++) {
    tween = a[i2];
    tween && tween._lazy && (tween.render(tween._lazy[0], tween._lazy[1], true)._lazy = 0);
  }
};
var _isRevertWorthy = function _isRevertWorthy2(animation) {
  return !!(animation._initted || animation._startAt || animation.add);
};
var _lazySafeRender = function _lazySafeRender2(animation, time, suppressEvents, force) {
  _lazyTweens.length && !_reverting && _lazyRender();
  animation.render(time, suppressEvents, force || !!(_reverting && time < 0 && _isRevertWorthy(animation)));
  _lazyTweens.length && !_reverting && _lazyRender();
};
var _numericIfPossible = function _numericIfPossible2(value) {
  var n2 = parseFloat(value);
  return (n2 || n2 === 0) && (value + "").match(_delimitedValueExp).length < 2 ? n2 : _isString(value) ? value.trim() : value;
};
var _passThrough = function _passThrough2(p2) {
  return p2;
};
var _setDefaults = function _setDefaults2(obj, defaults2) {
  for (var p2 in defaults2) {
    p2 in obj || (obj[p2] = defaults2[p2]);
  }
  return obj;
};
var _setKeyframeDefaults = function _setKeyframeDefaults2(excludeDuration) {
  return function(obj, defaults2) {
    for (var p2 in defaults2) {
      p2 in obj || p2 === "duration" && excludeDuration || p2 === "ease" || (obj[p2] = defaults2[p2]);
    }
  };
};
var _merge = function _merge2(base, toMerge) {
  for (var p2 in toMerge) {
    base[p2] = toMerge[p2];
  }
  return base;
};
var _mergeDeep = function _mergeDeep2(base, toMerge) {
  for (var p2 in toMerge) {
    p2 !== "__proto__" && p2 !== "constructor" && p2 !== "prototype" && (base[p2] = _isObject(toMerge[p2]) ? _mergeDeep2(base[p2] || (base[p2] = {}), toMerge[p2]) : toMerge[p2]);
  }
  return base;
};
var _copyExcluding = function _copyExcluding2(obj, excluding) {
  var copy = {}, p2;
  for (p2 in obj) {
    p2 in excluding || (copy[p2] = obj[p2]);
  }
  return copy;
};
var _inheritDefaults = function _inheritDefaults2(vars) {
  var parent = vars.parent || _globalTimeline, func = vars.keyframes ? _setKeyframeDefaults(_isArray(vars.keyframes)) : _setDefaults;
  if (_isNotFalse(vars.inherit)) {
    while (parent) {
      func(vars, parent.vars.defaults);
      parent = parent.parent || parent._dp;
    }
  }
  return vars;
};
var _arraysMatch = function _arraysMatch2(a1, a2) {
  var i2 = a1.length, match = i2 === a2.length;
  while (match && i2-- && a1[i2] === a2[i2]) {
  }
  return i2 < 0;
};
var _addLinkedListItem = function _addLinkedListItem2(parent, child, firstProp, lastProp, sortBy) {
  if (firstProp === void 0) {
    firstProp = "_first";
  }
  if (lastProp === void 0) {
    lastProp = "_last";
  }
  var prev = parent[lastProp], t2;
  if (sortBy) {
    t2 = child[sortBy];
    while (prev && prev[sortBy] > t2) {
      prev = prev._prev;
    }
  }
  if (prev) {
    child._next = prev._next;
    prev._next = child;
  } else {
    child._next = parent[firstProp];
    parent[firstProp] = child;
  }
  if (child._next) {
    child._next._prev = child;
  } else {
    parent[lastProp] = child;
  }
  child._prev = prev;
  child.parent = child._dp = parent;
  return child;
};
var _removeLinkedListItem = function _removeLinkedListItem2(parent, child, firstProp, lastProp) {
  if (firstProp === void 0) {
    firstProp = "_first";
  }
  if (lastProp === void 0) {
    lastProp = "_last";
  }
  var prev = child._prev, next = child._next;
  if (prev) {
    prev._next = next;
  } else if (parent[firstProp] === child) {
    parent[firstProp] = next;
  }
  if (next) {
    next._prev = prev;
  } else if (parent[lastProp] === child) {
    parent[lastProp] = prev;
  }
  child._next = child._prev = child.parent = null;
};
var _removeFromParent = function _removeFromParent2(child, onlyIfParentHasAutoRemove) {
  child.parent && (!onlyIfParentHasAutoRemove || child.parent.autoRemoveChildren) && child.parent.remove && child.parent.remove(child);
  child._act = 0;
};
var _uncache = function _uncache2(animation, child) {
  if (animation && (!child || child._end > animation._dur || child._start < 0)) {
    var a = animation;
    while (a) {
      a._dirty = 1;
      a = a.parent;
    }
  }
  return animation;
};
var _recacheAncestors = function _recacheAncestors2(animation) {
  var parent = animation.parent;
  while (parent && parent.parent) {
    parent._dirty = 1;
    parent.totalDuration();
    parent = parent.parent;
  }
  return animation;
};
var _rewindStartAt = function _rewindStartAt2(tween, totalTime, suppressEvents, force) {
  return tween._startAt && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween.vars.immediateRender && !tween.vars.autoRevert || tween._startAt.render(totalTime, true, force));
};
var _hasNoPausedAncestors = function _hasNoPausedAncestors2(animation) {
  return !animation || animation._ts && _hasNoPausedAncestors2(animation.parent);
};
var _elapsedCycleDuration = function _elapsedCycleDuration2(animation) {
  return animation._repeat ? _animationCycle(animation._tTime, animation = animation.duration() + animation._rDelay) * animation : 0;
};
var _animationCycle = function _animationCycle2(tTime, cycleDuration) {
  var whole = Math.floor(tTime = _roundPrecise(tTime / cycleDuration));
  return tTime && whole === tTime ? whole - 1 : whole;
};
var _parentToChildTotalTime = function _parentToChildTotalTime2(parentTime, child) {
  return (parentTime - child._start) * child._ts + (child._ts >= 0 ? 0 : child._dirty ? child.totalDuration() : child._tDur);
};
var _setEnd = function _setEnd2(animation) {
  return animation._end = _roundPrecise(animation._start + (animation._tDur / Math.abs(animation._ts || animation._rts || _tinyNum) || 0));
};
var _alignPlayhead = function _alignPlayhead2(animation, totalTime) {
  var parent = animation._dp;
  if (parent && parent.smoothChildTiming && animation._ts) {
    animation._start = _roundPrecise(parent._time - (animation._ts > 0 ? totalTime / animation._ts : ((animation._dirty ? animation.totalDuration() : animation._tDur) - totalTime) / -animation._ts));
    _setEnd(animation);
    parent._dirty || _uncache(parent, animation);
  }
  return animation;
};
var _postAddChecks = function _postAddChecks2(timeline2, child) {
  var t2;
  if (child._time || !child._dur && child._initted || child._start < timeline2._time && (child._dur || !child.add)) {
    t2 = _parentToChildTotalTime(timeline2.rawTime(), child);
    if (!child._dur || _clamp(0, child.totalDuration(), t2) - child._tTime > _tinyNum) {
      child.render(t2, true);
    }
  }
  if (_uncache(timeline2, child)._dp && timeline2._initted && timeline2._time >= timeline2._dur && timeline2._ts) {
    if (timeline2._dur < timeline2.duration()) {
      t2 = timeline2;
      while (t2._dp) {
        t2.rawTime() >= 0 && t2.totalTime(t2._tTime);
        t2 = t2._dp;
      }
    }
    timeline2._zTime = -_tinyNum;
  }
};
var _addToTimeline = function _addToTimeline2(timeline2, child, position, skipChecks) {
  child.parent && _removeFromParent(child);
  child._start = _roundPrecise((_isNumber(position) ? position : position || timeline2 !== _globalTimeline ? _parsePosition(timeline2, position, child) : timeline2._time) + child._delay);
  child._end = _roundPrecise(child._start + (child.totalDuration() / Math.abs(child.timeScale()) || 0));
  _addLinkedListItem(timeline2, child, "_first", "_last", timeline2._sort ? "_start" : 0);
  _isFromOrFromStart(child) || (timeline2._recent = child);
  skipChecks || _postAddChecks(timeline2, child);
  timeline2._ts < 0 && _alignPlayhead(timeline2, timeline2._tTime);
  return timeline2;
};
var _scrollTrigger = function _scrollTrigger2(animation, trigger) {
  return (_globals.ScrollTrigger || _missingPlugin("scrollTrigger", trigger)) && _globals.ScrollTrigger.create(trigger, animation);
};
var _attemptInitTween = function _attemptInitTween2(tween, time, force, suppressEvents, tTime) {
  _initTween(tween, time, tTime);
  if (!tween._initted) {
    return 1;
  }
  if (!force && tween._pt && !_reverting && (tween._dur && tween.vars.lazy !== false || !tween._dur && tween.vars.lazy) && _lastRenderedFrame !== _ticker.frame) {
    _lazyTweens.push(tween);
    tween._lazy = [tTime, suppressEvents];
    return 1;
  }
};
var _parentPlayheadIsBeforeStart = function _parentPlayheadIsBeforeStart2(_ref) {
  var parent = _ref.parent;
  return parent && parent._ts && parent._initted && !parent._lock && (parent.rawTime() < 0 || _parentPlayheadIsBeforeStart2(parent));
};
var _isFromOrFromStart = function _isFromOrFromStart2(_ref2) {
  var data = _ref2.data;
  return data === "isFromStart" || data === "isStart";
};
var _renderZeroDurationTween = function _renderZeroDurationTween2(tween, totalTime, suppressEvents, force) {
  var prevRatio = tween.ratio, ratio = totalTime < 0 || !totalTime && (!tween._start && _parentPlayheadIsBeforeStart(tween) && !(!tween._initted && _isFromOrFromStart(tween)) || (tween._ts < 0 || tween._dp._ts < 0) && !_isFromOrFromStart(tween)) ? 0 : 1, repeatDelay = tween._rDelay, tTime = 0, pt4, iteration, prevIteration;
  if (repeatDelay && tween._repeat) {
    tTime = _clamp(0, tween._tDur, totalTime);
    iteration = _animationCycle(tTime, repeatDelay);
    tween._yoyo && iteration & 1 && (ratio = 1 - ratio);
    if (iteration !== _animationCycle(tween._tTime, repeatDelay)) {
      prevRatio = 1 - ratio;
      tween.vars.repeatRefresh && tween._initted && tween.invalidate();
    }
  }
  if (ratio !== prevRatio || _reverting || force || tween._zTime === _tinyNum || !totalTime && tween._zTime) {
    if (!tween._initted && _attemptInitTween(tween, totalTime, force, suppressEvents, tTime)) {
      return;
    }
    prevIteration = tween._zTime;
    tween._zTime = totalTime || (suppressEvents ? _tinyNum : 0);
    suppressEvents || (suppressEvents = totalTime && !prevIteration);
    tween.ratio = ratio;
    tween._from && (ratio = 1 - ratio);
    tween._time = 0;
    tween._tTime = tTime;
    pt4 = tween._pt;
    while (pt4) {
      pt4.r(ratio, pt4.d);
      pt4 = pt4._next;
    }
    totalTime < 0 && _rewindStartAt(tween, totalTime, suppressEvents, true);
    tween._onUpdate && !suppressEvents && _callback(tween, "onUpdate");
    tTime && tween._repeat && !suppressEvents && tween.parent && _callback(tween, "onRepeat");
    if ((totalTime >= tween._tDur || totalTime < 0) && tween.ratio === ratio) {
      ratio && _removeFromParent(tween, 1);
      if (!suppressEvents && !_reverting) {
        _callback(tween, ratio ? "onComplete" : "onReverseComplete", true);
        tween._prom && tween._prom();
      }
    }
  } else if (!tween._zTime) {
    tween._zTime = totalTime;
  }
};
var _findNextPauseTween = function _findNextPauseTween2(animation, prevTime, time) {
  var child;
  if (time > prevTime) {
    child = animation._first;
    while (child && child._start <= time) {
      if (child.data === "isPause" && child._start > prevTime) {
        return child;
      }
      child = child._next;
    }
  } else {
    child = animation._last;
    while (child && child._start >= time) {
      if (child.data === "isPause" && child._start < prevTime) {
        return child;
      }
      child = child._prev;
    }
  }
};
var _setDuration = function _setDuration2(animation, duration, skipUncache, leavePlayhead) {
  var repeat = animation._repeat, dur = _roundPrecise(duration) || 0, totalProgress = animation._tTime / animation._tDur;
  totalProgress && !leavePlayhead && (animation._time *= dur / animation._dur);
  animation._dur = dur;
  animation._tDur = !repeat ? dur : repeat < 0 ? 1e10 : _roundPrecise(dur * (repeat + 1) + animation._rDelay * repeat);
  totalProgress > 0 && !leavePlayhead && _alignPlayhead(animation, animation._tTime = animation._tDur * totalProgress);
  animation.parent && _setEnd(animation);
  skipUncache || _uncache(animation.parent, animation);
  return animation;
};
var _onUpdateTotalDuration = function _onUpdateTotalDuration2(animation) {
  return animation instanceof Timeline ? _uncache(animation) : _setDuration(animation, animation._dur);
};
var _zeroPosition = {
  _start: 0,
  endTime: _emptyFunc,
  totalDuration: _emptyFunc
};
var _parsePosition = function _parsePosition2(animation, position, percentAnimation) {
  var labels = animation.labels, recent = animation._recent || _zeroPosition, clippedDuration = animation.duration() >= _bigNum ? recent.endTime(false) : animation._dur, i2, offset, isPercent;
  if (_isString(position) && (isNaN(position) || position in labels)) {
    offset = position.charAt(0);
    isPercent = position.substr(-1) === "%";
    i2 = position.indexOf("=");
    if (offset === "<" || offset === ">") {
      i2 >= 0 && (position = position.replace(/=/, ""));
      return (offset === "<" ? recent._start : recent.endTime(recent._repeat >= 0)) + (parseFloat(position.substr(1)) || 0) * (isPercent ? (i2 < 0 ? recent : percentAnimation).totalDuration() / 100 : 1);
    }
    if (i2 < 0) {
      position in labels || (labels[position] = clippedDuration);
      return labels[position];
    }
    offset = parseFloat(position.charAt(i2 - 1) + position.substr(i2 + 1));
    if (isPercent && percentAnimation) {
      offset = offset / 100 * (_isArray(percentAnimation) ? percentAnimation[0] : percentAnimation).totalDuration();
    }
    return i2 > 1 ? _parsePosition2(animation, position.substr(0, i2 - 1), percentAnimation) + offset : clippedDuration + offset;
  }
  return position == null ? clippedDuration : +position;
};
var _createTweenType = function _createTweenType2(type, params, timeline2) {
  var isLegacy = _isNumber(params[1]), varsIndex = (isLegacy ? 2 : 1) + (type < 2 ? 0 : 1), vars = params[varsIndex], irVars, parent;
  isLegacy && (vars.duration = params[1]);
  vars.parent = timeline2;
  if (type) {
    irVars = vars;
    parent = timeline2;
    while (parent && !("immediateRender" in irVars)) {
      irVars = parent.vars.defaults || {};
      parent = _isNotFalse(parent.vars.inherit) && parent.parent;
    }
    vars.immediateRender = _isNotFalse(irVars.immediateRender);
    type < 2 ? vars.runBackwards = 1 : vars.startAt = params[varsIndex - 1];
  }
  return new Tween(params[0], vars, params[varsIndex + 1]);
};
var _conditionalReturn = function _conditionalReturn2(value, func) {
  return value || value === 0 ? func(value) : func;
};
var _clamp = function _clamp2(min, max, value) {
  return value < min ? min : value > max ? max : value;
};
var getUnit = function getUnit2(value, v2) {
  return !_isString(value) || !(v2 = _unitExp.exec(value)) ? "" : v2[1];
};
var clamp = function clamp2(min, max, value) {
  return _conditionalReturn(value, function(v2) {
    return _clamp(min, max, v2);
  });
};
var _slice = [].slice;
var _isArrayLike = function _isArrayLike2(value, nonEmpty) {
  return value && _isObject(value) && "length" in value && (!nonEmpty && !value.length || value.length - 1 in value && _isObject(value[0])) && !value.nodeType && value !== _win;
};
var _flatten = function _flatten2(ar2, leaveStrings, accumulator) {
  if (accumulator === void 0) {
    accumulator = [];
  }
  return ar2.forEach(function(value) {
    var _accumulator;
    return _isString(value) && !leaveStrings || _isArrayLike(value, 1) ? (_accumulator = accumulator).push.apply(_accumulator, toArray(value)) : accumulator.push(value);
  }) || accumulator;
};
var toArray = function toArray2(value, scope, leaveStrings) {
  return _context && !scope && _context.selector ? _context.selector(value) : _isString(value) && !leaveStrings && (_coreInitted || !_wake()) ? _slice.call((scope || _doc).querySelectorAll(value), 0) : _isArray(value) ? _flatten(value, leaveStrings) : _isArrayLike(value) ? _slice.call(value, 0) : value ? [value] : [];
};
var selector = function selector2(value) {
  value = toArray(value)[0] || _warn("Invalid scope") || {};
  return function(v2) {
    var el = value.current || value.nativeElement || value;
    return toArray(v2, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") || _doc.createElement("div") : value);
  };
};
var shuffle = function shuffle2(a) {
  return a.sort(function() {
    return 0.5 - Math.random();
  });
};
var distribute = function distribute2(v2) {
  if (_isFunction(v2)) {
    return v2;
  }
  var vars = _isObject(v2) ? v2 : {
    each: v2
  }, ease = _parseEase(vars.ease), from = vars.from || 0, base = parseFloat(vars.base) || 0, cache = {}, isDecimal = from > 0 && from < 1, ratios = isNaN(from) || isDecimal, axis = vars.axis, ratioX = from, ratioY = from;
  if (_isString(from)) {
    ratioX = ratioY = {
      center: 0.5,
      edges: 0.5,
      end: 1
    }[from] || 0;
  } else if (!isDecimal && ratios) {
    ratioX = from[0];
    ratioY = from[1];
  }
  return function(i2, target, a) {
    var l2 = (a || vars).length, distances = cache[l2], originX, originY, x2, y3, d2, j3, max, min, wrapAt;
    if (!distances) {
      wrapAt = vars.grid === "auto" ? 0 : (vars.grid || [1, _bigNum])[1];
      if (!wrapAt) {
        max = -_bigNum;
        while (max < (max = a[wrapAt++].getBoundingClientRect().left) && wrapAt < l2) {
        }
        wrapAt < l2 && wrapAt--;
      }
      distances = cache[l2] = [];
      originX = ratios ? Math.min(wrapAt, l2) * ratioX - 0.5 : from % wrapAt;
      originY = wrapAt === _bigNum ? 0 : ratios ? l2 * ratioY / wrapAt - 0.5 : from / wrapAt | 0;
      max = 0;
      min = _bigNum;
      for (j3 = 0; j3 < l2; j3++) {
        x2 = j3 % wrapAt - originX;
        y3 = originY - (j3 / wrapAt | 0);
        distances[j3] = d2 = !axis ? _sqrt(x2 * x2 + y3 * y3) : Math.abs(axis === "y" ? y3 : x2);
        d2 > max && (max = d2);
        d2 < min && (min = d2);
      }
      from === "random" && shuffle(distances);
      distances.max = max - min;
      distances.min = min;
      distances.v = l2 = (parseFloat(vars.amount) || parseFloat(vars.each) * (wrapAt > l2 ? l2 - 1 : !axis ? Math.max(wrapAt, l2 / wrapAt) : axis === "y" ? l2 / wrapAt : wrapAt) || 0) * (from === "edges" ? -1 : 1);
      distances.b = l2 < 0 ? base - l2 : base;
      distances.u = getUnit(vars.amount || vars.each) || 0;
      ease = ease && l2 < 0 ? _invertEase(ease) : ease;
    }
    l2 = (distances[i2] - distances.min) / distances.max || 0;
    return _roundPrecise(distances.b + (ease ? ease(l2) : l2) * distances.v) + distances.u;
  };
};
var _roundModifier = function _roundModifier2(v2) {
  var p2 = Math.pow(10, ((v2 + "").split(".")[1] || "").length);
  return function(raw) {
    var n2 = _roundPrecise(Math.round(parseFloat(raw) / v2) * v2 * p2);
    return (n2 - n2 % 1) / p2 + (_isNumber(raw) ? 0 : getUnit(raw));
  };
};
var snap = function snap2(snapTo, value) {
  var isArray = _isArray(snapTo), radius, is2D;
  if (!isArray && _isObject(snapTo)) {
    radius = isArray = snapTo.radius || _bigNum;
    if (snapTo.values) {
      snapTo = toArray(snapTo.values);
      if (is2D = !_isNumber(snapTo[0])) {
        radius *= radius;
      }
    } else {
      snapTo = _roundModifier(snapTo.increment);
    }
  }
  return _conditionalReturn(value, !isArray ? _roundModifier(snapTo) : _isFunction(snapTo) ? function(raw) {
    is2D = snapTo(raw);
    return Math.abs(is2D - raw) <= radius ? is2D : raw;
  } : function(raw) {
    var x2 = parseFloat(is2D ? raw.x : raw), y3 = parseFloat(is2D ? raw.y : 0), min = _bigNum, closest = 0, i2 = snapTo.length, dx, dy;
    while (i2--) {
      if (is2D) {
        dx = snapTo[i2].x - x2;
        dy = snapTo[i2].y - y3;
        dx = dx * dx + dy * dy;
      } else {
        dx = Math.abs(snapTo[i2] - x2);
      }
      if (dx < min) {
        min = dx;
        closest = i2;
      }
    }
    closest = !radius || min <= radius ? snapTo[closest] : raw;
    return is2D || closest === raw || _isNumber(raw) ? closest : closest + getUnit(raw);
  });
};
var random = function random2(min, max, roundingIncrement, returnFunction) {
  return _conditionalReturn(_isArray(min) ? !max : roundingIncrement === true ? !!(roundingIncrement = 0) : !returnFunction, function() {
    return _isArray(min) ? min[~~(Math.random() * min.length)] : (roundingIncrement = roundingIncrement || 1e-5) && (returnFunction = roundingIncrement < 1 ? Math.pow(10, (roundingIncrement + "").length - 2) : 1) && Math.floor(Math.round((min - roundingIncrement / 2 + Math.random() * (max - min + roundingIncrement * 0.99)) / roundingIncrement) * roundingIncrement * returnFunction) / returnFunction;
  });
};
var pipe = function pipe2() {
  for (var _len = arguments.length, functions = new Array(_len), _key = 0; _key < _len; _key++) {
    functions[_key] = arguments[_key];
  }
  return function(value) {
    return functions.reduce(function(v2, f2) {
      return f2(v2);
    }, value);
  };
};
var unitize = function unitize2(func, unit) {
  return function(value) {
    return func(parseFloat(value)) + (unit || getUnit(value));
  };
};
var normalize = function normalize2(min, max, value) {
  return mapRange(min, max, 0, 1, value);
};
var _wrapArray = function _wrapArray2(a, wrapper, value) {
  return _conditionalReturn(value, function(index) {
    return a[~~wrapper(index)];
  });
};
var wrap = function wrap2(min, max, value) {
  var range = max - min;
  return _isArray(min) ? _wrapArray(min, wrap2(0, min.length), max) : _conditionalReturn(value, function(value2) {
    return (range + (value2 - min) % range) % range + min;
  });
};
var wrapYoyo = function wrapYoyo2(min, max, value) {
  var range = max - min, total = range * 2;
  return _isArray(min) ? _wrapArray(min, wrapYoyo2(0, min.length - 1), max) : _conditionalReturn(value, function(value2) {
    value2 = (total + (value2 - min) % total) % total || 0;
    return min + (value2 > range ? total - value2 : value2);
  });
};
var _replaceRandom = function _replaceRandom2(s2) {
  return s2.replace(_randomExp, function(match) {
    var arIndex = match.indexOf("[") + 1, values = match.substring(arIndex || 7, arIndex ? match.indexOf("]") : match.length - 1).split(_commaDelimExp);
    return random(arIndex ? values : +values[0], arIndex ? 0 : +values[1], +values[2] || 1e-5);
  });
};
var mapRange = function mapRange2(inMin, inMax, outMin, outMax, value) {
  var inRange = inMax - inMin, outRange = outMax - outMin;
  return _conditionalReturn(value, function(value2) {
    return outMin + ((value2 - inMin) / inRange * outRange || 0);
  });
};
var interpolate = function interpolate2(start, end, progress, mutate) {
  var func = isNaN(start + end) ? 0 : function(p3) {
    return (1 - p3) * start + p3 * end;
  };
  if (!func) {
    var isString = _isString(start), master = {}, p2, i2, interpolators, l2, il;
    progress === true && (mutate = 1) && (progress = null);
    if (isString) {
      start = {
        p: start
      };
      end = {
        p: end
      };
    } else if (_isArray(start) && !_isArray(end)) {
      interpolators = [];
      l2 = start.length;
      il = l2 - 2;
      for (i2 = 1; i2 < l2; i2++) {
        interpolators.push(interpolate2(start[i2 - 1], start[i2]));
      }
      l2--;
      func = function func2(p3) {
        p3 *= l2;
        var i3 = Math.min(il, ~~p3);
        return interpolators[i3](p3 - i3);
      };
      progress = end;
    } else if (!mutate) {
      start = _merge(_isArray(start) ? [] : {}, start);
    }
    if (!interpolators) {
      for (p2 in end) {
        _addPropTween.call(master, start, p2, "get", end[p2]);
      }
      func = function func2(p3) {
        return _renderPropTweens(p3, master) || (isString ? start.p : start);
      };
    }
  }
  return _conditionalReturn(progress, func);
};
var _getLabelInDirection = function _getLabelInDirection2(timeline2, fromTime, backward) {
  var labels = timeline2.labels, min = _bigNum, p2, distance, label;
  for (p2 in labels) {
    distance = labels[p2] - fromTime;
    if (distance < 0 === !!backward && distance && min > (distance = Math.abs(distance))) {
      label = p2;
      min = distance;
    }
  }
  return label;
};
var _callback = function _callback2(animation, type, executeLazyFirst) {
  var v2 = animation.vars, callback = v2[type], prevContext = _context, context3 = animation._ctx, params, scope, result;
  if (!callback) {
    return;
  }
  params = v2[type + "Params"];
  scope = v2.callbackScope || animation;
  executeLazyFirst && _lazyTweens.length && _lazyRender();
  context3 && (_context = context3);
  result = params ? callback.apply(scope, params) : callback.call(scope);
  _context = prevContext;
  return result;
};
var _interrupt = function _interrupt2(animation) {
  _removeFromParent(animation);
  animation.scrollTrigger && animation.scrollTrigger.kill(!!_reverting);
  animation.progress() < 1 && _callback(animation, "onInterrupt");
  return animation;
};
var _quickTween;
var _registerPluginQueue = [];
var _createPlugin = function _createPlugin2(config3) {
  if (!config3) return;
  config3 = !config3.name && config3["default"] || config3;
  if (_windowExists() || config3.headless) {
    var name = config3.name, isFunc = _isFunction(config3), Plugin = name && !isFunc && config3.init ? function() {
      this._props = [];
    } : config3, instanceDefaults = {
      init: _emptyFunc,
      render: _renderPropTweens,
      add: _addPropTween,
      kill: _killPropTweensOf,
      modifier: _addPluginModifier,
      rawVars: 0
    }, statics = {
      targetTest: 0,
      get: 0,
      getSetter: _getSetter,
      aliases: {},
      register: 0
    };
    _wake();
    if (config3 !== Plugin) {
      if (_plugins[name]) {
        return;
      }
      _setDefaults(Plugin, _setDefaults(_copyExcluding(config3, instanceDefaults), statics));
      _merge(Plugin.prototype, _merge(instanceDefaults, _copyExcluding(config3, statics)));
      _plugins[Plugin.prop = name] = Plugin;
      if (config3.targetTest) {
        _harnessPlugins.push(Plugin);
        _reservedProps[name] = 1;
      }
      name = (name === "css" ? "CSS" : name.charAt(0).toUpperCase() + name.substr(1)) + "Plugin";
    }
    _addGlobal(name, Plugin);
    config3.register && config3.register(gsap, Plugin, PropTween);
  } else {
    _registerPluginQueue.push(config3);
  }
};
var _255 = 255;
var _colorLookup = {
  aqua: [0, _255, _255],
  lime: [0, _255, 0],
  silver: [192, 192, 192],
  black: [0, 0, 0],
  maroon: [128, 0, 0],
  teal: [0, 128, 128],
  blue: [0, 0, _255],
  navy: [0, 0, 128],
  white: [_255, _255, _255],
  olive: [128, 128, 0],
  yellow: [_255, _255, 0],
  orange: [_255, 165, 0],
  gray: [128, 128, 128],
  purple: [128, 0, 128],
  green: [0, 128, 0],
  red: [_255, 0, 0],
  pink: [_255, 192, 203],
  cyan: [0, _255, _255],
  transparent: [_255, _255, _255, 0]
};
var _hue = function _hue2(h, m1, m2) {
  h += h < 0 ? 1 : h > 1 ? -1 : 0;
  return (h * 6 < 1 ? m1 + (m2 - m1) * h * 6 : h < 0.5 ? m2 : h * 3 < 2 ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1) * _255 + 0.5 | 0;
};
var splitColor = function splitColor2(v2, toHSL, forceAlpha) {
  var a = !v2 ? _colorLookup.black : _isNumber(v2) ? [v2 >> 16, v2 >> 8 & _255, v2 & _255] : 0, r2, g2, b2, h, s2, l2, max, min, d2, wasHSL;
  if (!a) {
    if (v2.substr(-1) === ",") {
      v2 = v2.substr(0, v2.length - 1);
    }
    if (_colorLookup[v2]) {
      a = _colorLookup[v2];
    } else if (v2.charAt(0) === "#") {
      if (v2.length < 6) {
        r2 = v2.charAt(1);
        g2 = v2.charAt(2);
        b2 = v2.charAt(3);
        v2 = "#" + r2 + r2 + g2 + g2 + b2 + b2 + (v2.length === 5 ? v2.charAt(4) + v2.charAt(4) : "");
      }
      if (v2.length === 9) {
        a = parseInt(v2.substr(1, 6), 16);
        return [a >> 16, a >> 8 & _255, a & _255, parseInt(v2.substr(7), 16) / 255];
      }
      v2 = parseInt(v2.substr(1), 16);
      a = [v2 >> 16, v2 >> 8 & _255, v2 & _255];
    } else if (v2.substr(0, 3) === "hsl") {
      a = wasHSL = v2.match(_strictNumExp);
      if (!toHSL) {
        h = +a[0] % 360 / 360;
        s2 = +a[1] / 100;
        l2 = +a[2] / 100;
        g2 = l2 <= 0.5 ? l2 * (s2 + 1) : l2 + s2 - l2 * s2;
        r2 = l2 * 2 - g2;
        a.length > 3 && (a[3] *= 1);
        a[0] = _hue(h + 1 / 3, r2, g2);
        a[1] = _hue(h, r2, g2);
        a[2] = _hue(h - 1 / 3, r2, g2);
      } else if (~v2.indexOf("=")) {
        a = v2.match(_numExp);
        forceAlpha && a.length < 4 && (a[3] = 1);
        return a;
      }
    } else {
      a = v2.match(_strictNumExp) || _colorLookup.transparent;
    }
    a = a.map(Number);
  }
  if (toHSL && !wasHSL) {
    r2 = a[0] / _255;
    g2 = a[1] / _255;
    b2 = a[2] / _255;
    max = Math.max(r2, g2, b2);
    min = Math.min(r2, g2, b2);
    l2 = (max + min) / 2;
    if (max === min) {
      h = s2 = 0;
    } else {
      d2 = max - min;
      s2 = l2 > 0.5 ? d2 / (2 - max - min) : d2 / (max + min);
      h = max === r2 ? (g2 - b2) / d2 + (g2 < b2 ? 6 : 0) : max === g2 ? (b2 - r2) / d2 + 2 : (r2 - g2) / d2 + 4;
      h *= 60;
    }
    a[0] = ~~(h + 0.5);
    a[1] = ~~(s2 * 100 + 0.5);
    a[2] = ~~(l2 * 100 + 0.5);
  }
  forceAlpha && a.length < 4 && (a[3] = 1);
  return a;
};
var _colorOrderData = function _colorOrderData2(v2) {
  var values = [], c = [], i2 = -1;
  v2.split(_colorExp).forEach(function(v3) {
    var a = v3.match(_numWithUnitExp) || [];
    values.push.apply(values, a);
    c.push(i2 += a.length + 1);
  });
  values.c = c;
  return values;
};
var _formatColors = function _formatColors2(s2, toHSL, orderMatchData) {
  var result = "", colors = (s2 + result).match(_colorExp), type = toHSL ? "hsla(" : "rgba(", i2 = 0, c, shell, d2, l2;
  if (!colors) {
    return s2;
  }
  colors = colors.map(function(color) {
    return (color = splitColor(color, toHSL, 1)) && type + (toHSL ? color[0] + "," + color[1] + "%," + color[2] + "%," + color[3] : color.join(",")) + ")";
  });
  if (orderMatchData) {
    d2 = _colorOrderData(s2);
    c = orderMatchData.c;
    if (c.join(result) !== d2.c.join(result)) {
      shell = s2.replace(_colorExp, "1").split(_numWithUnitExp);
      l2 = shell.length - 1;
      for (; i2 < l2; i2++) {
        result += shell[i2] + (~c.indexOf(i2) ? colors.shift() || type + "0,0,0,0)" : (d2.length ? d2 : colors.length ? colors : orderMatchData).shift());
      }
    }
  }
  if (!shell) {
    shell = s2.split(_colorExp);
    l2 = shell.length - 1;
    for (; i2 < l2; i2++) {
      result += shell[i2] + colors[i2];
    }
  }
  return result + shell[l2];
};
var _colorExp = (function() {
  var s2 = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b", p2;
  for (p2 in _colorLookup) {
    s2 += "|" + p2 + "\\b";
  }
  return new RegExp(s2 + ")", "gi");
})();
var _hslExp = /hsl[a]?\(/;
var _colorStringFilter = function _colorStringFilter2(a) {
  var combined = a.join(" "), toHSL;
  _colorExp.lastIndex = 0;
  if (_colorExp.test(combined)) {
    toHSL = _hslExp.test(combined);
    a[1] = _formatColors(a[1], toHSL);
    a[0] = _formatColors(a[0], toHSL, _colorOrderData(a[1]));
    return true;
  }
};
var _tickerActive;
var _ticker = (function() {
  var _getTime = Date.now, _lagThreshold = 500, _adjustedLag = 33, _startTime = _getTime(), _lastUpdate = _startTime, _gap = 1e3 / 240, _nextTime = _gap, _listeners2 = [], _id, _req, _raf, _self, _delta, _i4, _tick = function _tick2(v2) {
    var elapsed = _getTime() - _lastUpdate, manual = v2 === true, overlap, dispatch, time, frame;
    (elapsed > _lagThreshold || elapsed < 0) && (_startTime += elapsed - _adjustedLag);
    _lastUpdate += elapsed;
    time = _lastUpdate - _startTime;
    overlap = time - _nextTime;
    if (overlap > 0 || manual) {
      frame = ++_self.frame;
      _delta = time - _self.time * 1e3;
      _self.time = time = time / 1e3;
      _nextTime += overlap + (overlap >= _gap ? 4 : _gap - overlap);
      dispatch = 1;
    }
    manual || (_id = _req(_tick2));
    if (dispatch) {
      for (_i4 = 0; _i4 < _listeners2.length; _i4++) {
        _listeners2[_i4](time, _delta, frame, v2);
      }
    }
  };
  _self = {
    time: 0,
    frame: 0,
    tick: function tick() {
      _tick(true);
    },
    deltaRatio: function deltaRatio(fps) {
      return _delta / (1e3 / (fps || 60));
    },
    wake: function wake() {
      if (_coreReady) {
        if (!_coreInitted && _windowExists()) {
          _win = _coreInitted = window;
          _doc = _win.document || {};
          _globals.gsap = gsap;
          (_win.gsapVersions || (_win.gsapVersions = [])).push(gsap.version);
          _install(_installScope || _win.GreenSockGlobals || !_win.gsap && _win || {});
          _registerPluginQueue.forEach(_createPlugin);
        }
        _raf = typeof requestAnimationFrame !== "undefined" && requestAnimationFrame;
        _id && _self.sleep();
        _req = _raf || function(f2) {
          return setTimeout(f2, _nextTime - _self.time * 1e3 + 1 | 0);
        };
        _tickerActive = 1;
        _tick(2);
      }
    },
    sleep: function sleep() {
      (_raf ? cancelAnimationFrame : clearTimeout)(_id);
      _tickerActive = 0;
      _req = _emptyFunc;
    },
    lagSmoothing: function lagSmoothing(threshold, adjustedLag) {
      _lagThreshold = threshold || Infinity;
      _adjustedLag = Math.min(adjustedLag || 33, _lagThreshold);
    },
    fps: function fps(_fps) {
      _gap = 1e3 / (_fps || 240);
      _nextTime = _self.time * 1e3 + _gap;
    },
    add: function add(callback, once, prioritize) {
      var func = once ? function(t2, d2, f2, v2) {
        callback(t2, d2, f2, v2);
        _self.remove(func);
      } : callback;
      _self.remove(callback);
      _listeners2[prioritize ? "unshift" : "push"](func);
      _wake();
      return func;
    },
    remove: function remove(callback, i2) {
      ~(i2 = _listeners2.indexOf(callback)) && _listeners2.splice(i2, 1) && _i4 >= i2 && _i4--;
    },
    _listeners: _listeners2
  };
  return _self;
})();
var _wake = function _wake2() {
  return !_tickerActive && _ticker.wake();
};
var _easeMap = {};
var _customEaseExp = /^[\d.\-M][\d.\-,\s]/;
var _quotesExp = /["']/g;
var _parseObjectInString = function _parseObjectInString2(value) {
  var obj = {}, split = value.substr(1, value.length - 3).split(":"), key = split[0], i2 = 1, l2 = split.length, index, val, parsedVal;
  for (; i2 < l2; i2++) {
    val = split[i2];
    index = i2 !== l2 - 1 ? val.lastIndexOf(",") : val.length;
    parsedVal = val.substr(0, index);
    obj[key] = isNaN(parsedVal) ? parsedVal.replace(_quotesExp, "").trim() : +parsedVal;
    key = val.substr(index + 1).trim();
  }
  return obj;
};
var _valueInParentheses = function _valueInParentheses2(value) {
  var open = value.indexOf("(") + 1, close = value.indexOf(")"), nested = value.indexOf("(", open);
  return value.substring(open, ~nested && nested < close ? value.indexOf(")", close + 1) : close);
};
var _configEaseFromString = function _configEaseFromString2(name) {
  var split = (name + "").split("("), ease = _easeMap[split[0]];
  return ease && split.length > 1 && ease.config ? ease.config.apply(null, ~name.indexOf("{") ? [_parseObjectInString(split[1])] : _valueInParentheses(name).split(",").map(_numericIfPossible)) : _easeMap._CE && _customEaseExp.test(name) ? _easeMap._CE("", name) : ease;
};
var _invertEase = function _invertEase2(ease) {
  return function(p2) {
    return 1 - ease(1 - p2);
  };
};
var _parseEase = function _parseEase2(ease, defaultEase) {
  return !ease ? defaultEase : (_isFunction(ease) ? ease : _easeMap[ease] || _configEaseFromString(ease)) || defaultEase;
};
var _insertEase = function _insertEase2(names, easeIn, easeOut, easeInOut) {
  if (easeOut === void 0) {
    easeOut = function easeOut2(p2) {
      return 1 - easeIn(1 - p2);
    };
  }
  if (easeInOut === void 0) {
    easeInOut = function easeInOut2(p2) {
      return p2 < 0.5 ? easeIn(p2 * 2) / 2 : 1 - easeIn((1 - p2) * 2) / 2;
    };
  }
  var ease = {
    easeIn,
    easeOut,
    easeInOut
  }, lowercaseName;
  _forEachName(names, function(name) {
    _easeMap[name] = _globals[name] = ease;
    _easeMap[lowercaseName = name.toLowerCase()] = easeOut;
    for (var p2 in ease) {
      _easeMap[lowercaseName + (p2 === "easeIn" ? ".in" : p2 === "easeOut" ? ".out" : ".inOut")] = _easeMap[name + "." + p2] = ease[p2];
    }
  });
  return ease;
};
var _easeInOutFromOut = function _easeInOutFromOut2(easeOut) {
  return function(p2) {
    return p2 < 0.5 ? (1 - easeOut(1 - p2 * 2)) / 2 : 0.5 + easeOut((p2 - 0.5) * 2) / 2;
  };
};
var _configElastic = function _configElastic2(type, amplitude, period) {
  var p1 = amplitude >= 1 ? amplitude : 1, p2 = (period || (type ? 0.3 : 0.45)) / (amplitude < 1 ? amplitude : 1), p3 = p2 / _2PI * (Math.asin(1 / p1) || 0), easeOut = function easeOut2(p4) {
    return p4 === 1 ? 1 : p1 * Math.pow(2, -10 * p4) * _sin((p4 - p3) * p2) + 1;
  }, ease = type === "out" ? easeOut : type === "in" ? function(p4) {
    return 1 - easeOut(1 - p4);
  } : _easeInOutFromOut(easeOut);
  p2 = _2PI / p2;
  ease.config = function(amplitude2, period2) {
    return _configElastic2(type, amplitude2, period2);
  };
  return ease;
};
var _configBack = function _configBack2(type, overshoot) {
  if (overshoot === void 0) {
    overshoot = 1.70158;
  }
  var easeOut = function easeOut2(p2) {
    return p2 ? --p2 * p2 * ((overshoot + 1) * p2 + overshoot) + 1 : 0;
  }, ease = type === "out" ? easeOut : type === "in" ? function(p2) {
    return 1 - easeOut(1 - p2);
  } : _easeInOutFromOut(easeOut);
  ease.config = function(overshoot2) {
    return _configBack2(type, overshoot2);
  };
  return ease;
};
_forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", function(name, i2) {
  var power = i2 < 5 ? i2 + 1 : i2;
  _insertEase(name + ",Power" + (power - 1), i2 ? function(p2) {
    return Math.pow(p2, power);
  } : function(p2) {
    return p2;
  }, function(p2) {
    return 1 - Math.pow(1 - p2, power);
  }, function(p2) {
    return p2 < 0.5 ? Math.pow(p2 * 2, power) / 2 : 1 - Math.pow((1 - p2) * 2, power) / 2;
  });
});
_easeMap.Linear.easeNone = _easeMap.none = _easeMap.Linear.easeIn;
_insertEase("Elastic", _configElastic("in"), _configElastic("out"), _configElastic());
(function(n2, c) {
  var n1 = 1 / c, n22 = 2 * n1, n3 = 2.5 * n1, easeOut = function easeOut2(p2) {
    return p2 < n1 ? n2 * p2 * p2 : p2 < n22 ? n2 * Math.pow(p2 - 1.5 / c, 2) + 0.75 : p2 < n3 ? n2 * (p2 -= 2.25 / c) * p2 + 0.9375 : n2 * Math.pow(p2 - 2.625 / c, 2) + 0.984375;
  };
  _insertEase("Bounce", function(p2) {
    return 1 - easeOut(1 - p2);
  }, easeOut);
})(7.5625, 2.75);
_insertEase("Expo", function(p2) {
  return Math.pow(2, 10 * (p2 - 1)) * p2 + p2 * p2 * p2 * p2 * p2 * p2 * (1 - p2);
});
_insertEase("Circ", function(p2) {
  return -(_sqrt(1 - p2 * p2) - 1);
});
_insertEase("Sine", function(p2) {
  return p2 === 1 ? 1 : -_cos(p2 * _HALF_PI) + 1;
});
_insertEase("Back", _configBack("in"), _configBack("out"), _configBack());
_easeMap.SteppedEase = _easeMap.steps = _globals.SteppedEase = {
  config: function config(steps, immediateStart) {
    if (steps === void 0) {
      steps = 1;
    }
    var p1 = 1 / steps, p2 = steps + (immediateStart ? 0 : 1), p3 = immediateStart ? 1 : 0, max = 1 - _tinyNum;
    return function(p4) {
      return ((p2 * _clamp(0, max, p4) | 0) + p3) * p1;
    };
  }
};
_defaults.ease = _easeMap["quad.out"];
_forEachName("onComplete,onUpdate,onStart,onRepeat,onReverseComplete,onInterrupt", function(name) {
  return _callbackNames += name + "," + name + "Params,";
});
var GSCache = function GSCache2(target, harness) {
  this.id = _gsID++;
  target._gsap = this;
  this.target = target;
  this.harness = harness;
  this.get = harness ? harness.get : _getProperty;
  this.set = harness ? harness.getSetter : _getSetter;
};
var Animation = /* @__PURE__ */ (function() {
  function Animation2(vars) {
    this.vars = vars;
    this._delay = +vars.delay || 0;
    if (this._repeat = vars.repeat === Infinity ? -2 : vars.repeat || 0) {
      this._rDelay = vars.repeatDelay || 0;
      this._yoyo = !!vars.yoyo || !!vars.yoyoEase;
    }
    this._ts = 1;
    _setDuration(this, +vars.duration, 1, 1);
    this.data = vars.data;
    if (_context) {
      this._ctx = _context;
      _context.data.push(this);
    }
    _tickerActive || _ticker.wake();
  }
  var _proto = Animation2.prototype;
  _proto.delay = function delay(value) {
    if (value || value === 0) {
      this.parent && this.parent.smoothChildTiming && this.startTime(this._start + value - this._delay);
      this._delay = value;
      return this;
    }
    return this._delay;
  };
  _proto.duration = function duration(value) {
    return arguments.length ? this.totalDuration(this._repeat > 0 ? value + (value + this._rDelay) * this._repeat : value) : this.totalDuration() && this._dur;
  };
  _proto.totalDuration = function totalDuration(value) {
    if (!arguments.length) {
      return this._tDur;
    }
    this._dirty = 0;
    return _setDuration(this, this._repeat < 0 ? value : (value - this._repeat * this._rDelay) / (this._repeat + 1));
  };
  _proto.totalTime = function totalTime(_totalTime, suppressEvents) {
    _wake();
    if (!arguments.length) {
      return this._tTime;
    }
    var parent = this._dp;
    if (parent && parent.smoothChildTiming && this._ts) {
      _alignPlayhead(this, _totalTime);
      !parent._dp || parent.parent || _postAddChecks(parent, this);
      while (parent && parent.parent) {
        if (parent.parent._time !== parent._start + (parent._ts >= 0 ? parent._tTime / parent._ts : (parent.totalDuration() - parent._tTime) / -parent._ts)) {
          parent.totalTime(parent._tTime, true);
        }
        parent = parent.parent;
      }
      if (!this.parent && this._dp.autoRemoveChildren && (this._ts > 0 && _totalTime < this._tDur || this._ts < 0 && _totalTime > 0 || !this._tDur && !_totalTime)) {
        _addToTimeline(this._dp, this, this._start - this._delay);
      }
    }
    if (this._tTime !== _totalTime || !this._dur && !suppressEvents || this._initted && Math.abs(this._zTime) === _tinyNum || !this._initted && this._dur && _totalTime || !_totalTime && !this._initted && (this.add || this._ptLookup)) {
      this._ts || (this._pTime = _totalTime);
      _lazySafeRender(this, _totalTime, suppressEvents);
    }
    return this;
  };
  _proto.time = function time(value, suppressEvents) {
    return arguments.length ? this.totalTime(Math.min(this.totalDuration(), value + _elapsedCycleDuration(this)) % (this._dur + this._rDelay) || (value ? this._dur : 0), suppressEvents) : this._time;
  };
  _proto.totalProgress = function totalProgress(value, suppressEvents) {
    return arguments.length ? this.totalTime(this.totalDuration() * value, suppressEvents) : this.totalDuration() ? Math.min(1, this._tTime / this._tDur) : this.rawTime() >= 0 && this._initted ? 1 : 0;
  };
  _proto.progress = function progress(value, suppressEvents) {
    return arguments.length ? this.totalTime(this.duration() * (this._yoyo && !(this.iteration() & 1) ? 1 - value : value) + _elapsedCycleDuration(this), suppressEvents) : this.duration() ? Math.min(1, this._time / this._dur) : this.rawTime() > 0 ? 1 : 0;
  };
  _proto.iteration = function iteration(value, suppressEvents) {
    var cycleDuration = this.duration() + this._rDelay;
    return arguments.length ? this.totalTime(this._time + (value - 1) * cycleDuration, suppressEvents) : this._repeat ? _animationCycle(this._tTime, cycleDuration) + 1 : 1;
  };
  _proto.timeScale = function timeScale(value, suppressEvents) {
    if (!arguments.length) {
      return this._rts === -_tinyNum ? 0 : this._rts;
    }
    if (this._rts === value) {
      return this;
    }
    var tTime = this.parent && this._ts ? _parentToChildTotalTime(this.parent._time, this) : this._tTime;
    this._rts = +value || 0;
    this._ts = this._ps || value === -_tinyNum ? 0 : this._rts;
    this.totalTime(_clamp(-Math.abs(this._delay), this.totalDuration(), tTime), suppressEvents !== false);
    _setEnd(this);
    return _recacheAncestors(this);
  };
  _proto.paused = function paused(value) {
    if (!arguments.length) {
      return this._ps;
    }
    if (this._ps !== value) {
      this._ps = value;
      if (value) {
        this._pTime = this._tTime || Math.max(-this._delay, this.rawTime());
        this._ts = this._act = 0;
      } else {
        _wake();
        this._ts = this._rts;
        this.totalTime(this.parent && !this.parent.smoothChildTiming ? this.rawTime() : this._tTime || this._pTime, this.progress() === 1 && Math.abs(this._zTime) !== _tinyNum && (this._tTime -= _tinyNum));
      }
    }
    return this;
  };
  _proto.startTime = function startTime(value) {
    if (arguments.length) {
      this._start = _roundPrecise(value);
      var parent = this.parent || this._dp;
      parent && (parent._sort || !this.parent) && _addToTimeline(parent, this, this._start - this._delay);
      return this;
    }
    return this._start;
  };
  _proto.endTime = function endTime(includeRepeats) {
    return this._start + (_isNotFalse(includeRepeats) ? this.totalDuration() : this.duration()) / Math.abs(this._ts || 1);
  };
  _proto.rawTime = function rawTime(wrapRepeats) {
    var parent = this.parent || this._dp;
    return !parent ? this._tTime : wrapRepeats && (!this._ts || this._repeat && this._time && this.totalProgress() < 1) ? this._tTime % (this._dur + this._rDelay) : !this._ts ? this._tTime : _parentToChildTotalTime(parent.rawTime(wrapRepeats), this);
  };
  _proto.revert = function revert(config3) {
    if (config3 === void 0) {
      config3 = _revertConfig;
    }
    var prevIsReverting = _reverting;
    _reverting = config3;
    if (_isRevertWorthy(this)) {
      this.timeline && this.timeline.revert(config3);
      this.totalTime(-0.01, config3.suppressEvents);
    }
    this.data !== "nested" && config3.kill !== false && this.kill();
    _reverting = prevIsReverting;
    return this;
  };
  _proto.globalTime = function globalTime(rawTime) {
    var animation = this, time = arguments.length ? rawTime : animation.rawTime();
    while (animation) {
      time = animation._start + time / (Math.abs(animation._ts) || 1);
      animation = animation._dp;
    }
    return !this.parent && this._sat ? this._sat.globalTime(rawTime) : time;
  };
  _proto.repeat = function repeat(value) {
    if (arguments.length) {
      this._repeat = value === Infinity ? -2 : value;
      return _onUpdateTotalDuration(this);
    }
    return this._repeat === -2 ? Infinity : this._repeat;
  };
  _proto.repeatDelay = function repeatDelay(value) {
    if (arguments.length) {
      var time = this._time;
      this._rDelay = value;
      _onUpdateTotalDuration(this);
      return time ? this.time(time) : this;
    }
    return this._rDelay;
  };
  _proto.yoyo = function yoyo(value) {
    if (arguments.length) {
      this._yoyo = value;
      return this;
    }
    return this._yoyo;
  };
  _proto.seek = function seek(position, suppressEvents) {
    return this.totalTime(_parsePosition(this, position), _isNotFalse(suppressEvents));
  };
  _proto.restart = function restart(includeDelay, suppressEvents) {
    this.play().totalTime(includeDelay ? -this._delay : 0, _isNotFalse(suppressEvents));
    this._dur || (this._zTime = -_tinyNum);
    return this;
  };
  _proto.play = function play(from, suppressEvents) {
    from != null && this.seek(from, suppressEvents);
    return this.reversed(false).paused(false);
  };
  _proto.reverse = function reverse(from, suppressEvents) {
    from != null && this.seek(from || this.totalDuration(), suppressEvents);
    return this.reversed(true).paused(false);
  };
  _proto.pause = function pause(atTime, suppressEvents) {
    atTime != null && this.seek(atTime, suppressEvents);
    return this.paused(true);
  };
  _proto.resume = function resume() {
    return this.paused(false);
  };
  _proto.reversed = function reversed(value) {
    if (arguments.length) {
      !!value !== this.reversed() && this.timeScale(-this._rts || (value ? -_tinyNum : 0));
      return this;
    }
    return this._rts < 0;
  };
  _proto.invalidate = function invalidate() {
    this._initted = this._act = 0;
    this._zTime = -_tinyNum;
    return this;
  };
  _proto.isActive = function isActive() {
    var parent = this.parent || this._dp, start = this._start, rawTime;
    return !!(!parent || this._ts && this._initted && parent.isActive() && (rawTime = parent.rawTime(true)) >= start && rawTime < this.endTime(true) - _tinyNum);
  };
  _proto.eventCallback = function eventCallback(type, callback, params) {
    var vars = this.vars;
    if (arguments.length > 1) {
      if (!callback) {
        delete vars[type];
      } else {
        vars[type] = callback;
        params && (vars[type + "Params"] = params);
        type === "onUpdate" && (this._onUpdate = callback);
      }
      return this;
    }
    return vars[type];
  };
  _proto.then = function then(onFulfilled) {
    var self = this, prevProm = self._prom;
    return new Promise(function(resolve) {
      var f2 = _isFunction(onFulfilled) ? onFulfilled : _passThrough, _resolve = function _resolve2() {
        var _then = self.then;
        self.then = null;
        prevProm && prevProm();
        _isFunction(f2) && (f2 = f2(self)) && (f2.then || f2 === self) && (self.then = _then);
        resolve(f2);
        self.then = _then;
      };
      if (self._initted && self.totalProgress() === 1 && self._ts >= 0 || !self._tTime && self._ts < 0) {
        _resolve();
      } else {
        self._prom = _resolve;
      }
    });
  };
  _proto.kill = function kill() {
    _interrupt(this);
  };
  return Animation2;
})();
_setDefaults(Animation.prototype, {
  _time: 0,
  _start: 0,
  _end: 0,
  _tTime: 0,
  _tDur: 0,
  _dirty: 0,
  _repeat: 0,
  _yoyo: false,
  parent: null,
  _initted: false,
  _rDelay: 0,
  _ts: 1,
  _dp: 0,
  ratio: 0,
  _zTime: -_tinyNum,
  _prom: 0,
  _ps: false,
  _rts: 1
});
var Timeline = /* @__PURE__ */ (function(_Animation) {
  _inheritsLoose(Timeline2, _Animation);
  function Timeline2(vars, position) {
    var _this;
    if (vars === void 0) {
      vars = {};
    }
    _this = _Animation.call(this, vars) || this;
    _this.labels = {};
    _this.smoothChildTiming = !!vars.smoothChildTiming;
    _this.autoRemoveChildren = !!vars.autoRemoveChildren;
    _this._sort = _isNotFalse(vars.sortChildren);
    _globalTimeline && _addToTimeline(vars.parent || _globalTimeline, _assertThisInitialized(_this), position);
    vars.reversed && _this.reverse();
    vars.paused && _this.paused(true);
    vars.scrollTrigger && _scrollTrigger(_assertThisInitialized(_this), vars.scrollTrigger);
    return _this;
  }
  var _proto2 = Timeline2.prototype;
  _proto2.to = function to2(targets, vars, position) {
    _createTweenType(0, arguments, this);
    return this;
  };
  _proto2.from = function from(targets, vars, position) {
    _createTweenType(1, arguments, this);
    return this;
  };
  _proto2.fromTo = function fromTo(targets, fromVars, toVars, position) {
    _createTweenType(2, arguments, this);
    return this;
  };
  _proto2.set = function set(targets, vars, position) {
    vars.duration = 0;
    vars.parent = this;
    _inheritDefaults(vars).repeatDelay || (vars.repeat = 0);
    vars.immediateRender = !!vars.immediateRender;
    new Tween(targets, vars, _parsePosition(this, position), 1);
    return this;
  };
  _proto2.call = function call(callback, params, position) {
    return _addToTimeline(this, Tween.delayedCall(0, callback, params), position);
  };
  _proto2.staggerTo = function staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
    vars.duration = duration;
    vars.stagger = vars.stagger || stagger;
    vars.onComplete = onCompleteAll;
    vars.onCompleteParams = onCompleteAllParams;
    vars.parent = this;
    new Tween(targets, vars, _parsePosition(this, position));
    return this;
  };
  _proto2.staggerFrom = function staggerFrom(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
    vars.runBackwards = 1;
    _inheritDefaults(vars).immediateRender = _isNotFalse(vars.immediateRender);
    return this.staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams);
  };
  _proto2.staggerFromTo = function staggerFromTo(targets, duration, fromVars, toVars, stagger, position, onCompleteAll, onCompleteAllParams) {
    toVars.startAt = fromVars;
    _inheritDefaults(toVars).immediateRender = _isNotFalse(toVars.immediateRender);
    return this.staggerTo(targets, duration, toVars, stagger, position, onCompleteAll, onCompleteAllParams);
  };
  _proto2.render = function render3(totalTime, suppressEvents, force) {
    var prevTime = this._time, tDur = this._dirty ? this.totalDuration() : this._tDur, dur = this._dur, tTime = totalTime <= 0 ? 0 : _roundPrecise(totalTime), crossingStart = this._zTime < 0 !== totalTime < 0 && (this._initted || !dur), time, child, next, iteration, cycleDuration, prevPaused, pauseTween, timeScale, prevStart, prevIteration, yoyo, isYoyo;
    this !== _globalTimeline && tTime > tDur && totalTime >= 0 && (tTime = tDur);
    if (tTime !== this._tTime || force || crossingStart) {
      if (prevTime !== this._time && dur) {
        tTime += this._time - prevTime;
        totalTime += this._time - prevTime;
      }
      time = tTime;
      prevStart = this._start;
      timeScale = this._ts;
      prevPaused = !timeScale;
      if (crossingStart) {
        dur || (prevTime = this._zTime);
        (totalTime || !suppressEvents) && (this._zTime = totalTime);
      }
      if (this._repeat) {
        yoyo = this._yoyo;
        cycleDuration = dur + this._rDelay;
        if (this._repeat < -1 && totalTime < 0) {
          return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
        }
        time = _roundPrecise(tTime % cycleDuration);
        if (tTime === tDur) {
          iteration = this._repeat;
          time = dur;
        } else {
          prevIteration = _roundPrecise(tTime / cycleDuration);
          iteration = ~~prevIteration;
          if (iteration && iteration === prevIteration) {
            time = dur;
            iteration--;
          }
          time > dur && (time = dur);
        }
        prevIteration = _animationCycle(this._tTime, cycleDuration);
        !prevTime && this._tTime && prevIteration !== iteration && this._tTime - prevIteration * cycleDuration - this._dur <= 0 && (prevIteration = iteration);
        if (yoyo && iteration & 1) {
          time = dur - time;
          isYoyo = 1;
        }
        if (iteration !== prevIteration && !this._lock) {
          var rewinding = yoyo && prevIteration & 1, doesWrap = rewinding === (yoyo && iteration & 1);
          iteration < prevIteration && (rewinding = !rewinding);
          prevTime = rewinding ? 0 : tTime % dur ? dur : tTime;
          this._lock = 1;
          this.render(prevTime || (isYoyo ? 0 : _roundPrecise(iteration * cycleDuration)), suppressEvents, !dur)._lock = 0;
          this._tTime = tTime;
          !suppressEvents && this.parent && _callback(this, "onRepeat");
          if (this.vars.repeatRefresh && !isYoyo) {
            this.invalidate()._lock = 1;
            prevIteration = iteration;
          }
          if (prevTime && prevTime !== this._time || prevPaused !== !this._ts || this.vars.onRepeat && !this.parent && !this._act) {
            return this;
          }
          dur = this._dur;
          tDur = this._tDur;
          if (doesWrap) {
            this._lock = 2;
            prevTime = rewinding ? dur : -1e-4;
            this.render(prevTime, true);
            this.vars.repeatRefresh && !isYoyo && this.invalidate();
          }
          this._lock = 0;
          if (!this._ts && !prevPaused) {
            return this;
          }
        }
      }
      if (this._hasPause && !this._forcing && this._lock < 2) {
        pauseTween = _findNextPauseTween(this, _roundPrecise(prevTime), _roundPrecise(time));
        if (pauseTween) {
          tTime -= time - (time = pauseTween._start);
        }
      }
      this._tTime = tTime;
      this._time = time;
      this._act = !!timeScale;
      if (!this._initted) {
        this._onUpdate = this.vars.onUpdate;
        this._initted = 1;
        this._zTime = totalTime;
        prevTime = 0;
      }
      if (!prevTime && tTime && dur && !suppressEvents && !prevIteration) {
        _callback(this, "onStart");
        if (this._tTime !== tTime) {
          return this;
        }
      }
      if (time >= prevTime && totalTime >= 0) {
        child = this._first;
        while (child) {
          next = child._next;
          if ((child._act || time >= child._start) && child._ts && pauseTween !== child) {
            if (child.parent !== this) {
              return this.render(totalTime, suppressEvents, force);
            }
            child.render(child._ts > 0 ? (time - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (time - child._start) * child._ts, suppressEvents, force);
            if (time !== this._time || !this._ts && !prevPaused) {
              pauseTween = 0;
              next && (tTime += this._zTime = -_tinyNum);
              break;
            }
          }
          child = next;
        }
      } else {
        child = this._last;
        var adjustedTime = totalTime < 0 ? totalTime : time;
        while (child) {
          next = child._prev;
          if ((child._act || adjustedTime <= child._end) && child._ts && pauseTween !== child) {
            if (child.parent !== this) {
              return this.render(totalTime, suppressEvents, force);
            }
            child.render(child._ts > 0 ? (adjustedTime - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (adjustedTime - child._start) * child._ts, suppressEvents, force || _reverting && _isRevertWorthy(child));
            if (time !== this._time || !this._ts && !prevPaused) {
              pauseTween = 0;
              next && (tTime += this._zTime = adjustedTime ? -_tinyNum : _tinyNum);
              break;
            }
          }
          child = next;
        }
      }
      if (pauseTween && !suppressEvents) {
        this.pause();
        pauseTween.render(time >= prevTime ? 0 : -_tinyNum)._zTime = time >= prevTime ? 1 : -1;
        if (this._ts) {
          this._start = prevStart;
          _setEnd(this);
          return this.render(totalTime, suppressEvents, force);
        }
      }
      this._onUpdate && !suppressEvents && _callback(this, "onUpdate", true);
      if (tTime === tDur && this._tTime >= this.totalDuration() || !tTime && prevTime) {
        if (prevStart === this._start || Math.abs(timeScale) !== Math.abs(this._ts)) {
          if (!this._lock) {
            (totalTime || !dur) && (tTime === tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);
            if (!suppressEvents && !(totalTime < 0 && !prevTime) && (tTime || prevTime || !tDur)) {
              _callback(this, tTime === tDur && totalTime >= 0 ? "onComplete" : "onReverseComplete", true);
              this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
            }
          }
        }
      }
    }
    return this;
  };
  _proto2.add = function add(child, position) {
    var _this2 = this;
    _isNumber(position) || (position = _parsePosition(this, position, child));
    if (!(child instanceof Animation)) {
      if (_isArray(child)) {
        child.forEach(function(obj) {
          return _this2.add(obj, position);
        });
        return this;
      }
      if (_isString(child)) {
        return this.addLabel(child, position);
      }
      if (_isFunction(child)) {
        child = Tween.delayedCall(0, child);
      } else {
        return this;
      }
    }
    return this !== child ? _addToTimeline(this, child, position) : this;
  };
  _proto2.getChildren = function getChildren(nested, tweens, timelines, ignoreBeforeTime) {
    if (nested === void 0) {
      nested = true;
    }
    if (tweens === void 0) {
      tweens = true;
    }
    if (timelines === void 0) {
      timelines = true;
    }
    if (ignoreBeforeTime === void 0) {
      ignoreBeforeTime = -_bigNum;
    }
    var a = [], child = this._first;
    while (child) {
      if (child._start >= ignoreBeforeTime) {
        if (child instanceof Tween) {
          tweens && a.push(child);
        } else {
          timelines && a.push(child);
          nested && a.push.apply(a, child.getChildren(true, tweens, timelines));
        }
      }
      child = child._next;
    }
    return a;
  };
  _proto2.getById = function getById2(id) {
    var animations = this.getChildren(1, 1, 1), i2 = animations.length;
    while (i2--) {
      if (animations[i2].vars.id === id) {
        return animations[i2];
      }
    }
  };
  _proto2.remove = function remove(child) {
    if (_isString(child)) {
      return this.removeLabel(child);
    }
    if (_isFunction(child)) {
      return this.killTweensOf(child);
    }
    child.parent === this && _removeLinkedListItem(this, child);
    if (child === this._recent) {
      this._recent = this._last;
    }
    return _uncache(this);
  };
  _proto2.totalTime = function totalTime(_totalTime2, suppressEvents) {
    if (!arguments.length) {
      return this._tTime;
    }
    this._forcing = 1;
    if (!this._dp && this._ts) {
      this._start = _roundPrecise(_ticker.time - (this._ts > 0 ? _totalTime2 / this._ts : (this.totalDuration() - _totalTime2) / -this._ts));
    }
    _Animation.prototype.totalTime.call(this, _totalTime2, suppressEvents);
    this._forcing = 0;
    return this;
  };
  _proto2.addLabel = function addLabel(label, position) {
    this.labels[label] = _parsePosition(this, position);
    return this;
  };
  _proto2.removeLabel = function removeLabel(label) {
    delete this.labels[label];
    return this;
  };
  _proto2.addPause = function addPause(position, callback, params) {
    var t2 = Tween.delayedCall(0, callback || _emptyFunc, params);
    t2.data = "isPause";
    this._hasPause = 1;
    return _addToTimeline(this, t2, _parsePosition(this, position));
  };
  _proto2.removePause = function removePause(position) {
    var child = this._first;
    position = _parsePosition(this, position);
    while (child) {
      if (child._start === position && child.data === "isPause") {
        _removeFromParent(child);
      }
      child = child._next;
    }
  };
  _proto2.killTweensOf = function killTweensOf(targets, props, onlyActive) {
    var tweens = this.getTweensOf(targets, onlyActive), i2 = tweens.length;
    while (i2--) {
      _overwritingTween !== tweens[i2] && tweens[i2].kill(targets, props);
    }
    return this;
  };
  _proto2.getTweensOf = function getTweensOf2(targets, onlyActive) {
    var a = [], parsedTargets = toArray(targets), child = this._first, isGlobalTime = _isNumber(onlyActive), children;
    while (child) {
      if (child instanceof Tween) {
        if (_arrayContainsAny(child._targets, parsedTargets) && (isGlobalTime ? (!_overwritingTween || child._initted && child._ts) && child.globalTime(0) <= onlyActive && child.globalTime(child.totalDuration()) > onlyActive : !onlyActive || child.isActive())) {
          a.push(child);
        }
      } else if ((children = child.getTweensOf(parsedTargets, onlyActive)).length) {
        a.push.apply(a, children);
      }
      child = child._next;
    }
    return a;
  };
  _proto2.tweenTo = function tweenTo(position, vars) {
    vars = vars || {};
    var tl2 = this, endTime = _parsePosition(tl2, position), _vars = vars, startAt = _vars.startAt, _onStart = _vars.onStart, onStartParams = _vars.onStartParams, immediateRender = _vars.immediateRender, initted, tween = Tween.to(tl2, _setDefaults({
      ease: vars.ease || "none",
      lazy: false,
      immediateRender: false,
      time: endTime,
      overwrite: "auto",
      duration: vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl2._time)) / tl2.timeScale()) || _tinyNum,
      onStart: function onStart() {
        tl2.pause();
        if (!initted) {
          var duration = vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl2._time)) / tl2.timeScale());
          tween._dur !== duration && _setDuration(tween, duration, 0, 1).render(tween._time, true, true);
          initted = 1;
        }
        _onStart && _onStart.apply(tween, onStartParams || []);
      }
    }, vars));
    return immediateRender ? tween.render(0) : tween;
  };
  _proto2.tweenFromTo = function tweenFromTo(fromPosition, toPosition, vars) {
    return this.tweenTo(toPosition, _setDefaults({
      startAt: {
        time: _parsePosition(this, fromPosition)
      }
    }, vars));
  };
  _proto2.recent = function recent() {
    return this._recent;
  };
  _proto2.nextLabel = function nextLabel(afterTime) {
    if (afterTime === void 0) {
      afterTime = this._time;
    }
    return _getLabelInDirection(this, _parsePosition(this, afterTime));
  };
  _proto2.previousLabel = function previousLabel(beforeTime) {
    if (beforeTime === void 0) {
      beforeTime = this._time;
    }
    return _getLabelInDirection(this, _parsePosition(this, beforeTime), 1);
  };
  _proto2.currentLabel = function currentLabel(value) {
    return arguments.length ? this.seek(value, true) : this.previousLabel(this._time + _tinyNum);
  };
  _proto2.shiftChildren = function shiftChildren(amount, adjustLabels, ignoreBeforeTime) {
    if (ignoreBeforeTime === void 0) {
      ignoreBeforeTime = 0;
    }
    var child = this._first, labels = this.labels, p2;
    amount = _roundPrecise(amount);
    while (child) {
      if (child._start >= ignoreBeforeTime) {
        child._start += amount;
        child._end += amount;
      }
      child = child._next;
    }
    if (adjustLabels) {
      for (p2 in labels) {
        if (labels[p2] >= ignoreBeforeTime) {
          labels[p2] += amount;
        }
      }
    }
    return _uncache(this);
  };
  _proto2.invalidate = function invalidate(soft) {
    var child = this._first;
    this._lock = 0;
    while (child) {
      child.invalidate(soft);
      child = child._next;
    }
    return _Animation.prototype.invalidate.call(this, soft);
  };
  _proto2.clear = function clear(includeLabels) {
    if (includeLabels === void 0) {
      includeLabels = true;
    }
    var child = this._first, next;
    while (child) {
      next = child._next;
      this.remove(child);
      child = next;
    }
    this._dp && (this._time = this._tTime = this._pTime = 0);
    includeLabels && (this.labels = {});
    return _uncache(this);
  };
  _proto2.totalDuration = function totalDuration(value) {
    var max = 0, self = this, child = self._last, prevStart = _bigNum, prev, start, parent;
    if (arguments.length) {
      return self.timeScale((self._repeat < 0 ? self.duration() : self.totalDuration()) / (self.reversed() ? -value : value));
    }
    if (self._dirty) {
      parent = self.parent;
      while (child) {
        prev = child._prev;
        child._dirty && child.totalDuration();
        start = child._start;
        if (start > prevStart && self._sort && child._ts && !self._lock) {
          self._lock = 1;
          _addToTimeline(self, child, start - child._delay, 1)._lock = 0;
        } else {
          prevStart = start;
        }
        if (start < 0 && child._ts) {
          max -= start;
          if (!parent && !self._dp || parent && parent.smoothChildTiming) {
            self._start += _roundPrecise(start / self._ts);
            self._time -= start;
            self._tTime -= start;
          }
          self.shiftChildren(-start, false, -Infinity);
          prevStart = 0;
        }
        child._end > max && child._ts && (max = child._end);
        child = prev;
      }
      _setDuration(self, self === _globalTimeline && self._time > max ? self._time : max, 1, 1);
      self._dirty = 0;
    }
    return self._tDur;
  };
  Timeline2.updateRoot = function updateRoot(time) {
    if (_globalTimeline._ts) {
      _lazySafeRender(_globalTimeline, _parentToChildTotalTime(time, _globalTimeline));
      _lastRenderedFrame = _ticker.frame;
    }
    if (_ticker.frame >= _nextGCFrame) {
      _nextGCFrame += _config.autoSleep || 120;
      var child = _globalTimeline._first;
      if (!child || !child._ts) {
        if (_config.autoSleep && _ticker._listeners.length < 2) {
          while (child && !child._ts) {
            child = child._next;
          }
          child || _ticker.sleep();
        }
      }
    }
  };
  return Timeline2;
})(Animation);
_setDefaults(Timeline.prototype, {
  _lock: 0,
  _hasPause: 0,
  _forcing: 0
});
var _addComplexStringPropTween = function _addComplexStringPropTween2(target, prop, start, end, setter, stringFilter, funcParam) {
  var pt4 = new PropTween(this._pt, target, prop, 0, 1, _renderComplexString, null, setter), index = 0, matchIndex = 0, result, startNums, color, endNum, chunk, startNum, hasRandom, a;
  pt4.b = start;
  pt4.e = end;
  start += "";
  end += "";
  if (hasRandom = ~end.indexOf("random(")) {
    end = _replaceRandom(end);
  }
  if (stringFilter) {
    a = [start, end];
    stringFilter(a, target, prop);
    start = a[0];
    end = a[1];
  }
  startNums = start.match(_complexStringNumExp) || [];
  while (result = _complexStringNumExp.exec(end)) {
    endNum = result[0];
    chunk = end.substring(index, result.index);
    if (color) {
      color = (color + 1) % 5;
    } else if (chunk.substr(-5) === "rgba(") {
      color = 1;
    }
    if (endNum !== startNums[matchIndex++]) {
      startNum = parseFloat(startNums[matchIndex - 1]) || 0;
      pt4._pt = {
        _next: pt4._pt,
        p: chunk || matchIndex === 1 ? chunk : ",",
        //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
        s: startNum,
        c: endNum.charAt(1) === "=" ? _parseRelative(startNum, endNum) - startNum : parseFloat(endNum) - startNum,
        m: color && color < 4 ? Math.round : 0
      };
      index = _complexStringNumExp.lastIndex;
    }
  }
  pt4.c = index < end.length ? end.substring(index, end.length) : "";
  pt4.fp = funcParam;
  if (_relExp.test(end) || hasRandom) {
    pt4.e = 0;
  }
  this._pt = pt4;
  return pt4;
};
var _addPropTween = function _addPropTween2(target, prop, start, end, index, targets, modifier, stringFilter, funcParam, optional) {
  _isFunction(end) && (end = end(index || 0, target, targets));
  var currentValue = target[prop], parsedStart = start !== "get" ? start : !_isFunction(currentValue) ? currentValue : funcParam ? target[prop.indexOf("set") || !_isFunction(target["get" + prop.substr(3)]) ? prop : "get" + prop.substr(3)](funcParam) : target[prop](), setter = !_isFunction(currentValue) ? _setterPlain : funcParam ? _setterFuncWithParam : _setterFunc, pt4;
  if (_isString(end)) {
    if (~end.indexOf("random(")) {
      end = _replaceRandom(end);
    }
    if (end.charAt(1) === "=") {
      pt4 = _parseRelative(parsedStart, end) + (getUnit(parsedStart) || 0);
      if (pt4 || pt4 === 0) {
        end = pt4;
      }
    }
  }
  if (!optional || parsedStart !== end || _forceAllPropTweens) {
    if (!isNaN(parsedStart * end) && end !== "") {
      pt4 = new PropTween(this._pt, target, prop, +parsedStart || 0, end - (parsedStart || 0), typeof currentValue === "boolean" ? _renderBoolean : _renderPlain, 0, setter);
      funcParam && (pt4.fp = funcParam);
      modifier && pt4.modifier(modifier, this, target);
      return this._pt = pt4;
    }
    !currentValue && !(prop in target) && _missingPlugin(prop, end);
    return _addComplexStringPropTween.call(this, target, prop, parsedStart, end, setter, stringFilter || _config.stringFilter, funcParam);
  }
};
var _processVars = function _processVars2(vars, index, target, targets, tween) {
  _isFunction(vars) && (vars = _parseFuncOrString(vars, tween, index, target, targets));
  if (!_isObject(vars) || vars.style && vars.nodeType || _isArray(vars) || _isTypedArray(vars)) {
    return _isString(vars) ? _parseFuncOrString(vars, tween, index, target, targets) : vars;
  }
  var copy = {}, p2;
  for (p2 in vars) {
    copy[p2] = _parseFuncOrString(vars[p2], tween, index, target, targets);
  }
  return copy;
};
var _checkPlugin = function _checkPlugin2(property, vars, tween, index, target, targets) {
  var plugin, pt4, ptLookup, i2;
  if (_plugins[property] && (plugin = new _plugins[property]()).init(target, plugin.rawVars ? vars[property] : _processVars(vars[property], index, target, targets, tween), tween, index, targets) !== false) {
    tween._pt = pt4 = new PropTween(tween._pt, target, property, 0, 1, plugin.render, plugin, 0, plugin.priority);
    if (tween !== _quickTween) {
      ptLookup = tween._ptLookup[tween._targets.indexOf(target)];
      i2 = plugin._props.length;
      while (i2--) {
        ptLookup[plugin._props[i2]] = pt4;
      }
    }
  }
  return plugin;
};
var _overwritingTween;
var _forceAllPropTweens;
var _initTween = function _initTween2(tween, time, tTime) {
  var vars = tween.vars, ease = vars.ease, startAt = vars.startAt, immediateRender = vars.immediateRender, lazy = vars.lazy, onUpdate = vars.onUpdate, runBackwards = vars.runBackwards, yoyoEase = vars.yoyoEase, keyframes = vars.keyframes, autoRevert = vars.autoRevert, dur = tween._dur, prevStartAt = tween._startAt, targets = tween._targets, parent = tween.parent, fullTargets = parent && parent.data === "nested" ? parent.vars.targets : targets, autoOverwrite = tween._overwrite === "auto" && !_suppressOverwrites, tl2 = tween.timeline, reverseEase = vars.easeReverse || yoyoEase, cleanVars, i2, p2, pt4, target, hasPriority, gsData, harness, plugin, ptLookup, index, harnessVars, overwritten;
  tl2 && (!keyframes || !ease) && (ease = "none");
  tween._ease = _parseEase(ease, _defaults.ease);
  tween._rEase = reverseEase && (_parseEase(reverseEase) || tween._ease);
  tween._from = !tl2 && !!vars.runBackwards;
  if (tween._from) tween.ratio = 1;
  if (!tl2 || keyframes && !vars.stagger) {
    harness = targets[0] ? _getCache(targets[0]).harness : 0;
    harnessVars = harness && vars[harness.prop];
    cleanVars = _copyExcluding(vars, _reservedProps);
    if (prevStartAt) {
      prevStartAt._zTime < 0 && prevStartAt.progress(1);
      time < 0 && runBackwards && immediateRender && !autoRevert ? prevStartAt.render(-1, true) : prevStartAt.revert(runBackwards && dur ? _revertConfigNoKill : _startAtRevertConfig);
      prevStartAt._lazy = 0;
    }
    if (startAt) {
      _removeFromParent(tween._startAt = Tween.set(targets, _setDefaults({
        data: "isStart",
        overwrite: false,
        parent,
        immediateRender: true,
        lazy: !prevStartAt && _isNotFalse(lazy),
        startAt: null,
        delay: 0,
        onUpdate: onUpdate && function() {
          return _callback(tween, "onUpdate");
        },
        stagger: 0
      }, startAt)));
      tween._startAt._dp = 0;
      tween._startAt._sat = tween;
      time < 0 && (_reverting || !immediateRender && !autoRevert) && tween._startAt.revert(_revertConfigNoKill);
      if (immediateRender) {
        if (dur && time <= 0 && tTime <= 0) {
          time && (tween._zTime = time);
          return;
        }
      }
    } else if (runBackwards && dur) {
      if (!prevStartAt) {
        time && (immediateRender = false);
        p2 = _setDefaults({
          overwrite: false,
          data: "isFromStart",
          //we tag the tween with as "isFromStart" so that if [inside a plugin] we need to only do something at the very END of a tween, we have a way of identifying this tween as merely the one that's setting the beginning values for a "from()" tween. For example, clearProps in CSSPlugin should only get applied at the very END of a tween and without this tag, from(...{height:100, clearProps:"height", delay:1}) would wipe the height at the beginning of the tween and after 1 second, it'd kick back in.
          lazy: immediateRender && !prevStartAt && _isNotFalse(lazy),
          immediateRender,
          //zero-duration tweens render immediately by default, but if we're not specifically instructed to render this tween immediately, we should skip this and merely _init() to record the starting values (rendering them immediately would push them to completion which is wasteful in that case - we'd have to render(-1) immediately after)
          stagger: 0,
          parent
          //ensures that nested tweens that had a stagger are handled properly, like gsap.from(".class", {y: gsap.utils.wrap([-100,100]), stagger: 0.5})
        }, cleanVars);
        harnessVars && (p2[harness.prop] = harnessVars);
        _removeFromParent(tween._startAt = Tween.set(targets, p2));
        tween._startAt._dp = 0;
        tween._startAt._sat = tween;
        time < 0 && (_reverting ? tween._startAt.revert(_revertConfigNoKill) : tween._startAt.render(-1, true));
        tween._zTime = time;
        if (!immediateRender) {
          _initTween2(tween._startAt, _tinyNum, _tinyNum);
        } else if (!time) {
          return;
        }
      }
    }
    tween._pt = tween._ptCache = 0;
    lazy = dur && _isNotFalse(lazy) || lazy && !dur;
    for (i2 = 0; i2 < targets.length; i2++) {
      target = targets[i2];
      gsData = target._gsap || _harness(targets)[i2]._gsap;
      tween._ptLookup[i2] = ptLookup = {};
      _lazyLookup[gsData.id] && _lazyTweens.length && _lazyRender();
      index = fullTargets === targets ? i2 : fullTargets.indexOf(target);
      if (harness && (plugin = new harness()).init(target, harnessVars || cleanVars, tween, index, fullTargets) !== false) {
        tween._pt = pt4 = new PropTween(tween._pt, target, plugin.name, 0, 1, plugin.render, plugin, 0, plugin.priority);
        plugin._props.forEach(function(name) {
          ptLookup[name] = pt4;
        });
        plugin.priority && (hasPriority = 1);
      }
      if (!harness || harnessVars) {
        for (p2 in cleanVars) {
          if (_plugins[p2] && (plugin = _checkPlugin(p2, cleanVars, tween, index, target, fullTargets))) {
            plugin.priority && (hasPriority = 1);
          } else {
            ptLookup[p2] = pt4 = _addPropTween.call(tween, target, p2, "get", cleanVars[p2], index, fullTargets, 0, vars.stringFilter);
          }
        }
      }
      tween._op && tween._op[i2] && tween.kill(target, tween._op[i2]);
      if (autoOverwrite && tween._pt) {
        _overwritingTween = tween;
        _globalTimeline.killTweensOf(target, ptLookup, tween.globalTime(time));
        overwritten = !tween.parent;
        _overwritingTween = 0;
      }
      tween._pt && lazy && (_lazyLookup[gsData.id] = 1);
    }
    hasPriority && _sortPropTweensByPriority(tween);
    tween._onInit && tween._onInit(tween);
  }
  tween._onUpdate = onUpdate;
  tween._initted = (!tween._op || tween._pt) && !overwritten;
  keyframes && time <= 0 && tl2.render(_bigNum, true, true);
};
var _updatePropTweens = function _updatePropTweens2(tween, property, value, start, startIsRelative, ratio, time, skipRecursion) {
  var ptCache = (tween._pt && tween._ptCache || (tween._ptCache = {}))[property], pt4, rootPT, lookup, i2;
  if (!ptCache) {
    ptCache = tween._ptCache[property] = [];
    lookup = tween._ptLookup;
    i2 = tween._targets.length;
    while (i2--) {
      pt4 = lookup[i2][property];
      if (pt4 && pt4.d && pt4.d._pt) {
        pt4 = pt4.d._pt;
        while (pt4 && pt4.p !== property && pt4.fp !== property) {
          pt4 = pt4._next;
        }
      }
      if (!pt4) {
        _forceAllPropTweens = 1;
        tween.vars[property] = "+=0";
        _initTween(tween, time);
        _forceAllPropTweens = 0;
        return skipRecursion ? _warn(property + " not eligible for reset. Try splitting into individual properties") : 1;
      }
      ptCache.push(pt4);
    }
  }
  i2 = ptCache.length;
  while (i2--) {
    rootPT = ptCache[i2];
    pt4 = rootPT._pt || rootPT;
    pt4.s = (start || start === 0) && !startIsRelative ? start : pt4.s + (start || 0) + ratio * pt4.c;
    pt4.c = value - pt4.s;
    rootPT.e && (rootPT.e = _round(value) + getUnit(rootPT.e));
    rootPT.b && (rootPT.b = pt4.s + getUnit(rootPT.b));
  }
};
var _addAliasesToVars = function _addAliasesToVars2(targets, vars) {
  var harness = targets[0] ? _getCache(targets[0]).harness : 0, propertyAliases = harness && harness.aliases, copy, p2, i2, aliases;
  if (!propertyAliases) {
    return vars;
  }
  copy = _merge({}, vars);
  for (p2 in propertyAliases) {
    if (p2 in copy) {
      aliases = propertyAliases[p2].split(",");
      i2 = aliases.length;
      while (i2--) {
        copy[aliases[i2]] = copy[p2];
      }
    }
  }
  return copy;
};
var _parseKeyframe = function _parseKeyframe2(prop, obj, allProps, easeEach) {
  var ease = obj.ease || easeEach || "power1.inOut", p2, a;
  if (_isArray(obj)) {
    a = allProps[prop] || (allProps[prop] = []);
    obj.forEach(function(value, i2) {
      return a.push({
        t: i2 / (obj.length - 1) * 100,
        v: value,
        e: ease
      });
    });
  } else {
    for (p2 in obj) {
      a = allProps[p2] || (allProps[p2] = []);
      p2 === "ease" || a.push({
        t: parseFloat(prop),
        v: obj[p2],
        e: ease
      });
    }
  }
};
var _parseFuncOrString = function _parseFuncOrString2(value, tween, i2, target, targets) {
  return _isFunction(value) ? value.call(tween, i2, target, targets) : _isString(value) && ~value.indexOf("random(") ? _replaceRandom(value) : value;
};
var _staggerTweenProps = _callbackNames + "repeat,repeatDelay,yoyo,repeatRefresh,yoyoEase,easeReverse,autoRevert";
var _staggerPropsToSkip = {};
_forEachName(_staggerTweenProps + ",id,stagger,delay,duration,paused,scrollTrigger", function(name) {
  return _staggerPropsToSkip[name] = 1;
});
var Tween = /* @__PURE__ */ (function(_Animation2) {
  _inheritsLoose(Tween2, _Animation2);
  function Tween2(targets, vars, position, skipInherit) {
    var _this3;
    if (typeof vars === "number") {
      position.duration = vars;
      vars = position;
      position = null;
    }
    _this3 = _Animation2.call(this, skipInherit ? vars : _inheritDefaults(vars)) || this;
    var _this3$vars = _this3.vars, duration = _this3$vars.duration, delay = _this3$vars.delay, immediateRender = _this3$vars.immediateRender, stagger = _this3$vars.stagger, overwrite = _this3$vars.overwrite, keyframes = _this3$vars.keyframes, defaults2 = _this3$vars.defaults, scrollTrigger = _this3$vars.scrollTrigger, parent = vars.parent || _globalTimeline, parsedTargets = (_isArray(targets) || _isTypedArray(targets) ? _isNumber(targets[0]) : "length" in vars) ? [targets] : toArray(targets), tl2, i2, copy, l2, p2, curTarget, staggerFunc, staggerVarsToMerge;
    _this3._targets = parsedTargets.length ? _harness(parsedTargets) : _warn("GSAP target " + targets + " not found. https://gsap.com", !_config.nullTargetWarn) || [];
    _this3._ptLookup = [];
    _this3._overwrite = overwrite;
    if (keyframes || stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
      vars = _this3.vars;
      var easeReverse = vars.easeReverse || vars.yoyoEase;
      tl2 = _this3.timeline = new Timeline({
        data: "nested",
        defaults: defaults2 || {},
        targets: parent && parent.data === "nested" ? parent.vars.targets : parsedTargets
      });
      tl2.kill();
      tl2.parent = tl2._dp = _assertThisInitialized(_this3);
      tl2._start = 0;
      if (stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
        l2 = parsedTargets.length;
        staggerFunc = stagger && distribute(stagger);
        if (_isObject(stagger)) {
          for (p2 in stagger) {
            if (~_staggerTweenProps.indexOf(p2)) {
              staggerVarsToMerge || (staggerVarsToMerge = {});
              staggerVarsToMerge[p2] = stagger[p2];
            }
          }
        }
        for (i2 = 0; i2 < l2; i2++) {
          copy = _copyExcluding(vars, _staggerPropsToSkip);
          copy.stagger = 0;
          easeReverse && (copy.easeReverse = easeReverse);
          staggerVarsToMerge && _merge(copy, staggerVarsToMerge);
          curTarget = parsedTargets[i2];
          copy.duration = +_parseFuncOrString(duration, _assertThisInitialized(_this3), i2, curTarget, parsedTargets);
          copy.delay = (+_parseFuncOrString(delay, _assertThisInitialized(_this3), i2, curTarget, parsedTargets) || 0) - _this3._delay;
          if (!stagger && l2 === 1 && copy.delay) {
            _this3._delay = delay = copy.delay;
            _this3._start += delay;
            copy.delay = 0;
          }
          tl2.to(curTarget, copy, staggerFunc ? staggerFunc(i2, curTarget, parsedTargets) : 0);
          tl2._ease = _easeMap.none;
        }
        tl2.duration() ? duration = delay = 0 : _this3.timeline = 0;
      } else if (keyframes) {
        _inheritDefaults(_setDefaults(tl2.vars.defaults, {
          ease: "none"
        }));
        tl2._ease = _parseEase(keyframes.ease || vars.ease || "none");
        var time = 0, a, kf, v2;
        if (_isArray(keyframes)) {
          keyframes.forEach(function(frame) {
            return tl2.to(parsedTargets, frame, ">");
          });
          tl2.duration();
        } else {
          copy = {};
          for (p2 in keyframes) {
            p2 === "ease" || p2 === "easeEach" || _parseKeyframe(p2, keyframes[p2], copy, keyframes.easeEach);
          }
          for (p2 in copy) {
            a = copy[p2].sort(function(a2, b2) {
              return a2.t - b2.t;
            });
            time = 0;
            for (i2 = 0; i2 < a.length; i2++) {
              kf = a[i2];
              v2 = {
                ease: kf.e,
                duration: (kf.t - (i2 ? a[i2 - 1].t : 0)) / 100 * duration
              };
              v2[p2] = kf.v;
              tl2.to(parsedTargets, v2, time);
              time += v2.duration;
            }
          }
          tl2.duration() < duration && tl2.to({}, {
            duration: duration - tl2.duration()
          });
        }
      }
      duration || _this3.duration(duration = tl2.duration());
    } else {
      _this3.timeline = 0;
    }
    if (overwrite === true && !_suppressOverwrites) {
      _overwritingTween = _assertThisInitialized(_this3);
      _globalTimeline.killTweensOf(parsedTargets);
      _overwritingTween = 0;
    }
    _addToTimeline(parent, _assertThisInitialized(_this3), position);
    vars.reversed && _this3.reverse();
    vars.paused && _this3.paused(true);
    if (immediateRender || !duration && !keyframes && _this3._start === _roundPrecise(parent._time) && _isNotFalse(immediateRender) && _hasNoPausedAncestors(_assertThisInitialized(_this3)) && parent.data !== "nested") {
      _this3._tTime = -_tinyNum;
      _this3.render(Math.max(0, -delay) || 0);
    }
    scrollTrigger && _scrollTrigger(_assertThisInitialized(_this3), scrollTrigger);
    return _this3;
  }
  var _proto3 = Tween2.prototype;
  _proto3.render = function render3(totalTime, suppressEvents, force) {
    var prevTime = this._time, tDur = this._tDur, dur = this._dur, isNegative = totalTime < 0, tTime = totalTime > tDur - _tinyNum && !isNegative ? tDur : totalTime < _tinyNum ? 0 : totalTime, time, pt4, iteration, cycleDuration, prevIteration, isYoyo, ratio, timeline2;
    if (!dur) {
      _renderZeroDurationTween(this, totalTime, suppressEvents, force);
    } else if (tTime !== this._tTime || !totalTime || force || !this._initted && this._tTime || this._startAt && this._zTime < 0 !== isNegative || this._lazy) {
      time = tTime;
      timeline2 = this.timeline;
      if (this._repeat) {
        cycleDuration = dur + this._rDelay;
        if (this._repeat < -1 && isNegative) {
          return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
        }
        time = _roundPrecise(tTime % cycleDuration);
        if (tTime === tDur) {
          iteration = this._repeat;
          time = dur;
        } else {
          prevIteration = _roundPrecise(tTime / cycleDuration);
          iteration = ~~prevIteration;
          if (iteration && iteration === prevIteration) {
            time = dur;
            iteration--;
          } else if (time > dur) {
            time = dur;
          }
        }
        isYoyo = this._yoyo && iteration & 1;
        if (isYoyo) time = dur - time;
        prevIteration = _animationCycle(this._tTime, cycleDuration);
        if (time === prevTime && !force && this._initted && iteration === prevIteration) {
          this._tTime = tTime;
          return this;
        }
        if (iteration !== prevIteration) {
          if (this.vars.repeatRefresh && !isYoyo && !this._lock && time !== cycleDuration && this._initted) {
            this._lock = force = 1;
            this.render(_roundPrecise(cycleDuration * iteration), true).invalidate()._lock = 0;
          }
        }
      }
      if (!this._initted) {
        if (_attemptInitTween(this, isNegative ? totalTime : time, force, suppressEvents, tTime)) {
          this._tTime = 0;
          return this;
        }
        if (prevTime !== this._time && !(force && this.vars.repeatRefresh && iteration !== prevIteration)) {
          return this;
        }
        if (dur !== this._dur) {
          return this.render(totalTime, suppressEvents, force);
        }
      }
      if (this._rEase) {
        var inv = time < prevTime;
        if (inv !== this._inv) {
          var segDur = inv ? prevTime : dur - prevTime;
          this._inv = inv;
          if (this._from) this.ratio = 1 - this.ratio;
          this._invRatio = this.ratio;
          this._invTime = prevTime;
          this._invRecip = segDur ? (inv ? -1 : 1) / segDur : 0;
          this._invScale = inv ? -this.ratio : 1 - this.ratio;
          this._invEase = inv ? this._rEase : this._ease;
        }
        this.ratio = ratio = this._invRatio + this._invScale * this._invEase((time - this._invTime) * this._invRecip);
      } else {
        this.ratio = ratio = this._ease(time / dur);
      }
      if (this._from) this.ratio = ratio = 1 - ratio;
      this._tTime = tTime;
      this._time = time;
      if (!this._act && this._ts) {
        this._act = 1;
        this._lazy = 0;
      }
      if (!prevTime && tTime && !suppressEvents && !prevIteration) {
        _callback(this, "onStart");
        if (this._tTime !== tTime) {
          return this;
        }
      }
      pt4 = this._pt;
      while (pt4) {
        pt4.r(ratio, pt4.d);
        pt4 = pt4._next;
      }
      timeline2 && timeline2.render(totalTime < 0 ? totalTime : timeline2._dur * timeline2._ease(time / this._dur), suppressEvents, force) || this._startAt && (this._zTime = totalTime);
      if (this._onUpdate && !suppressEvents) {
        isNegative && _rewindStartAt(this, totalTime, suppressEvents, force);
        _callback(this, "onUpdate");
      }
      this._repeat && iteration !== prevIteration && this.vars.onRepeat && !suppressEvents && this.parent && _callback(this, "onRepeat");
      if ((tTime === this._tDur || !tTime) && this._tTime === tTime) {
        isNegative && !this._onUpdate && _rewindStartAt(this, totalTime, true, true);
        (totalTime || !dur) && (tTime === this._tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);
        if (!suppressEvents && !(isNegative && !prevTime) && (tTime || prevTime || isYoyo)) {
          _callback(this, tTime === tDur ? "onComplete" : "onReverseComplete", true);
          this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
        }
      }
    }
    return this;
  };
  _proto3.targets = function targets() {
    return this._targets;
  };
  _proto3.invalidate = function invalidate(soft) {
    (!soft || !this.vars.runBackwards) && (this._startAt = 0);
    this._pt = this._op = this._onUpdate = this._lazy = this.ratio = 0;
    this._ptLookup = [];
    this.timeline && this.timeline.invalidate(soft);
    return _Animation2.prototype.invalidate.call(this, soft);
  };
  _proto3.resetTo = function resetTo(property, value, start, startIsRelative, skipRecursion) {
    _tickerActive || _ticker.wake();
    this._ts || this.play();
    var time = Math.min(this._dur, (this._dp._time - this._start) * this._ts), ratio;
    this._initted || _initTween(this, time);
    ratio = this._ease(time / this._dur);
    if (_updatePropTweens(this, property, value, start, startIsRelative, ratio, time, skipRecursion)) {
      return this.resetTo(property, value, start, startIsRelative, 1);
    }
    _alignPlayhead(this, 0);
    this.parent || _addLinkedListItem(this._dp, this, "_first", "_last", this._dp._sort ? "_start" : 0);
    return this.render(0);
  };
  _proto3.kill = function kill(targets, vars) {
    if (vars === void 0) {
      vars = "all";
    }
    if (!targets && (!vars || vars === "all")) {
      this._lazy = this._pt = 0;
      this.parent ? _interrupt(this) : this.scrollTrigger && this.scrollTrigger.kill(!!_reverting);
      return this;
    }
    if (this.timeline) {
      var tDur = this.timeline.totalDuration();
      this.timeline.killTweensOf(targets, vars, _overwritingTween && _overwritingTween.vars.overwrite !== true)._first || _interrupt(this);
      this.parent && tDur !== this.timeline.totalDuration() && _setDuration(this, this._dur * this.timeline._tDur / tDur, 0, 1);
      return this;
    }
    var parsedTargets = this._targets, killingTargets = targets ? toArray(targets) : parsedTargets, propTweenLookup = this._ptLookup, firstPT = this._pt, overwrittenProps, curLookup, curOverwriteProps, props, p2, pt4, i2;
    if ((!vars || vars === "all") && _arraysMatch(parsedTargets, killingTargets)) {
      vars === "all" && (this._pt = 0);
      return _interrupt(this);
    }
    overwrittenProps = this._op = this._op || [];
    if (vars !== "all") {
      if (_isString(vars)) {
        p2 = {};
        _forEachName(vars, function(name) {
          return p2[name] = 1;
        });
        vars = p2;
      }
      vars = _addAliasesToVars(parsedTargets, vars);
    }
    i2 = parsedTargets.length;
    while (i2--) {
      if (~killingTargets.indexOf(parsedTargets[i2])) {
        curLookup = propTweenLookup[i2];
        if (vars === "all") {
          overwrittenProps[i2] = vars;
          props = curLookup;
          curOverwriteProps = {};
        } else {
          curOverwriteProps = overwrittenProps[i2] = overwrittenProps[i2] || {};
          props = vars;
        }
        for (p2 in props) {
          pt4 = curLookup && curLookup[p2];
          if (pt4) {
            if (!("kill" in pt4.d) || pt4.d.kill(p2) === true) {
              _removeLinkedListItem(this, pt4, "_pt");
            }
            delete curLookup[p2];
          }
          if (curOverwriteProps !== "all") {
            curOverwriteProps[p2] = 1;
          }
        }
      }
    }
    this._initted && !this._pt && firstPT && _interrupt(this);
    return this;
  };
  Tween2.to = function to2(targets, vars) {
    return new Tween2(targets, vars, arguments[2]);
  };
  Tween2.from = function from(targets, vars) {
    return _createTweenType(1, arguments);
  };
  Tween2.delayedCall = function delayedCall(delay, callback, params, scope) {
    return new Tween2(callback, 0, {
      immediateRender: false,
      lazy: false,
      overwrite: false,
      delay,
      onComplete: callback,
      onReverseComplete: callback,
      onCompleteParams: params,
      onReverseCompleteParams: params,
      callbackScope: scope
    });
  };
  Tween2.fromTo = function fromTo(targets, fromVars, toVars) {
    return _createTweenType(2, arguments);
  };
  Tween2.set = function set(targets, vars) {
    vars.duration = 0;
    vars.repeatDelay || (vars.repeat = 0);
    return new Tween2(targets, vars);
  };
  Tween2.killTweensOf = function killTweensOf(targets, props, onlyActive) {
    return _globalTimeline.killTweensOf(targets, props, onlyActive);
  };
  return Tween2;
})(Animation);
_setDefaults(Tween.prototype, {
  _targets: [],
  _lazy: 0,
  _startAt: 0,
  _op: 0,
  _onInit: 0
});
_forEachName("staggerTo,staggerFrom,staggerFromTo", function(name) {
  Tween[name] = function() {
    var tl2 = new Timeline(), params = _slice.call(arguments, 0);
    params.splice(name === "staggerFromTo" ? 5 : 4, 0, 0);
    return tl2[name].apply(tl2, params);
  };
});
var _setterPlain = function _setterPlain2(target, property, value) {
  return target[property] = value;
};
var _setterFunc = function _setterFunc2(target, property, value) {
  return target[property](value);
};
var _setterFuncWithParam = function _setterFuncWithParam2(target, property, value, data) {
  return target[property](data.fp, value);
};
var _setterAttribute = function _setterAttribute2(target, property, value) {
  return target.setAttribute(property, value);
};
var _getSetter = function _getSetter2(target, property) {
  return _isFunction(target[property]) ? _setterFunc : _isUndefined(target[property]) && target.setAttribute ? _setterAttribute : _setterPlain;
};
var _renderPlain = function _renderPlain2(ratio, data) {
  return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 1e6) / 1e6, data);
};
var _renderBoolean = function _renderBoolean2(ratio, data) {
  return data.set(data.t, data.p, !!(data.s + data.c * ratio), data);
};
var _renderComplexString = function _renderComplexString2(ratio, data) {
  var pt4 = data._pt, s2 = "";
  if (!ratio && data.b) {
    s2 = data.b;
  } else if (ratio === 1 && data.e) {
    s2 = data.e;
  } else {
    while (pt4) {
      s2 = pt4.p + (pt4.m ? pt4.m(pt4.s + pt4.c * ratio) : Math.round((pt4.s + pt4.c * ratio) * 1e4) / 1e4) + s2;
      pt4 = pt4._next;
    }
    s2 += data.c;
  }
  data.set(data.t, data.p, s2, data);
};
var _renderPropTweens = function _renderPropTweens2(ratio, data) {
  var pt4 = data._pt;
  while (pt4) {
    pt4.r(ratio, pt4.d);
    pt4 = pt4._next;
  }
};
var _addPluginModifier = function _addPluginModifier2(modifier, tween, target, property) {
  var pt4 = this._pt, next;
  while (pt4) {
    next = pt4._next;
    pt4.p === property && pt4.modifier(modifier, tween, target);
    pt4 = next;
  }
};
var _killPropTweensOf = function _killPropTweensOf2(property) {
  var pt4 = this._pt, hasNonDependentRemaining, next;
  while (pt4) {
    next = pt4._next;
    if (pt4.p === property && !pt4.op || pt4.op === property) {
      _removeLinkedListItem(this, pt4, "_pt");
    } else if (!pt4.dep) {
      hasNonDependentRemaining = 1;
    }
    pt4 = next;
  }
  return !hasNonDependentRemaining;
};
var _setterWithModifier = function _setterWithModifier2(target, property, value, data) {
  data.mSet(target, property, data.m.call(data.tween, value, data.mt), data);
};
var _sortPropTweensByPriority = function _sortPropTweensByPriority2(parent) {
  var pt4 = parent._pt, next, pt22, first, last;
  while (pt4) {
    next = pt4._next;
    pt22 = first;
    while (pt22 && pt22.pr > pt4.pr) {
      pt22 = pt22._next;
    }
    if (pt4._prev = pt22 ? pt22._prev : last) {
      pt4._prev._next = pt4;
    } else {
      first = pt4;
    }
    if (pt4._next = pt22) {
      pt22._prev = pt4;
    } else {
      last = pt4;
    }
    pt4 = next;
  }
  parent._pt = first;
};
var PropTween = /* @__PURE__ */ (function() {
  function PropTween2(next, target, prop, start, change, renderer, data, setter, priority) {
    this.t = target;
    this.s = start;
    this.c = change;
    this.p = prop;
    this.r = renderer || _renderPlain;
    this.d = data || this;
    this.set = setter || _setterPlain;
    this.pr = priority || 0;
    this._next = next;
    if (next) {
      next._prev = this;
    }
  }
  var _proto4 = PropTween2.prototype;
  _proto4.modifier = function modifier(func, tween, target) {
    this.mSet = this.mSet || this.set;
    this.set = _setterWithModifier;
    this.m = func;
    this.mt = target;
    this.tween = tween;
  };
  return PropTween2;
})();
_forEachName(_callbackNames + "parent,duration,ease,delay,overwrite,runBackwards,startAt,yoyo,immediateRender,repeat,repeatDelay,data,paused,reversed,lazy,callbackScope,stringFilter,id,yoyoEase,stagger,inherit,repeatRefresh,keyframes,autoRevert,scrollTrigger,easeReverse", function(name) {
  return _reservedProps[name] = 1;
});
_globals.TweenMax = _globals.TweenLite = Tween;
_globals.TimelineLite = _globals.TimelineMax = Timeline;
_globalTimeline = new Timeline({
  sortChildren: false,
  defaults: _defaults,
  autoRemoveChildren: true,
  id: "root",
  smoothChildTiming: true
});
_config.stringFilter = _colorStringFilter;
var _media = [];
var _listeners = {};
var _emptyArray = [];
var _lastMediaTime = 0;
var _contextID = 0;
var _dispatch = function _dispatch2(type) {
  return (_listeners[type] || _emptyArray).map(function(f2) {
    return f2();
  });
};
var _onMediaChange = function _onMediaChange2() {
  var time = Date.now(), matches = [];
  if (time - _lastMediaTime > 2) {
    _dispatch("matchMediaInit");
    _media.forEach(function(c) {
      var queries = c.queries, conditions = c.conditions, match, p2, anyMatch, toggled;
      for (p2 in queries) {
        match = _win.matchMedia(queries[p2]).matches;
        match && (anyMatch = 1);
        if (match !== conditions[p2]) {
          conditions[p2] = match;
          toggled = 1;
        }
      }
      if (toggled) {
        c.revert();
        anyMatch && matches.push(c);
      }
    });
    _dispatch("matchMediaRevert");
    matches.forEach(function(c) {
      return c.onMatch(c, function(func) {
        return c.add(null, func);
      });
    });
    _lastMediaTime = time;
    _dispatch("matchMedia");
  }
};
var Context = /* @__PURE__ */ (function() {
  function Context2(func, scope) {
    this.selector = scope && selector(scope);
    this.data = [];
    this._r = [];
    this.isReverted = false;
    this.id = _contextID++;
    func && this.add(func);
  }
  var _proto5 = Context2.prototype;
  _proto5.add = function add(name, func, scope) {
    if (_isFunction(name)) {
      scope = func;
      func = name;
      name = _isFunction;
    }
    var self = this, f2 = function f3() {
      var prev = _context, prevSelector = self.selector, result;
      prev && prev !== self && prev.data.push(self);
      scope && (self.selector = selector(scope));
      _context = self;
      result = func.apply(self, arguments);
      _isFunction(result) && self._r.push(result);
      _context = prev;
      self.selector = prevSelector;
      self.isReverted = false;
      return result;
    };
    self.last = f2;
    return name === _isFunction ? f2(self, function(func2) {
      return self.add(null, func2);
    }) : name ? self[name] = f2 : f2;
  };
  _proto5.ignore = function ignore(func) {
    var prev = _context;
    _context = null;
    func(this);
    _context = prev;
  };
  _proto5.getTweens = function getTweens() {
    var a = [];
    this.data.forEach(function(e2) {
      return e2 instanceof Context2 ? a.push.apply(a, e2.getTweens()) : e2 instanceof Tween && !(e2.parent && e2.parent.data === "nested") && a.push(e2);
    });
    return a;
  };
  _proto5.clear = function clear() {
    this._r.length = this.data.length = 0;
  };
  _proto5.kill = function kill(revert, matchMedia2) {
    var _this4 = this;
    if (revert) {
      (function() {
        var tweens = _this4.getTweens(), i3 = _this4.data.length, t2;
        while (i3--) {
          t2 = _this4.data[i3];
          if (t2.data === "isFlip") {
            t2.revert();
            t2.getChildren(true, true, false).forEach(function(tween) {
              return tweens.splice(tweens.indexOf(tween), 1);
            });
          }
        }
        tweens.map(function(t3) {
          return {
            g: t3._dur || t3._delay || t3._sat && !t3._sat.vars.immediateRender ? t3.globalTime(0) : -Infinity,
            t: t3
          };
        }).sort(function(a, b2) {
          return b2.g - a.g || -Infinity;
        }).forEach(function(o2) {
          return o2.t.revert(revert);
        });
        i3 = _this4.data.length;
        while (i3--) {
          t2 = _this4.data[i3];
          if (t2 instanceof Timeline) {
            if (t2.data !== "nested") {
              t2.scrollTrigger && t2.scrollTrigger.revert();
              t2.kill();
            }
          } else {
            !(t2 instanceof Tween) && t2.revert && t2.revert(revert);
          }
        }
        _this4._r.forEach(function(f2) {
          return f2(revert, _this4);
        });
        _this4.isReverted = true;
      })();
    } else {
      this.data.forEach(function(e2) {
        return e2.kill && e2.kill();
      });
    }
    this.clear();
    if (matchMedia2) {
      var i2 = _media.length;
      while (i2--) {
        _media[i2].id === this.id && _media.splice(i2, 1);
      }
    }
  };
  _proto5.revert = function revert(config3) {
    this.kill(config3 || {});
  };
  return Context2;
})();
var MatchMedia = /* @__PURE__ */ (function() {
  function MatchMedia2(scope) {
    this.contexts = [];
    this.scope = scope;
    _context && _context.data.push(this);
  }
  var _proto6 = MatchMedia2.prototype;
  _proto6.add = function add(conditions, func, scope) {
    _isObject(conditions) || (conditions = {
      matches: conditions
    });
    var context3 = new Context(0, scope || this.scope), cond = context3.conditions = {}, mq, p2, active;
    _context && !context3.selector && (context3.selector = _context.selector);
    this.contexts.push(context3);
    func = context3.add("onMatch", func);
    context3.queries = conditions;
    for (p2 in conditions) {
      if (p2 === "all") {
        active = 1;
      } else {
        mq = _win.matchMedia(conditions[p2]);
        if (mq) {
          _media.indexOf(context3) < 0 && _media.push(context3);
          (cond[p2] = mq.matches) && (active = 1);
          mq.addListener ? mq.addListener(_onMediaChange) : mq.addEventListener("change", _onMediaChange);
        }
      }
    }
    active && func(context3, function(f2) {
      return context3.add(null, f2);
    });
    return this;
  };
  _proto6.revert = function revert(config3) {
    this.kill(config3 || {});
  };
  _proto6.kill = function kill(revert) {
    this.contexts.forEach(function(c) {
      return c.kill(revert, true);
    });
  };
  return MatchMedia2;
})();
var _gsap = {
  registerPlugin: function registerPlugin() {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }
    args.forEach(function(config3) {
      return _createPlugin(config3);
    });
  },
  timeline: function timeline(vars) {
    return new Timeline(vars);
  },
  getTweensOf: function getTweensOf(targets, onlyActive) {
    return _globalTimeline.getTweensOf(targets, onlyActive);
  },
  getProperty: function getProperty(target, property, unit, uncache) {
    _isString(target) && (target = toArray(target)[0]);
    var getter = _getCache(target || {}).get, format = unit ? _passThrough : _numericIfPossible;
    unit === "native" && (unit = "");
    return !target ? target : !property ? function(property2, unit2, uncache2) {
      return format((_plugins[property2] && _plugins[property2].get || getter)(target, property2, unit2, uncache2));
    } : format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
  },
  quickSetter: function quickSetter(target, property, unit) {
    target = toArray(target);
    if (target.length > 1) {
      var setters = target.map(function(t2) {
        return gsap.quickSetter(t2, property, unit);
      }), l2 = setters.length;
      return function(value) {
        var i2 = l2;
        while (i2--) {
          setters[i2](value);
        }
      };
    }
    target = target[0] || {};
    var Plugin = _plugins[property], cache = _getCache(target), p2 = cache.harness && (cache.harness.aliases || {})[property] || property, setter = Plugin ? function(value) {
      var p3 = new Plugin();
      _quickTween._pt = 0;
      p3.init(target, unit ? value + unit : value, _quickTween, 0, [target]);
      p3.render(1, p3);
      _quickTween._pt && _renderPropTweens(1, _quickTween);
    } : cache.set(target, p2);
    return Plugin ? setter : function(value) {
      return setter(target, p2, unit ? value + unit : value, cache, 1);
    };
  },
  quickTo: function quickTo(target, property, vars) {
    var _setDefaults22;
    var tween = gsap.to(target, _setDefaults((_setDefaults22 = {}, _setDefaults22[property] = "+=0.1", _setDefaults22.paused = true, _setDefaults22.stagger = 0, _setDefaults22), vars || {})), func = function func2(value, start, startIsRelative) {
      return tween.resetTo(property, value, start, startIsRelative);
    };
    func.tween = tween;
    return func;
  },
  isTweening: function isTweening(targets) {
    return _globalTimeline.getTweensOf(targets, true).length > 0;
  },
  defaults: function defaults(value) {
    value && value.ease && (value.ease = _parseEase(value.ease, _defaults.ease));
    return _mergeDeep(_defaults, value || {});
  },
  config: function config2(value) {
    return _mergeDeep(_config, value || {});
  },
  registerEffect: function registerEffect(_ref3) {
    var name = _ref3.name, effect = _ref3.effect, plugins = _ref3.plugins, defaults2 = _ref3.defaults, extendTimeline = _ref3.extendTimeline;
    (plugins || "").split(",").forEach(function(pluginName) {
      return pluginName && !_plugins[pluginName] && !_globals[pluginName] && _warn(name + " effect requires " + pluginName + " plugin.");
    });
    _effects[name] = function(targets, vars, tl2) {
      return effect(toArray(targets), _setDefaults(vars || {}, defaults2), tl2);
    };
    if (extendTimeline) {
      Timeline.prototype[name] = function(targets, vars, position) {
        return this.add(_effects[name](targets, _isObject(vars) ? vars : (position = vars) && {}, this), position);
      };
    }
  },
  registerEase: function registerEase(name, ease) {
    _easeMap[name] = _parseEase(ease);
  },
  parseEase: function parseEase(ease, defaultEase) {
    return arguments.length ? _parseEase(ease, defaultEase) : _easeMap;
  },
  getById: function getById(id) {
    return _globalTimeline.getById(id);
  },
  exportRoot: function exportRoot(vars, includeDelayedCalls) {
    if (vars === void 0) {
      vars = {};
    }
    var tl2 = new Timeline(vars), child, next;
    tl2.smoothChildTiming = _isNotFalse(vars.smoothChildTiming);
    _globalTimeline.remove(tl2);
    tl2._dp = 0;
    tl2._time = tl2._tTime = _globalTimeline._time;
    child = _globalTimeline._first;
    while (child) {
      next = child._next;
      if (includeDelayedCalls || !(!child._dur && child instanceof Tween && child.vars.onComplete === child._targets[0])) {
        _addToTimeline(tl2, child, child._start - child._delay);
      }
      child = next;
    }
    _addToTimeline(_globalTimeline, tl2, 0);
    return tl2;
  },
  context: function context(func, scope) {
    return func ? new Context(func, scope) : _context;
  },
  matchMedia: function matchMedia(scope) {
    return new MatchMedia(scope);
  },
  matchMediaRefresh: function matchMediaRefresh() {
    return _media.forEach(function(c) {
      var cond = c.conditions, found, p2;
      for (p2 in cond) {
        if (cond[p2]) {
          cond[p2] = false;
          found = 1;
        }
      }
      found && c.revert();
    }) || _onMediaChange();
  },
  addEventListener: function addEventListener(type, callback) {
    var a = _listeners[type] || (_listeners[type] = []);
    ~a.indexOf(callback) || a.push(callback);
  },
  removeEventListener: function removeEventListener(type, callback) {
    var a = _listeners[type], i2 = a && a.indexOf(callback);
    i2 >= 0 && a.splice(i2, 1);
  },
  utils: {
    wrap,
    wrapYoyo,
    distribute,
    random,
    snap,
    normalize,
    getUnit,
    clamp,
    splitColor,
    toArray,
    selector,
    mapRange,
    pipe,
    unitize,
    interpolate,
    shuffle
  },
  install: _install,
  effects: _effects,
  ticker: _ticker,
  updateRoot: Timeline.updateRoot,
  plugins: _plugins,
  globalTimeline: _globalTimeline,
  core: {
    PropTween,
    globals: _addGlobal,
    Tween,
    Timeline,
    Animation,
    getCache: _getCache,
    _removeLinkedListItem,
    reverting: function reverting() {
      return _reverting;
    },
    context: function context2(toAdd) {
      if (toAdd && _context) {
        _context.data.push(toAdd);
        toAdd._ctx = _context;
      }
      return _context;
    },
    suppressOverwrites: function suppressOverwrites(value) {
      return _suppressOverwrites = value;
    }
  }
};
_forEachName("to,from,fromTo,delayedCall,set,killTweensOf", function(name) {
  return _gsap[name] = Tween[name];
});
_ticker.add(Timeline.updateRoot);
_quickTween = _gsap.to({}, {
  duration: 0
});
var _getPluginPropTween = function _getPluginPropTween2(plugin, prop) {
  var pt4 = plugin._pt;
  while (pt4 && pt4.p !== prop && pt4.op !== prop && pt4.fp !== prop) {
    pt4 = pt4._next;
  }
  return pt4;
};
var _addModifiers = function _addModifiers2(tween, modifiers) {
  var targets = tween._targets, p2, i2, pt4;
  for (p2 in modifiers) {
    i2 = targets.length;
    while (i2--) {
      pt4 = tween._ptLookup[i2][p2];
      if (pt4 && (pt4 = pt4.d)) {
        if (pt4._pt) {
          pt4 = _getPluginPropTween(pt4, p2);
        }
        pt4 && pt4.modifier && pt4.modifier(modifiers[p2], tween, targets[i2], p2);
      }
    }
  }
};
var _buildModifierPlugin = function _buildModifierPlugin2(name, modifier) {
  return {
    name,
    headless: 1,
    rawVars: 1,
    //don't pre-process function-based values or "random()" strings.
    init: function init4(target, vars, tween) {
      tween._onInit = function(tween2) {
        var temp, p2;
        if (_isString(vars)) {
          temp = {};
          _forEachName(vars, function(name2) {
            return temp[name2] = 1;
          });
          vars = temp;
        }
        if (modifier) {
          temp = {};
          for (p2 in vars) {
            temp[p2] = modifier(vars[p2]);
          }
          vars = temp;
        }
        _addModifiers(tween2, vars);
      };
    }
  };
};
var gsap = _gsap.registerPlugin({
  name: "attr",
  init: function init(target, vars, tween, index, targets) {
    var p2, pt4, v2;
    this.tween = tween;
    for (p2 in vars) {
      v2 = target.getAttribute(p2) || "";
      pt4 = this.add(target, "setAttribute", (v2 || 0) + "", vars[p2], index, targets, 0, 0, p2);
      pt4.op = p2;
      pt4.b = v2;
      this._props.push(p2);
    }
  },
  render: function render(ratio, data) {
    var pt4 = data._pt;
    while (pt4) {
      _reverting ? pt4.set(pt4.t, pt4.p, pt4.b, pt4) : pt4.r(ratio, pt4.d);
      pt4 = pt4._next;
    }
  }
}, {
  name: "endArray",
  headless: 1,
  init: function init2(target, value) {
    var i2 = value.length;
    while (i2--) {
      this.add(target, i2, target[i2] || 0, value[i2], 0, 0, 0, 0, 0, 1);
    }
  }
}, _buildModifierPlugin("roundProps", _roundModifier), _buildModifierPlugin("modifiers"), _buildModifierPlugin("snap", snap)) || _gsap;
Tween.version = Timeline.version = gsap.version = "3.15.0";
_coreReady = 1;
_windowExists() && _wake();
var Power0 = _easeMap.Power0;
var Power1 = _easeMap.Power1;
var Power2 = _easeMap.Power2;
var Power3 = _easeMap.Power3;
var Power4 = _easeMap.Power4;
var Linear = _easeMap.Linear;
var Quad = _easeMap.Quad;
var Cubic = _easeMap.Cubic;
var Quart = _easeMap.Quart;
var Quint = _easeMap.Quint;
var Strong = _easeMap.Strong;
var Elastic = _easeMap.Elastic;
var Back = _easeMap.Back;
var SteppedEase = _easeMap.SteppedEase;
var Bounce = _easeMap.Bounce;
var Sine = _easeMap.Sine;
var Expo = _easeMap.Expo;
var Circ = _easeMap.Circ;

// node_modules/gsap/CSSPlugin.js
var _win2;
var _doc2;
var _docElement;
var _pluginInitted;
var _tempDiv;
var _tempDivStyler;
var _recentSetterPlugin;
var _reverting2;
var _windowExists3 = function _windowExists4() {
  return typeof window !== "undefined";
};
var _transformProps = {};
var _RAD2DEG = 180 / Math.PI;
var _DEG2RAD = Math.PI / 180;
var _atan2 = Math.atan2;
var _bigNum2 = 1e8;
var _capsExp = /([A-Z])/g;
var _horizontalExp = /(left|right|width|margin|padding|x)/i;
var _complexExp = /[\s,\(]\S/;
var _propertyAliases = {
  autoAlpha: "opacity,visibility",
  scale: "scaleX,scaleY",
  alpha: "opacity"
};
var _renderCSSProp = function _renderCSSProp2(ratio, data) {
  return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 1e4) / 1e4 + data.u, data);
};
var _renderPropWithEnd = function _renderPropWithEnd2(ratio, data) {
  return data.set(data.t, data.p, ratio === 1 ? data.e : Math.round((data.s + data.c * ratio) * 1e4) / 1e4 + data.u, data);
};
var _renderCSSPropWithBeginning = function _renderCSSPropWithBeginning2(ratio, data) {
  return data.set(data.t, data.p, ratio ? Math.round((data.s + data.c * ratio) * 1e4) / 1e4 + data.u : data.b, data);
};
var _renderCSSPropWithBeginningAndEnd = function _renderCSSPropWithBeginningAndEnd2(ratio, data) {
  return data.set(data.t, data.p, ratio === 1 ? data.e : ratio ? Math.round((data.s + data.c * ratio) * 1e4) / 1e4 + data.u : data.b, data);
};
var _renderRoundedCSSProp = function _renderRoundedCSSProp2(ratio, data) {
  var value = data.s + data.c * ratio;
  data.set(data.t, data.p, ~~(value + (value < 0 ? -0.5 : 0.5)) + data.u, data);
};
var _renderNonTweeningValue = function _renderNonTweeningValue2(ratio, data) {
  return data.set(data.t, data.p, ratio ? data.e : data.b, data);
};
var _renderNonTweeningValueOnlyAtEnd = function _renderNonTweeningValueOnlyAtEnd2(ratio, data) {
  return data.set(data.t, data.p, ratio !== 1 ? data.b : data.e, data);
};
var _setterCSSStyle = function _setterCSSStyle2(target, property, value) {
  return target.style[property] = value;
};
var _setterCSSProp = function _setterCSSProp2(target, property, value) {
  return target.style.setProperty(property, value);
};
var _setterTransform = function _setterTransform2(target, property, value) {
  return target._gsap[property] = value;
};
var _setterScale = function _setterScale2(target, property, value) {
  return target._gsap.scaleX = target._gsap.scaleY = value;
};
var _setterScaleWithRender = function _setterScaleWithRender2(target, property, value, data, ratio) {
  var cache = target._gsap;
  cache.scaleX = cache.scaleY = value;
  cache.renderTransform(ratio, cache);
};
var _setterTransformWithRender = function _setterTransformWithRender2(target, property, value, data, ratio) {
  var cache = target._gsap;
  cache[property] = value;
  cache.renderTransform(ratio, cache);
};
var _transformProp = "transform";
var _transformOriginProp = _transformProp + "Origin";
var _saveStyle = function _saveStyle2(property, isNotCSS) {
  var _this = this;
  var target = this.target, style = target.style, cache = target._gsap;
  if (property in _transformProps && style) {
    this.tfm = this.tfm || {};
    if (property !== "transform") {
      property = _propertyAliases[property] || property;
      ~property.indexOf(",") ? property.split(",").forEach(function(a) {
        return _this.tfm[a] = _get(target, a);
      }) : this.tfm[property] = cache.x ? cache[property] : _get(target, property);
      property === _transformOriginProp && (this.tfm.zOrigin = cache.zOrigin);
    } else {
      return _propertyAliases.transform.split(",").forEach(function(p2) {
        return _saveStyle2.call(_this, p2, isNotCSS);
      });
    }
    if (this.props.indexOf(_transformProp) >= 0) {
      return;
    }
    if (cache.svg) {
      this.svgo = target.getAttribute("data-svg-origin");
      this.props.push(_transformOriginProp, isNotCSS, "");
    }
    property = _transformProp;
  }
  (style || isNotCSS) && this.props.push(property, isNotCSS, style[property]);
};
var _removeIndependentTransforms = function _removeIndependentTransforms2(style) {
  if (style.translate) {
    style.removeProperty("translate");
    style.removeProperty("scale");
    style.removeProperty("rotate");
  }
};
var _revertStyle = function _revertStyle2() {
  var props = this.props, target = this.target, style = target.style, cache = target._gsap, i2, p2;
  for (i2 = 0; i2 < props.length; i2 += 3) {
    if (!props[i2 + 1]) {
      props[i2 + 2] ? style[props[i2]] = props[i2 + 2] : style.removeProperty(props[i2].substr(0, 2) === "--" ? props[i2] : props[i2].replace(_capsExp, "-$1").toLowerCase());
    } else if (props[i2 + 1] === 2) {
      target[props[i2]](props[i2 + 2]);
    } else {
      target[props[i2]] = props[i2 + 2];
    }
  }
  if (this.tfm) {
    for (p2 in this.tfm) {
      cache[p2] = this.tfm[p2];
    }
    if (cache.svg) {
      cache.renderTransform();
      target.setAttribute("data-svg-origin", this.svgo || "");
    }
    i2 = _reverting2();
    if ((!i2 || !i2.isStart) && !style[_transformProp]) {
      _removeIndependentTransforms(style);
      if (cache.zOrigin && style[_transformOriginProp]) {
        style[_transformOriginProp] += " " + cache.zOrigin + "px";
        cache.zOrigin = 0;
        cache.renderTransform();
      }
      cache.uncache = 1;
    }
  }
};
var _getStyleSaver = function _getStyleSaver2(target, properties) {
  var saver = {
    target,
    props: [],
    revert: _revertStyle,
    save: _saveStyle
  };
  target._gsap || gsap.core.getCache(target);
  properties && target.style && target.nodeType && properties.split(",").forEach(function(p2) {
    return saver.save(p2);
  });
  return saver;
};
var _supports3D;
var _createElement = function _createElement2(type, ns3) {
  var e2 = _doc2.createElementNS ? _doc2.createElementNS((ns3 || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), type) : _doc2.createElement(type);
  return e2 && e2.style ? e2 : _doc2.createElement(type);
};
var _getComputedProperty = function _getComputedProperty2(target, property, skipPrefixFallback) {
  var cs2 = getComputedStyle(target);
  return cs2[property] || cs2.getPropertyValue(property.replace(_capsExp, "-$1").toLowerCase()) || cs2.getPropertyValue(property) || !skipPrefixFallback && _getComputedProperty2(target, _checkPropPrefix(property) || property, 1) || "";
};
var _prefixes = "O,Moz,ms,Ms,Webkit".split(",");
var _checkPropPrefix = function _checkPropPrefix2(property, element, preferPrefix) {
  var e2 = element || _tempDiv, s2 = e2.style, i2 = 5;
  if (property in s2 && !preferPrefix) {
    return property;
  }
  property = property.charAt(0).toUpperCase() + property.substr(1);
  while (i2-- && !(_prefixes[i2] + property in s2)) {
  }
  return i2 < 0 ? null : (i2 === 3 ? "ms" : i2 >= 0 ? _prefixes[i2] : "") + property;
};
var _initCore = function _initCore2() {
  if (_windowExists3() && window.document) {
    _win2 = window;
    _doc2 = _win2.document;
    _docElement = _doc2.documentElement;
    _tempDiv = _createElement("div") || {
      style: {}
    };
    _tempDivStyler = _createElement("div");
    _transformProp = _checkPropPrefix(_transformProp);
    _transformOriginProp = _transformProp + "Origin";
    _tempDiv.style.cssText = "border-width:0;line-height:0;position:absolute;padding:0";
    _supports3D = !!_checkPropPrefix("perspective");
    _reverting2 = gsap.core.reverting;
    _pluginInitted = 1;
  }
};
var _getReparentedCloneBBox = function _getReparentedCloneBBox2(target) {
  var owner = target.ownerSVGElement, svg = _createElement("svg", owner && owner.getAttribute("xmlns") || "http://www.w3.org/2000/svg"), clone = target.cloneNode(true), bbox;
  clone.style.display = "block";
  svg.appendChild(clone);
  _docElement.appendChild(svg);
  try {
    bbox = clone.getBBox();
  } catch (e2) {
  }
  svg.removeChild(clone);
  _docElement.removeChild(svg);
  return bbox;
};
var _getAttributeFallbacks = function _getAttributeFallbacks2(target, attributesArray) {
  var i2 = attributesArray.length;
  while (i2--) {
    if (target.hasAttribute(attributesArray[i2])) {
      return target.getAttribute(attributesArray[i2]);
    }
  }
};
var _getBBox = function _getBBox2(target) {
  var bounds, cloned;
  try {
    bounds = target.getBBox();
  } catch (error) {
    bounds = _getReparentedCloneBBox(target);
    cloned = 1;
  }
  bounds && (bounds.width || bounds.height) || cloned || (bounds = _getReparentedCloneBBox(target));
  return bounds && !bounds.width && !bounds.x && !bounds.y ? {
    x: +_getAttributeFallbacks(target, ["x", "cx", "x1"]) || 0,
    y: +_getAttributeFallbacks(target, ["y", "cy", "y1"]) || 0,
    width: 0,
    height: 0
  } : bounds;
};
var _isSVG = function _isSVG2(e2) {
  return !!(e2.getCTM && (!e2.parentNode || e2.ownerSVGElement) && _getBBox(e2));
};
var _removeProperty = function _removeProperty2(target, property) {
  if (property) {
    var style = target.style, first2Chars;
    if (property in _transformProps && property !== _transformOriginProp) {
      property = _transformProp;
    }
    if (style.removeProperty) {
      first2Chars = property.substr(0, 2);
      if (first2Chars === "ms" || property.substr(0, 6) === "webkit") {
        property = "-" + property;
      }
      style.removeProperty(first2Chars === "--" ? property : property.replace(_capsExp, "-$1").toLowerCase());
    } else {
      style.removeAttribute(property);
    }
  }
};
var _addNonTweeningPT = function _addNonTweeningPT2(plugin, target, property, beginning, end, onlySetAtEnd) {
  var pt4 = new PropTween(plugin._pt, target, property, 0, 1, onlySetAtEnd ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue);
  plugin._pt = pt4;
  pt4.b = beginning;
  pt4.e = end;
  plugin._props.push(property);
  return pt4;
};
var _nonConvertibleUnits = {
  deg: 1,
  rad: 1,
  turn: 1
};
var _nonStandardLayouts = {
  grid: 1,
  flex: 1
};
var _convertToUnit = function _convertToUnit2(target, property, value, unit) {
  var curValue = parseFloat(value) || 0, curUnit = (value + "").trim().substr((curValue + "").length) || "px", style = _tempDiv.style, horizontal = _horizontalExp.test(property), isRootSVG = target.tagName.toLowerCase() === "svg", measureProperty = (isRootSVG ? "client" : "offset") + (horizontal ? "Width" : "Height"), amount = 100, toPixels = unit === "px", toPercent = unit === "%", px, parent, cache, isSVG;
  if (unit === curUnit || !curValue || _nonConvertibleUnits[unit] || _nonConvertibleUnits[curUnit]) {
    return curValue;
  }
  curUnit !== "px" && !toPixels && (curValue = _convertToUnit2(target, property, value, "px"));
  isSVG = target.getCTM && _isSVG(target);
  if ((toPercent || curUnit === "%") && (_transformProps[property] || ~property.indexOf("adius"))) {
    px = isSVG ? target.getBBox()[horizontal ? "width" : "height"] : target[measureProperty];
    return _round(toPercent ? curValue / px * amount : curValue / 100 * px);
  }
  style[horizontal ? "width" : "height"] = amount + (toPixels ? curUnit : unit);
  parent = unit !== "rem" && ~property.indexOf("adius") || unit === "em" && target.appendChild && !isRootSVG ? target : target.parentNode;
  if (isSVG) {
    parent = (target.ownerSVGElement || {}).parentNode;
  }
  if (!parent || parent === _doc2 || !parent.appendChild) {
    parent = _doc2.body;
  }
  cache = parent._gsap;
  if (cache && toPercent && cache.width && horizontal && cache.time === _ticker.time && !cache.uncache) {
    return _round(curValue / cache.width * amount);
  } else {
    if (toPercent && (property === "height" || property === "width")) {
      var v2 = target.style[property];
      target.style[property] = amount + unit;
      px = target[measureProperty];
      v2 ? target.style[property] = v2 : _removeProperty(target, property);
    } else {
      (toPercent || curUnit === "%") && !_nonStandardLayouts[_getComputedProperty(parent, "display")] && (style.position = _getComputedProperty(target, "position"));
      parent === target && (style.position = "static");
      parent.appendChild(_tempDiv);
      px = _tempDiv[measureProperty];
      parent.removeChild(_tempDiv);
      style.position = "absolute";
    }
    if (horizontal && toPercent) {
      cache = _getCache(parent);
      cache.time = _ticker.time;
      cache.width = parent[measureProperty];
    }
  }
  return _round(toPixels ? px * curValue / amount : px && curValue ? amount / px * curValue : 0);
};
var _get = function _get2(target, property, unit, uncache) {
  var value;
  _pluginInitted || _initCore();
  if (property in _propertyAliases && property !== "transform") {
    property = _propertyAliases[property];
    if (~property.indexOf(",")) {
      property = property.split(",")[0];
    }
  }
  if (_transformProps[property] && property !== "transform") {
    value = _parseTransform(target, uncache);
    value = property !== "transformOrigin" ? value[property] : value.svg ? value.origin : _firstTwoOnly(_getComputedProperty(target, _transformOriginProp)) + " " + value.zOrigin + "px";
  } else {
    value = target.style[property];
    if (!value || value === "auto" || uncache || ~(value + "").indexOf("calc(")) {
      value = _specialProps[property] && _specialProps[property](target, property, unit) || _getComputedProperty(target, property) || _getProperty(target, property) || (property === "opacity" ? 1 : 0);
    }
  }
  return unit && !~(value + "").trim().indexOf(" ") ? _convertToUnit(target, property, value, unit) + unit : value;
};
var _tweenComplexCSSString = function _tweenComplexCSSString2(target, prop, start, end) {
  if (!start || start === "none") {
    var p2 = _checkPropPrefix(prop, target, 1), s2 = p2 && _getComputedProperty(target, p2, 1);
    if (s2 && s2 !== start) {
      prop = p2;
      start = s2;
    } else if (prop === "borderColor") {
      start = _getComputedProperty(target, "borderTopColor");
    }
  }
  var pt4 = new PropTween(this._pt, target.style, prop, 0, 1, _renderComplexString), index = 0, matchIndex = 0, a, result, startValues, startNum, color, startValue, endValue, endNum, chunk, endUnit, startUnit, endValues;
  pt4.b = start;
  pt4.e = end;
  start += "";
  end += "";
  if (end.substring(0, 6) === "var(--") {
    end = _getComputedProperty(target, end.substring(4, end.indexOf(")")));
  }
  if (end === "auto") {
    startValue = target.style[prop];
    target.style[prop] = end;
    end = _getComputedProperty(target, prop) || end;
    startValue ? target.style[prop] = startValue : _removeProperty(target, prop);
  }
  a = [start, end];
  _colorStringFilter(a);
  start = a[0];
  end = a[1];
  startValues = start.match(_numWithUnitExp) || [];
  endValues = end.match(_numWithUnitExp) || [];
  if (endValues.length) {
    while (result = _numWithUnitExp.exec(end)) {
      endValue = result[0];
      chunk = end.substring(index, result.index);
      if (color) {
        color = (color + 1) % 5;
      } else if (chunk.substr(-5) === "rgba(" || chunk.substr(-5) === "hsla(") {
        color = 1;
      }
      if (endValue !== (startValue = startValues[matchIndex++] || "")) {
        startNum = parseFloat(startValue) || 0;
        startUnit = startValue.substr((startNum + "").length);
        endValue.charAt(1) === "=" && (endValue = _parseRelative(startNum, endValue) + startUnit);
        endNum = parseFloat(endValue);
        endUnit = endValue.substr((endNum + "").length);
        index = _numWithUnitExp.lastIndex - endUnit.length;
        if (!endUnit) {
          endUnit = endUnit || _config.units[prop] || startUnit;
          if (index === end.length) {
            end += endUnit;
            pt4.e += endUnit;
          }
        }
        if (startUnit !== endUnit) {
          startNum = _convertToUnit(target, prop, startValue, endUnit) || 0;
        }
        pt4._pt = {
          _next: pt4._pt,
          p: chunk || matchIndex === 1 ? chunk : ",",
          //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
          s: startNum,
          c: endNum - startNum,
          m: color && color < 4 || prop === "zIndex" ? Math.round : 0
        };
      }
    }
    pt4.c = index < end.length ? end.substring(index, end.length) : "";
  } else {
    pt4.r = prop === "display" && end === "none" ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue;
  }
  _relExp.test(end) && (pt4.e = 0);
  this._pt = pt4;
  return pt4;
};
var _keywordToPercent = {
  top: "0%",
  bottom: "100%",
  left: "0%",
  right: "100%",
  center: "50%"
};
var _convertKeywordsToPercentages = function _convertKeywordsToPercentages2(value) {
  var split = value.split(" "), x2 = split[0], y3 = split[1] || "50%";
  if (x2 === "top" || x2 === "bottom" || y3 === "left" || y3 === "right") {
    value = x2;
    x2 = y3;
    y3 = value;
  }
  split[0] = _keywordToPercent[x2] || x2;
  split[1] = _keywordToPercent[y3] || y3;
  return split.join(" ");
};
var _renderClearProps = function _renderClearProps2(ratio, data) {
  if (data.tween && data.tween._time === data.tween._dur) {
    var target = data.t, style = target.style, props = data.u, cache = target._gsap, prop, clearTransforms, i2;
    if (props === "all" || props === true) {
      style.cssText = "";
      clearTransforms = 1;
    } else {
      props = props.split(",");
      i2 = props.length;
      while (--i2 > -1) {
        prop = props[i2];
        if (_transformProps[prop]) {
          clearTransforms = 1;
          prop = prop === "transformOrigin" ? _transformOriginProp : _transformProp;
        }
        _removeProperty(target, prop);
      }
    }
    if (clearTransforms) {
      _removeProperty(target, _transformProp);
      if (cache) {
        cache.svg && target.removeAttribute("transform");
        style.scale = style.rotate = style.translate = "none";
        _parseTransform(target, 1);
        cache.uncache = 1;
        _removeIndependentTransforms(style);
      }
    }
  }
};
var _specialProps = {
  clearProps: function clearProps(plugin, target, property, endValue, tween) {
    if (tween.data !== "isFromStart") {
      var pt4 = plugin._pt = new PropTween(plugin._pt, target, property, 0, 0, _renderClearProps);
      pt4.u = endValue;
      pt4.pr = -10;
      pt4.tween = tween;
      plugin._props.push(property);
      return 1;
    }
  }
  /* className feature (about 0.4kb gzipped).
  , className(plugin, target, property, endValue, tween) {
  	let _renderClassName = (ratio, data) => {
  			data.css.render(ratio, data.css);
  			if (!ratio || ratio === 1) {
  				let inline = data.rmv,
  					target = data.t,
  					p;
  				target.setAttribute("class", ratio ? data.e : data.b);
  				for (p in inline) {
  					_removeProperty(target, p);
  				}
  			}
  		},
  		_getAllStyles = (target) => {
  			let styles = {},
  				computed = getComputedStyle(target),
  				p;
  			for (p in computed) {
  				if (isNaN(p) && p !== "cssText" && p !== "length") {
  					styles[p] = computed[p];
  				}
  			}
  			_setDefaults(styles, _parseTransform(target, 1));
  			return styles;
  		},
  		startClassList = target.getAttribute("class"),
  		style = target.style,
  		cssText = style.cssText,
  		cache = target._gsap,
  		classPT = cache.classPT,
  		inlineToRemoveAtEnd = {},
  		data = {t:target, plugin:plugin, rmv:inlineToRemoveAtEnd, b:startClassList, e:(endValue.charAt(1) !== "=") ? endValue : startClassList.replace(new RegExp("(?:\\s|^)" + endValue.substr(2) + "(?![\\w-])"), "") + ((endValue.charAt(0) === "+") ? " " + endValue.substr(2) : "")},
  		changingVars = {},
  		startVars = _getAllStyles(target),
  		transformRelated = /(transform|perspective)/i,
  		endVars, p;
  	if (classPT) {
  		classPT.r(1, classPT.d);
  		_removeLinkedListItem(classPT.d.plugin, classPT, "_pt");
  	}
  	target.setAttribute("class", data.e);
  	endVars = _getAllStyles(target, true);
  	target.setAttribute("class", startClassList);
  	for (p in endVars) {
  		if (endVars[p] !== startVars[p] && !transformRelated.test(p)) {
  			changingVars[p] = endVars[p];
  			if (!style[p] && style[p] !== "0") {
  				inlineToRemoveAtEnd[p] = 1;
  			}
  		}
  	}
  	cache.classPT = plugin._pt = new PropTween(plugin._pt, target, "className", 0, 0, _renderClassName, data, 0, -11);
  	if (style.cssText !== cssText) { //only apply if things change. Otherwise, in cases like a background-image that's pulled dynamically, it could cause a refresh. See https://gsap.com/forums/topic/20368-possible-gsap-bug-switching-classnames-in-chrome/.
  		style.cssText = cssText; //we recorded cssText before we swapped classes and ran _getAllStyles() because in cases when a className tween is overwritten, we remove all the related tweening properties from that class change (otherwise class-specific stuff can't override properties we've directly set on the target's style object due to specificity).
  	}
  	_parseTransform(target, true); //to clear the caching of transforms
  	data.css = new gsap.plugins.css();
  	data.css.init(target, changingVars, tween);
  	plugin._props.push(...data.css._props);
  	return 1;
  }
  */
};
var _identity2DMatrix = [1, 0, 0, 1, 0, 0];
var _rotationalProperties = {};
var _isNullTransform = function _isNullTransform2(value) {
  return value === "matrix(1, 0, 0, 1, 0, 0)" || value === "none" || !value;
};
var _getComputedTransformMatrixAsArray = function _getComputedTransformMatrixAsArray2(target) {
  var matrixString = _getComputedProperty(target, _transformProp);
  return _isNullTransform(matrixString) ? _identity2DMatrix : matrixString.substr(7).match(_numExp).map(_round);
};
var _getMatrix = function _getMatrix2(target, force2D) {
  var cache = target._gsap || _getCache(target), style = target.style, matrix = _getComputedTransformMatrixAsArray(target), parent, nextSibling, temp, addedToDOM;
  if (cache.svg && target.getAttribute("transform")) {
    temp = target.transform.baseVal.consolidate().matrix;
    matrix = [temp.a, temp.b, temp.c, temp.d, temp.e, temp.f];
    return matrix.join(",") === "1,0,0,1,0,0" ? _identity2DMatrix : matrix;
  } else if (matrix === _identity2DMatrix && !target.offsetParent && target !== _docElement && !cache.svg) {
    temp = style.display;
    style.display = "block";
    parent = target.parentNode;
    if (!parent || !target.offsetParent && !target.getBoundingClientRect().width) {
      addedToDOM = 1;
      nextSibling = target.nextElementSibling;
      _docElement.appendChild(target);
    }
    matrix = _getComputedTransformMatrixAsArray(target);
    temp ? style.display = temp : _removeProperty(target, "display");
    if (addedToDOM) {
      nextSibling ? parent.insertBefore(target, nextSibling) : parent ? parent.appendChild(target) : _docElement.removeChild(target);
    }
  }
  return force2D && matrix.length > 6 ? [matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13]] : matrix;
};
var _applySVGOrigin = function _applySVGOrigin2(target, origin, originIsAbsolute, smooth, matrixArray, pluginToAddPropTweensTo) {
  var cache = target._gsap, matrix = matrixArray || _getMatrix(target, true), xOriginOld = cache.xOrigin || 0, yOriginOld = cache.yOrigin || 0, xOffsetOld = cache.xOffset || 0, yOffsetOld = cache.yOffset || 0, a = matrix[0], b2 = matrix[1], c = matrix[2], d2 = matrix[3], tx = matrix[4], ty = matrix[5], originSplit = origin.split(" "), xOrigin = parseFloat(originSplit[0]) || 0, yOrigin = parseFloat(originSplit[1]) || 0, bounds, determinant, x2, y3;
  if (!originIsAbsolute) {
    bounds = _getBBox(target);
    xOrigin = bounds.x + (~originSplit[0].indexOf("%") ? xOrigin / 100 * bounds.width : xOrigin);
    yOrigin = bounds.y + (~(originSplit[1] || originSplit[0]).indexOf("%") ? yOrigin / 100 * bounds.height : yOrigin);
  } else if (matrix !== _identity2DMatrix && (determinant = a * d2 - b2 * c)) {
    x2 = xOrigin * (d2 / determinant) + yOrigin * (-c / determinant) + (c * ty - d2 * tx) / determinant;
    y3 = xOrigin * (-b2 / determinant) + yOrigin * (a / determinant) - (a * ty - b2 * tx) / determinant;
    xOrigin = x2;
    yOrigin = y3;
  }
  if (smooth || smooth !== false && cache.smooth) {
    tx = xOrigin - xOriginOld;
    ty = yOrigin - yOriginOld;
    cache.xOffset = xOffsetOld + (tx * a + ty * c) - tx;
    cache.yOffset = yOffsetOld + (tx * b2 + ty * d2) - ty;
  } else {
    cache.xOffset = cache.yOffset = 0;
  }
  cache.xOrigin = xOrigin;
  cache.yOrigin = yOrigin;
  cache.smooth = !!smooth;
  cache.origin = origin;
  cache.originIsAbsolute = !!originIsAbsolute;
  target.style[_transformOriginProp] = "0px 0px";
  if (pluginToAddPropTweensTo) {
    _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOrigin", xOriginOld, xOrigin);
    _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOrigin", yOriginOld, yOrigin);
    _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOffset", xOffsetOld, cache.xOffset);
    _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOffset", yOffsetOld, cache.yOffset);
  }
  target.setAttribute("data-svg-origin", xOrigin + " " + yOrigin);
};
var _parseTransform = function _parseTransform2(target, uncache) {
  var cache = target._gsap || new GSCache(target);
  if ("x" in cache && !uncache && !cache.uncache) {
    return cache;
  }
  var style = target.style, invertedScaleX = cache.scaleX < 0, px = "px", deg = "deg", cs2 = getComputedStyle(target), origin = _getComputedProperty(target, _transformOriginProp) || "0", x2, y3, z3, scaleX, scaleY, rotation, rotationX, rotationY, skewX, skewY, perspective, xOrigin, yOrigin, matrix, angle, cos, sin, a, b2, c, d2, a12, a22, t12, t2, t3, a13, a23, a33, a42, a43, a32;
  x2 = y3 = z3 = rotation = rotationX = rotationY = skewX = skewY = perspective = 0;
  scaleX = scaleY = 1;
  cache.svg = !!(target.getCTM && _isSVG(target));
  if (cs2.translate) {
    if (cs2.translate !== "none" || cs2.scale !== "none" || cs2.rotate !== "none") {
      style[_transformProp] = (cs2.translate !== "none" ? "translate3d(" + (cs2.translate + " 0 0").split(" ").slice(0, 3).join(", ") + ") " : "") + (cs2.rotate !== "none" ? "rotate(" + cs2.rotate + ") " : "") + (cs2.scale !== "none" ? "scale(" + cs2.scale.split(" ").join(",") + ") " : "") + (cs2[_transformProp] !== "none" ? cs2[_transformProp] : "");
    }
    style.scale = style.rotate = style.translate = "none";
  }
  matrix = _getMatrix(target, cache.svg);
  if (cache.svg) {
    if (cache.uncache) {
      t2 = target.getBBox();
      origin = cache.xOrigin - t2.x + "px " + (cache.yOrigin - t2.y) + "px";
      t12 = "";
    } else {
      t12 = !uncache && target.getAttribute("data-svg-origin");
    }
    _applySVGOrigin(target, t12 || origin, !!t12 || cache.originIsAbsolute, cache.smooth !== false, matrix);
  }
  xOrigin = cache.xOrigin || 0;
  yOrigin = cache.yOrigin || 0;
  if (matrix !== _identity2DMatrix) {
    a = matrix[0];
    b2 = matrix[1];
    c = matrix[2];
    d2 = matrix[3];
    x2 = a12 = matrix[4];
    y3 = a22 = matrix[5];
    if (matrix.length === 6) {
      scaleX = Math.sqrt(a * a + b2 * b2);
      scaleY = Math.sqrt(d2 * d2 + c * c);
      rotation = a || b2 ? _atan2(b2, a) * _RAD2DEG : 0;
      skewX = c || d2 ? _atan2(c, d2) * _RAD2DEG + rotation : 0;
      skewX && (scaleY *= Math.abs(Math.cos(skewX * _DEG2RAD)));
      if (cache.svg) {
        x2 -= xOrigin - (xOrigin * a + yOrigin * c);
        y3 -= yOrigin - (xOrigin * b2 + yOrigin * d2);
      }
    } else {
      a32 = matrix[6];
      a42 = matrix[7];
      a13 = matrix[8];
      a23 = matrix[9];
      a33 = matrix[10];
      a43 = matrix[11];
      x2 = matrix[12];
      y3 = matrix[13];
      z3 = matrix[14];
      angle = _atan2(a32, a33);
      rotationX = angle * _RAD2DEG;
      if (angle) {
        cos = Math.cos(-angle);
        sin = Math.sin(-angle);
        t12 = a12 * cos + a13 * sin;
        t2 = a22 * cos + a23 * sin;
        t3 = a32 * cos + a33 * sin;
        a13 = a12 * -sin + a13 * cos;
        a23 = a22 * -sin + a23 * cos;
        a33 = a32 * -sin + a33 * cos;
        a43 = a42 * -sin + a43 * cos;
        a12 = t12;
        a22 = t2;
        a32 = t3;
      }
      angle = _atan2(-c, a33);
      rotationY = angle * _RAD2DEG;
      if (angle) {
        cos = Math.cos(-angle);
        sin = Math.sin(-angle);
        t12 = a * cos - a13 * sin;
        t2 = b2 * cos - a23 * sin;
        t3 = c * cos - a33 * sin;
        a43 = d2 * sin + a43 * cos;
        a = t12;
        b2 = t2;
        c = t3;
      }
      angle = _atan2(b2, a);
      rotation = angle * _RAD2DEG;
      if (angle) {
        cos = Math.cos(angle);
        sin = Math.sin(angle);
        t12 = a * cos + b2 * sin;
        t2 = a12 * cos + a22 * sin;
        b2 = b2 * cos - a * sin;
        a22 = a22 * cos - a12 * sin;
        a = t12;
        a12 = t2;
      }
      if (rotationX && Math.abs(rotationX) + Math.abs(rotation) > 359.9) {
        rotationX = rotation = 0;
        rotationY = 180 - rotationY;
      }
      scaleX = _round(Math.sqrt(a * a + b2 * b2 + c * c));
      scaleY = _round(Math.sqrt(a22 * a22 + a32 * a32));
      angle = _atan2(a12, a22);
      skewX = Math.abs(angle) > 2e-4 ? angle * _RAD2DEG : 0;
      perspective = a43 ? 1 / (a43 < 0 ? -a43 : a43) : 0;
    }
    if (cache.svg) {
      t12 = target.getAttribute("transform");
      cache.forceCSS = target.setAttribute("transform", "") || !_isNullTransform(_getComputedProperty(target, _transformProp));
      t12 && target.setAttribute("transform", t12);
    }
  }
  if (Math.abs(skewX) > 90 && Math.abs(skewX) < 270) {
    if (invertedScaleX) {
      scaleX *= -1;
      skewX += rotation <= 0 ? 180 : -180;
      rotation += rotation <= 0 ? 180 : -180;
    } else {
      scaleY *= -1;
      skewX += skewX <= 0 ? 180 : -180;
    }
  }
  uncache = uncache || cache.uncache;
  cache.x = x2 - ((cache.xPercent = x2 && (!uncache && cache.xPercent || (Math.round(target.offsetWidth / 2) === Math.round(-x2) ? -50 : 0))) ? target.offsetWidth * cache.xPercent / 100 : 0) + px;
  cache.y = y3 - ((cache.yPercent = y3 && (!uncache && cache.yPercent || (Math.round(target.offsetHeight / 2) === Math.round(-y3) ? -50 : 0))) ? target.offsetHeight * cache.yPercent / 100 : 0) + px;
  cache.z = z3 + px;
  cache.scaleX = _round(scaleX);
  cache.scaleY = _round(scaleY);
  cache.rotation = _round(rotation) + deg;
  cache.rotationX = _round(rotationX) + deg;
  cache.rotationY = _round(rotationY) + deg;
  cache.skewX = skewX + deg;
  cache.skewY = skewY + deg;
  cache.transformPerspective = perspective + px;
  if (cache.zOrigin = parseFloat(origin.split(" ")[2]) || !uncache && cache.zOrigin || 0) {
    style[_transformOriginProp] = _firstTwoOnly(origin);
  }
  cache.xOffset = cache.yOffset = 0;
  cache.force3D = _config.force3D;
  cache.renderTransform = cache.svg ? _renderSVGTransforms : _supports3D ? _renderCSSTransforms : _renderNon3DTransforms;
  cache.uncache = 0;
  return cache;
};
var _firstTwoOnly = function _firstTwoOnly2(value) {
  return (value = value.split(" "))[0] + " " + value[1];
};
var _addPxTranslate = function _addPxTranslate2(target, start, value) {
  var unit = getUnit(start);
  return _round(parseFloat(start) + parseFloat(_convertToUnit(target, "x", value + "px", unit))) + unit;
};
var _renderNon3DTransforms = function _renderNon3DTransforms2(ratio, cache) {
  cache.z = "0px";
  cache.rotationY = cache.rotationX = "0deg";
  cache.force3D = 0;
  _renderCSSTransforms(ratio, cache);
};
var _zeroDeg = "0deg";
var _zeroPx = "0px";
var _endParenthesis = ") ";
var _renderCSSTransforms = function _renderCSSTransforms2(ratio, cache) {
  var _ref = cache || this, xPercent = _ref.xPercent, yPercent = _ref.yPercent, x2 = _ref.x, y3 = _ref.y, z3 = _ref.z, rotation = _ref.rotation, rotationY = _ref.rotationY, rotationX = _ref.rotationX, skewX = _ref.skewX, skewY = _ref.skewY, scaleX = _ref.scaleX, scaleY = _ref.scaleY, transformPerspective = _ref.transformPerspective, force3D = _ref.force3D, target = _ref.target, zOrigin = _ref.zOrigin, transforms = "", use3D = force3D === "auto" && ratio && ratio !== 1 || force3D === true;
  if (zOrigin && (rotationX !== _zeroDeg || rotationY !== _zeroDeg)) {
    var angle = parseFloat(rotationY) * _DEG2RAD, a13 = Math.sin(angle), a33 = Math.cos(angle), cos;
    angle = parseFloat(rotationX) * _DEG2RAD;
    cos = Math.cos(angle);
    x2 = _addPxTranslate(target, x2, a13 * cos * -zOrigin);
    y3 = _addPxTranslate(target, y3, -Math.sin(angle) * -zOrigin);
    z3 = _addPxTranslate(target, z3, a33 * cos * -zOrigin + zOrigin);
  }
  if (transformPerspective !== _zeroPx) {
    transforms += "perspective(" + transformPerspective + _endParenthesis;
  }
  if (xPercent || yPercent) {
    transforms += "translate(" + xPercent + "%, " + yPercent + "%) ";
  }
  if (use3D || x2 !== _zeroPx || y3 !== _zeroPx || z3 !== _zeroPx) {
    transforms += z3 !== _zeroPx || use3D ? "translate3d(" + x2 + ", " + y3 + ", " + z3 + ") " : "translate(" + x2 + ", " + y3 + _endParenthesis;
  }
  if (rotation !== _zeroDeg) {
    transforms += "rotate(" + rotation + _endParenthesis;
  }
  if (rotationY !== _zeroDeg) {
    transforms += "rotateY(" + rotationY + _endParenthesis;
  }
  if (rotationX !== _zeroDeg) {
    transforms += "rotateX(" + rotationX + _endParenthesis;
  }
  if (skewX !== _zeroDeg || skewY !== _zeroDeg) {
    transforms += "skew(" + skewX + ", " + skewY + _endParenthesis;
  }
  if (scaleX !== 1 || scaleY !== 1) {
    transforms += "scale(" + scaleX + ", " + scaleY + _endParenthesis;
  }
  target.style[_transformProp] = transforms || "translate(0, 0)";
};
var _renderSVGTransforms = function _renderSVGTransforms2(ratio, cache) {
  var _ref2 = cache || this, xPercent = _ref2.xPercent, yPercent = _ref2.yPercent, x2 = _ref2.x, y3 = _ref2.y, rotation = _ref2.rotation, skewX = _ref2.skewX, skewY = _ref2.skewY, scaleX = _ref2.scaleX, scaleY = _ref2.scaleY, target = _ref2.target, xOrigin = _ref2.xOrigin, yOrigin = _ref2.yOrigin, xOffset = _ref2.xOffset, yOffset = _ref2.yOffset, forceCSS = _ref2.forceCSS, tx = parseFloat(x2), ty = parseFloat(y3), a11, a21, a12, a22, temp;
  rotation = parseFloat(rotation);
  skewX = parseFloat(skewX);
  skewY = parseFloat(skewY);
  if (skewY) {
    skewY = parseFloat(skewY);
    skewX += skewY;
    rotation += skewY;
  }
  if (rotation || skewX) {
    rotation *= _DEG2RAD;
    skewX *= _DEG2RAD;
    a11 = Math.cos(rotation) * scaleX;
    a21 = Math.sin(rotation) * scaleX;
    a12 = Math.sin(rotation - skewX) * -scaleY;
    a22 = Math.cos(rotation - skewX) * scaleY;
    if (skewX) {
      skewY *= _DEG2RAD;
      temp = Math.tan(skewX - skewY);
      temp = Math.sqrt(1 + temp * temp);
      a12 *= temp;
      a22 *= temp;
      if (skewY) {
        temp = Math.tan(skewY);
        temp = Math.sqrt(1 + temp * temp);
        a11 *= temp;
        a21 *= temp;
      }
    }
    a11 = _round(a11);
    a21 = _round(a21);
    a12 = _round(a12);
    a22 = _round(a22);
  } else {
    a11 = scaleX;
    a22 = scaleY;
    a21 = a12 = 0;
  }
  if (tx && !~(x2 + "").indexOf("px") || ty && !~(y3 + "").indexOf("px")) {
    tx = _convertToUnit(target, "x", x2, "px");
    ty = _convertToUnit(target, "y", y3, "px");
  }
  if (xOrigin || yOrigin || xOffset || yOffset) {
    tx = _round(tx + xOrigin - (xOrigin * a11 + yOrigin * a12) + xOffset);
    ty = _round(ty + yOrigin - (xOrigin * a21 + yOrigin * a22) + yOffset);
  }
  if (xPercent || yPercent) {
    temp = target.getBBox();
    tx = _round(tx + xPercent / 100 * temp.width);
    ty = _round(ty + yPercent / 100 * temp.height);
  }
  temp = "matrix(" + a11 + "," + a21 + "," + a12 + "," + a22 + "," + tx + "," + ty + ")";
  target.setAttribute("transform", temp);
  forceCSS && (target.style[_transformProp] = temp);
};
var _addRotationalPropTween = function _addRotationalPropTween2(plugin, target, property, startNum, endValue) {
  var cap = 360, isString = _isString(endValue), endNum = parseFloat(endValue) * (isString && ~endValue.indexOf("rad") ? _RAD2DEG : 1), change = endNum - startNum, finalValue = startNum + change + "deg", direction, pt4;
  if (isString) {
    direction = endValue.split("_")[1];
    if (direction === "short") {
      change %= cap;
      if (change !== change % (cap / 2)) {
        change += change < 0 ? cap : -cap;
      }
    }
    if (direction === "cw" && change < 0) {
      change = (change + cap * _bigNum2) % cap - ~~(change / cap) * cap;
    } else if (direction === "ccw" && change > 0) {
      change = (change - cap * _bigNum2) % cap - ~~(change / cap) * cap;
    }
  }
  plugin._pt = pt4 = new PropTween(plugin._pt, target, property, startNum, change, _renderPropWithEnd);
  pt4.e = finalValue;
  pt4.u = "deg";
  plugin._props.push(property);
  return pt4;
};
var _assign = function _assign2(target, source) {
  for (var p2 in source) {
    target[p2] = source[p2];
  }
  return target;
};
var _addRawTransformPTs = function _addRawTransformPTs2(plugin, transforms, target) {
  var startCache = _assign({}, target._gsap), exclude = "perspective,force3D,transformOrigin,svgOrigin", style = target.style, endCache, p2, startValue, endValue, startNum, endNum, startUnit, endUnit;
  if (startCache.svg) {
    startValue = target.getAttribute("transform");
    target.setAttribute("transform", "");
    style[_transformProp] = transforms;
    endCache = _parseTransform(target, 1);
    _removeProperty(target, _transformProp);
    target.setAttribute("transform", startValue);
  } else {
    startValue = getComputedStyle(target)[_transformProp];
    style[_transformProp] = transforms;
    endCache = _parseTransform(target, 1);
    style[_transformProp] = startValue;
  }
  for (p2 in _transformProps) {
    startValue = startCache[p2];
    endValue = endCache[p2];
    if (startValue !== endValue && exclude.indexOf(p2) < 0) {
      startUnit = getUnit(startValue);
      endUnit = getUnit(endValue);
      startNum = startUnit !== endUnit ? _convertToUnit(target, p2, startValue, endUnit) : parseFloat(startValue);
      endNum = parseFloat(endValue);
      plugin._pt = new PropTween(plugin._pt, endCache, p2, startNum, endNum - startNum, _renderCSSProp);
      plugin._pt.u = endUnit || 0;
      plugin._props.push(p2);
    }
  }
  _assign(endCache, startCache);
};
_forEachName("padding,margin,Width,Radius", function(name, index) {
  var t2 = "Top", r2 = "Right", b2 = "Bottom", l2 = "Left", props = (index < 3 ? [t2, r2, b2, l2] : [t2 + l2, t2 + r2, b2 + r2, b2 + l2]).map(function(side) {
    return index < 2 ? name + side : "border" + side + name;
  });
  _specialProps[index > 1 ? "border" + name : name] = function(plugin, target, property, endValue, tween) {
    var a, vars;
    if (arguments.length < 4) {
      a = props.map(function(prop) {
        return _get(plugin, prop, property);
      });
      vars = a.join(" ");
      return vars.split(a[0]).length === 5 ? a[0] : vars;
    }
    a = (endValue + "").split(" ");
    vars = {};
    props.forEach(function(prop, i2) {
      return vars[prop] = a[i2] = a[i2] || a[(i2 - 1) / 2 | 0];
    });
    plugin.init(target, vars, tween);
  };
});
var CSSPlugin = {
  name: "css",
  register: _initCore,
  targetTest: function targetTest(target) {
    return target.style && target.nodeType;
  },
  init: function init3(target, vars, tween, index, targets) {
    var props = this._props, style = target.style, startAt = tween.vars.startAt, startValue, endValue, endNum, startNum, type, specialProp, p2, startUnit, endUnit, relative, isTransformRelated, transformPropTween, cache, smooth, hasPriority, inlineProps, finalTransformValue;
    _pluginInitted || _initCore();
    this.styles = this.styles || _getStyleSaver(target);
    inlineProps = this.styles.props;
    this.tween = tween;
    for (p2 in vars) {
      if (p2 === "autoRound") {
        continue;
      }
      endValue = vars[p2];
      if (_plugins[p2] && _checkPlugin(p2, vars, tween, index, target, targets)) {
        continue;
      }
      type = typeof endValue;
      specialProp = _specialProps[p2];
      if (type === "function") {
        endValue = endValue.call(tween, index, target, targets);
        type = typeof endValue;
      }
      if (type === "string" && ~endValue.indexOf("random(")) {
        endValue = _replaceRandom(endValue);
      }
      if (specialProp) {
        specialProp(this, target, p2, endValue, tween) && (hasPriority = 1);
      } else if (p2.substr(0, 2) === "--") {
        startValue = (getComputedStyle(target).getPropertyValue(p2) + "").trim();
        endValue += "";
        _colorExp.lastIndex = 0;
        if (!_colorExp.test(startValue)) {
          startUnit = getUnit(startValue);
          endUnit = getUnit(endValue);
          endUnit ? startUnit !== endUnit && (startValue = _convertToUnit(target, p2, startValue, endUnit) + endUnit) : startUnit && (endValue += startUnit);
        }
        this.add(style, "setProperty", startValue, endValue, index, targets, 0, 0, p2);
        props.push(p2);
        inlineProps.push(p2, 0, style[p2]);
      } else if (type !== "undefined") {
        if (startAt && p2 in startAt) {
          startValue = typeof startAt[p2] === "function" ? startAt[p2].call(tween, index, target, targets) : startAt[p2];
          _isString(startValue) && ~startValue.indexOf("random(") && (startValue = _replaceRandom(startValue));
          getUnit(startValue + "") || startValue === "auto" || (startValue += _config.units[p2] || getUnit(_get(target, p2)) || "");
          (startValue + "").charAt(1) === "=" && (startValue = _get(target, p2));
        } else {
          startValue = _get(target, p2);
        }
        startNum = parseFloat(startValue);
        relative = type === "string" && endValue.charAt(1) === "=" && endValue.substr(0, 2);
        relative && (endValue = endValue.substr(2));
        endNum = parseFloat(endValue);
        if (p2 in _propertyAliases) {
          if (p2 === "autoAlpha") {
            if (startNum === 1 && _get(target, "visibility") === "hidden" && endNum) {
              startNum = 0;
            }
            inlineProps.push("visibility", 0, style.visibility);
            _addNonTweeningPT(this, style, "visibility", startNum ? "inherit" : "hidden", endNum ? "inherit" : "hidden", !endNum);
          }
          if (p2 !== "scale" && p2 !== "transform") {
            p2 = _propertyAliases[p2];
            ~p2.indexOf(",") && (p2 = p2.split(",")[0]);
          }
        }
        isTransformRelated = p2 in _transformProps;
        if (isTransformRelated) {
          this.styles.save(p2);
          finalTransformValue = endValue;
          if (type === "string" && endValue.substring(0, 6) === "var(--") {
            endValue = _getComputedProperty(target, endValue.substring(4, endValue.indexOf(")")));
            if (endValue.substring(0, 5) === "calc(") {
              var origPerspective = target.style.perspective;
              target.style.perspective = endValue;
              endValue = _getComputedProperty(target, "perspective");
              origPerspective ? target.style.perspective = origPerspective : _removeProperty(target, "perspective");
            }
            endNum = parseFloat(endValue);
          }
          if (!transformPropTween) {
            cache = target._gsap;
            cache.renderTransform && !vars.parseTransform || _parseTransform(target, vars.parseTransform);
            smooth = vars.smoothOrigin !== false && cache.smooth;
            transformPropTween = this._pt = new PropTween(this._pt, style, _transformProp, 0, 1, cache.renderTransform, cache, 0, -1);
            transformPropTween.dep = 1;
          }
          if (p2 === "scale") {
            this._pt = new PropTween(this._pt, cache, "scaleY", cache.scaleY, (relative ? _parseRelative(cache.scaleY, relative + endNum) : endNum) - cache.scaleY || 0, _renderCSSProp);
            this._pt.u = 0;
            props.push("scaleY", p2);
            p2 += "X";
          } else if (p2 === "transformOrigin") {
            inlineProps.push(_transformOriginProp, 0, style[_transformOriginProp]);
            endValue = _convertKeywordsToPercentages(endValue);
            if (cache.svg) {
              _applySVGOrigin(target, endValue, 0, smooth, 0, this);
            } else {
              endUnit = parseFloat(endValue.split(" ")[2]) || 0;
              endUnit !== cache.zOrigin && _addNonTweeningPT(this, cache, "zOrigin", cache.zOrigin, endUnit);
              _addNonTweeningPT(this, style, p2, _firstTwoOnly(startValue), _firstTwoOnly(endValue));
            }
            continue;
          } else if (p2 === "svgOrigin") {
            _applySVGOrigin(target, endValue, 1, smooth, 0, this);
            continue;
          } else if (p2 in _rotationalProperties) {
            _addRotationalPropTween(this, cache, p2, startNum, relative ? _parseRelative(startNum, relative + endValue) : endValue);
            continue;
          } else if (p2 === "smoothOrigin") {
            _addNonTweeningPT(this, cache, "smooth", cache.smooth, endValue);
            continue;
          } else if (p2 === "force3D") {
            cache[p2] = endValue;
            continue;
          } else if (p2 === "transform") {
            _addRawTransformPTs(this, endValue, target);
            continue;
          }
        } else if (!(p2 in style)) {
          p2 = _checkPropPrefix(p2) || p2;
        }
        if (isTransformRelated || (endNum || endNum === 0) && (startNum || startNum === 0) && !_complexExp.test(endValue) && p2 in style) {
          startUnit = (startValue + "").substr((startNum + "").length);
          endNum || (endNum = 0);
          endUnit = getUnit(endValue) || (p2 in _config.units ? _config.units[p2] : startUnit);
          startUnit !== endUnit && (startNum = _convertToUnit(target, p2, startValue, endUnit));
          this._pt = new PropTween(this._pt, isTransformRelated ? cache : style, p2, startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum, !isTransformRelated && (endUnit === "px" || p2 === "zIndex") && vars.autoRound !== false ? _renderRoundedCSSProp : _renderCSSProp);
          this._pt.u = endUnit || 0;
          if (isTransformRelated && finalTransformValue !== endValue) {
            this._pt.b = startValue;
            this._pt.e = finalTransformValue;
            this._pt.r = _renderCSSPropWithBeginningAndEnd;
          } else if (startUnit !== endUnit && endUnit !== "%") {
            this._pt.b = startValue;
            this._pt.r = _renderCSSPropWithBeginning;
          }
        } else if (!(p2 in style)) {
          if (p2 in target) {
            this.add(target, p2, startValue || target[p2], relative ? relative + endValue : endValue, index, targets);
          } else if (p2 !== "parseTransform") {
            _missingPlugin(p2, endValue);
            continue;
          }
        } else {
          _tweenComplexCSSString.call(this, target, p2, startValue, relative ? relative + endValue : endValue);
        }
        isTransformRelated || (p2 in style ? inlineProps.push(p2, 0, style[p2]) : typeof target[p2] === "function" ? inlineProps.push(p2, 2, target[p2]()) : inlineProps.push(p2, 1, startValue || target[p2]));
        props.push(p2);
      }
    }
    hasPriority && _sortPropTweensByPriority(this);
  },
  render: function render2(ratio, data) {
    if (data.tween._time || !_reverting2()) {
      var pt4 = data._pt;
      while (pt4) {
        pt4.r(ratio, pt4.d);
        pt4 = pt4._next;
      }
    } else {
      data.styles.revert();
    }
  },
  get: _get,
  aliases: _propertyAliases,
  getSetter: function getSetter(target, property, plugin) {
    var p2 = _propertyAliases[property];
    p2 && p2.indexOf(",") < 0 && (property = p2);
    return property in _transformProps && property !== _transformOriginProp && (target._gsap.x || _get(target, "x")) ? plugin && _recentSetterPlugin === plugin ? property === "scale" ? _setterScale : _setterTransform : (_recentSetterPlugin = plugin || {}) && (property === "scale" ? _setterScaleWithRender : _setterTransformWithRender) : target.style && !_isUndefined(target.style[property]) ? _setterCSSStyle : ~property.indexOf("-") ? _setterCSSProp : _getSetter(target, property);
  },
  core: {
    _removeProperty,
    _getMatrix
  }
};
gsap.utils.checkPrefix = _checkPropPrefix;
gsap.core.getStyleSaver = _getStyleSaver;
(function(positionAndScale, rotation, others, aliases) {
  var all = _forEachName(positionAndScale + "," + rotation + "," + others, function(name) {
    _transformProps[name] = 1;
  });
  _forEachName(rotation, function(name) {
    _config.units[name] = "deg";
    _rotationalProperties[name] = 1;
  });
  _propertyAliases[all[13]] = positionAndScale + "," + rotation;
  _forEachName(aliases, function(name) {
    var split = name.split(":");
    _propertyAliases[split[1]] = all[split[0]];
  });
})("x,y,z,scale,scaleX,scaleY,xPercent,yPercent", "rotation,rotationX,rotationY,skewX,skewY", "transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective", "0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY");
_forEachName("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective", function(name) {
  _config.units[name] = "px";
});
gsap.registerPlugin(CSSPlugin);

// node_modules/gsap/index.js
var gsapWithCSS = gsap.registerPlugin(CSSPlugin) || gsap;
var TweenMaxWithCSS = gsapWithCSS.core.Tween;

// node_modules/@chenglou/pretext/dist/generated/bidi-data.js
var latin1BidiTypes = [
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "S",
  "B",
  "S",
  "WS",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "B",
  "B",
  "S",
  "WS",
  "ON",
  "ON",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ES",
  "CS",
  "ES",
  "CS",
  "CS",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "CS",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "CS",
  "ON",
  "ET",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "ON",
  "ON",
  "BN",
  "ON",
  "ON",
  "ET",
  "ET",
  "EN",
  "EN",
  "ON",
  "L",
  "ON",
  "ON",
  "ON",
  "EN",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L"
];
var nonLatin1BidiRanges = [
  [697, 698, "ON"],
  [706, 719, "ON"],
  [722, 735, "ON"],
  [741, 749, "ON"],
  [751, 767, "ON"],
  [768, 879, "NSM"],
  [884, 885, "ON"],
  [894, 894, "ON"],
  [900, 901, "ON"],
  [903, 903, "ON"],
  [1014, 1014, "ON"],
  [1155, 1161, "NSM"],
  [1418, 1418, "ON"],
  [1421, 1422, "ON"],
  [1423, 1423, "ET"],
  [1424, 1424, "R"],
  [1425, 1469, "NSM"],
  [1470, 1470, "R"],
  [1471, 1471, "NSM"],
  [1472, 1472, "R"],
  [1473, 1474, "NSM"],
  [1475, 1475, "R"],
  [1476, 1477, "NSM"],
  [1478, 1478, "R"],
  [1479, 1479, "NSM"],
  [1480, 1535, "R"],
  [1536, 1541, "AN"],
  [1542, 1543, "ON"],
  [1544, 1544, "AL"],
  [1545, 1546, "ET"],
  [1547, 1547, "AL"],
  [1548, 1548, "CS"],
  [1549, 1549, "AL"],
  [1550, 1551, "ON"],
  [1552, 1562, "NSM"],
  [1563, 1610, "AL"],
  [1611, 1631, "NSM"],
  [1632, 1641, "AN"],
  [1642, 1642, "ET"],
  [1643, 1644, "AN"],
  [1645, 1647, "AL"],
  [1648, 1648, "NSM"],
  [1649, 1749, "AL"],
  [1750, 1756, "NSM"],
  [1757, 1757, "AN"],
  [1758, 1758, "ON"],
  [1759, 1764, "NSM"],
  [1765, 1766, "AL"],
  [1767, 1768, "NSM"],
  [1769, 1769, "ON"],
  [1770, 1773, "NSM"],
  [1774, 1775, "AL"],
  [1776, 1785, "EN"],
  [1786, 1808, "AL"],
  [1809, 1809, "NSM"],
  [1810, 1839, "AL"],
  [1840, 1866, "NSM"],
  [1867, 1957, "AL"],
  [1958, 1968, "NSM"],
  [1969, 1983, "AL"],
  [1984, 2026, "R"],
  [2027, 2035, "NSM"],
  [2036, 2037, "R"],
  [2038, 2041, "ON"],
  [2042, 2044, "R"],
  [2045, 2045, "NSM"],
  [2046, 2069, "R"],
  [2070, 2073, "NSM"],
  [2074, 2074, "R"],
  [2075, 2083, "NSM"],
  [2084, 2084, "R"],
  [2085, 2087, "NSM"],
  [2088, 2088, "R"],
  [2089, 2093, "NSM"],
  [2094, 2136, "R"],
  [2137, 2139, "NSM"],
  [2140, 2143, "R"],
  [2144, 2191, "AL"],
  [2192, 2193, "AN"],
  [2194, 2198, "AL"],
  [2199, 2207, "NSM"],
  [2208, 2249, "AL"],
  [2250, 2273, "NSM"],
  [2274, 2274, "AN"],
  [2275, 2306, "NSM"],
  [2362, 2362, "NSM"],
  [2364, 2364, "NSM"],
  [2369, 2376, "NSM"],
  [2381, 2381, "NSM"],
  [2385, 2391, "NSM"],
  [2402, 2403, "NSM"],
  [2433, 2433, "NSM"],
  [2492, 2492, "NSM"],
  [2497, 2500, "NSM"],
  [2509, 2509, "NSM"],
  [2530, 2531, "NSM"],
  [2546, 2547, "ET"],
  [2555, 2555, "ET"],
  [2558, 2558, "NSM"],
  [2561, 2562, "NSM"],
  [2620, 2620, "NSM"],
  [2625, 2626, "NSM"],
  [2631, 2632, "NSM"],
  [2635, 2637, "NSM"],
  [2641, 2641, "NSM"],
  [2672, 2673, "NSM"],
  [2677, 2677, "NSM"],
  [2689, 2690, "NSM"],
  [2748, 2748, "NSM"],
  [2753, 2757, "NSM"],
  [2759, 2760, "NSM"],
  [2765, 2765, "NSM"],
  [2786, 2787, "NSM"],
  [2801, 2801, "ET"],
  [2810, 2815, "NSM"],
  [2817, 2817, "NSM"],
  [2876, 2876, "NSM"],
  [2879, 2879, "NSM"],
  [2881, 2884, "NSM"],
  [2893, 2893, "NSM"],
  [2901, 2902, "NSM"],
  [2914, 2915, "NSM"],
  [2946, 2946, "NSM"],
  [3008, 3008, "NSM"],
  [3021, 3021, "NSM"],
  [3059, 3064, "ON"],
  [3065, 3065, "ET"],
  [3066, 3066, "ON"],
  [3072, 3072, "NSM"],
  [3076, 3076, "NSM"],
  [3132, 3132, "NSM"],
  [3134, 3136, "NSM"],
  [3142, 3144, "NSM"],
  [3146, 3149, "NSM"],
  [3157, 3158, "NSM"],
  [3170, 3171, "NSM"],
  [3192, 3198, "ON"],
  [3201, 3201, "NSM"],
  [3260, 3260, "NSM"],
  [3276, 3277, "NSM"],
  [3298, 3299, "NSM"],
  [3328, 3329, "NSM"],
  [3387, 3388, "NSM"],
  [3393, 3396, "NSM"],
  [3405, 3405, "NSM"],
  [3426, 3427, "NSM"],
  [3457, 3457, "NSM"],
  [3530, 3530, "NSM"],
  [3538, 3540, "NSM"],
  [3542, 3542, "NSM"],
  [3633, 3633, "NSM"],
  [3636, 3642, "NSM"],
  [3647, 3647, "ET"],
  [3655, 3662, "NSM"],
  [3761, 3761, "NSM"],
  [3764, 3772, "NSM"],
  [3784, 3790, "NSM"],
  [3864, 3865, "NSM"],
  [3893, 3893, "NSM"],
  [3895, 3895, "NSM"],
  [3897, 3897, "NSM"],
  [3898, 3901, "ON"],
  [3953, 3966, "NSM"],
  [3968, 3972, "NSM"],
  [3974, 3975, "NSM"],
  [3981, 3991, "NSM"],
  [3993, 4028, "NSM"],
  [4038, 4038, "NSM"],
  [4141, 4144, "NSM"],
  [4146, 4151, "NSM"],
  [4153, 4154, "NSM"],
  [4157, 4158, "NSM"],
  [4184, 4185, "NSM"],
  [4190, 4192, "NSM"],
  [4209, 4212, "NSM"],
  [4226, 4226, "NSM"],
  [4229, 4230, "NSM"],
  [4237, 4237, "NSM"],
  [4253, 4253, "NSM"],
  [4957, 4959, "NSM"],
  [5008, 5017, "ON"],
  [5120, 5120, "ON"],
  [5760, 5760, "WS"],
  [5787, 5788, "ON"],
  [5906, 5908, "NSM"],
  [5938, 5939, "NSM"],
  [5970, 5971, "NSM"],
  [6002, 6003, "NSM"],
  [6068, 6069, "NSM"],
  [6071, 6077, "NSM"],
  [6086, 6086, "NSM"],
  [6089, 6099, "NSM"],
  [6107, 6107, "ET"],
  [6109, 6109, "NSM"],
  [6128, 6137, "ON"],
  [6144, 6154, "ON"],
  [6155, 6157, "NSM"],
  [6158, 6158, "BN"],
  [6159, 6159, "NSM"],
  [6277, 6278, "NSM"],
  [6313, 6313, "NSM"],
  [6432, 6434, "NSM"],
  [6439, 6440, "NSM"],
  [6450, 6450, "NSM"],
  [6457, 6459, "NSM"],
  [6464, 6464, "ON"],
  [6468, 6469, "ON"],
  [6622, 6655, "ON"],
  [6679, 6680, "NSM"],
  [6683, 6683, "NSM"],
  [6742, 6742, "NSM"],
  [6744, 6750, "NSM"],
  [6752, 6752, "NSM"],
  [6754, 6754, "NSM"],
  [6757, 6764, "NSM"],
  [6771, 6780, "NSM"],
  [6783, 6783, "NSM"],
  [6832, 6877, "NSM"],
  [6880, 6891, "NSM"],
  [6912, 6915, "NSM"],
  [6964, 6964, "NSM"],
  [6966, 6970, "NSM"],
  [6972, 6972, "NSM"],
  [6978, 6978, "NSM"],
  [7019, 7027, "NSM"],
  [7040, 7041, "NSM"],
  [7074, 7077, "NSM"],
  [7080, 7081, "NSM"],
  [7083, 7085, "NSM"],
  [7142, 7142, "NSM"],
  [7144, 7145, "NSM"],
  [7149, 7149, "NSM"],
  [7151, 7153, "NSM"],
  [7212, 7219, "NSM"],
  [7222, 7223, "NSM"],
  [7376, 7378, "NSM"],
  [7380, 7392, "NSM"],
  [7394, 7400, "NSM"],
  [7405, 7405, "NSM"],
  [7412, 7412, "NSM"],
  [7416, 7417, "NSM"],
  [7616, 7679, "NSM"],
  [8125, 8125, "ON"],
  [8127, 8129, "ON"],
  [8141, 8143, "ON"],
  [8157, 8159, "ON"],
  [8173, 8175, "ON"],
  [8189, 8190, "ON"],
  [8192, 8202, "WS"],
  [8203, 8205, "BN"],
  [8207, 8207, "R"],
  [8208, 8231, "ON"],
  [8232, 8232, "WS"],
  [8233, 8233, "B"],
  [8234, 8238, "BN"],
  [8239, 8239, "CS"],
  [8240, 8244, "ET"],
  [8245, 8259, "ON"],
  [8260, 8260, "CS"],
  [8261, 8286, "ON"],
  [8287, 8287, "WS"],
  [8288, 8303, "BN"],
  [8304, 8304, "EN"],
  [8308, 8313, "EN"],
  [8314, 8315, "ES"],
  [8316, 8318, "ON"],
  [8320, 8329, "EN"],
  [8330, 8331, "ES"],
  [8332, 8334, "ON"],
  [8352, 8399, "ET"],
  [8400, 8432, "NSM"],
  [8448, 8449, "ON"],
  [8451, 8454, "ON"],
  [8456, 8457, "ON"],
  [8468, 8468, "ON"],
  [8470, 8472, "ON"],
  [8478, 8483, "ON"],
  [8485, 8485, "ON"],
  [8487, 8487, "ON"],
  [8489, 8489, "ON"],
  [8494, 8494, "ET"],
  [8506, 8507, "ON"],
  [8512, 8516, "ON"],
  [8522, 8525, "ON"],
  [8528, 8543, "ON"],
  [8585, 8587, "ON"],
  [8592, 8721, "ON"],
  [8722, 8722, "ES"],
  [8723, 8723, "ET"],
  [8724, 9013, "ON"],
  [9083, 9108, "ON"],
  [9110, 9257, "ON"],
  [9280, 9290, "ON"],
  [9312, 9351, "ON"],
  [9352, 9371, "EN"],
  [9450, 9899, "ON"],
  [9901, 10239, "ON"],
  [10496, 11123, "ON"],
  [11126, 11263, "ON"],
  [11493, 11498, "ON"],
  [11503, 11505, "NSM"],
  [11513, 11519, "ON"],
  [11647, 11647, "NSM"],
  [11744, 11775, "NSM"],
  [11776, 11869, "ON"],
  [11904, 11929, "ON"],
  [11931, 12019, "ON"],
  [12032, 12245, "ON"],
  [12272, 12287, "ON"],
  [12288, 12288, "WS"],
  [12289, 12292, "ON"],
  [12296, 12320, "ON"],
  [12330, 12333, "NSM"],
  [12336, 12336, "ON"],
  [12342, 12343, "ON"],
  [12349, 12351, "ON"],
  [12441, 12442, "NSM"],
  [12443, 12444, "ON"],
  [12448, 12448, "ON"],
  [12539, 12539, "ON"],
  [12736, 12773, "ON"],
  [12783, 12783, "ON"],
  [12829, 12830, "ON"],
  [12880, 12895, "ON"],
  [12924, 12926, "ON"],
  [12977, 12991, "ON"],
  [13004, 13007, "ON"],
  [13175, 13178, "ON"],
  [13278, 13279, "ON"],
  [13311, 13311, "ON"],
  [19904, 19967, "ON"],
  [42128, 42182, "ON"],
  [42509, 42511, "ON"],
  [42607, 42610, "NSM"],
  [42611, 42611, "ON"],
  [42612, 42621, "NSM"],
  [42622, 42623, "ON"],
  [42654, 42655, "NSM"],
  [42736, 42737, "NSM"],
  [42752, 42785, "ON"],
  [42888, 42888, "ON"],
  [43010, 43010, "NSM"],
  [43014, 43014, "NSM"],
  [43019, 43019, "NSM"],
  [43045, 43046, "NSM"],
  [43048, 43051, "ON"],
  [43052, 43052, "NSM"],
  [43064, 43065, "ET"],
  [43124, 43127, "ON"],
  [43204, 43205, "NSM"],
  [43232, 43249, "NSM"],
  [43263, 43263, "NSM"],
  [43302, 43309, "NSM"],
  [43335, 43345, "NSM"],
  [43392, 43394, "NSM"],
  [43443, 43443, "NSM"],
  [43446, 43449, "NSM"],
  [43452, 43453, "NSM"],
  [43493, 43493, "NSM"],
  [43561, 43566, "NSM"],
  [43569, 43570, "NSM"],
  [43573, 43574, "NSM"],
  [43587, 43587, "NSM"],
  [43596, 43596, "NSM"],
  [43644, 43644, "NSM"],
  [43696, 43696, "NSM"],
  [43698, 43700, "NSM"],
  [43703, 43704, "NSM"],
  [43710, 43711, "NSM"],
  [43713, 43713, "NSM"],
  [43756, 43757, "NSM"],
  [43766, 43766, "NSM"],
  [43882, 43883, "ON"],
  [44005, 44005, "NSM"],
  [44008, 44008, "NSM"],
  [44013, 44013, "NSM"],
  [64285, 64285, "R"],
  [64286, 64286, "NSM"],
  [64287, 64296, "R"],
  [64297, 64297, "ES"],
  [64298, 64335, "R"],
  [64336, 64450, "AL"],
  [64451, 64466, "ON"],
  [64467, 64829, "AL"],
  [64830, 64847, "ON"],
  [64848, 64911, "AL"],
  [64912, 64913, "ON"],
  [64914, 64967, "AL"],
  [64968, 64975, "ON"],
  [64976, 65007, "BN"],
  [65008, 65020, "AL"],
  [65021, 65023, "ON"],
  [65024, 65039, "NSM"],
  [65040, 65049, "ON"],
  [65056, 65071, "NSM"],
  [65072, 65103, "ON"],
  [65104, 65104, "CS"],
  [65105, 65105, "ON"],
  [65106, 65106, "CS"],
  [65108, 65108, "ON"],
  [65109, 65109, "CS"],
  [65110, 65118, "ON"],
  [65119, 65119, "ET"],
  [65120, 65121, "ON"],
  [65122, 65123, "ES"],
  [65124, 65126, "ON"],
  [65128, 65128, "ON"],
  [65129, 65130, "ET"],
  [65131, 65131, "ON"],
  [65136, 65278, "AL"],
  [65279, 65279, "BN"],
  [65281, 65282, "ON"],
  [65283, 65285, "ET"],
  [65286, 65290, "ON"],
  [65291, 65291, "ES"],
  [65292, 65292, "CS"],
  [65293, 65293, "ES"],
  [65294, 65295, "CS"],
  [65296, 65305, "EN"],
  [65306, 65306, "CS"],
  [65307, 65312, "ON"],
  [65339, 65344, "ON"],
  [65371, 65381, "ON"],
  [65504, 65505, "ET"],
  [65506, 65508, "ON"],
  [65509, 65510, "ET"],
  [65512, 65518, "ON"],
  [65520, 65528, "BN"],
  [65529, 65533, "ON"],
  [65534, 65535, "BN"],
  [65793, 65793, "ON"],
  [65856, 65932, "ON"],
  [65936, 65948, "ON"],
  [65952, 65952, "ON"],
  [66045, 66045, "NSM"],
  [66272, 66272, "NSM"],
  [66273, 66299, "EN"],
  [66422, 66426, "NSM"],
  [67584, 67870, "R"],
  [67871, 67871, "ON"],
  [67872, 68096, "R"],
  [68097, 68099, "NSM"],
  [68100, 68100, "R"],
  [68101, 68102, "NSM"],
  [68103, 68107, "R"],
  [68108, 68111, "NSM"],
  [68112, 68151, "R"],
  [68152, 68154, "NSM"],
  [68155, 68158, "R"],
  [68159, 68159, "NSM"],
  [68160, 68324, "R"],
  [68325, 68326, "NSM"],
  [68327, 68408, "R"],
  [68409, 68415, "ON"],
  [68416, 68863, "R"],
  [68864, 68899, "AL"],
  [68900, 68903, "NSM"],
  [68904, 68911, "AL"],
  [68912, 68921, "AN"],
  [68922, 68927, "AL"],
  [68928, 68937, "AN"],
  [68938, 68968, "R"],
  [68969, 68973, "NSM"],
  [68974, 68974, "ON"],
  [68975, 69215, "R"],
  [69216, 69246, "AN"],
  [69247, 69290, "R"],
  [69291, 69292, "NSM"],
  [69293, 69311, "R"],
  [69312, 69327, "AL"],
  [69328, 69336, "ON"],
  [69337, 69369, "AL"],
  [69370, 69375, "NSM"],
  [69376, 69423, "R"],
  [69424, 69445, "AL"],
  [69446, 69456, "NSM"],
  [69457, 69487, "AL"],
  [69488, 69505, "R"],
  [69506, 69509, "NSM"],
  [69510, 69631, "R"],
  [69633, 69633, "NSM"],
  [69688, 69702, "NSM"],
  [69714, 69733, "ON"],
  [69744, 69744, "NSM"],
  [69747, 69748, "NSM"],
  [69759, 69761, "NSM"],
  [69811, 69814, "NSM"],
  [69817, 69818, "NSM"],
  [69826, 69826, "NSM"],
  [69888, 69890, "NSM"],
  [69927, 69931, "NSM"],
  [69933, 69940, "NSM"],
  [70003, 70003, "NSM"],
  [70016, 70017, "NSM"],
  [70070, 70078, "NSM"],
  [70089, 70092, "NSM"],
  [70095, 70095, "NSM"],
  [70191, 70193, "NSM"],
  [70196, 70196, "NSM"],
  [70198, 70199, "NSM"],
  [70206, 70206, "NSM"],
  [70209, 70209, "NSM"],
  [70367, 70367, "NSM"],
  [70371, 70378, "NSM"],
  [70400, 70401, "NSM"],
  [70459, 70460, "NSM"],
  [70464, 70464, "NSM"],
  [70502, 70508, "NSM"],
  [70512, 70516, "NSM"],
  [70587, 70592, "NSM"],
  [70606, 70606, "NSM"],
  [70608, 70608, "NSM"],
  [70610, 70610, "NSM"],
  [70625, 70626, "NSM"],
  [70712, 70719, "NSM"],
  [70722, 70724, "NSM"],
  [70726, 70726, "NSM"],
  [70750, 70750, "NSM"],
  [70835, 70840, "NSM"],
  [70842, 70842, "NSM"],
  [70847, 70848, "NSM"],
  [70850, 70851, "NSM"],
  [71090, 71093, "NSM"],
  [71100, 71101, "NSM"],
  [71103, 71104, "NSM"],
  [71132, 71133, "NSM"],
  [71219, 71226, "NSM"],
  [71229, 71229, "NSM"],
  [71231, 71232, "NSM"],
  [71264, 71276, "ON"],
  [71339, 71339, "NSM"],
  [71341, 71341, "NSM"],
  [71344, 71349, "NSM"],
  [71351, 71351, "NSM"],
  [71453, 71453, "NSM"],
  [71455, 71455, "NSM"],
  [71458, 71461, "NSM"],
  [71463, 71467, "NSM"],
  [71727, 71735, "NSM"],
  [71737, 71738, "NSM"],
  [71995, 71996, "NSM"],
  [71998, 71998, "NSM"],
  [72003, 72003, "NSM"],
  [72148, 72151, "NSM"],
  [72154, 72155, "NSM"],
  [72160, 72160, "NSM"],
  [72193, 72198, "NSM"],
  [72201, 72202, "NSM"],
  [72243, 72248, "NSM"],
  [72251, 72254, "NSM"],
  [72263, 72263, "NSM"],
  [72273, 72278, "NSM"],
  [72281, 72283, "NSM"],
  [72330, 72342, "NSM"],
  [72344, 72345, "NSM"],
  [72544, 72544, "NSM"],
  [72546, 72548, "NSM"],
  [72550, 72550, "NSM"],
  [72752, 72758, "NSM"],
  [72760, 72765, "NSM"],
  [72850, 72871, "NSM"],
  [72874, 72880, "NSM"],
  [72882, 72883, "NSM"],
  [72885, 72886, "NSM"],
  [73009, 73014, "NSM"],
  [73018, 73018, "NSM"],
  [73020, 73021, "NSM"],
  [73023, 73029, "NSM"],
  [73031, 73031, "NSM"],
  [73104, 73105, "NSM"],
  [73109, 73109, "NSM"],
  [73111, 73111, "NSM"],
  [73459, 73460, "NSM"],
  [73472, 73473, "NSM"],
  [73526, 73530, "NSM"],
  [73536, 73536, "NSM"],
  [73538, 73538, "NSM"],
  [73562, 73562, "NSM"],
  [73685, 73692, "ON"],
  [73693, 73696, "ET"],
  [73697, 73713, "ON"],
  [78912, 78912, "NSM"],
  [78919, 78933, "NSM"],
  [90398, 90409, "NSM"],
  [90413, 90415, "NSM"],
  [92912, 92916, "NSM"],
  [92976, 92982, "NSM"],
  [94031, 94031, "NSM"],
  [94095, 94098, "NSM"],
  [94178, 94178, "ON"],
  [94180, 94180, "NSM"],
  [113821, 113822, "NSM"],
  [113824, 113827, "BN"],
  [117760, 117973, "ON"],
  [118e3, 118009, "EN"],
  [118010, 118012, "ON"],
  [118016, 118451, "ON"],
  [118458, 118480, "ON"],
  [118496, 118512, "ON"],
  [118528, 118573, "NSM"],
  [118576, 118598, "NSM"],
  [119143, 119145, "NSM"],
  [119155, 119162, "BN"],
  [119163, 119170, "NSM"],
  [119173, 119179, "NSM"],
  [119210, 119213, "NSM"],
  [119273, 119274, "ON"],
  [119296, 119361, "ON"],
  [119362, 119364, "NSM"],
  [119365, 119365, "ON"],
  [119552, 119638, "ON"],
  [120513, 120513, "ON"],
  [120539, 120539, "ON"],
  [120571, 120571, "ON"],
  [120597, 120597, "ON"],
  [120629, 120629, "ON"],
  [120655, 120655, "ON"],
  [120687, 120687, "ON"],
  [120713, 120713, "ON"],
  [120745, 120745, "ON"],
  [120771, 120771, "ON"],
  [120782, 120831, "EN"],
  [121344, 121398, "NSM"],
  [121403, 121452, "NSM"],
  [121461, 121461, "NSM"],
  [121476, 121476, "NSM"],
  [121499, 121503, "NSM"],
  [121505, 121519, "NSM"],
  [122880, 122886, "NSM"],
  [122888, 122904, "NSM"],
  [122907, 122913, "NSM"],
  [122915, 122916, "NSM"],
  [122918, 122922, "NSM"],
  [123023, 123023, "NSM"],
  [123184, 123190, "NSM"],
  [123566, 123566, "NSM"],
  [123628, 123631, "NSM"],
  [123647, 123647, "ET"],
  [124140, 124143, "NSM"],
  [124398, 124399, "NSM"],
  [124643, 124643, "NSM"],
  [124646, 124646, "NSM"],
  [124654, 124655, "NSM"],
  [124661, 124661, "NSM"],
  [124928, 125135, "R"],
  [125136, 125142, "NSM"],
  [125143, 125251, "R"],
  [125252, 125258, "NSM"],
  [125259, 126063, "R"],
  [126064, 126143, "AL"],
  [126144, 126207, "R"],
  [126208, 126287, "AL"],
  [126288, 126463, "R"],
  [126464, 126703, "AL"],
  [126704, 126705, "ON"],
  [126706, 126719, "AL"],
  [126720, 126975, "R"],
  [126976, 127019, "ON"],
  [127024, 127123, "ON"],
  [127136, 127150, "ON"],
  [127153, 127167, "ON"],
  [127169, 127183, "ON"],
  [127185, 127221, "ON"],
  [127232, 127242, "EN"],
  [127243, 127247, "ON"],
  [127279, 127279, "ON"],
  [127338, 127343, "ON"],
  [127405, 127405, "ON"],
  [127584, 127589, "ON"],
  [127744, 128728, "ON"],
  [128732, 128748, "ON"],
  [128752, 128764, "ON"],
  [128768, 128985, "ON"],
  [128992, 129003, "ON"],
  [129008, 129008, "ON"],
  [129024, 129035, "ON"],
  [129040, 129095, "ON"],
  [129104, 129113, "ON"],
  [129120, 129159, "ON"],
  [129168, 129197, "ON"],
  [129200, 129211, "ON"],
  [129216, 129217, "ON"],
  [129232, 129240, "ON"],
  [129280, 129623, "ON"],
  [129632, 129645, "ON"],
  [129648, 129660, "ON"],
  [129664, 129674, "ON"],
  [129678, 129734, "ON"],
  [129736, 129736, "ON"],
  [129741, 129756, "ON"],
  [129759, 129770, "ON"],
  [129775, 129784, "ON"],
  [129792, 129938, "ON"],
  [129940, 130031, "ON"],
  [130032, 130041, "EN"],
  [130042, 130042, "ON"],
  [131070, 131071, "BN"],
  [196606, 196607, "BN"],
  [262142, 262143, "BN"],
  [327678, 327679, "BN"],
  [393214, 393215, "BN"],
  [458750, 458751, "BN"],
  [524286, 524287, "BN"],
  [589822, 589823, "BN"],
  [655358, 655359, "BN"],
  [720894, 720895, "BN"],
  [786430, 786431, "BN"],
  [851966, 851967, "BN"],
  [917502, 917759, "BN"],
  [917760, 917999, "NSM"],
  [918e3, 921599, "BN"],
  [983038, 983039, "BN"],
  [1048574, 1048575, "BN"],
  [1114110, 1114111, "BN"]
];

// node_modules/@chenglou/pretext/dist/bidi.js
function classifyCodePoint(codePoint) {
  if (codePoint <= 255)
    return latin1BidiTypes[codePoint];
  let lo2 = 0;
  let hi4 = nonLatin1BidiRanges.length - 1;
  while (lo2 <= hi4) {
    const mid = lo2 + hi4 >> 1;
    const range = nonLatin1BidiRanges[mid];
    if (codePoint < range[0]) {
      hi4 = mid - 1;
      continue;
    }
    if (codePoint > range[1]) {
      lo2 = mid + 1;
      continue;
    }
    return range[2];
  }
  return "L";
}
function computeBidiLevels(str) {
  const len = str.length;
  if (len === 0)
    return null;
  const types = new Array(len);
  let sawBidi = false;
  for (let i2 = 0; i2 < len; ) {
    const first = str.charCodeAt(i2);
    let codePoint = first;
    let codeUnitLength = 1;
    if (first >= 55296 && first <= 56319 && i2 + 1 < len) {
      const second = str.charCodeAt(i2 + 1);
      if (second >= 56320 && second <= 57343) {
        codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
        codeUnitLength = 2;
      }
    }
    const t2 = classifyCodePoint(codePoint);
    if (t2 === "R" || t2 === "AL" || t2 === "AN")
      sawBidi = true;
    for (let j3 = 0; j3 < codeUnitLength; j3++) {
      types[i2 + j3] = t2;
    }
    i2 += codeUnitLength;
  }
  if (!sawBidi)
    return null;
  let startLevel = 0;
  for (let i2 = 0; i2 < len; i2++) {
    const t2 = types[i2];
    if (t2 === "L") {
      startLevel = 0;
      break;
    }
    if (t2 === "R" || t2 === "AL") {
      startLevel = 1;
      break;
    }
  }
  const levels = new Int8Array(len);
  for (let i2 = 0; i2 < len; i2++)
    levels[i2] = startLevel;
  const e2 = startLevel & 1 ? "R" : "L";
  const sor = e2;
  let lastType = sor;
  for (let i2 = 0; i2 < len; i2++) {
    if (types[i2] === "NSM")
      types[i2] = lastType;
    else
      lastType = types[i2];
  }
  lastType = sor;
  for (let i2 = 0; i2 < len; i2++) {
    const t2 = types[i2];
    if (t2 === "EN")
      types[i2] = lastType === "AL" ? "AN" : "EN";
    else if (t2 === "R" || t2 === "L" || t2 === "AL")
      lastType = t2;
  }
  for (let i2 = 0; i2 < len; i2++) {
    if (types[i2] === "AL")
      types[i2] = "R";
  }
  for (let i2 = 1; i2 < len - 1; i2++) {
    if (types[i2] === "ES" && types[i2 - 1] === "EN" && types[i2 + 1] === "EN") {
      types[i2] = "EN";
    }
    if (types[i2] === "CS" && (types[i2 - 1] === "EN" || types[i2 - 1] === "AN") && types[i2 + 1] === types[i2 - 1]) {
      types[i2] = types[i2 - 1];
    }
  }
  for (let i2 = 0; i2 < len; i2++) {
    if (types[i2] !== "EN")
      continue;
    let j3;
    for (j3 = i2 - 1; j3 >= 0 && types[j3] === "ET"; j3--)
      types[j3] = "EN";
    for (j3 = i2 + 1; j3 < len && types[j3] === "ET"; j3++)
      types[j3] = "EN";
  }
  for (let i2 = 0; i2 < len; i2++) {
    const t2 = types[i2];
    if (t2 === "WS" || t2 === "ES" || t2 === "ET" || t2 === "CS")
      types[i2] = "ON";
  }
  lastType = sor;
  for (let i2 = 0; i2 < len; i2++) {
    const t2 = types[i2];
    if (t2 === "EN")
      types[i2] = lastType === "L" ? "L" : "EN";
    else if (t2 === "R" || t2 === "L")
      lastType = t2;
  }
  for (let i2 = 0; i2 < len; i2++) {
    if (types[i2] !== "ON")
      continue;
    let end = i2 + 1;
    while (end < len && types[end] === "ON")
      end++;
    const before = i2 > 0 ? types[i2 - 1] : sor;
    const after = end < len ? types[end] : sor;
    const bDir = before !== "L" ? "R" : "L";
    const aDir = after !== "L" ? "R" : "L";
    if (bDir === aDir) {
      for (let j3 = i2; j3 < end; j3++)
        types[j3] = bDir;
    }
    i2 = end - 1;
  }
  for (let i2 = 0; i2 < len; i2++) {
    if (types[i2] === "ON")
      types[i2] = e2;
  }
  for (let i2 = 0; i2 < len; i2++) {
    const t2 = types[i2];
    if ((levels[i2] & 1) === 0) {
      if (t2 === "R")
        levels[i2]++;
      else if (t2 === "AN" || t2 === "EN")
        levels[i2] += 2;
    } else if (t2 === "L" || t2 === "AN" || t2 === "EN") {
      levels[i2]++;
    }
  }
  return levels;
}
function computeSegmentLevels(normalized, segStarts) {
  const bidiLevels = computeBidiLevels(normalized);
  if (bidiLevels === null)
    return null;
  const segLevels = new Int8Array(segStarts.length);
  for (let i2 = 0; i2 < segStarts.length; i2++) {
    segLevels[i2] = bidiLevels[segStarts[i2]];
  }
  return segLevels;
}

// node_modules/@chenglou/pretext/dist/analysis.js
var collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
var needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
function getWhiteSpaceProfile(whiteSpace) {
  const mode = whiteSpace ?? "normal";
  return mode === "pre-wrap" ? { mode, preserveOrdinarySpaces: true, preserveHardBreaks: true } : { mode, preserveOrdinarySpaces: false, preserveHardBreaks: false };
}
function normalizeWhitespaceNormal(text) {
  if (!needsWhitespaceNormalizationRe.test(text))
    return text;
  let normalized = text.replace(collapsibleWhitespaceRunRe, " ");
  if (normalized.charCodeAt(0) === 32) {
    normalized = normalized.slice(1);
  }
  if (normalized.length > 0 && normalized.charCodeAt(normalized.length - 1) === 32) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function normalizeWhitespacePreWrap(text) {
  if (!/[\r\f]/.test(text))
    return text;
  return text.replace(/\r\n/g, "\n").replace(/[\r\f]/g, "\n");
}
var sharedWordSegmenter = null;
var segmenterLocale;
function getSharedWordSegmenter() {
  if (sharedWordSegmenter === null) {
    sharedWordSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: "word" });
  }
  return sharedWordSegmenter;
}
var arabicScriptRe = /\p{Script=Arabic}/u;
var combiningMarkRe = /\p{M}/u;
var decimalDigitRe = /\p{Nd}/u;
function containsArabicScript(text) {
  return arabicScriptRe.test(text);
}
function isCJKCodePoint(codePoint) {
  return codePoint >= 19968 && codePoint <= 40959 || codePoint >= 13312 && codePoint <= 19903 || codePoint >= 131072 && codePoint <= 173791 || codePoint >= 173824 && codePoint <= 177983 || codePoint >= 177984 && codePoint <= 178207 || codePoint >= 178208 && codePoint <= 183983 || codePoint >= 183984 && codePoint <= 191471 || codePoint >= 191472 && codePoint <= 192093 || codePoint >= 194560 && codePoint <= 195103 || codePoint >= 196608 && codePoint <= 201551 || codePoint >= 201552 && codePoint <= 205743 || codePoint >= 205744 && codePoint <= 210041 || codePoint >= 63744 && codePoint <= 64255 || codePoint >= 12288 && codePoint <= 12351 || codePoint >= 12352 && codePoint <= 12447 || codePoint >= 12448 && codePoint <= 12543 || codePoint >= 12592 && codePoint <= 12687 || codePoint >= 44032 && codePoint <= 55215 || codePoint >= 65280 && codePoint <= 65519;
}
function isCJK(s2) {
  for (let i2 = 0; i2 < s2.length; i2++) {
    const first = s2.charCodeAt(i2);
    if (first < 12288)
      continue;
    if (first >= 55296 && first <= 56319 && i2 + 1 < s2.length) {
      const second = s2.charCodeAt(i2 + 1);
      if (second >= 56320 && second <= 57343) {
        const codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
        if (isCJKCodePoint(codePoint))
          return true;
        i2++;
        continue;
      }
    }
    if (isCJKCodePoint(first))
      return true;
  }
  return false;
}
function endsWithLineStartProhibitedText(text) {
  const last = getLastCodePoint(text);
  return last !== null && (kinsokuStart.has(last) || leftStickyPunctuation.has(last));
}
var keepAllGlueChars = /* @__PURE__ */ new Set([
  "\xA0",
  "\u202F",
  "\u2060",
  "\uFEFF"
]);
function containsCJKText(text) {
  return isCJK(text);
}
function endsWithKeepAllGlueText(text) {
  const last = getLastCodePoint(text);
  return last !== null && keepAllGlueChars.has(last);
}
function canContinueKeepAllTextRun(previousText) {
  return !endsWithLineStartProhibitedText(previousText) && !endsWithKeepAllGlueText(previousText);
}
var kinsokuStart = /* @__PURE__ */ new Set([
  "\uFF0C",
  "\uFF0E",
  "\uFF01",
  "\uFF1A",
  "\uFF1B",
  "\uFF1F",
  "\u3001",
  "\u3002",
  "\u30FB",
  "\uFF09",
  "\u3015",
  "\u3009",
  "\u300B",
  "\u300D",
  "\u300F",
  "\u3011",
  "\u3017",
  "\u3019",
  "\u301B",
  "\u30FC",
  "\u3005",
  "\u303B",
  "\u309D",
  "\u309E",
  "\u30FD",
  "\u30FE"
]);
var kinsokuEnd = /* @__PURE__ */ new Set([
  '"',
  "(",
  "[",
  "{",
  "\u201C",
  "\u2018",
  "\xAB",
  "\u2039",
  "\uFF08",
  "\u3014",
  "\u3008",
  "\u300A",
  "\u300C",
  "\u300E",
  "\u3010",
  "\u3016",
  "\u3018",
  "\u301A"
]);
var forwardStickyGlue = /* @__PURE__ */ new Set([
  "'",
  "\u2019"
]);
var leftStickyPunctuation = /* @__PURE__ */ new Set([
  ".",
  ",",
  "!",
  "?",
  ":",
  ";",
  "\u060C",
  "\u061B",
  "\u061F",
  "\u0964",
  "\u0965",
  "\u104A",
  "\u104B",
  "\u104C",
  "\u104D",
  "\u104F",
  ")",
  "]",
  "}",
  "%",
  '"',
  "\u201D",
  "\u2019",
  "\xBB",
  "\u203A",
  "\u2026"
]);
var arabicNoSpaceTrailingPunctuation = /* @__PURE__ */ new Set([
  ":",
  ".",
  "\u060C",
  "\u061B"
]);
var myanmarMedialGlue = /* @__PURE__ */ new Set([
  "\u104F"
]);
var closingQuoteChars = /* @__PURE__ */ new Set([
  "\u201D",
  "\u2019",
  "\xBB",
  "\u203A",
  "\u300D",
  "\u300F",
  "\u3011",
  "\u300B",
  "\u3009",
  "\u3015",
  "\uFF09"
]);
function isLeftStickyPunctuationSegment(segment) {
  if (isEscapedQuoteClusterSegment(segment))
    return true;
  let sawPunctuation = false;
  for (const ch2 of segment) {
    if (leftStickyPunctuation.has(ch2)) {
      sawPunctuation = true;
      continue;
    }
    if (sawPunctuation && combiningMarkRe.test(ch2))
      continue;
    return false;
  }
  return sawPunctuation;
}
function isCJKLineStartProhibitedSegment(segment) {
  for (const ch2 of segment) {
    if (!kinsokuStart.has(ch2) && !leftStickyPunctuation.has(ch2))
      return false;
  }
  return segment.length > 0;
}
function isForwardStickyClusterSegment(segment) {
  if (isEscapedQuoteClusterSegment(segment))
    return true;
  for (const ch2 of segment) {
    if (!kinsokuEnd.has(ch2) && !forwardStickyGlue.has(ch2) && !combiningMarkRe.test(ch2))
      return false;
  }
  return segment.length > 0;
}
function isEscapedQuoteClusterSegment(segment) {
  let sawQuote = false;
  for (const ch2 of segment) {
    if (ch2 === "\\" || combiningMarkRe.test(ch2))
      continue;
    if (kinsokuEnd.has(ch2) || leftStickyPunctuation.has(ch2) || forwardStickyGlue.has(ch2)) {
      sawQuote = true;
      continue;
    }
    return false;
  }
  return sawQuote;
}
function previousCodePointStart(text, end) {
  const last = end - 1;
  if (last <= 0)
    return Math.max(last, 0);
  const lastCodeUnit = text.charCodeAt(last);
  if (lastCodeUnit < 56320 || lastCodeUnit > 57343)
    return last;
  const maybeHigh = last - 1;
  if (maybeHigh < 0)
    return last;
  const highCodeUnit = text.charCodeAt(maybeHigh);
  return highCodeUnit >= 55296 && highCodeUnit <= 56319 ? maybeHigh : last;
}
function getLastCodePoint(text) {
  if (text.length === 0)
    return null;
  const start = previousCodePointStart(text, text.length);
  return text.slice(start);
}
function splitTrailingForwardStickyCluster(text) {
  const chars = Array.from(text);
  let splitIndex = chars.length;
  while (splitIndex > 0) {
    const ch2 = chars[splitIndex - 1];
    if (combiningMarkRe.test(ch2)) {
      splitIndex--;
      continue;
    }
    if (kinsokuEnd.has(ch2) || forwardStickyGlue.has(ch2)) {
      splitIndex--;
      continue;
    }
    break;
  }
  if (splitIndex <= 0 || splitIndex === chars.length)
    return null;
  return {
    head: chars.slice(0, splitIndex).join(""),
    tail: chars.slice(splitIndex).join("")
  };
}
function getRepeatableSingleCharRunChar(text, isWordLike, kind) {
  return kind === "text" && !isWordLike && text.length === 1 && text !== "-" && text !== "\u2014" ? text : null;
}
function materializeDeferredSingleCharRun(texts, chars, lengths, index) {
  const ch2 = chars[index];
  const text = texts[index];
  if (ch2 == null)
    return text;
  const length = lengths[index];
  if (text.length === length)
    return text;
  const materialized = ch2.repeat(length);
  texts[index] = materialized;
  return materialized;
}
function hasArabicNoSpacePunctuation(containsArabic, lastCodePoint) {
  return containsArabic && lastCodePoint !== null && arabicNoSpaceTrailingPunctuation.has(lastCodePoint);
}
function endsWithMyanmarMedialGlue(segment) {
  const lastCodePoint = getLastCodePoint(segment);
  return lastCodePoint !== null && myanmarMedialGlue.has(lastCodePoint);
}
function splitLeadingSpaceAndMarks(segment) {
  if (segment.length < 2 || segment[0] !== " ")
    return null;
  const marks = segment.slice(1);
  if (/^\p{M}+$/u.test(marks)) {
    return { space: " ", marks };
  }
  return null;
}
function endsWithClosingQuote(text) {
  let end = text.length;
  while (end > 0) {
    const start = previousCodePointStart(text, end);
    const ch2 = text.slice(start, end);
    if (closingQuoteChars.has(ch2))
      return true;
    if (!leftStickyPunctuation.has(ch2))
      return false;
    end = start;
  }
  return false;
}
function classifySegmentBreakChar(ch2, whiteSpaceProfile) {
  if (whiteSpaceProfile.preserveOrdinarySpaces || whiteSpaceProfile.preserveHardBreaks) {
    if (ch2 === " ")
      return "preserved-space";
    if (ch2 === "	")
      return "tab";
    if (whiteSpaceProfile.preserveHardBreaks && ch2 === "\n")
      return "hard-break";
  }
  if (ch2 === " ")
    return "space";
  if (ch2 === "\xA0" || ch2 === "\u202F" || ch2 === "\u2060" || ch2 === "\uFEFF") {
    return "glue";
  }
  if (ch2 === "\u200B")
    return "zero-width-break";
  if (ch2 === "\xAD")
    return "soft-hyphen";
  return "text";
}
var breakCharRe = /[\x20\t\n\xA0\xAD\u200B\u202F\u2060\uFEFF]/;
function joinTextParts(parts) {
  return parts.length === 1 ? parts[0] : parts.join("");
}
function joinReversedPrefixParts(prefixParts, tail) {
  const parts = [];
  for (let i2 = prefixParts.length - 1; i2 >= 0; i2--) {
    parts.push(prefixParts[i2]);
  }
  parts.push(tail);
  return joinTextParts(parts);
}
function splitSegmentByBreakKind(segment, isWordLike, start, whiteSpaceProfile) {
  if (!breakCharRe.test(segment)) {
    return [{ text: segment, isWordLike, kind: "text", start }];
  }
  const pieces = [];
  let currentKind = null;
  let currentTextParts = [];
  let currentStart = start;
  let currentWordLike = false;
  let offset = 0;
  for (const ch2 of segment) {
    const kind = classifySegmentBreakChar(ch2, whiteSpaceProfile);
    const wordLike = kind === "text" && isWordLike;
    if (currentKind !== null && kind === currentKind && wordLike === currentWordLike) {
      currentTextParts.push(ch2);
      offset += ch2.length;
      continue;
    }
    if (currentKind !== null) {
      pieces.push({
        text: joinTextParts(currentTextParts),
        isWordLike: currentWordLike,
        kind: currentKind,
        start: currentStart
      });
    }
    currentKind = kind;
    currentTextParts = [ch2];
    currentStart = start + offset;
    currentWordLike = wordLike;
    offset += ch2.length;
  }
  if (currentKind !== null) {
    pieces.push({
      text: joinTextParts(currentTextParts),
      isWordLike: currentWordLike,
      kind: currentKind,
      start: currentStart
    });
  }
  return pieces;
}
function isTextRunBoundary(kind) {
  return kind === "space" || kind === "preserved-space" || kind === "zero-width-break" || kind === "hard-break";
}
var urlSchemeSegmentRe = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
function isUrlLikeRunStart(segmentation, index) {
  const text = segmentation.texts[index];
  if (text.startsWith("www."))
    return true;
  return urlSchemeSegmentRe.test(text) && index + 1 < segmentation.len && segmentation.kinds[index + 1] === "text" && segmentation.texts[index + 1] === "//";
}
function isUrlQueryBoundarySegment(text) {
  return text.includes("?") && (text.includes("://") || text.startsWith("www."));
}
function mergeUrlLikeRuns(segmentation) {
  const texts = segmentation.texts.slice();
  const isWordLike = segmentation.isWordLike.slice();
  const kinds = segmentation.kinds.slice();
  const starts = segmentation.starts.slice();
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    if (kinds[i2] !== "text" || !isUrlLikeRunStart(segmentation, i2))
      continue;
    const mergedParts = [texts[i2]];
    let j3 = i2 + 1;
    while (j3 < segmentation.len && !isTextRunBoundary(kinds[j3])) {
      mergedParts.push(texts[j3]);
      isWordLike[i2] = true;
      const endsQueryPrefix = texts[j3].includes("?");
      kinds[j3] = "text";
      texts[j3] = "";
      j3++;
      if (endsQueryPrefix)
        break;
    }
    texts[i2] = joinTextParts(mergedParts);
  }
  let compactLen = 0;
  for (let read = 0; read < texts.length; read++) {
    const text = texts[read];
    if (text.length === 0)
      continue;
    if (compactLen !== read) {
      texts[compactLen] = text;
      isWordLike[compactLen] = isWordLike[read];
      kinds[compactLen] = kinds[read];
      starts[compactLen] = starts[read];
    }
    compactLen++;
  }
  texts.length = compactLen;
  isWordLike.length = compactLen;
  kinds.length = compactLen;
  starts.length = compactLen;
  return {
    len: compactLen,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeUrlQueryRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    const text = segmentation.texts[i2];
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i2]);
    kinds.push(segmentation.kinds[i2]);
    starts.push(segmentation.starts[i2]);
    if (!isUrlQueryBoundarySegment(text))
      continue;
    const nextIndex = i2 + 1;
    if (nextIndex >= segmentation.len || isTextRunBoundary(segmentation.kinds[nextIndex])) {
      continue;
    }
    const queryParts = [];
    const queryStart = segmentation.starts[nextIndex];
    let j3 = nextIndex;
    while (j3 < segmentation.len && !isTextRunBoundary(segmentation.kinds[j3])) {
      queryParts.push(segmentation.texts[j3]);
      j3++;
    }
    if (queryParts.length > 0) {
      texts.push(joinTextParts(queryParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(queryStart);
      i2 = j3 - 1;
    }
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
var numericJoinerChars = /* @__PURE__ */ new Set([
  ":",
  "-",
  "/",
  "\xD7",
  ",",
  ".",
  "+",
  "\u2013",
  "\u2014"
]);
var asciiPunctuationChainSegmentRe = /^[A-Za-z0-9_]+[,:;]*$/;
var asciiPunctuationChainTrailingJoinersRe = /[,:;]+$/;
function segmentContainsDecimalDigit(text) {
  for (const ch2 of text) {
    if (decimalDigitRe.test(ch2))
      return true;
  }
  return false;
}
function isNumericRunSegment(text) {
  if (text.length === 0)
    return false;
  for (const ch2 of text) {
    if (decimalDigitRe.test(ch2) || numericJoinerChars.has(ch2))
      continue;
    return false;
  }
  return true;
}
function mergeNumericRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    const text = segmentation.texts[i2];
    const kind = segmentation.kinds[i2];
    if (kind === "text" && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
      const mergedParts = [text];
      let j3 = i2 + 1;
      while (j3 < segmentation.len && segmentation.kinds[j3] === "text" && isNumericRunSegment(segmentation.texts[j3])) {
        mergedParts.push(segmentation.texts[j3]);
        j3++;
      }
      texts.push(joinTextParts(mergedParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(segmentation.starts[i2]);
      i2 = j3 - 1;
      continue;
    }
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i2]);
    kinds.push(kind);
    starts.push(segmentation.starts[i2]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeAsciiPunctuationChains(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    const text = segmentation.texts[i2];
    const kind = segmentation.kinds[i2];
    const wordLike = segmentation.isWordLike[i2];
    if (kind === "text" && wordLike && asciiPunctuationChainSegmentRe.test(text)) {
      const mergedParts = [text];
      let endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(text);
      let j3 = i2 + 1;
      while (endsWithJoiners && j3 < segmentation.len && segmentation.kinds[j3] === "text" && segmentation.isWordLike[j3] && asciiPunctuationChainSegmentRe.test(segmentation.texts[j3])) {
        const nextText = segmentation.texts[j3];
        mergedParts.push(nextText);
        endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(nextText);
        j3++;
      }
      texts.push(joinTextParts(mergedParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(segmentation.starts[i2]);
      i2 = j3 - 1;
      continue;
    }
    texts.push(text);
    isWordLike.push(wordLike);
    kinds.push(kind);
    starts.push(segmentation.starts[i2]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function splitHyphenatedNumericRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    const text = segmentation.texts[i2];
    if (segmentation.kinds[i2] === "text" && text.includes("-")) {
      const parts = text.split("-");
      let shouldSplit = parts.length > 1;
      for (let j3 = 0; j3 < parts.length; j3++) {
        const part = parts[j3];
        if (!shouldSplit)
          break;
        if (part.length === 0 || !segmentContainsDecimalDigit(part) || !isNumericRunSegment(part)) {
          shouldSplit = false;
        }
      }
      if (shouldSplit) {
        let offset = 0;
        for (let j3 = 0; j3 < parts.length; j3++) {
          const part = parts[j3];
          const splitText = j3 < parts.length - 1 ? `${part}-` : part;
          texts.push(splitText);
          isWordLike.push(true);
          kinds.push("text");
          starts.push(segmentation.starts[i2] + offset);
          offset += splitText.length;
        }
        continue;
      }
    }
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i2]);
    kinds.push(segmentation.kinds[i2]);
    starts.push(segmentation.starts[i2]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeGlueConnectedTextRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  let read = 0;
  while (read < segmentation.len) {
    const textParts = [segmentation.texts[read]];
    let wordLike = segmentation.isWordLike[read];
    let kind = segmentation.kinds[read];
    let start = segmentation.starts[read];
    if (kind === "glue") {
      const glueParts = [textParts[0]];
      const glueStart = start;
      read++;
      while (read < segmentation.len && segmentation.kinds[read] === "glue") {
        glueParts.push(segmentation.texts[read]);
        read++;
      }
      const glueText = joinTextParts(glueParts);
      if (read < segmentation.len && segmentation.kinds[read] === "text") {
        textParts[0] = glueText;
        textParts.push(segmentation.texts[read]);
        wordLike = segmentation.isWordLike[read];
        kind = "text";
        start = glueStart;
        read++;
      } else {
        texts.push(glueText);
        isWordLike.push(false);
        kinds.push("glue");
        starts.push(glueStart);
        continue;
      }
    } else {
      read++;
    }
    if (kind === "text") {
      while (read < segmentation.len && segmentation.kinds[read] === "glue") {
        const glueParts = [];
        while (read < segmentation.len && segmentation.kinds[read] === "glue") {
          glueParts.push(segmentation.texts[read]);
          read++;
        }
        const glueText = joinTextParts(glueParts);
        if (read < segmentation.len && segmentation.kinds[read] === "text") {
          textParts.push(glueText, segmentation.texts[read]);
          wordLike = wordLike || segmentation.isWordLike[read];
          read++;
          continue;
        }
        textParts.push(glueText);
      }
    }
    texts.push(joinTextParts(textParts));
    isWordLike.push(wordLike);
    kinds.push(kind);
    starts.push(start);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function carryTrailingForwardStickyAcrossCJKBoundary(segmentation) {
  const texts = segmentation.texts.slice();
  const isWordLike = segmentation.isWordLike.slice();
  const kinds = segmentation.kinds.slice();
  const starts = segmentation.starts.slice();
  for (let i2 = 0; i2 < texts.length - 1; i2++) {
    if (kinds[i2] !== "text" || kinds[i2 + 1] !== "text")
      continue;
    if (!isCJK(texts[i2]) || !isCJK(texts[i2 + 1]))
      continue;
    const split = splitTrailingForwardStickyCluster(texts[i2]);
    if (split === null)
      continue;
    texts[i2] = split.head;
    texts[i2 + 1] = split.tail + texts[i2 + 1];
    starts[i2 + 1] = starts[i2] + split.head.length;
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function buildMergedSegmentation(normalized, profile, whiteSpaceProfile) {
  const wordSegmenter = getSharedWordSegmenter();
  let mergedLen = 0;
  const mergedTexts = [];
  const mergedTextParts = [];
  const mergedWordLike = [];
  const mergedKinds = [];
  const mergedStarts = [];
  const mergedSingleCharRunChars = [];
  const mergedSingleCharRunLengths = [];
  const mergedContainsCJK = [];
  const mergedContainsArabicScript = [];
  const mergedEndsWithClosingQuote = [];
  const mergedEndsWithMyanmarMedialGlue = [];
  const mergedHasArabicNoSpacePunctuation = [];
  for (const s2 of wordSegmenter.segment(normalized)) {
    for (const piece of splitSegmentByBreakKind(s2.segment, s2.isWordLike ?? false, s2.index, whiteSpaceProfile)) {
      let appendPieceToPrevious = function() {
        if (mergedSingleCharRunChars[prevIndex] !== null) {
          mergedTextParts[prevIndex] = [
            materializeDeferredSingleCharRun(mergedTexts, mergedSingleCharRunChars, mergedSingleCharRunLengths, prevIndex)
          ];
          mergedSingleCharRunChars[prevIndex] = null;
        }
        mergedTextParts[prevIndex].push(piece.text);
        mergedWordLike[prevIndex] = mergedWordLike[prevIndex] || piece.isWordLike;
        mergedContainsCJK[prevIndex] = mergedContainsCJK[prevIndex] || pieceContainsCJK;
        mergedContainsArabicScript[prevIndex] = mergedContainsArabicScript[prevIndex] || pieceContainsArabicScript;
        mergedEndsWithClosingQuote[prevIndex] = pieceEndsWithClosingQuote;
        mergedEndsWithMyanmarMedialGlue[prevIndex] = pieceEndsWithMyanmarMedialGlue;
        mergedHasArabicNoSpacePunctuation[prevIndex] = hasArabicNoSpacePunctuation(mergedContainsArabicScript[prevIndex], pieceLastCodePoint);
      };
      const isText = piece.kind === "text";
      const repeatableSingleCharRunChar = getRepeatableSingleCharRunChar(piece.text, piece.isWordLike, piece.kind);
      const pieceContainsCJK = isCJK(piece.text);
      const pieceContainsArabicScript = containsArabicScript(piece.text);
      const pieceLastCodePoint = getLastCodePoint(piece.text);
      const pieceEndsWithClosingQuote = endsWithClosingQuote(piece.text);
      const pieceEndsWithMyanmarMedialGlue = endsWithMyanmarMedialGlue(piece.text);
      const prevIndex = mergedLen - 1;
      if (profile.carryCJKAfterClosingQuote && isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && pieceContainsCJK && mergedContainsCJK[prevIndex] && mergedEndsWithClosingQuote[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && isCJKLineStartProhibitedSegment(piece.text) && mergedContainsCJK[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && mergedEndsWithMyanmarMedialGlue[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && piece.isWordLike && pieceContainsArabicScript && mergedHasArabicNoSpacePunctuation[prevIndex]) {
        appendPieceToPrevious();
        mergedWordLike[prevIndex] = true;
      } else if (repeatableSingleCharRunChar !== null && mergedLen > 0 && mergedKinds[prevIndex] === "text" && mergedSingleCharRunChars[prevIndex] === repeatableSingleCharRunChar) {
        mergedSingleCharRunLengths[prevIndex] = (mergedSingleCharRunLengths[prevIndex] ?? 1) + 1;
      } else if (isText && !piece.isWordLike && mergedLen > 0 && mergedKinds[prevIndex] === "text" && !mergedContainsCJK[prevIndex] && (isLeftStickyPunctuationSegment(piece.text) || piece.text === "-" && mergedWordLike[prevIndex])) {
        appendPieceToPrevious();
      } else {
        mergedTexts[mergedLen] = piece.text;
        mergedTextParts[mergedLen] = [piece.text];
        mergedWordLike[mergedLen] = piece.isWordLike;
        mergedKinds[mergedLen] = piece.kind;
        mergedStarts[mergedLen] = piece.start;
        mergedSingleCharRunChars[mergedLen] = repeatableSingleCharRunChar;
        mergedSingleCharRunLengths[mergedLen] = repeatableSingleCharRunChar === null ? 0 : 1;
        mergedContainsCJK[mergedLen] = pieceContainsCJK;
        mergedContainsArabicScript[mergedLen] = pieceContainsArabicScript;
        mergedEndsWithClosingQuote[mergedLen] = pieceEndsWithClosingQuote;
        mergedEndsWithMyanmarMedialGlue[mergedLen] = pieceEndsWithMyanmarMedialGlue;
        mergedHasArabicNoSpacePunctuation[mergedLen] = hasArabicNoSpacePunctuation(pieceContainsArabicScript, pieceLastCodePoint);
        mergedLen++;
      }
    }
  }
  for (let i2 = 0; i2 < mergedLen; i2++) {
    if (mergedSingleCharRunChars[i2] !== null) {
      mergedTexts[i2] = materializeDeferredSingleCharRun(mergedTexts, mergedSingleCharRunChars, mergedSingleCharRunLengths, i2);
      continue;
    }
    mergedTexts[i2] = joinTextParts(mergedTextParts[i2]);
  }
  for (let i2 = 1; i2 < mergedLen; i2++) {
    if (mergedKinds[i2] === "text" && !mergedWordLike[i2] && isEscapedQuoteClusterSegment(mergedTexts[i2]) && mergedKinds[i2 - 1] === "text" && !mergedContainsCJK[i2 - 1]) {
      mergedTexts[i2 - 1] += mergedTexts[i2];
      mergedWordLike[i2 - 1] = mergedWordLike[i2 - 1] || mergedWordLike[i2];
      mergedTexts[i2] = "";
    }
  }
  const forwardStickyPrefixParts = Array.from({ length: mergedLen }, () => null);
  let nextLiveIndex = -1;
  for (let i2 = mergedLen - 1; i2 >= 0; i2--) {
    const text = mergedTexts[i2];
    if (text.length === 0)
      continue;
    if (mergedKinds[i2] === "text" && !mergedWordLike[i2] && isForwardStickyClusterSegment(text) && nextLiveIndex >= 0 && mergedKinds[nextLiveIndex] === "text") {
      const prefixParts = forwardStickyPrefixParts[nextLiveIndex] ?? [];
      prefixParts.push(text);
      forwardStickyPrefixParts[nextLiveIndex] = prefixParts;
      mergedStarts[nextLiveIndex] = mergedStarts[i2];
      mergedTexts[i2] = "";
      continue;
    }
    nextLiveIndex = i2;
  }
  for (let i2 = 0; i2 < mergedLen; i2++) {
    const prefixParts = forwardStickyPrefixParts[i2];
    if (prefixParts == null)
      continue;
    mergedTexts[i2] = joinReversedPrefixParts(prefixParts, mergedTexts[i2]);
  }
  let compactLen = 0;
  for (let read = 0; read < mergedLen; read++) {
    const text = mergedTexts[read];
    if (text.length === 0)
      continue;
    if (compactLen !== read) {
      mergedTexts[compactLen] = text;
      mergedWordLike[compactLen] = mergedWordLike[read];
      mergedKinds[compactLen] = mergedKinds[read];
      mergedStarts[compactLen] = mergedStarts[read];
    }
    compactLen++;
  }
  mergedTexts.length = compactLen;
  mergedWordLike.length = compactLen;
  mergedKinds.length = compactLen;
  mergedStarts.length = compactLen;
  const compacted = mergeGlueConnectedTextRuns({
    len: compactLen,
    texts: mergedTexts,
    isWordLike: mergedWordLike,
    kinds: mergedKinds,
    starts: mergedStarts
  });
  const withMergedUrls = carryTrailingForwardStickyAcrossCJKBoundary(mergeAsciiPunctuationChains(splitHyphenatedNumericRuns(mergeNumericRuns(mergeUrlQueryRuns(mergeUrlLikeRuns(compacted))))));
  for (let i2 = 0; i2 < withMergedUrls.len - 1; i2++) {
    const split = splitLeadingSpaceAndMarks(withMergedUrls.texts[i2]);
    if (split === null)
      continue;
    if (withMergedUrls.kinds[i2] !== "space" && withMergedUrls.kinds[i2] !== "preserved-space" || withMergedUrls.kinds[i2 + 1] !== "text" || !containsArabicScript(withMergedUrls.texts[i2 + 1])) {
      continue;
    }
    withMergedUrls.texts[i2] = split.space;
    withMergedUrls.isWordLike[i2] = false;
    withMergedUrls.kinds[i2] = withMergedUrls.kinds[i2] === "preserved-space" ? "preserved-space" : "space";
    withMergedUrls.texts[i2 + 1] = split.marks + withMergedUrls.texts[i2 + 1];
    withMergedUrls.starts[i2 + 1] = withMergedUrls.starts[i2] + split.space.length;
  }
  return withMergedUrls;
}
function compileAnalysisChunks(segmentation, whiteSpaceProfile) {
  if (segmentation.len === 0)
    return [];
  if (!whiteSpaceProfile.preserveHardBreaks) {
    return [{
      startSegmentIndex: 0,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len
    }];
  }
  const chunks = [];
  let startSegmentIndex = 0;
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    if (segmentation.kinds[i2] !== "hard-break")
      continue;
    chunks.push({
      startSegmentIndex,
      endSegmentIndex: i2,
      consumedEndSegmentIndex: i2 + 1
    });
    startSegmentIndex = i2 + 1;
  }
  if (startSegmentIndex < segmentation.len) {
    chunks.push({
      startSegmentIndex,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len
    });
  }
  return chunks;
}
function mergeKeepAllTextSegments(segmentation) {
  if (segmentation.len <= 1)
    return segmentation;
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  let pendingTextParts = null;
  let pendingWordLike = false;
  let pendingStart = 0;
  let pendingContainsCJK = false;
  let pendingCanContinue = false;
  function flushPendingText() {
    if (pendingTextParts === null)
      return;
    texts.push(joinTextParts(pendingTextParts));
    isWordLike.push(pendingWordLike);
    kinds.push("text");
    starts.push(pendingStart);
    pendingTextParts = null;
  }
  for (let i2 = 0; i2 < segmentation.len; i2++) {
    const text = segmentation.texts[i2];
    const kind = segmentation.kinds[i2];
    const wordLike = segmentation.isWordLike[i2];
    const start = segmentation.starts[i2];
    if (kind === "text") {
      const textContainsCJK = containsCJKText(text);
      const textCanContinue = canContinueKeepAllTextRun(text);
      if (pendingTextParts !== null && pendingContainsCJK && pendingCanContinue) {
        pendingTextParts.push(text);
        pendingWordLike = pendingWordLike || wordLike;
        pendingContainsCJK = pendingContainsCJK || textContainsCJK;
        pendingCanContinue = textCanContinue;
        continue;
      }
      flushPendingText();
      pendingTextParts = [text];
      pendingWordLike = wordLike;
      pendingStart = start;
      pendingContainsCJK = textContainsCJK;
      pendingCanContinue = textCanContinue;
      continue;
    }
    flushPendingText();
    texts.push(text);
    isWordLike.push(wordLike);
    kinds.push(kind);
    starts.push(start);
  }
  flushPendingText();
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function analyzeText(text, profile, whiteSpace = "normal", wordBreak = "normal") {
  const whiteSpaceProfile = getWhiteSpaceProfile(whiteSpace);
  const normalized = whiteSpaceProfile.mode === "pre-wrap" ? normalizeWhitespacePreWrap(text) : normalizeWhitespaceNormal(text);
  if (normalized.length === 0) {
    return {
      normalized,
      chunks: [],
      len: 0,
      texts: [],
      isWordLike: [],
      kinds: [],
      starts: []
    };
  }
  const segmentation = wordBreak === "keep-all" ? mergeKeepAllTextSegments(buildMergedSegmentation(normalized, profile, whiteSpaceProfile)) : buildMergedSegmentation(normalized, profile, whiteSpaceProfile);
  return {
    normalized,
    chunks: compileAnalysisChunks(segmentation, whiteSpaceProfile),
    ...segmentation
  };
}

// node_modules/@chenglou/pretext/dist/measurement.js
var measureContext = null;
var segmentMetricCaches = /* @__PURE__ */ new Map();
var cachedEngineProfile = null;
var MAX_PREFIX_FIT_GRAPHEMES = 96;
var emojiPresentationRe = /\p{Emoji_Presentation}/u;
var maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
var sharedGraphemeSegmenter = null;
var emojiCorrectionCache = /* @__PURE__ */ new Map();
function getMeasureContext() {
  if (measureContext !== null)
    return measureContext;
  if (typeof OffscreenCanvas !== "undefined") {
    measureContext = new OffscreenCanvas(1, 1).getContext("2d");
    return measureContext;
  }
  if (typeof document !== "undefined") {
    measureContext = document.createElement("canvas").getContext("2d");
    return measureContext;
  }
  throw new Error("Text measurement requires OffscreenCanvas or a DOM canvas context.");
}
function getSegmentMetricCache(font) {
  let cache = segmentMetricCaches.get(font);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    segmentMetricCaches.set(font, cache);
  }
  return cache;
}
function getSegmentMetrics(seg, cache) {
  let metrics = cache.get(seg);
  if (metrics === void 0) {
    const ctx = getMeasureContext();
    metrics = {
      width: ctx.measureText(seg).width,
      containsCJK: isCJK(seg)
    };
    cache.set(seg, metrics);
  }
  return metrics;
}
function getEngineProfile() {
  if (cachedEngineProfile !== null)
    return cachedEngineProfile;
  if (typeof navigator === "undefined") {
    cachedEngineProfile = {
      lineFitEpsilon: 5e-3,
      carryCJKAfterClosingQuote: false,
      preferPrefixWidthsForBreakableRuns: false,
      preferEarlySoftHyphenBreak: false
    };
    return cachedEngineProfile;
  }
  const ua2 = navigator.userAgent;
  const vendor = navigator.vendor;
  const isSafari = vendor === "Apple Computer, Inc." && ua2.includes("Safari/") && !ua2.includes("Chrome/") && !ua2.includes("Chromium/") && !ua2.includes("CriOS/") && !ua2.includes("FxiOS/") && !ua2.includes("EdgiOS/");
  const isChromium = ua2.includes("Chrome/") || ua2.includes("Chromium/") || ua2.includes("CriOS/") || ua2.includes("Edg/");
  cachedEngineProfile = {
    lineFitEpsilon: isSafari ? 1 / 64 : 5e-3,
    carryCJKAfterClosingQuote: isChromium,
    preferPrefixWidthsForBreakableRuns: isSafari,
    preferEarlySoftHyphenBreak: isSafari
  };
  return cachedEngineProfile;
}
function parseFontSize(font) {
  const m2 = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return m2 ? parseFloat(m2[1]) : 16;
}
function getSharedGraphemeSegmenter() {
  if (sharedGraphemeSegmenter === null) {
    sharedGraphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  }
  return sharedGraphemeSegmenter;
}
function isEmojiGrapheme(g2) {
  return emojiPresentationRe.test(g2) || g2.includes("\uFE0F");
}
function textMayContainEmoji(text) {
  return maybeEmojiRe.test(text);
}
function getEmojiCorrection(font, fontSize) {
  let correction = emojiCorrectionCache.get(font);
  if (correction !== void 0)
    return correction;
  const ctx = getMeasureContext();
  ctx.font = font;
  const canvasW = ctx.measureText("\u{1F600}").width;
  correction = 0;
  if (canvasW > fontSize + 0.5 && typeof document !== "undefined" && document.body !== null) {
    const span = document.createElement("span");
    span.style.font = font;
    span.style.display = "inline-block";
    span.style.visibility = "hidden";
    span.style.position = "absolute";
    span.textContent = "\u{1F600}";
    document.body.appendChild(span);
    const domW = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    if (canvasW - domW > 0.5) {
      correction = canvasW - domW;
    }
  }
  emojiCorrectionCache.set(font, correction);
  return correction;
}
function countEmojiGraphemes(text) {
  let count = 0;
  const graphemeSegmenter = getSharedGraphemeSegmenter();
  for (const g2 of graphemeSegmenter.segment(text)) {
    if (isEmojiGrapheme(g2.segment))
      count++;
  }
  return count;
}
function getEmojiCount(seg, metrics) {
  if (metrics.emojiCount === void 0) {
    metrics.emojiCount = countEmojiGraphemes(seg);
  }
  return metrics.emojiCount;
}
function getCorrectedSegmentWidth(seg, metrics, emojiCorrection) {
  if (emojiCorrection === 0)
    return metrics.width;
  return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
}
function getSegmentBreakableFitAdvances(seg, metrics, cache, emojiCorrection, mode) {
  if (metrics.breakableFitAdvances !== void 0 && metrics.breakableFitMode === mode) {
    return metrics.breakableFitAdvances;
  }
  metrics.breakableFitMode = mode;
  const graphemeSegmenter = getSharedGraphemeSegmenter();
  const graphemes = [];
  for (const gs2 of graphemeSegmenter.segment(seg)) {
    graphemes.push(gs2.segment);
  }
  if (graphemes.length <= 1) {
    metrics.breakableFitAdvances = null;
    return metrics.breakableFitAdvances;
  }
  if (mode === "sum-graphemes") {
    const advances2 = [];
    for (const grapheme of graphemes) {
      const graphemeMetrics = getSegmentMetrics(grapheme, cache);
      advances2.push(getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection));
    }
    metrics.breakableFitAdvances = advances2;
    return metrics.breakableFitAdvances;
  }
  if (mode === "pair-context" || graphemes.length > MAX_PREFIX_FIT_GRAPHEMES) {
    const advances2 = [];
    let previousGrapheme = null;
    let previousWidth = 0;
    for (const grapheme of graphemes) {
      const graphemeMetrics = getSegmentMetrics(grapheme, cache);
      const currentWidth = getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection);
      if (previousGrapheme === null) {
        advances2.push(currentWidth);
      } else {
        const pair = previousGrapheme + grapheme;
        const pairMetrics = getSegmentMetrics(pair, cache);
        advances2.push(getCorrectedSegmentWidth(pair, pairMetrics, emojiCorrection) - previousWidth);
      }
      previousGrapheme = grapheme;
      previousWidth = currentWidth;
    }
    metrics.breakableFitAdvances = advances2;
    return metrics.breakableFitAdvances;
  }
  const advances = [];
  let prefix = "";
  let prefixWidth = 0;
  for (const grapheme of graphemes) {
    prefix += grapheme;
    const prefixMetrics = getSegmentMetrics(prefix, cache);
    const nextPrefixWidth = getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection);
    advances.push(nextPrefixWidth - prefixWidth);
    prefixWidth = nextPrefixWidth;
  }
  metrics.breakableFitAdvances = advances;
  return metrics.breakableFitAdvances;
}
function getFontMeasurementState(font, needsEmojiCorrection) {
  const ctx = getMeasureContext();
  ctx.font = font;
  const cache = getSegmentMetricCache(font);
  const fontSize = parseFontSize(font);
  const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font, fontSize) : 0;
  return { cache, fontSize, emojiCorrection };
}

// node_modules/@chenglou/pretext/dist/line-break.js
function consumesAtLineStart(kind) {
  return kind === "space" || kind === "zero-width-break" || kind === "soft-hyphen";
}
function breaksAfter(kind) {
  return kind === "space" || kind === "preserved-space" || kind === "tab" || kind === "zero-width-break" || kind === "soft-hyphen";
}
function normalizeLineStartSegmentIndex(prepared, segmentIndex, endSegmentIndex = prepared.widths.length) {
  while (segmentIndex < endSegmentIndex) {
    const kind = prepared.kinds[segmentIndex];
    if (!consumesAtLineStart(kind))
      break;
    segmentIndex++;
  }
  return segmentIndex;
}
function getTabAdvance(lineWidth, tabStopAdvance) {
  if (tabStopAdvance <= 0)
    return 0;
  const remainder = lineWidth % tabStopAdvance;
  if (Math.abs(remainder) <= 1e-6)
    return tabStopAdvance;
  return tabStopAdvance - remainder;
}
function getLeadingLetterSpacing(prepared, hasContent, segmentIndex) {
  return prepared.letterSpacing !== 0 && hasContent && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
}
function getLineEndContribution(leadingSpacing, segmentContribution) {
  return segmentContribution === 0 ? 0 : leadingSpacing + segmentContribution;
}
function getTabTrailingLetterSpacing(prepared, segmentIndex) {
  return prepared.letterSpacing !== 0 && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
}
function getWholeSegmentFitContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
  const segmentContribution = kind === "tab" ? segmentWidth + getTabTrailingLetterSpacing(prepared, segmentIndex) : prepared.lineEndFitAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing) {
  const segmentContribution = kind === "tab" ? 0 : prepared.lineEndFitAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
  const segmentContribution = kind === "tab" ? segmentWidth : prepared.lineEndPaintAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getBreakableGraphemeAdvance(prepared, hasContent, baseAdvance) {
  return prepared.letterSpacing !== 0 && hasContent ? baseAdvance + prepared.letterSpacing : baseAdvance;
}
function getBreakableCandidateFitWidth(prepared, candidatePaintWidth) {
  return prepared.letterSpacing === 0 ? candidatePaintWidth : candidatePaintWidth + prepared.letterSpacing;
}
function fitSoftHyphenBreak(graphemeFitAdvances, initialWidth, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, letterSpacing) {
  let fitCount = 0;
  let fittedWidth = initialWidth;
  while (fitCount < graphemeFitAdvances.length) {
    const nextWidth = fittedWidth + graphemeFitAdvances[fitCount] + letterSpacing;
    const nextLineWidth = fitCount + 1 < graphemeFitAdvances.length ? nextWidth + discretionaryHyphenWidth : nextWidth;
    if (nextLineWidth > maxWidth + lineFitEpsilon)
      break;
    fittedWidth = nextWidth;
    fitCount++;
  }
  return { fitCount, fittedWidth };
}
function walkPreparedLinesSimple(prepared, maxWidth, onLine) {
  const { widths, kinds, breakableFitAdvances } = prepared;
  if (widths.length === 0)
    return 0;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  let lineCount = 0;
  let lineW = 0;
  let hasContent = false;
  let lineStartSegmentIndex = 0;
  let lineStartGraphemeIndex = 0;
  let lineEndSegmentIndex = 0;
  let lineEndGraphemeIndex = 0;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakPaintWidth = 0;
  function clearPendingBreak() {
    pendingBreakSegmentIndex = -1;
    pendingBreakPaintWidth = 0;
  }
  function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
    lineCount++;
    onLine?.(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
    lineW = 0;
    hasContent = false;
    clearPendingBreak();
  }
  function startLineAtSegment(segmentIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
    lineW = width;
  }
  function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = graphemeIndex;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = graphemeIndex + 1;
    lineW = width;
  }
  function appendWholeSegment(segmentIndex, width) {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, width);
      return;
    }
    lineW += width;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
  }
  function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
    const fitAdvances = breakableFitAdvances[segmentIndex];
    for (let g2 = startGraphemeIndex; g2 < fitAdvances.length; g2++) {
      const gw = fitAdvances[g2];
      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g2, gw);
      } else if (lineW + gw > fitLimit) {
        emitCurrentLine();
        startLineAtGrapheme(segmentIndex, g2, gw);
      } else {
        lineW += gw;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = g2 + 1;
      }
    }
    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
  }
  let i2 = 0;
  while (i2 < widths.length) {
    if (!hasContent) {
      i2 = normalizeLineStartSegmentIndex(prepared, i2);
      if (i2 >= widths.length)
        break;
    }
    const w2 = widths[i2];
    const kind = kinds[i2];
    const breakAfter = breaksAfter(kind);
    if (!hasContent) {
      if (w2 > fitLimit && breakableFitAdvances[i2] !== null) {
        appendBreakableSegmentFrom(i2, 0);
      } else {
        startLineAtSegment(i2, w2);
      }
      if (breakAfter) {
        pendingBreakSegmentIndex = i2 + 1;
        pendingBreakPaintWidth = lineW - w2;
      }
      i2++;
      continue;
    }
    const newW = lineW + w2;
    if (newW > fitLimit) {
      if (breakAfter) {
        appendWholeSegment(i2, w2);
        emitCurrentLine(i2 + 1, 0, lineW - w2);
        i2++;
        continue;
      }
      if (pendingBreakSegmentIndex >= 0) {
        if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
          emitCurrentLine();
          continue;
        }
        emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
        continue;
      }
      if (w2 > fitLimit && breakableFitAdvances[i2] !== null) {
        emitCurrentLine();
        appendBreakableSegmentFrom(i2, 0);
        i2++;
        continue;
      }
      emitCurrentLine();
      continue;
    }
    appendWholeSegment(i2, w2);
    if (breakAfter) {
      pendingBreakSegmentIndex = i2 + 1;
      pendingBreakPaintWidth = lineW - w2;
    }
    i2++;
  }
  if (hasContent)
    emitCurrentLine();
  return lineCount;
}
function walkPreparedLinesRaw(prepared, maxWidth, onLine) {
  if (prepared.simpleLineWalkFastPath) {
    return walkPreparedLinesSimple(prepared, maxWidth, onLine);
  }
  const { widths, kinds, breakableFitAdvances, discretionaryHyphenWidth, chunks } = prepared;
  if (widths.length === 0 || chunks.length === 0)
    return 0;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  let lineCount = 0;
  let lineW = 0;
  let hasContent = false;
  let lineStartSegmentIndex = 0;
  let lineStartGraphemeIndex = 0;
  let lineEndSegmentIndex = 0;
  let lineEndGraphemeIndex = 0;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakFitWidth = 0;
  let pendingBreakPaintWidth = 0;
  let pendingBreakKind = null;
  function clearPendingBreak() {
    pendingBreakSegmentIndex = -1;
    pendingBreakFitWidth = 0;
    pendingBreakPaintWidth = 0;
    pendingBreakKind = null;
  }
  function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
    lineCount++;
    onLine?.(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
    lineW = 0;
    hasContent = false;
    clearPendingBreak();
  }
  function startLineAtSegment(segmentIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
    lineW = width;
  }
  function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = graphemeIndex;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = graphemeIndex + 1;
    lineW = width;
  }
  function appendWholeSegment(segmentIndex, advance) {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, advance);
      return;
    }
    lineW += advance;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
  }
  function updatePendingBreakForWholeSegment(kind, breakAfter, segmentIndex, segmentWidth, leadingSpacing, advance) {
    if (!breakAfter)
      return;
    const fitAdvance = getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing);
    const paintAdvance = getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth);
    pendingBreakSegmentIndex = segmentIndex + 1;
    pendingBreakFitWidth = lineW - advance + fitAdvance;
    pendingBreakPaintWidth = lineW - advance + paintAdvance;
    pendingBreakKind = kind;
  }
  function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
    const fitAdvances = breakableFitAdvances[segmentIndex];
    for (let g2 = startGraphemeIndex; g2 < fitAdvances.length; g2++) {
      const baseGw = fitAdvances[g2];
      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g2, baseGw);
      } else {
        const gw = getBreakableGraphemeAdvance(prepared, true, baseGw);
        const candidatePaintWidth = lineW + gw;
        if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
          emitCurrentLine();
          startLineAtGrapheme(segmentIndex, g2, baseGw);
        } else {
          lineW = candidatePaintWidth;
          lineEndSegmentIndex = segmentIndex;
          lineEndGraphemeIndex = g2 + 1;
        }
      }
    }
    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
  }
  function continueSoftHyphenBreakableSegment(segmentIndex) {
    if (pendingBreakKind !== "soft-hyphen")
      return false;
    const fitWidths = breakableFitAdvances[segmentIndex];
    if (fitWidths == null)
      return false;
    const { fitCount, fittedWidth } = fitSoftHyphenBreak(fitWidths, lineW, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, prepared.letterSpacing);
    if (fitCount === 0)
      return false;
    lineW = fittedWidth;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = fitCount;
    clearPendingBreak();
    if (fitCount === fitWidths.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
      return true;
    }
    emitCurrentLine(segmentIndex, fitCount, fittedWidth + discretionaryHyphenWidth);
    appendBreakableSegmentFrom(segmentIndex, fitCount);
    return true;
  }
  function emitEmptyChunk(chunk) {
    lineCount++;
    onLine?.(0, chunk.startSegmentIndex, 0, chunk.consumedEndSegmentIndex, 0);
    clearPendingBreak();
  }
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
      emitEmptyChunk(chunk);
      continue;
    }
    hasContent = false;
    lineW = 0;
    lineStartSegmentIndex = chunk.startSegmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = chunk.startSegmentIndex;
    lineEndGraphemeIndex = 0;
    clearPendingBreak();
    let i2 = chunk.startSegmentIndex;
    while (i2 < chunk.endSegmentIndex) {
      if (!hasContent) {
        i2 = normalizeLineStartSegmentIndex(prepared, i2, chunk.endSegmentIndex);
        if (i2 >= chunk.endSegmentIndex)
          break;
      }
      const kind = kinds[i2];
      const breakAfter = breaksAfter(kind);
      const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i2);
      const w2 = kind === "tab" ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance) : widths[i2];
      const advance = leadingSpacing + w2;
      const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i2, leadingSpacing, w2);
      if (kind === "soft-hyphen") {
        if (hasContent) {
          lineEndSegmentIndex = i2 + 1;
          lineEndGraphemeIndex = 0;
          pendingBreakSegmentIndex = i2 + 1;
          pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
          pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
          pendingBreakKind = kind;
        }
        i2++;
        continue;
      }
      if (!hasContent) {
        if (fitAdvance > fitLimit && breakableFitAdvances[i2] !== null) {
          appendBreakableSegmentFrom(i2, 0);
        } else {
          startLineAtSegment(i2, w2);
        }
        updatePendingBreakForWholeSegment(kind, breakAfter, i2, w2, leadingSpacing, advance);
        i2++;
        continue;
      }
      const newFitW = lineW + fitAdvance;
      if (newFitW > fitLimit) {
        const currentBreakFitWidth = lineW + getBreakOpportunityFitContribution(prepared, kind, i2, leadingSpacing);
        const currentBreakPaintWidth = lineW + getLineEndPaintContribution(prepared, kind, i2, leadingSpacing, w2);
        if (pendingBreakKind === "soft-hyphen" && engineProfile.preferEarlySoftHyphenBreak && pendingBreakFitWidth <= fitLimit) {
          emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
          continue;
        }
        if (pendingBreakKind === "soft-hyphen" && continueSoftHyphenBreakableSegment(i2)) {
          i2++;
          continue;
        }
        if (breakAfter && currentBreakFitWidth <= fitLimit) {
          appendWholeSegment(i2, advance);
          emitCurrentLine(i2 + 1, 0, currentBreakPaintWidth);
          i2++;
          continue;
        }
        if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
          if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
            emitCurrentLine();
            continue;
          }
          const nextSegmentIndex = pendingBreakSegmentIndex;
          emitCurrentLine(nextSegmentIndex, 0, pendingBreakPaintWidth);
          i2 = nextSegmentIndex;
          continue;
        }
        if (fitAdvance > fitLimit && breakableFitAdvances[i2] !== null) {
          emitCurrentLine();
          appendBreakableSegmentFrom(i2, 0);
          i2++;
          continue;
        }
        emitCurrentLine();
        continue;
      }
      appendWholeSegment(i2, advance);
      updatePendingBreakForWholeSegment(kind, breakAfter, i2, w2, leadingSpacing, advance);
      i2++;
    }
    if (hasContent) {
      const finalPaintWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex ? pendingBreakPaintWidth : lineW;
      emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth);
    }
  }
  return lineCount;
}

// node_modules/@chenglou/pretext/dist/layout.js
var sharedGraphemeSegmenter2 = null;
function getSharedGraphemeSegmenter2() {
  if (sharedGraphemeSegmenter2 === null) {
    sharedGraphemeSegmenter2 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  }
  return sharedGraphemeSegmenter2;
}
function createEmptyPrepared(includeSegments) {
  if (includeSegments) {
    return {
      widths: [],
      lineEndFitAdvances: [],
      lineEndPaintAdvances: [],
      kinds: [],
      simpleLineWalkFastPath: true,
      segLevels: null,
      breakableFitAdvances: [],
      letterSpacing: 0,
      spacingGraphemeCounts: [],
      discretionaryHyphenWidth: 0,
      tabStopAdvance: 0,
      chunks: [],
      segments: []
    };
  }
  return {
    widths: [],
    lineEndFitAdvances: [],
    lineEndPaintAdvances: [],
    kinds: [],
    simpleLineWalkFastPath: true,
    segLevels: null,
    breakableFitAdvances: [],
    letterSpacing: 0,
    spacingGraphemeCounts: [],
    discretionaryHyphenWidth: 0,
    tabStopAdvance: 0,
    chunks: []
  };
}
function buildBaseCjkUnits(segText, engineProfile) {
  const units = [];
  let unitParts = [];
  let unitStart = 0;
  let unitContainsCJK = false;
  let unitEndsWithClosingQuote = false;
  let unitIsSingleKinsokuEnd = false;
  function pushUnit() {
    if (unitParts.length === 0)
      return;
    units.push({
      text: unitParts.length === 1 ? unitParts[0] : unitParts.join(""),
      start: unitStart
    });
    unitParts = [];
    unitContainsCJK = false;
    unitEndsWithClosingQuote = false;
    unitIsSingleKinsokuEnd = false;
  }
  function startUnit(grapheme, start, graphemeContainsCJK) {
    unitParts = [grapheme];
    unitStart = start;
    unitContainsCJK = graphemeContainsCJK;
    unitEndsWithClosingQuote = endsWithClosingQuote(grapheme);
    unitIsSingleKinsokuEnd = kinsokuEnd.has(grapheme);
  }
  function appendToUnit(grapheme, graphemeContainsCJK) {
    unitParts.push(grapheme);
    unitContainsCJK = unitContainsCJK || graphemeContainsCJK;
    const graphemeEndsWithClosingQuote = endsWithClosingQuote(grapheme);
    if (grapheme.length === 1 && leftStickyPunctuation.has(grapheme)) {
      unitEndsWithClosingQuote = unitEndsWithClosingQuote || graphemeEndsWithClosingQuote;
    } else {
      unitEndsWithClosingQuote = graphemeEndsWithClosingQuote;
    }
    unitIsSingleKinsokuEnd = false;
  }
  for (const gs2 of getSharedGraphemeSegmenter2().segment(segText)) {
    const grapheme = gs2.segment;
    const graphemeContainsCJK = isCJK(grapheme);
    if (unitParts.length === 0) {
      startUnit(grapheme, gs2.index, graphemeContainsCJK);
      continue;
    }
    if (unitIsSingleKinsokuEnd || kinsokuStart.has(grapheme) || leftStickyPunctuation.has(grapheme) || engineProfile.carryCJKAfterClosingQuote && graphemeContainsCJK && unitEndsWithClosingQuote) {
      appendToUnit(grapheme, graphemeContainsCJK);
      continue;
    }
    if (!unitContainsCJK && !graphemeContainsCJK) {
      appendToUnit(grapheme, graphemeContainsCJK);
      continue;
    }
    pushUnit();
    startUnit(grapheme, gs2.index, graphemeContainsCJK);
  }
  pushUnit();
  return units;
}
function mergeKeepAllTextUnits(units) {
  if (units.length <= 1)
    return units;
  const merged = [];
  let currentTextParts = [units[0].text];
  let currentStart = units[0].start;
  let currentContainsCJK = isCJK(units[0].text);
  let currentCanContinue = canContinueKeepAllTextRun(units[0].text);
  function flushCurrent() {
    merged.push({
      text: currentTextParts.length === 1 ? currentTextParts[0] : currentTextParts.join(""),
      start: currentStart
    });
  }
  for (let i2 = 1; i2 < units.length; i2++) {
    const next = units[i2];
    const nextContainsCJK = isCJK(next.text);
    const nextCanContinue = canContinueKeepAllTextRun(next.text);
    if (currentContainsCJK && currentCanContinue) {
      currentTextParts.push(next.text);
      currentContainsCJK = currentContainsCJK || nextContainsCJK;
      currentCanContinue = nextCanContinue;
      continue;
    }
    flushCurrent();
    currentTextParts = [next.text];
    currentStart = next.start;
    currentContainsCJK = nextContainsCJK;
    currentCanContinue = nextCanContinue;
  }
  flushCurrent();
  return merged;
}
function countRenderedSpacingGraphemes(text, kind) {
  if (kind === "zero-width-break" || kind === "soft-hyphen" || kind === "hard-break") {
    return 0;
  }
  if (kind === "tab")
    return 1;
  let count = 0;
  const graphemeSegmenter = getSharedGraphemeSegmenter2();
  for (const _2 of graphemeSegmenter.segment(text))
    count++;
  return count;
}
function addInternalLetterSpacing(width, graphemeCount, letterSpacing) {
  return graphemeCount > 1 ? width + (graphemeCount - 1) * letterSpacing : width;
}
function measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing) {
  const engineProfile = getEngineProfile();
  const { cache, emojiCorrection } = getFontMeasurementState(font, textMayContainEmoji(analysis.normalized));
  const discretionaryHyphenWidth = getCorrectedSegmentWidth("-", getSegmentMetrics("-", cache), emojiCorrection) + (letterSpacing === 0 ? 0 : letterSpacing);
  const spaceWidth = getCorrectedSegmentWidth(" ", getSegmentMetrics(" ", cache), emojiCorrection);
  const tabStopAdvance = spaceWidth * 8;
  const hasLetterSpacing = letterSpacing !== 0;
  if (analysis.len === 0)
    return createEmptyPrepared(includeSegments);
  const widths = [];
  const lineEndFitAdvances = [];
  const lineEndPaintAdvances = [];
  const kinds = [];
  let simpleLineWalkFastPath = analysis.chunks.length <= 1 && !hasLetterSpacing;
  const segStarts = includeSegments ? [] : null;
  const breakableFitAdvances = [];
  const spacingGraphemeCounts = [];
  const segments = includeSegments ? [] : null;
  const preparedStartByAnalysisIndex = Array.from({ length: analysis.len });
  function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, breakableFitAdvance, spacingGraphemeCount) {
    if (kind !== "text" && kind !== "space" && kind !== "zero-width-break") {
      simpleLineWalkFastPath = false;
    }
    widths.push(width);
    lineEndFitAdvances.push(lineEndFitAdvance);
    lineEndPaintAdvances.push(lineEndPaintAdvance);
    kinds.push(kind);
    segStarts?.push(start);
    breakableFitAdvances.push(breakableFitAdvance);
    if (hasLetterSpacing)
      spacingGraphemeCounts.push(spacingGraphemeCount);
    if (segments !== null)
      segments.push(text);
  }
  function pushMeasuredTextSegment(text, kind, start, wordLike, allowOverflowBreaks) {
    const textMetrics = getSegmentMetrics(text, cache);
    const spacingGraphemeCount = hasLetterSpacing ? countRenderedSpacingGraphemes(text, kind) : 0;
    const width = addInternalLetterSpacing(getCorrectedSegmentWidth(text, textMetrics, emojiCorrection), spacingGraphemeCount, letterSpacing);
    const baseLineEndFitAdvance = kind === "space" || kind === "preserved-space" || kind === "zero-width-break" ? 0 : width;
    const lineEndFitAdvance = baseLineEndFitAdvance === 0 ? 0 : baseLineEndFitAdvance + (spacingGraphemeCount > 0 ? letterSpacing : 0);
    const lineEndPaintAdvance = kind === "space" || kind === "zero-width-break" ? 0 : width;
    if (allowOverflowBreaks && wordLike && text.length > 1) {
      let fitMode = "sum-graphemes";
      if (letterSpacing !== 0) {
        fitMode = "segment-prefixes";
      } else if (isNumericRunSegment(text)) {
        fitMode = "pair-context";
      } else if (engineProfile.preferPrefixWidthsForBreakableRuns) {
        fitMode = "segment-prefixes";
      }
      const fitAdvances = getSegmentBreakableFitAdvances(text, textMetrics, cache, emojiCorrection, fitMode);
      pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, fitAdvances, spacingGraphemeCount);
      return;
    }
    pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, null, spacingGraphemeCount);
  }
  for (let mi3 = 0; mi3 < analysis.len; mi3++) {
    preparedStartByAnalysisIndex[mi3] = widths.length;
    const segText = analysis.texts[mi3];
    const segWordLike = analysis.isWordLike[mi3];
    const segKind = analysis.kinds[mi3];
    const segStart = analysis.starts[mi3];
    if (segKind === "soft-hyphen") {
      pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, segStart, null, 0);
      continue;
    }
    if (segKind === "hard-break") {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, 0);
      continue;
    }
    if (segKind === "tab") {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, hasLetterSpacing ? countRenderedSpacingGraphemes(segText, segKind) : 0);
      continue;
    }
    const segMetrics = getSegmentMetrics(segText, cache);
    if (segKind === "text" && segMetrics.containsCJK) {
      const baseUnits = buildBaseCjkUnits(segText, engineProfile);
      const measuredUnits = wordBreak === "keep-all" ? mergeKeepAllTextUnits(baseUnits) : baseUnits;
      for (let i2 = 0; i2 < measuredUnits.length; i2++) {
        const unit = measuredUnits[i2];
        pushMeasuredTextSegment(unit.text, "text", segStart + unit.start, segWordLike, wordBreak === "keep-all" || !isCJK(unit.text));
      }
      continue;
    }
    pushMeasuredTextSegment(segText, segKind, segStart, segWordLike, true);
  }
  const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, widths.length);
  const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
  if (segments !== null) {
    return {
      widths,
      lineEndFitAdvances,
      lineEndPaintAdvances,
      kinds,
      simpleLineWalkFastPath,
      segLevels,
      breakableFitAdvances,
      letterSpacing,
      spacingGraphemeCounts,
      discretionaryHyphenWidth,
      tabStopAdvance,
      chunks,
      segments
    };
  }
  return {
    widths,
    lineEndFitAdvances,
    lineEndPaintAdvances,
    kinds,
    simpleLineWalkFastPath,
    segLevels,
    breakableFitAdvances,
    letterSpacing,
    spacingGraphemeCounts,
    discretionaryHyphenWidth,
    tabStopAdvance,
    chunks
  };
}
function mapAnalysisChunksToPreparedChunks(chunks, preparedStartByAnalysisIndex, preparedEndSegmentIndex) {
  const preparedChunks = [];
  for (let i2 = 0; i2 < chunks.length; i2++) {
    const chunk = chunks[i2];
    const startSegmentIndex = chunk.startSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.startSegmentIndex] : preparedEndSegmentIndex;
    const endSegmentIndex = chunk.endSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.endSegmentIndex] : preparedEndSegmentIndex;
    const consumedEndSegmentIndex = chunk.consumedEndSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.consumedEndSegmentIndex] : preparedEndSegmentIndex;
    preparedChunks.push({
      startSegmentIndex,
      endSegmentIndex,
      consumedEndSegmentIndex
    });
  }
  return preparedChunks;
}
function prepareInternal(text, font, includeSegments, options) {
  const wordBreak = options?.wordBreak ?? "normal";
  const letterSpacing = options?.letterSpacing ?? 0;
  const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace, wordBreak);
  return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing);
}
function prepareWithSegments(text, font, options) {
  return prepareInternal(text, font, true, options);
}
function getInternalPrepared(prepared) {
  return prepared;
}
function measureNaturalWidth(prepared) {
  let maxWidth = 0;
  walkPreparedLinesRaw(getInternalPrepared(prepared), Number.POSITIVE_INFINITY, (width) => {
    if (width > maxWidth)
      maxWidth = width;
  });
  return maxWidth;
}

// src/client/demo-leafer.ts
var NODE_H = 44;
var NODE_GAP = 2;
var INDENT = 20;
var PAD_L = 16;
var FONT = "12px -apple-system, sans-serif";
var C2 = {
  nodeBg: "rgba(10,10,15,.6)",
  nodeHover: "rgba(10,10,15,.8)",
  nodeSelected: "rgba(124,58,237,.15)",
  border: "rgba(124,58,237,.3)",
  borderSel: "rgba(0,212,255,.7)",
  cursor: "rgba(0,212,255,.7)",
  text: "#e0e0e0",
  dir: "#7c3aed",
  file: "#888"
};
var tree = [
  { name: "src", isDir: true, level: 0, path: "/src" },
  { name: "app.ts", isDir: false, level: 1, path: "/src/app.ts" },
  { name: "ui.ts", isDir: false, level: 1, path: "/src/ui.ts" },
  { name: "tree.ts", isDir: false, level: 1, path: "/src/tree.ts" },
  { name: "modules", isDir: true, level: 1, path: "/src/modules" },
  { name: "tree-leafer.ts", isDir: false, level: 2, path: "/src/modules/tree-leafer.ts" },
  { name: "tree-text.ts", isDir: false, level: 2, path: "/src/modules/tree-text.ts" },
  { name: "ui.ts", isDir: false, level: 2, path: "/src/modules/ui.ts" },
  { name: "orb.ts", isDir: false, level: 2, path: "/src/modules/orb.ts" },
  { name: "gestures.ts", isDir: false, level: 2, path: "/src/modules/gestures.ts" },
  { name: "public", isDir: true, level: 0, path: "/public" },
  { name: "index.html", isDir: false, level: 1, path: "/public/index.html" },
  { name: "bundle.js", isDir: false, level: 1, path: "/public/bundle.js" },
  { name: "css", isDir: true, level: 1, path: "/public/css" },
  { name: "base.css", isDir: false, level: 2, path: "/public/css/base.css" },
  { name: "sidebar.css", isDir: false, level: 2, path: "/public/css/sidebar.css" },
  { name: "package.json", isDir: false, level: 0, path: "/package.json" },
  { name: "tsconfig.json", isDir: false, level: 0, path: "/tsconfig.json" },
  { name: "build.mjs", isDir: false, level: 0, path: "/build.mjs" },
  { name: "README.md", isDir: false, level: 0, path: "/README.md" }
];
var container = document.getElementById("tree-canvas");
var rect = container.getBoundingClientRect();
var t0 = performance.now();
var leafer = new xe2({
  view: container,
  width: rect.width,
  height: rect.height,
  fill: "transparent",
  type: "draw"
});
var content = new ve2();
leafer.add(content);
function measureNodeWidth(name) {
  const prepared = prepareWithSegments(name, FONT);
  return measureNaturalWidth(prepared);
}
var selectedIdx = -1;
var cursorRect = new Se2({
  width: rect.width,
  height: NODE_H,
  fill: "transparent",
  stroke: C2.cursor,
  strokeWidth: 1.5,
  opacity: 0
});
content.add(cursorRect);
var y2 = 4;
var nodes = [];
for (let i2 = 0; i2 < tree.length; i2++) {
  const item = tree[i2];
  const indent = item.level * INDENT;
  const w2 = rect.width - indent - 8;
  const grp = new ve2({ x: 4, y: y2 });
  const bg = new Se2({
    x: indent,
    y: 0,
    width: w2,
    height: NODE_H,
    fill: C2.nodeBg,
    cornerRadius: 6
  });
  const leftLine = new ei2({
    points: [indent + 1.5, 6, indent + 1.5, NODE_H - 6],
    stroke: C2.border,
    strokeWidth: 3
  });
  const icon = item.isDir ? "\u{1F4C2}" : "\u{1F4C4}";
  const iconEl = new di2({
    text: icon,
    x: indent + PAD_L,
    y: 14,
    fontSize: 14
  });
  const label = new di2({
    text: item.name,
    x: indent + PAD_L + 22,
    y: (NODE_H - 14) / 2,
    fill: C2.text,
    fontSize: 12,
    fontFamily: "-apple-system, sans-serif"
  });
  if (item.level > 0) {
    const lineX = indent - INDENT / 2 + 6;
    const connLine = new ei2({
      points: [lineX, y2 + 6, lineX, y2 + NODE_H / 2, indent + 4, y2 + NODE_H / 2],
      stroke: "rgba(124,58,237,.2)",
      strokeWidth: 1
    });
    content.add(connLine);
  }
  grp.add(bg);
  grp.add(leftLine);
  grp.add(iconEl);
  grp.add(label);
  content.add(grp);
  const nodeY = y2;
  const nodeIndent = indent;
  const nodeW = w2;
  nodes.push({ grp, bg, leftLine, label, y: nodeY, data: item });
  grp.on("pointer.tap", () => {
    if (selectedIdx >= 0 && selectedIdx < nodes.length) {
      const old = nodes[selectedIdx];
      gsapWithCSS.to(old.bg, { fill: C2.nodeBg, duration: 0.2 });
      gsapWithCSS.to(old.leftLine, { stroke: C2.border, duration: 0.2 });
    }
    selectedIdx = i2;
    gsapWithCSS.to(bg, { fill: C2.nodeSelected, duration: 0.2 });
    gsapWithCSS.to(leftLine, { stroke: C2.borderSel, duration: 0.2 });
    gsapWithCSS.to(cursorRect, {
      x: nodeIndent + 4,
      y: nodeY,
      width: nodeW,
      opacity: 0.7,
      duration: 0.3,
      ease: "power2.out"
    });
    updateInfo(item);
  });
  grp.on("pointer.enter", () => {
    if (selectedIdx !== i2) gsapWithCSS.to(bg, { fill: C2.nodeHover, duration: 0.15 });
  });
  grp.on("pointer.leave", () => {
    if (selectedIdx !== i2) gsapWithCSS.to(bg, { fill: C2.nodeBg, duration: 0.15 });
  });
  y2 += NODE_H + NODE_GAP;
}
var t1 = performance.now();
var tl = gsapWithCSS.timeline();
for (let i2 = 0; i2 < nodes.length; i2++) {
  const n2 = nodes[i2];
  n2.grp.x = -40;
  n2.grp.opacity = 0;
  tl.to(n2.grp, { x: 4, opacity: 1, duration: 0.2, ease: "power2.out" }, i2 * 0.03);
}
function updateInfo(item) {
  const perfEl2 = document.getElementById("perf");
  const tw = measureNodeWidth(item.name);
  perfEl2.innerHTML = `
    <p>\u9009\u4E2D: <span>${item.path}</span></p>
    <p>\u7C7B\u578B: <span>${item.isDir ? "\u76EE\u5F55" : "\u6587\u4EF6"}</span></p>
    <p>\u5C42\u7EA7: <span>${item.level}</span></p>
    <p>Pretext \u81EA\u7136\u5BBD\u5EA6: <span>${tw.toFixed(1)}px</span></p>
    <p>\u6E32\u67D3\u8017\u65F6: <span>${(t1 - t0).toFixed(1)}ms</span></p>
  `;
}
var perfEl = document.getElementById("perf");
perfEl.innerHTML = `
  <p>\u8282\u70B9\u6570: <span>${tree.length}</span></p>
  <p>\u6E32\u67D3\u8017\u65F6: <span>${(t1 - t0).toFixed(1)}ms</span></p>
  <p>\u70B9\u51FB\u8282\u70B9\u67E5\u770B\u8BE6\u60C5</p>
`;
/*! Bundled license information:

gsap/gsap-core.js:
  (*!
   * GSAP 3.15.0
   * https://gsap.com
   *
   * @license Copyright 2008-2026, GreenSock. All rights reserved.
   * Subject to the terms at https://gsap.com/standard-license
   * @author: Jack Doyle, jack@greensock.com
  *)

gsap/CSSPlugin.js:
  (*!
   * CSSPlugin 3.15.0
   * https://gsap.com
   *
   * Copyright 2008-2026, GreenSock. All rights reserved.
   * Subject to the terms at https://gsap.com/standard-license
   * @author: Jack Doyle, jack@greensock.com
  *)
*/
