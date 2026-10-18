import { describe, expect, it } from 'vitest';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { TYRANT_COASTS, applyTyrantCoast, createTyrantCoasts, type TyrantCoastCommand, type TyrantHost } from '../../src/domain/tyrant/coasts.js';
import {
  TYRANT_EPILOGUE_ABILITY_IDS, TYRANT_EPILOGUE_LOCATION, applyTyrantEpilogue, createTyrantEpilogue,
  getTyrantEpilogueActions, projectTyrantEpilogue, tyrantEpilogueBlock, tyrantEpilogueNeedsCheck,
  validateTyrantEpilogueCommand, type TyrantEpilogueCommand,
} from '../../src/domain/tyrant/epilogue.js';

const [DIVERSION, RELEASE] = TYRANT_EPILOGUE_ABILITY_IDS;
/** Directed component evidence: original coast fulfillments and later reviews
 * run through their own reducer first. S0 promotion and resolved rolls are
 * explicit host fixtures, not evidence of a saved natural promotion run. */
function scene() {
  const h: TyrantHost = { actorId: 'original-actor', eventId: 'coast-1', revision: 1,
    status: 'ACTIVE', sequence: 1, week: 200, weekAnchor: 0, nowSecond: 36000, location: TYRANT_COASTS[0].location,
    cash: 500, actions: 50, health: 100, mind: 100, spirituality: 120, check: null, seaVoyages: [] };
  let coasts = createTyrantCoasts('epilogue-component', h.actorId, h.week, h.nowSecond);
  const pay = (e: { cashCost: number; cashGain: number; actions: number; spirituality: number; health: number; mind: number; seconds: number }) => {
    h.cash -= e.cashCost; h.cash += e.cashGain; h.actions -= e.actions; h.spirituality -= e.spirituality;
    h.health = Math.max(0, h.health - e.health); h.mind = Math.max(0, h.mind - e.mind); h.nowSecond += e.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (h.health <= 0 || h.mind <= 0) h.status = 'DEAD';
    h.revision++; h.eventId = `scene-${h.revision}`; h.check = null;
  };
  const coastStep = (c: TyrantCoastCommand) => {
    h.check = c.type === 'FULFILL' ? resolveNormalCheck({ ability: 'will', baseAbility: 30, difficulty: 20, modifiers: [], roll: 20 }) : null;
    const r = applyTyrantCoast(coasts, c, h); coasts = r.state; pay(r.effect);
  };
  for (const p of TYRANT_COASTS) {
    h.location = p.location;
    for (const type of ['SURVEY', 'ASK_PERMISSION', 'FULFILL', 'RETURN_TO_HARBOR'] as const) coastStep({ type, coastId: p.id });
  }
  h.nowSecond = h.weekAnchor + 604800; h.weekAnchor += 604800; h.week++;
  for (const p of TYRANT_COASTS) {
    h.location = p.location; coastStep({ type: 'REVIEW_NEXT_WEEK', coastId: p.id }); coastStep({ type: 'RETURN_TO_HARBOR', coastId: p.id });
  }
  const originalCoastBytes = JSON.stringify(coasts);
  h.sequence = 0; h.location = TYRANT_EPILOGUE_LOCATION; h.actions = 3; h.spirituality = 100; h.mind = 100; h.health = 90;
  let state = createTyrantEpilogue(coasts, { week: h.week, nowSecond: h.nowSecond, actorId: h.actorId });
  const mastery: Record<string, number> = { [DIVERSION]: 0, [RELEASE]: 0, 'tyrant.s1.guided-thunder': 13 };
  const currentInjuries: { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: number | null }[] = [];
  const step = (type: TyrantEpilogueCommand['type'], roll = 20) => {
    const c: TyrantEpilogueCommand = { type };
    h.check = tyrantEpilogueNeedsCheck(c) ? resolveNormalCheck({ ability: 'will', baseAbility: 28, difficulty: 48, modifiers: [{ source: '本人本次有限施术', value: 30 }], roll }) : null;
    const before = structuredClone(state), result = applyTyrantEpilogue(state, c, h);
    expect(state).toEqual(before); expect(JSON.stringify(coasts)).toBe(originalCoastBytes);
    expect(result.effect.cashGain).toBe(0); expect(result.effect.health).toBeGreaterThanOrEqual(0);
    expect(result.effect.mind).toBeGreaterThanOrEqual(0); expect(result.effect.spirituality).toBeGreaterThanOrEqual(0);
    state = result.state;
    for (const [id, gain] of Object.entries(result.masteryGains)) mastery[id] = (mastery[id] ?? 0) + gain;
    currentInjuries.push(...result.injuries); pay(result.effect);
    expect(state.pressure.remainingUnits + state.sink.absorbedUnits).toBe(36);
    return result;
  };
  const start = () => { step('OBSERVE'); step('ASK_PERMISSION'); };
  const ordinary = () => { start(); step('ISOLATE'); step('RESCUE_IVA'); step('RESCUE_TOMAS'); };
  const energyReady = () => { step('VERIFY_ENERGY'); step('BUY_CARRIER'); step('VERIFY_MATERIAL'); };
  const block = (type: TyrantEpilogueCommand['type']) => tyrantEpilogueBlock(state, { type }, h);
  return { h, coasts, originalCoastBytes, mastery, currentInjuries, step, start, ordinary, energyReady, block, get state() { return state; } };
}

