import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { BEAUTY_GODDESS_PREPARATION_IDS, type BeautyGoddessCommand } from '../../src/domain/beauty-goddess/types.js';

export const lifeGiverNaturalPath = 'tests/fixtures/life-giver-v01680/natural.json';
export const moonLegacyKeys = ['apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar', 'witchKing', 'summoningMaster', 'lifeGiver'] as const;
export const originalMoonRoots = (s: SliceState) => moonLegacyKeys.map(key => s[key]);
let originalCache: SliceState | undefined;
/** Read the actual final572-command source, never a nested old entry snapshot.
 * Raw schema165 stays pinned separately; current assertions use migration. */
export function originalLifeGiver(): SliceState {
  if (!originalCache) {
    const raw = readObjectEntry<SliceState>(lifeGiverNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 165, contentVersion: 'life-giver-v165' });
    expect(readObjectEntry<SliceIntent[]>(lifeGiverNaturalPath, 'commands')).toHaveLength(572);
    const s = migrateSliceState(raw);
    expect(s).toMatchObject({ revision: 573, week: 131, status: 'ACTIVE', health: 70, mind: 100, spirituality: 120,
      cash: 634, actionsRemaining: 3, injuryRisk: 2, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 25 },
      random: { seed: 'apothecary-rebuild-first', cursor: 315 }, progression: { pathwayId: 'moon', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(s.progression.mastery).toEqual(raw.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(21);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.injuries).toEqual(raw.injuries); expect(s.injuries).toHaveLength(3); expect(s.injuries.every(i => i.severity === 'LIGHT' && i.treatedRevision === null)).toBe(true);
    expect(s.character).toEqual(raw.character); expect(s.character).toMatchObject({ name: '艾琳', gender: 'FEMALE', age: 26, coreStats: { physique: 32, perception: 28, will: 27, knowledge: 25 } });
    expect(s.combatHistory).toEqual(raw.combatHistory); expect(s.lifeGiver.promotionWeek).toBe(120);
    for (const key of moonLegacyKeys) expect(s[key], key).toEqual(raw[key]);
    expect(s.summoningMaster.life.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', location: 'HOME', status: 'ALIVE', health: 100, mind: 92, stamina: 88, ordinaryDistanceM: 334, gateCrossings: 5 });
    expect(s.summoningMaster.life.partner.restHistory.map(r => r.week)).toEqual([105, 123]);
    expect(s.witchKing.life.papers.map(p => p.status)).toEqual(['CONSUMED', 'CONSUMED', 'CONSUMED']);
    expect(s.lifeGiver.life.beads.filter(b => b.purpose === 'COMBAT').map(b => [b.status, b.location])).toEqual([['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY'], ['SPENT', 'RETURN_TRAY']]);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** Declared future input selection before the new journal, retaining the actual
 * source seed and every old draw. Never used by the natural producer. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  if (s.beautyGoddess.acquisitionJournal.length) throw new Error('Directed input must precede the new journal.');
  const key = `${s.random.seed}:${s.random.cursor}:${s.character.coreStats.will}:${kind}`;
  const cached = cursors.get(key); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const failure = (roll: number) => roll > chance && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 1024; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor), rolls = Array.from({ length: 3 }, () => random.nextInt(1, 100)), roll = rolls[0]!;
    const matches = kind === 'SUCCESS' ? roll > 5 && roll <= chance : kind === 'GREAT_SUCCESS' ? roll <= 5 : kind === 'FAILURE' ? failure(roll) : kind === 'GREAT_FAILURE' ? roll >= 96 : rolls.every(failure);
    if (matches) { cursors.set(key, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} input within 1024 original-seed cursors.`);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const bg = (s: SliceState, command: BeautyGoddessCommand, commands?: SliceIntent[]) => step(s, { type: 'BEAUTY_GODDESS', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectBeautyGoddess = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'BEAUTY_GODDESS', command } as SliceIntent);
/** Actual source is only11 weeks after S2. Advance one real week using ordinary
 * REST, then declare cash/AP and future cursor. The optional MALE identity is
 * an explicitly directed unit setup before any new record; raw source stays female. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  let s = originalLifeGiver();
  for (let n = 0; s.week < 132 && n < 16; n++) s = step(s, { type: 'ACTION', action: 'REST' });
  expect(s.week).toBe(132); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.character.gender = gender; s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export const taught = (kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE') => bg(directedInitial2(kind, gender), { type: 'LEARN_GUIDANCE' });
export const dose = { type: 'CONSUME', bottleId: 'beauty-goddess-potion-1', confirmed: true } as const;
export const acknowledge = { type: 'CONFIRM_TRANSFORMATION', confirmed: true } as const;
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false, gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  let s = taught(kind, gender); for (const taskId of BEAUTY_GODDESS_PREPARATION_IDS) s = bg(s, { type: 'PREPARE_TASK', taskId });
  s = bg(s, acknowledge);
  if (labour) for (let n = 0; n < 5; n++) s = bg(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
  s = bg(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); return bg(s, { type: 'PREPARE_PROMOTION' });
}
const promotedCache = new Map<string, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS', gender: 'FEMALE' | 'MALE' = 'FEMALE'): SliceState {
  const key = `${kind}:${gender}`;
  if (!promotedCache.has(key)) { const s = bg(prepared(kind, false, gender), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(key, s); }
  return structuredClone(promotedCache.get(key)!);
}
/** Ordinary recovery, no forced paid clinic for the actual three LIGHT wounds. */
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    if (s.activeEvent) throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite ordinary rest did not complete.');
}
