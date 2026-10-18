import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  LIGHT_SEEKER_CASE_IDS, applyLightSeekerActivity, blockLightSeekerLife, createLightSeekerLifeState,
  hasLightSeekerLifeLock, projectLightSeekerLife, validateLightSeekerActivityCommand, validateLightSeekerLife,
  type LightSeekerActivityCommand, type LightSeekerCaseId, type LightSeekerLifeEvent,
} from '../../src/domain/light-seeker/life.js';
import { createLightSeekerSiteState, validateLightSeekerSiteState, advanceLightSeekerTime } from '../../src/domain/light-seeker/resources.js';
import { blockLightSeekerEncounter } from '../../src/domain/light-seeker/encounter.js';
import {
  lightSeekerBoundaryForIntent, lightSeekerSnapshot, sunLegacyKeys, ct, rejectCt, unitBudget,
  type LightSeekerBoundary,
} from './light-seeker-helper.js';

const GUIDED = 'sun.s2.guided-radiance', LIMITED = 'sun.s2.limited-light';
let promoted: SliceState, practiced: SliceState;
let marker: LightSeekerBoundary, screened: LightSeekerBoundary, withdrawn: LightSeekerBoundary;
const attempt = (s: SliceState, caseId: LightSeekerCaseId) => s.lightSeeker.life.cases[caseId].attempts.at(-1)!;
const mastery = (s: SliceState) => [s.progression.mastery[GUIDED], s.progression.mastery[LIMITED]];
const originals = (s: SliceState) => [...sunLegacyKeys.map(key => s[key]), s.character, s.injuries, s.injuryRisk, s.combatHistory, s.town, s.knowledge];
const matches = (intent: SliceIntent, type: LightSeekerActivityCommand['type'], caseId: LightSeekerCaseId) =>
  intent.type === 'LIGHT_SEEKER' && intent.command.type === type && 'caseId' in intent.command && intent.command.caseId === caseId;
const capture = (type: LightSeekerActivityCommand['type'], caseId: LightSeekerCaseId) =>
  lightSeekerBoundaryForIntent(intent => matches(intent, type, caseId));
const wasSuccessful = (tier: unknown) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
beforeAll(() => {
  promoted = lightSeekerSnapshot('promoted'); practiced = lightSeekerSnapshot('practiced');
  // Real recorded commands select captures. No boundary-name guess, chosen seed or predicted tier.
  const cast = (caseId: LightSeekerCaseId) => lightSeekerBoundaryForIntent(
    intent => matches(intent, 'PERFORM', caseId), b => b.beforeLast.lightSeeker.life.cases[caseId].method === 'ABILITY');
  marker = cast('marker-path'); screened = cast('screened-return'); withdrawn = cast('withdrawn-visit');
});

/** DIRECTED LOCAL-STEP ONLY. A clone and injected endpoint roll exercise a branch;
 * they are never saved, described as natural play or passed off as a replay-valid history.
 * This does not search or change the genuine fixture's seed/cursor to obtain an outcome. */
function direct(s: SliceState, command: LightSeekerActivityCommand, roll: 1 | 100 = 1) {
  const ctx: SeerContext = {
    roll: vi.fn(() => { throw new Error('Unexpected extra light-seeker draw'); }), note: vi.fn(),
    check: vi.fn((ability, difficulty) => {
      s.random.cursor++;
      return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    }),
  };
  applyLightSeekerActivity(s, command, ctx); return ctx;
}
function denied(s: SliceState, command: LightSeekerActivityCommand) {
  const before = structuredClone(s);
  expect(blockLightSeekerLife(s, command)).not.toBeNull();
  expect(() => direct(s, command)).toThrow(); expect(s).toEqual(before);
}
function finish(s: SliceState, caseId: LightSeekerCaseId) {
  const a = attempt(s, caseId), p = s.lightSeeker.life.site;
  if (p.light.mode !== 'OFF' || a.performed && a.spiritualitySpent > 0 && !a.lightStopped) direct(s, { type: 'STOP', caseId });
  if (caseId === 'marker-path' && p.operatorLocation === 'FAR') direct(s, { type: 'RETURN_OPERATOR', caseId });
  if (p.spiritLocation === 'ENTRY') direct(s, { type: 'RETIRE_SPIRIT', caseId });
  if (p.shutter.state === 'OPEN') direct(s, { type: 'CLOSE_SHUTTER', caseId });
  if (caseId === 'screened-return' && p.operatorLocation === 'FAR') direct(s, { type: 'RETURN_OPERATOR', caseId });
  if (caseId === 'screened-return' && a.performed && !a.screenInspected) direct(s, { type: 'INSPECT_SCREEN', caseId });
  if (p.cover.position === 'SCREEN') direct(s, { type: 'RETURN_COVER', caseId });
  direct(s, { type: 'INSPECT', caseId }); direct(s, { type: 'LEAVE', caseId });
}
function report(s: SliceState, caseId: LightSeekerCaseId) {
  // Explicit directed unit budget, only after the physical contact has been closed.
  s.actionsRemaining = 1; direct(s, { type: 'REPORT', caseId });
}
function realSeconds(e: LightSeekerLifeEvent, s: SliceState): number {
  const c = e.command;
  if (c.type === 'PERFORM') {
    if (s.lightSeeker.life.cases[c.caseId].method === 'ABILITY') return 10;
    return c.caseId === 'marker-path' ? 0 : 4;
  }
  if (c.type === 'MOVE_OPERATOR_FAR') return c.caseId === 'screened-return' ? 12 : 6;
  const seconds: Partial<Record<LightSeekerActivityCommand['type'], number>> = {
    CONSENT_OPERATOR: 2, DECLINE_OPERATOR: 2, CONSENT_SPIRIT: 2, DECLINE_SPIRIT: 2,
    INVITE_SPIRIT: 9, RETIRE_SPIRIT: 9, OPEN_SHUTTER: 8, CLOSE_SHUTTER: 8,
    PLACE_COVER: 7, RETURN_COVER: 7, TRACE_MARK: 4, READ_LAMP: 4, PASS_OPERATOR: 6,
    RETURN_OPERATOR: 6, INSPECT_SCREEN: 10, WITHDRAW_PERMISSION: 1, WAIT_10: 10, INSPECT: 2,
  };
  return seconds[c.type] ?? 0;
}

