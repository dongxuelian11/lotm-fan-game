import assert from 'node:assert/strict';
import { createBlackEmperorState } from '../../src/domain/black-emperor/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema224 addition before comparing older captures. */
export function assertEmptyBlackEmperorState(state: Pick<SliceState, 'blackEmperor'>): void {
  const empty: SliceState['blackEmperor'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createBlackEmperorState(), empty);
  assert.equal(Object.hasOwn(state, 'blackEmperor'), true);
  assert.deepEqual(state.blackEmperor, empty);
}
