import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createProphecyMasterState } from '../../src/domain/prophecy-master/index.js';
import { advanceProphecyMasterLifeClock, applyProphecyMasterActivity, blockProphecyMasterLife, createProphecyMasterLifeState, hasProphecyMasterLifeLock, projectProphecyMasterLife, PROPHECY_MASTER_CASE_IDS, prophecyMasterLifeActions, validateProphecyMasterActivityCommand, validateProphecyMasterLife, type ProphecyMasterActivityCommand, type ProphecyMasterCaseId } from '../../src/domain/prophecy-master/life.js';

const ABILITY = 'hermit.s3.prophetic-glimpse';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit isolated directed fixture, never evidence of a naturally successful promotion or forecast. */
function ready(): SliceState {
  const s = createSliceRun('prophecy-life', sliceDefaultCreationSelection, 'prophecy-life');
  s.prophecyMaster = createProphecyMasterState(); s.week = 110; s.prophecyMaster.promotionWeek = 109; s.prophecyMaster.mysticActingAtPromotion = 100;
  s.progression = { pathwayId: 'hermit', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [ABILITY]: 0, 'hermit.s4.mystical-reenactment': 17 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: ProphecyMasterActivityCommand, roll = 1) { const ctx = context(s, roll); applyProphecyMasterActivity(s, command, ctx); expect(validateProphecyMasterLife(s), `${command.type}: ${JSON.stringify(s.prophecyMaster.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: ProphecyMasterCaseId, type: Exclude<ProphecyMasterActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'STATE_HYPOTHESIS'>, roll = 1) { return act(s, { type, caseId } as ProphecyMasterActivityCommand, roll); }
function reject(s: SliceState, command: ProphecyMasterActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyProphecyMasterActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: ProphecyMasterCaseId) => s.prophecyMaster.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: ProphecyMasterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); }
function borrow(s: SliceState, id: ProphecyMasterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { start(s, id, method); step(s, id, 'CONSENT_OWNER'); step(s, id, 'TAKE_RECORD'); }
function hypothesis(s: SliceState, id: 'bell-schedule' | 'covered-door', value: 'ALARM' | 'HANDOVER' = 'ALARM') { act(s, { type: 'STATE_HYPOTHESIS', caseId: id, hypothesis: value }); }
function finish(s: SliceState, id: ProphecyMasterCaseId) { for (const type of ['RETURN_START', 'RETURN_RECORD', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, id, type); }
function bell(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', value: 'ALARM' | 'HANDOVER' = 'ALARM') {
  const id = 'bell-schedule'; borrow(s, id, method); if (method === 'ABILITY') step(s, id, 'GLIMPSE', roll); hypothesis(s, id, value);
  for (const type of ['GO_A', 'READ_SCHEDULE', 'WITNESS_BELL', 'COMPARE_EVIDENCE'] as const) step(s, id, type); finish(s, id);
}
function parcel(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'covered-door'; borrow(s, id, method); if (method === 'ABILITY') step(s, id, 'GLIMPSE', roll); hypothesis(s, id);
  for (const type of ['GO_A', 'CHECK_DOOR', 'WALK_B', 'DELIVER_PARCEL', 'READ_DELIVERY', 'COMPARE_EVIDENCE', 'RETURN_A'] as const) step(s, id, type); finish(s, id);
}
function bounded(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'bounded-source'; borrow(s, id, method); if (method === 'ABILITY') step(s, id, 'GLIMPSE', roll);
  for (const type of ['GO_A', 'CHECK_WARNING', 'CLOSE_SHUTTER', 'STOP_INQUIRY', 'ORDINARY_CHECK', 'COMPARE_EVIDENCE'] as const) step(s, id, type); finish(s, id);
}

describe('Prophecy Master finite uncertain forecasts and later real evidence', () => {
  it('owns unique original objects and adult participants without exposing unobserved door conditions', () => {
    const s = ready(), l = s.prophecyMaster.life, view = projectProphecyMasterLife(s);
    expect(validateProphecyMasterLife(s)).toBe(true); expect(l).toEqual(createProphecyMasterLifeState());
    expect(l.owner).toMatchObject({ age: 49, location: 'START' }); expect(l.keeper).toMatchObject({ age: 44, location: 'A' }); expect(l.receiver).toMatchObject({ id: 'PM3-TOMAS', age: 37, location: 'B' });
    expect(l.parcel).toMatchObject({ id: 'PM3-PARCEL', quantity: 1, massGrams: 800, location: 'OWNER' }); expect(l.instrument).toMatchObject({ location: 'A', coreSealed: true, residualLevel: 1 });
    expect(new Set(Object.values(l.records).map(v => v.id)).size).toBe(3); expect(view.door.locked).toBeNull(); expect(view.curtain.state).toBeNull(); expect(view.bell.witnessedEvent).toBeNull();
  });
  it('PERFORM only opens the original scene and never silently casts or supplies a hypothesis', () => {
    const s = ready(); start(s, 'bell-schedule'); expect(s.actionsRemaining).toBe(97); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100);
    expect(attempt(s, 'bell-schedule')).toMatchObject({ glimpseTier: null, hypothesis: null, steps: [], ownerConsent: 'UNASKED' }); expect(s.prophecyMaster.life.playerLocation).toBe('START');
    reject(s, { type: 'GLIMPSE', caseId: 'bell-schedule' }); reject(s, { type: 'TAKE_RECORD', caseId: 'bell-schedule' });
  });
  it('pays the sole six-spirituality and two-mind forecast before any event and preserves uncertainty', () => {
    const s = ready(); borrow(s, 'bell-schedule'); const ctx = step(s, 'bell-schedule', 'GLIMPSE');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(attempt(s, 'bell-schedule').glimpseText).toContain('两声回响，原架暂空');
    expect(attempt(s, 'bell-schedule').evidence).toEqual([]); expect(attempt(s, 'bell-schedule').correction).toBeNull(); expect(projectProphecyMasterLife(s).bell.witnessedEvent).toBeNull(); expect(s.progression.mastery[ABILITY]).toBe(0);
    reject(s, { type: 'GLIMPSE', caseId: 'bell-schedule' }); reject(s, { type: 'COMPARE_EVIDENCE', caseId: 'bell-schedule' }); reject(s, { type: 'GO_A', caseId: 'bell-schedule' });
  });
  it('records a wrong ALARM hypothesis, actually waits twelve seconds, then corrects from witnessed evidence', () => {
    const s = ready(); borrow(s, 'bell-schedule'); step(s, 'bell-schedule', 'GLIMPSE'); hypothesis(s, 'bell-schedule'); step(s, 'bell-schedule', 'GO_A'); step(s, 'bell-schedule', 'READ_SCHEDULE');
    const before = attempt(s, 'bell-schedule').elapsedSeconds; expect(projectProphecyMasterLife(s).bell.witnessedEvent).toBeNull(); expect(attempt(s, 'bell-schedule').evidence).toHaveLength(1); expect(attempt(s, 'bell-schedule').evidence[0]!.text).toContain('不能确定下一次');
    reject(s, { type: 'COMPARE_EVIDENCE', caseId: 'bell-schedule' }); step(s, 'bell-schedule', 'WITNESS_BELL'); expect(attempt(s, 'bell-schedule').elapsedSeconds - before).toBe(12);
    expect(s.prophecyMaster.life.bell).toMatchObject({ support: 'RACK', rings: 2, witnessedEvent: 'HANDOVER', handling: [{ from: 'RACK', to: 'KEEPER', atSecond: before + 2 }, { from: 'KEEPER', to: 'RACK', atSecond: before + 12 }] });
    step(s, 'bell-schedule', 'COMPARE_EVIDENCE'); expect(attempt(s, 'bell-schedule').hypothesis).toBe('ALARM'); expect(attempt(s, 'bell-schedule').correction).toContain('否定并修正'); expect(s.progression.mastery[ABILITY]).toBe(0);
    const a = attempt(s, 'bell-schedule'); expect(a.glimpseAtSecond!).toBeLessThan(a.hypothesisAtSecond!); expect(a.hypothesisAtSecond!).toBeLessThan(a.evidence[0]!.atSecond); expect(a.evidence.at(-1)!.atSecond).toBeLessThan(a.comparedAtSecond!);
    finish(s, 'bell-schedule'); expect(s.progression.mastery[ABILITY]).toBe(8); expect(a.glimpseText).toContain('含义不明');
  });
  it('does not call a chosen matching hypothesis true until the actual event supplies evidence', () => {
    const s = ready(); bell(s, 1, 'ABILITY', 'HANDOVER'); expect(attempt(s, 'bell-schedule').hypothesis).toBe('HANDOVER'); expect(attempt(s, 'bell-schedule').correction).toContain('经实际事件核对才得到支持');
  });
  it('failure preserves full costs and permits an ordinary successful investigation without mastery', () => {
    const s = ready(); bell(s, 100); expect(attempt(s, 'bell-schedule')).toMatchObject({ glimpseTier: 'GREAT_FAILURE', result: 'ORDINARY', spiritualitySpent: 6, mindSpent: 2, bellWitnessed: true, compared: true });
    expect(attempt(s, 'bell-schedule').glimpseText).toContain('未得到可靠画面'); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(s.progression.acting).toBe(25); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('cannot backfill a paid forecast or change the original hypothesis after looking at real evidence', () => {
    const s = ready(); borrow(s, 'bell-schedule'); hypothesis(s, 'bell-schedule'); reject(s, { type: 'GLIMPSE', caseId: 'bell-schedule' }); step(s, 'bell-schedule', 'GO_A'); step(s, 'bell-schedule', 'READ_SCHEDULE');
    reject(s, { type: 'GLIMPSE', caseId: 'bell-schedule' }); reject(s, { type: 'STATE_HYPOTHESIS', caseId: 'bell-schedule', hypothesis: 'HANDOVER' });
  });
  it('physically carries two original items to the locked door and the original parcel along the side path', () => {
    const s = ready(); bell(s); borrow(s, 'covered-door'); step(s, 'covered-door', 'GLIMPSE'); hypothesis(s, 'covered-door'); const l = s.prophecyMaster.life;
    expect(l.records['covered-door'].location).toBe('PLAYER'); expect(l.parcel.location).toBe('PLAYER'); expect(projectProphecyMasterLife(s).door.locked).toBeNull(); step(s, 'covered-door', 'GO_A');
    reject(s, { type: 'WALK_B', caseId: 'covered-door' }); reject(s, { type: 'DELIVER_PARCEL', caseId: 'covered-door' }); step(s, 'covered-door', 'CHECK_DOOR'); expect(projectProphecyMasterLife(s).door.locked).toBe(true);
    step(s, 'covered-door', 'WALK_B'); expect(l.parcel).toMatchObject({ location: 'PLAYER', travelMetres: 18, massGrams: 800 }); expect(attempt(s, 'covered-door').playerMoves[1]).toMatchObject({ from: 'A', to: 'B', metres: 12, seconds: 12, itemIds: ['PM3-DOOR-RECORD', 'PM3-PARCEL'] });
    reject(s, { type: 'RETURN_START', caseId: 'covered-door' }); step(s, 'covered-door', 'DELIVER_PARCEL'); expect(l.parcel.location).toBe('RECEIVER'); expect(l.receipt).toMatchObject({ location: 'PLAYER', signed: true }); reject(s, { type: 'COMPARE_EVIDENCE', caseId: 'covered-door' });
    for (const type of ['READ_DELIVERY', 'COMPARE_EVIDENCE', 'RETURN_A'] as const) step(s, 'covered-door', type); finish(s, 'covered-door');
    expect(l.parcel).toMatchObject({ location: 'RECEIVER', travelMetres: 18 }); expect(l.receipt).toMatchObject({ location: 'OWNER', travelMetres: 18 }); expect(l.records['covered-door']).toMatchObject({ location: 'OWNER', travelMetres: 36 }); expect(attempt(s, 'covered-door').playerTravelMetres).toBe(36);
  });
  it('successful bounded glimpse still cannot reveal source, replace a real stop, or clear residual contamination', () => {
    const s = ready(); bell(s); parcel(s); borrow(s, 'bounded-source'); step(s, 'bounded-source', 'GLIMPSE'); expect(attempt(s, 'bounded-source').glimpseText).toContain('未辨来源');
    step(s, 'bounded-source', 'GO_A'); step(s, 'bounded-source', 'CHECK_WARNING'); reject(s, { type: 'ORDINARY_CHECK', caseId: 'bounded-source' }); step(s, 'bounded-source', 'CLOSE_SHUTTER'); reject(s, { type: 'ORDINARY_CHECK', caseId: 'bounded-source' });
    step(s, 'bounded-source', 'STOP_INQUIRY'); step(s, 'bounded-source', 'ORDINARY_CHECK'); step(s, 'bounded-source', 'COMPARE_EVIDENCE'); finish(s, 'bounded-source');
    expect(s.prophecyMaster.life.instrument).toMatchObject({ location: 'A', coreSealed: true, residualLevel: 1, checked: true }); expect(s.prophecyMaster.life.shutter).toMatchObject({ state: 'CLOSED', closures: 1 }); expect(attempt(s, 'bounded-source').correction).toContain('来源仍未查明'); expect(s.progression.mastery[ABILITY]).toBe(24);
  });
  it('a failed bounded forecast can stop immediately and finish the ordinary real comparison', () => {
    const s = ready(); bell(s, 100); parcel(s, 100); borrow(s, 'bounded-source'); step(s, 'bounded-source', 'GLIMPSE', 100); step(s, 'bounded-source', 'STOP_INQUIRY');
    for (const type of ['GO_A', 'CHECK_WARNING', 'CLOSE_SHUTTER', 'ORDINARY_CHECK', 'COMPARE_EVIDENCE'] as const) step(s, 'bounded-source', type); finish(s, 'bounded-source'); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.spirituality).toBe(102); expect(s.mind).toBe(94); expect(attempt(s, 'bounded-source').result).toBe('ORDINARY');
  });
  it('all three ordinary routes work at zero spirituality and spend thirteen AP without power rewards', () => {
    const s = ready(); s.spirituality = 0; bell(s, 1, 'ORDINARY'); parcel(s, 1, 'ORDINARY'); bounded(s, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.mind).toBe(100); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.prophecyMaster.life.playerTravelMetres).toBe(60); expect(s.prophecyMaster.life.clockSeconds).toBe(113);
  });
  it('finishes the thirteen AP route at eighteen spirituality, six mind and sixty real metres without changing old roots', () => {
    const s = ready(), old = structuredClone({ pryer: s.pryer, combatScholar: s.combatScholar, wizard: s.wizard, scrollProfessor: s.scrollProfessor, starMystic: s.starMystic, mystic: s.mystic }), character = structuredClone(s.character);
    bell(s); parcel(s); bounded(s); act(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(102); expect(s.mind).toBe(94); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toMatchObject({ [ABILITY]: 24, 'hermit.s4.mystical-reenactment': 17 });
    expect(s.character).toEqual(character); expect({ pryer: s.pryer, combatScholar: s.combatScholar, wizard: s.wizard, scrollProfessor: s.scrollProfessor, starMystic: s.starMystic, mystic: s.mystic }).toEqual(old);
    expect(s.prophecyMaster.life.playerTravelMetres).toBe(60); expect(PROPHECY_MASTER_CASE_IDS.map(id => attempt(s, id).elapsedSeconds)).toEqual([37, 53, 29]); expect(s.prophecyMaster.life.clockSeconds).toBe(119); expect(hasProphecyMasterLifeLock(s)).toBe(false);
    reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'bell-schedule' });
  });
  it('supports actual return at zero AP, spirituality and mind after owner consent is withdrawn', () => {
    const s = ready(); bell(s); borrow(s, 'covered-door'); step(s, 'covered-door', 'GLIMPSE'); hypothesis(s, 'covered-door'); step(s, 'covered-door', 'GO_A'); step(s, 'covered-door', 'CHECK_DOOR'); step(s, 'covered-door', 'WALK_B');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.prophecyMaster.life.owner.willing = false; reject(s, { type: 'DELIVER_PARCEL', caseId: 'covered-door' }); step(s, 'covered-door', 'WITHDRAW'); reject(s, { type: 'CLOSE', caseId: 'covered-door' }); reject(s, { type: 'RETURN_START', caseId: 'covered-door' });
    for (const type of ['RETURN_A', 'RETURN_START', 'RETURN_RECORD', 'INSPECT', 'WITHDRAW'] as const) step(s, 'covered-door', type);
    expect(hasProphecyMasterLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0); expect(s.mind).toBe(0); expect(s.prophecyMaster.life.parcel).toMatchObject({ location: 'OWNER', travelMetres: 36 }); expect(attempt(s, 'covered-door')).toMatchObject({ withdrawn: true, result: 'ORDINARY', spiritualitySpent: 6, mindSpent: 2 });
  });
  it('keeps a delivered original package at its willing receiver even when later inquiry is withdrawn', () => {
    const s = ready(); bell(s); borrow(s, 'covered-door', 'ORDINARY'); hypothesis(s, 'covered-door'); for (const type of ['GO_A', 'CHECK_DOOR', 'WALK_B', 'DELIVER_PARCEL'] as const) step(s, 'covered-door', type);
    s.prophecyMaster.life.receiver.willing = false; reject(s, { type: 'READ_DELIVERY', caseId: 'covered-door' }); step(s, 'covered-door', 'WITHDRAW'); for (const type of ['RETURN_A', 'RETURN_START', 'RETURN_RECORD', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, 'covered-door', type);
    expect(s.prophecyMaster.life.parcel).toMatchObject({ location: 'RECEIVER', travelMetres: 18 }); expect(s.prophecyMaster.life.receipt).toMatchObject({ location: 'OWNER', signed: true }); expect(attempt(s, 'covered-door').result).toBe('ORDINARY');
  });
  it('records a genuine owner refusal without rolling, then can withdraw and report honestly', () => {
    const s = ready(); start(s, 'bell-schedule'); s.prophecyMaster.life.owner.willing = false; const ctx = step(s, 'bell-schedule', 'CONSENT_OWNER'); expect(ctx.check).not.toHaveBeenCalled(); expect(attempt(s, 'bell-schedule').ownerConsent).toBe('DECLINED');
    reject(s, { type: 'TAKE_RECORD', caseId: 'bell-schedule' }); for (const type of ['WITHDRAW', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, 'bell-schedule', type);
    expect(s.prophecyMaster.life.playerTravelMetres).toBe(0); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.spirituality).toBe(120);
    s.prophecyMaster.life.owner.willing = true; start(s, 'covered-door'); expect(attempt(s, 'covered-door').ownerConsent).toBe('UNASKED'); reject(s, { type: 'TAKE_RECORD', caseId: 'covered-door' });
  });
  it('honors the keeper refusal before the future bell event instead of forcing it into the record', () => {
    const s = ready(); borrow(s, 'bell-schedule'); hypothesis(s, 'bell-schedule'); step(s, 'bell-schedule', 'GO_A'); s.prophecyMaster.life.keeper.willing = false; step(s, 'bell-schedule', 'READ_SCHEDULE');
    expect(attempt(s, 'bell-schedule').keeperConsent).toBe('DECLINED'); reject(s, { type: 'WITNESS_BELL', caseId: 'bell-schedule' }); step(s, 'bell-schedule', 'WITHDRAW'); finish(s, 'bell-schedule'); expect(s.prophecyMaster.life.bell.witnessedEvent).toBeNull(); expect(s.prophecyMaster.life.bell.rings).toBe(0);
  });
  it('honors a receiver refusal locally without consuming or copying the original parcel or receipt', () => {
    const s = ready(); bell(s); borrow(s, 'covered-door', 'ORDINARY'); hypothesis(s, 'covered-door'); for (const type of ['GO_A', 'CHECK_DOOR', 'WALK_B'] as const) step(s, 'covered-door', type);
    s.prophecyMaster.life.receiver.willing = false; const ctx = step(s, 'covered-door', 'DELIVER_PARCEL'); expect(ctx.check).not.toHaveBeenCalled(); expect(attempt(s, 'covered-door').receiverConsent).toBe('DECLINED'); expect(s.prophecyMaster.life.parcel.location).toBe('PLAYER'); expect(s.prophecyMaster.life.receipt).toMatchObject({ location: 'RECEIVER', signed: false });
    reject(s, { type: 'DELIVER_PARCEL', caseId: 'covered-door' }); step(s, 'covered-door', 'WITHDRAW'); step(s, 'covered-door', 'RETURN_A'); finish(s, 'covered-door'); expect(s.prophecyMaster.life.parcel.location).toBe('OWNER');
  });
  it('projects a blocked forecast with an available ordinary hypothesis when resources are insufficient', () => {
    const s = ready(); borrow(s, 'bell-schedule'); s.spirituality = 5; const actions = prophecyMasterLifeActions(s); expect(actions.find(a => a.command.type === 'GLIMPSE')).toMatchObject({ enabled: false }); expect(actions.filter(a => a.command.type === 'STATE_HYPOTHESIS')).toHaveLength(2); expect(projectProphecyMasterLife(s).nextStep).toContain('待验证');
    reject(s, { type: 'GLIMPSE', caseId: 'bell-schedule' }); s.spirituality = 6; s.mind = 1; expect(blockProphecyMasterLife(s, { type: 'GLIMPSE', caseId: 'bell-schedule' })).toContain('2精神');
  });
  it('requires a reserved implementation AP and permits prepared cancellation without a refund', () => {
    const s = ready(); step(s, 'bell-schedule', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'bell-schedule', method: 'ABILITY' }); s.actionsRemaining = 2;
    act(s, { type: 'PREPARE', caseId: 'bell-schedule', method: 'ABILITY' }); step(s, 'bell-schedule', 'WITHDRAW'); expect(s.actionsRemaining).toBe(1); expect(hasProphecyMasterLifeLock(s)).toBe(false); expect(s.prophecyMaster.life.cases['bell-schedule'].withdrawals).toBe(1);
  });
  it('keeps the dead original body and its held original objects in place', () => {
    const s = ready(); borrow(s, 'bell-schedule'); hypothesis(s, 'bell-schedule'); step(s, 'bell-schedule', 'GO_A'); s.health = 0; s.status = 'DEAD'; expect(validateProphecyMasterLife(s)).toBe(true);
    reject(s, { type: 'WITHDRAW', caseId: 'bell-schedule' }); reject(s, { type: 'RETURN_START', caseId: 'bell-schedule' }); expect(s.prophecyMaster.life.playerLocation).toBe('A'); expect(s.prophecyMaster.life.records['bell-schedule'].location).toBe('PLAYER');
  });
  it('rejects extra command fields, cross-case actions and invented high-source or instant-answer commands', () => {
    for (const value of [{ type: 'GLIMPSE', caseId: 'bell-schedule', answer: 'HANDOVER' }, { type: 'STATE_HYPOTHESIS', caseId: 'bell-schedule', hypothesis: 'TRUTH' }, { type: 'STATE_HYPOTHESIS', caseId: 'bounded-source', hypothesis: 'ALARM' }, { type: 'WITNESS_BELL', caseId: 'covered-door' }, { type: 'OPEN_CORE', caseId: 'bounded-source' }, { type: 'REVEAL_TRUTH', caseId: 'bell-schedule' }, { type: 'REFLECT', caseId: 'bell-schedule' }]) expect(validateProphecyMasterActivityCommand(value)).toBe(false);
  });
  it('replays exact uncertain text, wrong hypothesis, timing, original identities, costs and actual item movements', () => {
    const s = ready(); bell(s); parcel(s); bounded(s); act(s, { type: 'REFLECT' }); expect(validateProphecyMasterLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    const mutations: ((t: SliceState) => void)[] = [
      t => { attempt(t, 'bell-schedule').glimpseText = '确定是交接'; }, t => { attempt(t, 'bell-schedule').hypothesis = 'HANDOVER'; }, t => { attempt(t, 'bell-schedule').evidence[1]!.atSecond = 0; }, t => { attempt(t, 'bell-schedule').steps[2]!.atSecond = 0; },
      t => { attempt(t, 'covered-door').spiritualitySpent = 0; }, t => { attempt(t, 'covered-door').mindSpent = 0; }, t => { attempt(t, 'covered-door').playerMoves[1]!.metres = 0; }, t => { t.prophecyMaster.life.parcel.location = 'OWNER'; },
      t => { t.prophecyMaster.life.records['bell-schedule'].id = 'NEW-COPY'; }, t => { t.prophecyMaster.life.bell.rings = 0; }, t => { t.prophecyMaster.life.instrument.residualLevel = 0 as 1; }, t => { t.prophecyMaster.life.clockSeconds++; }, t => { t.progression.mastery[ABILITY] = 0; },
    ];
    for (const mutate of mutations) { const tampered = structuredClone(s); mutate(tampered); expect(validateProphecyMasterLife(tampered)).toBe(false); }
  });
  it('adds only recorded combat elapsed seconds and rejects an unexplained clock advance', () => {
    const s = ready(); bell(s); const seconds = s.prophecyMaster.life.clockSeconds; advanceProphecyMasterLifeClock(s, 60); expect(validateProphecyMasterLife(s)).toBe(false);
    s.combatHistory.push({ prophecyMasterOutcome: { elapsedSeconds: 60 } } as SliceState['combatHistory'][number]); expect(validateProphecyMasterLife(s)).toBe(true); expect(s.prophecyMaster.life.clockSeconds).toBe(seconds + 60);
    const before = structuredClone(s); expect(() => advanceProphecyMasterLifeClock(s, -1)).toThrow(); expect(s).toEqual(before);
  });
  it('counts the encounter independent real four-metre noncombat exit exactly once', () => {
    const s = ready(); const e = s.prophecyMaster.encounter; e.status = 'RESOLVED'; e.startHistoryIndex = null; e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres = 4;
    expect(validateProphecyMasterLife(s)).toBe(false); advanceProphecyMasterLifeClock(s, 4); expect(validateProphecyMasterLife(s)).toBe(true); advanceProphecyMasterLifeClock(s, 4); expect(validateProphecyMasterLife(s)).toBe(false);
  });
});
