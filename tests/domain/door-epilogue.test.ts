import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { DoorEffect, DoorHost } from '../../src/domain/door/ports.js';
import { DOOR_EPILOGUE_POLICY as P, DOOR_EPILOGUE_SCENE as S } from '../../src/domain/door/epilogue-content.js';
import { applyDoorEpilogue, createDoorEpilogue, doorEpilogueBlock, getDoorEpilogueActions,
  getDoorEpilogueCheckInput, projectDoorEpilogue, validateDoorEpilogueCommand, validateDoorEpilogueState,
  type DoorEpilogueCommand } from '../../src/domain/door/epilogue.js';
const ESCAPE = 'door.s0.bounded-conceptual-escape', SEAL = 'door.s0.single-exit-seal';

/** Explicit component inputs. This does not claim a naturally achieved S0;
 * the chapter's source/promotion/three-service gate is tested separately. */
function scene() {
  const h: DoorHost = { eventId: 'door-scene-1', revision: 1, week: 200,
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }, actorId: 'actual-door-component-actor',
    sourceDigest: 'PRIVATE_SOURCE_DIGEST_DO_NOT_PROJECT', location: S.location, nowSecond: 36000,
    weekAnchor: 0, sequence: 0, status: 'ACTIVE', cash: 50, actions: 2, health: 100, mind: 100,
    spirituality: 100, check: null, serviceReceipts: [], legacyAccess: null, succession: null };
  let state = createDoorEpilogue({ actorId: h.actorId, week: h.week, nowSecond: h.nowSecond });
  const mastery: Record<string, number> = { [ESCAPE]: 0, [SEAL]: 0, 'star-key.s1.original-learning': 17 };
  const advance = (e: DoorEffect) => {
    h.cash -= e.cashCost; h.actions -= e.actions; h.health = Math.max(0, h.health - e.health);
    h.mind = Math.max(0, h.mind - e.mind); h.spirituality -= e.spirituality; h.nowSecond += e.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (!h.health || !h.mind) h.status = 'DEAD'; h.revision++; h.eventId = `door-scene-${h.revision}`; h.check = null;
  };
  const check = (type: DoorEpilogueCommand['type'], roll = 20) => {
    const spec = getDoorEpilogueCheckInput({ type });
    return spec ? resolveNormalCheck({ ability: spec.ability, difficulty: spec.difficulty,
      baseAbility: spec.ability === 'will' ? 30 : 25, modifiers: [{ source: spec.source, value: spec.modifier }], roll }) : null;
  };
  const step = (type: DoorEpilogueCommand['type'], roll = 20) => {
    h.check = check(type, roll);
    const before = structuredClone(state), host = structuredClone(h), result = applyDoorEpilogue(state, { type }, h);
    expect(state).toEqual(before); expect(h).toEqual(host); expect(result.effect.cashGain).toBe(0);
    expect(result.effect.toLocation).toBeNull();
    state = result.state; for (const [key, gain] of Object.entries(result.masteryGains)) mastery[key] = (mastery[key] ?? 0) + gain;
    advance(result.effect); return result;
  };
  const block = (type: DoorEpilogueCommand['type']) => doorEpilogueBlock(state, { type }, h);
  const prepare = () => { step('OBSERVE'); step('APPROACH_WORKER'); step('RELEASE_CATCH'); };
  const release = (roll = 20) => { prepare(); step('CONCEPTUAL_ESCAPE', roll); step('FREE_WORKER'); };
  return { h, mastery, step, check, block, prepare, release, get state() { return state; } };
}

