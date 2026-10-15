import { currentMisfortuneKnightCombatSource, replayMisfortuneKnightCombatRound, validMisfortuneKnightCombatSource } from '../misfortune-knight/combat.js';
import { combatBody } from '../misfortune-knight/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, actual original leaf and finite continuous bodies. */
export function resolveMisfortuneKnightCombatRound(s:SliceState,stance:SliceStance){
 const source=currentMisfortuneKnightCombatSource(s);if(!source||!validMisfortuneKnightCombatSource(source))throw new Error('缺少同一独立对手、原杆、实际石院或连续原卷叶来源。');
 const result=replayMisfortuneKnightCombatRound(source,stance),o=result.round.misfortuneKnightOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.misfortuneKnight.encounter,combatBody(o));s.misfortuneKnight.encounter.scene=structuredClone(o.rootAfter);s.misfortuneKnight.encounter.materials=structuredClone(o.materialsAfter);
 const leaf=s.spiritWarlock.companion;if(leaf.source!==o.companion.source||leaf.acquiredWeek!==o.companion.acquiredWeek||leaf.invitedWeek!==o.companion.invitedWeek||leaf.releases!==o.companion.releases)throw new Error('同一原卷叶来源不一致。');
 leaf.status=o.companion.status;leaf.deployments=o.companion.deployments;leaf.recalls=o.companion.recalls;
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveMisfortuneKnightSliceCombatRound=resolveMisfortuneKnightCombatRound;
export { validateMisfortuneKnightCombatRound as validateMisfortuneKnightRecordedRound } from '../misfortune-knight/combat.js';
