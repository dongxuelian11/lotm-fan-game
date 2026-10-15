import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { PlaneswalkerCommand } from '../../src/domain/planeswalker/types.js';
import { PLANESWALKER_PREPARATION_IDS } from '../../src/domain/planeswalker/types.js';
import { PLANESWALKER_RITUAL_SITE_IDS, type PlaneswalkerRitualSiteId } from '../../src/domain/planeswalker/ritual.js';
import { PLANESWALKER_CASE_IDS, type PlaneswalkerCaseId } from '../../src/domain/planeswalker/life.js';

export const wandererPeacefulPath = 'tests/fixtures/wanderer-v01500/peaceful.json';
export const doorLegacyKeys = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer'] as const;
let oldCache: SliceState | undefined;
export function peacefulStart(): SliceState {
  oldCache ??= migrateSliceState(readObjectEntry<unknown>(wandererPeacefulPath, 'final'));
  return structuredClone(oldCache);
}
export const oldDoorRoots = (s: SliceState) => doorLegacyKeys.map(key => s[key]);
export type DirectedKind = 'GREAT_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'TRANSIT_45' | 'WARD_45' | 'DEPARTURE_FAILURE' | 'EXHAUST_SUPPLY';
const cursors = new Map<DirectedKind, number>();
/** Directed input selection only, before any new journal exists. The historical seed is never replaced.
 * 18 successful departures (failed attempts are paid and retained), one dose, three life checks. Ordinary rest/work has no random draw.
 * This is explicit branch coverage, not natural-play evidence; historical stats are unchanged. */
