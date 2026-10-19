import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSilentDiscipleState } from '../../src/domain/silent-disciple/index.js';
import { advanceSilentDiscipleLifeClock, applySilentDiscipleActivity, blockSilentDiscipleLife, createSilentDiscipleLifeState, hasSilentDiscipleLifeLock, projectSilentDiscipleLife, SILENT_DISCIPLE_CASE_IDS, silentDiscipleLifeActions, validateSilentDiscipleActivityCommand, validateSilentDiscipleLife, type SilentDiscipleActivityCommand, type SilentDiscipleCaseId } from '../../src/domain/silent-disciple/life.js';

const FORM = 'chained.s3.short-transfiguration', LINK = 'chained.s3.measured-curse';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Directed isolated fixture; no natural promotion or successful transfiguration is implied. */
function ready(): SliceState {
  const s = createSliceRun('silent-disciple-life', sliceDefaultCreationSelection, 'silent-disciple-life');
  s.silentDisciple = createSilentDiscipleState(); s.week = 110; s.silentDisciple.promotionWeek = 109; s.silentDisciple.puppetActingAtPromotion = 100;
  s.progression = { pathwayId: 'chained', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [FORM]: 0, [LINK]: 0, 'chained.s4.curse-source': 17 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: SilentDiscipleActivityCommand, roll = 1) { const ctx = context(s, roll); applySilentDiscipleActivity(s, command, ctx); expect(validateSilentDiscipleLife(s), command.type).toBe(true); return ctx; }
function step(s: SliceState, caseId: SilentDiscipleCaseId, type: Exclude<SilentDiscipleActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'READ_MOON_NOTICE' | 'GUIDED_REST' | 'ENDURE_REST' | 'WAIT_MOON'>, roll = 1) { return act(s, { type, caseId } as SilentDiscipleActivityCommand, roll); }
function reject(s: SliceState, command: SilentDiscipleActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applySilentDiscipleActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: SilentDiscipleCaseId) => s.silentDisciple.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: SilentDiscipleCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE'); }
function approach(s: SliceState, id: SilentDiscipleCaseId) { step(s, id, 'GO_A'); step(s, id, 'READ_IDENTITY'); }
function cast(s: SliceState, id: SilentDiscipleCaseId, roll = 1) { approach(s, id); if (id !== 'measured-link') step(s, id, 'STORE_ITEMS'); step(s, id, 'CONSENT_ELSA'); return step(s, id, 'PERFORM', roll); }
function evidence(s: SliceState, id: SilentDiscipleCaseId) { for (const type of ['WALK_B', 'READ_NOTE', 'RETURN_A', 'COMPARE_IDENTITY'] as const) step(s, id, type); }
function finish(s: SliceState, id: SilentDiscipleCaseId) { for (const type of ['RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, id, type); }
function complete(s: SliceState, id: SilentDiscipleCaseId, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', release = false) {
  start(s, id, method);
  if (method === 'ORDINARY') { approach(s, id); evidence(s, id); step(s, id, 'PERFORM'); }
  else {
    cast(s, id, roll); step(s, id, 'STOP_INPUT'); evidence(s, id);
    const a = attempt(s, id), succeeds = ['SUCCESS', 'GREAT_SUCCESS'].includes(String(a.abilityTier));
    if (id === 'measured-link') step(s, id, succeeds && release ? 'DROP_LINK' : 'WAIT_LINK');
    else { step(s, id, succeeds && release ? 'RELEASE_FORM' : 'WAIT_FORM'); step(s, id, 'RETURN_ITEMS'); }
    if (!succeeds) step(s, id, 'ORDINARY_CHECK');
  }
  finish(s, id);
}

describe('Silent Disciple same original body, actual objects and finite consent', () => {
  it('creates one original adult, original clothing bundle and bag, and labels all precise rules G', () => {
    const s = ready(), l = s.silentDisciple.life; expect(l).toEqual(createSilentDiscipleLifeState()); expect(validateSilentDiscipleLife(s)).toBe(true);
    expect(l.volunteer).toMatchObject({ id: 'SD3-ELSA', bodyId: 'SD3-ELSA', name: '埃尔莎·莫尔', age: 43, location: 'A', form: 'HUMAN', health: 100, mind: 100, spirituality: 100 });
    expect(l.clothing).toEqual({ id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true });
    expect(l.bag).toEqual({ id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' });
    expect(l.tray).toMatchObject({ id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' }); expect(l.note.id).toBe('SD3-NOTE');
    expect(projectSilentDiscipleLife(s).story).toContain('G'); expect(projectSilentDiscipleLife(s).story).toContain('仍未知');
  });
  it('START_CASE opens without moving, casting, storing items or granting consent', () => {
    const s = ready(); start(s, 'original-body'); expect(s.actionsRemaining).toBe(98); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100);
    expect(attempt(s, 'original-body')).toMatchObject({ consent: 'UNASKED', abilityTier: null, steps: [], resolutionPaid: false });
    expect(s.silentDisciple.life.playerLocation).toBe('START'); expect(s.silentDisciple.life.clothing.worn).toBe(true);
    reject(s, { type: 'PERFORM', caseId: 'original-body' }); reject(s, { type: 'READ_IDENTITY', caseId: 'original-body' });
  });
  it('requires original private item storage and current consent before changing the one body', () => {
    const s = ready(); start(s, 'original-body'); approach(s, 'original-body'); reject(s, { type: 'CONSENT_ELSA', caseId: 'original-body' });
    step(s, 'original-body', 'STORE_ITEMS'); expect(s.silentDisciple.life.clothing).toMatchObject({ location: 'TRAY', worn: false }); expect(s.silentDisciple.life.bag.location).toBe('TRAY');
    reject(s, { type: 'PERFORM', caseId: 'original-body' }); step(s, 'original-body', 'CONSENT_ELSA');
    const original = structuredClone(s.silentDisciple.life.volunteer), ctx = step(s, 'original-body', 'PERFORM');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 20); expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(s.actionsRemaining).toBe(97);
    expect(s.silentDisciple.life.volunteer).toEqual({ ...original, form: 'RABBIT' }); expect(attempt(s, 'original-body')).toMatchObject({ formRemainingSeconds: 60, abilitySourceId: 'SD3-ELSA', spiritualitySpent: 5, mindSpent: 2 });
    reject(s, { type: 'PERFORM', caseId: 'original-body' }); reject(s, { type: 'RETURN_ITEMS', caseId: 'original-body' });
  });
  for (const [roll, tier, succeeds] of [[1, 'GREAT_SUCCESS', true], [30, 'SUCCESS', true], [85, 'FAILURE', false], [100, 'GREAT_FAILURE', false]] as const) {
    it(`keeps all ${tier} costs and records only the actual paid effect`, () => {
      const s = ready(); complete(s, 'original-body', roll); expect(attempt(s, 'original-body').abilityTier).toBe(tier);
      expect(s.actionsRemaining).toBe(96); expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(s.progression.mastery[FORM]).toBe(succeeds ? 8 : 0);
      expect(attempt(s, 'original-body')).toMatchObject({ waitedSeconds: succeeds ? 49 : 0, ordinaryChecked: !succeeds, comparedForm: succeeds ? 'RABBIT' : 'HUMAN', result: succeeds ? 'ABILITY' : 'ORDINARY' });
      expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.silentDisciple.life.clothing.worn).toBe(true); expect(s.health).toBe(100);
    });
  }
  it('stopping does not instantly revert; walking advances duration and restoration does not dress her', () => {
    const s = ready(); start(s, 'original-body'); cast(s, 'original-body'); const before = s.silentDisciple.life.clockSeconds;
    step(s, 'original-body', 'STOP_INPUT'); expect(s.silentDisciple.life.clockSeconds).toBe(before); expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT');
    reject(s, { type: 'RECORD_OUTCOME', caseId: 'original-body' }); evidence(s, 'original-body'); expect(attempt(s, 'original-body').formRemainingSeconds).toBe(49);
    step(s, 'original-body', 'WAIT_FORM'); expect(s.silentDisciple.life.clockSeconds).toBe(before + 60); expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN');
    expect(s.silentDisciple.life.clothing).toMatchObject({ location: 'TRAY', worn: false }); expect(s.silentDisciple.life.bag.location).toBe('TRAY');
    reject(s, { type: 'RECORD_OUTCOME', caseId: 'original-body' }); reject(s, { type: 'RETURN_START', caseId: 'original-body' });
    step(s, 'original-body', 'RETURN_ITEMS'); finish(s, 'original-body'); reject(s, { type: 'WAIT_FORM', caseId: 'original-body' });
  });
  it('revokes the second case immediately after the actual attempt and charges optional release', () => {
    const s = ready(); complete(s, 'original-body'); start(s, 'revoked-form'); cast(s, 'revoked-form');
    expect(attempt(s, 'revoked-form')).toMatchObject({ consent: 'REVOKED', formRemainingSeconds: 60, inputActive: true });
    reject(s, { type: 'CONSENT_ELSA', caseId: 'revoked-form' }); reject(s, { type: 'PERFORM', caseId: 'revoked-form' }); reject(s, { type: 'RELEASE_FORM', caseId: 'revoked-form' });
    step(s, 'revoked-form', 'STOP_INPUT'); const resource = s.spirituality; step(s, 'revoked-form', 'RELEASE_FORM'); expect(s.spirituality).toBe(resource - 2);
    expect(s.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(s.silentDisciple.life.clothing.worn).toBe(false); expect(attempt(s, 'revoked-form')).toMatchObject({ spiritualitySpent: 7, mindSpent: 2, released: true, waitedSeconds: 0 });
    evidence(s, 'revoked-form'); step(s, 'revoked-form', 'RETURN_ITEMS'); finish(s, 'revoked-form'); expect(attempt(s, 'revoked-form').consent).toBe('REVOKED');
  });
  it('always allows living cleanup without AP, mind or spirituality, including the remaining real wait', () => {
    const s = ready(); start(s, 'original-body'); cast(s, 'original-body'); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    step(s, 'original-body', 'STOP_INPUT'); reject(s, { type: 'RELEASE_FORM', caseId: 'original-body' }); evidence(s, 'original-body'); step(s, 'original-body', 'WAIT_FORM');
    step(s, 'original-body', 'RETURN_ITEMS'); for (const type of ['RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE'] as const) step(s, 'original-body', type);
    expect(hasSilentDiscipleLifeLock(s)).toBe(false); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0); expect(s.mind).toBe(0); expect(s.health).toBe(100);
    reject(s, { type: 'REPORT_CASE', caseId: 'original-body' });
  });
  it('a current refusal cannot be reasked or overcome and has a truthful ordinary fallback', () => {
    const s = ready(); start(s, 'original-body'); approach(s, 'original-body'); step(s, 'original-body', 'STORE_ITEMS'); s.silentDisciple.life.volunteer.willing = false;
    const ctx = step(s, 'original-body', 'CONSENT_ELSA'); expect(ctx.check).not.toHaveBeenCalled(); expect(attempt(s, 'original-body').consent).toBe('DECLINED');
    reject(s, { type: 'CONSENT_ELSA', caseId: 'original-body' }); reject(s, { type: 'PERFORM', caseId: 'original-body' });
    evidence(s, 'original-body'); step(s, 'original-body', 'ORDINARY_CHECK'); step(s, 'original-body', 'RETURN_ITEMS'); finish(s, 'original-body');
    expect(s.progression.mastery[FORM]).toBe(0); expect(s.spirituality).toBe(120); expect(s.actionsRemaining).toBe(96);
  });
  it('withdrawal stops new input but leaves the current rabbit and original belongings until real cleanup', () => {
    const s = ready(); start(s, 'original-body'); cast(s, 'original-body'); step(s, 'original-body', 'WITHDRAW');
    expect(attempt(s, 'original-body')).toMatchObject({ consent: 'REVOKED', withdrawn: true, stopped: true, formRemainingSeconds: 60 });
    expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); reject(s, { type: 'RETURN_START', caseId: 'original-body' });
    evidence(s, 'original-body'); step(s, 'original-body', 'WAIT_FORM'); step(s, 'original-body', 'RETURN_ITEMS'); finish(s, 'original-body');
    expect(attempt(s, 'original-body')).toMatchObject({ waitedSeconds: 49, closed: true, withdrawn: true });
  });
  it('all three ordinary cases take exactly13 AP, real48m, no forms/links or imaginary mastery', () => {
    const s = ready(); s.spirituality = 0; const items = structuredClone({ clothing: s.silentDisciple.life.clothing, bag: s.silentDisciple.life.bag });
    for (const id of SILENT_DISCIPLE_CASE_IDS) complete(s, id, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.mind).toBe(100); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[FORM]).toBe(0); expect(s.progression.mastery[LINK]).toBe(0);
    expect(s.silentDisciple.life.playerTravelMetres).toBe(48); expect(s.silentDisciple.life.clockSeconds).toBe(69); expect({ clothing: s.silentDisciple.life.clothing, bag: s.silentDisciple.life.bag }).toEqual(items);
    expect(hasSilentDiscipleLifeLock(s)).toBe(false); for (const id of SILENT_DISCIPLE_CASE_IDS) expect(attempt(s, id)).toMatchObject({ abilityTier: null, result: 'ORDINARY', ordinaryChecked: true, itemsStored: false });
  });
  it('bounded contact only grants measured-link mastery after a real link and cannot injure the volunteer', () => {
    const s = ready(); complete(s, 'original-body'); complete(s, 'revoked-form'); start(s, 'measured-link'); const original = structuredClone(s.silentDisciple.life.volunteer), ctx = cast(s, 'measured-link');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(attempt(s, 'measured-link')).toMatchObject({ linkState: 'LINKED', linkRemainingSeconds: 30, spiritualitySpent: 4, mindSpent: 1, abilitySourceId: 'SD3-ELSA' });
    expect(s.silentDisciple.life.volunteer).toEqual(original); expect(s.health).toBe(100); reject(s, { type: 'STORE_ITEMS', caseId: 'measured-link' });
    step(s, 'measured-link', 'STOP_INPUT'); step(s, 'measured-link', 'DROP_LINK'); evidence(s, 'measured-link'); finish(s, 'measured-link'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(106); expect(s.mind).toBe(95); expect(s.progression.mastery[FORM]).toBe(16); expect(s.progression.mastery[LINK]).toBe(8); expect(s.progression.acting).toBe(100);
  });
  it('link wait counts actual remaining seconds after travel rather than resetting a30s window', () => {
    const s = ready(); complete(s, 'original-body'); complete(s, 'revoked-form'); start(s, 'measured-link'); cast(s, 'measured-link'); step(s, 'measured-link', 'STOP_INPUT'); evidence(s, 'measured-link');
    expect(attempt(s, 'measured-link').linkRemainingSeconds).toBe(19); step(s, 'measured-link', 'WAIT_LINK'); expect(attempt(s, 'measured-link')).toMatchObject({ linkRemainingSeconds: 0, linkState: 'NONE', waitedSeconds: 19 }); finish(s, 'measured-link');
  });
  it('withdrawing a real link drops it without refund, injury or a false waiting record', () => {
    const s = ready(); complete(s, 'original-body'); complete(s, 'revoked-form'); start(s, 'measured-link'); cast(s, 'measured-link'); const cost = s.spirituality;
    step(s, 'measured-link', 'WITHDRAW'); expect(attempt(s, 'measured-link')).toMatchObject({ withdrawn: true, consent: 'REVOKED', linkState: 'NONE', released: true, waitedSeconds: 0 });
    evidence(s, 'measured-link'); finish(s, 'measured-link'); expect(s.spirituality).toBe(cost); expect(s.health).toBe(100);
  });
  it('retains all six old roots and preserves failures while reports still earn acting', () => {
    const s = ready(), old = structuredClone({ prisoner: s.prisoner, madman: s.madman, werewolf: s.werewolf, zombie: s.zombie, wraith: s.wraith, puppet: s.puppet });
    for (const id of SILENT_DISCIPLE_CASE_IDS) complete(s, id, 100); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[FORM]).toBe(0); expect(s.progression.mastery[LINK]).toBe(0); expect(s.spirituality).toBe(106); expect(s.mind).toBe(95);
    expect({ prisoner: s.prisoner, madman: s.madman, werewolf: s.werewolf, zombie: s.zombie, wraith: s.wraith, puppet: s.puppet }).toEqual(old);
    reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT_CASE', caseId: 'original-body' });
  });
  it('shows an unaffordable paid attempt and the reachable ordinary fallback without inventing success', () => {
    const s = ready(); start(s, 'original-body'); approach(s, 'original-body'); step(s, 'original-body', 'STORE_ITEMS'); step(s, 'original-body', 'CONSENT_ELSA'); s.spirituality = 4;
    expect(silentDiscipleLifeActions(s).find(v => v.command.type === 'PERFORM')).toMatchObject({ enabled: false }); expect(blockSilentDiscipleLife(s, { type: 'PERFORM', caseId: 'original-body' })).toContain('5灵性');
    evidence(s, 'original-body'); expect(silentDiscipleLifeActions(s).find(v => v.command.type === 'ORDINARY_CHECK')).toMatchObject({ enabled: true });
  });
  it('reserves first implementation AP and permits cancellation without refunding preparation', () => {
    const s = ready(); step(s, 'original-body', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'original-body', method: 'ABILITY' });
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'original-body', method: 'ABILITY' }); step(s, 'original-body', 'WITHDRAW'); expect(s.actionsRemaining).toBe(1); expect(hasSilentDiscipleLifeLock(s)).toBe(false);
  });
  it('rejects extra targets, unsafe life combat, invented forms, wrong cases and extra confirmation data', () => {
    for (const command of [{ type: 'PERFORM', caseId: 'original-body', targetId: 'ANYONE' }, { type: 'PERFORM', caseId: 'original-body', form: 'PERMANENT_RABBIT' }, { type: 'COMBAT', caseId: 'measured-link' }, { type: 'SELF_HARM', caseId: 'measured-link' }, { type: 'DROP_LINK', caseId: 'original-body' }, { type: 'WAIT_FORM', caseId: 'measured-link' }, { type: 'REFLECT', caseId: 'original-body' }, { type: 'GUIDED_REST', confirmed: true }]) expect(validateSilentDiscipleActivityCommand(command)).toBe(false);
  });
  it('strictly replays original identities, ownership, form, elapsed time, source, consent and paid costs', () => {
    const s = ready(); for (const id of SILENT_DISCIPLE_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' }); expect(validateSilentDiscipleLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    const mutations: ((t: SliceState) => void)[] = [
      t => { t.silentDisciple.life.volunteer.bodyId = 'COPY' as 'SD3-ELSA'; }, t => { t.silentDisciple.life.volunteer.form = 'RABBIT'; }, t => { t.silentDisciple.life.volunteer.age = 17 as 43; }, t => { t.silentDisciple.life.volunteer.health = 80 as 100; },
      t => { t.silentDisciple.life.clothing.quantity = 2 as 1; }, t => { t.silentDisciple.life.clothing.owner = 'PLAYER' as 'SD3-ELSA'; }, t => { t.silentDisciple.life.clothing.location = 'TRAY'; }, t => { t.silentDisciple.life.bag.location = 'TRAY'; },
      t => { attempt(t, 'original-body').abilitySourceId = null; }, t => { attempt(t, 'original-body').spiritualitySpent = 0; }, t => { attempt(t, 'original-body').mindSpent = 0; }, t => { attempt(t, 'original-body').resolutionActions = 0; },
      t => { attempt(t, 'original-body').waitedSeconds = 60; }, t => { attempt(t, 'original-body').playerMoves[1]!.metres = 0; }, t => { attempt(t, 'original-body').steps[0]!.atSecond++; },
      t => { attempt(t, 'revoked-form').consent = 'GRANTED'; }, t => { attempt(t, 'measured-link').linkState = 'LINKED'; }, t => { t.silentDisciple.life.clockSeconds++; }, t => { t.progression.mastery[FORM] = 0; }, t => { t.progression.mastery[LINK] = 0; },
    ];
    for (const mutate of mutations) { const t = structuredClone(s); mutate(t); expect(validateSilentDiscipleLife(t)).toBe(false); }
  });
  it('blocks dead player operations without silently healing, reversion or moving a body', () => {
    const s = ready(); start(s, 'original-body'); cast(s, 'original-body'); step(s, 'original-body', 'STOP_INPUT'); s.status = 'DEAD'; s.health = 0;
    expect(validateSilentDiscipleLife(s)).toBe(true); reject(s, { type: 'WAIT_FORM', caseId: 'original-body' }); reject(s, { type: 'WITHDRAW', caseId: 'original-body' }); reject(s, { type: 'RETURN_START', caseId: 'original-body' });
    expect(s.silentDisciple.life.volunteer.form).toBe('RABBIT'); expect(() => advanceSilentDiscipleLifeClock(s, -1)).toThrow(); expect(() => advanceSilentDiscipleLifeClock(s, 0.5)).toThrow();
  });
});

