import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { LightSeekerCommand } from '../../src/domain/light-seeker/types.js';

export const lightSeekerFixtureDirectory = 'tests/fixtures/light-seeker-v01720';
export const lightSeekerFixturePath = `${lightSeekerFixtureDirectory}/natural.json`;
export const lightSeekerBoundaryIndexPath = `${lightSeekerFixtureDirectory}/boundaries.index.json`;
export const justiceMentorFixturePath = 'tests/fixtures/justice-mentor-v01480/peaceful.json';
export const sunLegacyKeys = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor'] as const;
export interface LightSeekerBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export type LightSeekerSnapshotKey = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'beforeLast' | 'final';

/** Select one genuine capture: split flat snapshots or one streamed root property. Never create missing evidence. */
export function lightSeekerSnapshot(key: LightSeekerSnapshotKey): SliceState {
  const nested = `${lightSeekerFixtureDirectory}/snapshots/${key}.json`;
  const flat = `${lightSeekerFixtureDirectory}/snapshot-${key}.json`;
  const file = existsSync(nested) ? nested : flat;
  return migrateSliceState(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : readObjectEntry<unknown>(lightSeekerFixturePath, key));
}
function boundaryIndex(): Record<string, string> {
  return JSON.parse(readFileSync(lightSeekerBoundaryIndexPath, 'utf8')) as Record<string, string>;
}
export function lightSeekerBoundaryNames(): string[] { return Object.keys(boundaryIndex()); }
export function lightSeekerBoundary(key: string): LightSeekerBoundary {
  const entry = boundaryIndex()[key];
  if (!entry) throw new Error(`Missing actual LightSeeker boundary: ${key}`);
  const file = resolve(lightSeekerFixtureDirectory, entry);
  // Each indexed file must include the full before/intent/after pair; no final-only reconstruction.
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
export function lightSeekerBoundaryForIntent(predicate: (intent: SliceIntent) => boolean,
  accept: (boundary: LightSeekerBoundary) => boolean = () => true): LightSeekerBoundary {
  for (const [key, entry] of Object.entries(boundaryIndex())) {
    if (!predicate(readObjectEntry<SliceIntent>(resolve(lightSeekerFixtureDirectory, entry), 'lastIntent'))) continue;
    const boundary = lightSeekerBoundary(key);
    if (accept(boundary)) return boundary;
  }
  throw new Error('Missing actual LightSeeker boundary matching the recorded command and result');
}
/** Explicit directed unit budget only. This modified state is never natural-play evidence. */
export function unitBudget(state: SliceState): SliceState {
  const next = structuredClone(state); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
/** Keep the original random stream; never search for a more favorable branch. */
export function ct(state: SliceState, command: LightSeekerCommand): SliceState {
  const before = structuredClone(state), intent: SliceIntent = { type: 'LIGHT_SEEKER', command };
  const next = applySliceIntent(state, intent);
  expect(state).toEqual(before); assertValidSliceState(next); return next;
}
export function rejectCt(state: SliceState, command: unknown): void {
  const before = structuredClone(state);
  expect(() => applySliceIntent(state, { type: 'LIGHT_SEEKER', command } as SliceIntent)).toThrow();
  expect(state).toEqual(before);
}
