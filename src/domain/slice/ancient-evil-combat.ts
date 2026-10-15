import type { MadmanBurstPolicy } from '../madman/combat.js';
import { currentAncientEvilCombatSource, replayAncientEvilCombatRound, validAncientEvilCombatSource } from '../ancient-evil/combat.js';
import { combatBody } from '../ancient-evil/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** Preserve the original source, seed, cursor, six-slot weights and CHAINED 50/20/15/15 core. */
export function resolveAncientEvilCombatRound(s: SliceState, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD') {
  const source = currentAncientEvilCombatSource(s);
  if (!source || !validAncientEvilCombatSource(source)) throw new Error('缺少同一原莱娜、已净空原室或真实资源记录。');
  const result = replayAncientEvilCombatRound(source, stance, cursePolicy, madmanPolicy), o = result.round.ancientEvilOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter;
  Object.assign(s.ancientEvil.encounter, combatBody(o)); s.silentDisciple.life = structuredClone(o.rootAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveAncientEvilSliceCombatRound = resolveAncientEvilCombatRound;
