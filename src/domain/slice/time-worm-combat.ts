import { currentTimeWormCombatSource, replayTimeWormCombatRound, validTimeWormCombatSource } from '../time-worm/combat.js';
import { combatBody } from '../time-worm/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolveTimeWormCombatRound(s:SliceState,stance:SliceStance){
 const source=currentTimeWormCombatSource(s);if(!source||!validTimeWormCombatSource(source))throw new Error('缺少同一独立对手、原棍、实际登记室外前庭或连续身体来源。');
 const result=replayTimeWormCombatRound(source,stance),o=result.round.timeWormOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.timeWorm.encounter,combatBody(o));s.timeWorm.encounter.scene=structuredClone(o.rootAfter);s.timeWorm.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveTimeWormSliceCombatRound=resolveTimeWormCombatRound;
export { validateTimeWormCombatRound as validateTimeWormRecordedRound } from '../time-worm/combat.js';
