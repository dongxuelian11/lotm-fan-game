import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../../src/domain/wisdom-angel/types.js';
import {
  WISDOM_ANGEL_CASE_IDS, blockWisdomAngelLife, createWisdomAngelLifeState, hasWisdomAngelLifeLock,
  projectWisdomAngelLife, validateWisdomAngelActivityCommand, validateWisdomAngelLife,
  type WisdomAngelActivityCommand, type WisdomAngelCaseId,
} from '../../src/domain/wisdom-angel/life.js';
import { readingLegacyKeys, wisdomAngelSnapshot, wisdomAngelBoundaryForIntent, unitBudget, wa, rejectWa } from './wisdom-angel-helper.js';

// These are directed unit branches from an actual promoted save. They never overwrite natural captures.
const ready = () => unitBudget(wisdomAngelSnapshot('promoted'));
const attempt = (s: SliceState, id: WisdomAngelCaseId = 'record-handover') => s.wisdomAngel.life.cases[id].attempts.at(-1)!;
const mastery = (s: SliceState) => WISDOM_ANGEL_ABILITY_IDS.map(id => s.progression.mastery[id]);
const oldRecords = (s: SliceState) => [...readingLegacyKeys.map(key => s[key]), s.character, s.injuries, s.injuryRisk, s.combatHistory, s.town];
function cast(s: SliceState, command: WisdomAngelActivityCommand, roll: 1 | 100): SliceState {
  const input = structuredClone(s);
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 10000; cursor++) {
    if (new DeterministicActionRandomStream(s.random.seed, cursor).nextInt(1, 100) !== roll) continue;
    input.random.cursor = cursor; assertValidSliceState(input); return wa(input, command);
  }
  throw new Error(`No directed unit-only cursor for roll ${roll}`);
}
function begin(s: SliceState, caseId: WisdomAngelCaseId = 'record-handover', method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = wa(unitBudget(s), { type: 'OBSERVE', caseId });
  s = wa(unitBudget(s), { type: 'PREPARE', caseId, method });
  return wa(s, { type: 'PERFORM', caseId });
}
function enter(s: SliceState, caseId: WisdomAngelCaseId = 'record-handover'): SliceState {
  for (const type of ['READ_SOURCE', 'CONSENT_OWNER', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_PAPERS', 'READ_FIRST', 'READ_SECOND'] as const) s = wa(s, { type, caseId });
  return s;
}
function close(s: SliceState, caseId: WisdomAngelCaseId = 'record-handover'): SliceState {
  if (attempt(s, caseId).synthesis.state === 'ACTIVE' || attempt(s, caseId).response.state === 'ACTIVE') s = wa(s, { type: 'STOP_METHOD', caseId });
  if (attempt(s, caseId).papersTaken && !attempt(s, caseId).papersReturned) s = wa(s, { type: 'RETURN_PAPERS', caseId });
  if (attempt(s, caseId).deviceTaken && !attempt(s, caseId).deviceReturned) s = wa(s, { type: 'RETURN_DEVICE', caseId });
  if (attempt(s, caseId).entered && !attempt(s, caseId).exited) s = wa(s, { type: 'EXIT_ROOM', caseId });
  s = wa(s, { type: 'INSPECT', caseId }); return wa(s, { type: 'CLOSE', caseId });
}
const report = (s: SliceState, caseId: WisdomAngelCaseId = 'record-handover') => wa(unitBudget(s), { type: 'REPORT', caseId });
function ordinary(s: SliceState, caseId: WisdomAngelCaseId): SliceState {
  s = enter(begin(s, caseId, 'ORDINARY'), caseId);
  if (caseId === 'record-handover') {
    s = wa(s, { type: 'MANUAL_COMPARE', caseId }); s = wa(s, { type: 'VERIFY_HANDOVER', caseId });
  } else {
    s = wa(s, { type: 'TAKE_DEVICE', caseId });
    if (caseId === 'withdrawn-consent') s = wa(s, { type: 'WITHDRAW_CONSENT', caseId });
    else {
      for (const type of ['OBSERVE_CONDITION', 'FIRST_DEMONSTRATION'] as const) s = wa(s, { type, caseId });
      s = wa(s, { type: 'PREDICT', caseId, prediction: 'WHITE' });
      for (const type of ['SWITCH_FILTER', 'OBSERVE_CONDITION', 'SECOND_DEMONSTRATION', 'VERIFY_RESULT'] as const) s = wa(s, { type, caseId });
    }
  }
  return report(close(s, caseId), caseId);
}
function deviceReady(): SliceState {
  let s = enter(begin(ordinary(ready(), 'record-handover'), 'changed-condition'), 'changed-condition');
  for (const type of ['TAKE_DEVICE', 'OBSERVE_CONDITION', 'FIRST_DEMONSTRATION'] as const) s = wa(s, { type, caseId: 'changed-condition' });
  return s;
}
function responseReady(): SliceState {
  let s = deviceReady();
  s = wa(s, { type: 'PREDICT', caseId: 'changed-condition', prediction: 'WHITE' });
  s = wa(s, { type: 'SWITCH_FILTER', caseId: 'changed-condition' });
  s = wa(s, { type: 'OBSERVE_CONDITION', caseId: 'changed-condition' });
  return wa(s, { type: 'PREDICT', caseId: 'changed-condition', prediction: 'AMBER' });
}
function withdrawalReady(): SliceState {
  const s = ordinary(ordinary(ready(), 'record-handover'), 'changed-condition');
  return wa(enter(begin(s, 'withdrawn-consent'), 'withdrawn-consent'), { type: 'TAKE_DEVICE', caseId: 'withdrawn-consent' });
}
function expectInvalid(s: SliceState, mutations: ((next: SliceState) => void)[]) {
  for (const mutate of mutations) {
    const next = structuredClone(s); mutate(next);
    expect(validateWisdomAngelLife(next)).toBe(false); expect(() => assertValidSliceState(next)).toThrow();
  }
}

describe('Wisdom Angel original finite evidence, current conditions and actual physical return', () => {
  it('starts with one living original adult, two dated original sheets and one device with exactly two charges', () => {
    const s = ready(), l = s.wisdomAngel.life;
    expect(l).toEqual(createWisdomAngelLifeState()); expect(Object.keys(l.cases)).toEqual([...WISDOM_ANGEL_CASE_IDS]);
    expect(l.mara).toEqual({ id: 'WA2-MARA', name: '玛拉', age: 43, alive: true, health: 100, mind: 100, location: 'EXIT', travelMetres: 0 });
    expect(l.room).toEqual({ id: 'WA2-ROOM', pathMetres: 4, exitOpen: true });
    expect(l.papers.map(p => [p.id, p.owner, p.location, p.firstReadWeek])).toEqual([
      ['WA2-SHEET-1', 'WA2-MARA', 'TABLE', null], ['WA2-SHEET-2', 'WA2-MARA', 'TABLE', null],
    ]);
    expect(l.papers.every(p => p.text.includes('1349年6月26日'))).toBe(true);
    expect(l.device).toEqual({ id: 'WA2-DEVICE', owner: 'WA2-MARA', location: 'TABLE', charges: 2, filter: 'CLEAR', conditionVersion: 1, demonstrations: 0, filterChanges: 0 });
    expect(hasWisdomAngelLifeLock(s)).toBe(false); expect(validateWisdomAngelLife(s)).toBe(true); expect(mastery(s)).toEqual([0, 0]);
  });

  it('hides unread sheet text, unknown current filter and verified handover from the public projection and blocked reasons', () => {
    let s = begin(ready()); const id = 'record-handover';
    for (const type of ['SYNTHESIS', 'VERIFY_HANDOVER', 'READ_FIRST', 'ENTER_ROOM'] as const) rejectWa(s, { type, caseId: id });
    const early = JSON.stringify(projectWisdomAngelLife(s));
    for (const p of s.wisdomAngel.life.papers) expect(early).not.toContain(p.text);
    expect(early).not.toContain('已与原桌旁玛拉当面核对'); expect(projectWisdomAngelLife(s).device.filter).toBeNull();
    s = wa(s, { type: 'READ_SOURCE', caseId: id });
    expect(projectWisdomAngelLife(s).papers.map(p => p.text)).toEqual([null, null]);
    expect(blockWisdomAngelLife(s, { type: 'SYNTHESIS', caseId: id })).not.toBeNull();
    for (const type of ['CONSENT_OWNER', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_PAPERS', 'READ_FIRST'] as const) s = wa(s, { type, caseId: id });
    expect(projectWisdomAngelLife(s).papers.map(p => p.text)).toEqual([s.wisdomAngel.life.papers[0].text, null]);
    rejectWa(s, { type: 'SYNTHESIS', caseId: id }); rejectWa(s, { type: 'VERIFY_HANDOVER', caseId: id });
    s = wa(s, { type: 'READ_SECOND', caseId: id }); expect(attempt(s).handoverFinding).toBeNull();
  });

  it('requires current source agreement before entering and spends actual seconds and metres without teleporting originals', () => {
    let s = begin(ready()); const id = 'record-handover';
    rejectWa(s, { type: 'CONSENT_OWNER', caseId: id }); rejectWa(s, { type: 'AGREE_RETURN', caseId: id });
    s = wa(s, { type: 'READ_SOURCE', caseId: id }); s = wa(s, { type: 'CONSENT_OWNER', caseId: id });
    rejectWa(s, { type: 'ENTER_ROOM', caseId: id }); s = wa(s, { type: 'AGREE_RETURN', caseId: id });
    const door = structuredClone(s); s = wa(s, { type: 'ENTER_ROOM', caseId: id });
    expect(s.wisdomAngel.life).toMatchObject({ playerLocation: 'TABLE', mara: { location: 'TABLE', travelMetres: 4 }, playerTravelMetres: 4 });
    expect(attempt(s)).toMatchObject({ ownerConsent: 'GRANTED', ownerConsentWeek: s.week, entered: true, playerTravelMetres: 4, maraTravelMetres: 4 });
    expect(s.wisdomAngel.life.clockSeconds).toBe(door.wisdomAngel.life.clockSeconds + 4);
    expect(s.wisdomAngel.life.papers).toEqual(door.wisdomAngel.life.papers); expect(s.wisdomAngel.life.device).toEqual(door.wisdomAngel.life.device);
    expect(s.actionsRemaining).toBe(door.actionsRemaining); expect(s.random).toEqual(door.random);
  });

  it('honors refusal before entry without spending abilities, moving bodies or borrowing originals', () => {
    let s = begin(ready()), before = structuredClone(s); const caseId = 'record-handover';
    s = wa(s, { type: 'READ_SOURCE', caseId }); s = wa(s, { type: 'DECLINE_OWNER', caseId });
    for (const type of ['CONSENT_OWNER', 'ENTER_ROOM', 'TAKE_PAPERS', 'SYNTHESIS'] as const) rejectWa(s, { type, caseId });
    s = report(close(s));
    expect(attempt(s)).toMatchObject({ result: 'ORDINARY', entered: false, exited: false, papersTaken: false, elapsedSeconds: 6, closed: true });
    expect(s.wisdomAngel.life.mara).toEqual(before.wisdomAngel.life.mara); expect(s.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers);
    expect(s.spirituality).toBe(before.spirituality); expect(s.progression.acting).toBe(25); expect(mastery(s)).toEqual([0, 0]);
  });

  it('records successful synthesis as a limited unverified hypothesis, then awards only an actual reported handover application', () => {
    let s = enter(begin(ready())); const before = structuredClone(s), caseId = 'record-handover';
    s = cast(s, { type: 'SYNTHESIS', caseId }, 1);
    expect(attempt(s).synthesis).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'ACTIVE', remainingSeconds: 20, conditionVersion: 1 });
    expect(attempt(s).models[0]).toMatchObject({ version: 1, basis: 'TWO_READ_SHEETS', state: 'ACTIVE', checkedAt: null });
    expect(attempt(s).models[0]!.hypothesis).toContain('仍待当面核验'); expect(attempt(s).handoverVerified).toBe(false); expect(attempt(s).handoverFinding).toBeNull();
    expect(mastery(s)).toEqual([0, 0]); expect(s.spirituality).toBe(before.spirituality - 5); expect(oldRecords(s)).toEqual(oldRecords(before));
    const e = s.wisdomAngel.life.journal.at(-1)!;
    expect(e.source).toMatchObject({ caseId, version: 1, at: before.wisdomAngel.life.clockSeconds, ownerConsentWeek: s.week, paperIds: ['WA2-SHEET-1', 'WA2-SHEET-2'], deviceId: null, observedDemonstrationIds: [], observedFilter: null, prediction: null });
    expect(e.check).toMatchObject({ ability: 'knowledge', difficulty: 20, roll: 1 }); expect(e.randomAfter).toBe(e.randomBefore! + 1);
    rejectWa(s, { type: 'SYNTHESIS', caseId }); s = wa(s, { type: 'VERIFY_HANDOVER', caseId });
    expect(attempt(s)).toMatchObject({ handoverVerified: true, synthesis: { effects: 1, state: 'APPLIED', remainingSeconds: 0 } });
    expect(attempt(s).handoverFinding).toContain('未据此判定任何人有罪'); expect(mastery(s)).toEqual([0, 0]);
    s = report(close(s)); expect(mastery(s)).toEqual([8, 0]); expect(s.progression.acting).toBe(25);
    expect(attempt(s)).toMatchObject({ playerTravelMetres: 8, maraTravelMetres: 8, papersReturned: true, exited: true, result: 'ABILITY' });
    rejectWa(s, { type: 'REPORT', caseId }); rejectWa(s, { type: 'PREPARE', caseId, method: 'ABILITY' });
  });

  it('pays for a failed synthesis without reroll, truth disclosure, mastery or blocking ordinary comparison', () => {
    let s = enter(begin(ready())); const before = structuredClone(s), caseId = 'record-handover';
    s = cast(s, { type: 'SYNTHESIS', caseId }, 100);
    expect(attempt(s).synthesis).toMatchObject({ attempts: 1, successes: 0, effects: 0, tier: 'GREAT_FAILURE', state: 'FAILED', remainingSeconds: 0 });
    expect(attempt(s).handoverFinding).toBeNull(); rejectWa(s, { type: 'SYNTHESIS', caseId }); rejectWa(s, { type: 'VERIFY_HANDOVER', caseId });
    s = wa(s, { type: 'MANUAL_COMPARE', caseId }); s = wa(s, { type: 'VERIFY_HANDOVER', caseId }); s = report(close(s));
    expect(attempt(s).result).toBe('ORDINARY'); expect(s.spirituality).toBe(before.spirituality - 5); expect(mastery(s)).toEqual([0, 0]); expect(oldRecords(s)).toEqual(oldRecords(before));
  });

  it('requires an actually paid first demonstration before modelling the original device', () => {
    let s = enter(begin(ordinary(ready(), 'record-handover'), 'changed-condition'), 'changed-condition'); const caseId = 'changed-condition';
    rejectWa(s, { type: 'SYNTHESIS', caseId }); rejectWa(s, { type: 'FIRST_DEMONSTRATION', caseId });
    s = wa(s, { type: 'TAKE_DEVICE', caseId }); rejectWa(s, { type: 'FIRST_DEMONSTRATION', caseId });
    s = wa(s, { type: 'OBSERVE_CONDITION', caseId }); rejectWa(s, { type: 'SYNTHESIS', caseId });
    const before = structuredClone(s); s = wa(s, { type: 'FIRST_DEMONSTRATION', caseId });
    expect(s.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', charges: 1, demonstrations: 1, conditionVersion: 1 });
    expect(attempt(s, caseId).demonstrations).toEqual([{ id: 'WA2-DEMO-1', version: 1, filter: 'CLEAR', at: before.wisdomAngel.life.clockSeconds + 3, result: 'WHITE', chargeBefore: 2, chargeAfter: 1 }]);
    expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random); rejectWa(s, { type: 'FIRST_DEMONSTRATION', caseId });
  });

  it('physically changes the real filter once, preserves old evidence and invalidates rather than silently revises the old model', () => {
    let s = cast(deviceReady(), { type: 'SYNTHESIS', caseId: 'changed-condition' }, 1); const caseId = 'changed-condition';
    s = wa(s, { type: 'PREDICT', caseId, prediction: 'WHITE' }); const before = structuredClone(s);
    s = wa(s, { type: 'SWITCH_FILTER', caseId });
    expect(s.wisdomAngel.life.device).toMatchObject({ charges: 1, demonstrations: 1, filter: 'AMBER', conditionVersion: 2, filterChanges: 1 });
    expect(attempt(s, caseId).synthesis).toMatchObject({ successes: 1, effects: 0, state: 'INVALIDATED', remainingSeconds: 0, conditionVersion: 1 });
    expect(attempt(s, caseId).models[0]).toEqual({ ...attempt(before, caseId).models[0], state: 'INVALIDATED' });
    expect(attempt(s, caseId).demonstrations).toEqual(attempt(before, caseId).demonstrations); expect(attempt(s, caseId).predictions).toEqual(attempt(before, caseId).predictions);
    expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 2); expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random);
    expect(projectWisdomAngelLife(s).device.filter).toBeNull();
    for (const type of ['SWITCH_FILTER', 'SYNTHESIS', 'RESPONSE', 'SECOND_DEMONSTRATION'] as const) rejectWa(s, { type, caseId });
    s = wa(s, { type: 'OBSERVE_CONDITION', caseId }); expect(projectWisdomAngelLife(s).device.filter).toBe('AMBER');
    s = cast(s, { type: 'SYNTHESIS', caseId }, 1);
    expect(attempt(s, caseId).synthesis).toMatchObject({ attempts: 2, successes: 2, effects: 0, state: 'ACTIVE', conditionVersion: 2 });
    expect(attempt(s, caseId).models.map(m => [m.version, m.state])).toEqual([[1, 'INVALIDATED'], [2, 'ACTIVE']]);
    expect(s.wisdomAngel.life.journal.at(-1)!.source).toMatchObject({ version: 2, observedFilter: 'AMBER', observedDemonstrationIds: ['WA2-DEMO-1'], deviceId: 'WA2-DEVICE' });
  });

  it.each(['WHITE', 'AMBER'] as const)('keeps a %s prediction as a hypothesis and requires the actual second charge plus later result verification', prediction => {
    let s = deviceReady(); const caseId = 'changed-condition';
    s = wa(s, { type: 'PREDICT', caseId, prediction: 'WHITE' }); s = wa(s, { type: 'SWITCH_FILTER', caseId }); s = wa(s, { type: 'OBSERVE_CONDITION', caseId });
    s = wa(s, { type: 'PREDICT', caseId, prediction }); s = cast(s, { type: 'SYNTHESIS', caseId }, 1); s = cast(s, { type: 'RESPONSE', caseId }, 1);
    const before = structuredClone(s); expect(attempt(s, caseId).resultVerified).toBe(false); expect(attempt(s, caseId).predictionMatched).toBeNull(); expect(mastery(s)).toEqual([0, 0]);
    rejectWa(s, { type: 'VERIFY_RESULT', caseId }); s = wa(s, { type: 'SECOND_DEMONSTRATION', caseId });
    expect(s.wisdomAngel.life.device).toMatchObject({ charges: 0, demonstrations: 2 }); expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 3);
    expect(attempt(s, caseId).demonstrations.at(-1)).toMatchObject({ id: 'WA2-DEMO-2', version: 2, filter: 'AMBER', result: 'AMBER', chargeBefore: 1, chargeAfter: 0 });
    expect(attempt(s, caseId).response.effects).toBe(prediction === 'AMBER' ? 1 : 0); expect(attempt(s, caseId).synthesis.effects).toBe(0); expect(attempt(s, caseId).predictionMatched).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random);
    for (const type of ['FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION', 'RESPONSE'] as const) rejectWa(s, { type, caseId });
    s = wa(s, { type: 'VERIFY_RESULT', caseId }); expect(attempt(s, caseId).predictionMatched).toBe(prediction === 'AMBER');
    expect(attempt(s, caseId).predictions.map(p => [p.version, p.prediction])).toEqual([[1, 'WHITE'], [2, prediction]]);
    expect(attempt(s, caseId).synthesis.effects).toBe(prediction === 'AMBER' ? 1 : 0); expect(mastery(s)).toEqual([0, 0]);
    s = report(close(s, caseId), caseId); expect(mastery(s)).toEqual(prediction === 'AMBER' ? [8, 8] : [0, 0]);
    expect(s.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', location: 'TABLE', charges: 0 });
  });

  it('a stale original prediction remains recorded but never applies to changed conditions', () => {
    let s = deviceReady(); const caseId = 'changed-condition';
    s = wa(s, { type: 'PREDICT', caseId, prediction: 'WHITE' }); s = wa(s, { type: 'SWITCH_FILTER', caseId }); s = wa(s, { type: 'OBSERVE_CONDITION', caseId });
    rejectWa(s, { type: 'RESPONSE', caseId }); s = wa(s, { type: 'SECOND_DEMONSTRATION', caseId }); s = wa(s, { type: 'VERIFY_RESULT', caseId });
    expect(attempt(s, caseId)).toMatchObject({ predictionMatched: false, resultVerified: true }); expect(attempt(s, caseId).predictions).toHaveLength(1);
    s = report(close(s, caseId), caseId); expect(mastery(s)).toEqual([0, 0]); expect(s.wisdomAngel.life.device.charges).toBe(0);
  });

  it('failed response still costs6S and cannot reroll, refund or recharge the original demonstration', () => {
    let s = responseReady(); const before = structuredClone(s), caseId = 'changed-condition';
    s = cast(s, { type: 'RESPONSE', caseId }, 100);
    expect(attempt(s, caseId).response).toMatchObject({ attempts: 1, successes: 0, effects: 0, state: 'FAILED', remainingSeconds: 0 });
    expect(s.spirituality).toBe(before.spirituality - 6); rejectWa(s, { type: 'RESPONSE', caseId });
    s = wa(s, { type: 'SECOND_DEMONSTRATION', caseId }); s = wa(s, { type: 'VERIFY_RESULT', caseId }); s = report(close(s, caseId), caseId);
    expect(attempt(s, caseId).predictionMatched).toBe(true); expect(s.wisdomAngel.life.device.charges).toBe(0); expect(mastery(s)).toEqual([0, 0]);
  });

  it.each(['WAIT_20', 'STOP_METHOD'] as const)('a successful-unused response followed by %s earns no application or mastery', type => {
    let s = cast(responseReady(), { type: 'RESPONSE', caseId: 'changed-condition' }, 1); const before = structuredClone(s), caseId = 'changed-condition';
    s = wa(s, { type, caseId });
    expect(attempt(s, caseId).response).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: type === 'WAIT_20' ? 'EXPIRED' : 'STOPPED', remainingSeconds: 0 });
    expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + (type === 'WAIT_20' ? 20 : 0));
    expect(s.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device); expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random);
    s = wa(s, { type: 'SECOND_DEMONSTRATION', caseId }); s = wa(s, { type: 'VERIFY_RESULT', caseId }); s = report(close(s, caseId), caseId); expect(mastery(s)).toEqual([0, 0]);
  });

  it('current withdrawal stops a successful-unused synthesis immediately at zero AP and preserves required physical cleanup', () => {
    let s = cast(withdrawalReady(), { type: 'SYNTHESIS', caseId: 'withdrawn-consent' }, 1); const caseId = 'withdrawn-consent';
    s.actionsRemaining = 0; s.spirituality = 0; assertValidSliceState(s); const before = structuredClone(s);
    s = wa(s, { type: 'WITHDRAW_CONSENT', caseId });
    expect(attempt(s, caseId)).toMatchObject({ ownerConsent: 'REVOKED', synthesis: { attempts: 1, successes: 1, effects: 0, state: 'STOPPED' } });
    expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds); expect(s.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers);
    expect(s.wisdomAngel.life.device).toEqual(before.wisdomAngel.life.device); expect(s.wisdomAngel.life.mara).toEqual(before.wisdomAngel.life.mara);
    for (const type of ['SYNTHESIS', 'MANUAL_COMPARE', 'OBSERVE_CONDITION', 'CONSENT_OWNER', 'WITHDRAW_CONSENT', 'WAIT_20', 'EXIT_ROOM', 'CLOSE'] as const) rejectWa(s, { type, caseId });
    s = wa(s, { type: 'RETURN_PAPERS', caseId }); expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 2); rejectWa(s, { type: 'EXIT_ROOM', caseId });
    s = wa(s, { type: 'RETURN_DEVICE', caseId }); expect(s.wisdomAngel.life.device).toMatchObject({ id: 'WA2-DEVICE', owner: 'WA2-MARA', location: 'TABLE', charges: 0 });
    s = wa(s, { type: 'EXIT_ROOM', caseId });
    expect(s.wisdomAngel.life.clockSeconds).toBe(before.wisdomAngel.life.clockSeconds + 7); expect(attempt(s, caseId)).toMatchObject({ playerTravelMetres: 8, maraTravelMetres: 8, papersReturned: true, deviceReturned: true, exited: true });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(s.random).toEqual(before.random); expect(mastery(s)).toEqual([0, 0]);
    s = report(close(unitBudget(s), caseId), caseId); expect(mastery(s)).toEqual([0, 0]); expect(attempt(s, caseId).result).toBe('ORDINARY');
  });

  it('ordinary play completes every actual demonstration, return and report without needing success or spirituality', () => {
    const before = ready(); let s = structuredClone(before); s.spirituality = 0;
    for (const id of WISDOM_ANGEL_CASE_IDS) s = ordinary(s, id);
    expect(s.progression.acting).toBe(75); s = wa(unitBudget(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(mastery(s)).toEqual([0, 0]); expect(s.spirituality).toBe(0); expect(oldRecords(s)).toEqual(oldRecords(before));
    expect(s.wisdomAngel.life).toMatchObject({ reflected: true, activeCase: null, playerLocation: 'EXIT', playerTravelMetres: 24, mara: { location: 'EXIT', travelMetres: 24 }, device: { location: 'TABLE', charges: 0, demonstrations: 2, conditionVersion: 2 } });
    expect(s.wisdomAngel.life.papers.every(p => p.location === 'TABLE')).toBe(true); expect(hasWisdomAngelLifeLock(s)).toBe(false);
    expect(Object.values(s.wisdomAngel.life.cases).every(c => c.status === 'RESOLVED' && c.closes === 1 && c.attempts.length === 1)).toBe(true);
    rejectWa(s, { type: 'REFLECT' });
  });

  it('insufficient resources reject before charging or drawing and still leave the ordinary route open', () => {
    let s = enter(begin(ready())); s.spirituality = 4; rejectWa(s, { type: 'SYNTHESIS', caseId: 'record-handover' });
    s = wa(s, { type: 'MANUAL_COMPARE', caseId: 'record-handover' }); s = wa(s, { type: 'VERIFY_HANDOVER', caseId: 'record-handover' }); s = close(s);
    expect(s.spirituality).toBe(4); expect(attempt(s).spiritualitySpent).toBe(0);
    let response = responseReady(); response.spirituality = 5; rejectWa(response, { type: 'RESPONSE', caseId: 'changed-condition' });
    response = wa(response, { type: 'SECOND_DEMONSTRATION', caseId: 'changed-condition' }); expect(response.spirituality).toBe(5);
  });

  it('locks ordinary week actions, inherited craft and old scenes while originals are held', () => {
    const s = enter(begin(ready())), before = structuredClone(s); expect(hasWisdomAngelLifeLock(s)).toBe(true);
    for (const payload of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' }, { type: 'INSIGHT_SCHOLAR', command: { type: 'OBSERVE', caseId: 'copy-discrepancy' } }, { type: 'WISDOM_ANGEL', command: { type: 'MAKE_INHERITED_FLASH' } }, { type: 'WISDOM_ANGEL', command: { type: 'ENCOUNTER_TALK' } }]) {
      expect(() => applySliceIntent(s, payload as SliceIntent)).toThrow(); expect(s).toEqual(before);
    }
  });

  it('detaches projections and distinguishes attempts, successes, actual applications and reported mastery', () => {
    const s = cast(enter(begin(ready())), { type: 'SYNTHESIS', caseId: 'record-handover' }, 1), before = structuredClone(s);
    const publicState = projectSliceState(s), view = projectWisdomAngelLife(s);
    expect(publicState.wisdomAngel.resources).toMatchObject({ health: s.health, mind: s.mind, spirituality: s.spirituality, maxSpirituality: 120 });
    expect(view.currentAttempt!.synthesis).toMatchObject({ attempts: 1, successes: 1, effects: 0 });
    expect(view.story).toContain('未作原著证实'); expect(view.story).toContain('完整配方与原著仪式未知'); expect(view.story).toContain('每案每项新能力仅实际应用后+8');
    view.papers[0]!.text = 'forged'; view.device.charges = 50; view.mara.location = 'EXIT'; view.currentAttempt!.synthesis.effects = 1; view.cases[0]!.attempts[0]!.models[0]!.hypothesis = 'truth button';
    expect(s).toEqual(before);
  });

  it.each([{}, { type: 'TELEPORT', caseId: 'record-handover' }, { type: 'ENTER_ROOM', caseId: 'record-handover', ignoreConsent: true }, { type: 'PREPARE', caseId: 'record-handover', method: 'OMNISCIENT' }, { type: 'PREDICT', caseId: 'record-handover', prediction: 'WHITE' }, { type: 'PREDICT', caseId: 'changed-condition', prediction: 'TRUE' }, { type: 'REFLECT', caseId: 'record-handover' }])
    ('rejects nonexact life command%# without mutating input or RNG', command => {
      expect(validateWisdomAngelActivityCommand(command)).toBe(false); rejectWa(ready(), command);
    });

  it('rejects forged physical identities, sheets, stored charges, versions, consent, movement, time and unearned effects', () => {
    const s = cast(responseReady(), { type: 'RESPONSE', caseId: 'changed-condition' }, 1), id = 'changed-condition';
    expectInvalid(s, [
      t => { (t.wisdomAngel.life.mara as unknown as { age: number }).age = 17; },
      t => { (t.wisdomAngel.life.room as unknown as { pathMetres: number }).pathMetres = 0; },
      t => { t.wisdomAngel.life.papers[0].text = 'a free unseen answer'; },
      t => { t.wisdomAngel.life.papers[1].id = t.wisdomAngel.life.papers[0].id; },
      t => { t.wisdomAngel.life.papers[0].firstReadWeek = null; },
      t => { t.wisdomAngel.life.device.charges++; }, t => { t.wisdomAngel.life.device.conditionVersion--; },
      t => { (t.wisdomAngel.life.device as unknown as { owner: string }).owner = 'PLAYER'; },
      t => { t.wisdomAngel.life.playerLocation = 'EXIT'; }, t => { t.wisdomAngel.life.clockSeconds++; },
      t => { attempt(t, id).playerTravelMetres++; }, t => { attempt(t, id).elapsedSeconds--; },
      t => { attempt(t, id).ownerConsentWeek!--; }, t => { attempt(t, id).observedVersions.pop(); },
      t => { attempt(t, id).demonstrations[0]!.chargeBefore = 3; }, t => { attempt(t, id).demonstrations[0]!.result = 'AMBER'; },
      t => { attempt(t, id).response.effects = 1; }, t => { attempt(t, id).response.remainingSeconds = 200; },
      t => { attempt(t, id).spiritualitySpent--; }, t => { t.progression.mastery[WISDOM_ANGEL_ABILITY_IDS[1]] = 8; },
    ]);
  });

  it('replays every recorded check and actual source and rejects missing, reordered, duplicated, backdated or forged history', () => {
    let s = cast(deviceReady(), { type: 'SYNTHESIS', caseId: 'changed-condition' }, 1), id = 'changed-condition';
    s = wa(s, { type: 'PREDICT', caseId: id, prediction: 'WHITE' }); s = wa(s, { type: 'SWITCH_FILTER', caseId: id }); s = wa(s, { type: 'OBSERVE_CONDITION', caseId: id });
    s = cast(s, { type: 'SYNTHESIS', caseId: id }, 100); s = wa(s, { type: 'PREDICT', caseId: id, prediction: 'AMBER' }); s = cast(s, { type: 'RESPONSE', caseId: id }, 1);
    const firstCheck = (t: SliceState) => t.wisdomAngel.life.journal.find(e => e.command.type === 'SYNTHESIS')!;
    expect(validateWisdomAngelLife(s)).toBe(true);
    expectInvalid(s, [
      t => { t.wisdomAngel.life.journal.pop(); }, t => { t.wisdomAngel.life.journal.push(structuredClone(t.wisdomAngel.life.journal.at(-1)!)); },
      t => { const j = t.wisdomAngel.life.journal; [j[0], j[1]] = [j[1]!, j[0]!]; },
      t => { firstCheck(t).week = t.wisdomAngel.promotionWeek! - 1; }, t => { firstCheck(t).tier = 'GREAT_FAILURE'; },
      t => { firstCheck(t).randomBefore = null; }, t => { firstCheck(t).randomAfter!++; },
      t => { firstCheck(t).check = null; }, t => { (firstCheck(t).check! as { roll: number }).roll = 100; },
      t => { (firstCheck(t).check! as { difficulty: number }).difficulty = 1; }, t => { firstCheck(t).source = null; },
      t => { firstCheck(t).source!.paperIds.reverse(); }, t => { firstCheck(t).source!.deviceId = 'IS3-BOX'; },
      t => { firstCheck(t).source!.observedDemonstrationIds.push('WA2-DEMO-2'); },
      t => { firstCheck(t).source!.observedFilter = 'AMBER'; }, t => { firstCheck(t).source!.version = 2; },
      t => { firstCheck(t).source!.at++; }, t => { firstCheck(t).source!.ownerConsentWeek!--; },
      t => { t.wisdomAngel.life.journal.at(-1)!.source!.prediction = 'WHITE'; },
      t => { t.wisdomAngel.life.journal[0]!.source = structuredClone(firstCheck(t).source); },
    ]);
  });

  it.each(['FIRST_DEMONSTRATION', 'SWITCH_FILTER', 'SECOND_DEMONSTRATION', 'VERIFY_RESULT', 'WITHDRAW_CONSENT'] as const)
    ('replays captured %s unchanged under the original seed, without assuming a successful ability outcome', type => {
      const captured = wisdomAngelBoundaryForIntent(intent => intent.type === 'WISDOM_ANGEL' && intent.command.type === type);
      const before = structuredClone(captured.beforeLast), result = applySliceIntent(before, captured.lastIntent);
      expect(result).toEqual(captured.final); expect(before).toEqual(captured.beforeLast); assertValidSliceState(result);
      expect(result.random.seed).toBe(before.random.seed); expect(oldRecords(result)).toEqual(oldRecords(before));
    });
});
