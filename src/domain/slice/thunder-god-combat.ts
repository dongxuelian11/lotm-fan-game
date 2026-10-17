import { currentThunderGodCombatSource, replayThunderGodCombatRound, validThunderGodCombatSource } from '../thunder-god/combat.js';
import { combatBody } from '../thunder-god/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolveThunderGodCombatRound(s:SliceState,stance:SliceStance){
 const source=currentThunderGodCombatSource(s);if(!source||!validThunderGodCombatSource(source))throw new Error('缺少同一独立对手、原杆、实际干平台或连续身体来源。');
 const result=replayThunderGodCombatRound(source,stance),o=result.round.thunderGodOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.thunderGod.encounter,combatBody(o));s.thunderGod.encounter.scene=structuredClone(o.rootAfter);s.thunderGod.encounter.materials=structuredClone(o.materialsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveThunderGodSliceCombatRound=resolveThunderGodCombatRound;
export { validateThunderGodCombatRound as validateThunderGodRecordedRound } from '../thunder-god/combat.js';
