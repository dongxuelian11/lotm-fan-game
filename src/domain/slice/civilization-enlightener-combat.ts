import { currentCivilizationEnlightenerCombatSource, replayCivilizationEnlightenerCombatRound, validCivilizationEnlightenerCombatSource } from '../civilization-enlightener/combat.js';
import { combatBody } from '../civilization-enlightener/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Same seed/cursor and continuous original bodies; no new team or replacement resource pool. */
export function resolveCivilizationEnlightenerCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentCivilizationEnlightenerCombatSource(s);
  if (!source || !validCivilizationEnlightenerCombatSource(source)) throw new Error('缺少同一独立对手、原杆、实际工院或连续来源记录。');
  const result = replayCivilizationEnlightenerCombatRound(source, stance), o = result.round.civilizationEnlightenerOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter);
  Object.assign(s.civilizationEnlightener.encounter, combatBody(o)); s.civilizationEnlightener.encounter.scene = structuredClone(o.rootAfter); s.civilizationEnlightener.encounter.materials = structuredClone(o.materialsAfter);
  for (const value of o.creations) {
    const original = s.alchemist.life.creations.find(x => x.id === value.id);
    if (!original || original.location !== 'YARD') throw new Error('同一原件已不在真实现场。');
    original.charge = value.charge; original.durability = value.durability; original.active = value.active;
  }
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveCivilizationEnlightenerSliceCombatRound = resolveCivilizationEnlightenerCombatRound;
