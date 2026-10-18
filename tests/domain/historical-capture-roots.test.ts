import { createHash } from 'node:crypto';
import { stableStringify } from '../../src/domain/canonical.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { historicalFoolStateForEmptyRootAudit, historicalVisionaryStateForEmptyRootAudit,
  historicalPerfecterStateForEmptyRootAudit, historicalWithoutEmptyDoorPublic } from '../helpers/historical-empty-root-audit.js';
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

// These exact three retained inputs are enough to exercise the same audit
// adapters called by the complete historical suites; no long-capture hooks or
// producer are imported. This does not claim full old campaign authentication.
const canonicalHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
const smallHistoricalAliases = [
  { name: 'preserves raw205 Fool2084 through the exact empty Door audit seam',
    path: 'tests/fixtures/fool-v02080/natural.json', entry: 'final', bytes: 37252637,
    pin: '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959',
    schema: 205, content: 'fool-v205', revision: 2084,
    rawHash: '66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a',
    fingerprint: canonicalHash,
    view: (state: SliceState, raw: Record<string, unknown>) => historicalFoolStateForEmptyRootAudit(state, Object.keys(raw)) },
  { name: 'preserves raw207 Visionary660 through the exact empty Door audit seam',
    path: 'tests/fixtures/visionary-v02100/boundary-660-learn_guidance.json', entry: 'beforeLast', bytes: 2261974,
    pin: '11268eb866d0842a91ca20fe2d2c7f032352050bcd39484231effc05260fb632',
    schema: 207, content: 'visionary-v207', revision: 660, rawHash: null,
    fingerprint: hash, view: historicalVisionaryStateForEmptyRootAudit },
  { name: 'preserves raw208 Perfecter798 through the exact empty Door audit seam',
    path: 'tests/fixtures/perfecter-v02110/boundary-798-learn_guidance.json', entry: 'beforeLast', bytes: 3216137,
    pin: '7c713fd6b70b4fd6c6a5eb9d0abe1eb782912260673db9319ecc4f2fba64f4f7',
    schema: 208, content: 'perfecter-v208', revision: 798, rawHash: null,
    fingerprint: hash, view: historicalPerfecterStateForEmptyRootAudit },
] as const;

describe('Three pinned historical empty Door aliases without long capture setup', () => {
  it.each(smallHistoricalAliases)('$name', fixture => {
    const bytes = readFileSync(fixture.path);
    expect(bytes.length).toBe(fixture.bytes); expect(sha(bytes)).toBe(fixture.pin);
    const raw = readObjectEntry<Record<string, unknown>>(fixture.path, fixture.entry);
    expect([raw.schemaVersion, raw.contentVersion, raw.revision]).toEqual([fixture.schema, fixture.content, fixture.revision]);
    expect(Object.hasOwn(raw, 'door')).toBe(false);
    const originalHash = fixture.fingerprint(raw);
    const pinnedHash = fixture.rawHash ?? readObjectEntry<{ beforeStateSha256: string }>(fixture.path, 'audit').beforeStateSha256;
    expect(originalHash).toBe(pinnedHash);
    const current = migrateSliceState(raw), currentHash = fixture.fingerprint(current);
    const audited = fixture.view(current, raw);
    expect(Object.keys(audited).sort()).toEqual(Object.keys(raw).sort());
    expect(fixture.fingerprint(audited)).toBe(originalHash);
    expect(() => migrateSliceState({ ...raw, door: current.door })).toThrow();
    expect(() => migrateSliceState({ ...raw, unexpectedRoot: null })).toThrow();
    const missing = { ...current }; Reflect.deleteProperty(missing, 'door');
    expect(() => fixture.view(missing, raw)).toThrow();
    for (const door of [null, { ...current.door, guidanceKnown: true },
      { ...current.door, unexpected: undefined },
      { ...current.door, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => fixture.view({ ...current, door } as SliceState, raw)).toThrow();
    for (const value of [null, undefined])
      expect(() => fixture.view({ ...current, unexpectedRoot: value } as SliceState, raw)).toThrow();
    // Existing fields remain in the complete hash rather than being normalized.
    expect(fixture.fingerprint(fixture.view({ ...current, cash: current.cash + 1 }, raw))).not.toBe(originalHash);
    expect(fixture.fingerprint(fixture.view({ ...current, random: { ...current.random, cursor: current.random.cursor + 1 } }, raw))).not.toBe(originalHash);

    const projection = projectSliceState(current), publicHash = fixture.fingerprint(projection);
    const withoutDoor = historicalWithoutEmptyDoorPublic(projection, current);
    const { door: _expectedDoor, ...expectedRest } = projection;
    expect(fixture.fingerprint(withoutDoor)).toBe(fixture.fingerprint(expectedRest));
    const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, 'door');
    expect(() => historicalWithoutEmptyDoorPublic(missingPublic, current)).toThrow();
    for (const door of [null, { ...projection.door, promoted: true },
      { ...projection.door, unexpected: undefined },
      { ...projection.door, actions: [{ ...projection.door.actions[0]!, enabled: true }] },
      { ...projection.door, resources: { ...projection.door.resources, cash: 'forged' } }])
      expect(() => historicalWithoutEmptyDoorPublic({ ...projection, door } as SliceProjection, current)).toThrow();
    const extraPublic = historicalWithoutEmptyDoorPublic({ ...projection, unknownRoot: null } as SliceProjection, current);
    expect(Object.hasOwn(extraPublic, 'unknownRoot')).toBe(true);
    expect(fixture.fingerprint(extraPublic)).not.toBe(fixture.fingerprint(withoutDoor));
    expect(fixture.fingerprint(historicalWithoutEmptyDoorPublic({ ...projection, cash: projection.cash + 1 }, current)))
      .not.toBe(fixture.fingerprint(withoutDoor));
    expect(fixture.fingerprint(raw)).toBe(originalHash);
    expect(fixture.fingerprint(current)).toBe(currentHash);
    expect(fixture.fingerprint(projection)).toBe(publicHash);
    expect(sha(readFileSync(fixture.path))).toBe(fixture.pin);
  }, 120_000);
});
