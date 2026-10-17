import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createHandOfOrderState, handOfOrderInheritedView, validateHandOfOrderSource, validateHandOfOrderState } from '../../src/domain/hand-of-order/index.js';
import { getHandOfOrderCurrentSite } from '../../src/domain/hand-of-order/life.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_SOURCE_KEYS } from '../../src/domain/hand-of-order/types.js';
import { oldJusticiarRoots, originalBalancer, hoo, promoted, promotedForLife, ready, rejectIntent, step, taught } from './hand-of-order-directed-helper.js';

describe('HandOfOrder original594 inheritance and one live continuation', () => {
  it('keeps actualS2 promotion126 separate from originalpromotion9 and all17 old masteries', () => {
    const original = originalBalancer(), s = promoted(), source = s.handOfOrder.sourceScene!, view = handOfOrderInheritedView(s);
    expect(view.progression.promotionWeek).toBe(9); expect(view.balancer.promotionWeek).toBe(126);
    expect(source.character.coreStats).toEqual({ physique: 30, perception: 25, will: 25, knowledge: 21 });
    expect(s.character.coreStats).toEqual({ physique: 31, perception: 26, will: 26, knowledge: 22 });
    expect(source.budget).toMatchObject({ sequence: 2, acting: 100, gender: 'FEMALE', health: 60, mind: 96, injuryRisk: 1 });
    expect(source.budget.injuries).toEqual(original.injuries); expect(view.progression.mastery).toEqual(original.progression.mastery);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(original));
    expect(s.handOfOrder.sourceHistory).toEqual(Object.fromEntries(HAND_OF_ORDER_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(validateHandOfOrderSource(s)).toBe(true); expect(validateHandOfOrderState(s)).toBe(true);
  }, 120_000);
  it('selects actual clock767 room, sourceplate65 and open operation without invented volunteer energy', () => {
    const original = originalBalancer(), s = promoted(), site = getHandOfOrderCurrentSite(s);
    expect(site).toEqual(original.chaosHunter.life); expect(site).not.toBe(s.chaosHunter.life);
    expect(site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 124, guideTravelMetres: 92, clockSeconds: 767,
      guide: { id: 'GUIDE', name: '薇娜·贝尔', location: 'OUTSIDE' }, volunteer: { id: 'CH3-MIRA', age: 43, health: 100, mind: 100, willing: false, location: 'OUTSIDE' },
      parcel: { id: 'CH3-PARCEL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', massGrams: 350 },
      line: { id: 'CH3-LINE', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE' },
      paper: { id: 'CH3-RULE-PAPER', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', text: '本次从A到B的越线' },
      table: { id: 'CH3-TABLE-B', location: 'B', thirdParties: 0 } });
    expect(s.handOfOrder.life.operation).toMatchObject(original.balancer.life.operation);
    expect(s.handOfOrder.life.guardPlate).toEqual(original.balancer.life.guardPlate);
    expect(s.handOfOrder.life.guardPlate).not.toBe(s.balancer.life.guardPlate);
    expect('energy' in site!.volunteer).toBe(false); expect('spirituality' in site!.volunteer).toBe(false); expect('mind' in site!.guide).toBe(false);
    expect(site).not.toEqual(s.balancer.life.source!.snapshot); expect(getHandOfOrderCurrentSite(original)).toEqual(original.chaosHunter.life);
  }, 120_000);
  it('retains resisting Caspar at his original position with his original injury, rod and resources', () => {
    const s = promoted(), original = originalBalancer(); expect(s.balancer.encounter).toEqual(original.balancer.encounter);
    expect(s.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90, enemyMind: 100, enemySpirituality: 67, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B' });
    expect(s.balancer.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision])).toEqual([['LIGHT', 592]]);
    expect(s.chaosHunter.encounter).toEqual(original.chaosHunter.encounter); expect(s.imperativeMage.encounter).toEqual(original.imperativeMage.encounter);
    expect(s.balancer.bottles).toEqual(original.balancer.bottles); expect('gifts' in s.handOfOrder).toBe(false);
    expect('gifts' in s.handOfOrder.sourceScene!.originals).toBe(false);
  }, 120_000);
  it('requires actual clinic/rest recovery before the directed healthy life fixture and never changes source injuries', () => {
    const commands: SliceIntent[] = [], original = originalBalancer(), s = ready(promoted(), { health: 100, mind: 100, spirituality: 120, healed: true }, commands);
    expect(s.health).toBe(100); expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.handOfOrder.sourceScene!.budget.health).toBe(60); expect(s.handOfOrder.sourceScene!.budget.injuries).toEqual(original.injuries);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true);
    expect(commands.filter(c => c.type === 'ACTION' && c.action === 'REST').length).toBeGreaterThanOrEqual(2);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(original)); assertValidSliceState(s);
  }, 120_000);
  it('first ordinary exit walks4m only in the new site and never refreshes plate or oldyard', () => {
    const s = promotedForLife(), originals = structuredClone(s.handOfOrder.sourceScene!.originals), roots = oldJusticiarRoots(s);
    const n = hoo(s, { type: 'EXIT_ORIGINAL' });
    expect(getHandOfOrderCurrentSite(n)).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 128, clockSeconds: 771 });
    expect(n.chaosHunter.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 124, clockSeconds: 767 });
    expect(n.handOfOrder.life.guardPlate!.integrity).toBe(65); expect(n.handOfOrder.sourceScene!.originals).toEqual(originals); expect(oldJusticiarRoots(n)).toEqual(roots);
    assertValidSliceState(n);
  }, 120_000);
  it('freezes all eight action surfaces at guidance and projects their old history read-only', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'ARBITER', command: { type: 'LEARN_GUIDANCE' } }, { type: 'SHERIFF', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'INTERROGATOR', command: { type: 'LEARN_GUIDANCE' } }, { type: 'JUDGE', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'PUNISHMENT_KNIGHT', command: { type: 'LEARN_GUIDANCE' } }, { type: 'IMPERATIVE_MAGE', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'CHAOS_HUNTER', command: { type: 'REFLECT' } }, { type: 'BALANCER', command: { type: 'PREPARE_ENCOUNTER' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      const before = stableStringify(oldJusticiarRoots(s)), projected = projectSliceState(s);
      const scan = (v: unknown): void => {
        if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(scan); return; }
        const object = v as Record<string, unknown>;
        if (Array.isArray(object.actions)) for (const action of object.actions as { enabled?: boolean }[]) expect(action.enabled).toBe(false);
        if ('preferredActionId' in object) expect(object.preferredActionId).toBeNull(); for (const child of Object.values(object)) scan(child);
      };
      for (const key of HAND_OF_ORDER_SOURCE_KEYS) scan(projected[key]);
      expect(projected.balancer.abilities).toHaveLength(17); expect(projected.balancer.acting).toBe(100);
      expect(stableStringify(oldJusticiarRoots(s))).toBe(before);
    }
  }, 180_000);
  it('rejects old-body replacement, stale source, invented energy and missing new-stage evidence', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.chaosHunter.life.clockSeconds++; }, s => { s.balancer.encounter.enemyHealth = 100; },
      s => { s.handOfOrder.sourceScene!.originals.site = structuredClone(s.balancer.life.source!.snapshot); },
      s => { s.handOfOrder.sourceHistory!.balancer.life.guardPlate.integrity = 100; },
      s => { (s.handOfOrder.life.site!.volunteer as unknown as Record<string, unknown>).energy = 100; },
      s => { s.handOfOrder = createHandOfOrderState(); }, s => { s.progression.sequence = 0; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateHandOfOrderState(s), change.toString()).toBe(false); }
  }, 120_000);
});


