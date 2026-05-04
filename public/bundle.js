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
  function showToast(msg) {
    const toast = document.getElementById("operationToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2e3);
  }
  function exposeGlobals() {
    window.API = API;
    window.KFMState = KFMState;
    window.selectedFile = KFMState.selectedFile;
    window.expandedPaths = KFMState.expandedPaths;
    Object.defineProperty(window, "showHidden", { get: () => KFMState.showHidden, configurable: true });
    window.showToast = showToast;
  }
  async function initApp() {
    exposeGlobals();
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
    const eyeBtn = document.getElementById("toggleHiddenBtn");
    if (eyeBtn) {
      eyeBtn.addEventListener("click", () => {
        KFMState.toggleHidden();
        eyeBtn.classList.toggle("active");
      });
    }
    const toggleBtn = document.getElementById("sidebarToggleBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        var _a, _b;
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
          if (sidebar.classList.contains("open")) {
            (_a = window.closeSidebar) == null ? void 0 : _a.call(window);
          } else {
            (_b = window.openSidebar) == null ? void 0 : _b.call(window);
          }
        }
      });
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
      this._drawShadow(box, bounds);
      this._drawBackground(box, bounds);
      if (box.shape) this._drawShape(box, bounds);
      this._drawBorder(box, bounds);
      this._drawHighlight(box, bounds);
      if (box.icon) this._drawIcon(box.icon, bounds, box.padding);
      if (box.textStyle.content) this._drawText(box.textStyle, bounds, box.padding, box.icon);
      if (box.overflow === "hidden" || box.scrollable) {
        this.ctx.beginPath();
        this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, box.borderRadius);
        this.ctx.clip();
      }
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
  var LINE_HEIGHT = 20;
  var MAX_LINES = 2;
  var TEXT_STYLES = {
    folderLabel: {
      font: FONT,
      lineHeight: LINE_HEIGHT,
      align: "left",
      verticalAlign: "middle",
      overflow: "ellipsis",
      maxLines: MAX_LINES
    },
    fileLabel: {
      font: FONT,
      lineHeight: LINE_HEIGHT,
      align: "left",
      verticalAlign: "middle",
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
  function createToggle(item, rowHeight, ex) {
    const tog = createBox("toggle-icon", { id: `toggle-${item.path}`, x: T_OFF, y: 0, height: rowHeight });
    tog.textStyle = { ...TEXT_STYLES.toggleIcon, content: "\u25B6", color: "#00d4ff" };
    if (ex) tog.transform.rotate = Math.PI / 2;
    return tog;
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
    row.addChild(createToggle(item, rowHeight, ex));
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
      overflow: "hidden",
      gradient: depth > 0 ? depthGradient(depth) : void 0,
      shadow: { color: "rgba(0,0,0,0.5)", blur: 12, offsetX: -4, offsetY: 0 }
    });
    if (depth > 0) {
      container.kfmStyle = resolveStyle("left-emphasis-rest-hidden", {
        borderColor: `rgba(180,130,255,${borderOp})`,
        emphasisScale: 2,
        cornerRadius: 4
      });
    }
    let cy = 0;
    if (children.length === 0) {
      container.height = 0;
      if (container.kfmStyle) {
        container.kfmStyle.cornerRadius = 0;
      }
      return container;
    }
    for (const item of children) {
      if (!KFMState.showHidden && item.name.startsWith(".")) continue;
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
    const rootRelX = absX(baseDepth) + getShift(baseDepth);
    const rootContainer = buildExpanded("/root", items, ctx, baseDepth, rootRelX);
    rootContainer.y = 0;
    rootBox.addChild(rootContainer);
    rootBox.height = rootContainer.height;
    rootBox.scrollY = 0;
    return rootBox;
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
    var target = targets[0], harnessPlugin, i;
    _isObject(target) || _isFunction(target) || (targets = [targets]);
    if (!(harnessPlugin = (target._gsap || {}).harness)) {
      i = _harnessPlugins.length;
      while (i-- && !_harnessPlugins[i].targetTest(target)) {
      }
      harnessPlugin = _harnessPlugins[i];
    }
    i = targets.length;
    while (i--) {
      targets[i] && (targets[i]._gsap || (targets[i]._gsap = new GSCache(targets[i], harnessPlugin))) || targets.splice(i, 1);
    }
    return targets;
  };
  var _getCache = function _getCache2(target) {
    return target._gsap || _harness(toArray(target))[0]._gsap;
  };
  var _getProperty = function _getProperty2(target, property, v) {
    return (v = target[property]) && _isFunction(v) ? target[property]() : _isUndefined(v) && target.getAttribute && target.getAttribute(property) || v;
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
    var l = toFind.length, i = 0;
    for (; toSearch.indexOf(toFind[i]) < 0 && ++i < l; ) {
    }
    return i < l;
  };
  var _lazyRender = function _lazyRender2() {
    var l = _lazyTweens.length, a = _lazyTweens.slice(0), i, tween;
    _lazyLookup = {};
    _lazyTweens.length = 0;
    for (i = 0; i < l; i++) {
      tween = a[i];
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
    var n = parseFloat(value);
    return (n || n === 0) && (value + "").match(_delimitedValueExp).length < 2 ? n : _isString(value) ? value.trim() : value;
  };
  var _passThrough = function _passThrough2(p) {
    return p;
  };
  var _setDefaults = function _setDefaults2(obj, defaults2) {
    for (var p in defaults2) {
      p in obj || (obj[p] = defaults2[p]);
    }
    return obj;
  };
  var _setKeyframeDefaults = function _setKeyframeDefaults2(excludeDuration) {
    return function(obj, defaults2) {
      for (var p in defaults2) {
        p in obj || p === "duration" && excludeDuration || p === "ease" || (obj[p] = defaults2[p]);
      }
    };
  };
  var _merge = function _merge2(base, toMerge) {
    for (var p in toMerge) {
      base[p] = toMerge[p];
    }
    return base;
  };
  var _mergeDeep = function _mergeDeep2(base, toMerge) {
    for (var p in toMerge) {
      p !== "__proto__" && p !== "constructor" && p !== "prototype" && (base[p] = _isObject(toMerge[p]) ? _mergeDeep2(base[p] || (base[p] = {}), toMerge[p]) : toMerge[p]);
    }
    return base;
  };
  var _copyExcluding = function _copyExcluding2(obj, excluding) {
    var copy = {}, p;
    for (p in obj) {
      p in excluding || (copy[p] = obj[p]);
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
    var i = a1.length, match = i === a2.length;
    while (match && i-- && a1[i] === a2[i]) {
    }
    return i < 0;
  };
  var _addLinkedListItem = function _addLinkedListItem2(parent, child, firstProp, lastProp, sortBy) {
    if (firstProp === void 0) {
      firstProp = "_first";
    }
    if (lastProp === void 0) {
      lastProp = "_last";
    }
    var prev = parent[lastProp], t;
    if (sortBy) {
      t = child[sortBy];
      while (prev && prev[sortBy] > t) {
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
    var t;
    if (child._time || !child._dur && child._initted || child._start < timeline2._time && (child._dur || !child.add)) {
      t = _parentToChildTotalTime(timeline2.rawTime(), child);
      if (!child._dur || _clamp(0, child.totalDuration(), t) - child._tTime > _tinyNum) {
        child.render(t, true);
      }
    }
    if (_uncache(timeline2, child)._dp && timeline2._initted && timeline2._time >= timeline2._dur && timeline2._ts) {
      if (timeline2._dur < timeline2.duration()) {
        t = timeline2;
        while (t._dp) {
          t.rawTime() >= 0 && t.totalTime(t._tTime);
          t = t._dp;
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
    var prevRatio = tween.ratio, ratio = totalTime < 0 || !totalTime && (!tween._start && _parentPlayheadIsBeforeStart(tween) && !(!tween._initted && _isFromOrFromStart(tween)) || (tween._ts < 0 || tween._dp._ts < 0) && !_isFromOrFromStart(tween)) ? 0 : 1, repeatDelay = tween._rDelay, tTime = 0, pt, iteration, prevIteration;
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
      pt = tween._pt;
      while (pt) {
        pt.r(ratio, pt.d);
        pt = pt._next;
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
    var labels = animation.labels, recent = animation._recent || _zeroPosition, clippedDuration = animation.duration() >= _bigNum ? recent.endTime(false) : animation._dur, i, offset, isPercent;
    if (_isString(position) && (isNaN(position) || position in labels)) {
      offset = position.charAt(0);
      isPercent = position.substr(-1) === "%";
      i = position.indexOf("=");
      if (offset === "<" || offset === ">") {
        i >= 0 && (position = position.replace(/=/, ""));
        return (offset === "<" ? recent._start : recent.endTime(recent._repeat >= 0)) + (parseFloat(position.substr(1)) || 0) * (isPercent ? (i < 0 ? recent : percentAnimation).totalDuration() / 100 : 1);
      }
      if (i < 0) {
        position in labels || (labels[position] = clippedDuration);
        return labels[position];
      }
      offset = parseFloat(position.charAt(i - 1) + position.substr(i + 1));
      if (isPercent && percentAnimation) {
        offset = offset / 100 * (_isArray(percentAnimation) ? percentAnimation[0] : percentAnimation).totalDuration();
      }
      return i > 1 ? _parsePosition2(animation, position.substr(0, i - 1), percentAnimation) + offset : clippedDuration + offset;
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
  var getUnit = function getUnit2(value, v) {
    return !_isString(value) || !(v = _unitExp.exec(value)) ? "" : v[1];
  };
  var clamp = function clamp2(min, max, value) {
    return _conditionalReturn(value, function(v) {
      return _clamp(min, max, v);
    });
  };
  var _slice = [].slice;
  var _isArrayLike = function _isArrayLike2(value, nonEmpty) {
    return value && _isObject(value) && "length" in value && (!nonEmpty && !value.length || value.length - 1 in value && _isObject(value[0])) && !value.nodeType && value !== _win;
  };
  var _flatten = function _flatten2(ar, leaveStrings, accumulator) {
    if (accumulator === void 0) {
      accumulator = [];
    }
    return ar.forEach(function(value) {
      var _accumulator;
      return _isString(value) && !leaveStrings || _isArrayLike(value, 1) ? (_accumulator = accumulator).push.apply(_accumulator, toArray(value)) : accumulator.push(value);
    }) || accumulator;
  };
  var toArray = function toArray2(value, scope, leaveStrings) {
    return _context && !scope && _context.selector ? _context.selector(value) : _isString(value) && !leaveStrings && (_coreInitted || !_wake()) ? _slice.call((scope || _doc).querySelectorAll(value), 0) : _isArray(value) ? _flatten(value, leaveStrings) : _isArrayLike(value) ? _slice.call(value, 0) : value ? [value] : [];
  };
  var selector = function selector2(value) {
    value = toArray(value)[0] || _warn("Invalid scope") || {};
    return function(v) {
      var el = value.current || value.nativeElement || value;
      return toArray(v, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") || _doc.createElement("div") : value);
    };
  };
  var shuffle = function shuffle2(a) {
    return a.sort(function() {
      return 0.5 - Math.random();
    });
  };
  var distribute = function distribute2(v) {
    if (_isFunction(v)) {
      return v;
    }
    var vars = _isObject(v) ? v : {
      each: v
    }, ease2 = _parseEase(vars.ease), from = vars.from || 0, base = parseFloat(vars.base) || 0, cache = {}, isDecimal = from > 0 && from < 1, ratios = isNaN(from) || isDecimal, axis = vars.axis, ratioX = from, ratioY = from;
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
    return function(i, target, a) {
      var l = (a || vars).length, distances = cache[l], originX, originY, x, y, d, j, max, min, wrapAt;
      if (!distances) {
        wrapAt = vars.grid === "auto" ? 0 : (vars.grid || [1, _bigNum])[1];
        if (!wrapAt) {
          max = -_bigNum;
          while (max < (max = a[wrapAt++].getBoundingClientRect().left) && wrapAt < l) {
          }
          wrapAt < l && wrapAt--;
        }
        distances = cache[l] = [];
        originX = ratios ? Math.min(wrapAt, l) * ratioX - 0.5 : from % wrapAt;
        originY = wrapAt === _bigNum ? 0 : ratios ? l * ratioY / wrapAt - 0.5 : from / wrapAt | 0;
        max = 0;
        min = _bigNum;
        for (j = 0; j < l; j++) {
          x = j % wrapAt - originX;
          y = originY - (j / wrapAt | 0);
          distances[j] = d = !axis ? _sqrt(x * x + y * y) : Math.abs(axis === "y" ? y : x);
          d > max && (max = d);
          d < min && (min = d);
        }
        from === "random" && shuffle(distances);
        distances.max = max - min;
        distances.min = min;
        distances.v = l = (parseFloat(vars.amount) || parseFloat(vars.each) * (wrapAt > l ? l - 1 : !axis ? Math.max(wrapAt, l / wrapAt) : axis === "y" ? l / wrapAt : wrapAt) || 0) * (from === "edges" ? -1 : 1);
        distances.b = l < 0 ? base - l : base;
        distances.u = getUnit(vars.amount || vars.each) || 0;
        ease2 = ease2 && l < 0 ? _invertEase(ease2) : ease2;
      }
      l = (distances[i] - distances.min) / distances.max || 0;
      return _roundPrecise(distances.b + (ease2 ? ease2(l) : l) * distances.v) + distances.u;
    };
  };
  var _roundModifier = function _roundModifier2(v) {
    var p = Math.pow(10, ((v + "").split(".")[1] || "").length);
    return function(raw) {
      var n = _roundPrecise(Math.round(parseFloat(raw) / v) * v * p);
      return (n - n % 1) / p + (_isNumber(raw) ? 0 : getUnit(raw));
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
      var x = parseFloat(is2D ? raw.x : raw), y = parseFloat(is2D ? raw.y : 0), min = _bigNum, closest = 0, i = snapTo.length, dx, dy;
      while (i--) {
        if (is2D) {
          dx = snapTo[i].x - x;
          dy = snapTo[i].y - y;
          dx = dx * dx + dy * dy;
        } else {
          dx = Math.abs(snapTo[i] - x);
        }
        if (dx < min) {
          min = dx;
          closest = i;
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
      return functions.reduce(function(v, f) {
        return f(v);
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
  var _replaceRandom = function _replaceRandom2(s) {
    return s.replace(_randomExp, function(match) {
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
    var func = isNaN(start + end) ? 0 : function(p2) {
      return (1 - p2) * start + p2 * end;
    };
    if (!func) {
      var isString = _isString(start), master = {}, p, i, interpolators, l, il;
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
        l = start.length;
        il = l - 2;
        for (i = 1; i < l; i++) {
          interpolators.push(interpolate2(start[i - 1], start[i]));
        }
        l--;
        func = function func2(p2) {
          p2 *= l;
          var i2 = Math.min(il, ~~p2);
          return interpolators[i2](p2 - i2);
        };
        progress = end;
      } else if (!mutate) {
        start = _merge(_isArray(start) ? [] : {}, start);
      }
      if (!interpolators) {
        for (p in end) {
          _addPropTween.call(master, start, p, "get", end[p]);
        }
        func = function func2(p2) {
          return _renderPropTweens(p2, master) || (isString ? start.p : start);
        };
      }
    }
    return _conditionalReturn(progress, func);
  };
  var _getLabelInDirection = function _getLabelInDirection2(timeline2, fromTime, backward) {
    var labels = timeline2.labels, min = _bigNum, p, distance, label;
    for (p in labels) {
      distance = labels[p] - fromTime;
      if (distance < 0 === !!backward && distance && min > (distance = Math.abs(distance))) {
        label = p;
        min = distance;
      }
    }
    return label;
  };
  var _callback = function _callback2(animation, type, executeLazyFirst) {
    var v = animation.vars, callback = v[type], prevContext = _context, context3 = animation._ctx, params, scope, result;
    if (!callback) {
      return;
    }
    params = v[type + "Params"];
    scope = v.callbackScope || animation;
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
  var splitColor = function splitColor2(v, toHSL, forceAlpha) {
    var a = !v ? _colorLookup.black : _isNumber(v) ? [v >> 16, v >> 8 & _255, v & _255] : 0, r, g, b, h, s, l, max, min, d, wasHSL;
    if (!a) {
      if (v.substr(-1) === ",") {
        v = v.substr(0, v.length - 1);
      }
      if (_colorLookup[v]) {
        a = _colorLookup[v];
      } else if (v.charAt(0) === "#") {
        if (v.length < 6) {
          r = v.charAt(1);
          g = v.charAt(2);
          b = v.charAt(3);
          v = "#" + r + r + g + g + b + b + (v.length === 5 ? v.charAt(4) + v.charAt(4) : "");
        }
        if (v.length === 9) {
          a = parseInt(v.substr(1, 6), 16);
          return [a >> 16, a >> 8 & _255, a & _255, parseInt(v.substr(7), 16) / 255];
        }
        v = parseInt(v.substr(1), 16);
        a = [v >> 16, v >> 8 & _255, v & _255];
      } else if (v.substr(0, 3) === "hsl") {
        a = wasHSL = v.match(_strictNumExp);
        if (!toHSL) {
          h = +a[0] % 360 / 360;
          s = +a[1] / 100;
          l = +a[2] / 100;
          g = l <= 0.5 ? l * (s + 1) : l + s - l * s;
          r = l * 2 - g;
          a.length > 3 && (a[3] *= 1);
          a[0] = _hue(h + 1 / 3, r, g);
          a[1] = _hue(h, r, g);
          a[2] = _hue(h - 1 / 3, r, g);
        } else if (~v.indexOf("=")) {
          a = v.match(_numExp);
          forceAlpha && a.length < 4 && (a[3] = 1);
          return a;
        }
      } else {
        a = v.match(_strictNumExp) || _colorLookup.transparent;
      }
      a = a.map(Number);
    }
    if (toHSL && !wasHSL) {
      r = a[0] / _255;
      g = a[1] / _255;
      b = a[2] / _255;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      l = (max + min) / 2;
      if (max === min) {
        h = s = 0;
      } else {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }
      a[0] = ~~(h + 0.5);
      a[1] = ~~(s * 100 + 0.5);
      a[2] = ~~(l * 100 + 0.5);
    }
    forceAlpha && a.length < 4 && (a[3] = 1);
    return a;
  };
  var _colorOrderData = function _colorOrderData2(v) {
    var values = [], c = [], i = -1;
    v.split(_colorExp).forEach(function(v2) {
      var a = v2.match(_numWithUnitExp) || [];
      values.push.apply(values, a);
      c.push(i += a.length + 1);
    });
    values.c = c;
    return values;
  };
  var _formatColors = function _formatColors2(s, toHSL, orderMatchData) {
    var result = "", colors = (s + result).match(_colorExp), type = toHSL ? "hsla(" : "rgba(", i = 0, c, shell, d, l;
    if (!colors) {
      return s;
    }
    colors = colors.map(function(color) {
      return (color = splitColor(color, toHSL, 1)) && type + (toHSL ? color[0] + "," + color[1] + "%," + color[2] + "%," + color[3] : color.join(",")) + ")";
    });
    if (orderMatchData) {
      d = _colorOrderData(s);
      c = orderMatchData.c;
      if (c.join(result) !== d.c.join(result)) {
        shell = s.replace(_colorExp, "1").split(_numWithUnitExp);
        l = shell.length - 1;
        for (; i < l; i++) {
          result += shell[i] + (~c.indexOf(i) ? colors.shift() || type + "0,0,0,0)" : (d.length ? d : colors.length ? colors : orderMatchData).shift());
        }
      }
    }
    if (!shell) {
      shell = s.split(_colorExp);
      l = shell.length - 1;
      for (; i < l; i++) {
        result += shell[i] + colors[i];
      }
    }
    return result + shell[l];
  };
  var _colorExp = (function() {
    var s = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b", p;
    for (p in _colorLookup) {
      s += "|" + p + "\\b";
    }
    return new RegExp(s + ")", "gi");
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
    var _getTime = Date.now, _lagThreshold = 500, _adjustedLag = 33, _startTime = _getTime(), _lastUpdate = _startTime, _gap = 1e3 / 240, _nextTime = _gap, _listeners2 = [], _id, _req, _raf, _self, _delta, _i, _tick = function _tick2(v) {
      var elapsed = _getTime() - _lastUpdate, manual = v === true, overlap, dispatch, time, frame;
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
        for (_i = 0; _i < _listeners2.length; _i++) {
          _listeners2[_i](time, _delta, frame, v);
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
          _req = _raf || function(f) {
            return setTimeout(f, _nextTime - _self.time * 1e3 + 1 | 0);
          };
          _tickerActive = 1;
          _tick(2);
        }
      },
      sleep: function sleep2() {
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
        var func = once ? function(t, d, f, v) {
          callback(t, d, f, v);
          _self.remove(func);
        } : callback;
        _self.remove(callback);
        _listeners2[prioritize ? "unshift" : "push"](func);
        _wake();
        return func;
      },
      remove: function remove(callback, i) {
        ~(i = _listeners2.indexOf(callback)) && _listeners2.splice(i, 1) && _i >= i && _i--;
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
    var obj = {}, split = value.substr(1, value.length - 3).split(":"), key = split[0], i = 1, l = split.length, index, val, parsedVal;
    for (; i < l; i++) {
      val = split[i];
      index = i !== l - 1 ? val.lastIndexOf(",") : val.length;
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
    var split = (name + "").split("("), ease2 = _easeMap[split[0]];
    return ease2 && split.length > 1 && ease2.config ? ease2.config.apply(null, ~name.indexOf("{") ? [_parseObjectInString(split[1])] : _valueInParentheses(name).split(",").map(_numericIfPossible)) : _easeMap._CE && _customEaseExp.test(name) ? _easeMap._CE("", name) : ease2;
  };
  var _invertEase = function _invertEase2(ease2) {
    return function(p) {
      return 1 - ease2(1 - p);
    };
  };
  var _parseEase = function _parseEase2(ease2, defaultEase) {
    return !ease2 ? defaultEase : (_isFunction(ease2) ? ease2 : _easeMap[ease2] || _configEaseFromString(ease2)) || defaultEase;
  };
  var _insertEase = function _insertEase2(names, easeIn, easeOut, easeInOut) {
    if (easeOut === void 0) {
      easeOut = function easeOut2(p) {
        return 1 - easeIn(1 - p);
      };
    }
    if (easeInOut === void 0) {
      easeInOut = function easeInOut2(p) {
        return p < 0.5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2;
      };
    }
    var ease2 = {
      easeIn,
      easeOut,
      easeInOut
    }, lowercaseName;
    _forEachName(names, function(name) {
      _easeMap[name] = _globals[name] = ease2;
      _easeMap[lowercaseName = name.toLowerCase()] = easeOut;
      for (var p in ease2) {
        _easeMap[lowercaseName + (p === "easeIn" ? ".in" : p === "easeOut" ? ".out" : ".inOut")] = _easeMap[name + "." + p] = ease2[p];
      }
    });
    return ease2;
  };
  var _easeInOutFromOut = function _easeInOutFromOut2(easeOut) {
    return function(p) {
      return p < 0.5 ? (1 - easeOut(1 - p * 2)) / 2 : 0.5 + easeOut((p - 0.5) * 2) / 2;
    };
  };
  var _configElastic = function _configElastic2(type, amplitude, period) {
    var p1 = amplitude >= 1 ? amplitude : 1, p2 = (period || (type ? 0.3 : 0.45)) / (amplitude < 1 ? amplitude : 1), p3 = p2 / _2PI * (Math.asin(1 / p1) || 0), easeOut = function easeOut2(p) {
      return p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * _sin((p - p3) * p2) + 1;
    }, ease2 = type === "out" ? easeOut : type === "in" ? function(p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);
    p2 = _2PI / p2;
    ease2.config = function(amplitude2, period2) {
      return _configElastic2(type, amplitude2, period2);
    };
    return ease2;
  };
  var _configBack = function _configBack2(type, overshoot) {
    if (overshoot === void 0) {
      overshoot = 1.70158;
    }
    var easeOut = function easeOut2(p) {
      return p ? --p * p * ((overshoot + 1) * p + overshoot) + 1 : 0;
    }, ease2 = type === "out" ? easeOut : type === "in" ? function(p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);
    ease2.config = function(overshoot2) {
      return _configBack2(type, overshoot2);
    };
    return ease2;
  };
  _forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", function(name, i) {
    var power = i < 5 ? i + 1 : i;
    _insertEase(name + ",Power" + (power - 1), i ? function(p) {
      return Math.pow(p, power);
    } : function(p) {
      return p;
    }, function(p) {
      return 1 - Math.pow(1 - p, power);
    }, function(p) {
      return p < 0.5 ? Math.pow(p * 2, power) / 2 : 1 - Math.pow((1 - p) * 2, power) / 2;
    });
  });
  _easeMap.Linear.easeNone = _easeMap.none = _easeMap.Linear.easeIn;
  _insertEase("Elastic", _configElastic("in"), _configElastic("out"), _configElastic());
  (function(n, c) {
    var n1 = 1 / c, n2 = 2 * n1, n3 = 2.5 * n1, easeOut = function easeOut2(p) {
      return p < n1 ? n * p * p : p < n2 ? n * Math.pow(p - 1.5 / c, 2) + 0.75 : p < n3 ? n * (p -= 2.25 / c) * p + 0.9375 : n * Math.pow(p - 2.625 / c, 2) + 0.984375;
    };
    _insertEase("Bounce", function(p) {
      return 1 - easeOut(1 - p);
    }, easeOut);
  })(7.5625, 2.75);
  _insertEase("Expo", function(p) {
    return Math.pow(2, 10 * (p - 1)) * p + p * p * p * p * p * p * (1 - p);
  });
  _insertEase("Circ", function(p) {
    return -(_sqrt(1 - p * p) - 1);
  });
  _insertEase("Sine", function(p) {
    return p === 1 ? 1 : -_cos(p * _HALF_PI) + 1;
  });
  _insertEase("Back", _configBack("in"), _configBack("out"), _configBack());
  _easeMap.SteppedEase = _easeMap.steps = _globals.SteppedEase = {
    config: function config(steps, immediateStart) {
      if (steps === void 0) {
        steps = 1;
      }
      var p1 = 1 / steps, p2 = steps + (immediateStart ? 0 : 1), p3 = immediateStart ? 1 : 0, max = 1 - _tinyNum;
      return function(p) {
        return ((p2 * _clamp(0, max, p) | 0) + p3) * p1;
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
        var f = _isFunction(onFulfilled) ? onFulfilled : _passThrough, _resolve = function _resolve2() {
          var _then = self.then;
          self.then = null;
          prevProm && prevProm();
          _isFunction(f) && (f = f(self)) && (f.then || f === self) && (self.then = _then);
          resolve(f);
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
    _proto2.to = function to(targets, vars, position) {
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
      var animations = this.getChildren(1, 1, 1), i = animations.length;
      while (i--) {
        if (animations[i].vars.id === id) {
          return animations[i];
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
      var t = Tween.delayedCall(0, callback || _emptyFunc, params);
      t.data = "isPause";
      this._hasPause = 1;
      return _addToTimeline(this, t, _parsePosition(this, position));
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
      var tweens = this.getTweensOf(targets, onlyActive), i = tweens.length;
      while (i--) {
        _overwritingTween !== tweens[i] && tweens[i].kill(targets, props);
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
      var tl = this, endTime = _parsePosition(tl, position), _vars = vars, startAt = _vars.startAt, _onStart = _vars.onStart, onStartParams = _vars.onStartParams, immediateRender = _vars.immediateRender, initted, tween = Tween.to(tl, _setDefaults({
        ease: vars.ease || "none",
        lazy: false,
        immediateRender: false,
        time: endTime,
        overwrite: "auto",
        duration: vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale()) || _tinyNum,
        onStart: function onStart() {
          tl.pause();
          if (!initted) {
            var duration = vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale());
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
      var child = this._first, labels = this.labels, p;
      amount = _roundPrecise(amount);
      while (child) {
        if (child._start >= ignoreBeforeTime) {
          child._start += amount;
          child._end += amount;
        }
        child = child._next;
      }
      if (adjustLabels) {
        for (p in labels) {
          if (labels[p] >= ignoreBeforeTime) {
            labels[p] += amount;
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
    var pt = new PropTween(this._pt, target, prop, 0, 1, _renderComplexString, null, setter), index = 0, matchIndex = 0, result, startNums, color, endNum, chunk, startNum, hasRandom, a;
    pt.b = start;
    pt.e = end;
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
        pt._pt = {
          _next: pt._pt,
          p: chunk || matchIndex === 1 ? chunk : ",",
          //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
          s: startNum,
          c: endNum.charAt(1) === "=" ? _parseRelative(startNum, endNum) - startNum : parseFloat(endNum) - startNum,
          m: color && color < 4 ? Math.round : 0
        };
        index = _complexStringNumExp.lastIndex;
      }
    }
    pt.c = index < end.length ? end.substring(index, end.length) : "";
    pt.fp = funcParam;
    if (_relExp.test(end) || hasRandom) {
      pt.e = 0;
    }
    this._pt = pt;
    return pt;
  };
  var _addPropTween = function _addPropTween2(target, prop, start, end, index, targets, modifier, stringFilter, funcParam, optional) {
    _isFunction(end) && (end = end(index || 0, target, targets));
    var currentValue = target[prop], parsedStart = start !== "get" ? start : !_isFunction(currentValue) ? currentValue : funcParam ? target[prop.indexOf("set") || !_isFunction(target["get" + prop.substr(3)]) ? prop : "get" + prop.substr(3)](funcParam) : target[prop](), setter = !_isFunction(currentValue) ? _setterPlain : funcParam ? _setterFuncWithParam : _setterFunc, pt;
    if (_isString(end)) {
      if (~end.indexOf("random(")) {
        end = _replaceRandom(end);
      }
      if (end.charAt(1) === "=") {
        pt = _parseRelative(parsedStart, end) + (getUnit(parsedStart) || 0);
        if (pt || pt === 0) {
          end = pt;
        }
      }
    }
    if (!optional || parsedStart !== end || _forceAllPropTweens) {
      if (!isNaN(parsedStart * end) && end !== "") {
        pt = new PropTween(this._pt, target, prop, +parsedStart || 0, end - (parsedStart || 0), typeof currentValue === "boolean" ? _renderBoolean : _renderPlain, 0, setter);
        funcParam && (pt.fp = funcParam);
        modifier && pt.modifier(modifier, this, target);
        return this._pt = pt;
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
    var copy = {}, p;
    for (p in vars) {
      copy[p] = _parseFuncOrString(vars[p], tween, index, target, targets);
    }
    return copy;
  };
  var _checkPlugin = function _checkPlugin2(property, vars, tween, index, target, targets) {
    var plugin, pt, ptLookup, i;
    if (_plugins[property] && (plugin = new _plugins[property]()).init(target, plugin.rawVars ? vars[property] : _processVars(vars[property], index, target, targets, tween), tween, index, targets) !== false) {
      tween._pt = pt = new PropTween(tween._pt, target, property, 0, 1, plugin.render, plugin, 0, plugin.priority);
      if (tween !== _quickTween) {
        ptLookup = tween._ptLookup[tween._targets.indexOf(target)];
        i = plugin._props.length;
        while (i--) {
          ptLookup[plugin._props[i]] = pt;
        }
      }
    }
    return plugin;
  };
  var _overwritingTween;
  var _forceAllPropTweens;
  var _initTween = function _initTween2(tween, time, tTime) {
    var vars = tween.vars, ease2 = vars.ease, startAt = vars.startAt, immediateRender = vars.immediateRender, lazy = vars.lazy, onUpdate = vars.onUpdate, runBackwards = vars.runBackwards, yoyoEase = vars.yoyoEase, keyframes = vars.keyframes, autoRevert = vars.autoRevert, dur = tween._dur, prevStartAt = tween._startAt, targets = tween._targets, parent = tween.parent, fullTargets = parent && parent.data === "nested" ? parent.vars.targets : targets, autoOverwrite = tween._overwrite === "auto" && !_suppressOverwrites, tl = tween.timeline, reverseEase = vars.easeReverse || yoyoEase, cleanVars, i, p, pt, target, hasPriority, gsData, harness, plugin, ptLookup, index, harnessVars, overwritten;
    tl && (!keyframes || !ease2) && (ease2 = "none");
    tween._ease = _parseEase(ease2, _defaults.ease);
    tween._rEase = reverseEase && (_parseEase(reverseEase) || tween._ease);
    tween._from = !tl && !!vars.runBackwards;
    if (tween._from) tween.ratio = 1;
    if (!tl || keyframes && !vars.stagger) {
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
          p = _setDefaults({
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
          harnessVars && (p[harness.prop] = harnessVars);
          _removeFromParent(tween._startAt = Tween.set(targets, p));
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
      for (i = 0; i < targets.length; i++) {
        target = targets[i];
        gsData = target._gsap || _harness(targets)[i]._gsap;
        tween._ptLookup[i] = ptLookup = {};
        _lazyLookup[gsData.id] && _lazyTweens.length && _lazyRender();
        index = fullTargets === targets ? i : fullTargets.indexOf(target);
        if (harness && (plugin = new harness()).init(target, harnessVars || cleanVars, tween, index, fullTargets) !== false) {
          tween._pt = pt = new PropTween(tween._pt, target, plugin.name, 0, 1, plugin.render, plugin, 0, plugin.priority);
          plugin._props.forEach(function(name) {
            ptLookup[name] = pt;
          });
          plugin.priority && (hasPriority = 1);
        }
        if (!harness || harnessVars) {
          for (p in cleanVars) {
            if (_plugins[p] && (plugin = _checkPlugin(p, cleanVars, tween, index, target, fullTargets))) {
              plugin.priority && (hasPriority = 1);
            } else {
              ptLookup[p] = pt = _addPropTween.call(tween, target, p, "get", cleanVars[p], index, fullTargets, 0, vars.stringFilter);
            }
          }
        }
        tween._op && tween._op[i] && tween.kill(target, tween._op[i]);
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
    keyframes && time <= 0 && tl.render(_bigNum, true, true);
  };
  var _updatePropTweens = function _updatePropTweens2(tween, property, value, start, startIsRelative, ratio, time, skipRecursion) {
    var ptCache = (tween._pt && tween._ptCache || (tween._ptCache = {}))[property], pt, rootPT, lookup, i;
    if (!ptCache) {
      ptCache = tween._ptCache[property] = [];
      lookup = tween._ptLookup;
      i = tween._targets.length;
      while (i--) {
        pt = lookup[i][property];
        if (pt && pt.d && pt.d._pt) {
          pt = pt.d._pt;
          while (pt && pt.p !== property && pt.fp !== property) {
            pt = pt._next;
          }
        }
        if (!pt) {
          _forceAllPropTweens = 1;
          tween.vars[property] = "+=0";
          _initTween(tween, time);
          _forceAllPropTweens = 0;
          return skipRecursion ? _warn(property + " not eligible for reset. Try splitting into individual properties") : 1;
        }
        ptCache.push(pt);
      }
    }
    i = ptCache.length;
    while (i--) {
      rootPT = ptCache[i];
      pt = rootPT._pt || rootPT;
      pt.s = (start || start === 0) && !startIsRelative ? start : pt.s + (start || 0) + ratio * pt.c;
      pt.c = value - pt.s;
      rootPT.e && (rootPT.e = _round(value) + getUnit(rootPT.e));
      rootPT.b && (rootPT.b = pt.s + getUnit(rootPT.b));
    }
  };
  var _addAliasesToVars = function _addAliasesToVars2(targets, vars) {
    var harness = targets[0] ? _getCache(targets[0]).harness : 0, propertyAliases = harness && harness.aliases, copy, p, i, aliases;
    if (!propertyAliases) {
      return vars;
    }
    copy = _merge({}, vars);
    for (p in propertyAliases) {
      if (p in copy) {
        aliases = propertyAliases[p].split(",");
        i = aliases.length;
        while (i--) {
          copy[aliases[i]] = copy[p];
        }
      }
    }
    return copy;
  };
  var _parseKeyframe = function _parseKeyframe2(prop, obj, allProps, easeEach) {
    var ease2 = obj.ease || easeEach || "power1.inOut", p, a;
    if (_isArray(obj)) {
      a = allProps[prop] || (allProps[prop] = []);
      obj.forEach(function(value, i) {
        return a.push({
          t: i / (obj.length - 1) * 100,
          v: value,
          e: ease2
        });
      });
    } else {
      for (p in obj) {
        a = allProps[p] || (allProps[p] = []);
        p === "ease" || a.push({
          t: parseFloat(prop),
          v: obj[p],
          e: ease2
        });
      }
    }
  };
  var _parseFuncOrString = function _parseFuncOrString2(value, tween, i, target, targets) {
    return _isFunction(value) ? value.call(tween, i, target, targets) : _isString(value) && ~value.indexOf("random(") ? _replaceRandom(value) : value;
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
      var _this3$vars = _this3.vars, duration = _this3$vars.duration, delay = _this3$vars.delay, immediateRender = _this3$vars.immediateRender, stagger = _this3$vars.stagger, overwrite = _this3$vars.overwrite, keyframes = _this3$vars.keyframes, defaults2 = _this3$vars.defaults, scrollTrigger = _this3$vars.scrollTrigger, parent = vars.parent || _globalTimeline, parsedTargets = (_isArray(targets) || _isTypedArray(targets) ? _isNumber(targets[0]) : "length" in vars) ? [targets] : toArray(targets), tl, i, copy, l, p, curTarget, staggerFunc, staggerVarsToMerge;
      _this3._targets = parsedTargets.length ? _harness(parsedTargets) : _warn("GSAP target " + targets + " not found. https://gsap.com", !_config.nullTargetWarn) || [];
      _this3._ptLookup = [];
      _this3._overwrite = overwrite;
      if (keyframes || stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
        vars = _this3.vars;
        var easeReverse = vars.easeReverse || vars.yoyoEase;
        tl = _this3.timeline = new Timeline({
          data: "nested",
          defaults: defaults2 || {},
          targets: parent && parent.data === "nested" ? parent.vars.targets : parsedTargets
        });
        tl.kill();
        tl.parent = tl._dp = _assertThisInitialized(_this3);
        tl._start = 0;
        if (stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
          l = parsedTargets.length;
          staggerFunc = stagger && distribute(stagger);
          if (_isObject(stagger)) {
            for (p in stagger) {
              if (~_staggerTweenProps.indexOf(p)) {
                staggerVarsToMerge || (staggerVarsToMerge = {});
                staggerVarsToMerge[p] = stagger[p];
              }
            }
          }
          for (i = 0; i < l; i++) {
            copy = _copyExcluding(vars, _staggerPropsToSkip);
            copy.stagger = 0;
            easeReverse && (copy.easeReverse = easeReverse);
            staggerVarsToMerge && _merge(copy, staggerVarsToMerge);
            curTarget = parsedTargets[i];
            copy.duration = +_parseFuncOrString(duration, _assertThisInitialized(_this3), i, curTarget, parsedTargets);
            copy.delay = (+_parseFuncOrString(delay, _assertThisInitialized(_this3), i, curTarget, parsedTargets) || 0) - _this3._delay;
            if (!stagger && l === 1 && copy.delay) {
              _this3._delay = delay = copy.delay;
              _this3._start += delay;
              copy.delay = 0;
            }
            tl.to(curTarget, copy, staggerFunc ? staggerFunc(i, curTarget, parsedTargets) : 0);
            tl._ease = _easeMap.none;
          }
          tl.duration() ? duration = delay = 0 : _this3.timeline = 0;
        } else if (keyframes) {
          _inheritDefaults(_setDefaults(tl.vars.defaults, {
            ease: "none"
          }));
          tl._ease = _parseEase(keyframes.ease || vars.ease || "none");
          var time = 0, a, kf, v;
          if (_isArray(keyframes)) {
            keyframes.forEach(function(frame) {
              return tl.to(parsedTargets, frame, ">");
            });
            tl.duration();
          } else {
            copy = {};
            for (p in keyframes) {
              p === "ease" || p === "easeEach" || _parseKeyframe(p, keyframes[p], copy, keyframes.easeEach);
            }
            for (p in copy) {
              a = copy[p].sort(function(a2, b) {
                return a2.t - b.t;
              });
              time = 0;
              for (i = 0; i < a.length; i++) {
                kf = a[i];
                v = {
                  ease: kf.e,
                  duration: (kf.t - (i ? a[i - 1].t : 0)) / 100 * duration
                };
                v[p] = kf.v;
                tl.to(parsedTargets, v, time);
                time += v.duration;
              }
            }
            tl.duration() < duration && tl.to({}, {
              duration: duration - tl.duration()
            });
          }
        }
        duration || _this3.duration(duration = tl.duration());
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
      var prevTime = this._time, tDur = this._tDur, dur = this._dur, isNegative = totalTime < 0, tTime = totalTime > tDur - _tinyNum && !isNegative ? tDur : totalTime < _tinyNum ? 0 : totalTime, time, pt, iteration, cycleDuration, prevIteration, isYoyo, ratio, timeline2;
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
        pt = this._pt;
        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
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
      var parsedTargets = this._targets, killingTargets = targets ? toArray(targets) : parsedTargets, propTweenLookup = this._ptLookup, firstPT = this._pt, overwrittenProps, curLookup, curOverwriteProps, props, p, pt, i;
      if ((!vars || vars === "all") && _arraysMatch(parsedTargets, killingTargets)) {
        vars === "all" && (this._pt = 0);
        return _interrupt(this);
      }
      overwrittenProps = this._op = this._op || [];
      if (vars !== "all") {
        if (_isString(vars)) {
          p = {};
          _forEachName(vars, function(name) {
            return p[name] = 1;
          });
          vars = p;
        }
        vars = _addAliasesToVars(parsedTargets, vars);
      }
      i = parsedTargets.length;
      while (i--) {
        if (~killingTargets.indexOf(parsedTargets[i])) {
          curLookup = propTweenLookup[i];
          if (vars === "all") {
            overwrittenProps[i] = vars;
            props = curLookup;
            curOverwriteProps = {};
          } else {
            curOverwriteProps = overwrittenProps[i] = overwrittenProps[i] || {};
            props = vars;
          }
          for (p in props) {
            pt = curLookup && curLookup[p];
            if (pt) {
              if (!("kill" in pt.d) || pt.d.kill(p) === true) {
                _removeLinkedListItem(this, pt, "_pt");
              }
              delete curLookup[p];
            }
            if (curOverwriteProps !== "all") {
              curOverwriteProps[p] = 1;
            }
          }
        }
      }
      this._initted && !this._pt && firstPT && _interrupt(this);
      return this;
    };
    Tween2.to = function to(targets, vars) {
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
      var tl = new Timeline(), params = _slice.call(arguments, 0);
      params.splice(name === "staggerFromTo" ? 5 : 4, 0, 0);
      return tl[name].apply(tl, params);
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
    var pt = data._pt, s = "";
    if (!ratio && data.b) {
      s = data.b;
    } else if (ratio === 1 && data.e) {
      s = data.e;
    } else {
      while (pt) {
        s = pt.p + (pt.m ? pt.m(pt.s + pt.c * ratio) : Math.round((pt.s + pt.c * ratio) * 1e4) / 1e4) + s;
        pt = pt._next;
      }
      s += data.c;
    }
    data.set(data.t, data.p, s, data);
  };
  var _renderPropTweens = function _renderPropTweens2(ratio, data) {
    var pt = data._pt;
    while (pt) {
      pt.r(ratio, pt.d);
      pt = pt._next;
    }
  };
  var _addPluginModifier = function _addPluginModifier2(modifier, tween, target, property) {
    var pt = this._pt, next;
    while (pt) {
      next = pt._next;
      pt.p === property && pt.modifier(modifier, tween, target);
      pt = next;
    }
  };
  var _killPropTweensOf = function _killPropTweensOf2(property) {
    var pt = this._pt, hasNonDependentRemaining, next;
    while (pt) {
      next = pt._next;
      if (pt.p === property && !pt.op || pt.op === property) {
        _removeLinkedListItem(this, pt, "_pt");
      } else if (!pt.dep) {
        hasNonDependentRemaining = 1;
      }
      pt = next;
    }
    return !hasNonDependentRemaining;
  };
  var _setterWithModifier = function _setterWithModifier2(target, property, value, data) {
    data.mSet(target, property, data.m.call(data.tween, value, data.mt), data);
  };
  var _sortPropTweensByPriority = function _sortPropTweensByPriority2(parent) {
    var pt = parent._pt, next, pt2, first, last;
    while (pt) {
      next = pt._next;
      pt2 = first;
      while (pt2 && pt2.pr > pt.pr) {
        pt2 = pt2._next;
      }
      if (pt._prev = pt2 ? pt2._prev : last) {
        pt._prev._next = pt;
      } else {
        first = pt;
      }
      if (pt._next = pt2) {
        pt2._prev = pt;
      } else {
        last = pt;
      }
      pt = next;
    }
    parent._pt = first;
  };
  var PropTween = /* @__PURE__ */ (function() {
    function PropTween2(next, target, prop, start, change, renderer2, data, setter, priority) {
      this.t = target;
      this.s = start;
      this.c = change;
      this.p = prop;
      this.r = renderer2 || _renderPlain;
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
    return (_listeners[type] || _emptyArray).map(function(f) {
      return f();
    });
  };
  var _onMediaChange = function _onMediaChange2() {
    var time = Date.now(), matches = [];
    if (time - _lastMediaTime > 2) {
      _dispatch("matchMediaInit");
      _media.forEach(function(c) {
        var queries = c.queries, conditions = c.conditions, match, p, anyMatch, toggled;
        for (p in queries) {
          match = _win.matchMedia(queries[p]).matches;
          match && (anyMatch = 1);
          if (match !== conditions[p]) {
            conditions[p] = match;
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
      var self = this, f = function f2() {
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
      self.last = f;
      return name === _isFunction ? f(self, function(func2) {
        return self.add(null, func2);
      }) : name ? self[name] = f : f;
    };
    _proto5.ignore = function ignore(func) {
      var prev = _context;
      _context = null;
      func(this);
      _context = prev;
    };
    _proto5.getTweens = function getTweens() {
      var a = [];
      this.data.forEach(function(e) {
        return e instanceof Context2 ? a.push.apply(a, e.getTweens()) : e instanceof Tween && !(e.parent && e.parent.data === "nested") && a.push(e);
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
          var tweens = _this4.getTweens(), i2 = _this4.data.length, t;
          while (i2--) {
            t = _this4.data[i2];
            if (t.data === "isFlip") {
              t.revert();
              t.getChildren(true, true, false).forEach(function(tween) {
                return tweens.splice(tweens.indexOf(tween), 1);
              });
            }
          }
          tweens.map(function(t2) {
            return {
              g: t2._dur || t2._delay || t2._sat && !t2._sat.vars.immediateRender ? t2.globalTime(0) : -Infinity,
              t: t2
            };
          }).sort(function(a, b) {
            return b.g - a.g || -Infinity;
          }).forEach(function(o) {
            return o.t.revert(revert);
          });
          i2 = _this4.data.length;
          while (i2--) {
            t = _this4.data[i2];
            if (t instanceof Timeline) {
              if (t.data !== "nested") {
                t.scrollTrigger && t.scrollTrigger.revert();
                t.kill();
              }
            } else {
              !(t instanceof Tween) && t.revert && t.revert(revert);
            }
          }
          _this4._r.forEach(function(f) {
            return f(revert, _this4);
          });
          _this4.isReverted = true;
        })();
      } else {
        this.data.forEach(function(e) {
          return e.kill && e.kill();
        });
      }
      this.clear();
      if (matchMedia2) {
        var i = _media.length;
        while (i--) {
          _media[i].id === this.id && _media.splice(i, 1);
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
      var context3 = new Context(0, scope || this.scope), cond = context3.conditions = {}, mq, p, active;
      _context && !context3.selector && (context3.selector = _context.selector);
      this.contexts.push(context3);
      func = context3.add("onMatch", func);
      context3.queries = conditions;
      for (p in conditions) {
        if (p === "all") {
          active = 1;
        } else {
          mq = _win.matchMedia(conditions[p]);
          if (mq) {
            _media.indexOf(context3) < 0 && _media.push(context3);
            (cond[p] = mq.matches) && (active = 1);
            mq.addListener ? mq.addListener(_onMediaChange) : mq.addEventListener("change", _onMediaChange);
          }
        }
      }
      active && func(context3, function(f) {
        return context3.add(null, f);
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
        var setters = target.map(function(t) {
          return gsap.quickSetter(t, property, unit);
        }), l = setters.length;
        return function(value) {
          var i = l;
          while (i--) {
            setters[i](value);
          }
        };
      }
      target = target[0] || {};
      var Plugin = _plugins[property], cache = _getCache(target), p = cache.harness && (cache.harness.aliases || {})[property] || property, setter = Plugin ? function(value) {
        var p2 = new Plugin();
        _quickTween._pt = 0;
        p2.init(target, unit ? value + unit : value, _quickTween, 0, [target]);
        p2.render(1, p2);
        _quickTween._pt && _renderPropTweens(1, _quickTween);
      } : cache.set(target, p);
      return Plugin ? setter : function(value) {
        return setter(target, p, unit ? value + unit : value, cache, 1);
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
      _effects[name] = function(targets, vars, tl) {
        return effect(toArray(targets), _setDefaults(vars || {}, defaults2), tl);
      };
      if (extendTimeline) {
        Timeline.prototype[name] = function(targets, vars, position) {
          return this.add(_effects[name](targets, _isObject(vars) ? vars : (position = vars) && {}, this), position);
        };
      }
    },
    registerEase: function registerEase(name, ease2) {
      _easeMap[name] = _parseEase(ease2);
    },
    parseEase: function parseEase(ease2, defaultEase) {
      return arguments.length ? _parseEase(ease2, defaultEase) : _easeMap;
    },
    getById: function getById(id) {
      return _globalTimeline.getById(id);
    },
    exportRoot: function exportRoot(vars, includeDelayedCalls) {
      if (vars === void 0) {
        vars = {};
      }
      var tl = new Timeline(vars), child, next;
      tl.smoothChildTiming = _isNotFalse(vars.smoothChildTiming);
      _globalTimeline.remove(tl);
      tl._dp = 0;
      tl._time = tl._tTime = _globalTimeline._time;
      child = _globalTimeline._first;
      while (child) {
        next = child._next;
        if (includeDelayedCalls || !(!child._dur && child instanceof Tween && child.vars.onComplete === child._targets[0])) {
          _addToTimeline(tl, child, child._start - child._delay);
        }
        child = next;
      }
      _addToTimeline(_globalTimeline, tl, 0);
      return tl;
    },
    context: function context(func, scope) {
      return func ? new Context(func, scope) : _context;
    },
    matchMedia: function matchMedia(scope) {
      return new MatchMedia(scope);
    },
    matchMediaRefresh: function matchMediaRefresh() {
      return _media.forEach(function(c) {
        var cond = c.conditions, found, p;
        for (p in cond) {
          if (cond[p]) {
            cond[p] = false;
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
      var a = _listeners[type], i = a && a.indexOf(callback);
      i >= 0 && a.splice(i, 1);
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
    var pt = plugin._pt;
    while (pt && pt.p !== prop && pt.op !== prop && pt.fp !== prop) {
      pt = pt._next;
    }
    return pt;
  };
  var _addModifiers = function _addModifiers2(tween, modifiers) {
    var targets = tween._targets, p, i, pt;
    for (p in modifiers) {
      i = targets.length;
      while (i--) {
        pt = tween._ptLookup[i][p];
        if (pt && (pt = pt.d)) {
          if (pt._pt) {
            pt = _getPluginPropTween(pt, p);
          }
          pt && pt.modifier && pt.modifier(modifiers[p], tween, targets[i], p);
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
          var temp, p;
          if (_isString(vars)) {
            temp = {};
            _forEachName(vars, function(name2) {
              return temp[name2] = 1;
            });
            vars = temp;
          }
          if (modifier) {
            temp = {};
            for (p in vars) {
              temp[p] = modifier(vars[p]);
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
      var p, pt, v;
      this.tween = tween;
      for (p in vars) {
        v = target.getAttribute(p) || "";
        pt = this.add(target, "setAttribute", (v || 0) + "", vars[p], index, targets, 0, 0, p);
        pt.op = p;
        pt.b = v;
        this._props.push(p);
      }
    },
    render: function render(ratio, data) {
      var pt = data._pt;
      while (pt) {
        _reverting ? pt.set(pt.t, pt.p, pt.b, pt) : pt.r(ratio, pt.d);
        pt = pt._next;
      }
    }
  }, {
    name: "endArray",
    headless: 1,
    init: function init2(target, value) {
      var i = value.length;
      while (i--) {
        this.add(target, i, target[i] || 0, value[i], 0, 0, 0, 0, 0, 1);
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
        return _propertyAliases.transform.split(",").forEach(function(p) {
          return _saveStyle2.call(_this, p, isNotCSS);
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
    var props = this.props, target = this.target, style = target.style, cache = target._gsap, i, p;
    for (i = 0; i < props.length; i += 3) {
      if (!props[i + 1]) {
        props[i + 2] ? style[props[i]] = props[i + 2] : style.removeProperty(props[i].substr(0, 2) === "--" ? props[i] : props[i].replace(_capsExp, "-$1").toLowerCase());
      } else if (props[i + 1] === 2) {
        target[props[i]](props[i + 2]);
      } else {
        target[props[i]] = props[i + 2];
      }
    }
    if (this.tfm) {
      for (p in this.tfm) {
        cache[p] = this.tfm[p];
      }
      if (cache.svg) {
        cache.renderTransform();
        target.setAttribute("data-svg-origin", this.svgo || "");
      }
      i = _reverting2();
      if ((!i || !i.isStart) && !style[_transformProp]) {
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
    properties && target.style && target.nodeType && properties.split(",").forEach(function(p) {
      return saver.save(p);
    });
    return saver;
  };
  var _supports3D;
  var _createElement = function _createElement2(type, ns) {
    var e = _doc2.createElementNS ? _doc2.createElementNS((ns || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), type) : _doc2.createElement(type);
    return e && e.style ? e : _doc2.createElement(type);
  };
  var _getComputedProperty = function _getComputedProperty2(target, property, skipPrefixFallback) {
    var cs = getComputedStyle(target);
    return cs[property] || cs.getPropertyValue(property.replace(_capsExp, "-$1").toLowerCase()) || cs.getPropertyValue(property) || !skipPrefixFallback && _getComputedProperty2(target, _checkPropPrefix(property) || property, 1) || "";
  };
  var _prefixes = "O,Moz,ms,Ms,Webkit".split(",");
  var _checkPropPrefix = function _checkPropPrefix2(property, element, preferPrefix) {
    var e = element || _tempDiv, s = e.style, i = 5;
    if (property in s && !preferPrefix) {
      return property;
    }
    property = property.charAt(0).toUpperCase() + property.substr(1);
    while (i-- && !(_prefixes[i] + property in s)) {
    }
    return i < 0 ? null : (i === 3 ? "ms" : i >= 0 ? _prefixes[i] : "") + property;
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
    } catch (e) {
    }
    svg.removeChild(clone);
    _docElement.removeChild(svg);
    return bbox;
  };
  var _getAttributeFallbacks = function _getAttributeFallbacks2(target, attributesArray) {
    var i = attributesArray.length;
    while (i--) {
      if (target.hasAttribute(attributesArray[i])) {
        return target.getAttribute(attributesArray[i]);
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
  var _isSVG = function _isSVG2(e) {
    return !!(e.getCTM && (!e.parentNode || e.ownerSVGElement) && _getBBox(e));
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
    var pt = new PropTween(plugin._pt, target, property, 0, 1, onlySetAtEnd ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue);
    plugin._pt = pt;
    pt.b = beginning;
    pt.e = end;
    plugin._props.push(property);
    return pt;
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
        var v = target.style[property];
        target.style[property] = amount + unit;
        px = target[measureProperty];
        v ? target.style[property] = v : _removeProperty(target, property);
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
      var p = _checkPropPrefix(prop, target, 1), s = p && _getComputedProperty(target, p, 1);
      if (s && s !== start) {
        prop = p;
        start = s;
      } else if (prop === "borderColor") {
        start = _getComputedProperty(target, "borderTopColor");
      }
    }
    var pt = new PropTween(this._pt, target.style, prop, 0, 1, _renderComplexString), index = 0, matchIndex = 0, a, result, startValues, startNum, color, startValue, endValue, endNum, chunk, endUnit, startUnit, endValues;
    pt.b = start;
    pt.e = end;
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
              pt.e += endUnit;
            }
          }
          if (startUnit !== endUnit) {
            startNum = _convertToUnit(target, prop, startValue, endUnit) || 0;
          }
          pt._pt = {
            _next: pt._pt,
            p: chunk || matchIndex === 1 ? chunk : ",",
            //note: SVG spec allows omission of comma/space when a negative sign is wedged between two numbers, like 2.5-5.3 instead of 2.5,-5.3 but when tweening, the negative value may switch to positive, so we insert the comma just in case.
            s: startNum,
            c: endNum - startNum,
            m: color && color < 4 || prop === "zIndex" ? Math.round : 0
          };
        }
      }
      pt.c = index < end.length ? end.substring(index, end.length) : "";
    } else {
      pt.r = prop === "display" && end === "none" ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue;
    }
    _relExp.test(end) && (pt.e = 0);
    this._pt = pt;
    return pt;
  };
  var _keywordToPercent = {
    top: "0%",
    bottom: "100%",
    left: "0%",
    right: "100%",
    center: "50%"
  };
  var _convertKeywordsToPercentages = function _convertKeywordsToPercentages2(value) {
    var split = value.split(" "), x = split[0], y = split[1] || "50%";
    if (x === "top" || x === "bottom" || y === "left" || y === "right") {
      value = x;
      x = y;
      y = value;
    }
    split[0] = _keywordToPercent[x] || x;
    split[1] = _keywordToPercent[y] || y;
    return split.join(" ");
  };
  var _renderClearProps = function _renderClearProps2(ratio, data) {
    if (data.tween && data.tween._time === data.tween._dur) {
      var target = data.t, style = target.style, props = data.u, cache = target._gsap, prop, clearTransforms, i;
      if (props === "all" || props === true) {
        style.cssText = "";
        clearTransforms = 1;
      } else {
        props = props.split(",");
        i = props.length;
        while (--i > -1) {
          prop = props[i];
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
        var pt = plugin._pt = new PropTween(plugin._pt, target, property, 0, 0, _renderClearProps);
        pt.u = endValue;
        pt.pr = -10;
        pt.tween = tween;
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
    var cache = target._gsap, matrix = matrixArray || _getMatrix(target, true), xOriginOld = cache.xOrigin || 0, yOriginOld = cache.yOrigin || 0, xOffsetOld = cache.xOffset || 0, yOffsetOld = cache.yOffset || 0, a = matrix[0], b = matrix[1], c = matrix[2], d = matrix[3], tx = matrix[4], ty = matrix[5], originSplit = origin.split(" "), xOrigin = parseFloat(originSplit[0]) || 0, yOrigin = parseFloat(originSplit[1]) || 0, bounds, determinant, x, y;
    if (!originIsAbsolute) {
      bounds = _getBBox(target);
      xOrigin = bounds.x + (~originSplit[0].indexOf("%") ? xOrigin / 100 * bounds.width : xOrigin);
      yOrigin = bounds.y + (~(originSplit[1] || originSplit[0]).indexOf("%") ? yOrigin / 100 * bounds.height : yOrigin);
    } else if (matrix !== _identity2DMatrix && (determinant = a * d - b * c)) {
      x = xOrigin * (d / determinant) + yOrigin * (-c / determinant) + (c * ty - d * tx) / determinant;
      y = xOrigin * (-b / determinant) + yOrigin * (a / determinant) - (a * ty - b * tx) / determinant;
      xOrigin = x;
      yOrigin = y;
    }
    if (smooth || smooth !== false && cache.smooth) {
      tx = xOrigin - xOriginOld;
      ty = yOrigin - yOriginOld;
      cache.xOffset = xOffsetOld + (tx * a + ty * c) - tx;
      cache.yOffset = yOffsetOld + (tx * b + ty * d) - ty;
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
    var style = target.style, invertedScaleX = cache.scaleX < 0, px = "px", deg = "deg", cs = getComputedStyle(target), origin = _getComputedProperty(target, _transformOriginProp) || "0", x, y, z, scaleX, scaleY, rotation, rotationX, rotationY, skewX, skewY, perspective, xOrigin, yOrigin, matrix, angle, cos, sin, a, b, c, d, a12, a22, t1, t2, t3, a13, a23, a33, a42, a43, a32;
    x = y = z = rotation = rotationX = rotationY = skewX = skewY = perspective = 0;
    scaleX = scaleY = 1;
    cache.svg = !!(target.getCTM && _isSVG(target));
    if (cs.translate) {
      if (cs.translate !== "none" || cs.scale !== "none" || cs.rotate !== "none") {
        style[_transformProp] = (cs.translate !== "none" ? "translate3d(" + (cs.translate + " 0 0").split(" ").slice(0, 3).join(", ") + ") " : "") + (cs.rotate !== "none" ? "rotate(" + cs.rotate + ") " : "") + (cs.scale !== "none" ? "scale(" + cs.scale.split(" ").join(",") + ") " : "") + (cs[_transformProp] !== "none" ? cs[_transformProp] : "");
      }
      style.scale = style.rotate = style.translate = "none";
    }
    matrix = _getMatrix(target, cache.svg);
    if (cache.svg) {
      if (cache.uncache) {
        t2 = target.getBBox();
        origin = cache.xOrigin - t2.x + "px " + (cache.yOrigin - t2.y) + "px";
        t1 = "";
      } else {
        t1 = !uncache && target.getAttribute("data-svg-origin");
      }
      _applySVGOrigin(target, t1 || origin, !!t1 || cache.originIsAbsolute, cache.smooth !== false, matrix);
    }
    xOrigin = cache.xOrigin || 0;
    yOrigin = cache.yOrigin || 0;
    if (matrix !== _identity2DMatrix) {
      a = matrix[0];
      b = matrix[1];
      c = matrix[2];
      d = matrix[3];
      x = a12 = matrix[4];
      y = a22 = matrix[5];
      if (matrix.length === 6) {
        scaleX = Math.sqrt(a * a + b * b);
        scaleY = Math.sqrt(d * d + c * c);
        rotation = a || b ? _atan2(b, a) * _RAD2DEG : 0;
        skewX = c || d ? _atan2(c, d) * _RAD2DEG + rotation : 0;
        skewX && (scaleY *= Math.abs(Math.cos(skewX * _DEG2RAD)));
        if (cache.svg) {
          x -= xOrigin - (xOrigin * a + yOrigin * c);
          y -= yOrigin - (xOrigin * b + yOrigin * d);
        }
      } else {
        a32 = matrix[6];
        a42 = matrix[7];
        a13 = matrix[8];
        a23 = matrix[9];
        a33 = matrix[10];
        a43 = matrix[11];
        x = matrix[12];
        y = matrix[13];
        z = matrix[14];
        angle = _atan2(a32, a33);
        rotationX = angle * _RAD2DEG;
        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a12 * cos + a13 * sin;
          t2 = a22 * cos + a23 * sin;
          t3 = a32 * cos + a33 * sin;
          a13 = a12 * -sin + a13 * cos;
          a23 = a22 * -sin + a23 * cos;
          a33 = a32 * -sin + a33 * cos;
          a43 = a42 * -sin + a43 * cos;
          a12 = t1;
          a22 = t2;
          a32 = t3;
        }
        angle = _atan2(-c, a33);
        rotationY = angle * _RAD2DEG;
        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a * cos - a13 * sin;
          t2 = b * cos - a23 * sin;
          t3 = c * cos - a33 * sin;
          a43 = d * sin + a43 * cos;
          a = t1;
          b = t2;
          c = t3;
        }
        angle = _atan2(b, a);
        rotation = angle * _RAD2DEG;
        if (angle) {
          cos = Math.cos(angle);
          sin = Math.sin(angle);
          t1 = a * cos + b * sin;
          t2 = a12 * cos + a22 * sin;
          b = b * cos - a * sin;
          a22 = a22 * cos - a12 * sin;
          a = t1;
          a12 = t2;
        }
        if (rotationX && Math.abs(rotationX) + Math.abs(rotation) > 359.9) {
          rotationX = rotation = 0;
          rotationY = 180 - rotationY;
        }
        scaleX = _round(Math.sqrt(a * a + b * b + c * c));
        scaleY = _round(Math.sqrt(a22 * a22 + a32 * a32));
        angle = _atan2(a12, a22);
        skewX = Math.abs(angle) > 2e-4 ? angle * _RAD2DEG : 0;
        perspective = a43 ? 1 / (a43 < 0 ? -a43 : a43) : 0;
      }
      if (cache.svg) {
        t1 = target.getAttribute("transform");
        cache.forceCSS = target.setAttribute("transform", "") || !_isNullTransform(_getComputedProperty(target, _transformProp));
        t1 && target.setAttribute("transform", t1);
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
    cache.x = x - ((cache.xPercent = x && (!uncache && cache.xPercent || (Math.round(target.offsetWidth / 2) === Math.round(-x) ? -50 : 0))) ? target.offsetWidth * cache.xPercent / 100 : 0) + px;
    cache.y = y - ((cache.yPercent = y && (!uncache && cache.yPercent || (Math.round(target.offsetHeight / 2) === Math.round(-y) ? -50 : 0))) ? target.offsetHeight * cache.yPercent / 100 : 0) + px;
    cache.z = z + px;
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
    var _ref = cache || this, xPercent = _ref.xPercent, yPercent = _ref.yPercent, x = _ref.x, y = _ref.y, z = _ref.z, rotation = _ref.rotation, rotationY = _ref.rotationY, rotationX = _ref.rotationX, skewX = _ref.skewX, skewY = _ref.skewY, scaleX = _ref.scaleX, scaleY = _ref.scaleY, transformPerspective = _ref.transformPerspective, force3D = _ref.force3D, target = _ref.target, zOrigin = _ref.zOrigin, transforms = "", use3D = force3D === "auto" && ratio && ratio !== 1 || force3D === true;
    if (zOrigin && (rotationX !== _zeroDeg || rotationY !== _zeroDeg)) {
      var angle = parseFloat(rotationY) * _DEG2RAD, a13 = Math.sin(angle), a33 = Math.cos(angle), cos;
      angle = parseFloat(rotationX) * _DEG2RAD;
      cos = Math.cos(angle);
      x = _addPxTranslate(target, x, a13 * cos * -zOrigin);
      y = _addPxTranslate(target, y, -Math.sin(angle) * -zOrigin);
      z = _addPxTranslate(target, z, a33 * cos * -zOrigin + zOrigin);
    }
    if (transformPerspective !== _zeroPx) {
      transforms += "perspective(" + transformPerspective + _endParenthesis;
    }
    if (xPercent || yPercent) {
      transforms += "translate(" + xPercent + "%, " + yPercent + "%) ";
    }
    if (use3D || x !== _zeroPx || y !== _zeroPx || z !== _zeroPx) {
      transforms += z !== _zeroPx || use3D ? "translate3d(" + x + ", " + y + ", " + z + ") " : "translate(" + x + ", " + y + _endParenthesis;
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
    var _ref2 = cache || this, xPercent = _ref2.xPercent, yPercent = _ref2.yPercent, x = _ref2.x, y = _ref2.y, rotation = _ref2.rotation, skewX = _ref2.skewX, skewY = _ref2.skewY, scaleX = _ref2.scaleX, scaleY = _ref2.scaleY, target = _ref2.target, xOrigin = _ref2.xOrigin, yOrigin = _ref2.yOrigin, xOffset = _ref2.xOffset, yOffset = _ref2.yOffset, forceCSS = _ref2.forceCSS, tx = parseFloat(x), ty = parseFloat(y), a11, a21, a12, a22, temp;
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
    if (tx && !~(x + "").indexOf("px") || ty && !~(y + "").indexOf("px")) {
      tx = _convertToUnit(target, "x", x, "px");
      ty = _convertToUnit(target, "y", y, "px");
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
    var cap = 360, isString = _isString(endValue), endNum = parseFloat(endValue) * (isString && ~endValue.indexOf("rad") ? _RAD2DEG : 1), change = endNum - startNum, finalValue = startNum + change + "deg", direction, pt;
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
    plugin._pt = pt = new PropTween(plugin._pt, target, property, startNum, change, _renderPropWithEnd);
    pt.e = finalValue;
    pt.u = "deg";
    plugin._props.push(property);
    return pt;
  };
  var _assign = function _assign2(target, source) {
    for (var p in source) {
      target[p] = source[p];
    }
    return target;
  };
  var _addRawTransformPTs = function _addRawTransformPTs2(plugin, transforms, target) {
    var startCache = _assign({}, target._gsap), exclude = "perspective,force3D,transformOrigin,svgOrigin", style = target.style, endCache, p, startValue, endValue, startNum, endNum, startUnit, endUnit;
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
    for (p in _transformProps) {
      startValue = startCache[p];
      endValue = endCache[p];
      if (startValue !== endValue && exclude.indexOf(p) < 0) {
        startUnit = getUnit(startValue);
        endUnit = getUnit(endValue);
        startNum = startUnit !== endUnit ? _convertToUnit(target, p, startValue, endUnit) : parseFloat(startValue);
        endNum = parseFloat(endValue);
        plugin._pt = new PropTween(plugin._pt, endCache, p, startNum, endNum - startNum, _renderCSSProp);
        plugin._pt.u = endUnit || 0;
        plugin._props.push(p);
      }
    }
    _assign(endCache, startCache);
  };
  _forEachName("padding,margin,Width,Radius", function(name, index) {
    var t = "Top", r = "Right", b = "Bottom", l = "Left", props = (index < 3 ? [t, r, b, l] : [t + l, t + r, b + r, b + l]).map(function(side) {
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
      props.forEach(function(prop, i) {
        return vars[prop] = a[i] = a[i] || a[(i - 1) / 2 | 0];
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
      var props = this._props, style = target.style, startAt = tween.vars.startAt, startValue, endValue, endNum, startNum, type, specialProp, p, startUnit, endUnit, relative, isTransformRelated, transformPropTween, cache, smooth, hasPriority, inlineProps, finalTransformValue;
      _pluginInitted || _initCore();
      this.styles = this.styles || _getStyleSaver(target);
      inlineProps = this.styles.props;
      this.tween = tween;
      for (p in vars) {
        if (p === "autoRound") {
          continue;
        }
        endValue = vars[p];
        if (_plugins[p] && _checkPlugin(p, vars, tween, index, target, targets)) {
          continue;
        }
        type = typeof endValue;
        specialProp = _specialProps[p];
        if (type === "function") {
          endValue = endValue.call(tween, index, target, targets);
          type = typeof endValue;
        }
        if (type === "string" && ~endValue.indexOf("random(")) {
          endValue = _replaceRandom(endValue);
        }
        if (specialProp) {
          specialProp(this, target, p, endValue, tween) && (hasPriority = 1);
        } else if (p.substr(0, 2) === "--") {
          startValue = (getComputedStyle(target).getPropertyValue(p) + "").trim();
          endValue += "";
          _colorExp.lastIndex = 0;
          if (!_colorExp.test(startValue)) {
            startUnit = getUnit(startValue);
            endUnit = getUnit(endValue);
            endUnit ? startUnit !== endUnit && (startValue = _convertToUnit(target, p, startValue, endUnit) + endUnit) : startUnit && (endValue += startUnit);
          }
          this.add(style, "setProperty", startValue, endValue, index, targets, 0, 0, p);
          props.push(p);
          inlineProps.push(p, 0, style[p]);
        } else if (type !== "undefined") {
          if (startAt && p in startAt) {
            startValue = typeof startAt[p] === "function" ? startAt[p].call(tween, index, target, targets) : startAt[p];
            _isString(startValue) && ~startValue.indexOf("random(") && (startValue = _replaceRandom(startValue));
            getUnit(startValue + "") || startValue === "auto" || (startValue += _config.units[p] || getUnit(_get(target, p)) || "");
            (startValue + "").charAt(1) === "=" && (startValue = _get(target, p));
          } else {
            startValue = _get(target, p);
          }
          startNum = parseFloat(startValue);
          relative = type === "string" && endValue.charAt(1) === "=" && endValue.substr(0, 2);
          relative && (endValue = endValue.substr(2));
          endNum = parseFloat(endValue);
          if (p in _propertyAliases) {
            if (p === "autoAlpha") {
              if (startNum === 1 && _get(target, "visibility") === "hidden" && endNum) {
                startNum = 0;
              }
              inlineProps.push("visibility", 0, style.visibility);
              _addNonTweeningPT(this, style, "visibility", startNum ? "inherit" : "hidden", endNum ? "inherit" : "hidden", !endNum);
            }
            if (p !== "scale" && p !== "transform") {
              p = _propertyAliases[p];
              ~p.indexOf(",") && (p = p.split(",")[0]);
            }
          }
          isTransformRelated = p in _transformProps;
          if (isTransformRelated) {
            this.styles.save(p);
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
            if (p === "scale") {
              this._pt = new PropTween(this._pt, cache, "scaleY", cache.scaleY, (relative ? _parseRelative(cache.scaleY, relative + endNum) : endNum) - cache.scaleY || 0, _renderCSSProp);
              this._pt.u = 0;
              props.push("scaleY", p);
              p += "X";
            } else if (p === "transformOrigin") {
              inlineProps.push(_transformOriginProp, 0, style[_transformOriginProp]);
              endValue = _convertKeywordsToPercentages(endValue);
              if (cache.svg) {
                _applySVGOrigin(target, endValue, 0, smooth, 0, this);
              } else {
                endUnit = parseFloat(endValue.split(" ")[2]) || 0;
                endUnit !== cache.zOrigin && _addNonTweeningPT(this, cache, "zOrigin", cache.zOrigin, endUnit);
                _addNonTweeningPT(this, style, p, _firstTwoOnly(startValue), _firstTwoOnly(endValue));
              }
              continue;
            } else if (p === "svgOrigin") {
              _applySVGOrigin(target, endValue, 1, smooth, 0, this);
              continue;
            } else if (p in _rotationalProperties) {
              _addRotationalPropTween(this, cache, p, startNum, relative ? _parseRelative(startNum, relative + endValue) : endValue);
              continue;
            } else if (p === "smoothOrigin") {
              _addNonTweeningPT(this, cache, "smooth", cache.smooth, endValue);
              continue;
            } else if (p === "force3D") {
              cache[p] = endValue;
              continue;
            } else if (p === "transform") {
              _addRawTransformPTs(this, endValue, target);
              continue;
            }
          } else if (!(p in style)) {
            p = _checkPropPrefix(p) || p;
          }
          if (isTransformRelated || (endNum || endNum === 0) && (startNum || startNum === 0) && !_complexExp.test(endValue) && p in style) {
            startUnit = (startValue + "").substr((startNum + "").length);
            endNum || (endNum = 0);
            endUnit = getUnit(endValue) || (p in _config.units ? _config.units[p] : startUnit);
            startUnit !== endUnit && (startNum = _convertToUnit(target, p, startValue, endUnit));
            this._pt = new PropTween(this._pt, isTransformRelated ? cache : style, p, startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum, !isTransformRelated && (endUnit === "px" || p === "zIndex") && vars.autoRound !== false ? _renderRoundedCSSProp : _renderCSSProp);
            this._pt.u = endUnit || 0;
            if (isTransformRelated && finalTransformValue !== endValue) {
              this._pt.b = startValue;
              this._pt.e = finalTransformValue;
              this._pt.r = _renderCSSPropWithBeginningAndEnd;
            } else if (startUnit !== endUnit && endUnit !== "%") {
              this._pt.b = startValue;
              this._pt.r = _renderCSSPropWithBeginning;
            }
          } else if (!(p in style)) {
            if (p in target) {
              this.add(target, p, startValue || target[p], relative ? relative + endValue : endValue, index, targets);
            } else if (p !== "parseTransform") {
              _missingPlugin(p, endValue);
              continue;
            }
          } else {
            _tweenComplexCSSString.call(this, target, p, startValue, relative ? relative + endValue : endValue);
          }
          isTransformRelated || (p in style ? inlineProps.push(p, 0, style[p]) : typeof target[p] === "function" ? inlineProps.push(p, 2, target[p]()) : inlineProps.push(p, 1, startValue || target[p]));
          props.push(p);
        }
      }
      hasPriority && _sortPropTweensByPriority(this);
    },
    render: function render2(ratio, data) {
      if (data.tween._time || !_reverting2()) {
        var pt = data._pt;
        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
        }
      } else {
        data.styles.revert();
      }
    },
    get: _get,
    aliases: _propertyAliases,
    getSetter: function getSetter(target, property, plugin) {
      var p = _propertyAliases[property];
      p && p.indexOf(",") < 0 && (property = p);
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

  // src/client/modules/char-rain.ts
  async function animateCharRain(container, root, renderer2) {
    var _a, _b, _c;
    const rows = container.children.filter(
      (c) => {
        var _a2, _b2;
        return ((_a2 = c.id) == null ? void 0 : _a2.startsWith("title-")) || ((_b2 = c.id) == null ? void 0 : _b2.startsWith("file-"));
      }
    );
    if (rows.length === 0) return;
    const canvas = document.getElementById("tree-canvas");
    const ctx = canvas == null ? void 0 : canvas.getContext("2d");
    if (!ctx) return;
    const origOverflow = container.overflow;
    container.overflow = "visible";
    const absY = container.getAbsolutePosition().y;
    const scrollY = (_a = root.scrollY) != null ? _a : 0;
    const topY = scrollY - absY;
    container.children.forEach((c) => {
      c.opacity = 1;
    });
    renderer2 == null ? void 0 : renderer2.setRoot(root);
    const allTargets = [];
    const lineGroups = [];
    let currentLineGroup = 0;
    const hiddenLabels = [];
    const hiddenToggles = [];
    for (const row of rows) {
      const label = row.children.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("label-");
      });
      if (!label || !((_b = label.textStyle) == null ? void 0 : _b.content)) continue;
      const text = label.textStyle.content;
      const font = label.textStyle.font || FONT;
      const color = label.textStyle.color;
      const lineH = label.textStyle.lineHeight || LINE_HEIGHT;
      ctx.font = font;
      let layoutLines2;
      try {
        const prepared = prepareWithSegments(text, font);
        const layout2 = layoutWithLines(prepared, label.width, lineH);
        layoutLines2 = layout2.lines;
      } catch {
        layoutLines2 = [{ text, width: ctx.measureText(text).width }];
      }
      const maxVis = label.textStyle.maxLines || MAX_LINES;
      const isTrunc = layoutLines2.length > maxVis;
      const visLines = layoutLines2.slice(0, maxVis);
      const totalTextHeight = visLines.length * lineH;
      const verticalOffset = Math.max(0, (row.height - totalTextHeight) / 2);
      const rowFirstLineGroup = currentLineGroup;
      for (let li = 0; li < visLines.length; li++) {
        const line = visLines[li];
        let chars;
        if (li === maxVis - 1 && isTrunc) {
          chars = [...line.text.slice(0, -1), "\u2026"];
        } else {
          chars = [...line.text];
        }
        const charWidths = chars.map((ch) => ctx.measureText(ch).width);
        if (!lineGroups[currentLineGroup]) lineGroups[currentLineGroup] = [];
        let cx = 0;
        for (let ci = 0; ci < chars.length; ci++) {
          const targetX = row.x + label.x + cx;
          const targetY = row.y + label.y + verticalOffset + li * lineH;
          const initX = targetX + (Math.random() - 0.5) * 100;
          const initY = targetY - 80 - Math.random() * 140;
          const box = new Box({
            id: `cr-${row.id}-L${li}-C${ci}`,
            x: initX,
            y: initY,
            width: charWidths[ci] + 2,
            height: lineH,
            opacity: 0,
            backgroundColor: "transparent",
            // 透明背景，消除阴影
            interactive: false,
            zIndex: 99,
            overflow: "visible"
          });
          box.textStyle = {
            content: chars[ci],
            color,
            font,
            lineHeight: lineH,
            align: "left",
            verticalAlign: "middle",
            overflow: "visible",
            maxLines: 1
          };
          container.addChild(box);
          allTargets.push({ box, targetX, targetY });
          lineGroups[currentLineGroup].push({ box, targetX, targetY });
          cx += charWidths[ci];
        }
        currentLineGroup++;
      }
      const toggleBox = row.children.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
      });
      if (toggleBox && ((_c = toggleBox.textStyle) == null ? void 0 : _c.content)) {
        const tChar = toggleBox.textStyle.content;
        const tFont = toggleBox.textStyle.font || font;
        ctx.font = tFont;
        const tWidth = ctx.measureText(tChar).width;
        const tTargetX = row.x + toggleBox.x;
        const tTargetY = row.y + toggleBox.y;
        const tInitX = tTargetX + (Math.random() - 0.5) * 100;
        const tInitY = tTargetY - 80 - Math.random() * 140;
        const tBox = new Box({
          id: `cr-${row.id}-toggle`,
          x: tInitX,
          y: tInitY,
          width: toggleBox.width,
          height: toggleBox.height || LINE_HEIGHT,
          opacity: 0,
          backgroundColor: "transparent",
          interactive: false,
          zIndex: 99,
          overflow: "visible"
        });
        tBox.textStyle = {
          ...toggleBox.textStyle,
          overflow: "visible",
          maxLines: 1
        };
        container.addChild(tBox);
        const togTarget = { box: tBox, targetX: tTargetX, targetY: tTargetY, isToggle: toggleBox.transform.rotate > 0.1 };
        allTargets.push(togTarget);
        lineGroups[rowFirstLineGroup].push(togTarget);
      }
      const labelBox = row.children.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("label-");
      });
      if (labelBox) {
        labelBox.visible = false;
        hiddenLabels.push(labelBox);
      }
      const toggleHider = row.children.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
      });
      if (toggleHider) {
        toggleHider.visible = false;
        hiddenToggles.push(toggleHider);
      }
    }
    if (allTargets.length === 0) {
      container.overflow = origOverflow;
      return;
    }
    renderer2 == null ? void 0 : renderer2.setRoot(root);
    const BASE_DUR = 0.22;
    try {
      await new Promise((resolve) => {
        const tl = gsapWithCSS.timeline({ onComplete: resolve });
        for (let gi = 0; gi < lineGroups.length; gi++) {
          const group = lineGroups[gi];
          if (!group || group.length === 0) continue;
          for (let ci = 0; ci < group.length; ci++) {
            const t = group[ci];
            const randDelay = Math.random() * 0.1 + gi * 8e-3;
            const randDur = BASE_DUR + Math.random() * 0.06;
            tl.to(t.box, {
              x: t.targetX,
              y: t.targetY,
              opacity: 1,
              duration: randDur,
              ease: "back.out(1.05)"
            }, randDelay);
            if (t.isToggle) {
              tl.to(t.box.transform, {
                rotate: Math.PI / 2,
                duration: randDur,
                ease: "power2.out"
              }, randDelay);
            }
          }
        }
      });
    } finally {
      const currentRoot = renderer2 == null ? void 0 : renderer2.getRoot();
      if (currentRoot !== root) return;
      for (const t of allTargets) {
        const idx = container.children.indexOf(t.box);
        if (idx >= 0) container.children.splice(idx, 1);
      }
      hiddenLabels.forEach((l) => {
        l.visible = true;
      });
      hiddenToggles.forEach((t) => {
        t.visible = true;
      });
      container.overflow = origOverflow;
      container.children.forEach((c) => {
        c.opacity = 1;
      });
      renderer2 == null ? void 0 : renderer2.setRoot(root);
    }
  }

  // src/client/modules/tree-render.ts
  var renderer = null;
  var _stateSub = null;
  function _ensureSubscribed() {
    if (_stateSub) KFMState.unsubscribe(_stateSub);
    _stateSub = () => {
      _animBusy = false;
      _animBusyAt = 0;
      _clickQueue = [];
      rebuildTree();
    };
    KFMState.subscribe(_stateSub);
  }
  function markAnimatingPath(path) {
    animatingPath = path;
  }
  function triggerExpandAnimation(path) {
    var _a;
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (!root) return;
    const container = findBoxById(root, `expanded-${path}`);
    const titleRow = findBoxById(root, `title-${path}`);
    const toggle2 = (_a = titleRow == null ? void 0 : titleRow.children) == null ? void 0 : _a.find((c) => {
      var _a2;
      return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
    });
    if (!container) return;
    const fullHeight = container._fullHeight || 0;
    if (!fullHeight) {
      if (toggle2 && toggle2.transform) {
        let animFrame2 = function() {
          const elapsed = performance.now() - startTime;
          const t = Math.min(elapsed / durationMs, 1);
          const eased = 1 - (1 - t) * (1 - t);
          toggle2.transform.rotate = endRot * eased;
          if (rend) rend.setRoot(rend.getRoot());
          if (elapsed < durationMs) {
            requestAnimationFrame(animFrame2);
          } else {
          }
        };
        var animFrame = animFrame2;
        toggle2.transform.rotate = 0;
        const startTime = performance.now();
        const endRot = Math.PI / 2;
        const durationMs = 300;
        const rend = renderer;
        requestAnimationFrame(animFrame2);
      }
      renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
      return;
    }
    animatingPath = null;
    const _origYs = container._origYs;
    if (_origYs && container.children.length === _origYs.length) {
      container.children.forEach((c, j) => {
        c.y = _origYs[j];
      });
    }
    container.children.forEach((c) => {
      c.opacity = 1;
    });
    const ancestors = collectAncestors(container, root);
    _animBusy = true;
    _animBusyAt = Date.now();
    animateCharRain(container, root, renderer);
    gsapWithCSS.to(container, {
      height: fullHeight,
      duration: 0.05,
      ease: "back.out(1.15)",
      onUpdate: function() {
        applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
        renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
      },
      onComplete: () => {
        if (container.kfmStyle && container._savedCr !== void 0) {
          container.kfmStyle.cornerRadius = container._savedCr;
        }
        slideInRows(container, root, toggle2).then(() => {
          fixExpandedToggles(container);
          renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
        }).finally(() => {
          _animBusy = false;
          _animBusyAt = 0;
          const _root = renderer == null ? void 0 : renderer.getRoot();
          if (_root) {
            _rebuildRowIndex(_root);
          }
          if (cursorRowId) {
            const _t = findBoxById(_root, cursorRowId);
            if (_t) moveCursorTo(_t, false);
          }
          processClickQueue();
        });
      }
    });
    applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
    renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
  }
  function fixExpandedToggles(container) {
    const state = KFMState;
    if (!state) return;
    function walk(box) {
      var _a, _b;
      if (!box.children) return;
      for (const child of box.children) {
        if ((_a = child.id) == null ? void 0 : _a.startsWith("expanded-")) {
          const path = child.id.slice("expanded-".length);
          if (state.expandedPaths[path]) {
            const titleRow = findBoxByIdLocal(child.parent, `title-${path}`);
            const tog = (_b = titleRow == null ? void 0 : titleRow.children) == null ? void 0 : _b.find((c) => {
              var _a2;
              return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
            });
            if (tog) {
              gsapWithCSS.killTweensOf(tog.transform);
              tog.transform.rotate = Math.PI / 2;
            }
          }
        }
        walk(child);
      }
    }
    walk(container);
  }
  function findBoxByIdLocal(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    if (root.children) {
      for (const c of root.children) {
        const found = findBoxByIdLocal(c, id);
        if (found) return found;
      }
    }
    return null;
  }
  function isAnimLocked() {
    return _animBusy;
  }
  var cursorBox = null;
  var cursorRowId = null;
  var _rowIndex = [];
  var _sessionId = 0;
  var animatingPath = null;
  var _animBusy = false;
  var _animBusyAt = 0;
  var pendingCollapse = null;
  var _clickQueue = [];
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
  function moveCursorTo(hitBox, animate = true) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!cursorBox) return;
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (root && !root.children.includes(cursorBox)) {
      ensureCursorBox(root, root.height || ((_b = (_a = document.getElementById("tree-canvas")) == null ? void 0 : _a.clientHeight) != null ? _b : 618));
    }
    let abs;
    try {
      abs = hitBox.getAbsolutePosition();
    } catch {
      return;
    }
    const canvas = document.getElementById("tree-canvas");
    const depth = (_d = (_c = hitBox.data) == null ? void 0 : _c.depth) != null ? _d : 0;
    const shift = getShift(depth);
    const offsetX = shift / 2;
    const rm = ((_e = canvas == null ? void 0 : canvas.clientWidth) != null ? _e : 295) - 8;
    const targetX = abs.x + offsetX;
    const targetY = abs.y + 2;
    const targetW = rm - abs.x - offsetX;
    const targetH = hitBox.height - 4;
    cursorRowId = hitBox.id || null;
    const label = hitBox.children.find((c) => {
      var _a2;
      return (_a2 = c.id) == null ? void 0 : _a2.startsWith("label-");
    });
    let textW = 0;
    if ((_f = label == null ? void 0 : label.textStyle) == null ? void 0 : _f.content) {
      const ctx2d = (_g = canvas == null ? void 0 : canvas.getContext) == null ? void 0 : _g.call(canvas, "2d");
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
    const totalLineW = targetW;
    const topLineW = Math.min(Math.max(textW, 20), totalLineW - 10);
    const botLineW = totalLineW - topLineW;
    const cdata = cursorBox.data;
    if (cdata) {
      cdata.cursorDynamicLines = true;
      cdata.color = "rgba(0,212,255,0.7)";
    }
    if (animate && cdata) {
      try {
        gsapWithCSS.to(cursorBox, {
          x: targetX,
          y: targetY,
          width: targetW,
          height: targetH,
          duration: 0.18,
          ease: "power3.out",
          overwrite: "auto"
        });
        gsapWithCSS.to(cdata, {
          topLineW,
          botLineW,
          duration: 0.18,
          ease: "power3.out",
          overwrite: "auto"
        });
      } catch {
        cursorBox.x = targetX;
        cursorBox.y = targetY;
        cursorBox.width = targetW;
        cursorBox.height = targetH;
        cdata.topLineW = topLineW;
        cdata.botLineW = botLineW;
      }
    } else {
      cursorBox.x = targetX;
      cursorBox.y = targetY;
      cursorBox.width = targetW;
      cursorBox.height = targetH;
      if (cdata) {
        cdata.topLineW = topLineW;
        cdata.botLineW = botLineW;
      }
    }
  }
  function onSidebarOpen() {
    _sessionId++;
    _animBusy = false;
    _animBusyAt = 0;
    animatingPath = null;
    _clickQueue = [];
    cursorBox = null;
    cursorRowId = null;
    _rowIndex = [];
    pendingCollapse = null;
    gsapWithCSS.globalTimeline.clear();
    renderer == null ? void 0 : renderer.stop();
    renderer = null;
    const fileTree = document.getElementById("fileTree");
    if (!fileTree) return;
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
    requestAnimationFrame(() => {
      rebuildTree();
      renderer == null ? void 0 : renderer.resize();
      window.__treeRenderer = renderer;
      _ensureSubscribed();
      styleRegistry.subscribe(() => rebuildTree());
      window.addEventListener("resize", () => renderer == null ? void 0 : renderer.resize());
      bindScrollEvents(canvas);
      bindClickEvents(canvas, dpr);
      _createSidebarTouchArea();
    });
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const onEnd = () => {
        sidebar.removeEventListener("transitionend", onEnd);
        renderer == null ? void 0 : renderer.resize();
      };
      sidebar.addEventListener("transitionend", onEnd);
    }
  }
  function onSidebarClose() {
    var _a;
    _sessionId++;
    gsapWithCSS.globalTimeline.clear();
    _animBusy = false;
    _animBusyAt = 0;
    animatingPath = null;
    pendingCollapse = null;
    _clickQueue = [];
    cursorBox = null;
    cursorRowId = null;
    _rowIndex = [];
    renderer == null ? void 0 : renderer.stop();
    renderer = null;
    (_a = document.getElementById("sidebarTouchArea")) == null ? void 0 : _a.remove();
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
    _ensureSubscribed();
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
  function _rebuildRowIndex(root) {
    _rowIndex = [];
    function walk(box) {
      var _a;
      for (const child of box.children) {
        if (!child.visible || child.disabled) continue;
        if (child.interactive && ((_a = child.gesture) == null ? void 0 : _a.onTap)) {
          _rowIndex.push(child);
        }
        walk(child);
      }
    }
    walk(root);
    _rowIndex.sort((a, b) => {
      return a.getAbsolutePosition().y - b.getAbsolutePosition().y;
    });
  }
  function _getCursorRowIndex() {
    if (!cursorRowId || _rowIndex.length === 0) return -1;
    return _rowIndex.findIndex((box) => box.id === cursorRowId);
  }
  function _moveCursorBySteps(steps) {
    if (_rowIndex.length === 0) return;
    const oldIdx = _getCursorRowIndex();
    const newIdx = Math.max(0, Math.min(_rowIndex.length - 1, oldIdx + steps));
    if (newIdx !== oldIdx && _rowIndex[newIdx]) {
      moveCursorTo(_rowIndex[newIdx]);
    }
  }
  function _isCursorMode() {
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (!root) return false;
    return root.getMaxScroll().maxY <= 0;
  }
  function _getCenterRowIndex() {
    var _a, _b, _c;
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (!root || _rowIndex.length === 0) return -1;
    const canvasH = ((_b = (_a = document.getElementById("tree-canvas")) == null ? void 0 : _a.clientHeight) != null ? _b : 0) || 618;
    const scrollY = (_c = root.scrollY) != null ? _c : 0;
    const centerY = scrollY + canvasH / 2;
    let closestIdx = -1;
    let closestDist = Infinity;
    for (let i = 0; i < _rowIndex.length; i++) {
      try {
        if (!_rowIndex[i]) continue;
        const abs = _rowIndex[i].getAbsolutePosition();
        const rowCenter = abs.y + _rowIndex[i].height / 2;
        const dist = Math.abs(rowCenter - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      } catch {
      }
    }
    return closestIdx;
  }
  function _snapCursorToCenter() {
    if (_animBusy) return;
    const idx = _getCenterRowIndex();
    if (idx >= 0 && _rowIndex[idx] && _rowIndex[idx].id !== cursorRowId) {
      console.log("[snapCursorToCenter] snapping from", cursorRowId, "to", _rowIndex[idx].id, "centerIdx=", idx);
      moveCursorTo(_rowIndex[idx]);
    }
  }
  function _scrollToCenterCursor() {
    var _a;
    if (_isCursorMode()) return;
    const root = renderer == null ? void 0 : renderer.getRoot();
    if (!root || cursorRowId === null) return;
    const canvas = document.getElementById("tree-canvas");
    const canvasH = (_a = canvas == null ? void 0 : canvas.clientHeight) != null ? _a : 618;
    const maxY = root.getMaxScroll().maxY;
    const idx = _getCursorRowIndex();
    if (idx < 0 || !_rowIndex[idx]) return;
    try {
      const abs = _rowIndex[idx].getAbsolutePosition();
      const targetScrollY = Math.max(0, Math.min(maxY, abs.y + _rowIndex[idx].height / 2 - canvasH / 2));
      gsapWithCSS.to(root, {
        scrollY: targetScrollY,
        duration: 0.35,
        ease: "power2.inOut",
        overwrite: "auto",
        onUpdate: function() {
          renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
        }
      });
    } catch {
    }
  }
  function _createSidebarTouchArea() {
    const old = document.getElementById("sidebarTouchArea");
    if (old) old.remove();
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const box = document.createElement("div");
    box.id = "sidebarTouchArea";
    const w = sidebar.getBoundingClientRect().width;
    box.style.cssText = `position:fixed;top:0;bottom:0;right:0;z-index:999;touch-action:none;left:${w}px;`;
    document.body.appendChild(box);
    bindScrollEvents(box);
    box.addEventListener("click", () => {
      var _a, _b;
      if (!cursorRowId || _rowIndex.length === 0) return;
      const idx = _getCursorRowIndex();
      if (idx < 0 || !_rowIndex[idx]) return;
      const hit = _rowIndex[idx];
      const hitData = hit.data || {};
      if (hitData.isDir) {
        if (hitData.isExpanded) {
          doCollapse(hit, hitData);
        } else {
          doExpand(hit, hitData);
        }
      } else {
        (_b = (_a = hit.gesture) == null ? void 0 : _a.onTap) == null ? void 0 : _b.call(_a);
      }
    });
    let sx = 0;
    box.addEventListener("touchstart", (e) => {
      sx = e.touches[0].clientX;
    }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (sx - e.changedTouches[0].clientX > 60) closeSidebar();
    });
  }
  function bindScrollEvents(canvas) {
    let _touchIsCursor = false;
    let wheelTarget = 0;
    let wheelRaf = 0;
    let cursorWheelAccum = 0;
    let cursorWheelDecayRaf = 0;
    canvas.addEventListener("wheel", (e) => {
      var _a;
      e.preventDefault();
      if (_isCursorMode()) {
        cursorWheelAccum += e.deltaY / LINE_HEIGHT;
        const steps = Math.trunc(cursorWheelAccum);
        if (steps !== 0) {
          _moveCursorBySteps(-steps);
          cursorWheelAccum -= steps;
        }
        if (!cursorWheelDecayRaf) {
          cursorWheelDecayRaf = requestAnimationFrame(function decay() {
            cursorWheelAccum *= 0.85;
            const s = Math.trunc(cursorWheelAccum);
            if (s !== 0) {
              _moveCursorBySteps(-s);
              cursorWheelAccum -= s;
            }
            if (Math.abs(cursorWheelAccum) < 0.05) {
              cursorWheelAccum = 0;
              cursorWheelDecayRaf = 0;
              return;
            }
            cursorWheelDecayRaf = requestAnimationFrame(decay);
          });
        }
        return;
      }
      const cur = (_a = getRootScrollY()) != null ? _a : 0;
      wheelTarget = cur + e.deltaY;
      if (!wheelRaf) {
        let wheelAccum = 0;
        const wheelCenterIdx = _getCenterRowIndex();
        wheelRaf = requestAnimationFrame(function smoothWheel() {
          var _a2, _b, _c;
          const cur2 = (_a2 = getRootScrollY()) != null ? _a2 : 0;
          const diff = wheelTarget - cur2;
          if (Math.abs(diff) < 0.5) {
            setRootScrollY(wheelTarget);
            _snapCursorToCenter();
            wheelRaf = 0;
            return;
          }
          const maxY = (_c = (_b = renderer == null ? void 0 : renderer.getRoot()) == null ? void 0 : _b.getMaxScroll().maxY) != null ? _c : 0;
          const desired = cur2 + diff * 0.25;
          if (desired < 0 && maxY > 0) {
            setRootScrollY(0);
            wheelAccum += -desired;
            const steps = Math.floor(wheelAccum / LINE_HEIGHT);
            if (steps > 0) {
              wheelAccum -= steps * LINE_HEIGHT;
              const targetIdx = Math.max(0, wheelCenterIdx - steps);
              if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
            }
          } else if (desired > maxY) {
            setRootScrollY(maxY);
            wheelAccum += desired - maxY;
            const steps = Math.floor(wheelAccum / LINE_HEIGHT);
            if (steps > 0) {
              wheelAccum -= steps * LINE_HEIGHT;
              const targetIdx = Math.min(_rowIndex.length - 1, wheelCenterIdx + steps);
              if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
            }
          } else {
            setRootScrollY(desired);
            _snapCursorToCenter();
          }
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
    let _boundPen = 0;
    let _boundIsTop = false;
    let cursorTouchBase = 0;
    let cursorTouchStartY = 0;
    let cursorLastTouchY = 0;
    let cursorLastTouchTime = 0;
    let cursorVelocity = 0;
    let cursorFlingRaf = 0;
    canvas.addEventListener("touchstart", (e) => {
      var _a, _b;
      const y = e.touches[0].clientY;
      lastTouchY = y;
      lastTouchTime = performance.now();
      if (flingRaf) {
        cancelAnimationFrame(flingRaf);
        flingRaf = 0;
      }
      if (cursorFlingRaf) {
        cancelAnimationFrame(cursorFlingRaf);
        cursorFlingRaf = 0;
      }
      _touchIsCursor = _isCursorMode();
      console.log("[touchstart] _touchIsCursor=", _touchIsCursor, " _isCursorMode()=", _isCursorMode());
      if (_touchIsCursor) {
        cursorTouchBase = Math.max(0, _getCursorRowIndex());
        cursorTouchStartY = y;
        cursorLastTouchY = y;
        cursorLastTouchTime = lastTouchTime;
        cursorVelocity = 0;
      } else {
        touchStartY2 = y;
        touchScrollY = (_a = getRootScrollY()) != null ? _a : 0;
        velocity = 0;
        _boundPen = 0;
        _boundIsTop = false;
        const root2 = renderer == null ? void 0 : renderer.getRoot();
        if (root2 && !_isCursorMode()) {
          const maxY2 = (_b = root2.getMaxScroll().maxY) != null ? _b : 0;
          const centerIdx = _getCenterRowIndex();
          const cursorIdx = _getCursorRowIndex();
          if (touchScrollY <= 0 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx < centerIdx) {
            _boundPen = (centerIdx - cursorIdx) * LINE_HEIGHT;
            _boundIsTop = true;
          } else if (touchScrollY >= maxY2 && centerIdx >= 0 && cursorIdx >= 0 && cursorIdx > centerIdx) {
            _boundPen = (cursorIdx - centerIdx) * LINE_HEIGHT;
            _boundIsTop = false;
          }
        }
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      var _a;
      const y = e.touches[0].clientY;
      const now = performance.now();
      if (_touchIsCursor) {
        const dy2 = cursorTouchStartY - y;
        const dt2 = now - cursorLastTouchTime;
        if (dt2 > 0) {
          cursorVelocity = (cursorLastTouchY - y) / dt2 * 16 * 1.7;
        }
        cursorLastTouchY = y;
        cursorLastTouchTime = now;
        const stepOffset = dy2 / LINE_HEIGHT;
        const idx = Math.round(
          Math.max(0, Math.min(_rowIndex.length - 1, cursorTouchBase + stepOffset))
        );
        if (_rowIndex[idx]) moveCursorTo(_rowIndex[idx]);
        return;
      }
      const dy = touchStartY2 - y;
      const dt = now - lastTouchTime;
      if (dt > 0) {
        velocity = (lastTouchY - y) / dt * 16 * 1.7;
      }
      const dPen = lastTouchY - y;
      lastTouchY = y;
      lastTouchTime = now;
      const root3 = renderer == null ? void 0 : renderer.getRoot();
      const maxY = (_a = root3 == null ? void 0 : root3.getMaxScroll().maxY) != null ? _a : 0;
      if (_boundPen > 0) {
        _boundPen = Math.max(0, _boundPen + (_boundIsTop ? -dPen : dPen));
        if (_boundPen === 0) {
          touchScrollY = _boundIsTop ? 0 : maxY;
          touchStartY2 = y;
          setRootScrollY(touchScrollY);
          _snapCursorToCenter();
        } else {
          setRootScrollY(_boundIsTop ? 0 : maxY);
          const steps = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex();
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = _boundIsTop ? Math.max(0, centerIdx - steps) : Math.min(_rowIndex.length - 1, centerIdx + steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          } else {
            _snapCursorToCenter();
          }
        }
      } else {
        const desired = touchScrollY + dy;
        if (desired < 0 && maxY > 0) {
          _boundPen = -desired;
          _boundIsTop = true;
          setRootScrollY(0);
          const steps = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex();
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.max(0, centerIdx - steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else if (desired > maxY) {
          _boundPen = desired - maxY;
          _boundIsTop = false;
          setRootScrollY(maxY);
          const steps = Math.floor(_boundPen / LINE_HEIGHT);
          const centerIdx = _getCenterRowIndex();
          if (centerIdx >= 0 && steps > 0) {
            const targetIdx = Math.min(_rowIndex.length - 1, centerIdx + steps);
            if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
          }
        } else {
          setRootScrollY(desired);
          _snapCursorToCenter();
        }
      }
    }, { passive: true });
    canvas.addEventListener("touchend", () => {
      var _a, _b;
      if (_touchIsCursor) {
        if (Math.abs(cursorVelocity) >= 0.5 && _rowIndex.length > 0) {
          let cursorFling2 = function() {
            cursorVelocity *= 0.96;
            if (Math.abs(cursorVelocity) < 0.3) {
              cursorFlingRaf = 0;
              return;
            }
            cursorTouchBase += cursorVelocity / LINE_HEIGHT;
            const idx = Math.round(
              Math.max(0, Math.min(_rowIndex.length - 1, cursorTouchBase))
            );
            if (_rowIndex[idx]) moveCursorTo(_rowIndex[idx]);
            cursorFlingRaf = requestAnimationFrame(cursorFling2);
          };
          var cursorFling = cursorFling2;
          cursorTouchBase = Math.max(0, _getCursorRowIndex());
          cursorFlingRaf = requestAnimationFrame(cursorFling2);
        }
        return;
      }
      if (Math.abs(velocity) < 0.5) return;
      let flingPen = _boundPen;
      let flingIsTop = _boundIsTop;
      const flingMaxY = (_b = (_a = renderer == null ? void 0 : renderer.getRoot()) == null ? void 0 : _a.getMaxScroll().maxY) != null ? _b : 0;
      function fling() {
        var _a2;
        velocity *= 0.96;
        if (Math.abs(velocity) < 0.3) {
          flingRaf = 0;
          return;
        }
        if (flingPen > 0) {
          flingPen = Math.max(0, flingPen + (flingIsTop ? -velocity : velocity));
          if (flingPen === 0) {
            setRootScrollY(flingIsTop ? 0 : flingMaxY);
            _snapCursorToCenter();
          } else {
            setRootScrollY(flingIsTop ? 0 : flingMaxY);
            const steps = Math.floor(flingPen / LINE_HEIGHT);
            const centerIdx = _getCenterRowIndex();
            if (centerIdx >= 0 && steps > 0) {
              const targetIdx = flingIsTop ? Math.max(0, centerIdx - steps) : Math.min(_rowIndex.length - 1, centerIdx + steps);
              if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
            }
          }
        } else {
          const cur = (_a2 = getRootScrollY()) != null ? _a2 : 0;
          const desired = cur + velocity;
          if (desired < 0 && flingMaxY > 0) {
            flingPen = -desired;
            flingIsTop = true;
            setRootScrollY(0);
            const centerIdx = _getCenterRowIndex();
            const steps = Math.floor(flingPen / LINE_HEIGHT);
            if (centerIdx >= 0 && steps > 0) {
              const targetIdx = Math.max(0, centerIdx - steps);
              if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
            }
          } else if (desired > flingMaxY) {
            flingPen = desired - flingMaxY;
            flingIsTop = false;
            setRootScrollY(flingMaxY);
            const centerIdx = _getCenterRowIndex();
            const steps = Math.floor(flingPen / LINE_HEIGHT);
            if (centerIdx >= 0 && steps > 0) {
              const targetIdx = Math.min(_rowIndex.length - 1, centerIdx + steps);
              if (_rowIndex[targetIdx]) moveCursorTo(_rowIndex[targetIdx]);
            }
          } else {
            setRootScrollY(desired);
            _snapCursorToCenter();
          }
        }
        flingRaf = requestAnimationFrame(fling);
      }
      flingRaf = requestAnimationFrame(fling);
    }, { passive: true });
  }
  function bindClickEvents(canvas, _dpr) {
    canvas.addEventListener("click", (e) => {
      if (!renderer) return;
      _clickQueue.push({ offsetX: e.offsetX, offsetY: e.offsetY });
      processClickQueue();
    });
  }
  function processClickQueue() {
    var _a, _b;
    if (_clickQueue.length === 0 || !renderer) return;
    if (_animBusy) {
      if (_animBusyAt && Date.now() - _animBusyAt > 3e3) {
        _animBusy = false;
        _animBusyAt = 0;
        _clickQueue = [];
        return;
      }
      gsapWithCSS.globalTimeline.clear();
      _animBusy = false;
      _animBusyAt = 0;
      animatingPath = null;
      rebuildTree();
    }
    const { offsetX, offsetY } = _clickQueue.shift();
    const root = renderer.getRoot();
    if (!root) return;
    const scrollY = (_a = root.scrollY) != null ? _a : 0;
    const px = offsetX;
    const py = offsetY + scrollY;
    for (const child of root.children) {
      if (!child.visible || child.disabled) continue;
      const hit = findTapTarget(child, px, py);
      if ((_b = hit == null ? void 0 : hit.gesture) == null ? void 0 : _b.onTap) {
        if (cursorRowId !== null && cursorRowId === hit.id) {
          const hitData = hit.data || {};
          const isDir = hitData.isDir;
          const isExpanded = hitData.isExpanded;
          if (isDir) {
            if (isExpanded) {
              console.log("[processClickQueue] doCollapse path=", hitData.path);
              doCollapse(hit, hitData);
            } else {
              console.log("[processClickQueue] doExpand path=", hitData.path);
              doExpand(hit, hitData);
            }
            return;
          } else {
            hit.gesture.onTap();
          }
        } else {
          moveCursorTo(hit);
          _scrollToCenterCursor();
        }
        break;
      }
    }
    processClickQueue();
  }
  function doExpand(hit, hitData) {
    var _a;
    animatingPath = hitData.path;
    hit.gesture.onTap();
    _animBusy = true;
    _animBusyAt = Date.now();
    const root = renderer.getRoot();
    const containerId = `expanded-${hitData.path}`;
    const container = findBoxById(root, containerId);
    const titleRow = findBoxById(root, `title-${hitData.path}`);
    const toggle2 = (_a = titleRow == null ? void 0 : titleRow.children) == null ? void 0 : _a.find((c) => {
      var _a2;
      return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
    });
    if (!container) {
      _animBusy = false;
      _animBusyAt = 0;
      processClickQueue();
      return;
    }
    const fullHeight = container._fullHeight || 0;
    if (!fullHeight) {
      const finish = () => {
        _animBusy = false;
        _animBusyAt = 0;
        processClickQueue();
      };
      if (toggle2 && toggle2.transform) {
        let animFrame2 = function() {
          const elapsed = performance.now() - startTime;
          const t = Math.min(elapsed / durationMs, 1);
          const eased = 1 - (1 - t) * (1 - t);
          toggle2.transform.rotate = startRot + (endRot - startRot) * eased;
          if (rend) rend.setRoot(rend.getRoot());
          if (elapsed < durationMs) {
            requestAnimationFrame(animFrame2);
          } else {
            finish();
          }
        };
        var animFrame = animFrame2;
        toggle2.transform.rotate = 0;
        const startTime = performance.now();
        const startRot = 0;
        const endRot = Math.PI / 2;
        const durationMs = 300;
        const rend = renderer;
        requestAnimationFrame(animFrame2);
      } else {
        finish();
      }
      return;
    }
    animatingPath = null;
    const _origYs = container._origYs;
    if (_origYs && container.children.length === _origYs.length) {
      container.children.forEach((c, j) => {
        c.y = _origYs[j];
      });
    }
    container.children.forEach((c) => {
      c.opacity = 1;
    });
    const ancestors = collectAncestors(container, root);
    animateCharRain(container, root, renderer);
    gsapWithCSS.to(container, {
      height: fullHeight,
      duration: 0.05,
      ease: "back.out(1.15)",
      onUpdate: function() {
        applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
        renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
      },
      onComplete: () => {
        if (container.kfmStyle && container._savedCr !== void 0) {
          container.kfmStyle.cornerRadius = container._savedCr;
        }
        slideInRows(container, root, toggle2).then(() => {
          fixExpandedToggles(container);
          renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
        }).finally(() => {
          _animBusy = false;
          _animBusyAt = 0;
          const _root = renderer == null ? void 0 : renderer.getRoot();
          if (_root) {
            _rebuildRowIndex(_root);
          }
          if (cursorRowId) {
            const _t = findBoxById(_root, cursorRowId);
            if (_t) moveCursorTo(_t, false);
          }
          processClickQueue();
        });
      }
    });
    applyAnimOffsetSiblings(container, fullHeight, ancestors, root);
    renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
  }
  function doCollapse(hit, hitData) {
    animatingPath = hitData.path;
    const tog = hit.children.find((c) => {
      var _a;
      return (_a = c.id) == null ? void 0 : _a.startsWith("toggle-");
    });
    const containerId = `expanded-${hitData.path}`;
    const root = renderer.getRoot();
    const container = findBoxById(root, containerId);
    _animBusy = true;
    _animBusyAt = Date.now();
    const tl = gsapWithCSS.timeline({
      onComplete: () => {
        _animBusy = false;
        _animBusyAt = 0;
        hit.gesture.onTap();
        processClickQueue();
      }
    });
    if (tog) {
      tl.to(tog.transform, {
        rotate: 0,
        duration: 0.25,
        ease: "power2.in",
        onUpdate: () => {
          if (renderer) renderer.setRoot(renderer.getRoot());
        }
      }, 0);
    }
    if (container) {
      const fullH = container.height;
      const root2 = renderer.getRoot();
      const origYs = container.children.map((c) => c.y);
      const ancestors = collectAncestors(container, root2);
      tl.to(container, {
        height: 0,
        duration: 0.3,
        ease: "power2.in",
        onUpdate: function() {
          applyAnimOffset(container, origYs, fullH, ancestors, root2);
          renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
        }
      }, 0);
    }
    tl.play();
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    if (!renderer) return;
    if (_animBusy) {
      if (_animBusyAt && Date.now() - _animBusyAt > 3e3) {
        _animBusy = false;
        _animBusyAt = 0;
        _clickQueue = [];
      } else {
        return;
      }
    }
    const prevScrollY = (_b = (_a = renderer.getRoot()) == null ? void 0 : _a.scrollY) != null ? _b : 0;
    const prevCursorRowId = cursorRowId;
    const prevCursorX = (_c = cursorBox == null ? void 0 : cursorBox.x) != null ? _c : -1;
    const prevCursorY = (_d = cursorBox == null ? void 0 : cursorBox.y) != null ? _d : -1;
    const prevCursorW = (_e = cursorBox == null ? void 0 : cursorBox.width) != null ? _e : -1;
    const prevCursorH = (_f = cursorBox == null ? void 0 : cursorBox.height) != null ? _f : -1;
    const prevCursorTopLine = (_h = (_g = cursorBox == null ? void 0 : cursorBox.data) == null ? void 0 : _g.topLineW) != null ? _h : -1;
    const prevCursorBotLine = (_j = (_i = cursorBox == null ? void 0 : cursorBox.data) == null ? void 0 : _i.botLineW) != null ? _j : -1;
    cursorBox = null;
    cursorRowId = null;
    const canvas = document.getElementById("tree-canvas");
    const cw = ((_k = canvas == null ? void 0 : canvas.clientWidth) != null ? _k : 0) || 295;
    const rightMargin = cw - 8;
    const rootBox = buildSidebarTree(cw, rightMargin);
    if (canvas) rootBox.width = cw;
    const canvasH = ((_l = canvas == null ? void 0 : canvas.clientHeight) != null ? _l : 0) || 618;
    if (canvas) {
      rootBox.height = canvasH;
    }
    if (animatingPath) {
      const titleRow = findBoxById(rootBox, `title-${animatingPath}`);
      const toggle = (_m = titleRow == null ? void 0 : titleRow.children) == null ? void 0 : _m.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
      });
      if (toggle) {
        toggle.transform.rotate = 0;
      }
    }
    function collapseSubs(box) {
      var _a2, _b2;
      if (!box || !box.children) return;
      for (const child of box.children) {
        if (((_a2 = child.id) == null ? void 0 : _a2.startsWith("expanded-")) && child.height > 0) {
          if (animatingPath && child.id === `expanded-${animatingPath}`) continue;
          const subFullH = child.height;
          child._fullHeight = subFullH;
          child._origYs = child.children.map((c) => c.y);
          child.height = 0;
          if (child.kfmStyle) {
            child._savedCr = child.kfmStyle.cornerRadius;
            child.kfmStyle.cornerRadius = 0;
          }
          for (const c of child.children) {
            c.y = c.y - subFullH;
          }
          const subPath = child.id.slice("expanded-".length);
          const subTitle = findBoxById(rootBox, "title-" + subPath);
          const subTog = (_b2 = subTitle == null ? void 0 : subTitle.children) == null ? void 0 : _b2.find((c) => {
            var _a3;
            return (_a3 = c.id) == null ? void 0 : _a3.startsWith("toggle-");
          });
          if (subTog) {
            child._toggleBox = subTog;
            child._toggleRotate = subTog.transform.rotate;
          }
          collapseSubs(child);
        }
      }
    }
    if (animatingPath) {
      const preContainer = findBoxById(rootBox, `expanded-${animatingPath}`);
      if (preContainer) {
        const preFullH = preContainer.height;
        preContainer._fullHeight = preFullH;
        preContainer._origYs = preContainer.children.map((c) => c.y);
        preContainer.height = 0;
        if (preContainer.kfmStyle) {
          preContainer._savedCr = preContainer.kfmStyle.cornerRadius;
          preContainer.kfmStyle.cornerRadius = 0;
        }
        for (const child of preContainer.children) {
          child.y = child.y - preFullH;
          child.opacity = 0;
        }
        collapseSubs(preContainer);
      }
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
          if (animatingPath && prevCursorY >= 0) {
            cursorBox.x = prevCursorX;
            cursorBox.y = prevCursorY;
            cursorBox.width = prevCursorW;
            if (prevCursorH >= 0) {
              cursorBox.height = prevCursorH;
            }
            if (prevCursorTopLine >= 0) {
              cursorBox.data.topLineW = prevCursorTopLine;
            }
            if (prevCursorBotLine >= 0) {
              cursorBox.data.botLineW = prevCursorBotLine;
            }
            cursorRowId = prevCursorRowId;
          } else {
            moveCursorTo(target);
          }
        } else {
          snapToCenterRow(newRoot, canvasH);
        }
      } else {
      }
    }
    _rebuildRowIndex(newRoot);
    if (!renderer.isRunning) {
      renderer.start();
    }
    animatingPath = null;
    const diagRoot = renderer == null ? void 0 : renderer.getRoot();
    const diagCS = diagRoot == null ? void 0 : diagRoot.getContentSize();
    console.log(
      "[rebuildTree] _isCursorMode=",
      _isCursorMode(),
      " scrollY=",
      diagRoot == null ? void 0 : diagRoot.scrollY,
      " contentH=",
      diagCS == null ? void 0 : diagCS.height,
      " viewportH=",
      (diagRoot == null ? void 0 : diagRoot.height) || 0,
      " maxY=",
      diagRoot == null ? void 0 : diagRoot.getMaxScroll().maxY,
      " _rowIndexLen=",
      _rowIndex.length,
      " cursorRowId=",
      cursorRowId,
      " cursorIdx=",
      _getCursorRowIndex(),
      " prevCursorRowId=",
      prevCursorRowId,
      " animatingPath=",
      animatingPath
    );
  }
  function findBoxById(root, id) {
    for (const child of root.children) {
      if (child.id === id) return child;
      const found = findBoxById(child, id);
      if (found) return found;
    }
    return null;
  }
  function collectAncestors(box, root) {
    const ancestors = [];
    let current = box;
    while (current.parent) {
      const p = current.parent;
      const idx = p.children.indexOf(current);
      if (idx < 0) break;
      const sibOrigYs = [];
      for (let i = idx + 1; i < p.children.length; i++) {
        sibOrigYs.push(p.children[i].y);
      }
      ancestors.push({ parent: p, sibIdx: idx, sibOrigYs, origHeight: p.height });
      if (p === root) break;
      current = p;
    }
    return ancestors;
  }
  function applyAnimOffset(container, containerOrigYs, fullHeight, ancestors, root) {
    const offset = container.height - fullHeight;
    for (let i = 0; i < container.children.length; i++) {
      container.children[i].y = containerOrigYs[i] + offset;
    }
    let heightDelta = offset;
    for (const anc of ancestors) {
      for (let i = anc.sibIdx + 1; i < anc.parent.children.length; i++) {
        const sib = anc.parent.children[i];
        if (sib.id === "cursor-highlight") continue;
        sib.y = anc.sibOrigYs[i - anc.sibIdx - 1] + heightDelta;
      }
      if (anc.parent !== root) {
        anc.parent.height = anc.origHeight + heightDelta;
      }
    }
  }
  function applyAnimOffsetSiblings(container, fullHeight, ancestors, root) {
    const offset = container.height - fullHeight;
    let heightDelta = offset;
    for (const anc of ancestors) {
      for (let i = anc.sibIdx + 1; i < anc.parent.children.length; i++) {
        const sib = anc.parent.children[i];
        if (sib.id === "cursor-highlight") continue;
        sib.y = anc.sibOrigYs[i - anc.sibIdx - 1] + heightDelta;
      }
      if (anc.parent !== root) {
        anc.parent.height = anc.origHeight + heightDelta;
      }
    }
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
  async function slideInRows(container, root, selfToggle) {
    if (selfToggle) {
      gsapWithCSS.fromTo(selfToggle.transform, { rotate: 0 }, {
        rotate: Math.PI / 2,
        duration: 0.15,
        ease: "power2.out",
        onUpdate: () => {
          renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
        }
      });
    }
    const subContainers = container.children.filter(
      (c) => {
        var _a;
        return ((_a = c.id) == null ? void 0 : _a.startsWith("expanded-")) && c._fullHeight > 0;
      }
    );
    async function expandNext(idx) {
      var _a, _b;
      if (idx >= subContainers.length) return;
      const child = subContainers[idx];
      const subFullH = child._fullHeight;
      const subOrigYs = child._origYs;
      if (subOrigYs && child.children.length === subOrigYs.length) {
        child.children.forEach((c, j) => {
          c.y = subOrigYs[j];
        });
      }
      child.children.forEach((c) => {
        c.opacity = 1;
      });
      const subTog = child._toggleBox;
      const subTogRotate = (_a = child._toggleRotate) != null ? _a : Math.PI / 2;
      const freshTitle = findBoxById(root, `title-${child.id.slice("expanded-".length)}`);
      const freshTog = (_b = freshTitle == null ? void 0 : freshTitle.children) == null ? void 0 : _b.find((c) => {
        var _a2;
        return (_a2 = c.id) == null ? void 0 : _a2.startsWith("toggle-");
      });
      if (freshTog) {
        gsapWithCSS.killTweensOf(freshTog.transform);
        freshTog.transform.rotate = subTogRotate;
      }
      const subRainPromise = animateCharRain(child, root, renderer);
      await new Promise((resolve) => {
        gsapWithCSS.to(child, {
          height: subFullH,
          duration: 0.05,
          ease: "back.out(1.15)",
          onUpdate: () => {
            renderer == null ? void 0 : renderer.setRoot(renderer.getRoot());
          },
          onComplete: resolve
        });
      });
      if (child.kfmStyle && child._savedCr !== void 0) {
        child.kfmStyle.cornerRadius = child._savedCr;
      }
      await slideInRows(child, root);
      await expandNext(idx + 1);
    }
    await expandNext(0);
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
      var _a, _b;
      if (e.target.closest(".light-orb")) return;
      if (!touchStarted) return;
      const dx = e.touches[0].clientX - touchStartX;
      if ((_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.contains("open")) {
        if (dx < -60) {
          closeSidebar();
          touchStarted = false;
          return;
        }
        return;
      }
      if (!((_b = document.getElementById("sidebar")) == null ? void 0 : _b.classList.contains("open")) && dx > 60) {
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
    background: linear-gradient(rgba(20,16,32,0.92),rgba(20,16,32,0.92)) padding-box, linear-gradient(135deg,#7c3aed,rgba(0,212,255,.8)) border-box;
    backdrop-filter: blur(16px);
    border: 1px solid transparent;
    border-left-width: 3px;
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
      const bgColor = isUser ? "linear-gradient(rgba(10,10,15,.85),rgba(10,10,15,.85)) padding-box,linear-gradient(135deg,#7c3aed,rgba(0,212,255,.8)) border-box" : "rgba(12,20,35,0.85)";
      const borderStyle = isUser ? "border:1px solid transparent;border-left-width:3px;" : "border:1px solid rgba(0,212,255,0.08);border-left:3px solid rgba(0,212,255,0.2);";
      const align = isUser ? "flex-end" : "flex-start";
      const label = isUser ? "\u4F60" : "\u851A\u7136";
      const labelColor = isUser ? "#7c3aed" : "#00d4ff";
      const font = "13px sans-serif";
      const lineHeight = 20;
      try {
        const lines = layoutLines(msg.text, font, innerWidth - 24, lineHeight);
        const textHtml = lines.map((l) => `<span style="display:block">${escapeHtml(l.text)}</span>`).join("");
        html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:#e0e0e0">${textHtml}</div>
          </div>
        </div>`;
      } catch {
        html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:85%;padding:6px 12px;background:${bgColor};${borderStyle}border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-size:13px;color:#e0e0e0">${escapeHtml(msg.text)}</div>
          </div>
        </div>`;
      }
    }
    contentArea.innerHTML = html;
    contentArea.scrollTop = contentArea.scrollHeight;
  }
  function escapeHtml(str) {
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
      panelEl.style.borderColor = "rgba(0, 212, 255, 0.6)";
      panelEl.style.boxShadow = "0 0 30px 8px rgba(0, 212, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.5)";
    }
    updateStateLabel();
  }
  function exitEditMode() {
    if (orbState !== "editing") return;
    orbState = "expanded";
    if (panelEl) {
      panelEl.style.borderColor = "";
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
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function waitForAnimUnlock() {
    if (!isAnimLocked()) return;
    const start = Date.now();
    while (isAnimLocked()) {
      if (Date.now() - start > 3e3) break;
      await sleep(50);
    }
  }
  async function fetchDirRecursive(dirPath, expandedPaths = {}, depth = 20) {
    try {
      let ingestTree2 = function(parentPath, items) {
        const children = items.map((item) => ({
          name: item.name,
          path: item.path,
          isDir: item.isDir,
          isLink: false
        }));
        KFMState.files[parentPath] = {
          name: parentPath.split("/").pop() || parentPath,
          path: parentPath,
          isDir: true,
          isLink: false,
          children
        };
        for (const item of items) {
          if (item.isDir && item.children && item.children.length > 0) {
            ingestTree2(item.path, item.children);
          }
        }
      };
      var ingestTree = ingestTree2;
      const res = await fetch(API2 + "/files/list-recursive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath, depth, expandedPaths })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const tree = data.tree || [];
      if (tree.length === 0) {
        KFMState.files[dirPath] = {
          name: dirPath.split("/").pop() || dirPath,
          path: dirPath,
          isDir: true,
          isLink: false,
          children: []
        };
        return true;
      }
      ingestTree2(dirPath, tree);
      return true;
    } catch {
      return false;
    }
  }
  async function loadAndAnimate(path) {
    markAnimatingPath(path);
    const childExpandedPaths = getChildExpandedPaths(path);
    const loaded = await fetchDirRecursive(path, childExpandedPaths);
    if (!loaded) return;
    KFMState.notify();
    triggerExpandAnimation(path);
  }
  function getChildExpandedPaths(path) {
    const result = {};
    for (const expandedPath of Object.keys(KFMState.expandedPaths)) {
      if (expandedPath.startsWith(path + "/")) {
        result[expandedPath] = true;
      }
    }
    return result;
  }
  async function loadFileTree(rootPath) {
    const allExpandedPaths = { ...KFMState.expandedPaths };
    const loaded = await fetchDirRecursive(rootPath, allExpandedPaths);
    if (!loaded) return;
    markAnimatingPath(rootPath);
    KFMState.notify();
    await waitForAnimUnlock();
    const rootNode = KFMState.files[rootPath];
    if (rootNode == null ? void 0 : rootNode.children) {
      for (const child of rootNode.children) {
        if (child.isDir && KFMState.expandedPaths[child.path]) {
          markAnimatingPath(child.path);
          KFMState.notify();
          await waitForAnimUnlock();
        }
      }
    }
    markAnimatingPath(null);
  }
  function initLazyLoader() {
    const originalSetExpanded = KFMState.setExpanded.bind(KFMState);
    KFMState.setExpanded = function(path, expanded) {
      var _a;
      if (expanded) {
        const cached = ((_a = KFMState.files[path]) == null ? void 0 : _a.children) !== void 0;
        if (!cached) {
          KFMState.expandedPaths[path] = true;
          localStorage.setItem("expandedPaths", JSON.stringify(KFMState.expandedPaths));
          loadAndAnimate(path).catch(console.error);
          return;
        }
      }
      originalSetExpanded(path, expanded);
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
