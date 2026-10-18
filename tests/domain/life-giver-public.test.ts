import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectLifeGiverCombat, validateLifeGiverRoundOutcome, type LifeGiverRoundOutcome } from '../../src/domain/life-giver/combat.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceProjection, SlicePublicCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/life-giver-v01680';
const CAPTURES = [
  {
    key: 'combat-first', file: `${ROOT}/boundary-parts-mY7bu5/part-04.json`, live: true, rounds: 1,
    sha: '7589a0c21911776ea377d44e699fc976924253d2290c18466c644a6c06b6d414',
  },
  {
    key: 'combat-terminal', file: `${ROOT}/boundary-parts-mY7bu5/part-05.json`, live: false, rounds: 8,
    sha: 'f71df3e21dab14437708a6cc39d0446d8b342103b2ebaa99cb9d34c389f8f1ae',
  },
] as const;
type CapturedState = Pick<SliceState, 'character' | 'combat' | 'combatHistory' | 'lastCombatRound' | 'random'> & {
  schemaVersion: number; contentVersion: string;
};
type PublicOutcome = NonNullable<SlicePublicCombatRound['lifeGiverOutcome']>;
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

function withoutReplay(o: LifeGiverRoundOutcome): PublicOutcome {
  const { source: _source, randomCursorAfter: _cursor, ...facts } = structuredClone(o);
  return facts;
}

function assertPublicOnly(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertPublicOnly(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter',
      'cursorBefore', 'cursorAfter', 'preparation', 'lifeAnchor', 'privateProbe'].includes(key), `${path}.${key}`).toBe(false);
    // Original objects and real check modifiers may legitimately explain their source.
    if (key === 'source') {
      expect(path, `${path}.${key}`).toMatch(/(?:\.partner(?:After)?|\.papersAfter\[\d+\]|\.combatBeads\[\d+\]|\.check\.modifiers\[\d+\])$/);
      expect(typeof child).toBe('string');
    }
    assertPublicOnly(child, `${path}.${key}`);
  }
}

function assertNoRandomInputs(value: unknown, path = 'projection'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertNoRandomInputs(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter',
      'cursorBefore', 'cursorAfter', 'lifeAnchor'].includes(key), `${path}.${key}`).toBe(false);
    assertNoRandomInputs(child, `${path}.${key}`);
  }
}

function assertRound(actual: SlicePublicCombatRound | null, original: SliceCombatRound, name: string, path: string): void {
  expect(original.lifeGiverOutcome).toBeDefined();
  expect(validateLifeGiverRoundOutcome(original.lifeGiverOutcome), `${path} is a real valid resolved round`).toBe(true);
  const expected = projectPlayerText({ ...original, lifeGiverOutcome: withoutReplay(original.lifeGiverOutcome!) }, name);
  expect(actual, `${path} retains every allowed field`).toEqual(expected);
  expect(actual!.lifeGiverOutcome).not.toHaveProperty('source');
  expect(actual!.lifeGiverOutcome).not.toHaveProperty('randomCursorAfter');
  assertPublicOnly(actual!.lifeGiverOutcome, `${path}.lifeGiverOutcome`);
}

function assertEntrances(view: SliceProjection, original: CapturedState): void {
  assertRound(view.lastCombatRound, original.lastCombatRound!, original.character.name, 'lastCombatRound');
  const indices = original.combatHistory.flatMap((round, i) => round.lifeGiverOutcome ? [i] : []);
  expect(indices.length).toBeGreaterThan(0);
  for (const i of indices) {
    assertRound(view.combatHistory[i]!, original.combatHistory[i]!, original.character.name, `combatHistory[${i}]`);
  }
  if (original.combat) {
    expect(original.combat.lastRound?.lifeGiverOutcome).toBeDefined();
    expect(view.combat).not.toBeNull();
    assertRound(view.combat!.lastRound, original.combat.lastRound!, original.character.name, 'combat.lastRound');
    expect(view.combat!.lastRound).toEqual(view.lastCombatRound);
  } else expect(view.combat).toBeNull();
  expect(view.combatHistory[indices.at(-1)!]).toEqual(view.lastCombatRound);
}

