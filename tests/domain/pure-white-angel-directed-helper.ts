import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { PURE_WHITE_ANGEL_PREPARATION_IDS, type PureWhiteAngelCommand } from '../../src/domain/pure-white-angel/types.js';
import { hasPureWhiteAngelLock } from '../../src/domain/pure-white-angel/index.js';

export const lightSeekerNaturalPath = 'tests/fixtures/light-seeker-v01720/natural.json';
export const sunLegacyKeys = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor', 'lightSeeker'] as const;
export const originalSunRoots = (s: SliceState) => sunLegacyKeys.map(key => s[key]);
/** Raw historical evidence is explicitly migrated; old bytes and hashes remain untouched. */
export function loadPureWhiteAngelFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Exactly729 original commands, including Owen's actual death and three
 * untreated player wounds. Recovery is performed only by public commands. */
export function originalLightSeeker(): SliceState {
  if (!originalCache) {
    const s = loadPureWhiteAngelFixture(lightSeekerNaturalPath, 'final');
    expect(s).toMatchObject({ revision: 730, week: 175, status: 'ACTIVE', health: 50, mind: 100, spirituality: 87,
      cash: 540, actionsRemaining: 3, injuryRisk: 3, careKnown: false,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 28 },
      random: { seed: 'bard-natural-v029', cursor: 356 }, progression: { pathwayId: 'sun', sequence: 2, acting: 100, promotionWeek: 5 } });
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(20);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.character).toMatchObject({ name: '塞琳', gender: 'FEMALE', age: 26, coreStats: { physique: 30, perception: 26, will: 29, knowledge: 24 } });
    expect(s.lightSeeker.promotionWeek).toBe(167);
    expect(s.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'LS2-OWEN', enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.lightSeeker.life).toMatchObject({ reflected: true, activeCase: null, site: {
      id: 'LS2-GALLERY', lengthMetres: 6, ordinaryExit: 'OPEN', elapsedSeconds: 976, playerLocation: 'ENTRY', playerMetres: 94,
      operatorId: 'LS2-MARA', operatorLocation: 'SIDE', operatorMetres: 33, operatorEnergy: 90, operatorConsent: 'GRANTED', operatorConsentWeek: 174,
      spiritId: 'LS2-REED', spiritLocation: 'SIDE', spiritMetres: 18, spiritEnergy: 96, spiritConsent: 'CLOSED', spiritConsentWeek: 171,
      shutter: { state: 'OPEN', durability: 81, operations: 19 }, lamp: { oil: 3 },
      cover: { position: 'OWNER_STAND', durability: 100 }, screen: { durability: 99, inspections: 1 }, light: { mode: 'OFF' },
      board: { inscription: 'NORTH_ARCH', location: 'FAR_STAND', owner: 'LS2-MARA', read: true },
    } });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const pw = (s: SliceState, command: PureWhiteAngelCommand, commands?: SliceIntent[]) => step(s, { type: 'PURE_WHITE_ANGEL', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectPureWhiteAngel = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'PURE_WHITE_ANGEL', command } as SliceIntent);
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
  if (hasPureWhiteAngelLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
  const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
  if (untreated && !s.careKnown && s.actionsRemaining > 0 && s.cash >= 60) {
    return clearEvents(step(s, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands), commands);
  }
  if (untreated && s.careKnown && s.cash >= 60 && s.lastMedicalInviteWeek !== s.week) forceRest = true;
  return clearEvents(step(s, { type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, commands), commands);
}
export interface ReadyBudget { ap?: number; cash?: number; health?: number; mind?: number; spirituality?: number; pollution?: number; afterWeek?: number; healed?: boolean }
export function ready(s: SliceState, { ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1, healed = false }: ReadyBudget = {}, commands?: SliceIntent[]): SliceState {
  s = clearEvents(s, commands);
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek || healed && s.injuries.length > 0; n++) {
    if (n >= 600 || s.status !== 'ACTIVE') throw new Error('Finite actual ordinary preparation did not meet the declared budget.');
    s = ordinary(s, commands);
  }
  return s;
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = pw(originalLightSeeker(), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'pure-white-angel-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of PURE_WHITE_ANGEL_PREPARATION_IDS) if (!s.pureWhiteAngel.preparations.some(p => p.taskId === taskId)) s = pw(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.pureWhiteAngel.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = pw(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true, afterWeek: s.lightSeeker.promotionWeek! + 11 }, commands);
  s = pw(s, { type: 'BUY_POTION', bottleId }, commands);
  return pw(s, { type: 'PREPARE_PROMOTION' }, commands);
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
      const bottle = s.pureWhiteAngel.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = pw(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.pureWhiteAngel.bottles.every(b => b.status === 'CONSUMED')) {
        s = pw(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = pw(ready(s, { afterWeek: s.pureWhiteAngel.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.pureWhiteAngel.bottles.find(b => b.status === 'SUPPLIER')!;
      s = prepareBottle(s, next.id);
    }
    if (!promotedCache) throw new Error('The fixed actual potion strategy exhausted twelve bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  return ready(s, { health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true }, commands);
}