describe('LightSeeker actual life captures and one conserved six-metre gallery', () => {
  it('starts with independent Mara and Reed, the fixed existing board and exactly one set of original objects', () => {
    expect(promoted.lightSeeker.life).toEqual(createLightSeekerLifeState());
    expect(promoted.lightSeeker.life.site).toEqual(createLightSeekerSiteState());
    expect(Object.keys(promoted.lightSeeker.life.cases)).toEqual([...LIGHT_SEEKER_CASE_IDS]);
    expect(promoted.lightSeeker.life.site).toMatchObject({ id: 'LS2-GALLERY', lengthMetres: 6, ordinaryExit: 'OPEN',
      playerLocation: 'ENTRY', playerMetres: 0, operatorId: 'LS2-MARA', operatorAge: 46,
      operatorLocation: 'ENTRY', operatorEnergy: 100, operatorMetres: 0, operatorConsent: 'UNASKED',
      spiritId: 'LS2-REED', spiritLocation: 'SIDE', spiritMetres: 0, spiritEnergy: 100, spiritConsent: 'UNASKED',
      shutter: { id: 'LS2-SHUTTER', state: 'CLOSED', durability: 100, operations: 0 },
      lamp: { id: 'LS2-LAMP', oil: 3 }, board: { id: 'LS2-MARK', inscription: 'NORTH_ARCH', location: 'FAR_STAND', owner: 'LS2-MARA', read: false } });
    expect(mastery(promoted)).toEqual([0, 0]); expect(hasLightSeekerLifeLock(promoted)).toBe(false);
    expect(validateLightSeekerLife(promoted)).toBe(true);
    const other = createLightSeekerLifeState(); other.site.lamp.oil--; expect(promoted.lightSeeker.life.site.lamp.oil).toBe(3);
  });

  it.each(LIGHT_SEEKER_CASE_IDS)('replays the actual %s cast, paying the complete cost regardless of its recorded result', caseId => {
    const b = caseId === 'marker-path' ? marker : caseId === 'screened-return' ? screened : withdrawn;
    const before = structuredClone(b.beforeLast), next = applySliceIntent(b.beforeLast, b.lastIntent);
    expect(next).toEqual(b.final); expect(b.beforeLast).toEqual(before); assertValidSliceState(next);
    expect(validateLightSeekerLife(next)).toBe(true); expect(originals(next)).toEqual(originals(before));
    const e = next.lightSeeker.life.journal.at(-1)!, cost = caseId === 'marker-path' ? 7 : 9;
    expect(e.command).toEqual({ type: 'PERFORM', caseId }); expect(e.paid).toEqual({ actions: 1, spirituality: cost });
    expect(next.spirituality).toBe(before.spirituality - cost); expect(next.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(next.week).toBe(before.week); expect(next.lightSeeker.life.site.elapsedSeconds - before.lightSeeker.life.site.elapsedSeconds).toBe(10);
    expect(e.source).toMatchObject({ caseId, abilityId: caseId === 'marker-path' ? GUIDED : LIMITED, cost,
      abilityCost: caseId === 'marker-path' ? 7 : 6, inheritedCost: caseId === 'marker-path' ? 0 : 3,
      at: before.lightSeeker.life.site.elapsedSeconds, coreStat: caseId === 'marker-path' ? 'will' : 'knowledge',
      baseAbility: before.character.coreStats[caseId === 'marker-path' ? 'will' : 'knowledge'], operatorConsentWeek: before.week, site: before.lightSeeker.life.site });
    expect(e.check).toMatchObject({ ability: caseId === 'marker-path' ? 'will' : 'knowledge', difficulty: 20 });
    const random = new DeterministicActionRandomStream(before.random.seed, e.randomBefore!);
    expect(e.check!.roll).toBe(random.nextInt(1, 100)); expect(e.randomAfter).toBe(random.cursor);
    expect(next.random).toEqual({ seed: before.random.seed, cursor: before.random.cursor + 1 });
    expect(attempt(next, caseId)).toMatchObject({ spiritualitySpent: cost, appliedAbilityIds: [],
      window: wasSuccessful(e.tier) ? 'ACTIVE' : 'FAILED' });
    expect(next.lightSeeker.life.site.light.mode).toBe(wasSuccessful(e.tier) ? caseId === 'marker-path' ? 'GUIDED' : 'LIMITED' : caseId === 'marker-path' ? 'OFF' : 'PLAIN');
    if (wasSuccessful(e.tier)) expect(next.lightSeeker.life.site.light.expiresAt! - next.lightSeeker.life.site.elapsedSeconds).toBe(20);
    expect(mastery(next)).toEqual(mastery(before));
  });

  it('accounts for every second, real walk, independent energy debit, oil use and original wear from the ordered journal', () => {
    const l = practiced.lightSeeker.life, p = l.site, events = l.journal;
    const count = (type: LightSeekerActivityCommand['type']) => events.filter(e => e.command.type === type).length;
    expect(p.elapsedSeconds).toBe(events.reduce((n, e) => n + realSeconds(e, practiced), 0));
    const playerMetres = events.reduce((n, e) => {
      const c = e.command;
      if (['OPEN_SHUTTER', 'CLOSE_SHUTTER', 'PLACE_COVER', 'RETURN_COVER', 'INSPECT_SCREEN'].includes(c.type)) return n + 6;
      if (c.type === 'MOVE_OPERATOR_FAR') return n + (c.caseId === 'screened-return' ? 12 : 6);
      if (c.type === 'RETURN_OPERATOR' && c.caseId === 'marker-path') return n + 6;
      return n;
    }, 0);
    expect(p.playerMetres).toBe(playerMetres);
    const operatorTrips = count('MOVE_OPERATOR_FAR') + count('RETURN_OPERATOR') + count('PASS_OPERATOR');
    expect(p.operatorMetres).toBe(operatorTrips * 6); expect(p.operatorEnergy).toBe(100 - operatorTrips * 2);
    const spiritTrips = count('INVITE_SPIRIT') + count('RETIRE_SPIRIT');
    expect(p.spiritMetres).toBe(spiritTrips * 9); expect(p.spiritEnergy).toBe(100 - spiritTrips * 2);
    expect(p.shutter.operations).toBe(count('OPEN_SHUTTER') + count('CLOSE_SHUTTER'));
    expect(p.shutter.durability).toBe(100 - p.shutter.operations);
    expect(p.screen.inspections).toBe(count('INSPECT_SCREEN')); expect(p.screen.durability).toBe(100 - p.screen.inspections);
    expect(p.lamp.oil).toBe(3 - count('READ_LAMP'));
    expect(p).toMatchObject({ playerLocation: 'ENTRY', operatorLocation: 'ENTRY', spiritLocation: 'SIDE',
      light: { mode: 'OFF', expiresAt: null }, shutter: { state: 'CLOSED' }, cover: { position: 'OWNER_STAND' },
      board: { id: 'LS2-MARK', inscription: 'NORTH_ARCH', location: 'FAR_STAND', owner: 'LS2-MARA', read: true } });
    expect(events.every(e => e.budget.actionsBefore - e.budget.actionsAfter === e.paid.actions &&
      e.budget.spiritualityBefore - e.budget.spiritualityAfter === e.paid.spirituality)).toBe(true);
    expect(validateLightSeekerSiteState(p)).toBe(true); expect(validateLightSeekerLife(practiced)).toBe(true);
  });

  it('carries the same oil, wear, people and positions between cases instead of resetting a new site', () => {
    const first = attempt(practiced, 'marker-path'), second = attempt(practiced, 'screened-return'), third = attempt(practiced, 'withdrawn-visit');
    expect(first.siteAtStart).toEqual(createLightSeekerSiteState());
    expect(second.siteAtStart).toEqual(first.siteAtClose); expect(third.siteAtStart).toEqual(second.siteAtClose);
    expect(practiced.lightSeeker.life.site).toEqual(third.siteAtClose);
    expect(second.siteAtStart.shutter.durability).toBeLessThan(100);
    expect(third.siteAtStart.screen.durability).toBeLessThan(100);
    expect(first.siteAtClose!.operatorEnergy).toBe(first.siteAtStart.operatorEnergy - 4);
    expect(second.siteAtClose!.operatorEnergy).toBe(second.siteAtStart.operatorEnergy - 4);
    expect(third.spiritTravelMetres).toBeGreaterThanOrEqual(18); expect(third.spiritTravelMetres % 9).toBe(0);
  });

  it('awards 25 per honest report and 25 reflection, with new mastery only for actual applications and no old-skill bonus', () => {
    expect(practiced.progression.acting).toBe(100); expect(practiced.lightSeeker.life.reflected).toBe(true);
    for (const id of [GUIDED, LIMITED] as const) {
      const applied = LIGHT_SEEKER_CASE_IDS.filter(caseId => attempt(practiced, caseId).appliedAbilityIds.includes(id)).length;
      expect(practiced.progression.mastery[id]).toBe(applied * 8);
    }
    for (const [id, value] of Object.entries(promoted.progression.mastery)) {
      if (id !== GUIDED && id !== LIMITED) expect(practiced.progression.mastery[id], id).toBe(value);
    }
    expect(attempt(practiced, 'withdrawn-visit')).toMatchObject({ permissionWithdrawn: true, spiritVisited: true,
      spiritRetired: true, result: 'ORDINARY', appliedAbilityIds: [] });
    for (const caseId of LIGHT_SEEKER_CASE_IDS) {
      expect(practiced.lightSeeker.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true, closes: 1 });
      rejectCt(practiced, { type: 'REPORT', caseId }); rejectCt(practiced, { type: 'PREPARE', caseId, method: 'ABILITY' });
    }
    rejectCt(practiced, { type: 'REFLECT' }); expect(hasLightSeekerLifeLock(practiced)).toBe(false);
  });

  it('replays the actual current withdrawal without moving Reed, refunding the paid window or crediting an application', () => {
    const b = capture('WITHDRAW_PERMISSION', 'withdrawn-visit'), before = structuredClone(b.beforeLast);
    const next = applySliceIntent(b.beforeLast, b.lastIntent), p = next.lightSeeker.life.site;
    expect(next).toEqual(b.final); expect(b.beforeLast).toEqual(before); assertValidSliceState(next);
    expect(attempt(next, 'withdrawn-visit')).toMatchObject({ permissionWithdrawn: true, spiritConsent: 'WITHDRAWN', appliedAbilityIds: [] });
    expect(p.spiritLocation).toBe('SIDE'); expect(p.spiritId).toBe(before.lightSeeker.life.site.spiritId);
    expect(p.spiritMetres).toBe(before.lightSeeker.life.site.spiritMetres); expect(p.spiritEnergy).toBe(before.lightSeeker.life.site.spiritEnergy);
    expect(p.elapsedSeconds - before.lightSeeker.life.site.elapsedSeconds).toBe(1);
    expect(next.spirituality).toBe(before.spirituality); expect(next.random).toEqual(before.random);
    expect(mastery(next)).toEqual(mastery(before)); expect(next.lightSeeker.life.journal.at(-1)!.paid).toEqual({ actions: 0, spirituality: 0 });
    rejectCt(next, { type: 'INVITE_SPIRIT', caseId: 'withdrawn-visit' });
    rejectCt(next, { type: 'CONSENT_SPIRIT', caseId: 'withdrawn-visit' });
  });

  it('rejects invented truth, immunity, remote moves, arbitrary extra fields and unknown commands', () => {
    for (const c of [
      { type: 'TRACE_MARK', caseId: 'marker-path', revealTruth: true }, { type: 'TELEPORT', caseId: 'screened-return' },
      { type: 'MAKE_IMMUNE', caseId: 'withdrawn-visit' }, { type: 'MOVE_OPERATOR_FAR', caseId: 'marker-path', metres: 999 },
      { type: 'PREPARE', caseId: 'marker-path' }, { type: 'PREPARE', caseId: 'marker-path', method: 'FREE' },
      { type: 'REFLECT', caseId: 'marker-path' }, { type: 'OBSERVE', caseId: 'buoy-return' },
    ]) { expect(validateLightSeekerActivityCommand(c)).toBe(false); rejectCt(promoted, c); }
    expect(validateLightSeekerActivityCommand({ type: 'PREPARE', caseId: 'marker-path', method: 'ABILITY' })).toBe(true);
  });

  it('keeps open practice in this week and prevents ordinary work, premature leaving or encounter entry', () => {
    for (const b of [marker, screened, withdrawn]) {
      const s = b.final, before = structuredClone(s), caseId = s.lightSeeker.life.activeCase!;
      expect(hasLightSeekerLifeLock(s)).toBe(true);
      for (const action of ['WORK', 'REST'] as const) expect(() => applySliceIntent(s, { type: 'ACTION', action })).toThrow();
      for (const type of ['LEAVE', 'REPORT', 'REFLECT'] as const) rejectCt(s, type === 'REFLECT' ? { type } : { type, caseId });
      expect(blockLightSeekerEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(s).toEqual(before);
    }
  });

  it('projects truthful current costs and detached copies without moving anyone or advancing time and RNG', () => {
    const s = structuredClone(withdrawn.final), before = structuredClone(s), view = projectLightSeekerLife(s);
    expect(view.site).toEqual(s.lightSeeker.life.site); expect(view.currentAttempt).toEqual(attempt(s, 'withdrawn-visit'));
    expect(view.sitePhase).toBe('LIFE'); expect(view.inside).toBe(true);
    expect(view.story).toContain('7灵性'); expect(view.story).toContain('20秒');
    expect(view.environment).toContain('9米');
    view.site.lamp.oil = 0; view.currentAttempt!.spiritEnergySpent++; view.cases[0]!.attempts[0]!.siteAtStart.playerMetres++;
    expect(s).toEqual(before);
    expect(projectLightSeekerLife(practiced).cases[0]!.observations.join(' ')).toContain('NORTH_ARCH');
  });
});

describe('LightSeeker directed local steps, never substitute natural outcomes', () => {
  it('requires a real six-metre accompaniment and four-second read before a paid successful guided window becomes an application', () => {
    const s = structuredClone(marker.beforeLast), caseId = 'marker-path', old = structuredClone(originals(s));
    const before = structuredClone(s.lightSeeker.life.site), priorS = s.spirituality, priorMastery = mastery(s);
    const ctx = direct(s, { type: 'PERFORM', caseId }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 20);
    const p = s.lightSeeker.life.site;
    expect(p.light).toEqual({ mode: 'GUIDED', expiresAt: p.elapsedSeconds + 20 });
    expect(p.board).toEqual(before.board); expect(p.operatorLocation).toBe('ENTRY'); expect(p.playerLocation).toBe('ENTRY');
    expect(p.operatorEnergy).toBe(before.operatorEnergy); expect(s.spirituality).toBe(priorS - 7);
    expect(attempt(s, caseId).appliedAbilityIds).toEqual([]); expect(mastery(s)).toEqual(priorMastery);
    denied(s, { type: 'TRACE_MARK', caseId }); denied(s, { type: 'PERFORM', caseId });
    const at = p.elapsedSeconds; direct(s, { type: 'MOVE_OPERATOR_FAR', caseId });
    expect(p.elapsedSeconds - at).toBe(6); expect(p.operatorMetres - before.operatorMetres).toBe(6);
    expect(p.playerMetres - before.playerMetres).toBe(6); expect(p.operatorEnergy).toBe(before.operatorEnergy - 2);
    expect([p.playerLocation, p.operatorLocation]).toEqual(['FAR', 'FAR']);
    direct(s, { type: 'TRACE_MARK', caseId }); expect(p.elapsedSeconds - at).toBe(10);
    expect(p.board).toEqual({ ...before.board, read: true }); expect(p.lamp).toEqual(before.lamp);
    expect(attempt(s, caseId).appliedAbilityIds).toEqual([GUIDED]); expect(mastery(s)).toEqual(priorMastery);
    denied(s, { type: 'TRACE_MARK', caseId }); denied(s, { type: 'READ_LAMP', caseId });
    finish(s, caseId); expect(p.operatorMetres - before.operatorMetres).toBe(12);
    expect(p.operatorEnergy).toBe(before.operatorEnergy - 4); expect(mastery(s)).toEqual(priorMastery);
    report(s, caseId); expect(mastery(s)).toEqual([priorMastery[0]! + 8, priorMastery[1]]);
    expect(originals(s)).toEqual(old); expect(p.board.owner).toBe('LS2-MARA');
  });

  it('pays seven spirituality and ten seconds on guided failure, then burns one original lamp oil without awarding ability mastery', () => {
    const s = structuredClone(marker.beforeLast), caseId = 'marker-path', priorS = s.spirituality, before = structuredClone(s.lightSeeker.life.site), oldMastery = mastery(s);
    direct(s, { type: 'PERFORM', caseId }, 100);
    expect(s.spirituality).toBe(priorS - 7); expect(s.lightSeeker.life.site.elapsedSeconds - before.elapsedSeconds).toBe(10);
    expect(attempt(s, caseId)).toMatchObject({ window: 'FAILED', spiritualitySpent: 7, appliedAbilityIds: [] });
    expect(s.lightSeeker.life.site.light.mode).toBe('OFF'); direct(s, { type: 'MOVE_OPERATOR_FAR', caseId });
    denied(s, { type: 'TRACE_MARK', caseId }); const at = s.lightSeeker.life.site.elapsedSeconds;
    direct(s, { type: 'READ_LAMP', caseId }); expect(s.lightSeeker.life.site.elapsedSeconds - at).toBe(4);
    expect(s.lightSeeker.life.site.lamp.oil).toBe(before.lamp.oil - 1);
    expect(s.lightSeeker.life.site.board).toEqual({ ...before.board, read: true });
    expect(attempt(s, caseId)).toMatchObject({ lampRead: true, markerRead: true, appliedAbilityIds: [] });
    finish(s, caseId); report(s, caseId); expect(mastery(s)).toEqual(oldMastery);
    expect(s.spirituality).toBe(priorS - 7); expect(s.lightSeeker.life.site.lamp.oil).toBe(before.lamp.oil - 1);
  });

  it('expires guided light after twenty actual seconds but still requires explicit STOP and real physical cleanup', () => {
    const s = structuredClone(marker.beforeLast), caseId = 'marker-path'; direct(s, { type: 'PERFORM', caseId });
    const before = structuredClone(s.lightSeeker.life.site), paidS = s.spirituality;
    direct(s, { type: 'WAIT_10', caseId }); expect(s.lightSeeker.life.site.light.mode).toBe('GUIDED');
    direct(s, { type: 'WAIT_10', caseId }); expect(s.lightSeeker.life.site.light).toEqual({ mode: 'OFF', expiresAt: null });
    expect(attempt(s, caseId)).toMatchObject({ window: 'EXPIRED', lightStopped: false, appliedAbilityIds: [] });
    expect(s.lightSeeker.life.site.shutter).toEqual(before.shutter); expect(s.lightSeeker.life.site.operatorLocation).toBe('ENTRY');
    denied(s, { type: 'LEAVE', caseId }); denied(s, { type: 'INSPECT', caseId });
    direct(s, { type: 'MOVE_OPERATOR_FAR', caseId }); denied(s, { type: 'TRACE_MARK', caseId });
    finish(s, caseId); report(s, caseId); expect(s.spirituality).toBe(paidS); expect(mastery(s)).toEqual([0, 0]);
    expect(attempt(s, caseId)).toMatchObject({ interrupted: true, result: 'ORDINARY', window: 'STOPPED' });
  });

  it('does not send a paid guided beam through a closed or broken shutter, or read an absent original board', () => {
    for (const change of [
      (s: SliceState) => { s.lightSeeker.life.site.shutter.state = 'CLOSED'; },
      (s: SliceState) => { s.lightSeeker.life.site.shutter.state = 'BROKEN'; s.lightSeeker.life.site.shutter.durability = 0; },
      (s: SliceState) => { s.lightSeeker.life.site.board.location = 'PLAYER'; s.lightSeeker.life.site.board.owner = 'PLAYER'; },
    ]) {
      const s = structuredClone(marker.beforeLast); direct(s, { type: 'PERFORM', caseId: 'marker-path' });
      direct(s, { type: 'MOVE_OPERATOR_FAR', caseId: 'marker-path' }); change(s);
      denied(s, { type: 'TRACE_MARK', caseId: 'marker-path' });
    }
  });

  it('uses exactly nine spirituality to establish limited light, and applies it only when the same operator really walks back six metres', () => {
    const s = structuredClone(screened.beforeLast), caseId = 'screened-return', before = structuredClone(s.lightSeeker.life.site), oldMastery = mastery(s), priorS = s.spirituality;
    const ctx = direct(s, { type: 'PERFORM', caseId }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20);
    expect(s.spirituality).toBe(priorS - 9); const p = s.lightSeeker.life.site;
    expect(p.light).toEqual({ mode: 'LIMITED', expiresAt: p.elapsedSeconds + 20 });
    expect(p.operatorLocation).toBe('FAR'); expect(p.operatorEnergy).toBe(before.operatorEnergy);
    expect(attempt(s, caseId).appliedAbilityIds).toEqual([]); expect(mastery(s)).toEqual(oldMastery);
    const at = p.elapsedSeconds; direct(s, { type: 'PASS_OPERATOR', caseId });
    expect(p.elapsedSeconds - at).toBe(6); expect(p.operatorMetres - before.operatorMetres).toBe(6);
    expect(p.operatorLocation).toBe('ENTRY'); expect(p.operatorEnergy).toBe(before.operatorEnergy - 2);
    expect(p.playerMetres).toBe(before.playerMetres); expect(attempt(s, caseId).appliedAbilityIds).toEqual([LIMITED]);
    denied(s, { type: 'PASS_OPERATOR', caseId }); denied(s, { type: 'INSPECT_SCREEN', caseId });
    finish(s, caseId); expect(p.screen.inspections).toBe(before.screen.inspections + 1);
    expect(p.screen.durability).toBe(before.screen.durability - 1); expect(mastery(s)).toEqual(oldMastery);
    report(s, caseId); expect(mastery(s)).toEqual([oldMastery[0], oldMastery[1]! + 8]); expect(s.spirituality).toBe(priorS - 9);
  });

  it('keeps the already-paid plain illumination on a failed limiting check and makes its ordinary exit physical', () => {
    const s = structuredClone(screened.beforeLast), caseId = 'screened-return', before = structuredClone(s.lightSeeker.life.site), priorS = s.spirituality, oldMastery = mastery(s);
    direct(s, { type: 'PERFORM', caseId }, 100); const p = s.lightSeeker.life.site;
    expect(s.spirituality).toBe(priorS - 9); expect(p.elapsedSeconds - before.elapsedSeconds).toBe(10);
    expect(p.light).toEqual({ mode: 'PLAIN', expiresAt: null }); expect(attempt(s, caseId).window).toBe('FAILED');
    denied(s, { type: 'PASS_OPERATOR', caseId }); denied(s, { type: 'RETURN_OPERATOR', caseId }); denied(s, { type: 'CLOSE_SHUTTER', caseId });
    direct(s, { type: 'STOP', caseId }); denied(s, { type: 'RETURN_OPERATOR', caseId });
    direct(s, { type: 'CLOSE_SHUTTER', caseId }); const at = p.elapsedSeconds;
    direct(s, { type: 'RETURN_OPERATOR', caseId }); expect(p.elapsedSeconds - at).toBe(6);
    expect(p.operatorMetres - before.operatorMetres).toBe(6); expect(p.operatorEnergy).toBe(before.operatorEnergy - 2);
    finish(s, caseId); report(s, caseId); expect(mastery(s)).toEqual(oldMastery);
    expect(attempt(s, caseId)).toMatchObject({ result: 'ORDINARY', appliedAbilityIds: [] });
  });

  it('expires LIMITED into PLAIN at twenty seconds, requiring STOP before closing, ordinary return or screen inspection', () => {
    const s = structuredClone(screened.beforeLast), caseId = 'screened-return'; direct(s, { type: 'PERFORM', caseId });
    const before = structuredClone(s.lightSeeker.life.site), oldMastery = mastery(s);
    direct(s, { type: 'WAIT_10', caseId }); expect(s.lightSeeker.life.site.light.mode).toBe('LIMITED');
    direct(s, { type: 'WAIT_10', caseId }); const p = s.lightSeeker.life.site;
    expect(p.elapsedSeconds - before.elapsedSeconds).toBe(20); expect(p.light).toEqual({ mode: 'PLAIN', expiresAt: null });
    expect(attempt(s, caseId)).toMatchObject({ window: 'EXPIRED', lightStopped: false, appliedAbilityIds: [] });
    expect(p.operatorLocation).toBe('FAR'); expect(p.cover.position).toBe('SCREEN'); expect(p.shutter.state).toBe('OPEN');
    for (const type of ['PASS_OPERATOR', 'RETURN_OPERATOR', 'CLOSE_SHUTTER', 'INSPECT_SCREEN', 'LEAVE'] as const) denied(s, { type, caseId });
    finish(s, caseId); report(s, caseId); expect(mastery(s)).toEqual(oldMastery);
    expect(p.operatorMetres - before.operatorMetres).toBe(6); expect(p.operatorEnergy).toBe(before.operatorEnergy - 2);
  });

  it('cannot begin a six-second pass with only five seconds left, or apply through an absent cover or screen', () => {
    for (const change of [
      (s: SliceState) => { advanceLightSeekerTime(s.lightSeeker.life.site, 15); attempt(s, 'screened-return').elapsedSeconds += 15; },
      (s: SliceState) => { s.lightSeeker.life.site.cover.position = 'OWNER_STAND'; },
      (s: SliceState) => { s.lightSeeker.life.site.screen.durability = 0; },
      (s: SliceState) => { s.lightSeeker.life.site.operatorConsent = 'WITHDRAWN'; },
      (s: SliceState) => { s.lightSeeker.life.site.operatorConsentWeek = s.week - 1; },
    ]) {
      const s = structuredClone(screened.beforeLast); direct(s, { type: 'PERFORM', caseId: 'screened-return' }); change(s);
      denied(s, { type: 'PASS_OPERATOR', caseId: 'screened-return' });
    }
  });

  it('respects the third visit current withdrawal, cannot recall Reed into light, and never grants eight mastery for an unused success', () => {
    const s = structuredClone(withdrawn.beforeLast), caseId = 'withdrawn-visit', oldMastery = mastery(s), before = structuredClone(s.lightSeeker.life.site);
    s.actionsRemaining = 1; s.spirituality = 9; direct(s, { type: 'PERFORM', caseId });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); direct(s, { type: 'WITHDRAW_PERMISSION', caseId });
    expect(attempt(s, caseId)).toMatchObject({ permissionWithdrawn: true, spiritConsent: 'WITHDRAWN',
      spiritVisited: true, spiritRetired: true, window: 'ACTIVE', appliedAbilityIds: [] });
    expect(s.lightSeeker.life.site.spiritLocation).toBe('SIDE'); expect(s.lightSeeker.life.site.spiritEnergy).toBe(before.spiritEnergy);
    for (const type of ['INVITE_SPIRIT', 'CONSENT_SPIRIT', 'WITHDRAW_PERMISSION', 'PERFORM', 'PASS_OPERATOR'] as const) denied(s, { type, caseId });
    const physical = structuredClone(s.lightSeeker.life.site), at = physical.elapsedSeconds;
    direct(s, { type: 'STOP', caseId }); const stopped = structuredClone(s.lightSeeker.life.site);
    expect(stopped).toEqual({ ...physical, light: { mode: 'OFF', expiresAt: null } });
    denied(s, { type: 'INVITE_SPIRIT', caseId });
    finish(s, caseId); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.lightSeeker.life.site.elapsedSeconds - at).toBe(17); // shutter round trip8 + cover round trip7 + inspect2
    expect(s.lightSeeker.life.site.spiritMetres).toBe(before.spiritMetres); report(s, caseId);
    expect(mastery(s)).toEqual(oldMastery); expect(attempt(s, caseId).result).toBe('ORDINARY');
  });

  it('requires new current consent after stopping and pays a second real nine-metre visit and return for the same Reed', () => {
    const s = structuredClone(withdrawn.beforeLast), caseId = 'withdrawn-visit'; direct(s, { type: 'PERFORM', caseId });
    direct(s, { type: 'WITHDRAW_PERMISSION', caseId }); direct(s, { type: 'STOP', caseId });
    denied(s, { type: 'INVITE_SPIRIT', caseId }); const before = structuredClone(s.lightSeeker.life.site);
    direct(s, { type: 'CONSENT_SPIRIT', caseId }); direct(s, { type: 'INVITE_SPIRIT', caseId });
    expect(s.lightSeeker.life.site).toMatchObject({ spiritId: before.spiritId, spiritLocation: 'ENTRY',
      spiritMetres: before.spiritMetres + 9, spiritEnergy: before.spiritEnergy - 2, spiritConsent: 'GRANTED', spiritConsentWeek: s.week });
    expect(s.lightSeeker.life.site.elapsedSeconds - before.elapsedSeconds).toBe(11);
    denied(s, { type: 'PERFORM', caseId }); direct(s, { type: 'RETIRE_SPIRIT', caseId });
    expect(s.lightSeeker.life.site.spiritMetres - before.spiritMetres).toBe(18);
    expect(s.lightSeeker.life.site.spiritEnergy).toBe(before.spiritEnergy - 4);
    expect(s.lightSeeker.life.site.elapsedSeconds - before.elapsedSeconds).toBe(20);
    expect(attempt(s, caseId).appliedAbilityIds).toEqual([]); finish(s, caseId);
  });

  it('prepares an ordinary third visit through public commands, using one action, zero spirituality and four seconds without lighting', () => {
    const b = capture('PREPARE', 'withdrawn-visit'), caseId = 'withdrawn-visit';
    // Explicit changed choice with a directed budget, not an additional natural fixture.
    let s = ct(unitBudget(b.beforeLast), { type: 'PREPARE', caseId, method: 'ORDINARY' });
    for (const type of ['CONSENT_OPERATOR', 'CONSENT_SPIRIT', 'INVITE_SPIRIT', 'PLACE_COVER'] as const) s = ct(s, { type, caseId });
    const before = structuredClone(s), p = before.lightSeeker.life.site;
    const action = projectLightSeekerLife(s).actions.find(a => a.command.type === 'PERFORM' && 'caseId' in a.command && a.command.caseId === caseId)!;
    expect(action.enabled).toBe(true); expect(action.cost).toContain('0灵性'); expect(action.cost).toContain('4秒');
    s = ct(s, { type: 'PERFORM', caseId }); const e = s.lightSeeker.life.journal.at(-1)!;
    expect(e.paid).toEqual({ actions: 1, spirituality: 0 }); expect(e.check).toBeNull(); expect(e.source).toBeNull();
    expect(s.random).toEqual(before.random); expect(s.spirituality).toBe(before.spirituality); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(s.lightSeeker.life.site.elapsedSeconds - p.elapsedSeconds).toBe(4); expect(s.lightSeeker.life.site.light).toEqual({ mode: 'OFF', expiresAt: null });
    expect(s.lightSeeker.life.site.spiritMetres).toBe(p.spiritMetres); expect(s.lightSeeker.life.site.spiritLocation).toBe('ENTRY');
    s = ct(s, { type: 'WITHDRAW_PERMISSION', caseId }); s = ct(s, { type: 'RETIRE_SPIRIT', caseId });
    expect(s.lightSeeker.life.site.spiritMetres - attempt(s, caseId).siteAtStart.spiritMetres).toBe(18);
    expect(attempt(s, caseId).spiritEnergySpent).toBe(4);
    for (const type of ['RETURN_COVER', 'INSPECT', 'LEAVE'] as const) s = ct(s, { type, caseId });
    expect(attempt(s, caseId)).toMatchObject({ closed: true, result: 'ORDINARY', appliedAbilityIds: [] });
    expect(hasLightSeekerLifeLock(s)).toBe(false); expect(s.lightSeeker.life.site.shutter).toEqual(p.shutter);
  });

  it('charges only the inherited three spirituality and four seconds on an ordinary screened practice', () => {
    const s = structuredClone(screened.beforeLast), caseId = 'screened-return', before = structuredClone(s.lightSeeker.life.site), priorS = s.spirituality;
    // Directed method branch at the same prepared local state, never saved as a genuine history.
    s.lightSeeker.life.cases[caseId].method = 'ORDINARY'; attempt(s, caseId).method = 'ORDINARY';
    const oldRandom = structuredClone(s.random), ctx = direct(s, { type: 'PERFORM', caseId });
    expect(ctx.check).not.toHaveBeenCalled(); expect(s.random).toEqual(oldRandom); expect(s.spirituality).toBe(priorS - 3);
    expect(s.lightSeeker.life.site.elapsedSeconds - before.elapsedSeconds).toBe(4);
    expect(s.lightSeeker.life.site.light.mode).toBe('PLAIN'); denied(s, { type: 'PASS_OPERATOR', caseId });
    finish(s, caseId); expect(attempt(s, caseId).appliedAbilityIds).toEqual([]);
  });

  it('prechecks the complete nine-spirituality cost and current permission, position and blocker before paying or drawing', () => {
    for (const change of [
      (s: SliceState) => { s.spirituality = 8; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.actionsRemaining = 0; },
      (s: SliceState) => { s.lightSeeker.life.site.operatorConsent = 'DECLINED'; },
      (s: SliceState) => { s.lightSeeker.life.site.operatorConsentWeek = s.week - 1; },
      (s: SliceState) => { s.lightSeeker.life.site.playerLocation = 'FAR'; },
      (s: SliceState) => { s.lightSeeker.life.site.operatorLocation = 'ENTRY'; },
      (s: SliceState) => { s.lightSeeker.life.site.spiritLocation = 'ENTRY'; },
      (s: SliceState) => { s.lightSeeker.life.site.shutter.state = 'CLOSED'; },
      (s: SliceState) => { s.lightSeeker.life.site.cover.position = 'OWNER_STAND'; },
      (s: SliceState) => { s.lightSeeker.life.site.screen.durability = 0; },
    ]) { const s = structuredClone(screened.beforeLast); change(s); denied(s, { type: 'PERFORM', caseId: 'screened-return' }); }
    const guided = structuredClone(marker.beforeLast); guided.spirituality = 6; denied(guided, { type: 'PERFORM', caseId: 'marker-path' });
  });

  it('lets a current refusal close honestly without a cast, spend or refund and does not trap the global week lock', () => {
    const b = capture('PREPARE', 'marker-path'), caseId = 'marker-path';
    let s = ct(unitBudget(b.beforeLast), { type: 'PREPARE', caseId, method: 'ABILITY' });
    const priorS = s.spirituality, oldRandom = structuredClone(s.random);
    s = ct(s, { type: 'DECLINE_OPERATOR', caseId }); rejectCt(s, { type: 'PERFORM', caseId });
    for (const type of ['INSPECT', 'LEAVE'] as const) s = ct(s, { type, caseId });
    expect(hasLightSeekerLifeLock(s)).toBe(false); expect(s.spirituality).toBe(priorS); expect(s.random).toEqual(oldRandom);
    expect(attempt(s, caseId)).toMatchObject({ interrupted: true, performed: false, result: 'ORDINARY', appliedAbilityIds: [] });
    expect(s.lightSeeker.life.site.shutter.durability).toBe(100);
  });
});

