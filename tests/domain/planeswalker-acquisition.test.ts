import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { PLANESWALKER_ABILITY_IDS, PLANESWALKER_PREPARATION_IDS } from '../../src/domain/planeswalker/types.js';
import { PLANESWALKER_PRICES, PLANESWALKER_AUXILIARY_DONORS } from '../../src/domain/planeswalker/content.js';
import { hasPlaneswalkerLock, projectPlaneswalker, validatePlaneswalkerState, validatePlaneswalkerCommand } from '../../src/domain/planeswalker/index.js';
import { planeswalkerRitualQualified } from '../../src/domain/planeswalker/ritual.js';
import { directedInitial3, oldDoorRoots, taught, qualified, preparedDose, consume, pw, rejectPW, freshWeek, readyForActions } from './planeswalker-directed-helper.js';

import { actualBoundary } from './planeswalker-fixture-helper.js';

const valid = (s: SliceState) => { expect(validatePlaneswalkerState(s)).toBe(true); assertValidSliceState(s); };

describe('Planeswalker original auxiliary kits, paid checks and actual public consumption', () => {
  it('registers current original sources at guidance with no complete main-ingredient formula', () => {
    const before = directedInitial3(), s = pw(before, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 500, before.actionsRemaining - 1]);
    expect(PLANESWALKER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, labourBalance: 900, preparation: 140 });
    expect(s.planeswalker.bottles.every(b => b.stockedWeek === s.week && b.source.includes(`第${s.week}周`))).toBe(true);
    const p = projectPlaneswalker(s); expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([{ name: '星之虫', quantity: 1, unit: '条' }, { name: '时之虫', quantity: 1, unit: '条' }, { name: '灵体之虫', quantity: 1, unit: '条' }]);
    expect(p.story).toContain('完整主材料'); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(before)); rejectPW(s, { type: 'LEARN_GUIDANCE' }); valid(s);
  });
  it('delivers three independent original auxiliaries with each paid bottle, preserving other bottles', () => {
    const before = taught(), s = pw(before, { type: 'BUY_POTION', bottleId: 'planeswalker-potion-1' }), b = s.planeswalker.bottles[0]!, kit = b.auxiliaryKit;
    expect(s.cash).toBe(before.cash - 6400); expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(s.random).toEqual(before.random);
    expect(kit).toMatchObject({ id: 'PW2-KIT-1', sealId: 'PW2-SEAL-1', status: 'PLAYER', acquiredWeek: s.week, openedWeek: null, consumedWeek: null, checkedWeeks: [] });
    expect(kit.items.map(i => i.kind)).toEqual(['STAR_WORM', 'TIME_WORM', 'SPIRIT_WORM']);
    for (const [n, item] of kit.items.entries()) {
      expect(item).toMatchObject({ quantity: 1, status: 'PLAYER', handedOverWeek: s.week, donorSequence: 4, donorId: PLANESWALKER_AUXILIARY_DONORS[n]!.donorId });
      expect(item.receiptId).toBe(`PW2-RECEIPT-${item.kind}-1`); expect(item.donorAge).toBeGreaterThan(18);
    }
    expect(s.planeswalker.bottles.slice(1)).toEqual(before.planeswalker.bottles.slice(1)); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(before));
    rejectPW(s, { type: 'BUY_POTION', bottleId: b.id }); rejectPW(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); valid(s);
  });
  it('earns only the fifth bottle-specific labour discount and never transfers it to another original kit', () => {
    let s = taught(); const bottleId = 'planeswalker-potion-1';
    for (let n = 0; n < 5; n++) { const before = s; s = pw(s, { type: 'POTION_WORK', bottleId }); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); }
    expect(s.planeswalker.bottles[0]!.labourSteps).toBe(5); expect(s.planeswalker.bottles[1]!.labourSteps).toBe(0);
    rejectPW(s, { type: 'POTION_WORK', bottleId }); const cash = s.cash; s = pw(s, { type: 'BUY_POTION', bottleId }); expect(s.cash).toBe(cash - 900);
    expect(s.planeswalker.bottles[0]!.auxiliaryKit.items.every(i => i.status === 'PLAYER')).toBe(true);
    expect(s.planeswalker.ritual.journal).toEqual([]); expect(s.planeswalker.preparations).toEqual([]); valid(s);
  });
  it('does not let the three professional preparations or an old completed S4 seal replace nine actual legends', () => {
    let s = taught(); for (const taskId of PLANESWALKER_PREPARATION_IDS) s = pw(s, { type: 'PREPARE_TASK', taskId });
    s = pw(s, { type: 'BUY_POTION', bottleId: 'planeswalker-potion-1' });
    expect(s.secretsSorcerer.ritual.phase).toBe('CLOSED'); expect(s.planeswalker.preparations).toHaveLength(3);
    expect(planeswalkerRitualQualified(s)).toBe(false); rejectPW(s, { type: 'PREPARE_PROMOTION' }); valid(s);
  });
  it('checks every held original kit for140 once without consuming any auxiliary and preserves cancellation history', () => {
    let s = qualified(); s = readyForActions(s, 5);
    for (const taskId of PLANESWALKER_PREPARATION_IDS) s = pw(s, { type: 'PREPARE_TASK', taskId });
    for (const bottleId of ['planeswalker-potion-1', 'planeswalker-potion-2']) s = pw(s, { type: 'BUY_POTION', bottleId });
    const before = structuredClone(s); s = pw(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 140, before.actionsRemaining - 1]);
    for (const b of s.planeswalker.bottles.slice(0, 2)) expect(b.auxiliaryKit).toMatchObject({ status: 'PLAYER', openedWeek: s.week, consumedWeek: null, checkedWeeks: [s.week] });
    expect(s.planeswalker.bottles[2]).toEqual(before.planeswalker.bottles[2]); expect(hasPlaneswalkerLock(s)).toBe(true);
    const prepared = structuredClone(s); s = pw(s, { type: 'LEAVE_PREPARATION' });
    expect(s.cash).toBe(prepared.cash); expect(s.planeswalker.bottles).toEqual(prepared.planeswalker.bottles);
    expect(s.planeswalker.ritual).toEqual(prepared.planeswalker.ritual); expect(hasPlaneswalkerLock(s)).toBe(false);
    rejectPW(s, { type: 'CONSUME', bottleId: 'planeswalker-potion-1', confirmed: true }); valid(s);
  }, 90_000);
  it('pays another140 after cancellation and appends a fresh actual check even in the same week', () => {
    let s = actualBoundary('paid140-current-week-original-auxiliary-check').final; const first = s.week; s = pw(s, { type: 'LEAVE_PREPARATION' });
    const cash = s.cash; s = pw(s, { type: 'PREPARE_PROMOTION' });
    expect(s.cash).toBe(cash - 140); expect(s.planeswalker.bottles[0]!.auxiliaryKit.checkedWeeks).toEqual([first, first]);
    expect(s.planeswalker.bottles[0]!.auxiliaryKit.openedWeek).toBe(first); valid(s);
  });
  it.each([
    ['GREAT_SUCCESS', 8, 0, 0, 2], ['SUCCESS', 15, 0, 0, 2], ['FAILURE', 25, 15, 30, 3], ['GREAT_FAILURE', 45, 25, 60, 3],
  ] as const)('publicly settles directed%s with three consumed originals and no false histories', (tier, mindCost, healthCost, pollution, sequence) => {
    const name = tier === 'SUCCESS' ? 'promotion' : tier === 'FAILURE' ? 'actual-potion-failure' : 'actual-potion-failure-2';
    const boundary = tier === 'GREAT_SUCCESS' ? null : actualBoundary(name);
    const before = boundary?.beforeLast ?? preparedDose(tier);
    const bottleId = boundary?.lastIntent.type === 'PLANESWALKER' && 'bottleId' in boundary.lastIntent.command ? boundary.lastIntent.command.bottleId : 'planeswalker-potion-1';
    const s = consume(before, bottleId), b = s.planeswalker.bottles.find(bottle => bottle.id === bottleId)!;
    if (boundary) expect(s).toEqual(boundary.final);
    expect(b.outcome).toBe(tier); expect(s.lastCheck?.tier).toBe(tier);
    expect([s.health, s.mind, s.seer.pollution, s.spirituality]).toEqual([before.health - healthCost, before.mind - mindCost, Math.min(100, before.seer.pollution + pollution), before.spirituality]);
    expect(s.random).toEqual({ seed: before.random.seed, cursor: before.random.cursor + 1 }); expect(s.progression.sequence).toBe(sequence);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: before.week, preparationWeek: before.week });
    expect(b.auxiliaryKit).toMatchObject({ status: 'CONSUMED', consumedWeek: before.week, checkedWeeks: [before.week] });
    expect(b.auxiliaryKit.items.every(i => i.status === 'CONSUMED' && i.quantity === 1 && i.handedOverWeek === b.acquiredWeek)).toBe(true);
    expect(s.planeswalker.bottles.filter(x => x.id !== bottleId)).toEqual(before.planeswalker.bottles.filter(x => x.id !== bottleId)); expect(s.planeswalker.preparedWeek).toBeNull();
    expect(s.planeswalker.ritual).toEqual(before.planeswalker.ritual); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(before));
    expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(before.injuryRisk); expect(s.character.gender).toBe(before.character.gender);
    expect(s.combatHistory).toEqual(before.combatHistory);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 2) {
      expect(s.planeswalker.wandererActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(PLANESWALKER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
    } else { expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(before.character.coreStats); expect(s.planeswalker.promotionWeek).toBeNull(); }
    rejectPW(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); valid(s);
  }, 90_000);
  it('retains all three failed kits then receives genuinely new supplier stock only after a real week', () => {
    let s = preparedDose('EXHAUST_SUPPLY'); const ritual = structuredClone(s.planeswalker.ritual);
    for (let n = 0; n < 3; n++) {
      const bottleId = `planeswalker-potion-${n + 1}`;
      if (n > 0) { s = readyForActions(s, 2); s = pw(s, { type: 'BUY_POTION', bottleId }); s = pw(s, { type: 'PREPARE_PROMOTION' }); }
      s = consume(s, bottleId); expect(s.progression.sequence).toBe(3); expect(['FAILURE', 'GREAT_FAILURE']).toContain(s.planeswalker.bottles[n]!.outcome);
    }
    s = readyForActions(s, 2); const failed = structuredClone(s.planeswalker.bottles); s = pw(s, { type: 'REQUEST_SUPPLY' });
    rejectPW(s, { type: 'RECEIVE_SUPPLY' }); s = freshWeek(s); s = pw(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.planeswalker.bottles.slice(0, 3)).toEqual(failed); expect(s.planeswalker.bottles).toHaveLength(6);
    expect(s.planeswalker.bottles.slice(3).map(b => b.auxiliaryKit.id)).toEqual(['PW2-KIT-4', 'PW2-KIT-5', 'PW2-KIT-6']);
    expect(s.planeswalker.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.auxiliaryKit.checkedWeeks.length === 0 && b.auxiliaryKit.items.every(i => i.status === 'SUPPLIER'))).toBe(true);
    expect(s.planeswalker.ritual).toEqual(ritual); rejectPW(s, { type: 'CONSUME', bottleId: 'planeswalker-potion-1', confirmed: true }); valid(s);
  }, 90_000);
  it.each([
    { type: 'CONSUME', bottleId: 'planeswalker-potion-1' }, { type: 'CONSUME', bottleId: 'planeswalker-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'planeswalker-potion-1', confirmed: true, reuseAuxiliary: true },
    { type: 'BUY_POTION', bottleId: 'wanderer-potion-1' }, { type: 'BUY_POTION', bottleId: 'planeswalker-potion-01' },
    { type: 'PREPARE_PROMOTION', qualifiedSites: 9 }, { type: 'PREPARE_TASK', taskId: 'FAKE_LEGEND' },
  ])('rejects malformed acquisition command%j', c => { expect(validatePlaneswalkerCommand(c)).toBe(false); rejectPW(taught(), c); });
});

