import { currentKnowledgeEmperorCombatSource, replayKnowledgeEmperorCombatRound, validKnowledgeEmperorCombatSource } from '../knowledge-emperor/combat.js';
import type { SliceStance, SliceState } from './types.js';
/** Only this module's live continuation changes; the eight original roots remain read-only. */
export function resolveKnowledgeEmperorCombatRound(s:SliceState,stance:SliceStance){
 const source=currentKnowledgeEmperorCombatSource(s);if(!source||!validKnowledgeEmperorCombatSource(source))throw new Error('缺少达里安、实际便笺、原工作坊或连续身体来源。');
 const result=replayKnowledgeEmperorCombatRound(source,stance),o=result.round.knowledgeEmperorOutcome!,c=s.combat!,e=s.knowledgeEmperor.encounter;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery={...o.masteryAfter};
 e.enemyHealth=o.enemyHealth;e.enemyMind=o.enemyMind;e.enemySpirituality=o.enemySpirituality;e.enemyStatus=o.enemyStatus;e.enemyInjuries=structuredClone(o.enemyInjuriesAfter);e.enemyRisk=o.enemyRiskAfter;e.weaponLocation=o.enemyStatus==='RESISTING'?'HAND':'YARD';e.powerUses={...o.powerUses};e.currentSite=structuredClone(o.siteAfter);e.workshop=structuredClone(o.workshopAfter);e.note=structuredClone(o.noteAfter);e.marks=structuredClone(o.marksAfter);e.lastForceReceipt=structuredClone(o.lastForceReceipt);e.conditionVersion=o.conditionVersion;
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuriesAfter);c.enemyRisk=o.enemyRiskAfter;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveKnowledgeEmperorSliceCombatRound=resolveKnowledgeEmperorCombatRound;
export { validateKnowledgeEmperorCombatRound as validateKnowledgeEmperorRecordedRound } from '../knowledge-emperor/combat.js';
