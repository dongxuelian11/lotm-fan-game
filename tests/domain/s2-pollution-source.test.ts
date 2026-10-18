import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, assertValidSliceState } from '../../src/domain/slice/index.js';
import { validateSeerState } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
function unitBottle(s: SliceState, stage: 'miracleWorker' | 'weatherWarlock' | 'lifeGiver' | 'concealmentServant' | 'wisdomAngel') {
  // Miracle bottles are normally brewed, so this deliberately invalid unit-only
  // shell isolates the common predicate without pretending to have brewed one.
  if (stage === 'miracleWorker') s.miracleWorker.bottles.push({ id: 'unit-unbrewed', batchId: 'unit-none', inputIds: [], brewedWeek: 1, status: 'CONSUMED', consumedWeek: 1, outcome: null, restorationId: null });
  return s[stage].bottles[0]!;
}

/** Narrow unit coverage of the shared rejection-origin predicate. These altered
 * ordinary roots are deliberately not valid whole campaign saves: the owning
 * stage still verifies source, paid acquisition, timing and consumption. No
 * natural fixture or random cursor is edited by these tests. */
describe('S2 shared potion rejection origins remain distinct from stage validity', () => {
  for (const stage of ['miracleWorker', 'weatherWarlock', 'lifeGiver', 'concealmentServant', 'wisdomAngel'] as const) {
    it.each(['FAILURE', 'GREAT_FAILURE'] as const)(`${stage} recognises its own %s without an unrelated earlier failure`, tier => {
      const s = createSliceRun(`origin-${stage}-${tier}`, sliceDefaultCreationSelection, 'origin-unit-only');
      assertValidSliceState(s);
      s.seer.pollution = 30;
      expect(validateSeerState(s)).toBe(false);
      const bottle = unitBottle(s, stage);
      bottle.outcome = tier;
      expect(validateSeerState(s)).toBe(true);
      // A matching failure label alone never authorises a forged whole save.
      expect(() => assertValidSliceState(s)).toThrow();
      bottle.outcome = null;
      expect(validateSeerState(s)).toBe(false);
    });
    it(`${stage} does not use a successful bottle to justify unaccounted pollution`, () => {
      const s = createSliceRun(`origin-${stage}-success`, sliceDefaultCreationSelection, 'origin-unit-only');
      s.seer.pollution = 30;
      unitBottle(s, stage).outcome = 'SUCCESS';
      expect(validateSeerState(s)).toBe(false);
    });
  }
});
