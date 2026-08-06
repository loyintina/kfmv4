/** 卡片堆模块：面板右侧的临时卡片驻留区。
 *  「卡片堆召唤按钮」功能（2026-08 新加）：点击按钮把一张卡片召唤进堆，
 *  堆满后最旧的卡片自动退场。
 */
import { MAX_STACK_CARDS } from '../config/limits.ts';

export interface StackCard {
  id: string;
  title: string;
  summonedAt: number;
}

export class CardStack {
  private cards: StackCard[] = [];

  /** 召唤一张卡片进堆；堆满时挤出最旧的一张并返回它 */
  summon(title: string): StackCard | null {
    const card: StackCard = {
      id: `card-${Date.now().toString(36)}-${this.cards.length}`,
      title,
      summonedAt: Date.now(),
    };
    let evicted: StackCard | null = null;
    if (this.cards.length >= MAX_STACK_CARDS) {
      evicted = this.cards.shift() ?? null;
    }
    this.cards.push(card);
    return evicted;
  }

  /** 当前堆内卡片（按召唤顺序，旧→新） */
  list(): readonly StackCard[] {
    return this.cards;
  }

  /** 解散整张卡片堆 */
  dismissAll(): void {
    this.cards = [];
  }
}
