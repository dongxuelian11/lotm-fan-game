import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { DeathHost } from '../../src/domain/death/ports.js';
import { DEATH_ABILITY_IDS, type DeathServiceCommand, type DeathEpilogueCommand, type DeathServicesState } from '../../src/domain/death/types.js';
import { applyDeathServices, createDeathServices, deathServiceVerifiedReceipts } from '../../src/domain/death/services.js';
import { applyDeathEpilogue, deathEpilogueBlock, deathEpilogueCheckInput, deathEpilogueStartPreview,
  getDeathEpilogueActions, nextDeathEpilogueCommand, projectDeathEpilogue, startDeathEpilogue,
  validateDeathEpilogueCommand } from '../../src/domain/death/epilogue.js';

/** Actual pure service transitions build each finite scene. Explicit hosts are
 * directed component inputs, not natural play or validated campaign saves. */
function completed() {
  const h: DeathHost = { eventId: 'finite-1', revision: 1, week: 3333,
    date: { epoch: 'FIFTH_EPOCH', year: 1413, month: 5, day: 12 }, actorId: 'finite-actor', sourceDigest: 'component', sourceEra: 'POST_CYCLE',
    location: 'DE0-RESIDUE-ROOM', nowSecond: 0, weekAnchor: 0, sequence: 1, status: 'ACTIVE', cash: 100, actions: 8,
    health: 90, mind: 90, spirituality: 100, check: null, serviceReceipts: [], legacyAccess: null, succession: null,
    uniquenessCustodianPresent: false, recoveryPermission: null };
  let services = createDeathServices('finite-epilogue', h.actorId, h.week, h.nowSecond);
  const tick = (seconds: number) => {
    h.nowSecond += seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    h.revision++; h.eventId = `finite-${h.revision}`;
  };
  const service = (command: DeathServiceCommand) => {
    const result = applyDeathServices(services, command, h); services = result.state;
    h.cash -= result.effect.cashCost; h.actions -= result.effect.actions; tick(result.effect.seconds);
  };
  for (const type of ['ASK_PERMISSION', 'SURVEY', 'OBSERVE_PROPAGATION', 'BUY_SUPPLIES', 'POSITION_SCREEN', 'CLOSE_LID', 'SEAL_CONTAINER', 'RETURN_CONTAINER', 'VERIFY_SERVICE'] as const)
    service({ type, serviceId: 'residue-sealing' });
  h.location = 'DE0-OLD-WHARF';
  for (const type of ['ASK_PERMISSION', 'SURVEY', 'BUY_SUPPLIES', 'LAY_ROPE', 'SUPPORT_BRIDGE'] as const)
    service({ type, serviceId: 'old-wharf-exit' });
  for (const workerId of ['DE0-WHARF-WORKER-1', 'DE0-WHARF-WORKER-2'] as const)
    service({ type: 'ESCORT_WORKER', serviceId: 'old-wharf-exit', workerId });
  service({ type: 'VERIFY_SERVICE', serviceId: 'old-wharf-exit' });
  h.sequence = 0; h.serviceReceipts = deathServiceVerifiedReceipts(services);
  return { h, services, tick };
}
function scene(adjust?: (services: DeathServicesState, h: DeathHost) => void) {
  const r = completed(); adjust?.(r.services, r.h);
  const original = structuredClone(r.services), intro = startDeathEpilogue(r.services, r.h);
  expect(r.services).toEqual(original); let state = intro.state;
  r.h.mind -= intro.effect.mind; r.tick(intro.effect.seconds);
  const step = (type: DeathEpilogueCommand['type'], roll = 30) => {
    const command: DeathEpilogueCommand = { type }, input = deathEpilogueCheckInput(state, command, r.h);
    r.h.check = input ? resolveNormalCheck({ ability: input.ability, baseAbility: 27, difficulty: input.difficulty,
      modifiers: [{ source: input.source, value: input.modifier }], roll }) : null;
    const before = structuredClone(state), hb = structuredClone(r.h), result = applyDeathEpilogue(state, command, r.h);
    expect(state).toEqual(before); expect(r.h).toEqual(hb); state = result.state;
    r.h.spirituality -= result.effect.spirituality; r.h.mind -= result.effect.mind;
    if (result.effect.toLocation) r.h.location = result.effect.toLocation;
    r.tick(result.effect.seconds); r.h.check = null; return result;
  };
  const block = (type: DeathEpilogueCommand['type']) => deathEpilogueBlock(state, { type }, r.h);
  const barrier = () => { step('OBSERVE'); step('ASK_BARRIER_PERMISSION'); step('OBSERVE_PROPAGATION'); };
  const passage = () => { if (!state.observed) step('OBSERVE'); step('ASK_PASSAGE_PERMISSION'); step('SURVEY_ENDPOINTS'); };
  return { ...r, intro, step, block, barrier, passage, get state() { return state; } };
}

