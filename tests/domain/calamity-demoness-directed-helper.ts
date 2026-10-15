import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { CALAMITY_DEMONESS_PREPARATION_IDS, type CalamityDemonessCommand } from '../../src/domain/calamity-demoness/types.js';
import type { CalamityDemonessActivityCommand, CalamityDemonessCaseId } from '../../src/domain/calamity-demoness/life.js';

export const unagingNaturalPath = 'tests/fixtures/unaging-demoness-v01530/natural.json';
export const demonessLegacyKeys = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness'] as const;
export const SCREEN = 'assassin.s2.mirror-screen', FLAME = 'assassin.s2.black-flame-channel', FROST = 'assassin.s7.frost';
let originalCache: SliceState | undefined;
/** The immutable original is an actual487-command natural continuation, not a new unit fork. */
export function originalUnagingFinal(): SliceState {
  originalCache ??= migrateSliceState(readObjectEntry<unknown>(unagingNaturalPath, 'final'));
  return structuredClone(originalCache);
}
export const oldDemonessRoots = (s: SliceState) => demonessLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'SCREEN_FAILURE' | 'FLAME_FAILURE' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** SOURCE-ONLY unit inputs. Search at most512 original-seed cursors BEFORE any S2 journal exists.
 * This is declared branch coverage, never natural play. No predetermined check, chosen battle
 * action, historical edit or completed-journal rewrite is permitted. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const cached = cursors.get(kind); if (cached !== undefined) return cached;
  const doseChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), a = rng.nextInt(1, 100), b = rng.nextInt(1, 100), c = rng.nextInt(1, 100);
    const failure = (n: number) => n > doseChance && n < 96;
    const matches = kind === 'FAILURE' ? failure(a) : kind === 'GREAT_FAILURE' ? a >= 96 : kind === 'THREE_FAILURES' ? [a, b, c].every(failure) :
      (kind === 'GREAT_SUCCESS' ? a <= 5 : a > 5 && a <= doseChance) && (b <= lifeChance) === (kind !== 'SCREEN_FAILURE') && (c <= lifeChance) === (kind !== 'FLAME_FAILURE');
    if (matches) { cursors.set(kind, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} source within512 original-seed candidates.`);
}
/** Declared pre-journal budgets: W128, cash100000, AP100, spirit31, selected cursor.
 * Retains original H70, untreated HEAVY, risk0, female body,16 mastery, people/items and old roots.
 * These inputs do not claim that the unit branch earned money, waited naturally or played487 steps. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS'): SliceState {
  const s = originalUnagingFinal(), weeks = Math.max(0, s.unagingDemoness.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100; s.spirituality = 31;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState { const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next; }
export const cd = (s: SliceState, command: CalamityDemonessCommand, commands?: SliceIntent[]) => step(s, { type: 'CALAMITY_DEMONESS', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent); expect(() => applySliceIntent(s, intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectCalamity = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'CALAMITY_DEMONESS', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS') => cd(directedInitial3(kind), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of CALAMITY_DEMONESS_PREPARATION_IDS) s = cd(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = cd(s, { type: 'POTION_WORK', bottleId: 'calamity-demoness-potion-1' });
  s = cd(s, { type: 'BUY_POTION', bottleId: 'calamity-demoness-potion-1' }); return cd(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'calamity-demoness-potion-1', confirmed: true } as const;
const promotions = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotions.has(kind)) { const s = cd(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotions.set(kind, s); }
  return structuredClone(promotions.get(kind)!);
}
/** Real ordinary clinic60 and subsequent REST remove the original HEAVY. AP100 isolates week churn;
 * no direct healing, deleting injuries, changing checks or resetting the selected stream. */
export function recover(s: SliceState, commands?: SliceIntent[]): SliceState {
  if (s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) && !s.careKnown) s = step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands);
  for (let n = 0; n < 24; n++) {
    if (s.activeEvent) { if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected recovery event ${s.activeEvent.id}`); s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' }, commands); continue; }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public clinic/rest recovery did not complete.');
}
const lifeCache = new Map<DirectedKind, SliceState>();
export function lifeReady(kind: DirectedKind = 'SUCCESS'): SliceState { if (!lifeCache.has(kind)) lifeCache.set(kind, recover(promoted(kind))); return structuredClone(lifeCache.get(kind)!); }
export const currentAttempt = (s: SliceState, id: CalamityDemonessCaseId = s.calamityDemoness.life.activeCase!) => s.calamityDemoness.life.cases[id].attempts.at(-1)!;
export function walk(s: SliceState, caseId: CalamityDemonessCaseId, to: Extract<CalamityDemonessActivityCommand, { type: 'WALK' }>['to']): SliceState { return s.calamityDemoness.life.site.playerLocation === to ? s : cd(s, { type: 'WALK', caseId, to }); }
export function beginCase(s: SliceState, caseId: CalamityDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = cd(s, { type: 'OBSERVE', caseId });
  if (caseId === 'mirror-screen') for (const type of ['ARRIVE_VERA', 'ARRIVE_MARCUS'] as const) s = cd(s, { type, caseId });
  for (const type of ['CONSENT_OPERATOR', 'CONSENT_OWNER'] as const) s = cd(s, { type, caseId });
  return cd(s, { type: 'PREPARE', caseId, method });
}
export function closeCase(s: SliceState, caseId: CalamityDemonessCaseId): SliceState {
  if (caseId === 'revoked-window' && !currentAttempt(s).permissionWithdrawn) s = cd(s, { type: 'WITHDRAW_PERMISSION', caseId });
  if (!currentAttempt(s).stopped) s = cd(s, { type: 'STOP', caseId });
  if (caseId === 'black-flame-channel' && s.calamityDemoness.life.site.residue?.status === 'CONTAINED' && s.calamityDemoness.life.site.residue?.location === 'BOX') {
    s = walk(s, caseId, 'BOX'); if (s.calamityDemoness.life.site.box.state === 'OPEN') s = cd(s, { type: 'CLOSE_BOX', caseId }); s = cd(s, { type: 'COLLECT_RESIDUE', caseId });
  }
  const plate = s.calamityDemoness.life.site.plates.find(p => p.caseId === caseId)!;
  if (plate.location === 'A' || plate.location === 'BOX') { s = walk(s, caseId, plate.location); s = cd(s, { type: 'REMOVE_PLATE', caseId }); }
  s = walk(s, caseId, 'ENTRY');
  if (caseId === 'black-flame-channel') {
    if (s.calamityDemoness.life.site.vera?.location === 'OUTSIDE') s = cd(s, { type: 'RETURN_ADULTS', caseId });
    if (s.calamityDemoness.life.site.residue?.status === 'CONTAINED') s = cd(s, { type: 'SEALED_HANDOVER', caseId });
  }
  if (!currentAttempt(s).plateReturned) s = cd(s, { type: 'RETURN_PLATE', caseId });
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = cd(s, { type, caseId }); return s;
}
export function completeCase(s: SliceState, caseId: CalamityDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = beginCase(s, caseId, method);
  if (caseId === 'mirror-screen') {
    s = walk(s, caseId, 'A'); s = cd(s, { type: 'INSTALL_PLATE', caseId }); if (method === 'ABILITY') s = cd(s, { type: 'SCREEN_MIRROR', caseId }); s = cd(s, { type: 'APPLY_LOAD', caseId });
  } else if (caseId === 'black-flame-channel') {
    s = cd(s, { type: 'MOVE_ADULTS_OUTSIDE', caseId }); s = walk(s, caseId, 'BOX'); s = cd(s, { type: 'INSTALL_PLATE', caseId }); s = cd(s, { type: 'CLOSE_BOX', caseId });
    if (method === 'ABILITY') s = cd(s, { type: 'CHANNEL_BLACK_FLAME', caseId });
  } else {
    s = cd(s, { type: 'WITHDRAW_PERMISSION', caseId }); s = cd(s, { type: 'STOP', caseId }); s = walk(s, caseId, 'A'); s = cd(s, { type: 'ORDINARY_ROUTE', caseId }); s = cd(s, { type: 'RETURN_ROUTE', caseId });
  }
  return closeCase(s, caseId);
}
const practices = new Map<DirectedKind, SliceState>();
export function practiced(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!practices.has(kind)) { let s = lifeReady(kind); for (const id of ['mirror-screen', 'black-flame-channel', 'revoked-window'] as const) s = completeCase(s, id); s = cd(s, { type: 'REFLECT' }); assertValidSliceState(s); practices.set(kind, s); }
  return structuredClone(practices.get(kind)!);
}
export function encounterReady(): SliceState { return cd(cd(practiced(), { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }); }
let battleCache: SliceState | undefined;
export function combatStart(): SliceState { battleCache ??= cd(encounterReady(), { type: 'ENCOUNTER_FIGHT' }); return structuredClone(battleCache); }
