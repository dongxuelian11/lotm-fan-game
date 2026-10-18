import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { HAND_OF_ORDER_PREPARATION_IDS, HAND_OF_ORDER_SOURCE_KEYS, type HandOfOrderCommand } from '../../src/domain/hand-of-order/types.js';
import { hasHandOfOrderLock } from '../../src/domain/hand-of-order/index.js';
import { projectHandOfOrderLife } from '../../src/domain/hand-of-order/life.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

export const balancerNaturalPath = 'tests/fixtures/balancer-v01840/natural.json';
export const justiciarLegacyKeys = HAND_OF_ORDER_SOURCE_KEYS;
export const oldJusticiarRoots = (s: SliceState) => justiciarLegacyKeys.map(key => structuredClone(s[key]));
export const originalJusticiarRoots = oldJusticiarRoots;
export function loadHandOfOrderFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<unknown>(path, entry)); }
let originalCache: SliceState | undefined;
/** The genuine complete 594-command source. Raw schema181 and its hash are
 * pinned separately; all fixtures explicitly request CURRENT migration. */
export function originalBalancer(): SliceState {
  if (!originalCache) {
    const s = loadHandOfOrderFixture(balancerNaturalPath, 'final');
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      runId: 'arbiter-rebuild-natural', revision: 595, week: 135, status: 'ACTIVE', health: 60, mind: 96, spirituality: 120,
      cash: 690, actionsRemaining: 3, injuryRisk: 1, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 22 },
      random: { seed: 'arbiter-natural-v066', cursor: 367 }, progression: { pathwayId: 'justiciar', sequence: 2, acting: 100, promotionWeek: 9 } });
    expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 590, null], ['HEAVY', 593, null]]);
    expect(s.seer.pollution).toBe(0); expect(Object.keys(s.progression.mastery)).toHaveLength(17);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(6);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 30, perception: 25, will: 25, knowledge: 21 } });
    expect(s.balancer.promotionWeek).toBe(126); expect(s.balancer.life.reflected).toBe(true);
    expect(s.balancer.life.operation).toEqual({ door: 'OPEN', truth: null, effect: null });
    expect(s.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 126 });
    expect(s.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90, enemyMind: 100, enemySpirituality: 67, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B' });
    expect(s.balancer.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 592, null]]);
    expect(s.chaosHunter.life).toMatchObject({ siteId: 'CH3-LINE-PRACTICE', playerLocation: 'START', playerTravelMetres: 124, guideTravelMetres: 92, clockSeconds: 767,
      guide: { id: 'GUIDE', name: '薇娜·贝尔', location: 'OUTSIDE' }, volunteer: { id: 'CH3-MIRA', age: 43, alive: true, independentMind: true, willing: false, location: 'OUTSIDE', health: 100, mind: 100, injuries: [] },
      parcel: { id: 'CH3-PARCEL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 350 },
      line: { id: 'CH3-LINE', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1 },
      paper: { id: 'CH3-RULE-PAPER', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, text: '本次从A到B的越线' },
      table: { id: 'CH3-TABLE-B', location: 'B', thirdParties: 0 } });
    expect(s.chaosHunter.life).not.toEqual(s.balancer.life.source!.snapshot);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const hoo = (s: SliceState, command: HandOfOrderCommand, commands?: SliceIntent[]) => step(s, { type: 'HAND_OF_ORDER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectHandOfOrder = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'HAND_OF_ORDER', command } as SliceIntent);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** UNIT-ONLY source selection before a new-stage journal exists. Never used by
 * natural play; original seed and all 594 old commands/roots remain unchanged. */
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
/** Explicit pre-journal UNIT setup only: mature week138 (or original135),
 * cash100000, AP100 and an original-seed cursor. Actual H60/M96/S120,
 * LIGHT590/HEAVY593, risk1, eight roots and all17 masteries are untouched. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalBalancer(), weeks = mature ? Math.max(0, s.balancer.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
/** Resolve actual ordinary events only when public play produces one. */
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
    if (s.status !== 'ACTIVE' || hasHandOfOrderLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
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
  if (!taughtCache.has(key)) taughtCache.set(key, hoo(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' }));
  return structuredClone(taughtCache.get(key)!);
}
export const dose = { type: 'CONSUME', bottleId: 'hand-of-order-potion-1', confirmed: true } as const;
/** This path is also usable on originalBalancer: never edits budgets, rolls or old history. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[], labour = true): SliceState {
  if (!s.handOfOrder.guidanceKnown) s = hoo(ready(s, { cash: 590 }, commands), { type: 'LEARN_GUIDANCE' }, commands);
  for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) if (!s.handOfOrder.preparations.some(p => p.taskId === taskId)) s = hoo(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  if (labour) while (s.handOfOrder.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = hoo(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: (labour ? 1200 : 7200) + 180 + 30, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.balancer.promotionWeek! + 11 }, commands);
  s = hoo(s, { type: 'BUY_POTION', bottleId }, commands); return hoo(s, { type: 'PREPARE_PROMOTION' }, commands);
}
const preparedCache = new Map<string, SliceState>();
export function prepared(kind: DirectedKind = 'SUCCESS', labour = true): SliceState {
  const key = `${kind}:${labour}`;
  if (!preparedCache.has(key)) {
    let s = taught(kind);
    for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) s = hoo(s, { type: 'PREPARE_TASK', taskId });
    if (labour) for (let n = 0; n < 5; n++) s = hoo(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    s = hoo(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    preparedCache.set(key, hoo(s, { type: 'PREPARE_PROMOTION' }));
  }
  return structuredClone(preparedCache.get(key)!);
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) {
    const s = hoo(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s);
  }
  return structuredClone(promotedCache.get(kind)!);
}

// Explicit aliases for independently owned life, encounter and UI candidate tests.
export const handOfOrderSource = originalBalancer;
export const applyHandOfOrderDirected = hoo;
export const settleHandOfOrderDirected = ready;
export const promoteHandOfOrderDirected = promoted;

export type DirectedLifeKind = 'DIVISION' | 'DIVISION_FAIL' | 'AFTERMATH' | 'AFTERMATH_FAIL';
const lifePromotedCache = new Map<string, SliceState>();
/** UNIT cursor selected before guidance, preserving the original seed/history.
 * Potion is the first draw, first paid knowledge18 cast the next. AFTERMATH
 * therefore requires ordinary completion of the first handover case. Body
 * recovery below uses actual REST and clinic PAY60, never a source patch. */
export function promotedForLife(kind: DirectedLifeKind = 'DIVISION', options: number | { actions?: number; weeklyBudget?: number } = {}): SliceState {
  const weeklyBudget = typeof options === 'number' ? options : options.weeklyBudget ?? 100;
  const actions = typeof options === 'number' ? options : options.actions ?? weeklyBudget;
  const key = `${kind}:${weeklyBudget}:${actions}`, cached = lifePromotedCache.get(key);
  if (cached) return structuredClone(cached);
  if (!Number.isInteger(weeklyBudget) || weeklyBudget < 5 || weeklyBudget > 100 || !Number.isInteger(actions) || actions < 5 || actions > weeklyBudget) throw new Error('Invalid declared UNIT acquisition budget.');
  let s = directedInitial2();
  const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 18, modifiers: [] });
  const passed = (r: number, c: number) => r <= 5 || r < 96 && r <= c;
  const sourceCursor = originalBalancer().random.cursor;
  let selected: number | null = null;
  for (let cursor = sourceCursor; cursor < sourceCursor + 2048; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100), cast = rng.nextInt(1, 100);
    if (passed(potion, potionChance) && (kind.endsWith('_FAIL') ? !passed(cast, lifeChance) : passed(cast, lifeChance))) { selected = cursor; break; }
  }
  if (selected === null) throw new Error(`No bounded original-seed UNIT source for ${kind}.`);
  s.random.cursor = selected; s.actionsRemaining = actions; s.weeklyBudget = weeklyBudget; assertValidSliceState(s);
  s = hoo(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) s = hoo(s, { type: 'PREPARE_TASK', taskId });
  s = hoo(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
  s = hoo(s, { type: 'PREPARE_PROMOTION' }); s = hoo(s, dose);
  expect(s.progression.sequence).toBe(1); s = recoverResources(s);
  assertValidSliceState(s); lifePromotedCache.set(key, s); return structuredClone(s);
}

/** Follow only the actual public preferred life action, stopping immediately at
 * reflection. Ordinary recovery is allowed only while the real scene is closed. */
export function completeHandOfOrderLife(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 512; n++) {
    if (s.handOfOrder.life.reflected) { expect(s.progression.acting).toBe(100); return s; }
    const p = projectHandOfOrderLife(s), next = p.actions.find(a => a.id === p.preferredActionId && a.enabled);
    if (next) { s = hoo(s, next.command, commands); continue; }
    if (s.status !== 'ACTIVE' || hasHandOfOrderLock(s) || s.combat) throw new Error(`No public preferred life action: ${p.nextStep}`);
    s = ready(s, { ap: Math.min(2, s.weeklyBudget), cash: 300, mind: 50, spirituality: 40 }, commands);
    const retry = projectHandOfOrderLife(s), action = retry.actions.find(a => a.id === retry.preferredActionId && a.enabled);
    if (!action) throw new Error(`Life remains blocked after ordinary recovery: ${retry.nextStep}`);
    s = hoo(s, action.command, commands);
  }
  throw new Error('Preferred finite life sequence exceeded its declared bound.');
}
export const promotedDigested = (kind: DirectedLifeKind = 'DIVISION') => completeHandOfOrderLife(promotedForLife(kind));
