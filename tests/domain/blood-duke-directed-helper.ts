import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { BLOOD_DUKE_PREPARATION_IDS, type BloodDukeCommand } from '../../src/domain/blood-duke/types.js';

export const blathererNaturalPath = 'tests/fixtures/blatherer-v01560/natural.json';
export const abyssLegacyKeys = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil', 'blatherer'] as const;
let originalCache: SliceState | undefined;
let originalDeadCache: SliceState | undefined;
/** Actual public replay of exactly583 original commands, before optional old TALK.
 * No state snapshot is manufactured from the immutable592-command DEAD ending. */
export function originalBlathererPrefix(): SliceState {
  if (!originalCache) {
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(blathererNaturalPath, 'creation');
    const seed = readObjectEntry<string>(blathererNaturalPath, 'seed');
    const commands = readObjectEntry<SliceIntent[]>(blathererNaturalPath, 'commands');
    const final = readObjectEntry<SliceState>(blathererNaturalPath, 'final');
    expect(commands).toHaveLength(592); expect(final.status).toBe('DEAD');
    expect(commands[583]).toEqual({ type: 'BLATHERER', command: { type: 'ENCOUNTER_TALK' } });
    let state = createSliceRun(final.runId, creation, seed);
    for (const command of commands.slice(0, 583)) state = applySliceIntent(state, command);
    assertValidSliceState(state); originalCache = state;
  }
  return structuredClone(originalCache);
}
export function originalBlathererDead(): SliceState {
  originalDeadCache ??= migrateSliceState(readObjectEntry<unknown>(blathererNaturalPath, 'final'));
  return structuredClone(originalDeadCache);
}
export const oldAbyssRoots = (s: SliceState) => abyssLegacyKeys.map(key => s[key]);
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
/** Explicit pre-journal UNIT budgets: week158 (12 full weeks after promotion146),
 * cash100000, AP100 and selected original-seed cursor. Keeps original H100/M100/S120,
 * no injuries/risk0, stats, all seven roots and14 skills including legitimate zeros.
 * This is directed unit coverage, never a natural completion fixture. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalBlathererPrefix(), weeks = mature ? Math.max(0, s.blatherer.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const bd = (s: SliceState, command: BloodDukeCommand, commands?: SliceIntent[]) => step(s, { type: 'BLOOD_DUKE', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectBloodDuke = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'BLOOD_DUKE', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => bd(directedInitial3(kind, mature), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = bd(s, { type: 'POTION_WORK', bottleId: 'blood-duke-potion-1' });
  s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' }); return bd(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'blood-duke-potion-1', confirmed: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = bd(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
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
