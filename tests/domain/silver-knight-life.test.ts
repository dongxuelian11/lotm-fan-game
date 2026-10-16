import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createSilverKnightState } from '../../src/domain/silver-knight/index.js';
import { advanceSilverKnightLifeClock, applySilverKnightActivity, blockSilverKnightLife, createSilverKnightLifeState, hasSilverKnightLifeLock, projectSilverKnightLife, SILVER_KNIGHT_CASE_IDS, silverKnightLifeActions, validateSilverKnightActivityCommand, validateSilverKnightLife, type SilverKnightActivityCommand, type SilverKnightCaseId } from '../../src/domain/silver-knight/life.js';

const ARMOR = 'warrior.s3.silver-armor', LIGHT = 'warrior.s3.light-concealment', THRUST = 'warrior.s3.silver-thrust';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Directed isolated life fixture only; never presented as a naturally hunted or promoted character. */
function ready(): SliceState {
  const s = createSliceRun('silver-knight-life', sliceDefaultCreationSelection, 'silver-knight-life');
  s.silverKnight = createSilverKnightState(); s.week = 110; s.silverKnight.promotionWeek = 109; s.silverKnight.demonHunterActingAtPromotion = 100;
  s.progression = { pathwayId: 'warrior', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [ARMOR]: 0, [LIGHT]: 0, [THRUST]: 0, 'warrior.s6.dawn-weapon': 37 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: SilverKnightActivityCommand, roll = 1) { const ctx = context(s, roll); applySilverKnightActivity(s, command, ctx); expect(validateSilverKnightLife(s), `${command.type}: ${JSON.stringify(s.silverKnight.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: SilverKnightCaseId, type: Exclude<SilverKnightActivityCommand['type'], 'PREPARE' | 'REFLECT'>, roll = 1) { return act(s, { type, caseId } as SilverKnightActivityCommand, roll); }
function reject(s: SliceState, command: SilverKnightActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applySilverKnightActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: SilverKnightCaseId) => s.silverKnight.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: SilverKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); }
function arrive(s: SliceState, id: SilverKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { start(s, id, method); for (const type of ['CONSENT_OWNER', 'TAKE_ITEM', 'GO_SITE', 'CONSENT_OBSERVER'] as const) step(s, id, type); }
function close(s: SliceState, id: SilverKnightCaseId) { for (const type of ['RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, id, type); }
function armor(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'armor-load'; arrive(s, id, method); step(s, id, 'WEAR_PAD'); if (method === 'ABILITY') step(s, id, 'FORM_ARMOR', roll); step(s, id, 'APPLY_LOAD'); if (s.silverKnight.life.armor.active) step(s, id, 'STOP_EFFECT'); step(s, id, 'REMOVE_PAD'); close(s, id);
}
function light(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', scrutiny = false) {
  const id = 'light-check'; arrive(s, id, method); step(s, id, 'PLACE_LAMP'); step(s, id, 'LIGHT_LAMP'); if (scrutiny) step(s, id, 'ASK_SCRUTINY'); if (method === 'ABILITY') step(s, id, 'CONCEAL', roll); step(s, id, 'CHECK_VISIBILITY'); step(s, id, 'EXTINGUISH'); step(s, id, 'RECOVER_LAMP'); close(s, id);
}
function thrust(s: SliceState, roll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', ward = false) {
  const id = 'partition-thrust'; arrive(s, id, method); step(s, id, 'SIGHT_TARGET'); if (ward) step(s, id, 'RAISE_WARD'); if (method === 'ABILITY') step(s, id, 'SILVER_THRUST', roll); if (s.silverKnight.life.ward.active) step(s, id, 'LOWER_WARD');
  step(s, id, 'OPEN_SIDE_DOOR'); step(s, id, 'WALK_TARGET'); if (!s.silverKnight.life.target.silverMarks) step(s, id, 'MARK_TARGET'); step(s, id, 'VERIFY_TARGET'); step(s, id, 'RETURN_FROM_TARGET'); step(s, id, 'CLOSE_SIDE_DOOR'); close(s, id);
}

describe('Silver Knight finite original life scenes', () => {
  it('has original consenting adults, one finite load, one oil and a unique nonliving target', () => {
    const s = ready(), l = s.silverKnight.life; expect(validateSilverKnightLife(s)).toBe(true);
    expect(l.elda).toMatchObject({ id: 'SK3-ELDA', age: 46, location: 'START' }); expect(l.nolan).toMatchObject({ id: 'SK3-NOLAN', age: 39, location: 'GALLERY' });
    expect(l.rig).toMatchObject({ remainingLoads: 1, loadKg: 12, safetyStop: 'ENGAGED' }); expect(l.lamp).toMatchObject({ oil: 1, quantity: 1, location: 'OWNER' }); expect(l.target).toMatchObject({ id: 'SK3-PRACTICE-TARGET', quantity: 1, living: false, silverMarks: 0 });
    expect(l.partition.state).toBe('LOCKED'); expect(l.sideDoor.state).toBe('CLOSED'); expect(createSilverKnightLifeState()).toEqual(l);
  });
  it('actually consumes the original limited load against silver armor and retains its integrity', () => {
    const s = ready(); arrive(s, 'armor-load'); reject(s, { type: 'FORM_ARMOR', caseId: 'armor-load' }); step(s, 'armor-load', 'WEAR_PAD'); const ctx = step(s, 'armor-load', 'FORM_ARMOR');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(114); expect(s.silverKnight.life.armor).toMatchObject({ formed: true, active: true, integrity: 100, remainingSeconds: 30 });
    step(s, 'armor-load', 'APPLY_LOAD'); expect(s.silverKnight.life.armor).toMatchObject({ active: true, integrity: 65, remainingSeconds: 28 }); expect(s.silverKnight.life.rig).toMatchObject({ remainingLoads: 0, appliedLoads: 1 }); expect(s.silverKnight.life.pad.integrity).toBe(100);
    reject(s, { type: 'APPLY_LOAD', caseId: 'armor-load' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'armor-load' }); reject(s, { type: 'CLOSE', caseId: 'armor-load' }); step(s, 'armor-load', 'STOP_EFFECT'); step(s, 'armor-load', 'REMOVE_PAD');
    expect(s.progression.mastery[ARMOR]).toBe(0); close(s, 'armor-load'); expect(s.progression.mastery[ARMOR]).toBe(8); expect(s.silverKnight.life.pad).toMatchObject({ location: 'OWNER', travelMetres: 8, worn: false }); expect(s.silverKnight.life.armor.integrity).toBe(65); expect(s.health).toBe(100);
  });
  it('pays for failed armor then really uses and wears the ordinary original pad', () => {
    const s = ready(); armor(s, 100); expect(attempt(s, 'armor-load')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, result: 'ORDINARY', loadReceivedBy: 'PAD', armorIntegrityAfterLoad: 0 });
    expect(s.silverKnight.life.pad.integrity).toBe(90); expect(s.silverKnight.life.rig.remainingLoads).toBe(0); expect(s.progression.mastery[ARMOR]).toBe(0); expect(s.silverKnight.life.armor.formed).toBe(false);
  });
  it('does not credit expired armor that never actually received the load', () => {
    const s = ready(); arrive(s, 'armor-load'); for (const type of ['WEAR_PAD', 'FORM_ARMOR', 'WAIT_EFFECT', 'APPLY_LOAD', 'REMOVE_PAD'] as const) step(s, 'armor-load', type); close(s, 'armor-load');
    expect(attempt(s, 'armor-load')).toMatchObject({ armorFormed: true, loadReceivedBy: 'PAD', result: 'ORDINARY' }); expect(s.silverKnight.life.armor.integrity).toBe(100); expect(s.progression.mastery[ARMOR]).toBe(0);
  });
  it('walks the original lamp to a real light position and reveals the same body when extinguished', () => {
    const s = ready(); armor(s); arrive(s, 'light-check'); reject(s, { type: 'CONCEAL', caseId: 'light-check' }); step(s, 'light-check', 'PLACE_LAMP'); step(s, 'light-check', 'LIGHT_LAMP');
    expect(s.silverKnight.life.lamp).toMatchObject({ location: 'STAND', oil: 0, lit: true, remainingSeconds: 30 }); step(s, 'light-check', 'CONCEAL');
    expect(s.silverKnight.life.concealment).toMatchObject({ active: true, remainingSeconds: 8, location: 'LIGHT' }); expect(s.silverKnight.life.playerLocation).toBe('LIGHT');
    step(s, 'light-check', 'CHECK_VISIBILITY'); expect(attempt(s, 'light-check').observedVisibility).toBe('UNSEEN'); step(s, 'light-check', 'EXTINGUISH');
    expect(s.silverKnight.life.concealment).toMatchObject({ active: false, remainingSeconds: 0, location: 'LIGHT', lastEnd: 'LIGHT_OUT' }); expect(s.silverKnight.life.playerLocation).toBe('LIGHT');
    reject(s, { type: 'RETURN_PLAYER', caseId: 'light-check' }); reject(s, { type: 'LIGHT_LAMP', caseId: 'light-check' }); step(s, 'light-check', 'RECOVER_LAMP'); close(s, 'light-check');
    expect(s.silverKnight.life.lamp).toMatchObject({ location: 'OWNER', oil: 0, travelMetres: 12 }); expect(s.progression.mastery[LIGHT]).toBe(8);
  });
  it('can be detected by a real attentive observer despite a successful concealment roll', () => {
    const s = ready(); armor(s); light(s, 1, 'ABILITY', true); expect(attempt(s, 'light-check')).toMatchObject({ abilityTier: 'GREAT_SUCCESS', concealmentFormed: true, scrutinyRequested: true, observedVisibility: 'SEEN', result: 'ORDINARY', spiritualitySpent: 6 }); expect(s.progression.mastery[LIGHT]).toBe(0);
  });
  it('preserves failed light concealment and ordinary observation without rerolling or refilling oil', () => {
    const s = ready(); armor(s); light(s, 100); expect(attempt(s, 'light-check')).toMatchObject({ abilityTier: 'GREAT_FAILURE', concealmentFormed: false, observedVisibility: 'SEEN', result: 'ORDINARY' }); expect(s.silverKnight.life.lamp.oil).toBe(0); expect(s.progression.mastery[LIGHT]).toBe(0);
  });
  it('expires concealment and the original oil light without moving the player or allowing dark recasting', () => {
    const s = ready(); armor(s); arrive(s, 'light-check'); for (const type of ['PLACE_LAMP', 'LIGHT_LAMP', 'CONCEAL', 'WAIT_EFFECT'] as const) step(s, 'light-check', type);
    expect(s.silverKnight.life.playerLocation).toBe('LIGHT'); expect(s.silverKnight.life.lamp).toMatchObject({ lit: false, oil: 0, remainingSeconds: 0 }); expect(s.silverKnight.life.concealment).toMatchObject({ active: false, lastEnd: 'EXPIRED' });
    reject(s, { type: 'CONCEAL', caseId: 'light-check' }); step(s, 'light-check', 'CHECK_VISIBILITY'); step(s, 'light-check', 'RECOVER_LAMP'); close(s, 'light-check'); expect(s.progression.mastery[LIGHT]).toBe(0);
  });
  it('requires actual target sighting, leaves a real mark through the ordinary partition and never teleports the player', () => {
    const s = ready(); armor(s); light(s); arrive(s, 'partition-thrust'); reject(s, { type: 'SILVER_THRUST', caseId: 'partition-thrust' }); step(s, 'partition-thrust', 'SIGHT_TARGET'); step(s, 'partition-thrust', 'SILVER_THRUST');
    expect(s.silverKnight.life.playerLocation).toBe('STRIKE'); expect(s.silverKnight.life.target).toMatchObject({ location: 'TARGET', living: false, silverMarks: 1 }); expect(s.silverKnight.life.partition.state).toBe('LOCKED'); expect(s.silverKnight.life.blade).toMatchObject({ attempts: 1, active: false, targetId: 'SK3-PRACTICE-TARGET', outcome: 'HIT' });
    reject(s, { type: 'VERIFY_TARGET', caseId: 'partition-thrust' }); reject(s, { type: 'WALK_TARGET', caseId: 'partition-thrust' }); reject(s, { type: 'SILVER_THRUST', caseId: 'partition-thrust' });
    step(s, 'partition-thrust', 'OPEN_SIDE_DOOR'); step(s, 'partition-thrust', 'WALK_TARGET'); expect(s.silverKnight.life.playerLocation).toBe('TARGET'); reject(s, { type: 'RETURN_PLAYER', caseId: 'partition-thrust' }); step(s, 'partition-thrust', 'VERIFY_TARGET');
    step(s, 'partition-thrust', 'RETURN_FROM_TARGET'); step(s, 'partition-thrust', 'CLOSE_SIDE_DOOR'); close(s, 'partition-thrust'); expect(s.progression.mastery[THRUST]).toBe(8); expect(s.silverKnight.life.stylus).toMatchObject({ location: 'OWNER', travelMetres: 20 });
    expect(attempt(s, 'partition-thrust').playerMoves.map(m => [m.from, m.to, m.metres])).toEqual([['START', 'STRIKE', 6], ['STRIKE', 'TARGET', 4], ['TARGET', 'STRIKE', 4], ['STRIKE', 'START', 6]]);
  });
  it('records a miss on the original catcher, then permits ordinary walking and marking of the original target', () => {
    const s = ready(); armor(s); light(s); thrust(s, 100); expect(attempt(s, 'partition-thrust')).toMatchObject({ abilityTier: 'GREAT_FAILURE', thrustOutcome: 'MISSED', targetMarked: true, verifiedSilverMarks: 0, verifiedOrdinaryMarks: 1, result: 'ORDINARY', spiritualitySpent: 6 });
    expect(s.silverKnight.life.target).toMatchObject({ silverMarks: 0, ordinaryMarks: 1 }); expect(s.silverKnight.life.catcher.missedMarks).toBe(1); expect(s.progression.mastery[THRUST]).toBe(0);
  });
  it('lets the finite original higher ward really block a successful roll and never duplicates its charge', () => {
    const s = ready(); armor(s); light(s); arrive(s, 'partition-thrust'); step(s, 'partition-thrust', 'SIGHT_TARGET'); step(s, 'partition-thrust', 'RAISE_WARD'); reject(s, { type: 'OPEN_SIDE_DOOR', caseId: 'partition-thrust' }); step(s, 'partition-thrust', 'SILVER_THRUST');
    expect(attempt(s, 'partition-thrust')).toMatchObject({ abilityTier: 'GREAT_SUCCESS', thrustOutcome: 'WARD_BLOCKED', spiritualitySpent: 6 }); expect(s.silverKnight.life.target.silverMarks).toBe(0); expect(s.silverKnight.life.catcher.missedMarks).toBe(0); expect(s.silverKnight.life.ward).toMatchObject({ charges: 0, active: true, remainingSeconds: 19 });
    step(s, 'partition-thrust', 'LOWER_WARD'); reject(s, { type: 'RAISE_WARD', caseId: 'partition-thrust' }); for (const type of ['OPEN_SIDE_DOOR', 'WALK_TARGET', 'MARK_TARGET', 'VERIFY_TARGET', 'RETURN_FROM_TARGET', 'CLOSE_SIDE_DOOR'] as const) step(s, 'partition-thrust', type); close(s, 'partition-thrust'); expect(s.progression.mastery[THRUST]).toBe(0);
  });
  it('requires independent permissions and permits an owner refusal before touching any original', () => {
    const s = ready(); start(s, 'armor-load'); reject(s, { type: 'TAKE_ITEM', caseId: 'armor-load' }); s.silverKnight.life.elda.willing = false; const ctx = step(s, 'armor-load', 'CONSENT_OWNER'); expect(ctx.check).not.toHaveBeenCalled(); reject(s, { type: 'TAKE_ITEM', caseId: 'armor-load' });
    for (const type of ['STOP_CONTACT', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, 'armor-load', type); expect(s.silverKnight.life.pad.location).toBe('OWNER'); expect(s.silverKnight.life.playerTravelMetres).toBe(0); expect(s.progression.mastery[ARMOR]).toBe(0);
    s.silverKnight.life.elda.willing = true; start(s, 'light-check'); reject(s, { type: 'TAKE_ITEM', caseId: 'light-check' }); expect(attempt(s, 'light-check').ownerConsent).toBe('UNASKED');
  });
  it('never rolls consent and respects the real observer refusal with ordinary same-body return', () => {
    const s = ready(); s.silverKnight.life.nolan.willing = false; arrive(s, 'armor-load'); expect(attempt(s, 'armor-load').observerConsent).toBe('DECLINED'); reject(s, { type: 'WEAR_PAD', caseId: 'armor-load' }); step(s, 'armor-load', 'STOP_CONTACT'); close(s, 'armor-load');
    expect(s.silverKnight.life.playerTravelMetres).toBe(8); expect(s.silverKnight.life.pad).toMatchObject({ location: 'OWNER', integrity: 100 }); expect(s.silverKnight.life.rig.remainingLoads).toBe(1); expect(s.spirituality).toBe(120);
  });
  it('keeps 0AP and 0S physical cleanup available after permission is withdrawn in the light scene', () => {
    const s = ready(); armor(s); arrive(s, 'light-check'); for (const type of ['PLACE_LAMP', 'LIGHT_LAMP', 'CONCEAL'] as const) step(s, 'light-check', type);
    s.silverKnight.life.elda.willing = false; s.silverKnight.life.nolan.willing = false; s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    reject(s, { type: 'CHECK_VISIBILITY', caseId: 'light-check' }); step(s, 'light-check', 'STOP_CONTACT'); reject(s, { type: 'WITHDRAW', caseId: 'light-check' }); reject(s, { type: 'RETURN_ITEM', caseId: 'light-check' });
    for (const type of ['EXTINGUISH', 'RECOVER_LAMP', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE'] as const) step(s, 'light-check', type); expect(hasSilverKnightLifeLock(s)).toBe(false); expect(s.silverKnight.life.lamp).toMatchObject({ location: 'OWNER', oil: 0 }); expect(attempt(s, 'light-check').result).toBe('ORDINARY');
  });
  it('stops at the actual target and requires four metres back plus door closure before returning to start', () => {
    const s = ready(); armor(s); light(s); arrive(s, 'partition-thrust'); for (const type of ['SIGHT_TARGET', 'OPEN_SIDE_DOOR', 'WALK_TARGET', 'STOP_CONTACT'] as const) step(s, 'partition-thrust', type);
    s.actionsRemaining = 0; s.spirituality = 0; reject(s, { type: 'RETURN_PLAYER', caseId: 'partition-thrust' }); reject(s, { type: 'CLOSE_SIDE_DOOR', caseId: 'partition-thrust' }); step(s, 'partition-thrust', 'RETURN_FROM_TARGET'); reject(s, { type: 'RETURN_PLAYER', caseId: 'partition-thrust' });
    for (const type of ['CLOSE_SIDE_DOOR', 'RETURN_PLAYER', 'RETURN_ITEM', 'INSPECT', 'CLOSE'] as const) step(s, 'partition-thrust', type); expect(hasSilverKnightLifeLock(s)).toBe(false); expect(s.silverKnight.life.target).toMatchObject({ silverMarks: 0, ordinaryMarks: 0 }); expect(s.silverKnight.life.stylus.travelMetres).toBe(20);
  });
  it('completes thirteen AP and eighteen spirituality with three real successes while all old six roots stay identical', () => {
    const s = ready(), old = structuredClone({ warrior: s.warrior, gladiator: s.gladiator, weaponmaster: s.weaponmaster, dawnPaladin: s.dawnPaladin, guardian: s.guardian, demonHunter: s.demonHunter }); armor(s); light(s); thrust(s); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(102); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toMatchObject({ [ARMOR]: 8, [LIGHT]: 8, [THRUST]: 8, 'warrior.s6.dawn-weapon': 37 }); expect(s.silverKnight.life.playerTravelMetres).toBe(40);
    expect(s.silverKnight.life.clockSeconds).toBe(SILVER_KNIGHT_CASE_IDS.reduce((sum, id) => sum + attempt(s, id).elapsedSeconds, 0)); expect({ warrior: s.warrior, gladiator: s.gladiator, weaponmaster: s.weaponmaster, dawnPaladin: s.dawnPaladin, guardian: s.guardian, demonHunter: s.demonHunter }).toEqual(old);
    expect(s.seer.completedSources.filter(id => id.startsWith('silver-knight-'))).toEqual(['silver-knight-life-armor-load', 'silver-knight-life-light-check', 'silver-knight-life-partition-thrust', 'silver-knight-reflection']); expect(hasSilverKnightLifeLock(s)).toBe(false); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'armor-load' });
  });
  it('allows all ordinary cases at zero spirituality in thirteen AP without new mastery', () => {
    const s = ready(); s.spirituality = 0; armor(s, 1, 'ORDINARY'); light(s, 1, 'ORDINARY'); thrust(s, 1, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.progression.acting).toBe(100); expect([s.progression.mastery[ARMOR], s.progression.mastery[LIGHT], s.progression.mastery[THRUST]]).toEqual([0, 0, 0]); expect(s.silverKnight.life.pad.integrity).toBe(90); expect(s.silverKnight.life.target.ordinaryMarks).toBe(1); expect(s.silverKnight.life.blade.attempts).toBe(0);
  });
  it('requires six spirituality for an attempt but still permits the real ordinary fallback', () => {
    const s = ready(); arrive(s, 'armor-load'); step(s, 'armor-load', 'WEAR_PAD'); s.spirituality = 5; reject(s, { type: 'FORM_ARMOR', caseId: 'armor-load' }); step(s, 'armor-load', 'APPLY_LOAD'); step(s, 'armor-load', 'REMOVE_PAD'); close(s, 'armor-load'); expect(s.spirituality).toBe(5); expect(attempt(s, 'armor-load').spiritualitySpent).toBe(0);
  });
  it('requires reserve AP before preparation and supports cancellation without a refund', () => {
    const s = ready(); step(s, 'armor-load', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'armor-load', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'armor-load', method: 'ABILITY' }); s.actionsRemaining = 0; step(s, 'armor-load', 'WITHDRAW');
    expect(s.silverKnight.life.cases['armor-load']).toMatchObject({ status: 'OBSERVED', withdrawals: 1, method: null }); expect(s.actionsRemaining).toBe(0); expect(hasSilverKnightLifeLock(s)).toBe(false);
  });
  it('round trips an active original light scene and full game date including epoch', () => {
    const s = ready(); armor(s); arrive(s, 'light-check'); for (const type of ['PLACE_LAMP', 'LIGHT_LAMP', 'CONCEAL'] as const) step(s, 'light-check', type); const loaded = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateSilverKnightLife(loaded)).toBe(true); expect(loaded.silverKnight.life).toEqual(s.silverKnight.life); expect(loaded.silverKnight.life.introducedDate?.epoch).toBe('FIFTH_EPOCH'); step(loaded, 'light-check', 'CHECK_VISIBILITY'); expect(loaded.silverKnight.life.concealment.remainingSeconds).toBe(6);
    delete (loaded.silverKnight.life.introducedDate as Partial<NonNullable<typeof loaded.silverKnight.life.introducedDate>>).epoch; expect(validateSilverKnightLife(loaded)).toBe(false);
  });
  it('accepts actual recorded hunt seconds before promotion and retains them through life and later death', () => {
    const s = ready(); s.silverKnight.promotionWeek = null; s.progression.sequence = 4; s.combatHistory.push({ silverKnightOutcome: { elapsedSeconds: 60 } } as unknown as SliceState['combatHistory'][number]); advanceSilverKnightLifeClock(s, 60);
    expect(validateSilverKnightLife(s)).toBe(true); expect(s.silverKnight.life.introducedWeek).toBeNull(); s.silverKnight.promotionWeek = 109; s.progression.sequence = 3; armor(s); light(s); thrust(s); act(s, { type: 'REFLECT' });
    const sourceRecords = structuredClone(s.seer.completedSources); s.combatHistory.push({ silverKnightOutcome: { elapsedSeconds: 60 } } as unknown as SliceState['combatHistory'][number]); advanceSilverKnightLifeClock(s, 60); s.status = 'DEAD'; s.health = 0;
    expect(validateSilverKnightLife(s)).toBe(true); expect(s.seer.completedSources).toEqual(sourceRecords); reject(s, { type: 'OBSERVE', caseId: 'armor-load' }); s.silverKnight.life.clockSeconds--; expect(validateSilverKnightLife(s)).toBe(false);
  });
  it('keeps a dead original body and its borrowed objects in their actual scene position', () => {
    const s = ready(); arrive(s, 'armor-load'); step(s, 'armor-load', 'WEAR_PAD'); s.health = 0; s.status = 'DEAD'; const before = structuredClone(s.silverKnight.life);
    expect(validateSilverKnightLife(s)).toBe(true); reject(s, { type: 'STOP_CONTACT', caseId: 'armor-load' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'armor-load' }); expect(s.silverKnight.life).toEqual(before);
  });
  it('projects detached current originals, trace records and only concrete next controls', () => {
    const s = ready(); expect(silverKnightLifeActions(s).map(a => a.command.type)).toEqual(['OBSERVE']); arrive(s, 'armor-load'); expect(silverKnightLifeActions(s).map(a => a.command.type)).toEqual(['WEAR_PAD', 'STOP_CONTACT']); step(s, 'armor-load', 'WEAR_PAD');
    expect(silverKnightLifeActions(s).map(a => a.command.type)).toEqual(['FORM_ARMOR', 'APPLY_LOAD', 'STOP_CONTACT']); const view = projectSilverKnightLife(s); expect(view.facts.join(' ')).toContain('SK3-PRACTICE-TARGET'); view.pad.integrity = 0; view.currentAttempt!.playerMoves[0]!.metres = 999; view.cases[0]!.attempts[0]!.steps[0]!.eldaWilling = false;
    expect(s.silverKnight.life.pad.integrity).toBe(100); expect(attempt(s, 'armor-load').playerMoves[0]!.metres).toBe(4); expect(attempt(s, 'armor-load').steps[0]!.eldaWilling).toBe(true);
  });
  it('rejects copied originals, refilled resources, false hits, fabricated walking and invalid source records', () => {
    const s = ready(); armor(s); light(s); thrust(s); act(s, { type: 'REFLECT' });
    const mutations: ((x: SliceState) => void)[] = [x => { x.silverKnight.life.rig.remainingLoads = 1; }, x => { x.silverKnight.life.armor.integrity = 100; }, x => { x.silverKnight.life.lamp.oil = 1; }, x => { x.silverKnight.life.lamp.location = 'STAND'; }, x => { x.silverKnight.life.playerLocation = 'TARGET'; }, x => { x.silverKnight.life.target.silverMarks = 0; }, x => { x.silverKnight.life.catcher.missedMarks = 1; }, x => { x.silverKnight.life.stylus.travelMetres = 0; }, x => { x.silverKnight.life.sideDoor.state = 'OPEN'; }, x => { x.silverKnight.life.ward.charges = 0; }, x => { (x.silverKnight.life.target as { quantity: number }).quantity = 2; }, x => { x.silverKnight.life.clockSeconds++; }, x => { attempt(x, 'armor-load').steps = []; }, x => { attempt(x, 'light-check').observedVisibility = 'SEEN'; }, x => { attempt(x, 'partition-thrust').playerMoves[1]!.metres = 0; }, x => { attempt(x, 'partition-thrust').verifiedSilverMarks = 0; }, x => { x.silverKnight.life.introducedDate!.month = 13; }, x => { x.seer.completedSources.push('silver-knight-reflection'); }, x => { x.seer.completedSources = x.seer.completedSources.filter(id => id !== 'silver-knight-life-armor-load'); }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateSilverKnightLife(copy)).toBe(false); }
  });
  it('rejects impossible calendar dates, invented ability tiers and nonintegral recorded combat seconds', () => {
    const s = ready(); armor(s); const wrongDate = structuredClone(s); wrongDate.silverKnight.life.introducedDate = { epoch: 'FIFTH_EPOCH', year: 1350, month: 2, day: 30 }; expect(validateSilverKnightLife(wrongDate)).toBe(false);
    const forged = structuredClone(s); (attempt(forged, 'armor-load').steps.find(v => v.type === 'FORM_ARMOR') as { tier: string }).tier = 'ALWAYS_HIT'; expect(validateSilverKnightLife(forged)).toBe(false);
    s.combatHistory.push({ silverKnightOutcome: { elapsedSeconds: 0.5 } } as unknown as SliceState['combatHistory'][number]); expect(validateSilverKnightLife(s)).toBe(false); expect(() => advanceSilverKnightLifeClock(s, -1)).toThrow();
  });
  it('exposes only exact finite commands and exact warrior sequence three', () => {
    expect(SILVER_KNIGHT_CASE_IDS).toEqual(['armor-load', 'light-check', 'partition-thrust']);
    for (const command of [{ type: 'FORM_ARMOR', caseId: 'light-check' }, { type: 'CONCEAL', caseId: 'partition-thrust' }, { type: 'REFLECT', caseId: 'armor-load' }, { type: 'CONSENT_OWNER', caseId: 'armor-load', forced: true }, { type: 'SILVER_THRUST', caseId: 'partition-thrust', targetId: 'A-LIVING-PERSON' }, { type: 'CONCEAL', caseId: 'light-check', seconds: 604800 }, { type: 'MERCURY_FORM', caseId: 'armor-load' }, { type: 'TELEPORT_PLAYER', caseId: 'partition-thrust' }]) expect(validateSilverKnightActivityCommand(command)).toBe(false);
    const s = ready(); expect(blockSilverKnightLife(s, { type: 'OBSERVE', caseId: 'light-check' })).not.toBeNull(); s.progression.sequence = 4; reject(s, { type: 'OBSERVE', caseId: 'armor-load' }); s.progression.sequence = 2; reject(s, { type: 'OBSERVE', caseId: 'armor-load' }); s.progression.sequence = 3; s.progression.pathwayId = 'error'; reject(s, { type: 'OBSERVE', caseId: 'armor-load' });
  });
});