describe('LightSeeker finite resource shape and expiry, isolated resource units', () => {
  it.each(['GUIDED', 'LIMITED'] as const)('expires %s exactly at the boundary without restoring oil, wear, positions or fatigue', mode => {
    const p = createLightSeekerSiteState();
    p.elapsedSeconds = 40; p.light = { mode, expiresAt: 60 };
    p.lamp.oil = 1; p.shutter.operations = 2; p.shutter.durability = 98;
    p.operatorMetres = 12; p.operatorEnergy = 96; p.spiritMetres = 18; p.spiritEnergy = 96;
    expect(validateLightSeekerSiteState(p)).toBe(true);
    const physical = structuredClone(p); advanceLightSeekerTime(p, 19);
    expect(p.light).toEqual({ mode, expiresAt: 60 }); advanceLightSeekerTime(p, 1);
    expect(p).toEqual({ ...physical, elapsedSeconds: 60, light: { mode: mode === 'LIMITED' ? 'PLAIN' : 'OFF', expiresAt: null } });
    expect(validateLightSeekerSiteState(p)).toBe(true);
  });

  it('rejects invalid elapsed seconds without partially changing the original resource state', () => {
    for (const seconds of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const p = createLightSeekerSiteState(), before = structuredClone(p);
      expect(() => advanceLightSeekerTime(p, seconds)).toThrow(); expect(p).toEqual(before);
    }
  });

  it('rejects replacement identities, impossible oil, unrecorded wear, free fatigue recovery and instant spirit movement', () => {
    const mutations: ((p: ReturnType<typeof createLightSeekerSiteState>) => void)[] = [
      p => { (p as unknown as Record<string, unknown>).operatorId = 'JM3-CORWIN'; },
      p => { (p as unknown as Record<string, unknown>).spiritId = 'ELM'; },
      p => { p.lamp.oil = 4; }, p => { p.shutter.durability--; },
      p => { p.shutter.state = 'BROKEN'; }, p => { p.screen.durability--; },
      p => { p.operatorEnergy = 99; }, p => { p.operatorMetres = 6; },
      p => { p.spiritLocation = 'ENTRY'; }, p => { p.spiritMetres = 9; p.spiritEnergy = 98; },
      p => { p.spiritMetres = 18; }, p => { p.board.owner = 'PLAYER'; },
      p => { p.light = { mode: 'LIMITED', expiresAt: 21 }; }, p => { p.light = { mode: 'PLAIN', expiresAt: 10 }; },
    ];
    for (const [index, change] of mutations.entries()) {
      const p = createLightSeekerSiteState(); change(p); expect(validateLightSeekerSiteState(p), `resource mutation ${index}`).toBe(false);
    }
  });
});