describe('Death single same-vessel epilogue', () => {
  it('previews and records the real 3600m/3665s round trip, permission before custody', () => {
    const r = completed(), before = structuredClone(r.services), p = deathEpilogueStartPreview(r.services, r.h);
    expect(p).toMatchObject({ enabled: true, metres: 3600, seconds: 3665, mind: 2, actions: 0, cash: 0 });
    const started = startDeathEpilogue(r.services, r.h), s = started.state;
    expect(r.services).toEqual(before); expect(s.origin.residue).toEqual(before.residue); expect(s.origin.wharf).toEqual(before.wharf);
    expect(s.introduction.phases.map(p => p.kind)).toEqual(['ASK_RECEIVER', 'WALK_TO_KEEPER', 'ASK_KEEPER', 'LOAD_ORIGINAL', 'CARRY_ORIGINAL', 'HANDOVER_ORIGINAL', 'TIDE_INCIDENT']);
    expect(s.introduction.phases.filter(p => p.permission).every(p => p.permission?.status === 'ALLOW')).toBe(true);
    expect(started.movements.filter(m => m.actorId === r.h.actorId).reduce((sum, m) => sum + m.metres, 0)).toBe(3600);
    expect(s.residue).toMatchObject({ id: before.residue.residue.id, total: 4, exposed: 1, contained: 3, dissipated: 0 });
    expect(s.vessel).toMatchObject({ ownerId: before.residue.custodian.id, holderId: before.wharf.workers[0].id, seal: 'BROKEN' });
    expect(s.vessel.keeper).toEqual(before.residue.custodian); expect(s.vessel.roomScreen).toMatchObject({ location: 'DE0-RESIDUE-ROOM', position: 6 });
    expect(s.wharf.workers.map(p => [p.position, p.energy, p.health])).toEqual([[12, 74, 100], [12, 68, 100]]);
    expect(s.wharf.bridge.condition).toBe(46); expect(s.wharf.rope.condition).toBe(82);
  });
  it.each(['receiver', 'keeper'] as const)('honours %s refusal with no moved original or invented incident', party => {
    const r = scene(s => { (party === 'receiver' ? s.wharf.workers[0] : s.residue.custodian).willingness = 'REFUSED'; });
    expect(r.intro.effect).toMatchObject({ seconds: party === 'receiver' ? 10 : 3640, mind: 0 });
    expect(r.state.vessel.delivered).toBe(false); expect(r.state.residue).toMatchObject({ exposed: 0, contained: 4 });
    expect(r.state.pulse.outcome).toBe('NONE'); expect(r.state.wharf.rope.condition).toBe(85);
    r.step('OBSERVE'); expect(r.block('PARTIAL_SPIRIT_PASSAGE')).not.toBeNull(); r.step('REPORT');
    expect(r.state.status).toBe('RESOLVED'); expect(r.state.journal.every(e => Object.keys(e.masteryGains).length === 0)).toBe(true);
  });
  it('never awards mastery for successful opening, only its one actual application', () => {
    const r = scene(); r.barrier(); const opening = r.step('PROPAGATION_BARRIER');
    expect(opening.state.journal.at(-1)?.check?.chance).toBe(70); expect(opening.masteryGains).toEqual({});
    expect(r.h).toMatchObject({ spirituality: 92, mind: 85 });
    const application = r.step('APPLY_BARRIER'); expect(application.masteryGains).toEqual({ [DEATH_ABILITY_IDS[1]]: 8 });
    expect(r.block('APPLY_BARRIER')).not.toBeNull(); expect(r.block('PROPAGATION_BARRIER')).not.toBeNull();
    r.passage(); const passage = r.step('PARTIAL_SPIRIT_PASSAGE'); expect(passage.masteryGains).toEqual({});
    expect(passage.state.journal.at(-1)?.check?.chance).toBe(70);
    const transit = r.step('TRAVERSE_PASSAGE'); expect(transit.masteryGains).toEqual({ [DEATH_ABILITY_IDS[0]]: 8 });
    expect(r.state.wharf.workers[1]).toMatchObject({ position: 18, health: 100, energy: 65, travelledMetres: 18, elapsedSeconds: 18 });
    expect(r.state.wharf.workers[1].injuries).toContain('DE0-WHARF-WORKER-2:OLD-ANKLE-SPRAIN');
    r.step('MANUAL_SEAL'); r.step('REPORT'); expect(r.state.position).toBe(12); expect(r.state.playerLocation).toBe('DE0-OLD-WHARF');
    expect(r.state.residue).toMatchObject({ total: 4, exposed: 0, contained: 3, dissipated: 1 });
    expect(r.state.vessel.seal).toBe('BROKEN'); expect(nextDeathEpilogueCommand(r.state, r.h)).toBeNull();
  });
  it('retains failed attempt costs and never retries or grants mastery', () => {
    const r = scene(); r.barrier(); const before = r.state.wharf.rope.condition;
    const result = r.step('PROPAGATION_BARRIER', 90);
    expect(result.masteryGains).toEqual({}); expect(r.state.barrier.window).toMatchObject({ attempted: true, passed: false, applied: false });
    expect(r.state.wharf.rope.condition).toBe(before - 2); expect(r.h.spirituality).toBe(92); expect(r.block('PROPAGATION_BARRIER')).not.toBeNull();
    r.step('MANUAL_SEAL'); r.step('REPORT'); expect(r.state.residue).toMatchObject({ contained: 4, exposed: 0, dissipated: 0 });
    expect(r.state.journal.every(e => Object.keys(e.masteryGains).length === 0)).toBe(true);
  });
  it('ordinary closure needs no casts, fresh seal, cash or AP', () => {
    const r = scene(); r.h.cash = 0; r.h.actions = 0; r.h.spirituality = 0;
    r.step('OBSERVE'); r.step('MANUAL_SEAL'); r.step('REPORT');
    expect(r.state.vessel).toMatchObject({ lid: 'CLOSED', seal: 'BROKEN' });
    expect(r.state.journal.every(e => e.check === null && Object.keys(e.masteryGains).length === 0)).toBe(true);
    expect(r.state.passage.window.attempted).toBe(false); expect(r.state.barrier.window.attempted).toBe(false);
  });
  it('zero-cash necessary withdrawal has real local/city movement and an aligned end week', () => {
    const r = scene(); r.h.cash = 0; r.h.actions = 0; r.h.spirituality = 0; r.h.nowSecond = 604790;
    const result = r.step('WITHDRAW');
    expect(result.effect).toMatchObject({ cashCost: 0, cashGain: 0, actions: 0, toLocation: 'DE0-RECEPTION', seconds: 1807 });
    expect(result.movements.filter(m => m.actorId === r.h.actorId).reduce((sum, m) => sum + m.metres, 0)).toBe(1806);
    expect(r.h.location).toBe('DE0-RECEPTION'); expect(r.state.playerLocation).toBe(r.h.location);
    expect(r.state.journal.at(-1)?.endWeek).toBe(r.h.week); expect(r.state.status).toBe('WITHDRAWN');
    expect(r.state.wharf.workers[1].position).toBe(12); expect(r.state.wharf.workers[1].health).toBe(96);
    expect(r.state.wharf.workers[1].injuries).toContain('DE0-WHARF-WORKER-2:OLD-ANKLE-SPRAIN');
    expect(projectDeathEpilogue(r.state, r.h.nowSecond).currentScenePosition).toBeNull();
  });
  it('consenting ordinary retreat moves only the real companion and does not grant mastery', () => {
    const r = scene(); r.step('OBSERVE'); r.step('ASK_PASSAGE_PERMISSION'); const result = r.step('ORDINARY_EXIT');
    expect(r.state.wharf.workers[1]).toMatchObject({ position: 18, energy: 66, health: 100 });
    expect(r.state.wharf.workers[0].position).toBe(12); expect(r.state.pulse.outcome).toBe('MISSED');
    expect(result.masteryGains).toEqual({}); expect(r.state.arrivals).toEqual([]);
  });
  it('invalidates un-applied windows on real shared-anchor wear, occlusion and expiry', () => {
    const r = scene(); r.barrier(); r.passage(); r.step('PROPAGATION_BARRIER'); r.step('PARTIAL_SPIRIT_PASSAGE');
    expect(r.state.barrier.window.counter).toBe('ANCHOR_MOVED'); expect(r.block('APPLY_BARRIER')).not.toBeNull();
    r.step('LOWER_SCREEN'); expect(r.state.passage.window.counter).toBe('OCCLUDED'); expect(r.block('TRAVERSE_PASSAGE')).not.toBeNull();
    const another = scene(); another.barrier(); another.step('PROPAGATION_BARRIER'); another.h.nowSecond += 21;
    expect(another.block('APPLY_BARRIER')).not.toBeNull();
  });
  it('fresh recommendation sequence terminates after finite attempts and preserves source snapshots', () => {
    const r = scene(), original = structuredClone(r.state.origin); let steps = 0;
    while (r.state.status === 'ACTIVE' && steps < 30) {
      const next = nextDeathEpilogueCommand(r.state, r.h); expect(next).not.toBeNull(); r.step(next!.type); steps++;
    }
    expect(steps).toBeLessThan(30); expect(r.state.status).toBe('RESOLVED'); expect(r.state.origin).toEqual(original);
    expect(r.state.journal.filter(e => e.check !== null)).toHaveLength(2);
    expect(r.state.journal.flatMap(e => Object.values(e.masteryGains))).toEqual([8, 8]);
    expect(getDeathEpilogueActions(r.state, r.h).every(a => !a.preferredAction)).toBe(true);
    const publicText = JSON.stringify(projectDeathEpilogue(r.state, r.h.nowSecond));
    for (const privateKey of ['sourceDigest', 'seed', 'cursor', 'dueSecond', 'willingness', 'origin']) expect(publicText).not.toContain(`"${privateKey}"`);
  });
  it('rejects forged checks, hosts or consent in public commands', () => {
    expect(validateDeathEpilogueCommand({ type: 'OBSERVE' })).toBe(true);
    for (const extra of [{ check: {} }, { consent: true }, { host: {} }, { target: 'other' }, { roll: 1 }])
      expect(validateDeathEpilogueCommand({ type: 'OBSERVE', ...extra })).toBe(false);
  });
});
