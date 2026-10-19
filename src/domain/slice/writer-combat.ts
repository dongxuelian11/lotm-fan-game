import { currentWriterCombatSource, replayWriterCombatRound, validWriterCombatSource } from '../writer/combat.js';
import { combatBody } from '../writer/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor and continuous original bodies; no team or old-resource mutation. */
export function resolveWriterCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentWriterCombatSource(s);
  if (!source || !validWriterCombatSource(source)) throw new Error('缺少同一独立对手、原杖、实际石院或连续来源记录。');
  const result = replayWriterCombatRound(source, stance), o = result.round.writerOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter);
  Object.assign(s.writer.encounter, combatBody(o)); s.writer.encounter.scene = structuredClone(o.rootAfter); s.writer.encounter.materials = structuredClone(o.materialsAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveWriterSliceCombatRound = resolveWriterCombatRound;
