import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { DARKNESS_ABILITIES, DARKNESS_ABILITY_IDS } from '../../src/domain/darkness/content.js';
import type { DarknessBudget } from '../../src/domain/darkness/source.js';
import {
  applyDarknessEvacuation, createDarknessEvacuation, DARKNESS_EVACUATION_LOCATION,
  DARKNESS_EVACUATION_POINTS, darknessEvacuationVerifiedReceipts,
  type DarknessEvacuationCommand, type DarknessEvacuationHost, type DarknessEvacuationPoint,
} from '../../src/domain/darkness/evacuation.js';
import {
  applyDarknessEpilogue, createDarknessEpilogue, darknessEpilogueBlock,
  getDarknessEpilogueActions, projectDarknessEpilogue, validateDarknessEpilogueCommand,
  type DarknessEpilogueCommand,
} from '../../src/domain/darkness/epilogue.js';

const CONCEALMENT = 'darkness.s0.short-concealment';
const DIVERSION = 'darkness.s0.bounded-misfortune-diversion';
const controlledCheck = (roll: number) => resolveNormalCheck({ ability: 'will', baseAbility: 45,
  difficulty: 42, modifiers: [], roll });

/** Directed component checks, not a natural promotion, accepted save, or end-to-end
 * campaign. The original four arrivals, permissions, lamp use, and Lena's wound
 * are produced by the real evacuation reducer. The S0 budget, resolved rolls,
 * elapsed-time inputs and explicitly marked countermeasure/refusal fixtures are
 * controlled test inputs. They do not prove the production promotion/replay path.
 * Test execution is owned by the parent task; this worker did not run these tests. */
