import { assertEmptyDemonessState, assertEmptyDemonessPublic, historicalInactiveCalamitySourcePublic } from './empty-demoness-capture.js';
import assert from 'node:assert/strict';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyDeathState, assertEmptyDoorState, assertEmptyDoorPublic } from './empty-death-capture.js';
import { assertEmptyErrorAscentState, assertEmptyErrorAscentPublic } from './empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from './empty-twilight-giant-capture.js';
import { assertEmptyHermitState, assertEmptyHermitPublic } from './empty-hermit-capture.js';
import { assertEmptyHangedManState, assertEmptyHangedManPublic } from './empty-hanged-man-capture.js';
import { assertEmptyAbyssState, assertEmptyAbyssPublic } from './empty-abyss-capture.js';

/** Test-only exact historical audit seams, never a production migration.
 * Only these three published formats are supported. Callers authenticate the
 * original fixture before passing its complete original keys. No old field is
 * omitted, renamed, rewritten, or selected from a generic current-key list. */
export const EMPTY_RED_PRIEST: SliceState['redPriest'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  campaign: null, materials: null, epilogue: null, journal: [],
};
export const EMPTY_VISIONARY: SliceState['visionary'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  era: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_PERFECTER: SliceState['perfecter'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  works: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_MOON: SliceState['moon'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_DARKNESS: SliceState['darkness'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_WHITE_TOWER: SliceState['whiteTower'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_TYRANT: SliceState['tyrant'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null,
  journal: [], promotionStability: { preparations: [] },
};
export const EMPTY_SUN: SliceState['sun'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};

const EARLY_EMPTY_ROOTS = {
  redPriest: EMPTY_RED_PRIEST, visionary: EMPTY_VISIONARY, perfecter: EMPTY_PERFECTER,
  moon: EMPTY_MOON, darkness: EMPTY_DARKNESS, whiteTower: EMPTY_WHITE_TOWER,
  tyrant: EMPTY_TYRANT, sun: EMPTY_SUN,
};
const FOOL_ADDITIONS = ['redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss'] as const;
const VISIONARY_ADDITIONS = ['perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss'] as const;
const PERFECTER_ADDITIONS = ['moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss'] as const;
type AddedRoot = typeof FOOL_ADDITIONS[number];

function exactView(current: SliceState, originalKeys: readonly string[], additions: readonly AddedRoot[],
  format: readonly [205 | 207 | 208, 'fool-v205' | 'visionary-v207' | 'perfecter-v208']): Record<string, unknown> {
  assert.deepEqual([current.schemaVersion, current.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.equal(new Set(originalKeys).size, originalKeys.length);
  assert(originalKeys.includes('schemaVersion') && originalKeys.includes('contentVersion'));
  for (const root of additions) assert.equal(originalKeys.includes(root), false, `Unexpected historical root ${root}`);
  // Exact keys FIRST: an unknown/extra key, even undefined, must never disappear.
  assert.deepEqual(Object.keys(current).sort(), [...originalKeys, ...additions].sort());
  assertEmptyDeathState(current); assertEmptyDoorState(current); assertEmptyErrorAscentState(current); assertEmptyTwilightGiantState(current); assertEmptyDemonessState(current);
  assertEmptyHermitState(current); assertEmptyHangedManState(current); assertEmptyAbyssState(current);
  for (const root of additions) if (root !== 'death' && root !== 'door' && root !== 'errorAscent' && root !== 'twilightGiant' && root !== 'demoness' && root !== 'hermit' && root !== 'hangedMan' && root !== 'abyss') {
    assert.equal(Object.hasOwn(current, root), true);
    assert.deepEqual(current[root], EARLY_EMPTY_ROOTS[root]);
  }
  const originalFields: Record<string, unknown> = { ...current };
  for (const root of additions) delete originalFields[root];
  originalFields.schemaVersion = format[0]; originalFields.contentVersion = format[1];
  assert.deepEqual(Object.keys(originalFields).sort(), [...originalKeys].sort());
  return originalFields;
}

export function historicalFoolStateForEmptyRootAudit(current: SliceState, originalKeys: readonly string[]): Record<string, unknown> {
  return exactView(current, originalKeys, FOOL_ADDITIONS, [205, 'fool-v205']);
}
export function historicalVisionaryStateForEmptyRootAudit(current: SliceState, historical: Record<string, unknown>): Record<string, unknown> {
  assert.deepEqual([historical.schemaVersion, historical.contentVersion], [207, 'visionary-v207']);
  return exactView(current, Object.keys(historical), VISIONARY_ADDITIONS, [207, 'visionary-v207']);
}
export function historicalPerfecterStateForEmptyRootAudit(current: SliceState, historical: Record<string, unknown>): Record<string, unknown> {
  assert.deepEqual([historical.schemaVersion, historical.contentVersion], [208, 'perfecter-v208']);
  return exactView(current, Object.keys(historical), PERFECTER_ADDITIONS, [208, 'perfecter-v208']);
}

/** Remove only these SEVEN independently pinned empty public roots. All other public
 * fields, including unknown additions, stay in the caller's complete hash. */
export function historicalWithoutEmptyDoorAndErrorPublic(projection: SliceProjection, state: SliceState): Omit<SliceProjection, 'door' | 'errorAscent' | 'twilightGiant' | 'demoness' | 'hermit' | 'hangedMan' | 'abyss'> {
  assertEmptyDoorState(state); assertEmptyDoorPublic(projection, state);
  assertEmptyErrorAscentState(state); assertEmptyErrorAscentPublic(projection, state);
  assertEmptyTwilightGiantState(state); assertEmptyTwilightGiantPublic(projection, state);
  assertEmptyDemonessState(state); assertEmptyDemonessPublic(projection, state);
  assertEmptyHermitState(state); assertEmptyHermitPublic(projection, state);
  assertEmptyHangedManState(state); assertEmptyHangedManPublic(projection, state);
  assertEmptyAbyssState(state); assertEmptyAbyssPublic(projection, state);
  const { door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness,
    hermit: _emptyHermit, hangedMan: _emptyHangedMan, abyss: _emptyAbyss, ...allOtherFields } = historicalInactiveCalamitySourcePublic(projection, state);
  return allOtherFields;
}
