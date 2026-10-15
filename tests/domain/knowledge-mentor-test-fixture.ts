import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { KnowledgeMentorCommand } from '../../src/domain/knowledge-mentor/types.js';
import { projectKnowledgeMentorLife, type KnowledgeMentorCaseId } from '../../src/domain/knowledge-mentor/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

export const knowledgeMentorFixturePath = 'tests/fixtures/knowledge-mentor-v01670/natural.json';
export const knowledgeMentorBoundaryPath = 'tests/fixtures/knowledge-mentor-v01670/boundaries.json';
export const paragonLegacyKeys = ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar'] as const;
export interface KnowledgeMentorBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export function knowledgeMentorSnapshot(key: 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final'): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(knowledgeMentorFixturePath, key));
}
export function knowledgeMentorBoundary(key: string): KnowledgeMentorBoundary {
  const b = readObjectEntry<KnowledgeMentorBoundary>(knowledgeMentorBoundaryPath, key);
  return { beforeLast: migrateSliceState(b.beforeLast), lastIntent: b.lastIntent, final: migrateSliceState(b.final) };
}
/** Enumerate names without JSON.parse of all full-history saved states together. */
export function knowledgeMentorBoundaryNames(): string[] {
  const text = readFileSync(knowledgeMentorBoundaryPath, 'utf8'), keys: string[] = []; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { const start = i; let escaped = false;
      for (i++; i < text.length; i++) { const x = text[i]; if (escaped) escaped = false; else if (x === '\\') escaped = true; else if (x === '"') break; }
      let next = i + 1; while (next < text.length && /\s/.test(text[next]!)) next++;
      if (depth === 1 && text[next] === ':') keys.push(JSON.parse(text.slice(start, i + 1)) as string);
    } else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') depth--;
  }
  return keys;
}
/** Explicit directed unit setup. Never a natural campaign capture. No original,
 * old person, promotion, injury, mastery or recorded resource is rewritten. */
