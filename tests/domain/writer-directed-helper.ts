import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { WRITER_PREPARATION_IDS, type WriterCommand } from '../../src/domain/writer/types.js';

export const discernerNaturalPath = 'tests/fixtures/discerner-v01660/natural.json';
export const audienceLegacyKeys = ['audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker', 'manipulator', 'dreamWeaver', 'discerner'] as const;
export const originalAudienceRoots = (s: SliceState) => audienceLegacyKeys.map(key => s[key]);
let originalCache: SliceState | undefined;
/** Migrate the exact final save from the actual 580-command source. No repair,
 * replenishment, invented prior journal or old mastery assignment is allowed. */
export function originalDiscerner(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(discernerNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(discernerNaturalPath, 'final');
    expect(commands).toHaveLength(580);
    const migrated = migrateSliceState(original);
    expect(migrated).toMatchObject({ revision: 581, week: 126, status: 'ACTIVE', health: 98, mind: 98, spirituality: 120,
      cash: 560, actionsRemaining: 1, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 20 },
      random: { seed: 'audience-rebuild-first', cursor: 477 }, progression: { pathwayId: 'audience', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(migrated.progression.mastery).toEqual(original.progression.mastery); expect(Object.keys(migrated.progression.mastery)).toHaveLength(23);
    expect(Object.values(migrated.progression.mastery).filter(v => v === 0)).toHaveLength(8);
    expect(migrated.injuries).toEqual([]); expect(migrated.injuryRisk).toBe(0);
    expect(migrated.character).toEqual(original.character); expect(migrated.combatHistory).toEqual(original.combatHistory);
    expect(migrated.discerner.promotionWeek).toBe(117);
    for (const key of audienceLegacyKeys) expect(migrated[key], key).toEqual(original[key]);
    originalCache = migrated; assertValidSliceState(originalCache);
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
/** DECLARED directed-unit inputs: mature W129/date+21d, cash100000,
 * AP/weeklyBudget100, selected future cursor of the original seed. No direct
 * health, mind, spirituality, identity, history or mastery repair. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalDiscerner(), weeks = mature ? Math.max(0, s.discerner.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const wr = (s: SliceState, command: WriterCommand, commands?: SliceIntent[]) => step(s, { type: 'WRITER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectWriter = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'WRITER', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => wr(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' });
export const dose = { type: 'CONSUME', bottleId: 'writer-potion-1', confirmed: true } as const;
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of WRITER_PREPARATION_IDS) s = wr(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = wr(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
  s = wr(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); return wr(s, { type: 'PREPARE_PROMOTION' });
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = wr(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s); }
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
