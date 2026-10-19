import { describe, expect, it } from 'vitest';
import {
  applyDarknessEvacuation, canLeaveDarknessEvacuation, createDarknessEvacuation,
  DARKNESS_EVACUATION_LOCATION, DARKNESS_EVACUATION_POINTS, darknessEvacuationBlock,
  darknessEvacuationVerifiedReceipts, projectDarknessEvacuation, validateDarknessEvacuationCommand,
  type DarknessEvacuationCommand, type DarknessEvacuationHost, type DarknessEvacuationPoint, type DarknessResidentId,
} from '../../src/domain/darkness/evacuation.js';

/** Component fixtures only. Authored NPC willingness fixtures, clock advances, depletion and
 * test injuries below are explicit inputs, never a natural playthrough, save,
 * earned wage, or player-controlled consent. These tests were NOT RUN. */
function component() {
  const h: DarknessEvacuationHost = { eventId: 'evac-1', revision: 1, week: 200,
    actorId: 'original-player', location: DARKNESS_EVACUATION_LOCATION, nowSecond: 36000, weekAnchor: 0,
    sequence: 1, status: 'ACTIVE', cash: 108, actions: 3, health: 100, mind: 97, spirituality: 112, check: null };
  let state = createDarknessEvacuation('evacuation-component', h.actorId, h.week, h.nowSecond);
  const step = (c: DarknessEvacuationCommand, answer?: 'ACCEPT' | 'DECLINE') => {
    h.eventId = `evac-${h.revision}`;
    // Explicit pre-existing NPC willingness fixture. No public command can set it.
    if (answer && 'residentId' in c) state.residents.find(p => p.id === c.residentId)!.willingness = answer;
    const before = structuredClone(state), result = applyDarknessEvacuation(state, c, h);
    expect(state).toEqual(before); expect(result.effect.cashGain).toBe(0);
    expect(result.effect.mind).toBe(0); expect(result.effect.spirituality).toBe(0);
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions;
    h.health += result.effect.health; h.nowSecond += result.effect.seconds; h.revision++; h.eventId = `evac-${h.revision}`;
    return result;
  };
  const walk = (to: DarknessEvacuationPoint, pace: 'CAREFUL' | 'DIRECT' = 'CAREFUL') => step({ type: 'WALK', to, pace });
  const go = (to: DarknessEvacuationPoint) => {
    while (state.position !== to) {
      const index = DARKNESS_EVACUATION_POINTS.indexOf(state.position), direction = to > state.position ? 1 : -1;
      walk(DARKNESS_EVACUATION_POINTS[index + direction]!);
    }
  };
  const day = (declines: DarknessResidentId[] = []) => {
    step({ type: 'SURVEY_DAY' }); step({ type: 'BUY_SUPPLIES' });
    for (const id of ['DN-LENA', 'DN-JONAH', 'DN-ADA', 'DN-NOAH'] as const) {
      go(state.residents.find(p => p.id === id)!.position);
      step({ type: 'REGISTER_RESIDENT', residentId: id }, declines.includes(id) ? 'DECLINE' : 'ACCEPT');
    }
    go(110); step({ type: 'ORDINARY_RETURN' });
  };
  const night = () => { step({ type: 'WAIT_NIGHT' }); step({ type: 'BEGIN_NIGHT' }); };
  const handle = () => {
    step({ type: 'LIGHT', lampId: 'DN-LAMP-1' });
    go(25); step({ type: 'OBSERVE', hazard: 'FALSE_LIGHT' }); step({ type: 'SHIELD_FALSE_LIGHT' });
    go(55); step({ type: 'OBSERVE', hazard: 'NOISE' }); step({ type: 'RELAY_INSTRUCTIONS' });
  };
  const rescue = (id: DarknessResidentId) => {
    go(state.residents.find(p => p.id === id)!.position); step({ type: 'ESCORT', residentId: id }); go(110);
  };
  return { h, get state() { return state; }, step, walk, go, day, night, handle, rescue };
}

