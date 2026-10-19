import type { WinnerLuckPolicy } from '../winner/types.js';
import { currentFateProphetCombatSource, replayFateProphetCombatRound, validFateProphetCombatSource } from '../fate-prophet/combat.js';
import { combatBody } from '../fate-prophet/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** One original seed/cursor, inherited Wheel15/20/40/25 core and one actual luck ledger. */
export function resolveFateProphetCombatRound(s: SliceState, stance: SliceStance, winnerPolicy: WinnerLuckPolicy = 'HOLD') {
  const source = currentFateProphetCombatSource(s);
  if (!source || !validFateProphetCombatSource(source)) throw new Error('缺少同一原洛温、已净空原现场或真实原资源记录。');
  const result = replayFateProphetCombatRound(source, stance, winnerPolicy), o = result.round.fateProphetOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.winner.luck = { ...o.luckAfter };
  Object.assign(s.fateProphet.encounter, combatBody(o)); s.chaosWalker.life = structuredClone(o.rootAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveFateProphetSliceCombatRound = resolveFateProphetCombatRound;
