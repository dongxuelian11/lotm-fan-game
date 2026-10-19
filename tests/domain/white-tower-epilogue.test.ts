import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { WhiteTowerHost } from '../../src/domain/white-tower/ports.js';
import {
  WHITE_TOWER_PASSAGES, applyWhiteTowerPassages, createWhiteTowerPassages, whiteTowerPassagesComplete,
  type WhiteTowerPassageCommand,
} from '../../src/domain/white-tower/passages.js';
import {
  applyWhiteTowerEpilogue, createWhiteTowerEpilogue, getWhiteTowerEpilogueActions,
  projectWhiteTowerEpilogue, validateWhiteTowerEpilogueCommand, whiteTowerEpilogueBlock,
  type WhiteTowerEpilogueCommand,
} from '../../src/domain/white-tower/epilogue.js';

const INSIGHT = 'reader.s0.structural-insight', WEAKNESS = 'reader.s0.bounded-weak-point';
/** Directed component evidence only. Three original passages are performed
 * through their real reducer first. Location changes, calendar boundaries,
 * the S0 host budget and resolved rolls are explicit test inputs. No fabricated
 * promotion or saved runtime is admitted. Test execution belongs to the parent. */
function scene() {
  const h: WhiteTowerHost = { eventId: 'setup-1', revision: 1, week: 200,
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 5, day: 1 }, actorId: 'same-actor', sourceDigest: 'component-source',
    location: 'WT0-MARKET', nowSecond: 36000, weekAnchor: 0, sequence: 1, status: 'ACTIVE',
    cash: 500, actions: 50, health: 100, mind: 100, spirituality: 120, check: null,
    passageReceipts: [], legacyAccess: null, succession: null };
  let passages = createWhiteTowerPassages('epilogue-component', h.actorId, h.week, h.nowSecond);
  const payAndAdvance = (effect: { cashCost: number; actions: number; health: number; mind: number; spirituality: number; seconds: number }) => {
    h.cash -= effect.cashCost; h.actions -= effect.actions; h.health = Math.max(0, h.health - effect.health);
    h.mind = Math.max(0, h.mind - effect.mind); h.spirituality -= effect.spirituality; h.nowSecond += effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (h.health <= 0 || h.mind <= 0) h.status = 'DEAD';
    h.revision++; h.eventId = `scene-${h.revision}`; h.check = null;
  };
  const passageStep = (command: WhiteTowerPassageCommand) => {
    h.check = command.type === 'BUILD' ? resolveNormalCheck({ ability: 'knowledge', baseAbility: 31, difficulty: 44, modifiers: [{ source: 'controlled mechanical preparation', value: 30 }], roll: 20 }) : null;
    const result = applyWhiteTowerPassages(passages, command, h); passages = result.state; payAndAdvance(result.effect);
  };
  for (const p of WHITE_TOWER_PASSAGES) {
    h.location = p.location;
    for (const type of ['SURVEY', 'ASK_PERMISSION', 'BUY_MATERIALS', 'BUILD', 'ACCEPT_WORK', 'RETURN_ON_FOOT', 'PASS_RESIDENT', 'RETURN_ON_FOOT'] as const) passageStep({ type, passageId: p.id });
  }
  h.nowSecond = h.weekAnchor + 604800; h.weekAnchor += 604800; h.week++;
  for (const p of WHITE_TOWER_PASSAGES) { h.location = p.location; passageStep({ type: 'REVIEW_NEXT_WEEK', passageId: p.id }); passageStep({ type: 'RETURN_ON_FOOT', passageId: p.id }); }
  expect(whiteTowerPassagesComplete(passages)).toBe(true);
  const passageBytes = JSON.stringify(passages);
  // Explicit S0 component fixture. End-to-end promotion is covered elsewhere.
  h.sequence = 0; h.location = 'WT0-GATE'; h.actions = 3; h.spirituality = 100; h.mind = 100; h.health = 90;
  let state = createWhiteTowerEpilogue(passages, { week: h.week, nowSecond: h.nowSecond, actorId: h.actorId });
  const mastery: Record<string, number> = { [INSIGHT]: 0, [WEAKNESS]: 0, 'reader.s1.original-test-skill': 13 };
  const step = (type: WhiteTowerEpilogueCommand['type'], roll = 20) => {
    h.check = type === 'STRUCTURAL_INSIGHT' ? resolveNormalCheck({ ability: 'perception', baseAbility: 30, difficulty: 47, modifiers: [{ source: 'bounded current preparation', value: 30 }], roll })
      : type === 'BOUNDED_WEAK_POINT' ? resolveNormalCheck({ ability: 'will', baseAbility: 28, difficulty: 48, modifiers: [{ source: 'bounded current preparation', value: 30 }], roll }) : null;
    const before = structuredClone(state), result = applyWhiteTowerEpilogue(state, { type }, h);
    expect(state).toEqual(before); expect(JSON.stringify(passages)).toBe(passageBytes); expect(result.effect.cashGain).toBe(0);
    expect(result.effect.health).toBeGreaterThanOrEqual(0); expect(result.effect.mind).toBeGreaterThanOrEqual(0);
    state = result.state; for (const [id, gain] of Object.entries(result.masteryGains)) mastery[id] = (mastery[id] ?? 0) + gain;
    payAndAdvance(result.effect); return result;
  };
  const first = (roll = 20) => { step('OBSERVE'); step('ASK_PERMISSION'); step('STRUCTURAL_INSIGHT', roll); };
  const counter = (roll = 20) => { first(roll); step('VERIFY_STRUCTURE'); step('CLEAR_SCREEN'); step('OBSERVE'); step('VERIFY_STRUCTURE'); step('ASK_PERMISSION'); };
  const block = (type: WhiteTowerEpilogueCommand['type']) => whiteTowerEpilogueBlock(state, { type }, h);
  return { h, mastery, passages, passageBytes, step, first, counter, block, get state() { return state; } };
}

