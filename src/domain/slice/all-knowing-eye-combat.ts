import { currentAllKnowingEyeCombatSource, replayAllKnowingEyeCombatRound, validAllKnowingEyeCombatSource } from '../all-knowing-eye/combat.js';
import { combatBody } from '../all-knowing-eye/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, actual original crafts and finite continuous bodies. */
export function resolveAllKnowingEyeCombatRound(s:SliceState,stance:SliceStance){
 const source=currentAllKnowingEyeCombatSource(s);if(!source||!validAllKnowingEyeCombatSource(source))throw new Error('缺少同一独立对手、原杆、实际石院或连续原微光片来源。');
 const result=replayAllKnowingEyeCombatRound(source,stance),o=result.round.allKnowingEyeOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.allKnowingEye.encounter,combatBody(o));s.allKnowingEye.encounter.scene=structuredClone(o.rootAfter);s.allKnowingEye.encounter.materials=structuredClone(o.materialsAfter);
 // Consume only the exact surviving original crafts recorded in this round.
 if(s.mysticismMagister.crafts.length!==source.crafts.length||s.mysticismMagister.crafts.some((craft,i)=>JSON.stringify(craft)!==JSON.stringify(source.crafts[i])))throw new Error('实际原微光片在回合来源后被改写。');
 s.mysticismMagister.crafts=structuredClone(o.craftsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveAllKnowingEyeSliceCombatRound=resolveAllKnowingEyeCombatRound;
export { validateAllKnowingEyeCombatRound as validateAllKnowingEyeRecordedRound } from '../all-knowing-eye/combat.js';
