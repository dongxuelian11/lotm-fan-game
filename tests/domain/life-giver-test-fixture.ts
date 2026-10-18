import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { lifeGiverBoundaryFile } from '../../scripts/play/life-giver-boundary-files.mjs';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { LifeGiverCommand } from '../../src/domain/life-giver/types.js';
import type { LifeGiverCaseId } from '../../src/domain/life-giver/life.js';

export const lifeGiverFixturePath = 'tests/fixtures/life-giver-v01680/natural.json';
export const lifeGiverBoundaryIndexPath = 'tests/fixtures/life-giver-v01680/boundaries.index.json';
export const summoningMasterFixturePath = 'tests/fixtures/summoning-master-v01440/natural.json';
export const moonLegacyKeys = ['apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar'] as const;
export interface LifeGiverBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export function lifeGiverSnapshot(key: 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final'): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(lifeGiverFixturePath, key));
}
export function lifeGiverBoundary(key: string): LifeGiverBoundary {
  const b = readObjectEntry<LifeGiverBoundary>(lifeGiverBoundaryFile('tests/fixtures/life-giver-v01680', key), key);
  return { beforeLast: migrateSliceState(b.beforeLast), lastIntent: b.lastIntent, final: migrateSliceState(b.final) };
}
/** Read the small recorded manifest, never allocate/parse the complete boundaries document. */
export function lifeGiverBoundaryNames(): string[] {
  return readObjectEntry<{ key: string }[]>(lifeGiverFixturePath, 'boundaryManifest').map(b => b.key);
}
/** Directed unit-only budget. Never written back to a natural campaign fixture. */
export function unitBudget(s: SliceState): SliceState {
  const next = structuredClone(s); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
export function directedLifeReady(): SliceState {
  const s = unitBudget(lifeGiverSnapshot('promoted')); s.cash = 10000;
  assertValidSliceState(s); return s;
}
/** Unit-only deterministic check cursor. Production draws and all validators remain real. */
export function directedCheckInput(s: SliceState, roll: number): SliceState {
  const next = structuredClone(s);
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 10000; cursor++) {
    if (new DeterministicActionRandomStream(s.random.seed, cursor).nextInt(1, 100) === roll) {
      next.random.cursor = cursor; assertValidSliceState(next); return next;
    }
  }
  throw new Error(`No directed cursor for ${roll}`);
}
export function lg(s: SliceState, command: LifeGiverCommand, roll?: number): SliceState {
  const input = roll === undefined ? s : directedCheckInput(s, roll), before = structuredClone(input);
  const result = applySliceIntent(input, { type: 'LIFE_GIVER', command });
  expect(input).toEqual(before); assertValidSliceState(result); return result;
}
export function rejectLg(s: SliceState, command: unknown): void {
  const before = structuredClone(s);
  expect(() => applySliceIntent(s, { type: 'LIFE_GIVER', command } as SliceIntent)).toThrow(); expect(s).toEqual(before);
}
export const guest = (s: SliceState) => s.summoningMaster.life.partner;
export const attempt = (s: SliceState, id: LifeGiverCaseId = 'tired-guest') => s.lifeGiver.life.cases[id].attempts.at(-1)!;
export function beginCase(s: SliceState, id: LifeGiverCaseId = 'tired-guest', method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = lg(unitBudget(s), { type: 'OBSERVE', caseId: id });
  s = lg(unitBudget(s), { type: 'PREPARE', caseId: id, method });
  return lg(s, { type: 'PERFORM', caseId: id });
}
export function arriveAndBorrow(s: SliceState, id: LifeGiverCaseId = 'tired-guest'): SliceState {
  for (const type of ['VISIT_HOME', 'CHECK_GUEST_ORIGIN', 'CONSENT', 'FETCH_GUEST', 'CONSENT_OWNER', 'BORROW_TOKEN'] as const)
    s = lg(s, { type, caseId: id });
  return s;
}
export function closeCase(s: SliceState, id: LifeGiverCaseId = 'tired-guest'): SliceState {
  if (attempt(s, id).shelterStatus === 'ACTIVE') s = lg(s, { type: 'STOP_SHELTER', caseId: id });
  if (s.lifeGiver.life.shutter.location === 'LOWERED') s = lg(s, { type: 'CLEAR_PATH', caseId: id });
  if (s.lifeGiver.life.token.location !== 'OWNER') s = lg(s, { type: 'RETURN_TOKEN', caseId: id });
  if (attempt(s, id).arrived && !attempt(s, id).guestReturned) s = lg(s, { type: 'RETURN_GUEST', caseId: id });
  if (s.lifeGiver.life.playerLocation === 'HOME') s = lg(s, { type: 'RETURN_PLAYER', caseId: id });
  if (s.lifeGiver.life.beads.some(b => b.purpose === 'LIFE' && b.caseId === id && b.location === 'PLAYER')) s = lg(s, { type: 'RETURN_BEADS', caseId: id });
  s = lg(s, { type: 'INSPECT', caseId: id }); return lg(s, { type: 'CLOSE', caseId: id });
}