function directedCursor(kind: DirectedKind, seed: string, start: number, knowledge: number, will: number): number {
  const routeChance = computeCheckChance({ baseAbility: knowledge, difficulty: 20, modifiers: [] });
  const doseChance = computeCheckChance({ baseAbility: will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: Math.min(500, knowledge + 1), difficulty: 20, modifiers: [] });
  const saved = cursors.get(kind); if (saved !== undefined) return saved;
  for (let cursor = start; cursor < start + 1_000_000; cursor++) {
    const rng = new DeterministicActionRandomStream(seed, cursor);
    if (kind === 'DEPARTURE_FAILURE') {
      if (rng.nextInt(1, 100) < 96) continue;
    } else {
      // First departure succeeds for simple boundary tests. Later failures are kept and paid publicly.
      if (rng.nextInt(1, 100) > routeChance) continue;
      let successes = 1, attempts = 1;
      while (successes < 18 && attempts++ < 256) if (rng.nextInt(1, 100) <= routeChance) successes++;
      if (successes !== 18) continue;
      const dose = rng.nextInt(1, 100);
      const wanted = kind === 'GREAT_SUCCESS' ? dose <= 5 : kind === 'EXHAUST_SUPPLY' ? dose > doseChance : kind === 'FAILURE' ? dose > doseChance && dose < 96 : kind === 'GREAT_FAILURE' ? dose >= 96 : dose > 5 && dose <= doseChance;
      if (!wanted) continue;
      if (kind === 'EXHAUST_SUPPLY') {
        if (rng.nextInt(1, 100) <= doseChance || rng.nextInt(1, 100) <= doseChance) continue;
        cursors.set(kind, cursor); return cursor;
      }
      let life = true;
      for (let n = 0; n < 3; n++) if (rng.nextInt(1, 100) > lifeChance) life = false;
      if (!life) continue;
      if (kind === 'TRANSIT_45') {
        rng.nextInt(1, 100); rng.nextInt(1, 100);
        const player = rng.nextInt(1, 435), check = rng.nextInt(1, 100), enemy = rng.nextInt(1, 100);
        if (player < 101 || player > 200 || check > lifeChance || enemy < 61 || enemy > 80) continue;
      }
      if (kind === 'WARD_45') {
        const playerCount = rng.nextInt(1, 100); rng.nextInt(1, 100);
        const first = rng.nextInt(1, 425), enemy = rng.nextInt(1, 100), second = rng.nextInt(1, 425), check = rng.nextInt(1, 100);
        // First pattern action only opens the original closed door. Enemy then prepares the ward.
        if (playerCount <= 10 || first > 125 || enemy < 36 || enemy > 60 || second > 125 || check > lifeChance) continue;
      }
    }
    cursors.set(kind, cursor); return cursor;
  }
  throw new Error(`No directed initial cursor found for ${kind}; never mutate a completed journal to force an outcome.`);
}
/** Clearly directed INITIAL S3 conditions. Every later transition uses applySliceIntent.
 * No old histories, wounds, inventories, source identities or seed are edited. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = peacefulStart(), weeks = Math.max(0, s.wanderer.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7);
  s.cash = 100_000; s.weeklyBudget = 8; s.actionsRemaining = 8;
  s.random.cursor = directedCursor(kind, s.random.seed, s.random.cursor, s.character.coreStats.knowledge, s.character.coreStats.will);
  assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const pw = (s: SliceState, command: PlaneswalkerCommand, commands?: SliceIntent[]) => step(s, { type: 'PLANESWALKER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectPW = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'PLANESWALKER', command } as SliceIntent);
export function freshWeek(s: SliceState, commands?: SliceIntent[]): SliceState {
  const week = s.week;
  while (s.week === week) s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  return s;
}
export function readyForActions(s: SliceState, actions = 2, spirit = 24, commands?: SliceIntent[]): SliceState {
  while (s.actionsRemaining < actions || s.spirituality < spirit || s.mind < 95 || s.health < 100) {
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  return s;
}
export function taught(kind: DirectedKind = 'SUCCESS'): SliceState { return pw(directedInitial3(kind), { type: 'LEARN_GUIDANCE' }); }
export function routePrepared(s: SliceState, siteId: PlaneswalkerRitualSiteId = 'PW2-COPPER', commands?: SliceIntent[]): SliceState {
  s = readyForActions(s, 2, 24, commands);
  s = pw(s, { type: 'PREPARE_ROUTE_KIT', siteId }, commands);
  for (const type of ['CHECK_ROUTE_COORDINATES', 'CHECK_ROUTE_PROTECTION', 'CHECK_ROUTE_RETURN'] as const) s = pw(s, { type }, commands);
  return s;
}
export function routeAway(s: SliceState, siteId: PlaneswalkerRitualSiteId = 'PW2-COPPER', commands?: SliceIntent[]): SliceState {
  for (let attempts = 0; attempts < 256; attempts++) {
    s = routePrepared(s, siteId, commands); s = pw(s, { type: 'DEPART_RITUAL', confirmed: true }, commands);
    if (s.planeswalker.ritual.playerLocation === siteId) return s;
    expect(s.planeswalker.ritual.visits.at(-1)!.phase).toBe('FAILED');
    s = pw(s, { type: 'CLOSE_ROUTE_KIT' }, commands);
  }
  throw new Error('Directed route failed to reach the original site after256 paid attempts.');
}
export function returnAndClose(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (const type of ['CHECK_RITUAL_RETURN_MARKER', 'RETURN_RITUAL', 'CLOSE_ROUTE_KIT'] as const) s = pw(s, { type }, commands);
  return s;
}
export function visit(s: SliceState, siteId: PlaneswalkerRitualSiteId, verify = false, commands?: SliceIntent[]): SliceState {
  s = routeAway(s, siteId, commands);
  s = pw(s, { type: 'CONTACT_SETTLEMENT' }, commands);
  s = pw(s, { type: verify ? 'VERIFY_LEGEND' : 'HELP_SETTLEMENT' }, commands);
  return returnAndClose(s, commands);
}
interface QualificationCapture { initial: SliceState; commands: SliceIntent[]; final: SliceState }
const qualificationCache = new Map<DirectedKind, QualificationCapture>();
export function qualificationCapture(kind: DirectedKind = 'SUCCESS'): QualificationCapture {
  if (!qualificationCache.has(kind)) {
    const initial = directedInitial3(kind), commands: SliceIntent[] = [];
    let s = pw(initial, { type: 'LEARN_GUIDANCE' }, commands);
    for (const siteId of PLANESWALKER_RITUAL_SITE_IDS) s = visit(s, siteId, false, commands);
    const lastHelpWeek = Math.max(...Object.values(s.planeswalker.ritual.sites).map(site => site.helpWeek!));
    while (s.week <= lastHelpWeek) s = freshWeek(s, commands);
    for (const siteId of PLANESWALKER_RITUAL_SITE_IDS) s = visit(s, siteId, true, commands);
    assertValidSliceState(s); qualificationCache.set(kind, { initial, commands, final: s });
  }
  return structuredClone(qualificationCache.get(kind)!);
}
export const qualified = (kind: DirectedKind = 'SUCCESS') => qualificationCapture(kind).final;
export function preparedDose(kind: DirectedKind = 'SUCCESS'): SliceState {
  let s = qualified(kind); s = readyForActions(s, 5, 24);
  for (const taskId of PLANESWALKER_PREPARATION_IDS) s = pw(s, { type: 'PREPARE_TASK', taskId });
  s = pw(s, { type: 'BUY_POTION', bottleId: 'planeswalker-potion-1' });
  s = pw(s, { type: 'PREPARE_PROMOTION' }); assertValidSliceState(s); return s;
}
export const consume = (s: SliceState, bottleId = 'planeswalker-potion-1') => pw(s, { type: 'CONSUME', bottleId, confirmed: true });
const promotionCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotionCache.has(kind)) {
    const s = consume(preparedDose(kind)); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotionCache.set(kind, s);
  }
  return structuredClone(promotionCache.get(kind)!);
}
export function beginCase(s: SliceState, caseId: PlaneswalkerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = readyForActions(s, 4, 24);
  const lastWeek = Math.max(0, ...Object.values(s.planeswalker.life.cases).flatMap(c => c.attempts.map(a => a.week)));
  while (s.week <= lastWeek) s = freshWeek(s);
  s = pw(s, { type: 'OBSERVE', caseId }); s = pw(s, { type: 'PREPARE', caseId, method });
  s = pw(s, { type: 'CONSENT_OPERATOR', caseId });
  if (caseId === 'pattern-reproduction') s = pw(s, { type: 'READ_PATTERN', caseId });
  else for (const type of ['BUY_KIT', 'CHECK_ENDPOINTS', 'TAKE_PARCEL'] as const) s = pw(s, { type, caseId });
  return s;
}
export function completeCase(s: SliceState, caseId: PlaneswalkerCaseId, apply = true): SliceState {
  s = beginCase(s, caseId);
  if (caseId !== 'withdrawn-transit') s = pw(s, { type: 'OPEN_DOOR', caseId });
  s = pw(s, { type: 'PERFORM', caseId });
  if (caseId === 'symbolic-transit' && apply) {
    for (const type of ['DEPART', 'READ_RETURN_MARKER', 'RETURN_LOCAL'] as const) s = pw(s, { type, caseId });
  } else if (caseId === 'pattern-reproduction' && apply) s = pw(s, { type: 'APPLY_PATTERN', caseId });
  if (caseId === 'withdrawn-transit') s = pw(s, { type: 'WITHDRAW_PERMISSION', caseId });
  s = pw(s, { type: 'CLEANUP', caseId }); s = pw(s, { type: 'REPORT', caseId });
  assertValidSliceState(s); return s;
}
const practicedCache = new Map<DirectedKind, SliceState>();
export function practiced(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!practicedCache.has(kind)) {
    let s = promoted(kind);
    for (const caseId of PLANESWALKER_CASE_IDS) s = completeCase(s, caseId);
    s = readyForActions(s, 1, 24); s = pw(s, { type: 'REFLECT' }); assertValidSliceState(s); practicedCache.set(kind, s);
  }
  return structuredClone(practicedCache.get(kind)!);
}
export function encounterReady(kind: DirectedKind = 'SUCCESS'): SliceState {
  return pw(readyForActions(practiced(kind), 2, 120), { type: 'ENCOUNTER_TALK' });
}
export function combatStart(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = pw(encounterReady(kind), { type: 'ENCOUNTER_FIGHT' }); assertValidSliceState(s); return s;
}
