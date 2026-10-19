import { describe, expect, it } from 'vitest';
import { computeCheckChance, resolveNormalCheck } from '../src/resolution/normal-check.js';
import { ERROR_ASCENT_EPILOGUE_SCENE as S } from '../src/domain/error-ascent/epilogue-content.js';
import {
  ERROR_ASCENT_EPILOGUE_ABILITY_IDS, applyErrorAscentEpilogue, createErrorAscentEpilogue,
  errorAscentEpilogueBlock, getErrorAscentEpilogueActions, getErrorAscentEpilogueCheckInput,
  projectErrorAscentEpilogue, validateErrorAscentEpilogueCommand, validateErrorAscentEpilogueState,
  type ErrorAscentEpilogueCommand, type ErrorAscentEpilogueHost,
} from '../src/domain/error-ascent/epilogue.js';

const [THEFT, DIVERSION] = ERROR_ASCENT_EPILOGUE_ABILITY_IDS;
const START = 36000;
/** Explicit module fixture, not evidence of a naturally played S0 promotion.
 * The chapter owns admission, random cursor and atomic budget persistence. */
function scene() {
  const h: ErrorAscentEpilogueHost = {
    actorId: 'PRIVATE_EPILOGUE_ACTOR', eventId: 'PRIVATE_EPILOGUE_EVENT_1', revision: 1,
    week: 200, nowSecond: START, location: S.location, sequence: 0, status: 'ACTIVE',
    cash: 0, actions: 2, health: 100, mind: 100, spirituality: 100,
    coreStats: { will: 27, perception: 29 }, check: null,
  };
  let state = createErrorAscentEpilogue({ actorId: h.actorId, week: h.week, nowSecond: h.nowSecond });
  const mastery: Record<string, number> = { [THEFT]: 0, [DIVERSION]: 0, 'error.s1.short-time-theft': 16 };
  const check = (type: ErrorAscentEpilogueCommand['type'], roll = 37) => {
    const spec = getErrorAscentEpilogueCheckInput({ type });
    return spec ? resolveNormalCheck({ ability: spec.ability, difficulty: spec.difficulty,
      baseAbility: spec.ability === 'will' ? h.coreStats.will : h.coreStats.perception,
      modifiers: [{ source: spec.source, value: spec.modifier }], roll }) : null;
  };
  const block = (type: ErrorAscentEpilogueCommand['type']) => errorAscentEpilogueBlock(state, { type }, h);
  const step = (type: ErrorAscentEpilogueCommand['type'], roll = 37) => {
    h.check = check(type, roll);
    const before = structuredClone(state), hostBefore = structuredClone(h);
    const result = applyErrorAscentEpilogue(state, { type }, h), e = result.effect;
    expect(state).toEqual(before); expect(h).toEqual(hostBefore);
    expect(e.cashGain).toBe(0); expect(e.toLocation).toBeNull();
    expect([e.actions, e.cashCost, e.health, e.mind, e.spirituality, e.seconds].every(n => n >= 0)).toBe(true);
    state = result.state;
    h.cash -= e.cashCost; h.actions -= e.actions; h.spirituality -= e.spirituality;
    h.health = Math.max(0, h.health - e.health); h.mind = Math.max(0, h.mind - e.mind); h.nowSecond += e.seconds;
    if (!h.health || !h.mind) h.status = 'DEAD';
    for (const [id, gain] of Object.entries(result.masteryGains)) mastery[id] = (mastery[id] ?? 0) + gain;
    h.revision++; h.eventId = `PRIVATE_EPILOGUE_EVENT_${h.revision}`; h.check = null;
    expect(state.lastSecond).toBe(h.nowSecond);
    return result;
  };
  const prepareRelease = (theftRoll = 37) => {
    step('OBSERVE'); step('STEAL_MOVEMENT', theftRoll); step('APPROACH_LEVER'); step('PULL_RELEASE');
  };
  return { h, mastery, check, block, step, prepareRelease, get state() { return state; } };
}

