// Preload: browser globals for Node.js test environment
// Keep in sync with all modules under test

// ========== localStorage ==========
const _store = {};
globalThis.localStorage = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
  get length() { return Object.keys(_store).length; },
  key: (i) => Object.keys(_store)[i] ?? null,
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

// ========== Simple mock for element .style ==========
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

// ========== Element mock ==========
function makeElement(tag, overrides) {
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
    children: [],
    parentElement: null,
    parentNode: null,
    firstChild: null,
    lastChild: null,
    scrollTop: 0,
    scrollLeft: 0,
    clientWidth: 295,
    clientHeight: 618,
    offsetWidth: 295,
    offsetHeight: 618,
    _listeners: {},
    addEventListener(type, fn, opts) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push({ fn, opts });
    },
    removeEventListener(type, fn, opts) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter(
        e => e.fn !== fn || e.opts !== opts
      );
    },
    /** 移除所有事件监听（测试隔离用） */
    _removeAllListeners() {
      this._listeners = {};
    },
    dispatchEvent(event) {
      const handlers = this._listeners[event.type] || [];
      for (const h of handlers) h.fn(event);
      // Bubbling
      if (event.bubbles !== false && this.parentElement) {
        this.parentElement.dispatchEvent(event);
      }
    },
    getBoundingClientRect() {
      // Parse left/top from style if available
      const left = parseInt(this.style._values?.left) || 0;
      const top = parseInt(this.style._values?.top) || 0;
      const w = parseInt(this.style._values?.width) || this.clientWidth || 0;
      const h = parseInt(this.style._values?.height) || this.clientHeight || 0;
      return { left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top };
    },
    closest(selector) {
      if (!selector) return null;
      let el = this;
      while (el) {
        if (el.matches?.(selector)) return el;
        el = el.parentElement;
      }
      return null;
    },
    matches(selector) {
      if (!selector) return false;
      // Simple class/id/tag matching for test environment
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return this.classList.contains(cls);
      }
      if (selector.startsWith('#')) {
        return this.id === selector.slice(1);
      }
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
        return null;
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
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
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
    // Canvas context mock for text measurement
    getContext(type) {
      if (type === '2d') {
        return {
          font: '',
          measureText: (text) => ({ width: text.length * 7 }),
          fillText: () => {}, strokeText: () => {},
          save: () => {}, restore: () => {},
          beginPath: () => {}, closePath: () => {},
          fill: () => {}, stroke: () => {},
          arc: () => {}, moveTo: () => {}, lineTo: () => {},
          translate: () => {}, scale: () => {}, rotate: () => {},
          clearRect: () => {},
          fillRect: () => {},
          strokeRect: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
        };
      }
      return null;
    },
    ...overrides,
  };
  return el;
}

// ========== document ==========
const _docEl = makeElement('html', { id: 'documentElement' });
const _bodyEl = makeElement('body', { id: 'bodyElement' });
_docEl.appendChild(_bodyEl);

globalThis.document = {
  documentElement: _docEl,
  body: _bodyEl,
  head: makeElement('head'),
  dispatchEvent(event) {
    // Forward to documentElement for event dispatch
    return _docEl.dispatchEvent(event);
  },
  createElement: (tag) => {
    if (tag === 'canvas') {
      return makeElement('canvas', {
        clientWidth: 295, clientHeight: 618,
        getContext: (type) => {
          if (type === '2d') {
            return {
              font: '',
              measureText: (text) => ({ width: text.length * 7 }),
              fillText: () => {}, strokeText: () => {},
              save: () => {}, restore: () => {},
              beginPath: () => {}, closePath: () => {},
              fill: () => {}, stroke: () => {},
              arc: () => {}, moveTo: () => {}, lineTo: () => {},
              translate: () => {}, scale: () => {}, rotate: () => {},
              clearRect: () => {},
              fillRect: () => {},
              strokeRect: () => {},
              createLinearGradient: () => ({ addColorStop: () => {} }),
              createRadialGradient: () => ({ addColorStop: () => {} }),
            };
          }
          return null;
        },
      });
    }
    return makeElement(tag);
  },
  getElementById: (id) => {
    function find(el) {
      if (el.id === id) return el;
      for (const c of el.children || []) {
        const found = find(c);
        if (found) return found;
      }
      return null;
    }
    return find(_docEl);
  },
  querySelector: (sel) => _docEl.querySelector(sel),
  querySelectorAll: (sel) => _docEl.querySelectorAll(sel),
  addEventListener(type, fn, opts) { _docEl.addEventListener(type, fn, opts); },
  removeEventListener(type, fn, opts) { _docEl.removeEventListener(type, fn, opts); },
  createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  // Event
  createEvent: (type) => ({ type }),
};

// ========== Test helpers ==========
/** 清除 document 上所有事件监听（测试隔离用） */
globalThis.__clearDocumentListeners = () => {
  _docEl._removeAllListeners();
};

// ========== window ==========
globalThis.window = globalThis;
globalThis.window.innerWidth = 414;     // iPhone-ish
globalThis.window.innerHeight = 896;
globalThis.window.devicePixelRatio = 2;
globalThis.window.visualViewport = {
  height: 896,
  width: 414,
  addEventListener: () => {},
  removeEventListener: () => {},
};

// TouchEvent no longer needed — gesture-registry uses PointerEvent

// ========== MouseEvent mock ==========
class MockMouseEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.clientX = init.clientX || 0;
    this.clientY = init.clientY || 0;
    this.target = init.target || _bodyEl;
    this._propagationStopped = false;
  }
  stopPropagation() { this._propagationStopped = true; }
}

globalThis.MouseEvent = MockMouseEvent;

// ========== PointerEvent mock (gesture-registry uses pointer events) ==========
class MockPointerEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.clientX = init.clientX || 0;
    this.clientY = init.clientY || 0;
    this.button = init.button ?? 0;
    this.target = init.target || _bodyEl;
    this.bubbles = init.bubbles !== false;
    this._defaultPrevented = false;
    this._propagationStopped = false;
  }
  preventDefault() { this._defaultPrevented = true; }
  stopPropagation() { this._propagationStopped = true; }
}
globalThis.PointerEvent = MockPointerEvent;

// ========== CSS ==========
globalThis.CSS = {
  supports: () => true,
  escape: (s) => s,
};
