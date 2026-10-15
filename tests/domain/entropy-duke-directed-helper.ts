import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { ENTROPY_DUKE_PREPARATION_IDS, type EntropyDukeCommand } from '../../src/domain/entropy-duke/types.js';

export const frenzyMageNaturalPath = 'tests/fixtures/frenzy-mage-v01590/natural.json';
export const blackEmperorLegacyKeys = ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder', 'fallenEarl', 'frenzyMage'] as const;
let originalCache: SliceState | undefined;
/** Actual living first555-command prefix. The published complete558-command
 * source is DEAD and is never revived or edited. Replay preserves the original
 * creation, seed, choices, two untreated HEAVY injuries and zero masteries. */
export function originalFrenzyMage(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(frenzyMageNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'final');
    const practiced = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'practiced');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(frenzyMageNaturalPath, 'creation');
    const seed = readObjectEntry<string>(frenzyMageNaturalPath, 'seed');
    expect(commands).toHaveLength(558); expect(original.status).toBe('DEAD');
    let replay = createSliceRun(original.runId, creation, seed);
    for (const command of commands.slice(0, 555)) replay = applySliceIntent(replay, command);
    expect(replay).toMatchObject({ revision: 556, week: 141, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120,
      cash: 540, random: { seed: 'lawyer-natural-v063', cursor: 189 }, progression: { sequence: 3, acting: 100 } });
    expect(replay.injuries).toEqual(original.injuries); expect(Object.keys(replay.progression.mastery)).toHaveLength(12);
    expect(replay.frenzyMage.encounter.status).toBe('AVAILABLE');
    for (const key of blackEmperorLegacyKeys.filter(key => key !== 'frenzyMage')) expect(replay[key]).toEqual(practiced[key]);
    originalCache = replay; assertValidSliceState(originalCache);
  }
  return structuredClone(originalCache);
}
export const oldBlackEmperorRoots = (s: SliceState) => blackEmperorLegacyKeys.map(key => s[key]);
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
/** Explicit pre-journal UNIT budgets: week145 (12 weeks after actual W133),
 * cash100000, AP100 and selected original-seed cursor. Keeps original H100/M100/
 * S120, two untreated HEAVY injuries184/436, risk and all seven source histories,
 * actual old gifts and twelve skills including three legitimate zeros.
 * This is directed unit coverage, never natural campaign-completion evidence. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalFrenzyMage(), weeks = mature ? Math.max(0, s.frenzyMage.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ed = (s: SliceState, command: EntropyDukeCommand, commands?: SliceIntent[]) => step(s, { type: 'ENTROPY_DUKE', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectEntropyDuke = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'ENTROPY_DUKE', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => ed(directedInitial3(kind, mature), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = ed(s, { type: 'POTION_WORK', bottleId: 'entropy-duke-potion-1' });
  s = ed(s, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' }); return ed(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'entropy-duke-potion-1', confirmed: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = ed(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
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
