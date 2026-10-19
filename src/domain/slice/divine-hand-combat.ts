import { currentDivineHandCombatSource, replayDivineHandCombatRound, validDivineHandCombatSource } from '../divine-hand/combat.js';
import { combatBody } from '../divine-hand/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolveDivineHandCombatRound(s:SliceState,stance:SliceStance){
 const source=currentDivineHandCombatSource(s);if(!source||!validDivineHandCombatSource(source))throw new Error('缺少同一独立对手、原棍、实际修理室外前庭或连续身体来源。');
 const result=replayDivineHandCombatRound(source,stance),o=result.round.divineHandOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.divineHand.encounter,combatBody(o));s.divineHand.encounter.scene=structuredClone(o.rootAfter);s.divineHand.encounter.materials=structuredClone(o.materialsAfter);
 s.glory.life.site=structuredClone(o.originalsAfter.site);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveDivineHandSliceCombatRound=resolveDivineHandCombatRound;
export { validateDivineHandCombatRound as validateDivineHandRecordedRound } from '../divine-hand/combat.js';
