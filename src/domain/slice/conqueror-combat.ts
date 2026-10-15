import { currentConquerorCombatSource, replayConquerorCombatRound, validConquerorCombatSource } from '../conqueror/combat.js';
import { combatBody } from '../conqueror/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor and continuous original bodies; no team or old-resource mutation. */
export function resolveConquerorCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentConquerorCombatSource(s);
  if (!source || !validConquerorCombatSource(source)) throw new Error('缺少同一独立对手、原铁杖水源、实际外院或连续来源记录。');
  const result = replayConquerorCombatRound(source, stance), o = result.round.conquerorOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter);
  Object.assign(s.conqueror.encounter, combatBody(o)); s.conqueror.encounter.scene = structuredClone(o.rootAfter); s.conqueror.encounter.materials = structuredClone(o.materialsAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveConquerorSliceCombatRound = resolveConquerorCombatRound;
