import { currentBarrenMatriarchCombatSource, replayBarrenMatriarchCombatRound, validBarrenMatriarchCombatSource } from '../barren-matriarch/combat.js';
import { combatBody } from '../barren-matriarch/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** One original seed/cursor, inherited Mother20/15/20/45 core and original physical objects. */
export function resolveBarrenMatriarchCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentBarrenMatriarchCombatSource(s);
  if (!source || !validBarrenMatriarchCombatSource(source)) throw new Error('缺少同一原对手、已净空原现场或真实原资源记录。');
  const result = replayBarrenMatriarchCombatRound(source, stance), o = result.round.barrenMatriarchOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter); s.barrenMatriarch.life.rootPad = structuredClone(o.rootPadAfter);
  Object.assign(s.barrenMatriarch.encounter, combatBody(o)); s.coffinBearer.life = structuredClone(o.rootAfter) as SliceState['coffinBearer']['life'];
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveBarrenMatriarchSliceCombatRound = resolveBarrenMatriarchCombatRound;
