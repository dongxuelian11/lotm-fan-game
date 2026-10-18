import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { THUNDER_GOD_PREPARATION_IDS, type ThunderGodCommand } from '../../src/domain/thunder-god/types.js';
import { THUNDER_GOD_PRICES } from '../../src/domain/thunder-god/content.js';
import { hasThunderGodLock } from '../../src/domain/thunder-god/index.js';

export const catastropheNaturalPath = 'tests/fixtures/catastrophe-v01710/natural.json';
export const catastropheBranchPath = 'tests/fixtures/catastrophe-v01710/original-enemy-approach.json';
export const tyrantLegacyKeys = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing', 'catastrophe'] as const;
export const originalTyrantRoots = (s: SliceState) => tyrantLegacyKeys.map(key => s[key]);
/** Historical input is explicitly migrated; raw schema/hash assertions use a
 * separate read and never relabel old fixtures as current evidence. */
export function loadThunderGodFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Exactly599 original commands before optional Vale contact. The separate
 * 602-command actual death is never revived, retried or overwritten. */
export function originalCatastrophe(): SliceState {
  if (!originalCache) {
    const s = loadThunderGodFixture(catastropheBranchPath, 'beforeLast');
    expect(s).toMatchObject({ revision: 600, week: 138, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120,
      cash: 350, actionsRemaining: 3, injuryRisk: 0, injuries: [], date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 2, day: 12 },
      random: { seed: 'sailor-natural-v026', cursor: 267 }, progression: { pathwayId: 'tyrant', sequence: 2, acting: 100, promotionWeek: 7 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(22); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.character).toMatchObject({ name: '托林', gender: 'FEMALE', age: 26, coreStats: { physique: 34, perception: 27, will: 27, knowledge: 21 } });
    expect(s.catastrophe.promotionWeek).toBe(131);
    expect(s.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(s.catastrophe.life).toMatchObject({ reflected: true, activeCase: null, site: {
      id: 'CT2-COVE', boundaryMetres: 12, clockSeconds: 123, playerPosition: 'EXIT', playerTravelMetres: 12,
      keeper: { id: 'CT2-NORA', name: '诺拉', age: 45, alive: true, position: 'CONTROL', energy: 88, travelMetres: 36 },
      water: { id: 'CT2-WATER', originalUnits: 20, bayUnits: 20, channelUnits: 0 },
      gate: { id: 'CT2-GATE', position: 'CLOSED', durability: 96, operations: 4 }, buoy: { id: 'CT2-BUOY', offsetMetres: 0 },
      mooring: { durability: 99 }, winch: { durability: 99 }, wheel: { durability: 99, turns: 1 },
    } });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const tg = (s: SliceState, command: ThunderGodCommand, commands?: SliceIntent[]) => step(s, { type: 'THUNDER_GOD', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectThunderGod = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'THUNDER_GOD', command } as SliceIntent);
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
  if (hasThunderGodLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
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
  if (!taughtCache) taughtCache = tg(ready(originalCatastrophe(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'thunder-god-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of THUNDER_GOD_PREPARATION_IDS) if (!s.thunderGod.preparations.some(p => p.taskId === taskId)) s = tg(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.thunderGod.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = tg(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  const bottle = s.thunderGod.bottles.find(b => b.id === bottleId)!;
  const price = bottle.recovery ? THUNDER_GOD_PRICES.recoveryLabourBalance : THUNDER_GOD_PRICES.labourBalance;
  s = ready(s, { ap: 1, cash: price + THUNDER_GOD_PRICES.preparation, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.catastrophe.promotionWeek! + 11 }, commands);
  s = tg(s, { type: 'BUY_POTION', bottleId }, commands);
  return tg(s, { type: 'PREPARE_PROMOTION' }, commands);
}
let preparedCache: SliceState | undefined;
export function prepared(): SliceState {
  if (!preparedCache) preparedCache = prepareBottle(taught(), dose.bottleId);
  return structuredClone(preparedCache);
}
let promotedCache: SliceState | undefined;
/** Actual same-seed originals are attempted in order, then the latest failed
 * dose's same characteristic is recovered for a new carrier. Every failure
 * remains. The cap is a test guard, not an alternate outcome or seed search. */
export function promoted(): SliceState {
  if (!promotedCache) {
    let s = prepared();
    for (let attempt = 0; attempt < 12; attempt++) {
      const bottle = s.thunderGod.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = tg(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.thunderGod.bottles.every(b => b.status === 'CONSUMED')) {
        s = tg(ready(s, { ap: 1, cash: THUNDER_GOD_PRICES.recovery }), { type: 'REQUEST_RECOVERY_V1', bottleId: bottle.id });
        s = tg(ready(s, { ap: 1, afterWeek: s.thunderGod.resupply.requestedWeek! }), { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: bottle.id });
      }
      const next = s.thunderGod.bottles.find(b => b.status === 'SUPPLIER')!;
      s = prepareBottle(s, next.id);
    }
    if (!promotedCache) throw new Error('The fixed actual potion strategy exhausted twelve bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  return ready(s, { health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
}
