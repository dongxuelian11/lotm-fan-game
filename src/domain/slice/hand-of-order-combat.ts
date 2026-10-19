import { currentHandOfOrderCombatSource, replayHandOfOrderCombatRound, validHandOfOrderCombatSource } from '../hand-of-order/combat.js';
import { handOfOrderCombatBody } from '../hand-of-order/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor; Justiciar30/20/35/15 core; the new root owns the current original guard plate. */
export function resolveHandOfOrderCombatRound(s: SliceState, stance: SliceStance) {
  const source=currentHandOfOrderCombatSource(s);
  if (!source || !validHandOfOrderCombatSource(source)) throw new Error('缺少同一独立对手、实际净空院落或真实物资记录。');
  const result=replayHandOfOrderCombatRound(source,stance),o=result.round.handOfOrderOutcome!,c=s.combat!;
  s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;
  s.progression.mastery={...o.masteryAfter};s.handOfOrder.life.guardPlate=structuredClone(o.guardPlateAfter);Object.assign(s.handOfOrder.encounter,handOfOrderCombatBody(o));
  s.handOfOrder.life.site=structuredClone(o.siteAfter);s.handOfOrder.life.operation=structuredClone(o.operationAfter);
  c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;
  c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
  if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);
  return result;
}
export const resolveHandOfOrderSliceCombatRound=resolveHandOfOrderCombatRound;
