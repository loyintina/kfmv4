"use strict";
(() => {
  // src/client/modules/app.ts
  var API = "/kfmv4/api";
  var selectedFile = "";
  var expandedPaths = JSON.parse(localStorage.getItem("expandedPaths") || "{}");
  var showHidden = false;
  function setSelectedFile(f) {
    selectedFile = f;
  }
  function setExpandedPaths(p) {
    expandedPaths = p;
  }
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
    window.selectedFile = selectedFile;
    window.expandedPaths = expandedPaths;
    window.showHidden = showHidden;
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
    const aiInput = document.getElementById("aiInput");
    if (aiInput) {
      aiInput.addEventListener("input", () => {
        aiInput.style.height = "auto";
        const newHeight = Math.min(aiInput.scrollHeight, 120);
        aiInput.style.height = newHeight + "px";
      });
    }
  }

  // src/client/modules/tree.ts
  async function loadTree(path = "") {
    let targetPath = path || "/root";
    if (targetPath.startsWith("~")) targetPath = "/root" + (targetPath.length > 1 ? targetPath.slice(1) : "");
    try {
      const res = await fetch(API + "/files/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, showHidden })
      });
      const data = await res.json();
      if (data.error) return [];
      return data.items.map((item) => ({
        name: item.name,
        isDir: item.isDir,
        isLink: false,
        path: item.path
      }));
    } catch (e) {
      console.error("loadTree error:", e);
      return [];
    }
  }
  async function renderTree(container = document.getElementById("fileTree"), path = "", depth = 0) {
    var _a, _b, _c;
    let savedPath = null;
    if (depth === 0) {
      const savedSelected = document.querySelector(".tree-item.selected");
      savedPath = ((_a = savedSelected == null ? void 0 : savedSelected.dataset) == null ? void 0 : _a.path) || null;
      (_b = window.resetCursorHighlight) == null ? void 0 : _b.call(window);
      container.innerHTML = '<div class="loading-pulse"><div class="pulse-row"></div><div class="pulse-row"></div><div class="pulse-row"></div></div>';
    }
    const items = await loadTree(path);
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const div = document.createElement("div");
      div.className = "tree-item";
      div.dataset.path = item.path;
      const row = document.createElement("div");
      row.className = "tree-row";
      const toggle = document.createElement("span");
      toggle.className = "tree-toggle" + (expandedPaths[item.path] ? " expanded" : "");
      if (!item.isDir) toggle.classList.add("hidden");
      const name = document.createElement("span");
      name.className = "tree-name" + (item.isLink ? " link" : "");
      name.textContent = item.name + (item.isLink ? " \u2192" : "");
      row.append(toggle, name);
      div.appendChild(row);
      const wrap = document.createElement("div");
      wrap.className = "tree-children-wrap";
      const maxDepth = 6;
      const depthRatio = Math.min(depth / maxDepth, 1);
      const opacity = 0.15 + depthRatio * 0.85;
      wrap.style.borderColor = `rgba(124,58,237,${opacity})`;
      const inner = document.createElement("div");
      const bgTop = `rgba(124,58,237,${0.01 + depthRatio * 0.1})`;
      const bgBot = `rgba(124,58,237,${0.06 + depthRatio * 0.25})`;
      inner.style.background = `linear-gradient(to bottom,${bgTop},${bgBot})`;
      const childrenWrap = document.createElement("div");
      if (expandedPaths[item.path]) {
        wrap.classList.add("open");
        toggle.classList.add("expanded");
      }
      wrap.appendChild(inner);
      inner.appendChild(childrenWrap);
      div.appendChild(wrap);
      frag.appendChild(div);
      if (expandedPaths[item.path] && item.isDir) renderTree(childrenWrap, item.path, depth + 1);
      row.addEventListener("click", async (e) => {
        var _a2, _b2, _c2, _d, _e;
        const isCurrentlySelected = div.classList.contains("selected");
        if (isCurrentlySelected) {
          if (item.isDir) {
            const isOpen = wrap.classList.contains("open");
            if (!isOpen && !childrenWrap.querySelector(".tree-item")) {
              await renderTree(childrenWrap, item.path, depth + 1);
            }
            wrap.classList.toggle("open");
            toggle.classList.toggle("expanded");
            const newPaths = { ...expandedPaths };
            newPaths[item.path] = !isOpen;
            setExpandedPaths(newPaths);
            localStorage.setItem("expandedPaths", JSON.stringify(newPaths));
            const doBounce = (el, dir, delay) => {
              setTimeout(() => {
                const offset = dir ? -10 : 10;
                const rebound = dir ? 2 : -2;
                el.style.transition = "transform .3s cubic-bezier(.34,1.56,.64,1)";
                el.style.transform = `translateY(${offset}px)`;
                setTimeout(() => {
                  el.style.transform = `translateY(${rebound}px)`;
                }, 320);
                setTimeout(() => {
                  el.style.transform = "";
                  el.style.transition = "";
                }, 450);
              }, delay);
            };
            if (isOpen) {
              doBounce(div, true, 0);
              let sibling = div.nextElementSibling;
              let i = 1;
              while (sibling) {
                if (sibling.classList.contains("tree-item")) {
                  doBounce(sibling, true, (i - 1) * 20);
                  i++;
                }
                sibling = sibling.nextElementSibling;
              }
            } else {
              doBounce(div, false, 0);
              let sibling = div.nextElementSibling;
              let i = 1;
              while (sibling) {
                if (sibling.classList.contains("tree-item")) {
                  doBounce(sibling, false, (i - 1) * 20);
                  i++;
                }
                sibling = sibling.nextElementSibling;
              }
            }
            let sc = 0;
            {
              let s = div.nextElementSibling;
              while (s) {
                if (s.classList.contains("tree-item")) sc++;
                s = s.nextElementSibling;
              }
            }
            (_a2 = window.syncCursorDuringBounce) == null ? void 0 : _a2.call(window, sc);
          }
        } else {
          const prevSelected = document.querySelector(".tree-item.selected");
          if (prevSelected) prevSelected.classList.remove("selected");
          div.classList.add("selected");
          setSelectedFile(item.path);
          window.selectedFile = item.path;
          (_b2 = window.updateCursorHighlight) == null ? void 0 : _b2.call(window);
          (_c2 = window.updateSidebarPath) == null ? void 0 : _c2.call(window, div);
          if (!((_d = window.isInConstraintZone) == null ? void 0 : _d.call(window, div))) {
            (_e = window.scrollIntoConstraintZone) == null ? void 0 : _e.call(window, div);
          }
        }
        e.stopPropagation();
      });
    }
    container.appendChild(frag);
    if (depth === 0 && savedPath) {
      const newItem = document.querySelector(`.tree-item[data-path="${savedPath}"]`);
      if (newItem) {
        newItem.classList.add("selected");
        (_c = window.updateCursorHighlight) == null ? void 0 : _c.call(window, true);
      }
    }
  }
  function refreshTree() {
    renderTree();
  }
  function toggleHidden() {
    var _a;
    const v = !showHidden;
    window.showHidden = v;
    setShowHidden(v);
    (_a = document.getElementById("toggleHiddenBtn")) == null ? void 0 : _a.classList.toggle("active", v);
    renderTree();
  }
  function initTree() {
    window.renderTree = renderTree;
    window.refreshTree = refreshTree;
    window.toggleHidden = toggleHidden;
    renderTree();
    setInterval(() => {
    }, 3e4);
  }

  // src/client/modules/ui.ts
  var CURSOR_POS_KEY = "kfm_cursor_position";
  var cursorHighlight = null;
  var CONSTRAINT_HEIGHT = 96;
  var SCROLL_THROTTLE = 50;
  var BOUNDARY_STEP_THRESHOLD = 30;
  var lastScrollCheck = 0;
  var boundaryAccum = 0;
  function resetCursorHighlight() {
    cursorHighlight = null;
  }
  function initCursorHighlight() {
    if (cursorHighlight && !document.body.contains(cursorHighlight)) cursorHighlight = null;
    if (cursorHighlight) return;
    const container = document.querySelector(".sidebar-content");
    if (!container) return;
    cursorHighlight = document.createElement("div");
    cursorHighlight.className = "cursor-highlight";
    cursorHighlight.style.top = "0px";
    container.appendChild(cursorHighlight);
  }
  function updateCursorHighlight(immediate = false) {
    if (!cursorHighlight) initCursorHighlight();
    if (!cursorHighlight) return;
    const selected = document.querySelector(".tree-item.selected");
    if (!selected) {
      cursorHighlight.style.opacity = "0";
      updateSidebarPath(null);
      return;
    }
    const row = selected.querySelector(".tree-row") || selected;
    const container = document.querySelector(".sidebar-content");
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = rowRect.top - containerRect.top + container.scrollTop;
    const left = rowRect.left - containerRect.left;
    const width = rowRect.width;
    const trans = "top .3s cubic-bezier(.25,.46,.45,.94),left .3s cubic-bezier(.25,.46,.45,.94),width .3s cubic-bezier(.25,.46,.45,.94)";
    cursorHighlight.style.transition = immediate ? "none" : trans;
    cursorHighlight.style.top = top + "px";
    cursorHighlight.style.left = left + "px";
    cursorHighlight.style.width = width + "px";
    cursorHighlight.style.opacity = "1";
    cursorHighlight.style.height = rowRect.height + "px";
    updateSidebarPath(selected);
    if (immediate) {
      requestAnimationFrame(() => {
        if (cursorHighlight) cursorHighlight.style.transition = trans;
      });
    }
  }
  function updateSidebarPath(item) {
    const pathEl = document.getElementById("sidebarPath");
    if (!pathEl) return;
    if (!item) {
      pathEl.textContent = "-";
      pathEl.title = "";
      return;
    }
    const nameEl = item.querySelector(".tree-name");
    const name = nameEl ? nameEl.textContent : "-";
    pathEl.textContent = name;
    pathEl.title = name || "";
  }
  function syncCursorDuringBounce(siblingCount = 0) {
    if (!cursorHighlight) initCursorHighlight();
    if (!cursorHighlight) return;
    cursorHighlight.style.transition = "none";
    const totalMs = Math.max(500, (siblingCount > 0 ? (siblingCount - 1) * 20 : 0) + 550);
    const maxFrames = Math.ceil(totalMs / 16.67);
    let frame = 0;
    const sync = () => {
      if (frame >= maxFrames) {
        requestAnimationFrame(() => {
          const sel2 = document.querySelector(".tree-item.selected");
          if (sel2 && cursorHighlight) {
            sel2.style.transform = "";
            sel2.style.transition = "";
            const row = sel2.querySelector(".tree-row") || sel2;
            const container = document.querySelector(".sidebar-content");
            const cr = container.getBoundingClientRect();
            const rr = row.getBoundingClientRect();
            cursorHighlight.style.top = rr.top - cr.top + container.scrollTop + "px";
            cursorHighlight.style.left = rr.left - cr.left + "px";
            cursorHighlight.style.width = rr.width + "px";
            cursorHighlight.style.height = rr.height + "px";
          }
          requestAnimationFrame(() => {
            if (cursorHighlight) cursorHighlight.style.transition = "top .3s cubic-bezier(.25,.46,.45,.94),left .3s cubic-bezier(.25,.46,.45,.94),width .3s cubic-bezier(.25,.46,.45,.94)";
          });
        });
        return;
      }
      const sel = document.querySelector(".tree-item.selected");
      if (sel && cursorHighlight) {
        const row = sel.querySelector(".tree-row") || sel;
        const container = document.querySelector(".sidebar-content");
        const cr = container.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        cursorHighlight.style.top = rr.top - cr.top + container.scrollTop + "px";
        cursorHighlight.style.left = rr.left - cr.left + "px";
        cursorHighlight.style.width = rr.width + "px";
        cursorHighlight.style.height = rr.height + "px";
        cursorHighlight.style.opacity = "1";
      }
      frame++;
      requestAnimationFrame(sync);
    };
    sync();
  }
  function openSidebar() {
    var _a, _b;
    (_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.add("open");
    (_b = document.getElementById("overlay")) == null ? void 0 : _b.classList.add("show");
    setTimeout(() => {
      initCursorHighlight();
      restoreCursorPosition();
    }, 100);
  }
  function closeSidebar() {
    var _a, _b;
    saveCursorPosition();
    (_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.remove("open");
    (_b = document.getElementById("overlay")) == null ? void 0 : _b.classList.remove("show");
  }
  function saveCursorPosition() {
    const selected = document.querySelector(".tree-item.selected");
    if (selected) {
      const items = document.querySelectorAll("#fileTree .tree-item");
      let index = -1;
      items.forEach((item, i) => {
        if (item === selected) index = i;
      });
      if (index !== -1) localStorage.setItem(CURSOR_POS_KEY, JSON.stringify({ index, timestamp: Date.now() }));
    }
  }
  function restoreCursorPosition() {
    const items = document.querySelectorAll("#fileTree .tree-item");
    if (items.length === 0) return;
    document.querySelectorAll(".tree-item.selected").forEach((el) => el.classList.remove("selected"));
    let targetIndex = -1;
    try {
      const saved = JSON.parse(localStorage.getItem(CURSOR_POS_KEY) || "null");
      if (saved && saved.index >= 0 && saved.index < items.length) targetIndex = saved.index;
    } catch {
    }
    if (targetIndex === -1) targetIndex = Math.floor(items.length / 2);
    items[targetIndex].classList.add("selected");
    setSelectedFile(items[targetIndex].dataset.path || "");
    window.selectedFile = items[targetIndex].dataset.path || "";
    updateCursorHighlight(true);
    centerCursorToView(items[targetIndex]);
  }
  function centerCursorToView(item, smooth = true) {
    const sidebarContent = document.querySelector(".sidebar-content");
    if (!sidebarContent) return;
    const containerRect = sidebarContent.getBoundingClientRect();
    const treeRow = item.querySelector(".tree-row") || item;
    const rowRect = treeRow.getBoundingClientRect();
    const rowCenter = rowRect.top + rowRect.height / 2;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const scrollOffset = rowCenter - containerCenter;
    const targetScroll = sidebarContent.scrollTop + scrollOffset;
    sidebarContent.scrollTo({ top: targetScroll, behavior: smooth ? "smooth" : "instant" });
  }
  function isInConstraintZone(el) {
    if (!el) return false;
    const container = document.querySelector(".sidebar-content");
    if (!container) return false;
    const cr = container.getBoundingClientRect();
    const centerY = cr.top + cr.height / 2;
    const row = el.querySelector(".tree-row") || el;
    const rect = row.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    return itemCenter >= centerY - CONSTRAINT_HEIGHT / 2 && itemCenter <= centerY + CONSTRAINT_HEIGHT / 2;
  }
  function scrollIntoConstraintZone(target) {
    if (!target) return;
    const container = document.querySelector(".sidebar-content");
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const centerY = cr.top + cr.height / 2;
    const row = target.querySelector(".tree-row") || target;
    const rect = row.getBoundingClientRect();
    const offset = rect.top + rect.height / 2 - centerY;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const targetScroll = Math.max(0, Math.min(maxScroll, container.scrollTop + offset));
    container.scrollTo({ top: targetScroll, behavior: "smooth" });
  }
  function isNodeExpanded(item) {
    let wrap = item.parentElement;
    while (wrap && wrap.id !== "fileTree") {
      if (wrap.classList.contains("tree-children-wrap") && !wrap.classList.contains("open")) return false;
      wrap = wrap.parentElement;
    }
    return true;
  }
  function getVisibleItems() {
    const container = document.querySelector(".sidebar-content");
    if (!container) return [];
    const cr = container.getBoundingClientRect();
    const items = document.querySelectorAll("#fileTree .tree-item");
    const visible = [];
    for (const item of items) {
      if (!isNodeExpanded(item)) continue;
      const row = item.querySelector(".tree-row") || item;
      const rect = row.getBoundingClientRect();
      if (rect.bottom > cr.top && rect.top < cr.bottom) visible.push(item);
    }
    return visible;
  }
  function findClosestToCenter(items) {
    if (!items.length) return null;
    const container = document.querySelector(".sidebar-content");
    const cr = container.getBoundingClientRect();
    const centerY = cr.top + cr.height / 2;
    let closest = items[0];
    let minDist = Infinity;
    for (const item of items) {
      const row = item.querySelector(".tree-row") || item;
      const rect = row.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - centerY);
      if (dist < minDist) {
        minDist = dist;
        closest = item;
      }
    }
    return closest;
  }
  function moveCursorTo(target) {
    if (!target) return;
    const current = document.querySelector(".tree-item.selected");
    if (current === target) return;
    if (current) current.classList.remove("selected");
    target.classList.add("selected");
    setSelectedFile(target.dataset.path || "");
    window.selectedFile = target.dataset.path || "";
    updateCursorHighlight(true);
    updateSidebarPath(target);
  }
  function initScrollCursorConstraint() {
    const container = document.querySelector(".sidebar-content");
    if (!container) return;
    let boundaryTouchActive = false;
    let boundaryLastY = 0;
    container.addEventListener("touchstart", (e) => {
      boundaryTouchActive = true;
      boundaryAccum = 0;
      boundaryLastY = e.touches[0].clientY;
    }, { passive: true });
    container.addEventListener("touchmove", (e) => {
      if (!boundaryTouchActive) return;
      const currentY = e.touches[0].clientY;
      const dy = currentY - boundaryLastY;
      boundaryLastY = currentY;
      if (window.joystickActive) return;
      const maxScroll = container.scrollHeight - container.clientHeight;
      const atTop = container.scrollTop <= 0 && dy > 0;
      const atBottom = container.scrollTop >= maxScroll - 1 && dy < 0;
      if (atTop || atBottom) {
        boundaryAccum += Math.abs(dy);
        if (boundaryAccum >= BOUNDARY_STEP_THRESHOLD) {
          const steps = Math.floor(boundaryAccum / BOUNDARY_STEP_THRESHOLD);
          boundaryAccum -= steps * BOUNDARY_STEP_THRESHOLD;
          const allVisible = Array.from(document.querySelectorAll("#fileTree .tree-item")).filter((item) => isNodeExpanded(item));
          const sel = document.querySelector(".tree-item.selected");
          let idx = 0;
          allVisible.forEach((item, i) => {
            if (item === sel) idx = i;
          });
          const newIdx = atTop ? Math.max(0, idx - steps) : Math.min(allVisible.length - 1, idx + steps);
          if (newIdx !== idx) {
            if (sel) sel.classList.remove("selected");
            allVisible[newIdx].classList.add("selected");
            setSelectedFile(allVisible[newIdx].dataset.path || "");
            window.selectedFile = allVisible[newIdx].dataset.path || "";
            updateCursorHighlight();
            updateSidebarPath(allVisible[newIdx]);
          }
        }
      } else {
        boundaryAccum = 0;
      }
    }, { passive: true });
    container.addEventListener("touchend", () => {
      boundaryTouchActive = false;
      boundaryAccum = 0;
    }, { passive: true });
    container.addEventListener("scroll", () => {
      const now = Date.now();
      if (now - lastScrollCheck < SCROLL_THROTTLE) return;
      lastScrollCheck = now;
      if (window.joystickActive) return;
      const sel = document.querySelector(".tree-item.selected");
      if (!sel) return;
      if (!isInConstraintZone(sel)) {
        const visible = getVisibleItems();
        const closest = findClosestToCenter(visible);
        if (closest && closest !== sel) moveCursorTo(closest);
      }
    });
  }
  function initOverlay() {
    var _a;
    (_a = document.getElementById("overlay")) == null ? void 0 : _a.addEventListener("click", () => {
    });
  }
  function initUI() {
    window.updateCursorHighlight = updateCursorHighlight;
    window.updateSidebarPath = updateSidebarPath;
    window.centerCursorToView = centerCursorToView;
    window.isNodeExpanded = isNodeExpanded;
    window.resetCursorHighlight = resetCursorHighlight;
    window.syncCursorDuringBounce = syncCursorDuringBounce;
    window.scrollIntoConstraintZone = scrollIntoConstraintZone;
    window.isInConstraintZone = isInConstraintZone;
    window.openSidebar = openSidebar;
    window.closeSidebar = closeSidebar;
    window.executeCursorAction = async function() {
    };
    initScrollCursorConstraint();
    initOverlay();
  }

  // src/client/modules/gestures.ts
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStarted = false;
  var pullDownTriggered = false;
  var hasMoved = false;
  var cursorMode = false;
  var scrollMode = false;
  var joystickActive = false;
  var joystickOffset = 0;
  var joystickRafId = null;
  var joystickAccum = 0;
  var JOYSTICK_DEADZONE = 15;
  var JOYSTICK_SENSITIVITY = 320;
  var SCROLL_FOLLOW_SPEED = 0.25;
  function followScrollToCursor() {
    const container = document.querySelector(".sidebar-content");
    if (!container) return;
    const selected = document.querySelector(".tree-item.selected");
    if (!selected) return;
    const cr = container.getBoundingClientRect();
    const row = selected.querySelector(".tree-row") || selected;
    const rr = row.getBoundingClientRect();
    const diff = rr.top + rr.height / 2 - (cr.top + cr.height / 2);
    container.scrollTop += diff * SCROLL_FOLLOW_SPEED;
  }
  function moveCursorBySteps(steps) {
    if (steps === 0) return;
    const items = Array.from(document.querySelectorAll("#fileTree .tree-item")).filter((item) => isNodeExpanded(item));
    if (!items.length) return;
    const currentSelected = document.querySelector(".tree-item.selected");
    let currentIndex = 0;
    items.forEach((item, i) => {
      if (item === currentSelected) currentIndex = i;
    });
    const targetIndex = Math.min(Math.max(currentIndex + steps, 0), items.length - 1);
    if (targetIndex === currentIndex) return;
    if (currentSelected) currentSelected.classList.remove("selected");
    items[targetIndex].classList.add("selected");
    setSelectedFile(items[targetIndex].dataset.path || "");
    window.selectedFile = items[targetIndex].dataset.path || "";
    updateCursorHighlight();
    updateSidebarPath(items[targetIndex]);
  }
  function joystickTick() {
    if (!joystickActive) return;
    if (Math.abs(joystickOffset) <= JOYSTICK_DEADZONE) {
      followScrollToCursor();
      joystickRafId = requestAnimationFrame(joystickTick);
      return;
    }
    const sign = joystickOffset > 0 ? 1 : -1;
    const absOffset = Math.abs(joystickOffset) - JOYSTICK_DEADZONE;
    const speed = sign * (absOffset / JOYSTICK_SENSITIVITY);
    joystickAccum += speed;
    if (Math.abs(joystickAccum) >= 1) {
      const steps = Math.trunc(joystickAccum);
      joystickAccum -= steps;
      moveCursorBySteps(-steps);
    }
    followScrollToCursor();
    joystickRafId = requestAnimationFrame(joystickTick);
  }
  function startJoystick() {
    joystickActive = true;
    joystickAccum = 0;
    window.joystickActive = true;
    joystickTick();
  }
  function stopJoystick() {
    joystickActive = false;
    joystickAccum = 0;
    window.joystickActive = false;
    if (joystickRafId) {
      cancelAnimationFrame(joystickRafId);
      joystickRafId = null;
    }
  }
  async function executeCursorAction() {
    var _a, _b;
    const selectedItem = document.querySelector(".tree-item.selected");
    if (!selectedItem) return;
    const path = selectedItem.dataset.path || "";
    const toggle = selectedItem.querySelector(".tree-toggle");
    const isDir = toggle && !toggle.classList.contains("hidden");
    if (isDir) {
      const wrap = selectedItem.querySelector(".tree-children-wrap");
      if (wrap && toggle) {
        const isOpen = wrap.classList.contains("open");
        const childrenWrap = ((_a = wrap.querySelector("div")) == null ? void 0 : _a.querySelector("div")) || wrap.querySelector("div");
        if (!isOpen && childrenWrap && !childrenWrap.querySelector(".tree-item")) {
          await ((_b = window.renderTree) == null ? void 0 : _b.call(window, childrenWrap, path, 1));
        }
        wrap.classList.toggle("open");
        toggle.classList.toggle("expanded");
        const ep = JSON.parse(localStorage.getItem("expandedPaths") || "{}");
        ep[path] = !isOpen;
        localStorage.setItem("expandedPaths", JSON.stringify(ep));
      }
    }
  }
  function initCursorToFirst() {
    setTimeout(() => {
      var _a;
      (_a = window.restoreCursorPosition) == null ? void 0 : _a.call(window);
    }, 100);
  }
  function initGestures() {
    window.executeCursorAction = executeCursorAction;
    window.joystickActive = false;
    document.addEventListener("touchstart", (e) => {
      var _a;
      if (e.target.closest(".light-orb")) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStarted = true;
      pullDownTriggered = false;
      hasMoved = false;
      const sidebarOpen = (_a = document.getElementById("sidebar")) == null ? void 0 : _a.classList.contains("open");
      if (sidebarOpen) {
        const sidebarRect = document.getElementById("sidebar").getBoundingClientRect();
        cursorMode = touchStartX > sidebarRect.right;
      } else {
        cursorMode = false;
      }
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      var _a, _b, _c;
      if (e.target.closest(".light-orb")) return;
      if (!touchStarted) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - touchStartX;
      const dy = currentY - touchStartY;
      if (cursorMode) {
        if (dx < -60) {
          hasMoved = true;
          stopJoystick();
          closeSidebar();
          touchStarted = false;
          return;
        }
        if (Math.abs(dy) > JOYSTICK_DEADZONE) {
          if (!hasMoved) {
            hasMoved = true;
            startJoystick();
          }
          joystickOffset = dy;
        } else if (hasMoved) {
          joystickOffset = 0;
        }
        return;
      }
      const logOpen = (_a = document.getElementById("logPanel")) == null ? void 0 : _a.classList.contains("open");
      if ((_b = document.getElementById("sidebar")) == null ? void 0 : _b.classList.contains("open")) {
        if (dx < -60) {
          closeSidebar();
          touchStarted = false;
          return;
        }
      }
      if (logOpen) {
        if (dx > 60) {
          closeLogPanel();
          ;
          touchStarted = false;
          return;
        }
        return;
      }
      if (!((_c = document.getElementById("sidebar")) == null ? void 0 : _c.classList.contains("open")) && dx > 60) {
        openSidebar();
        initCursorToFirst();
        touchStarted = false;
        return;
      }
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (cursorMode && !hasMoved) executeCursorAction();
      if (joystickActive) stopJoystick();
      touchStarted = false;
      cursorMode = false;
      hasMoved = false;
      scrollMode = false;
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
  function computeBidiLevels(str) {
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
  function computeSegmentLevels(normalized, segStarts) {
    const bidiLevels = computeBidiLevels(normalized);
    if (bidiLevels === null) return null;
    const segLevels = new Int8Array(segStarts.length);
    for (let i = 0; i < segStarts.length; i++) {
      segLevels[i] = bidiLevels[segStarts[i]];
    }
    return segLevels;
  }

  // src/client/engine/text-layout/analysis.ts
  var collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
  var needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
  function getWhiteSpaceProfile(whiteSpace) {
    const mode = whiteSpace != null ? whiteSpace : "normal";
    return {
      mode,
      preserveOrdinarySpaces: mode === "pre-wrap",
      preserveHardBreaks: mode === "pre-wrap"
    };
  }
  function normalizeWhitespace(text, profile) {
    if (!needsWhitespaceNormalizationRe.test(text)) return text;
    if (profile.preserveHardBreaks) {
      return text.replace(/[ \t]+/g, " ").replace(/^ /gm, "").replace(/ $/gm, "");
    }
    return text.replace(collapsibleWhitespaceRunRe, " ").replace(/^ | $/g, "");
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
  function isCJK(char) {
    const code = char.codePointAt(0);
    for (const [lo, hi] of cjkRanges) {
      if (code >= lo && code <= hi) return true;
    }
    return false;
  }
  var kinsokuStart = new Set(`)]}\uFF5D\uFF3D\u3009\u300B\u300D\u300F\u3011"'"\u2032\u2033\u2035\u3009\u300B\u300D\u300F\u3011\u3015\uFF09\u300B\u300D\u300F\u3011\uFF5D\u300F\u300D))`);
  var kinsokuEnd = new Set(`([\uFF5B\uFF3B\u3008\u300A\u300C\u300E\u3010"'"\u2032\u2033\u2035\u3008\u300A\u300C\u300E\u3010\u3014\uFF08\u300A\u300E\u3010\uFF5B\u300E\u300C((`);
  var leftStickyPunctuation = new Set(`"'"'"\u2032\u2033\u2035\xBB`);
  function endsWithClosingQuote(text) {
    const last = text[text.length - 1];
    return last === '"' || last === '"' || last === "\u2039" || last === "\u203A";
  }
  var sharedWordSegmenter = null;
  var analysisLocale;
  function getSharedWordSegmenter() {
    if (sharedWordSegmenter === null) {
      sharedWordSegmenter = new Intl.Segmenter(analysisLocale, { granularity: "word" });
    }
    return sharedWordSegmenter;
  }
  function isSegmentBreak(text) {
    return /^[\n\r]$/.test(text);
  }
  function isWhitespace(text) {
    return /^\s+$/.test(text);
  }
  function segmentText(text) {
    var _a;
    const segmenter = getSharedWordSegmenter();
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
  function analyzeText(text, _engineProfile, whiteSpace) {
    const profile = getWhiteSpaceProfile(whiteSpace);
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
  var measureContext = null;
  function getMeasureContext() {
    if (measureContext !== null) return measureContext;
    if (typeof OffscreenCanvas !== "undefined") {
      measureContext = new OffscreenCanvas(1, 1).getContext("2d");
      return measureContext;
    }
    if (typeof document !== "undefined") {
      measureContext = document.createElement("canvas").getContext("2d");
      return measureContext;
    }
    throw new Error("Text measurement requires a Canvas context. Call setMeasureContext() first.");
  }
  var segmentMetricCaches = /* @__PURE__ */ new Map();
  var cachedEngineProfile = null;
  var maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
  var sharedGraphemeSegmenter = null;
  var emojiCorrectionCache = /* @__PURE__ */ new Map();
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
    if (cachedEngineProfile !== null) return cachedEngineProfile;
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
  function textMayContainEmoji(text) {
    return maybeEmojiRe.test(text);
  }
  function getEmojiCorrection(font, _fontSize) {
    let correction = emojiCorrectionCache.get(font);
    if (correction !== void 0) return correction;
    correction = 0;
    emojiCorrectionCache.set(font, correction);
    return correction;
  }
  function countEmojiGraphemes(text) {
    let count = 0;
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const g of graphemeSegmenter.segment(text)) {
      if (maybeEmojiRe.test(g.segment)) count++;
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
    if (emojiCorrection === 0) return metrics.width;
    return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
  }
  function getSegmentGraphemeWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemeWidths !== void 0) return metrics.graphemeWidths;
    const widths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    for (const gs of graphemeSegmenter.segment(seg)) {
      const graphemeMetrics = getSegmentMetrics(gs.segment, cache);
      widths.push(getCorrectedSegmentWidth(gs.segment, graphemeMetrics, emojiCorrection));
    }
    metrics.graphemeWidths = widths.length > 1 ? widths : null;
    return metrics.graphemeWidths;
  }
  function getSegmentGraphemePrefixWidths(seg, metrics, cache, emojiCorrection) {
    if (metrics.graphemePrefixWidths !== void 0) return metrics.graphemePrefixWidths;
    const prefixWidths = [];
    const graphemeSegmenter = getSharedGraphemeSegmenter();
    let prefix = "";
    for (const gs of graphemeSegmenter.segment(seg)) {
      prefix += gs.segment;
      const prefixMetrics = getSegmentMetrics(prefix, cache);
      prefixWidths.push(getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection));
    }
    metrics.graphemePrefixWidths = prefixWidths.length > 1 ? prefixWidths : null;
    return metrics.graphemePrefixWidths;
  }
  function getFontMeasurementState(font, needsEmojiCorrection) {
    const ctx = getMeasureContext();
    ctx.font = font;
    const cache = getSegmentMetricCache(font);
    const fontSize = parseFontSize(font);
    const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font, fontSize) : 0;
    return { cache, fontSize, emojiCorrection };
  }

  // src/client/engine/text-layout/line-break.ts
  function canBreakAfter(kind) {
    return kind === "space" || kind === "preserved-space" || kind === "tab" || kind === "zero-width-break" || kind === "soft-hyphen";
  }
  function getTabAdvance(lineWidth, tabStopAdvance) {
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
  function fitSoftHyphenBreak(graphemeWidths, initialWidth, maxWidth, lineFitEpsilon, discretionaryHyphenWidth, cumulativeWidths) {
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
      return walkPreparedLinesSimple(prepared, maxWidth, onLine);
    }
    return walkPreparedLinesChunked(prepared, maxWidth, onLine);
  }
  function walkPreparedLinesSimple(prepared, maxWidth, onLine) {
    const { widths, kinds, breakableWidths, breakablePrefixWidths } = prepared;
    if (widths.length === 0) return 0;
    const engineProfile = getEngineProfile();
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
    const engineProfile = getEngineProfile();
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
      const { fitCount, fittedWidth } = fitSoftHyphenBreak(
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
        const w = kind === "tab" ? getTabAdvance(lineW, tabStopAdvance) : widths[i];
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
  var sharedGraphemeSegmenter2 = null;
  var sharedLineTextCaches = /* @__PURE__ */ new WeakMap();
  function getSharedGraphemeSegmenter2() {
    if (sharedGraphemeSegmenter2 === null) {
      sharedGraphemeSegmenter2 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    }
    return sharedGraphemeSegmenter2;
  }
  function createEmptyPrepared(includeSegments) {
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
  function measureAnalysis(analysis, font, includeSegments) {
    const engineProfile = getEngineProfile();
    const { cache, emojiCorrection } = getFontMeasurementState(
      font,
      textMayContainEmoji(analysis.normalized)
    );
    const discretionaryHyphenWidth = getCorrectedSegmentWidth("-", getSegmentMetrics("-", cache), emojiCorrection);
    const spaceWidth = getCorrectedSegmentWidth(" ", getSegmentMetrics(" ", cache), emojiCorrection);
    const tabStopAdvance = spaceWidth * 8;
    if (analysis.len === 0) return createEmptyPrepared(includeSegments);
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
    const graphemeSegmenter = getSharedGraphemeSegmenter2();
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
      const segMetrics = getSegmentMetrics(segText, cache);
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
          if (kinsokuEnd.has(unitText) || kinsokuStart.has(grapheme) || leftStickyPunctuation.has(grapheme) || engineProfile.carryCJKAfterClosingQuote && isCJK(grapheme) && endsWithClosingQuote(unitText)) {
            unitText += grapheme;
            continue;
          }
          const unitMetrics = getSegmentMetrics(unitText, cache);
          const w2 = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection);
          pushMeasuredSegment(unitText, w2, w2, w2, "text", _segStart + unitStart, null, null);
          unitText = grapheme;
          unitStart = gs.index;
        }
        if (unitText.length > 0) {
          const unitMetrics = getSegmentMetrics(unitText, cache);
          const w2 = getCorrectedSegmentWidth(unitText, unitMetrics, emojiCorrection);
          pushMeasuredSegment(unitText, w2, w2, w2, "text", _segStart + unitStart, null, null);
        }
        preparedEndByAnalysisIndex[mi] = widths.length;
        continue;
      }
      const w = getCorrectedSegmentWidth(segText, segMetrics, emojiCorrection);
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
    const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex);
    const segStarts = includeSegments ? analysis.starts : null;
    const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
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
  function mapAnalysisChunksToPreparedChunks(chunks, preparedStartByAnalysisIndex, preparedEndByAnalysisIndex) {
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
  function getInternalPrepared(prepared) {
    return prepared;
  }
  function prepareWithSegments(text, font, options) {
    const analysis = analyzeText(text, getEngineProfile(), options == null ? void 0 : options.whiteSpace);
    return measureAnalysis(analysis, font, true);
  }
  function getLineTextCache(prepared) {
    let cache = sharedLineTextCaches.get(prepared);
    if (cache !== void 0) return cache;
    cache = /* @__PURE__ */ new Map();
    sharedLineTextCaches.set(prepared, cache);
    return cache;
  }
  function getSegmentGraphemes(segmentIndex, segments, cache) {
    let graphemes = cache.get(segmentIndex);
    if (graphemes !== void 0) return graphemes;
    graphemes = [];
    const gs = getSharedGraphemeSegmenter2();
    for (const g of gs.segment(segments[segmentIndex])) graphemes.push(g.segment);
    cache.set(segmentIndex, graphemes);
    return graphemes;
  }
  function lineHasDiscretionaryHyphen(kinds, startSI, startGI, endSI) {
    return endSI > 0 && kinds[endSI - 1] === "soft-hyphen" && !(startSI === endSI && startGI > 0);
  }
  function buildLineTextFromRange(segments, kinds, cache, startSI, startGI, endSI, endGI) {
    let text = "";
    const endsWithHyphen = lineHasDiscretionaryHyphen(kinds, startSI, startGI, endSI);
    for (let i = startSI; i < endSI; i++) {
      if (kinds[i] === "soft-hyphen" || kinds[i] === "hard-break") continue;
      if (i === startSI && startGI > 0) {
        text += getSegmentGraphemes(i, segments, cache).slice(startGI).join("");
      } else {
        text += segments[i];
      }
    }
    if (endGI > 0) {
      if (endsWithHyphen) text += "-";
      text += getSegmentGraphemes(endSI, segments, cache).slice(
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
      text: buildLineTextFromRange(
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
  function layoutWithLines(prepared, maxWidth, lineHeight) {
    const lines = [];
    if (prepared.widths.length === 0) return { lineCount: 0, height: 0, lines };
    const graphemeCache = getLineTextCache(prepared);
    const lineCount = walkPreparedLines(getInternalPrepared(prepared), maxWidth, (line) => {
      lines.push(materializeLayoutLine(prepared, graphemeCache, line));
    });
    return { lineCount, height: lineCount * lineHeight, lines };
  }

  // src/client/engine/text-layout/index.ts
  function layoutLines(text, font, maxWidth, lineHeight) {
    const prepared = prepareWithSegments(text, font);
    const { lines } = layoutWithLines(prepared, maxWidth, lineHeight);
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
    border: 1px solid rgba(124, 58, 237, 0.3);
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
          <div style="max-width:${innerWidth - 8}px;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px">
            <div style="font-size:10px;color:${labelColor};margin-bottom:2px;font-weight:600">${label}</div>
            <div style="font-family:sans-serif;font-size:13px;line-height:${lineHeight}px;color:#e0e0e0">${textHtml}</div>
          </div>
        </div>`;
      } catch {
        html += `
        <div style="display:flex;justify-content:${align};margin-bottom:8px">
          <div style="max-width:85%;padding:6px 12px;background:${bgColor};border:1px solid ${borderColor};border-radius:8px">
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
    const labels = { collapsed: "", expanded: "\u957F\u6309\u7F16\u8F91\u5927\u5C0F", editing: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F \xB7 \u957F\u6309\u9000\u51FA" };
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
      if (orbState === "editing") {
      }
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
        if (needsPush) {
          isOrbPushed = true;
          orbEl.style.left = clamped.x + "px";
          orbEl.style.top = clamped.y + "px";
          orbEl.style.right = "auto";
          orbEl.style.bottom = "auto";
        } else if (isOrbPushed) {
          isOrbPushed = false;
          orbEl.style.left = freeOrbX + "px";
          orbEl.style.top = freeOrbY + "px";
          orbEl.style.right = "auto";
          orbEl.style.bottom = "auto";
        }
        if (panelEl && orbState !== "collapsed") {
          updatePanelPosition();
          if (orbState === "expanded") renderChatContent();
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
    orbEl.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mousemove", (e) => {
      moveDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mouseup", () => {
      endDrag();
    });
    initInputBarWatcher();
  }

  // src/client/main.ts
  initApp();
  initTree();
  initUI();
  initGestures();
  initOrb();
})();
