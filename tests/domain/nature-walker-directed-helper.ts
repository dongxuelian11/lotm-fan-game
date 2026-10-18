import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { NATURE_WALKER_PREPARATION_IDS, NATURE_WALKER_SOURCE_KEYS, type NatureWalkerCommand } from '../../src/domain/nature-walker/types.js';
import { hasNatureWalkerLock } from '../../src/domain/nature-walker/index.js';
import { projectNatureWalkerLife } from '../../src/domain/nature-walker/life.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

export const barrenMatriarchNaturalPath = 'tests/fixtures/barren-matriarch-v01850/natural.json';
export const motherLegacyKeys = NATURE_WALKER_SOURCE_KEYS;
export const oldMotherRoots = (s: SliceState) => motherLegacyKeys.map(key => structuredClone(s[key]));
export const originalMotherRoots = oldMotherRoots;
export function loadNatureWalkerFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<unknown>(path, entry)); }
let originalCache: SliceState | undefined;
/** Stream the authentic complete 851-command terminal source, then explicitly
 * migrate to CURRENT. Raw historical schema/hash assertions live separately. */
export function originalBarrenMatriarch(): SliceState {
  if (!originalCache) {
    const s = loadNatureWalkerFixture(barrenMatriarchNaturalPath, 'final');
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      runId: 'cultivator-rebuild-natural', revision: 852, week: 212, status: 'ACTIVE', health: 100, mind: 96, spirituality: 114,
      cash: 885, actionsRemaining: 3, injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 7, day: 14 },
      random: { seed: 'cultivator-natural-v069', cursor: 238 }, progression: { pathwayId: 'mother', sequence: 2, acting: 100, promotionWeek: 6 } });
    expect(s.injuries).toEqual([]); expect(s.seer.pollution).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(3);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180,
      coreStats: { physique: 28, perception: 24, will: 23, knowledge: 24 } });
    expect(s.barrenMatriarch.promotionWeek).toBe(202); expect(s.barrenMatriarch.life.reflected).toBe(true);
    expect(s.barrenMatriarch.life.operation).toEqual({ dormancy: null, buffer: null });
    expect(s.barrenMatriarch.life.rootPad).toEqual({ id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1,
      owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 50, acquiredWeek: 202 });
    expect(s.barrenMatriarch.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'BM2-MARTIN', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 87 });
    expect(s.barrenMatriarch.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['HEAVY', 851, null]]);
    expect(s.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CB3-NOLAN', enemyStatus: 'SURRENDERED', enemyHealth: 50 });
    expect(s.coffinBearer.life).toMatchObject({ siteId: 'CB3-NURSERY-TRANSFER', playerLocation: 'START', playerTravelMetres: 124, clockSeconds: 834,
      owner: { id: 'CB3-ADA', name: '艾达·芬恩', age: 46, location: 'OUTSIDE', health: 100, mind: 100, injuries: [] },
      recipient: { id: 'CB3-LENA', name: '莉娜·肖', age: 39, location: 'OUTSIDE', health: 100, mind: 100, injuries: [] },
      box: { id: 'CB3-CASE', holder: 'OWNER', location: 'OUTSIDE', sampleId: null },
      tag: { id: 'CB3-TAG', holder: 'OWNER', location: 'OUTSIDE' }, paper: { id: 'CB3-RECORD', holder: 'OWNER', location: 'OUTSIDE' } });
    expect(s.coffinBearer.life.samples.map(sample => [sample.id, sample.alive, sample.vitality, sample.location])).toEqual([
      ['CB3-LIVE-1', true, 47, 'OUTSIDE'], ['CB3-LIVE-2', true, 47, 'OUTSIDE'], ['CB3-DRY-1', false, 0, 'OUTSIDE']]);
    expect(s.coffinBearer.life.guard.segments.map(segment => segment.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const nw = (s: SliceState, command: NatureWalkerCommand, commands?: SliceIntent[]) => step(s, { type: 'NATURE_WALKER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectNatureWalker = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'NATURE_WALKER', command } as SliceIntent);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** UNIT-ONLY source selection before a new-stage journal exists. Never used by
 * natural play; original seed and all 851 old commands/roots remain unchanged. */
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
/** Explicit pre-journal UNIT setup only: mature week214 (or original212),
 * cash100000, AP100 and an original-seed cursor. Actual H100/M96/S114,
 * no injuries, eight roots and all15 masteries are untouched; FEMALE is unchanged. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalBarrenMatriarch(), weeks = mature ? Math.max(0, s.barrenMatriarch.promotionWeek! + 12 - s.week) : 0;
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
    if (s.status !== 'ACTIVE' || hasNatureWalkerLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
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
  if (!taughtCache.has(key)) taughtCache.set(key, nw(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' }));
  return structuredClone(taughtCache.get(key)!);
}
export const dose = { type: 'CONSUME', bottleId: 'nature-walker-potion-1', confirmed: true } as const;
/** This path is also usable on originalBarrenMatriarch: never edits budgets, rolls or old history. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[], labour = true): SliceState {
  if (!s.natureWalker.guidanceKnown) s = nw(ready(s, { cash: 590 }, commands), { type: 'LEARN_GUIDANCE' }, commands);
  for (const taskId of NATURE_WALKER_PREPARATION_IDS) if (!s.natureWalker.preparations.some(p => p.taskId === taskId)) s = nw(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  if (labour) while (s.natureWalker.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = nw(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: (labour ? 1200 : 7200) + 180 + 30, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.barrenMatriarch.promotionWeek! + 11 }, commands);
  s = nw(s, { type: 'BUY_POTION', bottleId }, commands); return nw(s, { type: 'PREPARE_PROMOTION' }, commands);
}
const preparedCache = new Map<string, SliceState>();
export function prepared(kind: DirectedKind = 'SUCCESS', labour = true): SliceState {
  const key = `${kind}:${labour}`;
  if (!preparedCache.has(key)) {
    let s = taught(kind);
    for (const taskId of NATURE_WALKER_PREPARATION_IDS) s = nw(s, { type: 'PREPARE_TASK', taskId });
    if (labour) for (let n = 0; n < 5; n++) s = nw(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    s = nw(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    preparedCache.set(key, nw(s, { type: 'PREPARE_PROMOTION' }));
  }
  return structuredClone(preparedCache.get(key)!);
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) {
    const s = nw(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s);
  }
  return structuredClone(promotedCache.get(kind)!);
}

// Explicit aliases for independently owned life, encounter and UI candidate tests.
export const natureWalkerSource = originalBarrenMatriarch;
export const applyNatureWalkerDirected = nw;
export const settleNatureWalkerDirected = ready;
export const promoteNatureWalkerDirected = promoted;

export type DirectedLifeKind = 'LIVING_RESPONSE' | 'LIVING_RESPONSE_FAIL' | 'ROOT_BEARING' | 'ROOT_BEARING_FAIL';
const lifePromotedCache = new Map<string, SliceState>();
/** UNIT cursor selected before guidance, preserving the original seed/history.
 * Potion is the first draw, first paid knowledge18 cast the next. ROOT_BEARING
 * therefore requires ordinary completion of earlier plant-care cases. Body
 * recovery below uses actual REST and any real clinic bill, never a source patch. */
export function promotedForLife(kind: DirectedLifeKind = 'LIVING_RESPONSE', options: number | { actions?: number; weeklyBudget?: number } = {}): SliceState {
  const weeklyBudget = typeof options === 'number' ? options : options.weeklyBudget ?? 100;
  const actions = typeof options === 'number' ? options : options.actions ?? weeklyBudget;
  const key = `${kind}:${weeklyBudget}:${actions}`, cached = lifePromotedCache.get(key);
  if (cached) return structuredClone(cached);
  if (!Number.isInteger(weeklyBudget) || weeklyBudget < 5 || weeklyBudget > 100 || !Number.isInteger(actions) || actions < 5 || actions > weeklyBudget) throw new Error('Invalid declared UNIT acquisition budget.');
  let s = directedInitial2();
  const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats[kind.startsWith('ROOT_BEARING') ? 'will' : 'knowledge'] + 1, difficulty: 18, modifiers: [] });
  const passed = (r: number, c: number) => r <= 5 || r < 96 && r <= c;
  const sourceCursor = originalBarrenMatriarch().random.cursor;
  let selected: number | null = null;
  for (let cursor = sourceCursor; cursor < sourceCursor + 2048; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100), cast = rng.nextInt(1, 100);
    if (passed(potion, potionChance) && (kind.endsWith('_FAIL') ? !passed(cast, lifeChance) : passed(cast, lifeChance))) { selected = cursor; break; }
  }
  if (selected === null) throw new Error(`No bounded original-seed UNIT source for ${kind}.`);
  s.random.cursor = selected; s.actionsRemaining = actions; s.weeklyBudget = weeklyBudget; assertValidSliceState(s);
  s = nw(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of NATURE_WALKER_PREPARATION_IDS) s = nw(s, { type: 'PREPARE_TASK', taskId });
  s = nw(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
  s = nw(s, { type: 'PREPARE_PROMOTION' }); s = nw(s, dose);
  expect(s.progression.sequence).toBe(1); s = recoverResources(s);
  assertValidSliceState(s); lifePromotedCache.set(key, s); return structuredClone(s);
}

/** Follow only the actual public preferred life action, stopping immediately at
 * reflection. Ordinary recovery is allowed only while the real scene is closed. */
export function completeNatureWalkerLife(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 512; n++) {
    if (s.natureWalker.life.reflected) { expect(s.progression.acting).toBe(100); return s; }
    const p = projectNatureWalkerLife(s), next = p.actions.find(a => a.id === p.preferredActionId && a.enabled);
    if (next) { s = nw(s, next.command, commands); continue; }
    if (s.status !== 'ACTIVE' || hasNatureWalkerLock(s) || s.combat) throw new Error(`No public preferred life action: ${p.nextStep}`);
    s = ready(s, { ap: Math.min(2, s.weeklyBudget), cash: 300, mind: 50, spirituality: 40 }, commands);
    const retry = projectNatureWalkerLife(s), action = retry.actions.find(a => a.id === retry.preferredActionId && a.enabled);
    if (!action) throw new Error(`Life remains blocked after ordinary recovery: ${retry.nextStep}`);
    s = nw(s, action.command, commands);
  }
  throw new Error('Preferred finite life sequence exceeded its declared bound.');
}
export const promotedDigested = (kind: DirectedLifeKind = 'LIVING_RESPONSE') => completeNatureWalkerLife(promotedForLife(kind));
