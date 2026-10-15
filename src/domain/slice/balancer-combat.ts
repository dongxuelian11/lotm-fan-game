import { currentBalancerCombatSource, replayBalancerCombatRound, validBalancerCombatSource } from '../balancer/combat.js';
import { combatBody } from '../balancer/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** One original seed/cursor, inherited Justiciar30/20/35/15 core and original physical objects. */
export function resolveBalancerCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentBalancerCombatSource(s);
  if (!source || !validBalancerCombatSource(source)) throw new Error('缺少同一原对手、已净空原现场或真实原资源记录。');
  const result = replayBalancerCombatRound(source, stance), o = result.round.balancerOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter); s.balancer.life.guardPlate = structuredClone(o.guardPlateAfter);
  Object.assign(s.balancer.encounter, combatBody(o)); s.chaosHunter.life = structuredClone(o.rootAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveBalancerSliceCombatRound = resolveBalancerCombatRound;
