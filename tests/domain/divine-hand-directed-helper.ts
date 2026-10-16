import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { DIVINE_HAND_PREPARATION_IDS, type DivineHandCommand } from '../../src/domain/divine-hand/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { hasDivineHandLock } from '../../src/domain/divine-hand/index.js';

export const gloryNaturalPath = 'tests/fixtures/glory-v01760/natural.json';
export const silverKnightDirectedPath = 'tests/fixtures/silver-knight-v01520/directed.json';
export const silverKnightNaturalPath = 'tests/fixtures/silver-knight-v01520/natural.json';
export const silverNaturalDeathPath = 'tests/fixtures/preparation-audit-v01630/silver-natural.json';
export const silverV2NaturalDeathPath = 'tests/fixtures/preparation-audit-v01630/silver-v2-natural.json';
export const warriorLegacyKeys = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight', 'glory'] as const;
export const originalWarriorRoots = (s: SliceState) => warriorLegacyKeys.map(key => s[key]);
/** Raw schema173 evidence is read separately. This helper explicitly invokes
 * the product migration and never relabels an old snapshot as current. */
export function loadDivineHandFixture(path: string, entry: string): SliceState {
  return migrateSliceState(readObjectEntry<SliceState>(path, entry));
}
let originalCache: SliceState | undefined;
/** Actual158 Glory continuation with an explicit70-command DIRECTED S3
 * prefix, not a natural9→2 completion. No source, seed, cursor or wound edit.
 * Further helper calls are directed unit executions, not a new public capture. */
export function originalGlory(): SliceState {
  if (!originalCache) {
    const s = loadDivineHandFixture(gloryNaturalPath, 'final');
    expect(s).toMatchObject({ revision: 600, week: 146, status: 'ACTIVE', health: 90, mind: 100, spirituality: 96,
      cash: 500, actionsRemaining: 2, injuryRisk: 0, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 },
      random: { seed: 'warrior-natural-v042', cursor: 475 }, progression: { pathwayId: 'warrior', sequence: 2, acting: 100 } });
    expect(s.injuries).toEqual([{ id: 'warrior-rebuild-natural:combat:1:PLAYER:598:0', severity: 'LIGHT', acquiredRevision: 598, treatedRevision: null }]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(20);
    expect(Object.entries(s.progression.mastery).filter(([, n]) => n === 0).map(([id]) => id)).toEqual([
      'warrior.s6.dawn-light', 'warrior.s6.light-storm', 'warrior.s5.guard-state', 'warrior.s5.damage-sharing',
    ]);
    expect(s.character).toMatchObject({ name: '莱恩', gender: 'FEMALE', age: 26, coreStats: { physique: 34, perception: 24, will: 25, knowledge: 22 } });
    expect(s.glory.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'GL2-MARTIN', enemyHealth: 70, enemyMind: 100, enemySpirituality: 110, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD', enemyPosition: 'YARD' });
    expect(s.glory.life.site).toMatchObject({ clockSeconds: 293, playerLocation: 'OUTSIDE', playerTravelMetres: 60, playerEnergy: 35,
      celia: { location: 'OUTSIDE', energy: 80, travelMetres: 20 }, evan: { location: 'OUTSIDE', energy: 82, travelMetres: 18 },
      armor: { id: 'SK3-LIFE-ARMOR', integrity: 60, active: false, remainingSeconds: 0 }, armorWorn: true,
      pads: { location: 'BENCH', remaining: 1, consumed: 1, worn: false }, load: { remainingLoads: 0, appliedLoads: 1 } });
    expect(s.glory.life.site.plates.map(plate => plate.charges)).toEqual([0, 0, 1]);
    expect(s.silverKnight.life.armor.integrity).toBe(65);
    assertValidSliceState(s); originalCache = s;
  }
  return structuredClone(originalCache);
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ae = (s: SliceState, command: DivineHandCommand, commands?: SliceIntent[]) => step(s, { type: 'DIVINE_HAND', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectDivineHand = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'DIVINE_HAND', command } as SliceIntent);
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
  if (hasDivineHandLock(s) || s.combat) throw new Error('Ordinary recovery cannot bypass an active scene.');
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
 * armor, old load, pads or paid plates. No direct health/resource rewrite. */
export function recoveredSource(): SliceState {
  if (!recoveredCache) {
    const s = ready(originalGlory(), { health: 100, mind: 100, spirituality: 120 });
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.glory.life.site.playerEnergy).toBe(35);
    recoveredCache = s;
  }
  return structuredClone(recoveredCache);
}
let taughtCache: SliceState | undefined;
export function taught(): SliceState {
  if (!taughtCache) taughtCache = ae(ready(originalGlory(), { ap: 1, cash: 500 }), { type: 'LEARN_GUIDANCE' });
  return structuredClone(taughtCache);
}
export const dose = { type: 'CONSUME', bottleId: 'divine-hand-potion-1', confirmed: true } as const;
/** Five real jobs and all three separate professional preparations. No cash,
 * action, calendar, seed, cursor, injury or mastery fields are edited. */
export function prepareBottle(s: SliceState, bottleId: string, commands?: SliceIntent[]): SliceState {
  for (const taskId of DIVINE_HAND_PREPARATION_IDS) if (!s.divineHand.preparations.some(p => p.taskId === taskId)) s = ae(ready(s, {}, commands), { type: 'PREPARE_TASK', taskId }, commands);
  while (s.divineHand.bottles.find(b => b.id === bottleId)!.labourSteps < 5) s = ae(ready(s, {}, commands), { type: 'POTION_WORK', bottleId }, commands);
  s = ready(s, { ap: 1, cash: 1250, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.glory.promotionWeek! + 11 }, commands);
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
      const bottle = s.divineHand.bottles.find(b => b.status === 'PLAYER');
      if (!bottle) throw new Error('Expected the next real acquired original bottle.');
      s = ae(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      if (s.progression.sequence === 1) { assertValidSliceState(s); promotedCache = s; break; }
      if (s.divineHand.bottles.every(b => b.status === 'CONSUMED')) {
        s = ae(ready(s, { ap: 1, cash: 100 }), { type: 'REQUEST_SUPPLY' });
        s = ae(ready(s, { afterWeek: s.divineHand.resupply.requestedWeek! }), { type: 'RECEIVE_SUPPLY' });
      }
      const next = s.divineHand.bottles.find(b => b.status === 'SUPPLIER')!;
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
 * guidance/journal exists, preserving the historical seed and all eight roots, including directed S3 provenance.
 * These alternate inputs test potion branches only, never natural evidence.
 * All later costs, checks and journals run through the ordinary public reducer.
 * The regular originalGlory/taught/prepared/promoted path never calls this. */
export function directedPrepared(outcomes: readonly PublicResolutionTier[]): SliceState {
  const key = outcomes.join('|');
  if (!directedPreparedCache.has(key)) {
    let s = ready(recoveredSource(), { cash: 500 });
    if (s.divineHand.guidanceKnown || s.divineHand.acquisitionJournal.length) throw new Error('Directed cursor must precede new-stage history.');
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 100_000; cursor++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
      if (outcomes.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }).tier === tier)) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded directed input for the explicitly requested potion branches.');
    s.random.cursor = selected; assertValidSliceState(s);
    s = ae(s, { type: 'LEARN_GUIDANCE' });
    directedPreparedCache.set(key, prepareBottle(s, 'divine-hand-potion-1'));
  }
  return structuredClone(directedPreparedCache.get(key)!);
}
