import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';

export const planeswalkerFixtureRoot = 'tests/fixtures/planeswalker-v01740';
export const planeswalkerFixturePath = `${planeswalkerFixtureRoot}/natural.json`;
export type ActualSnapshot = 'departureStart' | 'guidanceStart' | 'ritualQualified' | 'promoted' | 'practiced' | 'combatStart' | 'final';
const cache = new Map<ActualSnapshot, SliceState>();
export function actualSnapshot(name: ActualSnapshot = 'final'): SliceState {
  if (!cache.has(name)) {
    const old: unknown = name === 'final' ? readObjectEntry(planeswalkerFixturePath, 'final') : JSON.parse(readFileSync(`${planeswalkerFixtureRoot}/snapshot-${name}.json`, 'utf8'));
    cache.set(name, migrateSliceState(old));
  }
  return structuredClone(cache.get(name)!);
}
export function actualBoundary(name: string): { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState } {
  const file = `${planeswalkerFixtureRoot}/${name}.json`;
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