const savedMutations: [string, (s: SliceState) => void][] = [
  ['extra lamp oil', s => { s.lightSeeker.life.site.lamp.oil = s.lightSeeker.life.site.lamp.oil === 3 ? 2 : 3; }],
  ['resource-valid extra shutter wear', s => { s.lightSeeker.life.site.shutter.operations++; s.lightSeeker.life.site.shutter.durability--; }],
  ['resource-valid extra screen inspection', s => { s.lightSeeker.life.site.screen.inspections++; s.lightSeeker.life.site.screen.durability--; }],
  ['resource-valid unrecorded Mara walk', s => { s.lightSeeker.life.site.operatorMetres += 12; s.lightSeeker.life.site.operatorEnergy -= 4; }],
  ['resource-valid unrecorded Reed visit', s => { s.lightSeeker.life.site.spiritMetres += 18; s.lightSeeker.life.site.spiritEnergy -= 4; }],
  ['unrecorded player walk', s => { s.lightSeeker.life.site.playerMetres++; }],
  ['invented elapsed time', s => { s.lightSeeker.life.site.elapsedSeconds++; }],
  ['taken original board', s => { s.lightSeeker.life.site.board.location = 'PLAYER'; s.lightSeeker.life.site.board.owner = 'PLAYER'; }],
  ['erased actual board read', s => { s.lightSeeker.life.site.board.read = false; }],
  ['free action in paid event', s => { s.lightSeeker.life.journal[0]!.paid.actions = 0; }],
  ['forged action budget', s => { s.lightSeeker.life.journal[0]!.budget.actionsAfter++; }],
  ['underpaid combined cast', s => { const e = s.lightSeeker.life.journal.find(e => e.source?.abilityId === LIMITED)!; e.paid.spirituality = 6; e.budget.spiritualityAfter += 3; }],
  ['duplicate journal event', s => { s.lightSeeker.life.journal.push(structuredClone(s.lightSeeker.life.journal.at(-1)!)); }],
  ['reversed event order', s => { s.lightSeeker.life.journal.reverse(); }],
  ['unrecorded physical step removed', s => { const i = s.lightSeeker.life.journal.findIndex(e => e.command.type === 'CLOSE_SHUTTER'); s.lightSeeker.life.journal.splice(i, 1); }],
  ['unknown receipt text', s => { (s.lightSeeker.life.journal[0] as unknown as Record<string, unknown>).text = 'Everything returned'; }],
  ['changed recorded roll', s => { const e = s.lightSeeker.life.journal.find(e => e.check)!; e.check!.roll = e.check!.roll === 100 ? 1 : 100; }],
  ['extra random draw', s => { const e = s.lightSeeker.life.journal.find(e => e.check)!; e.randomAfter!++; }],
  ['false current permission source', s => { const e = s.lightSeeker.life.journal.find(e => e.source)!; e.source!.operatorConsentWeek--; }],
  ['false source clock', s => { const e = s.lightSeeker.life.journal.find(e => e.source)!; e.source!.at++; }],
  ['false source position', s => { const e = s.lightSeeker.life.journal.find(e => e.source)!; e.source!.site.playerLocation = 'FAR'; }],
  ['resource-valid rewritten source shutter', s => { const e = s.lightSeeker.life.journal.find(e => e.source)!; e.source!.site.shutter.operations++; e.source!.site.shutter.durability--; }],
  ['invented prior-case oil refill', s => { const a = attempt(s, 'screened-return'); a.siteAtStart.lamp.oil = a.siteAtStart.lamp.oil === 3 ? 2 : 3; }],
  ['invented closed-case refund', s => { attempt(s, 'marker-path').spiritualitySpent = 0; }],
  ['invented applied withdrawal', s => { attempt(s, 'withdrawn-visit').appliedAbilityIds.push(LIMITED); s.progression.mastery[LIMITED]! += 8; }],
  ['erased current withdrawal', s => { attempt(s, 'withdrawn-visit').permissionWithdrawn = false; }],
  ['invented shorter spirit walk', s => { attempt(s, 'withdrawn-visit').spiritTravelMetres -= 9; }],
  ['forged close snapshot', s => { attempt(s, 'withdrawn-visit').siteAtClose!.playerMetres++; }],
  ['free acting', s => { s.progression.acting--; }],
  ['free guided mastery', s => { s.progression.mastery[GUIDED]!++; }],
];
describe('LightSeeker saved ordered life provenance', () => {
  it.each(savedMutations)('rejects %s even when the final shape or resource totals look plausible', (_name, change) => {
    const s = structuredClone(practiced); change(s);
    expect(validateLightSeekerLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });

  it('rejects a self-consistent changed current check/source base ability rather than trusting its recomputed threshold', () => {
    for (const b of [marker, screened, withdrawn]) {
      const s = structuredClone(b.final), e = s.lightSeeker.life.journal.at(-1)!, source = e.source!;
      source.baseAbility++;
      e.check = resolveNormalCheck({ ability: source.coreStat, baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: e.check!.roll });
      e.tier = e.check.tier;
      expect(validateLightSeekerLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
    }
  });

  it('rejects a changed source core-stat identity or a live spirituality value that no longer matches the paid receipt', () => {
    const wrongStat = structuredClone(marker.final); wrongStat.lightSeeker.life.journal.at(-1)!.source!.coreStat = 'knowledge';
    expect(validateLightSeekerLife(wrongStat)).toBe(false);
    const freeS = structuredClone(screened.final); freeS.spirituality++;
    expect(validateLightSeekerLife(freeS)).toBe(false);
    const nextWeek = structuredClone(withdrawn.final); nextWeek.week++;
    expect(validateLightSeekerLife(nextWeek)).toBe(false);
  });
});
