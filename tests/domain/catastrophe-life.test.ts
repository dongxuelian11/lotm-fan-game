import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  CATASTROPHE_CASE_IDS, applyCatastropheActivity, blockCatastropheLife, createCatastropheLifeState,
  hasCatastropheLifeLock, projectCatastropheLife, validateCatastropheActivityCommand, validateCatastropheLife,
  type CatastropheActivityCommand, type CatastropheCaseId,
} from '../../src/domain/catastrophe/life.js';
import { createCatastropheSiteState, validateCatastropheSiteState } from '../../src/domain/catastrophe/resources.js';
import { blockCatastropheEncounter } from '../../src/domain/catastrophe/encounter.js';
import { catastropheBoundary, catastropheSnapshot, tyrantLegacyKeys, rejectCt, type CatastropheBoundary } from './catastrophe-helper.js';

const STORM = 'tyrant.s2.storm-field', PRESSURE = 'tyrant.s2.water-pressure';
let promoted: SliceState, practiced: SliceState, storm: CatastropheBoundary, pressure: CatastropheBoundary, withdrawal: CatastropheBoundary;
beforeAll(() => {
  promoted = catastropheSnapshot('promoted'); practiced = catastropheSnapshot('practiced');
  storm = catastropheBoundary('buoy-return-storm-outcome'); pressure = catastropheBoundary('wheel-return-pressure-outcome');
  withdrawal = catastropheBoundary('withdrawn-request-pressure-outcome');
});
const attempt = (s: SliceState, id: CatastropheCaseId) => s.catastrophe.life.cases[id].attempts.at(-1)!;
const mastery = (s: SliceState) => [s.progression.mastery[STORM], s.progression.mastery[PRESSURE]];
const originals = (s: SliceState) => [...tyrantLegacyKeys.map(key => s[key]), s.character, s.injuries, s.injuryRisk, s.combatHistory, s.town];
/** DIRECTED STEP-ONLY units start from genuine captured pre-cast states. A scripted check
 * tests a local branch only; it is never persisted, called natural evidence or validated as
 * a full recorded history. No seed/cursor search selects a favorable natural outcome. */
function direct(s: SliceState, command: CatastropheActivityCommand, roll: 1 | 100 = 1) {
  const ctx: SeerContext = { roll: vi.fn(() => { throw new Error('Unexpected additional life draw'); }), note: vi.fn(),
    check: vi.fn((ability, difficulty) => { s.random.cursor++; return resolveNormalCheck({ ability,
      baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll }); }) };
  applyCatastropheActivity(s, command, ctx); return ctx;
}
function denied(s: SliceState, command: CatastropheActivityCommand) {
  const frozen = structuredClone(s);
  expect(blockCatastropheLife(s, command)).not.toBeNull(); expect(() => direct(s, command)).toThrow(); expect(s).toEqual(frozen);
}
function finish(s: SliceState, caseId: CatastropheCaseId) {
  const a = attempt(s, caseId);
  if ([a.storm, a.pressure].some(u => u.attempts && !u.stopped)) direct(s, { type: 'STOP_EFFECT', caseId });
  if (s.catastrophe.life.site.buoy.offsetMetres) direct(s, { type: 'RECOVER_BUOY', caseId });
  if (s.catastrophe.life.site.water.channelUnits) direct(s, { type: 'DRAIN_WATER', caseId });
  if (s.catastrophe.life.site.gate.position === 'OPEN') direct(s, { type: 'CLOSE_GATE', caseId });
  if (caseId === 'buoy-return') direct(s, { type: 'CHECK_MOORING', caseId });
  direct(s, { type: 'RETURN_KEEPER', caseId }); direct(s, { type: 'EXIT_SITE', caseId });
  direct(s, { type: 'INSPECT', caseId }); direct(s, { type: 'CLOSE', caseId });
}
function report(s: SliceState, caseId: CatastropheCaseId) {
  // Explicit domain-unit budget, after physical contact is closed. Never a natural capture.
  s.actionsRemaining = 1; direct(s, { type: 'REPORT', caseId });
}

