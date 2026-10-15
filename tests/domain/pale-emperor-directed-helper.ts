import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { FerrymanEraCommand } from '../../src/domain/ferryman/era.js';
import { PALE_EMPEROR_PREPARATION_IDS, PALE_EMPEROR_SOURCE_KEYS, type PaleEmperorCommand } from '../../src/domain/pale-emperor/types.js';
import { hasPaleEmperorLock } from '../../src/domain/pale-emperor/index.js';

export const deathConsulNaturalPath = 'tests/fixtures/death-consul-v01730/natural.json';
export const deathLegacyKeys = PALE_EMPEROR_SOURCE_KEYS;
/** Only ferryman.era is live. Every historical part remains frozen. */
export const originalDeathRoots = (s: SliceState) => deathLegacyKeys.map(key => {
  if (key !== 'ferryman') return structuredClone(s[key]);
  const { era: _era, ...history } = s.ferryman; return structuredClone(history);
});
export function loadPaleEmperorFixture(path: string, entry: string): SliceState { return migrateSliceState(readObjectEntry<SliceState>(path, entry)); }
let originalCache: SliceState | undefined;
export function originalDeathConsul(): SliceState {
  if (!originalCache) {
    const s = loadPaleEmperorFixture(deathConsulNaturalPath, 'final');
    expect(s).toMatchObject({ revision: 816, week: 3290, status: 'ACTIVE', health: 20, mind: 100, spirituality: 95,
      cash: 34, actionsRemaining: 1, injuryRisk: 6,
      date: { epoch: 'FIFTH_EPOCH', year: 1412, month: 7, day: 15 },
      random: { seed: 'corpsecollector-natural-v032', cursor: 359 }, progression: { pathwayId: 'death', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.character).toMatchObject({ name: '伊莲', gender: 'FEMALE', age: 26, coreStats: { physique: 32, perception: 28, will: 26, knowledge: 22 } });
    expect(s.deathConsul.promotionWeek).toBe(3284);
    expect(s.deathConsul.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 80, enemySpirituality: 46, enemyStatus: 'RESISTING' });
    expect(s.deathConsul.life).toMatchObject({ reflected: true, activeCase: null, site: { playerLocation: 'ENTRY', operatorLocation: 'OUTSIDE', operatorEnergy: 94,
      door: { state: 'OPEN', operations: 17 }, effect: { mode: 'OFF' }, residual: { strength: 1, container: 'CLOSED', seal: 'RESEALED', scorch: 1, heatSeconds: 0 }, material: { remaining: 0 } } });
    expect(s.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, status: 'RESISTING' } });
    expect(s.undying.lifecycle.experiencedCycles).toBe(1); assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState { const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next; }
export const pe = (s: SliceState, command: PaleEmperorCommand, commands?: SliceIntent[]) => step(s, { type: 'PALE_EMPEROR', command }, commands);
export const era = (s: SliceState, type: FerrymanEraCommand['type'], commands?: SliceIntent[]) => step(s, { type: 'FERRYMAN', command: { type } }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void { const before = structuredClone(s), payload = structuredClone(intent); expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload); }
export const rejectPaleEmperor = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'PALE_EMPEROR', command } as SliceIntent);
/** No hidden editing: all earnings, 60p care, 8p rests and 24p seven-day
 * charges use the same public current-era reducer as ordinary play. */
export function ordinary(s: SliceState, commands?: SliceIntent[], forceRest = false): SliceState {
  if (hasPaleEmperorLock(s) || s.combat || s.activeEvent) throw new Error('Ordinary recovery cannot bypass a scene, preparation or encounter.');
  if (s.ferryman.era.location !== 'RECEPTION') return era(s, 'ERA_ENTER', commands);
  if (s.actionsRemaining === 0) return era(s, s.cash < 24 ? 'ERA_WORK' : 'ERA_NEXT_WEEK', commands);
  return era(s, forceRest && s.cash >= 8 ? 'ERA_REST' : 'ERA_WORK', commands);
}
export interface ReadyBudget { ap?: number; actions?: number; cash?: number; health?: number; mind?: number; spirituality?: number; pollution?: number; afterWeek?: number; healed?: boolean }
export function ready(s: SliceState, options: ReadyBudget = {}, commands?: SliceIntent[]): SliceState {
  const { ap = options.actions ?? 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1, healed = false } = options;
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek || healed && s.injuries.length > 0; n++) {
    if (n >= 1200 || s.status !== 'ACTIVE' || hasPaleEmperorLock(s)) throw new Error('Fixed actual current-era preparation did not meet the declared finite budget.');
    if (s.actionsRemaining === 0 || s.ferryman.era.location !== 'RECEPTION') { s = ordinary(s, commands); continue; }
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    const needsRecovery = s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || healed && s.injuries.length > 0;
    if (healed && untreated && s.cash >= 60) s = era(s, 'ERA_CARE', commands);
    else if (needsRecovery && !(healed && untreated) && s.cash >= 32) s = era(s, 'ERA_REST', commands);
    else s = ordinary(s, commands);
  }
  return s;
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = pe(ready(originalDeathConsul(), { ap: 1, cash: 120 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'pale-emperor-potion-1', confirmed: true } as const;
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of PALE_EMPEROR_PREPARATION_IDS) if (!s.paleEmperor.preparations.some(p => p.taskId === taskId)) s = pe(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.paleEmperor.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = pe(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.deathConsul.promotionWeek! + 11 }, commands);
  s = pe(s, { type: 'BUY_POTION', bottleId }, commands); return pe(s, { type: 'PREPARE_PROMOTION' }, commands);
}
let preparedCache: SliceState | undefined;
export function prepared(): SliceState { if (!preparedCache) preparedCache = prepareBottle(taught(), dose.bottleId); return structuredClone(preparedCache); }
let promotedCache: SliceState | undefined;
export function promoted(): SliceState {
  if (!promotedCache) {
    let s = prepared();
    for (let attempt = 0; attempt < 12; attempt++) {
      const bottle = s.paleEmperor.bottles.find(b => b.status === 'PLAYER'); if (!bottle) throw new Error('Expected an actual acquired bottle.');
      s = pe(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.paleEmperor.bottles.every(b => b.status === 'CONSUMED')) {
        s = pe(ready(s, { ap: 1, cash: 20 }), { type: 'REQUEST_SUPPLY' });
        s = pe(ready(s, { afterWeek: s.paleEmperor.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      s = prepareBottle(s, s.paleEmperor.bottles.find(b => b.status === 'SUPPLIER')!.id);
    }
    if (!promotedCache) throw new Error('The fixed same-seed strategy exhausted twelve real bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export const recoverResources = (s: SliceState, commands?: SliceIntent[]) => ready(s, { ap: 4, cash: 100, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true }, commands);
