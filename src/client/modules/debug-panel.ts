// 调试面板模块 - 默认隐藏，Ctrl+Shift+D 切换
let debugPanel: HTMLDivElement | null = null;
let debugLogs: string[] = [];
let isVisible = false;

export function initDebugPanel(): void {
  if (debugPanel) return;
  debugPanel = document.createElement('div');
  debugPanel.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;height:250px;background:#1a1a2e;color:#00ff88;font-size:12px;padding:10px;z-index:9999;overflow-y:auto;font-family:monospace;border:1px solid #00ff88;display:none;';
  document.body.appendChild(debugPanel);
  
  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'COPY';
  copyBtn.style.cssText = 'position:sticky;top:0;right:0;float:right;background:#00ff88;color:#1a1a2e;border:none;padding:5px 10px;cursor:pointer;font-size:11px;margin-bottom:5px;';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(debugLogs.join('\n'));
    copyBtn.textContent = 'COPIED!';
    setTimeout(() => copyBtn.textContent = 'COPY', 1500);
  }; 
  debugPanel.appendChild(copyBtn);
  
  // 清空按钮
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'CLEAR';
  clearBtn.style.cssText = 'position:sticky;top:0;right:70px;float:right;background:#ff6666;color:#fff;border:none;padding:5px 10px;cursor:pointer;font-size:11px;margin-bottom:5px;margin-right:5px;';
  clearBtn.onclick = () => {
    debugLogs = []; 
    debugPanel!.querySelectorAll('.log-line').forEach(el => el.remove());
  }; 
  debugPanel.appendChild(clearBtn);
  
  // 快捷键切换
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      isVisible = !isVisible;
      debugPanel!.style.display = isVisible ? 'block' : 'none';
    }
  });
}

export function debugLog(...args: any[]): void {
  initDebugPanel();
  const time = new Date().toLocaleTimeString();
  const msg = args.map(a => a === null ? '' : a === undefined ? 'undefined' : String(a)).join(' ');
  debugLogs.push(`[${time}] ${msg}`);
  const line = document.createElement('div');
  line.className = 'log-line';
  line.style.margin = '2px 0';
  line.textContent = `[${time}] ${msg}`;
  debugPanel!.appendChild(line);
  debugPanel!.scrollTop = debugPanel!.scrollHeight;
}
