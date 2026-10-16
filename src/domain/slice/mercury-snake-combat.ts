import { currentMercurySnakeCombatSource, replayMercurySnakeCombatRound, validMercurySnakeCombatSource } from '../mercury-snake/combat.js';
import { mercurySnakeCombatBody } from '../mercury-snake/encounter.js';
import type { WinnerLuckPolicy } from '../winner/types.js';
import type { SliceStance, SliceState } from './types.js';
/** Only the new live root changes; old Rowan, all predecessor roots and old luck copies remain evidence. */
export function resolveMercurySnakeCombatRound(s: SliceState, stance: SliceStance, winnerPolicy: WinnerLuckPolicy = 'HOLD') {
  const source = currentMercurySnakeCombatSource(s); if (!source || !validMercurySnakeCombatSource(source)) throw new Error('缺少奥斯温、原现场、实际积运与有限物资来源。');
  const result = replayMercurySnakeCombatRound(source, stance, winnerPolicy), o = result.round.mercurySnakeOutcome!, c = s.combat!, e = s.mercurySnake.encounter;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = { ...o.masteryAfter };
  s.mercurySnake.luck = { ...o.luckAfter }; Object.assign(e, mercurySnakeCombatBody(o)); e.currentSite = structuredClone(o.siteAfter); s.mercurySnake.life.operation = structuredClone(o.operationAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveMercurySnakeSliceCombatRound = resolveMercurySnakeCombatRound;
export { validateMercurySnakeCombatRound as validateMercurySnakeRecordedRound } from '../mercury-snake/combat.js';
