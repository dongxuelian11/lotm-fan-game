import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createAbyssState, validateAbyssState } from '../../src/domain/abyss/index.js';
import { openAbyssRuntimeSession } from '../../src/domain/abyss/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { ABYSS_SOURCE_FILE, ABYSS_SOURCE_COMMAND_COUNT, abyssHash, authenticAbyssSource,
  assertAbyssSourceUnmodified } from '../helpers/abyss-scenario.js';

const fresh = (): SliceState => createSliceRun('abyss-schema-run', sliceDefaultCreationSelection, 'abyss-schema-seed');
const legacy220 = () => {
  const { abyss: _root, ...state } = fresh();
  return { ...state, schemaVersion: 220 as const, contentVersion: 'hanged-man-v220' as const };
};
const historicalFields = (state: object) => Object.fromEntries(Object.entries(state)
  .filter(([key]) => !['schemaVersion', 'contentVersion', 'abyss'].includes(key)));

describe('Abyss schema221 exact additive admission', () => {
  it('creates precisely the empty root without granting an owned session', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.abyss).toStrictEqual(createAbyssState());
    expect(validateAbyssState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    expect(() => openAbyssRuntimeSession(state)).toThrow();
  });

  it('upgrades original220 by changing only format and adding an explicit empty abyss root', () => {
    const source = legacy220(), sourceHash = abyssHash(source), historicalHash = abyssHash(historicalFields(source));
    const current = migrateSliceState(source);
    expect(abyssHash(source)).toBe(sourceHash);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), 'abyss'].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.abyss).toStrictEqual(createAbyssState());
    expect(abyssHash(historicalFields(current))).toBe(historicalHash);
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(current.hangedMan).not.toBe(source.hangedMan);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing roots, altered empty roots, injected legacy roots and unknown fields without repair', () => {
    const current = fresh(), legacy = legacy220(), { abyss: _root, ...missing } = current;
    for (const invalid of [
      missing,
      { ...current, abyss: undefined },
      { ...current, abyss: null },
      { ...current, abyss: { ...current.abyss, authority: true } },
      { ...current, abyss: { ...current.abyss, unknown: undefined } },
      { ...current, futureChapter: {} },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...current, contentVersion: 'future-v221' },
      { ...current, contentVersion: 'hanged-man-v220' },
      { ...legacy, abyss: createAbyssState() },
      { ...legacy, abyss: undefined },
      { ...legacy, futureChapter: {} },
      { ...legacy, contentVersion: CURRENT_CONTENT_VERSION },
      { ...legacy, hangedMan: { ...legacy.hangedMan, forged: true } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects all schema221 UncleanMonarch recovery fields and commands injected into original220', () => {
    const legacy = legacy220(), root = legacy.uncleanMonarch;
    const injections = [
      { ...root, resupply: { ...root.resupply, recovery: null } },
      { ...root, resupply: { ...root.resupply, recovery: undefined } },
      { ...root, bottles: root.bottles.map((bottle, index) => index === 0 ? { ...bottle, recovery: null } : bottle) },
      { ...root, acquisitionJournal: [{ recoverySite: null }] },
      ...['REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'STABILIZE_PROMOTION'].map(type => ({
        ...root, acquisitionJournal: [{ command: { type, bottleId: 'unclean-monarch-potion-1' } }],
      })),
    ];
    for (const uncleanMonarch of injections) {
      const invalid = { ...legacy, uncleanMonarch }, before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects guidance or S0 markers without the genuine chapter history', () => {
    const guidance = fresh(); guidance.abyss.guidanceKnown = true;
    expect(validateAbyssState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openAbyssRuntimeSession(guidance)).toThrow();
    for (const spirituality of [15, 150]) {
      const promoted = fresh();
      promoted.progression.pathwayId = 'abyss'; promoted.progression.sequence = 0;
      promoted.progression.acting = 100; promoted.spirituality = spirituality;
      expect(validateAbyssState(promoted)).toBe(false);
      expect(() => assertValidSliceState(promoted)).toThrow();
      expect(() => migrateSliceState(promoted)).toThrow();
      expect(() => openAbyssRuntimeSession(promoted)).toThrow();
    }
  });

  it('accepts narrow typed intents while refusing authority, state and resource injection', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' }, { type: 'CLINIC' },
      { type: 'NEXT_WEEK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'STABILIZE_PROMOTION', compoundId: 'abyss-compound-1' },
      { type: 'CONSUME', compoundId: 'abyss-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'ABYSS', command })).toBe(true);
    for (const payload of [
      { type: 'ABYSS', command: { type: 'WORK', cash: 100 } },
      { type: 'ABYSS', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'ABYSS', command: { type: 'CONSUME', compoundId: 'abyss-compound-1', confirmed: false } },
      { type: 'ABYSS', command: { type: 'WORK' }, skipValidation: true },
      { type: 'ABYSS', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'ABYSS', command: { type: 'WORK' }, source: {} },
      { type: 'ABYSS', command: { type: 'UNRECOGNIZED_ACTION' } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });

  it('preserves the real natural821 final and every original field while adding only absent empty roots', () => {
    assertAbyssSourceUnmodified();
    expect(readObjectEntry<SliceIntent[]>(ABYSS_SOURCE_FILE, 'commands')).toHaveLength(ABYSS_SOURCE_COMMAND_COUNT);
    const raw = readObjectEntry<Record<string, unknown>>(ABYSS_SOURCE_FILE, 'final'), before = abyssHash(raw);
    expect(raw).toMatchObject({ schemaVersion: 199, contentVersion: 'unclean-monarch-v199', revision: 822 });
    const current = authenticAbyssSource(), defaults = fresh();
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(abyssHash(current[key as keyof SliceState]), `Changed source821 ${key}`).toBe(abyssHash(value));
    }
    const added = Object.keys(current).filter(key => !Object.hasOwn(raw, key));
    expect(added).toContain('abyss');
    for (const key of added) expect(current[key as keyof SliceState]).toStrictEqual(defaults[key as keyof SliceState]);
    expect(abyssHash(raw)).toBe(before);
    expect(() => assertValidSliceState(current)).not.toThrow();
    expect(() => openAbyssRuntimeSession(current)).toThrow();
    expect(migrateSliceState(current)).toStrictEqual(current);
    assertAbyssSourceUnmodified();
  }, 120_000);
});
