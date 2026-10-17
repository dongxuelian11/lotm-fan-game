import { currentPureWhiteAngelCombatSource, replayPureWhiteAngelCombatRound, validPureWhiteAngelCombatSource } from '../pure-white-angel/combat.js';
import { combatBody } from '../pure-white-angel/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolvePureWhiteAngelCombatRound(s:SliceState,stance:SliceStance){
 const source=currentPureWhiteAngelCombatSource(s);if(!source||!validPureWhiteAngelCombatSource(source))throw new Error('缺少同一独立对手、原杆、实际廊外前庭或连续身体来源。');
 const result=replayPureWhiteAngelCombatRound(source,stance),o=result.round.pureWhiteAngelOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.pureWhiteAngel.encounter,combatBody(o));s.pureWhiteAngel.encounter.scene=structuredClone(o.rootAfter);s.pureWhiteAngel.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolvePureWhiteAngelSliceCombatRound=resolvePureWhiteAngelCombatRound;
export { validatePureWhiteAngelCombatRound as validatePureWhiteAngelRecordedRound } from '../pure-white-angel/combat.js';
