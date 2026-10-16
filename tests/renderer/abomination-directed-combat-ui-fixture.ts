import { expect, vi } from 'vitest';
import { currentAbominationCombatSource, replayAbominationCombatRound } from '../../src/domain/abomination/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Explicit DIRECTED PRESENTATION fixture, not a natural or saved campaign.
 * The real first-combat source is read-only. These declared draws create exactly
 * one cry followed by one paid MENTAL spike so the renderer can exercise the
 * otherwise unobserved three-second row. No result is written into a SliceState,
 * a capture, a save, or a commit receipt. The natural capture remains unchanged.
 * The identical declaration is covered by the independent combat-rule tests.
 */
export function directedCryPresentationRound(state: SliceState): SliceCombatRound {
  const before = JSON.stringify(state), source = currentAbominationCombatSource(state);
  if (!source) throw new Error('The directed presentation needs a real available first-combat source.');
  const draws = [1, 1, 501, 1, 100, 1, 1_000_000];
  let cursor = 0;
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max);
    const draw = draws[cursor++];
    if (draw === undefined || draw < min || draw > max) throw new Error(`Unexpected directed presentation draw ${draw} in ${min}..${max}`);
    return draw;
  });
  try {
    const result = replayAbominationCombatRound(source, 'CONTROL');
    expect(cursor).toBe(draws.length); expect(JSON.stringify(state)).toBe(before);
    expect(result.round.consequenceDomain).toBe('MENTAL');
    expect(result.round.abominationOutcome).toMatchObject({ elapsedSeconds: 63, hesitationSeconds: 3, cryApplications: 1, barrierApplications: 0,
      piece: { charges: 2, wear: 1 }, enemySpirituality: source.body.enemySpirituality - 7 });
    return result.round;
  } finally { spy.mockRestore(); }
}