describe('Darkness finite ordinary evacuation candidate', () => {
  it('starts with four distinct current adults at actual homes and no free borrowed tools or blanket consent', () => {
    const r = component();
    expect(r.state.residents.map(p => [p.id, p.age, p.position, p.consent])).toEqual([
      ['DN-LENA', 32, 0, 'UNASKED'], ['DN-JONAH', 41, 10, 'UNASKED'], ['DN-ADA', 36, 25, 'UNASKED'], ['DN-NOAH', 58, 40, 'UNASKED'],
    ]);
    expect(r.state.supplies).toMatchObject({ stock: 1, lamps: [], rope: null, totalOilUsedSeconds: 0 });
    expect(darknessEvacuationVerifiedReceipts(r.state)).toEqual([]);
    expect(darknessEvacuationBlock(r.state, { type: 'REPORT' }, r.h)).not.toBeNull();
  });

  it('requires daylight in-person registration and real traversal of all 40+30+40 metres', () => {
    const r = component(); r.step({ type: 'SURVEY_DAY' }); r.step({ type: 'BUY_SUPPLIES' });
    expect(darknessEvacuationBlock(r.state, { type: 'REGISTER_RESIDENT', residentId: 'DN-NOAH' }, r.h)).toContain('当面');
    expect(darknessEvacuationBlock(r.state, { type: 'WALK', to: 110, pace: 'CAREFUL' }, r.h)).toContain('相邻');
    expect(r.state.survey.walkedEdges).toEqual([]);
    r.step({ type: 'REGISTER_RESIDENT', residentId: 'DN-LENA' }, 'ACCEPT');
    r.h.nowSecond = 72000;
    expect(darknessEvacuationBlock(r.state, { type: 'BEGIN_NIGHT' }, r.h)).toContain('亲走');
    expect(darknessEvacuationBlock(r.state, { type: 'REGISTER_RESIDENT', residentId: 'DN-JONAH' }, r.h)).not.toBeNull();
  });

  it('charges the single 108p kit and survey once, preserving finite physical identities', () => {
    const r = component(); r.day();
    expect(r.h).toMatchObject({ cash: 0, actions: 2, health: 100, mind: 97, spirituality: 112 });
    expect(r.state.survey.walkedEdges.sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(r.state.journal.reduce((m, rec) => m + rec.walkedMeters, 0)).toBe(220);
    expect(r.state.supplies.lamps.map(l => [l.id, l.oilSeconds])).toEqual([['DN-LAMP-1', 3600], ['DN-LAMP-2', 3600]]);
    expect(r.state.supplies.rope).toMatchObject({ id: 'DN-ROPE-1', condition: 100 });
    expect(darknessEvacuationBlock(r.state, { type: 'BUY_SUPPLIES' }, r.h)).not.toBeNull();
    expect(darknessEvacuationBlock(r.state, { type: 'SURVEY_DAY' }, r.h)).not.toBeNull();
  });

  it('does not replace an adult refusal with consent or move anyone through a report', () => {
    const r = component(); r.day(['DN-LENA']); r.night();
    expect(r.state.residents[0]!.consent).toBe('DECLINE');
    expect(darknessEvacuationBlock(r.state, { type: 'ESCORT', residentId: 'DN-LENA' }, r.h)).toContain('独立同意');
    expect(darknessEvacuationBlock(r.state, { type: 'REPORT' }, r.h)).not.toBeNull();
    expect(r.state.residents.map(p => p.position)).toEqual([0, 10, 25, 40]);
    r.step({ type: 'REVIEW_PERMISSION', residentId: 'DN-LENA' }, 'ACCEPT');
    r.step({ type: 'ESCORT', residentId: 'DN-LENA' }); r.walk(10);
    r.step({ type: 'REVIEW_PERMISSION', residentId: 'DN-LENA' }, 'DECLINE');
    expect(r.state.escortId).toBeNull(); expect(r.state.residents[0]!.position).toBe(10);
    expect(r.state.residents[0]!.permissionHistory.map(p => p.answer)).toEqual(['DECLINE', 'ACCEPT', 'DECLINE']);
    r.step({ type: 'ORDINARY_RETURN' });
    expect(r.state.residents[0]!.position).toBe(10); expect(r.state.residents[0]!.arrival).toBeNull();
  });

  it("reads this adult's own authored willingness and rejects public consent, result and host injection", () => {
    const r = component(); r.step({ type: 'SURVEY_DAY' });
    const c = { type: 'REGISTER_RESIDENT', residentId: 'DN-LENA' } as const;
    r.state.residents[0]!.willingness = 'DECLINE'; // Explicit private-state refusal fixture.
    r.step(c); expect(r.state.residents[0]!.consent).toBe('DECLINE');
    expect(darknessEvacuationBlock(r.state, { type: 'REVIEW_PERMISSION', residentId: 'DN-LENA' }, r.h)).toContain('没有变化');
    for (const extra of [{ consent: true }, { willingness: 'ACCEPT' }, { position: 110 }, { nowSecond: 72000 }, { cash: 999 }, { success: true }]) expect(validateDarknessEvacuationCommand({ ...c, ...extra })).toBe(false);
    expect(validateDarknessEvacuationCommand({ type: 'ESCORT', residentId: 'NEW-RESIDENT' })).toBe(false);
  });

  it('needs a real night and observes each existing hazard at its own position', () => {
    const r = component(); r.day();
    expect(darknessEvacuationBlock(r.state, { type: 'BEGIN_NIGHT' }, r.h)).not.toBeNull();
    r.night(); expect(r.h.actions).toBe(1);
    expect(darknessEvacuationBlock(r.state, { type: 'OBSERVE', hazard: 'FALSE_LIGHT' }, r.h)).not.toBeNull();
    r.handle();
    expect(r.state.falseLight.shieldedEventId).not.toBeNull(); expect(r.state.noise.markedEventId).not.toBeNull();
    expect(r.state.supplies.rope!.usedMeters).toBe(2);
    expect(r.state.residents.map(p => p.position)).toEqual([0, 10, 25, 40]);
  });

  it('walks a willing adult segment by segment, with slower assistance and independent arrival', () => {
    const r = component(); r.day(); r.night(); r.step({ type: 'ESCORT', residentId: 'DN-LENA' });
    const first = r.walk(10);
    expect(first.effect).toMatchObject({ seconds: 40, actions: 0, cashCost: 0 });
    expect(r.state.residents.map(p => p.position)).toEqual([10, 10, 25, 40]);
    expect(r.state.residents[0]!.arrival).toBeNull();
    r.go(110); expect(r.state.escortId).toBeNull();
    expect(r.state.residents[0]!.arrival).toMatchObject({ nightId: 0, second: r.h.nowSecond });
    expect(r.state.residents.slice(1).every(p => !p.arrival)).toBe(true);
    const arrived = structuredClone(r.state.residents[0]); r.step({ type: 'ORDINARY_RETURN' });
    expect(r.state.residents[0]).toEqual(arrived);
  });

  it('can finish ordinary evacuation with no AP, no cash and extinguished lamps, without claiming ritual completion', () => {
    const r = component(); r.day(); r.night(); r.h.actions = 0; r.h.cash = 0;
    for (const l of r.state.supplies.lamps) l.oilSeconds = 0; // Explicit exhausted-lamp fixture.
    for (const id of ['DN-LENA', 'DN-NOAH', 'DN-ADA', 'DN-JONAH'] as const) r.rescue(id);
    r.step({ type: 'ORDINARY_RETURN' });
    expect(r.state.residents.every(p => p.position === 110 && p.arrival)).toBe(true);
    expect(canLeaveDarknessEvacuation(r.state)).toBe(true);
    expect(r.h).toMatchObject({ cash: 0, actions: 0, health: 100 });
    expect(darknessEvacuationVerifiedReceipts(r.state)).toEqual([]);
  });

  it('allows in-person ordinary aid even before any paid survey, with zero or overdrawn resources', () => {
    const r = component(); r.h.actions = 0; r.h.cash = 0;
    r.step({ type: 'REVIEW_PERMISSION', residentId: 'DN-LENA' });
    r.step({ type: 'ESCORT', residentId: 'DN-LENA' }); r.go(110);
    r.h.actions = -1; r.h.cash = -1; // Explicit existing deficit; no cost is charged.
    r.step({ type: 'ORDINARY_RETURN' });
    expect(r.state.residents[0]!.position).toBe(110); expect(r.state.residents[0]!.registeredEventId).toBeNull();
    expect(r.state.survey.startedEventId).toBeNull(); expect(r.state.supplies.lamps).toEqual([]);
    expect(r.h).toMatchObject({ actions: -1, cash: -1 }); expect(canLeaveDarknessEvacuation(r.state)).toBe(true);
    expect(darknessEvacuationVerifiedReceipts(r.state)).toEqual([]);
  });

  it('burns exact lamp-seconds including external elapsed time, with no reset after lamp exhaustion', () => {
    const r = component(); r.day(); r.night();
    r.step({ type: 'LIGHT', lampId: 'DN-LAMP-1' }); expect(r.state.supplies.lamps[0]!.oilSeconds).toBe(3595);
    r.h.nowSecond += 4000; // Explicit host clock input; no wages/AP/healing.
    const before = r.h.nowSecond; r.walk(10);
    expect(r.state.supplies.lamps[0]).toMatchObject({ oilSeconds: 0, lit: false });
    expect(r.state.supplies.lamps[1]!.oilSeconds).toBe(3600);
    expect(r.state.supplies.totalOilUsedSeconds).toBe(3600); expect(r.h.nowSecond - before).toBe(20);
    expect(darknessEvacuationBlock(r.state, { type: 'LIGHT', lampId: 'DN-LAMP-1' }, r.h)).not.toBeNull();
    expect(darknessEvacuationBlock(r.state, { type: 'WALK', to: 25, pace: 'DIRECT' }, r.h)).toContain('灯油');
    expect(darknessEvacuationBlock(r.state, { type: 'WALK', to: 25, pace: 'CAREFUL' }, r.h)).toBeNull();
  });

  it('keeps genuine damage and injuries after risky unhandled movement, release and ordinary return', () => {
    const r = component(); r.day(); r.night(); r.go(25);
    r.step({ type: 'LIGHT', lampId: 'DN-LAMP-1' }); r.step({ type: 'ESCORT', residentId: 'DN-ADA' });
    r.walk(40, 'DIRECT');
    expect(r.state.residents[2]!.injuries).toHaveLength(1);
    expect(r.state.supplies.lamps[0]!.condition).toBe(90); expect(r.state.supplies.rope!.condition).toBe(95);
    const injuries = structuredClone(r.state.residents[2]!.injuries), oil = r.state.supplies.lamps[0]!.oilSeconds;
    expect(r.state.escortId).toBeNull(); expect(r.state.residents[2]!.consent).toBe('DECLINE');
    r.h.actions = 0; r.step({ type: 'ORDINARY_RETURN' });
    expect(r.state.residents[2]!.position).toBe(40); expect(r.state.residents[2]!.arrival).toBeNull();
    expect(r.state.residents[2]!.injuries).toEqual(injuries); expect(r.state.supplies.lamps[0]!.condition).toBe(90);
    expect(r.state.supplies.lamps[0]!.oilSeconds).toBeLessThanOrEqual(oil);
    expect(r.state.residents).toHaveLength(4);
    r.go(25); r.step({ type: 'OBSERVE', hazard: 'FALSE_LIGHT' }); r.step({ type: 'SHIELD_FALSE_LIGHT' }); r.go(40);
    r.step({ type: 'REVIEW_PERMISSION', residentId: 'DN-ADA' });
    expect(r.state.residents[2]!.consent).toBe('ACCEPT'); expect(r.state.residents[2]!.injuries).toEqual(injuries);
  });

  it('records the player injury as a real health effect and never heals it on exit', () => {
    const r = component(); r.day(); r.night(); r.go(25); r.step({ type: 'LIGHT', lampId: 'DN-LAMP-1' });
    const hit = r.walk(40, 'DIRECT'); expect(hit.effect.health).toBe(-3); expect(r.h.health).toBe(97);
    r.step({ type: 'ORDINARY_RETURN' }); expect(r.h.health).toBe(97); expect(r.state.playerInjuries).toHaveLength(1);
  });

  it('does not treat a marked noisy road as proof that each later adult heard the instructions', () => {
    const r = component(); r.day(); r.night(); r.handle(); r.go(40);
    r.step({ type: 'ESCORT', residentId: 'DN-NOAH' }); r.go(55);
    expect(r.state.noise.relayedResidentIds).toEqual([]);
    r.step({ type: 'RELAY_INSTRUCTIONS' }); expect(r.state.noise.relayedResidentIds).toEqual(['DN-NOAH']);
    expect(darknessEvacuationBlock(r.state, { type: 'RELAY_INSTRUCTIONS' }, r.h)).not.toBeNull();
  });

  it('resumes a later actual night without recreating adults, clearing damage or resetting resolved hazards', () => {
    const r = component(); r.day(); r.night(); r.handle(); r.rescue('DN-NOAH'); r.step({ type: 'ORDINARY_RETURN' });
    const adult = structuredClone(r.state.residents[3]), hazard = structuredClone(r.state.falseLight), supplies = structuredClone(r.state.supplies);
    r.step({ type: 'WAIT_NIGHT' }); r.step({ type: 'BEGIN_NIGHT' });
    expect(r.state.nights.map(n => n.id)).toEqual([0, 1]); expect(r.h.actions).toBe(0);
    expect(r.state.residents[3]).toEqual(adult); expect(r.state.falseLight).toEqual(hazard); expect(r.state.supplies).toEqual(supplies);
    expect(r.state.residents).toHaveLength(4);
  });

  it('closes only after all four real night arrivals, real ordinary return, and the third paid phase', () => {
    const r = component(); r.day(); r.night(); r.handle();
    for (const id of ['DN-LENA', 'DN-NOAH', 'DN-ADA', 'DN-JONAH'] as const) r.rescue(id);
    expect(darknessEvacuationBlock(r.state, { type: 'REPORT' }, r.h)).not.toBeNull();
    r.step({ type: 'ORDINARY_RETURN' }); const before = structuredClone(r.state.residents); r.step({ type: 'REPORT' });
    expect(r.h).toMatchObject({ cash: 0, actions: 0, health: 100, mind: 97, spirituality: 112 });
    expect(r.state.residents).toEqual(before); expect(darknessEvacuationVerifiedReceipts(r.state).length).toBeGreaterThan(10);
    expect(darknessEvacuationBlock(r.state, { type: 'REPORT' }, r.h)).not.toBeNull();
    expect(darknessEvacuationBlock(r.state, { type: 'ESCORT', residentId: 'DN-LENA' }, r.h)).not.toBeNull();
    expect(JSON.stringify(projectDarknessEvacuation(r.state, r.h.nowSecond))).toContain('已到达4/4');
  });

  it('does not call daytime safety a real nighttime arrival or recreate the completed person later', () => {
    const r = component(); r.day(); r.rescue('DN-LENA'); r.step({ type: 'ORDINARY_RETURN' });
    const before = structuredClone(r.state.residents[0]); expect(before.arrival!.nightId).toBeNull();
    r.night(); expect(r.state.residents[0]).toEqual(before); expect(darknessEvacuationVerifiedReceipts(r.state)).toEqual([]);
  });

  it('rejects duplicate events, backwards time and a different actor without mutating input', () => {
    const r = component(); r.step({ type: 'SURVEY_DAY' }); const before = structuredClone(r.state), last = r.state.journal[0]!;
    expect(() => applyDarknessEvacuation(r.state, { type: 'BUY_SUPPLIES' }, { ...r.h, eventId: last.id })).toThrow();
    expect(() => applyDarknessEvacuation(r.state, { type: 'BUY_SUPPLIES' }, { ...r.h, nowSecond: r.state.lastSecond - 1 })).toThrow();
    expect(() => applyDarknessEvacuation(r.state, { type: 'BUY_SUPPLIES' }, { ...r.h, actorId: 'different-person', eventId: 'fresh' })).toThrow();
    expect(r.state).toEqual(before);
  });
});
