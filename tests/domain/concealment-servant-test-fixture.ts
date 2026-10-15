import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { ConcealmentServantCommand } from '../../src/domain/concealment-servant/types.js';
import type { ConcealmentServantCaseId } from '../../src/domain/concealment-servant/life.js';

export const concealmentServantFixturePath = 'tests/fixtures/concealment-servant-v01690/natural.json';
export const concealmentServantBoundaryIndexPath = 'tests/fixtures/concealment-servant-v01690/boundaries.index.json';
export const fearBishopFixturePath = 'tests/fixtures/fear-bishop-v01450/natural.json';
export const darknessLegacyKeys = ['sleepless', 'midnight', 'nightmare', 'soother', 'nightwatcher', 'fearBishop'] as const;
export interface ConcealmentServantBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
export type ConcealmentServantSnapshotKey = 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart' | 'final';
export function concealmentServantSnapshot(key: ConcealmentServantSnapshotKey): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(concealmentServantFixturePath, key));
}
/** Recorded small manifest: exact boundary key to one relative boundary filename. */
type BoundaryIndex = Record<string, string>;
export function concealmentServantBoundaryNames(): string[] {
  const index = JSON.parse(readFileSync(concealmentServantBoundaryIndexPath, 'utf8')) as BoundaryIndex;
  return Object.keys(index);
}
export function concealmentServantBoundary(key: string): ConcealmentServantBoundary {
  const index = JSON.parse(readFileSync(concealmentServantBoundaryIndexPath, 'utf8')) as BoundaryIndex;
  const entry = index[key];
  if (!entry) throw new Error(`Missing actual Concealment Servant boundary: ${key}`);
  // Each file is one boundary, never an aggregate of every state in the campaign.
  const file = resolve('tests/fixtures/concealment-servant-v01690', entry);
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
/** Directed unit-only action budget. Never write it, or a directed RNG cursor, back to a natural fixture. */
export function unitBudget(s: SliceState): SliceState {
  const next = structuredClone(s); next.weeklyBudget = 3; next.actionsRemaining = 3;
  assertValidSliceState(next); return next;
}
export function directedLifeReady(): SliceState { return unitBudget(concealmentServantSnapshot('promoted')); }
/** Search a test-local input cursor only; the production command draws/checks remain unchanged. */
export function directedCheckInput(s: SliceState, roll: number): SliceState {
  const next = structuredClone(s);
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 10000; cursor++) {
    if (new DeterministicActionRandomStream(s.random.seed, cursor).nextInt(1, 100) === roll) {
      next.random.cursor = cursor; assertValidSliceState(next); return next;
    }
  }
  throw new Error(`No directed unit cursor for roll ${roll}`);
}
export function cs(s: SliceState, command: ConcealmentServantCommand, roll?: number): SliceState {
  const input = roll === undefined ? s : directedCheckInput(s, roll), before = structuredClone(input);
  const result = applySliceIntent(input, { type: 'CONCEALMENT_SERVANT', command });
  expect(input).toEqual(before); assertValidSliceState(result); return result;
}
export function rejectCs(s: SliceState, command: unknown): void {
  const before = structuredClone(s);
  expect(() => applySliceIntent(s, { type: 'CONCEALMENT_SERVANT', command } as SliceIntent)).toThrow();
  expect(s).toEqual(before);
}
export const attempt = (s: SliceState, id: ConcealmentServantCaseId = 'consented-box') => s.concealmentServant.life.cases[id].attempts.at(-1)!;
export function beginCase(s: SliceState, id: ConcealmentServantCaseId = 'consented-box', method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = cs(unitBudget(s), { type: 'OBSERVE', caseId: id });
  s = cs(unitBudget(s), { type: 'PREPARE', caseId: id, method });
  return cs(s, { type: 'PERFORM', caseId: id });
}
export function enterAndTake(s: SliceState, id: ConcealmentServantCaseId = 'consented-box'): SliceState {
  for (const type of ['READ_SOURCE', 'CHECK_DOOR', 'CONSENT_OWNER', 'CONSENT_PARTICIPANT', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_BOX'] as const)
    s = cs(s, { type, caseId: id });
  return s;
}
export function closeCase(s: SliceState, id: ConcealmentServantCaseId = 'consented-box'): SliceState {
  const a = attempt(s, id), l = s.concealmentServant.life;
  if (l.room.concealed || a.traceVeil.state === 'ACTIVE' || a.doorBlocked && !a.releasedAfterBlock) s = cs(s, { type: 'RELEASE_CONCEALMENT', caseId: id });
  if (s.concealmentServant.life.room.doorBlocked) s = cs(s, { type: 'UNBOLT_DOOR', caseId: id });
  if (s.concealmentServant.life.anchorLight.on) s = cs(s, { type: 'SWITCH_OFF_ANCHOR', caseId: id });
  if (a.boxTaken && !a.boxReturned) s = cs(s, { type: 'RETURN_BOX', caseId: id });
  if (a.entered && !a.exited) s = cs(s, { type: 'EXIT_ROOM', caseId: id });
  s = cs(s, { type: 'INSPECT', caseId: id });
  return cs(s, { type: 'CLOSE', caseId: id });
}
export function reportCase(s: SliceState, id: ConcealmentServantCaseId = 'consented-box'): SliceState {
  return cs(unitBudget(s), { type: 'REPORT', caseId: id });
}