const auxiliaryMutations: [string, (s: SliceState) => void][] = [
  ['kit from another bottle', s => { s.planeswalker.bottles[0]!.auxiliaryKit.id = 'PW2-KIT-2'; }],
  ['substitute original seal', s => { s.planeswalker.bottles[0]!.auxiliaryKit.sealId = 'REPLACEMENT'; }],
  ['unknown additional auxiliary', s => { const k = s.planeswalker.bottles[0]!.auxiliaryKit; k.items.push(structuredClone(k.items[0]!)); }],
  ['missing time worm', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items.splice(1, 1); }],
  ['duplicate star worm', s => { const k = s.planeswalker.bottles[0]!.auxiliaryKit; k.items[1] = structuredClone(k.items[0]!); }],
  ['altered quantity', s => { Object.assign(s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!, { quantity: 2 }); }],
  ['altered donor identity', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.donorId = 'WN3-NORA'; }],
  ['altered donor age', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.donorAge++; }],
  ['altered donor pathway', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.donorPathway = 'diviner'; }],
  ['receipt from another original', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.receiptId = 'PW2-RECEIPT-STAR_WORM-2'; }],
  ['rewritten source', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.source += ' replacement'; }],
  ['handed over before its bottle', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.handedOverWeek!--; }],
  ['consumed one worm before dose', s => { s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.status = 'CONSUMED'; }],
  ['never opened its checked seal', s => { s.planeswalker.bottles[0]!.auxiliaryKit.openedWeek = null; }],
  ['erased inspection history', s => { s.planeswalker.bottles[0]!.auxiliaryKit.checkedWeeks = []; }],
  ['inspection before nine legends', s => { s.planeswalker.bottles[0]!.auxiliaryKit.checkedWeeks[0] = s.wanderer.promotionWeek!; }],
  ['future inspection', s => { s.planeswalker.bottles[0]!.auxiliaryKit.checkedWeeks.push(s.week + 1); }],
];
describe('Planeswalker exact auxiliary provenance and custody validation', () => {
  it.each(auxiliaryMutations)('rejects%s', (_name, mutate) => {
    const s = actualBoundary('paid140-current-week-original-auxiliary-check').final; mutate(s); expect(validatePlaneswalkerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects restoring a consumed original worm even when the other two remain consumed', () => {
    const s = actualBoundary('actual-potion-failure').final; s.planeswalker.bottles[0]!.auxiliaryKit.items[0]!.status = 'PLAYER';
    expect(validatePlaneswalkerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
});
