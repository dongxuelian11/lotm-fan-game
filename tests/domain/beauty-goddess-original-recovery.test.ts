import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import {
  applyBeautyGoddessAcquisition, beautyGoddessAcquisitionBlock, beautyGoddessAcquisitionActions,
  createBeautyGoddessState, hasBeautyGoddessLock, projectBeautyGoddess,
  resolveBeautyGoddessOriginalCharacteristicsSnapshot, resolveBeautyGoddessOriginalCharacteristics,
  validateBeautyGoddessAcquisitionCommand, validateBeautyGoddessAcquisitionJournal, validateBeautyGoddessState,
} from '../../src/domain/beauty-goddess/index.js';
import { BEAUTY_GODDESS_PRICES } from '../../src/domain/beauty-goddess/content.js';
import type { BeautyGoddessState, BeautyGoddessAcquisitionCommand } from '../../src/domain/beauty-goddess/types.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';

type Snapshot = Pick<BeautyGoddessState, 'bottles' | 'resupply' | 'acquisitionJournal'>;
const sourcePath = 'tests/fixtures/beauty-goddess-v01900/script-blocker-first.json';
const sourceSha = '195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb';
const readComponent = (name: string): Snapshot => JSON.parse(readFileSync(`tests/fixtures/beauty-recovery-components/${name}.json`, 'utf8')).snapshot;
const original = (): SliceState => JSON.parse(readFileSync(sourcePath, 'utf8')).final;
const command = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): BeautyGoddessAcquisitionCommand => ({ type, bottleId: `beauty-goddess-potion-${n}` });
const applyNoDraw = (s: SliceState, c: BeautyGoddessAcquisitionCommand) => {
  applyBeautyGoddessAcquisition(s, c, { note() {}, check() { throw new Error('Recovery must not draw'); }, roll() { throw new Error('Recovery must not draw'); } }); s.revision++;
};
const fundedComponent = () => {
  const s = original(); s.schemaVersion = 209; s.cash = 100000; s.actionsRemaining = 100; s.revision += 2;
  return s; // Explicit initial component budget; never a purported natural source or an acquisition refund.
};

