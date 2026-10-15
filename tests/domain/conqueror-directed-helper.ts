import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CONQUEROR_PREPARATION_IDS, type ConquerorCommand } from '../../src/domain/conqueror/types.js';

export const weatherWarlockNaturalPath = 'tests/fixtures/weather-warlock-v01650/natural.json';
export const hunterLegacyKeys = ['hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper', 'ironBloodKnight', 'warBishop', 'weatherWarlock'] as const;
export const originalHunterRoots = (s: SliceState) => hunterLegacyKeys.map(key => s[key]);
let originalCache: SliceState | undefined;
/** Replay every one of the actual source's 658 commands. The source is never
 * shortened, repaired, replenished, rerolled or replaced by invented history. */
export function originalWeatherWarlock(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(weatherWarlockNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(weatherWarlockNaturalPath, 'final');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(weatherWarlockNaturalPath, 'creation');
    const seed = readObjectEntry<string>(weatherWarlockNaturalPath, 'seed');
    expect(commands).toHaveLength(658);
    let replay = createSliceRun(original.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    expect(replay).toMatchObject({ revision: 659, week: 164, status: 'ACTIVE', health: 100, mind: 100, spirituality: 101,
      cash: 576, actionsRemaining: 2, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 8, day: 12 },
      random: { seed: 'hunter-rebuild-first', cursor: 287 }, progression: { pathwayId: 'hunter', sequence: 2, acting: 100, promotionWeek: 9 } });
    expect(replay.progression.mastery).toEqual(original.progression.mastery); expect(Object.keys(replay.progression.mastery)).toHaveLength(21);
    expect(replay.injuries).toEqual(original.injuries); expect(replay.injuryRisk).toBe(original.injuryRisk);
    expect(replay.character).toEqual(original.character); expect(replay.combatHistory).toEqual(original.combatHistory);
    expect(replay.weatherWarlock.promotionWeek).toBe(155);
    expect(replay.ironBloodKnight.team.members.slice(0, 5).map(m => [m.health, m.energy])).toEqual([[100, 5], [100, 5], [100, 5], [100, 5], [100, 6]]);
    for (const key of hunterLegacyKeys) expect(replay[key], key).toEqual(original[key]);
    originalCache = replay; assertValidSliceState(originalCache);
  }
  return structuredClone(originalCache);
}
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** Explicit directed-unit input selection BEFORE the first new acquisition
 * event. Every actual predecessor seed, roll, identity and outcome remains. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const key = `${s.random.seed}:${s.random.cursor}:${s.character.coreStats.will}:${kind}`;
  const cached = cursors.get(key); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const failed = (roll: number) => roll > chance && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
    const rolls = Array.from({ length: 3 }, () => rng.nextInt(1, 100)), roll = rolls[0]!;
    const matches = kind === 'SUCCESS' ? roll > 5 && roll <= chance : kind === 'GREAT_SUCCESS' ? roll <= 5
      : kind === 'FAILURE' ? failed(roll) : kind === 'GREAT_FAILURE' ? roll >= 96 : rolls.every(failed);
    if (matches) { cursors.set(key, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} input within 512 original-seed cursors.`);
}
/** DECLARED directed-unit inputs: mature W167/date+21d, cash100000,
 * AP/weeklyBudget100, selected future cursor of the original seed. No direct
 * health, energy, spirituality, roster, history or mastery repair. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalWeatherWarlock(), weeks = mature ? Math.max(0, s.weatherWarlock.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const cq = (s: SliceState, command: ConquerorCommand, commands?: SliceIntent[]) => step(s, { type: 'CONQUEROR', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectConqueror = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'CONQUEROR', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => cq(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' });
export const dose = { type: 'CONSUME', bottleId: 'conqueror-potion-1', confirmed: true } as const;
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of CONQUEROR_PREPARATION_IDS) s = cq(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = cq(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
  s = cq(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); return cq(s, { type: 'PREPARE_PROMOTION' });
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = cq(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
/** Public REST only; recovery is never direct resource assignment. */
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'DECLINE' }, commands); continue;
    }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public rest did not complete.');
}
