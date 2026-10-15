import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { SAGE_PREPARATION_IDS, type SageCommand } from '../../src/domain/sage/types.js';

export const prophecyNaturalPath = 'tests/fixtures/prophecy-master-v01540/natural.json';
export const hermitLegacyKeys = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster'] as const;
let originalCache: SliceState | undefined;
/** Immutable, actual 507-command natural S3 continuation. No Sage action is part of this source. */
export function originalProphecyFinal(): SliceState {
  originalCache ??= migrateSliceState(readObjectEntry<unknown>(prophecyNaturalPath, 'final'));
  return structuredClone(originalCache);
}
export const oldHermitRoots = (s: SliceState) => hermitLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES' | 'RITUAL_FAILURE' | 'RITUAL_GREAT_FAILURE';
const cursors = new Map<DirectedKind, number>();
/** Explicit UNIT source selection, never natural play: search at most 512 original-seed
 * cursors BEFORE any Sage journal exists. The first three rolls stop the real disaster;
 * the following roll covers a dose tier. Ritual failure variants spend a real first
 * failed cut, followed by three real successful operations. No historical check is edited. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const cached = cursors.get(kind); if (cached !== undefined) return cached;
  const chance = (difficulty: number, baseAbility = s.character.coreStats.knowledge) => computeCheckChance({ baseAbility, difficulty, modifiers: [] });
  const cut = chance(20), core = chance(25), dose = chance(30, s.character.coreStats.will);
  const failedDose = (roll: number) => roll > dose && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), rolls = Array.from({ length: 6 }, () => rng.nextInt(1, 100));
    const [a, b, c, d] = rolls as [number, number, number, number, number, number];
    const ritualFailure = kind === 'RITUAL_FAILURE' || kind === 'RITUAL_GREAT_FAILURE';
    const matches = ritualFailure
      ? (kind === 'RITUAL_FAILURE' ? a > cut && a < 96 : a >= 96) && b <= cut && c <= cut && d <= core
      : a <= cut && b <= cut && c <= core && (kind === 'SUCCESS' ? d > 5 && d <= dose : kind === 'GREAT_SUCCESS' ? d <= 5 : kind === 'FAILURE' ? failedDose(d) : kind === 'GREAT_FAILURE' ? d >= 96 : rolls.slice(3).every(failedDose));
    if (matches) { cursors.set(kind, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} source among 512 original-seed cursors.`);
}
/** Pre-journal UNIT budgets only: week128 (12 full S3 weeks), cash100000, AP100,
 * selected cursor. Retains original H80/M100/S114, two untreated LIGHT, risk1,
 * stats, seven old roots, 11 mastery entries, people and used scrolls. Not natural play. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalProphecyFinal(), weeks = mature ? Math.max(0, s.prophecyMaster.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const sg = (s: SliceState, command: SageCommand, commands?: SliceIntent[]) => step(s, { type: 'SAGE', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectSage = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'SAGE', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => sg(directedInitial3(kind, mature), { type: 'LEARN_GUIDANCE' });
export function evacuated(kind: DirectedKind = 'SUCCESS'): SliceState {
  let s = taught(kind);
  for (const type of ['RITUAL_BUY_SEALS', 'RITUAL_VISIT', 'RITUAL_STUDY', 'RITUAL_EVACUATE'] as const) s = sg(s, { type });
  return s;
}
export function stopDisaster(s: SliceState): SliceState {
  if (s.sage.ritual.seals.length === 0) s = sg(s, { type: 'RITUAL_BUY_SEALS' });
  if (s.sage.ritual.location === 'OUTSIDE') s = sg(s, { type: 'RITUAL_VISIT' });
  if (s.sage.ritual.studiedWeek === null) s = sg(s, { type: 'RITUAL_STUDY' });
  if (s.sage.ritual.evacuatedWeek === null) s = sg(s, { type: 'RITUAL_EVACUATE' });
  for (let attempt = 0; attempt < 4 && s.sage.ritual.core.active; attempt++) {
    if (!s.sage.ritual.seals.some(seal => seal.status === 'HELD')) {
      if (s.sage.ritual.location !== 'OUTSIDE') s = sg(s, { type: 'RITUAL_RETREAT' });
      s = sg(s, { type: 'RITUAL_BUY_SEALS' });
    }
    if (s.sage.ritual.location === 'OUTSIDE') s = sg(s, { type: 'RITUAL_VISIT' });
    s = sg(s, { type: s.sage.ritual.routes.plate.active ? 'RITUAL_CUT_PLATE' : s.sage.ritual.routes.index.active ? 'RITUAL_CUT_INDEX' : 'RITUAL_CONTAIN' });
  }
  expect(s.sage.ritual.core.active).toBe(false);
  s = sg(s, { type: 'RITUAL_RETREAT' }); return sg(s, { type: 'RITUAL_REVIEW' });
}
const stoppedCache = new Map<DirectedKind, SliceState>();
export function stopped(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!stoppedCache.has(kind)) stoppedCache.set(kind, stopDisaster(taught(kind)));
  return structuredClone(stoppedCache.get(kind)!);
}
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = stopped(kind); for (const taskId of SAGE_PREPARATION_IDS) s = sg(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = sg(s, { type: 'POTION_WORK', bottleId: 'sage-potion-1' });
  s = sg(s, { type: 'BUY_POTION', bottleId: 'sage-potion-1' }); return sg(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'sage-potion-1', confirmed: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = sg(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
/** Actual REST commands only. This helper never edits health, injuries or a journal.
 * Source LIGHT injuries resolve through ordinary rest; it does not claim paid HEAVY care. */
export function recover(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 24; n++) {
    if (s.activeEvent) throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public rest recovery did not complete.');
}
