/**
 * src/client/plugins/eyes/index.ts — 眼睛插件包入口（№5 首个 bundle，
 * Cordis 全流程首例）。
 *
 * bundle 四规矩（№5 首立，9.0 通用惯例）：
 *   1. 一个文件夹 = 一个包，本文件是唯一入口，声明成员清单；
 *   2. 整包启停：成员作为调用者 fiber 的子插件 apply——父 dispose 时
 *      逆序连带 unload（cordis 纤维树白送原子性）；
 *   3. 内外有别：包内成员互 inject 自由（段 inject 包内 eyes 服务）；
 *      包对外只 expose 本入口声明的接口（applyEyesBundle + 类型）；
 *   4. 包级配置：EyesBundleConfig.sections 可关停个别段——关掉某段，
 *      投影文件里就少这一段，其余不动。
 *
 * 依赖方向：eyes 总插件 inject dynFiles（包外基建）；段 inject eyes
 * （包内事务）。拓扑序 = 成员清单顺序。
 */
import { Context } from 'cordis';
import { eyesPlugin } from './eyes.js';
import { coordsSection } from './sections/coords.js';
import { skeletonSection } from './sections/skeleton.js';

export interface EyesBundleConfig {
  /** 包级配置：关停个别段（缺省全开） */
  sections?: {
    coords?: boolean;
    skeleton?: boolean;
  };
}

/** 成员清单（拓扑序：总插件 → 段插件） */
export const eyesBundleMembers = [eyesPlugin, coordsSection, skeletonSection];

/** 整包 apply：成员挂为调用者 fiber 的子插件（禁用 = 父 dispose 逆序连带） */
export function applyEyesBundle(ctx: Context, config: EyesBundleConfig = {}): void {
  ctx.plugin(eyesPlugin);
  if (config.sections?.coords !== false) ctx.plugin(coordsSection);
  if (config.sections?.skeleton !== false) ctx.plugin(skeletonSection);
}
