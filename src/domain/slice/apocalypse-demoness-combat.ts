import { currentApocalypseDemonessCombatSource, replayApocalypseDemonessCombatRound, validApocalypseDemonessCombatSource } from '../apocalypse-demoness/combat.js';
import { combatBody, commitApocalypseDemonessOriginals } from '../apocalypse-demoness/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, independent finite opponent and continuous actual bodies. */
export function resolveApocalypseDemonessCombatRound(s:SliceState,stance:SliceStance){
 const source=currentApocalypseDemonessCombatSource(s);if(!source||!validApocalypseDemonessCombatSource(source))throw new Error('缺少同一独立莱奥娜、实购镜片、相邻修理院或连续身体来源。');
 const result=replayApocalypseDemonessCombatRound(source,stance),o=result.round.apocalypseDemonessOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.apocalypseDemoness.encounter,combatBody(o));s.apocalypseDemoness.encounter.scene=structuredClone(o.rootAfter);s.apocalypseDemoness.encounter.materials=structuredClone(o.materialsAfter);
 commitApocalypseDemonessOriginals(s,o.originalsAfter);
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveApocalypseDemonessSliceCombatRound=resolveApocalypseDemonessCombatRound;
export { validateApocalypseDemonessCombatRound as validateApocalypseDemonessRecordedRound } from '../apocalypse-demoness/combat.js';
