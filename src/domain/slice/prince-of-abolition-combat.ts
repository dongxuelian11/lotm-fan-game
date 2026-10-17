import { currentPrinceOfAbolitionCombatSource, replayPrinceOfAbolitionCombatRound, validPrinceOfAbolitionCombatSource } from '../prince-of-abolition/combat.js';
import { princeOfAbolitionCombatBody } from '../prince-of-abolition/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor; Black Emperor35/15/20/30 core; only the new root owns the current original gift stock. */
export function resolvePrinceOfAbolitionCombatRound(s: SliceState, stance: SliceStance) {
  const source=currentPrinceOfAbolitionCombatSource(s);
  if (!source || !validPrinceOfAbolitionCombatSource(source)) throw new Error('缺少同一独立对手、实际净空院落或真实物资记录。');
  const result=replayPrinceOfAbolitionCombatRound(source,stance),o=result.round.princeOfAbolitionOutcome!,c=s.combat!;
  s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;
  s.progression.mastery={...o.masteryAfter};s.princeOfAbolition.gifts=structuredClone(o.giftsAfter);Object.assign(s.princeOfAbolition.encounter,princeOfAbolitionCombatBody(o));
  s.princeOfAbolition.encounter.currentSite=structuredClone(o.siteAfter);s.princeOfAbolition.life.operation=structuredClone(o.operationAfter);
  c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;
  c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
  if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);
  return result;
}
export const resolvePrinceOfAbolitionSliceCombatRound=resolvePrinceOfAbolitionCombatRound;
