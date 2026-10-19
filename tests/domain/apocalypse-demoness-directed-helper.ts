import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { APOCALYPSE_DEMONESS_PREPARATION_IDS, type ApocalypseDemonessCommand } from '../../src/domain/apocalypse-demoness/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { hasApocalypseDemonessLock } from '../../src/domain/apocalypse-demoness/index.js';

export const calamityNaturalPath = 'tests/fixtures/calamity-demoness-v01770/natural.json';
export const unagingNaturalPath = 'tests/fixtures/unaging-demoness-v01530/natural.json';
export const demonessLegacyKeys = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness', 'calamityDemoness'] as const;
export const originalDemonessRoots = (s: SliceState) => demonessLegacyKeys.map(key => s[key]);
/** Raw schema174 evidence is read separately. This helper explicitly invokes
 * the product migration and never relabels an old snapshot as current. */
export function loadApocalypseDemonessFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Actual585-command same-seed S9→S2 source, with no seed, cursor, resource,
 * source-root or wound edits. Helper executions are explicit unit continuations,
 * not a replacement natural capture. */
export function originalCalamity(): SliceState {
  if (!originalCache) {
    const s = loadApocalypseDemonessFixture(calamityNaturalPath, 'final');
    expect(s).toMatchObject({ revision: 586, week: 143, status: 'ACTIVE', health: 70, mind: 100, spirituality: 120,
      cash: 610, actionsRemaining: 3, injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 18 },
      random: { seed: 'assassin-natural-v045', cursor: 207 }, progression: { pathwayId: 'demoness', sequence: 2, acting: 100 } });
    expect(s.injuries).toEqual([{ id: 'witch-rebuild-natural:combat:2:PLAYER:584:0', severity: 'HEAVY', acquiredRevision: 584, treatedRevision: null }]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(18);
    expect(Object.entries(s.progression.mastery).filter(([, n]) => n === 0).map(([id]) => id)).toEqual([
      'assassin.s9.vision', 'assassin.s7.black-flame', 'assassin.s7.frost', 'assassin.s6.silk-binding', 'assassin.s6.charm', 'assassin.s5.disease', 'assassin.s4.plague',
    ]);
    expect(s.character).toMatchObject({ name: '诺斯', gender: 'FEMALE', age: 26, coreStats: { physique: 29, perception: 26, will: 26, knowledge: 22 } });
    expect(s.calamityDemoness.encounter).toMatchObject({ status: 'RETREATED', targetId: 'CD2-IRIS', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyPosition: 'YARD', plate: { id: 'CD2-COMBAT-PLATE', charges: 3 } });
    expect(s.calamityDemoness.encounter.currentSite).toMatchObject({ clockSeconds: 407, playerLocation: 'OUTSIDE', playerTravelMetres: 78, playerEnergy: 22,
      vera: { location: 'OUTSIDE', energy: 92, travelMetres: 8, mirrorConsent: 'WITHDRAWN', boxConsent: 'CLOSED' },
      marcus: { location: 'OUTSIDE', energy: 70, travelMetres: 30, mirrorConsent: 'CLOSED', boxConsent: 'CLOSED' },
      load: { remainingLoads: 0, appliedLoads: 1 }, box: { state: 'CLOSED', scorched: true, pulses: 1 }, residue: { status: 'CONSUMED' } });
    expect(s.calamityDemoness.encounter.currentSite!.plates.map(plate => plate.charges)).toEqual([0, 0, 1]);
    expect(s.calamityDemoness.life.site).toMatchObject({ clockSeconds: 217, playerLocation: 'ENTRY', playerTravelMetres: 72, playerEnergy: 28 });
    expect(s.calamityDemoness.encounter.startSite).toEqual(s.calamityDemoness.life.site);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ae = (s: SliceState, command: ApocalypseDemonessCommand, commands?: SliceIntent[]) => step(s, { type: 'APOCALYPSE_DEMONESS', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectApocalypseDemoness = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'APOCALYPSE_DEMONESS', command } as SliceIntent);
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
  if (hasApocalypseDemonessLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
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
let recoveredCache: SliceState | undefined;
/** Optional actual ordinary recovery. It does not refill local scene energy,
 * old load, residue, returned plates or original combat plate. No direct health/resource rewrite. */
export function recoveredSource(): SliceState {
  if (!recoveredCache) {
    const s = ready(originalCalamity(), { health: 100, mind: 100, spirituality: 120 });
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.calamityDemoness.encounter.currentSite!.playerEnergy).toBe(22);
    recoveredCache = s;
  }
  return structuredClone(recoveredCache);
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = ae(ready(originalCalamity(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'apocalypse-demoness-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of APOCALYPSE_DEMONESS_PREPARATION_IDS) if (!s.apocalypseDemoness.preparations.some(p => p.taskId === taskId)) s = ae(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.apocalypseDemoness.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ae(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.calamityDemoness.promotionWeek! + 11 }, commands);
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
      const bottle = s.apocalypseDemoness.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = ae(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.apocalypseDemoness.bottles.every(b => b.status === 'CONSUMED')) {
        s = ae(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = ae(ready(s, { afterWeek: s.apocalypseDemoness.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.apocalypseDemoness.bottles.find(b => b.status === 'SUPPLIER')!;
      s = prepareBottle(s, next.id);
    }
    if (!promotedCache) throw new Error('The fixed actual potion strategy exhausted twelve bottles; preserve failure.');
  }
  return structuredClone(promotedCache);
}
export function recoverResources(s: SliceState, commands?: SliceIntent[]): SliceState {
  return ready(s, { health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
}

const directedPreparedCache = new Map<string, SliceState>();
/** DIRECTED UNIT INPUT ONLY. Pick a legal initial cursor before ANY new-stage
 * guidance/journal exists, preserving the historical seed and all eight roots, including all original natural S9→S2 evidence.
 * These alternate inputs test potion branches only, never natural evidence.
 * All later costs, checks and journals run through the ordinary public reducer.
 * The regular originalCalamity/taught/prepared/promoted path never calls this. */
export function directedPrepared(outcomes: readonly PublicResolutionTier[]): SliceState {
  const key = outcomes.join('|');
  if (!directedPreparedCache.has(key)) {
    let s = ready(recoveredSource(), { cash: 500 });
    if (s.apocalypseDemoness.guidanceKnown || s.apocalypseDemoness.acquisitionJournal.length) throw new Error('Directed cursor must precede new-stage history.');
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 100_000; cursor++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
      if (outcomes.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }).tier === tier)) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded directed input for the explicitly requested potion branches.');
    s.random.cursor = selected; assertValidSliceState(s);
    s = ae(s, { type: 'LEARN_GUIDANCE' });
    directedPreparedCache.set(key, prepareBottle(s, 'apocalypse-demoness-potion-1'));
  }
  return structuredClone(directedPreparedCache.get(key)!);
}