describe('Tyrant finite original-water rescue and original-energy release', () => {
  it('requires actual same-actor coast reviews without copying residents, grain or injury history into the new accident', () => {
    const r = scene(), empty = createTyrantCoasts('empty', r.h.actorId, 200, 0);
    expect(() => createTyrantEpilogue(empty, { week: 201, nowSecond: 604800 })).toThrow();
    expect(() => createTyrantEpilogue(r.coasts, { week: r.h.week, nowSecond: r.h.nowSecond, actorId: 'different' })).toThrow();
    expect(r.state.origin.coastReviewEventIds).toEqual(r.coasts.coasts.map(c => c.review!.eventId));
    expect(r.state.origin.coastJournalEventIds).toEqual(r.coasts.journal.map(j => j.id));
    expect(r.state.residents.map(p => ({ name: p.name, age: p.age, position: p.position, severity: p.injury.severity, permission: p.permission, arrival: p.arrival }))).toEqual([
      { name: '伊芙', age: 32, position: 8, severity: 'LIGHT', permission: null, arrival: null },
      { name: '托马斯', age: 47, position: 14, severity: 'HEAVY', permission: null, arrival: null },
    ]);
    expect(r.coasts.coasts.map(c => c.grain)).toEqual([12, 12, 3]);
    expect(r.block('DIVERT_WATER')).not.toBeNull(); expect(r.block('RESCUE_IVA')).not.toBeNull();
    // Real ascension is the engine's responsibility; old review expiry does not
    // revoke an already ascended character's opportunity to help these people.
    expect(() => createTyrantEpilogue(r.coasts, { week: r.h.week + 20, nowSecond: r.h.nowSecond + 20 * 604800 })).not.toThrow();
  });

  it('pays20 spirituality8 mind once and grants mastery only on real complete escape inside the90-second window', () => {
    const r = scene(); r.start(); const begun = r.step('DIVERT_WATER');
    expect(begun.effect).toMatchObject({ actions: 1, spirituality: 20, mind: 8, seconds: 4 });
    expect(r.h).toMatchObject({ actions: 2, spirituality: 80, mind: 92, health: 90 });
    expect(r.state.diversion.expiresSecond).toBe(r.h.nowSecond + 90);
    expect(r.state.residents.map(p => p.position)).toEqual([8, 14]); expect(r.mastery[DIVERSION]).toBe(0);
    const first = r.step('RESCUE_IVA'); expect(first.masteryGains).toEqual({ [DIVERSION]: 8 });
    expect(r.state.residents[0]!.arrival).toMatchObject({ from: 8, to: 0, walkedMeters: 16, route: 'DIVERTED_WATER', diversionEventId: begun.state.diversion.receipt!.eventId });
    expect(r.state.residents[1]!.position).toBe(14);
    const second = r.step('RESCUE_TOMAS'); expect(second.masteryGains).toEqual({});
    expect(r.state.diversion.assists).toHaveLength(2); expect(r.mastery[DIVERSION]).toBe(8);
    expect(r.state.diversion.expiresSecond! - r.h.nowSecond).toBe(2);
    expect(r.state.residents.map(p => p.injury.active)).toEqual([true, true]);
    expect(r.mastery['tyrant.s1.guided-thunder']).toBe(13); expect(r.block('DIVERT_WATER')).not.toBeNull();
    expect(r.block('RESCUE_TOMAS')).not.toBeNull();
  });

  it('does not count a late-started rescue that would finish outside the window and uses ordinary isolation instead', () => {
    const r = scene(); r.start(); r.step('DIVERT_WATER'); r.h.nowSecond += 59;
    expect(r.block('RESCUE_IVA')).not.toBeNull(); // 59 + 32 > 90, though the window is still visible.
    r.step('ISOLATE'); r.step('RESCUE_IVA'); r.step('RESCUE_TOMAS'); r.step('REPORT');
    expect(r.state.diversion).toMatchObject({ attempted: true, passed: true, applied: false, expiresSecond: null, assists: [] });
    expect(r.state.residents.every(p => p.arrival!.route === 'ORDINARY_SHORE')).toBe(true);
    expect(r.mastery[DIVERSION]).toBe(0); expect(r.h.spirituality).toBe(80);
  });

  it('counts an escape finishing exactly at expiry, but cannot credit the next person after expiry', () => {
    const r = scene(); r.start(); r.step('DIVERT_WATER'); r.h.nowSecond += 58;
    expect(r.block('RESCUE_IVA')).toBeNull(); r.step('RESCUE_IVA');
    expect(r.h.nowSecond).toBe(r.state.diversion.expiresSecond); expect(r.mastery[DIVERSION]).toBe(8);
    expect(r.block('RESCUE_TOMAS')).not.toBeNull(); r.step('SECURE_ROPE'); r.step('RESCUE_TOMAS');
    expect(r.state.residents[1]!.arrival!.route).toBe('ORIGINAL_ROPE'); expect(r.state.diversion.assists).toHaveLength(1);
  });

  it('permits full ordinary shore rescue without spending money, actions or spirituality and never requires power success', () => {
    const r = scene(); r.h.cash = 0; r.h.actions = 0; r.h.spirituality = 0;
    r.ordinary(); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', reported: true, position: 0, pressure: { remainingUnits: 36 }, sink: { absorbedUnits: 0 } });
    expect(r.state.diversion.attempted).toBe(false); expect(r.state.release.attempted).toBe(false);
    expect(r.state.residents.every(p => p.position === 0 && p.injury.active && p.arrival!.route === 'ORDINARY_SHORE')).toBe(true);
    expect(r.h).toMatchObject({ cash: 0, actions: 0, spirituality: 0, health: 90, mind: 100 });
    expect(getTyrantEpilogueActions(r.state, r.h).some(a => a.enabled)).toBe(false);
  });

  it('keeps ordinary rope rescue available after a paid failed diversion, without creating new victims or washing away wounds', () => {
    const r = scene(); r.start(); const wounds = JSON.stringify(r.state.residents.map(p => p.injury));
    r.step('DIVERT_WATER', 90); expect(r.mastery[DIVERSION]).toBe(0);
    expect(r.h).toMatchObject({ health: 84, mind: 90, spirituality: 80 });
    r.h.actions = 0; r.h.cash = 0; r.h.spirituality = 0;
    r.step('SECURE_ROPE'); r.step('RESCUE_IVA'); r.step('RESCUE_TOMAS'); r.step('ISOLATE'); r.step('REPORT');
    expect(r.state.rope).toMatchObject({ condition: 82, uses: 2 });
    expect(r.state.residents.every(p => p.arrival!.route === 'ORIGINAL_ROPE')).toBe(true);
    expect(JSON.stringify(r.state.residents.map(p => p.injury))).toBe(wounds);
    expect(r.state.playerInjuries).toHaveLength(1); expect(r.h.health).toBe(84); expect(r.mastery[DIVERSION]).toBe(0);
  });

  it('requires a paid unique original conduit plus independent source and material tests before releasing exactly original36 to a physical sink', () => {
    const r = scene(); r.ordinary(); const cash = r.h.cash;
    expect(r.block('RELEASE_ENERGY')).not.toBeNull();
    r.step('BUY_CARRIER'); expect(r.h.cash).toBe(cash - 24);
    expect(r.block('BUY_CARRIER')).not.toBeNull(); expect(r.block('VERIFY_MATERIAL')).not.toBeNull();
    r.step('VERIFY_ENERGY'); expect(r.state.pressure.verification).toMatchObject({ measuredUnits: 36, independentMechanicalTest: true, actorId: r.h.actorId });
    expect(r.block('RELEASE_ENERGY')).not.toBeNull(); r.step('VERIFY_MATERIAL');
    expect(r.state.carrier.verification).toMatchObject({ carrierId: r.state.carrier.id, independentContinuityTest: true });
    expect(r.state.carrier).toMatchObject({ holder: 'CONNECTION', position: 4, condition: 79 });
    const release = r.step('RELEASE_ENERGY');
    expect(release.effect).toMatchObject({ actions: 1, spirituality: 16, mind: 10, seconds: 4 });
    expect(r.state.pressure.remainingUnits).toBe(0); expect(r.state.sink.absorbedUnits).toBe(36);
    expect(r.state.carrier).toMatchObject({ stock: 0, ownerId: r.h.actorId, holder: 'SINK', condition: 0, consumed: { originalUnitsTransferred: 36 } });
    expect(release.masteryGains).toEqual({ [RELEASE]: 8 }); expect(r.state.release.transferredUnits).toBe(36);
    expect(r.block('RELEASE_ENERGY')).not.toBeNull(); expect(r.block('BUY_CARRIER')).not.toBeNull(); expect(r.block('VERIFY_MATERIAL')).not.toBeNull();
    const projection = projectTyrantEpilogue(r.state, r.currentInjuries, r.h.nowSecond);
    expect(projection.story).toContain('当前剩0份'); expect(projection.story).not.toContain('当前剩36份');
    expect(projection.lines.some(l => l.includes('已经实际烧结消耗'))).toBe(true);
    r.step('REPORT'); expect(r.state.status).toBe('RESOLVED');
  });

  it('cannot leave a still-endangered resident to farm conversion and preserves unreleased original quantity on failed release', () => {
    const r = scene(); r.start(); r.step('ISOLATE'); r.energyReady();
    expect(r.block('RELEASE_ENERGY')).not.toBeNull();
    r.step('RESCUE_IVA'); r.step('RESCUE_TOMAS'); const result = r.step('RELEASE_ENERGY', 99);
    expect(result.injuries).toEqual([expect.objectContaining({ severity: 'HEAVY' })]);
    expect(r.state.pressure.remainingUnits).toBe(36); expect(r.state.sink.absorbedUnits).toBe(0);
    expect(r.state.carrier).toMatchObject({ stock: 0, condition: 0, consumed: { originalUnitsTransferred: 0 } });
    expect(r.mastery[RELEASE]).toBe(0); expect(r.h).toMatchObject({ health: 74, mind: 85, spirituality: 84 });
    expect(r.block('RELEASE_ENERGY')).not.toBeNull(); r.step('REPORT'); expect(r.state.status).toBe('RESOLVED');
  });

  it('withdraws physically without claiming missing rescues, healing original residents, or silently isolating the source', () => {
    const r = scene(); r.step('WITHDRAW'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', position: -8, reported: true, water: { connected: true, isolated: null }, pressure: { remainingUnits: 36 } });
    expect(r.state.residents.map(p => p.position)).toEqual([8, 14]); expect(r.state.residents.every(p => p.arrival === null)).toBe(true);
    expect(r.state.journal[0]).toMatchObject({ from: 0, to: -8, walkedMeters: 8, actorId: r.h.actorId });
    expect(projectTyrantEpilogue(r.state).lines.filter(l => l.includes('尚未抵岸'))).toHaveLength(2);
  });

  it('stops on actual death and retains consumed resources, original positions and recoil history', () => {
    const r = scene(); r.start(); r.h.health = 10; const dead = r.step('DIVERT_WATER', 99);
    expect(dead.effect.health).toBe(16); expect(r.state.status).toBe('DEAD'); expect(r.h.status).toBe('DEAD');
    expect(r.state.residents.map(p => p.position)).toEqual([8, 14]); expect(r.h.spirituality).toBe(80);
    for (const type of ['WITHDRAW', 'ISOLATE', 'RESCUE_IVA', 'REPORT'] as const) expect(r.block(type)).not.toBeNull();
    expect(getTyrantEpilogueActions(r.state, r.h).some(a => a.enabled)).toBe(false);
  });

  it('projects authoritative current injuries after treatment/rest while keeping immutable historical recoil evidence', () => {
    const r = scene(); r.start(); r.step('DIVERT_WATER', 99);
    expect(projectTyrantEpilogue(r.state, r.currentInjuries).lines[0]).toContain('重伤（未处置）');
    const treated = r.currentInjuries.map(i => ({ ...i, treatedRevision: r.h.revision }));
    expect(projectTyrantEpilogue(r.state, treated).lines[0]).toContain('已处置，仍在恢复');
    // The runtime owns later clinic/rest. An empty authoritative injury budget
    // must override this scene's immutable record of the previous injury.
    expect(projectTyrantEpilogue(r.state, []).lines[0]).toContain('当前没有未恢复伤势');
    expect(r.state.playerInjuries).toHaveLength(1); expect(r.state.journal.at(-1)!.notes.join('')).toContain('新增重伤');
  });

  it('rejects public result injection, stale event/time, foreign actors, remote actions and future private fields', () => {
    const r = scene();
    for (const extra of [{ roll: 1 }, { success: true }, { consent: true }, { energy: 999 }, { material: 'free' }, { expiresSecond: 99999999 }, { mastery: 8 }]) {
      expect(validateTyrantEpilogueCommand({ type: 'DIVERT_WATER', ...extra })).toBe(false);
    }
    expect(validateTyrantEpilogueCommand({ type: 'DIVERT_WATER' })).toBe(true);
    r.start(); const saved = { ...r.h };
    r.h.actorId = 'another'; expect(r.block('DIVERT_WATER')).not.toBeNull(); Object.assign(r.h, saved);
    r.h.location = 'elsewhere'; expect(r.block('DIVERT_WATER')).not.toBeNull(); Object.assign(r.h, saved);
    r.h.eventId = r.state.journal[0]!.eventId; expect(r.block('DIVERT_WATER')).not.toBeNull(); Object.assign(r.h, saved);
    r.h.nowSecond = r.state.lastSecond - 1; expect(r.block('DIVERT_WATER')).not.toBeNull(); Object.assign(r.h, saved);
    const poisoned = Object.assign(structuredClone(r.state), { random: { seed: 'private-seed', cursor: 123 }, source: { private: 'hidden-original' }, futureRoll: 1 });
    const projection = projectTyrantEpilogue(poisoned, []);
    expect(Object.keys(projection)).toEqual(['id', 'title', 'story', 'nextStep', 'lines']);
    for (const secret of ['private-seed', 'hidden-original', 'futureRoll', 'cursor']) expect(JSON.stringify(projection)).not.toContain(secret);
    expect(JSON.stringify(r.coasts)).toBe(r.originalCoastBytes);
    expect(computeCheckChance({ baseAbility: 28, difficulty: 48, modifiers: [{ source: '本人本次有限施术', value: 30 }] })).toBe(70);
  });
});
