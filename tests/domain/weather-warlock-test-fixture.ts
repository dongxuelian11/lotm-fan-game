import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

export const weatherFixturePath = 'tests/fixtures/weather-warlock-v01650/natural.json';
export type WeatherSnapshot = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final';
/** Real same-seed public-command snapshots. No replacement roster or invented S2 promotion. */
export function weatherSnapshot(key: WeatherSnapshot): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(weatherFixturePath, 'utf8'))[key]);
}
export const weatherContext = (s: SliceState, roll = 1): SeerContext => ({
  roll: vi.fn(min => min), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({
    ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll,
  })),
});
/** Explicit unit-only AP/cash budget; original bodies, health, energy, history and objects are untouched. */
export function weatherLifeReady(): SliceState {
  const s = weatherSnapshot('promoted');
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 10000;
  return s;
}
