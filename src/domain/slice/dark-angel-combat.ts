import { currentDarkAngelCombatSource, replayDarkAngelCombatRound, validDarkAngelCombatSource } from '../dark-angel/combat.js';
import type { SliceStance, SliceState } from './types.js';
/** Only this module's live continuation changes; the eight original roots remain read-only. */
export function resolveDarkAngelCombatRound(s:SliceState,stance:SliceStance){
 const source=currentDarkAngelCombatSource(s);if(!source||!validDarkAngelCombatSource(source))throw new Error('缺少埃德加、实际封条、原放牧与储备或连续身体来源。');
 const result=replayDarkAngelCombatRound(source,stance),o=result.round.darkAngelOutcome!,c=s.combat!,e=s.darkAngel.encounter;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery={...o.masteryAfter};
 e.enemyHealth=o.enemyHealth;e.enemyMind=o.enemyMind;e.enemySpirituality=o.enemySpirituality;e.enemyStatus=o.enemyStatus;e.enemyInjuries=structuredClone(o.enemyInjuriesAfter);e.enemyRisk=o.enemyRiskAfter;e.weaponLocation=o.enemyStatus==='RESISTING'?'HAND':'YARD';e.powerUses={...o.powerUses};e.currentSite=structuredClone(o.siteAfter);e.grazing=structuredClone(o.grazingAfter);e.reserve=structuredClone(o.reserveAfter);s.darkAngel.life.operation=structuredClone(o.operationAfter);e.note=structuredClone(o.noteAfter);e.marks=structuredClone(o.marksAfter);e.lastForceReceipt=structuredClone(o.lastForceReceipt);e.conditionVersion=o.conditionVersion;
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuriesAfter);c.enemyRisk=o.enemyRiskAfter;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveDarkAngelSliceCombatRound=resolveDarkAngelCombatRound;
export { validateDarkAngelCombatRound as validateDarkAngelRecordedRound } from '../dark-angel/combat.js';
