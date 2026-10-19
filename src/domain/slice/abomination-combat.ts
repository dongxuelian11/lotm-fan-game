import { currentAbominationCombatSource, replayAbominationCombatRound, validAbominationCombatSource } from '../abomination/combat.js';
import { abominationCombatBody } from '../abomination/encounter.js';
import type { MadmanBurstPolicy } from '../madman/combat.js';
import type { SliceStance, SliceState } from './types.js';
/** Only the new live continuation changes. All eight original roots remain read-only. */
export function resolveAbominationCombatRound(s: SliceState, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD') {
  const source = currentAbominationCombatSource(s); if (!source || !validAbominationCombatSource(source)) throw new Error('缺少罗德里克、有限原物与持续完整身体来源。');
  const result = replayAbominationCombatRound(source, stance, cursePolicy, madmanPolicy), o = result.round.abominationOutcome!, c = s.combat!, e = s.abomination.encounter;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = { ...o.masteryAfter };
  Object.assign(e, abominationCombatBody(o)); e.currentSite = structuredClone(o.siteAfter); s.abomination.life.operation = structuredClone(o.operationAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveAbominationSliceCombatRound = resolveAbominationCombatRound;
export { validateAbominationCombatRound as validateAbominationRecordedRound } from '../abomination/combat.js';