export function directedLifeReady(): SliceState {
  const s = knowledgeMentorSnapshot('promoted');
  s.cash = 10000; s.weeklyBudget = 3; s.actionsRemaining = 3;
  assertValidSliceState(s); return s;
}
export function unitBudget(s: SliceState): SliceState {
  const next = structuredClone(s); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
/** Choose a genuine deterministic cursor for a unit-only requested check roll.
 * Production RNG and validators remain intact; no natural record is changed. */
export function directedCheckInput(s: SliceState, roll: number): SliceState {
  const next = structuredClone(s);
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 10000; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (random.nextInt(1, 100) === roll) { next.random.cursor = cursor; assertValidSliceState(next); return next; }
  }
  throw new Error(`No directed cursor found for roll ${roll}`);
}
export function km(s: SliceState, command: KnowledgeMentorCommand, roll?: number): SliceState {
  const input = roll === undefined ? s : directedCheckInput(s, roll), before = structuredClone(input);
  const result = applySliceIntent(input, { type: 'KNOWLEDGE_MENTOR', command });
  expect(input).toEqual(before); assertValidSliceState(result); return result;
}
export function rejectKm(s: SliceState, command: unknown): void {
  const before = structuredClone(s);
  expect(() => applySliceIntent(s, { type: 'KNOWLEDGE_MENTOR', command } as SliceIntent)).toThrow(); expect(s).toEqual(before);
}
export const attempt = (s: SliceState, id: KnowledgeMentorCaseId = 'documented-cycle') => projectKnowledgeMentorLife(s).cases.find(c => c.id === id)!.attempts.at(-1)!;
export function beginCase(s: SliceState, id: KnowledgeMentorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = km(unitBudget(s), { type: 'OBSERVE', caseId: id });
  s = km(unitBudget(s), { type: 'PREPARE', caseId: id, method });
  return km(s, { type: 'PERFORM', caseId: id });
}
export function measure(s: SliceState, id: KnowledgeMentorCaseId): SliceState {
  for (const type of ['READ_RECORDS', 'MEASURE_BASELINE', 'MEASURE_BASELINE'] as const) s = km(s, { type, caseId: id });
  return s;
}
export function install(s: SliceState, id: KnowledgeMentorCaseId): SliceState {
  s = km(s, { type: 'BUY_PLATE', caseId: id }); s = km(s, { type: 'BIND_PLATE', caseId: id }, 1);
  return km(s, { type: 'INSTALL_PLATE', caseId: id });
}
export function recharge(s: SliceState): SliceState {
  for (const objectId of ['AL4-BOX-1', 'AL4-FRAME-1'] as const) {
    if (s.alchemist.life.creations.find(x => x.id === objectId)!.charge < 3) s = km(unitBudget(s), { type: 'RECHARGE', objectId });
  }
  return s;
}
/** Physically clean up a completed three-step case, then pay its report action. */
export function closeCase(s: SliceState, id: KnowledgeMentorCaseId): SliceState {
  let a = attempt(s, id);
  if (a.programActive) s = km(s, { type: 'STOP_PROGRAM', caseId: id });
  a = attempt(s, id);
  if (a.parcel.holder === 'AL4-BOX-1') {
    if (a.ownerNode !== a.parcel.location) s = km(s, { type: 'MOVE', caseId: id, to: a.parcel.location as 'BENCH_START' | 'BENCH_END' });
    s = km(s, { type: 'COLLECT_PARCEL', caseId: id });
  }
  if (attempt(s, id).ownerNode !== 'BENCH_START') s = km(s, { type: 'MOVE', caseId: id, to: 'BENCH_START' });
  if (attempt(s, id).parcel.holder === 'PLAYER') s = km(s, { type: 'RETURN_PARCEL', caseId: id });
  if (attempt(s, id).plate) s = km(s, { type: 'RECYCLE_PLATE', caseId: id });
  const box = s.alchemist.life.creations.find(x => x.id === 'AL4-BOX-1')!;
  if (attempt(s, id).ownerNode !== box.location) s = km(s, { type: 'MOVE', caseId: id, to: box.location as 'BENCH_START' | 'BENCH_END' });
  s = km(s, { type: 'RETURN_ORIGINALS', caseId: id }); s = km(s, { type: 'VERIFY', caseId: id });
  s = km(s, { type: 'CLOSE', caseId: id }); return km(unitBudget(s), { type: 'REPORT', caseId: id });
}
export function ordinaryCase(s: SliceState, id: KnowledgeMentorCaseId): SliceState {
  s = measure(beginCase(s, id, 'ORDINARY'), id);
  if (id === 'consented-transfer') {
    s = km(s, { type: 'CONSENT', caseId: id, permission: 'PARCEL' });
    s = km(s, { type: 'TAKE_PARCEL', caseId: id }); s = km(s, { type: 'LOAD_PARCEL', caseId: id });
  }
  if (id === 'blocked-cycle') s = km(s, { type: 'PLACE_STOP_BAR', caseId: id });
  s = km(s, { type: 'MANUAL_STEP', caseId: id }); s = km(s, { type: 'MANUAL_STEP', caseId: id });
  if (id === 'blocked-cycle') {
    s = km(s, { type: 'MANUAL_STOP', caseId: id }); s = km(s, { type: 'CLEAR_STOP_BAR', caseId: id });
    s = km(s, { type: 'MANUAL_STEP', caseId: id });
  }
  s = km(s, { type: 'MANUAL_STEP', caseId: id }); return closeCase(s, id);
}
export function directedPracticed(): SliceState {
  let s = directedLifeReady();
  for (const id of ['documented-cycle', 'consented-transfer', 'blocked-cycle'] as const) s = ordinaryCase(s, id);
  return km(unitBudget(s), { type: 'REFLECT' });
}
export function directedCombatStart(plates = 1): SliceState {
  let s = recharge(directedPracticed());
  for (let i = 0; i < plates; i++) s = km(unitBudget(s), { type: 'PREPARE_COMBAT_PLATE' }, 1);
  s = km(unitBudget(s), { type: 'ENCOUNTER_TALK' }); return km(s, { type: 'ENCOUNTER_FIGHT' });
}
