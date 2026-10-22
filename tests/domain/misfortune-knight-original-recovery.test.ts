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
  applyMisfortuneKnightAcquisition, createMisfortuneKnightState, hasMisfortuneKnightLock,
  misfortuneKnightAcquisitionActions, misfortuneKnightAcquisitionBlock, projectMisfortuneKnight,
  resolveMisfortuneKnightOriginalCharacteristics, resolveMisfortuneKnightOriginalCharacteristicsSnapshot,
  validateMisfortuneKnightAcquisitionCommand, validateMisfortuneKnightAcquisitionJournal, validateMisfortuneKnightState,
} from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_GUIDE, MISFORTUNE_KNIGHT_RECOVERY_SCHEMA_VERSION, MISFORTUNE_KNIGHT_RECOVERY_SITE_ID } from '../../src/domain/misfortune-knight/content.js';
import { MISFORTUNE_KNIGHT_PREPARATION_IDS, type MisfortuneKnightAcquisitionBudget, type MisfortuneKnightAcquisitionCommand, type MisfortuneKnightAcquisitionEvent, type MisfortuneKnightState } from '../../src/domain/misfortune-knight/types.js';
import { directedInitial2, recoverResources, step } from './misfortune-knight-directed-helper.js';

type Snapshot = Pick<MisfortuneKnightState, 'bottles' | 'resupply' | 'acquisitionJournal'>;
const bottleId = (n: number) => `misfortune-knight-potion-${n}`;
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): MisfortuneKnightAcquisitionCommand => ({ type, bottleId: bottleId(n) });
const apply = (s: SliceState, command: MisfortuneKnightAcquisitionCommand): void => {
  applyMisfortuneKnightAcquisition(s, command, { note() {}, roll() { throw new Error('No auxiliary recovery draw'); }, check(ability, difficulty) {
    const random = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
    const check = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
    s.random.cursor = random.cursor; return check;
  } });
  s.revision++;
};
/** Explicit component-only pre-guidance cursor/budget input. Never modify the seed
 * or a recorded outcome, never call this from a natural run. */
function component(kinds: PublicResolutionTier[]): SliceState {
  const s = directedInitial2(); s.schemaVersion = MISFORTUNE_KNIGHT_RECOVERY_SCHEMA_VERSION;
  assert.equal(s.misfortuneKnight.acquisitionJournal.length, 0);
  const first = s.random.cursor; let chosen: number | null = null;
  for (let cursor = first; cursor < first + 65536; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (kinds.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) }).tier === tier)) { chosen = cursor; break; }
  }
  assert.notEqual(chosen, null, 'A declared pre-guidance component cursor must exist'); s.random.cursor = chosen!;
  apply(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId });
  return s;
}
function consume(s: SliceState, n: number): void {
  if (s.misfortuneKnight.bottles[n - 1]!.status === 'SUPPLIER') apply(s, { type: 'BUY_POTION', bottleId: bottleId(n) });
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
function budget(s: SliceState): MisfortuneKnightAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution,
    gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats },
    mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
/** Explicit archived component generator, not a public runtime bypass. The old
 * wire commands and all original costs are retained solely to test read replay. */
function appendArchivedSupply(s: SliceState, receive = false): void {
  const before = budget(s), revision = s.revision, state = s.misfortuneKnight;
  const command: MisfortuneKnightAcquisitionCommand = { type: receive ? 'RECEIVE_SUPPLY' : 'REQUEST_SUPPLY' };
  const actor = { ...state.acquisitionJournal[0]!.actor, sourceHistoryDigest: null };
  if (!receive) { s.actionsRemaining--; s.cash -= 100; state.resupply.requestedWeek = s.week; }
  else {
    const first = state.bottles.length + 1;
    for (let offset = 0; offset < 3; offset++) {
      const n = first + offset;
      state.bottles.push({ ...structuredClone(createMisfortuneKnightState().bottles[0]!), id: bottleId(n), stockedWeek: s.week,
        source: `${MISFORTUNE_KNIGHT_GUIDE}第${Math.ceil(n / 3)}批、第${s.week}周实际到货的序列1厄难骑士成品，独立封存编号${bottleId(n)}。本瓶须另行取得并独立耗用。` });
    }
    state.resupply.deliveries++; state.resupply.requestedWeek = null;
  }
  const event: MisfortuneKnightAcquisitionEvent = { week: s.week, date: structuredClone(s.date), revision, command, actor,
    before, after: budget(s), cursorBefore: s.random.cursor, cursorAfter: s.random.cursor, randomBefore: null, randomAfter: null, check: null };
  state.acquisitionJournal.push(event); s.revision++;
}

