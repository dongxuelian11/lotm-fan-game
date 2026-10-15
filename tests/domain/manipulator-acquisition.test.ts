import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyManipulatorAcquisition, applyManipulatorCommand, createManipulatorState, isManipulatorAcquisitionCommand,
  projectManipulator, validateManipulatorCommand, validateManipulatorState,
} from '../../src/domain/manipulator/index.js';
import { MANIPULATOR_FORMULA, MANIPULATOR_FORMULA_ALTERNATIVES, MANIPULATOR_PRICES } from '../../src/domain/manipulator/content.js';
import { MANIPULATOR_ABILITY_IDS, MANIPULATOR_DONOR_IDS, type ManipulatorAcquisitionCommand } from '../../src/domain/manipulator/types.js';
import { MANIPULATOR_GROUP_IDS, applyManipulatorRitualCommand, canConsumeManipulatorRitual, type ManipulatorRitualCommand } from '../../src/domain/manipulator/ritual.js';

/** Old natural Dreamwalker history is kept intact. Later clocks/resources/rolls are explicit unit fixtures. */
function dreamwalker(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/dreamwalker-v0970/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.manipulator = createManipulatorState(); s.week = Math.max(s.week, s.dreamwalker.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ManipulatorAcquisitionCommand, roll = 1) { const c = context(s, roll); applyManipulatorAcquisition(s, command, c); return c; }
function ritual(s: SliceState, command: ManipulatorRitualCommand, roll = 1) { applyManipulatorRitualCommand(s, command, context(s, roll)); }
function taught(s = dreamwalker()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.manipulator.batches[index]!; apply(s, { type: 'BUY_MATERIALS', batchId: b.id }); return b; }
function tears(s: SliceState, index = 0) { for (const donorId of MANIPULATOR_DONOR_IDS) apply(s, { type: 'COLLECT_TEAR', batchId: s.manipulator.batches[index]!.id, donorId }); }
function brew(s: SliceState, index = 0) { const b = buy(s, index); tears(s, index); apply(s, { type: 'BREW', batchId: b.id }); return s.manipulator.bottles.find(item => item.batchId === b.id)!; }
function gather(s: SliceState) {
  ritual(s, { type: 'BOOK_GATHERING' }); s.week += 1; ritual(s, { type: 'OPEN_GATHERING' });
  for (const groupId of MANIPULATOR_GROUP_IDS) ritual(s, { type: 'ARRIVE_GROUP', groupId });
  ritual(s, { type: 'RESONATE' });
}
function gathered() { const s = taught(); brew(s); gather(s); return s; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.manipulator.bottles[index]!.id, confirmed: true }) as const;
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyManipulatorAcquisition(s, command as ManipulatorAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Manipulator S4 original materials, seven voluntary adult sources and actual current resonance', () => {
  it('creates separate original stock with no preexisting tears or magic bottle and hides before Dreamwalker', () => {
    const s = createSliceRun('manipulator-hidden', sliceDefaultCreationSelection, 'manipulator-hidden');
    expect(validateManipulatorState(s)).toBe(true);
    expect(s.manipulator.batches).toHaveLength(3); expect(s.manipulator.bottles).toEqual([]);
    expect(s.manipulator.batches.every(batch => batch.materials.length === 3 && batch.tears.length === 0 && batch.status === 'SUPPLIER')).toBe(true);
    expect(projectManipulator(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], batches: [], donors: [], bottles: [], abilities: [], actions: [] });
    expect(projectManipulator(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createManipulatorState(); other.batches[0]!.materials[0]!.holder = 'PLAYER'; other.donors['MP4-D1'].willing = false;
    expect(s.manipulator.batches[0]!.materials[0]!.holder).toBe('SUPPLIER'); expect(s.manipulator.donors['MP4-D1'].willing).toBe(true);
  });
  it('charges520 once and exposes exact heart branch, alternatives and no invented water', () => {
    const s = dreamwalker(), old = structuredClone([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99480, 999]);
    expect([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker]).toEqual(old);
    expect(MANIPULATOR_PRICES).toEqual({ guidance: 520, materials: 6500, labourCredit: 5600, gathering: 240 });
    expect(MANIPULATOR_FORMULA).toEqual([{ name: '树人导师的结晶之心', quantity: 1, unit: '颗' }, { name: '老年心灵巨龙的血液', quantity: 80, unit: '毫升' }, { name: '树人导师的金色树叶', quantity: 3, unit: '片' }, { name: '七名不同人类或类人生物在强烈情绪中的泪水', quantity: 7, unit: '人各1滴' }]);
    expect(MANIPULATOR_FORMULA_ALTERNATIVES).toContain('老年心灵巨龙的完整大脑'); expect(MANIPULATOR_FORMULA_ALTERNATIVES).toContain('操纵师非凡特性');
    expect(projectManipulator(s).formulaKnown).toBe(true); expect(projectManipulator(s).formula.some(item => item.name.includes('纯水'))).toBe(false);
    expect(validateManipulatorState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual jobs for this batch only, then900 and still zero donor drops', () => {
    const s = taught(), b = s.manipulator.batches[0]!;
    for (let n = 0; n < 5; n++) apply(s, { type: 'MATERIAL_WORK', batchId: b.id });
    reject(s, { type: 'MATERIAL_WORK', batchId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status, b.acquiredWeek]).toEqual([98580, 994, 'PLAYER', s.week]);
    expect(b.materials.map(item => [item.quantity, item.unit, item.holder])).toEqual([[1, '颗', 'PLAYER'], [80, '毫升', 'PLAYER'], [3, '片', 'PLAYER']]);
    expect(b.tears).toEqual([]); expect(s.manipulator.bottles).toEqual([]); expect(s.manipulator.batches[1]!.labourSteps).toBe(0);
    expect(validateManipulatorState(s)).toBe(true); reject(s, { type: 'BUY_MATERIALS', batchId: b.id }); reject(s, { type: 'BREW', batchId: b.id });
  });
  it('does not partially discount or move labour credit between batches', () => {
    const s = taught(), b = s.manipulator.batches[0]!;
    for (let n = 0; n < 4; n++) apply(s, { type: 'MATERIAL_WORK', batchId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6500);
    s.cash = 6499; reject(s, { type: 'BUY_MATERIALS', batchId: s.manipulator.batches[1]!.id });
  });
  it('visits seven different current consenting adults separately and keeps each source vial', () => {
    const s = taught(), b = buy(s), before = s.actionsRemaining;
    expect(Object.values(s.manipulator.donors).every(d => d.age > 18 && d.willing && !!d.story && !!d.location)).toBe(true);
    for (const [index, donorId] of MANIPULATOR_DONOR_IDS.entries()) {
      apply(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId });
      const drop = b.tears[index]!; expect(drop).toMatchObject({ donorId, batchId: b.id, quantity: 1, unit: '滴', collectedWeek: s.week, consent: true, holder: 'PLAYER' });
      expect(drop.event).toContain(s.manipulator.donors[donorId].location); expect(s.manipulator.donors[donorId].visits).toHaveLength(1);
      expect(validateManipulatorState(s)).toBe(true); reject(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId });
      if (index < 6) reject(s, { type: 'BREW', batchId: b.id });
    }
    expect(before - s.actionsRemaining).toBe(7); expect(new Set(b.tears.map(drop => drop.donorId)).size).toBe(7); expect(new Set(b.tears.map(drop => drop.id)).size).toBe(7);
  });
  it('refuses current dissent, no materials, no action, and donor impersonation without changes', () => {
    const s = taught(), b = s.manipulator.batches[0]!;
    reject(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId: 'MP4-D1' }); buy(s);
    s.manipulator.donors['MP4-D1'].willing = false; reject(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId: 'MP4-D1' });
    expect(validateManipulatorState(s)).toBe(true); s.manipulator.donors['MP4-D1'].willing = true;
    s.actionsRemaining = 0; reject(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId: 'MP4-D1' });
    reject(s, { type: 'COLLECT_TEAR', batchId: b.id, donorId: 'MP4-D8' });
  });
  it('brews once by consuming exactly three original material groups and seven original drops', () => {
    const s = taught(), b = buy(s); tears(s); const ap = s.actionsRemaining;
    const originals = [...b.materials.map(item => item.id), ...b.tears.map(item => item.id)]; apply(s, { type: 'BREW', batchId: b.id });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.manipulator.bottles).toHaveLength(1);
    expect(s.manipulator.bottles[0]).toMatchObject({ id: 'manipulator-potion-1', batchId: b.id, sourceItemIds: originals, status: 'PLAYER', brewedWeek: s.week });
    expect([...b.materials, ...b.tears].every(item => item.holder === 'CONSUMED')).toBe(true); expect(b.status).toBe('BREWED');
    expect(validateManipulatorState(s)).toBe(true); reject(s, { type: 'BREW', batchId: b.id }); reject(s, dose(s));
  });
  it('a second batch needs seven genuinely fresh visits and original drops, never old vials', () => {
    const s = taught(), first = brew(s), firstSources = [...first.sourceItemIds], secondBatch = buy(s, 1);
    reject(s, { type: 'BREW', batchId: secondBatch.id }); tears(s, 1); apply(s, { type: 'BREW', batchId: secondBatch.id });
    const second = s.manipulator.bottles[1]!;
    expect(second.sourceItemIds.some(id => firstSources.includes(id))).toBe(false);
    expect(Object.values(s.manipulator.donors).every(donor => donor.visits.length === 2 && donor.visits[0]!.eventId !== donor.visits[1]!.eventId)).toBe(true);
    expect(s.manipulator.batches[1]!.tears[0]!.event).toContain('第2次'); expect(validateManipulatorState(s)).toBe(true);
  });
  it('requires current real attendance and a separate true confirmation', () => {
    const s = taught(); brew(s); reject(s, dose(s)); ritual(s, { type: 'BOOK_GATHERING' }); reject(s, dose(s));
    s.week += 1; ritual(s, { type: 'OPEN_GATHERING' }); reject(s, dose(s));
    for (const groupId of MANIPULATOR_GROUP_IDS) ritual(s, { type: 'ARRIVE_GROUP', groupId }); reject(s, dose(s)); ritual(s, { type: 'RESONATE' });
    for (const c of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), count: 10000 }]) { expect(validateManipulatorCommand(c)).toBe(false); reject(s, c); }
    expect(canConsumeManipulatorRitual(s)).toBe(true); expect(validateManipulatorState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('applies exact four-tier potion outcome%s with actual consumed sources and one closed event', (roll, tier, mind, health, pollution, sequence) => {
    const s = gathered(), old = structuredClone([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker]), mastery = { ...s.progression.mastery }, core = { ...s.character.coreStats }, ap = s.actionsRemaining;
    const b = s.manipulator.bottles[0]!, event = s.manipulator.ritual.gatherings[0]!; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28); expect([s.mind, s.health, s.seer.pollution, s.progression.sequence, s.actionsRemaining, s.spirituality]).toEqual([mind, health, pollution, sequence, ap, 31]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, ritualId: event.id, ritualWindowWeek: s.week });
    expect(event).toMatchObject({ status: 'CLOSED', closedWeek: s.week, consumedBottleId: b.id }); expect(event.groups.every(group => group.presentCount === 0 && group.location === 'HOME' && group.arrivedCount === 3000)).toBe(true);
    expect(s.manipulator.ritual.playerLocation).toBe('OUTSIDE'); expect(canConsumeManipulatorRitual(s)).toBe(false);
    expect([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker]).toEqual(old);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 4) {
      expect(s.progression.acting).toBe(0); expect(s.manipulator.dreamwalkerActingAtPromotion).toBe(100);
      for (const id of MANIPULATOR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(core[key] + 1);
    } else { expect(s.progression.acting).toBe(100); expect(s.manipulator.promotionWeek).toBeNull(); expect(s.character.coreStats).toEqual(core); }
    expect(validateManipulatorState(s)).toBe(true); reject(s, dose(s));
  });
  it.each(['health', 'mind', 'acting', 'weeks'] as const)('rejects insufficient%s before any potion roll or consumption', field => {
    const s = gathered();
    if (field === 'health') s.health = 20; if (field === 'mind') s.mind = 40; if (field === 'acting') s.progression.acting = 99;
    if (field === 'weeks') s.dreamwalker.promotionWeek = s.week - 11;
    reject(s, dose(s));
  });
  it('supervision clamps only potion costs and never refills current spirituality', () => {
    const s = gathered(); s.health = 21; s.mind = 41; s.spirituality = 2; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.spirituality, s.progression.sequence]).toEqual([1, 1, 2, 5]); expect(validateManipulatorState(s)).toBe(true);
  });
  it('failed potion needs another original bottle and a new later-week event', () => {
    const s = taught(); brew(s); brew(s, 1); gather(s); apply(s, dose(s), 90);
    const old = structuredClone(s.manipulator.ritual.gatherings[0]); reject(s, dose(s, 1));
    s.health = 100; s.mind = 100; gather(s); apply(s, dose(s, 1), 1);
    expect(s.manipulator.ritual.gatherings[0]).toEqual(old); expect(s.manipulator.bottles[1]!.ritualId).not.toBe(s.manipulator.bottles[0]!.ritualId);
    expect(s.manipulator.bottles[1]!.consumedWeek).toBe(s.manipulator.bottles[0]!.consumedWeek! + 1); expect(validateManipulatorState(s)).toBe(true);
  });
  it('restocks only after every existing bottle actually fails, with next-week fresh materials and no free tears', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i++) { brew(s, i); gather(s); apply(s, dose(s, i), 90); s.health = 100; s.mind = 100; }
    const old = structuredClone(s.manipulator.batches); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.manipulator.batches).toHaveLength(6); expect(s.manipulator.batches.slice(0, 3)).toEqual(old);
    expect(s.manipulator.batches.slice(3).every(batch => batch.status === 'SUPPLIER' && batch.stockedWeek === s.week && batch.tears.length === 0 && batch.materials.every(item => item.holder === 'SUPPLIER'))).toBe(true);
    expect(s.manipulator.bottles).toHaveLength(3); expect(validateManipulatorState(s)).toBe(true);
    brew(s, 3); expect(s.manipulator.bottles[3]!.sourceItemIds).toHaveLength(10); expect(Object.values(s.manipulator.donors).every(donor => donor.visits.length === 4)).toBe(true); expect(validateManipulatorState(s)).toBe(true);
  });
  it('strictly rejects convenience grants and extra command payloads', () => {
    for (const value of [null, {}, { type: 'BUY_POTION', bottleId: 'manipulator-potion-1' }, { type: 'BREW', batchId: 'manipulator-batch-1', skipTears: true }, { type: 'COLLECT_TEAR', batchId: 'manipulator-batch-1', donorId: 'MP4-D1', consent: true }, { type: 'SET_ATTENDANCE', count: 10000 }, { type: 'BUY_MATERIALS', batchId: 'manipulator-batch-0' }]) expect(validateManipulatorCommand(value)).toBe(false);
    expect(isManipulatorAcquisitionCommand({ type: 'BREW', batchId: 'manipulator-batch-1' })).toBe(true); expect(isManipulatorAcquisitionCommand({ type: 'BOOK_GATHERING' })).toBe(false);
  });
  it('root command routes acquisition and ritual to their actual state machines', () => {
    const s = dreamwalker(); applyManipulatorCommand(s, { type: 'LEARN_GUIDANCE' }, context(s)); brew(s);
    applyManipulatorCommand(s, { type: 'BOOK_GATHERING' }, context(s)); expect(s.manipulator.ritual.gatherings[0]!.status).toBe('BOOKED');
    expect(() => applyManipulatorCommand(s, { type: 'REFLECT' }, context(s))).toThrow('共享入口');
  });
  it.each(['material', 'drop-quantity', 'duplicate-donor', 'source-link', 'donor-event', 'adult', 'bottle-time', 'bottle-copy', 'ritual-link', 'extra-state'] as const)('rejects corrupted%s without repairing original history', field => {
    const s = gathered(); apply(s, dose(s), 1); const batch = s.manipulator.batches[0]!, bottle = s.manipulator.bottles[0]!;
    if (field === 'material') batch.materials[1]!.quantity = 79;
    if (field === 'drop-quantity') (batch.tears[0] as unknown as { quantity: number }).quantity = 2;
    if (field === 'duplicate-donor') batch.tears[1]!.donorId = batch.tears[0]!.donorId;
    if (field === 'source-link') bottle.sourceItemIds[0] = 'unrelated-heart';
    if (field === 'donor-event') s.manipulator.donors['MP4-D1'].visits[0]!.eventId = 'invented-event';
    if (field === 'adult') s.manipulator.donors['MP4-D1'].age = 17;
    if (field === 'bottle-time') bottle.brewedWeek -= 1;
    if (field === 'bottle-copy') s.manipulator.bottles.push(structuredClone(bottle));
    if (field === 'ritual-link') bottle.ritualId = 'other-event';
    if (field === 'extra-state') Object.assign(s.manipulator, { freeTears: 7 });
    const copy = structuredClone(s); expect(validateManipulatorState(s)).toBe(false); expect(s).toEqual(copy);
  });
});
