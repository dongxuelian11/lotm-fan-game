import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSummoningMasterState } from '../../src/domain/summoning-master/index.js';
import { SUMMONING_MASTER_ABILITY_IDS } from '../../src/domain/summoning-master/types.js';
import { applySummoningMasterActivity, blockSummoningMasterLife, createSummoningMasterLifeState, getSummoningMasterPartner, hasSummoningMasterLifeLock, moveSummoningMasterPartner, projectSummoningMasterLife, returnSummoningMasterGuestOrdinarily, validateSummoningMasterActivityCommand, validateSummoningMasterLife, validateSummoningMasterPartner, type SummoningMasterActivityCommand, type SummoningMasterCaseId } from '../../src/domain/summoning-master/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Isolated post-promotion fixture. Natural acquisition is covered by the public campaign replay. */
function ready(): SliceState {
  const s = createSliceRun('summoning-master-life', sliceDefaultCreationSelection, 'summoning-master-life');
  s.summoningMaster = createSummoningMasterState(); s.week = 20; s.summoningMaster.promotionWeek = 19;
  s.progression = { pathwayId: 'moon', sequence: 3, acting: 0, promotionWeek: 19, mastery: Object.fromEntries(SUMMONING_MASTER_ABILITY_IDS.map(id => [id, 0])) };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 };
  return s;
}
function act(s: SliceState, command: SummoningMasterActivityCommand, roll = 1) { const ctx = context(s, roll); applySummoningMasterActivity(s, command, ctx); expect(validateSummoningMasterLife(s)).toBe(true); return ctx; }
function reject(s: SliceState, command: SummoningMasterActivityCommand) { const before = structuredClone(s); expect(() => applySummoningMasterActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
function start(s: SliceState, caseId: SummoningMasterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { if (s.summoningMaster.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId }); }
function consentAtHome(s: SliceState, caseId: SummoningMasterCaseId) { act(s, { type: 'VISIT_HOME', caseId }); act(s, { type: 'CONSENT', caseId }); }
function invite(s: SliceState, caseId: SummoningMasterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  consentAtHome(s, caseId);
  if (method === 'ORDINARY') { act(s, { type: 'FETCH_GUEST', caseId }); if (caseId !== 'source-visit') act(s, { type: 'CONSENT_OWNER', caseId }); }
  else { act(s, { type: 'RETURN_PLAYER', caseId }); if (caseId !== 'source-visit') act(s, { type: 'CONSENT_OWNER', caseId }); act(s, { type: 'OPEN_GATE', caseId }); act(s, { type: 'INVITE_GUEST', caseId }); }
}
function close(s: SliceState, caseId: SummoningMasterCaseId, returnMethod: 'GATE' | 'ORDINARY' = 'ORDINARY') {
  const l = s.summoningMaster.life, a = l.cases[caseId].attempts.at(-1)!;
  if (a.tokenTaken && !a.tokenReturned) act(s, { type: 'RETURN_TOKEN', caseId });
  if (returnMethod === 'ORDINARY' && l.gate.status === 'OPEN') act(s, { type: 'CLOSE_GATE', caseId });
  if (a.guestArrived && !a.guestReturned) act(s, { type: 'RETURN_GUEST', caseId, method: returnMethod });
  if (l.gate.status === 'OPEN') act(s, { type: 'CLOSE_GATE', caseId });
  if (!a.inspected) act(s, { type: 'INSPECT', caseId });
  if (l.playerLocation === 'HOME') act(s, { type: 'RETURN_PLAYER', caseId });
  act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: SummoningMasterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  start(s, caseId, method); invite(s, caseId, method); act(s, { type: 'VERIFY_GUEST', caseId });
  if (caseId === 'original-token') { act(s, { type: 'BORROW_TOKEN', caseId }); act(s, { type: method === 'ABILITY' ? 'COOPERATE' : 'CARRY_TOKEN', caseId }); }
  if (caseId === 'interrupted-door') act(s, { type: method === 'ABILITY' ? 'INTERRUPT_GATE' : 'OBSERVE_CLOSED_GATE', caseId });
  close(s, caseId); act(s, { type: 'REPORT', caseId });
}
const a = (s: SliceState, id: SummoningMasterCaseId) => s.summoningMaster.life.cases[id].attempts.at(-1)!;

describe('Summoning Master one real guest, original token and interruptible door', () => {
  it('starts with one independently minded sourceful adult and its own chime, with detached projections', () => {
    const s = ready(), p = getSummoningMasterPartner(s); expect(p).toBe(s.summoningMaster.life.partner);
    expect(p).toMatchObject({ id: 'SM3-LUMEN', adult: true, independentMind: true, location: 'HOME', status: 'ALIVE', health: 100, mind: 100, stamina: 100, metWeek: null, chime: { id: 'SM3-CHIME', owner: 'SM3-LUMEN' } });
    const v = projectSummoningMasterLife(s); v.partner.stamina = 0; v.token.owner = 'PLAYER' as never; expect(p.stamina).toBe(100); expect(s.summoningMaster.life.token.owner).toBe('SM3-ADA39'); expect(validateSummoningMasterLife(s)).toBe(true);
  });
  it('requires actual source visit and current consent before opening or inviting, retaining one body', () => {
    const s = ready(), p = getSummoningMasterPartner(s); start(s, 'source-visit'); reject(s, { type: 'OPEN_GATE', caseId: 'source-visit' }); reject(s, { type: 'CONSENT', caseId: 'source-visit' });
    invite(s, 'source-visit'); expect(p).toBe(s.summoningMaster.life.partner); expect(p).toMatchObject({ location: 'YARD', metWeek: 20, stamina: 94, gateCrossings: 1 }); expect(s.summoningMaster.life.playerTravelMetres).toBe(60); expect(s.spirituality).toBe(114); expect(s.actionsRemaining).toBe(97);
    act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); close(s, 'source-visit', 'GATE'); expect(p).toMatchObject({ location: 'HOME', stamina: 88, gateCrossings: 2 }); act(s, { type: 'REPORT', caseId: 'source-visit' }); expect(s.progression.acting).toBe(25); expect(s.progression.mastery['moon.s3.bounded-summoning']).toBe(8); expect(s.progression.mastery['moon.s3.guest-cooperation']).toBe(0);
  });
  it('gate expiry never deletes the crossed original and zero-resource ordinary return moves both bodies', () => {
    const s = ready(); start(s, 'source-visit'); invite(s, 'source-visit'); act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); act(s, { type: 'WAIT', caseId: 'source-visit', seconds: 40 });
    const p = getSummoningMasterPartner(s), clock = s.summoningMaster.life.clockSeconds; expect(s.summoningMaster.life.gate).toMatchObject({ status: 'EXPIRED', remainingSeconds: 0 }); expect(p.location).toBe('YARD');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; p.stamina = 0; reject(s, { type: 'CLOSE', caseId: 'source-visit' }); reject(s, { type: 'RETURN_GUEST', caseId: 'source-visit', method: 'GATE' });
    act(s, { type: 'RETURN_GUEST', caseId: 'source-visit', method: 'ORDINARY' }); expect(p).toMatchObject({ location: 'HOME', stamina: 0, ordinaryDistanceM: 30 }); expect(s.summoningMaster.life.playerLocation).toBe('HOME'); expect(s.summoningMaster.life.clockSeconds).toBe(clock + 30);
    reject(s, { type: 'CLOSE', caseId: 'source-visit' }); act(s, { type: 'INSPECT', caseId: 'source-visit' }); act(s, { type: 'RETURN_PLAYER', caseId: 'source-visit' }); act(s, { type: 'CLOSE', caseId: 'source-visit' }); expect(hasSummoningMasterLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0); expect(s.health).toBe(100);
  });
  it('does not allow a fresh roll after failed opening and completes by actual ordinary pickup and return', () => {
    const s = ready(); start(s, 'source-visit'); consentAtHome(s, 'source-visit'); act(s, { type: 'RETURN_PLAYER', caseId: 'source-visit' }); const ctx = act(s, { type: 'OPEN_GATE', caseId: 'source-visit' }, 100); expect(ctx.check).toHaveBeenCalledOnce(); expect(s.spirituality).toBe(114); expect(getSummoningMasterPartner(s).location).toBe('HOME'); reject(s, { type: 'OPEN_GATE', caseId: 'source-visit' });
    act(s, { type: 'VISIT_HOME', caseId: 'source-visit' }); act(s, { type: 'FETCH_GUEST', caseId: 'source-visit' }); act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); close(s, 'source-visit'); act(s, { type: 'REPORT', caseId: 'source-visit' });
    expect(a(s, 'source-visit')).toMatchObject({ result: 'ORDINARY', gateTier: 'GREAT_FAILURE', spiritualitySpent: 6, guestStaminaSpent: 0, homeVisits: 2, guestTravelMetres: 60 }); expect(getSummoningMasterPartner(s).stamina).toBe(100); expect(s.progression.mastery['moon.s3.bounded-summoning']).toBe(0);
  });
  it('respects refusal at HOME and can report ordinary source checking without forced summoning', () => {
    const s = ready(); getSummoningMasterPartner(s).willing = false; start(s, 'source-visit'); consentAtHome(s, 'source-visit'); expect(a(s, 'source-visit').consent).toBe('DECLINED'); reject(s, { type: 'FETCH_GUEST', caseId: 'source-visit' });
    act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); close(s, 'source-visit'); act(s, { type: 'REPORT', caseId: 'source-visit' }); expect(getSummoningMasterPartner(s)).toMatchObject({ location: 'HOME', stamina: 100, gateCrossings: 0 }); expect(s.spirituality).toBe(120); expect(s.progression.acting).toBe(25);
  });
  it('current revocation disables new actions but preserves ordinary evacuation of an already crossed body', () => {
    const s = ready(); start(s, 'source-visit'); invite(s, 'source-visit'); act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); act(s, { type: 'REVOKE_CONSENT', caseId: 'source-visit' }); reject(s, { type: 'RETURN_GUEST', caseId: 'source-visit', method: 'GATE' }); expect(getSummoningMasterPartner(s).location).toBe('YARD'); close(s, 'source-visit'); expect(getSummoningMasterPartner(s).location).toBe('HOME'); expect(a(s, 'source-visit').consent).toBe('CLOSED');
  });
  it('does not carry forward an old case invitation into the next case', () => {
    const s = ready(); finish(s, 'source-visit'); start(s, 'original-token'); expect(a(s, 'original-token').consent).toBe('UNASKED'); reject(s, { type: 'OPEN_GATE', caseId: 'original-token' }); reject(s, { type: 'BORROW_TOKEN', caseId: 'original-token' }); expect(s.summoningMaster.life.token.location).toBe('OWNER');
  });
  it('cooperation uses the same 200g owned token and actual guest stamina, then requires the token back first', () => {
    const s = ready(); finish(s, 'source-visit'); const token = s.summoningMaster.life.token, stamina = getSummoningMasterPartner(s).stamina; start(s, 'original-token'); invite(s, 'original-token'); act(s, { type: 'BORROW_TOKEN', caseId: 'original-token' }); act(s, { type: 'COOPERATE', caseId: 'original-token' });
    expect(s.summoningMaster.life.token).toBe(token); expect(token).toMatchObject({ owner: 'SM3-ADA39', massGrams: 200, location: 'TABLE', custodian: 'TABLE' }); expect(getSummoningMasterPartner(s).stamina).toBe(stamina - 14); expect(a(s, 'original-token').guestTravelMetres).toBe(3); reject(s, { type: 'COOPERATE', caseId: 'original-token' }); reject(s, { type: 'RETURN_GUEST', caseId: 'original-token', method: 'ORDINARY' }); close(s, 'original-token');
    expect(token).toMatchObject({ owner: 'SM3-ADA39', location: 'OWNER', custodian: 'SM3-ADA39' }); expect(a(s, 'original-token').guestTravelMetres).toBe(36); act(s, { type: 'REPORT', caseId: 'original-token' }); expect(s.progression.mastery['moon.s3.guest-cooperation']).toBe(8);
  });
  it('failed cooperation charges both real pools once and leaves the actual token for ordinary carrying', () => {
    const s = ready(); finish(s, 'source-visit'); start(s, 'original-token'); invite(s, 'original-token'); act(s, { type: 'BORROW_TOKEN', caseId: 'original-token' }); const spiritual = s.spirituality, stamina = getSummoningMasterPartner(s).stamina;
    act(s, { type: 'COOPERATE', caseId: 'original-token' }, 100); expect(s.spirituality).toBe(spiritual - 3); expect(getSummoningMasterPartner(s).stamina).toBe(stamina - 8); expect(s.summoningMaster.life.token).toMatchObject({ location: 'YARD', custodian: 'PLAYER' }); reject(s, { type: 'COOPERATE', caseId: 'original-token' });
    act(s, { type: 'CARRY_TOKEN', caseId: 'original-token' }); close(s, 'original-token'); act(s, { type: 'REPORT', caseId: 'original-token' }); expect(a(s, 'original-token')).toMatchObject({ result: 'ORDINARY', spiritualitySpent: 9, guestStaminaSpent: 14 }); expect(s.progression.mastery['moon.s3.guest-cooperation']).toBe(0);
  });
  it('interrupts the real door after crossing without injury or deletion, and forces a genuine ordinary return', () => {
    const s = ready(); finish(s, 'source-visit'); finish(s, 'original-token'); start(s, 'interrupted-door'); invite(s, 'interrupted-door'); act(s, { type: 'INTERRUPT_GATE', caseId: 'interrupted-door' });
    expect(s.summoningMaster.life.gate).toMatchObject({ status: 'BROKEN', remainingSeconds: 0 }); expect(getSummoningMasterPartner(s)).toMatchObject({ location: 'YARD', health: 100, mind: 100 }); reject(s, { type: 'OPEN_GATE', caseId: 'interrupted-door' }); reject(s, { type: 'RETURN_GUEST', caseId: 'interrupted-door', method: 'GATE' }); close(s, 'interrupted-door'); act(s, { type: 'REPORT', caseId: 'interrupted-door' }); expect(a(s, 'interrupted-door')).toMatchObject({ result: 'ABILITY', gateInterrupted: true, guestTravelMetres: 30 }); expect(s.progression.mastery['moon.s3.bounded-summoning']).toBe(8);
  });
  it('failed door in the interruption case honestly records an unopened gate and ordinary evacuation', () => {
    const s = ready(); finish(s, 'source-visit'); finish(s, 'original-token'); start(s, 'interrupted-door'); consentAtHome(s, 'interrupted-door'); act(s, { type: 'RETURN_PLAYER', caseId: 'interrupted-door' }); act(s, { type: 'CONSENT_OWNER', caseId: 'interrupted-door' }); act(s, { type: 'OPEN_GATE', caseId: 'interrupted-door' }, 100); act(s, { type: 'VISIT_HOME', caseId: 'interrupted-door' }); act(s, { type: 'FETCH_GUEST', caseId: 'interrupted-door' }); reject(s, { type: 'INTERRUPT_GATE', caseId: 'interrupted-door' }); act(s, { type: 'OBSERVE_CLOSED_GATE', caseId: 'interrupted-door' }); close(s, 'interrupted-door'); act(s, { type: 'REPORT', caseId: 'interrupted-door' }); expect(a(s, 'interrupted-door')).toMatchObject({ result: 'ORDINARY', gateInterrupted: false, interruptionObserved: true, guestTravelMetres: 60 });
  });
  it('ordinary three-case route reaches acting100 with real journeys and no new ability mastery', () => {
    const s = ready(); for (const id of ['source-visit', 'original-token', 'interrupted-door'] as const) finish(s, id); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(120); expect(Object.values(s.progression.mastery)).toEqual([0, 0]); expect(getSummoningMasterPartner(s)).toMatchObject({ location: 'HOME', stamina: 100, gateCrossings: 0, ordinaryDistanceM: 180 }); expect(s.summoningMaster.life.playerTravelMetres).toBeGreaterThanOrEqual(360); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'source-visit' });
  });
  it('requires two AP at preparation, with all physical cleanup still available at zero AP', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'source-visit' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'source-visit', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'source-visit', method: 'ABILITY' }); act(s, { type: 'PERFORM', caseId: 'source-visit' }); invite(s, 'source-visit'); act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); close(s, 'source-visit'); expect(s.actionsRemaining).toBe(0); expect(hasSummoningMasterLifeLock(s)).toBe(false); reject(s, { type: 'REPORT', caseId: 'source-visit' });
  });
  it('returns by ordinary path when not enough guest stamina remains for the gate return', () => {
    const s = ready(); start(s, 'source-visit'); getSummoningMasterPartner(s).stamina = 6; invite(s, 'source-visit'); act(s, { type: 'VERIFY_GUEST', caseId: 'source-visit' }); expect(getSummoningMasterPartner(s).stamina).toBe(0); reject(s, { type: 'RETURN_GUEST', caseId: 'source-visit', method: 'GATE' }); close(s, 'source-visit'); expect(getSummoningMasterPartner(s)).toMatchObject({ location: 'HOME', stamina: 0 });
  });
  it('rest costs actual money and AP once per real week, restores only stamina and mind, and never heals', () => {
    const s = ready(), p = getSummoningMasterPartner(s); p.stamina = 40; p.mind = 70; p.health = 85; act(s, { type: 'REST_GUEST' }); expect(p).toMatchObject({ stamina: 70, mind: 80, health: 85, location: 'HOME' }); expect(s.cash).toBe(970); expect(s.actionsRemaining).toBe(99); expect(p.restHistory).toHaveLength(1); reject(s, { type: 'REST_GUEST' }); s.week++; act(s, { type: 'REST_GUEST' }); expect(p).toMatchObject({ stamina: 100, mind: 90, health: 85 }); expect(p.restHistory).toHaveLength(2); expect(s.cash).toBe(940);
  });
  it('never resurrects or replaces a dead combat guest, and no life lock is invented around its remains', () => {
    const s = ready(), p = getSummoningMasterPartner(s); p.location = 'YARD'; p.health = 0; p.status = 'DEAD'; const before = structuredClone(p); expect(returnSummoningMasterGuestOrdinarily(s)).toBe(0); expect(p).toEqual(before); expect(() => moveSummoningMasterPartner(s, 'HOME')).toThrow(); reject(s, { type: 'REST_GUEST' }); expect(hasSummoningMasterLifeLock(s)).toBe(false); expect(validateSummoningMasterLife(s)).toBe(true); expect(p.chime.owner).toBe('SM3-LUMEN');
  });
  it('exposes the authoritative body for combat return and includes encounter travel without duplicating pools', () => {
    const s = ready(), p = getSummoningMasterPartner(s); p.metWeek = s.week; s.summoningMaster.life.playerTravelMetres += 60; s.summoningMaster.life.clockSeconds += 60; moveSummoningMasterPartner(s, 'YARD'); p.stamina -= 6; p.gateCrossings++; expect(returnSummoningMasterGuestOrdinarily(s)).toBe(30); expect(p).toMatchObject({ location: 'HOME', stamina: 94, ordinaryDistanceM: 30 }); expect(s.summoningMaster.life.clockSeconds).toBe(90); expect(validateSummoningMasterLife(s)).toBe(true); expect(returnSummoningMasterGuestOrdinarily(s)).toBe(0);
  });
  it('preserves paid failed attempts when closed, refuses same-week retries and does not erase on cancellation', () => {
    const s = ready(); start(s, 'source-visit'); consentAtHome(s, 'source-visit'); act(s, { type: 'RETURN_PLAYER', caseId: 'source-visit' }); act(s, { type: 'OPEN_GATE', caseId: 'source-visit' }, 100); close(s, 'source-visit'); const before = structuredClone(a(s, 'source-visit')); reject(s, { type: 'PREPARE', caseId: 'source-visit', method: 'ABILITY' }); s.week++; act(s, { type: 'PREPARE', caseId: 'source-visit', method: 'ORDINARY' }); act(s, { type: 'WITHDRAW', caseId: 'source-visit' }); expect(a(s, 'source-visit')).toEqual(before); expect(s.spirituality).toBe(114);
  });
  it('keeps inherited papers in their old authoritative pool and blocks maintenance inside a life case', () => {
    const s = ready(), papers = s.witchKing.life.papers; act(s, { type: 'BUY_PAPERS' }); expect(s.witchKing.life.papers).toBe(papers); expect(papers).toHaveLength(3); expect(s.cash).toBe(940); act(s, { type: 'PREPARE_PAPER', paperId: papers[0]!.id }); expect(papers[0]!.status).toBe('PREPARED'); expect(s.spirituality).toBe(117); const view = projectSummoningMasterLife(s); view.inheritedPapers[0]!.status = 'CONSUMED'; expect(papers[0]!.status).toBe('PREPARED'); start(s, 'source-visit'); expect(blockSummoningMasterLife(s, { type: 'BUY_PAPERS' })).not.toBeNull();
  });
  it('rejects forged original identity, cloned chime, invalid mass and premature report without mutation', () => {
    for (const change of [(s: SliceState) => { s.summoningMaster.life.partner.id = 'COPY' as never; }, (s: SliceState) => { s.summoningMaster.life.partner.chime.owner = 'PLAYER' as never; }, (s: SliceState) => { s.summoningMaster.life.token.massGrams = 201 as never; }, (s: SliceState) => { s.summoningMaster.life.partner.health = 0; }, (s: SliceState) => { s.summoningMaster.life.gate.remainingSeconds = 40; }]) { const s = ready(); change(s); expect(validateSummoningMasterLife(s)).toBe(false); }
    const s = ready(); reject(s, { type: 'REPORT', caseId: 'source-visit' }); expect(validateSummoningMasterPartner(null)).toBe(false); for (const c of [{ type: 'SUMMON_ANGEL' }, { type: 'OPEN_GATE', caseId: 'source-visit', count: 10 }, { type: 'WAIT', caseId: 'source-visit', seconds: 0 }, { type: 'RETURN_GUEST', caseId: 'source-visit', method: 'DELETE' }, { type: 'REST_GUEST', health: 100 }]) expect(validateSummoningMasterActivityCommand(c)).toBe(false);
    s.summoningMaster.promotionWeek = null; expect(validateSummoningMasterLife(s)).toBe(true); s.summoningMaster.life.partner.stamina--; expect(validateSummoningMasterLife(s)).toBe(false); expect(createSummoningMasterLifeState().partner.chime.owner).toBe('SM3-LUMEN');
  });
});
