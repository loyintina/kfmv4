// Preload: browser globals for Node.js test environment
// Keep in sync with all modules under test

// ========== localStorage ==========
const _store = {};
globalThis.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
};

// ========== Timer wrappers ==========
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// ========== Performance ==========
if (!globalThis.performance) {
  globalThis.performance = { now: () => Date.now() };
}

// ========== Console ==========
const _origLog = console.log;
// Keep a log for test assertions
globalThis.__testLogs = [];
console.log = (...args) => { __testLogs.push(args.join(' ')); _origLog(...args); };
console.warn = (...args) => { console.log('[WARN]', ...args); };
console.error = (...args) => { console.log('[ERROR]', ...args); };

// ========== Style mock ==========
function makeStyle(initial) {
  const s = {
    _values: { ...initial },
    setProperty(prop, val) { this._values[prop] = val; },
    removeProperty(prop) { delete this._values[prop]; },
    getPropertyValue(prop) { return this._values[prop] ?? ''; },
    get cssText() {
      return Object.entries(this._values)
        .map(([k, v]) => `${k}:${v}`).join(';');
    },
    set cssText(val) {
      this._values = {};
      if (val) {
        for (const part of val.split(';')) {
          const idx = part.indexOf(':');
          if (idx > 0) {
            this._values[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
          }
        }
      }
    },
  };
  // Proxy: s.color = '#fff' → s._values.color = '#fff'
  return new Proxy(s, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return target._values[prop] ?? '';
    },
    set(target, prop, val) {
      if (prop in target) { target[prop] = val; return true; }
      if (typeof prop === 'string' && !prop.startsWith('_')) {
        target._values[prop] = val;
      }
      return true;
    },
    has(target, prop) { return prop in target || prop in target._values; },
  });
}

