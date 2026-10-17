import { currentEntropyDukeCombatSource, replayEntropyDukeCombatRound, validEntropyDukeCombatSource } from '../entropy-duke/combat.js';
import { combatBody } from '../entropy-duke/encounter.js';
import type { SliceStance, SliceState } from './types.js';
/** One original seed/cursor, inherited Black Emperor35/15/20/30 core and original gift ledger. */
export function resolveEntropyDukeCombatRound(s: SliceState, stance: SliceStance) {
  const source = currentEntropyDukeCombatSource(s);
  if (!source || !validEntropyDukeCombatSource(source)) throw new Error('缺少同一原对手、已净空原现场或真实原资源记录。');
  const result = replayEntropyDukeCombatRound(source, stance), o = result.round.entropyDukeOutcome!, c = s.combat!;
  s.health = o.playerHealthAfter; s.mind = o.playerMindAfter; s.spirituality = o.playerSpiritualityAfter; s.injuries = structuredClone(o.playerInjuriesAfter); s.injuryRisk = o.playerRiskAfter; s.progression.mastery = structuredClone(o.masteryAfter); s.briber.gifts = structuredClone(o.giftsAfter);
  Object.assign(s.entropyDuke.encounter, combatBody(o)); s.frenzyMage.life = structuredClone(o.rootAfter);
  c.enemyHealth = o.enemyHealth; c.enemyMind = o.enemyMind; c.enemyInjuries = structuredClone(o.enemyInjuries); c.enemyRisk = o.enemyRisk; c.enemyStatus = o.enemyStatus;
  c.lastRound = result.round; s.lastCombatRound = result.round; c.round++; s.random.cursor = o.randomCursorAfter;
  if (result.outcome === 'CONTINUE') s.spirituality = Math.min(120, s.spirituality + 12);
  return result;
}
export const resolveEntropyDukeSliceCombatRound = resolveEntropyDukeCombatRound;
