import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CIVILIZATION_ENLIGHTENER_PREPARATION_IDS, type CivilizationEnlightenerCommand } from '../../src/domain/civilization-enlightener/types.js';

export const knowledgeMentorNaturalPath = 'tests/fixtures/knowledge-mentor-v01670/natural.json';
export const paragonLegacyKeys = ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar', 'knowledgeMentor'] as const;
export const originalParagonRoots = (s: SliceState) => paragonLegacyKeys.map(key => s[key]);
let originalCache: SliceState | undefined;
/** The raw 691-command file remains untouched. Current-schema assertions are
 * always made on migration output, never the historical schema164 capture. */
export function originalKnowledgeMentor(): SliceState {
  if (!originalCache) {
    const raw = readObjectEntry<SliceState>(knowledgeMentorNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 164, contentVersion: 'knowledge-mentor-v164' });
    expect(readObjectEntry<SliceIntent[]>(knowledgeMentorNaturalPath, 'commands')).toHaveLength(691);
    const s = migrateSliceState(raw);
    expect(s).toMatchObject({ revision: 692, week: 169, status: 'ACTIVE', health: 70, mind: 99, spirituality: 113,
      cash: 576, actionsRemaining: 3, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 9, day: 16 },
      random: { seed: 'savant-rebuild-first', cursor: 308 }, progression: { pathwayId: 'paragon', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(s.progression.mastery).toEqual(raw.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.injuries).toEqual(raw.injuries); expect(s.injuries).toHaveLength(1); expect(s.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    expect(s.character).toEqual(raw.character); expect(s.character).toMatchObject({ name: '伊文', gender: 'FEMALE', age: 26, coreStats: { physique: 29, perception: 28, will: 24, knowledge: 31 } });
    expect(s.combatHistory).toEqual(raw.combatHistory); expect(s.knowledgeMentor.promotionWeek).toBe(156);
    for (const key of paragonLegacyKeys) expect(s[key], key).toEqual(raw[key]);
    expect(s.alchemist.life.creations.map(o => [o.id, o.charge, o.durability, o.location, o.active])).toEqual([
      ['AL4-BOX-1', 0, 100, 'PLAYER', false], ['AL4-FRAME-1', 0, 90, 'PLAYER', false],
    ]);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** Select a future input only before any acquisition receipt. The predecessor
 * seed and every existing draw, failure, body, resource and mastery stay true. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  if (s.civilizationEnlightener.acquisitionJournal.length) throw new Error('Directed input must precede the new journal.');
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
/** Declared unit inputs: cash100000, AP/budget100, selected future cursor.
 * Actual week169 already exceeds promotion156 by13 weeks. No calendar edit,
 * healing, resource recharge, old-history rewrite or mastery assignment. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = originalKnowledgeMentor(); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ce = (s: SliceState, command: CivilizationEnlightenerCommand, commands?: SliceIntent[]) => step(s, { type: 'CIVILIZATION_ENLIGHTENER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectEnlightener = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'CIVILIZATION_ENLIGHTENER', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS') => ce(directedInitial2(kind), { type: 'LEARN_GUIDANCE' });
export const dose = { type: 'CONSUME', bottleId: 'civilization-enlightener-potion-1', confirmed: true } as const;
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) s = ce(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = ce(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
  s = ce(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); return ce(s, { type: 'PREPARE_PROMOTION' });
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = ce(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
/** Public clinic payment and later REST, never direct injury repair. */
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' }, commands); continue;
    }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public clinic care and rest did not complete.');
}
