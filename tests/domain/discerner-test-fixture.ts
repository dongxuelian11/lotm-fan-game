import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

export const discernerFixturePath = 'tests/fixtures/discerner-v01660/natural.json';
export const discernerBoundaryPath = 'tests/fixtures/discerner-v01660/boundaries.json';
export type DiscernerSnapshot = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final';
export interface DiscernerBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
/** Select actual same-seed public-command captures, never synthesize a natural result.
 * Parse one tree at a time to avoid retaining every full-history boundary. */
export function discernerSnapshot(key: DiscernerSnapshot): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(discernerFixturePath, key));
}
export function discernerBoundary(key: string): DiscernerBoundary {
  const value = readObjectEntry<DiscernerBoundary>(discernerBoundaryPath, key);
  return { beforeLast: migrateSliceState(value.beforeLast), lastIntent: value.lastIntent, final: migrateSliceState(value.final) };
}
/** List root names without decoding every full-history boundary simultaneously. */
export function discernerBoundaryNames(): string[] {
  const text = readFileSync(discernerBoundaryPath, 'utf8'), keys: string[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i; let escaped = false;
      for (i++; i < text.length; i++) {
        const char = text[i];
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') break;
      }
      let next = i + 1; while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      if (depth === 1 && text[next] === ':') keys.push(JSON.parse(text.slice(start, i + 1)) as string);
    } else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return keys;
}
/** Explicit unit-only normal-check RNG. This is not a natural-play claim. */
export const discernerContext = (s: SliceState, roll = 1): SeerContext => ({
  roll: vi.fn(min => min), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({
    ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll,
  })),
});
/** Explicit unit-only AP/cash budget; retain actual promotion, original bodies,
 * injuries, current energy, original cards/personas and all old history. */
export function discernerLifeReady(): SliceState {
  const s = discernerSnapshot('promoted');
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 10000;
  return s;
}
export const audienceLegacyKeys = ['audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker', 'manipulator', 'dreamWeaver'] as const;
