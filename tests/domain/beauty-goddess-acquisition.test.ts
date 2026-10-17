import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateLifeGiverState } from '../../src/domain/life-giver/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  BEAUTY_GODDESS_INHERITED_ABILITY_IDS, createBeautyGoddessState, hasBeautyGoddessLock,
  projectBeautyGoddess, beautyGoddessInheritedView, validateBeautyGoddessAcquisitionJournal,
  validateBeautyGoddessCommand, validateBeautyGoddessSource, validateBeautyGoddessState,
} from '../../src/domain/beauty-goddess/index.js';
import { BEAUTY_GODDESS_ABILITY_IDS, BEAUTY_GODDESS_PREPARATION_IDS } from '../../src/domain/beauty-goddess/types.js';
import { acknowledge, bg, directedInitial2, directedInitialCursor, dose, originalMoonRoots, originalLifeGiver, prepared, promoted, recoverResources, rejectBeautyGoddess, rejectIntent, step, taught, lifeGiverNaturalPath, moonLegacyKeys } from './beauty-goddess-directed-helper.js';

const journal = (s: SliceState) => s.beautyGoddess.acquisitionJournal;
describe('Beauty Goddess: actual572-command source and declared directed inputs', () => {
  it('pins raw schema165 separately, then migrates the exact final body and histories', () => {
    expect(createHash('sha256').update(readFileSync(lifeGiverNaturalPath)).digest('hex')).toBe('6ae7bbe18c20979643cf881cec54e3794656701b3b962ce775f14c44d46356b1');
    const raw = readObjectEntry<SliceState>(lifeGiverNaturalPath, 'final'), s = originalLifeGiver();
    expect(raw).toMatchObject({ schemaVersion: 165, contentVersion: 'life-giver-v165' });
    expect(s.progression.mastery).toEqual(raw.progression.mastery); expect(Object.keys(s.progression.mastery)).toEqual([...BEAUTY_GODDESS_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.beautyGoddess).toEqual(createBeautyGoddessState()); expect(originalMoonRoots(s)).toEqual(originalMoonRoots(raw));
    expect(s.lifeGiver.encounter).toMatchObject({ enemyStatus: 'RESISTING', enemyHealth: 80, enemyMind: 100, enemySpirituality: 1 });
    expect(s.summoningMaster.encounter.enemyStatus).toBe('RESISTING'); expect(s.witchKing.encounter.enemy.status).toBe('SURRENDERED');
    expect(s.witchKing.life.papers.map(p => p.status)).toEqual(['CONSUMED', 'CONSUMED', 'CONSUMED']);
    expect(s.lifeGiver.life.beads.every(b => b.location === 'RETURN_TRAY')).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('declares directed identity only before new receipts and advances the real missing twelfth week', () => {
    const original = originalLifeGiver(), female = directedInitial2(), male = directedInitial2('SUCCESS', 'MALE');
    expect(original.week).toBe(131); expect(projectBeautyGoddess(original).digestion).toContain('11/12');
    expect(female.week).toBe(132); expect(male.week).toBe(132); expect(female.cash).toBe(100000); expect(female.actionsRemaining).toBe(100);
    expect(female.random.seed).toBe(original.random.seed); expect(female.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(originalMoonRoots(male)).toEqual(originalMoonRoots(original)); expect(male.progression).toEqual(original.progression);
    expect(male.character).toEqual({ ...female.character, gender: 'MALE' }); expect(original.character.gender).toBe('FEMALE');
    expect(() => directedInitialCursor(taught(), 'SUCCESS')).toThrow(/precede/); assertValidSliceState(male);
  });
  it('hides the stage for unrelated characters and produces independent bottles', () => {
    const s = createSliceRun('beauty-hidden', sliceDefaultCreationSelection, 'beauty-hidden');
    expect(projectBeautyGoddess(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectBeautyGoddess(s, { type: 'LEARN_GUIDANCE' }); const other = createBeautyGoddessState(); other.bottles[0]!.labourSteps = 5;
    expect(s.beautyGoddess.bottles[0]!.labourSteps).toBe(0);
  });
  it('paid guidance seals the live final guest rather than old entry resource snapshots', () => {
    const before = originalLifeGiver(), s = bg(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([134, 2, 70, 100, 120]); expect(s.injuries).toEqual(before.injuries);
    const scene = s.beautyGoddess.sourceScene!;
    expect(scene).toMatchObject({ week: 131, revision: 573, random: { seed: 'apothecary-rebuild-first', cursor: 315 }, city: 'BACKLUND' });
    expect(scene.partner).toEqual(before.summoningMaster.life.partner); expect(scene.partner.stamina).toBe(88); expect(scene.partner.mind).toBe(92);
    expect(scene.papers.every(p => p.status === 'CONSUMED')).toBe(true); expect(scene.character).toEqual(before.character);
    for (const key of moonLegacyKeys) expect(s.beautyGoddess.sourceHistory![key]).toEqual(before[key]);
    expect(s.beautyGoddess.sourceHistory!.summoningMaster).not.toBe(s.summoningMaster);
    expect(e.actor).toMatchObject({ pathwayId: 'moon', lifeGiverPromotionWeek: 120, apothecaryPromotionWeek: 5 });
    expect([e.cursorBefore, e.cursorAfter, e.check]).toEqual([315, 315, null]);
    expect(validateBeautyGoddessSource(s)).toBe(true); expect(validateBeautyGoddessAcquisitionJournal(s)).toBe(true); rejectBeautyGoddess(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires all three real old reports and reflection, exact bottle chronology and21 skills', () => {
    const mutations = [
      (s: SliceState) => { s.lifeGiver.life.reflected = false; },
      (s: SliceState) => { s.lifeGiver.life.cases['tired-guest'].status = 'EXAMINED'; },
      (s: SliceState) => { s.lifeGiver.life.cases['withdrawn-consent'].attempts[0]!.tokenReturned = false; },
      (s: SliceState) => { s.lifeGiver.summoningMasterActingAtPromotion = 99; },
      (s: SliceState) => { s.summoningMaster.promotionWeek = null; },
      (s: SliceState) => { s.apothecary.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.consumedWeek = 6; },
      (s: SliceState) => { delete s.progression.mastery['moon.s3.guest-cooperation']; },
      (s: SliceState) => { s.progression.mastery['moon.s1.invented'] = 0; },
    ];
    for (const mutate of mutations) { const s = directedInitial2(); mutate(s); rejectBeautyGoddess(s, { type: 'LEARN_GUIDANCE' }); }
  });
  it('rejects foreign bottle IDs and false, absent or unrecognized confirmation fields', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'CREATE_SOUL' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'life-giver-potion-1' },
      { ...dose, bottleId: 'beauty-goddess-potion-0' }, { ...dose, acceptFeminization: true },
      { type: 'CONFIRM_TRANSFORMATION' }, { type: 'CONFIRM_TRANSFORMATION', confirmed: false }, { type: 'DECLINE_TRANSFORMATION', free: true }]) expect(validateBeautyGoddessCommand(command)).toBe(false);
    expect(validateBeautyGoddessCommand(dose)).toBe(true); expect(validateBeautyGoddessCommand(acknowledge)).toBe(true);
  });
});

describe('Beauty Goddess informed body choice and finite acquisition', () => {
  it('preparations do not imply consent; refusing keeps S2 and later voluntary confirmation remains possible', () => {
    let s = taught('SUCCESS', 'MALE'); for (const taskId of BEAUTY_GODDESS_PREPARATION_IDS) s = bg(s, { type: 'PREPARE_TASK', taskId });
    s = bg(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); rejectBeautyGoddess(s, { type: 'PREPARE_PROMOTION' }); rejectBeautyGoddess(s, dose);
    const before = structuredClone(s); s = bg(s, { type: 'DECLINE_TRANSFORMATION' });
    expect([s.progression.sequence, s.character.gender, s.cash, s.actionsRemaining]).toEqual([2, 'MALE', before.cash, before.actionsRemaining]);
    expect(s.beautyGoddess.transformation).toMatchObject({ originalGender: 'MALE', decision: 'DECLINED', acknowledgedWeek: null, outcome: null });
    expect(s.beautyGoddess.bottles[0]!.status).toBe('PLAYER'); rejectBeautyGoddess(s, { type: 'PREPARE_PROMOTION' });
    s = bg(s, acknowledge); expect(s.character.gender).toBe('MALE'); rejectBeautyGoddess(s, acknowledge);
    s = bg(s, { type: 'PREPARE_PROMOTION' }); expect(s.character.gender).toBe('MALE'); expect(bg(s, dose).character.gender).toBe('FEMALE');
  });
  it('withdrawal after actual site preparation keeps the bottle and costs, never changes the body', () => {
    const ready = prepared('SUCCESS', false, 'MALE'); expect(hasBeautyGoddessLock(ready)).toBe(true); rejectIntent(ready, { type: 'ACTION', action: 'REST' });
    const declined = bg(ready, { type: 'DECLINE_TRANSFORMATION' }); expect(hasBeautyGoddessLock(declined)).toBe(false);
    expect([declined.cash, declined.actionsRemaining, declined.character.gender, declined.progression.sequence]).toEqual([ready.cash, ready.actionsRemaining, 'MALE', 2]);
    expect(declined.beautyGoddess.preparedWeek).toBeNull(); expect(declined.beautyGoddess.bottles[0]!.status).toBe('PLAYER'); rejectBeautyGoddess(declined, dose);
    expect(validateBeautyGoddessState(declined)).toBe(true);
  }, 15_000);
  it('five actual jobs credit only that bottle5500 and leave1100 due', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = bg(s, { type: 'POTION_WORK', bottleId: 'beauty-goddess-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]); rejectBeautyGoddess(s, { type: 'POTION_WORK', bottleId: 'beauty-goddess-potion-2' });
    s = bg(s, { type: 'BUY_POTION', bottleId: 'beauty-goddess-potion-2' }); expect(s.cash).toBe(before.cash - 1100);
    s = bg(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(before.cash - 1100 - 6600);
    rejectBeautyGoddess(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(validateBeautyGoddessAcquisitionJournal(s)).toBe(true);
    expect(prepared('SUCCESS', true)).toMatchObject({ cash: 98250, actionsRemaining: 90 });
  });
  it('partial labour gives no partial credit and site cancellation needs another paid check', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = bg(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const cash = s.cash; s = bg(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(cash - 6600);
    expect(s.beautyGoddess.preparations).toEqual([]); rejectBeautyGoddess(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(), left = bg(ready, { type: 'LEAVE_PREPARATION' });
    expect([left.cash, left.actionsRemaining]).toEqual([ready.cash, ready.actionsRemaining]); rejectBeautyGoddess(left, dose);
    expect(bg(left, { type: 'PREPARE_PROMOTION' }).cash).toBe(left.cash - 150);
  });
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('records actual %s and female source remains female', kind => {
    const before = prepared(kind), s = bg(before, dose), event = journal(s).at(-1)!, succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const healthCost = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, mindCost = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([s.health, s.mind, s.spirituality]).toEqual([Math.max(1, before.health - healthCost), Math.max(1, before.mind - mindCost), before.spirituality]);
    expect(s.progression.sequence).toBe(succeeds ? 1 : 2); expect(s.character.gender).toBe('FEMALE');
    expect(s.beautyGoddess.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 132, preparationWeek: 132 });
    expect(s.beautyGoddess.preparedWeek).toBeNull(); expect(originalMoonRoots(s)).toEqual(originalMoonRoots(before));
    expect(s.character.age).toBe(26); expect(s.character.name).toBe('艾琳'); expect(s.character.traits).toEqual(before.character.traits); expect(s.injuries).toEqual(before.injuries);
    for (const id of BEAUTY_GODDESS_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(before.progression.mastery[id]);
    expect([event.cursorAfter, event.randomAfter]).toEqual([event.cursorBefore + 1, event.randomBefore! + 1]); expect(event.check!.tier).toBe(kind);
    expect(validateBeautyGoddessAcquisitionJournal(s)).toBe(true); expect(validateBeautyGoddessState(s)).toBe(true);
    if (succeeds) {
      expect(Object.keys(s.progression.mastery)).toHaveLength(23); expect(s.progression.acting).toBe(0); expect(s.beautyGoddess.lifeGiverActingAtPromotion).toBe(100);
      for (const id of BEAUTY_GODDESS_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      expect(s.beautyGoddess.transformation.outcome).toBe('FEMALE'); rejectBeautyGoddess(s, dose);
    } else expect(s.beautyGoddess.transformation.outcome).toBeNull();
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('declared male unit input %s changes body only on actual success', kind => {
    const before = prepared(kind, false, 'MALE'), s = bg(before, dose), succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(before.character.gender).toBe('MALE'); expect(s.character.gender).toBe(succeeds ? 'FEMALE' : 'MALE');
    const withoutMutable = ({ coreStats: _stats, gender: _gender, ...identity }: SliceState['character']) => identity;
    expect(withoutMutable(s.character)).toEqual(withoutMutable(before.character)); expect(originalMoonRoots(s)).toEqual(originalMoonRoots(before));
    expect(s.beautyGoddess.transformation).toMatchObject({ originalGender: 'MALE', decision: 'ACCEPTED', outcome: succeeds ? 'FEMALE' : null });
    assertValidSliceState(s);
  });
  it('three consumed failures never authorize a fourth independent original', () => {
    let s = taught('THREE_FAILURES'); for (const taskId of BEAUTY_GODDESS_PREPARATION_IDS) s = bg(s, { type: 'PREPARE_TASK', taskId }); s = bg(s, acknowledge);
    for (let n = 1; n <= 3; n++) {
      s = recoverResources(s); const bottleId = `beauty-goddess-potion-${n}`;
      s = bg(s, { type: 'BUY_POTION', bottleId }); s = bg(s, { type: 'PREPARE_PROMOTION' }); s = bg(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.beautyGoddess.bottles[n - 1]!.outcome).toBe('FAILURE'); expect(s.progression.sequence).toBe(2);
    }
    const before = structuredClone(s);
    rejectBeautyGoddess(s, { type: 'REQUEST_SUPPLY' }); rejectBeautyGoddess(s, { type: 'RECEIVE_SUPPLY' });
    expect(s).toEqual(before); expect(s.beautyGoddess.bottles).toHaveLength(3);
    // Exact paid recovery, later-week custody and repeated failures have explicit
    // component fixtures in beauty-goddess-original-recovery.test.ts.
  });
});

describe('Beauty Goddess exact historical view and tamper rejection', () => {
  it('reconstructs the real paid-guidance S2 checkpoint, including original male identity', () => {
    const s = promoted('SUCCESS', 'MALE'), before = structuredClone(s), view = beautyGoddessInheritedView(s), scene = s.beautyGoddess.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery); expect(view.character).toEqual(scene.character);
    expect(view.character.gender).toBe('MALE'); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.beautyGoddess).toEqual(createBeautyGoddessState()); expect(validateLifeGiverState(view)).toBe(true); expect(s).toEqual(before);
  });
  it('rejects a forged body, changed identity, old zero mastery and copied old material', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; },
      (s: SliceState) => { s.character.name = '另一个人'; },
      (s: SliceState) => { s.character.age++; },
      (s: SliceState) => { s.progression.mastery['moon.s3.guest-cooperation'] = 8; },
      (s: SliceState) => { s.summoningMaster.life.partner.stamina++; },
      (s: SliceState) => { s.beautyGoddess.life.sourcePartner!.stamina++; s.summoningMaster.life.partner.stamina++; },
      (s: SliceState) => { s.summoningMaster.life.partner.restHistory.pop(); },
      (s: SliceState) => { s.witchKing.life.papers[2]!.status = 'PREPARED'; },
      (s: SliceState) => { s.lifeGiver.life.beads[0]!.location = 'PLAYER'; },
      (s: SliceState) => { s.beautyGoddess.sourceScene!.character.gender = 'MALE'; },
      (s: SliceState) => { s.beautyGoddess.transformation.decision = 'UNDECIDED'; },
      (s: SliceState) => { s.beautyGoddess.transformation.acknowledgedWeek = null; },
      (s: SliceState) => { s.beautyGoddess.acquisitionJournal.at(-1)!.after.gender = 'MALE'; },
      (s: SliceState) => { s.beautyGoddess.acquisitionJournal.find(e => e.command.type === 'CONFIRM_TRANSFORMATION')!.command = { type: 'DECLINE_TRANSFORMATION' }; },
    ]) { const s = promoted(); mutate(s); expect(validateBeautyGoddessState(s), mutate.toString()).toBe(false); }
  });
  it('rejects free resource changes, edited costs and random result substitution', () => {
    for (const mutate of [
      (s: SliceState) => { s.cash++; }, (s: SliceState) => { s.actionsRemaining++; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; }, (s: SliceState) => { journal(s)[0]!.after.actions++; },
      (s: SliceState) => { journal(s).at(-1)!.check!.roll = 1; }, (s: SliceState) => { journal(s).at(-1)!.randomAfter = journal(s).at(-1)!.randomAfter! + 1; },
      (s: SliceState) => { s.beautyGoddess.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.beautyGoddess.preparations[1]!.taskId = s.beautyGoddess.preparations[0]!.taskId; },
    ]) { const s = promoted(); mutate(s); expect(validateBeautyGoddessState(s), mutate.toString()).toBe(false); }
  });
  it('ordinary source recovery needs no forced paid clinic and keeps the live guest unchanged', () => {
    const original = originalLifeGiver(), s = recoverResources(original);
    expect(s.injuries).toEqual([]); expect(s.health).toBe(100); expect(s.summoningMaster.life.partner).toEqual(original.summoningMaster.life.partner);
    expect(originalMoonRoots(s)).toEqual(originalMoonRoots(original));
  });
});
