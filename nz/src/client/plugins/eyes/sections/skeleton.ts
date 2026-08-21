/**
 * src/client/plugins/eyes/sections/skeleton.ts — 骨架自态段（2026-08-20
 * 修订：数据源 = 骨架期真实存在的真相源，不空转）。
 *
 * 采集五个骨架真相源：broker 账（插件户口/卡类型/手势计数/RiskClass
 * 计数）、审计账（permission 判定尾迹）、体检记录（plugtest 末三轮）、
 * bootLog 尾迹。collect 时现场直读——投影永远是「此刻」的骨架。
 *
 * 依赖全走可选链：裸 context（plugtest 降级探针）下有意降级为空账，
 * 不炸。viewport/file-tree/orb-panel/card-stack 各段随对应卡落地补齐
 * （8.12.6 眼睛全量段，数据源触发制）。
 */
import { Context } from 'cordis';
import { bootLog } from '../../../ctx.js';

export function skeletonSection(ctx: Context): void {
  ctx.inject(['eyes'], (ctx) => {
    const dispose = ctx.eyes.registerSection({
      id: 'skeleton-state',
      title: '骨架自态（skeleton-state）',
      source: 'broker 账（plugtest/cardTypes/gestures/permissions）+ 审计账 + bootLog',
      collect: () => ({
        plugins: ctx.plugtest?.list().plugins ?? [],
        cardTypes: ctx.cardTypes?.list().map((d) => d.id) ?? [],
        gestureHandlers: ctx.gestures?.handlerCount ?? 0,
        declaredRisks: ctx.permissions?.declaredCount ?? 0,
        auditTail: (ctx.permissions?.audit ?? [])
          .slice(-3)
          .map((e) => `${e.tool} → ${e.decision}（${e.rule}）`),
        plugtestRunsTail: (ctx.plugtest?.runs ?? [])
          .slice(-3)
          .map((r) => `${r.plugin}:${r.code}`),
        bootLogTail: bootLog.slice(-5),
      }),
    });
    ctx.effect(() => dispose);
  });
}
