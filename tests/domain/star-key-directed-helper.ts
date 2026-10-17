import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { STAR_KEY_PREPARATION_IDS, type StarKeyCommand } from '../../src/domain/star-key/types.js';
import { hasStarKeyLock } from '../../src/domain/star-key/index.js';

export const planeswalkerNaturalPath = 'tests/fixtures/planeswalker-v01740/natural.json';
export const planeswalkerBranchPath = 'tests/fixtures/planeswalker-v01740/original-enemy-approach.json';
export const doorLegacyKeys = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer', 'planeswalker'] as const;
export const originalDoorRoots = (s: SliceState) => doorLegacyKeys.map(key => s[key]);
/** Historical input is explicitly migrated; raw schema/hash assertions use a
 * separate read and never relabel old fixtures as current evidence. */
export function loadStarKeyFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Exactly701 original commands before optional Soren contact. The full707
 * and earlier209 deaths remain separate immutable history. The original S4
 * starting point is explicitly directed; no new seed/cursor edit is made. */
export function originalPlaneswalker(): SliceState {
  if (!originalCache) {
    const s = loadStarKeyFixture(planeswalkerBranchPath, 'beforeLast');
    expect(s).toMatchObject({revision:1009,week:201,status:'ACTIVE',health:100,mind:100,spirituality:120,
      cash:5280,actionsRemaining:3,injuryRisk:0,injuries:[],date:{epoch:'FIFTH_EPOCH',year:1353,month:4,day:28},
      random:{seed:'secrets-sorcerer-directed-24',cursor:94},progression:{pathwayId:'door',sequence:2,acting:100}});
    expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    expect(Object.values(s.progression.mastery).filter(n=>n===0)).toHaveLength(7);
    expect(s.character).toMatchObject({name:'伊莲',gender:'FEMALE',age:26,coreStats:{physique:27,perception:28,will:27,knowledge:23}});
    expect(s.planeswalker.encounter.status).toBe('AVAILABLE');
    expect(s.planeswalker.life.site).toMatchObject({elapsedSeconds:211,playerLocation:'ENTRY',operatorEnergy:94,
      operatorConsent:'WITHDRAWN',parcel:{location:'ENTRY_STAND'},lamp:{oilRemaining:2},screen:{state:'BLANK'}});
    expect(s.wanderer.life.packet.location).toBe('REMOTE');
    expect(s.wanderer.life.energy).toEqual({id:'WN3-ENERGY',remaining:1,spent:1});
    expect(s.wanderer.life.suit.protectionSeconds).toBe(90);
    assertValidSliceState(s);originalCache=s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ae = (s: SliceState, command: StarKeyCommand, commands?: SliceIntent[]) => step(s, { type: 'STAR_KEY', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectStarKey = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'STAR_KEY', command } as SliceIntent);
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
  if (hasStarKeyLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
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
  if (!taughtCache) taughtCache = ae(ready(originalPlaneswalker(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'star-key-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of STAR_KEY_PREPARATION_IDS) if (!s.starKey.preparations.some(p => p.taskId === taskId)) s = ae(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.starKey.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ae(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.planeswalker.promotionWeek! + 11 }, commands);
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
      const bottle = s.starKey.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = ae(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.starKey.bottles.every(b => b.status === 'CONSUMED')) {
        s = ae(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = ae(ready(s, { afterWeek: s.starKey.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.starKey.bottles.find(b => b.status === 'SUPPLIER')!;
      s = prepareBottle(s, next.id);
    }
    if (!promotedCache) throw new Error('The fixed actual potion strategy exhausted twelve bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  return ready(s, { health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
}
