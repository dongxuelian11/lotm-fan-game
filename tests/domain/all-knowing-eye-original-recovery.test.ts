import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyAllKnowingEyeAcquisition, createAllKnowingEyeState, hasAllKnowingEyeLock,
  allKnowingEyeAcquisitionActions, allKnowingEyeAcquisitionBlock, projectAllKnowingEye,
  resolveAllKnowingEyeOriginals, resolveAllKnowingEyeOriginalsSnapshot,
  validateAllKnowingEyeAcquisitionCommand, validateAllKnowingEyeAcquisitionJournal, validateAllKnowingEyeState,
} from '../../src/domain/all-knowing-eye/index.js';
import { ALL_KNOWING_EYE_GUIDE, ALL_KNOWING_EYE_RECOVERY_SCHEMA_VERSION, ALL_KNOWING_EYE_RECOVERY_SITE_ID } from '../../src/domain/all-knowing-eye/content.js';
import { ALL_KNOWING_EYE_PREPARATION_IDS, type AllKnowingEyeAcquisitionBudget, type AllKnowingEyeAcquisitionCommand, type AllKnowingEyeAcquisitionEvent, type AllKnowingEyeState } from '../../src/domain/all-knowing-eye/types.js';
import { originalWisdomAngel, step } from './all-knowing-eye-directed-helper.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

/** Component-only pre-guidance budget and mature-date inputs. This does not
 * relabel a component branch as a natural playthrough or alter any old receipt. */
function directedInitial2(): SliceState {
  const s = originalWisdomAngel(), weeks = Math.max(0, 129 - s.week);
  s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.revision += 2;
  s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  return s;
}
function recoverResources(s: SliceState): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && s.injuries.length === 0) return s;
    assert.equal(s.activeEvent, null); s = step(s, { type: 'ACTION', action: 'REST' });
  }
  throw new Error('Finite ordinary rest did not complete.');
}

type Snapshot = Pick<AllKnowingEyeState, 'bottles' | 'resupply' | 'acquisitionJournal'>;
const bottleId = (n: number) => `all-knowing-eye-potion-${n}`;
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): AllKnowingEyeAcquisitionCommand => ({ type, bottleId: bottleId(n) });
const apply = (s: SliceState, command: AllKnowingEyeAcquisitionCommand): void => {
  applyAllKnowingEyeAcquisition(s, command, { note() {}, roll() { throw new Error('No auxiliary recovery draw'); }, check(ability, difficulty) {
    const random = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
    const check = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
    s.random.cursor = random.cursor; return check;
  } });
  s.revision++;
};
/** Explicit component-only pre-guidance cursor/budget input. Never modify the seed
 * or a recorded outcome, never call this from a natural run. */
function component(kinds: PublicResolutionTier[]): SliceState {
  const s = directedInitial2(); s.schemaVersion = ALL_KNOWING_EYE_RECOVERY_SCHEMA_VERSION;
  assert.equal(s.allKnowingEye.acquisitionJournal.length, 0);
  const first = s.random.cursor; let chosen: number | null = null;
  for (let cursor = first; cursor < first + 65536; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (kinds.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) }).tier === tier)) { chosen = cursor; break; }
  }
  assert.notEqual(chosen, null, 'A declared pre-guidance component cursor must exist'); s.random.cursor = chosen!;
  apply(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of ALL_KNOWING_EYE_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId });
  return s;
}
function consume(s: SliceState, n: number): void {
  if (s.allKnowingEye.bottles[n - 1]!.status === 'SUPPLIER') apply(s, { type: 'BUY_POTION', bottleId: bottleId(n) });
  apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, { type: 'CONSUME', bottleId: bottleId(n), confirmed: true });
}
function threeFailures(kinds: PublicResolutionTier[] = ['FAILURE', 'FAILURE', 'FAILURE']): SliceState {
  let s = component(kinds);
  for (let n = 1; n <= 3; n++) {
    s = recoverResources(s);
    for (let job = 0; job < 5; job++) apply(s, { type: 'POTION_WORK', bottleId: bottleId(n) });
    consume(s, n); assert.equal(s.progression.sequence, 2);
  }
  return s;
}
/** A component boundary advances week/date/revision together. This is explicitly
 * NOT ordinary time passage evidence; the central acquisition test uses REST. */
function nextComponentWeek(s: SliceState): void { s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2; }
function recover(s: SliceState, n = 1): void { apply(s, recovery('REQUEST_RECOVERY_V1', n)); nextComponentWeek(s); apply(s, recovery('RECOVER_CHARACTERISTIC_V1', n)); }
function budget(s: SliceState): AllKnowingEyeAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution,
    gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats },
    mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