describe('Catastrophe genuine life journal, single original water stock and once-only growth', () => {
  it('starts from one independent adult and one set of original resources, with precisely20 water units', () => {
    expect(promoted.catastrophe.life).toEqual(createCatastropheLifeState());
    expect(promoted.catastrophe.life.site).toEqual(createCatastropheSiteState());
    expect(Object.keys(promoted.catastrophe.life.cases)).toEqual([...CATASTROPHE_CASE_IDS]);
    expect(promoted.catastrophe.life.site).toMatchObject({ id: 'CT2-COVE', boundaryMetres: 12, playerPosition: 'EXIT',
      keeper: { id: 'CT2-NORA', age: 45, alive: true, position: 'CONTROL', energy: 100, travelMetres: 0 },
      water: { id: 'CT2-WATER', originalUnits: 20, bayUnits: 20, channelUnits: 0 },
      gate: { id: 'CT2-GATE', position: 'CLOSED', durability: 100, operations: 0 }, wheel: { turns: 0, durability: 100 } });
    expect(mastery(promoted)).toEqual([0, 0]); expect(hasCatastropheLifeLock(promoted)).toBe(false); expect(validateCatastropheLife(promoted)).toBe(true);
    const copy = createCatastropheLifeState(); copy.site.water.bayUnits--; expect(promoted.catastrophe.life.site.water.bayUnits).toBe(20);
  });
  it('replays genuine cast boundaries without changing costs, the seed, original people or actual success/failure', () => {
    for (const b of [storm, pressure, withdrawal]) {
      const frozen = structuredClone(b.beforeLast), next = applySliceIntent(b.beforeLast, b.lastIntent);
      expect(next).toEqual(b.final); expect(b.beforeLast).toEqual(frozen); assertValidSliceState(next);
      expect(validateCatastropheLife(next)).toBe(true); expect(originals(next)).toEqual(originals(b.beforeLast));
      const event = next.catastrophe.life.journal.at(-1)!;
      expect(event.paid).toEqual({ actions: 0, spirituality: event.command.type === 'STORM_FIELD' ? 7 : 6 });
      expect(next.spirituality).toBe(b.beforeLast.spirituality - event.paid.spirituality);
      expect(next.random).toEqual({ seed: b.beforeLast.random.seed, cursor: b.beforeLast.random.cursor + 1 });
      expect(event.check).toMatchObject({ ability: event.command.type === 'STORM_FIELD' ? 'will' : 'knowledge', difficulty: 20 });
      const rng = new DeterministicActionRandomStream(next.random.seed, event.randomBefore!);
      expect(event.check!.roll).toBe(rng.nextInt(1, 100)); expect(event.randomAfter).toBe(rng.cursor);
      expect(event.source).toMatchObject({ siteId: 'CT2-COVE', ownerId: 'CT2-NORA', ownerConsentWeek: next.week,
        playerPosition: 'CONTROL', keeperPosition: 'EXIT', waterId: 'CT2-WATER', gateId: 'CT2-GATE', boundaryMetres: 12 });
      expect(event.source!.bayUnits + event.source!.channelUnits).toBe(20);
      expect(attempt(next, (event.command as { caseId: CatastropheCaseId }).caseId).appliedAbilityIds).toEqual([]);
      expect(mastery(next)).toEqual(mastery(b.beforeLast));
    }
  });
  it('accounts for every real second, metre, energy debit, gate operation, wheel turn and original wear from the exact journal', () => {
    const l = practiced.catastrophe.life, events = l.journal, site = l.site;
    const count = (type: string) => events.filter(e => e.command.type === type).length;
    const seconds: Record<string, number> = { READ_SOURCE: 2, CONSENT_OWNER: 2, DECLINE_OWNER: 2, AGREE_RETURN: 2,
      ENTER_SITE: 2, EXIT_SITE: 2, CHECK_BOUNDARY: 2, CLEAR_KEEPER: 6, RETURN_KEEPER: 6, CHECK_GATE: 1,
      OPEN_GATE: 2, CLOSE_GATE: 2, ADMIT_WATER: 4, STORM_FIELD: 2, WATER_PRESSURE: 2, MOVE_BUOY: 2,
      DRIVE_WHEEL: 2, MANUAL_WHEEL: 4, CHECK_CONTINUATION: 1, RECOVER_BUOY: 8, DRAIN_WATER: 4, CHECK_MOORING: 2, WAIT_10: 10, INSPECT: 2 };
    expect(site.clockSeconds).toBe(events.reduce((n, e) => n + (seconds[e.command.type] ?? 0), 0));
    expect(site.playerTravelMetres).toBe(2 * (count('ENTER_SITE') + count('EXIT_SITE')));
    expect(site.keeper.travelMetres).toBe(6 * (count('CLEAR_KEEPER') + count('RETURN_KEEPER')));
    expect(site.keeper.energy).toBe(100 - 2 * (count('CLEAR_KEEPER') + count('RETURN_KEEPER')));
    expect(site.gate.operations).toBe(count('OPEN_GATE') + count('CLOSE_GATE')); expect(site.gate.durability).toBe(100 - site.gate.operations);
    expect(site.wheel.turns).toBe(count('DRIVE_WHEEL') + count('MANUAL_WHEEL')); expect(site.wheel.durability).toBe(100 - site.wheel.turns);
    expect(site.mooring.durability).toBe(100 - count('RECOVER_BUOY')); expect(site.winch.durability).toBe(100 - count('RECOVER_BUOY'));
    expect(site).toMatchObject({ playerPosition: 'EXIT', keeper: { position: 'CONTROL' }, buoy: { offsetMetres: 0 },
      gate: { position: 'CLOSED' }, water: { bayUnits: 20, channelUnits: 0 } });
    expect(events.filter(e => e.source).every(e => e.source!.bayUnits + e.source!.channelUnits === 20)).toBe(true);
    expect(events.every(e => e.budget.actionsBefore - e.budget.actionsAfter === e.paid.actions && e.budget.spiritualityBefore - e.budget.spiritualityAfter === e.paid.spirituality)).toBe(true);
    expect(validateCatastropheSiteState(site)).toBe(true); expect(validateCatastropheLife(practiced)).toBe(true);
  });
  it('awards25 per truthful report and25 reflection, with8 mastery only for each actual application and never a successful unused window', () => {
    expect(practiced.catastrophe.life.reflected).toBe(true); expect(practiced.progression.acting).toBe(100);
    for (const id of [STORM, PRESSURE]) {
      const applied = CATASTROPHE_CASE_IDS.filter(caseId => attempt(practiced, caseId).appliedAbilityIds.includes(id as typeof STORM | typeof PRESSURE)).length;
      expect(practiced.progression.mastery[id]).toBe(applied * 8);
    }
    expect(attempt(practiced, 'withdrawn-request')).toMatchObject({ ownerConsent: 'CLOSED', consentWithdrawn: true, result: 'ORDINARY', appliedAbilityIds: [] });
    for (const caseId of CATASTROPHE_CASE_IDS) {
      expect(practiced.catastrophe.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true, closes: 1 });
      rejectCt(practiced, { type: 'REPORT', caseId }); rejectCt(practiced, { type: 'PREPARE', caseId, method: 'ABILITY' });
    }
    rejectCt(practiced, { type: 'REFLECT' }); expect(hasCatastropheLifeLock(practiced)).toBe(false);
  });
  it('rejects hidden fields, unknown steps, old case IDs and the unapproved inherited craft command', () => {
    for (const c of [{ type: 'MOVE_BUOY', caseId: 'buoy-return', metres: 99 }, { type: 'PREPARE', caseId: 'buoy-return' },
      { type: 'PREPARE', caseId: 'buoy-return', method: 'FREE' }, { type: 'REFLECT', caseId: 'buoy-return' },
      { type: 'OBSERVE', caseId: 'remote-dinghy' }, { type: 'TELEPORT', caseId: 'buoy-return' }, { type: 'CRAFT', caseId: 'wheel-return' }]) {
      expect(validateCatastropheActivityCommand(c)).toBe(false); rejectCt(promoted, c);
    }
    expect(validateCatastropheActivityCommand({ type: 'PREPARE', caseId: 'buoy-return', method: 'ABILITY' })).toBe(true);
  });
  it('requires all three genuinely closed cases and reflection before the optional original enemy entrance', () => {
    expect(blockCatastropheEncounter(promoted, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    for (const b of [storm, pressure, withdrawal]) expect(blockCatastropheEncounter(b.beforeLast, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('projects current truth with detached copies and never moves resources or advances RNG by viewing', () => {
    const s = structuredClone(withdrawal.final), before = structuredClone(s), view = projectCatastropheLife(s);
    expect(view.site).toEqual(s.catastrophe.life.site); expect(view.currentAttempt).toEqual(attempt(s, 'withdrawn-request'));
    expect(view.sitePhase).toBe('LIFE'); expect(view.inside).toBe(true);
    view.site.water.channelUnits++; view.currentAttempt!.pressure.effects++; expect(s).toEqual(before);
  });
});

describe('Catastrophe directed local-step branches, never replacement natural outcomes', () => {
  it('charges a successful7S storm window without moving the buoy or awarding mastery, then applies only on the explicit move', () => {
    const s = structuredClone(storm.beforeLast), old = structuredClone(originals(s)), prior = s.spirituality, caseId = 'buoy-return';
    const c = direct(s, { type: 'STORM_FIELD', caseId }); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 20);
    expect(attempt(s, caseId).storm).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'ACTIVE', remainingSeconds: 10 });
    expect(s.catastrophe.life.site.buoy.offsetMetres).toBe(0); expect(s.spirituality).toBe(prior - 7); expect(mastery(s)).toEqual([0, 0]);
    denied(s, { type: 'STORM_FIELD', caseId }); direct(s, { type: 'MOVE_BUOY', caseId });
    expect(attempt(s, caseId).storm).toMatchObject({ effects: 1, remainingSeconds: 8 }); expect(s.catastrophe.life.site.buoy.offsetMetres).toBe(8);
    denied(s, { type: 'CLOSE', caseId }); denied(s, { type: 'RECOVER_BUOY', caseId });
    const site = structuredClone(s.catastrophe.life.site); direct(s, { type: 'STOP_EFFECT', caseId }); expect(s.catastrophe.life.site).toEqual(site);
    const wear = [site.mooring.durability, site.winch.durability]; finish(s, caseId);
    expect(s.catastrophe.life.site.buoy.offsetMetres).toBe(0); expect([s.catastrophe.life.site.mooring.durability, s.catastrophe.life.site.winch.durability]).toEqual(wear.map(n => n - 1));
    expect(mastery(s)).toEqual([0, 0]); report(s, caseId); expect(mastery(s)).toEqual([8, 0]); expect(originals(s)).toEqual(old);
  });
  it('expires a successful unused window at ten real seconds, requires explicit stop and awards no invented application', () => {
    const s = structuredClone(storm.beforeLast), caseId = 'buoy-return'; direct(s, { type: 'STORM_FIELD', caseId });
    const before = s.catastrophe.life.site.clockSeconds; direct(s, { type: 'WAIT_10', caseId });
    expect(s.catastrophe.life.site.clockSeconds - before).toBe(10); expect(attempt(s, caseId).storm).toMatchObject({ state: 'EXPIRED', remainingSeconds: 0, effects: 0, stopped: false });
    denied(s, { type: 'MOVE_BUOY', caseId }); denied(s, { type: 'RETURN_KEEPER', caseId }); finish(s, caseId); report(s, caseId);
    expect(attempt(s, caseId).result).toBe('ORDINARY'); expect(mastery(s)).toEqual([0, 0]);
  });
  it('retains failed pressure cost and performs an explicitly ordinary wheel turn without magical mastery', () => {
    const s = structuredClone(pressure.beforeLast), caseId = 'wheel-return', before = structuredClone(s.catastrophe.life.site), oldMastery = mastery(s), prior = s.spirituality;
    const c = direct(s, { type: 'WATER_PRESSURE', caseId }, 100); expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20);
    expect(s.spirituality).toBe(prior - 6); expect(attempt(s, caseId).pressure).toMatchObject({ state: 'FAILED', successes: 0, effects: 0 });
    denied(s, { type: 'WATER_PRESSURE', caseId }); denied(s, { type: 'DRIVE_WHEEL', caseId }); denied(s, { type: 'MANUAL_WHEEL', caseId });
    direct(s, { type: 'STOP_EFFECT', caseId }); direct(s, { type: 'MANUAL_WHEEL', caseId });
    expect(s.catastrophe.life.site.wheel).toMatchObject({ turns: before.wheel.turns + 1, durability: before.wheel.durability - 1 });
    expect(attempt(s, caseId)).toMatchObject({ manualWheel: true, appliedAbilityIds: [] }); finish(s, caseId); report(s, caseId);
    expect(attempt(s, caseId).result).toBe('ORDINARY'); expect(mastery(s)).toEqual(oldMastery);
  });
  it('successful pressure requires a second actual wheel step and preserves the same four channel units until explicit drain', () => {
    const s = structuredClone(pressure.beforeLast), caseId = 'wheel-return', before = structuredClone(s.catastrophe.life.site), oldMastery = mastery(s);
    direct(s, { type: 'WATER_PRESSURE', caseId }); expect(s.catastrophe.life.site.wheel).toEqual(before.wheel); expect(mastery(s)).toEqual(oldMastery);
    direct(s, { type: 'DRIVE_WHEEL', caseId }); expect(s.catastrophe.life.site.water).toEqual(before.water);
    expect(attempt(s, caseId)).toMatchObject({ wheelTurned: true, pressure: { effects: 1, remainingSeconds: 8 }, appliedAbilityIds: [PRESSURE] });
    expect(s.catastrophe.life.site.wheel.turns).toBe(before.wheel.turns + 1); finish(s, caseId); report(s, caseId);
    expect(mastery(s)).toEqual([oldMastery[0], oldMastery[1]! + 8]); expect(s.catastrophe.life.site.water).toMatchObject({ bayUnits: 20, channelUnits: 0 });
  });
  it('closing the real gate blocks an already paid window, preserves water, and allows ordinary drain through the separate return route', () => {
    const s = structuredClone(pressure.beforeLast), caseId = 'wheel-return'; direct(s, { type: 'WATER_PRESSURE', caseId });
    const site = structuredClone(s.catastrophe.life.site), priorS = s.spirituality; direct(s, { type: 'CLOSE_GATE', caseId });
    expect(s.catastrophe.life.site.gate).toMatchObject({ position: 'CLOSED', operations: site.gate.operations + 1, durability: site.gate.durability - 1 });
    expect(s.catastrophe.life.site.clockSeconds - site.clockSeconds).toBe(2); expect(s.catastrophe.life.site.water).toEqual(site.water);
    denied(s, { type: 'DRIVE_WHEEL', caseId }); denied(s, { type: 'DRAIN_WATER', caseId });
    direct(s, { type: 'STOP_EFFECT', caseId }); const at = s.catastrophe.life.site.clockSeconds; direct(s, { type: 'DRAIN_WATER', caseId });
    expect(s.catastrophe.life.site.clockSeconds - at).toBe(4); expect(s.catastrophe.life.site.water).toMatchObject({ bayUnits: 20, channelUnits: 0 });
    expect(s.spirituality).toBe(priorS); expect(attempt(s, caseId).appliedAbilityIds).toEqual([]); finish(s, caseId); report(s, caseId);
  });
  it('honors current withdrawal with an unused paid window and permits every explicit cleanup step at zero AP and zero S', () => {
    const s = structuredClone(withdrawal.beforeLast), caseId = 'withdrawn-request'; s.spirituality = 6; s.actionsRemaining = 0;
    direct(s, { type: 'WATER_PRESSURE', caseId }); expect(s.spirituality).toBe(0); direct(s, { type: 'CHECK_CONTINUATION', caseId });
    expect(attempt(s, caseId)).toMatchObject({ ownerConsent: 'WITHDRAWN', consentWithdrawn: true, spiritualitySpent: 6,
      pressure: { state: 'ACTIVE', successes: 1, remainingSeconds: 9, effects: 0 }, appliedAbilityIds: [] });
    for (const type of ['WATER_PRESSURE', 'STORM_FIELD', 'DRIVE_WHEEL', 'MOVE_BUOY', 'ADMIT_WATER', 'CONSENT_OWNER'] as const) denied(s, { type, caseId });
    const site = structuredClone(s.catastrophe.life.site), at = site.clockSeconds; direct(s, { type: 'STOP_EFFECT', caseId });
    expect(s.catastrophe.life.site).toEqual(site); expect(s.catastrophe.life.site.keeper.position).toBe('EXIT');
    finish(s, caseId); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.catastrophe.life.site.clockSeconds - at).toBe(16); // drain4 + close2 + keeper6 + player2 + inspect2
    expect(s.catastrophe.life.site.keeper.energy).toBe(site.keeper.energy - 2); expect(attempt(s, caseId).result).toBe('ORDINARY');
    const oldMastery = mastery(s); report(s, caseId); expect(mastery(s)).toEqual(oldMastery);
  });
  it('denies initial closed/empty water or missing current permission without paying or drawing', () => {
    for (const change of [
      (s: SliceState) => { s.catastrophe.life.site.gate.position = 'CLOSED'; },
      (s: SliceState) => { s.catastrophe.life.site.water.channelUnits = 0; s.catastrophe.life.site.water.bayUnits = 20; },
      (s: SliceState) => { attempt(s, 'wheel-return').ownerConsent = 'WITHDRAWN'; },
      (s: SliceState) => { attempt(s, 'wheel-return').ownerConsentWeek = s.week - 1; },
      (s: SliceState) => { s.catastrophe.life.site.keeper.position = 'CONTROL'; },
      (s: SliceState) => { s.spirituality = 5; }, (s: SliceState) => { s.mind = 0; },
    ]) { const s = structuredClone(pressure.beforeLast); change(s); denied(s, { type: 'WATER_PRESSURE', caseId: 'wheel-return' }); }
  });
});

