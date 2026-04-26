"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/client/modules/state.ts
  var KFMState = {
    files: {},
    expandedPaths: JSON.parse(localStorage.getItem("expandedPaths") || "{}"),
    selectedFile: "",
    showHidden: false,
    viewport: { scrollTop: 0, scrollLeft: 0 },
    sidebarOpen: false,
    fileCache: { version: 1, updated: 0, tree: {} },
    _listeners: [],
    subscribe(fn) {
      this._listeners.push(fn);
    },
    unsubscribe(fn) {
      const idx = this._listeners.indexOf(fn);
      if (idx !== -1) this._listeners.splice(idx, 1);
    },
    notify() {
      this._listeners.forEach((fn) => fn(this));
    },
    setExpanded(path, expanded) {
      if (expanded) {
        this.expandedPaths[path] = true;
      } else {
        delete this.expandedPaths[path];
      }
      localStorage.setItem("expandedPaths", JSON.stringify(this.expandedPaths));
      this.notify();
    },
    setSelectedFile(path) {
      this.selectedFile = path;
      this.notify();
    },
    toggleHidden() {
      this.showHidden = !this.showHidden;
      this.notify();
    },
    setSidebarOpen(open) {
      this.sidebarOpen = open;
      this.notify();
    },
    setViewport(v) {
      Object.assign(this.viewport, v);
      this.notify();
    }
  };
  if (typeof window !== "undefined") {
    window.KFMState = KFMState;
  }

  // src/client/modules/app.ts
  var API = "/kfmv4/api";
  function rlog(msg) {
    const t = (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour12: false });
    fetch(API + "/files/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/root/kfmv4/debug-swipe.log", content: t + " " + msg + "\n", append: true })
    }).catch(() => {
    });
  }
  function showToast(msg) {
    const toast = document.getElementById("operationToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2e3);
  }
  var logs = [];
  var MAX_LOGS = 100;
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function renderLogs() {
    const content = document.getElementById("logContent");
    if (!content) return;
    content.innerHTML = logs.map((log) => {
      const cls = log.type === "error" ? "error" : log.type === "success" ? "success" : "";
      return `<div class="log-item ${cls}"><span class="time">${log.time}</span>${escapeHtml(log.msg)}</div>`;
    }).join("");
  }
  function addLog(msg, type = "info") {
    const time = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    logs.unshift({ time, msg: String(msg), type });
    if (logs.length > MAX_LOGS) logs.pop();
    renderLogs();
  }
  function openLogPanel() {
    var _a;
    (_a = document.getElementById("logPanel")) == null ? void 0 : _a.classList.add("open");
    renderLogs();
  }
  function closeLogPanel() {
    var _a;
    (_a = document.getElementById("logPanel")) == null ? void 0 : _a.classList.remove("open");
  }
  function clearLogs() {
    logs.length = 0;
    renderLogs();
  }
  function initLogPanelSwipe() {
    const panel = document.getElementById("logPanel");
    if (!panel) return;
    let startX = 0;
    panel.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      const dx = e.touches[0].clientX - startX;
      if (dx > 0) panel.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    panel.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      panel.style.transform = "";
      if (dx > 80) closeLogPanel();
    }, { passive: true });
  }
  var originalLog = console.log;
  var originalError = console.error;
  console.log = function(...args) {
    originalLog.apply(console, args);
    addLog(args.map((a) => typeof a === "object" ? JSON.stringify(a) : a).join(" "));
  };
  console.error = function(...args) {
    originalError.apply(console, args);
    addLog(args.map((a) => typeof a === "object" ? JSON.stringify(a) : a).join(" "), "error");
  };
  function exposeGlobals() {
    window.API = API;
    window.selectedFile = KFMState.selectedFile;
    window.expandedPaths = KFMState.expandedPaths;
    window.showHidden = KFMState.showHidden;
    window.showToast = showToast;
    window.addLog = addLog;
    window.openLogPanel = openLogPanel;
    window.closeLogPanel = closeLogPanel;
    window.clearLogs = clearLogs;
    window.rlog = rlog;
  }
  async function initApp() {
    exposeGlobals();
    initLogPanelSwipe();
    const bar = document.getElementById("aiInputBar");
    if (bar && window.visualViewport) {
      const vv = window.visualViewport;
      const onResize = () => {
        const kh = window.innerHeight - vv.height;
        bar.style.bottom = kh + "px";
      };
      vv.addEventListener("resize", onResize);
      onResize();
    }
    const aiInput = document.getElementById("aiInput");
    if (aiInput) {
      aiInput.addEventListener("input", () => {
        aiInput.style.height = "auto";
        const newHeight = Math.min(aiInput.scrollHeight, 120);
        aiInput.style.height = newHeight + "px";
      });
    }
  }

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
    let lo = 0;
    let hi = nonLatin1BidiRanges.length - 1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      const range = nonLatin1BidiRanges[mid];
      if (codePoint < range[0]) {
        hi = mid - 1;
        continue;
      }
      if (codePoint > range[1]) {
        lo = mid + 1;
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
    for (let i = 0; i < len; ) {
      const first = str.charCodeAt(i);
      let codePoint = first;
      let codeUnitLength = 1;
      if (first >= 55296 && first <= 56319 && i + 1 < len) {
        const second = str.charCodeAt(i + 1);
        if (second >= 56320 && second <= 57343) {
          codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
          codeUnitLength = 2;
        }
      }
      const t = classifyCodePoint(codePoint);
      if (t === "R" || t === "AL" || t === "AN")
        sawBidi = true;
      for (let j = 0; j < codeUnitLength; j++) {
        types[i + j] = t;
      }
      i += codeUnitLength;
    }
    if (!sawBidi)
      return null;
    let startLevel = 0;
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "L") {
        startLevel = 0;
        break;
      }
      if (t === "R" || t === "AL") {
        startLevel = 1;
        break;
      }
    }
    const levels = new Int8Array(len);
    for (let i = 0; i < len; i++)
      levels[i] = startLevel;
    const e = startLevel & 1 ? "R" : "L";
    const sor = e;
    let lastType = sor;
    for (let i = 0; i < len; i++) {
      if (types[i] === "NSM")
        types[i] = lastType;
      else
        lastType = types[i];
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "EN")
        types[i] = lastType === "AL" ? "AN" : "EN";
      else if (t === "R" || t === "L" || t === "AL")
        lastType = t;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] === "AL")
        types[i] = "R";
    }
    for (let i = 1; i < len - 1; i++) {
      if (types[i] === "ES" && types[i - 1] === "EN" && types[i + 1] === "EN") {
        types[i] = "EN";
      }
      if (types[i] === "CS" && (types[i - 1] === "EN" || types[i - 1] === "AN") && types[i + 1] === types[i - 1]) {
        types[i] = types[i - 1];
      }
    }
    for (let i = 0; i < len; i++) {
      if (types[i] !== "EN")
        continue;
      let j;
      for (j = i - 1; j >= 0 && types[j] === "ET"; j--)
        types[j] = "EN";
      for (j = i + 1; j < len && types[j] === "ET"; j++)
        types[j] = "EN";
    }
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "WS" || t === "ES" || t === "ET" || t === "CS")
        types[i] = "ON";
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "EN")
        types[i] = lastType === "L" ? "L" : "EN";
      else if (t === "R" || t === "L")
        lastType = t;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] !== "ON")
        continue;
      let end = i + 1;
      while (end < len && types[end] === "ON")
        end++;
      const before = i > 0 ? types[i - 1] : sor;
      const after = end < len ? types[end] : sor;
      const bDir = before !== "L" ? "R" : "L";
      const aDir = after !== "L" ? "R" : "L";
      if (bDir === aDir) {
        for (let j = i; j < end; j++)
          types[j] = bDir;
      }
      i = end - 1;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] === "ON")
        types[i] = e;
    }
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if ((levels[i] & 1) === 0) {
        if (t === "R")
          levels[i]++;
        else if (t === "AN" || t === "EN")
          levels[i] += 2;
      } else if (t === "L" || t === "AN" || t === "EN") {
        levels[i]++;
      }
    }
    return levels;
  }
  function computeSegmentLevels(normalized, segStarts) {
    const bidiLevels = computeBidiLevels(normalized);
    if (bidiLevels === null)
      return null;
    const segLevels = new Int8Array(segStarts.length);
    for (let i = 0; i < segStarts.length; i++) {
      segLevels[i] = bidiLevels[segStarts[i]];
    }
    return segLevels;
  }

  // node_modules/@chenglou/pretext/dist/analysis.js
  var collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
  var needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
  function getWhiteSpaceProfile(whiteSpace) {
    const mode = whiteSpace != null ? whiteSpace : "normal";
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
  function isCJK(s) {
    for (let i = 0; i < s.length; i++) {
      const first = s.charCodeAt(i);
      if (first < 12288)
        continue;
      if (first >= 55296 && first <= 56319 && i + 1 < s.length) {
        const second = s.charCodeAt(i + 1);
        if (second >= 56320 && second <= 57343) {
          const codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
          if (isCJKCodePoint(codePoint))
            return true;
          i++;
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
    for (const ch of segment) {
      if (leftStickyPunctuation.has(ch)) {
        sawPunctuation = true;
        continue;
      }
      if (sawPunctuation && combiningMarkRe.test(ch))
        continue;
      return false;
    }
    return sawPunctuation;
  }
  function isCJKLineStartProhibitedSegment(segment) {
    for (const ch of segment) {
      if (!kinsokuStart.has(ch) && !leftStickyPunctuation.has(ch))
        return false;
    }
    return segment.length > 0;
  }
  function isForwardStickyClusterSegment(segment) {
    if (isEscapedQuoteClusterSegment(segment))
      return true;
    for (const ch of segment) {
      if (!kinsokuEnd.has(ch) && !forwardStickyGlue.has(ch) && !combiningMarkRe.test(ch))
        return false;
    }
    return segment.length > 0;
  }
  function isEscapedQuoteClusterSegment(segment) {
    let sawQuote = false;
    for (const ch of segment) {
      if (ch === "\\" || combiningMarkRe.test(ch))
        continue;
      if (kinsokuEnd.has(ch) || leftStickyPunctuation.has(ch) || forwardStickyGlue.has(ch)) {
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
      const ch = chars[splitIndex - 1];
      if (combiningMarkRe.test(ch)) {
        splitIndex--;
        continue;
      }
      if (kinsokuEnd.has(ch) || forwardStickyGlue.has(ch)) {
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
    const ch = chars[index];
    const text = texts[index];
    if (ch == null)
      return text;
    const length = lengths[index];
    if (text.length === length)
      return text;
    const materialized = ch.repeat(length);
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
      const ch = text.slice(start, end);
      if (closingQuoteChars.has(ch))
        return true;
      if (!leftStickyPunctuation.has(ch))
        return false;
      end = start;
    }
    return false;
  }
  function classifySegmentBreakChar(ch, whiteSpaceProfile) {
    if (whiteSpaceProfile.preserveOrdinarySpaces || whiteSpaceProfile.preserveHardBreaks) {
      if (ch === " ")
        return "preserved-space";
      if (ch === "	")
        return "tab";
      if (whiteSpaceProfile.preserveHardBreaks && ch === "\n")
        return "hard-break";
    }
    if (ch === " ")
      return "space";
    if (ch === "\xA0" || ch === "\u202F" || ch === "\u2060" || ch === "\uFEFF") {
      return "glue";
    }
    if (ch === "\u200B")
      return "zero-width-break";
    if (ch === "\xAD")
      return "soft-hyphen";
    return "text";
  }
  var breakCharRe = /[\x20\t\n\xA0\xAD\u200B\u202F\u2060\uFEFF]/;
  function joinTextParts(parts) {
    return parts.length === 1 ? parts[0] : parts.join("");
  }
  function joinReversedPrefixParts(prefixParts, tail) {
    const parts = [];
    for (let i = prefixParts.length - 1; i >= 0; i--) {
      parts.push(prefixParts[i]);
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
    for (const ch of segment) {
      const kind = classifySegmentBreakChar(ch, whiteSpaceProfile);
      const wordLike = kind === "text" && isWordLike;
      if (currentKind !== null && kind === currentKind && wordLike === currentWordLike) {
        currentTextParts.push(ch);
        offset += ch.length;
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
      currentTextParts = [ch];
      currentStart = start + offset;
      currentWordLike = wordLike;
      offset += ch.length;
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
    for (let i = 0; i < segmentation.len; i++) {
      if (kinds[i] !== "text" || !isUrlLikeRunStart(segmentation, i))
        continue;
      const mergedParts = [texts[i]];
      let j = i + 1;
      while (j < segmentation.len && !isTextRunBoundary(kinds[j])) {
        mergedParts.push(texts[j]);
        isWordLike[i] = true;
        const endsQueryPrefix = texts[j].includes("?");
        kinds[j] = "text";
        texts[j] = "";
        j++;
        if (endsQueryPrefix)
          break;
      }
      texts[i] = joinTextParts(mergedParts);
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
    for (let i = 0; i < segmentation.len; i++) {
      const text = segmentation.texts[i];
      texts.push(text);
      isWordLike.push(segmentation.isWordLike[i]);
      kinds.push(segmentation.kinds[i]);
      starts.push(segmentation.starts[i]);
      if (!isUrlQueryBoundarySegment(text))
        continue;
      const nextIndex = i + 1;
      if (nextIndex >= segmentation.len || isTextRunBoundary(segmentation.kinds[nextIndex])) {
        continue;
      }
      const queryParts = [];
      const queryStart = segmentation.starts[nextIndex];
      let j = nextIndex;
      while (j < segmentation.len && !isTextRunBoundary(segmentation.kinds[j])) {
        queryParts.push(segmentation.texts[j]);
        j++;
      }
      if (queryParts.length > 0) {
        texts.push(joinTextParts(queryParts));
        isWordLike.push(true);
        kinds.push("text");
        starts.push(queryStart);
        i = j - 1;
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
    for (const ch of text) {
      if (decimalDigitRe.test(ch))
        return true;
    }
    return false;
  }
  function isNumericRunSegment(text) {
    if (text.length === 0)
      return false;
    for (const ch of text) {
      if (decimalDigitRe.test(ch) || numericJoinerChars.has(ch))
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
    for (let i = 0; i < segmentation.len; i++) {
      const text = segmentation.texts[i];
      const kind = segmentation.kinds[i];
      if (kind === "text" && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
        const mergedParts = [text];
        let j = i + 1;
        while (j < segmentation.len && segmentation.kinds[j] === "text" && isNumericRunSegment(segmentation.texts[j])) {
          mergedParts.push(segmentation.texts[j]);
          j++;
        }
        texts.push(joinTextParts(mergedParts));
        isWordLike.push(true);
        kinds.push("text");
        starts.push(segmentation.starts[i]);
        i = j - 1;
        continue;
      }
      texts.push(text);
      isWordLike.push(segmentation.isWordLike[i]);
      kinds.push(kind);
      starts.push(segmentation.starts[i]);
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
    for (let i = 0; i < segmentation.len; i++) {
      const text = segmentation.texts[i];
      const kind = segmentation.kinds[i];
      const wordLike = segmentation.isWordLike[i];
      if (kind === "text" && wordLike && asciiPunctuationChainSegmentRe.test(text)) {
        const mergedParts = [text];
        let endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(text);
        let j = i + 1;
        while (endsWithJoiners && j < segmentation.len && segmentation.kinds[j] === "text" && segmentation.isWordLike[j] && asciiPunctuationChainSegmentRe.test(segmentation.texts[j])) {
          const nextText = segmentation.texts[j];
          mergedParts.push(nextText);
          endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(nextText);
          j++;
        }
        texts.push(joinTextParts(mergedParts));
        isWordLike.push(true);
        kinds.push("text");
        starts.push(segmentation.starts[i]);
        i = j - 1;
        continue;
      }
      texts.push(text);
      isWordLike.push(wordLike);
      kinds.push(kind);
      starts.push(segmentation.starts[i]);
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
    for (let i = 0; i < segmentation.len; i++) {
      const text = segmentation.texts[i];
      if (segmentation.kinds[i] === "text" && text.includes("-")) {
        const parts = text.split("-");
        let shouldSplit = parts.length > 1;
        for (let j = 0; j < parts.length; j++) {
          const part = parts[j];
          if (!shouldSplit)
            break;
          if (part.length === 0 || !segmentContainsDecimalDigit(part) || !isNumericRunSegment(part)) {
            shouldSplit = false;
          }
        }
        if (shouldSplit) {
          let offset = 0;
          for (let j = 0; j < parts.length; j++) {
            const part = parts[j];
            const splitText = j < parts.length - 1 ? `${part}-` : part;
            texts.push(splitText);
            isWordLike.push(true);
            kinds.push("text");
            starts.push(segmentation.starts[i] + offset);
            offset += splitText.length;
          }
          continue;
        }
      }
      texts.push(text);
      isWordLike.push(segmentation.isWordLike[i]);
      kinds.push(segmentation.kinds[i]);
      starts.push(segmentation.starts[i]);
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
    for (let i = 0; i < texts.length - 1; i++) {
      if (kinds[i] !== "text" || kinds[i + 1] !== "text")
        continue;
      if (!isCJK(texts[i]) || !isCJK(texts[i + 1]))
        continue;
      const split = splitTrailingForwardStickyCluster(texts[i]);
      if (split === null)
        continue;
      texts[i] = split.head;
      texts[i + 1] = split.tail + texts[i + 1];
      starts[i + 1] = starts[i] + split.head.length;
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
    var _a, _b, _c;
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
    for (const s of wordSegmenter.segment(normalized)) {
      for (const piece of splitSegmentByBreakKind(s.segment, (_a = s.isWordLike) != null ? _a : false, s.index, whiteSpaceProfile)) {
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
          mergedSingleCharRunLengths[prevIndex] = ((_b = mergedSingleCharRunLengths[prevIndex]) != null ? _b : 1) + 1;
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
    for (let i = 0; i < mergedLen; i++) {
      if (mergedSingleCharRunChars[i] !== null) {
        mergedTexts[i] = materializeDeferredSingleCharRun(mergedTexts, mergedSingleCharRunChars, mergedSingleCharRunLengths, i);
        continue;
      }
      mergedTexts[i] = joinTextParts(mergedTextParts[i]);
    }
    for (let i = 1; i < mergedLen; i++) {
      if (mergedKinds[i] === "text" && !mergedWordLike[i] && isEscapedQuoteClusterSegment(mergedTexts[i]) && mergedKinds[i - 1] === "text" && !mergedContainsCJK[i - 1]) {
        mergedTexts[i - 1] += mergedTexts[i];
        mergedWordLike[i - 1] = mergedWordLike[i - 1] || mergedWordLike[i];
        mergedTexts[i] = "";
      }
    }
    const forwardStickyPrefixParts = Array.from({ length: mergedLen }, () => null);
    let nextLiveIndex = -1;
    for (let i = mergedLen - 1; i >= 0; i--) {
      const text = mergedTexts[i];
      if (text.length === 0)
        continue;
      if (mergedKinds[i] === "text" && !mergedWordLike[i] && isForwardStickyClusterSegment(text) && nextLiveIndex >= 0 && mergedKinds[nextLiveIndex] === "text") {
        const prefixParts = (_c = forwardStickyPrefixParts[nextLiveIndex]) != null ? _c : [];
        prefixParts.push(text);
        forwardStickyPrefixParts[nextLiveIndex] = prefixParts;
        mergedStarts[nextLiveIndex] = mergedStarts[i];
        mergedTexts[i] = "";
        continue;
      }
      nextLiveIndex = i;
    }
    for (let i = 0; i < mergedLen; i++) {
      const prefixParts = forwardStickyPrefixParts[i];
      if (prefixParts == null)
        continue;
      mergedTexts[i] = joinReversedPrefixParts(prefixParts, mergedTexts[i]);
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
    for (let i = 0; i < withMergedUrls.len - 1; i++) {
      const split = splitLeadingSpaceAndMarks(withMergedUrls.texts[i]);
      if (split === null)
        continue;
      if (withMergedUrls.kinds[i] !== "space" && withMergedUrls.kinds[i] !== "preserved-space" || withMergedUrls.kinds[i + 1] !== "text" || !containsArabicScript(withMergedUrls.texts[i + 1])) {
        continue;
      }
      withMergedUrls.texts[i] = split.space;
      withMergedUrls.isWordLike[i] = false;
      withMergedUrls.kinds[i] = withMergedUrls.kinds[i] === "preserved-space" ? "preserved-space" : "space";
      withMergedUrls.texts[i + 1] = split.marks + withMergedUrls.texts[i + 1];
      withMergedUrls.starts[i + 1] = withMergedUrls.starts[i] + split.space.length;
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
    for (let i = 0; i < segmentation.len; i++) {
      if (segmentation.kinds[i] !== "hard-break")
        continue;
      chunks.push({
        startSegmentIndex,
        endSegmentIndex: i,
        consumedEndSegmentIndex: i + 1
      });
      startSegmentIndex = i + 1;
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
    for (let i = 0; i < segmentation.len; i++) {
      const text = segmentation.texts[i];
      const kind = segmentation.kinds[i];
      const wordLike = segmentation.isWordLike[i];
      const start = segmentation.starts[i];
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
    const ua = navigator.userAgent;
    const vendor = navigator.vendor;
    const isSafari = vendor === "Apple Computer, Inc." && ua.includes("Safari/") && !ua.includes("Chrome/") && !ua.includes("Chromium/") && !ua.includes("CriOS/") && !ua.includes("FxiOS/") && !ua.includes("EdgiOS/");
    const isChromium = ua.includes("Chrome/") || ua.includes("Chromium/") || ua.includes("CriOS/") || ua.includes("Edg/");
    cachedEngineProfile = {
      lineFitEpsilon: isSafari ? 1 / 64 : 5e-3,
      carryCJKAfterClosingQuote: isChromium,
      preferPrefixWidthsForBreakableRuns: isSafari,
      preferEarlySoftHyphenBreak: isSafari
    };
    return cachedEngineProfile;
  }
  function parseFontSize(font) {
    const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
    return m ? parseFloat(m[1]) : 16;
  }
  function getSharedGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
      sharedGraphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter;
  }
  function isEmojiGrapheme(g) {
    return emojiPresentationRe.test(g) || g.includes("\uFE0F");
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
    for (const g of graphemeSegmenter.segment(text)) {
      if (isEmojiGrapheme(g.segment))
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
    for (const gs of graphemeSegmenter.segment(seg)) {
      graphemes.push(gs.segment);
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
      onLine == null ? void 0 : onLine(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
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
      for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
        const gw = fitAdvances[g];
        if (!hasContent) {
          startLineAtGrapheme(segmentIndex, g, gw);
        } else if (lineW + gw > fitLimit) {
          emitCurrentLine();
          startLineAtGrapheme(segmentIndex, g, gw);
        } else {
          lineW += gw;
          lineEndSegmentIndex = segmentIndex;
          lineEndGraphemeIndex = g + 1;
        }
      }
      if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
      }
    }
    let i = 0;
    while (i < widths.length) {
      if (!hasContent) {
        i = normalizeLineStartSegmentIndex(prepared, i);
        if (i >= widths.length)
          break;
      }
      const w = widths[i];
      const kind = kinds[i];
      const breakAfter = breaksAfter(kind);
      if (!hasContent) {
        if (w > fitLimit && breakableFitAdvances[i] !== null) {
          appendBreakableSegmentFrom(i, 0);
        } else {
          startLineAtSegment(i, w);
        }
        if (breakAfter) {
          pendingBreakSegmentIndex = i + 1;
          pendingBreakPaintWidth = lineW - w;
        }
        i++;
        continue;
      }
      const newW = lineW + w;
      if (newW > fitLimit) {
        if (breakAfter) {
          appendWholeSegment(i, w);
          emitCurrentLine(i + 1, 0, lineW - w);
          i++;
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
        if (w > fitLimit && breakableFitAdvances[i] !== null) {
          emitCurrentLine();
          appendBreakableSegmentFrom(i, 0);
          i++;
          continue;
        }
        emitCurrentLine();
        continue;
      }
      appendWholeSegment(i, w);
      if (breakAfter) {
        pendingBreakSegmentIndex = i + 1;
        pendingBreakPaintWidth = lineW - w;
      }
      i++;
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
      onLine == null ? void 0 : onLine(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
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
      for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
        const baseGw = fitAdvances[g];
        if (!hasContent) {
          startLineAtGrapheme(segmentIndex, g, baseGw);
        } else {
          const gw = getBreakableGraphemeAdvance(prepared, true, baseGw);
          const candidatePaintWidth = lineW + gw;
          if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
            emitCurrentLine();
            startLineAtGrapheme(segmentIndex, g, baseGw);
          } else {
            lineW = candidatePaintWidth;
            lineEndSegmentIndex = segmentIndex;
            lineEndGraphemeIndex = g + 1;
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
      onLine == null ? void 0 : onLine(0, chunk.startSegmentIndex, 0, chunk.consumedEndSegmentIndex, 0);
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
      let i = chunk.startSegmentIndex;
      while (i < chunk.endSegmentIndex) {
        if (!hasContent) {
          i = normalizeLineStartSegmentIndex(prepared, i, chunk.endSegmentIndex);
          if (i >= chunk.endSegmentIndex)
            break;
        }
        const kind = kinds[i];
        const breakAfter = breaksAfter(kind);
        const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i);
        const w = kind === "tab" ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance) : widths[i];
        const advance = leadingSpacing + w;
        const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w);
        if (kind === "soft-hyphen") {
          if (hasContent) {
            lineEndSegmentIndex = i + 1;
            lineEndGraphemeIndex = 0;
            pendingBreakSegmentIndex = i + 1;
            pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
            pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
            pendingBreakKind = kind;
          }
          i++;
          continue;
        }
        if (!hasContent) {
          if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
            appendBreakableSegmentFrom(i, 0);
          } else {
            startLineAtSegment(i, w);
          }
          updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
          i++;
          continue;
        }
        const newFitW = lineW + fitAdvance;
        if (newFitW > fitLimit) {
          const currentBreakFitWidth = lineW + getBreakOpportunityFitContribution(prepared, kind, i, leadingSpacing);
          const currentBreakPaintWidth = lineW + getLineEndPaintContribution(prepared, kind, i, leadingSpacing, w);
          if (pendingBreakKind === "soft-hyphen" && engineProfile.preferEarlySoftHyphenBreak && pendingBreakFitWidth <= fitLimit) {
            emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
            continue;
          }
          if (pendingBreakKind === "soft-hyphen" && continueSoftHyphenBreakableSegment(i)) {
            i++;
            continue;
          }
          if (breakAfter && currentBreakFitWidth <= fitLimit) {
            appendWholeSegment(i, advance);
            emitCurrentLine(i + 1, 0, currentBreakPaintWidth);
            i++;
            continue;
          }
          if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
            if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
              emitCurrentLine();
              continue;
            }
            const nextSegmentIndex = pendingBreakSegmentIndex;
            emitCurrentLine(nextSegmentIndex, 0, pendingBreakPaintWidth);
            i = nextSegmentIndex;
            continue;
          }
          if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
            emitCurrentLine();
            appendBreakableSegmentFrom(i, 0);
            i++;
            continue;
          }
          emitCurrentLine();
          continue;
        }
        appendWholeSegment(i, advance);
        updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
        i++;
      }
      if (hasContent) {
        const finalPaintWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex ? pendingBreakPaintWidth : lineW;
        emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth);
      }
    }
    return lineCount;
  }

  // node_modules/@chenglou/pretext/dist/line-text.js
  var sharedGraphemeSegmenter2 = null;
  var sharedLineTextCaches = /* @__PURE__ */ new WeakMap();
  function getSharedGraphemeSegmenter2() {
    if (sharedGraphemeSegmenter2 === null) {
      sharedGraphemeSegmenter2 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter2;
  }
  function getSegmentGraphemes(segmentIndex, segments, cache) {
    let graphemes = cache.get(segmentIndex);
    if (graphemes !== void 0)
      return graphemes;
    graphemes = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter2();
    for (const gs of graphemeSegmenter.segment(segments[segmentIndex])) {
      graphemes.push(gs.segment);
    }
    cache.set(segmentIndex, graphemes);
    return graphemes;
  }
  function lineHasDiscretionaryHyphen(kinds, startSegmentIndex, startGraphemeIndex, endSegmentIndex) {
    return endSegmentIndex > 0 && kinds[endSegmentIndex - 1] === "soft-hyphen" && !(startSegmentIndex === endSegmentIndex && startGraphemeIndex > 0);
  }
  function appendSegmentGraphemeRange(text, graphemes, startGraphemeIndex, endGraphemeIndex) {
    for (let i = startGraphemeIndex; i < endGraphemeIndex; i++) {
      text += graphemes[i];
    }
    return text;
  }
  function getLineTextCache(prepared) {
    let cache = sharedLineTextCaches.get(prepared);
    if (cache !== void 0)
      return cache;
    cache = /* @__PURE__ */ new Map();
    sharedLineTextCaches.set(prepared, cache);
    return cache;
  }
  function buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    let text = "";
    const endsWithDiscretionaryHyphen = lineHasDiscretionaryHyphen(prepared.kinds, startSegmentIndex, startGraphemeIndex, endSegmentIndex);
    for (let i = startSegmentIndex; i < endSegmentIndex; i++) {
      if (prepared.kinds[i] === "soft-hyphen" || prepared.kinds[i] === "hard-break")
        continue;
      if (i === startSegmentIndex && startGraphemeIndex > 0) {
        const graphemes = getSegmentGraphemes(i, prepared.segments, cache);
        text = appendSegmentGraphemeRange(text, graphemes, startGraphemeIndex, graphemes.length);
      } else {
        text += prepared.segments[i];
      }
    }
    if (endGraphemeIndex > 0) {
      if (endsWithDiscretionaryHyphen)
        text += "-";
      const graphemes = getSegmentGraphemes(endSegmentIndex, prepared.segments, cache);
      text = appendSegmentGraphemeRange(text, graphemes, startSegmentIndex === endSegmentIndex ? startGraphemeIndex : 0, endGraphemeIndex);
    } else if (endsWithDiscretionaryHyphen) {
      text += "-";
    }
    return text;
  }

  // node_modules/@chenglou/pretext/dist/layout.js
  var sharedGraphemeSegmenter3 = null;
  function getSharedGraphemeSegmenter3() {
    if (sharedGraphemeSegmenter3 === null) {
      sharedGraphemeSegmenter3 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter3;
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
    for (const gs of getSharedGraphemeSegmenter3().segment(segText)) {
      const grapheme = gs.segment;
      const graphemeContainsCJK = isCJK(grapheme);
      if (unitParts.length === 0) {
        startUnit(grapheme, gs.index, graphemeContainsCJK);
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
      startUnit(grapheme, gs.index, graphemeContainsCJK);
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
    for (let i = 1; i < units.length; i++) {
      const next = units[i];
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
    const graphemeSegmenter = getSharedGraphemeSegmenter3();
    for (const _ of graphemeSegmenter.segment(text))
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
      segStarts == null ? void 0 : segStarts.push(start);
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
    for (let mi = 0; mi < analysis.len; mi++) {
      preparedStartByAnalysisIndex[mi] = widths.length;
      const segText = analysis.texts[mi];
      const segWordLike = analysis.isWordLike[mi];
      const segKind = analysis.kinds[mi];
      const segStart = analysis.starts[mi];
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
        for (let i = 0; i < measuredUnits.length; i++) {
          const unit = measuredUnits[i];
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
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
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
    var _a, _b;
    const wordBreak = (_a = options == null ? void 0 : options.wordBreak) != null ? _a : "normal";
    const letterSpacing = (_b = options == null ? void 0 : options.letterSpacing) != null ? _b : 0;
    const analysis = analyzeText(text, getEngineProfile(), options == null ? void 0 : options.whiteSpace, wordBreak);
    return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing);
  }
  function prepareWithSegments(text, font, options) {
    return prepareInternal(text, font, true, options);
  }
  function getInternalPrepared(prepared) {
    return prepared;
  }
  function createLayoutLine(prepared, cache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
    return {
      text: buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex),
      width,
      start: {
        segmentIndex: startSegmentIndex,
        graphemeIndex: startGraphemeIndex
      },
      end: {
        segmentIndex: endSegmentIndex,
        graphemeIndex: endGraphemeIndex
      }
    };
  }
  function layoutWithLines(prepared, maxWidth, lineHeight) {
    const lines = [];
    if (prepared.widths.length === 0)
      return { lineCount: 0, height: 0, lines };
    const graphemeCache = getLineTextCache(prepared);
    const lineCount = walkPreparedLinesRaw(getInternalPrepared(prepared), maxWidth, (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
      lines.push(createLayoutLine(prepared, graphemeCache, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex));
    });
    return { lineCount, height: lineCount * lineHeight, lines };
  }

  // src/client/engine/v2/flex.ts
  var DEFAULT_FLEX = {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flexWrap: "nowrap",
    gap: 0,
    rowGap: 0,
    columnGap: 0
  };
  var DEFAULT_FLEX_ITEM = {
    flex: 0,
    flexShrink: 1,
    flexBasis: "auto",
    alignSelf: "auto",
    minWidth: 0,
    maxWidth: Infinity,
    minHeight: 0,
    maxHeight: Infinity
  };
  function applyFlexLayout(parent) {
    var _a, _b, _c;
    if (!parent.layout) return;
    if (parent.children.length === 0) return;
    const layout2 = parent.layout;
    const style = { ...DEFAULT_FLEX, ...layout2 };
    const isRow = style.flexDirection === "row" || style.flexDirection === "row-reverse";
    const isReverse = style.flexDirection === "row-reverse" || style.flexDirection === "column-reverse";
    const gap = (_a = layout2.gap) != null ? _a : 0;
    const rowGap = (_b = layout2.rowGap) != null ? _b : gap;
    const columnGap = (_c = layout2.columnGap) != null ? _c : gap;
    const mainGap = isRow ? columnGap : rowGap;
    const crossGap = isRow ? rowGap : columnGap;
    const contentX = parent.padding.left;
    const contentY = parent.padding.top;
    const contentWidth = parent.width - parent.padding.left - parent.padding.right;
    const contentHeight = parent.height - parent.padding.top - parent.padding.bottom;
    const children = parent.children.slice();
    const layouts = children.map((child) => {
      var _a2;
      const itemStyle = { ...DEFAULT_FLEX_ITEM, ...child.layoutItem };
      let mainSize = isRow ? child.width : child.height;
      let crossSize = isRow ? child.height : child.width;
      if (itemStyle.flexBasis !== "auto") {
        mainSize = itemStyle.flexBasis;
      }
      if (isRow) {
        mainSize = Math.max(itemStyle.minWidth, Math.min(itemStyle.maxWidth, mainSize));
        crossSize = Math.max(itemStyle.minHeight, Math.min(itemStyle.maxHeight, crossSize));
      } else {
        mainSize = Math.max(itemStyle.minHeight, Math.min(itemStyle.maxHeight, mainSize));
        crossSize = Math.max(itemStyle.minWidth, Math.min(itemStyle.maxWidth, crossSize));
      }
      return {
        child,
        itemStyle,
        mainSize,
        crossSize,
        mainPos: 0,
        crossPos: 0,
        flexGrow: (_a2 = itemStyle.flex) != null ? _a2 : 0
      };
    });
    const totalFlexGrow = layouts.reduce((sum, l) => sum + l.flexGrow, 0);
    const totalMainSize = layouts.reduce((sum, l) => sum + l.mainSize, 0);
    const totalGaps = mainGap * (children.length - 1);
    const availableMainSpace = isRow ? contentWidth : contentHeight;
    const remainingSpace = availableMainSpace - totalMainSize - totalGaps;
    if (totalFlexGrow > 0 && remainingSpace > 0) {
      layouts.forEach((l) => {
        if (l.flexGrow > 0) {
          const extra = remainingSpace * l.flexGrow / totalFlexGrow;
          l.mainSize += extra;
          if (isRow) {
            l.mainSize = Math.min(l.itemStyle.maxWidth, l.mainSize);
          } else {
            l.mainSize = Math.min(l.itemStyle.maxHeight, l.mainSize);
          }
        }
      });
    }
    const finalTotalMainSize = layouts.reduce((sum, l) => sum + l.mainSize, 0);
    const finalRemaining = availableMainSpace - finalTotalMainSize - totalGaps;
    let mainOffset = contentX;
    let gapBetween = mainGap;
    switch (style.justifyContent) {
      case "flex-start":
        mainOffset = contentX;
        break;
      case "flex-end":
        mainOffset = contentX + finalRemaining;
        break;
      case "center":
        mainOffset = contentX + finalRemaining / 2;
        break;
      case "space-between":
        mainOffset = contentX;
        if (children.length > 1) {
          gapBetween = mainGap + finalRemaining / (children.length - 1);
        }
        break;
      case "space-around":
        if (children.length > 0) {
          const spacePer = finalRemaining / children.length;
          mainOffset = contentX + spacePer / 2;
          gapBetween = mainGap + spacePer;
        }
        break;
      case "space-evenly":
        if (children.length > 0) {
          const spacePer = finalRemaining / (children.length + 1);
          mainOffset = contentX + spacePer;
          gapBetween = mainGap + spacePer;
        }
        break;
    }
    if (isReverse) {
      mainOffset = isRow ? contentX + contentWidth - layouts[0].mainSize : contentY + contentHeight - layouts[0].mainSize;
      let pos = mainOffset;
      layouts.forEach((l, i) => {
        l.mainPos = pos;
        pos -= l.mainSize + gapBetween;
      });
    } else {
      let pos = mainOffset;
      layouts.forEach((l, i) => {
        l.mainPos = pos;
        pos += l.mainSize + gapBetween;
      });
    }
    const crossSpace = isRow ? contentHeight : contentWidth;
    const crossStart = isRow ? contentY : contentX;
    layouts.forEach((l) => {
      const align = l.itemStyle.alignSelf === "auto" ? style.alignItems : l.itemStyle.alignSelf;
      switch (align) {
        case "flex-start":
          l.crossPos = crossStart;
          break;
        case "flex-end":
          l.crossPos = crossStart + crossSpace - l.crossSize;
          break;
        case "center":
          l.crossPos = crossStart + (crossSpace - l.crossSize) / 2;
          break;
        case "stretch":
          l.crossSize = crossSpace;
          l.crossPos = crossStart;
          break;
      }
    });
    layouts.forEach((l) => {
      if (isRow) {
        l.child.x = l.mainPos;
        l.child.y = l.crossPos;
        l.child.width = l.mainSize;
        l.child.height = l.crossSize;
      } else {
        l.child.x = l.crossPos;
        l.child.y = l.mainPos;
        l.child.width = l.crossSize;
        l.child.height = l.mainSize;
      }
    });
  }

  // src/client/engine/v2/BorderDrawer.ts
  function getCornerSides(corner) {
    switch (corner) {
      case 1:
        return { side1: "top", side2: "left" };
      // 左上：上边→左边（逆时针）
      case 3:
        return { side1: "left", side2: "bottom" };
      // 左下：左边→下边
      case 5:
        return { side1: "bottom", side2: "right" };
      // 右下：下边→右边
      case 7:
        return { side1: "right", side2: "top" };
    }
  }
  function shouldDrawCorner(corner, border) {
    var sides = getCornerSides(corner);
    var s1 = border[sides.side1];
    var s2 = border[sides.side2];
    if (s1 === "hidden" && s2 === "hidden") return false;
    if (s1 === "normal" && s2 === "hidden" || s1 === "hidden" && s2 === "normal") return false;
    return true;
  }
  function getCornerType(corner, border, emphasisW, normalW) {
    var sides = getCornerSides(corner);
    var s1 = border[sides.side1];
    var s2 = border[sides.side2];
    if (s1 === "emphasis" && s2 === "emphasis") {
      return { type: "uniform", width: emphasisW };
    }
    if (s1 === "normal" && s2 === "normal") {
      return { type: "uniform", width: normalW };
    }
    if (s1 === "emphasis" && s2 === "normal") {
      return { type: "taper", startWidth: emphasisW, endWidth: normalW };
    }
    if (s1 === "normal" && s2 === "emphasis") {
      return { type: "taper", startWidth: normalW, endWidth: emphasisW };
    }
    if (s1 === "emphasis" && s2 === "hidden") {
      return { type: "taper", startWidth: emphasisW, endWidth: 0 };
    }
    if (s1 === "hidden" && s2 === "emphasis") {
      return { type: "taper", startWidth: 0, endWidth: emphasisW };
    }
    return null;
  }
  function getArcAngles(corner) {
    switch (corner) {
      case 1:
        return { start: 3 * Math.PI / 2, end: Math.PI };
      // 左上：上→左
      case 3:
        return { start: Math.PI, end: Math.PI / 2 };
      // 左下：左→下
      case 5:
        return { start: Math.PI / 2, end: 0 };
      // 右下：下→右
      case 7:
        return { start: 0, end: -Math.PI / 2 };
    }
  }
  function getArcCenter(corner, x, y, w, h, radius) {
    switch (corner) {
      case 1:
        return { cx: x + radius, cy: y + radius };
      case 3:
        return { cx: x + radius, cy: y + h - radius };
      case 5:
        return { cx: x + w - radius, cy: y + h - radius };
      case 7:
        return { cx: x + w - radius, cy: y + radius };
    }
  }
  function drawUniformArc(ctx, corner, x, y, w, h, radius, strokeWidth, color) {
    if (radius <= 0 || strokeWidth <= 0) return;
    var center = getArcCenter(corner, x, y, w, h, radius);
    var angles = getArcAngles(corner);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(center.cx, center.cy, radius, angles.start, angles.end, true);
    ctx.stroke();
  }
  function drawTaperArc(ctx, corner, x, y, w, h, radius, startWidth, endWidth, color) {
    var segments = 10;
    var center = getArcCenter(corner, x, y, w, h, radius);
    var angles = getArcAngles(corner);
    var angleStep = (angles.end - angles.start) / segments;
    ctx.strokeStyle = color;
    ctx.lineCap = "butt";
    for (var i = 0; i < segments; i++) {
      var t = (i + 0.5) / segments;
      var sw = startWidth + (endWidth - startWidth) * t;
      if (sw < 0.3) continue;
      var a1 = angles.start + angleStep * i;
      var a2 = angles.start + angleStep * (i + 1);
      ctx.lineWidth = sw;
      ctx.beginPath();
      ctx.arc(center.cx, center.cy, radius, a1, a2, true);
      ctx.stroke();
    }
  }
  function drawLineSegment(ctx, side, x, y, w, h, radius, strokeWidth, color) {
    var halfSw = strokeWidth / 2;
    ctx.fillStyle = color;
    switch (side) {
      case "left":
        ctx.fillRect(x - halfSw, y + radius, strokeWidth, Math.max(1, h - radius * 2));
        break;
      case "bottom":
        ctx.fillRect(x + radius, y + h - halfSw, Math.max(1, w - radius * 2), strokeWidth);
        break;
      case "right":
        ctx.fillRect(x + w - halfSw, y + radius, strokeWidth, Math.max(1, h - radius * 2));
        break;
      case "top":
        ctx.fillRect(x + radius, y - halfSw, Math.max(1, w - radius * 2), strokeWidth);
        break;
    }
  }
  function drawBorders(ctx, x, y, w, h, style) {
    var emphasisW = style.borderWidth * style.emphasisScale;
    var normalW = style.borderWidth;
    var radius = style.cornerRadius;
    var emColor = typeof style.borderColor === "string" ? style.borderColor : "#7c3aed";
    var nmColor = emColor;
    var border = style.border;
    var sides = ["top", "right", "bottom", "left"];
    for (var i = 0; i < 4; i++) {
      var side = sides[i];
      if (border[side] !== "normal") continue;
      drawLineSegment(ctx, side, x, y, w, h, radius, normalW, nmColor);
    }
    for (var j = 0; j < 4; j++) {
      var side2 = sides[j];
      if (border[side2] !== "emphasis") continue;
      drawLineSegment(ctx, side2, x, y, w, h, radius, emphasisW, emColor);
    }
    var corners = [1, 3, 5, 7];
    for (var k = 0; k < 4; k++) {
      var corner = corners[k];
      if (!shouldDrawCorner(corner, border)) continue;
      var cornerSides = getCornerSides(corner);
      var hasEm = border[cornerSides.side1] === "emphasis" || border[cornerSides.side2] === "emphasis";
      var color = hasEm ? emColor : nmColor;
      var cType = getCornerType(corner, border, emphasisW, normalW);
      if (!cType) continue;
      if (cType.type === "uniform") {
        drawUniformArc(ctx, corner, x, y, w, h, radius, cType.width, color);
      } else {
        drawTaperArc(
          ctx,
          corner,
          x,
          y,
          w,
          h,
          radius,
          cType.startWidth,
          cType.endWidth,
          color
        );
      }
    }
  }

  // src/client/engine/v2/renderer.ts
  var Renderer = class {
    constructor(canvas, options = {}) {
      __publicField(this, "canvas");
      __publicField(this, "ctx");
      __publicField(this, "dpr");
      __publicField(this, "width");
      __publicField(this, "height");
      __publicField(this, "backgroundColor");
      __publicField(this, "_isRunning");
      __publicField(this, "_root");
      __publicField(this, "_rafId");
      __publicField(this, "_lastTime");
      __publicField(this, "_frameCount");
      __publicField(this, "_fps");
      // Pretext 缓存：key = font + text
      __publicField(this, "_pretextCache");
      // input 元素缓存：key = Box.id
      __publicField(this, "_inputElements");
      var _a, _b;
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = (_a = options.dpr) != null ? _a : window.devicePixelRatio || 1;
      this.backgroundColor = (_b = options.backgroundColor) != null ? _b : "#0a0a0f";
      this.width = 0;
      this.height = 0;
      this._isRunning = false;
      this._root = null;
      this._rafId = 0;
      this._lastTime = 0;
      this._frameCount = 0;
      this._fps = 0;
      this._pretextCache = /* @__PURE__ */ new Map();
      this._inputElements = /* @__PURE__ */ new Map();
      this.resize();
    }
    // ============================================================
    // 生命周期
    // ============================================================
    resize() {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.width = w;
      this.height = h;
    }
    setRoot(box) {
      this._root = box;
      return this;
    }
    getRoot() {
      return this._root;
    }
    start() {
      if (this._isRunning) return this;
      this._isRunning = true;
      this._lastTime = performance.now();
      const loop = (now) => {
        if (!this._isRunning) return;
        this._render(now);
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
      return this;
    }
    stop() {
      this._isRunning = false;
      if (this._rafId) cancelAnimationFrame(this._rafId);
      return this;
    }
    get isRunning() {
      return this._isRunning;
    }
    get fps() {
      return this._fps;
    }
    // ============================================================
    // 渲染主循环
    // ============================================================
    _render(now) {
      if (this._lastTime) {
        const delta = now - this._lastTime;
        this._fps = Math.round(1e3 / delta);
      }
      this._lastTime = now;
      this._frameCount++;
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
      if (this._root) {
        this._tickAndRender(this._root, now, 1);
        try {
          this._manageInputs(this._root);
        } catch (e) {
          console.error("_manageInputs error", e);
        }
      }
    }
    _tickAndRender(box, now, parentOpacity) {
      box.tickAnimations(now);
      if (!box.visible) return;
      const opacity = box.opacity * parentOpacity;
      if (opacity <= 0) return;
      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      const bounds = box.getBounds();
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const { scale, rotate, translateX, translateY } = box.transform;
      if (translateX !== 0 || translateY !== 0) {
        this.ctx.translate(translateX, translateY);
      }
      if (rotate !== 0 || scale !== 1) {
        this.ctx.translate(cx, cy);
        if (rotate !== 0) this.ctx.rotate(rotate);
        if (scale !== 1) this.ctx.scale(scale, scale);
        this.ctx.translate(-cx, -cy);
      }
      if (box.overflow === "hidden" || box.scrollable) {
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, box.borderRadius);
        this.ctx.clip();
      }
      this._drawShadow(box, bounds);
      this._drawBackground(box, bounds);
      if (box.shape) this._drawShape(box, bounds);
      this._drawBorder(box, bounds);
      this._drawHighlight(box, bounds);
      if (box.icon) this._drawIcon(box.icon, bounds, box.padding);
      if (box.textStyle.content) this._drawText(box.textStyle, bounds, box.padding, box.icon);
      if (box.layout) {
        applyFlexLayout(box);
      }
      if (box.scrollable) {
        this.ctx.save();
        this.ctx.translate(-box.scrollX, -box.scrollY);
      }
      const sortedChildren = [...box.children].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      for (const child of sortedChildren) {
        this._tickAndRender(child, now, opacity);
      }
      if (box.scrollable) {
        this.ctx.restore();
        if (box.scrollbarVisible) {
          this._drawScrollbar(box, bounds);
        }
      }
      this.ctx.restore();
    }
    // ============================================================
    // input 元素管理（Phase 2 Demo）
    // ============================================================
    _manageInputs(root) {
      var _a, _b, _c, _d, _e, _f, _g;
      const inputableBoxes = root.flatten().filter((b) => {
        var _a2;
        return (_a2 = b.inputable) == null ? void 0 : _a2.enabled;
      });
      const seenIds = /* @__PURE__ */ new Set();
      for (const box of inputableBoxes) {
        seenIds.add(box.id);
        const bounds = box.getBounds();
        let el = this._inputElements.get(box.id);
        if (!el) {
          const isTextarea = ((_a = box.inputable) == null ? void 0 : _a.type) === "textarea";
          el = document.createElement(isTextarea ? "textarea" : "input");
          el.style.position = "fixed";
          el.style.background = "transparent";
          el.style.border = "none";
          el.style.outline = "none";
          el.style.fontSize = "16px";
          el.style.color = "#e0e0e0";
          el.style.zIndex = "10";
          el.style.resize = "none";
          el.style.padding = "10px";
          el.style.boxSizing = "border-box";
          el.style.lineHeight = (((_b = box.inputable) == null ? void 0 : _b.lineHeight) || 24) + "px";
          if (isTextarea) {
            el.style.wordWrap = "break-word";
            el.style.overflowY = "auto";
            const maxRows = ((_c = box.inputable) == null ? void 0 : _c.maxRows) || 5;
            const lineHeight = ((_d = box.inputable) == null ? void 0 : _d.lineHeight) || 24;
            const maxHeight = maxRows * lineHeight + 20;
            el.style.maxHeight = maxHeight + "px";
            const textareaEl = el;
            const inputBox = box;
            const rendererInstance = this;
            const adjustHeight = () => {
              textareaEl.style.height = "auto";
              const scrollHeight = textareaEl.scrollHeight;
              const minHeight = lineHeight;
              const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
              textareaEl.style.height = newHeight + "px";
              inputBox.height = newHeight;
              if (inputBox.parent) {
                inputBox.parent.height = newHeight + 24;
                inputBox.parent.y = rendererInstance.height - inputBox.parent.height;
              }
            };
            el.addEventListener("input", adjustHeight);
            el.style.height = lineHeight + "px";
            inputBox.height = lineHeight;
            if (inputBox.parent) {
              inputBox.parent.height = lineHeight + 24;
              inputBox.parent.y = rendererInstance.height - inputBox.parent.height;
            }
          }
          el.setAttribute("autocapitalize", "off");
          el.setAttribute("autocomplete", "off");
          el.setAttribute("autocorrect", "off");
          if ((_e = box.inputable) == null ? void 0 : _e.placeholder) el.placeholder = box.inputable.placeholder;
          if ((_f = box.inputable) == null ? void 0 : _f.value) el.value = box.inputable.value;
          el.style.left = `${bounds.x}px`;
          el.style.top = `${bounds.y}px`;
          el.style.width = `${bounds.width}px`;
          el.style.height = `${bounds.height}px`;
          (_g = this.canvas.parentElement) == null ? void 0 : _g.appendChild(el);
          this._inputElements.set(box.id, el);
        } else {
          el.style.left = `${bounds.x}px`;
          el.style.top = `${bounds.y}px`;
          el.style.width = `${bounds.width}px`;
          el.style.height = `${bounds.height}px`;
        }
      }
      for (const [id, el] of this._inputElements) {
        if (!seenIds.has(id)) {
          el.remove();
          this._inputElements.delete(id);
        }
      }
    }
    // ============================================================
    // 绘制层
    // ============================================================
    _drawShadow(box, b) {
      const shadow = box.shadow;
      if (!shadow) return;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(-1e4, -1e4, 2e4, 2e4);
      this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
      this.ctx.clip("evenodd");
      this.ctx.shadowColor = shadow.color;
      this.ctx.shadowBlur = shadow.blur;
      this.ctx.shadowOffsetX = shadow.offsetX + 1e4;
      this.ctx.shadowOffsetY = shadow.offsetY;
      this.ctx.fillStyle = "#000";
      this.ctx.beginPath();
      this.ctx.roundRect(b.x - 1e4, b.y, b.width, b.height, box.borderRadius);
      this.ctx.fill();
      this.ctx.restore();
    }
    /** 绘制矢量形状（Phase 2 Demo） */
    _drawShape(box, b) {
      var _a, _b;
      const shape = box.shape;
      const points = shape.points;
      if (points.length < 2) return;
      const composite = (_a = shape.composite) != null ? _a : "destination-out";
      const closed = (_b = shape.closed) != null ? _b : true;
      this.ctx.save();
      this.ctx.globalCompositeOperation = composite;
      this.ctx.beginPath();
      this.ctx.moveTo(b.x + points[0].x * b.width, b.y + points[0].y * b.height);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(b.x + points[i].x * b.width, b.y + points[i].y * b.height);
      }
      if (closed) this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
    _drawBackground(box, b) {
      const prevComposite = box.composite || "";
      if (prevComposite) {
        this.ctx.save();
        this.ctx.globalCompositeOperation = prevComposite;
      }
      if (box.gradient) {
        this._drawGradient(box.gradient, b, box.borderRadius);
      } else {
        this.ctx.fillStyle = box.backgroundColor;
        this.ctx.beginPath();
        this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
        this.ctx.fill();
      }
      if (prevComposite) {
        this.ctx.restore();
      }
      if (box.backgroundPattern && box.backgroundPattern.type === "grid") {
        this._drawBoxGridPattern(box, b);
      }
    }
    /** 绘制 Box 内的网格背景图案 */
    _drawBoxGridPattern(box, b) {
      var _a, _b, _c;
      const pattern = box.backgroundPattern;
      const cellSize = (_a = pattern.cellSize) != null ? _a : 20;
      const lineColor = (_b = pattern.lineColor) != null ? _b : "#2a2a3a";
      const lineWidth = (_c = pattern.lineWidth) != null ? _c : 1;
      this.ctx.save();
      this.ctx.strokeStyle = lineColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
      this.ctx.clip();
      for (let x = b.x; x <= b.x + b.width; x += cellSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, b.y);
        this.ctx.lineTo(x, b.y + b.height);
        this.ctx.stroke();
      }
      for (let y = b.y; y <= b.y + b.height; y += cellSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(b.x, y);
        this.ctx.lineTo(b.x + b.width, y);
        this.ctx.stroke();
      }
      this.ctx.restore();
      if (this._frameCount === 1) {
        const vLines = Math.floor(b.width / cellSize) + 1;
        const hLines = Math.floor(b.height / cellSize) + 1;
      }
    }
    _drawGradient(grad, b, radius) {
      let fillStyle;
      if (grad.type === "linear") {
        const angle = grad.angle * Math.PI / 180;
        const halfW = b.width / 2;
        const halfH = b.height / 2;
        fillStyle = this.ctx.createLinearGradient(
          b.x + halfW - Math.cos(angle) * halfW,
          b.y + halfH - Math.sin(angle) * halfH,
          b.x + halfW + Math.cos(angle) * halfW,
          b.y + halfH + Math.sin(angle) * halfH
        );
      } else {
        fillStyle = this.ctx.createRadialGradient(
          b.x + b.width / 2,
          b.y + b.height / 2,
          0,
          b.x + b.width / 2,
          b.y + b.height / 2,
          Math.max(b.width, b.height) / 2
        );
      }
      for (const stop of grad.stops) {
        fillStyle.addColorStop(stop.offset, stop.color);
      }
      this.ctx.fillStyle = fillStyle;
      this.ctx.beginPath();
      this.ctx.roundRect(b.x, b.y, b.width, b.height, radius);
      this.ctx.fill();
    }
    _drawScrollbar(box, b) {
      const content = box.getContentSize();
      const viewportH = b.height - box.padding.top - box.padding.bottom;
      const viewportW = b.width - box.padding.left - box.padding.right;
      const maxScroll = box.getMaxScroll();
      if (maxScroll.maxY > 0 && (box.scrollDirection === "vertical" || box.scrollDirection === "both")) {
        const trackHeight = viewportH;
        const thumbHeight = Math.max(20, viewportH / content.height * trackHeight);
        const thumbY = b.y + box.padding.top + box.scrollY / maxScroll.maxY * (trackHeight - thumbHeight);
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        this.ctx.beginPath();
        this.ctx.roundRect(b.x + b.width - 6, thumbY, 4, thumbHeight, 2);
        this.ctx.fill();
      }
      if (maxScroll.maxX > 0 && (box.scrollDirection === "horizontal" || box.scrollDirection === "both")) {
        const trackWidth = viewportW;
        const thumbWidth = Math.max(20, viewportW / content.width * trackWidth);
        const thumbX = b.x + box.padding.left + box.scrollX / maxScroll.maxX * (trackWidth - thumbWidth);
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        this.ctx.beginPath();
        this.ctx.roundRect(thumbX, b.y + b.height - 6, thumbWidth, 4, 2);
        this.ctx.fill();
      }
    }
    _drawCursorBorder(b, data) {
      const ctx = this.ctx;
      const color = data.color || "rgba(0,212,255,0.7)";
      const x = b.x;
      const y = b.y;
      const h = b.height;
      const R = 4;
      const EW = 3;
      const NW = 1;
      const seg = 12;
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = "butt";
      ctx.fillRect(x - 1.65, y + R, EW, h - R * 2);
      const tlCx = x + R, tlCy = y + R + 0.1;
      for (let i = 0; i < seg; i++) {
        const t = (i + 0.5) / seg;
        ctx.lineWidth = EW + (NW - EW) * t;
        const a1 = Math.PI + Math.PI / 2 * (i / seg);
        const a2 = Math.PI + Math.PI / 2 * ((i + 1) / seg);
        ctx.beginPath();
        ctx.arc(tlCx, tlCy, R, a1, a2, false);
        ctx.stroke();
      }
      const blCx = x + R, blCy = y + h - R;
      for (let i = 0; i < seg; i++) {
        const t = (i + 0.5) / seg;
        ctx.lineWidth = NW + (EW - NW) * t;
        const a1 = Math.PI / 2 + Math.PI / 2 * (i / seg);
        const a2 = Math.PI / 2 + Math.PI / 2 * ((i + 1) / seg);
        ctx.beginPath();
        ctx.arc(blCx, blCy, R, a1, a2, false);
        ctx.stroke();
      }
      const topW = data.topLineW || 0;
      if (topW > 0) {
        ctx.lineWidth = NW;
        ctx.beginPath();
        ctx.moveTo(x + R, y);
        ctx.lineTo(x + R + topW, y);
        ctx.stroke();
      }
      const botW = data.botLineW || 0;
      if (botW > 0) {
        ctx.lineWidth = NW;
        ctx.beginPath();
        ctx.moveTo(x + R, y + h);
        ctx.lineTo(x + R + botW, y + h);
        ctx.stroke();
      }
      ctx.restore();
    }
    _drawBorder(box, b) {
      const cdata = box.data;
      if (cdata == null ? void 0 : cdata.cursorDynamicLines) {
        this._drawCursorBorder(b, cdata);
        return;
      }
      if (box.kfmStyle) {
        drawBorders(this.ctx, b.x, b.y, b.width, b.height, box.kfmStyle);
        return;
      }
      const border = box.border;
      if (!border || border.width <= 0) return;
      const { color, width, sides } = border;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = width;
      this.ctx.lineCap = "round";
      const x = b.x, y = b.y, w = b.width, h = b.height, r = box.borderRadius;
      this.ctx.beginPath();
      if (sides.top) {
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
      }
      if (sides.right) {
        this.ctx.moveTo(x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
      }
      if (sides.bottom) {
        this.ctx.moveTo(x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
      }
      if (sides.left) {
        this.ctx.moveTo(x, y + h - r);
        this.ctx.lineTo(x, y + r);
      }
      this.ctx.stroke();
      if (sides.top && sides.right && sides.bottom && sides.left) {
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, r);
        this.ctx.stroke();
      }
    }
    _drawHighlight(box, b) {
      const hl = box.highlight;
      if (!hl) return;
      this.ctx.strokeStyle = hl.color;
      this.ctx.lineWidth = hl.width;
      this.ctx.lineCap = "round";
      if (hl.side === "all") {
        if (box.borderRadius > 0) {
          this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
        } else {
          this.ctx.strokeRect(b.x, b.y, b.width, b.height);
        }
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(b.x + hl.width / 2, b.y + 4);
        this.ctx.lineTo(b.x + hl.width / 2, b.y + b.height - 4);
        this.ctx.stroke();
      }
    }
    _drawIcon(icon, b, padding) {
      const iconX = icon.position === "left" ? b.x + padding.left : b.x + b.width - padding.right - icon.size;
      const iconY = b.y + padding.top;
      this.ctx.font = `${icon.size}px system-ui`;
      this.ctx.fillStyle = "#e0e0e0";
      this.ctx.textBaseline = "top";
      this.ctx.textAlign = "left";
      this.ctx.fillText(icon.char, iconX, iconY);
    }
    // ============================================================
    // Pretext 文本渲染
    // ============================================================
    _getTextKey(text, font) {
      return `${font}::${text}`;
    }
    _drawText(style, b, padding, icon) {
      if (!style.content) return;
      const iconWidth = icon && icon.position === "left" ? icon.size + 8 : 0;
      const iconRightWidth = icon && icon.position === "right" ? icon.size + 8 : 0;
      const textX = b.x + padding.left + iconWidth;
      const textY = b.y + padding.top;
      const maxWidth = b.width - padding.left - padding.right - iconWidth - iconRightWidth;
      if (maxWidth <= 0) return;
      const key = this._getTextKey(style.content, style.font);
      let prepared = this._pretextCache.get(key);
      if (!prepared) {
        try {
          prepared = prepareWithSegments(style.content, style.font);
          this._pretextCache.set(key, prepared);
        } catch {
          this._drawTextFallback(style, textX, textY, maxWidth, b, padding);
          return;
        }
      }
      const { lines } = layoutWithLines(prepared, maxWidth, style.lineHeight);
      const maxL = style.maxLines > 0 ? style.maxLines : lines.length;
      const visibleLines = lines.slice(0, maxL);
      const totalTextHeight = visibleLines.length * style.lineHeight;
      const availableHeight = b.height - padding.top - padding.bottom;
      let offsetY = 0;
      if (style.verticalAlign === "middle") {
        offsetY = (availableHeight - totalTextHeight) / 2;
      } else if (style.verticalAlign === "bottom") {
        offsetY = availableHeight - totalTextHeight;
      }
      this.ctx.font = style.font;
      this.ctx.fillStyle = style.color;
      this.ctx.textBaseline = "middle";
      const metrics = this.ctx.measureText("Ag");
      const fontHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent);
      const lineGap = (style.lineHeight - fontHeight) / 2;
      for (let i = 0; i < visibleLines.length; i++) {
        const line = visibleLines[i];
        let lineText = line.text;
        const isOverflowing = style.overflow === "ellipsis";
        const isTrimmed = lines.length > maxL || maxL === 1 && line.width >= maxWidth - 2;
        if (isOverflowing && i === maxL - 1 && isTrimmed) {
          lineText = lineText.slice(0, -1) + "\u2026";
          line.width = this.ctx.measureText(lineText).width;
        }
        let alignX = textX;
        if (style.align === "center") {
          alignX = textX + (maxWidth - line.width) / 2;
        } else if (style.align === "right") {
          alignX = textX + maxWidth - line.width;
        }
        const lineCenterY = textY + offsetY + i * style.lineHeight + style.lineHeight / 2;
        this.ctx.fillText(lineText, alignX, lineCenterY);
      }
    }
    /** 简单文本渲染回退（Pretext 不可用时） */
    _drawTextFallback(style, x, y, maxWidth, b, padding) {
      this.ctx.font = style.font;
      this.ctx.fillStyle = style.color;
      this.ctx.textBaseline = "middle";
      const centerY = y + (b.height - padding.top - padding.bottom) / 2;
      let text = style.content;
      const measured = this.ctx.measureText(text);
      if (measured.width > maxWidth) {
        while (text.length > 0 && this.ctx.measureText(text + "\u2026").width > maxWidth) {
          text = text.slice(0, -1);
        }
        text += "\u2026";
      }
      this.ctx.fillText(text, x, centerY);
    }
    // ============================================================
    // 碰撞检测
    // ============================================================
    /** 获取指定坐标下最顶层的可交互 Box */
    hitTest(x, y) {
      if (!this._root) return null;
      return this._hitTestRecursive(this._root, x, y);
    }
    _hitTestRecursive(box, x, y) {
      if (!box.visible || !box.interactive || box.disabled) return null;
      for (let i = box.children.length - 1; i >= 0; i--) {
        const found = this._hitTestRecursive(box.children[i], x, y);
        if (found) return found;
      }
      if (box.containsPoint(x, y)) {
        if (box.gesture) {
          const hasCallbacks = this._hasGestureCallbacks(box.gesture);
          const isPassive = box.gesture.passive !== false;
          if (isPassive && !hasCallbacks) {
            return null;
          }
        }
        return box;
      }
      return null;
    }
    /** 检测 gesture 是否绑定了任何回调 */
    _hasGestureCallbacks(gesture) {
      return !!(gesture.onTap || gesture.onLongPress || gesture.onSwipeLeft || gesture.onSwipeRight || gesture.onSwipeUp || gesture.onSwipeDown || gesture.onPan || gesture.onPanEnd || gesture.onPinch || gesture.onRotate || gesture.onCancel);
    }
    // ============================================================
    // 缓存管理
    // ============================================================
    clearTextCache() {
      this._pretextCache.clear();
    }
  };

  // src/client/engine/v2/utils.ts
  var ZERO_SPACING = { top: 0, right: 0, bottom: 0, left: 0 };

  // src/client/engine/v2/animation.ts
  function ease(name, t) {
    switch (name) {
      case "linear":
        return t;
      case "easeInQuad":
        return t * t;
      case "easeOutQuad":
        return t * (2 - t);
      case "easeInOutQuad":
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case "easeInCubic":
        return t * t * t;
      case "easeOutCubic": {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
      }
      case "easeInOutCubic":
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      case "easeOutElastic": {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
      }
      case "easeOutBounce": {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) {
          const t1 = t - 1.5 / 2.75;
          return 7.5625 * t1 * t1 + 0.75;
        }
        if (t < 2.5 / 2.75) {
          const t1 = t - 2.25 / 2.75;
          return 7.5625 * t1 * t1 + 0.9375;
        }
        {
          const t1 = t - 2.625 / 2.75;
          return 7.5625 * t1 * t1 + 0.984375;
        }
      }
    }
  }

  // src/client/engine/v2/box.ts
  var Box = class _Box {
    constructor(options = {}) {
      // --- 身份 ---
      __publicField(this, "id");
      __publicField(this, "type");
      // --- 几何 ---
      __publicField(this, "x");
      __publicField(this, "y");
      __publicField(this, "width");
      __publicField(this, "height");
      // --- 盒模型 ---
      __publicField(this, "padding");
      __publicField(this, "margin");
      // --- 视觉 ---
      __publicField(this, "backgroundColor");
      __publicField(this, "gradient");
      __publicField(this, "backgroundPattern");
      // Phase 2 Demo：网格背景
      __publicField(this, "borderRadius");
      __publicField(this, "opacity");
      __publicField(this, "visible");
      // --- 边框 ---
      __publicField(this, "border");
      __publicField(this, "highlight");
      // --- 阴影 ---
      __publicField(this, "shadow");
      // --- 文本 ---
      __publicField(this, "textStyle");
      // --- 图标 ---
      __publicField(this, "icon");
      // --- 交互 ---
      __publicField(this, "interactive");
      __publicField(this, "disabled");
      __publicField(this, "selected");
      __publicField(this, "state");
      __publicField(this, "stateStyles");
      // --- 层级 ---
      __publicField(this, "zIndex");
      __publicField(this, "overflow");
      // --- 变换 ---
      __publicField(this, "transform");
      // --- 动画 ---
      __publicField(this, "animations");
      // --- 树形 ---
      __publicField(this, "children");
      __publicField(this, "parent");
      __publicField(this, "data");
      // --- Flex 布局 ---
      __publicField(this, "layout");
      __publicField(this, "layoutItem");
      // --- 滚动容器 ---
      __publicField(this, "scrollable");
      __publicField(this, "scrollX");
      __publicField(this, "scrollY");
      __publicField(this, "scrollDirection");
      __publicField(this, "scrollbarVisible");
      // --- KFM 边���样式（高级）---
      __publicField(this, "kfmStyle");
      __publicField(this, "composite");
      // --- 手势配置（D-013 决策）---
      __publicField(this, "gesture");
      // 矢量形状（Phase 2 Demo）
      __publicField(this, "shape");
      // 可输入配置
      __publicField(this, "inputable");
      // --- 事件 ---
      __publicField(this, "eventHandlers");
      // --- 缓存 ---
      __publicField(this, "_contentWidth");
      __publicField(this, "_contentHeight");
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X;
      this.id = options.id || `box_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.type = (_a = options.type) != null ? _a : "container";
      this.x = (_b = options.x) != null ? _b : 0;
      this.y = (_c = options.y) != null ? _c : 0;
      this.width = (_d = options.width) != null ? _d : 100;
      this.height = (_e = options.height) != null ? _e : 40;
      this.padding = { ...ZERO_SPACING, ...options.padding };
      this.margin = { ...ZERO_SPACING, ...options.margin };
      this.backgroundColor = (_f = options.backgroundColor) != null ? _f : "#12121a";
      this.gradient = (_g = options.gradient) != null ? _g : null;
      this.backgroundPattern = (_h = options.backgroundPattern) != null ? _h : null;
      this.borderRadius = (_i = options.borderRadius) != null ? _i : 8;
      this.opacity = (_j = options.opacity) != null ? _j : 1;
      this.visible = (_k = options.visible) != null ? _k : true;
      this.border = (_l = options.border) != null ? _l : null;
      this.highlight = (_m = options.highlight) != null ? _m : null;
      this.shadow = (_n = options.shadow) != null ? _n : null;
      this.textStyle = {
        content: (_o = options.text) != null ? _o : "",
        color: (_p = options.textColor) != null ? _p : "#e0e0e0",
        font: (_q = options.font) != null ? _q : "14px system-ui, sans-serif",
        lineHeight: (_r = options.lineHeight) != null ? _r : 20,
        align: (_s = options.textAlign) != null ? _s : "left",
        verticalAlign: (_t = options.textVerticalAlign) != null ? _t : "middle",
        overflow: (_u = options.textOverflow) != null ? _u : "ellipsis",
        maxLines: (_v = options.maxLines) != null ? _v : 1
      };
      this.icon = options.icon ? { char: options.icon, size: (_w = options.iconSize) != null ? _w : 16, position: (_x = options.iconPosition) != null ? _x : "left" } : null;
      this.interactive = (_y = options.interactive) != null ? _y : this.type === "button" || this.type === "list-item";
      this.disabled = (_z = options.disabled) != null ? _z : false;
      this.selected = (_A = options.selected) != null ? _A : false;
      this.state = "normal";
      this.stateStyles = (_B = options.stateStyles) != null ? _B : {};
      this.zIndex = (_C = options.zIndex) != null ? _C : 0;
      this.overflow = (_D = options.overflow) != null ? _D : "visible";
      this.transform = {
        scale: (_F = (_E = options.transform) == null ? void 0 : _E.scale) != null ? _F : 1,
        rotate: (_H = (_G = options.transform) == null ? void 0 : _G.rotate) != null ? _H : 0,
        translateX: (_J = (_I = options.transform) == null ? void 0 : _I.translateX) != null ? _J : 0,
        translateY: (_L = (_K = options.transform) == null ? void 0 : _K.translateY) != null ? _L : 0
      };
      this.animations = [];
      this.children = (_M = options.children) != null ? _M : [];
      this.parent = null;
      this.data = (_N = options.data) != null ? _N : {};
      this.children.forEach((child) => {
        child.parent = this;
      });
      this.layout = (_O = options.layout) != null ? _O : null;
      this.layoutItem = (_P = options.layoutItem) != null ? _P : null;
      this.scrollable = (_Q = options.scrollable) != null ? _Q : false;
      this.scrollX = (_R = options.scrollX) != null ? _R : 0;
      this.scrollY = (_S = options.scrollY) != null ? _S : 0;
      this.scrollDirection = (_T = options.scrollDirection) != null ? _T : "vertical";
      this.scrollbarVisible = (_U = options.scrollbarVisible) != null ? _U : true;
      this.kfmStyle = (_V = options.kfmStyle) != null ? _V : null;
      this.composite = options.composite || "";
      this.gesture = (_W = options.gesture) != null ? _W : null;
      this.shape = (_X = options.shape) != null ? _X : null;
      if (options.inputable) {
        this.inputable = typeof options.inputable === "boolean" ? { enabled: options.inputable } : options.inputable;
      } else {
        this.inputable = null;
      }
      this.eventHandlers = /* @__PURE__ */ new Map();
      this._contentWidth = null;
      this._contentHeight = null;
    }
    // ============================================================
    // 几何计算
    // ============================================================
    /** 内容区域（去掉 padding 后的矩形） */
    get contentRect() {
      return {
        x: this.padding.left,
        y: this.padding.top,
        width: this.width - this.padding.left - this.padding.right,
        height: this.height - this.padding.top - this.padding.bottom
      };
    }
    /** 绝对位置（含所有父级偏移） */
    getAbsolutePosition() {
      let x = this.x;
      let y = this.y;
      let p = this.parent;
      while (p) {
        x += p.x + p.padding.left;
        y += p.y + p.padding.top;
        p = p.parent;
      }
      return { x, y };
    }
    /** 考虑 transform 后的包围盒 */
    getBounds() {
      const pos = this.getAbsolutePosition();
      const s = this.transform.scale;
      return {
        x: pos.x + this.transform.translateX,
        y: pos.y + this.transform.translateY,
        width: this.width * s,
        height: this.height * s
      };
    }
    /** 点是否在 Box 内 */
    containsPoint(px, py) {
      const b = this.getBounds();
      return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
    }
    // ============================================================
    // 滚动相关
    // ============================================================
    /** 计算内容实际尺寸（Flex 布局后的子元素边界） */
    getContentSize() {
      if (this.children.length === 0) {
        return { width: 0, height: 0 };
      }
      let maxRight = 0;
      let maxBottom = 0;
      for (const child of this.children) {
        const childRight = child.x + child.width;
        const childBottom = child.y + child.height;
        maxRight = Math.max(maxRight, childRight);
        maxBottom = Math.max(maxBottom, childBottom);
      }
      return { width: maxRight, height: maxBottom };
    }
    /** 获取最大滚动偏移 */
    getMaxScroll() {
      const content = this.getContentSize();
      const viewportW = this.width - this.padding.left - this.padding.right;
      const viewportH = this.height - this.padding.top - this.padding.bottom;
      return {
        maxX: Math.max(0, content.width - viewportW),
        maxY: Math.max(0, content.height - viewportH)
      };
    }
    /** 将滚动偏移限制在合法范围内 */
    clampScroll() {
      const max = this.getMaxScroll();
      if (this.scrollDirection === "vertical" || this.scrollDirection === "both") {
        this.scrollY = Math.max(0, Math.min(this.scrollY, max.maxY));
      }
      if (this.scrollDirection === "horizontal" || this.scrollDirection === "both") {
        this.scrollX = Math.max(0, Math.min(this.scrollX, max.maxX));
      }
    }
    // ============================================================
    // 树操作
    // ============================================================
    addChild(child) {
      child.parent = this;
      this.children.push(child);
      return this;
    }
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i > -1) {
        this.children.splice(i, 1);
        child.parent = null;
      }
      return this;
    }
    /** 深度优先查找 */
    find(predicate) {
      if (predicate(this)) return this;
      for (const child of this.children) {
        const found = child.find(predicate);
        if (found) return found;
      }
      return null;
    }
    /** 扁平化所有后代 */
    flatten(result = []) {
      result.push(this);
      for (const child of this.children) {
        child.flatten(result);
      }
      return result;
    }
    // ============================================================
    // 交互
    // ============================================================
    on(event, handler) {
      this.eventHandlers.set(event, handler);
      return this;
    }
    off(event) {
      this.eventHandlers.delete(event);
      return this;
    }
    emit(event, x, y, originalEvent) {
      const handler = this.eventHandlers.get(event);
      if (handler) {
        handler({ box: this, x, y, originalEvent });
      }
    }
    setState(state) {
      if (this.state === state) return;
      this.state = state;
    }
    /** 获取当前状态对应的样式覆盖 */
    getStateStyle() {
      var _a, _b;
      return (_b = (_a = this.stateStyles[this.state]) != null ? _a : this.stateStyles.normal) != null ? _b : {};
    }
    // ============================================================
    // 动画
    // ============================================================
    animate(prop, to, duration, easing = "easeOutCubic", onComplete) {
      const from = this.getAnimProp(prop);
      this.animations.push({
        prop,
        from,
        to,
        duration,
        startTime: performance.now(),
        easing,
        onComplete
      });
      return this;
    }
    getAnimProp(prop) {
      switch (prop) {
        case "opacity":
          return this.opacity;
        case "scale":
          return this.transform.scale;
        case "rotate":
          return this.transform.rotate;
        case "translateX":
          return this.transform.translateX;
        case "translateY":
          return this.transform.translateY;
        case "x":
          return this.x;
        case "y":
          return this.y;
        case "width":
          return this.width;
        case "height":
          return this.height;
      }
    }
    setAnimProp(prop, value) {
      switch (prop) {
        case "opacity":
          this.opacity = value;
          break;
        case "scale":
          this.transform.scale = value;
          break;
        case "rotate":
          this.transform.rotate = value;
          break;
        case "translateX":
          this.transform.translateX = value;
          break;
        case "translateY":
          this.transform.translateY = value;
          break;
        case "x":
          this.x = value;
          break;
        case "y":
          this.y = value;
          break;
        case "width":
          this.width = value;
          break;
        case "height":
          this.height = value;
          break;
      }
    }
    /** 更新所有活跃动画，返回是否有动画在播放 */
    tickAnimations(now) {
      let active = false;
      this.animations = this.animations.filter((anim) => {
        var _a;
        const elapsed = now - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);
        const eased = ease(anim.easing, progress);
        const value = anim.from + (anim.to - anim.from) * eased;
        this.setAnimProp(anim.prop, value);
        if (progress >= 1) {
          (_a = anim.onComplete) == null ? void 0 : _a.call(anim);
          return false;
        }
        active = true;
        return true;
      });
      for (const child of this.children) {
        if (child.tickAnimations(now)) active = true;
      }
      return active;
    }
    // ============================================================
    // 工具
    // ============================================================
    clone() {
      return new _Box({
        ...this.serialize(),
        id: void 0,
        children: this.children.map((c) => c.clone())
      });
    }
    serialize() {
      var _a, _b, _c, _d, _e, _f;
      return {
        id: this.id,
        type: this.type,
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        padding: { ...this.padding },
        margin: { ...this.margin },
        backgroundColor: this.backgroundColor,
        gradient: this.gradient ? { ...this.gradient } : null,
        borderRadius: this.borderRadius,
        opacity: this.opacity,
        visible: this.visible,
        border: this.border ? { ...this.border } : null,
        highlight: this.highlight ? { ...this.highlight } : null,
        shadow: this.shadow ? { ...this.shadow } : null,
        text: this.textStyle.content,
        textColor: this.textStyle.color,
        font: this.textStyle.font,
        lineHeight: this.textStyle.lineHeight,
        textAlign: this.textStyle.align,
        textVerticalAlign: this.textStyle.verticalAlign,
        textOverflow: this.textStyle.overflow,
        maxLines: this.textStyle.maxLines,
        icon: (_b = (_a = this.icon) == null ? void 0 : _a.char) != null ? _b : null,
        iconSize: (_c = this.icon) == null ? void 0 : _c.size,
        iconPosition: (_d = this.icon) == null ? void 0 : _d.position,
        interactive: this.interactive,
        disabled: this.disabled,
        selected: this.selected,
        stateStyles: { ...this.stateStyles },
        zIndex: this.zIndex,
        overflow: this.overflow,
        transform: { ...this.transform },
        layout: (_e = this.layout) != null ? _e : void 0,
        layoutItem: (_f = this.layoutItem) != null ? _f : void 0,
        scrollable: this.scrollable,
        scrollX: this.scrollX,
        scrollY: this.scrollY,
        scrollDirection: this.scrollDirection,
        scrollbarVisible: this.scrollbarVisible,
        kfmStyle: this.kfmStyle ? { ...this.kfmStyle } : null,
        gesture: this.gesture ? { ...this.gesture } : null,
        shape: this.shape ? { ...this.shape, points: [...this.shape.points] } : null,
        inputable: this.inputable ? { ...this.inputable } : void 0,
        data: { ...this.data }
      };
    }
  };

  // src/client/modules/style-registry.ts
  var DIMENSIONS = {
    BOX_HEIGHT: 26,
    SIDEBAR_WIDTH: 295,
    DISPLAY_WIDTH: 280,
    RIGHT_MARGIN: 287,
    INDENT: 18,
    ROW_PAD: 8,
    TRIANGLE_SIZE: 9,
    TRIANGLE_GAP: 5
  };
  var COLORS = {
    DIR: "#7c3aed",
    FILE: "#e0e0e0",
    ACCENT: "#00d4ff",
    SELECTED_BG: "rgba(124,58,237,0.15)",
    CANVAS_BG: "rgba(10,10,15,0.85)"
  };
  var FONT = "11px system-ui, sans-serif";
  var LINE_HEIGHT = 16;
  var MAX_LINES = 2;
  var TEXT_STYLES = {
    folderLabel: {
      font: FONT,
      lineHeight: LINE_HEIGHT,
      align: "left",
      verticalAlign: "top",
      overflow: "ellipsis",
      maxLines: MAX_LINES
    },
    fileLabel: {
      font: FONT,
      lineHeight: LINE_HEIGHT,
      align: "left",
      verticalAlign: "top",
      overflow: "ellipsis",
      maxLines: MAX_LINES
    },
    toggleIcon: {
      font: `${DIMENSIONS.TRIANGLE_SIZE}px system-ui, sans-serif`,
      lineHeight: LINE_HEIGHT,
      align: "center",
      verticalAlign: "middle"
    }
  };
  var templates = {
    "folder-row": {
      width: DIMENSIONS.SIDEBAR_WIDTH,
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: "rgba(124,58,237,0.3)",
      borderRadius: 0,
      interactive: true,
      overflow: "hidden"
    },
    "file-row": {
      width: DIMENSIONS.SIDEBAR_WIDTH,
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: "rgba(124,58,237,0.3)",
      borderRadius: 0,
      interactive: true,
      overflow: "hidden"
    },
    "toggle-icon": {
      width: DIMENSIONS.TRIANGLE_SIZE,
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: "transparent",
      borderRadius: 0,
      interactive: false
    },
    "folder-label": {
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: "transparent",
      borderRadius: 0,
      interactive: false
    },
    "file-label": {
      height: DIMENSIONS.BOX_HEIGHT,
      backgroundColor: "transparent",
      borderRadius: 0,
      interactive: false
    },
    "folder-container": {
      backgroundColor: "transparent",
      borderRadius: 4
    },
    "sidebar-root": {
      width: DIMENSIONS.SIDEBAR_WIDTH,
      height: 0,
      backgroundColor: "transparent",
      borderRadius: 0
    }
  };
  var listeners = [];
  var styleRegistry = {
    get(name) {
      const t = templates[name];
      return t ? { ...t } : void 0;
    },
    set(name, updates) {
      const old = templates[name];
      if (!old) {
        templates[name] = { ...updates };
      } else {
        Object.assign(templates[name], updates);
      }
      listeners.forEach((fn) => fn(name, old, templates[name]));
    },
    patch(patches) {
      for (const [name, updates] of Object.entries(patches)) {
        const old = templates[name];
        if (!old) {
          templates[name] = { ...updates };
        } else {
          Object.assign(templates[name], updates);
        }
        listeners.forEach((fn) => fn(name, old, templates[name]));
      }
    },
    subscribe(fn) {
      listeners.push(fn);
    },
    unsubscribe(fn) {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    },
    notify() {
      listeners.forEach((fn) => fn("", void 0, void 0));
    }
  };
  function createBox(templateName, overrides) {
    if (!templates[templateName]) {
      console.warn(`[style-registry] unknown template: "${templateName}"`);
    }
    const base = styleRegistry.get(templateName) || {};
    return new Box({ ...base, ...overrides });
  }
  if (typeof window !== "undefined") {
    window.styleRegistry = styleRegistry;
    window.DIMENSIONS = DIMENSIONS;
    window.COLORS = COLORS;
    window.TEXT_STYLES = TEXT_STYLES;
  }

  // src/client/engine/v2/StyleConfig.ts
  var DEFAULT_BOX_STYLE = {
    border: { left: "emphasis", bottom: "normal", top: "hidden", right: "hidden" },
    borderWidth: 1,
    emphasisScale: 3,
    cornerRadius: 12,
    borderColor: "#7c3aed",
    glowEnabled: false,
    glowRadius: 8,
    background: "glass",
    backgroundOpacity: 0.6
  };
  var PRESETS = {
    "default": {},
    // use DEFAULT_BOX_STYLE
    "all-emphasis": {
      border: { top: "emphasis", right: "emphasis", bottom: "emphasis", left: "emphasis" }
    },
    "all-hidden": {
      border: { top: "hidden", right: "hidden", bottom: "hidden", left: "hidden" },
      background: "glass",
      backgroundOpacity: 0.4
    },
    "left-emphasis-rest-hidden": {
      border: { left: "emphasis", top: "hidden", right: "hidden", bottom: "hidden" }
    },
    "left-bottom-normal": {
      border: { left: "normal", bottom: "normal", top: "hidden", right: "hidden" }
    },
    "bottom-right-normal": {
      border: { bottom: "normal", right: "normal", top: "hidden", left: "hidden" }
    },
    "left-right-emphasis": {
      border: { left: "emphasis", right: "emphasis", top: "hidden", bottom: "hidden" }
    }
  };
  function resolveStyle(preset, overrides) {
    var base = { ...DEFAULT_BOX_STYLE };
    var p = PRESETS[preset];
    if (p) {
      if (p.border) base.border = { ...base.border, ...p.border };
      if (p.borderWidth !== void 0) base.borderWidth = p.borderWidth;
      if (p.emphasisScale !== void 0) base.emphasisScale = p.emphasisScale;
      if (p.cornerRadius !== void 0) base.cornerRadius = p.cornerRadius;
      if (p.borderColor !== void 0) base.borderColor = p.borderColor;
      if (p.glowEnabled !== void 0) base.glowEnabled = p.glowEnabled;
      if (p.glowRadius !== void 0) base.glowRadius = p.glowRadius;
      if (p.background !== void 0) base.background = p.background;
      if (p.backgroundOpacity !== void 0) base.backgroundOpacity = p.backgroundOpacity;
      if (p.backgroundFill !== void 0) base.backgroundFill = p.backgroundFill;
    }
    if (overrides) {
      if (overrides.border) base.border = { ...base.border, ...overrides.border };
      if (overrides.borderWidth !== void 0) base.borderWidth = overrides.borderWidth;
      if (overrides.emphasisScale !== void 0) base.emphasisScale = overrides.emphasisScale;
      if (overrides.cornerRadius !== void 0) base.cornerRadius = overrides.cornerRadius;
      if (overrides.borderColor !== void 0) base.borderColor = overrides.borderColor;
      if (overrides.glowEnabled !== void 0) base.glowEnabled = overrides.glowEnabled;
      if (overrides.glowRadius !== void 0) base.glowRadius = overrides.glowRadius;
      if (overrides.background !== void 0) base.background = overrides.background;
      if (overrides.backgroundOpacity !== void 0) base.backgroundOpacity = overrides.backgroundOpacity;
      if (overrides.backgroundFill !== void 0) base.backgroundFill = overrides.backgroundFill;
    }
    return base;
  }

  // src/client/modules/tree-model.ts
  var SHIFT_TABLE = [18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
  function getShift(depth) {
    var _a;
    return (_a = SHIFT_TABLE[depth]) != null ? _a : 2;
  }
  var T_OFF = 12;
  var TXT_L = 26;
  function absX(d) {
    let x = 0;
    for (let i = 0; i < d; i++) x += getShift(i);
    return x;
  }
  function depthGradient(depth) {
    const shift = getShift(depth);
    const density = 1 - shift / 18;
    const topA = (0.02 + density * 0.18).toFixed(3);
    const botA = (0.08 + density * 0.35).toFixed(3);
    return {
      type: "linear",
      angle: 180,
      stops: [
        { offset: 0, color: `rgba(124,58,237,${topA})` },
        { offset: 1, color: `rgba(124,58,237,${botA})` }
      ]
    };
  }
  function calcTextLayout(name, maxWidth) {
    const prepared = prepareWithSegments(name, FONT);
    const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
    const actualLines = Math.min(lines.length, MAX_LINES);
    return { lines: actualLines, height: actualLines * LINE_HEIGHT + 6 };
  }
  function innerFolderRow(item, y, cw, ctx, depth) {
    const ex = !!ctx.expandedPaths[item.path];
    const sel = ctx.selectedFile === item.path;
    const maxWidth = cw - TXT_L - 16;
    const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
    const row = createBox("folder-row", {
      id: `title-${item.path}`,
      x: 0,
      y,
      width: cw,
      height: rowHeight,
      backgroundColor: sel ? "rgba(124,58,237,0.15)" : "transparent",
      data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
      gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) }
    });
    const tog = createBox("toggle-icon", { id: `toggle-${item.path}`, x: T_OFF, y: 3 });
    tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? "\u25BC" : "\u25B6", color: "#00d4ff" };
    row.addChild(tog);
    const label = createBox("folder-label", { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
    label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: "#e8e0f0" };
    row.addChild(label);
    return row;
  }
  function innerFileRow(item, y, cw, ctx, depth) {
    const sel = ctx.selectedFile === item.path;
    const maxWidth = cw - TXT_L - 16;
    const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
    const row = createBox("file-row", {
      id: `file-${item.path}`,
      x: 0,
      y,
      width: cw,
      height: rowHeight,
      backgroundColor: sel ? "rgba(124,58,237,0.15)" : "transparent",
      data: { path: item.path, isDir: false, depth, lineCount: actualLines },
      gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) }
    });
    const label = createBox("file-label", { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
    label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: "#e8e0f0" };
    row.addChild(label);
    return row;
  }
  function buildExpanded(path, children, ctx, depth, relX, parentWidth) {
    var _a, _b, _c;
    const w = (parentWidth != null ? parentWidth : ctx.rightMargin) - relX;
    const density = 1 - getShift(depth) / 18;
    const borderOp = (0.3 + density * 0.5).toFixed(3);
    const container = createBox("folder-container", {
      id: `expanded-${path}`,
      width: w,
      height: 0,
      x: relX,
      y: 0,
      backgroundColor: "transparent",
      gradient: depthGradient(depth),
      shadow: { color: "rgba(0,0,0,0.5)", blur: 12, offsetX: -4, offsetY: 0 }
    });
    container.kfmStyle = resolveStyle("left-emphasis-rest-hidden", {
      borderColor: `rgba(180,130,255,${borderOp})`,
      emphasisScale: 2,
      cornerRadius: 4
    });
    let cy = 0;
    if (children.length === 0) {
      const lr = createBox("file-row", { id: `loading-${path}`, x: TXT_L, y: 0, width: w - TXT_L, height: LINE_HEIGHT + 6 });
      const lb = createBox("file-label", { id: `loading-label-${path}`, x: 0, width: lr.width - 8, height: lr.height });
      lb.textStyle = { ...TEXT_STYLES.fileLabel, content: "\u2026", color: "#e8e0f0" };
      lr.addChild(lb);
      container.addChild(lr);
      container.height = LINE_HEIGHT + 10;
      return container;
    }
    for (const item of children) {
      if (item.isDir) {
        const folderRow = innerFolderRow(item, cy, w, ctx, depth);
        container.addChild(folderRow);
        cy += folderRow.height;
        if (ctx.expandedPaths[item.path]) {
          const ch = (_c = (_b = (_a = KFMState.files[item.path]) == null ? void 0 : _a.children) != null ? _b : item.children) != null ? _c : [];
          const sub = buildExpanded(item.path, ch, ctx, depth + 1, getShift(depth), w);
          sub.y = cy;
          container.addChild(sub);
          cy += sub.height;
        }
      } else {
        const fileRow = innerFileRow(item, cy, w, ctx, depth);
        container.addChild(fileRow);
        cy += fileRow.height;
      }
    }
    container.height = cy;
    return container;
  }
  function buildTree(items, options = {}) {
    var _a, _b, _c;
    const {
      expandedPaths = {},
      selectedFile = null,
      onDirToggle = () => {
      },
      onFileClick = () => {
      },
      baseDepth = 0,
      containerWidth = 295,
      scrollable = true,
      rightMargin = containerWidth - 8
    } = options;
    const ctx = { expandedPaths, selectedFile, onDirToggle, onFileClick, containerWidth, rightMargin };
    const rootBox = createBox("sidebar-root", {
      id: "file-tree-root",
      width: containerWidth,
      scrollable,
      scrollY: 0,
      height: 0,
      scrollbarVisible: false
    });
    let cy = 0;
    for (const item of items) {
      if (item.isDir) {
        const folderRow = container_AddRootFolderRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
        cy += folderRow.height;
        if (ctx.expandedPaths[item.path]) {
          const ch = (_c = (_b = (_a = KFMState.files[item.path]) == null ? void 0 : _a.children) != null ? _b : item.children) != null ? _c : [];
          const c = buildExpanded(item.path, ch, ctx, baseDepth, absX(baseDepth) + getShift(baseDepth));
          c.y = cy;
          rootBox.addChild(c);
          cy += c.height;
        }
      } else {
        const fileRow = container_AddRootFileRow(rootBox, item, cy, baseDepth, containerWidth, ctx);
        cy += fileRow.height;
      }
    }
    rootBox.height = cy;
    rootBox.scrollY = 0;
    return rootBox;
  }
  function container_AddRootFolderRow(parent, item, y, depth, cw, ctx) {
    const x = absX(depth);
    const w = ctx.rightMargin - x;
    const ex = !!ctx.expandedPaths[item.path];
    const sel = ctx.selectedFile === item.path;
    const maxWidth = w - TXT_L - 16;
    const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
    const row = createBox("folder-row", {
      id: `title-${item.path}`,
      x,
      y,
      width: w,
      height: rowHeight,
      backgroundColor: sel ? "rgba(124,58,237,0.15)" : "transparent",
      data: { path: item.path, isDir: true, isExpanded: ex, depth, lineCount: actualLines },
      gesture: { passive: true, onTap: () => ctx.onDirToggle(item.path, !ex) }
    });
    const tog = createBox("toggle-icon", { id: `toggle-${item.path}`, x: T_OFF, y: 3 });
    tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: ex ? "\u25BC" : "\u25B6", color: "#00d4ff" };
    row.addChild(tog);
    const label = createBox("folder-label", { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
    label.textStyle = { ...TEXT_STYLES.folderLabel, content: item.name, color: "#e8e0f0" };
    row.addChild(label);
    parent.addChild(row);
    return row;
  }
  function container_AddRootFileRow(parent, item, y, depth, cw, ctx) {
    const x = absX(depth);
    const w = ctx.rightMargin - x;
    const sel = ctx.selectedFile === item.path;
    const maxWidth = w - TXT_L - 16;
    const { lines: actualLines, height: rowHeight } = calcTextLayout(item.name, maxWidth);
    const row = createBox("file-row", {
      id: `file-${item.path}`,
      x,
      y,
      width: w,
      height: rowHeight,
      backgroundColor: sel ? "rgba(124,58,237,0.15)" : "transparent",
      data: { path: item.path, isDir: false, depth, lineCount: actualLines },
      gesture: { passive: true, onTap: () => ctx.onFileClick(item.path) }
    });
    const label = createBox("file-label", { id: `label-${item.path}`, x: TXT_L, width: maxWidth, height: rowHeight });
    label.textStyle = { ...TEXT_STYLES.fileLabel, content: item.name, color: "#e8e0f0" };
    row.addChild(label);
    parent.addChild(row);
    return row;
  }
  function buildSidebarTree(containerWidth, rightMargin) {
    var _a, _b;
    const state = KFMState;
    const rm = rightMargin != null ? rightMargin : (containerWidth != null ? containerWidth : 295) - 8;
    return buildTree((_b = (_a = state.files["/root"]) == null ? void 0 : _a.children) != null ? _b : [], {
      expandedPaths: state.expandedPaths,
      selectedFile: state.selectedFile,
      onDirToggle: (p, e) => state.setExpanded(p, e),
      onFileClick: (p) => state.selectFile(p),
      baseDepth: 0,
      containerWidth: containerWidth != null ? containerWidth : 280,
      scrollable: true,
      rightMargin: rm
    });
  }

  // src/client/modules/tree-render.ts
  var renderer = null;
  var cursorBox = null;
  var cursorRowId = null;
  function ensureCursorBox(root, canvasH) {
    var _a;
    if (cursorBox) {
      if (root.children.includes(cursorBox)) return cursorBox;
    }
    cursorBox = new Box({
      id: "cursor-highlight",
      x: 0,
      y: canvasH / 2 - 14,
      width: ((_a = document.getElementById("tree-canvas")) == null ? void 0 : _a.clientWidth) || 280,
      height: 24,
      backgroundColor: "rgba(46,213,163,0.15)",
      borderRadius: 0,
      interactive: false,
      visible: true,
      data: { cursorDynamicLines: true, topLineW: 0, botLineW: 0, color: "rgba(0,212,255,0.7)" }
    });
    root.addChild(cursorBox);
    return cursorBox;
  }
  function moveCursorTo(hitBox) {
    var _a, _b, _c, _d, _e;
    if (!cursorBox) return;
    const abs = hitBox.getAbsolutePosition();
    const canvas = document.getElementById("tree-canvas");
    const visibleW = canvas ? canvas.clientWidth : 280;
    const depth = (_b = (_a = hitBox.data) == null ? void 0 : _a.depth) != null ? _b : 0;
    const shift = getShift(depth);
    const offsetX = shift / 2;
    cursorBox.x = abs.x + offsetX;
    cursorBox.y = abs.y + 2;
    const rm = ((_c = canvas == null ? void 0 : canvas.clientWidth) != null ? _c : 295) - 8;
    cursorBox.width = rm - abs.x - offsetX;
    cursorBox.height = hitBox.height - 4;
    cursorRowId = hitBox.id || null;
    const label = hitBox.children.find((c) => {
      var _a2;
      return (_a2 = c.id) == null ? void 0 : _a2.startsWith("label-");
    });
    let textW = 0;
    if ((_d = label == null ? void 0 : label.textStyle) == null ? void 0 : _d.content) {
      const ctx2d = (_e = canvas == null ? void 0 : canvas.getContext) == null ? void 0 : _e.call(canvas, "2d");
      if (ctx2d) {
        const font = label.textStyle.font || "11px system-ui, sans-serif";
        const labelX = label.x || 0;
        const maxWidth = label.width;
        const content = label.textStyle.content;
        try {
          const prepared = prepareWithSegments(content, font);
          const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
          const firstLine = lines[0];
          let renderWidth2 = firstLine.width;
          if (lines.length > 1 && label.textStyle.overflow === "ellipsis") {
            const truncated = firstLine.text.slice(0, -1) + "\u2026";
            ctx2d.font = font;
            renderWidth2 = ctx2d.measureText(truncated).width;
          }
          textW = labelX + renderWidth2;
        } catch {
          ctx2d.font = font;
          const measured = ctx2d.measureText(content);
          if (measured.width > maxWidth && label.textStyle.overflow === "ellipsis") {
            let text = content;
            while (text.length > 0 && ctx2d.measureText(text + "\u2026").width > maxWidth) {
              text = text.slice(0, -1);
            }
            textW = labelX + ctx2d.measureText(text + "\u2026").width;
          } else {
            textW = labelX + measured.width;
          }
        }
      }
    }
    const totalLineW = cursorBox.width;
    const topLineW = Math.min(Math.max(textW, 20), totalLineW - 10);
    const botLineW = totalLineW - topLineW;
    cursorBox.data = { cursorDynamicLines: true, topLineW, botLineW, color: "rgba(0,212,255,0.7)" };
  }
  function onSidebarOpen() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rebuildTree();
      renderer == null ? void 0 : renderer.resize();
      const canvas = document.getElementById("tree-canvas");
      const tools = document.querySelector(".sidebar-tools");
      if (canvas && tools) tools.style.width = canvas.clientWidth + "px";
    }));
  }
  function onSidebarClose() {
  }
  function initTreeRenderer() {
    const fileTree = document.getElementById("fileTree");
    if (!fileTree) {
      console.warn("[tree-render] #fileTree not found");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.id = "tree-canvas";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    fileTree.innerHTML = "";
    fileTree.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    renderer = new Renderer(canvas, {
      backgroundColor: "rgba(10,10,15,0.85)",
      dpr
    });
    rebuildTree();
    window.__treeRenderer = renderer;
    KFMState.subscribe(() => rebuildTree());
    styleRegistry.subscribe(() => rebuildTree());
    window.addEventListener("resize", () => renderer == null ? void 0 : renderer.resize());
    bindScrollEvents(canvas);
    bindClickEvents(canvas, dpr);
  }
  function getRootScrollY() {
    var _a, _b;
    return (_b = (_a = renderer == null ? void 0 : renderer.getRoot()) == null ? void 0 : _a.scrollY) != null ? _b : null;
  }
  function setRootScrollY(val) {
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (!root) return;
    const maxScroll = root.getMaxScroll().maxY;
    root.scrollY = Math.max(0, Math.min(val, maxScroll));
  }
  function bindScrollEvents(canvas) {
    let wheelTarget = 0;
    let wheelRaf = 0;
    canvas.addEventListener("wheel", (e) => {
      var _a;
      e.preventDefault();
      const cur = (_a = getRootScrollY()) != null ? _a : 0;
      wheelTarget = cur + e.deltaY;
      if (!wheelRaf) {
        wheelRaf = requestAnimationFrame(function smoothWheel() {
          var _a2;
          const cur2 = (_a2 = getRootScrollY()) != null ? _a2 : 0;
          const diff = wheelTarget - cur2;
          if (Math.abs(diff) < 0.5) {
            setRootScrollY(wheelTarget);
            wheelRaf = 0;
            return;
          }
          setRootScrollY(cur2 + diff * 0.25);
          wheelRaf = requestAnimationFrame(smoothWheel);
        });
      }
    }, { passive: false });
    let touchStartY2 = 0;
    let touchScrollY = 0;
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let velocity = 0;
    let flingRaf = 0;
    canvas.addEventListener("touchstart", (e) => {
      var _a;
      touchStartY2 = e.touches[0].clientY;
      touchScrollY = (_a = getRootScrollY()) != null ? _a : 0;
      lastTouchY = touchStartY2;
      lastTouchTime = performance.now();
      velocity = 0;
      if (flingRaf) {
        cancelAnimationFrame(flingRaf);
        flingRaf = 0;
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      const y = e.touches[0].clientY;
      const dy = touchStartY2 - y;
      const now = performance.now();
      const dt = now - lastTouchTime;
      if (dt > 0) {
        velocity = (lastTouchY - y) / dt * 16 * 1.7;
      }
      lastTouchY = y;
      lastTouchTime = now;
      setRootScrollY(touchScrollY + dy);
    }, { passive: true });
    canvas.addEventListener("touchend", () => {
      if (Math.abs(velocity) < 0.5) return;
      function fling() {
        var _a;
        velocity *= 0.96;
        if (Math.abs(velocity) < 0.3) {
          flingRaf = 0;
          return;
        }
        const cur = (_a = getRootScrollY()) != null ? _a : 0;
        setRootScrollY(cur + velocity);
        flingRaf = requestAnimationFrame(fling);
      }
      flingRaf = requestAnimationFrame(fling);
    }, { passive: true });
  }
  function bindClickEvents(canvas, _dpr) {
    canvas.addEventListener("click", (e) => {
      var _a, _b;
      if (!renderer) return;
      const root = renderer.getRoot();
      if (!root) return;
      const scrollY = (_a = root.scrollY) != null ? _a : 0;
      const px = e.offsetX;
      const py = e.offsetY + scrollY;
      for (const child of root.children) {
        if (!child.visible || child.disabled) continue;
        const hit = findTapTarget(child, px, py);
        if ((_b = hit == null ? void 0 : hit.gesture) == null ? void 0 : _b.onTap) {
          if (cursorRowId !== null && cursorRowId === hit.id) {
            hit.gesture.onTap();
          } else {
            moveCursorTo(hit);
          }
          return;
        }
      }
    });
  }
  function findTapTarget(box, px, py) {
    var _a;
    for (let i = box.children.length - 1; i >= 0; i--) {
      const child = box.children[i];
      if (!child.visible || child.disabled) continue;
      const found = findTapTarget(child, px, py);
      if (found) return found;
    }
    if (box.containsPoint(px, py) && box.interactive && ((_a = box.gesture) == null ? void 0 : _a.onTap)) {
      return box;
    }
    return null;
  }
  function rebuildTree() {
    var _a, _b, _c;
    if (!renderer) return;
    const prevScrollY = (_b = (_a = renderer.getRoot()) == null ? void 0 : _a.scrollY) != null ? _b : 0;
    const prevCursorRowId = cursorRowId;
    cursorBox = null;
    cursorRowId = null;
    const canvas = document.getElementById("tree-canvas");
    const cw = (_c = canvas == null ? void 0 : canvas.clientWidth) != null ? _c : 295;
    const rightMargin = cw - 8;
    const rootBox = buildSidebarTree(cw, rightMargin);
    if (canvas) rootBox.width = canvas.clientWidth;
    const canvasH = canvas ? canvas.clientHeight : 618;
    if (canvas) {
      rootBox.height = canvasH;
    }
    renderer.setRoot(rootBox);
    const newRoot = renderer.getRoot();
    if (newRoot && prevScrollY > 0) {
      const maxY = newRoot.getMaxScroll().maxY;
      newRoot.scrollY = Math.min(prevScrollY, maxY);
    }
    if (newRoot) {
      ensureCursorBox(newRoot, canvasH);
      if (prevCursorRowId) {
        const target = findBoxById(newRoot, prevCursorRowId);
        if (target) {
          moveCursorTo(target);
        } else {
          snapToCenterRow(newRoot, canvasH);
        }
      } else {
        snapToCenterRow(newRoot, canvasH);
      }
    }
    if (!renderer.isRunning) {
      renderer.start();
    }
  }
  function findBoxById(root, id) {
    for (const child of root.children) {
      if (child.id === id) return child;
      const found = findBoxById(child, id);
      if (found) return found;
    }
    return null;
  }
  function snapToCenterRow(root, canvasH) {
    var _a;
    const scrollY = (_a = root.scrollY) != null ? _a : 0;
    const centerY = scrollY + canvasH / 2;
    let closest = null;
    let closestDist = Infinity;
    function walk(box) {
      var _a2;
      for (const child of box.children) {
        if (!child.visible || child.disabled) continue;
        if (child.interactive && ((_a2 = child.gesture) == null ? void 0 : _a2.onTap)) {
          const abs = child.getAbsolutePosition();
          const rowCenter = abs.y + child.height / 2;
          const dist = Math.abs(rowCenter - centerY);
          if (dist < closestDist) {
            closestDist = dist;
            closest = child;
          }
        }
        walk(child);
      }
    }
    walk(root);
    if (closest) moveCursorTo(closest);
  }

  // src/client/modules/ui.ts
  function openSidebar() {
    var _a, _b;
    (_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.add("open");
    (_b = document.getElementById("overlay")) == null ? void 0 : _b.classList.add("show");
    onSidebarOpen();
  }
  function closeSidebar() {
    var _a, _b;
    (_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.remove("open");
    (_b = document.getElementById("overlay")) == null ? void 0 : _b.classList.remove("show");
    onSidebarClose();
  }
  function initUI() {
    var _a;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.executeCursorAction = async function() {
    };
    (_a = document.getElementById("overlay")) == null ? void 0 : _a.addEventListener("click", () => {
      closeSidebar();
    });
  }

  // src/client/modules/gestures.ts
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStarted = false;
  function initGestures() {
    document.addEventListener("touchstart", (e) => {
      if (e.target.closest(".light-orb")) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStarted = true;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      var _a, _b, _c;
      if (e.target.closest(".light-orb")) return;
      if (!touchStarted) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dxAbs = Math.abs(dx);
      if ((_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.contains("open")) {
        if (dx < -60) {
          closeSidebar();
          touchStarted = false;
          return;
        }
        return;
      }
      const logOpen = (_b = document.getElementById("logPanel")) == null ? void 0 : _b.classList.contains("open");
      if (logOpen) {
        if (dx > 60) {
          closeLogPanel();
          touchStarted = false;
          return;
        }
        return;
      }
      if (!((_c = document.getElementById("sidebar")) == null ? void 0 : _c.classList.contains("open")) && dx > 60) {
        openSidebar();
        touchStarted = false;
        return;
      }
    }, { passive: true });
    document.addEventListener("touchend", () => {
      touchStarted = false;
    }, { passive: true });
  }

  // src/client/engine/text-layout/bidi.ts
  var baseTypes = [
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
    "ON",
    "CS",
    "ON",
    "CS",
    "ON",
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
    "ON",
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
    "ON",
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
  var arabicTypes = [
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "CS",
    "AL",
    "ON",
    "ON",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "AN",
    "ET",
    "AN",
    "AN",
    "AL",
    "AL",
    "AL",
    "NSM",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "ON",
    "NSM",
    "NSM",
    "NSM",
    "NSM",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL",
    "AL"
  ];
  function classifyChar(charCode) {
    if (charCode <= 255) return baseTypes[charCode];
    if (1424 <= charCode && charCode <= 1524) return "R";
    if (1536 <= charCode && charCode <= 1791) return arabicTypes[charCode & 255];
    if (1792 <= charCode && charCode <= 2220) return "AL";
    return "L";
  }
  function computeBidiLevels2(str) {
    const len = str.length;
    if (len === 0) return null;
    const types = new Array(len);
    let numBidi = 0;
    for (let i = 0; i < len; i++) {
      const t = classifyChar(str.charCodeAt(i));
      if (t === "R" || t === "AL" || t === "AN") numBidi++;
      types[i] = t;
    }
    if (numBidi === 0) return null;
    const startLevel = len / numBidi < 0.3 ? 0 : 1;
    const levels = new Int8Array(len);
    for (let i = 0; i < len; i++) levels[i] = startLevel;
    const e = startLevel & 1 ? "R" : "L";
    const sor = e;
    let lastType = sor;
    for (let i = 0; i < len; i++) {
      if (types[i] === "NSM") types[i] = lastType;
      else lastType = types[i];
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "EN") types[i] = lastType === "AL" ? "AN" : "EN";
      else if (t === "R" || t === "L" || t === "AL") lastType = t;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] === "AL") types[i] = "R";
    }
    for (let i = 1; i < len - 1; i++) {
      if (types[i] === "ES" && types[i - 1] === "EN" && types[i + 1] === "EN") {
        types[i] = "EN";
      }
      if (types[i] === "CS" && (types[i - 1] === "EN" || types[i - 1] === "AN") && types[i + 1] === types[i - 1]) {
        types[i] = types[i - 1];
      }
    }
    for (let i = 0; i < len; i++) {
      if (types[i] !== "EN") continue;
      let j;
      for (j = i - 1; j >= 0 && types[j] === "ET"; j--) types[j] = "EN";
      for (j = i + 1; j < len && types[j] === "ET"; j++) types[j] = "EN";
    }
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "WS" || t === "ES" || t === "ET" || t === "CS") types[i] = "ON";
    }
    lastType = sor;
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if (t === "EN") types[i] = lastType === "L" ? "L" : "EN";
      else if (t === "R" || t === "L") lastType = t;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] !== "ON") continue;
      let end = i + 1;
      while (end < len && types[end] === "ON") end++;
      const before = i > 0 ? types[i - 1] : sor;
      const after = end < len ? types[end] : sor;
      const bDir = before !== "L" ? "R" : "L";
      const aDir = after !== "L" ? "R" : "L";
      if (bDir === aDir) {
        for (let j = i; j < end; j++) types[j] = bDir;
      }
      i = end - 1;
    }
    for (let i = 0; i < len; i++) {
      if (types[i] === "ON") types[i] = e;
    }
    for (let i = 0; i < len; i++) {
      const t = types[i];
      if ((levels[i] & 1) === 0) {
        if (t === "R") levels[i]++;
        else if (t === "AN" || t === "EN") levels[i] += 2;
      } else if (t === "L" || t === "AN" || t === "EN") {
        levels[i]++;
      }
    }
    return levels;
  }
  function computeSegmentLevels2(normalized, segStarts) {
    const bidiLevels = computeBidiLevels2(normalized);
    if (bidiLevels === null) return null;
    const segLevels = new Int8Array(segStarts.length);
    for (let i = 0; i < segStarts.length; i++) {
      segLevels[i] = bidiLevels[segStarts[i]];
    }
    return segLevels;
  }

  // src/client/engine/text-layout/analysis.ts
  var collapsibleWhitespaceRunRe2 = /[ \t\n\r\f]+/g;
  var needsWhitespaceNormalizationRe2 = /[\t\n\r\f]| {2,}|^ | $/;
  function getWhiteSpaceProfile2(whiteSpace) {
    const mode = whiteSpace != null ? whiteSpace : "normal";
    return {
      mode,
      preserveOrdinarySpaces: mode === "pre-wrap",
      preserveHardBreaks: mode === "pre-wrap"
    };
  }
  function normalizeWhitespace(text, profile) {
    if (!needsWhitespaceNormalizationRe2.test(text)) return text;
    if (profile.preserveHardBreaks) {
      return text.replace(/[ \t]+/g, " ").replace(/^ /gm, "").replace(/ $/gm, "");
    }
    return text.replace(collapsibleWhitespaceRunRe2, " ").replace(/^ | $/g, "");
  }
  var cjkRanges = [
    [4352, 4607],
    // Hangul Jamo
    [11904, 12255],
    // CJK Radicals Supplement
    [12272, 12287],
    // Ideographic Description Characters
    [12288, 12351],
    // CJK Symbols and Punctuation
    [12352, 12447],
    // Hiragana
    [12448, 12543],
    // Katakana
    [12544, 12591],
    // Bopomofo
    [12592, 12687],
    // Hangul Compatibility Jamo
    [12736, 12783],
    // CJK Strokes
    [12800, 13055],
    // Enclosed CJK Letters and Months
    [13056, 13311],
    // CJK Compatibility
    [13312, 19903],
    // CJK Unified Ideographs Extension A
    [19968, 40959],
    // CJK Unified Ideographs
    [43360, 43391],
    // Hangul Jamo Extended-A
    [44032, 55215],
    // Hangul Syllables
    [55216, 55295],
    // Hangul Jamo Extended-B
    [63744, 64255],
    // CJK Compatibility Ideographs
    [65040, 65055],
    // Vertical Forms
    [65072, 65103],
    // CJK Compatibility Forms
    [65280, 65519],
    // Halfwidth and Fullwidth Forms
    [127488, 127743],
    // Enclosed Ideographic Supplement
    [131072, 173791],
    // CJK Unified Ideographs Extension B
    [173824, 177983],
    // CJK Unified Ideographs Extension C
    [177984, 178207],
    // CJK Unified Ideographs Extension D
    [178208, 183983]
    // CJK Unified Ideographs Extension E
  ];
  function isCJK2(char) {
    const code = char.codePointAt(0);
    for (const [lo, hi] of cjkRanges) {
      if (code >= lo && code <= hi) return true;
    }
    return false;
  }
  var kinsokuStart2 = new Set(`)]}\uFF5D\uFF3D\u3009\u300B\u300D\u300F\u3011"'"\u2032\u2033\u2035\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\u300B\u300D\u300F\u3011\uFF5D\u300F\u300D))`);
  var kinsokuEnd2 = new Set(`([\uFF5B\uFF3B\u3008\u300A\u300C\u300E\u3010"'"\u2032\u2033\u2035\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\u300A\u300E\u3010\uFF5B\u300E\u300C((`);
  var leftStickyPunctuation2 = new Set(`"'"'"\u2032\u2033\u2035\xBB`);
  function endsWithClosingQuote2(text) {
    const last = text[text.length - 1];
    return last === '"' || last === '"' || last === "\u2039" || last === "\u203A";
  }
  var sharedWordSegmenter2 = null;
  var analysisLocale;
  function getSharedWordSegmenter2() {
    if (sharedWordSegmenter2 === null) {
      sharedWordSegmenter2 = new Intl.Segmenter(analysisLocale, { granularity: "word" });
    }
    return sharedWordSegmenter2;
  }
  function isSegmentBreak(text) {
    return /^[\n\r]$/.test(text);
  }
  function isWhitespace(text) {
    return /^\s+$/.test(text);
  }
  function segmentText(text) {
    var _a;
    const segmenter = getSharedWordSegmenter2();
    const pieces = [];
    let offset = 0;
    for (const seg of segmenter.segment(text)) {
      const piece = seg.segment;
      const start = seg.index;
      while (offset < start) {
        const gap = text[offset];
        if (gap === "\n") {
          pieces.push({ text: gap, isWordLike: false, kind: "hard-break", start: offset });
        } else if (gap === "	") {
          pieces.push({ text: gap, isWordLike: false, kind: "tab", start: offset });
        } else if (gap === "\xAD") {
          pieces.push({ text: gap, isWordLike: false, kind: "soft-hyphen", start: offset });
        } else if (gap === "\u200B" || gap === "\u2060" || gap === "\uFEFF") {
          pieces.push({ text: gap, isWordLike: false, kind: "zero-width-break", start: offset });
        } else {
          pieces.push({ text: gap, isWordLike: false, kind: "space", start: offset });
        }
        offset++;
      }
      if (isSegmentBreak(piece)) {
        pieces.push({ text: piece, isWordLike: false, kind: "hard-break", start });
      } else if (piece === "	") {
        pieces.push({ text: piece, isWordLike: false, kind: "tab", start });
      } else if (piece === "\xAD") {
        pieces.push({ text: piece, isWordLike: false, kind: "soft-hyphen", start });
      } else if (piece === "\u200B" || piece === "\u2060" || piece === "\uFEFF") {
        pieces.push({ text: piece, isWordLike: false, kind: "zero-width-break", start });
      } else if (isWhitespace(piece)) {
        pieces.push({
          text: piece,
          isWordLike: false,
          kind: "preserved-space",
          start
        });
      } else {
        pieces.push({ text: piece, isWordLike: (_a = seg.isWordLike) != null ? _a : false, kind: "text", start });
      }
      offset = start + piece.length;
    }
    while (offset < text.length) {
      const gap = text[offset];
      if (gap === "\n") {
        pieces.push({ text: gap, isWordLike: false, kind: "hard-break", start: offset });
      } else if (gap === "\xAD") {
        pieces.push({ text: gap, isWordLike: false, kind: "soft-hyphen", start: offset });
      } else {
        pieces.push({ text: gap, isWordLike: false, kind: "space", start: offset });
      }
      offset++;
    }
    return pieces;
  }
  function buildMergedSegments(pieces, profile) {
    if (pieces.length === 0) {
      return { len: 0, texts: [], isWordLike: [], kinds: [], starts: [] };
    }
    const texts = [];
    const isWordLike = [];
    const kinds = [];
    const starts = [];
    for (const piece of pieces) {
      if (piece.kind === "text") {
        texts.push(piece.text);
        isWordLike.push(piece.isWordLike);
        kinds.push("text");
        starts.push(piece.start);
      } else if (piece.kind === "space") {
        texts.push(piece.text);
        isWordLike.push(false);
        kinds.push(profile.preserveOrdinarySpaces ? "preserved-space" : "space");
        starts.push(piece.start);
      } else if (piece.kind === "preserved-space") {
        texts.push(piece.text);
        isWordLike.push(false);
        kinds.push("preserved-space");
        starts.push(piece.start);
      } else {
        texts.push(piece.text);
        isWordLike.push(false);
        kinds.push(piece.kind);
        starts.push(piece.start);
      }
    }
    return { len: texts.length, texts, isWordLike, kinds, starts };
  }
  function buildChunks(merged) {
    const chunks = [];
    let chunkStart = 0;
    for (let i = 0; i < merged.len; i++) {
      if (merged.kinds[i] === "hard-break") {
        chunks.push({
          startSegmentIndex: chunkStart,
          endSegmentIndex: i + 1,
          consumedEndSegmentIndex: i + 1
        });
        chunkStart = i + 1;
      }
    }
    if (chunkStart < merged.len || chunks.length === 0) {
      chunks.push({
        startSegmentIndex: chunkStart,
        endSegmentIndex: merged.len,
        consumedEndSegmentIndex: merged.len
      });
    }
    return chunks;
  }
  var analysisCache = /* @__PURE__ */ new Map();
  function analyzeText2(text, _engineProfile, whiteSpace) {
    const profile = getWhiteSpaceProfile2(whiteSpace);
    const normalized = normalizeWhitespace(text, profile);
    const cacheKey = `${normalized}\0${profile.mode}`;
    const cached = analysisCache.get(cacheKey);
    if (cached !== void 0) return cached;
    const pieces = segmentText(normalized);
    const merged = buildMergedSegments(pieces, profile);
    const chunks = buildChunks(merged);
    const analysis = {
      normalized,
      chunks,
      len: merged.len,
      texts: merged.texts,
      isWordLike: merged.isWordLike,
      kinds: merged.kinds,
      starts: merged.starts
    };
    analysisCache.set(cacheKey, analysis);
    return analysis;
  }

  // src/client/engine/text-layout/measurement.ts
  var measureContext2 = null;
  function getMeasureContext2() {
    if (measureContext2 !== null) return measureContext2;
    if (typeof OffscreenCanvas !== "undefined") {
      measureContext2 = new OffscreenCanvas(1, 1).getContext("2d");
      return measureContext2;
    }
    if (typeof document !== "undefined") {
      measureContext2 = document.createElement("canvas").getContext("2d");
      return measureContext2;
    }
    throw new Error("Text measurement requires a Canvas context. Call setMeasureContext() first.");
  }
  var segmentMetricCaches2 = /* @__PURE__ */ new Map();
  var cachedEngineProfile2 = null;
  var maybeEmojiRe2 = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
  var sharedGraphemeSegmenter4 = null;
  var emojiCorrectionCache2 = /* @__PURE__ */ new Map();
  function getSegmentMetricCache2(font) {
    let cache = segmentMetricCaches2.get(font);
    if (!cache) {
      cache = /* @__PURE__ */ new Map();
      segmentMetricCaches2.set(font, cache);
    }
    return cache;
  }
  function getSegmentMetrics2(seg, cache) {
    let metrics = cache.get(seg);
    if (metrics === void 0) {
      const ctx = getMeasureContext2();
      metrics = {
        width: ctx.measureText(seg).width,
        containsCJK: isCJK2(seg)
      };
      cache.set(seg, metrics);
    }
    return metrics;
  }
  function getEngineProfile2() {
    if (cachedEngineProfile2 !== null) return cachedEngineProfile2;
    if (typeof navigator === "undefined") {
      cachedEngineProfile2 = {
        lineFitEpsilon: 5e-3,
        carryCJKAfterClosingQuote: false,
        preferPrefixWidthsForBreakableRuns: false,
        preferEarlySoftHyphenBreak: false
      };
      return cachedEngineProfile2;
    }
    const ua = navigator.userAgent;
    const vendor = navigator.vendor;
    const isSafari = vendor === "Apple Computer, Inc." && ua.includes("Safari/") && !ua.includes("Chrome/") && !ua.includes("Chromium/") && !ua.includes("CriOS/") && !ua.includes("FxiOS/") && !ua.includes("EdgiOS/");
    const isChromium = ua.includes("Chrome/") || ua.includes("Chromium/") || ua.includes("CriOS/") || ua.includes("Edg/");
    cachedEngineProfile2 = {
      lineFitEpsilon: isSafari ? 1 / 64 : 5e-3,
      carryCJKAfterClosingQuote: isChromium,
      preferPrefixWidthsForBreakableRuns: isSafari,
      preferEarlySoftHyphenBreak: isSafari
    };
    return cachedEngineProfile2;
  }
  function parseFontSize2(font) {
    const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
    return m ? parseFloat(m[1]) : 16;
  }
  function getSharedGraphemeSegmenter4() {
    if (sharedGraphemeSegmenter4 === null) {
      sharedGraphemeSegmenter4 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter4;
  }
  function textMayContainEmoji2(text) {
    return maybeEmojiRe2.test(text);
  }
  function getEmojiCorrection2(font, _fontSize) {
    let correction = emojiCorrectionCache2.get(font);
    if (correction !== void 0) return correction;
    correction = 0;
    emojiCorrectionCache2.set(font, correction);
    return correction;
  }
  function countEmojiGraphemes2(text) {
    let count = 0;
    const graphemeSegmenter = getSharedGraphemeSegmenter4();
    for (const g of graphemeSegmenter.segment(text)) {
      if (maybeEmojiRe2.test(g.segment)) count++;
    }
    return count;
  }
  function getEmojiCount2(seg, metrics) {
    if (metrics.emojiCount === void 0) {
      metrics.emojiCount = countEmojiGraphemes2(seg);
    }
    return metrics.emojiCount;
  }
  function getCorrectedSegmentWidth2(seg, metrics, emojiCorrection) {
    if (emojiCorrection === 0) return metrics.width;
    return metrics.width - getEmojiCount2(seg, metrics) * emojiCorrection;
  }
  function getSegmentGraphemeWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemeWidths !== void 0) return metrics.graphemeWidths;
    const widths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter4();
    for (const gs of graphemeSegmenter.segment(seg)) {
      const graphemeMetrics = getSegmentMetrics2(gs.segment, cache);
      widths.push(getCorrectedSegmentWidth2(gs.segment, graphemeMetrics, emojiCorrection));
    }
    metrics.graphemeWidths = widths.length > 1 ? widths : null;
    return metrics.graphemeWidths;
  }
  function getSegmentGraphemePrefixWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemePrefixWidths !== void 0) return metrics.graphemePrefixWidths;
    const prefixWidths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter4();
    let prefix = "";
    for (const gs of graphemeSegmenter.segment(seg)) {
      prefix += gs.segment;
      const prefixMetrics = getSegmentMetrics2(prefix, cache);
      prefixWidths.push(getCorrectedSegmentWidth2(prefix, prefixMetrics, emojiCorrection));
    }
    metrics.graphemePrefixWidths = prefixWidths.length > 1 ? prefixWidths : null;
    return metrics.graphemePrefixWidths;
  }
  function getFontMeasurementState2(font, needsEmojiCorrection) {
    const ctx = getMeasureContext2();
    ctx.font = font;
    const cache = getSegmentMetricCache2(font);
    const fontSize = parseFontSize2(font);
    const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection2(font, fontSize) : 0;
    return { cache, fontSize, emojiCorrection };
  }

  // src/client/engine/text-layout/line-break.ts
  function canBreakAfter(kind) {
    return kind === "space" || kind === "preserved-space" || kind === "tab" || kind === "zero-width-break" || kind === "soft-hyphen";
  }
  function getTabAdvance2(lineWidth, tabStopAdvance) {
    if (tabStopAdvance <= 0) return 0;
    const remainder = lineWidth % tabStopAdvance;
    if (Math.abs(remainder) <= 1e-6) return tabStopAdvance;
    return tabStopAdvance - remainder;
  }
  function getBreakableAdvance(graphemeWidths, graphemePrefixWidths, graphemeIndex, preferPrefixWidths) {
    if (!preferPrefixWidths || graphemePrefixWidths === null) {
      return graphemeWidths[graphemeIndex];
    }
    return graphemePrefixWidths[graphemeIndex] - (graphemeIndex > 0 ? graphemePrefixWidths[graphemeIndex - 1] : 0);
  }
  function fitSoftHyphenBreak2(graphemeWidths, initialWidth, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, cumulativeWidths) {
    let fitCount = 0;
    let fittedWidth = initialWidth;
    while (fitCount < graphemeWidths.length) {
      const nextWidth = cumulativeWidths ? initialWidth + graphemeWidths[fitCount] : fittedWidth + graphemeWidths[fitCount];
      const nextLineWidth = fitCount + 1 < graphemeWidths.length ? nextWidth + discretionaryHyphenWidth : nextWidth;
      if (nextLineWidth > maxWidth + lineFitEpsilon) break;
      fittedWidth = nextWidth;
      fitCount++;
    }
    return { fitCount, fittedWidth };
  }
  function walkPreparedLines(prepared, maxWidth, onLine) {
    if (prepared.simpleLineWalkFastPath) {
      return walkPreparedLinesSimple2(prepared, maxWidth, onLine);
    }
    return walkPreparedLinesChunked(prepared, maxWidth, onLine);
  }
  function walkPreparedLinesSimple2(prepared, maxWidth, onLine) {
    const { widths, kinds, breakableWidths, breakablePrefixWidths } = prepared;
    if (widths.length === 0) return 0;
    const engineProfile = getEngineProfile2();
    const lineFitEpsilon = engineProfile.lineFitEpsilon;
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
      onLine == null ? void 0 : onLine({
        startSegmentIndex: lineStartSegmentIndex,
        startGraphemeIndex: lineStartGraphemeIndex,
        endSegmentIndex,
        endGraphemeIndex,
        width
      });
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
    function updatePendingBreak(segmentIndex, segmentWidth) {
      if (!canBreakAfter(kinds[segmentIndex])) return;
      pendingBreakSegmentIndex = segmentIndex + 1;
      pendingBreakPaintWidth = lineW - segmentWidth;
    }
    function appendBreakableSegment(segmentIndex) {
      appendBreakableSegmentFrom(segmentIndex, 0);
    }
    function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
      var _a;
      const gWidths = breakableWidths[segmentIndex];
      const gPrefixWidths = (_a = breakablePrefixWidths[segmentIndex]) != null ? _a : null;
      for (let g = startGraphemeIndex; g < gWidths.length; g++) {
        const gw = getBreakableAdvance(
          gWidths,
          gPrefixWidths,
          g,
          engineProfile.preferPrefixWidthsForBreakableRuns
        );
        if (!hasContent) {
          startLineAtGrapheme(segmentIndex, g, gw);
          continue;
        }
        if (lineW + gw > maxWidth + lineFitEpsilon) {
          emitCurrentLine();
          startLineAtGrapheme(segmentIndex, g, gw);
        } else {
          lineW += gw;
          lineEndSegmentIndex = segmentIndex;
          lineEndGraphemeIndex = g + 1;
        }
      }
      if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === gWidths.length) {
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
      }
    }
    let i = 0;
    while (i < widths.length) {
      const w = widths[i];
      const kind = kinds[i];
      if (!hasContent) {
        if (w > maxWidth && breakableWidths[i] !== null) {
          appendBreakableSegment(i);
        } else {
          startLineAtSegment(i, w);
        }
        updatePendingBreak(i, w);
        i++;
        continue;
      }
      const newW = lineW + w;
      if (newW > maxWidth + lineFitEpsilon) {
        if (canBreakAfter(kind)) {
          appendWholeSegment(i, w);
          emitCurrentLine(i + 1, 0, lineW - w);
          i++;
          continue;
        }
        if (pendingBreakSegmentIndex >= 0) {
          emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
          continue;
        }
        if (w > maxWidth && breakableWidths[i] !== null) {
          emitCurrentLine();
          appendBreakableSegment(i);
          i++;
          continue;
        }
        emitCurrentLine();
        continue;
      }
      appendWholeSegment(i, w);
      updatePendingBreak(i, w);
      i++;
    }
    if (hasContent) emitCurrentLine();
    return lineCount;
  }
  function walkPreparedLinesChunked(prepared, maxWidth, onLine) {
    const {
      widths,
      lineEndFitAdvances,
      lineEndPaintAdvances,
      kinds,
      breakableWidths,
      breakablePrefixWidths,
      discretionaryHyphenWidth,
      tabStopAdvance,
      chunks
    } = prepared;
    if (widths.length === 0 || chunks.length === 0) return 0;
    const engineProfile = getEngineProfile2();
    const lineFitEpsilon = engineProfile.lineFitEpsilon;
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
      onLine == null ? void 0 : onLine({
        startSegmentIndex: lineStartSegmentIndex,
        startGraphemeIndex: lineStartGraphemeIndex,
        endSegmentIndex,
        endGraphemeIndex,
        width
      });
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
    function appendWholeSegment(segmentIndex, width) {
      if (!hasContent) {
        startLineAtSegment(segmentIndex, width);
        return;
      }
      lineW += width;
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
    function updatePendingBreakForWholeSegment(segmentIndex, segmentWidth) {
      if (!canBreakAfter(kinds[segmentIndex])) return;
      const fitAdvance = kinds[segmentIndex] === "tab" ? 0 : lineEndFitAdvances[segmentIndex];
      const paintAdvance = kinds[segmentIndex] === "tab" ? segmentWidth : lineEndPaintAdvances[segmentIndex];
      pendingBreakSegmentIndex = segmentIndex + 1;
      pendingBreakFitWidth = lineW - segmentWidth + fitAdvance;
      pendingBreakPaintWidth = lineW - segmentWidth + paintAdvance;
      pendingBreakKind = kinds[segmentIndex];
    }
    function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
      var _a;
      const gWidths = breakableWidths[segmentIndex];
      const gPrefixWidths = (_a = breakablePrefixWidths[segmentIndex]) != null ? _a : null;
      for (let g = startGraphemeIndex; g < gWidths.length; g++) {
        const gw = getBreakableAdvance(
          gWidths,
          gPrefixWidths,
          g,
          engineProfile.preferPrefixWidthsForBreakableRuns
        );
        if (!hasContent) {
          startLineAtGrapheme(segmentIndex, g, gw);
          continue;
        }
        if (lineW + gw > maxWidth + lineFitEpsilon) {
          emitCurrentLine();
          startLineAtGrapheme(segmentIndex, g, gw);
        } else {
          lineW += gw;
          lineEndSegmentIndex = segmentIndex;
          lineEndGraphemeIndex = g + 1;
        }
      }
      if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === gWidths.length) {
        lineEndSegmentIndex = segmentIndex + 1;
        lineEndGraphemeIndex = 0;
      }
    }
    function continueSoftHyphenBreakableSegment(segmentIndex) {
      var _a;
      if (pendingBreakKind !== "soft-hyphen") return false;
      const gWidths = breakableWidths[segmentIndex];
      if (gWidths === null) return false;
      const fitWidths = engineProfile.preferPrefixWidthsForBreakableRuns ? (_a = breakablePrefixWidths[segmentIndex]) != null ? _a : gWidths : gWidths;
      const usesPrefixWidths = fitWidths !== gWidths;
      const { fitCount, fittedWidth } = fitSoftHyphenBreak2(
        fitWidths,
        lineW,
        maxWidth,
        lineFitEpsilon,
        discretionaryHyphenWidth,
        usesPrefixWidths
      );
      if (fitCount === 0) return false;
      lineW = fittedWidth;
      lineEndSegmentIndex = segmentIndex;
      lineEndGraphemeIndex = fitCount;
      clearPendingBreak();
      if (fitCount === gWidths.length) {
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
      onLine == null ? void 0 : onLine({
        startSegmentIndex: chunk.startSegmentIndex,
        startGraphemeIndex: 0,
        endSegmentIndex: chunk.consumedEndSegmentIndex,
        endGraphemeIndex: 0,
        width: 0
      });
      clearPendingBreak();
    }
    function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
      hasContent = true;
      lineStartSegmentIndex = segmentIndex;
      lineStartGraphemeIndex = graphemeIndex;
      lineEndSegmentIndex = segmentIndex;
      lineEndGraphemeIndex = graphemeIndex + 1;
      lineW = width;
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
      let i = chunk.startSegmentIndex;
      while (i < chunk.endSegmentIndex) {
        const kind = kinds[i];
        const w = kind === "tab" ? getTabAdvance2(lineW, tabStopAdvance) : widths[i];
        if (kind === "soft-hyphen") {
          if (hasContent) {
            lineEndSegmentIndex = i + 1;
            lineEndGraphemeIndex = 0;
            pendingBreakSegmentIndex = i + 1;
            pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
            pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
            pendingBreakKind = kind;
          }
          i++;
          continue;
        }
        if (!hasContent) {
          if (w > maxWidth && breakableWidths[i] !== null) {
            appendBreakableSegmentFrom(i, 0);
          } else {
            startLineAtSegment(i, w);
          }
          updatePendingBreakForWholeSegment(i, w);
          i++;
          continue;
        }
        const newW = lineW + w;
        if (newW > maxWidth + lineFitEpsilon) {
          const currentBreakFitWidth = lineW + (kind === "tab" ? 0 : lineEndFitAdvances[i]);
          const currentBreakPaintWidth = lineW + (kind === "tab" ? w : lineEndPaintAdvances[i]);
          if (pendingBreakKind === "soft-hyphen" && engineProfile.preferEarlySoftHyphenBreak && pendingBreakFitWidth <= maxWidth + lineFitEpsilon) {
            emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
            continue;
          }
          if (pendingBreakKind === "soft-hyphen" && continueSoftHyphenBreakableSegment(i)) {
            i++;
            continue;
          }
          if (canBreakAfter(kind) && currentBreakFitWidth <= maxWidth + lineFitEpsilon) {
            appendWholeSegment(i, w);
            emitCurrentLine(i + 1, 0, currentBreakPaintWidth);
            i++;
            continue;
          }
          if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= maxWidth + lineFitEpsilon) {
            emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
            continue;
          }
          if (w > maxWidth && breakableWidths[i] !== null) {
            emitCurrentLine();
            appendBreakableSegmentFrom(i, 0);
            i++;
            continue;
          }
          emitCurrentLine();
          continue;
        }
        appendWholeSegment(i, w);
        updatePendingBreakForWholeSegment(i, w);
        i++;
      }
      if (hasContent) {
        const finalPaintWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex ? pendingBreakPaintWidth : lineW;
        emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth);
      }
    }
    return lineCount;
  }

  // src/client/engine/text-layout/layout.ts
  var sharedGraphemeSegmenter5 = null;
  var sharedLineTextCaches2 = /* @__PURE__ */ new WeakMap();
  function getSharedGraphemeSegmenter5() {
    if (sharedGraphemeSegmenter5 === null) {
      sharedGraphemeSegmenter5 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter5;
  }
  function createEmptyPrepared2(includeSegments) {
    const base = {
      widths: [],
      lineEndFitAdvances: [],
      lineEndPaintAdvances: [],
      kinds: [],
      simpleLineWalkFastPath: true,
      segLevels: null,
      breakableWidths: [],
      breakablePrefixWidths: [],
      discretionaryHyphenWidth: 0,
      tabStopAdvance: 0,
      chunks: []
    };
    if (includeSegments) {
      return { ...base, segments: [] };
    }
    return base;
  }
  function measureAnalysis2(analysis, font, includeSegments) {
    const engineProfile = getEngineProfile2();
    const { cache, emojiCorrection } = getFontMeasurementState2(
      font,
      textMayContainEmoji2(analysis.normalized)
    );
    const discretionaryHyphenWidth = getCorrectedSegmentWidth2("-", getSegmentMetrics2("-", cache), emojiCorrection);
    const spaceWidth = getCorrectedSegmentWidth2(" ", getSegmentMetrics2(" ", cache), emojiCorrection);
    const tabStopAdvance = spaceWidth * 8;
    if (analysis.len === 0) return createEmptyPrepared2(includeSegments);
    const widths = [];
    const lineEndFitAdvances = [];
    const lineEndPaintAdvances = [];
    const kinds = [];
    let simpleLineWalkFastPath = analysis.chunks.length <= 1;
    const breakableWidths = [];
    const breakablePrefixWidths = [];
    const segments = includeSegments ? [] : null;
    const preparedStartByAnalysisIndex = Array.from({ length: analysis.len });
    const preparedEndByAnalysisIndex = Array.from({ length: analysis.len });
    function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, _start, breakable, breakablePrefix) {
      if (kind !== "text" && kind !== "space" && kind !== "zero-width-break") {
        simpleLineWalkFastPath = false;
      }
      widths.push(width);
      lineEndFitAdvances.push(lineEndFitAdvance);
      lineEndPaintAdvances.push(lineEndPaintAdvance);
      kinds.push(kind);
      breakableWidths.push(breakable);
      breakablePrefixWidths.push(breakablePrefix);
      if (segments !== null) segments.push(text);
    }
    const graphemeSegmenter = getSharedGraphemeSegmenter5();
    for (let mi = 0; mi < analysis.len; mi++) {
      preparedStartByAnalysisIndex[mi] = widths.length;
      const segText = analysis.texts[mi];
      const segKind = analysis.kinds[mi];
      const _segStart = analysis.starts[mi];
      if (segKind === "soft-hyphen") {
        pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, _segStart, null, null);
        preparedEndByAnalysisIndex[mi] = widths.length;
        continue;
      }
      if (segKind === "hard-break") {
        pushMeasuredSegment(segText, 0, 0, 0, segKind, _segStart, null, null);
        preparedEndByAnalysisIndex[mi] = widths.length;
        continue;
      }
      if (segKind === "tab") {
        pushMeasuredSegment(segText, 0, 0, 0, segKind, _segStart, null, null);
        preparedEndByAnalysisIndex[mi] = widths.length;
        continue;
      }
      const segMetrics = getSegmentMetrics2(segText, cache);
      if (segKind === "text" && segMetrics.containsCJK) {
        let unitText = "";
        let unitStart = 0;
        for (const gs of graphemeSegmenter.segment(segText)) {
          const grapheme = gs.segment;
          if (unitText.length === 0) {
            unitText = grapheme;
            unitStart = gs.index;
            continue;
          }
          if (kinsokuEnd2.has(unitText) || kinsokuStart2.has(grapheme) || leftStickyPunctuation2.has(grapheme) || engineProfile.carryCJKAfterClosingQuote && isCJK2(grapheme) && endsWithClosingQuote2(unitText)) {
            unitText += grapheme;
            continue;
          }
          const unitMetrics = getSegmentMetrics2(unitText, cache);
          const w2 = getCorrectedSegmentWidth2(unitText, unitMetrics, emojiCorrection);
          pushMeasuredSegment(unitText, w2, w2, w2, "text", _segStart + unitStart, null, null);
          unitText = grapheme;
          unitStart = gs.index;
        }
        if (unitText.length > 0) {
          const unitMetrics = getSegmentMetrics2(unitText, cache);
          const w2 = getCorrectedSegmentWidth2(unitText, unitMetrics, emojiCorrection);
          pushMeasuredSegment(unitText, w2, w2, w2, "text", _segStart + unitStart, null, null);
        }
        preparedEndByAnalysisIndex[mi] = widths.length;
        continue;
      }
      const w = getCorrectedSegmentWidth2(segText, segMetrics, emojiCorrection);
      const lineEndFitAdvance = segKind === "space" || segKind === "preserved-space" || segKind === "zero-width-break" ? 0 : w;
      const lineEndPaintAdvance = segKind === "space" || segKind === "zero-width-break" ? 0 : w;
      if (analysis.isWordLike[mi] && segText.length > 1) {
        const graphemeWidths = getSegmentGraphemeWidths(segText, segMetrics, cache, emojiCorrection);
        const graphemePrefixWidths = engineProfile.preferPrefixWidthsForBreakableRuns ? getSegmentGraphemePrefixWidths(segText, segMetrics, cache, emojiCorrection) : null;
        pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, _segStart, graphemeWidths, graphemePrefixWidths);
      } else {
        pushMeasuredSegment(segText, w, lineEndFitAdvance, lineEndPaintAdvance, segKind, _segStart, null, null);
      }
      preparedEndByAnalysisIndex[mi] = widths.length;
    }
    const chunks = mapAnalysisChunksToPreparedChunks2(analysis.chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex);
    const segStarts = includeSegments ? analysis.starts : null;
    const segLevels = segStarts === null ? null : computeSegmentLevels2(analysis.normalized, segStarts);
    if (segments !== null) {
      return {
        widths,
        lineEndFitAdvances,
        lineEndPaintAdvances,
        kinds,
        simpleLineWalkFastPath,
        segLevels,
        breakableWidths,
        breakablePrefixWidths,
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
      breakableWidths,
      breakablePrefixWidths,
      discretionaryHyphenWidth,
      tabStopAdvance,
      chunks
    };
  }
  function mapAnalysisChunksToPreparedChunks2(chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex) {
    var _a;
    const preparedChunks = [];
    const lastIdx = preparedEndByAnalysisIndex.length - 1;
    const fallback = (_a = preparedEndByAnalysisIndex[lastIdx]) != null ? _a : 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const starts = preparedStartByAnalysisIndex;
      preparedChunks.push({
        startSegmentIndex: chunk.startSegmentIndex < starts.length ? starts[chunk.startSegmentIndex] : fallback,
        endSegmentIndex: chunk.endSegmentIndex < starts.length ? starts[chunk.endSegmentIndex] : fallback,
        consumedEndSegmentIndex: chunk.consumedEndSegmentIndex < starts.length ? starts[chunk.consumedEndSegmentIndex] : fallback
      });
    }
    return preparedChunks;
  }
  function getInternalPrepared2(prepared) {
    return prepared;
  }
  function prepareWithSegments2(text, font, options) {
    const analysis = analyzeText2(text, getEngineProfile2(), options == null ? void 0 : options.whiteSpace);
    return measureAnalysis2(analysis, font, true);
  }
  function getLineTextCache2(prepared) {
    let cache = sharedLineTextCaches2.get(prepared);
    if (cache !== void 0) return cache;
    cache = /* @__PURE__ */ new Map();
    sharedLineTextCaches2.set(prepared, cache);
    return cache;
  }
  function getSegmentGraphemes2(segmentIndex, segments, cache) {
    let graphemes = cache.get(segmentIndex);
    if (graphemes !== void 0) return graphemes;
    graphemes = [];
    const gs = getSharedGraphemeSegmenter5();
    for (const g of gs.segment(segments[segmentIndex])) graphemes.push(g.segment);
    cache.set(segmentIndex, graphemes);
    return graphemes;
  }
  function lineHasDiscretionaryHyphen2(kinds, startSI, startGI, endSI) {
    return endSI > 0 && kinds[endSI - 1] === "soft-hyphen" && !(startSI === endSI && startGI > 0);
  }
  function buildLineTextFromRange2(segments, kinds, cache, startSI, startGI, endSI, endGI) {
    let text = "";
    const endsWithHyphen = lineHasDiscretionaryHyphen2(kinds, startSI, startGI, endSI);
    for (let i = startSI; i < endSI; i++) {
      if (kinds[i] === "soft-hyphen" || kinds[i] === "hard-break") continue;
      if (i === startSI && startGI > 0) {
        text += getSegmentGraphemes2(i, segments, cache).slice(startGI).join("");
      } else {
        text += segments[i];
      }
    }
    if (endGI > 0) {
      if (endsWithHyphen) text += "-";
      text += getSegmentGraphemes2(endSI, segments, cache).slice(
        startSI === endSI ? startGI : 0,
        endGI
      ).join("");
    } else if (endsWithHyphen) {
      text += "-";
    }
    return text;
  }
  function materializeLayoutLine(prepared, cache, line) {
    return {
      text: buildLineTextFromRange2(
        prepared.segments,
        prepared.kinds,
        cache,
        line.startSegmentIndex,
        line.startGraphemeIndex,
        line.endSegmentIndex,
        line.endGraphemeIndex
      ),
      width: line.width,
      start: { segmentIndex: line.startSegmentIndex, graphemeIndex: line.startGraphemeIndex },
      end: { segmentIndex: line.endSegmentIndex, graphemeIndex: line.endGraphemeIndex }
    };
  }
  function layoutWithLines2(prepared, maxWidth, lineHeight) {
    const lines = [];
    if (prepared.widths.length === 0) return { lineCount: 0, height: 0, lines };
    const graphemeCache = getLineTextCache2(prepared);
    const lineCount = walkPreparedLines(getInternalPrepared2(prepared), maxWidth, (line) => {
      lines.push(materializeLayoutLine(prepared, graphemeCache, line));
    });
    return { lineCount, height: lineCount * lineHeight, lines };
  }

  // src/client/engine/text-layout/index.ts
  function layoutLines(text, font, maxWidth, lineHeight) {
    const prepared = prepareWithSegments2(text, font);
    const { lines } = layoutWithLines2(prepared, maxWidth, lineHeight);
    return lines.map((l) => ({ text: l.text, width: l.width }));
  }

  // src/client/modules/orb.ts
  var orbState = "collapsed";
  var orbEl = null;
  var panelEl = null;
  var PANEL_MIN_WIDTH = 120;
  var PANEL_MIN_HEIGHT = 100;
  var PANEL_DEFAULT_WIDTH = 300;
  var PANEL_DEFAULT_HEIGHT = 350;
  var panelWidth = PANEL_DEFAULT_WIDTH;
  var panelHeight = PANEL_DEFAULT_HEIGHT;
  var renderWidth = PANEL_DEFAULT_WIDTH;
  var renderHeight = PANEL_DEFAULT_HEIGHT;
  var dragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartOrbX = 0;
  var dragStartOrbY = 0;
  var dragStartPanelX = 0;
  var dragStartPanelY = 0;
  var longPressTimer = null;
  var longPressFired = false;
  var LONG_PRESS_MS = 600;
  var ORB_SIZE = 36;
  var ORB_HALF = ORB_SIZE / 2;
  var MARGIN = 8;
  var chatMessages = [
    { role: "ai", text: "\u4F60\u597D\uFF0C\u6211\u662F\u851A\u7136\u3002\u6709\u4EC0\u4E48\u53EF\u4EE5\u5E2E\u4F60\u7684\u5417\uFF1F" },
    { role: "user", text: "\u5E2E\u6211\u5206\u6790\u4E00\u4E0B\u5F53\u524D\u7684\u76EE\u5F55\u7ED3\u6784" },
    { role: "ai", text: "\u597D\u7684\uFF0C\u6B63\u5728\u5206\u6790\u76EE\u5F55\u7ED3\u6784\u3002\u5F53\u524D\u76EE\u5F55\u4E0B\u5171\u6709 12 \u4E2A\u6587\u4EF6\u5939\u548C 8 \u4E2A\u6587\u4EF6\u3002" }
  ];
  function getInputBarTop() {
    const bar = document.getElementById("aiInputBar");
    if (!bar) return window.innerHeight;
    return bar.getBoundingClientRect().top;
  }
  function getPanelTargetPosition(orbCX, orbCY) {
    let w = panelWidth;
    let h = panelHeight;
    const availLeft = orbCX - MARGIN;
    const availTop = orbCY - MARGIN;
    if (availLeft < w) w = Math.max(PANEL_MIN_WIDTH, availLeft);
    if (availTop < h) h = Math.max(PANEL_MIN_HEIGHT, availTop);
    return { left: orbCX - w, top: orbCY - h, width: w, height: h };
  }
  function clampOrbPosition(x, y) {
    const maxX = window.innerWidth - ORB_SIZE - MARGIN;
    const minX = MARGIN;
    const maxY = getInputBarTop() - ORB_SIZE - MARGIN;
    const minY = MARGIN;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    };
  }
  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "orb-panel";
    panel.style.cssText = `
    position: fixed;
    background: rgba(20, 16, 32, 0.92);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(124, 58, 237, 0.3); border-left: 3px solid rgba(124, 58, 237, 0.3);
    border-radius: 12px;
    box-shadow: 0 0 20px 4px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 205;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  `;
    panel.id = "orbPanel";
    document.body.appendChild(panel);
    return panel;
  }
  function renderChatContent() {
    if (!panelEl) return;
    const contentArea = panelEl.querySelector(".orb-panel-content");
    if (!contentArea) return;
    const innerWidth = renderWidth - 24;
    if (innerWidth < 50) return;
    let html = "";
    for (const msg of chatMessages) {
      const isUser = msg.role === "user";
      const bgColor = isUser ? "rgba(124,58,237,0.15)" : "rgba(46,213,163,0.1)";
      const borderColor = isUser ? "rgba(124,58,237,0.4)" : "rgba(46,213,163,0.3)";
      const align = isUser ? "flex-end" : "flex-start";
      const label = isUser ? "\u4F60" : "\u851A\u7136";
      const labelColor = isUser ? "#7c3aed" : "#2ed5a3";
      const font = "13px sans-serif";
      const lineHeight = 20;
      try {
        const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
        const textHtml = lines.map((l) => `<span style="display:block">${escapeHtml2(l.text)}</span>`).join("");
        html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-left:3px solid ${borderColor};border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:#e0e0e0">${textHtml}</div>
          </div>
        </div>`;
      } catch {
        html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:85%;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-left:3px solid ${borderColor};border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-size:13px;color:#e0e0e0">${escapeHtml2(msg.text)}</div>
          </div>
        </div>`;
      }
    }
    contentArea.innerHTML = html;
    contentArea.scrollTop = contentArea.scrollHeight;
  }
  function escapeHtml2(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function updatePanelPosition() {
    if (!orbEl || !panelEl) return;
    const orbRect = orbEl.getBoundingClientRect();
    const orbCX = orbRect.left + ORB_HALF;
    const orbCY = orbRect.top + ORB_HALF;
    const idealLeft = orbCX - panelWidth;
    const idealTop = orbCY - panelHeight;
    const screenLeft = MARGIN;
    const screenTop = MARGIN;
    const screenRight = window.innerWidth - MARGIN;
    const screenBottom = getInputBarTop() - MARGIN;
    const availLeft = orbCX - screenLeft;
    const availTop = orbCY - screenTop;
    const availRight = screenRight - orbCX;
    const availBottom = screenBottom - orbCY;
    renderWidth = Math.max(PANEL_MIN_WIDTH, Math.min(panelWidth, availLeft));
    renderHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(panelHeight, availTop));
    const panelLeft = orbCX - renderWidth;
    const panelTop = orbCY - renderHeight;
    panelEl.style.left = Math.max(screenLeft, panelLeft) + "px";
    panelEl.style.top = Math.max(screenTop, panelTop) + "px";
    panelEl.style.width = renderWidth + "px";
    panelEl.style.height = renderHeight + "px";
  }
  function buildPanelContent() {
    if (!panelEl) return;
    panelEl.innerHTML = `
    <div class="orb-panel-header" style="
      padding: 10px 14px;
      border-bottom: 1px solid rgba(124,58,237,0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    ">
      <span style="font-size:13px;color:#7c3aed;font-weight:600">AI \u5BF9\u8BDD\u4E0A\u4E0B\u6587</span>
      <span class="orb-panel-state" style="font-size:10px;color:rgba(255,255,255,0.3)"></span>
    </div>
    <div class="orb-panel-content" style="
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      min-height: 0;
    "></div>
  `;
  }
  function expandPanel() {
    if (!panelEl) panelEl = createPanel();
    if (orbState === "collapsed") {
      orbState = "expanded";
      buildPanelContent();
      updatePanelPosition();
      renderChatContent();
      panelEl.style.opacity = "1";
      panelEl.style.pointerEvents = "auto";
      updateStateLabel();
    }
  }
  function collapsePanel() {
    if (orbState === "expanded") {
      orbState = "collapsed";
      if (panelEl) {
        panelEl.style.opacity = "0";
        panelEl.style.pointerEvents = "none";
      }
      updateStateLabel();
    }
  }
  function enterEditMode() {
    if (orbState !== "expanded") return;
    orbState = "editing";
    if (panelEl) {
      panelEl.style.borderColor = "rgba(124, 58, 237, 0.8)";
      panelEl.style.boxShadow = "0 0 30px 8px rgba(124, 58, 237, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)";
    }
    updateStateLabel();
  }
  function exitEditMode() {
    if (orbState !== "editing") return;
    orbState = "expanded";
    if (panelEl) {
      panelEl.style.borderColor = "rgba(124, 58, 237, 0.3)";
      panelEl.style.boxShadow = "0 0 20px 4px rgba(124, 58, 237, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5)";
    }
    renderChatContent();
    updateStateLabel();
  }
  function togglePanel() {
    if (orbState === "collapsed") expandPanel();
    else if (orbState === "expanded") collapsePanel();
  }
  function updateStateLabel() {
    if (!panelEl) return;
    const label = panelEl.querySelector(".orb-panel-state");
    if (!label) return;
    const labels = { collapsed: "", expanded: "\u957F\u6309\u7F16\u8F91\u5927\u5C0F", editing: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F \xB7 \u677E\u624B\u5B8C\u6210" };
    label.textContent = labels[orbState];
  }
  function handleDragMove(dx, dy) {
    if (!orbEl) return;
    if (orbState === "editing") {
      const rawX = dragStartOrbX + dx;
      const rawY = dragStartOrbY + dy;
      const clamped = clampOrbPosition(rawX, rawY);
      const orbCX = clamped.x + ORB_HALF;
      const orbCY = clamped.y + ORB_HALF;
      panelWidth = Math.max(PANEL_MIN_WIDTH, orbCX - dragStartPanelX);
      panelHeight = Math.max(PANEL_MIN_HEIGHT, orbCY - dragStartPanelY);
      orbEl.style.left = clamped.x + "px";
      orbEl.style.top = clamped.y + "px";
      orbEl.style.right = "auto";
      orbEl.style.bottom = "auto";
      updatePanelPosition();
      renderChatContent();
    } else {
      const rawX = dragStartOrbX + dx;
      const rawY = dragStartOrbY + dy;
      const clamped = clampOrbPosition(rawX, rawY);
      orbEl.style.left = clamped.x + "px";
      orbEl.style.top = clamped.y + "px";
      orbEl.style.right = "auto";
      orbEl.style.bottom = "auto";
      orbEl.style.transition = "none";
      if (orbState === "expanded" && panelEl) {
        updatePanelPosition();
        renderChatContent();
      }
    }
  }
  function startDrag(x, y) {
    dragging = false;
    longPressFired = false;
    dragStartX = x;
    dragStartY = y;
    const rect = orbEl.getBoundingClientRect();
    dragStartOrbX = rect.left;
    dragStartOrbY = rect.top;
    if (panelEl) {
      dragStartPanelX = parseFloat(panelEl.style.left) || 0;
      dragStartPanelY = parseFloat(panelEl.style.top) || 0;
    }
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (orbState === "expanded") enterEditMode();
      else if (orbState === "editing") exitEditMode();
    }, LONG_PRESS_MS);
  }
  function moveDrag(x, y) {
    const dx = x - dragStartX;
    const dy = y - dragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragging = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
    if (!dragging) return;
    handleDragMove(dx, dy);
  }
  function endDrag() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (orbEl) {
      orbEl.style.transition = "box-shadow .2s";
      const rect = orbEl.getBoundingClientRect();
      freeOrbX = rect.left;
      freeOrbY = rect.top;
    }
    if (orbState === "editing") {
      exitEditMode();
    }
    if (!dragging && !longPressFired) togglePanel();
    dragging = false;
  }
  var freeOrbX = -1;
  var freeOrbY = -1;
  var lastBarTop = -1;
  var isOrbPushed = false;
  function initInputBarWatcher() {
    const check = () => {
      if (!orbEl) {
        requestAnimationFrame(check);
        return;
      }
      const barTop = getInputBarTop();
      if (freeOrbX === -1) {
        const rect = orbEl.getBoundingClientRect();
        freeOrbX = rect.left;
        freeOrbY = rect.top;
        lastBarTop = barTop;
      }
      if (barTop !== lastBarTop) {
        lastBarTop = barTop;
        const clamped = clampOrbPosition(freeOrbX, freeOrbY);
        const needsPush = freeOrbY !== clamped.y;
        const orbRect = orbEl.getBoundingClientRect();
        const orbCurrentX = orbRect.left;
        const orbCurrentY = orbRect.top;
        let orbTargetX = orbCurrentX;
        let orbTargetY = orbCurrentY;
        if (needsPush) {
          isOrbPushed = true;
          orbTargetX = clamped.x;
          orbTargetY = clamped.y;
        } else if (isOrbPushed) {
          isOrbPushed = false;
          orbTargetX = freeOrbX;
          orbTargetY = freeOrbY;
        } else {
          requestAnimationFrame(check);
          return;
        }
        orbEl.style.right = "auto";
        orbEl.style.bottom = "auto";
        const orbAnim = orbEl.animate(
          [
            { left: orbCurrentX + "px", top: orbCurrentY + "px" },
            { left: orbTargetX + "px", top: orbTargetY + "px" }
          ],
          { duration: 100, easing: "cubic-bezier(.4,0,.2,1)" }
        );
        orbAnim.onfinish = () => {
          orbEl.style.left = orbTargetX + "px";
          orbEl.style.top = orbTargetY + "px";
        };
        if (panelEl && orbState !== "collapsed") {
          const panelRect = panelEl.getBoundingClientRect();
          const panelTarget = getPanelTargetPosition(orbTargetX + ORB_HALF, orbTargetY + ORB_HALF);
          const panelAnim = panelEl.animate(
            [
              { left: panelRect.left + "px", top: panelRect.top + "px", width: panelRect.width + "px", height: panelRect.height + "px" },
              { left: panelTarget.left + "px", top: panelTarget.top + "px", width: panelTarget.width + "px", height: panelTarget.height + "px" }
            ],
            { duration: 100, easing: "cubic-bezier(.4,0,.2,1)" }
          );
          panelAnim.onfinish = () => {
            panelEl.style.left = panelTarget.left + "px";
            panelEl.style.top = panelTarget.top + "px";
            panelEl.style.width = panelTarget.width + "px";
            panelEl.style.height = panelTarget.height + "px";
            renderWidth = panelTarget.width;
            renderHeight = panelTarget.height;
            if (orbState === "expanded") renderChatContent();
          };
        }
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }
  function initOrb() {
    orbEl = document.getElementById("lightOrb");
    if (!orbEl) return;
    orbEl.style.zIndex = "210";
    const initRect = orbEl.getBoundingClientRect();
    const clamped = clampOrbPosition(initRect.left, initRect.top);
    orbEl.style.left = clamped.x + "px";
    orbEl.style.top = clamped.y + "px";
    orbEl.style.right = "auto";
    orbEl.style.bottom = "auto";
    freeOrbX = clamped.x;
    freeOrbY = clamped.y;
    orbEl.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    orbEl.addEventListener("touchmove", (e) => {
      e.stopPropagation();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    orbEl.addEventListener("touchend", (e) => {
      e.stopPropagation();
      endDrag();
    });
    let mouseDragging = false;
    orbEl.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      mouseDragging = true;
      startDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mousemove", (e) => {
      if (!mouseDragging) return;
      moveDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mouseup", () => {
      if (!mouseDragging && !dragging) return;
      mouseDragging = false;
      endDrag();
    });
    initInputBarWatcher();
  }

  // src/client/modules/tree-loader.ts
  var API2 = "/kfmv4/api";
  async function fetchDir(path) {
    var _a, _b;
    if (((_b = (_a = KFMState.files[path]) == null ? void 0 : _a.children) == null ? void 0 : _b.length) !== void 0) {
      return true;
    }
    try {
      const res = await fetch(API2 + "/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const items = data.items || [];
      const children = items.map((item) => ({
        name: item.name,
        path: item.path,
        isDir: item.isDir,
        isLink: false
      }));
      KFMState.files[path] = {
        name: path.split("/").pop() || path,
        path,
        isDir: true,
        isLink: false,
        children
      };
      return true;
    } catch {
      return false;
    }
  }
  async function ensureDirLoadedRecursive(path) {
    if (!KFMState.expandedPaths[path]) return;
    const loaded = await fetchDir(path);
    if (!loaded) return;
    const node = KFMState.files[path];
    if (node == null ? void 0 : node.children) {
      const loadPromises = [];
      for (const child of node.children) {
        if (child.isDir && KFMState.expandedPaths[child.path]) {
          loadPromises.push(ensureDirLoadedRecursive(child.path));
        }
      }
      if (loadPromises.length > 0) {
        await Promise.all(loadPromises);
      }
    }
  }
  async function loadFileTree(rootPath) {
    await fetchDir(rootPath);
    const rootNode = KFMState.files[rootPath];
    if (rootNode == null ? void 0 : rootNode.children) {
      const loadPromises = [];
      for (const child of rootNode.children) {
        if (child.isDir && KFMState.expandedPaths[child.path]) {
          loadPromises.push(ensureDirLoadedRecursive(child.path));
        }
      }
      if (loadPromises.length > 0) {
        await Promise.all(loadPromises);
      }
    }
    KFMState.notify();
  }
  async function loadLayerByLayer(path) {
    KFMState.notify();
    const loaded = await fetchDir(path);
    if (!loaded) return;
    KFMState.notify();
    const node = KFMState.files[path];
    if (node == null ? void 0 : node.children) {
      for (const child of node.children) {
        if (child.isDir && KFMState.expandedPaths[child.path]) {
          await loadLayerByLayer(child.path);
        }
      }
    }
  }
  function initLazyLoader() {
    const originalSetExpanded = KFMState.setExpanded.bind(KFMState);
    KFMState.setExpanded = function(path, expanded) {
      originalSetExpanded(path, expanded);
      if (expanded) {
        loadLayerByLayer(path).catch(console.error);
      }
    };
  }

  // src/client/main.ts
  initApp();
  initUI();
  initGestures();
  initOrb();
  initTreeRenderer();
  loadFileTree("/root").then(() => {
    initLazyLoader();
  }).catch((e) => console.error("[main] loadFileTree failed:", e));
})();
