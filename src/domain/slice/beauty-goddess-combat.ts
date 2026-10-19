import { currentBeautyGoddessCombatSource, replayBeautyGoddessCombatRound, validBeautyGoddessCombatSource } from '../beauty-goddess/combat.js';
import { combatBody } from '../beauty-goddess/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor, old material identities and finite continuous bodies. */
export function resolveBeautyGoddessCombatRound(s:SliceState,stance:SliceStance){
 const source=currentBeautyGoddessCombatSource(s);if(!source||!validBeautyGoddessCombatSource(source))throw new Error('缺少同一独立对手、原杆、实际石院或连续资源来源。');
 const result=replayBeautyGoddessCombatRound(source,stance),o=result.round.beautyGoddessOutcome!,c=s.combat!;
 s.health=o.playerHealthAfter;s.mind=o.playerMindAfter;s.spirituality=o.playerSpiritualityAfter;s.injuries=structuredClone(o.playerInjuriesAfter);s.injuryRisk=o.playerRiskAfter;s.progression.mastery=structuredClone(o.masteryAfter);
 Object.assign(s.beautyGoddess.encounter,combatBody(o));s.beautyGoddess.encounter.scene=structuredClone(o.rootAfter);s.beautyGoddess.encounter.materials=structuredClone(o.materialsAfter);
 for(const value of o.papers){const original=s.witchKing.life.papers.find(p=>p.id===value.id);if(!original)throw new Error('同一原纸已不存在。');original.status=value.status;original.consumedWeek=value.consumedWeek;original.consumedBy=value.consumedBy;original.combatRound=value.combatRound;}
 c.enemyHealth=o.enemyHealth;c.enemyMind=o.enemyMind;c.enemyInjuries=structuredClone(o.enemyInjuries);c.enemyRisk=o.enemyRisk;c.enemyStatus=o.enemyStatus;c.lastRound=result.round;s.lastCombatRound=result.round;c.round++;s.random.cursor=o.randomCursorAfter;
 if(result.outcome==='CONTINUE')s.spirituality=Math.min(120,s.spirituality+12);return result;
}
export const resolveBeautyGoddessSliceCombatRound=resolveBeautyGoddessCombatRound;
export { validateBeautyGoddessCombatRound as validateBeautyGoddessRecordedRound } from '../beauty-goddess/combat.js';
