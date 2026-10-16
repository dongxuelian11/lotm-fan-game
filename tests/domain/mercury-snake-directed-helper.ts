import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { MERCURY_SNAKE_PREPARATION_IDS, MERCURY_SNAKE_SOURCE_KEYS, type MercurySnakeCommand } from '../../src/domain/mercury-snake/types.js';
import { hasMercurySnakeLock } from '../../src/domain/mercury-snake/index.js';
import { projectMercurySnakeLife } from '../../src/domain/mercury-snake/life.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

export const fateProphetNaturalPath = 'tests/fixtures/fate-prophet-v01820/natural.json';
export const wheelLegacyKeys = MERCURY_SNAKE_SOURCE_KEYS;
export const oldWheelRoots = (s: SliceState) => wheelLegacyKeys.map(key => structuredClone(s[key]));
export const originalWheelRoots = oldWheelRoots;
export function loadMercurySnakeFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<unknown>(path, entry)); }
let originalCache: SliceState | undefined;
/** The genuine complete 703-command source. Raw schema179 is pinned separately
 * in shared tests; this helper explicitly requests the actual CURRENT migration. */
export function originalFateProphet(): SliceState {
  if (!originalCache) {
    const s = loadMercurySnakeFixture(fateProphetNaturalPath, 'final');
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      revision: 704, week: 177, status: 'ACTIVE', health: 90, mind: 95, spirituality: 119,
      cash: 1060, actionsRemaining: 2, injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 11, day: 11 },
      random: { seed: 'monster-natural-v060', cursor: 269 }, progression: { pathwayId: 'wheel', sequence: 2, acting: 100, promotionWeek: 6 } });
    expect(s.injuries).toEqual([{ id: 'monster-rebuild-natural:combat:2:PLAYER:702:0', severity: 'LIGHT', acquiredRevision: 702, treatedRevision: null }]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(6);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 26, perception: 25, will: 23, knowledge: 24 } });
    expect(s.fateProphet.promotionWeek).toBe(166); expect(s.fateProphet.life.reflected).toBe(true);
    expect(s.fateProphet.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'FP2-ROWAN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
    expect(s.fateProphet.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
    expect(s.chaosWalker.life).toMatchObject({ siteId: 'CW3-MECHANICAL-WORKSHOP', playerLocation: 'START', playerTravelMetres: 124, clockSeconds: 713,
      volunteer: { id: 'CW3-VERA', location: 'OUTSIDE', alive: true, willing: true, age: 39, health: 100, mind: 100, spirituality: 100 }, guide: { id: 'GUIDE', location: 'OUTSIDE' },
      cart: { id: 'CW3-CART', owner: 'GUIDE', location: 'A', releases: 3, returns: 3 }, parcel: { id: 'CW3-PARCEL', owner: 'GUIDE', location: 'CW3-CART', sealed: true, massGrams: 400 },
      disc: { id: 'CW3-DISC', location: 'A', pointer: 'A' }, record: { id: 'CW3-RECORD', location: 'B' }, pouch: { owner: 'CW3-VERA', location: 'VERA' } });
    expect(s.fateProphet.life.operation).toEqual({ door: 'OPEN', mechanical: { objectId: 'CW3-DISC', caseId: 'finite-disc', preparedAt: 477, preparationRoll: 41, bias: 'B', version: 1 }, forecast: null, correction: null });
    expect(s.winner.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ms = (s: SliceState, command: MercurySnakeCommand, commands?: SliceIntent[]) => step(s, { type: 'MERCURY_SNAKE', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectMercurySnake = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'MERCURY_SNAKE', command } as SliceIntent);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** UNIT-ONLY source selection before a new-stage journal exists. Never used by
 * natural play; original seed and all 703 old commands/roots remain unchanged. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const cached = cursors.get(kind); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), rolls = [rng.nextInt(1, 100), rng.nextInt(1, 100), rng.nextInt(1, 100)];
    const a = rolls[0]!, failure = (r: number) => r > chance && r < 96;
    if (kind === 'SUCCESS' ? a > 5 && a <= chance : kind === 'GREAT_SUCCESS' ? a <= 5 : kind === 'FAILURE' ? failure(a) : kind === 'GREAT_FAILURE' ? a >= 96 : rolls.every(failure)) {
      cursors.set(kind, cursor); return cursor;
    }
  }
  throw new Error(`No declared ${kind} UNIT cursor within the bounded original-seed search.`);
}
/** Explicit pre-journal UNIT setup only: week178 (or original177), cash100000,
 * AP100 and selected original-seed cursor. Original health90/mind95/spirituality119,
 * LIGHT injury, luck, all eight roots and 17 masteries are untouched. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalFateProphet(), weeks = mature ? Math.max(0, s.fateProphet.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
/** Resolve actual ordinary events only when public play produces one. A light
 * injury uses the existing ordinary REST path, without compulsory clinic work. */
