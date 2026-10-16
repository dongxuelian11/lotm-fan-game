import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createDeceitMentorState } from '../../src/domain/deceit-mentor/index.js';
import { applyDeceitMentorActivity, blockDeceitMentorLife, createDeceitMentorLifeState, DECEIT_MENTOR_CASE_IDS, deceitMentorLifeActions, hasDeceitMentorLifeLock, projectDeceitMentorLife, validateDeceitMentorActivityCommand, validateDeceitMentorLife, type DeceitMentorActivityCommand, type DeceitMentorCaseId } from '../../src/domain/deceit-mentor/life.js';

const LAW = 'error.s3.law-deceit', DEEP = 'error.s3.deep-deception';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit directed isolated product fixture, never evidence of naturally reaching sequence 3. */
function ready(): SliceState {
  const s = createSliceRun('deceit-mentor-life', sliceDefaultCreationSelection, 'deceit-mentor-life');
  s.deceitMentor = createDeceitMentorState(); s.week = 110; s.deceitMentor.promotionWeek = 109; s.deceitMentor.parasiteActingAtPromotion = 100;
  s.progression = { pathwayId: 'error', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [LAW]: 0, [DEEP]: 0, 'error.s4.parasitism': 37 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: DeceitMentorActivityCommand, roll = 1) { const ctx = context(s, roll); applyDeceitMentorActivity(s, command, ctx); expect(validateDeceitMentorLife(s), `${command.type}: ${JSON.stringify(s.deceitMentor.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: DeceitMentorCaseId, type: Exclude<DeceitMentorActivityCommand['type'], 'PREPARE' | 'REFLECT'>, roll = 1) { return act(s, { type, caseId } as DeceitMentorActivityCommand, roll); }
function reject(s: SliceState, command: DeceitMentorActivityCommand) { const before = structuredClone(s); const ctx = context(s); expect(() => applyDeceitMentorActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: DeceitMentorCaseId) => s.deceitMentor.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: DeceitMentorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); }
function arrive(s: SliceState, id: DeceitMentorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { start(s, id, method); for (const type of ['CONSENT_OWNER', 'TAKE_ITEM', 'GO_SITE', 'CONSENT_WITNESS'] as const) step(s, id, type); }
function close(s: SliceState, id: DeceitMentorCaseId) { for (const type of ['RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, id, type); }
function lamp(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'spent-lamp'; arrive(s, id, method); step(s, id, 'LIGHT_LAMP'); if (method === 'ABILITY') step(s, id, 'EXTEND_LIGHT', roll);
  if (!['SUCCESS', 'GREAT_SUCCESS'].includes(attempt(s, id).abilityTier ?? '')) step(s, id, 'LIGHT_CANDLE');
  step(s, id, 'READ_PLATE'); step(s, id, 'EXTINGUISH'); close(s, id);
}
function tag(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'falling-tag'; arrive(s, id, method); step(s, id, method === 'ABILITY' ? 'DELAY_TAG' : 'RELEASE_TAG', roll);
  if (s.deceitMentor.life.tag.location === 'TRAY') step(s, id, 'RECOVER_TAG'); step(s, id, 'READ_TAG');
  if (s.deceitMentor.life.tag.location === 'AIR') { step(s, id, 'WAIT_EFFECT'); step(s, id, 'RECOVER_TAG'); } close(s, id);
}
function card(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'witness-correction'; arrive(s, id, method); step(s, id, 'PLACE_CARD'); step(s, id, 'READ_CARD'); if (method === 'ABILITY') step(s, id, 'MISDIRECT', roll);
  step(s, id, 'FLIP_CARD'); if (s.deceitMentor.life.card.deceptionSeconds) step(s, id, 'STOP_EFFECT');
  for (const type of ['VERIFY_CARD', 'RECOVER_CARD', 'RETURN_WITNESS'] as const) step(s, id, type); close(s, id);
}

describe('Deceit Mentor finite originals, independent consent and expiring G effects', () => {
  it('starts with exactly one original of each object and one body per independently willing adult', () => {
    const s = ready(), l = s.deceitMentor.life; expect(validateDeceitMentorLife(s)).toBe(true);
    expect(l.edith).toMatchObject({ id: 'DM3-EDITH', age: 43, location: 'START' }); expect(l.basil).toMatchObject({ id: 'DM3-BASIL', age: 39, location: 'BENCH' });
    for (const key of ['lamp', 'candle', 'plate', 'tag', 'tray', 'card', 'frame'] as const) expect(l[key].quantity).toBe(1);
    expect(l.lamp).toMatchObject({ oil: 1, lit: false }); expect(l.candle).toMatchObject({ remaining: 1, burnSeconds: 40 }); expect(l.card.face).toBe('FRONT');
  });
  it('uses existing flame to add sixteen seconds without refilling oil, then returns the same lamp', () => {
    const s = ready(); arrive(s, 'spent-lamp'); step(s, 'spent-lamp', 'LIGHT_LAMP'); expect(s.deceitMentor.life.lamp).toMatchObject({ oil: 0, lit: true, wickSeconds: 20 });
    reject(s, { type: 'READ_PLATE', caseId: 'spent-lamp' }); const ctx = step(s, 'spent-lamp', 'EXTEND_LIGHT'); expect(ctx.check).toHaveBeenCalledWith('knowledge', 18);
    expect(s.deceitMentor.life.lamp).toMatchObject({ oil: 0, wickSeconds: 19, extensionSeconds: 16, extensionUsed: true }); expect(s.spirituality).toBe(114);
    reject(s, { type: 'EXTEND_LIGHT', caseId: 'spent-lamp' }); step(s, 'spent-lamp', 'READ_PLATE'); expect(attempt(s, 'spent-lamp')).toMatchObject({ plateRead: true, plateReadBy: 'LAMP', result: 'ABILITY' });
    reject(s, { type: 'RETURN_PLAYER', caseId: 'spent-lamp' }); step(s, 'spent-lamp', 'EXTINGUISH'); close(s, 'spent-lamp');
    expect(s.deceitMentor.life.lamp).toMatchObject({ location: 'OWNER', oil: 0, lit: false, extensionSeconds: 0, travelMetres: 12 }); expect(s.deceitMentor.life.candle.remaining).toBe(1); expect(s.progression.mastery[LAW]).toBe(8);
  });
  it.each([80, 100])('preserves failed extension roll %s and consumes the sole ordinary candle', roll => {
    const s = ready(); lamp(s, roll);
    expect(attempt(s, 'spent-lamp')).toMatchObject({ result: 'ORDINARY', spiritualitySpent: 6, lampOilSpent: 1, candleSpent: 1, plateReadBy: 'CANDLE' });
    expect(s.deceitMentor.life.lamp).toMatchObject({ oil: 0, extensionUsed: true, lit: false }); expect(s.deceitMentor.life.candle).toMatchObject({ remaining: 0, lit: false, burnSeconds: 16 }); expect(s.progression.mastery[LAW]).toBe(0);
  });
  it('cannot reignite an expired oil-less lamp and does not recharge its consumed fallback', () => {
    const s = ready(); arrive(s, 'spent-lamp'); step(s, 'spent-lamp', 'LIGHT_LAMP'); step(s, 'spent-lamp', 'WAIT_EFFECT');
    expect(s.deceitMentor.life.lamp).toMatchObject({ oil: 0, lit: false, wickSeconds: 0 }); reject(s, { type: 'LIGHT_LAMP', caseId: 'spent-lamp' }); reject(s, { type: 'EXTEND_LIGHT', caseId: 'spent-lamp' });
    step(s, 'spent-lamp', 'LIGHT_CANDLE'); reject(s, { type: 'LIGHT_CANDLE', caseId: 'spent-lamp' }); step(s, 'spent-lamp', 'READ_PLATE'); step(s, 'spent-lamp', 'EXTINGUISH'); close(s, 'spent-lamp'); expect(s.deceitMentor.life.candle.burnSeconds).toBe(16);
  });
  it('exhausts a successful finite extension through actual waiting instead of keeping eternal light', () => {
    const s = ready(); arrive(s, 'spent-lamp'); step(s, 'spent-lamp', 'LIGHT_LAMP'); step(s, 'spent-lamp', 'EXTEND_LIGHT'); step(s, 'spent-lamp', 'WAIT_EFFECT');
    expect(s.deceitMentor.life.lamp).toMatchObject({ oil: 0, lit: false, wickSeconds: 0, extensionSeconds: 0 }); reject(s, { type: 'READ_PLATE', caseId: 'spent-lamp' });
    step(s, 'spent-lamp', 'LIGHT_CANDLE'); step(s, 'spent-lamp', 'READ_PLATE'); step(s, 'spent-lamp', 'EXTINGUISH'); close(s, 'spent-lamp'); expect(s.progression.mastery[LAW]).toBe(0);
  });
  it('releases the same tag for eight seconds, reads five, expires onto the actual original tray', () => {
    const s = ready(); lamp(s); arrive(s, 'falling-tag'); step(s, 'falling-tag', 'DELAY_TAG'); expect(s.deceitMentor.life.tag).toMatchObject({ location: 'AIR', delaySeconds: 8, quantity: 1 });
    reject(s, { type: 'RECOVER_TAG', caseId: 'falling-tag' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'falling-tag' }); step(s, 'falling-tag', 'READ_TAG'); expect(s.deceitMentor.life.tag.delaySeconds).toBe(3);
    step(s, 'falling-tag', 'WAIT_EFFECT'); expect(s.deceitMentor.life.tag).toMatchObject({ location: 'TRAY', delaySeconds: 0 }); reject(s, { type: 'RETURN_ITEM', caseId: 'falling-tag' });
    step(s, 'falling-tag', 'RECOVER_TAG'); close(s, 'falling-tag'); expect(s.deceitMentor.life.tag).toMatchObject({ location: 'OWNER', travelMetres: 12 }); expect(attempt(s, 'falling-tag').tagReadWhile).toBe('AIR');
  });
  it('drops a failed tag immediately and requires ordinary physical pickup before reading', () => {
    const s = ready(); lamp(s); arrive(s, 'falling-tag'); step(s, 'falling-tag', 'DELAY_TAG', 100); expect(s.deceitMentor.life.tag.location).toBe('TRAY');
    reject(s, { type: 'READ_TAG', caseId: 'falling-tag' }); reject(s, { type: 'DELAY_TAG', caseId: 'falling-tag' }); step(s, 'falling-tag', 'RECOVER_TAG'); step(s, 'falling-tag', 'READ_TAG'); close(s, 'falling-tag');
    expect(attempt(s, 'falling-tag')).toMatchObject({ abilityTier: 'GREAT_FAILURE', result: 'ORDINARY', spiritualitySpent: 6, tagReadWhile: 'PLAYER' }); expect(s.progression.mastery[LAW]).toBe(8);
  });
  it('may stop tag suspension early but never remotely retrieves the fallen original', () => {
    const s = ready(); lamp(s); arrive(s, 'falling-tag'); step(s, 'falling-tag', 'DELAY_TAG'); step(s, 'falling-tag', 'STOP_CONTACT'); s.actionsRemaining = 0; s.spirituality = 0;
    expect(s.deceitMentor.life.tag.location).toBe('TRAY'); reject(s, { type: 'RETURN_PLAYER', caseId: 'falling-tag' }); reject(s, { type: 'WITHDRAW', caseId: 'falling-tag' });
    for (const type of ['RECOVER_TAG', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE'] as const) step(s, 'falling-tag', type);
    expect(s.deceitMentor.life.tag.location).toBe('OWNER'); expect(hasDeceitMentorLifeLock(s)).toBe(false); expect(attempt(s, 'falling-tag').result).toBe('ORDINARY');
  });
  it('expires tag delay without a read and records a later hand-held read as ordinary', () => {
    const s = ready(); lamp(s); arrive(s, 'falling-tag'); step(s, 'falling-tag', 'DELAY_TAG'); step(s, 'falling-tag', 'WAIT_EFFECT'); step(s, 'falling-tag', 'RECOVER_TAG'); step(s, 'falling-tag', 'READ_TAG'); close(s, 'falling-tag'); expect(attempt(s, 'falling-tag').result).toBe('ORDINARY');
  });
  it('records the original wrong judgement then explicitly corrects it after an ordinary flip', () => {
    const s = ready(); lamp(s); tag(s); arrive(s, 'witness-correction'); expect(s.deceitMentor.life.basil).toMatchObject({ location: 'CABINET', travelMetres: 4 });
    step(s, 'witness-correction', 'PLACE_CARD'); step(s, 'witness-correction', 'READ_CARD'); step(s, 'witness-correction', 'MISDIRECT');
    expect(s.deceitMentor.life.card).toMatchObject({ face: 'FRONT', deceptionSeconds: 6, location: 'FRAME' }); expect(attempt(s, 'witness-correction')).toMatchObject({ originalFace: 'FRONT', observedFaceBeforeCorrection: 'BACK', correctionMade: false });
    reject(s, { type: 'VERIFY_CARD', caseId: 'witness-correction' }); reject(s, { type: 'RECOVER_CARD', caseId: 'witness-correction' }); step(s, 'witness-correction', 'FLIP_CARD'); expect(s.deceitMentor.life.card).toMatchObject({ face: 'BACK', deceptionSeconds: 4 });
    step(s, 'witness-correction', 'WAIT_EFFECT'); expect(s.deceitMentor.life.card.deceptionSeconds).toBe(0); reject(s, { type: 'RETURN_WITNESS', caseId: 'witness-correction' });
    step(s, 'witness-correction', 'VERIFY_CARD'); expect(attempt(s, 'witness-correction')).toMatchObject({ observedFaceBeforeCorrection: 'BACK', correctedOriginalFace: 'FRONT', verifiedFace: 'BACK', correctionMade: true, result: 'ABILITY' });
    step(s, 'witness-correction', 'RECOVER_CARD'); reject(s, { type: 'RETURN_PLAYER', caseId: 'witness-correction' }); step(s, 'witness-correction', 'RETURN_WITNESS'); close(s, 'witness-correction');
    expect(s.deceitMentor.life.basil).toMatchObject({ location: 'BENCH', travelMetres: 8 }); expect(s.deceitMentor.life.card).toMatchObject({ location: 'OWNER', face: 'BACK', travelMetres: 20 }); expect(s.progression.mastery[DEEP]).toBe(8);
  });
  it('preserves failed deep deception as identified correctly and gives no mastery', () => {
    const s = ready(); lamp(s); tag(s); card(s, 100); expect(attempt(s, 'witness-correction')).toMatchObject({ abilityTier: 'GREAT_FAILURE', observedFaceBeforeCorrection: 'FRONT', correctedOriginalFace: 'FRONT', verifiedFace: 'BACK', result: 'ORDINARY', spiritualitySpent: 6 }); expect(s.progression.mastery[DEEP]).toBe(0);
  });
  it('still corrects an existing card error and physically returns all originals after consent is withdrawn', () => {
    const s = ready(); lamp(s); tag(s); arrive(s, 'witness-correction'); for (const type of ['PLACE_CARD', 'READ_CARD', 'MISDIRECT'] as const) step(s, 'witness-correction', type);
    s.deceitMentor.life.edith.willing = false; s.deceitMentor.life.basil.willing = false; s.actionsRemaining = 0; s.spirituality = 0;
    step(s, 'witness-correction', 'STOP_CONTACT'); reject(s, { type: 'RECOVER_CARD', caseId: 'witness-correction' });
    for (const type of ['FLIP_CARD', 'VERIFY_CARD', 'RECOVER_CARD', 'RETURN_WITNESS', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE'] as const) step(s, 'witness-correction', type);
    expect(attempt(s, 'witness-correction')).toMatchObject({ observedFaceBeforeCorrection: 'BACK', correctedOriginalFace: 'FRONT', correctionMade: true }); expect(hasDeceitMentorLifeLock(s)).toBe(false);
  });
  it('does not force a refusing witness to walk to the card scene or to agree by rolling', () => {
    const s = ready(); lamp(s); tag(s); s.deceitMentor.life.basil.willing = false; arrive(s, 'witness-correction');
    expect(attempt(s, 'witness-correction').witnessConsent).toBe('DECLINED'); expect(s.deceitMentor.life.basil).toMatchObject({ location: 'BENCH', travelMetres: 0 }); reject(s, { type: 'PLACE_CARD', caseId: 'witness-correction' }); reject(s, { type: 'MISDIRECT', caseId: 'witness-correction' });
    step(s, 'witness-correction', 'STOP_CONTACT'); close(s, 'witness-correction'); expect(s.progression.mastery[DEEP]).toBe(0); expect(s.deceitMentor.life.card.face).toBe('FRONT');
  });
  it('requires independent owner consent in each case and permits refusal without borrowing anything', () => {
    const s = ready(); lamp(s); start(s, 'falling-tag'); reject(s, { type: 'TAKE_ITEM', caseId: 'falling-tag' }); s.deceitMentor.life.edith.willing = false; step(s, 'falling-tag', 'CONSENT_OWNER'); reject(s, { type: 'TAKE_ITEM', caseId: 'falling-tag' });
    for (const type of ['STOP_CONTACT', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, 'falling-tag', type); expect(s.deceitMentor.life.tag).toMatchObject({ location: 'OWNER', travelMetres: 0 }); expect(s.progression.mastery[LAW]).toBe(8);
  });
  it('completes exactly thirteen AP with original objects and inherited records unchanged', () => {
    const s = ready(), inherited = structuredClone({ marauder: s.marauder, swindler: s.swindler, cryptologist: s.cryptologist, fireThief: s.fireThief, dreamStealer: s.dreamStealer, parasite: s.parasite });
    lamp(s); tag(s); card(s); act(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(102); expect(s.progression.acting).toBe(100);
    expect(s.deceitMentor.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 44, clockSeconds: 124, lamp: { location: 'OWNER', oil: 0 }, tag: { location: 'OWNER' }, card: { location: 'OWNER', face: 'BACK' }, basil: { location: 'BENCH', travelMetres: 8 } });
    expect(s.progression.mastery).toMatchObject({ [LAW]: 16, [DEEP]: 8, 'error.s4.parasitism': 37 }); expect({ marauder: s.marauder, swindler: s.swindler, cryptologist: s.cryptologist, fireThief: s.fireThief, dreamStealer: s.dreamStealer, parasite: s.parasite }).toEqual(inherited);
    expect(hasDeceitMentorLifeLock(s)).toBe(false); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'spent-lamp' });
  });
  it('allows all three ordinary cases at zero spirituality with exactly thirteen AP and no new mastery', () => {
    const s = ready(); s.spirituality = 0; lamp(s, 1, 'ORDINARY'); tag(s, 1, 'ORDINARY'); card(s, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.progression.mastery[LAW]).toBe(0); expect(s.progression.mastery[DEEP]).toBe(0); expect(s.deceitMentor.life.candle.remaining).toBe(0);
  });
  it('rejects an ability without six spirituality but keeps the actual ordinary fallback available', () => {
    const s = ready(); arrive(s, 'spent-lamp'); step(s, 'spent-lamp', 'LIGHT_LAMP'); s.spirituality = 5; reject(s, { type: 'EXTEND_LIGHT', caseId: 'spent-lamp' }); step(s, 'spent-lamp', 'LIGHT_CANDLE'); step(s, 'spent-lamp', 'READ_PLATE'); step(s, 'spent-lamp', 'EXTINGUISH'); close(s, 'spent-lamp'); expect(s.spirituality).toBe(5);
  });
  it('requires two AP before preparation and cancels prepared work without refund', () => {
    const s = ready(); step(s, 'spent-lamp', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'spent-lamp', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'spent-lamp', method: 'ABILITY' }); s.actionsRemaining = 0; step(s, 'spent-lamp', 'WITHDRAW'); expect(s.deceitMentor.life.cases['spent-lamp']).toMatchObject({ status: 'OBSERVED', withdrawals: 1 }); expect(hasDeceitMentorLifeLock(s)).toBe(false);
  });
  it('round trips an active timed original tag and preserves full PublicGameDate including epoch', () => {
    const s = ready(); lamp(s); arrive(s, 'falling-tag'); step(s, 'falling-tag', 'DELAY_TAG'); const loaded = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateDeceitMentorLife(loaded)).toBe(true); expect(loaded.deceitMentor.life).toEqual(s.deceitMentor.life); expect(loaded.deceitMentor.life.introducedDate?.epoch).toBe('FIFTH_EPOCH'); step(loaded, 'falling-tag', 'READ_TAG'); expect(loaded.deceitMentor.life.tag.delaySeconds).toBe(3);
    const malformed = structuredClone(loaded); delete (malformed.deceitMentor.life.introducedDate as Partial<NonNullable<typeof malformed.deceitMentor.life.introducedDate>>).epoch; expect(validateDeceitMentorLife(malformed)).toBe(false);
  });
  it('counts recorded combat seconds even after death without moving or resurrecting past life originals', () => {
    const s = ready(); lamp(s); tag(s); card(s); act(s, { type: 'REFLECT' });
    s.combatHistory.push({ deceitMentorOutcome: { elapsedSeconds: 60 } } as unknown as SliceState['combatHistory'][number]); s.deceitMentor.life.clockSeconds += 60; s.status = 'DEAD'; s.health = 0;
    expect(validateDeceitMentorLife(s)).toBe(true); reject(s, { type: 'OBSERVE', caseId: 'spent-lamp' }); s.deceitMentor.life.clockSeconds--; expect(validateDeceitMentorLife(s)).toBe(false);
  });
  it('returns detached original objects, movement and observation records in public projection', () => {
    const s = ready(); lamp(s); tag(s); arrive(s, 'witness-correction'); const view = projectDeceitMentorLife(s); view.lamp.oil = 1; view.basil.location = 'BENCH'; view.currentAttempt!.playerMoves[0]!.metres = 999; view.cases[0]!.attempts[0]!.steps[0]!.edithWilling = false;
    expect(s.deceitMentor.life.lamp.oil).toBe(0); expect(s.deceitMentor.life.basil.location).toBe('CABINET'); expect(attempt(s, 'witness-correction').playerMoves[0]!.metres).toBe(10); expect(attempt(s, 'spent-lamp').steps[0]!.edithWilling).toBe(true);
  });
  it('shows only the current concrete scene step with a safe stopping option', () => {
    const s = ready(); expect(deceitMentorLifeActions(s).map(a => a.command.type)).toEqual(['OBSERVE']); arrive(s, 'spent-lamp');
    expect(deceitMentorLifeActions(s).map(a => a.command.type)).toEqual(['LIGHT_LAMP', 'STOP_CONTACT']); expect(projectDeceitMentorLife(s).nextStep).toContain('点燃原灯');
    step(s, 'spent-lamp', 'LIGHT_LAMP'); expect(deceitMentorLifeActions(s).map(a => a.command.type)).toEqual(['EXTEND_LIGHT', 'LIGHT_CANDLE', 'STOP_CONTACT']);
    step(s, 'spent-lamp', 'EXTEND_LIGHT', 100); expect(deceitMentorLifeActions(s).map(a => a.command.type)).toEqual(['LIGHT_CANDLE', 'STOP_CONTACT']);
  });
  it('rejects copied originals, replenished resources, fabricated travel, missing correction and invalid dates', () => {
    const s = ready(); lamp(s); tag(s); card(s); act(s, { type: 'REFLECT' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.deceitMentor.life.lamp.oil = 1; }, x => { x.deceitMentor.life.lamp.extensionSeconds = 16; }, x => { x.deceitMentor.life.candle.remaining = 0; }, x => { x.deceitMentor.life.card.face = 'FRONT'; },
      x => { x.deceitMentor.life.tag.location = 'AIR'; }, x => { x.deceitMentor.life.playerLocation = 'BENCH'; }, x => { x.deceitMentor.life.basil.travelMetres = 0; }, x => { x.deceitMentor.life.card.travelMetres = 0; },
      x => { (x.deceitMentor.life.tag as { quantity: number }).quantity = 2; }, x => { x.deceitMentor.life.clockSeconds++; }, x => { attempt(x, 'falling-tag').steps = []; }, x => { attempt(x, 'spent-lamp').playerMoves[0]!.metres = 0; },
      x => { attempt(x, 'witness-correction').observedFaceBeforeCorrection = 'FRONT'; }, x => { attempt(x, 'witness-correction').correctedOriginalFace = 'BACK'; }, x => { attempt(x, 'witness-correction').correctionMade = false; },
      x => { x.deceitMentor.life.introducedDate!.month = 13; }, x => { x.seer.completedSources.push('deceit-mentor-reflection'); },
    ];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateDeceitMentorLife(copy)).toBe(false); }
  });
  it('allows only the three finite objects and exact command shapes, never arbitrary rules or forced consent', () => {
    expect(DECEIT_MENTOR_CASE_IDS).toEqual(['spent-lamp', 'falling-tag', 'witness-correction']); expect(createDeceitMentorLifeState().siteId).toBe('DM3-WORKSHOP');
    for (const command of [{ type: 'MISDIRECT', caseId: 'spent-lamp' }, { type: 'DELAY_TAG', caseId: 'witness-correction' }, { type: 'REFLECT', caseId: 'spent-lamp' }, { type: 'CONSENT_WITNESS', caseId: 'witness-correction', forced: true }, { type: 'EXTEND_LIGHT', caseId: 'spent-lamp', seconds: 604800 }, { type: 'EDIT_NATURAL_LAW', caseId: 'falling-tag' }]) expect(validateDeceitMentorActivityCommand(command)).toBe(false);
    const s = ready(); expect(blockDeceitMentorLife(s, { type: 'OBSERVE', caseId: 'falling-tag' })).not.toBeNull();
  });
});
