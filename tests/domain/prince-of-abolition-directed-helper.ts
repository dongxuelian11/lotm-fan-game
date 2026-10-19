import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { PRINCE_OF_ABOLITION_PREPARATION_IDS, PRINCE_OF_ABOLITION_SOURCE_KEYS, type PrinceOfAbolitionCommand } from '../../src/domain/prince-of-abolition/types.js';
import { hasPrinceOfAbolitionLock } from '../../src/domain/prince-of-abolition/index.js';
import { projectPrinceOfAbolitionLife } from '../../src/domain/prince-of-abolition/life.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

export const entropyDukeNaturalPath = 'tests/fixtures/entropy-duke-v01830/natural.json';
export const blackEmperorLegacyKeys = PRINCE_OF_ABOLITION_SOURCE_KEYS;
export const oldBlackEmperorRoots = (s: SliceState) => blackEmperorLegacyKeys.map(key => structuredClone(s[key]));
export const originalBlackEmperorRoots = oldBlackEmperorRoots;
export function loadPrinceOfAbolitionFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<unknown>(path, entry)); }
let originalCache: SliceState | undefined;
/** The genuine complete 743-command source. Raw schema180 is pinned separately
 * in shared tests; this helper explicitly requests the actual CURRENT migration. */
export function originalEntropyDuke(): SliceState {
  if (!originalCache) {
    const s = loadPrinceOfAbolitionFixture(entropyDukeNaturalPath, 'final');
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      runId: 'lawyer-rebuild-natural', revision: 744, week: 185, status: 'ACTIVE', health: 100, mind: 95, spirituality: 94,
      cash: 800, actionsRemaining: 3, injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 6 },
      random: { seed: 'lawyer-natural-v063', cursor: 228 }, progression: { pathwayId: 'black-emperor', sequence: 2, acting: 100, promotionWeek: 6 } });
    expect(s.injuries).toEqual([]); expect(s.seer.pollution).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(14); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(3);
    for (const id of ['black-emperor.s7.bribery-weakening', 'black-emperor.s5.disorder', 'black-emperor.s3.ordered-deviation']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 29, perception: 23, will: 25, knowledge: 23 } });
    expect(s.entropyDuke.promotionWeek).toBe(175); expect(s.entropyDuke.life.reflected).toBe(true);
    expect(s.entropyDuke.bottles.map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'GREAT_SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    expect(s.entropyDuke.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B' });
    expect(s.entropyDuke.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 741, null], ['HEAVY', 743, null]]);
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.filter(g => g.location === 'PLAYER').map(g => g.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']);
    expect(s.frenzyMage.life).toMatchObject({ siteId: 'FM3-DELIVERY-PRACTICE', playerLocation: 'START', playerTravelMetres: 120, guideTravelMetres: 52, clockSeconds: 449,
      guide: { id: 'GUIDE', name: '米蕾·沃德', location: 'OUTSIDE' }, volunteer: { id: 'FM3-DARIAN', age: 42, alive: true, independentMind: true, willing: true, location: 'OUTSIDE', health: 100, mind: 100, injuries: [] },
      parcel: { id: 'FM3-PARCEL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 400 },
      ball: { id: 'FM3-PRACTICE-BALL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 80, throws: 4, returns: 4 },
      paper: { id: 'FM3-ROUTE-PAPER', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, text: '从A到B' } });
    expect(s.entropyDuke.life.operation).toEqual({ door: 'OPEN', inputActive: false, flight: null });
    expect(s.entropyDuke.life.source!.snapshot.clockSeconds).toBe(85); expect(s.entropyDuke.encounter.startRoot!.clockSeconds).toBe(249);
    expect(s.fallenEarl.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0 });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const poa = (s: SliceState, command: PrinceOfAbolitionCommand, commands?: SliceIntent[]) => step(s, { type: 'PRINCE_OF_ABOLITION', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectPrinceOfAbolition = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'PRINCE_OF_ABOLITION', command } as SliceIntent);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** UNIT-ONLY source selection before a new-stage journal exists. Never used by
 * natural play; original seed and all 743 old commands/roots remain unchanged. */
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
/** Explicit pre-journal UNIT setup only: week187 (or original185), cash100000,
 * AP100, selected original-seed cursor. Health100, original mind95/spirituality94, no wounds, all eight
 * roots, 14 masteries and every original physical object are untouched. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalEntropyDuke(), weeks = mature ? Math.max(0, s.entropyDuke.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
/** Resolve actual ordinary events only when public play produces one; the source is healthy. */
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
    if (s.status !== 'ACTIVE' || hasPrinceOfAbolitionLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
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
  if (!taughtCache.has(key)) taughtCache.set(key, poa(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' }));
  return structuredClone(taughtCache.get(key)!);
}
export const dose = { type: 'CONSUME', bottleId: 'prince-of-abolition-potion-1', confirmed: true } as const;
/** This path is also usable on originalEntropyDuke: never edits budgets, rolls or old history. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[], labour = true): SliceState {
  if (!s.princeOfAbolition.guidanceKnown) s = poa(ready(s, { cash: 590 }, commands), { type: 'LEARN_GUIDANCE' }, commands);
  for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) if (!s.princeOfAbolition.preparations.some(p => p.taskId === taskId)) s = poa(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  if (labour) while (s.princeOfAbolition.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = poa(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: (labour ? 1200 : 7200) + 180 + 30, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.entropyDuke.promotionWeek! + 11 }, commands);
  s = poa(s, { type: 'BUY_POTION', bottleId }, commands); return poa(s, { type: 'PREPARE_PROMOTION' }, commands);
}
const preparedCache = new Map<string, SliceState>();
export function prepared(kind: DirectedKind = 'SUCCESS', labour = true): SliceState {
  const key = `${kind}:${labour}`; if (!preparedCache.has(key)) preparedCache.set(key, prepareBottle(taught(kind), dose.bottleId, undefined, labour));
  return structuredClone(preparedCache.get(key)!);
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) {
    const s = poa(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s);
  }
  return structuredClone(promotedCache.get(kind)!);
}

// Explicit aliases for independently owned life, encounter and UI candidate tests.
export const princeOfAbolitionSource = originalEntropyDuke;
export const applyPrinceOfAbolitionDirected = poa;
export const settlePrinceOfAbolitionDirected = ready;
export const promotePrinceOfAbolitionDirected = promoted;

export type DirectedLifeKind = 'AMPLIFY' | 'AMPLIFY_FAIL' | 'MAINTAIN' | 'MAINTAIN_FAIL';
const lifePromotedCache = new Map<string, SliceState>();
/** Directed UNIT selection occurs before any new-stage receipt. The first draw
 * is the paid successful potion. AMPLIFY selects the next knowledge18 draw.
 * MAINTAIN completes case1 ordinarily and launches case2 ordinarily; each
 * actual throw consumes one draw, then maintenance uses the third postdose draw. */
export function promotedForLife(kind: DirectedLifeKind = 'AMPLIFY', options: number | { actions?: number; weeklyBudget?: number } = {}): SliceState {
  const weeklyBudget = typeof options === 'number' ? options : options.weeklyBudget ?? 100;
  const actions = typeof options === 'number' ? options : options.actions ?? weeklyBudget;
  const key = `${kind}:${weeklyBudget}:${actions}`, cached = lifePromotedCache.get(key);
  if (cached) return structuredClone(cached);
  if (!Number.isInteger(weeklyBudget) || weeklyBudget < 5 || weeklyBudget > 100 || !Number.isInteger(actions) || actions < 5 || actions > weeklyBudget) throw new Error('Invalid declared UNIT budget for five paid acquisition actions.');
  let s = directedInitial2();
  const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 18, modifiers: [] });
  const passed = (roll: number, chance: number) => roll <= 5 || roll < 96 && roll <= chance;
  const sourceCursor = originalEntropyDuke().random.cursor;
  let selected: number | null = null;
  for (let cursor = sourceCursor; cursor < sourceCursor + 2048; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100), first = rng.nextInt(1, 100);
    rng.nextInt(1, 100); const third = rng.nextInt(1, 100);
    if (!passed(potion, potionChance)) continue;
    const wantsFailure = kind === 'AMPLIFY_FAIL' || kind === 'MAINTAIN_FAIL';
    const selectedLife = kind.startsWith('MAINTAIN') ? third : first;
    if (wantsFailure ? !passed(selectedLife, lifeChance) : passed(selectedLife, lifeChance)) { selected = cursor; break; }
  }
  if (selected === null) throw new Error(`No bounded original-seed UNIT source for ${kind}.`);
  s.random.cursor = selected; s.actionsRemaining = actions; s.weeklyBudget = weeklyBudget;
  assertValidSliceState(s);
  // Direct-buy path: guidance1 + three preparations3 + current preparation1.
  // No body, injury or resource patch and no recovery loop is needed for H100/M95.
  s = poa(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) s = poa(s, { type: 'PREPARE_TASK', taskId });
  s = poa(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
  s = poa(s, { type: 'PREPARE_PROMOTION' }); s = poa(s, dose);
  expect(s.progression.sequence).toBe(1); assertValidSliceState(s); lifePromotedCache.set(key, s); return structuredClone(s);
}

/** Follow only the actual public preferred life action, stopping immediately at
 * reflection. Ordinary recovery is allowed only while the real scene is closed. */
export function completePrinceLife(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 512; n++) {
    if (s.princeOfAbolition.life.reflected) { expect(s.progression.acting).toBe(100); return s; }
    const p = projectPrinceOfAbolitionLife(s), next = p.actions.find(a => a.id === p.preferredActionId && a.enabled);
    if (next) { s = poa(s, next.command, commands); continue; }
    if (s.status !== 'ACTIVE' || hasPrinceOfAbolitionLock(s) || s.combat) throw new Error(`No public preferred life action: ${p.nextStep}`);
    s = ready(s, { ap: Math.min(2, s.weeklyBudget), cash: 300, mind: 50, spirituality: 40 }, commands);
    const retry = projectPrinceOfAbolitionLife(s), action = retry.actions.find(a => a.id === retry.preferredActionId && a.enabled);
    if (!action) throw new Error(`Life remains blocked after ordinary recovery: ${retry.nextStep}`);
    s = poa(s, action.command, commands);
  }
  throw new Error('Preferred finite life sequence exceeded its declared bound.');
}
export const promotedDigested = (kind: DirectedLifeKind = 'AMPLIFY') => completePrinceLife(promotedForLife(kind));
