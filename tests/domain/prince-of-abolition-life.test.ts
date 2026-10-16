import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { validatePrinceOfAbolitionState } from '../../src/domain/prince-of-abolition/index.js';
import { blockPrinceOfAbolitionLife, getPrinceOfAbolitionCurrentSite, hasPrinceOfAbolitionLifeLock, princeOfAbolitionLifeActions, princeOfAbolitionLifeClosed, princeOfAbolitionLifeMasteryGains, princeOfAbolitionCompletedLifeBudgetMatches, projectPrinceOfAbolitionLife, validatePrinceOfAbolitionActivityCommand, validatePrinceOfAbolitionLifeState, type PrinceOfAbolitionCaseId, type PrinceOfAbolitionActivityCommand } from '../../src/domain/prince-of-abolition/life.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_PREPARATION_IDS } from '../../src/domain/prince-of-abolition/types.js';
import { completePrinceLife, directedInitial2, dose, oldBlackEmperorRoots, originalEntropyDuke, poa, promotedForLife, ready, rejectPrinceOfAbolition } from './prince-of-abolition-directed-helper.js';
const [AMPLIFY, MAINTAIN] = PRINCE_OF_ABOLITION_ABILITY_IDS;
const attempt = (s: SliceState, id: PrinceOfAbolitionCaseId) => s.princeOfAbolition.life.cases[id].attempts[0]!;
const piece = (s: SliceState, id: PrinceOfAbolitionCaseId) => s.princeOfAbolition.life.pieces.find(p => p.caseId === id)!;
const apply = (s: SliceState, id: PrinceOfAbolitionCaseId, type: PrinceOfAbolitionActivityCommand['type']) => poa(s, { type, caseId: id } as PrinceOfAbolitionActivityCommand);
function annex(s: SliceState): SliceState {
  if (s.princeOfAbolition.life.site.playerLocation === 'START') s = poa(s, { type: 'EXIT_ROOM' });
  if (!s.princeOfAbolition.life.annex) s = poa(ready(s, { ap: 4, cash: 100 }), { type: 'BUY_ANNEX' }); return s;
}
function start(s: SliceState, id: PrinceOfAbolitionCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = annex(s); s = ready(s, { ap: 3, cash: 20, spirituality: 8, mind: 4 }); s = apply(s, id, 'OBSERVE');
  for (const permission of ['OWNER', 'COOPERATION'] as const) s = poa(s, { type: 'CONSENT', caseId: id, permission });
  if (method === 'ABILITY') { s = poa(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' }); s = poa(s, { type: 'PREPARE', caseId: id, method }); }
  else s = apply(s, id, 'START_ORDINARY');
  return s;
}
function reach(s: SliceState, id: PrinceOfAbolitionCaseId): SliceState { for (const type of ['TAKE_BALL', 'WALK_TO_ANNEX', 'INSPECT', 'PREPARE_ACTION'] as const) s = apply(s, id, type); return s; }
function finish(s: SliceState, id: PrinceOfAbolitionCaseId): SliceState {
  if (!attempt(s, id).thrown) s = apply(s, id, 'THROW_BALL');
  while (s.princeOfAbolition.life.flight) s = apply(s, id, 'WAIT_FLIGHT');
  if (s.princeOfAbolition.life.site.playerLocation === 'ANNEX') s = apply(s, id, 'WALK_TO_RECEIVER');
  for (const type of ['RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RETURN_OBJECTS', 'LEAVE'] as const) s = apply(s, id, type);
  return apply(ready(s), id, 'REPORT');
}
function ordinary(s: SliceState, id: PrinceOfAbolitionCaseId): SliceState { return finish(reach(start(s, id, 'ORDINARY'), id), id); }
function amplification(kind: 'AMPLIFY' | 'AMPLIFY_FAIL' = 'AMPLIFY'): SliceState { const id = 'directed-throw'; return apply(reach(start(promotedForLife(kind), id), id), id, 'DIRECTED_AMPLIFICATION'); }
function maintenance(kind: 'MAINTAIN' | 'MAINTAIN_FAIL' = 'MAINTAIN'): SliceState { let s = ordinary(promotedForLife(kind), 'directed-throw'); s = reach(start(s, 'maintained-flight'), 'maintained-flight'); s = apply(s, 'maintained-flight', 'THROW_BALL'); return apply(s, 'maintained-flight', 'EFFECT_MAINTENANCE'); }

describe('Prince of Abolition finite original-ball practice and exact physical replay', () => {
  it('projects actual clock449 before promotion and walks real4m before any purchase or ball access', () => {
    const original = originalEntropyDuke(), s = promotedForLife(), roots = oldBlackEmperorRoots(s);
    expect(getPrinceOfAbolitionCurrentSite(original)).toEqual(original.frenzyMage.life);
    expect(projectPrinceOfAbolitionLife(original)).toMatchObject({ clockSeconds: 449, playerLocation: 'START', playerTravelMetres: 120 });
    rejectPrinceOfAbolition(s, { type: 'BUY_ANNEX' }); rejectPrinceOfAbolition(s, { type: 'OBSERVE', caseId: 'directed-throw' });
    const outside = poa(s, { type: 'EXIT_ROOM' }); expect(outside.princeOfAbolition.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 124, clockSeconds: 453 });
    expect(outside.cash).toBe(s.cash); expect(outside.actionsRemaining).toBe(s.actionsRemaining); expect(hasPrinceOfAbolitionLifeLock(outside)).toBe(false);
    expect(outside.princeOfAbolition.life.site.ball).toEqual(s.frenzyMage.life.ball); expect(outside.princeOfAbolition.life.site.guide).toEqual(s.frenzyMage.life.guide); expect(oldBlackEmperorRoots(outside)).toEqual(roots);
  }, 120_000);
  it('pays40p/1AP for a genuinely moved new receiver, preserving original empty B/C pads and owners', () => {
    let s = poa(promotedForLife(), { type: 'EXIT_ROOM' }); const before = structuredClone(s); s = poa(s, { type: 'BUY_ANNEX' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 40, before.actionsRemaining - 1]);
    expect(s.princeOfAbolition.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 140, clockSeconds: 471 });
    expect(s.princeOfAbolition.life.annex).toMatchObject({ paidPennies: 40, surface: { id: 'PA1-RECEIVER', location: 'RECEIVER', placed: true, inspections: 0 } });
    expect(s.princeOfAbolition.life.journal.at(-1)!.moves.map(m => [m.from, m.to, m.metres, m.itemIds])).toEqual([['OUTSIDE', 'ANNEX', 4, ['PA1-RECEIVER']], ['ANNEX', 'RECEIVER', 4, ['PA1-RECEIVER']], ['RECEIVER', 'ANNEX', 4, []], ['ANNEX', 'OUTSIDE', 4, []]]);
    expect(s.princeOfAbolition.life.site.pads).toEqual(before.frenzyMage.life.pads); expect(s.princeOfAbolition.life.site.parcel).toEqual(before.frenzyMage.life.parcel); expect(s.princeOfAbolition.life.site.ball).toEqual(before.frenzyMage.life.ball); rejectPrinceOfAbolition(s, { type: 'BUY_ANNEX' });
  }, 120_000);
  it('requires separate fresh owner, ability and adult cooperation permissions, with free cancellation before20p purchase', () => {
    let s = apply(annex(promotedForLife()), 'directed-throw', 'OBSERVE'); const before = structuredClone(s);
    rejectPrinceOfAbolition(s, { type: 'PREPARE', caseId: 'directed-throw', method: 'ABILITY' });
    s = poa(s, { type: 'WITHDRAW_CONSENT', caseId: 'directed-throw', permission: 'ABILITY' }); rejectPrinceOfAbolition(s, { type: 'CONSENT', caseId: 'directed-throw', permission: 'ABILITY' });
    s = apply(s, 'directed-throw', 'ABORT'); expect(s.cash).toBe(before.cash); expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(hasPrinceOfAbolitionLifeLock(s)).toBe(false); expect(s.princeOfAbolition.life.pieces).toEqual([]);
    rejectPrinceOfAbolition(s, { type: 'REPORT', caseId: 'directed-throw' }); expect(s.progression.acting).toBe(0);
  }, 120_000);
  it('ordinary play is available without buying a support; same ball is actually thrown, waited for, retrieved and returned', () => {
    const initial = annex(promotedForLife()), money = initial.cash, roots = oldBlackEmperorRoots(initial); const s = ordinary(initial, 'directed-throw');
    expect(s.cash).toBe(money); expect(s.princeOfAbolition.life.pieces).toEqual([]); expect(attempt(s, 'directed-throw')).toMatchObject({ method: 'ORDINARY', penniesSpent: 0, thrown: true, landed: true, retrieved: true, verified: true, returned: true, closed: true, playerTravelMetres: 16, cooperationEffortSpent: 3, volunteerMindSpent: 1, appliedAbilityIds: [] });
    expect(s.princeOfAbolition.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 156, volunteer: { location: 'OUTSIDE', mind: 99 }, ball: { holder: 'GUIDE', location: 'OUTSIDE', throws: 5, returns: 5 }, paper: { holder: 'GUIDE', location: 'OUTSIDE', text: '从A到B' } });
    expect(princeOfAbolitionLifeMasteryGains(s)).toEqual({ [AMPLIFY]: 0, [MAINTAIN]: 0 }); expect(oldBlackEmperorRoots(s)).toEqual(roots); assertValidSliceState(s);
  }, 120_000);
  it('uses one paid20p support, pays8S2M and applies exactly+35 only to the subsequent actual body throw', () => {
    let s = reach(start(promotedForLife(), 'directed-throw'), 'directed-throw'); const before = structuredClone(s); s = apply(s, 'directed-throw', 'DIRECTED_AMPLIFICATION');
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 2, before.random.cursor + 1]); expect(piece(s, 'directed-throw')).toMatchObject({ charges: 0, wear: 1, paidPennies: 20 });
    expect(s.princeOfAbolition.life.pending).toMatchObject({ actorId: 'PLAYER', objectId: 'FM3-PRACTICE-BALL', expiresAt: s.princeOfAbolition.life.site.clockSeconds + 20 }); expect(s.progression.mastery[AMPLIFY]).toBe(0);
    const throwBefore = structuredClone(s), roll = new DeterministicActionRandomStream(s.random.seed, s.random.cursor).nextInt(1, 100); s = apply(s, 'directed-throw', 'THROW_BALL');
    expect(s.lastCheck).toEqual(resolveNormalCheck({ ability: 'physique', baseAbility: s.character.coreStats.physique, difficulty: 20, modifiers: [{ source: AMPLIFY, value: 35 }], roll }));
    expect(attempt(s, 'directed-throw')).toMatchObject({ amplification: 35, appliedAbilityIds: [AMPLIFY], thrown: true, landed: false }); expect(s.random.cursor).toBe(throwBefore.random.cursor + 1); expect(s.princeOfAbolition.life.site.ball.holder).toBe('AIRBORNE'); rejectPrinceOfAbolition(s, { type: 'THROW_BALL', caseId: 'directed-throw' });
    s = finish(s, 'directed-throw'); expect(s.progression.mastery[AMPLIFY]).toBe(8); expect(s.progression.acting).toBe(25); rejectPrinceOfAbolition(s, { type: 'REPORT', caseId: 'directed-throw' }); assertValidSliceState(s);
  }, 120_000);
  it('failed cast consumes its support and8S4M, keeps the real failed result and permits ordinary completion', () => {
    let s = amplification('AMPLIFY_FAIL'); expect(['FAILURE', 'GREAT_FAILURE']).toContain(attempt(s, 'directed-throw').castTier); expect(attempt(s, 'directed-throw')).toMatchObject({ spiritualitySpent: 8, mindSpent: 4, appliedAbilityIds: [] }); expect(piece(s, 'directed-throw')).toMatchObject({ charges: 0, wear: 1 });
    rejectPrinceOfAbolition(s, { type: 'DIRECTED_AMPLIFICATION', caseId: 'directed-throw' }); s = finish(s, 'directed-throw'); expect(s.progression.mastery[AMPLIFY]).toBe(0); expect(attempt(s, 'directed-throw').result).toBe('ORDINARY');
  }, 120_000);
  it('expiry, original-ball movement,遮挡, stop and withdrawal lose only the unused window with no refund or repeat', () => {
    for (const kind of ['EXPIRED', 'MOVED', 'OCCLUDED', 'STOPPED', 'WITHDRAWN'] as const) {
      let s = amplification(), before = structuredClone(s);
      if (kind === 'EXPIRED') { s = apply(s, 'directed-throw', 'WAIT_10'); s = apply(s, 'directed-throw', 'WAIT_10'); }
      else if (kind === 'MOVED') { s = apply(s, 'directed-throw', 'WALK_TO_RECEIVER'); s = apply(s, 'directed-throw', 'RETURN_TO_ANNEX'); }
      else if (kind === 'WITHDRAWN') s = poa(s, { type: 'WITHDRAW_CONSENT', caseId: 'directed-throw', permission: 'ABILITY' });
      else s = apply(s, 'directed-throw', kind === 'OCCLUDED' ? 'OCCLUDE' : 'STOP_METHOD');
      expect(s.princeOfAbolition.life.pending).toBeNull(); expect([s.cash, s.spirituality, s.mind]).toEqual([before.cash, before.spirituality, before.mind]); expect(attempt(s, 'directed-throw').windowEnd).toBe(kind);
      rejectPrinceOfAbolition(s, { type: 'DIRECTED_AMPLIFICATION', caseId: 'directed-throw' }); if (kind === 'OCCLUDED') s = apply(s, 'directed-throw', 'RESTORE_VIEW'); s = finish(s, 'directed-throw'); expect(s.progression.mastery[AMPLIFY]).toBe(0); expect(attempt(s, 'directed-throw').amplification).toBe(0); assertValidSliceState(s);
    }
  }, 300_000);
  it('maintenance only extends a real unfinished own flight20s and public bounded waits resolve it once', () => {
    let s = maintenance(); const flight = structuredClone(s.princeOfAbolition.life.flight)!;
    expect(flight.landsAt).toBe(flight.originalLandAt + 20); expect(flight.segmentStartMm).toBe(0); expect(flight.segmentStartAt).toBe(flight.launchedAt); expect(attempt(s, 'maintained-flight')).toMatchObject({ maintenanceSeconds: 20, appliedAbilityIds: [MAINTAIN] });
    rejectPrinceOfAbolition(s, { type: 'EFFECT_MAINTENANCE', caseId: 'maintained-flight' }); rejectPrinceOfAbolition(s, { type: 'RETRIEVE_BALL', caseId: 'maintained-flight' });
    s = poa(s, { type: 'WITHDRAW_CONSENT', caseId: 'maintained-flight', permission: 'ABILITY' }); expect(s.princeOfAbolition.life.flight).toMatchObject({ id: flight.id, launchedAt: flight.launchedAt, originalLandAt: flight.originalLandAt, landsAt: flight.landsAt });
    while (s.princeOfAbolition.life.flight) { const p = projectPrinceOfAbolitionLife(s); expect(p.actions.find(a => a.preferredAction)?.command.type).toBe('WAIT_FLIGHT'); const at = p.clockSeconds; s = apply(s, 'maintained-flight', 'WAIT_FLIGHT'); expect(s.princeOfAbolition.life.site.clockSeconds - at).toBeLessThanOrEqual(10); }
    expect(s.princeOfAbolition.life.site.clockSeconds).toBe(flight.landsAt); rejectPrinceOfAbolition(s, { type: 'WAIT_FLIGHT', caseId: 'maintained-flight' }); s = finish(s, 'maintained-flight'); expect(s.progression.mastery[MAINTAIN]).toBe(8); expect(s.princeOfAbolition.life.operation).toEqual(originalEntropyDuke().entropyDuke.life.operation); assertValidSliceState(s);
  }, 240_000);
  it('maintenance fails honestly and cannot act after the four-second original trajectory already ended', () => {
    let s = maintenance('MAINTAIN_FAIL'); expect(attempt(s, 'maintained-flight')).toMatchObject({ mindSpent: 4, maintenanceSeconds: 0, appliedAbilityIds: [] }); expect(s.princeOfAbolition.life.flight!.landsAt).toBe(s.princeOfAbolition.life.flight!.originalLandAt); s = finish(s, 'maintained-flight'); expect(s.progression.mastery[MAINTAIN]).toBe(0);
    let late = ordinary(promotedForLife('MAINTAIN'), 'directed-throw'); late = reach(start(late, 'maintained-flight'), 'maintained-flight'); late = apply(late, 'maintained-flight', 'THROW_BALL'); late = apply(late, 'maintained-flight', 'WAIT_FLIGHT'); rejectPrinceOfAbolition(late, { type: 'EFFECT_MAINTENANCE', caseId: 'maintained-flight' }); late = finish(late, 'maintained-flight'); expect(late.progression.mastery[MAINTAIN]).toBe(0);
  }, 240_000);
  it('reports all three cases and reflects100acting without turning unused or failed casts into actual successes', () => {
    const s = completePrinceLife(promotedForLife('AMPLIFY_FAIL')); expect(s.progression.acting).toBe(100); expect(princeOfAbolitionLifeClosed(s)).toBe(true); expect(hasPrinceOfAbolitionLifeLock(s)).toBe(false); expect(princeOfAbolitionLifeActions(s)).toEqual([]); expect(projectPrinceOfAbolitionLife(s).nextStep).not.toMatch(/休息|付费/);
    expect(s.princeOfAbolition.life.site.volunteer).toMatchObject({ mind: 97, health: 100, location: 'OUTSIDE' }); expect(s.princeOfAbolition.life).toMatchObject({ cooperationEffortSpent: 9, volunteerMindSpent: 3, flight: null, pending: null }); expect(attempt(s, 'withdrawn-input')).toMatchObject({ withdrawn: true, amplification: 0, appliedAbilityIds: [] }); expect(s.progression.mastery[AMPLIFY]).toBe(0); assertValidSliceState(s);
  }, 240_000);
  it('keeps insufficient-resource, viable-cast and already-cast withdrawal recommendations finite without annex shuttling', () => {
    const prepareThird = (source: SliceState): SliceState => {
      let s = annex(source);
      // Deliberately use the ordinary route without ready() resource recovery.
      for (const id of ['directed-throw', 'maintained-flight'] as const) {
        s = apply(s, id, 'OBSERVE');
        for (const permission of ['OWNER', 'COOPERATION'] as const) s = poa(s, { type: 'CONSENT', caseId: id, permission });
        s = apply(s, id, 'START_ORDINARY'); s = finish(reach(s, id), id);
      }
      s = apply(s, 'withdrawn-input', 'OBSERVE');
      for (const permission of ['OWNER', 'COOPERATION', 'ABILITY'] as const) s = poa(s, { type: 'CONSENT', caseId: 'withdrawn-input', permission });
      return reach(poa(s, { type: 'PREPARE', caseId: 'withdrawn-input', method: 'ABILITY' }), 'withdrawn-input');
    };
    // UNIT-only initial conditions before guidance or any new-stage receipt.
    // The original seed, all eight histories and physical source remain intact.
    let low = directedInitial2('SUCCESS'); low.spirituality = 7; low.mind = 41; assertValidSliceState(low);
    low = poa(low, { type: 'LEARN_GUIDANCE' });
    for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) low = poa(low, { type: 'PREPARE_TASK', taskId });
    low = poa(low, { type: 'BUY_POTION', bottleId: dose.bottleId }); low = poa(low, { type: 'PREPARE_PROMOTION' }); low = poa(low, dose);
    expect([low.spirituality, low.mind]).toEqual([7, 26]); expect(low.princeOfAbolition.sourceScene!.budget).toMatchObject({ spirituality: 7, mind: 41 });
    const insufficient = prepareThird(low), sufficient = prepareThird(promotedForLife());
    const preferred = (s: SliceState) => { const p = projectPrinceOfAbolitionLife(s); const action = p.actions.find(a => a.enabled && a.id === p.preferredActionId); expect(action).toBeDefined(); return action!; };
    expect(preferred(insufficient).command).toEqual({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    expect(blockPrinceOfAbolitionLife(insufficient, { type: 'DIRECTED_AMPLIFICATION', caseId: 'withdrawn-input' })).not.toBeNull();
    expect(preferred(sufficient).command).toEqual({ type: 'DIRECTED_AMPLIFICATION', caseId: 'withdrawn-input' });
    const cast = poa(sufficient, preferred(sufficient).command);
    expect(attempt(cast, 'withdrawn-input').castTier).not.toBeNull(); expect(preferred(cast).command).toEqual({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    for (let s of [insufficient, cast]) {
      const travel = s.princeOfAbolition.life.site.playerTravelMetres, before = structuredClone(s), commands: PrinceOfAbolitionActivityCommand[] = [];
      for (let count = 0; s.princeOfAbolition.life.cases['withdrawn-input'].status !== 'RESOLVED' && count < 16; count++) { const command = preferred(s).command; commands.push(command); s = poa(s, command); }
      expect(s.princeOfAbolition.life.cases['withdrawn-input'].status).toBe('RESOLVED'); expect(commands.some(c => c.type === 'WALK_TO_ANNEX')).toBe(false); expect(s.princeOfAbolition.life.site.playerTravelMetres - travel).toBe(12);
      expect(attempt(s, 'withdrawn-input')).toMatchObject({ withdrawn: true, amplification: 0, thrown: true, landed: true, returned: true, appliedAbilityIds: [] }); expect([s.cash, s.spirituality, s.mind]).toEqual([before.cash, before.spirituality, before.mind]);
      expect(piece(s, 'withdrawn-input')).toMatchObject(attempt(before, 'withdrawn-input').castTier === null ? { charges: 1, wear: 0 } : { charges: 0, wear: 1 }); assertValidSliceState(s);
    }
  }, 300_000);
  it('settles the actual zero-AP ordinary exit against the recorded finance snapshot and rejects altered week balances', () => {
    let s = promotedForLife('AMPLIFY', { weeklyBudget: 7, actions: 7 });
    s = poa(s, { type: 'EXIT_ROOM' }); s = poa(s, { type: 'BUY_ANNEX' }); s = apply(s, 'directed-throw', 'OBSERVE');
    expect(s.actionsRemaining).toBe(0); expect(hasPrinceOfAbolitionLifeLock(s)).toBe(true);
    for (const permission of ['OWNER', 'COOPERATION'] as const) s = poa(s, { type: 'CONSENT', caseId: 'directed-throw', permission });
    rejectPrinceOfAbolition(s, { type: 'PREPARE', caseId: 'directed-throw', method: 'ORDINARY' });
    s = apply(s, 'directed-throw', 'START_ORDINARY'); s = reach(s, 'directed-throw'); s = apply(s, 'directed-throw', 'THROW_BALL'); s = apply(s, 'directed-throw', 'WAIT_FLIGHT');
    for (const type of ['WALK_TO_RECEIVER', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RETURN_OBJECTS'] as const) s = apply(s, 'directed-throw', type);
    const week = s.week, financeBefore = structuredClone(s.princeOfAbolition.life.journal.at(-1)!.finance); s = apply(s, 'directed-throw', 'LEAVE');
    const receipt = s.princeOfAbolition.life.journal.at(-1)!;
    expect(receipt.after.actions).toBe(0); expect(receipt.finance).toEqual(financeBefore); expect(s.week).toBe(week + 1); expect(s.actionsRemaining).toBe(7); expect(princeOfAbolitionCompletedLifeBudgetMatches(s, receipt)).toBe(true); expect(hasPrinceOfAbolitionLifeLock(s)).toBe(false);
    for (const mutate of [(copy: SliceState) => { copy.cash++; }, (copy: SliceState) => { copy.actionsRemaining--; }, (copy: SliceState) => { copy.week--; }]) { const copy = structuredClone(s); mutate(copy); expect(princeOfAbolitionCompletedLifeBudgetMatches(copy, receipt)).toBe(false); }
    s = apply(s, 'directed-throw', 'REPORT'); expect(s.progression.acting).toBe(25); expect(s.princeOfAbolition.life.cases['directed-throw'].status).toBe('RESOLVED'); assertValidSliceState(s);
  }, 180_000);
  it('keeps every projected action identical to its fully validated external block and rejects damaged journals without cached validity', () => {
    const pending = amplification(), initial = promotedForLife(), outside = poa(initial, { type: 'EXIT_ROOM' });
    // Test-only baseline evaluates the exported complete validator independently
    // for every candidate action. The product has no second implementation.
    const baseline = (s: SliceState, actions: ReturnType<typeof princeOfAbolitionLifeActions>) => actions.map(action => {
      const reason = blockPrinceOfAbolitionLife(s, action.command);
      return { ...action, enabled: reason === null, reason };
    });
    for (const s of [initial, outside, pending]) {
      const before = structuredClone(s), actions = princeOfAbolitionLifeActions(s), view = projectPrinceOfAbolitionLife(s);
      expect(actions).toEqual(baseline(s, actions)); expect(view.actions).toEqual(baseline(s, view.actions)); expect(s).toEqual(before);
    }
    // Reuse one object and mutate it between calls: validity is invocation-local,
    // so a previously valid projection never blesses a later changed receipt.
    const changed = structuredClone(pending); expect(princeOfAbolitionLifeActions(changed).some(a => a.enabled)).toBe(true);
    changed.princeOfAbolition.life.journal.at(-1)!.paid.spirituality--;
    const blocked = princeOfAbolitionLifeActions(changed); expect(blocked.length).toBeGreaterThan(0); expect(blocked.every(a => !a.enabled && a.reason === '原物、真实位置、实付成本或历史收据不一致。')).toBe(true);
    expect(blocked).toEqual(baseline(changed, blocked)); expect(projectPrinceOfAbolitionLife(changed).preferredActionId).toBeNull();
    rejectPrinceOfAbolition(changed, { type: 'THROW_BALL', caseId: 'directed-throw' }); expect(validatePrinceOfAbolitionLifeState(changed)).toBe(false);
    changed.princeOfAbolition.life.journal.at(-1)!.paid.spirituality++; expect(validatePrinceOfAbolitionLifeState(changed)).toBe(true); expect(princeOfAbolitionLifeActions(changed)).toEqual(princeOfAbolitionLifeActions(pending));
  }, 180_000);
  it('rejects command extra fields and coherent-looking tampering of costs, draw, source, movement and projection secrets', () => {
    expect(validatePrinceOfAbolitionActivityCommand({ type: 'EXIT_ROOM', caseId: 'directed-throw' })).toBe(false); expect(validatePrinceOfAbolitionActivityCommand({ type: 'THROW_BALL', caseId: 'directed-throw', targetId: 'FM3-DARIAN' })).toBe(false);
    const good = amplification(); const changes: ((s: SliceState) => void)[] = [s => { s.princeOfAbolition.life.site.clockSeconds--; }, s => { s.princeOfAbolition.life.site.pads[0]!.location = 'C'; }, s => { s.princeOfAbolition.life.site.ball.massGrams = 81 as 80; }, s => { s.princeOfAbolition.life.pieces[0]!.charges = 1; }, s => { s.princeOfAbolition.life.pending!.expiresAt++; }, s => { s.princeOfAbolition.life.journal.at(-1)!.paid.mind--; }, s => { s.princeOfAbolition.life.journal.at(-1)!.randomAfter!++; }, s => { s.princeOfAbolition.life.journal[1]!.moves[0]!.metres = 0; }, s => { s.princeOfAbolition.life.site.volunteer.mind++; }];
    for (const change of changes) { const s = structuredClone(good); change(s); expect(validatePrinceOfAbolitionLifeState(s), change.toString()).toBe(false); expect(validatePrinceOfAbolitionState(s)).toBe(false); }
    const view = projectPrinceOfAbolitionLife(good), serialized = JSON.stringify(view); for (const secret of ['randomCursor', 'randomBefore', 'randomAfter', 'siteBefore', 'siteAfter', 'sourceScene', 'sourceHistory', 'coreStats', 'weeklyBudget', 'lawyer-natural-v063', 'testSourceId']) expect(serialized).not.toContain(secret);
    expect(view.ledger.every(e => !('before' in e) && !('after' in e) && !('finance' in e))).toBe(true); expect(projectSliceState(good).princeOfAbolition.life).toEqual(view); expect(blockPrinceOfAbolitionLife(good, { type: 'WAIT_10', caseId: 'directed-throw' })).toBeNull();
  }, 180_000);
});
