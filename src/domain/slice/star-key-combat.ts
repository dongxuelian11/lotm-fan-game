import { currentStarKeyCombatSource, replayStarKeyCombatRound, validStarKeyCombatSource } from '../star-key/combat.js';
import { combatBody } from '../star-key/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolveStarKeyCombatRound(s:SliceState,stance:SliceStance){
 const source=currentStarKeyCombatSource(s);if(!source||!validStarKeyCombatSource(source))throw new Error('缺少同一独立对手、原棍、实际通行室外前庭或连续身体来源。');
 const result=replayStarKeyCombatRound(source,stance),o=result.round.starKeyOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.starKey.encounter,combatBody(o));s.starKey.encounter.scene=structuredClone(o.rootAfter);s.starKey.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveStarKeySliceCombatRound=resolveStarKeyCombatRound;
export { validateStarKeyCombatRound as validateStarKeyRecordedRound } from '../star-key/combat.js';
