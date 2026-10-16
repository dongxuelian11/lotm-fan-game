import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { GLORY_PREPARATION_IDS, type GloryCommand } from '../../src/domain/glory/types.js';
import type { GloryActivityCommand, GloryCaseId } from '../../src/domain/glory/life.js';

export const silverDirectedPath = 'tests/fixtures/silver-knight-v01520/directed.json';
export const warriorLegacyKeys = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight'] as const;
export const ARMOR = 'warrior.s2.armor-temper', BEARING = 'warrior.s2.close-guard', THRUST = 'warrior.s3.silver-thrust';
let sourceCache: SliceState | undefined;
/** This original is already DIRECTED, not a natural 9→3 advancement. Never edit its file. */
export function originalSilverFinal(): SliceState {
  sourceCache ??= migrateSliceState(readObjectEntry<unknown>(silverDirectedPath, 'final'));
  return structuredClone(sourceCache);
}
export const oldWarriorRoots = (s: SliceState) => warriorLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'ARMOR_FAILURE' | 'GUARD_FAILURE' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** A bounded RNG-only search over INITIAL INPUTS, before any new journal exists. The historical
 * seed is unchanged. The selected cursor is explicit directed unit provenance, never natural
 * play. Do not rewrite a completed journal, force check tiers, or fabricate old source histories. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const cached = cursors.get(kind); if (cached !== undefined) return cached;
  const dose = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const armor = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
  const guard = computeCheckChance({ baseAbility: s.character.coreStats.will + 1, difficulty: 20, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
    const a = rng.nextInt(1, 100), b = rng.nextInt(1, 100), c = rng.nextInt(1, 100);
    const normalFailure = (n: number) => n > dose && n < 96;
    const matches = kind === 'FAILURE' ? normalFailure(a) : kind === 'GREAT_FAILURE' ? a >= 96 :
      kind === 'THREE_FAILURES' ? [a, b, c].every(normalFailure) :
      (kind === 'GREAT_SUCCESS' ? a <= 5 : a > 5 && a <= dose) &&
      (b <= armor) === (kind !== 'ARMOR_FAILURE') && (c <= guard) === (kind !== 'GUARD_FAILURE');
    if (matches) { cursors.set(kind, cursor); return cursor; }
  }
  throw new Error(`No directed initial ${kind} cursor within 512 RNG-only candidates.`);
}
/** Explicit pre-journal unit inputs only: calendar W132, cash100000, AP100, spirit31, selected
 * cursor. Health30, two HEAVY + one LIGHT, original bodies/objects/roots/mastery/seed are retained.
 * These are declared unit budgets, not acquired resources or a natural campaign fixture. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = originalSilverFinal(), weeks = Math.max(0, s.silverKnight.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7);
  s.cash = 100_000; s.actionsRemaining = s.weeklyBudget = 100; s.spirituality = 31;
  s.random.cursor = directedInitialCursor(s, kind);
  assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const gl = (s: SliceState, command: GloryCommand, commands?: SliceIntent[]) => step(s, { type: 'GLORY', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectGlory = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'GLORY', command } as SliceIntent);
export function taught(kind: DirectedKind = 'SUCCESS'): SliceState { return gl(directedInitial3(kind), { type: 'LEARN_GUIDANCE' }); }
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind);
  for (const taskId of GLORY_PREPARATION_IDS) s = gl(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = gl(s, { type: 'POTION_WORK', bottleId: 'glory-potion-1' });
  s = gl(s, { type: 'BUY_POTION', bottleId: 'glory-potion-1' });
  return gl(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'glory-potion-1', confirmed: true } as const;
const promotions = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotions.has(kind)) {
    const s = gl(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotions.set(kind, s);
  }
  return structuredClone(promotions.get(kind)!);
}
/** Actual public ordinary clinic payment and later rest, never direct healing/injury deletion.
 * AP100 avoids incidental week/event churn in these narrowly directed unit branches. */
