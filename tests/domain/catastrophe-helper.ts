import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { CatastropheCommand } from '../../src/domain/catastrophe/types.js';

export const catastropheFixtureDirectory = 'tests/fixtures/catastrophe-v01710';
export const catastropheFixturePath = `${catastropheFixtureDirectory}/natural.json`;
export const catastropheBoundaryIndexPath = `${catastropheFixtureDirectory}/boundaries.index.json`;
export const seaKingFixturePath = 'tests/fixtures/sea-king-v01470/natural.json';
export const tyrantLegacyKeys = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing'] as const;
export interface CatastropheBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export type CatastropheSnapshotKey = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'beforeLast' | 'final';

/** Select one genuine capture: split flat snapshots or one streamed root property. Never create missing evidence. */
export function catastropheSnapshot(key: CatastropheSnapshotKey): SliceState {
  const nested = `${catastropheFixtureDirectory}/snapshots/${key}.json`;
  const flat = `${catastropheFixtureDirectory}/snapshot-${key}.json`;
  const file = existsSync(nested) ? nested : flat;
  return migrateSliceState(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : readObjectEntry<unknown>(catastropheFixturePath, key));
}
function boundaryIndex(): Record<string, string> {
  return JSON.parse(readFileSync(catastropheBoundaryIndexPath, 'utf8')) as Record<string, string>;
}
export function catastropheBoundaryNames(): string[] { return Object.keys(boundaryIndex()); }
export function catastropheBoundary(key: string): CatastropheBoundary {
  const entry = boundaryIndex()[key];
  if (!entry) throw new Error(`Missing actual Catastrophe boundary: ${key}`);
  const file = resolve(catastropheFixtureDirectory, entry);
  // Each indexed file must include the full before/intent/after pair; no final-only reconstruction.
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
export function catastropheBoundaryForIntent(predicate: (intent: SliceIntent) => boolean,
  accept: (boundary: CatastropheBoundary) => boolean = () => true): CatastropheBoundary {
  for (const [key, entry] of Object.entries(boundaryIndex())) {
    if (!predicate(readObjectEntry<SliceIntent>(resolve(catastropheFixtureDirectory, entry), 'lastIntent'))) continue;
    const boundary = catastropheBoundary(key);
    if (accept(boundary)) return boundary;
  }
  throw new Error('Missing actual Catastrophe boundary matching the recorded command and result');
}
/** Explicit directed unit budget only. This modified state is never natural-play evidence. */
export function unitBudget(state: SliceState): SliceState {
  const next = structuredClone(state); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
/** Keep the original random stream; never search for a more favorable branch. */
export function ct(state: SliceState, command: CatastropheCommand): SliceState {
  const before = structuredClone(state), intent: SliceIntent = { type: 'CATASTROPHE', command };
  const next = applySliceIntent(state, intent);
  expect(state).toEqual(before); assertValidSliceState(next); return next;
}
export function rejectCt(state: SliceState, command: unknown): void {
  const before = structuredClone(state);
  expect(() => applySliceIntent(state, { type: 'CATASTROPHE', command } as SliceIntent)).toThrow();
  expect(state).toEqual(before);
}
