import { currentAttendantMysteriesCombatSource, replayAttendantMysteriesCombatRound, validAttendantMysteriesCombatSource } from '../attendant-mysteries/combat.js';
import { combatBody } from '../attendant-mysteries/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** One original seed/cursor and one continuous body; old resource ledgers are untouched. */
export function resolveAttendantMysteriesCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentAttendantMysteriesCombatSource(s);
  if (!source || !validAttendantMysteriesCombatSource(source)) throw new Error('缺少同一原对手、真实空地、已购物料或连续来源记录。');
  const result = replayAttendantMysteriesCombatRound(source, stance), o = result.round.attendantMysteriesOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter);
  Object.assign(s.attendantMysteries.encounter, combatBody(o)); s.attendantMysteries.encounter.scene = structuredClone(o.rootAfter); s.attendantMysteries.encounter.remnant = structuredClone(o.remnantAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveAttendantMysteriesSliceCombatRound = resolveAttendantMysteriesCombatRound;
