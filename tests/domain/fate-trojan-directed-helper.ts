import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { FATE_TROJAN_PREPARATION_IDS, type FateTrojanCommand } from '../../src/domain/fate-trojan/types.js';
import { type FateTrojanCaseId, type FateTrojanActivityCommand } from '../../src/domain/fate-trojan/life.js';

export const deceitMentorPeacefulPath = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
export const errorLegacyKeys = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor'] as const;
let sourceCache: SliceState | undefined;
export function peacefulStart(): SliceState {
  sourceCache ??= migrateSliceState(readObjectEntry<unknown>(deceitMentorPeacefulPath, 'final'));
  return structuredClone(sourceCache);
}
export const oldErrorRoots = (s: SliceState) => errorLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'IDENTITY_FAILURE' | 'FATE_FAILURE';
const cursorCache = new Map<DirectedKind, number>();
/** DIRECTED INITIAL INPUT ONLY. Selects a legal cursor on the unchanged historical seed before
 * any S2 acquisition or life journal exists. This is branch coverage, never natural-play evidence.
 * All following checks, including promotion, use the public reducer's exact RNG. No forced tiers,
 * fabricated source histories, post-hoc cursor edits, state replacement or fixture output. */
function initialCursor(s: SliceState, kind: DirectedKind): number {
  const cached = cursorCache.get(kind); if (cached !== undefined) return cached;
  const dose = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const identity = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
  const fate = computeCheckChance({ baseAbility: s.character.coreStats.will + 1, difficulty: 20, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 10_000; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (random.nextInt(1, 100) > dose) continue;
    const linkSucceeded = random.nextInt(1, 100) <= identity, fateSucceeded = random.nextInt(1, 100) <= fate;
    if (linkSucceeded !== (kind !== 'IDENTITY_FAILURE') || fateSucceeded !== (kind !== 'FATE_FAILURE')) continue;
    cursorCache.set(kind, cursor); return cursor;
  }
  throw new Error(`No bounded directed initial cursor for ${kind}; never rewrite a completed journal.`);
}
/** Explicit isolated S3 calendar/cash/AP inputs. The genuine 451-command old history, bodies,
 * objects, injuries, inventory, mastery, identity and seed are retained byte-for-byte. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = peacefulStart(), weeks = Math.max(0, s.deceitMentor.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7);
  s.cash = 100_000; s.weeklyBudget = 8; s.actionsRemaining = 8;
  s.random.cursor = initialCursor(s, kind);
  assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ft = (s: SliceState, command: FateTrojanCommand, commands?: SliceIntent[]) => step(s, { type: 'FATE_TROJAN', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const frozen = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(frozen); expect(intent).toEqual(payload);
}
export const rejectFT = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'FATE_TROJAN', command } as SliceIntent);
export function readyForActions(s: SliceState, actions = 4, spirit = 24): SliceState {
  for (let attempts = 0; attempts < 40; attempts++) {
    if (s.actionsRemaining >= actions && s.spirituality >= spirit && s.mind >= 95 && s.health === 100) return s;
    s = step(s, { type: 'ACTION', action: 'REST' });
  }
  throw new Error('Ordinary public rest failed to supply the directed unit budget.');
}
const promotionCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotionCache.has(kind)) {
    let s = ft(directedInitial3(kind), { type: 'LEARN_GUIDANCE' });
    for (const taskId of FATE_TROJAN_PREPARATION_IDS) s = ft(s, { type: 'PREPARE_TASK', taskId });
    s = ft(s, { type: 'BUY_POTION', bottleId: 'fate-trojan-potion-1' });
    s = ft(s, { type: 'PREPARE_PROMOTION' });
    s = ft(s, { type: 'CONSUME', bottleId: 'fate-trojan-potion-1', confirmed: true });
    expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotionCache.set(kind, s);
  }
  return structuredClone(promotionCache.get(kind)!);
}
export function beginCase(s: SliceState, caseId: FateTrojanCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = readyForActions(s);
  for (const type of ['OBSERVE', 'CONSENT_OPERATOR', 'CONSENT_OWNER'] as const) s = ft(s, { type, caseId });
  return ft(s, { type: 'PREPARE', caseId, method });
}
export const currentAttempt = (s: SliceState, caseId: FateTrojanCaseId = s.fateTrojan.life.activeCase!) => s.fateTrojan.life.cases[caseId].attempts.at(-1)!;
export function walk(s: SliceState, caseId: FateTrojanCaseId, to: Extract<FateTrojanActivityCommand, { type: 'WALK' }>['to']): SliceState {
  return s.fateTrojan.life.site.playerLocation === to ? s : ft(s, { type: 'WALK', caseId, to });
}
export function closeCase(s: SliceState, caseId: FateTrojanCaseId): SliceState {
  if (s.fateTrojan.life.site.fate.status === 'ASSUMED') {
    s = walk(s, caseId, 'CABINET');
    if (!s.fateTrojan.life.site.cabinet.open) s = ft(s, { type: 'OPEN_CABINET', caseId });
    s = ft(s, { type: 'CARRY_PARCEL', caseId });
  }
  if (s.fateTrojan.life.site.cabinet.open) { s = walk(s, caseId, 'CABINET'); s = ft(s, { type: 'CLOSE_CABINET', caseId }); }
  s = walk(s, caseId, 'DESK');
  if (s.fateTrojan.life.site.link.returnPending) s = ft(s, { type: 'RETURN_LINK', caseId });
  if (caseId === 'revoked-link' && !currentAttempt(s).permissionWithdrawn) s = ft(s, { type: 'WITHDRAW_PERMISSION', caseId });
  if (!currentAttempt(s).stopped) s = ft(s, { type: 'STOP', caseId });
  if (!currentAttempt(s).sealReturned) s = ft(s, { type: 'RETURN_SEAL', caseId });
  s = walk(s, caseId, 'ENTRY');
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = ft(s, { type, caseId });
  return s;
}
export function completeCase(s: SliceState, caseId: FateTrojanCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = beginCase(s, caseId, method);
  if (caseId !== 'revoked-link') {
    if (method === 'ABILITY') s = ft(s, { type: caseId === 'identity-link' ? 'TAKE_IDENTITY' : 'TAKE_FATE', caseId });
    s = walk(s, caseId, 'CABINET'); s = ft(s, { type: 'OPEN_CABINET', caseId });
    if (caseId === 'fate-assumption') s = ft(s, { type: 'CARRY_PARCEL', caseId });
  }
  return closeCase(s, caseId);
}
const practiceCache = new Map<DirectedKind, SliceState>();
export function practiced(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!practiceCache.has(kind)) {
    let s = promoted(kind);
    for (const id of ['identity-link', 'fate-assumption', 'revoked-link'] as const) s = completeCase(s, id);
    s = readyForActions(s, 1); s = ft(s, { type: 'REFLECT' }); assertValidSliceState(s); practiceCache.set(kind, s);
  }
  return structuredClone(practiceCache.get(kind)!);
}
export function encounterReady(): SliceState { return ft(readyForActions(practiced(), 2, 120), { type: 'ENCOUNTER_TALK' }); }
let combatCache: SliceState | undefined;
export function combatStart(): SliceState {
  combatCache ??= ft(encounterReady(), { type: 'ENCOUNTER_FIGHT' });
  return structuredClone(combatCache);
}
