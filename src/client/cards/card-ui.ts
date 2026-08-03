/**
 * card-ui.ts — 卡片 UI 公共样式 helper（card-dev §内卡样式的模板化）
 *
 * 病灶（2026-08-03 注入卡 UI 不同步审计）：内卡反色框样式在 6 张卡里手抄
 * 20+ 次且各卡抄的遍数不同（3/4/5 处）——无公共模板，每张凭记忆抄，
 * 漏抄/抄错是必然（规范在 card-dev.md 但实现靠手抄，无机械门）。
 * 根治：基础样式抽公共 helper，建卡直接 import，禁止手写内卡 cssText。
 */

/** 二级内卡样式（card-dev §内卡样式：c2→c1 反色框 + margin-top:6px 间距） */
export function innerCardStyle(c1: string, c2: string): string {
  return `border-radius:10px;padding:8px 12px;margin-top:6px;background:linear-gradient(rgba(10,10,15,0.92),rgba(10,10,15,0.92)) padding-box,linear-gradient(135deg,${c2} 30%,${c1} 70%) border-box;border:1px solid transparent;border-left-width:3px`;
}

/** 表单输入样式 */
export function inputStyle(): string {
  return 'font-size:var(--card-font-size,11px);padding:0.35em 0.7em;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);outline:none;flex:1;min-width:0';
}

/** 按钮样式 */
export function btnStyle(accent: string): string {
  return `padding:0.3em 0.8em;border-radius:6px;font-size:var(--card-font-size,10px);font-weight:600;cursor:pointer;user-select:none;border:1px solid ${accent}40;color:${accent};background:transparent;flex:1;text-align:center`;
}

/** 保存成功反馈：按钮短暂变「✓ 已保存」后恢复（统一缺口——2026-08-03） */
export function flashSaved(btn: HTMLButtonElement, savedText = '✓ 已保存'): void {
  const original = btn.textContent;
  btn.textContent = savedText;
  btn.style.opacity = '0.75';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.opacity = '';
  }, 1500);
}

/** 表单行（label + wrap） */
export function mkRow(label: string): { row: HTMLElement; wrap: HTMLElement } {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px';
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:var(--card-font-size,10px);color:rgba(255,255,255,0.5);flex-shrink:0;margin-right:8px;width:52px';
  lbl.textContent = label;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex:1;min-width:0';
  row.appendChild(lbl);
  row.appendChild(wrap);
  return { row, wrap };
}