describe('HandOfOrder inherited-lock regression boundaries', () => {
  it('allows evidenced S1 ordinary REST to finish a real week with the ordinary bill and AP reset', () => {
    const initial = promotedForLife('DIVISION', { actions: 6, weeklyBudget: 6 });
    const roots = oldJusticiarRoots(initial), source = structuredClone(initial.handOfOrder.sourceScene), commands: SliceIntent[] = [];
    expect(initial.progression.sequence).toBe(1); expect(initial.health).toBe(100); expect(initial.injuries).toEqual([]);
    expect(initial.activeEvent).toBeNull(); expect(initial.actionsRemaining).toBeGreaterThan(0);
    let s = initial;
    for (let n = 0; n < initial.actionsRemaining; n++) {
      s = step(s, { type: 'ACTION', action: 'REST' }, commands);
      if (n + 1 < initial.actionsRemaining) {
        expect(s.week).toBe(initial.week); expect(s.actionsRemaining).toBe(initial.actionsRemaining - n - 1);
        expect(s.cash).toBe(initial.cash);
      }
    }
    expect(commands).toHaveLength(initial.actionsRemaining); expect(s.week).toBe(initial.week + 1);
    expect(s.date).toEqual(addGameWeeks(initial.date, 1)); expect(s.cash).toBe(initial.cash - 30);
    expect(s.actionsRemaining).toBe(initial.weeklyBudget); expect(s.weeklyBudget).toBe(6);
    expect(s.pulse).toBe('NONE'); expect(s.billAmount).toBe(0); expect(s.activeEvent).toBeNull();
    expect(s.debts).toEqual(initial.debts); expect(s.random).toEqual(initial.random);
    expect(s.progression).toEqual(initial.progression); expect(s.handOfOrder.sourceScene).toEqual(source);
    expect(oldJusticiarRoots(s)).toEqual(roots); assertValidSliceState(s);
  }, 120_000);
  it('keeps the current S1 scene locked even though its inherited S2 scene is closed', () => {
    let s = promotedForLife();
    s = hoo(s, { type: 'EXIT_ORIGINAL' }); s = hoo(s, { type: 'RENT_ANNEX' });
    s = hoo(s, { type: 'OBSERVE', caseId: 'paired-handover' });
    s = hoo(s, { type: 'PREPARE', caseId: 'paired-handover', method: 'ORDINARY' });
    const before = structuredClone(s), historical = handOfOrderInheritedView(s);
    expect(historical.progression.sequence).toBe(2); expect(historical.chaosHunter.life.activeCase).toBeNull();
    expect(historical.balancer.life.activeCase).toBeNull(); expect(s.handOfOrder.life.activeCase).toBe('paired-handover');
    rejectIntent(s, { type: 'ACTION', action: 'WORK' }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s).toEqual(before); assertValidSliceState(s);
  }, 120_000);
  it('does not reopen old commands or let bare S1, missing promotion evidence or S0 use ordinary actions', () => {
    const valid = step(promotedForLife(), { type: 'ACTION', action: 'REST' });
    const oldCommands: SliceIntent[] = [
      { type: 'CHAOS_HUNTER', command: { type: 'OBSERVE', caseId: 'paired-line' } },
      { type: 'CHAOS_HUNTER', command: { type: 'REFLECT' } },
      { type: 'BALANCER', command: { type: 'OBSERVE', caseId: 'visible-imbalance' } },
      { type: 'BALANCER', command: { type: 'PREPARE_ENCOUNTER' } },
    ];
    for (const intent of oldCommands) rejectIntent(valid, intent);
    const bare = originalBalancer(); bare.progression.sequence = 1;
    const missing = structuredClone(valid); missing.handOfOrder = createHandOfOrderState();
    const zero = structuredClone(valid); zero.progression.sequence = 0;
    for (const s of [bare, missing, zero]) {
      expect(() => assertValidSliceState(s)).toThrow();
      for (const intent of [...oldCommands, { type: 'ACTION', action: 'REST' }, { type: 'ACTION', action: 'WORK' }] as SliceIntent[]) rejectIntent(s, intent);
    }
    assertValidSliceState(valid);
  }, 120_000);
});
