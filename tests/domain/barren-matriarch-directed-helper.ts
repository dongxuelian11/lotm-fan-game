import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { BARREN_MATRIARCH_PREPARATION_IDS, type BarrenMatriarchCommand } from '../../src/domain/barren-matriarch/types.js';

export const coffinBearerNaturalPath = 'tests/fixtures/coffin-bearer-v01610/natural.json';
export const motherLegacyKeys = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist', 'coffinBearer'] as const;
let originalCache: SliceState | undefined;
/** All 674 original public commands are replayed. No saved terminal source is
 * shortened, repaired, revived, or given replacement old-stage history. */
export function originalCoffinBearer(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(coffinBearerNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(coffinBearerNaturalPath, 'final');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(coffinBearerNaturalPath, 'creation');
    const seed = readObjectEntry<string>(coffinBearerNaturalPath, 'seed');
    expect(commands).toHaveLength(674); expect(original.status).toBe('ACTIVE');
    let replay = createSliceRun(original.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    expect(replay).toMatchObject({ revision: 675, week: 174, status: 'ACTIVE', health: 50, mind: 100, spirituality: 116,
      cash: 335, actionsRemaining: 3, injuryRisk: 5, random: { seed: 'cultivator-natural-v069', cursor: 208 },
      character: { gender: 'FEMALE' }, progression: { pathwayId: 'mother', sequence: 3, acting: 100, promotionWeek: 6 } });
    expect(replay.injuries).toEqual(original.injuries); expect(replay.injuries).toHaveLength(4);
    expect(replay.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[131, 'HEAVY', null], [671, 'LIGHT', null], [672, 'HEAVY', null], [673, 'LIGHT', null]]);
    expect(Object.keys(replay.progression.mastery)).toHaveLength(13); expect(replay.progression.mastery).toEqual(original.progression.mastery);
    expect(Object.values(replay.progression.mastery).filter(value => value === 0)).toHaveLength(3);
    expect(replay.coffinBearer.promotionWeek).toBe(165);
    expect(replay.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CB3-NOLAN', enemyStatus: 'SURRENDERED', enemyHealth: 50 });
    for (const key of motherLegacyKeys) expect(replay[key], key).toEqual(original[key]);
    originalCache = replay; assertValidSliceState(originalCache);
  }
  return structuredClone(originalCache);
}
export const oldMotherRoots = (s: SliceState) => motherLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** DECLARED UNIT-only pre-journal cursor selection. Original seed, all previous
 * actual rolls and all source histories remain unchanged. */
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
/** DECLARED directed unit inputs only, before first new-stage journal:
 * W177/date+21days, cash100000, AP/budget100, selected original-seed cursor.
 * Keeps actual H50/M100/S116, all four untreated injuries, risk5, all seven
 * source roots and all13 old mastery values including three legitimate zeroes.
 * Optional MALE is an explicit pre-journal unit character input. Original source
 * FEMALE history is preserved; this never claims a natural male campaign.
 * It is not natural campaign evidence. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true, gender: 'MALE' | 'FEMALE' = 'FEMALE'): SliceState {
  const s = originalCoffinBearer(), weeks = mature ? Math.max(0, s.coffinBearer.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); s.character.gender = gender; assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ba = (s: SliceState, command: BarrenMatriarchCommand, commands?: SliceIntent[]) => step(s, { type: 'BARREN_MATRIARCH', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectBarrenMatriarch = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'BARREN_MATRIARCH', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true, gender: 'MALE' | 'FEMALE' = 'FEMALE') => ba(directedInitial3(kind, mature, gender), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false, gender: 'MALE' | 'FEMALE' = 'FEMALE'): SliceState {
  let s = taught(kind, true, gender); for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'barren-matriarch-potion-1' });
  s = ba(s, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' }); return ba(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'barren-matriarch-potion-1', confirmed: true, acceptFeminization: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = ba(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
function actualRecovery(s: SliceState, treat: boolean, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: treat ? 'PAY' : 'DECLINE' }, commands); continue;
    }
    // The actual Mother source has not discovered this clinic. Discovery is a
    // real public one-action investigation, never a fabricated careKnown flag.
    if (!s.careKnown && s.injuries.some(injury => injury.severity === 'HEAVY' && injury.treatedRevision === null)) {
      s = step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands); continue;
    }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && (!treat || s.injuries.length === 0)) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public clinic/rest recovery did not complete.');
}
/** Actual REST, real medical PAY60 and subsequent REST, never direct healing. */
export const recover = (s: SliceState, commands?: SliceIntent[]) => actualRecovery(s, true, commands);
/** Real DECLINE keeps untreated HEAVY injuries; real REST can heal LIGHT ones.
 * Source histories stay unchanged and risk remains until all wounds heal. */
export const recoverResources = (s: SliceState, commands?: SliceIntent[]) => actualRecovery(s, false, commands);