export function recover(s: SliceState, commands?: SliceIntent[]): SliceState {
  if (s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) && !s.careKnown)
    s = step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands);
  for (let n = 0; n < 24; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected unit recovery event ${s.activeEvent.id}.`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' }, commands); continue;
    }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Public paid recovery did not finish within its finite unit budget.');
}
const lifeReadyCache = new Map<DirectedKind, SliceState>();
export function lifeReady(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!lifeReadyCache.has(kind)) lifeReadyCache.set(kind, recover(promoted(kind)));
  return structuredClone(lifeReadyCache.get(kind)!);
}
export function beginCase(s: SliceState, caseId: GloryCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  for (const type of ['OBSERVE', 'CONSENT_OPERATOR', 'CONSENT_OWNER'] as const) s = gl(s, { type, caseId });
  return gl(s, { type: 'PREPARE', caseId, method });
}
export const currentAttempt = (s: SliceState, id: GloryCaseId = s.glory.life.activeCase!) => s.glory.life.cases[id].attempts.at(-1)!;
export function walk(s: SliceState, caseId: GloryCaseId, to: Extract<GloryActivityCommand, { type: 'WALK' }>['to']): SliceState {
  return s.glory.life.site.playerLocation === to ? s : gl(s, { type: 'WALK', caseId, to });
}
export function closeCase(s: SliceState, caseId: GloryCaseId): SliceState {
  if (currentAttempt(s, caseId).crossed && !currentAttempt(s, caseId).actorReturned) s = gl(s, { type: 'RETURN_ACTOR', caseId });
  if (caseId === 'revoked-crossing' && !currentAttempt(s, caseId).permissionWithdrawn) s = gl(s, { type: 'WITHDRAW_PERMISSION', caseId });
  if (!currentAttempt(s, caseId).stopped) s = gl(s, { type: 'STOP', caseId });
  if (s.glory.life.site.pads.worn) s = gl(s, { type: 'REMOVE_PAD', caseId });
  s = walk(s, caseId, 'BENCH');
  if (!currentAttempt(s, caseId).plateReturned) s = gl(s, { type: 'RETURN_PLATE', caseId });
  s = walk(s, caseId, 'ENTRY');
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = gl(s, { type, caseId });
  return s;
}
export function completeCase(s: SliceState, caseId: GloryCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = beginCase(s, caseId, method);
  if (caseId === 'armor-temper') {
    s = gl(s, { type: 'WEAR_PAD', caseId });
    if (method === 'ABILITY') s = gl(s, { type: 'TEMPER_ARMOR', caseId });
    s = gl(s, { type: 'APPLY_LOAD', caseId });
  } else if (caseId === 'close-guard') {
    if (method === 'ABILITY') s = gl(s, { type: 'RAISE_GUARD', caseId });
    s = gl(s, { type: currentAttempt(s).window === 'ACTIVE' ? 'CROSS_BRIDGE' : 'ORDINARY_CROSS', caseId });
  } else {
    s = gl(s, { type: 'WITHDRAW_PERMISSION', caseId }); s = gl(s, { type: 'STOP', caseId });
    s = gl(s, { type: 'ORDINARY_CROSS', caseId });
  }
  return closeCase(s, caseId);
}
const practices = new Map<DirectedKind, SliceState>();
export function practiced(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!practices.has(kind)) {
    let s = lifeReady(kind);
    for (const id of ['armor-temper', 'close-guard', 'revoked-crossing'] as const) s = completeCase(s, id);
    s = gl(s, { type: 'REFLECT' }); assertValidSliceState(s); practices.set(kind, s);
  }
  return structuredClone(practices.get(kind)!);
}
export function encounterReady(): SliceState { return gl(practiced(), { type: 'ENCOUNTER_TALK' }); }
let combatCache: SliceState | undefined;
export function combatStart(): SliceState {
  combatCache ??= gl(encounterReady(), { type: 'ENCOUNTER_FIGHT' });
  return structuredClone(combatCache);
}
