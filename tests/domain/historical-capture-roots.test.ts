import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import {
  hash, sha, same, historicalDarknessPublic, historicalDarknessState, migrateCapturedDarknessState,
  type Boundary as DarknessBoundary, type HistoricalDarknessState,
} from '../helpers/darkness-capture.js';
import {
  capturePublic, historicalMoonPublic, historicalMoonState, migrateCapturedMoonState,
  type Boundary as MoonBoundary, type HistoricalMoonState,
} from '../helpers/moon-capture.js';
import {
  assertCapturedGlobal as assertCapturedDeathGlobal, assertCurrentGlobal as assertCurrentDeathGlobal,
  historicalDeathPublic, historicalDeathState, readActionAt as readDeathActionAt,
} from '../helpers/death-capture.js';

// Published members exercise exact comparison adapters without campaign replay.
// Full campaign authentication/replay remains mandatory in the existing suites.
describe('Exact historical capture root adapters', () => {
  it('preserves raw210 Darkness680 and rejects every altered addition or historical field', () => {
    const path = 'tests/fixtures/darkness-v02130/boundary-680-darkness-learn_guidance.json.gz';
    const pin = '244055724e180d9629adc945354f0e5cbe5c9624fcbe06d765f0b95264dfc1f0';
    const bytes = readFileSync(path); expect(sha(bytes)).toBe(pin);
    const boundary = JSON.parse(gunzipSync(bytes).toString('utf8')) as DarknessBoundary;
    const raw = boundary.beforeLast, rawHash = hash(raw);
    expect(rawHash).toBe(boundary.audit.beforeStateSha256);
    const current = migrateCapturedDarknessState(raw), currentHash = hash(current);
    const additions = ['whiteTower', 'tyrant', 'sun', 'death', 'door'] as const;
    expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), ...additions].sort());
    same(historicalDarknessState(current), raw);
    for (const root of additions) {
      expect(Object.hasOwn(raw, root)).toBe(false);
      for (const value of [null, { ...current[root], guidanceKnown: true },
        { ...current[root], unexpected: undefined },
        { ...current[root], promotionStability: { preparations: [], unexpected: undefined } }]) {
        expect(() => historicalDarknessState({ ...current, [root]: value } as SliceState)).toThrow();
      }
      const missing = { ...current }; Reflect.deleteProperty(missing, root);
      expect(() => historicalDarknessState(missing)).toThrow();
      expect(() => migrateCapturedDarknessState({ ...raw, [root]: current[root] })).toThrow();
    }
    expect(() => migrateCapturedDarknessState({ ...raw, unexpectedRoot: null } as HistoricalDarknessState)).toThrow();
    expect(() => same(historicalDarknessState({ ...current, cash: current.cash + 1 }), raw)).toThrow();
    expect(() => same(historicalDarknessState({ ...current, unexpectedRoot: null } as SliceState), raw)).toThrow();
    const projection = projectSliceState(current), publicHash = hash(projection);
    const historical = historicalDarknessPublic(projection, current);
    expect(Object.keys(historical).sort()).toEqual(Object.keys(projection).filter(key => !additions.includes(key as typeof additions[number])).sort());
    for (const root of additions) {
      const missing = { ...projection }; Reflect.deleteProperty(missing, root);
      expect(() => historicalDarknessPublic(missing, current)).toThrow();
      for (const value of [{ ...projection[root], promoted: true }, { ...projection[root], unexpected: undefined },
        { ...projection[root], actions: [{ ...projection[root].actions[0]!, enabled: true }] },
        { ...projection[root], resources: { ...projection[root].resources, cash: 'forged' } }]) {
        expect(() => historicalDarknessPublic({ ...projection, [root]: value }, current)).toThrow();
      }
    }
    expect(() => same(historicalDarknessPublic({ ...projection, cash: projection.cash + 1 }, current), historical)).toThrow();
    expect(() => same(historicalDarknessPublic({ ...projection, unexpectedRoot: null } as SliceProjection, current), historical)).toThrow();
    expect(hash(raw)).toBe(rawHash); expect(hash(current)).toBe(currentHash); expect(hash(projection)).toBe(publicHash);
    expect(sha(readFileSync(path))).toBe(pin);
    // Any unrelated public/privacy drift remains a real failure, never normalized.
    expect(hash(historical)).toBe(boundary.audit.globalPublicBeforeSha256);
  }, 60_000);

  it('preserves raw209 Moon671 and rejects altered additions, old fields and unknown roots', () => {
    const path = 'tests/fixtures/moon-v02120/boundary-671-first-ordinary-rest.json.gz';
    const pin = '7ef790a4d05422e4743293771f613198198437ca8f0576ce09d8a41bb770991d';
    const bytes = readFileSync(path); expect(sha(bytes)).toBe(pin);
    const boundary = JSON.parse(gunzipSync(bytes).toString('utf8')) as MoonBoundary;
    const raw = boundary.final, rawHash = hash(raw);
    expect(rawHash).toBe(boundary.audit.afterStateSha256);
    const current = migrateCapturedMoonState(raw), currentHash = hash(current);
    const additions = ['darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door'] as const;
    expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), ...additions].sort());
    same(historicalMoonState(current), raw);
    for (const root of additions) {
      expect(Object.hasOwn(raw, root)).toBe(false);
      for (const value of [null, { ...current[root], guidanceKnown: true },
        { ...current[root], unexpected: undefined },
        { ...current[root], promotionStability: { preparations: [], unexpected: undefined } }]) {
        expect(() => historicalMoonState({ ...current, [root]: value } as SliceState)).toThrow();
      }
      const missing = { ...current }; Reflect.deleteProperty(missing, root);
      expect(() => historicalMoonState(missing)).toThrow();
      expect(() => migrateCapturedMoonState({ ...raw, [root]: current[root] })).toThrow();
    }
    expect(() => migrateCapturedMoonState({ ...raw, unexpectedRoot: null } as HistoricalMoonState)).toThrow();
    expect(() => same(historicalMoonState({ ...current, cash: current.cash + 1 }), raw)).toThrow();
    expect(() => same(historicalMoonState({ ...current, unexpectedRoot: null } as SliceState), raw)).toThrow();
    const projection = projectSliceState(current), publicHash = hash(projection);
    const historical = historicalMoonPublic(projection, current);
    expect(Object.keys(historical).sort()).toEqual(Object.keys(projection).filter(key => !additions.includes(key as typeof additions[number])).sort());
    for (const root of additions) {
      const missing = { ...projection }; Reflect.deleteProperty(missing, root);
      expect(() => historicalMoonPublic(missing, current)).toThrow();
      for (const value of [{ ...projection[root], promoted: true }, { ...projection[root], unexpected: undefined },
        { ...projection[root], actions: [{ ...projection[root].actions[0]!, enabled: true }] },
        { ...projection[root], resources: { ...projection[root].resources, cash: 'forged' } }]) {
        expect(() => historicalMoonPublic({ ...projection, [root]: value }, current)).toThrow();
      }
    }
    expect(() => same(historicalMoonPublic({ ...projection, cash: projection.cash + 1 }, current), historical)).toThrow();
    expect(() => same(historicalMoonPublic({ ...projection, unexpectedRoot: null } as SliceProjection, current), historical)).toThrow();
    same(capturePublic(projection, current), boundary.public);
    expect(hash(raw)).toBe(rawHash); expect(hash(current)).toBe(currentHash); expect(hash(projection)).toBe(publicHash);
    expect(sha(readFileSync(path))).toBe(pin);
  }, 60_000);

  it('preserves raw214 Death1039 and admits only the exact schema215 Door addition', () => {
    const action = readDeathActionAt(1039), raw = action.beforeLast, rawHash = hash(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([214, 'death-v214']);
    expect(rawHash).toBe(action.audit.beforeStateSha256); expect(Object.hasOwn(raw, 'door')).toBe(false);
    const current = migrateSliceState(raw), currentHash = hash(current);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), 'door'].sort());
    same(historicalDeathState(current), raw);
    const missing = { ...current }; Reflect.deleteProperty(missing, 'door');
    expect(() => historicalDeathState(missing)).toThrow();
    for (const door of [null, { ...current.door, guidanceKnown: true },
      { ...current.door, unexpected: undefined },
      { ...current.door, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => historicalDeathState({ ...current, door } as SliceState)).toThrow();
    expect(() => migrateSliceState({ ...raw, door: current.door })).toThrow();
    expect(() => same(historicalDeathState({ ...current, cash: current.cash + 1 }), raw)).toThrow();
    expect(() => same(historicalDeathState({ ...current, unexpectedRoot: null } as SliceState), raw)).toThrow();
    const projection = projectSliceState(current), publicHash = hash(projection);
    same(historicalDeathPublic(projection, current), action.globalPublicBefore);
    expect(hash(historicalDeathPublic(projection, current))).toBe(action.audit.globalPublicBeforeSha256);
    assertCapturedDeathGlobal(action.globalPublicBefore, action, 'before');
    assertCurrentDeathGlobal(projection, action, 'before');
    expect(() => assertCapturedDeathGlobal(projection, action, 'before')).toThrow();
    expect(() => assertCurrentDeathGlobal(action.globalPublicBefore, action, 'before')).toThrow();
    const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, 'door');
    expect(() => historicalDeathPublic(missingPublic, current)).toThrow();
    for (const door of [null, { ...projection.door, promoted: true },
      { ...projection.door, unexpected: undefined },
      { ...projection.door, actions: [{ ...projection.door.actions[0]!, enabled: true }] },
      { ...projection.door, resources: { ...projection.door.resources, cash: 'forged' } }]) {
      expect(() => historicalDeathPublic({ ...projection, door } as SliceProjection, current)).toThrow();
      expect(() => assertCurrentDeathGlobal({ ...projection, door } as SliceProjection, action, 'before')).toThrow();
    }
    expect(() => assertCurrentDeathGlobal({ ...projection, cash: projection.cash + 1 }, action, 'before')).toThrow();
    expect(() => assertCurrentDeathGlobal({ ...projection, unexpectedRoot: null } as SliceProjection, action, 'before')).toThrow();
    expect(hash(raw)).toBe(rawHash); expect(hash(current)).toBe(currentHash); expect(hash(projection)).toBe(publicHash);
  }, 120_000);

});
