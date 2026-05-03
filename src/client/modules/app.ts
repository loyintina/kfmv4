import { KFMState } from './state.js';
/**
 * KFM v4 - 全局状态与初始化
 */

export const API = '/kfmv4/api';


// ========== 调试日志 ==========
export function rlog(msg: string): void {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  fetch(API + '/files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/root/kfmv4/debug-swipe.log', content: t + ' ' + msg + '\n', append: true }),
  }).catch(() => {});
}

// ========== Toast ==========
export function showToast(msg: string): void {
  const toast = document.getElementById('operationToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 2000);
}

// ========== 日志系统 ==========
interface LogEntry { time: string; msg: string; type: string }
const logs: LogEntry[] = [];
const MAX_LOGS = 100;

function escapeHtml(str: string): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderLogs(): void {
  const content = document.getElementById('logContent');
  if (!content) return;
  content.innerHTML = logs.map(log => {
    const cls = log.type === 'error' ? 'error' : log.type === 'success' ? 'success' : '';
    return `<div class="log-item ${cls}"><span class="time">${log.time}</span>${escapeHtml(log.msg)}</div>`;
  }).join('');
}

export function addLog(msg: string, type = 'info'): void {
  const time = new Date().toLocaleTimeString();
  logs.unshift({ time, msg: String(msg), type });
  if (logs.length > MAX_LOGS) logs.pop();
  renderLogs();
}

export function openLogPanel(): void {
  document.getElementById('logPanel')?.classList.add('open');
  renderLogs();
}

export function closeLogPanel(): void {
  document.getElementById('logPanel')?.classList.remove('open');
}

export function clearLogs(): void {
  logs.length = 0;
  renderLogs();
}

export function copyLogs(): void {
  const text = logs.map(l => `[${l.time}] ${l.msg}`).join(String.fromCharCode(10));
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('日志已复制'));
  } else {
    // fallback for mobile
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('日志已复制');
  }
}

// 日志面板滑动关闭
function initLogPanelSwipe(): void {
  const panel = document.getElementById('logPanel');
  if (!panel) return;
  let startX = 0;
  panel.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX;
    if (dx > 0) panel.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    panel.style.transform = '';
    if (dx > 80) closeLogPanel();
  }, { passive: true });
}

// 捕获 console
const originalLog = console.log;
const originalError = console.error;
console.log = function (...args: any[]) {
  originalLog.apply(console, args);
  addLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
};
console.error = function (...args: any[]) {
  originalError.apply(console, args);
  addLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error');
};

// ========== 暴露到 window ==========
function exposeGlobals(): void {
  window.API = API;
  window.selectedFile = KFMState.selectedFile;
  window.expandedPaths = KFMState.expandedPaths;
  window.showHidden = KFMState.showHidden;
  window.showToast = showToast;
  window.addLog = addLog;
  window.openLogPanel = openLogPanel;
  window.closeLogPanel = closeLogPanel;
  window.clearLogs = clearLogs;
  window.copyLogs = copyLogs;
  window.rlog = rlog;
}

export async function initApp(): Promise<void> {
  exposeGlobals();
  initLogPanelSwipe();

  // AI输入栏跟随键盘平滑移动
  const bar = document.getElementById('aiInputBar');
  if (bar && (window as any).visualViewport) {
    const vv = (window as any).visualViewport;
    const onResize = () => {
      const kh = window.innerHeight - vv.height;
      bar.style.bottom = kh + 'px';
    };
    vv.addEventListener('resize', onResize);
    onResize();
  }

  // 眼睛按钮：显示/隐藏隐藏文件
  const eyeBtn = document.getElementById('toggleHiddenBtn');
  if (eyeBtn) {
    eyeBtn.addEventListener('click', () => {
      KFMState.toggleHidden();
      eyeBtn.classList.toggle('active');
    });
  }

  // 侧栏召唤按钮
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        if (sidebar.classList.contains('open')) {
          window.closeSidebar?.();
        } else {
          window.openSidebar?.();
        }
      }
    });
  }

  // AI输入框自动高度
  const aiInput = document.getElementById('aiInput') as HTMLTextAreaElement | null;
  if (aiInput) {
    aiInput.addEventListener('input', () => {
      aiInput.style.height = 'auto';
      const newHeight = Math.min(aiInput.scrollHeight, 120);
      aiInput.style.height = newHeight + 'px';
    });
  }
}