describe('Misfortune Knight stage213 bounded original recovery candidate', () => {
  it('pins untouched191 raw source and its actual1/2 failure,3 success receipts', () => {
    const path = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json', bytes = readFileSync(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee');
    const s = JSON.parse(bytes.toString()) as SliceState, before = stableStringify(s);
    assert.deepEqual([s.revision, s.week, s.status, s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining], [680, 158, 'ACTIVE', 100, 97, 112, 400, 3]);
    assert.deepEqual(s.misfortuneKnight.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => [e.week, e.revision, e.check!.tier]), [[132, 555, 'FAILURE'], [141, 584, 'FAILURE'], [151, 616, 'SUCCESS']]);
    const resolved = resolveMisfortuneKnightOriginalCharacteristics(s)!;
    assert.deepEqual(resolved.characteristics.map(c => c.holder), ['FAILED_REMAINS', 'FAILED_REMAINS', 'EMBODIED']);
    assert.equal(resolved.embodiedOriginalBottleId, bottleId(3));
    assert.equal(misfortuneKnightAcquisitionActions(s).length, 0);
    assert.notEqual(misfortuneKnightAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1')), null);
    assert.equal(stableStringify(s), before); assert.equal(readFileSync(path).compare(bytes), 0);
  });
  for (const n of [1, 2, 3]) for (const holder of ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS'] as const) it(`keeps original${n} embodied and other originals in their actual ${holder} custody`, () => {
    let s = component(holder === 'FAILED_REMAINS' ? ['FAILURE', 'FAILURE', 'SUCCESS'] : ['SUCCESS']);
    const external = [1, 2, 3].filter(id => id !== n);
    for (const id of external) {
      if (holder === 'PLAYER') apply(s, { type: 'BUY_POTION', bottleId: bottleId(id) });
      else if (holder === 'FAILED_REMAINS') { s = recoverResources(s); consume(s, id); }
    }
    s = recoverResources(s); consume(s, n);
    const before = stableStringify(s), result = resolveMisfortuneKnightOriginalCharacteristics(s)!;
    assert.equal(result.characteristics.length, 3); assert.equal(result.embodiedOriginalBottleId, bottleId(n)); assert.equal(result.embodiedBottleId, bottleId(n));
    for (const entry of result.characteristics) assert.equal(entry.holder, entry.originalBottleId === bottleId(n) ? 'EMBODIED' : holder);
    assert.equal(new Set(result.characteristics.map(entry => entry.characteristicId)).size, 3);
    assert.equal(validateMisfortuneKnightState(s), true); assert.equal(stableStringify(s), before);
  }, 60_000);
  for (const n of [1, 2, 3]) it(`recovery-success remains original${n}, after a second genuine failed carrier`, () => {
    let s = threeFailures(['FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    const originals = structuredClone(s.misfortuneKnight.bottles), originalJournal = structuredClone(s.misfortuneKnight.acquisitionJournal);
    recover(s, n); s = recoverResources(s); consume(s, 4);
    assert.equal(s.misfortuneKnight.bottles[3]!.outcome, 'FAILURE');
    assert.notEqual(misfortuneKnightAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1', n)), null);
    recover(s, 4); s = recoverResources(s); consume(s, 5);
    const result = resolveMisfortuneKnightOriginalCharacteristics(s)!;
    assert.equal(result.embodiedOriginalBottleId, bottleId(n)); assert.equal(result.embodiedBottleId, bottleId(5)); assert.equal(result.characteristics.length, 3);
    assert.deepEqual(s.misfortuneKnight.bottles.slice(0, 3), originals);
    assert.deepEqual(s.misfortuneKnight.acquisitionJournal.slice(0, originalJournal.length), originalJournal);
    assert.equal(s.misfortuneKnight.bottles[4]!.recovery!.sourceBottleId, bottleId(4));
    assert.equal(s.misfortuneKnight.bottles[4]!.recovery!.characteristicId, `${bottleId(n)}:characteristic`);
    assert.equal(validateMisfortuneKnightState(s), true);
  }, 60_000);
  it('charges120 and1AP, binds the actual failed receipt, waits another week and charges fresh90 after five new jobs', () => {
    const s = threeFailures(), old = structuredClone(s.misfortuneKnight), cash = s.cash, ap = s.actionsRemaining, random = { ...s.random };
    apply(s, recovery('REQUEST_RECOVERY_V1'));
    const pending = s.misfortuneKnight.resupply.recovery!, source = old.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === bottleId(1))!;
    assert.deepEqual([s.cash, s.actionsRemaining], [cash - 120, ap - 1]);
    assert.equal(pending.sourceReceiptRevision, source.revision); assert.equal(pending.siteId, MISFORTUNE_KNIGHT_RECOVERY_SITE_ID); assert.equal(pending.custodian, MISFORTUNE_KNIGHT_GUIDE);
    assert.match(misfortuneKnightAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))!, /真实周/);
    assert.notEqual(misfortuneKnightAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1', 2)), null);
    nextComponentWeek(s); apply(s, recovery('RECOVER_CHARACTERISTIC_V1'));
    assert.equal(old.bottles.every(b => b.labourSteps === 5), true);
    assert.equal(s.misfortuneKnight.bottles[3]!.labourSteps, 0);
    assert.equal(resolveMisfortuneKnightOriginalCharacteristics(s)!.characteristics[0]!.holder, 'SUPPLIER');
    for (let n = 0; n < 5; n++) apply(s, { type: 'POTION_WORK', bottleId: bottleId(4) });
    apply(s, { type: 'BUY_POTION', bottleId: bottleId(4) });
    assert.deepEqual([s.cash, s.actionsRemaining], [cash - 120 - 90, ap - 7]);
    assert.deepEqual(s.random, random); assert.deepEqual(s.misfortuneKnight.bottles.slice(0, 3), old.bottles);
    assert.equal(resolveMisfortuneKnightOriginalCharacteristics(s)!.characteristics[0]!.holder, 'PLAYER'); assert.equal(validateMisfortuneKnightState(s), true);
  }, 60_000);
  it('partial fresh labour costs900 and zero-action exit retains the new carrier without a refund', () => {
    const s = threeFailures(), cash = s.cash;
    recover(s); for (let n = 0; n < 4; n++) apply(s, { type: 'POTION_WORK', bottleId: bottleId(4) });
    apply(s, { type: 'BUY_POTION', bottleId: bottleId(4) }); assert.equal(s.cash, cash - 120 - 900);
    // An explicit component gap sets the last action; it is not a reward or natural receipt.
    s.revision += 2; s.actionsRemaining = 1; s.health = 100; s.mind = 100;
    apply(s, { type: 'PREPARE_PROMOTION' }); assert.equal(s.actionsRemaining, 0); assert.equal(hasMisfortuneKnightLock(s), true);
    const paid = s.cash, body = [s.health, s.mind, s.spirituality], random = { ...s.random };
    apply(s, { type: 'LEAVE_PREPARATION' });
    assert.equal(hasMisfortuneKnightLock(s), false); assert.equal(s.cash, paid); assert.equal(s.actionsRemaining, 0);
    assert.deepEqual([s.health, s.mind, s.spirituality], body); assert.deepEqual(s.random, random); assert.equal(s.misfortuneKnight.bottles[3]!.status, 'PLAYER');
    assert.match(misfortuneKnightAcquisitionBlock(s, { type: 'CONSUME', bottleId: bottleId(4), confirmed: true })!, /150/);
  }, 60_000);
  it('does not replace actual location or blocked door with frozen source coordinates', () => {
    for (const mutate of [
      (s: SliceState) => { s.concealmentServant.life.playerLocation = 'ROOM'; },
      (s: SliceState) => { s.concealmentServant.life.room.doorBlocked = true; },
      (s: SliceState) => { s.concealmentServant.life.room.concealed = true; },
      (s: SliceState) => { s.concealmentServant.life.anchorLight.on = true; },
      (s: SliceState) => { s.misfortuneKnight.life.practice.playerLocation = 'ROOM'; },
    ]) {
      const s = threeFailures(); apply(s, recovery('REQUEST_RECOVERY_V1')); nextComponentWeek(s); mutate(s);
      const before = stableStringify(s); assert.throws(() => apply(s, recovery('RECOVER_CHARACTERISTIC_V1'))); assert.equal(stableStringify(s), before);
    }
  }, 60_000);
  it('blocks missing120/AP, duplicate requests and schema209 without closing ordinary work', () => {
    for (const [schemaVersion, cash, actionsRemaining] of [[209, 120, 1], [210, 119, 1], [210, 120, 0]]) {
      const s = threeFailures(); Object.assign(s, { schemaVersion, cash, actionsRemaining });
      const before = stableStringify(s); assert.throws(() => apply(s, recovery('REQUEST_RECOVERY_V1'))); assert.equal(stableStringify(s), before);
    }
    let s = threeFailures(); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, recovery('REQUEST_RECOVERY_V1')); assert.equal(hasMisfortuneKnightLock(s), false);
    assert.throws(() => apply(s, recovery('REQUEST_RECOVERY_V1', 2)));
    s = step(s, { type: 'ACTION', action: 'WORK' }); assert.ok(s.cash > cash - 120); assert.equal(s.actionsRemaining, ap - 2);
    const actions = misfortuneKnightAcquisitionActions(s); assert.equal(actions.some(a => ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(a.command.type)), false);
    assert.match(projectMisfortuneKnight(s).supplies, /900便士或五项新劳动后90便士/);
  }, 60_000);
  it('reads an exact archived fourth-original batch while rejecting live resupply and conservation laundering', () => {
    const s = threeFailures(); appendArchivedSupply(s); const pending = structuredClone(s);
    assert.equal(validateMisfortuneKnightAcquisitionJournal(s), true); assert.equal(validateMisfortuneKnightState(s), true);
    const paid = pending.cash; apply(pending, recovery('REQUEST_RECOVERY_V1'));
    assert.equal(pending.cash, paid - 120); assert.equal(pending.misfortuneKnight.bottles.length, 3); assert.equal(validateMisfortuneKnightState(pending), true);
    nextComponentWeek(s); appendArchivedSupply(s, true); const before = stableStringify(s);
    assert.equal(validateMisfortuneKnightAcquisitionJournal(s), true); assert.equal(validateMisfortuneKnightState(s), true);
    assert.equal(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(s.misfortuneKnight), null); assert.equal(stableStringify(s), before);
    assert.equal(validateMisfortuneKnightAcquisitionCommand({ type: 'REQUEST_SUPPLY' }), false); assert.equal(validateMisfortuneKnightAcquisitionCommand({ type: 'RECEIVE_SUPPLY' }), false);
    assert.match(misfortuneKnightAcquisitionBlock(s, { type: 'BUY_POTION', bottleId: bottleId(4) })!, /来源总量未解决/);
    assert.notEqual(misfortuneKnightAcquisitionBlock(s, recovery('REQUEST_RECOVERY_V1')), null);
  }, 60_000);
  it('requires source identity and deterministic consumption replay before granting the full conservation view', () => {
    const good = threeFailures(); recover(good);
    for (const mutate of [
      (s: SliceState) => { s.character.name = '替换者'; },
      (s: SliceState) => { s.misfortuneKnight.sourceHistory!.concealmentServant.life.box.travelMetres++; },
      (s: SliceState) => {
        const event = s.misfortuneKnight.acquisitionJournal.find(e => e.command.type === 'CONSUME')!;
        const changed = resolveNormalCheck({ ability: 'will', baseAbility: event.before.coreStats.will, difficulty: 30, modifiers: [], roll: event.check!.roll === 80 ? 81 : 80 });
        event.check = changed; s.misfortuneKnight.bottles[0]!.outcome = changed.tier;
      },
    ]) { const s = structuredClone(good); mutate(s); assert.equal(resolveMisfortuneKnightOriginalCharacteristics(s), null); }
  }, 60_000);
  it('replays every cost and custody step instead of trusting a single recovery label', () => {
    const s = threeFailures(); recover(s); const good = structuredClone(s.misfortuneKnight);
    const mutations: ((x: Snapshot) => void)[] = [
      x => { x.acquisitionJournal[0]!.after.cash++; },
      x => { x.acquisitionJournal.at(-1)!.cursorAfter++; },
      x => { x.acquisitionJournal.at(-1)!.after.actions++; },
      x => { x.bottles[3]!.recovery!.sourceReceiptRevision++; },
      x => { x.bottles[3]!.recovery!.sourceBottleId = bottleId(2); },
      x => { x.bottles[3]!.recovery!.characteristicId = `${bottleId(4)}:characteristic`; },
      x => { x.bottles[3]!.recovery!.originalBottleId = bottleId(2); },
      x => { x.bottles[3]!.recovery!.custodian = '伪造保管人'; },
      x => { x.bottles[3]!.labourSteps = 5; },
      x => { delete x.bottles[3]!.recovery; },
      x => { x.bottles[3]!.status = 'PLAYER'; x.bottles[3]!.acquiredWeek = s.week; },
      x => { x.acquisitionJournal.splice(x.acquisitionJournal.length - 2, 1); },
      x => { Object.assign(x.acquisitionJournal[0]!.actor, { proof: 'trusted' }); },
    ];
    for (const mutate of mutations) { const bad = structuredClone(good); mutate(bad); assert.equal(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(bad), null); }
    assert.equal(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(good)!.characteristics.length, 3);
    const empty = createMisfortuneKnightState(); assert.deepEqual(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(empty)!.characteristics.map(c => c.holder), ['SUPPLIER', 'SUPPLIER', 'SUPPLIER']);
    empty.bottles[0]!.status = 'PLAYER'; empty.bottles[0]!.acquiredWeek = 126; assert.equal(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(empty), null);
  }, 60_000);
});