describe('Life Giver S2 public round projection from unchanged original captures', () => {
  it('excludes private replay inputs from the public type at all three entrances', () => {
    expectTypeOf<PublicOutcome>().not.toHaveProperty('source');
    expectTypeOf<PublicOutcome>().not.toHaveProperty('randomCursorAfter');
    expectTypeOf<NonNullable<SliceProjection['lastCombatRound']>['lifeGiverOutcome']>().toEqualTypeOf<PublicOutcome | undefined>();
    expectTypeOf<SliceProjection['combatHistory'][number]['lifeGiverOutcome']>().toEqualTypeOf<PublicOutcome | undefined>();
    expectTypeOf<NonNullable<NonNullable<SliceProjection['combat']>['lastRound']>['lifeGiverOutcome']>().toEqualTypeOf<PublicOutcome | undefined>();
    expectTypeOf<NonNullable<NonNullable<SliceProjection['combat']>['lifeGiver']>>().not.toHaveProperty('source');
  });

  it.each(CAPTURES)('keeps the genuine $key facts at every available entrance after old and current migration', capture => {
    const original = readObjectEntry<{ final: CapturedState }>(capture.file, capture.key).final;
    const originalHash = digest(original), originalRandom = structuredClone(original.random);
    expect(original.schemaVersion).toBe(165);
    expect(original.combat !== null).toBe(capture.live);
    const oldRounds = original.combatHistory.filter(r => r.lifeGiverOutcome);
    expect(oldRounds).toHaveLength(capture.rounds);
    for (const round of oldRounds) {
      expect(validateLifeGiverRoundOutcome(round.lifeGiverOutcome)).toBe(true);
      expect(round.lifeGiverOutcome!.source.randomSeed).toBe(original.random.seed);
    }

    const migrated = migrateSliceState(original);
    assertValidSliceState(migrated);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(migrated.combatHistory).toEqual(original.combatHistory);
    expect(migrated.lastCombatRound).toEqual(original.lastCombatRound);
    expect(migrated.combat).toEqual(original.combat);

    // Exercise both historical migration and already-current input, without forging a state or round.
    const current = migrateSliceState(migrated);
    assertValidSliceState(current);
    expect(current).toEqual(migrated);
    for (const state of [migrated, current]) {
      const before = digest(state), random = structuredClone(state.random);
      const view = projectSliceState(state);
      assertEntrances(view, original);
      assertNoRandomInputs(view);
      expect(JSON.stringify(view)).not.toContain(state.random.seed);
      if (view.combat) {
        const { source, ...allowed } = projectLifeGiverCombat(state);
        expect(source).not.toBeNull();
        expect(source!.randomSeed).toBe(state.random.seed);
        expect(view.combat.lifeGiver).toEqual(projectPlayerText(allowed, state.character.name));
        expect(view.combat.lifeGiver).not.toHaveProperty('source');
        assertPublicOnly(view.combat.lifeGiver, 'combat.lifeGiver');
      }
      expect(state.random).toEqual(random);
      expect(digest(state)).toBe(before);
    }
    expect(original.random).toEqual(originalRandom);
    expect(digest(original)).toBe(originalHash);
    expect(fileDigest(capture.file)).toBe(capture.sha);
  }, 60_000);

  it('retains real rolls, paid actions, material provenance, original positions and all eight final rounds without mutating private state', () => {
    const file = `${ROOT}/natural.json`, original = readObjectEntry<CapturedState>(file, 'final');
    const originalHash = digest(original), state = migrateSliceState(original);
    assertValidSliceState(state);
    const before = digest(state), random = structuredClone(state.random), view = projectSliceState(state);
    assertEntrances(view, original);
    const indices = original.combatHistory.flatMap((r, i) => r.lifeGiverOutcome ? [i] : []);
    expect(indices).toEqual([14, 15, 16, 17, 18, 19, 20, 21]);
    const outcomes = indices.map(i => original.combatHistory[i]!.lifeGiverOutcome!);
    expect(outcomes.flatMap(o => o.playerActions).some(a => a.rolls.length > 0 && a.paidCost > 0)).toBe(true);
    expect(outcomes.flatMap(o => o.playerActions).some(a => a.vitalityResult === 'FAILED' && a.paidCost === 6 && a.beadId !== null)).toBe(true);
    expect(outcomes.flatMap(o => o.playerActions).some(a => a.paperId !== null && a.paidCost === 3)).toBe(true);
    expect(outcomes.some(o => o.ordinaryReturnMetres === 30)).toBe(true);
    expect(outcomes.some(o => o.playerInjuriesAfter.length > 0)).toBe(true);
    for (const i of indices) {
      const raw = original.combatHistory[i]!.lifeGiverOutcome!, actual = view.combatHistory[i]!.lifeGiverOutcome!;
      expect(actual.playerActions).toEqual(projectPlayerText(raw.playerActions, state.character.name));
      expect(actual.enemyActions).toEqual(projectPlayerText(raw.enemyActions, state.character.name));
      expect(actual.partnerAfter).toEqual(projectPlayerText(raw.partnerAfter, state.character.name));
      expect(actual.papersAfter).toEqual(projectPlayerText(raw.papersAfter, state.character.name));
      expect(actual.combatBeads).toEqual(projectPlayerText(raw.combatBeads, state.character.name));
    }

    const unchanged = projectSliceState(state);
    view.lastCombatRound!.lifeGiverOutcome!.partnerAfter.stamina--;
    view.combatHistory[14]!.lifeGiverOutcome!.playerActions[0]!.paidCost++;
    view.combatHistory[14]!.lifeGiverOutcome!.combatBeads[0]!.location = 'YARD';
    expect(projectSliceState(state)).toEqual(unchanged);
    expect(state.random).toEqual(random);
    expect(digest(state)).toBe(before);
    expect(digest(original)).toBe(originalHash);
    expect(fileDigest(file)).toBe('6ae7bbe18c20979643cf881cec54e3794656701b3b962ce775f14c44d46356b1');
  }, 60_000);
});