describe('Catastrophe strict saved life provenance rejects tampering, even resource-valid rewrites', () => {
  it('rejects journal/check/source/cost/order/application and final-site forgery instead of trusting arbitrary appended text', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.catastrophe.life.site.water.bayUnits--; },
      s => { s.catastrophe.life.site.water.bayUnits = 16; s.catastrophe.life.site.water.channelUnits = 4; },
      s => { s.catastrophe.life.site.gate.operations++; s.catastrophe.life.site.gate.durability--; },
      s => { s.catastrophe.life.site.winch.durability--; },
      s => { s.catastrophe.life.site.wheel.turns++; s.catastrophe.life.site.wheel.durability--; },
      s => { s.catastrophe.life.site.keeper.travelMetres += 6; s.catastrophe.life.site.keeper.energy -= 2; },
      s => { s.catastrophe.life.site.clockSeconds++; },
      s => { s.catastrophe.life.journal[0]!.paid.actions++; },
      s => { s.catastrophe.life.journal[0]!.budget.actionsAfter++; },
      s => { s.catastrophe.life.journal.push(structuredClone(s.catastrophe.life.journal.at(-1)!)); },
      s => { s.catastrophe.life.journal.reverse(); },
      s => { (s.catastrophe.life.journal[0] as unknown as Record<string, unknown>).text = 'Everything was returned'; },
      s => { const e = s.catastrophe.life.journal.find(e => e.check)!; e.check!.roll = e.check!.roll === 100 ? 1 : 100; },
      s => { const e = s.catastrophe.life.journal.find(e => e.check)!; e.randomAfter!++; },
      s => { const e = s.catastrophe.life.journal.find(e => e.source)!; e.source!.ownerConsentWeek--; },
      s => { const e = s.catastrophe.life.journal.find(e => e.source)!; e.source!.bayUnits--; e.source!.channelUnits++; },
      s => { attempt(s, 'withdrawn-request').appliedAbilityIds.push(PRESSURE); s.progression.mastery[PRESSURE]! += 8; },
      s => { attempt(s, 'withdrawn-request').pressure.effects++; },
      s => { s.progression.acting--; }, s => { s.progression.mastery[STORM]!++; },
    ];
    for (const [index, change] of mutations.entries()) {
      const s = structuredClone(practiced); change(s); expect(validateCatastropheLife(s), `mutation ${index}`).toBe(false);
      expect(() => assertValidSliceState(s), `mutation ${index}`).toThrow();
    }
  });
});
