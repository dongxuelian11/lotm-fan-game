import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectElderRoundOutcome } from '../../src/domain/elder/combat.js';
import { projectBlackKnightRoundOutcome } from '../../src/domain/black-knight/combat.js';
import { projectThreeHeadedTemplarRoundOutcome } from '../../src/domain/three-headed-templar/combat.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const privateKeys = new Set(['random', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter', 'cursorBefore', 'cursorAfter']);
function noPrivate(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(privateKeys.has(key), key).toBe(false);
    if (key === 'source' && child !== null) expect(typeof child).toBe('string');
    noPrivate(child);
  }
}
function expectedOutcome(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expectedOutcome);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key, child]) => !privateKeys.has(key) && !(key === 'source' && child !== null && typeof child === 'object')).map(([key, child]) => [key, expectedOutcome(child)]));
}

describe('Hanged Man original 723-command inherited public evidence', () => {
  it('projects the authentic checkpoint with public Elder preparation and three historical outcomes, without changing private evidence', () => {
    // One static saved checkpoint, migrated once. No replay, outcome selection, gameplay or RNG calls.
    const state = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/dark-angel-v02010/boundary-consume-dark-angel-potion-3.json', 'final'));
    expect(state.revision).toBe(724);
    const before = digest(state), rng = structuredClone(state.random), projected = projectSliceState(state);
    noPrivate(projected);
    const preparation = state.elder.encounter.preparation!;
    expect(preparation).toBeTruthy();
    expect(projected.elder.encounter.preparation).toEqual({ week: preparation.week, revision: preparation.revision, mindPaid: preparation.mindPaid, lifeClockSeconds: preparation.lifeClockSeconds, before: preparation.before, after: preparation.after });
    let elder = 0, blackKnight = 0, templar = 0;
    state.combatHistory.forEach((round, index) => {
      const publicRound = projected.combatHistory[index]!;
      if (round.elderOutcome) {
        elder++;
        const visible = projectElderRoundOutcome(round.elderOutcome);
        expect(visible).toEqual(expectedOutcome(round.elderOutcome));
        expect(publicRound.elderOutcome).toEqual(projectPlayerText(visible, state.character.name));
      }
      if (round.blackKnightOutcome) {
        blackKnight++;
        const visible = projectBlackKnightRoundOutcome(round.blackKnightOutcome);
        expect(visible).toEqual(expectedOutcome(round.blackKnightOutcome));
        expect(publicRound.blackKnightOutcome).toEqual(projectPlayerText(visible, state.character.name));
      }
      if (round.threeHeadedTemplarOutcome) {
        templar++;
        const visible = projectThreeHeadedTemplarRoundOutcome(round.threeHeadedTemplarOutcome);
        expect(visible).toEqual(expectedOutcome(round.threeHeadedTemplarOutcome));
        expect(publicRound.threeHeadedTemplarOutcome).toEqual(projectPlayerText(visible, state.character.name));
      }
    });
    expect(elder).toBeGreaterThan(0); expect(blackKnight).toBeGreaterThan(0); expect(templar).toBeGreaterThan(0);
    expect(projected.lastCombatRound?.elderOutcome).toEqual(projected.combatHistory.at(-1)?.elderOutcome);
    expect(digest(state)).toBe(before); expect(state.random).toEqual(rng);
    projected.elder.encounter.preparation!.before.mind++;
    const firstElder = projected.combatHistory.find(round => round.elderOutcome?.playerActions.length)!.elderOutcome!;
    firstElder.playerActions[0]!.rolls.length = 0;
    firstElder.rootAfter.spirits['THT3-HELENA'].knownAbilities.length = 0;
    expect(digest(state)).toBe(before);
  }, 120_000);
});
