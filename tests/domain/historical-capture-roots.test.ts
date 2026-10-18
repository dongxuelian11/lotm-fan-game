import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import {
  hash, sha, same, historicalDarknessPublic, historicalDarknessState, migrateCapturedDarknessState,
  type Boundary as DarknessBoundary, type HistoricalDarknessState,
} from '../helpers/darkness-capture.js';
import {
  capturePublic, historicalMoonPublic, historicalMoonState, migrateCapturedMoonState,
  type Boundary as MoonBoundary, type HistoricalMoonState,
} from '../helpers/moon-capture.js';

// The two published members are sufficient to exercise the comparison adapters.
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
    const additions = ['whiteTower', 'tyrant', 'sun'] as const;
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
    const additions = ['darkness', 'whiteTower', 'tyrant', 'sun'] as const;
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
});
