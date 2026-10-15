import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createThreeHeadedTemplarState } from '../../src/domain/three-headed-templar/index.js';
import { applyThreeHeadedTemplarActivity, applyThreeHeadedTemplarCombatSpiritEvent, blockThreeHeadedTemplarLife, createThreeHeadedTemplarLifeState, getExternalThreeHeadedTemplarSpirits, hasThreeHeadedTemplarLifeLock, projectThreeHeadedTemplarLife, THREE_HEADED_TEMPLAR_CASE_IDS, THREE_HEADED_TEMPLAR_SPIRIT_IDS, threeHeadedTemplarLifeActions, validateThreeHeadedTemplarActivityCommand, validateThreeHeadedTemplarLife, validateThreeHeadedTemplarSpiritSources, type ThreeHeadedTemplarActivityCommand, type ThreeHeadedTemplarCaseId, type ThreeHeadedTemplarSpiritId } from '../../src/domain/three-headed-templar/life.js';

const ABILITY = 'hanged-man.s3.multiple-release', H = 'THT3-HELENA', R = 'THT3-ROLAND';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit isolated directed fixture; not a claim about natural grazing or externalization success. */
function ready(): SliceState {
  const s = createSliceRun('templar-life', sliceDefaultCreationSelection, 'templar-life');
  s.threeHeadedTemplar = createThreeHeadedTemplarState(); s.week = 110; s.threeHeadedTemplar.promotionWeek = 109; s.threeHeadedTemplar.blackKnightActingAtPromotion = 100;
  s.progression = { pathwayId: 'hanged-man', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [ABILITY]: 0, 'hanged-man.s4.flesh-soul-blade': 17 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: ThreeHeadedTemplarActivityCommand, roll = 1) { const ctx = context(s, roll); applyThreeHeadedTemplarActivity(s, command, ctx); expect(validateThreeHeadedTemplarLife(s), `${command.type}: ${JSON.stringify(s.threeHeadedTemplar.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: ThreeHeadedTemplarCaseId, type: Exclude<ThreeHeadedTemplarActivityCommand['type'], 'PREPARE' | 'GRAZE' | 'PREPARE_GRAZING' | 'RELEASE_GRAZED' | 'REST_SPIRIT' | 'EXTERNALIZE' | 'RECALL_SPIRIT' | 'SEND_SPIRIT' | 'ASSIST' | 'REFLECT' | 'MEET_SPIRITS'>) { return act(s, { type, caseId }); }
function reject(s: SliceState, command: ThreeHeadedTemplarActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyThreeHeadedTemplarActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const spirit = (s: SliceState, id: ThreeHeadedTemplarSpiritId) => s.threeHeadedTemplar.life.spirits[id];
const attempt = (s: SliceState, id: ThreeHeadedTemplarCaseId) => s.threeHeadedTemplar.life.cases[id].attempts[0]!;
function acquire(s: SliceState, id: ThreeHeadedTemplarSpiritId, roll = 1, abilities: string[] = spirit(s, id).knownAbilities) {
  if (s.threeHeadedTemplar.life.metSpiritsWeek === null) act(s, { type: 'MEET_SPIRITS' });
  act(s, { type: 'PREPARE_GRAZING', spiritId: id }); return act(s, { type: 'GRAZE', spiritId: id, abilityIds: abilities, confirmed: true }, roll);
}
function both(s: SliceState) { acquire(s, H); acquire(s, R); }
function start(s: SliceState, id: ThreeHeadedTemplarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); step(s, id, 'CONSENT_OWNER'); }
function finish(s: SliceState, id: ThreeHeadedTemplarCaseId) { step(s, id, 'INSPECT'); step(s, id, 'CLOSE'); step(s, id, 'REPORT'); }
function recall(s: SliceState) { for (const sp of getExternalThreeHeadedTemplarSpirits(s)) act(s, { type: 'RECALL_SPIRIT', spiritId: sp.id }); }
function ordinaryRoute(s: SliceState, id: ThreeHeadedTemplarCaseId) {
  recall(s); step(s, id, 'WALK_A'); step(s, id, 'TAKE_CARD');
  if (id === 'two-end-seal') step(s, id, 'READ_CARD'); else if (id === 'paired-care') step(s, id, 'SECURE_LEFT');
  step(s, id, 'WALK_B');
  if (id === 'two-end-seal') step(s, id, 'READ_FAR_SEAL'); else if (id === 'paired-care') step(s, id, 'CHECK_RIGHT'); else { step(s, id, 'OPEN_LIGHT'); step(s, id, 'CLOSE_SHUTTER'); }
  step(s, id, 'WALK_A'); step(s, id, 'RETURN_CARD'); step(s, id, 'RETURN_START'); finish(s, id);
}
function abilityRoute(s: SliceState, id: ThreeHeadedTemplarCaseId) {
  start(s, id); act(s, { type: 'EXTERNALIZE', spiritId: H }); if (id !== 'two-end-seal') act(s, { type: 'EXTERNALIZE', spiritId: R });
  const send = (spiritId: ThreeHeadedTemplarSpiritId, destination: 'A' | 'B') => act(s, { type: 'SEND_SPIRIT', spiritId, destination });
  if (id === 'two-end-seal') { send(H, 'A'); act(s, { type: 'ASSIST', spiritId: H, method: 'SIGNAL' }); send(H, 'B'); act(s, { type: 'ASSIST', spiritId: H, method: 'SIGNAL' }); }
  else if (id === 'paired-care') { send(R, 'A'); act(s, { type: 'ASSIST', spiritId: R, method: 'STEADY_HOLD' }); send(H, 'B'); act(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' }); }
  else { send(H, 'B'); act(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' }); send(R, 'A'); step(s, id, 'OPEN_LIGHT'); act(s, { type: 'RECALL_SPIRIT', spiritId: H }); act(s, { type: 'ASSIST', spiritId: R, method: 'SIGNAL' }); }
  recall(s); if (id === 'interrupted-light') step(s, id, 'CLOSE_SHUTTER'); finish(s, id);
}

describe('Three Headed Templar original finite deceased spirit sources', () => {
  it('starts with two sealed deceased sources, different original death records and caskets, and no default free spirits', () => {
    const s = ready(), l = s.threeHeadedTemplar.life;
    expect(validateThreeHeadedTemplarLife(s)).toBe(true); expect(l).toEqual(createThreeHeadedTemplarLifeState());
    expect(Object.values(l.spirits).map(sp => [sp.status, sp.location, sp.spirituality, sp.selectedAbilities])).toEqual([['SEALED', 'SEALED', 0, []], ['SEALED', 'SEALED', 0, []]]);
    expect(spirit(s, H)).toMatchObject({ age: 54, deceased: true, sequence: 4, custodianId: 'THT3-MARA' }); expect(spirit(s, R)).toMatchObject({ age: 61, deceased: true, sequence: 4 });
    expect(new Set(Object.values(l.spirits).map(sp => sp.deathRecordId)).size).toBe(2); expect(new Set(Object.values(l.spirits).map(sp => sp.casketId)).size).toBe(2);
    expect(projectThreeHeadedTemplarLife(s).spirits).toEqual([]); reject(s, { type: 'EXTERNALIZE', spiritId: H });
  });
  it('requires actual meeting, current willing custodian and a separately paid preparation', () => {
    const s = ready(); reject(s, { type: 'PREPARE_GRAZING', spiritId: H }); s.threeHeadedTemplar.life.owner.willing = false; reject(s, { type: 'MEET_SPIRITS' });
    s.threeHeadedTemplar.life.owner.willing = true; act(s, { type: 'MEET_SPIRITS' }); expect(s.actionsRemaining).toBe(99); expect(projectThreeHeadedTemplarLife(s).spirits).toHaveLength(2);
    reject(s, { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL'], confirmed: true }); act(s, { type: 'PREPARE_GRAZING', spiritId: H }); expect(s.cash).toBe(820); expect(s.actionsRemaining).toBe(98);
    s.threeHeadedTemplar.life.owner.willing = false; reject(s, { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL'], confirmed: true });
  });
  it('pays failed grazing in full and retries only the same still-sealed source with next-week new preparation', () => {
    const s = ready(), old = structuredClone(s.shepherd.grazing), shadow = structuredClone(s.blackKnight.life.shadow), ctx = acquire(s, H, 100);
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(s.cash).toBe(820); expect(s.actionsRemaining).toBe(97);
    expect(spirit(s, H)).toMatchObject({ status: 'SEALED', location: 'SEALED', spirituality: 0, preparedWeek: null, attemptWeek: 110, acquiredWeek: null, selectedAbilities: [] });
    reject(s, { type: 'PREPARE_GRAZING', spiritId: H }); reject(s, { type: 'EXTERNALIZE', spiritId: H });
    s.week++; acquire(s, H); expect(spirit(s, H)).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', acquiredWeek: 111, spirituality: 30, integrity: 100 });
    expect(spirit(s, H).history.filter(e => e.type === 'GRAZE')).toHaveLength(2); expect(s.cash).toBe(640); expect(s.shepherd.grazing).toEqual(old); expect(s.blackKnight.life.shadow).toEqual(shadow);
  });
  it('keeps exactly the actual selected methods and never borrows a newly invented method', () => {
    const s = ready(); acquire(s, H, 1, ['SIGNAL']); expect(spirit(s, H).selectedAbilities).toEqual(['SIGNAL']);
    expect(validateThreeHeadedTemplarActivityCommand({ type: 'GRAZE', spiritId: H, abilityIds: ['STEADY_HOLD'], confirmed: true })).toBe(false);
    expect(validateThreeHeadedTemplarActivityCommand({ type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL', 'SIGNAL'], confirmed: true })).toBe(false);
    expect(validateThreeHeadedTemplarActivityCommand({ type: 'GRAZE', spiritId: H, abilityIds: [], confirmed: true })).toBe(false);
    start(s, 'two-end-seal'); act(s, { type: 'EXTERNALIZE', spiritId: H }); reject(s, { type: 'ASSIST', spiritId: H, method: 'BRIEF_WARD' });
  });
  it('requires explicit permanent-release confirmation and cannot reacquire or heal the released original', () => {
    const s = ready(); acquire(s, H); const before = structuredClone(spirit(s, H));
    expect(validateThreeHeadedTemplarActivityCommand({ type: 'RELEASE_GRAZED', spiritId: H })).toBe(false);
    act(s, { type: 'RELEASE_GRAZED', spiritId: H, confirmed: true }); expect(spirit(s, H)).toMatchObject({ status: 'RELEASED', location: 'RELEASED', releasedWeek: 110, acquiredWeek: before.acquiredWeek, selectedAbilities: before.selectedAbilities, deathRecordId: before.deathRecordId, casketId: before.casketId });
    s.week++; for (const type of ['PREPARE_GRAZING', 'REST_SPIRIT', 'EXTERNALIZE'] as const) reject(s, { type, spiritId: H });
    reject(s, { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL'], confirmed: true });
  });
  it('externalizes one actual original once per idle week and never replenishes on recall', () => {
    const s = ready(); acquire(s, H); const resources = [s.spirituality, s.mind]; act(s, { type: 'EXTERNALIZE', spiritId: H });
    expect(spirit(s, H)).toMatchObject({ location: 'START', spirituality: 30 }); expect(s.spirituality).toBe(resources[0]! - 4); expect(s.mind).toBe(resources[1]! - 2); expect(hasThreeHeadedTemplarLifeLock(s)).toBe(true);
    reject(s, { type: 'RELEASE_GRAZED', spiritId: H, confirmed: true }); act(s, { type: 'RECALL_SPIRIT', spiritId: H }); expect(hasThreeHeadedTemplarLifeLock(s)).toBe(false);
    reject(s, { type: 'EXTERNALIZE', spiritId: H }); s.week++; act(s, { type: 'EXTERNALIZE', spiritId: H }); expect(spirit(s, H).spirituality).toBe(30);
  });
  it('failed externalization keeps the same internal source and full player costs without another same-case roll', () => {
    const s = ready(); acquire(s, H); start(s, 'two-end-seal'); const before = s.spirituality;
    const ctx = act(s, { type: 'EXTERNALIZE', spiritId: H }, 100); expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(before - 4); expect(spirit(s, H).location).toBe('INTERNAL');
    reject(s, { type: 'EXTERNALIZE', spiritId: H }); ordinaryRoute(s, 'two-end-seal'); expect(attempt(s, 'two-end-seal').result).toBe('ORDINARY'); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.progression.acting).toBe(25);
  });
  it('restores only the same acquired internal spirit with real later-week40p care, once, and never rewrites old sources', () => {
    const s = ready(); both(s); const old = structuredClone(s.shepherd.grazing); abilityRoute(s, 'two-end-seal'); expect(spirit(s, H).spirituality).toBe(24);
    reject(s, { type: 'REST_SPIRIT', spiritId: H }); s.week++; const cash = s.cash, ap = s.actionsRemaining; act(s, { type: 'REST_SPIRIT', spiritId: H });
    expect(s.cash).toBe(cash - 40); expect(s.actionsRemaining).toBe(ap - 1); expect(spirit(s, H).spirituality).toBe(30); reject(s, { type: 'REST_SPIRIT', spiritId: H }); expect(s.shepherd.grazing).toEqual(old);
  });
});

describe('Three Headed Templar three finite original scenes', () => {
  it('always offers an ordinary route without owning any spirit and can truthfully report/reflect100', () => {
    const s = ready(), old = structuredClone(s.shepherd.grazing), shadow = structuredClone(s.blackKnight.life.shadow), beforeS = s.spirituality;
    for (const id of THREE_HEADED_TEMPLAR_CASE_IDS) { start(s, id, 'ORDINARY'); ordinaryRoute(s, id); }
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.spirituality).toBe(beforeS); expect(s.actionsRemaining).toBe(87);
    expect(s.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 48, clockSeconds: 78, reflected: true, card: { location: 'TABLE', travelMetres: 24 }, shutter: { state: 'CLOSED' }, lamp: { on: false } });
    expect(Object.values(s.threeHeadedTemplar.life.cases).every(row => row.result === 'ORDINARY')).toBe(true); expect(s.shepherd.grazing).toEqual(old); expect(s.blackKnight.life.shadow).toEqual(shadow);
    expect(Object.values(s.threeHeadedTemplar.life.spirits).every(sp => sp.status === 'SEALED')).toBe(true);
  });
  it('does not silently cast at PERFORM, invent owner consent, or reveal a future far-end observation', () => {
    const s = ready(); both(s); step(s, 'two-end-seal', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ABILITY' }); const before = structuredClone(s.threeHeadedTemplar.life.spirits);
    step(s, 'two-end-seal', 'PERFORM'); expect(s.threeHeadedTemplar.life.spirits).toEqual(before); expect(attempt(s, 'two-end-seal')).toMatchObject({ steps: [], evidence: [], ownerConsent: 'UNASKED', farSealRead: false });
    reject(s, { type: 'EXTERNALIZE', spiritId: H }); expect(projectThreeHeadedTemplarLife(s).currentAttempt!.evidence).toEqual([]);
  });
  it('uses the same Helena atA thenB with two own paid signals, limited evidence and one maintenance payment', () => {
    const s = ready(); both(s); const beforeS = s.spirituality; abilityRoute(s, 'two-end-seal');
    const a = attempt(s, 'two-end-seal'); expect(a).toMatchObject({ result: 'ABILITY', cardRead: true, farSealRead: true, performances: 2, maintenancePayments: 1, spiritualitySpent: 5, mindSpent: 2, playerTravelMetres: 0, elapsedSeconds: 26 });
    expect(a.evidence.map(e => e.sourceId)).toEqual(['THT3-CARD', 'THT3-FAR-SEAL']); expect(a.evidence[1]!.text).toContain('不能由此推知'); expect(spirit(s, H)).toMatchObject({ location: 'INTERNAL', spirituality: 24, travelMetres: 16 });
    expect(s.spirituality).toBe(beforeS - 5); expect(s.progression.mastery[ABILITY]).toBe(8); expect(s.threeHeadedTemplar.life.card).toMatchObject({ location: 'TABLE', travelMetres: 0 });
    reject(s, { type: 'REPORT', caseId: 'two-end-seal' });
  });
  it('requires both separately paid originals actually at opposite boxes for paired care, never one remote substitute', () => {
    const s = ready(); both(s); abilityRoute(s, 'two-end-seal'); start(s, 'paired-care'); act(s, { type: 'EXTERNALIZE', spiritId: H }); act(s, { type: 'EXTERNALIZE', spiritId: R });
    act(s, { type: 'SEND_SPIRIT', spiritId: H, destination: 'B' }); reject(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' });
    act(s, { type: 'SEND_SPIRIT', spiritId: R, destination: 'A' }); act(s, { type: 'ASSIST', spiritId: R, method: 'STEADY_HOLD' });
    const before = [spirit(s, H).spirituality, spirit(s, R).spirituality]; act(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' });
    expect(attempt(s, 'paired-care')).toMatchObject({ simultaneousCare: true, rightChecked: true, playerTravelMetres: 0, performances: 2 }); expect(spirit(s, H).spirituality).toBe(before[0]! - 3); expect(spirit(s, R).spirituality).toBe(before[1]);
    expect(s.threeHeadedTemplar.life.leftBox.location).toBe('A'); expect(s.threeHeadedTemplar.life.rightBox.location).toBe('B'); recall(s); finish(s, 'paired-care'); expect(s.progression.mastery[ABILITY]).toBe(16);
  });
  it('does not count departed Roland as simultaneously holdingA when Helena reachesB', () => {
    const s = ready(); both(s); abilityRoute(s, 'two-end-seal'); start(s, 'paired-care'); act(s, { type: 'EXTERNALIZE', spiritId: H }); act(s, { type: 'EXTERNALIZE', spiritId: R });
    act(s, { type: 'SEND_SPIRIT', spiritId: R, destination: 'A' }); act(s, { type: 'ASSIST', spiritId: R, method: 'STEADY_HOLD' }); act(s, { type: 'RECALL_SPIRIT', spiritId: R });
    act(s, { type: 'SEND_SPIRIT', spiritId: H, destination: 'B' }); reject(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' });
    expect(attempt(s, 'paired-care').simultaneousCare).toBe(false);
  });
  it('strong light damages and interrupts only the actual original atB; her real8m recall allows Roland atA to continue', () => {
    const s = ready(); both(s); abilityRoute(s, 'two-end-seal'); abilityRoute(s, 'paired-care'); start(s, 'interrupted-light');
    act(s, { type: 'EXTERNALIZE', spiritId: H }); act(s, { type: 'EXTERNALIZE', spiritId: R }); act(s, { type: 'SEND_SPIRIT', spiritId: H, destination: 'B' }); act(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' }); act(s, { type: 'SEND_SPIRIT', spiritId: R, destination: 'A' });
    step(s, 'interrupted-light', 'OPEN_LIGHT'); expect(spirit(s, H)).toMatchObject({ integrity: 80, interrupted: true, location: 'B' }); expect(spirit(s, R)).toMatchObject({ integrity: 100, interrupted: false, location: 'A' });
    reject(s, { type: 'ASSIST', spiritId: H, method: 'LOW_GLOW' }); reject(s, { type: 'ASSIST', spiritId: R, method: 'SIGNAL' }); const before = s.threeHeadedTemplar.life.clockSeconds;
    act(s, { type: 'RECALL_SPIRIT', spiritId: H }); expect(s.threeHeadedTemplar.life.clockSeconds).toBe(before + 8); expect(spirit(s, H)).toMatchObject({ integrity: 80, location: 'INTERNAL', spirituality: 18, interrupted: false });
    act(s, { type: 'ASSIST', spiritId: R, method: 'SIGNAL' }); act(s, { type: 'RECALL_SPIRIT', spiritId: R }); reject(s, { type: 'INSPECT', caseId: 'interrupted-light' }); step(s, 'interrupted-light', 'CLOSE_SHUTTER'); finish(s, 'interrupted-light');
    expect(attempt(s, 'interrupted-light')).toMatchObject({ result: 'ABILITY', helenaInterrupted: true, rolandContinued: true }); expect(s.progression.mastery[ABILITY]).toBe(24);
  });
  it('three real ability scenes conserve the original sources and exact separate resource totals without body movement', () => {
    const s = ready(); both(s); for (const id of THREE_HEADED_TEMPLAR_CASE_IDS) abilityRoute(s, id); act(s, { type: 'REFLECT' });
    expect(s.threeHeadedTemplar.life).toMatchObject({ clockSeconds: 102, playerTravelMetres: 0, card: { travelMetres: 0, location: 'TABLE' } });
    expect(spirit(s, H)).toMatchObject({ spirituality: 18, integrity: 80, travelMetres: 48, status: 'GRAZED', location: 'INTERNAL' }); expect(spirit(s, R)).toMatchObject({ spirituality: 24, integrity: 100, travelMetres: 16 });
    expect(s.spirituality).toBe(85); expect(s.mind).toBe(86); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(24);
  });
  it('permits pre-PERFORM method changes but no retroactive switch after actual implementation', () => {
    const s = ready(); both(s); step(s, 'two-end-seal', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ABILITY' }); const ap = s.actionsRemaining;
    act(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ORDINARY' }); expect(s.actionsRemaining).toBe(ap); step(s, 'two-end-seal', 'PERFORM'); reject(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ABILITY' });
  });
  it('requires one real remaining implementation action at preparation and lets a prepared scene withdraw free', () => {
    const s = ready(); step(s, 'two-end-seal', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ORDINARY' }); s.actionsRemaining = 2;
    act(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ORDINARY' }); expect(hasThreeHeadedTemplarLifeLock(s)).toBe(true); s.actionsRemaining = 0; step(s, 'two-end-seal', 'WITHDRAW'); expect(hasThreeHeadedTemplarLifeLock(s)).toBe(false);
  });
  it('keeps physical cleanup possible at zero resources after withdrawal and does not teleport the body or card', () => {
    const s = ready(); start(s, 'two-end-seal', 'ORDINARY'); step(s, 'two-end-seal', 'WALK_A'); step(s, 'two-end-seal', 'TAKE_CARD'); step(s, 'two-end-seal', 'WALK_B');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    // External resource exhaustion is not an event within the finite scene; check routing and real moves directly.
    const ctx = context(s); applyThreeHeadedTemplarActivity(s, { type: 'WITHDRAW', caseId: 'two-end-seal' }, ctx);
    expect(blockThreeHeadedTemplarLife(s, { type: 'RETURN_START', caseId: 'two-end-seal' })).not.toBeNull();
    for (const type of ['WALK_A', 'RETURN_CARD', 'RETURN_START', 'INSPECT', 'CLOSE'] as const) applyThreeHeadedTemplarActivity(s, { type, caseId: 'two-end-seal' }, ctx);
    expect(s.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', card: { location: 'TABLE', travelMetres: 8 } }); expect(s.spirituality).toBe(0); expect(s.mind).toBe(0); expect(s.actionsRemaining).toBe(0);
  });
  it('honors actual owner refusal without coercion and lets the refusal be truthfully withdrawn', () => {
    const s = ready(); step(s, 'two-end-seal', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'two-end-seal', method: 'ORDINARY' }); step(s, 'two-end-seal', 'PERFORM'); s.threeHeadedTemplar.life.owner.willing = false;
    step(s, 'two-end-seal', 'CONSENT_OWNER'); expect(attempt(s, 'two-end-seal').ownerConsent).toBe('DECLINED'); reject(s, { type: 'TAKE_CARD', caseId: 'two-end-seal' }); step(s, 'two-end-seal', 'WITHDRAW'); finish(s, 'two-end-seal'); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
});

describe('Three Headed Templar replay, source authenticity and projection', () => {
  it('rejects refreshed spirituality, new caskets, fabricated selected methods and removed real source events', () => {
    const s = ready(); both(s); abilityRoute(s, 'two-end-seal');
    const corruptions = [
      (v: SliceState) => { spirit(v, H).spirituality = 30; },
      (v: SliceState) => { spirit(v, H).casketId = 'NEW-FREE-CASKET'; },
      (v: SliceState) => { spirit(v, H).selectedAbilities.push('STEADY_HOLD'); },
      (v: SliceState) => { spirit(v, H).history.splice(0, 1); },
      (v: SliceState) => { spirit(v, H).travelMetres = 0; },
      (v: SliceState) => { spirit(v, H).acquiredWeek = 109; },
      (v: SliceState) => { spirit(v, H).history.find(e => e.type === 'GRAZE')!.masterCost = 0; },
    ];
    for (const corrupt of corruptions) { const v = structuredClone(s); corrupt(v); expect(validateThreeHeadedTemplarSpiritSources(v.threeHeadedTemplar.life.spirits, v.week)).toBe(false); expect(validateThreeHeadedTemplarLife(v)).toBe(false); }
  });
  it('rejects fabricated simultaneous care, body teleport, missing physical card travel, fake free maintenance and premature report', () => {
    const s = ready(); start(s, 'two-end-seal', 'ORDINARY'); ordinaryRoute(s, 'two-end-seal');
    const corruptions = [
      (v: SliceState) => { attempt(v, 'two-end-seal').result = 'ABILITY'; v.threeHeadedTemplar.life.cases['two-end-seal'].result = 'ABILITY'; },
      (v: SliceState) => { attempt(v, 'two-end-seal').playerMoves[1]!.metres = 0; },
      (v: SliceState) => { v.threeHeadedTemplar.life.card.travelMetres = 0; },
      (v: SliceState) => { attempt(v, 'two-end-seal').evidence[1]!.sourceId = 'INVENTED-SEAL'; },
      (v: SliceState) => { v.threeHeadedTemplar.life.cases['paired-care'].status = 'RESOLVED'; },
      (v: SliceState) => { v.threeHeadedTemplar.life.clockSeconds++; },
      (v: SliceState) => { v.progression.acting = 100; },
    ];
    for (const corrupt of corruptions) { const v = structuredClone(s); corrupt(v); expect(validateThreeHeadedTemplarLife(v)).toBe(false); }
    const ability = ready(); both(ability); abilityRoute(ability, 'two-end-seal'); const changed = structuredClone(ability); attempt(changed, 'two-end-seal').maintenancePayments = 0; expect(validateThreeHeadedTemplarLife(changed)).toBe(false);
  });
  it('public source actions expose actual seven selected-method combinations, exact costs and irreversible confirmation', () => {
    const s = ready(); act(s, { type: 'MEET_SPIRITS' }); act(s, { type: 'PREPARE_GRAZING', spiritId: H });
    const actions = threeHeadedTemplarLifeActions(s).filter(row => row.command.type === 'GRAZE' && row.command.spiritId === H);
    expect(actions).toHaveLength(7); expect(new Set(actions.map(row => row.command.type === 'GRAZE' ? row.command.abilityIds.join(',') : '')).size).toBe(7); expect(actions.every(row => row.command.type === 'GRAZE' && row.command.confirmed && row.cost.includes('6本人灵性'))).toBe(true);
    act(s, { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL'], confirmed: true }); const release = threeHeadedTemplarLifeActions(s).find(row => row.command.type === 'RELEASE_GRAZED');
    expect(release?.command).toEqual({ type: 'RELEASE_GRAZED', spiritId: H, confirmed: true }); expect(release?.cost).toContain('不可重新取得');
  });
  it('projects one enabled current objective with actual source resources and no inferred future observations', () => {
    const s = ready(); expect(projectThreeHeadedTemplarLife(s).preferredActionId).toBe('meet-spirits'); both(s); start(s, 'two-end-seal');
    const view = projectThreeHeadedTemplarLife(s); expect(view.actions.find(row => row.id === view.preferredActionId)?.enabled).toBe(true); expect(view.currentAttempt!.evidence).toEqual([]);
    expect(view.spirits.find(sp => sp.id === H)).toMatchObject({ status: 'GRAZED', location: 'INTERNAL', spirituality: 30, integrity: 100 }); expect(view.story).toContain('本切片本人只沿用旧伊芮斯'); expect(view.facts.join(' ')).toContain('当前按逐灵实际记录');
    const before = structuredClone(s); projectThreeHeadedTemplarLife(s); expect(s).toEqual(before);
  });
  it('rejects widened public commands, original old-spirit IDs and fourth-method or unconfirmed grazing', () => {
    for (const command of [
      { type: 'EXTERNALIZE', spiritId: 'SH5-IRIS-1' }, { type: 'EXTERNALIZE', spiritId: H, refill: true }, { type: 'SEND_SPIRIT', spiritId: H, destination: 'GLOBAL' },
      { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL'], confirmed: false }, { type: 'GRAZE', spiritId: H, abilityIds: ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW', 'SCREEN'], confirmed: true },
      { type: 'RELEASE_GRAZED', spiritId: R, confirmed: false }, { type: 'ASSIST', spiritId: H, method: 'OMNISCIENCE' }, { type: 'REFLECT', free: true },
    ]) expect(validateThreeHeadedTemplarActivityCommand(command)).toBe(false);
  });
  it('pure combat source helper charges one paid support per original per round and withdraws only the light-hit source along4m', () => {
    const s = ready(); both(s); s.threeHeadedTemplar.encounter.status = 'READY'; s.threeHeadedTemplar.encounter.approachWeek = s.week;
    act(s, { type: 'EXTERNALIZE', spiritId: H }); act(s, { type: 'EXTERNALIZE', spiritId: R }); const originals = structuredClone(s.threeHeadedTemplar.life.spirits);
    const cost = applyThreeHeadedTemplarCombatSpiritEvent(originals, { type: 'SUPPORT', spiritId: H, week: s.week, round: 1, atSecond: 4 }); expect(cost).toMatchObject({ spiritCost: 3, masterCost: 1, seconds: 0, method: 'BRIEF_WARD' });
    expect(originals[H].spirituality).toBe(27); expect(() => applyThreeHeadedTemplarCombatSpiritEvent(originals, { type: 'SUPPORT', spiritId: H, week: s.week, round: 1, atSecond: 4 })).toThrow();
    const interrupted = applyThreeHeadedTemplarCombatSpiritEvent(originals, { type: 'LIGHT_BREAK', spiritId: H, week: s.week, round: 1, atSecond: 4 }); expect(interrupted).toMatchObject({ metres: 4, seconds: 4 }); expect(originals[H]).toMatchObject({ spirituality: 27, integrity: 80, location: 'INTERNAL', supportEnabled: false }); expect(originals[R].location).toBe('COURT');
    expect(validateThreeHeadedTemplarSpiritSources(originals, s.week)).toBe(true); expect(spirit(s, H).spirituality).toBe(30);
  });
  it('pure death break permanently releases the actual external original while retaining source and own remaining resources', () => {
    const s = ready(); both(s); s.threeHeadedTemplar.encounter.status = 'READY'; s.threeHeadedTemplar.encounter.approachWeek = s.week; act(s, { type: 'EXTERNALIZE', spiritId: H });
    const originals = structuredClone(s.threeHeadedTemplar.life.spirits); const cost = applyThreeHeadedTemplarCombatSpiritEvent(originals, { type: 'DEATH_RELEASE', spiritId: H, week: s.week, round: 1, atSecond: 2 });
    expect(cost).toMatchObject({ seconds: 0, metres: 0, spiritCost: 0, masterCost: 0 }); expect(originals[H]).toMatchObject({ status: 'RELEASED', location: 'RELEASED', releasedWeek: s.week, spirituality: 30, deathRecordId: spirit(s, H).deathRecordId, acquiredWeek: s.week });
    expect(originals[R].status).toBe('GRAZED'); expect(originals[R].location).toBe('INTERNAL'); expect(validateThreeHeadedTemplarSpiritSources(originals, s.week)).toBe(true);
  });
  it('rejects free imported court sources lacking original acquisition history', () => {
    const s = ready(); for (const id of THREE_HEADED_TEMPLAR_SPIRIT_IDS) { const sp = spirit(s, id); sp.status = 'GRAZED'; sp.location = 'COURT'; sp.spirituality = 30; sp.supportEnabled = true; sp.selectedAbilities = [...sp.knownAbilities]; sp.acquiredWeek = s.week; }
    expect(validateThreeHeadedTemplarSpiritSources(s.threeHeadedTemplar.life.spirits, s.week)).toBe(false); expect(validateThreeHeadedTemplarLife(s)).toBe(false);
  });
});