/** Explicit archived component generator, not a public runtime bypass. The old
 * wire commands and all original costs are retained solely to test read replay. */
function appendArchivedSupply(s: SliceState, receive = false): void {
  const before = budget(s), revision = s.revision, state = s.allKnowingEye;
  const command: AllKnowingEyeAcquisitionCommand = { type: receive ? 'RECEIVE_SUPPLY' : 'REQUEST_SUPPLY' };
  const actor = { ...state.acquisitionJournal[0]!.actor, sourceHistoryDigest: null };
  if (!receive) { s.actionsRemaining--; s.cash -= 100; state.resupply.requestedWeek = s.week; }
  else {
    const first = state.bottles.length + 1;
    for (let offset = 0; offset < 3; offset++) {
      const n = first + offset;
      state.bottles.push({ ...structuredClone(createAllKnowingEyeState().bottles[0]!), id: bottleId(n), stockedWeek: s.week,
        source: `${ALL_KNOWING_EYE_GUIDE}第${Math.ceil(n / 3)}批、第${s.week}周实际到货的序列1全知之眼成品，独立封存编号${bottleId(n)}。本瓶须另行取得并独立耗用。` });
    }
    state.resupply.deliveries++; state.resupply.requestedWeek = null;
  }
  const event: AllKnowingEyeAcquisitionEvent = { week: s.week, date: structuredClone(s.date), revision, command, actor,
    before, after: budget(s), cursorBefore: s.random.cursor, cursorAfter: s.random.cursor, randomBefore: null, randomAfter: null, check: null };
  state.acquisitionJournal.push(event); s.revision++;
}

