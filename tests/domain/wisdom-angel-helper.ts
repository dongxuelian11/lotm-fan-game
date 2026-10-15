import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { WisdomAngelCommand } from '../../src/domain/wisdom-angel/types.js';

export const wisdomAngelFixtureDirectory = 'tests/fixtures/wisdom-angel-v01700';
export const wisdomAngelFixturePath = `${wisdomAngelFixtureDirectory}/natural.json`;
export const wisdomAngelBoundaryIndexPath = `${wisdomAngelFixtureDirectory}/boundaries.index.json`;
export const insightScholarPeacefulFixturePath = 'tests/fixtures/insight-scholar-v01460/peaceful.json';
export const insightScholarDeathFixturePath = 'tests/fixtures/insight-scholar-v01460/natural.json';
export const readingLegacyKeys = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar'] as const;
export interface WisdomAngelBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export type WisdomAngelSnapshotKey = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final';

/** Read one snapshot only. Support either original top-level captures or individually split snapshots. */
export function wisdomAngelSnapshot(key: WisdomAngelSnapshotKey): SliceState {
  const split = `${wisdomAngelFixtureDirectory}/snapshots/${key}.json`;
  const file = existsSync(split) ? split : `${wisdomAngelFixtureDirectory}/snapshot-${key}.json`;
  return migrateSliceState(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : readObjectEntry<unknown>(wisdomAngelFixturePath, key));
}
function boundaryIndex(): Record<string, string> {
  return JSON.parse(readFileSync(wisdomAngelBoundaryIndexPath, 'utf8')) as Record<string, string>;
}
export function wisdomAngelBoundaryNames(): string[] { return Object.keys(boundaryIndex()); }
export function wisdomAngelBoundary(key: string): WisdomAngelBoundary {
  const entry = boundaryIndex()[key];
  if (!entry) throw new Error(`Missing actual Wisdom Angel boundary: ${key}`);
  const file = resolve(wisdomAngelFixtureDirectory, entry);
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
/** Match actual recorded commands without depending on the runner's human-readable labels. */
export function wisdomAngelBoundaryForIntent(predicate: (intent: SliceIntent) => boolean,
  accept: (boundary: WisdomAngelBoundary) => boolean = () => true): WisdomAngelBoundary {
  for (const [key, entry] of Object.entries(boundaryIndex())) {
    if (!predicate(readObjectEntry<SliceIntent>(resolve(wisdomAngelFixtureDirectory, entry), 'lastIntent'))) continue;
    const boundary = wisdomAngelBoundary(key);
    if (accept(boundary)) return boundary;
  }
  throw new Error('Missing captured Wisdom Angel boundary matching the actual command and result');
}
/** Explicit directed unit budget only. Never persist this state as a natural-play capture. */
export function unitBudget(state: SliceState): SliceState {
  const next = structuredClone(state); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
/** Production random stream stays unchanged; this helper does not search for a successful branch. */
export function wa(state: SliceState, command: WisdomAngelCommand): SliceState {
  const before = structuredClone(state), intent: SliceIntent = { type: 'WISDOM_ANGEL', command };
  const result = applySliceIntent(state, intent);
  expect(state).toEqual(before); assertValidSliceState(result); return result;
}
export function rejectWa(state: SliceState, command: unknown): void {
  const before = structuredClone(state);
  expect(() => applySliceIntent(state, { type: 'WISDOM_ANGEL', command } as SliceIntent)).toThrow();
  expect(state).toEqual(before);
}
