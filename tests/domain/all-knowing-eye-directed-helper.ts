import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { ALL_KNOWING_EYE_PREPARATION_IDS, type AllKnowingEyeCommand } from '../../src/domain/all-knowing-eye/types.js';
import { hasAllKnowingEyeLock } from '../../src/domain/all-knowing-eye/index.js';

export const wisdomAngelNaturalPath = 'tests/fixtures/wisdom-angel-v01700/natural.json';
export const wisdomAngelBranchPath = 'tests/fixtures/wisdom-angel-v01700/original-enemy-approach.json';
export const readerLegacyKeys = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar', 'wisdomAngel'] as const;
export const originalReaderRoots = (s: SliceState) => readerLegacyKeys.map(key => s[key]);
/** Historical input is explicitly migrated; raw schema/hash assertions use a
 * separate read and never relabel old fixtures as current evidence. */
export function loadAllKnowingEyeFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Exactly537 original commands before optional Victor contact. The separate
 * 543-command death and defensive death are never revived or overwritten. */
export function originalWisdomAngel(): SliceState {
  if (!originalCache) {
    const s = loadAllKnowingEyeFixture(wisdomAngelBranchPath, 'beforeLast');
    expect(s).toMatchObject({ revision: 538, week: 125, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120,
      cash: 410, actionsRemaining: 3, injuryRisk: 0, injuries: [], date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 13 },
      random: { seed: 'reader-natural-v023', cursor: 180 }, progression: { pathwayId: 'white-tower', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(19); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.character).toMatchObject({ name: '罗温', gender: 'FEMALE', age: 26, coreStats: { physique: 28, perception: 29, will: 27, knowledge: 30 } });
    expect(s.wisdomAngel.promotionWeek).toBe(117);
    expect(s.wisdomAngel.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(s.wisdomAngel.life).toMatchObject({ reflected: true, activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 24, clockSeconds: 118,
      room: { id: 'WA2-ROOM', pathMetres: 4, exitOpen: true }, mara: { id: 'WA2-MARA', age: 43, location: 'EXIT', travelMetres: 24 },
      device: { id: 'WA2-DEVICE', location: 'TABLE', charges: 0, filter: 'AMBER', conditionVersion: 2, demonstrations: 2, filterChanges: 1 } });
    expect(s.wisdomAngel.life.papers.map(p => [p.id, p.location, p.firstReadWeek])).toEqual([['WA2-SHEET-1', 'TABLE', 118], ['WA2-SHEET-2', 'TABLE', 118]]);
    expect(s.mysticismMagister.crafts.map(c => [c.id, c.status])).toEqual([['MM5-FLASH-1', 'CONSUMED'], ['MM5-FLASH-3', 'PLAYER'], ['MM5-FLASH-4', 'PLAYER']]);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ae = (s: SliceState, command: AllKnowingEyeCommand, commands?: SliceIntent[]) => step(s, { type: 'ALL_KNOWING_EYE', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectAllKnowingEye = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'ALL_KNOWING_EYE', command } as SliceIntent);
/** Fixed ordinary budget strategy, declared without reading future random
 * values. Actual work wages, living costs and recovery remain in the state. */
export function clearEvents(s: SliceState, commands?: SliceIntent[]): SliceState {
  for (let n = 0; s.activeEvent && n < 32; n++) {
    const event = projectSliceState(s).activeEvent!;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline' : event.id === 'LIFE-BILL-01' ? 'PAY_PART' : event.id === 'DEBT-NOTICE-01' ? 'DECLINE' : event.id === 'DEBT-SETTLE-01' ? 'DEFER' : event.id === 'LIFE-CARE-01' ? 'PAY' : event.id === 'CARE-WORK-OFFER' ? 'DECLINE' : null;
    if (!choiceId || !event.choices.some(c => c.id === choiceId && c.enabled)) throw new Error(`Undeclared ordinary event ${event.id}`);
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId }, commands);
  }
  if (s.activeEvent) throw new Error('Ordinary event queue did not close.');
  return s;
}
export function ordinary(s: SliceState, commands?: SliceIntent[], forceRest = false): SliceState {
  s = clearEvents(s, commands);
  if (hasAllKnowingEyeLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
  return clearEvents(step(s, { type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, commands), commands);
}
export interface ReadyBudget { ap?: number; cash?: number; health?: number; mind?: number; spirituality?: number; pollution?: number; afterWeek?: number }
export function ready(s: SliceState, { ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 }: ReadyBudget = {}, commands?: SliceIntent[]): SliceState {
  s = clearEvents(s, commands);
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    if (n >= 600 || s.status !== 'ACTIVE') throw new Error('Finite actual ordinary preparation did not meet the declared budget.');
    s = ordinary(s, commands);
  }
  return s;
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = ae(ready(originalWisdomAngel(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'all-knowing-eye-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of ALL_KNOWING_EYE_PREPARATION_IDS) if (!s.allKnowingEye.preparations.some(p => p.taskId === taskId)) s = ae(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.allKnowingEye.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ae(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: 128 }, commands);
  s = ae(s, { type: 'BUY_POTION', bottleId }, commands);
  return ae(s, { type: 'PREPARE_PROMOTION' }, commands);
}
let preparedCache: SliceState | undefined;
export function prepared(): SliceState {
  if (!preparedCache) preparedCache = prepareBottle(taught(), dose.bottleId);
  return structuredClone(preparedCache);
}
let promotedCache: SliceState | undefined;
/** Actual same-seed original bottles are attempted in order; every failure
 * remains. The cap is a test guard, not an alternate outcome or seed search. */
export function promoted(): SliceState {
  if (!promotedCache) {
    let s = prepared();
    for (let attempt = 0; attempt < 12; attempt++) {
      const bottle = s.allKnowingEye.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = ae(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.allKnowingEye.bottles.every(b => b.status === 'CONSUMED')) {
        s = ae(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = ae(ready(s, { afterWeek: s.allKnowingEye.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.allKnowingEye.bottles.find(b => b.status === 'SUPPLIER')!;
      s = prepareBottle(s, next.id);
    }
    if (!promotedCache) throw new Error('The fixed actual potion strategy exhausted twelve bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  return ready(s, { health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
}
