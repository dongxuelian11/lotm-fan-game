import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { MISFORTUNE_KNIGHT_PREPARATION_IDS, type MisfortuneKnightCommand } from '../../src/domain/misfortune-knight/types.js';

export const concealmentServantNaturalPath = 'tests/fixtures/concealment-servant-v01690/natural.json';
export const concealmentServantBranchPath = 'tests/fixtures/concealment-servant-v01690/original-enemy-approach.json';
export const darknessLegacyKeys = ['sleepless', 'midnight', 'nightmare', 'soother', 'spiritWarlock', 'nightwatcher', 'fearBishop', 'concealmentServant'] as const;
export const originalDarknessRoots = (s: SliceState) => darknessLegacyKeys.map(key => s[key]);
/** Shared explicit migration boundary for every historical fixture consumed by
 * current stage tests. Raw schema/hash assertions belong in separate tests. */
export function loadMisfortuneKnightFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** The living pre-Oswin branch is exactly the first518 original commands.
 * The original528-command DEAD final is never revived or used as a new start. */
export function originalConcealmentServant(): SliceState {
  if (!originalCache) {
    const s = loadMisfortuneKnightFixture(concealmentServantBranchPath, 'beforeLast');
    expect(s).toMatchObject({ revision: 519, week: 121, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120,
      cash: 420, actionsRemaining: 3, injuryRisk: 0, injuries: [], date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 10, day: 16 },
      random: { seed: 'sleepless-natural-v020', cursor: 341 }, progression: { pathwayId: 'darkness', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.character).toMatchObject({ name: '罗温', gender: 'FEMALE', age: 26, coreStats: { physique: 30, perception: 28, will: 30, knowledge: 23 } });
    expect(s.concealmentServant.promotionWeek).toBe(114);
    expect(s.spiritWarlock.companion).toEqual({ source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, invitedWeek: 53, releases: 1, deployments: 12, recalls: 12 });
    expect(s.spiritWarlock.practice).toMatchObject({ note: 'TABLE', dreamOpen: false, deliveries: 1, returns: 1 });
    expect(s.nightwatcher.encounter.enemy.status).toBe('DEAD'); expect(s.fearBishop.encounter.enemyStatus).toBe('SURRENDERED');
    expect(s.concealmentServant.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(s.concealmentServant.life).toMatchObject({ reflected: true, activeCase: null, playerLocation: 'EXIT',
      erin: { id: 'CS2-ERIN', age: 38, location: 'EXIT' }, box: { id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'START' },
      room: { id: 'CS2-ROOM', lengthMetres: 6, doorBlocked: false, concealed: false },
      trace: { id: 'CS2-TRACE-1', alive: false, conscious: false, searches: 2, delayedSearches: 1, totalDelaySeconds: 20 }, anchorLight: { on: false } });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** Unit-only selection of future input before guidance. Keep source seed and
 * every historical draw; never call this from the natural producer. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  if (s.misfortuneKnight.acquisitionJournal.length) throw new Error('Directed input must precede the new journal.');
  const key = `${s.random.seed}:${s.random.cursor}:${s.character.coreStats.will}:${kind}`;
  const cached = cursors.get(key); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const failure = (roll: number) => roll > chance && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 1024; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor), rolls = Array.from({ length: 3 }, () => random.nextInt(1, 100)), roll = rolls[0]!;
    const matches = kind === 'SUCCESS' ? roll > 5 && roll <= chance : kind === 'GREAT_SUCCESS' ? roll <= 5 : kind === 'FAILURE' ? failure(roll) : kind === 'GREAT_FAILURE' ? roll >= 96 : rolls.every(failure);
    if (matches) { cursors.set(key, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} input within1024 original-seed cursors.`);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const mk = (s: SliceState, command: MisfortuneKnightCommand, commands?: SliceIntent[]) => step(s, { type: 'MISFORTUNE_KNIGHT', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectMisfortuneKnight = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'MISFORTUNE_KNIGHT', command } as SliceIntent);
/** Advance five actual ordinary weeks from W121 to W126 before declaring unit
 * cash/AP/cursor inputs. Optional male input is explicitly unit-only and is
 * selected before any new journal; neither outcome changes that gender. */
let matureSourceCache: SliceState | undefined;
export function directedInitial2(kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  if (!matureSourceCache) {
    let source = originalConcealmentServant();
    for (let n = 0; source.week < 126 && n < 128; n++) source = step(source, { type: 'ACTION', action: 'REST' });
    expect(source.week).toBe(126); matureSourceCache = source;
  }
  const s = structuredClone(matureSourceCache); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.character.gender = gender; s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export const taught = (kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE') => mk(directedInitial2(kind, gender), { type: 'LEARN_GUIDANCE' });
export const dose = { type: 'CONSUME', bottleId: 'misfortune-knight-potion-1', confirmed: true } as const;
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false, gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  let s = taught(kind, gender); for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) s = mk(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = mk(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
  s = mk(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); return mk(s, { type: 'PREPARE_PROMOTION' });
}
const promotedCache = new Map<string, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  const key = `${kind}:${gender}`;
  if (!promotedCache.has(key)) { const s = mk(prepared(kind, false, gender), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(key, s); }
  return structuredClone(promotedCache.get(key)!);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    if (s.activeEvent) throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite ordinary rest did not complete.');
}
