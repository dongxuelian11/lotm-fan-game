import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { TIME_WORM_PREPARATION_IDS, type TimeWormCommand } from '../../src/domain/time-worm/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { hasTimeWormLock } from '../../src/domain/time-worm/index.js';

export const fateTrojanNaturalPath = 'tests/fixtures/fate-trojan-v01750/natural.json';
export const deceitMentorPeacefulPath = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
export const deceitMentorDeathPath = 'tests/fixtures/deceit-mentor-v01510/natural.json';
export const errorLegacyKeys = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor', 'fateTrojan'] as const;
export const originalErrorRoots = (s: SliceState) => errorLegacyKeys.map(key => s[key]);
/** Raw schema172 evidence is read separately. This helper explicitly invokes
 * the product migration and never relabels an old snapshot as current. */
export function loadTimeWormFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Full actual551 living final. No peaceful rollback, wound reset, seed search
 * or cursor edit. These are directed unit executions, not new public captures. */
export function originalFateTrojan(): SliceState {
  if (!originalCache) {
    const s = loadTimeWormFixture(fateTrojanNaturalPath, 'final');
    expect(s).toMatchObject({ revision: 552, week: 127, status: 'ACTIVE', health: 40, mind: 100, spirituality: 90,
      cash: 472, actionsRemaining: 3, injuryRisk: 2, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 27 },
      random: { seed: 'marauder-natural-v038', cursor: 361 }, progression: { pathwayId: 'error', sequence: 2, acting: 100 } });
    expect(s.injuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT', 'HEAVY']);
    expect(s.injuries.every(i => i.treatedRevision === null)).toBe(true);
    expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(Object.entries(s.progression.mastery).filter(([, n]) => n === 0).map(([id]) => id)).toEqual(['error.s5.thought-theft']);
    expect(s.character).toMatchObject({ name: '伊莲', gender: 'FEMALE', age: 26, coreStats: { physique: 28, perception: 27, will: 25, knowledge: 25 } });
    expect(s.fateTrojan.encounter).toMatchObject({ status: 'RETREATED', targetId: 'FT2-ELIAS', enemyHealth: 100, enemyMind: 100, enemySpirituality: 55, weaponLocation: 'HAND' });
    expect(s.fateTrojan.life.site).toMatchObject({ clockSeconds: 745, playerLocation: 'OUTSIDE', playerTravelMetres: 86, playerEnergy: 9,
      lina: { location: 'OUTSIDE', energy: 96, travelMetres: 4 }, victor: { location: 'OUTSIDE', energy: 88, travelMetres: 12 },
      parcel: { location: 'OUTSIDE', ordinaryMetres: 8 }, cabinet: { open: false, recognitionHolder: 'OWNER' },
      fate: { status: 'COMPLETED', paidToPlayer: 12, escrowPennies: 0 } });
    expect(s.fateTrojan.life.site.seals.map(seal => seal.charges)).toEqual([0, 0, 1]);
    expect(s.parasite.life.host).toMatchObject({ mode: 'NONE', control: 'HOST' });
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ae = (s: SliceState, command: TimeWormCommand, commands?: SliceIntent[]) => step(s, { type: 'TIME_WORM', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectTimeWorm = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'TIME_WORM', command } as SliceIntent);
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
  if (hasTimeWormLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
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
/** First care is paid from actual cash, then subsequent ordinary rest heals.
 * No site energy is restored by these ordinary global health commands. */
export function recoveredSource(): SliceState {
  if (!recoveredCache) {
    let s = ordinary(originalFateTrojan(), undefined, true);
    expect(s.chronicle.some(e => e.title === '普通伤口已处置')).toBe(true);
    s = ready(s, { health: 100, mind: 100, spirituality: 120 });
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.fateTrojan.life.site.playerEnergy).toBe(9);
    recoveredCache = s;
  }
  return structuredClone(recoveredCache);
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = ae(ready(recoveredSource(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'time-worm-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of TIME_WORM_PREPARATION_IDS) if (!s.timeWorm.preparations.some(p => p.taskId === taskId)) s = ae(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.timeWorm.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ae(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.fateTrojan.promotionWeek! + 11 }, commands);
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
      const bottle = s.timeWorm.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = ae(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.timeWorm.bottles.every(b => b.status === 'CONSUMED')) {
        s = ae(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = ae(ready(s, { afterWeek: s.timeWorm.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.timeWorm.bottles.find(b => b.status === 'SUPPLIER')!;
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
 * guidance/journal exists, preserving the historical seed and all eight roots.
 * These alternate inputs test potion branches only, never natural evidence.
 * All later costs, checks and journals run through the ordinary public reducer.
 * The regular originalFateTrojan/taught/prepared/promoted path never calls this. */
export function directedPrepared(outcomes: readonly PublicResolutionTier[]): SliceState {
  const key = outcomes.join('|');
  if (!directedPreparedCache.has(key)) {
    let s = ready(recoveredSource(), { cash: 500 });
    if (s.timeWorm.guidanceKnown || s.timeWorm.acquisitionJournal.length) throw new Error('Directed cursor must precede new-stage history.');
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 100_000; cursor++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
      if (outcomes.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }).tier === tier)) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded directed input for the explicitly requested potion branches.');
    s.random.cursor = selected; assertValidSliceState(s);
    s = ae(s, { type: 'LEARN_GUIDANCE' });
    directedPreparedCache.set(key, prepareBottle(s, 'time-worm-potion-1'));
  }
  return structuredClone(directedPreparedCache.get(key)!);
}