describe('All-Knowing Eye stage214 bounded original recovery', () => {
  it('pins the untouched666-command raw source with original1 success and original2/3 still supplied', () => {
    const path = 'tests/fixtures/all-knowing-eye-v01920/natural.json', bytes = readFileSync(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f');
    const s = readObjectEntry<SliceState>(path, 'final'), before = stableStringify(s);
    assert.deepEqual([s.revision, s.week, s.status, s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining], [667, 146, 'ACTIVE', 70, 86, 120, 1390, 3]);
    assert.deepEqual(s.allKnowingEye.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => [e.week, e.revision, e.check!.tier]), [[136, 574, 'SUCCESS']]);
    const resolved = resolveAllKnowingEyeOriginals(s)!;
    assert.deepEqual(resolved.characteristics.map(c => c.holder), ['EMBODIED', 'SUPPLIER', 'SUPPLIER']);
    assert.equal(resolved.embodiedOriginalBottleId, bottleId(1));
    assert.deepEqual(resolved.characteristics[0]!.consumptionHistory, [{ bottleId: bottleId(1), week: 136, revision: 574, outcome: 'SUCCESS' }]);
    assert.equal(allKnowingEyeAcquisitionActions(s).length, 0);
    assert.notEqual(allKnowingEyeAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1')), null);
    assert.equal(stableStringify(s), before); assert.equal(readFileSync(path).compare(bytes), 0);
  }, 60_000);
  for (const n of [1, 2, 3]) for (const holder of ['SUPPLIER', 'PLAYER', 'FAILED_REMNANT'] as const) it(`keeps original${n} embodied and other originals in their actual ${holder} custody`, () => {
    let s = component(holder === 'FAILED_REMNANT' ? ['FAILURE', 'FAILURE', 'SUCCESS'] : ['SUCCESS']);
    const external = [1, 2, 3].filter(id => id !== n);
    for (const id of external) {
      if (holder === 'PLAYER') apply(s, { type: 'BUY_POTION', bottleId: bottleId(id) });
      else if (holder === 'FAILED_REMNANT') { s = recoverResources(s); consume(s, id); }
    }
    s = recoverResources(s); consume(s, n);
    const before = stableStringify(s), result = resolveAllKnowingEyeOriginals(s)!;
    assert.equal(result.characteristics.length, 3); assert.equal(result.embodiedOriginalBottleId, bottleId(n)); assert.equal(result.embodiedBottleId, bottleId(n));
    for (const entry of result.characteristics) assert.equal(entry.holder, entry.originalBottleId === bottleId(n) ? 'EMBODIED' : holder);
    assert.equal(new Set(result.characteristics.map(entry => entry.characteristicId)).size, 3);
    assert.equal(validateAllKnowingEyeState(s), true); assert.equal(stableStringify(s), before);
  }, 60_000);
  for (const n of [1, 2, 3]) it(`recovery-success remains original${n}, after a second genuine failed carrier`, () => {
    let s = threeFailures(['FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    const originals = structuredClone(s.allKnowingEye.bottles), originalJournal = structuredClone(s.allKnowingEye.acquisitionJournal);
    recover(s, n); s = recoverResources(s); consume(s, 4);
    assert.equal(s.allKnowingEye.bottles[3]!.outcome, 'FAILURE');
    assert.notEqual(allKnowingEyeAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1', n)), null);
    recover(s, 4); s = recoverResources(s); consume(s, 5);
    const result = resolveAllKnowingEyeOriginals(s)!;
    assert.equal(result.embodiedOriginalBottleId, bottleId(n)); assert.equal(result.embodiedBottleId, bottleId(5)); assert.equal(result.characteristics.length, 3);
    assert.deepEqual(result.characteristics[n - 1]!.consumptionHistory.map(e => [e.bottleId, e.outcome]), [[bottleId(n), 'FAILURE'], [bottleId(4), 'FAILURE'], [bottleId(5), 'SUCCESS']]);
    assert.deepEqual(s.allKnowingEye.bottles.slice(0, 3), originals);
    assert.deepEqual(s.allKnowingEye.acquisitionJournal.slice(0, originalJournal.length), originalJournal);
    assert.equal(s.allKnowingEye.bottles[4]!.recovery!.sourceBottleId, bottleId(4));
    assert.equal(s.allKnowingEye.bottles[4]!.recovery!.characteristicId, `${bottleId(n)}:characteristic`);
    assert.equal(validateAllKnowingEyeState(s), true);
  }, 60_000);
  it('charges120 and1AP, binds the actual failed receipt, waits another week and charges fresh90 after five new jobs', () => {
    const s = threeFailures(), old = structuredClone(s.allKnowingEye), cash = s.cash, ap = s.actionsRemaining, random = { ...s.random };
    apply(s, recovery('REQUEST_RECOVERY_V1'));
    const pending = s.allKnowingEye.resupply.recovery!, source = old.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId(1))!;
    assert.deepEqual([s.cash, s.actionsRemaining], [cash - 120, ap - 1]);
    assert.deepEqual(s.allKnowingEye.acquisitionJournal.at(-1)!.recoverySite?.permission, { personId: 'WA2-MARA', week: s.week, revision: s.revision - 1, purpose: 'INVESTIGATE' });
    assert.deepEqual(s.allKnowingEye.acquisitionJournal.at(-1)!.recoverySite?.originals, s.allKnowingEye.sourceScene!.originals);
    assert.equal(pending.sourceReceiptRevision, source.revision); assert.equal(pending.siteId, ALL_KNOWING_EYE_RECOVERY_SITE_ID); assert.equal(pending.custodian, 'WA2-MARA');
    assert.match(allKnowingEyeAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))!, /真实周/);
    assert.notEqual(allKnowingEyeAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1', 2)), null);
    nextComponentWeek(s); apply(s, recovery('RECOVER_CHARACTERISTIC_V1'));
    assert.equal(s.allKnowingEye.acquisitionJournal.at(-1)!.recoverySite?.permission.purpose, 'RECOVER');
    assert.equal(s.allKnowingEye.acquisitionJournal.at(-1)!.recoverySite?.custodyAfter, 'SUPPLIER');
    assert.equal(old.bottles.every(b => b.labourSteps === 5), true);
    assert.equal(s.allKnowingEye.bottles[3]!.labourSteps, 0);
    assert.equal(resolveAllKnowingEyeOriginals(s)!.characteristics[0]!.holder, 'SUPPLIER');
    for (let n = 0; n < 5; n++) apply(s, { type: 'POTION_WORK', bottleId: bottleId(4) });
    apply(s, { type: 'BUY_POTION', bottleId: bottleId(4) });
    assert.deepEqual([s.cash, s.actionsRemaining], [cash - 120 - 90, ap - 7]);
    assert.deepEqual(s.random, random); assert.deepEqual(s.allKnowingEye.bottles.slice(0, 3), old.bottles);
    assert.equal(resolveAllKnowingEyeOriginals(s)!.characteristics[0]!.holder, 'PLAYER'); assert.equal(validateAllKnowingEyeState(s), true);
  }, 60_000);
  it('partial fresh labour costs900 and zero-action exit retains the new carrier without a refund', () => {
    const s = threeFailures(), cash = s.cash;
    recover(s); for (let n = 0; n < 4; n++) apply(s, { type: 'POTION_WORK', bottleId: bottleId(4) });
    apply(s, { type: 'BUY_POTION', bottleId: bottleId(4) }); assert.equal(s.cash, cash - 120 - 900);
    // An explicit component gap sets the last action; it is not a reward or natural receipt.
    s.revision += 2; s.actionsRemaining = 1; s.health = 100; s.mind = 100;
    apply(s, { type: 'PREPARE_PROMOTION' }); assert.equal(s.actionsRemaining, 0); assert.equal(hasAllKnowingEyeLock(s), true);
    const paid = s.cash, body = [s.health, s.mind, s.spirituality], random = { ...s.random };
    apply(s, { type: 'LEAVE_PREPARATION' });
    assert.equal(hasAllKnowingEyeLock(s), false); assert.equal(s.cash, paid); assert.equal(s.actionsRemaining, 0);
    assert.deepEqual([s.health, s.mind, s.spirituality], body); assert.deepEqual(s.random, random); assert.equal(s.allKnowingEye.bottles[3]!.status, 'PLAYER');
    assert.match(allKnowingEyeAcquisitionBlock(s, { type: 'CONSUME', bottleId: bottleId(4), confirmed: true })!, /150/);
  }, 60_000);
  it('requires the actual original EXIT, present adult Mara and unchanged accessible originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.wisdomAngel.life.playerLocation = 'TABLE'; },
      (s: SliceState) => { Object.assign(s.wisdomAngel.life.room, { exitOpen: false }); },
      (s: SliceState) => { s.wisdomAngel.life.mara.location = 'TABLE'; },
      (s: SliceState) => { Object.assign(s.wisdomAngel.life.mara, { alive: false }); },
      (s: SliceState) => { Object.assign(s.wisdomAngel.life.mara, { age: 17 }); },
      (s: SliceState) => { s.wisdomAngel.life.papers[0].location = 'PLAYER'; },
      (s: SliceState) => { s.wisdomAngel.life.device.charges = 1; },
      (s: SliceState) => { s.allKnowingEye.life.playerLocation = 'TABLE'; },
    ]) {
      const s = threeFailures(); apply(s, recovery('REQUEST_RECOVERY_V1')); nextComponentWeek(s); mutate(s);
      const before = stableStringify(s); assert.throws(() => apply(s, recovery('RECOVER_CHARACTERISTIC_V1'))); assert.equal(stableStringify(s), before);
    }
  }, 60_000);
  it('blocks missing120/AP, duplicate requests and schema210 without closing ordinary work', () => {
    for (const [schemaVersion, cash, actionsRemaining] of [[210, 120, 1], [211, 119, 1], [211, 120, 0]]) {
      const s = threeFailures(); Object.assign(s, { schemaVersion, cash, actionsRemaining });
      const before = stableStringify(s); assert.throws(() => apply(s, recovery('REQUEST_RECOVERY_V1'))); assert.equal(stableStringify(s), before);
    }
    let s = threeFailures(); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, recovery('REQUEST_RECOVERY_V1')); assert.equal(hasAllKnowingEyeLock(s), false);
    assert.throws(() => apply(s, recovery('REQUEST_RECOVERY_V1', 2)));
    s = step(s, { type: 'ACTION', action: 'WORK' }); assert.ok(s.cash > cash - 120); assert.equal(s.actionsRemaining, ap - 2);
    const actions = allKnowingEyeAcquisitionActions(s); assert.equal(actions.some(a => ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(a.command.type)), false);
    assert.match(projectAllKnowingEye(s).supplies, /900便士或五项新劳动后90便士/);
  }, 60_000);
  it('reads an exact archived fourth-original batch while rejecting live resupply and conservation laundering', () => {
    const s = threeFailures(); appendArchivedSupply(s); const pending = structuredClone(s);
    assert.equal(validateAllKnowingEyeAcquisitionJournal(s), true); assert.equal(validateAllKnowingEyeState(s), true);
    const paid = pending.cash; apply(pending, recovery('REQUEST_RECOVERY_V1'));
    assert.equal(pending.cash, paid - 120); assert.equal(pending.allKnowingEye.bottles.length, 3); assert.equal(validateAllKnowingEyeState(pending), true);
    nextComponentWeek(s); appendArchivedSupply(s, true); const before = stableStringify(s);
    assert.equal(validateAllKnowingEyeAcquisitionJournal(s), true); assert.equal(validateAllKnowingEyeState(s), true);
    assert.equal(resolveAllKnowingEyeOriginalsSnapshot(s.allKnowingEye), null); assert.equal(stableStringify(s), before);
    assert.equal(validateAllKnowingEyeAcquisitionCommand({ type: 'REQUEST_SUPPLY' }), false); assert.equal(validateAllKnowingEyeAcquisitionCommand({ type: 'RECEIVE_SUPPLY' }), false);
    assert.match(allKnowingEyeAcquisitionBlock(s, { type: 'BUY_POTION', bottleId: bottleId(4) })!, /来源总量未解决/);
    assert.notEqual(allKnowingEyeAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1')), null);
  }, 60_000);
  it('requires source identity and deterministic consumption replay before granting the full conservation view', () => {
    const good = threeFailures(); recover(good);
    for (const mutate of [
      (s: SliceState) => { s.character.name = '替换者'; },
      (s: SliceState) => { s.allKnowingEye.sourceHistory!.wisdomAngel.life.mara.travelMetres++; },
      (s: SliceState) => {
        const event = s.allKnowingEye.acquisitionJournal.find(e => e.command.type === 'CONSUME')!;
        const changed = resolveNormalCheck({ ability: 'will', baseAbility: event.before.coreStats.will, difficulty: 30, modifiers: [], roll: event.check!.roll === 80 ? 81 : 80 });
        event.check = changed; s.allKnowingEye.bottles[0]!.outcome = changed.tier;
      },
    ]) { const s = structuredClone(good); mutate(s); assert.equal(resolveAllKnowingEyeOriginals(s), null); }
  }, 60_000);
  it('replays every cost and custody step instead of trusting a single recovery label', () => {
    const s = threeFailures(); recover(s); const good = structuredClone(s.allKnowingEye);
    const mutations: ((x: Snapshot) => void)[] = [
      x => { x.acquisitionJournal[0]!.after.cash++; },
      x => { delete x.acquisitionJournal.at(-1)!.recoverySite; },
      x => { x.acquisitionJournal.at(-1)!.recoverySite!.permission.revision--; },
      x => { x.acquisitionJournal.at(-1)!.recoverySite!.permission.purpose = 'INVESTIGATE'; },
      x => { x.acquisitionJournal.at(-1)!.recoverySite!.originals.mara.location = 'TABLE'; },
      x => { x.acquisitionJournal.at(-1)!.recoverySite!.originals.clockSeconds++; },
      x => { x.acquisitionJournal.at(-1)!.recoverySite!.custodyAfter = 'FAILED_REMNANT'; },
      x => { x.acquisitionJournal.at(-1)!.cursorAfter++; },
      x => { x.acquisitionJournal.at(-1)!.after.actions++; },
      x => { x.bottles[3]!.recovery!.sourceReceiptRevision++; },
      x => { x.bottles[3]!.recovery!.sourceBottleId = bottleId(2); },
      x => { x.bottles[3]!.recovery!.characteristicId = `${bottleId(4)}:characteristic`; },
      x => { x.bottles[3]!.recovery!.originalBottleId = bottleId(2); },
      x => { Object.assign(x.bottles[3]!.recovery!, { custodian: '伪造保管人' }); },
      x => { x.bottles[3]!.labourSteps = 5; },
      x => { delete x.bottles[3]!.recovery; },
      x => { x.bottles[3]!.status = 'PLAYER'; x.bottles[3]!.acquiredWeek = s.week; },
      x => { x.acquisitionJournal.splice(x.acquisitionJournal.length - 2, 1); },
      x => { Object.assign(x.acquisitionJournal[0]!.actor, { proof: 'trusted' }); },
    ];
    for (const mutate of mutations) { const bad = structuredClone(good); mutate(bad); assert.equal(resolveAllKnowingEyeOriginalsSnapshot(bad), null); }
    assert.equal(resolveAllKnowingEyeOriginalsSnapshot(good)!.characteristics.length, 3);
    const duplicate = structuredClone(good); duplicate.bottles.push({ ...structuredClone(duplicate.bottles[3]!), id: bottleId(5) });
    assert.equal(resolveAllKnowingEyeOriginalsSnapshot(duplicate), null);
    const oldSchema = structuredClone(s); oldSchema.schemaVersion = 210; assert.equal(validateAllKnowingEyeState(oldSchema), false);
    assert.equal(validateAllKnowingEyeAcquisitionCommand({ ...recovery('REQUEST_RECOVERY_V1'), originalBottleId: bottleId(2) }), false);
    const empty = createAllKnowingEyeState(); assert.deepEqual(resolveAllKnowingEyeOriginalsSnapshot(empty)!.characteristics.map(c => c.holder), ['SUPPLIER', 'SUPPLIER', 'SUPPLIER']);
    empty.bottles[0]!.status = 'PLAYER'; empty.bottles[0]!.acquiredWeek = 126; assert.equal(resolveAllKnowingEyeOriginalsSnapshot(empty), null);
  }, 60_000);
});