describe('Silent Disciple finite original G observatory notice', () => {
  it('is optional until read, requires two actual postpromotion weeks, and does not infer week modulo4', () => {
    const s = ready(); reject(s, { type: 'READ_MOON_NOTICE' }); expect(hasSilentDiscipleLifeLock(s)).toBe(false);
    s.week = 111; expect(s.week % 4).not.toBe(0); act(s, { type: 'READ_MOON_NOTICE' }); expect(s.silentDisciple.life.moon).toMatchObject({ id: 'SD3-OBSERVATORY-NOTICE', status: 'ANNOUNCED', announcedWeek: 111 });
    expect(hasSilentDiscipleLifeLock(s)).toBe(true); expect(s.actionsRemaining).toBe(100); reject(s, { type: 'OBSERVE', caseId: 'original-body' }); reject(s, { type: 'READ_MOON_NOTICE' });
    expect(projectSilentDiscipleLife(s).actions.find(v => v.command.type === 'GUIDED_REST')?.cost).toContain('60便士'); expect(projectSilentDiscipleLife(s).actions.find(v => v.command.type === 'ENDURE_REST')?.cost).toContain('18精神');
  });
  for (const [method, cash, mental] of [['GUIDED_REST', 60, 8], ['ENDURE_REST', 0, 18]] as const) {
    it(`${method} pays once, waits real3600 seconds and neither heals nor refunds`, () => {
      const s = ready(); s.week = 111; s.health = 70; act(s, { type: 'READ_MOON_NOTICE' }); act(s, { type: method });
      expect(s.cash).toBe(1000 - cash); expect(s.mind).toBe(100 - mental); expect(s.actionsRemaining).toBe(99); expect(s.silentDisciple.life.clockSeconds).toBe(0);
      expect(s.silentDisciple.life.moon).toMatchObject({ status: 'RESTING', remainingSeconds: 3600, cashSpent: cash, mindSpent: mental }); reject(s, { type: method });
      s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'WAIT_MOON' }); expect(s.silentDisciple.life.moon).toMatchObject({ status: 'RESOLVED', remainingSeconds: 0, elapsedSeconds: 3600 });
      expect(s.silentDisciple.life.clockSeconds).toBe(3600); expect(s.health).toBe(70); expect(s.spirituality).toBe(0); expect(s.progression.acting).toBe(0); expect(hasSilentDiscipleLifeLock(s)).toBe(false);
      reject(s, { type: 'WAIT_MOON' }); reject(s, { type: 'READ_MOON_NOTICE' });
    });
  }
  it('keeps zero-money and zero-mind resolution reachable and cannot be read during active original-body work', () => {
    const s = ready(); s.week = 111; start(s, 'original-body'); reject(s, { type: 'READ_MOON_NOTICE' });
    const t = ready(); t.week = 111; t.cash = 0; t.mind = 3; act(t, { type: 'READ_MOON_NOTICE' }); reject(t, { type: 'GUIDED_REST' }); act(t, { type: 'ENDURE_REST' }); expect(t.mind).toBe(0); act(t, { type: 'WAIT_MOON' }); expect(t.health).toBe(100);
  });
  it('rejects fabricated moon costs, repeated elapsed time and a pending notice with another actual scene', () => {
    const s = ready(); s.week = 111; act(s, { type: 'READ_MOON_NOTICE' }); act(s, { type: 'GUIDED_REST' }); act(s, { type: 'WAIT_MOON' });
    for (const mutate of [(t: SliceState) => { t.silentDisciple.life.moon.cashSpent = 0; }, (t: SliceState) => { t.silentDisciple.life.moon.mindSpent = 0; }, (t: SliceState) => { t.silentDisciple.life.moon.elapsedSeconds = 7200; }, (t: SliceState) => { t.silentDisciple.life.moon.announcedWeek = 110; }]) { const t = structuredClone(s); mutate(t); expect(validateSilentDiscipleLife(t)).toBe(false); }
    const pending = ready(); pending.week = 111; act(pending, { type: 'READ_MOON_NOTICE' }); pending.silentDisciple.encounter.status = 'READY'; expect(validateSilentDiscipleLife(pending)).toBe(false);
  });
});
