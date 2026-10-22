import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {
  assertCurrentGlobal as assertCurrentDoorGlobal, historicalDoorPublic, historicalDoorState,
  readActionAt as readDoorActionAt, hash, same,
} from '../helpers/door-capture.js';
import {
  assertCurrentGlobal as assertCurrentSunGlobal, expectedCurrentGlobal as expectedCurrentSunGlobal,
  historicalSunPublic, historicalSunState, migrateCapturedSunState,
  readAction as readSunAction, readCheckpoint as readSunCheckpoint,
} from '../helpers/sun-capture.js';
import { captureHash, checkpoint, type BranchRoot } from '../helpers/red-priest-capture-fixture.js';

const POST218_ROOTS = ['hermit', 'hangedMan', 'abyss', 'chained',
  'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;

/** Snapshot-only migration contracts. No route replay, SQLite or full archive
 * scan; each reader still authenticates the real captured member and hashes. */
function rejectsChangedAdditions(state: SliceState, projection: SliceProjection,
  stateView: (state: SliceState) => object,
  publicView: (projection: SliceProjection, state: SliceState) => object): void {
  for (const key of POST218_ROOTS) {
    const missingState = { ...state }; Reflect.deleteProperty(missingState, key);
    const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, key);
    expect(() => stateView(missingState)).toThrow();
    expect(() => publicView(missingPublic, state)).toThrow();
    expect(() => stateView({ ...state, [key]: { ...state[key], unexpected: undefined } })).toThrow();
    expect(() => stateView({ ...state, [key]: { ...state[key], guidanceKnown: true } })).toThrow();
    expect(() => publicView({ ...projection, [key]: { ...projection[key], unexpected: undefined } }, state)).toThrow();
    expect(() => publicView({ ...projection, [key]: { ...projection[key], story: 'changed' } }, state)).toThrow();
  }
  // Unknown roots must survive the narrow adapter and fail full comparison,
  // including undefined values that JSON.stringify alone could silently drop.
  const privateView = stateView(state), historicalPublic = publicView(projection, state);
  expect(() => assert.deepEqual(stateView({ ...state, unexpectedPrivateRoot: undefined } as SliceState), privateView)).toThrow();
  expect(() => assert.deepEqual(publicView({ ...projection, unexpectedPublicRoot: undefined } as SliceProjection, state), historicalPublic)).toThrow();
}

describe('Current-schema capture-save migration contracts', () => {
  it('preserves the complete real Door928 state and public hashes through only exact empty additions', () => {
    const action = readDoorActionAt(928), raw = action.final, rawHash = hash(raw);
    const state = migrateSliceState(raw), projection = projectSliceState(state);
    const stateHash = hash(state), projectionHash = hash(projection);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(state).sort()).toEqual([...Object.keys(raw), 'errorAscent', 'twilightGiant', 'demoness', ...POST218_ROOTS].sort());
    same(historicalDoorState(state), raw);
    expect(hash(historicalDoorPublic(projection, state))).toBe(action.audit.globalPublicAfterSha256);
    assertCurrentDoorGlobal(projection, action, 'after');
    rejectsChangedAdditions(state, projection, historicalDoorState, historicalDoorPublic);
    expect(hash(raw)).toBe(rawHash); expect(hash(state)).toBe(stateHash); expect(hash(projection)).toBe(projectionHash);
  }, 30_000);

  it('preserves the complete real Sun934 snapshot and its exact reviewed public corrections', () => {
    const action = readSunAction(readSunCheckpoint().rows.at(-1)!), raw = action.final, rawHash = hash(raw);
    expect(action.commandCount).toBe(934);
    const state = migrateCapturedSunState(raw), projection = projectSliceState(state);
    const stateHash = hash(state), projectionHash = hash(projection);
    same(historicalSunState(state), raw);
    same(historicalSunPublic(projection, state), expectedCurrentSunGlobal(action, 'after'));
    assertCurrentSunGlobal(projection, action, 'after');
    rejectsChangedAdditions(state, projection, historicalSunState, historicalSunPublic);
    expect(hash(raw)).toBe(rawHash); expect(hash(state)).toBe(stateHash); expect(hash(projection)).toBe(projectionHash);
  }, 30_000);

  it('retains the exact real Red Priest918 private hash and rejects changed or unknown migration roots', () => {
    const root = checkpoint<BranchRoot>('fork/original-918-checkpoint.json'), rawHash = hash(root.state);
    const state = migrateSliceState(root.state), stateHash = hash(state);
    expect(captureHash(state, root.state)).toBe(root.finalStateSha256);
    for (const key of POST218_ROOTS) {
      const missing = { ...state }; Reflect.deleteProperty(missing, key);
      expect(() => captureHash(missing, root.state)).toThrow();
      expect(() => captureHash({ ...state, [key]: { ...state[key], unexpected: undefined } }, root.state)).toThrow();
      expect(() => captureHash({ ...state, [key]: { ...state[key], guidanceKnown: true } }, root.state)).toThrow();
      expect(() => captureHash(state, { ...root.state, [key]: state[key] })).toThrow();
    }
    expect(() => captureHash({ ...state, unexpectedPrivateRoot: undefined } as SliceState, root.state)).toThrow();
    expect(hash(root.state)).toBe(rawHash); expect(hash(state)).toBe(stateHash);
  }, 30_000);
});
