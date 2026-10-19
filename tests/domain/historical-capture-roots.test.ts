import { assertEmptyHermitState, assertEmptyHermitPublic } from '../helpers/empty-hermit-capture.js';
import { assertEmptyHangedManState, assertEmptyHangedManPublic } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState, assertEmptyAbyssPublic } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState, assertEmptyChainedPublic } from '../helpers/empty-chained-capture.js';
import { assertEmptyDemonessState, assertEmptyDemonessPublic, historicalInactiveCalamitySourcePublic } from '../helpers/empty-demoness-capture.js';
import { createHash } from 'node:crypto';
import { stableStringify } from '../../src/domain/canonical.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { historicalFoolStateForEmptyRootAudit, historicalVisionaryStateForEmptyRootAudit,
  historicalPerfecterStateForEmptyRootAudit, historicalWithoutEmptyDoorAndErrorPublic } from '../helpers/historical-empty-root-audit.js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
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
import {
  currentErrorNaturalAnchor, errorNaturalHash, historicalErrorNaturalState,
  historicalErrorNaturalPublic, readErrorNaturalSnapshot,
} from '../helpers/error-natural-capture.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from '../helpers/empty-twilight-giant-capture.js';

// Published members exercise exact comparison adapters without campaign replay.
// Full campaign authentication/replay remains mandatory in the existing suites.
describe('Exact historical capture root adapters', () => {
  it('restores only the inactive historical null source and rejects leaked current source fields', () => {
    const state = createSliceRun('inactive-null-source-audit', sliceDefaultCreationSelection, 'inactive-null-source-seed');
    const projection = projectSliceState(state), privateHash = hash(state), publicHash = hash(projection);
    const historical = historicalInactiveCalamitySourcePublic(projection, state);
    const expected = { ...projection, calamityDemoness: { ...projection.calamityDemoness,
      life: { ...projection.calamityDemoness.life, site: { ...projection.calamityDemoness.life.site, source: null } } } };
    expect(historical).toStrictEqual(expected);
    expect(Object.hasOwn(projection.calamityDemoness.life.site, 'source')).toBe(false);
    for (const source of [null, undefined, { privateMarker: 'must-not-be-public' }]) {
      const leaked = { ...projection, calamityDemoness: { ...projection.calamityDemoness,
        life: { ...projection.calamityDemoness.life, site: { ...projection.calamityDemoness.life.site, source } } } };
      expect(() => historicalInactiveCalamitySourcePublic(leaked, state)).toThrow();
    }
    expect(() => historicalInactiveCalamitySourcePublic(projection,
      { ...state, progression: { ...state.progression, pathwayId: 'demoness' } })).toThrow();
    const activeSource = { ...state, calamityDemoness: { ...state.calamityDemoness,
      life: { ...state.calamityDemoness.life, site: { ...state.calamityDemoness.life.site, source: {} } } } };
    expect(() => historicalInactiveCalamitySourcePublic(projection, activeSource as SliceState)).toThrow();
    const alteredSite = { ...projection.calamityDemoness.life.site,
      playerEnergy: projection.calamityDemoness.life.site.playerEnergy - 1, unexpected: undefined };
    const tampered = { ...projection, cash: projection.cash + 1,
      calamityDemoness: { ...projection.calamityDemoness,
        life: { ...projection.calamityDemoness.life, site: alteredSite } } };
    const auditedTamper = historicalInactiveCalamitySourcePublic(tampered, state);
    expect(auditedTamper.cash).toBe(projection.cash + 1);
    expect(auditedTamper.calamityDemoness.life.site.playerEnergy).toBe(alteredSite.playerEnergy);
    expect(Object.hasOwn(auditedTamper.calamityDemoness.life.site, 'unexpected')).toBe(true);
    expect(hash(auditedTamper)).not.toBe(hash(historical));
    expect(hash(state)).toBe(privateHash); expect(hash(projection)).toBe(publicHash);
  });

  it('preserves raw216 actual219 initial and terminal through only the exact schema217-222 empty additions', () => {
    for (const which of ['initial', 'terminal'] as const) {
      const raw = readErrorNaturalSnapshot(which);
      expect([raw.final.schemaVersion, raw.final.contentVersion]).toEqual([216, 'error-ascent-v216']);
      expect(Object.hasOwn(raw.final, 'twilightGiant')).toBe(false); expect(Object.hasOwn(raw.final, 'demoness')).toBe(false);
      expect(Object.hasOwn(raw.public, 'twilightGiant')).toBe(false); expect(Object.hasOwn(raw.public, 'demoness')).toBe(false);
      const privateHash = errorNaturalHash(raw.final), publicHash = errorNaturalHash(raw.public);
      expect(privateHash).toBe(raw.anchor.privateStateSha256);
      expect(publicHash).toBe(raw.anchor.publicStateSha256);
      const current = migrateSliceState(raw.final), projection = projectSliceState(current);
      const currentHash = errorNaturalHash(current), projectionHash = errorNaturalHash(projection);
      assertEmptyTwilightGiantState(current); assertEmptyTwilightGiantPublic(projection, current);
      assertEmptyDemonessState(current); assertEmptyDemonessPublic(projection, current);
      assertEmptyHermitState(current); assertEmptyHermitPublic(projection, current);
      assertEmptyHangedManState(current); assertEmptyHangedManPublic(projection, current);
      assertEmptyAbyssState(current); assertEmptyAbyssPublic(projection, current);
      assertEmptyChainedState(current); assertEmptyChainedPublic(projection, current);
      const stateKeys = Object.keys(raw.final), publicKeys = Object.keys(raw.public);
      expect(Object.keys(current).sort()).toEqual([...stateKeys, 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained'].sort());
      expect(Object.keys(projection).sort()).toEqual([...publicKeys, 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained'].sort());
      expect(historicalErrorNaturalState(current, stateKeys)).toEqual(raw.final);
      expect(historicalErrorNaturalPublic(projection, current, publicKeys)).toEqual(raw.public);
      expect(currentErrorNaturalAnchor(current, projection, raw)).toEqual(raw.anchor);
      for (const root of ['knowledgeEmperor', 'sage'] as const) {
        expect(Reflect.get(raw.public[root].encounter, 'preparation')).toBe(null);
        expect(Object.hasOwn(raw.public[root].encounter, 'preparationSummary')).toBe(false);
        expect(Reflect.get(raw.public[root].life.site, 'source')).toBe(null);
        for (const leaked of [null, undefined, { privateMarker: 'must-not-be-public' }]) {
          const sourceLeak = { ...projection, [root]: { ...projection[root], life: { ...projection[root].life,
            site: { ...projection[root].life.site, source: leaked } } } } as SliceProjection;
          expect(() => historicalErrorNaturalPublic(sourceLeak, current, publicKeys)).toThrow();
          const preparationLeak = { ...projection, [root]: { ...projection[root],
            encounter: { ...projection[root].encounter, preparation: leaked } } } as SliceProjection;
          expect(() => historicalErrorNaturalPublic(preparationLeak, current, publicKeys)).toThrow();
        }
        const missingSummary = { ...projection[root].encounter }; Reflect.deleteProperty(missingSummary, 'preparationSummary');
        expect(() => historicalErrorNaturalPublic({ ...projection, [root]: { ...projection[root],
          encounter: missingSummary } } as SliceProjection, current, publicKeys)).toThrow();
        for (const preparationSummary of [undefined, { week: current.week }])
          expect(() => historicalErrorNaturalPublic({ ...projection, [root]: { ...projection[root],
            encounter: { ...projection[root].encounter, preparationSummary } } } as SliceProjection, current, publicKeys)).toThrow();
        const activeSource = { ...current, [root]: { ...current[root], life: { ...current[root].life,
          site: { ...current[root].life.site, source: { privateMarker: 'must-stay-private' } } } } } as SliceState;
        expect(() => historicalErrorNaturalPublic(projection, activeSource, publicKeys)).toThrow();
        const activePreparation = { ...current, [root]: { ...current[root],
          encounter: { ...current[root].encounter, preparation: { week: current.week } } } } as SliceState;
        expect(() => historicalErrorNaturalPublic(projection, activePreparation, publicKeys)).toThrow();
        expect(() => historicalErrorNaturalPublic({ ...projection, [root]: { ...projection[root], promoted: true } }, current, publicKeys)).toThrow();
      }
      expect(() => historicalErrorNaturalPublic(projection,
        { ...current, progression: { ...current.progression, pathwayId: 'hermit' } }, publicKeys)).toThrow();
      expect(errorNaturalHash(historicalErrorNaturalState(current, stateKeys))).toBe(privateHash);
      expect(errorNaturalHash(historicalErrorNaturalPublic(projection, current, publicKeys))).toBe(publicHash);
      expect(() => migrateSliceState({ ...raw.final, twilightGiant: current.twilightGiant })).toThrow();
      expect(() => migrateSliceState({ ...raw.final, demoness: current.demoness })).toThrow();
      const missing = { ...current }; Reflect.deleteProperty(missing, 'twilightGiant');
      expect(() => historicalErrorNaturalState(missing, stateKeys)).toThrow();
      for (const twilightGiant of [null, { ...current.twilightGiant, guidanceKnown: true },
        { ...current.twilightGiant, unexpected: undefined },
        { ...current.twilightGiant, promotionStability: { preparations: [], unexpected: undefined } }])
        expect(() => historicalErrorNaturalState({ ...current, twilightGiant } as SliceState, stateKeys)).toThrow();
      const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, 'twilightGiant');
      expect(() => historicalErrorNaturalPublic(missingPublic, current, publicKeys)).toThrow();
      for (const twilightGiant of [null, { ...projection.twilightGiant, promoted: true },
        { ...projection.twilightGiant, unexpected: undefined },
        { ...projection.twilightGiant, actions: [{ ...projection.twilightGiant.actions[0]!, enabled: true }] },
        { ...projection.twilightGiant, resources: { ...projection.twilightGiant.resources, cash: 'forged' } }])
        expect(() => historicalErrorNaturalPublic({ ...projection, twilightGiant } as SliceProjection, current, publicKeys)).toThrow();
      for (const root of ['hermit', 'hangedMan', 'abyss', 'chained'] as const) {
        expect(Object.hasOwn(raw.final, root)).toBe(false); expect(Object.hasOwn(raw.public, root)).toBe(false);
        expect(() => migrateSliceState({ ...raw.final, [root]: current[root] })).toThrow();
        const missingState = { ...current }; Reflect.deleteProperty(missingState, root);
        expect(() => historicalErrorNaturalState(missingState, stateKeys)).toThrow();
        for (const value of [null, { ...current[root], guidanceKnown: true },
          { ...current[root], unexpected: undefined },
          { ...current[root], promotionStability: { preparations: [], unexpected: undefined } }])
          expect(() => historicalErrorNaturalState({ ...current, [root]: value } as SliceState, stateKeys)).toThrow();
        const missingView = { ...projection }; Reflect.deleteProperty(missingView, root);
        expect(() => historicalErrorNaturalPublic(missingView, current, publicKeys)).toThrow();
        for (const value of [null, { ...projection[root], promoted: true }, { ...projection[root], unexpected: undefined },
          { ...projection[root], actions: [{ ...projection[root].actions[0]!, enabled: true }] },
          { ...projection[root], resources: { ...projection[root].resources, cash: 'forged' } }])
          expect(() => historicalErrorNaturalPublic({ ...projection, [root]: value } as SliceProjection, current, publicKeys)).toThrow();
      }
      for (const unexpectedRoot of [null, undefined]) {
        expect(() => historicalErrorNaturalState({ ...current, unexpectedRoot } as SliceState, stateKeys)).toThrow();
        expect(() => historicalErrorNaturalPublic({ ...projection, unexpectedRoot } as SliceProjection, current, publicKeys)).toThrow();
      }
      expect(errorNaturalHash(historicalErrorNaturalState({ ...current, cash: current.cash + 1 }, stateKeys))).not.toBe(privateHash);
      expect(errorNaturalHash(historicalErrorNaturalState({ ...current, random: { ...current.random, cursor: current.random.cursor + 1 } }, stateKeys))).not.toBe(privateHash);
      expect(errorNaturalHash(historicalErrorNaturalPublic({ ...projection, cash: projection.cash + 1 }, current, publicKeys))).not.toBe(publicHash);
      expect(errorNaturalHash(raw.final)).toBe(privateHash); expect(errorNaturalHash(raw.public)).toBe(publicHash);
      expect(errorNaturalHash(current)).toBe(currentHash); expect(errorNaturalHash(projection)).toBe(projectionHash);
    }
  }, 120_000);

  it('preserves raw210 Darkness680 and rejects every altered addition or historical field', () => {
    const path = 'tests/fixtures/darkness-v02130/boundary-680-darkness-learn_guidance.json.gz';
    const pin = '244055724e180d9629adc945354f0e5cbe5c9624fcbe06d765f0b95264dfc1f0';
    const bytes = readFileSync(path); expect(sha(bytes)).toBe(pin);
    const boundary = JSON.parse(gunzipSync(bytes).toString('utf8')) as DarknessBoundary;
    const raw = boundary.beforeLast, rawHash = hash(raw);
    expect(rawHash).toBe(boundary.audit.beforeStateSha256);
    const current = migrateCapturedDarknessState(raw), currentHash = hash(current);
    const additions = ['whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained'] as const;
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
    const additions = ['darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained'] as const;
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

  it('preserves raw214 Death1039 and admits only the exact schema215-222 empty additions', () => {
    const action = readDeathActionAt(1039), raw = action.beforeLast, rawHash = hash(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([214, 'death-v214']);
    expect(rawHash).toBe(action.audit.beforeStateSha256); expect(Object.hasOwn(raw, 'door')).toBe(false); expect(Object.hasOwn(raw, 'errorAscent')).toBe(false); expect(Object.hasOwn(raw, 'twilightGiant')).toBe(false); expect(Object.hasOwn(raw, 'demoness')).toBe(false);
    const current = migrateSliceState(raw), currentHash = hash(current);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), 'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained'].sort());
    same(historicalDeathState(current), raw);
    const missing = { ...current }; Reflect.deleteProperty(missing, 'door');
    expect(() => historicalDeathState(missing)).toThrow();
    for (const door of [null, { ...current.door, guidanceKnown: true },
      { ...current.door, unexpected: undefined },
      { ...current.door, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => historicalDeathState({ ...current, door } as SliceState)).toThrow();
    expect(() => migrateSliceState({ ...raw, door: current.door })).toThrow();
    expect(() => migrateSliceState({ ...raw, errorAscent: current.errorAscent })).toThrow();
    expect(() => migrateSliceState({ ...raw, twilightGiant: current.twilightGiant })).toThrow();
    expect(() => migrateSliceState({ ...raw, demoness: current.demoness })).toThrow();
    const missingError = { ...current }; Reflect.deleteProperty(missingError, 'errorAscent');
    expect(() => historicalDeathState(missingError)).toThrow();
    for (const errorAscent of [null, { ...current.errorAscent, guidanceKnown: true },
      { ...current.errorAscent, unexpected: undefined },
      { ...current.errorAscent, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => historicalDeathState({ ...current, errorAscent } as SliceState)).toThrow();
    const missingTwilight = { ...current }; Reflect.deleteProperty(missingTwilight, 'twilightGiant');
    expect(() => historicalDeathState(missingTwilight)).toThrow();
    for (const twilightGiant of [null, { ...current.twilightGiant, guidanceKnown: true },
      { ...current.twilightGiant, unexpected: undefined },
      { ...current.twilightGiant, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => historicalDeathState({ ...current, twilightGiant } as SliceState)).toThrow();
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
    const missingErrorPublic = { ...projection }; Reflect.deleteProperty(missingErrorPublic, 'errorAscent');
    expect(() => historicalDeathPublic(missingErrorPublic, current)).toThrow();
    expect(() => assertCurrentDeathGlobal(missingErrorPublic, action, 'before')).toThrow();
    for (const errorAscent of [null, { ...projection.errorAscent, promoted: true },
      { ...projection.errorAscent, unexpected: undefined },
      { ...projection.errorAscent, actions: [{ ...projection.errorAscent.actions[0]!, enabled: true }] },
      { ...projection.errorAscent, resources: { ...projection.errorAscent.resources, cash: 'forged' } }]) {
      expect(() => historicalDeathPublic({ ...projection, errorAscent } as SliceProjection, current)).toThrow();
      expect(() => assertCurrentDeathGlobal({ ...projection, errorAscent } as SliceProjection, action, 'before')).toThrow();
    }
    const missingTwilightPublic = { ...projection }; Reflect.deleteProperty(missingTwilightPublic, 'twilightGiant');
    expect(() => historicalDeathPublic(missingTwilightPublic, current)).toThrow();
    expect(() => assertCurrentDeathGlobal(missingTwilightPublic, action, 'before')).toThrow();
    for (const twilightGiant of [null, { ...projection.twilightGiant, promoted: true },
      { ...projection.twilightGiant, unexpected: undefined },
      { ...projection.twilightGiant, actions: [{ ...projection.twilightGiant.actions[0]!, enabled: true }] },
      { ...projection.twilightGiant, resources: { ...projection.twilightGiant.resources, cash: 'forged' } }]) {
      expect(() => historicalDeathPublic({ ...projection, twilightGiant } as SliceProjection, current)).toThrow();
      expect(() => assertCurrentDeathGlobal({ ...projection, twilightGiant } as SliceProjection, action, 'before')).toThrow();
    }
    for (const root of ['hermit', 'hangedMan', 'abyss', 'chained'] as const) {
      expect(Object.hasOwn(raw, root)).toBe(false); expect(Object.hasOwn(action.globalPublicBefore, root)).toBe(false);
      expect(() => migrateSliceState({ ...raw, [root]: current[root] })).toThrow();
      const missingState = { ...current }; Reflect.deleteProperty(missingState, root);
      expect(() => historicalDeathState(missingState)).toThrow();
      for (const value of [null, { ...current[root], guidanceKnown: true },
        { ...current[root], unexpected: undefined },
        { ...current[root], promotionStability: { preparations: [], unexpected: undefined } }])
        expect(() => historicalDeathState({ ...current, [root]: value } as SliceState)).toThrow();
      const missingView = { ...projection }; Reflect.deleteProperty(missingView, root);
      expect(() => historicalDeathPublic(missingView, current)).toThrow();
      expect(() => assertCurrentDeathGlobal(missingView, action, 'before')).toThrow();
      for (const value of [null, { ...projection[root], promoted: true }, { ...projection[root], unexpected: undefined },
        { ...projection[root], actions: [{ ...projection[root].actions[0]!, enabled: true }] },
        { ...projection[root], resources: { ...projection[root].resources, cash: 'forged' } }]) {
        expect(() => historicalDeathPublic({ ...projection, [root]: value } as SliceProjection, current)).toThrow();
        expect(() => assertCurrentDeathGlobal({ ...projection, [root]: value } as SliceProjection, action, 'before')).toThrow();
      }
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
  { name: 'preserves raw205 Fool2084 through the exact empty Door, Error, Twilight Giant, Demoness, Hermit, Hanged Man, Abyss and Chained audit seam',
    path: 'tests/fixtures/fool-v02080/natural.json', entry: 'final', bytes: 37252637,
    pin: '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959',
    schema: 205, content: 'fool-v205', revision: 2084,
    rawHash: '66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a',
    fingerprint: canonicalHash,
    view: (state: SliceState, raw: Record<string, unknown>) => historicalFoolStateForEmptyRootAudit(state, Object.keys(raw)) },
  { name: 'preserves raw207 Visionary660 through the exact empty Door, Error, Twilight Giant, Demoness, Hermit, Hanged Man, Abyss and Chained audit seam',
    path: 'tests/fixtures/visionary-v02100/boundary-660-learn_guidance.json', entry: 'beforeLast', bytes: 2261974,
    pin: '11268eb866d0842a91ca20fe2d2c7f032352050bcd39484231effc05260fb632',
    schema: 207, content: 'visionary-v207', revision: 660, rawHash: null,
    fingerprint: hash, view: historicalVisionaryStateForEmptyRootAudit },
  { name: 'preserves raw208 Perfecter798 through the exact empty Door, Error, Twilight Giant, Demoness, Hermit, Hanged Man, Abyss and Chained audit seam',
    path: 'tests/fixtures/perfecter-v02110/boundary-798-learn_guidance.json', entry: 'beforeLast', bytes: 3216137,
    pin: '7c713fd6b70b4fd6c6a5eb9d0abe1eb782912260673db9319ecc4f2fba64f4f7',
    schema: 208, content: 'perfecter-v208', revision: 798, rawHash: null,
    fingerprint: hash, view: historicalPerfecterStateForEmptyRootAudit },
] as const;

describe('Three pinned historical empty Door, Error, Twilight Giant, Demoness, Hermit, Hanged Man, Abyss and Chained aliases without long capture setup', () => {
  it.each(smallHistoricalAliases)('$name', fixture => {
    const bytes = readFileSync(fixture.path);
    expect(bytes.length).toBe(fixture.bytes); expect(sha(bytes)).toBe(fixture.pin);
    const raw = readObjectEntry<Record<string, unknown>>(fixture.path, fixture.entry);
    expect([raw.schemaVersion, raw.contentVersion, raw.revision]).toEqual([fixture.schema, fixture.content, fixture.revision]);
    expect(Object.hasOwn(raw, 'door')).toBe(false); expect(Object.hasOwn(raw, 'errorAscent')).toBe(false); expect(Object.hasOwn(raw, 'twilightGiant')).toBe(false); expect(Object.hasOwn(raw, 'demoness')).toBe(false);
    expect(Object.hasOwn(raw, 'hermit')).toBe(false); expect(Object.hasOwn(raw, 'hangedMan')).toBe(false); expect(Object.hasOwn(raw, 'abyss')).toBe(false); expect(Object.hasOwn(raw, 'chained')).toBe(false);
    const originalHash = fixture.fingerprint(raw);
    const pinnedHash = fixture.rawHash ?? readObjectEntry<{ beforeStateSha256: string }>(fixture.path, 'audit').beforeStateSha256;
    expect(originalHash).toBe(pinnedHash);
    const current = migrateSliceState(raw), currentHash = fixture.fingerprint(current);
    const audited = fixture.view(current, raw);
    expect(Object.keys(audited).sort()).toEqual(Object.keys(raw).sort());
    expect(fixture.fingerprint(audited)).toBe(originalHash);
    expect(() => migrateSliceState({ ...raw, door: current.door })).toThrow();
    expect(() => migrateSliceState({ ...raw, errorAscent: current.errorAscent })).toThrow();
    expect(() => migrateSliceState({ ...raw, twilightGiant: current.twilightGiant })).toThrow();
    expect(() => migrateSliceState({ ...raw, demoness: current.demoness })).toThrow();
    expect(() => migrateSliceState({ ...raw, hermit: current.hermit })).toThrow();
    expect(() => migrateSliceState({ ...raw, hangedMan: current.hangedMan })).toThrow();
    expect(() => migrateSliceState({ ...raw, abyss: current.abyss })).toThrow();
    expect(() => migrateSliceState({ ...raw, chained: current.chained })).toThrow();
    expect(() => migrateSliceState({ ...raw, unexpectedRoot: null })).toThrow();
    const missing = { ...current }; Reflect.deleteProperty(missing, 'door');
    expect(() => fixture.view(missing, raw)).toThrow();
    for (const door of [null, { ...current.door, guidanceKnown: true },
      { ...current.door, unexpected: undefined },
      { ...current.door, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => fixture.view({ ...current, door } as SliceState, raw)).toThrow();
    const missingError = { ...current }; Reflect.deleteProperty(missingError, 'errorAscent');
    expect(() => fixture.view(missingError, raw)).toThrow();
    for (const errorAscent of [null, { ...current.errorAscent, guidanceKnown: true },
      { ...current.errorAscent, unexpected: undefined },
      { ...current.errorAscent, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => fixture.view({ ...current, errorAscent } as SliceState, raw)).toThrow();
    const missingTwilight = { ...current }; Reflect.deleteProperty(missingTwilight, 'twilightGiant');
    expect(() => fixture.view(missingTwilight, raw)).toThrow();
    for (const twilightGiant of [null, { ...current.twilightGiant, guidanceKnown: true },
      { ...current.twilightGiant, unexpected: undefined },
      { ...current.twilightGiant, promotionStability: { preparations: [], unexpected: undefined } }])
      expect(() => fixture.view({ ...current, twilightGiant } as SliceState, raw)).toThrow();
    const missingDemoness = { ...current }; Reflect.deleteProperty(missingDemoness, 'demoness');
    expect(() => fixture.view(missingDemoness, raw)).toThrow();
    for (const demoness of [null, undefined, { ...current.demoness, version: 2 },
      { ...current.demoness, guidanceKnown: true },
      { ...current.demoness, source: {} }, { ...current.demoness, frame: {} },
      { ...current.demoness, promotionWeek: 1 }, { ...current.demoness, passage: {} },
      { ...current.demoness, materials: {} }, { ...current.demoness, preparations: [{}] },
      { ...current.demoness, journal: [{}] }, { ...current.demoness, unexpected: undefined }])
      expect(() => fixture.view({ ...current, demoness } as SliceState, raw)).toThrow();
    for (const root of ['hermit', 'hangedMan', 'abyss', 'chained'] as const) {
      const missing = { ...current }; Reflect.deleteProperty(missing, root);
      expect(() => fixture.view(missing, raw)).toThrow();
      for (const value of [null, undefined, { ...current[root], version: 2 },
        { ...current[root], guidanceKnown: true },
        { ...current[root], source: {} }, { ...current[root], frame: {} },
        { ...current[root], promotionWeek: 1 }, { ...current[root], scene: {} },
        { ...current[root], materials: {} }, { ...current[root], journal: [{}] },
        { ...current[root], promotionStability: { preparations: [{}] } },
        { ...current[root], promotionStability: { preparations: [], unexpected: undefined } },
        { ...current[root], unexpected: undefined }])
        expect(() => fixture.view({ ...current, [root]: value } as SliceState, raw)).toThrow();
    }
    for (const value of [null, undefined])
      expect(() => fixture.view({ ...current, unexpectedRoot: value } as SliceState, raw)).toThrow();
    // Existing fields remain in the complete hash rather than being normalized.
    expect(fixture.fingerprint(fixture.view({ ...current, cash: current.cash + 1 }, raw))).not.toBe(originalHash);
    expect(fixture.fingerprint(fixture.view({ ...current, random: { ...current.random, cursor: current.random.cursor + 1 } }, raw))).not.toBe(originalHash);

    const projection = projectSliceState(current), publicHash = fixture.fingerprint(projection);
    const withoutNewRoots = historicalWithoutEmptyDoorAndErrorPublic(projection, current);
    const { door: _expectedDoor, errorAscent: _expectedErrorAscent, twilightGiant: _expectedTwilightGiant, demoness: _expectedDemoness,
      hermit: _expectedHermit, hangedMan: _expectedHangedMan, abyss: _expectedAbyss, chained: _expectedChained, ...expectedRest } = projection;
    const expectedHistorical = { ...expectedRest, calamityDemoness: { ...expectedRest.calamityDemoness,
      life: { ...expectedRest.calamityDemoness.life, site: { ...expectedRest.calamityDemoness.life.site, source: null } } } };
    expect(fixture.fingerprint(withoutNewRoots)).toBe(fixture.fingerprint(expectedHistorical));
    const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, 'door');
    expect(() => historicalWithoutEmptyDoorAndErrorPublic(missingPublic, current)).toThrow();
    for (const door of [null, { ...projection.door, promoted: true },
      { ...projection.door, unexpected: undefined },
      { ...projection.door, actions: [{ ...projection.door.actions[0]!, enabled: true }] },
      { ...projection.door, resources: { ...projection.door.resources, cash: 'forged' } }])
      expect(() => historicalWithoutEmptyDoorAndErrorPublic({ ...projection, door } as SliceProjection, current)).toThrow();
    const missingErrorPublic = { ...projection }; Reflect.deleteProperty(missingErrorPublic, 'errorAscent');
    expect(() => historicalWithoutEmptyDoorAndErrorPublic(missingErrorPublic, current)).toThrow();
    for (const errorAscent of [null, { ...projection.errorAscent, promoted: true },
      { ...projection.errorAscent, unexpected: undefined },
      { ...projection.errorAscent, actions: [{ ...projection.errorAscent.actions[0]!, enabled: true }] },
      { ...projection.errorAscent, resources: { ...projection.errorAscent.resources, cash: 'forged' } }])
      expect(() => historicalWithoutEmptyDoorAndErrorPublic({ ...projection, errorAscent } as SliceProjection, current)).toThrow();
    const missingTwilightPublic = { ...projection }; Reflect.deleteProperty(missingTwilightPublic, 'twilightGiant');
    expect(() => historicalWithoutEmptyDoorAndErrorPublic(missingTwilightPublic, current)).toThrow();
    for (const twilightGiant of [null, { ...projection.twilightGiant, promoted: true },
      { ...projection.twilightGiant, unexpected: undefined },
      { ...projection.twilightGiant, actions: [{ ...projection.twilightGiant.actions[0]!, enabled: true }] },
      { ...projection.twilightGiant, resources: { ...projection.twilightGiant.resources, cash: 'forged' } }])
      expect(() => historicalWithoutEmptyDoorAndErrorPublic({ ...projection, twilightGiant } as SliceProjection, current)).toThrow();
    const missingDemonessPublic = { ...projection }; Reflect.deleteProperty(missingDemonessPublic, 'demoness');
    expect(() => historicalWithoutEmptyDoorAndErrorPublic(missingDemonessPublic, current)).toThrow();
    for (const demoness of [null, undefined, { ...projection.demoness, promoted: true },
      { ...projection.demoness, unexpected: undefined },
      { ...projection.demoness, actions: [{ ...projection.demoness.actions[0]!, enabled: true }] },
      { ...projection.demoness, resources: { ...projection.demoness.resources, cash: 'forged' } }])
      expect(() => historicalWithoutEmptyDoorAndErrorPublic({ ...projection, demoness } as SliceProjection, current)).toThrow();
    for (const root of ['hermit', 'hangedMan', 'abyss', 'chained'] as const) {
      const missingPublic = { ...projection }; Reflect.deleteProperty(missingPublic, root);
      expect(() => historicalWithoutEmptyDoorAndErrorPublic(missingPublic, current)).toThrow();
      for (const value of [null, undefined, { ...projection[root], promoted: true },
        { ...projection[root], unexpected: undefined },
        { ...projection[root], actions: [{ ...projection[root].actions[0]!, enabled: true }] },
        { ...projection[root], resources: { ...projection[root].resources, cash: 'forged' } }])
        expect(() => historicalWithoutEmptyDoorAndErrorPublic({ ...projection, [root]: value } as SliceProjection, current)).toThrow();
    }
    const extraPublic = historicalWithoutEmptyDoorAndErrorPublic({ ...projection, unknownRoot: null } as SliceProjection, current);
    expect(Object.hasOwn(extraPublic, 'unknownRoot')).toBe(true);
    expect(fixture.fingerprint(extraPublic)).not.toBe(fixture.fingerprint(withoutNewRoots));
    expect(fixture.fingerprint(historicalWithoutEmptyDoorAndErrorPublic({ ...projection, cash: projection.cash + 1 }, current)))
      .not.toBe(fixture.fingerprint(withoutNewRoots));
    expect(fixture.fingerprint(raw)).toBe(originalHash);
    expect(fixture.fingerprint(current)).toBe(currentHash);
    expect(fixture.fingerprint(projection)).toBe(publicHash);
    expect(sha(readFileSync(fixture.path))).toBe(fixture.pin);
  }, 120_000);
});