function scene() {
  let revision = 1;
  const host: DarknessEvacuationHost = { eventId: 'evac-1', revision, week: 200,
    actorId: 'same-original-player', location: DARKNESS_EVACUATION_LOCATION,
    nowSecond: 36000, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 108,
    actions: 3, health: 100, mind: 97, spirituality: 112, check: null };
  let evacuation = createDarknessEvacuation('epilogue-component', host.actorId, host.week, host.nowSecond);
  const evacuate = (command: DarknessEvacuationCommand) => {
    host.eventId = `evac-${revision}`; host.revision = revision;
    const result = applyDarknessEvacuation(evacuation, command, host);
    evacuation = result.state; host.cash -= result.effect.cashCost; host.cash += result.effect.cashGain;
    host.actions -= result.effect.actions; host.health += result.effect.health;
    host.mind += result.effect.mind; host.spirituality += result.effect.spirituality;
    host.nowSecond += result.effect.seconds; revision++;
  };
  const go = (to: DarknessEvacuationPoint) => {
    while (evacuation.position !== to) {
      const index = DARKNESS_EVACUATION_POINTS.indexOf(evacuation.position);
      evacuate({ type: 'WALK', to: DARKNESS_EVACUATION_POINTS[index + (to > evacuation.position ? 1 : -1)]!, pace: 'CAREFUL' });
    }
  };
  evacuate({ type: 'SURVEY_DAY' }); evacuate({ type: 'BUY_SUPPLIES' });
  for (const resident of [...evacuation.residents]) {
    go(resident.home); evacuate({ type: 'REGISTER_RESIDENT', residentId: resident.id });
  }
  go(110); evacuate({ type: 'ORDINARY_RETURN' });
  evacuate({ type: 'WAIT_NIGHT' }); evacuate({ type: 'BEGIN_NIGHT' });
  evacuate({ type: 'LIGHT', lampId: 'DN-LAMP-1' });
  // A real failed night traversal injures Lena and withdraws her permission.
  evacuate({ type: 'ESCORT', residentId: 'DN-LENA' }); go(25);
  evacuate({ type: 'WALK', to: 40, pace: 'DIRECT' });
  go(25); evacuate({ type: 'OBSERVE', hazard: 'FALSE_LIGHT' }); evacuate({ type: 'SHIELD_FALSE_LIGHT' });
  go(40); evacuate({ type: 'REVIEW_PERMISSION', residentId: 'DN-LENA' });
  go(55); evacuate({ type: 'OBSERVE', hazard: 'NOISE' }); evacuate({ type: 'RELAY_INSTRUCTIONS' });
  for (const id of ['DN-LENA', 'DN-NOAH', 'DN-ADA', 'DN-JONAH'] as const) {
    go(evacuation.residents.find(p => p.id === id)!.position);
    evacuate({ type: 'ESCORT', residentId: id }); go(110);
  }
  evacuate({ type: 'ORDINARY_RETURN' }); evacuate({ type: 'REPORT' });
  expect(darknessEvacuationVerifiedReceipts(evacuation)).toContain(evacuation.reportEventId);
  expect(evacuation.residents.every(p => p.position === 110 && p.arrival?.nightId === 0)).toBe(true);
  const originalEvacuation = structuredClone(evacuation), originalBytes = JSON.stringify(evacuation);
  const b: DarknessBudget = { week: host.week, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 1 },
    actions: 3, cash: 40, health: 85, mind: 90, spirituality: 100, pollution: 10,
    injuries: [{ id: 'controlled-prior-player-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null }],
    injuryRisk: 1, status: 'ACTIVE', sequence: 0, acting: 0,
    mastery: { 'darkness.s1.original-practice': 13, [CONCEALMENT]: 0, [DIVERSION]: 0 },
    coreStats: { physique: 33, perception: 29, will: 45, knowledge: 26 }, completedSources: [],
  };
  let nowSecond = host.nowSecond, state = createDarknessEpilogue(evacuation, { week: b.week, nowSecond });
  const step = (type: DarknessEpilogueCommand['type'], roll?: number) => {
    const beforeState = structuredClone(state), beforeEvacuation = JSON.stringify(evacuation);
    const result = applyDarknessEpilogue(state, { type }, b, evacuation, {
      eventId: `epilogue-${revision}`, revision, nowSecond, check: roll === undefined ? null : controlledCheck(roll),
    });
    expect(state).toEqual(beforeState);
    expect(JSON.stringify(evacuation)).toBe(beforeEvacuation);
    expect(JSON.stringify(result.evacuation)).toBe(originalBytes);
    state = result.state; evacuation = result.evacuation; nowSecond += result.seconds; revision++;
    return result;
  };
  const ready = () => {
    step('GO_SHELTER'); step('INVITE_RETURN'); step('RETURN_RESIDENTS'); step('OBSERVE');
  };
  const block = (type: DarknessEpilogueCommand['type']) => darknessEpilogueBlock(state, { type }, b, evacuation, nowSecond);
  return { b, originalEvacuation, originalBytes, step, ready, block,
    get state() { return state; }, get evacuation() { return evacuation; },
    get nowSecond() { return nowSecond; }, get revision() { return revision; },
    advance(seconds: number) { nowSecond += seconds; }, // Explicit external elapsed time; no resources refresh.
  };
}

describe('Darkness bounded S0 epilogue, directed component evidence', () => {
  it('requires recorded arrivals and reuses the same two adults, wounds and arrival IDs without reusing old consent', () => {
    const r = scene();
    expect(DARKNESS_ABILITY_IDS).toEqual([CONCEALMENT, DIVERSION]);
    expect(DARKNESS_ABILITIES.map(a => a.id)).toEqual([CONCEALMENT, DIVERSION]);
    expect(r.state.residents.map(p => [p.id, p.age, p.position, p.consenting])).toEqual([
      ['DN-LENA', 32, 110, false], ['DN-NOAH', 58, 110, false],
    ]);
    for (const p of r.state.residents) {
      const old = r.originalEvacuation.residents.find(old => old.id === p.id)!;
      expect(old.consent).toBe('ACCEPT'); expect(p.originalArrivalId).toBe(old.arrival!.eventId);
      expect(p.injuries).toEqual(old.injuries.map(i => i.description));
    }
    expect(r.state.residents[0]!.injuries).toHaveLength(1);
    expect(r.state).toMatchObject({ position: 0, invited: false, returned: false, observed: false });
    for (const missing of ['REPORT', 'ARRIVAL', 'POSITION'] as const) {
      const incomplete = structuredClone(r.evacuation);
      if (missing === 'REPORT') incomplete.reportEventId = null;
      else if (missing === 'ARRIVAL') incomplete.residents[0]!.arrival = null;
      else incomplete.residents[0]!.position = 40;
      expect(() => createDarknessEpilogue(incomplete, { week: r.b.week, nowSecond: r.nowSecond })).toThrow('抵达');
    }
  });

  it('walks to the shelter, obtains this visit’s permission, then actually walks the same residents seventy metres', () => {
    const r = scene(), start = r.nowSecond, originals = structuredClone(r.state.residents), budget = structuredClone(r.b);
    expect(r.block('INVITE_RETURN')).not.toBeNull(); expect(r.block('RETURN_RESIDENTS')).not.toBeNull();
    expect(r.step('GO_SHELTER').seconds).toBe(110);
    expect(r.state.position).toBe(110); expect(r.state.residents).toEqual(originals);
    expect(r.block('RETURN_RESIDENTS')).not.toBeNull();
    expect(r.step('INVITE_RETURN').seconds).toBe(60);
    expect(r.state.residents.every(p => p.consenting && p.position === 110)).toBe(true);
    expect(r.state.journal.at(-1)!.command.type).toBe('INVITE_RETURN');
    expect(r.step('RETURN_RESIDENTS').seconds).toBe(140);
    expect(r.state.position).toBe(40); expect(r.state.residents.map(p => p.position)).toEqual([40, 40]);
    expect(r.state.residents.map(p => [p.id, p.originalArrivalId, p.injuries])).toEqual(originals.map(p => [p.id, p.originalArrivalId, p.injuries]));
    expect(r.nowSecond).toBe(start + 310); expect(r.b).toEqual(budget);
    expect(r.block('RETURN_RESIDENTS')).not.toBeNull(); expect(r.block('SHORT_CONCEALMENT')).toContain('观察');
    expect(r.step('OBSERVE').seconds).toBe(30); expect(r.block('OBSERVE')).not.toBeNull();
  });

  it('respects an independently authored refusal and later withdrawn permission without moving a person remotely', () => {
    const r = scene(); r.step('GO_SHELTER');
    r.state.residents[0]!.returnWillingness = 'DECLINE'; // Explicit current-visit NPC refusal fixture.
    const before = structuredClone(r.state), budget = structuredClone(r.b);
    expect(r.block('INVITE_RETURN')).toContain('当次');
    expect(() => r.step('INVITE_RETURN')).toThrow(); expect(r.state).toEqual(before); expect(r.b).toEqual(budget);
    r.step('WITHDRAW'); expect(r.state.residents.map(p => p.position)).toEqual([110, 110]);
    const withdrawn = scene(); withdrawn.ready();
    withdrawn.state.residents[1]!.consenting = false; // Explicit later withdrawal, not a public consent command.
    for (const type of ['SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION', 'CROSS', 'ORDINARY_SIDE_EXIT'] as const)
      expect(withdrawn.block(type)).not.toBeNull();
    expect(withdrawn.block('WITHDRAW')).toBeNull();
    const separated = scene(); separated.ready();
    separated.state.residents[1]!.position = 55; // Explicit current-position divergence fixture.
    expect(separated.block('CROSS')).not.toBeNull(); expect(separated.block('ORDINARY_SIDE_EXIT')).not.toBeNull();
    expect(separated.block('WITHDRAW')).toBeNull();
  });

  it('charges both successful techniques without moving people, altering the object or awarding unused mastery', () => {
    const r = scene(); r.ready();
    const people = structuredClone(r.state.residents), load = structuredClone(r.state.load), injuries = structuredClone(r.b.injuries), start = r.nowSecond;
    expect(r.step('SHORT_CONCEALMENT', 20).seconds).toBe(5);
    expect(r.state.concealment).toMatchObject({ attempted: true, passed: true, applied: false, origin: 40, expiresSecond: start + 35 });
    expect(r.step('BOUNDED_MISFORTUNE_DIVERSION', 20).seconds).toBe(3);
    expect(r.state.diversion).toEqual({ attempted: true, passed: true, applied: false, expiresSecond: start + 18 });
    expect([r.b.actions, r.b.cash, r.b.health, r.b.spirituality, r.b.mind, r.b.pollution]).toEqual([1, 40, 85, 78, 76, 10]);
    expect(r.state.residents).toEqual(people); expect(r.state.load).toEqual(load); expect(r.b.injuries).toEqual(injuries);
    expect(r.b.mastery).toEqual({ 'darkness.s1.original-practice': 13, [CONCEALMENT]: 0, [DIVERSION]: 0 });
    expect(r.state.journal.filter(e => e.check).map(e => e.check!.tier)).toEqual(['SUCCESS', 'SUCCESS']);
    for (const type of ['SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION'] as const) expect(r.block(type)).not.toBeNull();
  });

  it('applies both effects only during the actual eight-second crossing, including the exact ten-second release deadline', () => {
    const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', 20); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
    const people = structuredClone(r.state.residents), health = r.b.health, expires = r.state.diversion.expiresSecond!;
    r.advance(2); expect(r.nowSecond + 8).toBe(expires);
    expect(getDarknessEpilogueActions(r.state, r.b, r.evacuation, r.nowSecond).find(a => a.preferredAction)!.command.type).toBe('CROSS');
    expect(r.step('CROSS').seconds).toBe(8);
    expect(r.state.position).toBe(44); expect(r.state.residents.map(p => p.position)).toEqual([44, 44]);
    expect(r.state.residents.map(p => [p.id, p.injuries])).toEqual(people.map(p => [p.id, p.injuries]));
    expect(r.state.observer.lostSight).toBe(true);
    expect(r.state.concealment).toMatchObject({ applied: true, expiresSecond: null });
    expect(r.state.diversion).toMatchObject({ applied: true, expiresSecond: null });
    expect(r.state.load).toMatchObject({ id: 'DN-LATE-LOOSE-SHUTTER', pending: false, condition: 40, landed: 'EMPTY_BAY' });
    expect([r.b.mastery[CONCEALMENT], r.b.mastery[DIVERSION], r.b.health]).toEqual([8, 8, health]);
    const used = structuredClone(r.b), state = structuredClone(r.state);
    expect(() => r.step('CROSS')).toThrow(); expect(r.b).toEqual(used); expect(r.state).toEqual(state);
  });

  it('checks completion time rather than cast time, and lets elapsed seconds expire each independent effect', () => {
    for (const delay of [3, 23]) {
      const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', 20); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
      const paid = [r.b.actions, r.b.cash, r.b.spirituality, r.b.mind]; r.advance(delay); r.step('CROSS');
      expect(r.state.diversion.applied).toBe(false); expect(r.b.mastery[DIVERSION]).toBe(0);
      expect(r.state.concealment.applied).toBe(delay === 3);
      expect(r.b.mastery[CONCEALMENT]).toBe(delay === 3 ? 8 : 0);
      expect(r.state.load).toMatchObject({ landed: 'WALKWAY', condition: 40, pending: false });
      expect(r.b.health).toBe(77); expect(r.state.residents[0]!.injuries).toHaveLength(2);
      expect(r.state.concealment.expiresSecond).toBeNull(); expect(r.state.diversion.expiresSecond).toBeNull();
      expect([r.b.actions, r.b.cash, r.b.spirituality, r.b.mind]).toEqual(paid);
    }
  });

  it('requires an empty discharge bay both when casting and when the original object actually falls', () => {
    const blocked = scene(); blocked.ready(); blocked.state.load.emptyBayClear = false; // Explicit occupied-bay fixture.
    expect(blocked.block('BOUNDED_MISFORTUNE_DIVERSION')).not.toBeNull();
    const r = scene(); r.ready(); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
    r.state.load.emptyBayClear = false; // Explicit obstruction arriving after the successful cast.
    const oldWounds = [...r.state.residents[0]!.injuries]; r.step('CROSS');
    expect(r.state.diversion).toMatchObject({ passed: true, applied: false, expiresSecond: null });
    expect(r.state.load).toMatchObject({ id: 'DN-LATE-LOOSE-SHUTTER', landed: 'WALKWAY', condition: 40 });
    expect(r.state.residents[0]!.injuries.slice(0, oldWounds.length)).toEqual(oldWounds);
    expect(r.b.injuries).toHaveLength(2); expect(r.b.health).toBe(77); expect(r.b.mastery[DIVERSION]).toBe(0);
    expect(r.block('SECURE_LOAD')).not.toBeNull(); expect(r.block('BOUNDED_MISFORTUNE_DIVERSION')).not.toBeNull();
  });

  it('does not award concealment through noise or outside its ten-metre origin bound', () => {
    for (const counter of ['NOISE', 'DISTANCE'] as const) {
      const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', 20); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
      if (counter === 'NOISE') r.state.observer.alertedByNoise = true; // Explicit current-scene countermeasure.
      else r.state.concealment.origin = 33; // Controlled geometry input: destination 44 is eleven metres away.
      r.step('CROSS');
      expect(r.state.observer.lostSight).toBe(false); expect(r.state.concealment.applied).toBe(false);
      expect(r.b.mastery[CONCEALMENT]).toBe(0); expect(r.state.diversion.applied).toBe(true);
      expect(r.b.mastery[DIVERSION]).toBe(8); expect(r.b.health).toBe(85);
    }
  });

  it('charges failed and severely failed attempts once and retains their real strain injuries', () => {
    for (const roll of [90, 99]) {
      const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', roll); r.step('BOUNDED_MISFORTUNE_DIVERSION', roll);
      expect([r.b.actions, r.b.cash, r.b.spirituality, r.b.health, r.b.mind, r.b.injuryRisk]).toEqual(
        roll === 90 ? [1, 40, 78, 69, 70, 3] : [1, 40, 78, 45, 60, 5]);
      expect(r.b.injuries.slice(1).map(i => i.severity)).toEqual(roll === 90 ? ['LIGHT', 'LIGHT'] : ['HEAVY', 'HEAVY']);
      expect(r.state.concealment).toMatchObject({ attempted: true, passed: false, applied: false, expiresSecond: null });
      expect(r.state.diversion).toMatchObject({ attempted: true, passed: false, applied: false, expiresSecond: null });
      expect(r.state.load.condition).toBe(70); expect(r.state.residents.map(p => p.position)).toEqual([40, 40]);
      const paid = structuredClone(r.b), state = structuredClone(r.state);
      for (const type of ['SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION'] as const) expect(() => r.step(type, 20)).toThrow();
      expect(r.b).toEqual(paid); expect(r.state).toEqual(state);
      expect([r.b.mastery[CONCEALMENT], r.b.mastery[DIVERSION]]).toEqual([0, 0]);
    }
  });

  it('rejects insufficient AP, spirituality or survivable mind before charging either technique', () => {
    const r = scene(); r.ready();
    for (const [type, spirituality, mind] of [['SHORT_CONCEALMENT', 12, 8], ['BOUNDED_MISFORTUNE_DIVERSION', 10, 6]] as const) {
      for (const patch of [{ actions: 0 }, { spirituality: spirituality - 1 }, { mind }]) {
        const budget: DarknessBudget = { ...structuredClone(r.b), ...patch }, before = structuredClone(budget);
        expect(darknessEpilogueBlock(r.state, { type }, budget, r.evacuation, r.nowSecond)).toContain('不足');
        expect(() => applyDarknessEpilogue(r.state, { type }, budget, r.evacuation, {
          eventId: 'insufficient', revision: r.revision, nowSecond: r.nowSecond, check: controlledCheck(20),
        })).toThrow();
        expect(budget).toEqual(before);
      }
      expect(darknessEpilogueBlock(r.state, { type }, { ...r.b, actions: 1, spirituality, mind: mind + 1 }, r.evacuation, r.nowSecond)).toBeNull();
    }
    expect(r.state.concealment.attempted).toBe(false); expect(r.state.diversion.attempted).toBe(false);
  });

  it('rejects duplicate events, backward clocks and mismatched check inputs without additional costs', () => {
    const r = scene(); r.ready(); const before = structuredClone(r.state), budget = structuredClone(r.b);
    expect(() => r.step('SHORT_CONCEALMENT')).toThrow('检定');
    expect(() => r.step('STOP_EFFECTS', 20)).toThrow('检定');
    for (const nowSecond of [r.nowSecond - 1, r.nowSecond + 0.5, Number.NaN])
      expect(() => applyDarknessEpilogue(r.state, { type: 'STOP_EFFECTS' }, r.b, r.evacuation, {
        eventId: 'invalid-clock', revision: r.revision, nowSecond, check: null,
      })).toThrow('时刻');
    expect(() => applyDarknessEpilogue(r.state, { type: 'STOP_EFFECTS' }, r.b, r.evacuation, {
      eventId: r.state.journal[0]!.eventId, revision: r.revision, nowSecond: r.nowSecond, check: null,
    })).toThrow('重复');
    expect(r.state).toEqual(before); expect(r.b).toEqual(budget);
    expect(JSON.stringify(r.evacuation)).toBe(r.originalBytes);
  });

  it('stops temporary effects for free without refunds, healing, mastery or moving the residents', () => {
    const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', 20); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
    const paid = structuredClone(r.b), people = structuredClone(r.state.residents), load = structuredClone(r.state.load), time = r.nowSecond;
    expect(r.step('STOP_EFFECTS').seconds).toBe(0); expect(r.nowSecond).toBe(time);
    expect(r.state.concealment).toMatchObject({ passed: true, applied: false, expiresSecond: null });
    expect(r.state.diversion).toMatchObject({ passed: true, applied: false, expiresSecond: null });
    expect(r.b).toEqual(paid); expect(r.state.residents).toEqual(people); expect(r.state.load).toEqual(load);
    for (const type of ['SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION'] as const) expect(r.block(type)).not.toBeNull();
    r.step('ORDINARY_SIDE_EXIT'); r.step('REPORT');
    expect(r.state.reported).toBe(true); expect(r.b).toEqual(paid); expect(r.state.load.landed).toBe('NOT_RELEASED');
  });

  it('uses the original physical latch and a zero-AP zero-cash ordinary route without needing a successful technique', () => {
    const r = scene(); r.ready(); r.b.actions = 0; r.b.cash = 0; // Explicit exhausted-budget fixture.
    const budget = structuredClone(r.b), oldInjuries = r.state.residents.map(p => [...p.injuries]);
    const actions = getDarknessEpilogueActions(r.state, r.b, r.evacuation, r.nowSecond);
    expect(actions.find(a => a.preferredAction)!.command.type).toBe('SECURE_LOAD');
    for (const type of ['STOP_EFFECTS', 'SECURE_LOAD', 'ORDINARY_SIDE_EXIT', 'WITHDRAW'] as const)
      expect(actions.find(a => a.command.type === type)!.enabled).toBe(true);
    expect(r.step('SECURE_LOAD').seconds).toBe(60);
    expect(r.state.load).toMatchObject({ secured: true, latchUsed: true, condition: 65, landed: 'NOT_RELEASED' });
    expect(r.block('SECURE_LOAD')).not.toBeNull(); expect(r.block('BOUNDED_MISFORTUNE_DIVERSION')).not.toBeNull();
    r.step('CROSS'); expect(r.state.observer.lostSight).toBe(false); expect(r.state.load.landed).toBe('NOT_RELEASED');
    expect(r.step('ORDINARY_SIDE_EXIT').seconds).toBe(88); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', position: 0, reported: true });
    expect(r.state.residents.map(p => p.position)).toEqual([0, 0]); expect(r.state.residents.map(p => p.injuries)).toEqual(oldInjuries);
    expect(r.b).toEqual(budget); expect(r.state.journal.at(-1)!.summary).toContain('2名原居民抵达');
    expect(r.block('REPORT')).not.toBeNull();
  });

  it('lets the actor leave alone after permission is withdrawn and reports tail positions rather than historical shelter positions', () => {
    const r = scene(); r.ready(); r.step('SHORT_CONCEALMENT', 20); r.step('BOUNDED_MISFORTUNE_DIVERSION', 20);
    r.state.residents[1]!.consenting = false; // Explicit current-scene withdrawal after both attempts.
    r.b.actions = 0; r.b.cash = 0;
    const people = structuredClone(r.state.residents), budget = structuredClone(r.b), time = r.nowSecond;
    expect(r.block('ORDINARY_SIDE_EXIT')).not.toBeNull(); expect(r.block('REPORT')).not.toBeNull();
    expect(r.step('WITHDRAW').seconds).toBe(80);
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', position: 0, concealment: { expiresSecond: null }, diversion: { expiresSecond: null } });
    expect(r.state.residents).toEqual(people); expect(r.nowSecond).toBe(time + 80); expect(r.b).toEqual(budget);
    r.step('REPORT'); expect(r.state.journal.at(-1)!.summary).toContain('0名原居民抵达');
    const view = projectDarknessEpilogue(r.state, r.evacuation);
    expect(view.lines).toContainEqual(expect.stringContaining('莱娜：当前位置40米'));
    expect(view.lines).toContainEqual(expect.stringContaining('诺亚：当前位置40米'));
    expect(view.lines).toContainEqual(expect.stringContaining('夜间撤离表保留原抵达历史'));
    expect(r.evacuation.residents.every(p => p.position === 110)).toBe(true);
    expect(JSON.stringify(r.evacuation)).toBe(r.originalBytes);
    expect(JSON.stringify(view)).not.toMatch(/eventId|originalArrivalId|seed|cursor|sourceDigest/);
  });

  it('makes severe backlash death terminal for every action and rejects a living unpromoted actor', () => {
    const r = scene(); r.ready(); r.b.health = 20; // Explicit low-health fixture, no resurrection or free recovery.
    r.step('SHORT_CONCEALMENT', 99);
    expect(r.b).toMatchObject({ health: 0, status: 'DEAD', actions: 2, spirituality: 88, mind: 74 });
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', position: 40, concealment: { expiresSecond: null } });
    expect(r.state.residents.map(p => p.position)).toEqual([40, 40]);
    const dead = structuredClone(r.b), terminal = structuredClone(r.state);
    for (const action of getDarknessEpilogueActions(r.state, r.b, r.evacuation, r.nowSecond)) {
      expect(action.enabled).toBe(false);
      expect(() => r.step(action.command.type)).toThrow('在世');
    }
    expect(r.b).toEqual(dead); expect(r.state).toEqual(terminal);
    const unpromoted = scene(); unpromoted.b.sequence = 1;
    expect(getDarknessEpilogueActions(unpromoted.state, unpromoted.b, unpromoted.evacuation, unpromoted.nowSecond).every(a => !a.enabled)).toBe(true);
  });

  it('rejects forged outcomes, consent, residents, timing, money and unknown commands at the public command boundary', () => {
    const r = scene(); r.ready(); const before = structuredClone(r.state), budget = structuredClone(r.b);
    expect(validateDarknessEpilogueCommand({ type: 'CROSS' })).toBe(true);
    const invalid: unknown[] = [null, [], {}, 'CROSS', { type: 'RESURRECT' },
      ...[{ success: true }, { roll: 1 }, { check: controlledCheck(20) }, { consenting: true },
        { returnWillingness: 'ACCEPT' }, { residentIds: ['NEW-RESIDENT'] }, { position: 0 },
        { nowSecond: r.nowSecond }, { cash: 999 }, { free: true }].map(extra => ({ type: 'CROSS', ...extra }))];
    for (const command of invalid) {
      expect(validateDarknessEpilogueCommand(command)).toBe(false);
      expect(() => applyDarknessEpilogue(r.state, command as DarknessEpilogueCommand, r.b, r.evacuation, {
        eventId: 'forged-command', revision: r.revision, nowSecond: r.nowSecond, check: null,
      })).toThrow('无效');
    }
    expect(r.state).toEqual(before); expect(r.b).toEqual(budget); expect(JSON.stringify(r.evacuation)).toBe(r.originalBytes);
  });
});