// ========== Element mock with layout computation ==========
function makeElement(tag, overrides) {
  const children = [];

  function _calcScrollHeight() {
    if (children.length === 0) return 0;
    let maxBottom = 0;
    for (const c of children) {
      const cRect = typeof c.getBoundingClientRect === 'function' ? c.getBoundingClientRect() : null;
      const cH = (cRect && cRect.height) || c.offsetHeight || 0;
      const cTop = c.offsetTop || 0;
      maxBottom = Math.max(maxBottom, cTop + cH);
    }
    return maxBottom;
  }

  function _parsePx(val, fallback) {
    if (typeof val === 'string' && val.endsWith('px')) return parseFloat(val) || fallback;
    return fallback;
  }

  function _getStyleVal(name, fallback) {
    const v = el.style?._values?.[name];
    return v !== undefined && v !== '' ? _parsePx(v, fallback) : fallback;
  }

  function _isOverflowScrollY() {
    const ov = el.style?._values?.overflowY || el.style?._values?.overflow || '';
    return ov === 'auto' || ov === 'scroll';
  }

  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    dataset: {},
    style: makeStyle({}),
    classList: {
      _classes: [],
      add: (...names) => { for (const n of names) if (!el.classList._classes.includes(n)) el.classList._classes.push(n); },
      remove: (...names) => { el.classList._classes = el.classList._classes.filter(c => !names.includes(c)); },
      toggle: (name) => {
        const i = el.classList._classes.indexOf(name);
        if (i >= 0) el.classList._classes.splice(i, 1);
        else el.classList._classes.push(name);
      },
      contains: (name) => el.classList._classes.includes(name),
    },
    textContent: '',
    innerHTML: '',
    children,
    parentElement: null,
    parentNode: null,
    firstChild: null,
    lastChild: null,
    scrollLeft: 0,
    offsetWidth: 295,
    offsetHeight: 618,
    _listeners: {},
    addEventListener(type, fn, opts) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push({ fn, opts });
    },
    removeEventListener(type, fn, opts) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter(e => e.fn !== fn || e.opts !== opts);
    },
    _removeAllListeners() {
      this._listeners = {};
    },
    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      for (const h of handlers) h.fn(event);
      if (event.bubbles !== false && this.parentElement) {
        this.parentElement.dispatchEvent(event);
      }
    },
    getBoundingClientRect() {
      const left = _parsePx(this.style._values?.left, 0);
      const top = _parsePx(this.style._values?.top, 0);
      const w = _parsePx(this.style._values?.width, this.clientWidth || 0);
      const h = _parsePx(this.style._values?.height, this.clientHeight || 0);
      return { left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top };
    },
    closest(selector) {
      if (!selector) return null;
      let e = this;
      while (e) {
        if (typeof e.matches === 'function' && e.matches(selector)) return e;
        e = e.parentElement;
      }
      return null;
    },
    matches(selector) {
      if (!selector) return false;
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      return this.tagName === selector.toUpperCase();
    },
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        for (const c of this.children || []) {
          if (c.classList?.contains(cls)) return c;
          const found = c.querySelector?.(sel);
          if (found) return found;
        }
      } else if (sel.startsWith('#')) {
        const id = sel.slice(1);
        function walk(el) {
          for (const c of el.children || []) {
            if (c.id === id) return c;
            const found = walk(c);
            if (found) return found;
          }
          return null;
        }
        return walk(this);
      }
      return null;
    },
    querySelectorAll(sel) {
      const results = [];
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        function walk(el) {
          for (const c of el.children || []) {
            if (c.classList?.contains(cls)) results.push(c);
            walk(c);
          }
        }
        walk(this);
      }
      return results;
    },
    appendChild(child) {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild(child) {
      const arr = this.children;
      const i = arr.indexOf(child);
      if (i >= 0) arr.splice(i, 1);
      child.parentElement = null;
      child.parentNode = null;
    },
    insertBefore(newChild, refChild) {
      const i = this.children.indexOf(refChild);
      newChild.parentElement = this;
      newChild.parentNode = this;
      if (i >= 0) this.children.splice(i, 0, newChild);
      else this.children.push(newChild);
    },
    setAttribute(name, val) { this[name] = val; },
    getAttribute(name) { return this[name] ?? null; },
    removeAttribute(name) { delete this[name]; },
    focus() {},
    blur() {},
    contains(child) { return this.children.includes(child); },
    animate: (keyframes, opts) => ({
      play: () => {},
      pause: () => {},
      finish: () => { opts?.onfinish?.(); },
      cancel: () => {},
      onfinish: null,
      currentTime: 0,
      playbackRate: 1,
    }),
    remove() {
      if (this.parentElement) {
        this.parentElement.removeChild(this);
      }
    },

    // Canvas context mock for text measurement
    getContext(type) {
      if (type === '2d') {
        return {
          font: '',
          globalAlpha: 1,
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          measureText: (text) => ({ width: text.length * 7 }),
          fillText: () => {}, strokeText: () => {},
          save: () => {}, restore: () => {},
          beginPath: () => {}, closePath: () => {},
          fill: () => {}, stroke: () => {},
          arc: () => {}, moveTo: () => {}, lineTo: () => {},
          translate: () => {}, scale: () => {}, rotate: () => {},
          setTransform: () => {}, transform: () => {},
          clearRect: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          clip: () => {},
          rect: () => {},
        };
      }
      return null;
    },
    // offsetTop: computed from parent
    get offsetTop() {
      if (!this.parentElement) return 0;
      const parentRect = this.parentElement.getBoundingClientRect();
      const myRect = this.getBoundingClientRect();
      return myRect.top - parentRect.top;
    },
    ...overrides,
  };

  // Computed scroll properties
  Object.defineProperty(el, 'scrollHeight', {
    get: function () { return Math.max(_calcScrollHeight(), this.clientHeight); },
    set: function () {},
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(el, 'clientHeight', {
    get: function () { return _getStyleVal('height', 618); },
    set: function (v) { this.style.height = String(v) + 'px'; },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(el, 'clientWidth', {
    get: function () { return _getStyleVal('width', 295); },
    set: function (v) { this.style.width = String(v) + 'px'; },
    enumerable: true,
    configurable: true,
  });

  let _scrollTop = 0;
  Object.defineProperty(el, 'scrollTop', {
    get: function () {
      if (!_isOverflowScrollY()) return 0;
      return _scrollTop;
    },
    set: function (v) {
      if (!_isOverflowScrollY()) return;
      const maxScroll = Math.max(0, this.scrollHeight - this.clientHeight);
      _scrollTop = Math.max(0, Math.min(maxScroll, v));
    },
    enumerable: true,
    configurable: true,
  });

  // className 设置时同步到 classList
  let _className = '';
  Object.defineProperty(el, 'className', {
    get: function () { return _className; },
    set: function (v) {
      _className = v;
      this.classList._classes = v ? v.split(/\s+/) : [];
    },
    enumerable: true,
    configurable: true,
  });

  return el;
}

// ========== document ==========
const _docEl = makeElement('html', { id: 'documentElement' });
const _bodyEl = makeElement('body', { id: 'bodyElement' });
_docEl.appendChild(_bodyEl);

globalThis.document = {
  documentElement: _docEl,
  body: _bodyEl,
  createElement: (tag) => makeElement(tag),
  querySelector: (sel) => _docEl.querySelector(sel),
  querySelectorAll: (sel) => _docEl.querySelectorAll(sel),
  getElementById: (id) => (id === 'documentElement' ? _docEl : id === 'bodyElement' ? _bodyEl : null),
  createTextNode: (text) => ({ textContent: text, nodeType: 3 }),
  head: makeElement('head'),
  addEventListener: (type, fn) => _docEl.addEventListener(type, fn),
  removeEventListener: (type, fn) => _docEl.removeEventListener(type, fn),
  dispatchEvent: (event) => _docEl.dispatchEvent(event),
};

// ========== window ==========
globalThis.window = globalThis;
globalThis.window.innerWidth = 414;     // iPhone-ish
globalThis.window.innerHeight = 896;
// PointerEvent mock (gesture-registry uses pointer events)
class MockPointerEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.clientX = init.clientX || 0;
    this.clientY = init.clientY || 0;
    this.pointerId = init.pointerId || 1;
    this.pointerType = init.pointerType || 'touch';
    this.button = init.button ?? 0;
    this.bubbles = init.bubbles !== false;
    this.isPrimary = init.isPrimary ?? true;
    this.target = init.target || _bodyEl;
    this._defaultPrevented = false;
    this._propagationStopped = false;
  }
  preventDefault() { this._defaultPrevented = true; }
  stopPropagation() { this._propagationStopped = true; }
}
globalThis.PointerEvent = MockPointerEvent;
// MouseEvent mock
class MockMouseEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.clientX = init.clientX || 0;
    this.clientY = init.clientY || 0;
    this.button = init.button || 0;
    this.bubbles = init.bubbles !== false;
    this.target = init.target || null;
  }
}
globalThis.MouseEvent = MockMouseEvent;


// CSS
globalThis.CSS = {
  supports: () => false,
  escape: (s) => s,
};

// URL：保留原生构造/解析能力，仅补上 jsdom 没有的 createObjectURL/revokeObjectURL
globalThis.URL.createObjectURL = () => '';
globalThis.URL.revokeObjectURL = () => {};
globalThis.Blob = class Blob {};

// Test helpers
globalThis.__clearDocumentListeners = () => {
  _docEl._removeAllListeners();
};