export function resolveOrdinaryEvent(s: SliceState, commands?: SliceIntent[]): SliceState {
  if (!s.activeEvent) return s;
  const id = s.activeEvent.id;
  const choiceId = id === 'LIFE-CARE-01' ? (s.cash >= 60 ? 'PAY' : 'CREDIT') : id === 'LIFE-BILL-01' ? 'PAY_PART' : null;
  if (!choiceId) throw new Error(`Unexpected ordinary event ${id}; keep the actual state for review.`);
  return step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, commands);
}
export interface ReadyBudget { ap?: number; actions?: number; cash?: number; health?: number; mind?: number; spirituality?: number; pollution?: number; afterWeek?: number; healed?: boolean }
export function ready(s: SliceState, options: ReadyBudget = {}, commands?: SliceIntent[]): SliceState {
  const { ap = options.actions ?? 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1, healed = false } = options;
  if (ap > s.weeklyBudget) throw new Error('Requested AP exceeds the actual weekly budget.');
  for (let n = 0; n < 1200; n++) {
    if (s.activeEvent) { s = resolveOrdinaryEvent(s, commands); continue; }
    const needsRecovery = s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || healed && s.injuries.length > 0;
    if (s.actionsRemaining >= ap && s.cash >= cash && s.week > afterWeek && !needsRecovery) return s;
    if (s.status !== 'ACTIVE' || hasMercurySnakeLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    if (healed && untreated && !s.careKnown) s = step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands);
    else if (s.wagePaidWeek !== s.week && (s.cash < cash + 90 || s.cash < 90)) s = step(s, { type: 'ACTION', action: 'WORK' }, commands);
    else s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Actual ordinary recovery did not meet its declared finite budget.');
}
export const recoverResources = (s: SliceState, commands?: SliceIntent[]) => ready(s, { ap: Math.min(3, s.weeklyBudget), cash: 300, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true }, commands);
export const recover = recoverResources;
const taughtCache = new Map<string, SliceState>();
export function taught(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const key = `${kind}:${mature}`;
  if (!taughtCache.has(key)) taughtCache.set(key, ms(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' }));
  return structuredClone(taughtCache.get(key)!);
}
export const dose = { type: 'CONSUME', bottleId: 'mercury-snake-potion-1', confirmed: true } as const;
/** This path is also usable on originalFateProphet: never edits budgets, rolls or old history. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[], labour = true): SliceState {
  if (!s.mercurySnake.guidanceKnown) s = ms(ready(s, { cash: 590 }, commands), { type: 'LEARN_GUIDANCE' }, commands);
  for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) if (!s.mercurySnake.preparations.some(p => p.taskId === taskId)) s = ms(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  if (labour) while (s.mercurySnake.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ms(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: (labour ? 1200 : 7200) + 180 + 30, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.fateProphet.promotionWeek! + 11 }, commands);
  s = ms(s, { type: 'BUY_POTION', bottleId }, commands); return ms(s, { type: 'PREPARE_PROMOTION' }, commands);
}
const preparedCache = new Map<string, SliceState>();
export function prepared(kind: DirectedKind = 'SUCCESS', labour = true): SliceState {
  const key = `${kind}:${labour}`; if (!preparedCache.has(key)) preparedCache.set(key, prepareBottle(taught(kind), dose.bottleId, undefined, labour));
  return structuredClone(preparedCache.get(key)!);
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) {
    const s = ms(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s);
  }
  return structuredClone(promotedCache.get(kind)!);
}

// Explicit aliases for independently owned life, encounter and UI candidate tests.
export const mercurySnakeSource = originalFateProphet;
export const applyMercurySnakeDirected = ms;
export const settleMercurySnakeDirected = ready;
export const promoteMercurySnakeDirected = promoted;

export type DirectedLifeKind = 'RESTART' | 'RESTART_FAIL' | 'ANCHOR' | 'ANCHOR_FAIL';
const lifePromotedCache = new Map<string, SliceState>();
/** Directed UNIT selection occurs before any new-stage receipt. The first draw
 * is the paid successful potion; the next one/two are knowledge20 life checks.
 * ANCHOR tests complete case1 ordinarily, so it consumes no intervening draw. */
export function promotedForLife(kind: DirectedLifeKind = 'RESTART', options: number | { actions?: number; weeklyBudget?: number } = {}): SliceState {
  const weeklyBudget = typeof options === 'number' ? options : options.weeklyBudget ?? 100;
  const actions = typeof options === 'number' ? options : options.actions ?? weeklyBudget;
  const key = `${kind}:${weeklyBudget}:${actions}`, cached = lifePromotedCache.get(key);
  if (cached) return structuredClone(cached);
  if (!Number.isInteger(weeklyBudget) || weeklyBudget < 5 || weeklyBudget > 100 || !Number.isInteger(actions) || actions < 5 || actions > weeklyBudget) throw new Error('Invalid declared UNIT budget for five paid acquisition actions.');
  let s = directedInitial2();
  const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
  const passed = (roll: number, chance: number) => roll <= 5 || roll < 96 && roll <= chance;
  const sourceCursor = originalFateProphet().random.cursor;
  let selected: number | null = null;
  for (let cursor = sourceCursor; cursor < sourceCursor + 2048; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100), first = rng.nextInt(1, 100), second = rng.nextInt(1, 100);
    if (!passed(potion, potionChance)) continue;
    const wantsFailure = kind === 'RESTART_FAIL' || kind === 'ANCHOR_FAIL';
    if ((wantsFailure ? !passed(first, lifeChance) : passed(first, lifeChance)) && (kind !== 'ANCHOR' || passed(second, lifeChance))) { selected = cursor; break; }
  }
  if (selected === null) throw new Error(`No bounded original-seed UNIT source for ${kind}.`);
  s.random.cursor = selected; s.actionsRemaining = actions; s.weeklyBudget = weeklyBudget;
  assertValidSliceState(s);
  // Direct-buy path: guidance1 + three preparations3 + current preparation1.
  // No body, injury or luck patch and no recovery loop is needed for H90/M95.
  s = ms(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) s = ms(s, { type: 'PREPARE_TASK', taskId });
  s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
  s = ms(s, { type: 'PREPARE_PROMOTION' }); s = ms(s, dose);
  expect(s.progression.sequence).toBe(1); assertValidSliceState(s); lifePromotedCache.set(key, s); return structuredClone(s);
}

/** Follow only the actual public preferred life action, stopping immediately at
 * reflection. Ordinary recovery is allowed only while the real scene is closed. */
export function completeMercuryLife(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 512; n++) {
    if (s.mercurySnake.life.reflected) { expect(s.progression.acting).toBe(100); return s; }
    const p = projectMercurySnakeLife(s), next = p.actions.find(a => a.id === p.preferredActionId && a.enabled);
    if (next) { s = ms(s, next.command, commands); continue; }
    if (s.status !== 'ACTIVE' || hasMercurySnakeLock(s) || s.combat) throw new Error(`No public preferred life action: ${p.nextStep}`);
    s = ready(s, { ap: Math.min(2, s.weeklyBudget), cash: 60, mind: 50, spirituality: 40 }, commands);
    const retry = projectMercurySnakeLife(s), action = retry.actions.find(a => a.id === retry.preferredActionId && a.enabled);
    if (!action) throw new Error(`Life remains blocked after ordinary recovery: ${retry.nextStep}`);
    s = ms(s, action.command, commands);
  }
  throw new Error('Preferred finite life sequence exceeded its declared bound.');
}
export const promotedDigested = (kind: DirectedLifeKind = 'RESTART') => completeMercuryLife(promotedForLife(kind));
