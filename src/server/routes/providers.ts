/**
 * routes/providers.ts — providers.json 专用保存路由（粘贴即入库，fuse-on-save）
 *
 * API 卡粘贴明文 apiKey 保存时：
 *   1. 变量名 = KFM_PROVIDER_<ID 大写规范化>（撞名 _2/_3 后缀）
 *   2. 明文写入 .kfmv4/.env（chmod 600）
 *   3. providers.json 里只落 ${VAR} 代字——明文不再进 providers.json
 * 已是 ${...} 代字或空值的条目原样透传。返回融合后的全量列表，
 * 客户端用它刷新本地状态（编辑器里能看到 key 已变成代字）。
 *
 * 读取不走这里：客户端仍走 /api/files/read 拿 raw 代字（展示无副作用）。
 * 请求时的代字解析在 chat.ts 使用点（resolveKey，见 env-store.ts）。
 */

import type { Router } from 'express';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR, verifyLocalOrigin } from '../path-utils.js';
import { isEnvRef, envNameForProvider, upsertEnvVar } from '../env-store.js';

interface ProviderIn {
  id?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  models?: unknown;
}

const PROVIDERS_PATH = join(KFM_DATA_DIR, 'providers.json');

export function setupProvidersRoutes(router: Router): void {
  router.post('/providers/save', verifyLocalOrigin, (req, res) => {
    try {
      const providers: unknown = req.body?.providers;
      if (!Array.isArray(providers)) {
        return res.status(400).json({ success: false, error: 'providers 必须是数组' });
      }

      const nameOwner = new Map<string, string>(); // envName -> provider id（撞名检测）
      for (const p of providers as ProviderIn[]) {
        if (!p || typeof p !== 'object') continue;
        if (typeof p.apiKey !== 'string') continue;
        const raw = p.apiKey.trim();
        if (!raw || isEnvRef(raw)) continue; // 空值/代字透传

        const pid = String(p.id ?? 'key');
        let envName = envNameForProvider(pid);
        if (nameOwner.has(envName) && nameOwner.get(envName) !== pid) {
          let i = 2;
          while (nameOwner.has(`${envName}_${i}`)) i++;
          envName = `${envName}_${i}`;
        }
        nameOwner.set(envName, pid);

        upsertEnvVar(envName, raw);
        p.apiKey = '${' + envName + '}';
      }

      writeFileSync(PROVIDERS_PATH, JSON.stringify(providers, null, 2), { mode: 0o600 });
      res.json({ success: true, providers });
    } catch (e) {
      res.status(500).json({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