describe('Beauty Goddess stage212 same-original recovery integration', () => {
  it('pins the exact full670 source and actual44 percent without touching its bytes', () => {
    const bytes = readFileSync(sourcePath); assert.equal(createHash('sha256').update(bytes).digest('hex'), sourceSha);
    const fixture = JSON.parse(bytes.toString()), s = fixture.final as SliceState;
    assert.equal(fixture.commands.length, 670); assert.deepEqual([s.revision, s.week, s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining, s.seer.pollution], [671, 160, 85, 75, 120, 14, 1, 30]);
    assert.equal(s.character.gender, 'FEMALE'); assert.equal(s.beautyGoddess.transformation.decision, 'ACCEPTED');
    assert.equal(Object.values(s.progression.mastery).filter(n => n === 0).length, 7);
    assert.deepEqual(s.beautyGoddess.acquisitionJournal.filter(e => e.check).map(e => [e.check!.roll, e.check!.chance, e.check!.tier]), [[48, 44, 'FAILURE'], [67, 44, 'FAILURE'], [86, 44, 'FAILURE']]);
    assert.equal(validateBeautyGoddessState(s), true);
    assert.deepEqual(resolveBeautyGoddessOriginalCharacteristics(s)?.characteristics.map(c => c.holder), ['FAILED_REMAINS', 'FAILED_REMAINS', 'FAILED_REMAINS']);
    assert.equal(createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), sourceSha);
  });
  for (const n of [1, 2, 3]) it(`supports original${n} success with two distinct paid unused originals`, () => {
    const snapshot = readComponent(`success-original-${n}`), bytes = stableStringify(snapshot);
    const resolved = resolveBeautyGoddessOriginalCharacteristicsSnapshot(snapshot)!;
    assert.equal(resolved.embodiedOriginalBottleId, `beauty-goddess-potion-${n}`); assert.equal(resolved.characteristics.length, 3);
    assert.equal(resolved.characteristics.filter(c => c.holder === 'PLAYER').length, 2);
    assert.equal(new Set(resolved.characteristics.map(c => c.characteristicId)).size, 3);
    assert.equal(stableStringify(snapshot), bytes);
  });
  it('reuses original1 after two real subsequent failures, without changing old bottles or receipts', () => {
    const original = readComponent('exact-three-failed-originals'), continued = readComponent('recovery-continuation');
    assert.deepEqual(continued.bottles.slice(0, 3), original.bottles);
    assert.deepEqual(continued.acquisitionJournal.slice(0, original.acquisitionJournal.length), original.acquisitionJournal);
    assert.deepEqual(continued.bottles.slice(3).map(b => [b.recovery?.originalBottleId, b.recovery?.sourceBottleId, b.recovery?.characteristicId]), [
      ['beauty-goddess-potion-1', 'beauty-goddess-potion-1', 'beauty-goddess-potion-1:characteristic'],
      ['beauty-goddess-potion-1', 'beauty-goddess-potion-4', 'beauty-goddess-potion-1:characteristic'],
    ]);
    const draws = continued.acquisitionJournal.filter(e => e.command.type === 'CONSUME').slice(-2);
    assert.deepEqual(draws.map(e => [e.randomBefore, e.randomAfter, e.check?.roll, e.check?.tier]), [[318, 319, 57, 'FAILURE'], [319, 320, 76, 'FAILURE']]);
    const resolved = resolveBeautyGoddessOriginalCharacteristicsSnapshot(continued)!;
    assert.equal(resolved.characteristics.length, 3); assert.equal(resolved.characteristics[0]!.latestBottleId, 'beauty-goddess-potion-5');
    assert.equal(resolved.characteristics[0]!.holder, 'FAILED_REMAINS');
  });
  it('keeps old seven-failure/eighth-success history readable, but never maps nine independent originals to three', () => {
    const s = JSON.parse(readFileSync('tests/fixtures/beauty-goddess-v01900/natural.json', 'utf8')).final as SliceState;
    const bytes = stableStringify(s); assert.equal(s.beautyGoddess.bottles.length, 9);
    assert.equal(validateBeautyGoddessAcquisitionJournal(s), true); assert.equal(validateBeautyGoddessState(s), true);
    assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s.beautyGoddess), null); assert.equal(stableStringify(s), bytes);
    assert.equal(validateBeautyGoddessAcquisitionCommand({ type: 'REQUEST_SUPPLY' }), false);
    assert.equal(validateBeautyGoddessAcquisitionCommand({ type: 'RECEIVE_SUPPLY' }), false);
  });
  it('rejects fake lineage, cost, random cursor, fourth original and re-used failed-source evidence', () => {
    const mutators: ((s: Snapshot) => void)[] = [
      s => { s.acquisitionJournal[0]!.after.cash++; },
      s => { s.acquisitionJournal.at(-1)!.cursorAfter++; },
      s => { s.bottles[3]!.recovery!.originalBottleId = 'beauty-goddess-potion-2'; },
      s => { s.bottles[4]!.recovery!.sourceBottleId = 'beauty-goddess-potion-1'; },
      s => { s.bottles[3]!.recovery!.characteristicId = 'beauty-goddess-potion-4:characteristic'; },
      s => { s.bottles[3]!.labourSteps = 5; },
      s => { delete s.bottles[3]!.recovery; },
      s => { Object.assign(s.acquisitionJournal[0]!.actor, { audiencePromotionWeek: 1 }); },
    ];
    for (const mutate of mutators) { const s = readComponent('recovery-continuation'); mutate(s); assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s), null); }
  });
  it('shows paid investigation as blocked by cash14, with no new gender confirmation or independent supply action', () => {
    const s = original(); s.schemaVersion = 209;
    assert.match(beautyGoddessAcquisitionBlock(s, command('REQUEST_RECOVERY_V1'))!, /120/);
    const actions = beautyGoddessAcquisitionActions(s);
    assert.equal(actions.filter(a => a.command.type === 'REQUEST_RECOVERY_V1').length, 3);
    assert.equal(actions.some(a => ['CONFIRM_TRANSFORMATION', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(a.command.type)), false);
    assert.equal(validateBeautyGoddessAcquisitionCommand({ ...command('REQUEST_RECOVERY_V1'), free: true }), false);
    assert.equal(validateBeautyGoddessAcquisitionCommand(command('REQUEST_RECOVERY_V1')), true);
  });
  it('requires a paid specific investigation, later real week, new carrier labour and new90 balance', () => {
    const s = fundedComponent(), before = structuredClone(s.beautyGoddess), seed = { ...s.random }, oldCash = s.cash;
    applyNoDraw(s, command('REQUEST_RECOVERY_V1'));
    assert.equal(s.cash, oldCash - BEAUTY_GODDESS_PRICES.recovery); assert.equal(s.actionsRemaining, 99);
    assert.match(beautyGoddessAcquisitionBlock(s, command('RECOVER_CHARACTERISTIC_V1'))!, /真实周/);
    assert.notEqual(beautyGoddessAcquisitionBlock(s, command('RECOVER_CHARACTERISTIC_V1', 2)), null);
    s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    applyNoDraw(s, command('RECOVER_CHARACTERISTIC_V1'));
    assert.deepEqual(s.beautyGoddess.bottles.slice(0, 3), before.bottles); assert.equal(s.beautyGoddess.bottles[3]!.labourSteps, 0);
    assert.notEqual(beautyGoddessAcquisitionBlock(s, command('REQUEST_RECOVERY_V1')), null);
    for (let n = 0; n < 5; n++) applyNoDraw(s, { type: 'POTION_WORK', bottleId: 'beauty-goddess-potion-4' });
    applyNoDraw(s, { type: 'BUY_POTION', bottleId: 'beauty-goddess-potion-4' });
    assert.equal(s.cash, oldCash - 120 - 90); assert.equal(s.actionsRemaining, 93); assert.deepEqual(s.random, seed);
    assert.equal(s.beautyGoddess.bottles[3]!.status, 'PLAYER'); assert.equal(validateBeautyGoddessState(s), true);
    assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s.beautyGoddess)!.characteristics[0]!.holder, 'PLAYER');
  });
  it('does not let the consumer reinterpret unpaid supplier custody as a paid unused bottle', () => {
    const s = readComponent('success-original-1');
    const buy = s.acquisitionJournal.find(e => e.command.type === 'BUY_POTION' && e.command.bottleId === 'beauty-goddess-potion-2')!;
    buy.after.cash += 6600;
    assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s), null);
  });

  it('keeps unpurchased initial stock in supplier custody without inventing player inventory', () => {
    const s = createBeautyGoddessState(), before = stableStringify(s);
    const resolved = resolveBeautyGoddessOriginalCharacteristicsSnapshot(s)!;
    assert.deepEqual(resolved.characteristics.map(c => c.holder), ['SUPPLIER', 'SUPPLIER', 'SUPPLIER']);
    assert.equal(resolved.embodiedOriginalBottleId, null); assert.equal(resolved.embodiedBottleId, null);
    assert.equal(stableStringify(s), before);
    s.bottles[0]!.status = 'PLAYER'; s.bottles[0]!.acquiredWeek = 160;
    assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s), null);
  });

  it('rejects old schema, missing cash or action, and duplicate reservations without mutating the source', () => {
    for (const [schemaVersion, cash, actionsRemaining, reason] of [
      [208, 120, 1, /新版本/], [209, 119, 1, /120/], [209, 120, 0, /行动不足/],
    ] as const) {
      const s = fundedComponent(); Object.assign(s, { schemaVersion, cash, actionsRemaining });
      const before = stableStringify(s);
      assert.match(beautyGoddessAcquisitionBlock(s, command('REQUEST_RECOVERY_V1'))!, reason);
      assert.throws(() => applyNoDraw(s, command('REQUEST_RECOVERY_V1')), reason);
      assert.equal(stableStringify(s), before);
    }
    const s = fundedComponent(); s.cash = 120; s.actionsRemaining = 1;
    applyNoDraw(s, command('REQUEST_RECOVERY_V1'));
    assert.deepEqual([s.cash, s.actionsRemaining], [0, 0]);
    assert.equal(s.beautyGoddess.bottles.length, 3);
    const reserved = stableStringify(s);
    assert.throws(() => applyNoDraw(s, command('REQUEST_RECOVERY_V1', 2)));
    assert.equal(stableStringify(s), reserved);
    assert.equal(validateBeautyGoddessState(s), true);
  });

  it('charges the full900 for new ordinary drugs after partial fresh labour and never credits old jobs', () => {
    const s = fundedComponent(), oldBottles = structuredClone(s.beautyGoddess.bottles);
    assert.equal(oldBottles.every(b => b.labourSteps === 5), true);
    applyNoDraw(s, command('REQUEST_RECOVERY_V1'));
    s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    applyNoDraw(s, command('RECOVER_CHARACTERISTIC_V1'));
    const bottleId = 'beauty-goddess-potion-4';
    assert.equal(s.beautyGoddess.bottles[3]!.labourSteps, 0);
    assert.equal(resolveBeautyGoddessOriginalCharacteristicsSnapshot(s.beautyGoddess)!.characteristics[0]!.holder, 'SUPPLIER');
    for (let n = 0; n < 4; n++) applyNoDraw(s, { type: 'POTION_WORK', bottleId });
    const poor = structuredClone(s); poor.cash = 899;
    assert.match(beautyGoddessAcquisitionBlock(poor, { type: 'BUY_POTION', bottleId })!, /900/);
    const before = s.cash, actionsBefore = s.actionsRemaining;
    applyNoDraw(s, { type: 'BUY_POTION', bottleId });
    assert.equal(s.cash, before - 900); assert.equal(s.actionsRemaining, actionsBefore);
    assert.equal(s.beautyGoddess.bottles[3]!.labourSteps, 4);
    assert.deepEqual(s.beautyGoddess.bottles.slice(0, 3), oldBottles);
    assert.equal(validateBeautyGoddessState(s), true);
  });

  it('projects exact recovery costs, missing resources and44 percent without asking accepted female consent again', () => {
    const s = original(); s.schemaVersion = 209;
    const before = stableStringify(s), view = projectBeautyGoddess(s);
    assert.equal(view.resources!.cash, '14便士'); assert.equal(view.resources!.actionsRemaining, 1);
    assert.deepEqual(view.bottles.map(b => b.chance), [44, 44, 44]);
    assert.match(view.supplies, /120便士、1行动/); assert.match(view.supplies, /900便士/);
    assert.match(view.supplies, /五项新劳动后90便士/); assert.match(view.supplies, /150便士/);
    const requests = view.actions.filter(a => a.command.type === 'REQUEST_RECOVERY_V1');
    assert.equal(requests.length, 3);
    for (const a of requests) { assert.equal(a.enabled, false); assert.match(a.cost, /1行动 · 120便士/); assert.match(a.reason!, /120便士/); }
    assert.equal(view.actions.some(a => a.command.type === 'CONFIRM_TRANSFORMATION'), false);
    assert.equal(view.insideCase, false); assert.equal(hasBeautyGoddessLock(s), false);
    assert.equal(stableStringify(s), before);
  });

  it('allows zero-action ordinary exit after paid recovery preparation without refund, restoration or renewed consent', () => {
    const s = fundedComponent(); s.actionsRemaining = 3;
    const gender = structuredClone(s.beautyGoddess.transformation), body = [s.health, s.mind, s.spirituality], random = { ...s.random };
    applyNoDraw(s, command('REQUEST_RECOVERY_V1'));
    s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    applyNoDraw(s, command('RECOVER_CHARACTERISTIC_V1'));
    const bottleId = 'beauty-goddess-potion-4';
    applyNoDraw(s, { type: 'BUY_POTION', bottleId });
    applyNoDraw(s, { type: 'PREPARE_PROMOTION' });
    assert.equal(s.actionsRemaining, 0); assert.equal(s.cash, 100000 - 120 - 900 - 150);
    assert.equal(hasBeautyGoddessLock(s), true);
    const exit = beautyGoddessAcquisitionActions(s).find(a => a.command.type === 'LEAVE_PREPARATION')!;
    assert.equal(exit.enabled, true); assert.match(exit.cost, /0行动 · 不退成本/);
    const paid = s.cash;
    applyNoDraw(s, { type: 'LEAVE_PREPARATION' });
    assert.equal(s.cash, paid); assert.equal(s.actionsRemaining, 0); assert.equal(hasBeautyGoddessLock(s), false);
    assert.equal(s.beautyGoddess.preparedWeek, null); assert.equal(s.beautyGoddess.bottles[3]!.status, 'PLAYER');
    assert.deepEqual(s.beautyGoddess.transformation, gender); assert.deepEqual([s.health, s.mind, s.spirituality], body); assert.deepEqual(s.random, random);
    assert.equal(beautyGoddessAcquisitionActions(s).some(a => a.command.type === 'CONFIRM_TRANSFORMATION'), false);
    assert.match(beautyGoddessAcquisitionBlock(s, { type: 'CONSUME', bottleId, confirmed: true })!, /150便士/);
    assert.equal(validateBeautyGoddessState(s), true);
  });
});