describe('White Tower finite original gate and physical countermeasure', () => {
  it('requires all original passage receipts and starts a distinct new adult at a real gate without inherited consent', () => {
    const empty = createWhiteTowerPassages('empty', 'same-actor', 200, 36000);
    expect(() => createWhiteTowerEpilogue(empty, { week: 201, nowSecond: 604800 })).toThrow();
    const r = scene();
    expect(r.state.resident).toMatchObject({ id: 'WT0-SERA', age: 39, position: 0, consent: 'UNASKED', injuries: [], arrival: null });
    expect(r.state.gate).toMatchObject({ id: 'WT0-GATE-1', ownerId: 'WT0-SERA', position: 4, version: 1, condition: 82, open: false });
    expect(r.state.opponent).toMatchObject({ id: 'WT0-ROOK', position: 6, reconstruction: null });
    expect(r.block('CROSS')).not.toBeNull(); expect(r.block('ORDINARY_SIDE_EXIT')).not.toBeNull();
    expect(r.passages.routes.every(p => p.resident.position > 0)).toBe(true);
    expect(() => createWhiteTowerEpilogue(r.passages, { week: r.h.week, nowSecond: r.h.nowSecond, actorId: 'someone-else' })).toThrow();
  });

  it('pays for one 30-second insight but grants mastery only after a separate real mechanical verification', () => {
    const r = scene(); r.first();
    expect(r.h).toMatchObject({ actions: 2, spirituality: 88, mind: 92, health: 90 });
    expect(r.state.insight).toMatchObject({ attempted: true, passed: true, applied: false, version: 1 });
    expect(r.state.insight.expiresSecond).toBe(r.h.nowSecond + 30);
    expect(r.mastery[INSIGHT]).toBe(0); expect(r.state.verifications).toEqual([]);
    const verify = r.step('VERIFY_STRUCTURE');
    expect(verify.effect.seconds).toBe(14); expect(verify.masteryGains).toEqual({ [INSIGHT]: 8 });
    expect(r.state.verifications[0]).toMatchObject({ version: 1, assisted: true, independentMechanicalTest: true });
    expect(r.mastery['reader.s1.original-test-skill']).toBe(13);
    expect(r.block('STRUCTURAL_INSIGHT')).not.toBeNull();
  });

  it('has the original opponent physically reconstruct and obscure the gate, invalidating old knowledge and withdrawing this adult', () => {
    const r = scene(); r.first(); r.step('VERIFY_STRUCTURE');
    expect(r.state.gate).toMatchObject({ id: 'WT0-GATE-1', version: 2, visible: false, condition: 78, screen: { closed: true } });
    expect(r.state.opponent).toMatchObject({ position: 6, toolCondition: 66, reconstruction: { fromVersion: 1, toVersion: 2, position: 6 } });
    expect(r.state.insight.expiresSecond).toBeNull(); expect(r.state.weakness.expiresSecond).toBeNull();
    expect(r.state.resident).toMatchObject({ position: 0, consent: 'WITHDRAWN', routePermission: 'NONE' });
    expect(r.block('BOUNDED_WEAK_POINT')).not.toBeNull(); expect(r.block('CROSS')).not.toBeNull(); expect(r.block('OBSERVE')).not.toBeNull();
    r.step('CLEAR_SCREEN'); expect(r.block('BOUNDED_WEAK_POINT')).not.toBeNull();
    r.step('OBSERVE'); r.step('VERIFY_STRUCTURE');
    expect(r.state.verifications.map(v => v.version)).toEqual([1, 2]);
    expect(r.state.verifications[1]!.assisted).toBe(false); expect(r.mastery[INSIGHT]).toBe(8);
    expect(r.state.resident.consent).toBe('WITHDRAWN'); r.step('ASK_PERMISSION');
    expect(r.state.resident.permissionHistory.map(p => p.answer)).toEqual(['ACCEPT', 'WITHDRAWN', 'ACCEPT']);
  });

  it('pays for one ten-second weak point, then consumes it with original tools before moving a still-willing adult', () => {
    const r = scene(); r.counter(); const created = r.step('BOUNDED_WEAK_POINT');
    expect(created.effect).toMatchObject({ actions: 1, spirituality: 16, mind: 10, seconds: 3 });
    expect(r.h).toMatchObject({ actions: 1, spirituality: 72, mind: 82 });
    expect(r.mastery[WEAKNESS]).toBe(0); expect(r.state.gate.open).toBe(false);
    expect(r.state.weakness.expiresSecond).toBe(r.h.nowSecond + 10); expect(r.block('CROSS')).not.toBeNull();
    const used = r.step('EXPLOIT_WEAK_POINT');
    expect(used.effect.seconds).toBe(6); expect(used.masteryGains).toEqual({ [WEAKNESS]: 8 });
    expect(r.state.gate).toMatchObject({ id: 'WT0-GATE-1', version: 3, open: true, condition: 66, strut: { loaded: true, position: 4, condition: 70 }, lever: { condition: 71, holder: 'PLAYER', position: 0 } });
    expect(r.state.resident.position).toBe(0); expect(r.state.weakness.expiresSecond).toBeNull();
    r.step('CROSS'); expect(r.state).toMatchObject({ position: 8, resident: { position: 8, crossedEventId: expect.any(String), arrival: null } });
    expect(r.state.gate.lever.position).toBe(8);
    const exit = r.step('ORDINARY_SIDE_EXIT'); expect(exit.effect).toMatchObject({ seconds: 38, actions: 0, cashCost: 0 });
    expect(r.state).toMatchObject({ status: 'RESOLVED', position: 12, resident: { position: 12, arrival: { route: 'GATE_THEN_SIDE' } } });
    expect(r.state.gate.strut).toMatchObject({ loaded: false, holder: 'PLAYER', position: 12, condition: 67 });
    expect(r.state.gate.lever.position).toBe(12);
    r.step('REPORT'); expect(r.state.reported).toBe(true);
    expect(r.mastery).toEqual({ [INSIGHT]: 8, [WEAKNESS]: 8, 'reader.s1.original-test-skill': 13 });
    expect(JSON.stringify(r.passages)).toBe(r.passageBytes);
  });

  it('expires unused insight without granting mastery or allowing another attempt', () => {
    const r = scene(); r.first(); r.h.nowSecond += 31; // Explicit elapsed host time, no regeneration.
    const verify = r.step('VERIFY_STRUCTURE');
    expect(verify.effect.seconds).toBe(26); expect(verify.masteryGains).toEqual({});
    expect(r.state.insight).toMatchObject({ attempted: true, passed: true, applied: false, expiresSecond: null });
    expect(r.state.verifications[0]!.assisted).toBe(false); expect(r.mastery[INSIGHT]).toBe(0);
    expect(r.block('STRUCTURAL_INSIGHT')).not.toBeNull();
  });

  it('expires an unused weak point and keeps the finite paid failure instead of resetting or awarding use', () => {
    const r = scene(); r.counter(); r.step('BOUNDED_WEAK_POINT'); r.h.nowSecond += 11;
    expect(r.block('EXPLOIT_WEAK_POINT')).not.toBeNull(); expect(r.block('BOUNDED_WEAK_POINT')).not.toBeNull();
    r.step('SECURE_GATE'); r.step('CROSS'); r.step('ORDINARY_SIDE_EXIT'); r.step('REPORT');
    expect(r.state.weakness).toMatchObject({ attempted: true, passed: true, applied: false, expiresSecond: null });
    expect(r.mastery[WEAKNESS]).toBe(0); expect(r.h.spirituality).toBe(72);
    expect(r.state.resident.position).toBe(12); expect(r.state.gate.latch.condition).toBe(75);
  });

  it('invalidates a live weak point when an actual ordinary lock changes the same structure version', () => {
    const r = scene(); r.counter(); r.step('BOUNDED_WEAK_POINT'); const old = r.state.gate.version;
    r.step('SECURE_GATE'); expect(r.state.gate.version).toBe(old + 1); expect(r.state.weakness.expiresSecond).toBeNull();
    expect(r.block('EXPLOIT_WEAK_POINT')).not.toBeNull(); expect(r.mastery[WEAKNESS]).toBe(0);
    expect(r.state.opponent.stoppedByLatch).toBe(true);
  });

  it('retains actual spell failure, injury and costs while ordinary locking and side exit remain usable with zero resources', () => {
    const r = scene(); r.counter(90); expect(r.mastery[INSIGHT]).toBe(0);
    const failed = r.step('BOUNDED_WEAK_POINT', 90);
    expect(failed.injuries).toHaveLength(1); expect(r.state.playerInjuries).toHaveLength(2);
    expect(r.h).toMatchObject({ health: 78, mind: 78, spirituality: 72 });
    r.h.actions = 0; r.h.cash = 0; r.h.spirituality = 0; // Explicit resource exhaustion fixture.
    r.step('SECURE_GATE'); r.step('CROSS'); r.step('ORDINARY_SIDE_EXIT'); r.step('REPORT');
    expect(r.state.resident.position).toBe(12); expect(r.state.playerInjuries).toHaveLength(2);
    expect(r.h).toMatchObject({ health: 78, mind: 78, actions: 0, cash: 0, spirituality: 0 });
    expect(r.mastery[INSIGHT]).toBe(0); expect(r.mastery[WEAKNESS]).toBe(0);
  });

  it('records a severe recoil injury and does not move the adult after she withdraws', () => {
    const r = scene(); r.counter(); const failed = r.step('BOUNDED_WEAK_POINT', 99);
    expect(failed.injuries[0]!.severity).toBe('HEAVY'); expect(r.state.resident.injuries).toHaveLength(1);
    expect(r.state.resident).toMatchObject({ position: 0, consent: 'WITHDRAWN', routePermission: 'NONE' });
    expect(r.block('ORDINARY_SIDE_EXIT')).not.toBeNull(); expect(r.block('CROSS')).not.toBeNull();
    r.step('WITHDRAW'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', position: 12, resident: { position: 0, arrival: null } });
    expect(projectWhiteTowerEpilogue(r.state).story).toContain('本次尚未抵达');
    expect(r.state.resident.injuries).toHaveLength(1);
  });

  it('allows an explicitly renewed side-only agreement after countermeasure, with no automatic gate permission', () => {
    const r = scene(); r.first(); r.step('VERIFY_STRUCTURE');
    r.step('ASK_PERMISSION');
    expect(r.state.resident).toMatchObject({ consent: 'ACCEPT', routePermission: 'SIDE_ONLY', position: 0 });
    expect(r.block('CROSS')).not.toBeNull(); r.step('ORDINARY_SIDE_EXIT');
    expect(r.state.resident).toMatchObject({ position: 12, crossedEventId: null, arrival: { route: 'SIDE' } });
    expect(r.state.gate.visible).toBe(false); expect(r.state.gate.open).toBe(false);
  });

  it('offers a complete ordinary route without either spell and rejects all public result or consent injection', () => {
    const r = scene(); r.h.actions = 0; r.h.cash = 0; r.h.spirituality = 0;
    r.step('OBSERVE'); r.step('ASK_PERMISSION'); r.step('SECURE_GATE'); r.step('CROSS'); r.step('ORDINARY_SIDE_EXIT'); r.step('REPORT');
    expect(r.state.insight.attempted).toBe(false); expect(r.state.weakness.attempted).toBe(false);
    expect(r.state.resident.position).toBe(12); expect(r.state.opponent.reconstruction).toBeNull();
    for (const extra of [{ roll: 1 }, { success: true }, { consent: true }, { version: 1 }, { expiresSecond: 99999999 }, { mastery: 8 }]) expect(validateWhiteTowerEpilogueCommand({ type: 'STRUCTURAL_INSIGHT', ...extra })).toBe(false);
    expect(validateWhiteTowerEpilogueCommand({ type: 'STRUCTURAL_INSIGHT' })).toBe(true);
    expect(getWhiteTowerEpilogueActions(r.state, r.h).some(a => a.enabled)).toBe(false);
  });
});