describe('Door finite original hoist-shed incident', () => {
  it('creates new finite original adults and apparatus without importing old chapter bodies or parcels', () => {
    const r = scene();
    expect(r.state).toMatchObject({ actorId: r.h.actorId, location: 'DR0-HOIST-SHED', playerPosition: 0,
      worker: { id: S.workerId, age: 34, health: 96, position: 8, trapped: true, injuries: [S.workerInjury] },
      trolley: { id: S.trolleyId, ownerId: S.workerId, quantity: 1, condition: 84, position: 8 },
      counterweight: { quantity: 1, energy: 'HELD' } });
    expect(validateDoorEpilogueState(r.state)).toBe(true);
    expect(JSON.stringify(r.state)).not.toMatch(/Rowan|SUN0-|DE0-|罗温/);
    expect(() => createDoorEpilogue({ actorId: '', week: 200, nowSecond: 0 })).toThrow();
    expect(() => createDoorEpilogue({ actorId: 'actor', week: 0, nowSecond: 0 })).toThrow();
  });

  it('completes a genuinely ordinary rescue at zero AP and cash, preserving the old bruise and original items', () => {
    const r = scene(); r.h.cash = 0; r.h.actions = 0; const started = r.h.nowSecond;
    r.step('OBSERVE'); expect(r.block('CONCEPTUAL_ESCAPE')).not.toBeNull(); r.step('ISOLATE_AND_FREE');
    expect(r.state).toMatchObject({ playerPosition: 8, isolated: true, worker: { trapped: false, position: 8 },
      brake: { applied: true, condition: 70 }, latch: { spring: 'DISCHARGED' }, counterweight: { energy: 'SECURED' } });
    r.step('GUIDE_SIDE_EXIT'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', reported: true, playerPosition: 0, playerMetres: 32,
      worker: { position: 0, travelledMetres: 24, health: 96, injuries: [S.workerInjury] },
      trolley: { position: 0, travelledMetres: 24, id: S.trolleyId, condition: 84, holderId: S.workerId },
      arrival: { workerId: S.workerId, trolleyId: S.trolleyId, routeId: S.ordinaryExitId, metres: 24 } });
    expect(r.h).toMatchObject({ cash: 0, actions: 0, health: 100 }); expect(r.h.nowSecond - started).toBe(110);
    expect(r.mastery).toEqual({ [ESCAPE]: 0, [SEAL]: 0, 'star-key.s1.original-learning': 17 });
    expect(r.state.supplies.focus.stock).toBe(1); expect(r.state.supplies.seal.stock).toBe(1);
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('charges both genuine casts and grants mastery only when the two original impacts actually occur', () => {
    const r = scene(); r.prepare(); const due = r.state.impacts.spring.dueSecond;
    const cast = r.step('CONCEPTUAL_ESCAPE');
    expect(cast.effect).toMatchObject({ actions: 1, cashCost: 8, spirituality: 14, mind: 8, seconds: 1, health: 0 });
    expect(r.mastery[ESCAPE]).toBe(0); expect(r.state.worker.trapped).toBe(true);
    expect(r.state.escape.expiresSecond).toBe(r.h.nowSecond + 3);
    expect(r.state.supplies.focus).toMatchObject({ stock: 0, holder: 'SPENT' });
    const freed = r.step('FREE_WORKER'); expect(freed.masteryGains).toEqual({ [ESCAPE]: 8 });
    expect(r.state.impacts.spring).toMatchObject({ status: 'AVOIDED', resolvedSecond: due, playerHealthLoss: 0 });
    expect(r.state.escape).toMatchObject({ applied: true, appliedSecond: due, endedReason: 'USED', expiresSecond: null });
    expect(r.state.worker).toMatchObject({ position: 8, trapped: false, health: 96 });
    expect(r.block('SEAL_EXIT')).not.toBeNull(); r.step('OBSERVE_EXIT');
    const sealed = r.step('SEAL_EXIT'); expect(sealed.effect).toMatchObject({ cashCost: 6, actions: 1, spirituality: 12, mind: 6, seconds: 2, health: 0 });
    expect(sealed.masteryGains).toEqual({}); expect(r.mastery[SEAL]).toBe(0); expect(r.state.seal.expiresSecond).toBe(r.h.nowSecond + 20);
    const hauled = r.step('GUIDE_SIDE_EXIT'); expect(hauled.masteryGains).toEqual({ [SEAL]: 8 }); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'RESOLVED', reported: true, worker: { health: 96, position: 0 },
      trolley: { condition: 84, position: 0 }, exit: { condition: 76, closed: true }, counterweight: { energy: 'SPENT' },
      seal: { applied: true, expiresSecond: null, endedReason: 'USED' } });
    expect(r.h).toMatchObject({ actions: 0, cash: 36, health: 100, spirituality: 74, mind: 86 });
    expect(r.mastery).toEqual({ [ESCAPE]: 8, [SEAL]: 8, 'star-key.s1.original-learning': 17 });
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('settles a held impact at its real timestamp rather than rejecting it because the long haul finishes later', () => {
    const r = scene(); r.release(); r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT');
    const expiry = r.state.seal.expiresSecond!, due = r.state.impacts.exit.dueSecond!;
    expect(due).toBeLessThan(expiry); r.step('GUIDE_SIDE_EXIT');
    expect(r.h.nowSecond).toBeGreaterThan(expiry); expect(r.state.seal.appliedSecond).toBe(due);
    expect(r.state.impacts.exit.resolvedSecond).toBe(due); expect(r.mastery[SEAL]).toBe(8);
  });

  it.each([90, 100])('keeps all costs after failed roll %s while damage comes only from actual pending impacts', roll => {
    const r = scene(); r.prepare(); const first = r.step('CONCEPTUAL_ESCAPE', roll);
    expect(first.effect.health).toBe(0); expect(r.h.health).toBe(100); expect(r.state.playerInjuries).toEqual([]);
    r.step('FREE_WORKER'); expect(r.h.health).toBe(92); expect(r.state.playerInjuries).toHaveLength(1);
    r.step('OBSERVE_EXIT'); const second = r.step('SEAL_EXIT', roll); expect(second.effect.health).toBe(0);
    expect(r.h.health).toBe(92); expect(r.h.cash).toBe(36); expect(r.h.actions).toBe(0);
    expect(r.block('CONCEPTUAL_ESCAPE')).not.toBeNull(); expect(r.block('SEAL_EXIT')).not.toBeNull();
    r.step('GUIDE_SIDE_EXIT'); r.step('REPORT');
    expect(r.h.health).toBe(88); expect(r.state.worker).toMatchObject({ position: 0, health: 88 });
    expect(r.state.trolley).toMatchObject({ position: 0, condition: 74 }); expect(r.state.exit.condition).toBe(66);
    expect(r.state.playerInjuries).toHaveLength(2); expect(r.state.worker.injuries).toContain(S.workerInjury);
    expect(r.state.supplies.focus.stock).toBe(0); expect(r.state.supplies.seal.stock).toBe(0);
    expect(r.mastery[ESCAPE]).toBe(0); expect(r.mastery[SEAL]).toBe(0);
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it.each([[90, 90], [20, 90], [90, 20]])('allows ordinary completion after escape %s and seal %s without a forced retry', (escape, seal) => {
    const r = scene(); r.release(escape); r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT', seal);
    const health = r.h.health; r.h.cash = 0; r.h.actions = 0;
    expect(getDoorEpilogueActions(r.state, r.h).find(a => a.command.type === 'ISOLATE_AND_FREE')).toMatchObject({ enabled: true });
    expect(getDoorEpilogueActions(r.state, r.h).find(a => a.command.type === 'WITHDRAW')).toMatchObject({ enabled: true });
    r.step('ISOLATE_AND_FREE'); r.step('GUIDE_SIDE_EXIT'); r.step('REPORT');
    expect(r.h.health).toBe(health); expect(r.h).toMatchObject({ cash: 0, actions: 0 });
    expect(r.state.worker).toMatchObject({ position: 0, health: 96 }); expect(r.state.trolley.condition).toBe(84);
    expect(r.state.impacts.exit.status).toBe('MECHANICALLY_STOPPED'); expect(r.mastery[SEAL]).toBe(0);
    expect(r.mastery[ESCAPE]).toBe(escape === 20 ? 8 : 0);
    expect(r.state.supplies.focus.stock).toBe(0); expect(r.state.supplies.seal.stock).toBe(0);
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('can choose ordinary rescue without trying either ability even after declaring the rebound', () => {
    const r = scene(); r.prepare(); r.h.actions = 0; r.h.cash = 0;
    r.step('ISOLATE_AND_FREE'); expect(r.state.impacts.spring.status).toBe('MECHANICALLY_STOPPED');
    r.step('GUIDE_SIDE_EXIT'); expect(r.h.health).toBe(100); expect(r.state.status).toBe('RESOLVED');
    expect(r.state.escape.attempted).toBe(false); expect(r.state.seal.attempted).toBe(false);
  });

  it('keeps settled spring harm when the ordinary brake engages exactly at the impact boundary', () => {
    const r = scene(); r.prepare(); r.step('CONCEPTUAL_ESCAPE', 90);
    r.h.nowSecond = r.state.impacts.spring.dueSecond! - 1;
    r.step('ISOLATE_AND_FREE'); expect(r.h.health).toBe(92);
    expect(r.state.impacts.spring.status).toBe('STRUCK'); expect(r.state.worker.trapped).toBe(false);
    expect(r.state.playerInjuries).toHaveLength(1); r.step('GUIDE_SIDE_EXIT');
    expect(r.state.playerInjuries).toHaveLength(1); expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('does not turn successful casting into retroactive healing or generic protection for the worker', () => {
    const r = scene(); r.release(); expect(r.h.health).toBe(100); expect(r.state.worker.injuries).toEqual([S.workerInjury]);
    r.step('WAIT_WINDOW'); expect(r.state.impacts.exit.status).toBe('STRUCK');
    expect(r.h.health).toBe(96); expect(r.state.worker.health).toBe(88); expect(r.state.trolley.condition).toBe(74);
    expect(r.mastery[ESCAPE]).toBe(8); expect(r.mastery[SEAL]).toBe(0);
    expect(r.block('SEAL_EXIT')).not.toBeNull(); expect(r.block('CONCEPTUAL_ESCAPE')).not.toBeNull();
    r.step('GUIDE_SIDE_EXIT'); expect(r.h.health).toBe(96); expect(r.state.worker.injuries).toHaveLength(2);
  });

  it('cannot cast after the declared hit or replace it with a caller-selected eligible impact', () => {
    const r = scene(); r.prepare(); r.h.nowSecond = r.state.impacts.spring.dueSecond!;
    expect(r.block('CONCEPTUAL_ESCAPE')).not.toBeNull(); r.step('WAIT_WINDOW'); expect(r.h.health).toBe(92);
    expect(r.state.impacts.spring.status).toBe('STRUCK'); expect(r.mastery[ESCAPE]).toBe(0);
    expect(validateDoorEpilogueCommand({ type: 'CONCEPTUAL_ESCAPE', impactId: 'earlier-injury' })).toBe(false);
    expect(validateDoorEpilogueCommand({ type: 'CONCEPTUAL_ESCAPE', targetActorId: S.workerId })).toBe(false);
  });

  it('stopping a live effect exposes the actual future hit without refunding its paid material', () => {
    const r = scene(); r.prepare(); r.step('CONCEPTUAL_ESCAPE'); r.step('STOP_EFFECTS');
    expect(r.state.escape.endedReason).toBe('STOPPED'); r.step('FREE_WORKER');
    expect(r.h.health).toBe(92); expect(r.mastery[ESCAPE]).toBe(0); expect(r.state.supplies.focus.stock).toBe(0);
    r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT'); r.step('STOP_EFFECTS'); r.step('WAIT_WINDOW');
    expect(r.mastery[SEAL]).toBe(0); expect(r.state.impacts.exit.status).toBe('STRUCK');
    expect(r.state.supplies.seal.stock).toBe(0); expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('does not let a stop issued after the due time erase an already applied success', () => {
    const r = scene(); r.prepare(); r.step('CONCEPTUAL_ESCAPE'); r.h.nowSecond = r.state.impacts.spring.dueSecond!;
    const stopped = r.step('STOP_EFFECTS'); expect(stopped.masteryGains).toEqual({ [ESCAPE]: 8 });
    expect(r.state.impacts.spring.status).toBe('AVOIDED'); expect(r.state.escape.applied).toBe(true);
    expect(r.h.health).toBe(100); expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('a real change to the one observed exit defeats the old seal while its counterweight still pushes', () => {
    const r = scene(); r.release(); r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT');
    const version = r.state.exit.version; r.step('OPEN_EXIT');
    expect(r.state.exit.version).toBe(version + 1); expect(r.state.exit.closed).toBe(false);
    expect(r.state.seal).toMatchObject({ passed: true, applied: false, expiresSecond: null, endedReason: 'EXIT_CHANGED' });
    r.step('GUIDE_SIDE_EXIT'); expect(r.state.impacts.exit.status).toBe('STRUCK');
    expect(r.state.worker.health).toBe(88); expect(r.mastery[SEAL]).toBe(0); expect(r.state.trolley.quantity).toBe(1);
  });

  it('walking away physically invalidates self-escape, leaves the actual trapped worker, and earns no mastery', () => {
    const r = scene(); r.prepare(); r.step('CONCEPTUAL_ESCAPE'); r.h.cash = 0; r.h.actions = 0;
    r.step('WITHDRAW'); r.step('REPORT');
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', reported: true, playerPosition: 0, playerMetres: 32,
      worker: { position: 8, trapped: true }, trolley: { position: 8, holderId: S.workerId }, arrival: null,
      escape: { passed: true, applied: false, endedReason: 'MOVED' } });
    expect(r.state.impacts.spring.status).toBe('MISSED'); expect(r.h.health).toBe(100); expect(r.mastery[ESCAPE]).toBe(0);
    expect(projectDoorEpilogue(r.state).story).toContain('仍在八米维修位被夹住');
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('retains actual death and does not finish the release or pretend the body exited', () => {
    const r = scene(); r.prepare(); r.h.health = 1; r.step('CONCEPTUAL_ESCAPE', 100);
    expect(r.h.status).toBe('ACTIVE'); const died = r.step('FREE_WORKER');
    expect(died.effect.health).toBe(8); expect(r.h.status).toBe('DEAD');
    expect(r.state).toMatchObject({ status: 'WITHDRAWN', playerPosition: 8, worker: { trapped: true, position: 8 },
      trolley: { clampReleased: false, position: 8 }, arrival: null, impacts: { exit: { status: 'UNDECLARED' } } });
    expect(r.state.supplies.focus.stock).toBe(0); expect(r.block('WITHDRAW')).not.toBeNull(); expect(r.block('REPORT')).not.toBeNull();
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('rejects command forgeries, counterfeit check results, stale events and invalid actual hosts without mutation', () => {
    for (const extra of [{ success: true }, { roll: 1 }, { expiresSecond: 999999 }, { targetId: 'another-door' }, { resources: 999 }])
      expect(validateDoorEpilogueCommand({ type: 'SEAL_EXIT', ...extra })).toBe(false);
    const r = scene(); r.prepare(); const before = structuredClone(r.state), host = structuredClone(r.h);
    expect(() => applyDoorEpilogue(r.state, { type: 'CONCEPTUAL_ESCAPE' }, r.h)).toThrow();
    const actual = r.check('CONCEPTUAL_ESCAPE', 90)!;
    expect(() => applyDoorEpilogue(r.state, { type: 'CONCEPTUAL_ESCAPE' }, { ...r.h, check: { ...actual, tier: 'SUCCESS' } })).toThrow();
    expect(() => applyDoorEpilogue(r.state, { type: 'CONCEPTUAL_ESCAPE' }, { ...r.h, check: { ...actual, roll: 1 } })).toThrow();
    for (const invalid of [{ actorId: 'wrong-person' }, { sequence: 1 as const }, { status: 'DEAD' as const },
      { location: 'ANOTHER-SITE' }, { cash: Number.NaN }, { actions: -1 }, { nowSecond: -1 },
      { eventId: r.state.journal[0]!.eventId }, { revision: r.state.journal.at(-1)!.revision }])
      expect(doorEpilogueBlock(r.state, { type: 'WITHDRAW' }, { ...r.h, ...invalid })).not.toBeNull();
    expect(r.state).toEqual(before); expect(r.h).toEqual(host);
  });

  it('reconstructs 70 percent component checks and accepts no RNG or caller-supplied outcomes on ordinary actions', () => {
    const r = scene(); expect(r.check('CONCEPTUAL_ESCAPE')!.chance).toBe(70); expect(r.check('SEAL_EXIT')!.chance).toBe(70);
    expect(getDoorEpilogueCheckInput({ type: 'GUIDE_SIDE_EXIT' })).toBeNull();
    expect(() => applyDoorEpilogue(r.state, { type: 'OBSERVE' }, { ...r.h, check: r.check('SEAL_EXIT') })).toThrow();
    expect(P.escape.windowSeconds).toBe(3); expect(P.seal.windowSeconds).toBe(20);
  });

  it('detects altered material identities, replenished one-use props, invented rescue and forged application history', () => {
    const r = scene(); r.release(); r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT'); r.step('GUIDE_SIDE_EXIT');
    for (const change of [
      (s: typeof r.state) => { s.trolley.id = 'replacement-cart'; },
      (s: typeof r.state) => { s.worker.id = 'old-chapter-body'; },
      (s: typeof r.state) => { s.supplies.focus.stock = 1; },
      (s: typeof r.state) => { s.supplies.seal.holder = 'SUPPLIER'; },
      (s: typeof r.state) => { s.worker.health = 100; s.worker.injuries = []; },
      (s: typeof r.state) => { s.seal.appliedSecond = 0; },
      (s: typeof r.state) => { s.counterweight.energy = 'HELD'; },
      (s: typeof r.state) => { s.trolley.position = 8; },
      (s: typeof r.state) => { s.journal[3]!.masteryGains = { [ESCAPE]: 8 }; },
    ]) { const changed = structuredClone(r.state); change(changed); expect(validateDoorEpilogueState(changed)).toBe(false); }
    expect(validateDoorEpilogueState(r.state)).toBe(true);
  });

  it('recommends each affordable finite attempt once, then immediately switches to ordinary rescue on failure', () => {
    const r = scene(); const next = () => getDoorEpilogueActions(r.state, r.h).find(a => a.preferredAction)?.command.type;
    for (const type of ['OBSERVE', 'APPROACH_WORKER', 'RELEASE_CATCH', 'CONCEPTUAL_ESCAPE', 'FREE_WORKER',
      'OBSERVE_EXIT', 'SEAL_EXIT', 'GUIDE_SIDE_EXIT', 'REPORT'] as const) { expect(next()).toBe(type); r.step(type); }
    expect(next()).toBeUndefined(); expect(r.mastery[ESCAPE]).toBe(8); expect(r.mastery[SEAL]).toBe(8);
    const failed = scene(); failed.prepare(); failed.step('CONCEPTUAL_ESCAPE', 90);
    expect(getDoorEpilogueActions(failed.state, failed.h).find(a => a.preferredAction)?.command.type).toBe('ISOLATE_AND_FREE');
    failed.step('ISOLATE_AND_FREE'); expect(getDoorEpilogueActions(failed.state, failed.h).find(a => a.preferredAction)?.command.type).toBe('GUIDE_SIDE_EXIT');
    const poor = scene(); poor.step('OBSERVE'); poor.h.actions = 0; poor.h.cash = 0;
    expect(getDoorEpilogueActions(poor.state, poor.h).find(a => a.preferredAction)?.command.type).toBe('ISOLATE_AND_FREE');
  });

  it('projects only visible scene facts and useful actions, without private host, seed, cursor or source data', () => {
    const r = scene(); r.release(); r.step('OBSERVE_EXIT'); r.step('SEAL_EXIT', 90);
    const publicText = JSON.stringify({ scene: projectDoorEpilogue(r.state), actions: getDoorEpilogueActions(r.state, r.h) });
    for (const forbidden of ['PRIVATE_SOURCE_DIGEST_DO_NOT_PROJECT', 'sourceDigest', 'seed', 'cursor', 'journal', 'component', 'R218', 'Rowan'])
      expect(publicText).not.toContain(forbidden);
    expect(publicText).toContain('二十四米'); expect(publicText).toContain('普通');
    expect(getDoorEpilogueActions(r.state, r.h).find(a => a.command.type === 'ISOLATE_AND_FREE')).toMatchObject({ enabled: true, preferredAction: true });
  });
});
