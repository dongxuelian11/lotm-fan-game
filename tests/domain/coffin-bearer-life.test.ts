import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createCoffinBearerState } from '../../src/domain/coffin-bearer/index.js';
import {
  advanceCoffinBearerClock, advanceCoffinBearerLifeClock, applyCoffinBearerActivity, blockCoffinBearerLife,
  COFFIN_BEARER_CASE_IDS, coffinBearerLifeActions, consumeCoffinBearerGuardSegment, createCoffinBearerLifeState,
  getCoffinBearerGuardSegment, hasCoffinBearerLifeLock, projectCoffinBearerLife,
  validateCoffinBearerActivityCommand, validateCoffinBearerLife, type CoffinBearerActivityCommand, type CoffinBearerCaseId,
} from '../../src/domain/coffin-bearer/life.js';

const ABILITY = 'mother.s3.finite-preservation';
/** Directed isolated fixtures. They do not prove natural promotion or a naturally successful check. */
function ready(): SliceState {
  const s = createSliceRun('coffin-bearer-life-directed', sliceDefaultCreationSelection, 'coffin-bearer-life-directed');
  s.coffinBearer = createCoffinBearerState(); s.week = 145; s.coffinBearer.promotionWeek = 144; s.coffinBearer.ancientAlchemistActingAtPromotion = 100;
  s.progression = { pathwayId: 'mother', sequence: 3, acting: 0, promotionWeek: 144, mastery: { [ABILITY]: 0, 'mother.s4.living-matrix': 16 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
const context = (s: SliceState, roll = 1): SeerContext => ({
  roll: vi.fn(() => { throw new Error('Original sample transfer never draws an event, luck or resistance roll.'); }), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
});
function act(s: SliceState, command: CoffinBearerActivityCommand, roll = 1) { const ctx = context(s, roll); applyCoffinBearerActivity(s, command, ctx); expect(validateCoffinBearerLife(s), command.type).toBe(true); return ctx; }
type PlainStep = Exclude<CoffinBearerActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'CONFIRM_LIMITED' | 'BUY_KIT' | 'PREPARE_GUARD'>;
function step(s: SliceState, caseId: CoffinBearerCaseId, type: PlainStep, roll = 1) { return act(s, { type, caseId } as CoffinBearerActivityCommand, roll); }
function reject(s: SliceState, command: CoffinBearerActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyCoffinBearerActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: CoffinBearerCaseId) => s.coffinBearer.life.cases[id].attempts[0]!;
const sample = (s: SliceState, id: CoffinBearerCaseId) => s.coffinBearer.life.samples.find(x => x.caseId === id)!;
function start(s: SliceState, id: CoffinBearerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (!s.coffinBearer.life.kit.purchased) act(s, { type: 'BUY_KIT' });
  step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE');
}
function approach(s: SliceState, id: CoffinBearerCaseId) {
  step(s, id, 'GO_A'); if (s.coffinBearer.life.box.holder === 'OWNER') step(s, id, 'TAKE_KIT'); step(s, id, 'CHECK_SAMPLE');
}
function cast(s: SliceState, id: CoffinBearerCaseId, roll = 1) { approach(s, id); return step(s, id, id === 'dry-record' || attempt(s, id).method === 'ORDINARY' ? 'ORDINARY_CHECK' : 'PERFORM', roll); }
function transfer(s: SliceState, id: CoffinBearerCaseId) {
  if (id === 'fresh-transfer' && !attempt(s, id).waitCompleted) step(s, id, 'WAIT_WINDOW');
  for (const type of ['TAKE_SAMPLE', 'CARRY_B', 'OFFER_SAMPLE'] as const) step(s, id, type);
  if (id === 'fresh-transfer') step(s, id, 'HAND_OVER');
  if (id === 'withdrawn-transfer' && !attempt(s, id).stopped) step(s, id, 'STOP_EFFECT');
  if (id === 'dry-record') act(s, { type: 'CONFIRM_LIMITED', caseId: id, claim: 'LIMITED' });
}
function finish(s: SliceState, id: CoffinBearerCaseId, report = true) {
  step(s, id, 'RETURN_A'); if (id !== 'fresh-transfer') step(s, id, 'RETURN_SAMPLE');
  for (const type of ['RETURN_KIT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE'] as const) step(s, id, type);
  if (report) step(s, id, 'REPORT_CASE');
}
function complete(s: SliceState, id: CoffinBearerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', roll = 1) { start(s, id, id === 'dry-record' ? 'ORDINARY' : method); cast(s, id, roll); transfer(s, id); finish(s, id); }
function firstTwo(s: SliceState) { complete(s, 'fresh-transfer', 'ORDINARY'); complete(s, 'withdrawn-transfer', 'ORDINARY'); }
function oldSources(s: SliceState) { return structuredClone({ cultivator: s.cultivator, physician: s.physician, harvestpriest: s.harvestpriest, biologist: s.biologist, druid: s.druid, ancientAlchemist: s.ancientAlchemist, character: s.character, world: s.world }); }

describe('Coffin Bearer directed finite vitality and original physical transfer', () => {
  it('creates distinct original living samples and an already dead original, with two independent adult caretakers', () => {
    const s = ready(), l = s.coffinBearer.life; expect(l).toEqual(createCoffinBearerLifeState()); expect(validateCoffinBearerLife(s)).toBe(true);
    expect(l.owner).toMatchObject({ id: 'CB3-ADA', age: 46, independentMind: true, location: 'A', health: 100, mind: 100 });
    expect(l.recipient).toMatchObject({ id: 'CB3-LENA', age: 39, independentMind: true, location: 'B', health: 100, mind: 100 });
    expect(l.samples.map(x => [x.id, x.originalAlive, x.vitality, x.holder, x.origin])).toEqual([
      ['CB3-LIVE-1', true, 50, 'OWNER', 'OWNER_GREENHOUSE'], ['CB3-LIVE-2', true, 50, 'OWNER', 'OWNER_GREENHOUSE'], ['CB3-DRY-1', false, 0, 'OWNER', 'OWNER_NATURALLY_WITHERED'],
    ]);
    expect(l.box).toMatchObject({ holder: 'SUPPLIER', location: 'SUPPLIER', capacity: 1, maximumMassGrams: 1000, sampleId: null });
    expect(l.paper.sampleIds).toEqual(['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1']);
    for (const text of ['原著直接依据', '原创G', '完整配方', '不治病', '复活']) expect(projectCoffinBearerLife(s).story).toContain(text);
    expect('luck' in l).toBe(false);
  });
  it('buys the one physical kit for1AP90p from its supplier and never fabricates replacements', () => {
    const s = ready(), before = oldSources(s); act(s, { type: 'BUY_KIT' }); const l = s.coffinBearer.life;
    expect([s.actionsRemaining, s.cash, s.spirituality, s.mind]).toEqual([99, 910, 120, 100]);
    expect(l.kit).toEqual({ sourceId: 'CB3-SUPPLIER', purchased: true, purchasedWeek: 145, actionsSpent: 1, costPence: 90 });
    expect(l.box).toMatchObject({ owner: 'PLAYER', holder: 'PLAYER', location: 'START' }); expect(l.tag).toMatchObject({ holder: 'PLAYER', location: 'START' });
    expect(l.pads.map(x => [x.id, x.status, x.holder, x.location])).toEqual([['CB3-PAD-1', 'UNUSED', 'PLAYER', 'START'], ['CB3-PAD-2', 'UNUSED', 'PLAYER', 'START'], ['CB3-PAD-3', 'UNUSED', 'PLAYER', 'START']]);
    reject(s, { type: 'BUY_KIT' }); expect(oldSources(s)).toEqual(before);
    const poor = ready(); poor.cash = 89; reject(poor, { type: 'BUY_KIT' });
  });
  it('requires actual procurement before preparation and reserves a separate implementation action', () => {
    const s = ready(); step(s, 'fresh-transfer', 'OBSERVE'); reject(s, { type: 'PREPARE', caseId: 'fresh-transfer', method: 'ABILITY' });
    act(s, { type: 'BUY_KIT' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'fresh-transfer', method: 'ABILITY' });
  });
  it('START locks the actual case without moving originals or presuming current consent', () => {
    const s = ready(); start(s, 'fresh-transfer'); expect(hasCoffinBearerLifeLock(s)).toBe(true); expect(s.actionsRemaining).toBe(97);
    expect(attempt(s, 'fresh-transfer')).toMatchObject({ steps: [], sampleChecked: false, resolutionPaid: false, ownerConsent: 'UNASKED', recipientConsent: 'UNASKED', abilityTier: null });
    expect(s.coffinBearer.life.playerLocation).toBe('START'); expect(sample(s, 'fresh-transfer')).toMatchObject({ holder: 'OWNER', location: 'A', care: 'OWNER_CARE', vitality: 50 });
    for (const type of ['PERFORM', 'TAKE_SAMPLE', 'CARRY_B', 'OFFER_SAMPLE', 'LEAVE_CASE', 'WITHDRAW'] as const) reject(s, { type, caseId: 'fresh-transfer' });
  });
  it('physically carries only the kit toA then personally reads the original paper and current owner consent', () => {
    const s = ready(); start(s, 'fresh-transfer'); approach(s, 'fresh-transfer'); const a = attempt(s, 'fresh-transfer'), l = s.coffinBearer.life;
    expect(a.playerMoves).toEqual([{ from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['CB3-CASE', 'CB3-TAG', 'CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3'] }]);
    expect(a).toMatchObject({ elapsedSeconds: 6, ownerConsent: 'GRANTED', recipientConsent: 'UNASKED', checkedAlive: true, checkedVitality: 50, ordinaryExposureSeconds: 0 });
    expect(l.paper).toMatchObject({ holder: 'OWNER', location: 'A', readings: 1, records: [] });
    expect(sample(s, 'fresh-transfer')).toMatchObject({ holder: 'OWNER', care: 'EXPOSED', vitality: 50 }); expect(sample(s, 'withdrawn-transfer').care).toBe('OWNER_CARE');
  });
  it('pays exactly5S2M and the same first original pad for one knowledge20 four-tier check', () => {
    const s = ready(); start(s, 'fresh-transfer'); const ctx = cast(s, 'fresh-transfer'), a = attempt(s, 'fresh-transfer');
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20); expect(ctx.roll).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([96, 115, 98]);
    expect(a).toMatchObject({ elapsedSeconds: 8, abilityTier: 'GREAT_SUCCESS', abilitySourceId: 'CB3-LIVE-1', abilityAtSecond: 8, resolutionAtSecond: 8, remainingSeconds: 60, effectActive: true, spiritualitySpent: 5, mindSpent: 2, padId: 'CB3-PAD-1', ordinaryExposureSeconds: 2 });
    expect(s.coffinBearer.life.pads[0]).toMatchObject({ status: 'SPENT', holder: 'PLAYER', location: 'A', caseId: 'fresh-transfer', spentWeek: 145 });
    expect(sample(s, 'fresh-transfer').vitality).toBe(50);
    reject(s, { type: 'PERFORM', caseId: 'fresh-transfer' }); reject(s, { type: 'ORDINARY_CHECK', caseId: 'fresh-transfer' });
  });
  it('waits60actual protected seconds once, loses3vitality, really expires, and never decays either other original sample', () => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer'); reject(s, { type: 'TAKE_SAMPLE', caseId: 'fresh-transfer' }); step(s, 'fresh-transfer', 'WAIT_WINDOW');
    expect(attempt(s, 'fresh-transfer')).toMatchObject({ elapsedSeconds: 68, protectedExposureSeconds: 60, ordinaryExposureSeconds: 2, vitalityLost: 3, waitedSeconds: 60, waitCompleted: true, effectActive: false, remainingSeconds: 0, effectExpired: true, ordinaryRemainderSeconds: 0 });
    expect(s.coffinBearer.life.samples.map(x => x.vitality)).toEqual([47, 50, 0]); reject(s, { type: 'WAIT_WINDOW', caseId: 'fresh-transfer' });
    transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer');
    expect(attempt(s, 'fresh-transfer')).toMatchObject({ elapsedSeconds: 86, playerTravelMetres: 16, protectedExposureSeconds: 60, ordinaryExposureSeconds: 9, vitalityLost: 3, handedOver: true, result: 'ABILITY' });
    expect(sample(s, 'fresh-transfer')).toMatchObject({ vitality: 47, alive: true, holder: 'RECIPIENT', location: 'B', care: 'RECIPIENT_CARE', handovers: 2, returns: 0 }); expect(s.progression.mastery[ABILITY]).toBe(8);
  });
  it.each([71, 100])('failed roll%s keeps every actual cost and loses ordinary vitality without rerolls or free protection', roll => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer', roll); const a = attempt(s, 'fresh-transfer');
    expect(a).toMatchObject({ effectActive: false, remainingSeconds: 0, spiritualitySpent: 5, mindSpent: 2, padId: 'CB3-PAD-1' });
    reject(s, { type: 'PERFORM', caseId: 'fresh-transfer' }); transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer');
    expect(a).toMatchObject({ result: 'ORDINARY', elapsedSeconds: 86, ordinaryExposureSeconds: 69, protectedExposureSeconds: 0, vitalityLost: 6 });
    expect(sample(s, 'fresh-transfer').vitality).toBe(44); expect(s.progression.mastery[ABILITY]).toBe(0); expect([s.spirituality, s.mind]).toEqual([115, 98]);
  });
  it('early stopping keeps cost and originals and cannot award mastery without any protected time', () => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer'); const objects = structuredClone(s.coffinBearer.life.samples); step(s, 'fresh-transfer', 'STOP_EFFECT');
    expect(s.coffinBearer.life.samples).toEqual(objects); expect(attempt(s, 'fresh-transfer')).toMatchObject({ stopped: true, effectCancelled: true, effectActive: false, remainingSeconds: 0 });
    reject(s, { type: 'STOP_EFFECT', caseId: 'fresh-transfer' }); transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer');
    expect(sample(s, 'fresh-transfer').vitality).toBe(44); expect(s.progression.mastery[ABILITY]).toBe(0); expect([s.spirituality, s.mind]).toEqual([115, 98]);
  });
  it('requires actual single-capacity pickup, carrying, offer and current permission before the original handover', () => {
    const s = ready(); start(s, 'fresh-transfer', 'ORDINARY'); cast(s, 'fresh-transfer'); step(s, 'fresh-transfer', 'WAIT_WINDOW');
    for (const type of ['CARRY_B', 'OFFER_SAMPLE', 'HAND_OVER', 'RETURN_KIT', 'LEAVE_CASE'] as const) reject(s, { type, caseId: 'fresh-transfer' });
    step(s, 'fresh-transfer', 'TAKE_SAMPLE'); expect(s.coffinBearer.life.box.sampleId).toBe('CB3-LIVE-1'); expect(sample(s, 'fresh-transfer').holder).toBe('CASE');
    reject(s, { type: 'TAKE_SAMPLE', caseId: 'fresh-transfer' }); step(s, 'fresh-transfer', 'CARRY_B');
    expect(attempt(s, 'fresh-transfer').playerMoves.at(-1)?.itemIds).toEqual(['CB3-CASE', 'CB3-TAG', 'CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3', 'CB3-LIVE-1']);
    expect(s.coffinBearer.life.owner.location).toBe('A'); expect(s.coffinBearer.life.paper.location).toBe('A'); reject(s, { type: 'HAND_OVER', caseId: 'fresh-transfer' });
    step(s, 'fresh-transfer', 'OFFER_SAMPLE'); step(s, 'fresh-transfer', 'HAND_OVER'); expect(s.coffinBearer.life.box).toMatchObject({ sampleId: null, holder: 'PLAYER', location: 'B' });
    const fixed = structuredClone(sample(s, 'fresh-transfer')); finish(s, 'fresh-transfer'); expect(sample(s, 'fresh-transfer')).toEqual(fixed);
  });
  it('returns every original kit piece toA and requires physical retrieval there for the next case', () => {
    const s = ready(); complete(s, 'fresh-transfer'); const l = s.coffinBearer.life;
    expect(l.box).toMatchObject({ holder: 'OWNER', location: 'A', returns: 1 }); expect(l.tag).toMatchObject({ holder: 'OWNER', location: 'A', returns: 1 }); expect(l.pads.every(p => p.holder === 'OWNER' && p.location === 'A')).toBe(true);
    start(s, 'withdrawn-transfer'); expect(l.recipient.consent).toBe('UNASKED'); step(s, 'withdrawn-transfer', 'GO_A'); expect(attempt(s, 'withdrawn-transfer').playerMoves[0]?.itemIds).toEqual([]);
    reject(s, { type: 'CHECK_SAMPLE', caseId: 'withdrawn-transfer' }); step(s, 'withdrawn-transfer', 'TAKE_KIT'); step(s, 'withdrawn-transfer', 'CHECK_SAMPLE');
    expect(attempt(s, 'withdrawn-transfer')).toMatchObject({ elapsedSeconds: 7, sampleId: 'CB3-LIVE-2', checkedVitality: 50, recipientConsent: 'UNASKED' }); expect(l.pads[0]?.status).toBe('SPENT');
  });
  it.each([1, 100])('current withdrawal after roll%s requires STOP before personally returning the same second original', roll => {
    const s = ready(); complete(s, 'fresh-transfer', 'ORDINARY'); start(s, 'withdrawn-transfer'); cast(s, 'withdrawn-transfer', roll);
    for (const type of ['TAKE_SAMPLE', 'CARRY_B', 'OFFER_SAMPLE'] as const) step(s, 'withdrawn-transfer', type);
    const a = attempt(s, 'withdrawn-transfer'); expect(a).toMatchObject({ recipientConsent: 'REVOKED', consentWithdrawn: true, elapsedSeconds: 15, spiritualitySpent: 5, mindSpent: 2 });
    for (const type of ['RETURN_A', 'RETURN_SAMPLE', 'RETURN_KIT', 'HAND_OVER'] as const) reject(s, { type, caseId: 'withdrawn-transfer' });
    step(s, 'withdrawn-transfer', 'STOP_EFFECT'); expect(a.remainingSeconds).toBe(0); finish(s, 'withdrawn-transfer');
    expect(a).toMatchObject({ elapsedSeconds: 27, result: 'ORDINARY', sampleReturned: true, handedOver: false });
    expect(sample(s, 'withdrawn-transfer')).toMatchObject({ holder: 'OWNER', location: 'A', care: 'OWNER_CARE', handovers: 2, returns: 1, vitality: roll === 1 ? 50 : 49 });
    expect(a.playerMoves[2]?.itemIds).toContain('CB3-LIVE-2'); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('ordinary withdrawal does not erase already accumulated ordinary decay by using STOP', () => {
    const s = ready(); complete(s, 'fresh-transfer', 'ORDINARY'); complete(s, 'withdrawn-transfer', 'ORDINARY');
    expect(attempt(s, 'withdrawn-transfer')).toMatchObject({ ordinaryExposureSeconds: 13, ordinaryRemainderSeconds: 3, protectedExposureSeconds: 0, vitalityLost: 1, stopped: true });
    expect(sample(s, 'withdrawn-transfer').vitality).toBe(49); expect(s.coffinBearer.life.pads.every(p => p.status === 'UNUSED')).toBe(true);
  });
  it('rejects any PERFORM on the original dead sample without mutating state or paying, even under an ability preparation', () => {
    const s = ready(); firstTwo(s); start(s, 'dry-record', 'ABILITY'); approach(s, 'dry-record'); reject(s, { type: 'PERFORM', caseId: 'dry-record' });
    const ctx = step(s, 'dry-record', 'ORDINARY_CHECK'); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); transfer(s, 'dry-record'); finish(s, 'dry-record');
    expect(sample(s, 'dry-record')).toMatchObject({ originalAlive: false, originalVitality: 0, alive: false, vitality: 0, holder: 'OWNER', location: 'A' });
    expect(attempt(s, 'dry-record')).toMatchObject({ abilityCheck: null, abilityTier: null, padId: null, protectedExposureSeconds: 0, ordinaryExposureSeconds: 0, spiritualitySpent: 0, mindSpent: 0, result: 'ORDINARY' });
  });
  it('refuses a revival claim without changing original life, source paper, recipients or charging another implementation', () => {
    const s = ready(); firstTwo(s); start(s, 'dry-record', 'ORDINARY'); cast(s, 'dry-record');
    for (const type of ['TAKE_SAMPLE', 'CARRY_B', 'OFFER_SAMPLE'] as const) step(s, 'dry-record', type);
    const paper = structuredClone(s.coffinBearer.life.paper), originals = structuredClone(s.coffinBearer.life.samples), ap = s.actionsRemaining;
    reject(s, { type: 'RETURN_A', caseId: 'dry-record' }); const ctx = act(s, { type: 'CONFIRM_LIMITED', caseId: 'dry-record', claim: 'REVIVE' });
    expect(ctx.check).not.toHaveBeenCalled(); expect(s.actionsRemaining).toBe(ap); expect(s.coffinBearer.life.paper).toEqual(paper); expect(s.coffinBearer.life.samples).toEqual(originals);
    expect(attempt(s, 'dry-record')).toMatchObject({ rejectedClaims: 1, limitedConfirmed: false }); reject(s, { type: 'RETURN_A', caseId: 'dry-record' });
    act(s, { type: 'CONFIRM_LIMITED', caseId: 'dry-record', claim: 'LIMITED' }); finish(s, 'dry-record');
  });
  it('finishes three ordinary cases and reflection for14AP including the90p kit,140seconds and48actual metres', () => {
    const s = ready(), before = oldSources(s); for (const id of COFFIN_BEARER_CASE_IDS) complete(s, id, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.cash, s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([86, 910, 120, 100, 100, 0]);
    expect(s.coffinBearer.life).toMatchObject({ clockSeconds: 140, externalSeconds: 0, playerTravelMetres: 48, reflected: true, playerLocation: 'START', activeCase: null }); expect(hasCoffinBearerLifeLock(s)).toBe(false);
    expect(s.coffinBearer.life.samples.map(x => x.vitality)).toEqual([44, 49, 0]); expect(s.coffinBearer.life.paper.records).toHaveLength(3); expect(s.coffinBearer.life.box.returns).toBe(3);
    expect(s.coffinBearer.life.pads.every(p => p.status === 'UNUSED' && p.holder === 'OWNER' && p.location === 'A')).toBe(true); expect(oldSources(s)).toEqual(before);
  });
  it('successful living checks consume exactly2of3 original pads but only the real first delivery gives8mastery', () => {
    const s = ready(), before = oldSources(s); for (const id of COFFIN_BEARER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([86, 110, 96, 100, 8]);
    expect(s.coffinBearer.life.samples.map(x => x.vitality)).toEqual([47, 50, 0]); expect(s.coffinBearer.life.pads.map(p => [p.id, p.status, p.caseId])).toEqual([['CB3-PAD-1', 'SPENT', 'fresh-transfer'], ['CB3-PAD-2', 'SPENT', 'withdrawn-transfer'], ['CB3-PAD-3', 'UNUSED', null]]);
    expect(s.coffinBearer.life.clockSeconds).toBe(140); expect(s.progression.mastery['mother.s4.living-matrix']).toBe(16); expect(oldSources(s)).toEqual(before);
  });
  it('keeps all paid transfers and actual cleanup available at0AP0S0M while report still needs its own1AP', () => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer', 100); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer', false); expect(hasCoffinBearerLifeLock(s)).toBe(false); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'REPORT_CASE', caseId: 'fresh-transfer' });
  });
  it('offers one unpaid ordinary alternative when spell resources are insufficient, with no check or material consumption', () => {
    const s = ready(); start(s, 'fresh-transfer'); approach(s, 'fresh-transfer'); s.spirituality = 4; s.mind = 1; reject(s, { type: 'PERFORM', caseId: 'fresh-transfer' });
    const ctx = step(s, 'fresh-transfer', 'ORDINARY_CHECK'); expect(ctx.check).not.toHaveBeenCalled(); expect(s.coffinBearer.life.pads.every(p => p.status === 'UNUSED')).toBe(true); transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer');
    expect([s.spirituality, s.mind, s.progression.mastery[ABILITY]]).toEqual([4, 1, 0]);
  });
  it('withdraws only an unstarted preparation, never reopens reports, and rejects dead-player actions', () => {
    const s = ready(); act(s, { type: 'BUY_KIT' }); step(s, 'fresh-transfer', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'fresh-transfer', method: 'ABILITY' }); step(s, 'fresh-transfer', 'WITHDRAW');
    expect(s.actionsRemaining).toBe(97); expect(s.coffinBearer.life.cases['fresh-transfer'].withdrawals).toBe(1); expect(hasCoffinBearerLifeLock(s)).toBe(false);
    reject(s, { type: 'OBSERVE', caseId: 'withdrawn-transfer' }); act(s, { type: 'PREPARE', caseId: 'fresh-transfer', method: 'ORDINARY' }); step(s, 'fresh-transfer', 'START_CASE'); cast(s, 'fresh-transfer'); transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer');
    reject(s, { type: 'START_CASE', caseId: 'fresh-transfer' }); reject(s, { type: 'REPORT_CASE', caseId: 'fresh-transfer' }); s.status = 'DEAD'; s.health = 0; reject(s, { type: 'OBSERVE', caseId: 'withdrawn-transfer' }); reject(s, { type: 'PREPARE_GUARD' });
  });
  it('makes exactly one new120p4S three-segment guard and consumes original segments in order without modifying the old guard', () => {
    const s = ready(), before = oldSources(s); expect(getCoffinBearerGuardSegment(s)).toBeNull(); act(s, { type: 'PREPARE_GUARD' });
    expect([s.actionsRemaining, s.cash, s.spirituality]).toEqual([99, 880, 116]); expect(s.coffinBearer.life.guard).toMatchObject({ id: 'CB3-GUARD', sourceId: 'CB3-GUARD-MATERIAL', prepared: true, owner: 'PLAYER', location: 'HAND', preparedWeek: 145, actionsSpent: 1, costPence: 120, spiritualitySpent: 4 });
    reject(s, { type: 'PREPARE_GUARD' }); expect(getCoffinBearerGuardSegment(s)).toEqual({ guardId: 'CB3-GUARD', segmentId: 'CB3-SEG1' });
    expect(consumeCoffinBearerGuardSegment(s, 'CB3-GUARD', 'CB3-SEG2')).toBe(false); expect(consumeCoffinBearerGuardSegment(s, 'AA4-GUARD-1', 'CB3-SEG1')).toBe(false);
    for (const id of ['CB3-SEG1', 'CB3-SEG2', 'CB3-SEG3']) { expect(consumeCoffinBearerGuardSegment(s, 'CB3-GUARD', id)).toBe(true); expect(consumeCoffinBearerGuardSegment(s, 'CB3-GUARD', id)).toBe(false); }
    expect(getCoffinBearerGuardSegment(s)).toBeNull(); expect(s.coffinBearer.life.guard.segments.every(p => p.status === 'SPENT')).toBe(true); expect(oldSources(s)).toEqual(before);
    expect(validateCoffinBearerLife(s)).toBe(false); // These direct material spends deliberately have no combat evidence.
  });
  it('projects cloned original bodies, exact current consent, actual finite time and only validated typed commands', () => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer'); const p = projectCoffinBearerLife(s);
    expect(p.currentAttempt).toMatchObject({ effectActive: true, remainingSeconds: 60, ownerConsent: 'GRANTED', recipientConsent: 'UNASKED' }); expect(p.facts.join(' ')).toContain('剩余60秒');
    for (const action of coffinBearerLifeActions(s)) { expect(validateCoffinBearerActivityCommand(action.command)).toBe(true); expect(action.enabled).toBe(blockCoffinBearerLife(s, action.command) === null); }
    p.samples[0]!.vitality = 100; p.box.sampleId = 'CB3-DRY-1'; expect(sample(s, 'fresh-transfer').vitality).toBe(50); expect(s.coffinBearer.life.box.sampleId).toBeNull();
  });
  it('rejects supplied rolls, altered amounts, invented recipients, extra fields, luck and wrong-case shortcuts', () => {
    for (const bad of [{ type: 'PERFORM', caseId: 'fresh-transfer', roll: 1 }, { type: 'BUY_KIT', price: 0 }, { type: 'TAKE_SAMPLE', caseId: 'fresh-transfer', sampleId: 'CB3-DRY-1' }, { type: 'HAND_OVER', caseId: 'withdrawn-transfer' }, { type: 'WAIT_WINDOW', caseId: 'dry-record' }, { type: 'RETURN_SAMPLE', caseId: 'fresh-transfer' }, { type: 'CONFIRM_LIMITED', caseId: 'fresh-transfer', claim: 'LIMITED' }, { type: 'REFLECT', caseId: 'dry-record' }, { type: 'PREPARE_GUARD', kitId: 'AA4-GUARD-1' }, { type: 'ACCUMULATE' }, { type: 'REVIVE', caseId: 'dry-record' }]) expect(validateCoffinBearerActivityCommand(bad)).toBe(false);
  });
  it('strictly rejects forged samples, ownership, capacity, consent, paid sources, clocks, movement, repeated steps and mastery', () => {
    const s = ready(); for (const id of COFFIN_BEARER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    const changes: ((v: SliceState) => void)[] = [
      v => { sample(v, 'fresh-transfer').vitality++; }, v => { sample(v, 'fresh-transfer').holder = 'OWNER'; }, v => { sample(v, 'fresh-transfer').care = 'EXPOSED'; }, v => { sample(v, 'fresh-transfer').location = 'A'; }, v => { sample(v, 'fresh-transfer').handovers--; },
      v => { sample(v, 'withdrawn-transfer').id = 'CB3-LIVE-1'; }, v => { sample(v, 'withdrawn-transfer').returns = 0; }, v => { sample(v, 'dry-record').alive = true; }, v => { sample(v, 'dry-record').vitality = 1; }, v => { sample(v, 'dry-record').origin = 'OWNER_GREENHOUSE'; },
      v => { v.coffinBearer.life.box.capacity = 2 as 1; }, v => { v.coffinBearer.life.box.maximumMassGrams = 1001 as 1000; }, v => { v.coffinBearer.life.box.sampleId = 'CB3-LIVE-1'; }, v => { v.coffinBearer.life.box.holder = 'PLAYER'; }, v => { v.coffinBearer.life.box.returns--; },
      v => { v.coffinBearer.life.tag.location = 'START'; }, v => { v.coffinBearer.life.tag.returns--; }, v => { v.coffinBearer.life.paper.text = '原枯样已复活'; }, v => { v.coffinBearer.life.paper.sampleIds.reverse(); }, v => { v.coffinBearer.life.paper.readings--; }, v => { v.coffinBearer.life.paper.records[0] = '100活性'; },
      v => { v.coffinBearer.life.kit.costPence = 0; }, v => { v.coffinBearer.life.kit.actionsSpent = 0; }, v => { v.coffinBearer.life.pads[0]!.status = 'UNUSED'; }, v => { v.coffinBearer.life.pads[0]!.caseId = 'withdrawn-transfer'; }, v => { v.coffinBearer.life.pads[0]!.holder = 'PLAYER'; }, v => { v.coffinBearer.life.pads.push(structuredClone(v.coffinBearer.life.pads[2]!)); },
      v => { v.coffinBearer.life.owner.health = 99 as 100; }, v => { v.coffinBearer.life.recipient.consent = 'GRANTED'; }, v => { attempt(v, 'withdrawn-transfer').consentWithdrawn = false; }, v => { attempt(v, 'withdrawn-transfer').recipientConsent = 'GRANTED'; },
      v => { attempt(v, 'fresh-transfer').spiritualitySpent = 0; }, v => { attempt(v, 'fresh-transfer').mindSpent = 0; }, v => { attempt(v, 'fresh-transfer').resolutionActions = 0; }, v => { attempt(v, 'fresh-transfer').padId = null; }, v => { attempt(v, 'fresh-transfer').abilitySourceId = 'CB3-LIVE-2'; },
      v => { attempt(v, 'fresh-transfer').abilityCheck = { ...attempt(v, 'fresh-transfer').abilityCheck!, chance: 100 }; }, v => { attempt(v, 'fresh-transfer').protectedExposureSeconds--; }, v => { attempt(v, 'fresh-transfer').remainingSeconds = 60; }, v => { attempt(v, 'fresh-transfer').effectExpired = false; }, v => { attempt(v, 'fresh-transfer').vitalityLost--; },
      v => { attempt(v, 'fresh-transfer').playerMoves[1]!.itemIds = []; }, v => { attempt(v, 'fresh-transfer').playerMoves[1]!.metres = 0 as 4; }, v => { attempt(v, 'withdrawn-transfer').objectMoves = []; }, v => { attempt(v, 'dry-record').limitedConfirmed = false; },
      v => { attempt(v, 'fresh-transfer').steps.find(x => x.type === 'WAIT_WINDOW')!.atSecond++; }, v => { attempt(v, 'fresh-transfer').steps.push(structuredClone(attempt(v, 'fresh-transfer').steps.find(x => x.type === 'WAIT_WINDOW')!)); }, v => { Object.assign(attempt(v, 'dry-record').steps[0]!, { revived: true }); },
      v => { v.coffinBearer.life.clockSeconds++; }, v => { v.coffinBearer.life.externalSeconds = 60; }, v => { v.coffinBearer.life.playerTravelMetres--; }, v => { v.progression.mastery[ABILITY] = 16; }, v => { Object.assign(v.coffinBearer.life, { immortality: true }); },
      v => { v.coffinBearer.life.guard.segments[0]!.status = 'SPENT'; }, v => { v.coffinBearer.life.guard.sourceId = 'AA4-GUARD-1' as 'CB3-GUARD-MATERIAL'; },
    ];
    for (const mutate of changes) { const copy = structuredClone(s); mutate(copy); expect(validateCoffinBearerLife(copy)).toBe(false); }
  });
  it('external clock accepts only safe whole seconds, cannot run concurrently, and never continues exposure after care', () => {
    const s = ready(); expect(advanceCoffinBearerClock).toBe(advanceCoffinBearerLifeClock); expect(() => advanceCoffinBearerLifeClock(s, -1)).toThrow(); expect(() => advanceCoffinBearerLifeClock(s, 0.5)).toThrow();
    start(s, 'fresh-transfer'); cast(s, 'fresh-transfer'); const before = structuredClone(s); expect(() => advanceCoffinBearerLifeClock(s, 60)).toThrow(); expect(s).toEqual(before);
    transfer(s, 'fresh-transfer'); finish(s, 'fresh-transfer'); const original = structuredClone(s.coffinBearer.life.samples); advanceCoffinBearerLifeClock(s, 60);
    expect(s.coffinBearer.life.samples).toEqual(original); expect(s.coffinBearer.life.externalSeconds).toBe(60); expect(validateCoffinBearerLife(s)).toBe(false); // No corresponding combat round exists.
  });
  it('malformed replay records and hidden extra state return false without throwing', () => {
    const s = ready(); start(s, 'fresh-transfer'); cast(s, 'fresh-transfer');
    for (const mutate of [(v: SliceState) => { Object.assign(v.coffinBearer.life, { owner: null }); }, (v: SliceState) => { Object.assign(attempt(v, 'fresh-transfer'), { steps: [null] }); }, (v: SliceState) => { Object.assign(v.coffinBearer.life.cases, { extra: {} }); }, (v: SliceState) => { Object.assign(v.coffinBearer.life, { samples: [null] }); }]) {
      const copy = structuredClone(s); mutate(copy); expect(() => validateCoffinBearerLife(copy)).not.toThrow(); expect(validateCoffinBearerLife(copy)).toBe(false);
    }
  });
});
