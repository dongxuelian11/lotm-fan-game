import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
export const fateTrojanRoot = 'tests/fixtures/fate-trojan-v01750';
export const fateTrojanFixturePath = `${fateTrojanRoot}/natural.json`;
export function actualSnapshot(key = 'final'): SliceState {
  return migrateSliceState(key === 'final' ? readObjectEntry<unknown>(fateTrojanFixturePath, key)
    : JSON.parse(readFileSync(`${fateTrojanRoot}/snapshot-${key}.json`, 'utf8')));
}
export function actualBoundaryNames(): string[] { return Object.keys(JSON.parse(readFileSync(`${fateTrojanRoot}/boundaries.index.json`, 'utf8'))); }
export function actualBoundary(name: string): { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState } {
  const index: Record<string, string> = JSON.parse(readFileSync(`${fateTrojanRoot}/boundaries.index.json`, 'utf8'));
  if (!index[name]) throw new Error(`Missing actual Fate Trojan boundary ${name}`);
  const raw = JSON.parse(readFileSync(`${fateTrojanRoot}/${index[name]}`, 'utf8'));
  return { beforeLast: migrateSliceState(raw.beforeLast), lastIntent: raw.lastIntent, final: migrateSliceState(raw.final) };
}
export const actualCombatStart = () => actualSnapshot('combatStart');
