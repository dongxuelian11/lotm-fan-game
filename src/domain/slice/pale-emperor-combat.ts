import { currentPaleEmperorCombatSource, replayPaleEmperorCombatRound, validPaleEmperorCombatSource } from '../pale-emperor/combat.js';
import { combatBody } from '../pale-emperor/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolvePaleEmperorCombatRound(s:SliceState,stance:SliceStance){
 const source=currentPaleEmperorCombatSource(s);if(!source||!validPaleEmperorCombatSource(source))throw new Error('缺少同一独立对手、原棍、实际附室外前庭或连续身体来源。');
 const result=replayPaleEmperorCombatRound(source,stance),o=result.round.paleEmperorOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.paleEmperor.encounter,combatBody(o));s.paleEmperor.encounter.scene=structuredClone(o.rootAfter);s.paleEmperor.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolvePaleEmperorSliceCombatRound=resolvePaleEmperorCombatRound;
export { validatePaleEmperorCombatRound as validatePaleEmperorRecordedRound } from '../pale-emperor/combat.js';
