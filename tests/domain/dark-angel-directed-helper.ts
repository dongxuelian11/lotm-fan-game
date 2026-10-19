import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { DARK_ANGEL_PREPARATION_IDS, DARK_ANGEL_SOURCE_KEYS, type DarkAngelCommand } from '../../src/domain/dark-angel/types.js';
import { hasDarkAngelLock } from '../../src/domain/dark-angel/index.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

export const elderNaturalPath = 'tests/fixtures/elder-v01790/natural.json';
export const hangedManLegacyKeys = DARK_ANGEL_SOURCE_KEYS;
export const oldHangedManRoots = (s: SliceState) => hangedManLegacyKeys.map(key => structuredClone(s[key]));
export const originalHangedManRoots = oldHangedManRoots;
export function loadDarkAngelFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<unknown>(path, entry)); }
let originalCache: SliceState | undefined;
/** Actual immutable 615-command Elder source; migrated format is checked separately from raw176. */
export function originalElder(): SliceState {
  if (!originalCache) {
    const s = loadDarkAngelFixture(elderNaturalPath, 'final');
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      revision: 616, week: 145, status: 'ACTIVE', health: 60, mind: 94, spirituality: 118,
      cash: 818, actionsRemaining: 3, injuryRisk: 1, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 1 },
      random: { seed: 'secret-supplicant-natural-v051', cursor: 353 }, progression: { pathwayId: 'hanged-man', sequence: 2, acting: 100, promotionWeek: 6 } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', null]]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(2);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 26, perception: 24, will: 27, knowledge: 23 } });
    expect(s.elder.promotionWeek).toBe(135); expect(s.elder.life.reflected).toBe(true);
    expect(s.elder.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 90 });
    expect(s.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 88, clockSeconds: 933,
      owner: { id: 'THT3-MARA', location: 'OUTSIDE' }, card: { id: 'THT3-CARD', location: 'TABLE', travelMetres: 40 },
      spirits: { 'THT3-HELENA': { spirituality: 18, integrity: 60, location: 'INTERNAL', interrupted: true }, 'THT3-ROLAND': { spirituality: 21, integrity: 100, location: 'INTERNAL' } } });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const da = (s: SliceState, command: DarkAngelCommand, commands?: SliceIntent[]) => step(s, { type: 'DARK_ANGEL', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectDarkAngel = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'DARK_ANGEL', command } as SliceIntent);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<DirectedKind, number>();
/** UNIT-ONLY source selection before a new-stage journal exists. Never used by
 * natural play; original seed and all 615 old commands/roots remain unchanged. */
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
/** Explicit pre-journal UNIT setup only: week147 (or original145), cash100000,
 * AP100, selected original-seed cursor. Health60, untreated LIGHT/HEAVY, all eight
 * roots, 15 masteries and every original physical object are untouched. */
export function directedInitial2(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalElder(), weeks = mature ? Math.max(0, s.elder.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
/** Real public care: first discover the ordinary clinic, REST opens its offer,
 * PAY spends60p and treats both actual wounds; only later REST can heal them. */
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
    if (s.status !== 'ACTIVE' || hasDarkAngelLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
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
  if (!taughtCache.has(key)) taughtCache.set(key, da(directedInitial2(kind, mature), { type: 'LEARN_GUIDANCE' }));
  return structuredClone(taughtCache.get(key)!);
}
export const dose = { type: 'CONSUME', bottleId: 'dark-angel-potion-1', confirmed: true } as const;
/** This path is also usable on originalElder: never edits budgets, rolls or old history. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[], labour = true): SliceState {
  if (!s.darkAngel.guidanceKnown) s = da(ready(s, { cash: 590 }, commands), { type: 'LEARN_GUIDANCE' }, commands);
  for (const taskId of DARK_ANGEL_PREPARATION_IDS) if (!s.darkAngel.preparations.some(p => p.taskId === taskId)) s = da(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  if (labour) while (s.darkAngel.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = da(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: (labour ? 1200 : 7200) + 180 + 30, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.elder.promotionWeek! + 11 }, commands);
  s = da(s, { type: 'BUY_POTION', bottleId }, commands); return da(s, { type: 'PREPARE_PROMOTION' }, commands);
}
const preparedCache = new Map<string, SliceState>();
export function prepared(kind: DirectedKind = 'SUCCESS', labour = true): SliceState {
  const key = `${kind}:${labour}`; if (!preparedCache.has(key)) preparedCache.set(key, prepareBottle(taught(kind), dose.bottleId, undefined, labour));
  return structuredClone(preparedCache.get(key)!);
}
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) {
    const s = da(prepared(kind), dose); expect(s.progression.sequence).toBe(1); assertValidSliceState(s); promotedCache.set(kind, s);
  }
  return structuredClone(promotedCache.get(kind)!);
}
