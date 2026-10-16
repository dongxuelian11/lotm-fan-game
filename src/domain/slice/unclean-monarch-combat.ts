import { currentUncleanMonarchCombatSource, replayUncleanMonarchCombatRound, validUncleanMonarchCombatSource } from '../unclean-monarch/combat.js';
import type { SliceStance, SliceState } from './types.js';
/** Only the new live continuation changes. All eight original roots remain read-only. */
export function resolveUncleanMonarchCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentUncleanMonarchCombatSource(s); if (!source || !validUncleanMonarchCombatSource(source)) throw new Error('缺少哈伦、实际辅助片与刻片、当前情绪或连续身体来源。');
  const result = replayUncleanMonarchCombatRound(source, stance), o = result.round.uncleanMonarchOutcome!, c = s.combat!, e = s.uncleanMonarch.encounter;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = { ...o.masteryAfter };
  e.enemyHealth = o.enemyHealth; e.enemyMind = o.enemyMind; e.enemySpirituality = o.enemySpirituality; e.enemyStatus = o.enemyStatus; e.enemyInjuries = structuredClone(o.enemyInjuriesAfter); e.enemyRisk = o.enemyRiskAfter;
  e.weaponLocation = o.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD'; e.powerUses = { ...o.powerUses }; e.currentSite = structuredClone(o.siteAfter); e.strain = o.strainAfter;
  s.uncleanMonarch.life.operation = structuredClone(o.operationAfter); e.piece = structuredClone(o.pieceAfter); e.plates = structuredClone(o.platesAfter); e.lastForceReceipt = structuredClone(o.lastForceReceipt);
  e.conditionVersion = o.conditionVersion; e.emotion = o.emotion; e.emotionObservedAt = o.emotionObservedAt;
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuriesAfter); c.enemyRisk = o.enemyRiskAfter; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveUncleanMonarchSliceCombatRound = resolveUncleanMonarchCombatRound;
export { validateUncleanMonarchCombatRound as validateUncleanMonarchRecordedRound } from '../unclean-monarch/combat.js';
