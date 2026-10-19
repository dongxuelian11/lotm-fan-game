import assert from 'node:assert/strict';
import { createWheelOfFortuneState } from '../../src/domain/wheel-of-fortune/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema223 addition before comparing older captures. */
export function assertEmptyWheelOfFortuneState(state: Pick<SliceState, 'wheelOfFortune'>): void {
  const empty: SliceState['wheelOfFortune'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createWheelOfFortuneState(), empty);
  assert.equal(Object.hasOwn(state, 'wheelOfFortune'), true);
  assert.deepEqual(state.wheelOfFortune, empty);
}