describe('Error219 finite post-promotion escape module', () => {
  it('awards each mastery8 only after real later movement or release, then reaches the same exit with its pursuer stopped', () => {
    const r = scene(); r.step('OBSERVE');
    const theft = r.step('STEAL_MOVEMENT');
    expect(theft.effect).toMatchObject({ actions: 1, cashCost: 0, spirituality: 14, mind: 6, seconds: 1 });
    expect(theft.masteryGains).toEqual({});
    expect(r.state.theft).toMatchObject({ passed: true, applied: false, remainingSeconds: 3, stolenSeconds: 0 });
    r.step('APPROACH_LEVER');
    expect(r.state.player).toMatchObject({ positionMetres: 4, travelledMetres: 4 });
    expect(r.state.theft).toMatchObject({ stolenSeconds: 3, playerMetresDuringDelay: 3, applied: false });
    expect(r.mastery[THEFT]).toBe(0);
    const pull = r.step('PULL_RELEASE');
    expect(pull.masteryGains).toEqual({ [THEFT]: 8 });
    expect(r.state.theft.appliedSecond).toBe(START + 8);
    expect(r.state.guard.positionMetres).toBe(-6);
    expect(r.state.mechanism.release).toMatchObject({ state: 'PENDING', dueSecond: START + 13 });
    const diversion = r.step('DIVERT_RELEASE');
    expect(diversion.effect).toMatchObject({ actions: 1, spirituality: 12, mind: 6, seconds: 2 });
    expect(diversion.masteryGains).toEqual({});
    expect(r.state.diversion).toMatchObject({ passed: true, applied: false, expiresSecond: START + 30 });
    const crossed = r.step('CROSS_EXIT');
    expect(crossed.masteryGains).toEqual({ [DIVERSION]: 8 });
    expect(r.state).toMatchObject({ status: 'ESCAPED', lastSecond: START + 15,
      player: { route: 'OUTSIDE_MAIN', positionMetres: 9, travelledMetres: 9, healthLoss: 0 },
      guard: { id: S.guardId, positionMetres: 1, health: 92, status: 'STOPPED_BY_GRILLE',
        movement: { completedSecond: START + 11 }, cut: { cutSecond: START + 15 } },
      arrival: { routeId: S.mainExitId, second: START + 15, pursuerStopped: true } });
    expect(r.state.mechanism).toMatchObject({ exit: { id: S.exitId, open: true, spring: 'HELD', condition: 89 },
      grille: { id: S.grilleId, open: false, gravity: 'SPENT', condition: 84 },
      exitLatch: { quantity: 1, latched: true }, grilleLatch: { quantity: 1, latched: false },
      lever: { strokesRemaining: 0 }, link: { intact: false },
      release: { state: 'DIVERTED', settledSecond: START + 13, actualLatchId: S.grilleLatchId } });
    expect(r.h).toMatchObject({ actions: 0, cash: 0, spirituality: 74, mind: 88, health: 100 });
    expect(r.mastery).toEqual({ [THEFT]: 8, [DIVERSION]: 8, 'error.s1.short-time-theft': 16 });
    r.step('REPORT'); expect(r.block('REPORT')).not.toBeNull();
    expect(validateErrorAscentEpilogueState(r.state)).toBe(true);
  });

  it('does not reward idle successful casting, cancelled time, or leaving the real link before its application', () => {
    const idle = scene(); idle.step('OBSERVE'); idle.step('STEAL_MOVEMENT'); idle.step('WAIT_WINDOW');
    expect(idle.state.theft).toMatchObject({ passed: true, stolenSeconds: 3, playerMetresDuringDelay: 0, applied: false });
    expect(idle.state.guard.movement.state).toBe('COMPLETED'); expect(idle.mastery[THEFT]).toBe(0);
    const stopped = scene(); stopped.step('OBSERVE'); stopped.step('STEAL_MOVEMENT'); stopped.step('STOP_EFFECTS');
    stopped.step('APPROACH_LEVER');
    expect(stopped.state.theft).toMatchObject({ remainingSeconds: 0, stolenSeconds: 0, applied: false, stopped: true });
    expect(stopped.h.actions).toBe(1); expect(stopped.h.spirituality).toBe(86);
    const left = scene(); left.prepareRelease(); left.step('DIVERT_RELEASE'); left.step('WITHDRAW');
    expect(left.state.diversion).toMatchObject({ passed: true, applied: false, endedReason: 'LEFT_POSITION' });
    expect(left.state.mechanism.release).toMatchObject({ state: 'EXIT_CLOSED', actualLatchId: S.exitLatchId });
    expect(left.mastery).toMatchObject({ [THEFT]: 8, [DIVERSION]: 0 });
    expect(left.state.player.route).toBe('OUTSIDE_SIDE');
    expect(validateErrorAscentEpilogueState(left.state)).toBe(true);
  });

  it('refuses already executing movement, repeat attempts, altered latch links and remote positions', () => {
    const moving = scene(); moving.step('OBSERVE'); moving.step('APPROACH_LEVER');
    expect(moving.state.guard.movement.state).toBe('MOVING');
    expect(moving.block('STEAL_MOVEMENT')).not.toBeNull();
    const r = scene(); r.prepareRelease();
    expect(r.block('STEAL_MOVEMENT')).not.toBeNull(); expect(r.block('PULL_RELEASE')).not.toBeNull();
    const command: ErrorAscentEpilogueCommand = { type: 'DIVERT_RELEASE' };
    const changed = structuredClone(r.state); changed.mechanism.link.endpoints[1] = 'NOT_THE_ORIGINAL_LATCH';
    expect(errorAscentEpilogueBlock(changed, command, r.h)).not.toBeNull();
    expect(() => applyErrorAscentEpilogue(changed, command, { ...r.h, check: r.check('DIVERT_RELEASE') })).toThrow();
    const remote = structuredClone(r.state); remote.player.positionMetres = 0;
    expect(errorAscentEpilogueBlock(remote, command, r.h)).not.toBeNull();
    r.step('DIVERT_RELEASE'); expect(r.block('DIVERT_RELEASE')).not.toBeNull();
    r.step('CROSS_EXIT'); expect(r.block('PULL_RELEASE')).not.toBeNull();
    expect(validateErrorAscentEpilogueCommand({ type: 'DIVERT_RELEASE', success: true })).toBe(false);
  });

  it('lets a real defender cut the original link before a simultaneous pending release, without erasing the costs', () => {
    const r = scene(); r.step('OBSERVE'); r.step('APPROACH_LEVER'); r.step('PULL_RELEASE');
    expect(r.state.mechanism.release.dueSecond).toBe(START + 12);
    r.step('DIVERT_RELEASE'); expect(r.state.diversion.passed).toBe(true);
    const waited = r.step('WAIT_WINDOW');
    expect(waited.masteryGains).toEqual({});
    expect(r.state.guard.cut).toMatchObject({ state: 'CUT', cutSecond: START + 12 });
    expect(r.state.diversion).toMatchObject({ applied: false, endedReason: 'LINK_CUT' });
    expect(r.state.mechanism).toMatchObject({ link: { intact: false, condition: 0, version: 2 },
      release: { state: 'EXIT_CLOSED', settledSecond: START + 12, actualLatchId: S.exitLatchId },
      exit: { open: false, spring: 'SPENT', condition: 86 }, grille: { open: true, gravity: 'HELD', condition: 87 } });
    expect(r.state.guard).toMatchObject({ positionMetres: 7, status: 'STOPPED_BY_EXIT' });
    expect(r.h).toMatchObject({ actions: 1, spirituality: 88, mind: 94, health: 92 });
    expect(r.block('DIVERT_RELEASE')).not.toBeNull(); expect(r.block('CROSS_EXIT')).not.toBeNull();
    r.step('WITHDRAW'); expect(r.state.player.route).toBe('OUTSIDE_SIDE'); expect(r.mastery[DIVERSION]).toBe(0);
    expect(validateErrorAscentEpilogueState(r.state)).toBe(true);
  });

  it('pays both failed or severe-failed checks and still permits a real ordinary retreat at zero remaining AP', () => {
    for (const roll of [90, 100]) {
      const r = scene(); r.prepareRelease(roll); const failed = r.step('DIVERT_RELEASE', roll);
      expect(failed.masteryGains).toEqual({});
      expect(r.state.theft.passed).toBe(false); expect(r.state.diversion.passed).toBe(false);
      expect(r.h).toMatchObject({ actions: 0, spirituality: 74, mind: 88, cash: 0, health: 100 });
      expect(getErrorAscentEpilogueActions(r.state, r.h).find(a => a.command.type === 'WITHDRAW')).toMatchObject({ enabled: true });
      const retreat = r.step('WITHDRAW');
      expect(retreat.effect).toMatchObject({ seconds: 25, actions: 0, cashCost: 0, spirituality: 0, mind: 0, health: 0 });
      expect(r.state).toMatchObject({ status: 'WITHDRAWN', lastSecond: START + 35,
        player: { route: 'OUTSIDE_SIDE', positionMetres: 24, travelledMetres: 29, sideEntryFromMetres: 4 },
        arrival: { routeId: S.sideExitId, pursuerStopped: false } });
      expect(r.h).toMatchObject({ actions: 0, spirituality: 74, mind: 88, cash: 0, health: 100 });
      expect(r.mastery).toEqual({ [THEFT]: 0, [DIVERSION]: 0, 'error.s1.short-time-theft': 16 });
      expect(validateErrorAscentEpilogueState(r.state)).toBe(true);
    }
  });

  it('allows the unobserved ordinary exit without resources, but actual lethal contact stops all later movement', () => {
    const poor = scene(); Object.assign(poor.h, { actions: 0, cash: 0, spirituality: 0, mind: 1, health: 1 });
    const retreat = poor.step('WITHDRAW');
    expect(retreat.effect).toMatchObject({ actions: 0, cashCost: 0, seconds: 25, health: 0 });
    expect(poor.h).toMatchObject({ status: 'ACTIVE', health: 1, mind: 1, spirituality: 0, actions: 0 });
    expect(poor.state).toMatchObject({ observed: false, status: 'WITHDRAWN', player: { travelledMetres: 25 } });
    expect(poor.state.mechanism.lever.strokesRemaining).toBe(1);
    const dying = scene(); dying.h.health = 8; dying.step('OBSERVE'); dying.step('APPROACH_LEVER');
    const contact = dying.step('WAIT_WINDOW');
    expect(contact.effect).toMatchObject({ health: 8, seconds: 8 });
    expect(contact.injuries).toHaveLength(1);
    expect(dying.h).toMatchObject({ health: 0, status: 'DEAD', nowSecond: START + 14 });
    expect(dying.state).toMatchObject({ status: 'DEAD', arrival: null,
      player: { route: 'GALLERY', positionMetres: 4, travelledMetres: 4, healthLoss: 8 },
      guard: { positionMetres: 3, health: 92, strike: { used: true, second: START + 14, healthLoss: 8 }, baton: { condition: 86 } } });
    expect(dying.block('WITHDRAW')).not.toBeNull(); expect(dying.block('REPORT')).not.toBeNull();
    expect(validateErrorAscentEpilogueState(dying.state)).toBe(true);
  });

  it('uses current normal-check stats for the 74/62 calibration and rejects forged or missing host checks', () => {
    const r = scene();
    expect(r.check('STEAL_MOVEMENT')?.chance).toBe(74); expect(r.check('DIVERT_RELEASE')?.chance).toBe(62);
    const spec = getErrorAscentEpilogueCheckInput({ type: 'STEAL_MOVEMENT' })!;
    expect(computeCheckChance({ baseAbility: 20, difficulty: spec.difficulty,
      modifiers: [{ source: spec.source, value: spec.modifier }] })).toBe(60);
    r.step('OBSERVE');
    const command: ErrorAscentEpilogueCommand = { type: 'STEAL_MOVEMENT' }, original = structuredClone(r.state);
    const forged = resolveNormalCheck({ ability: 'will', baseAbility: 500, difficulty: spec.difficulty,
      modifiers: [{ source: spec.source, value: spec.modifier }], roll: 37 });
    expect(() => applyErrorAscentEpilogue(r.state, command, { ...r.h, check: forged })).toThrow();
    expect(() => applyErrorAscentEpilogue(r.state, command, { ...r.h, check: null })).toThrow();
    expect(() => applyErrorAscentEpilogue(r.state, { type: 'WAIT_WINDOW' }, { ...r.h, check: r.check('STEAL_MOVEMENT') })).toThrow();
    expect(errorAscentEpilogueBlock(r.state, command, { ...r.h, nowSecond: r.h.nowSecond + 1 })).not.toBeNull();
    expect(r.state).toEqual(original); expect(r.h.actions).toBe(2);
  });

  it('projects only public text and rejects local state or payment tampering without a historical replay', () => {
    const r = scene(); r.prepareRelease(); r.step('DIVERT_RELEASE'); r.step('CROSS_EXIT'); r.step('REPORT');
    const projection = projectErrorAscentEpilogue(r.state), json = JSON.stringify(projection);
    expect(Object.keys(projection).sort()).toEqual(['lines', 'nextStep', 'story']);
    expect(json).not.toMatch(/"(?:journal|host|check|roll|random|coreStats)"|PRIVATE_EPILOGUE/);
    expect(projection.lines.join(' ')).toContain('掌握增8');
    expect(r.state.journal.some(j => j.host.check !== null)).toBe(true);
    expect(validateErrorAscentEpilogueState(r.state)).toBe(true);
    const position = structuredClone(r.state); position.guard.positionMetres = 99;
    const payment = structuredClone(r.state); payment.journal.find(j => j.command.type === 'STEAL_MOVEMENT')!.effect.actions = 0;
    const originalItem = structuredClone(r.state); originalItem.mechanism.grilleLatch.id = 'COPIED_NEW_LATCH';
    expect(validateErrorAscentEpilogueState(position)).toBe(false);
    expect(validateErrorAscentEpilogueState(payment)).toBe(false);
    expect(validateErrorAscentEpilogueState(originalItem)).toBe(false);
  });
});
