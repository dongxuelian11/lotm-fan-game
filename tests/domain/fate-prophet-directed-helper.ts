import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { FATE_PROPHET_PREPARATION_IDS, type FateProphetCommand } from '../../src/domain/fate-prophet/types.js';

export const chaosWalkerNaturalPath = 'tests/fixtures/chaos-walker-v01580/natural.json';
export const wheelLegacyKeys = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage', 'chaosWalker'] as const;
let originalCache: SliceState | undefined;
/** Exact migration of the immutable final state produced by all 551 actual public
 * source commands. It remains the living W140 source, never a fabricated branch. */
export function originalChaosWalker(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(chaosWalkerNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(chaosWalkerNaturalPath, 'final');
    expect(commands).toHaveLength(551); expect(original.status).toBe('ACTIVE');
    expect(original).toMatchObject({ week: 140, revision: 552, health: 60, mind: 100, spirituality: 120, cash: 630, actionsRemaining: 3 });
    originalCache = migrateSliceState(original); assertValidSliceState(originalCache);
    expect(wheelLegacyKeys.map(key => originalCache![key])).toEqual(wheelLegacyKeys.map(key => original[key]));
  }
  return structuredClone(originalCache);
}
export const oldWheelRoots = (s: SliceState) => wheelLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** UNIT-only pre-journal source selection. No prior roll or history is changed;
 * bounded original-seed cursors select the next real public potion check(s). */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const key = `${s.random.seed}:${s.random.cursor}:${s.character.coreStats.will}:${kind}`;
  const cached = cursors.get(key); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const ordinaryFailure = (roll: number) => roll > chance && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
    const rolls = Array.from({ length: 3 }, () => rng.nextInt(1, 100)), roll = rolls[0]!;
    const matches = kind === 'SUCCESS' ? roll > 5 && roll <= chance : kind === 'GREAT_SUCCESS' ? roll <= 5
      : kind === 'FAILURE' ? ordinaryFailure(roll) : kind === 'GREAT_FAILURE' ? roll >= 96 : rolls.every(ordinaryFailure);
    if (matches) { cursors.set(key, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} source among 512 original-seed cursors.`);
}
/** Explicit pre-journal UNIT budgets: week142 (12 full weeks after promotion130),
 * cash100000, AP100 and selected original-seed cursor. Keeps original H60/M100/S120,
 * both untreated HEAVY injuries (333,547), LIGHT549, risk2, original luck, all seven roots and15 skills including legitimate zeros.
 * This is directed unit coverage, never a natural completion fixture. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalChaosWalker(), weeks = mature ? Math.max(0, s.chaosWalker.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const fp = (s: SliceState, command: FateProphetCommand, commands?: SliceIntent[]) => step(s, { type: 'FATE_PROPHET', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectFateProphet = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'FATE_PROPHET', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => fp(directedInitial3(kind, mature), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = fp(s, { type: 'POTION_WORK', bottleId: 'fate-prophet-potion-1' });
  s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' }); return fp(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'fate-prophet-potion-1', confirmed: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = fp(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
/** Actual REST commands only. Never edits actor resources, old roots or journals. */
export function recover(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 24; n++) {
    if (s.activeEvent) throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public rest resource recovery did not complete.');
}
