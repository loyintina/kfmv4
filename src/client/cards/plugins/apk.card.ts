/**
 * apk.card.ts — KFM-NA 安装包卡
 *
 * 提供 KFM-NA（Android 原生重构版）APK 的下载入口：
 * 显示包大小/构建时间，点按钮触发浏览器下载
 * （服务端 GET /api/download/apk 带 Content-Disposition，
 * 手机浏览器直接落下载，见 src/server/routes/files.ts）。
 */

import { registerCardType, type CardContentHandler } from '../../modules/card-registry.js';
import { buildCardLayout } from '../../modules/floating-card.js';
import { innerCardStyle, btnStyle } from '../card-ui.js';

const C1 = '#8B5CF6'; // 紫——对齐 KFM-NA 壳的紫屏
const C2 = '#38BDF8';

const API_BASE = (() => {
  const base = window.location.pathname.replace(/\/+$/, '');
  return base + '/api/';
})();

function createApkHandler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl) {
      const { bodyEl } = buildCardLayout(contentEl, 'KFM-NA 安装包', C1, C2);

      const infoCard = document.createElement('div');
      infoCard.style.cssText = innerCardStyle(C1, C2);

      const sizeRow = document.createElement('div');
      sizeRow.style.cssText = 'font-size:var(--card-font-size,11px);color:rgba(255,255,255,0.8);line-height:1.6';
      sizeRow.textContent = '读取中…';
      infoCard.appendChild(sizeRow);
      bodyEl.appendChild(infoCard);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;margin-top:8px';
      const dlBtn = document.createElement('button');
      dlBtn.textContent = '⬇ 下载 APK';
      dlBtn.style.cssText = btnStyle(C1);
      dlBtn.onclick = () => { window.location.href = API_BASE + 'download/apk'; };
      btnRow.appendChild(dlBtn);
      bodyEl.appendChild(btnRow);

      fetch(API_BASE + 'download/apk/info')
        .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
        .then((info: { size: number; mtime: string }) => {
          const mb = (info.size / 1024 / 1024).toFixed(2);
          const time = info.mtime.slice(0, 16).replace('T', ' ');
          sizeRow.textContent = `kfm-na.apk · ${mb} MB · 构建于 ${time} UTC`;
        })
        .catch(() => {
          sizeRow.textContent = 'APK 不存在（服务器上还没构建）';
          dlBtn.style.opacity = '0.4';
          dlBtn.style.pointerEvents = 'none';
        });
    },
    deactivate(contentEl) {
      contentEl.innerHTML = '';
    },
  };
}

registerCardType({
  typeId: 'apk',
  icon: '📦',
  name: '安装包',
  description: '下载 KFM-NA Android 安装包（原生重构版）',
  kind: 'tool',
  createHandler: createApkHandler,
});
