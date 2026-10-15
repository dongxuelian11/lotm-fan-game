import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateWisdomAngelState } from '../../src/domain/wisdom-angel/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  ALL_KNOWING_EYE_INHERITED_ABILITY_IDS, createAllKnowingEyeState, hasAllKnowingEyeLock,
  projectAllKnowingEye, allKnowingEyeInheritedView, validateAllKnowingEyeAcquisitionJournal,
  validateAllKnowingEyeCommand, validateAllKnowingEyeSource, validateAllKnowingEyeState,
  allKnowingEyeAcquisitionBlock,
} from '../../src/domain/all-knowing-eye/index.js';
import { ALL_KNOWING_EYE_ABILITY_IDS, ALL_KNOWING_EYE_PREPARATION_IDS } from '../../src/domain/all-knowing-eye/types.js';
import { ALL_KNOWING_EYE_PRICES } from '../../src/domain/all-knowing-eye/content.js';
import {
  ae, dose, originalReaderRoots, originalWisdomAngel, prepared, promoted, ready, rejectAllKnowingEye,
  rejectIntent, taught, wisdomAngelNaturalPath, wisdomAngelBranchPath, readerLegacyKeys, loadAllKnowingEyeFixture,
} from './all-knowing-eye-directed-helper.js';

const journal = (s: SliceState) => s.allKnowingEye.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('All-Knowing Eye original source: raw evidence is separate from migration', () => {
  it('pins raw167 living537 checkpoint and preserves both actual dead branches', async () => {
    expect(await fileHash(wisdomAngelNaturalPath)).toBe('2e24ce11c787ba9b51d10d58b2abe9917c17a34a000d10394605944d52043e96');
    expect(await fileHash(wisdomAngelBranchPath)).toBe('c208e391bb21812061361737bf5b22d6d3b21352945231eb81d0bd11c7be1fdd');
    const branch = readObjectEntry<SliceState>(wisdomAngelBranchPath, 'beforeLast');
    const final = readObjectEntry<SliceState>(wisdomAngelNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(wisdomAngelNaturalPath, 'commands');
    expect(branch).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167', revision: 538, status: 'ACTIVE', health: 100, random: { seed: 'reader-natural-v023', cursor: 180 } });
    expect(final).toMatchObject({ schemaVersion: 167, contentVersion: 'wisdom-angel-v167', revision: 544, status: 'DEAD', health: 0, random: { seed: 'reader-natural-v023', cursor: 239 } });
    expect(commands).toHaveLength(543); expect(commands.slice(0, 537)).toHaveLength(537);
    expect(commands[536]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[537]).toEqual({ type: 'WISDOM_ANGEL', command: { type: 'ENCOUNTER_TALK' } });
    expect(branch.wisdomAngel.encounter.approachWeek).toBeNull(); expect(final.wisdomAngel.encounter.status).toBe('LOST');
    expect(final.ending?.kind).toBe('DEATH'); expect(branch.ending).toBeNull();
    const defensivePath = 'tests/fixtures/wisdom-angel-v01700/defensive-round-2.json';
    expect(await fileHash(defensivePath)).toBe('6d34a93817e084cc3937eb15cde42300137d9d3b71c8ff84d814c42c8a46f870');
    expect(readObjectEntry<SliceState>(defensivePath, 'final')).toMatchObject({ status: 'DEAD', health: 0, random: { seed: 'reader-natural-v023', cursor: 209 } });
  }, 60_000);
  it('explicitly migrates all historical inputs and preserves eight roots,19 skills and five zeros', () => {
    const raw = readObjectEntry<SliceState>(wisdomAngelBranchPath, 'beforeLast'), s = originalWisdomAngel();
    expect(s).toMatchObject({ schemaVersion: 189, contentVersion: 'all-knowing-eye-v189', status: 'ACTIVE', revision: 538 });
    expect(s.allKnowingEye).toEqual(createAllKnowingEyeState()); expect(originalReaderRoots(s)).toEqual(originalReaderRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...ALL_KNOWING_EYE_INHERITED_ABILITY_IDS]); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.seer.pollution).toBe(0); expect(s.injuries).toEqual([]); assertValidSliceState(s);
    for (const path of [wisdomAngelNaturalPath, 'tests/fixtures/wisdom-angel-v01700/defensive-round-2.json']) {
      const dead = loadAllKnowingEyeFixture(path, 'final'); rejectAllKnowingEye(dead, { type: 'LEARN_GUIDANCE' }); expect(dead.status).toBe('DEAD');
    }
  }, 60_000);
  it('keeps original papers, zero-charge device, paid crafts and independent old outcomes', () => {
    const s = originalWisdomAngel(), life = s.wisdomAngel.life;
    expect(life.papers.map(p => [p.id, p.location, p.firstReadWeek])).toEqual([['WA2-SHEET-1', 'TABLE', 118], ['WA2-SHEET-2', 'TABLE', 118]]);
    expect(life.device).toMatchObject({ charges: 0, filter: 'AMBER', conditionVersion: 2, demonstrations: 2, filterChanges: 1 });
    expect(s.mysticismMagister.crafts.map(c => [c.id, c.status, c.usedWeek])).toEqual([['MM5-FLASH-1', 'CONSUMED', 58], ['MM5-FLASH-3', 'PLAYER', null], ['MM5-FLASH-4', 'PLAYER', null]]);
    expect(s.polymath.samples.FLASH.learnedWeek).toBe(42); expect(s.insightScholar.encounter.status).toBe('RESOLVED');
    expect(s.prophet.encounter.enemy.status).toBe('SURRENDERED');
    expect(s.wisdomAngel.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
  }, 60_000);
  it('hides unrelated paths and creates independent bottles and nested scene state', () => {
    const s = createSliceRun('eye-hidden', sliceDefaultCreationSelection, 'eye-hidden');
    expect(projectAllKnowingEye(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectAllKnowingEye(s, { type: 'LEARN_GUIDANCE' }); const other = createAllKnowingEyeState(); other.bottles[0]!.labourSteps = 5;
    expect(s.allKnowingEye.bottles[0]!.labourSteps).toBe(0);
  });
});

describe('All-Knowing Eye finite actual acquisition', () => {
  it('requires real500 guidance funds and seals the source without free recovery', () => {
    const original = originalWisdomAngel(); rejectAllKnowingEye(original, { type: 'LEARN_GUIDANCE' });
    const before = ready(original, { cash: 500 }), s = ae(before, { type: 'LEARN_GUIDANCE' }), event = journal(s)[0]!, scene = s.allKnowingEye.sourceScene!;
    expect(event.before.cash - event.after.cash).toBe(500); expect(event.before.actions - event.after.actions).toBe(1);
    expect(event.after.health).toBe(event.before.health); expect(event.after.mind).toBe(event.before.mind); expect(event.after.spirituality).toBe(event.before.spirituality);
    expect(scene.originals).toEqual({ playerLocation: before.wisdomAngel.life.playerLocation, playerTravelMetres: before.wisdomAngel.life.playerTravelMetres, clockSeconds: before.wisdomAngel.life.clockSeconds,
      room: before.wisdomAngel.life.room, mara: before.wisdomAngel.life.mara, papers: before.wisdomAngel.life.papers, device: before.wisdomAngel.life.device });
    for (const key of readerLegacyKeys) expect(s.allKnowingEye.sourceHistory![key]).toEqual(before[key]);
    expect(s.allKnowingEye.sourceHistory!.wisdomAngel).not.toBe(s.wisdomAngel); expect(scene.character).toEqual(before.character);
    expect(event.actor).toMatchObject({ pathwayId: 'white-tower', wisdomAngelPromotionWeek: 117, readerPromotionWeek: 5 });
    expect([event.cursorBefore, event.cursorAfter, event.check]).toEqual([before.random.cursor, before.random.cursor, null]);
    expect(validateAllKnowingEyeSource(s)).toBe(true); expect(validateAllKnowingEyeAcquisitionJournal(s)).toBe(true); rejectAllKnowingEye(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('requires three complete original reports, original chronology and exactly19 old skills', () => {
    const mutations = [
      (s: SliceState) => { s.wisdomAngel.life.reflected = false; },
      (s: SliceState) => { s.wisdomAngel.life.cases['record-handover'].status = 'EXAMINED'; },
      (s: SliceState) => { s.wisdomAngel.life.cases['withdrawn-consent'].attempts[0]!.papersReturned = false; },
      (s: SliceState) => { s.wisdomAngel.insightScholarActingAtPromotion = 99; },
      (s: SliceState) => { s.insightScholar.promotionWeek = null; },
      (s: SliceState) => { s.reader.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.consumedWeek = 6; },
      (s: SliceState) => { delete s.progression.mastery['reader.s5.material-imitation']; },
      (s: SliceState) => { s.progression.mastery['reader.s1.invented'] = 0; },
    ];
    for (const mutate of mutations) { const s = ready(originalWisdomAngel(), { cash: 500 }); mutate(s); rejectAllKnowingEye(s, { type: 'LEARN_GUIDANCE' }); }
  }, 60_000);
  it('uses the real S2promotion117 clock rather than general S9promotion5', () => {
    const s = taught(); expect(s.week - s.wisdomAngel.promotionWeek!).toBeLessThan(12);
    expect(projectAllKnowingEye(s).digestion).toContain(`${s.week - 117}/12`);
    expect(s.progression.promotionWeek).toBe(5); expect(s.wisdomAngel.promotionWeek).toBe(117);
    expect(allKnowingEyeAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('/12');
    const final = prepared(); expect(final.week).toBeGreaterThanOrEqual(129); expect(originalReaderRoots(final)).toEqual(originalReaderRoots(originalWisdomAngel()));
  }, 60_000);
  it('rejects absent confirmation, invented commands, old preparation IDs and foreign bottles', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'wisdom-angel-potion-1' },
      { ...dose, bottleId: 'all-knowing-eye-potion-0' }, { ...dose, transformGender: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }, { type: 'RECHARGE_DEVICE' },
    ]) expect(validateAllKnowingEyeCommand(command)).toBe(false);
    expect(validateAllKnowingEyeCommand(dose)).toBe(true); expect(ALL_KNOWING_EYE_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'RECORD_CONDITIONS', 'MARK_RETURN']);
  });
  it('records exactly five paid-in-actions jobs,5500 credit and1100 balance on one original', () => {
    const s = prepared(), jobs = journal(s).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(s).find(e => e.command.type === 'BUY_POTION')!;
    expect(jobs).toHaveLength(5); for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.after.actions).toBe(purchase.before.actions);
    expect(s.allKnowingEye.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(s.allKnowingEye.bottles.slice(1).every(b => b.labourSteps === 0 && b.status === 'SUPPLIER')).toBe(true);
    expect(ALL_KNOWING_EYE_PRICES).toMatchObject({ potion: 6600, labourCredit: 5500, labourBalance: 1100 });
    expect(journal(s).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(s.actionsRemaining).toBeLessThanOrEqual(3); expect(s.weeklyBudget).toBe(3); expect(s.random.seed).toBe('reader-natural-v023');
    expect(validateAllKnowingEyeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('keeps actual cancellation costs, blocks ordinary escape from prepared site and retains original bottle', () => {
    const s = prepared(), site = journal(s).at(-1)!; expect(site.command.type).toBe('PREPARE_PROMOTION');
    expect(site.before.cash - site.after.cash).toBe(150); expect(site.before.actions - site.after.actions).toBe(1);
    expect(hasAllKnowingEyeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ae(s, { type: 'LEAVE_PREPARATION' }), event = journal(left).at(-1)!;
    expect(event.before).toEqual(event.after); expect(hasAllKnowingEyeLock(left)).toBe(false);
    expect(left.allKnowingEye.bottles[0]!.status).toBe('PLAYER'); expect(left.allKnowingEye.preparations).toEqual(s.allKnowingEye.preparations);
    rejectAllKnowingEye(left, dose); expect(validateAllKnowingEyeAcquisitionJournal(left)).toBe(true);
  }, 60_000);
  it('records the actual same-seed bottle outcome, costs and one draw without replacing failure', () => {
    const before = prepared(), s = ae(before, dose), event = journal(s).at(-1)!, kind = event.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const healthCost = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, mindCost = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([event.after.health, event.after.mind, event.after.spirituality]).toEqual([Math.max(1, event.before.health - healthCost), Math.max(1, event.before.mind - mindCost), event.before.spirituality]);
    expect(event.after.sequence).toBe(succeeds ? 1 : 2); expect(s.character.gender).toBe('FEMALE');
    expect(s.allKnowingEye.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: event.week, preparationWeek: event.week });
    expect(s.allKnowingEye.preparedWeek).toBeNull(); expect(originalReaderRoots(s)).toEqual(originalReaderRoots(before));
    expect([event.cursorAfter, event.randomAfter]).toEqual([event.cursorBefore + 1, event.randomBefore! + 1]);
    for (const id of ALL_KNOWING_EYE_INHERITED_ABILITY_IDS) expect(event.after.mastery[id]).toBe(event.before.mastery[id]);
    expect(validateAllKnowingEyeAcquisitionJournal(s)).toBe(true); expect(validateAllKnowingEyeState(s)).toBe(true);
  }, 60_000);
  it('finishes with21 exact skills, two new zeros and unchanged actual old identities/resources', () => {
    const s = promoted(), source = originalWisdomAngel(), receipt = journal(s).at(-1)!;
    expect(receipt.command.type).toBe('CONSUME'); expect(receipt.after.sequence).toBe(1);
    expect(Object.keys(s.progression.mastery)).toHaveLength(21); expect(s.progression.acting).toBe(0); expect(s.allKnowingEye.wisdomAngelActingAtPromotion).toBe(100);
    for (const id of ALL_KNOWING_EYE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ALL_KNOWING_EYE_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalReaderRoots(s)).toEqual(originalReaderRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed); rejectAllKnowingEye(s, dose);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(receipt.after.coreStats[stat]).toBe(receipt.before.coreStats[stat] + 1);
    expect(receipt.after.spirituality).toBe(receipt.before.spirituality); assertValidSliceState(s);
  }, 60_000);
  it('does not request free resupply before all originals actually fail', () => {
    const s = taught(); rejectAllKnowingEye(s, { type: 'REQUEST_SUPPLY' }); rejectAllKnowingEye(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.allKnowingEye.bottles).toHaveLength(3); expect(s.allKnowingEye.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const receipt of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(receipt.before.cash - receipt.after.cash).toBe(100); expect(receipt.before.actions - receipt.after.actions).toBe(1);
      const delivery = journal(finish).find(e => e.command.type === 'RECEIVE_SUPPLY' && e.revision > receipt.revision)!;
      expect(delivery.week).toBeGreaterThan(receipt.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.allKnowingEye.bottles.map(b => b.id)).size).toBe(finish.allKnowingEye.bottles.length);
  }, 60_000);
});

describe('All-Knowing Eye immutable anchors and exact acquisition replay', () => {
  it('reconstructs the genuine paid-guidance S2 checkpoint without editing live state', () => {
    const s = promoted(), before = structuredClone(s), view = allKnowingEyeInheritedView(s), scene = s.allKnowingEye.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery); expect(view.character).toEqual(scene.character);
    expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision); expect(view.allKnowingEye).toEqual(createAllKnowingEyeState());
    expect(validateWisdomAngelState(view)).toBe(true); expect(s).toEqual(before);
  }, 60_000);
  it('rejects changed source identity, old zero mastery, restored crafts and unsupported original edits', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; }, (s: SliceState) => { s.character.name = '另一个人'; }, (s: SliceState) => { s.character.age++; },
      (s: SliceState) => { s.progression.mastery['reader.s3.method-analysis'] = 8; },
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.status = 'PLAYER'; s.mysticismMagister.crafts[0]!.usedWeek = null; },
      (s: SliceState) => { s.mysticismMagister.crafts.push(structuredClone(s.mysticismMagister.crafts[1]!)); },
      (s: SliceState) => { s.wisdomAngel.life.playerTravelMetres++; }, (s: SliceState) => { s.wisdomAngel.life.mara.travelMetres++; },
      (s: SliceState) => { s.wisdomAngel.life.device.charges++; }, (s: SliceState) => { s.wisdomAngel.life.papers[0].text += '赠送'; },
      (s: SliceState) => { s.wisdomAngel.life.papers[0].firstReadWeek = s.week; }, (s: SliceState) => { s.wisdomAngel.life.journal.pop(); },
      (s: SliceState) => { s.allKnowingEye.sourceScene!.character.gender = 'MALE'; },
      (s: SliceState) => { s.allKnowingEye.sourceHistory!.wisdomAngel.life.device.charges++; },
      (s: SliceState) => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ]) { const s = promoted(); mutate(s); expect(validateAllKnowingEyeState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged resource deltas, chronology, random checks, bottle identity and duplicate preparations', () => {
    for (const mutate of [
      (s: SliceState) => { s.cash++; }, (s: SliceState) => { s.actionsRemaining++; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; }, (s: SliceState) => { journal(s)[0]!.after.actions++; },
      (s: SliceState) => { journal(s)[1]!.revision = journal(s)[0]!.revision; },
      (s: SliceState) => { journal(s)[0]!.week = s.week + 1; },
      (s: SliceState) => { s.allKnowingEye.sourceScene!.revision = s.revision + 1; },
      (s: SliceState) => { s.allKnowingEye.sourceScene!.random.cursor = s.random.cursor + 1; },
      (s: SliceState) => { s.allKnowingEye.bottles[0]!.id = 'all-knowing-eye-potion-2'; },
      (s: SliceState) => { s.allKnowingEye.preparations[1]!.taskId = s.allKnowingEye.preparations[0]!.taskId; },
    ]) { const s = prepared(); mutate(s); expect(validateAllKnowingEyeState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const result = journal(s).at(-1)!.check!; result.roll = result.roll === 1 ? 2 : 1; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.allKnowingEye.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateAllKnowingEyeState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('closes all old mutation routes once current guidance freezes their history', () => {
    const s = taught();
    for (const intent of [
      { type: 'WISDOM_ANGEL', command: { type: 'MAKE_INHERITED_FLASH' } },
      { type: 'WISDOM_ANGEL', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'READER', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalReaderRoots(s)).toEqual(originalReaderRoots(originalWisdomAngel()));
  }, 60_000);
});
