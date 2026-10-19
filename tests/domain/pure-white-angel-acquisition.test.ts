import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateLightSeekerState } from '../../src/domain/light-seeker/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS, createPureWhiteAngelState, hasPureWhiteAngelLock,
  projectPureWhiteAngel, pureWhiteAngelInheritedView, validatePureWhiteAngelAcquisitionJournal,
  validatePureWhiteAngelCommand, validatePureWhiteAngelSource, validatePureWhiteAngelState,
  pureWhiteAngelAcquisitionBlock,
} from '../../src/domain/pure-white-angel/index.js';
import { PURE_WHITE_ANGEL_ABILITY_IDS, PURE_WHITE_ANGEL_PREPARATION_IDS } from '../../src/domain/pure-white-angel/types.js';
import { PURE_WHITE_ANGEL_PRICES } from '../../src/domain/pure-white-angel/content.js';
import {
  pw, step, dose, originalSunRoots, originalLightSeeker, prepared, promoted, ready, recoverResources,
  rejectPureWhiteAngel, rejectIntent, taught, lightSeekerNaturalPath, sunLegacyKeys,
} from './pure-white-angel-directed-helper.js';

const journal = (s: SliceState) => s.pureWhiteAngel.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Pure White Angel genuine Sun source', () => {
  it('pins raw169 and729 commands without healing the source or reviving Owen', async () => {
    expect(await fileHash(lightSeekerNaturalPath)).toBe('0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556');
    const raw = readObjectEntry<SliceState>(lightSeekerNaturalPath, 'final');
    expect(readObjectEntry<SliceIntent[]>(lightSeekerNaturalPath, 'commands')).toHaveLength(729);
    expect(raw).toMatchObject({ schemaVersion: 169, contentVersion: 'light-seeker-v169', revision: 730, week: 175, status: 'ACTIVE', health: 50, injuryRisk: 3 });
    expect(raw.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(raw.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(raw.lightSeeker.life.site).toMatchObject({ playerMetres: 94, operatorEnergy: 90, spiritEnergy: 96, elapsedSeconds: 976 });
  }, 120_000);
  it('migrates without changing any of eight roots,20 masteries or five zeros', () => {
    const raw = readObjectEntry<SliceState>(lightSeekerNaturalPath, 'final'), s = originalLightSeeker();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(s.pureWhiteAngel).toEqual(createPureWhiteAngelState());
    expect(originalSunRoots(s)).toEqual(originalSunRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression);
    expect(s.combatHistory).toEqual(raw.combatHistory); expect(s.injuries).toEqual(raw.injuries);
    expect(Object.keys(s.progression.mastery)).toEqual([...PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(() => migrateSliceState({ ...raw, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...raw, contentVersion: 'light-seeker-v168' })).toThrow();
    assertValidSliceState(s);
  }, 120_000);
  it('accepts purchased, brewed and completed-ritual provenance without inventing fields', () => {
    const s = taught(), source = s.pureWhiteAngel.sourceHistory!;
    expect(source.sunpriest.formulaKnown).toBe(true); expect(source.notary.formulaKnown).toBe(true);
    for (const stage of [source.sunpriest, source.notary]) {
      expect(Object.hasOwn(stage, 'guidanceKnown')).toBe(false);
      for (const bottle of stage.bottles) {
        expect(Object.hasOwn(bottle, 'acquiredWeek')).toBe(false);
        expect(Object.hasOwn(bottle, 'consumedWeek')).toBe(false);
        expect(bottle.brewedWeek).toBeLessThanOrEqual(stage.promotionWeek!);
      }
    }
    const ritual = source.unshadowed.ritual.visits.find(v => v.finishedSuccess)!;
    expect(source.unshadowed.bottles.find(b => b.id === ritual.pendingBottleId)?.ritualId).toBe(ritual.id);
    expect(source.priestOfLight.ritual.history.every(v => v.entered && v.returned)).toBe(true);
    expect(validatePureWhiteAngelSource(s)).toBe(true);
  }, 120_000);
  it('uses real clinic discovery, paid treatment and later ordinary rest', () => {
    const original = originalLightSeeker();
    let s = step(original, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(s.careKnown).toBe(true); expect(s.injuries).toEqual(original.injuries); expect(s.cash).toBe(original.cash);
    s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    const before = s;
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY' });
    expect(before.cash - s.cash).toBe(60); expect(s.health).toBe(before.health);
    expect(s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision !== null)).toBe(true);
    s = recoverResources(s);
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0); expect(s.health).toBe(100);
    expect(originalSunRoots(s)).toEqual(originalSunRoots(original));
    expect(s.lightSeeker.encounter.enemyStatus).toBe('DEAD'); assertValidSliceState(s);
  }, 120_000);
  it('hides unrelated paths and does not share mutable default bottle state', () => {
    const s = createSliceRun('pure-white-hidden', sliceDefaultCreationSelection, 'pure-white-hidden');
    expect(projectPureWhiteAngel(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectPureWhiteAngel(s, { type: 'LEARN_GUIDANCE' });
    const other = createPureWhiteAngelState(); other.bottles[0]!.labourSteps = 5;
    expect(s.pureWhiteAngel.bottles[0]!.labourSteps).toBe(0);
  });
});

describe('Pure White Angel finite paid acquisition', () => {
  it('charges500 and1 action while freezing the actual wounded source', () => {
    const before = originalLightSeeker(), s = taught(), event = journal(s)[0]!, scene = s.pureWhiteAngel.sourceScene!;
    expect(event.before.cash - event.after.cash).toBe(500); expect(event.before.actions - event.after.actions).toBe(1);
    expect([s.health, s.mind, s.spirituality]).toEqual([50, 100, 87]); expect(s.injuries).toEqual(before.injuries);
    expect(scene.originals).toEqual(before.lightSeeker.life.site); expect(scene.budget.injuries).toEqual(before.injuries);
    for (const key of sunLegacyKeys) expect(s.pureWhiteAngel.sourceHistory![key]).toEqual(before[key]);
    expect(s.pureWhiteAngel.sourceHistory!.lightSeeker).not.toBe(s.lightSeeker);
    expect(event.actor).toMatchObject({ pathwayId: 'sun', lightSeekerPromotionWeek: 167, bardPromotionWeek: 5 });
    expect([event.cursorBefore, event.cursorAfter, event.check]).toEqual([356, 356, null]);
    expect(validatePureWhiteAngelAcquisitionJournal(s)).toBe(true); rejectPureWhiteAngel(s, { type: 'LEARN_GUIDANCE' });
  }, 120_000);
  it('requires exact old reports, real bottle and ritual provenance, and20 old skill keys', () => {
    const mutations = [
      (s: SliceState) => { s.lightSeeker.life.reflected = false; },
      (s: SliceState) => { s.lightSeeker.life.cases['marker-path'].status = 'EXAMINED'; },
      (s: SliceState) => { s.lightSeeker.life.cases['withdrawn-visit'].attempts[0]!.closed = false; },
      (s: SliceState) => { s.lightSeeker.justiceMentorActingAtPromotion = 99; },
      (s: SliceState) => { s.justiceMentor.promotionWeek = null; },
      (s: SliceState) => { s.sunpriest.bottles[0]!.brewedWeek = s.week; },
      (s: SliceState) => { s.priestOfLight.ritual.history.at(-1)!.returned = false; },
      (s: SliceState) => { s.unshadowed.ritual.visits[0]!.finishedSuccess = false; },
      (s: SliceState) => { s.bard.bottles[0]!.consumedWeek = 6; },
      (s: SliceState) => { delete s.progression.mastery['sun.s7.holy-light']; },
      (s: SliceState) => { s.progression.mastery['sun.s1.invented'] = 0; },
    ];
    for (const mutate of mutations) { const s = originalLightSeeker(); mutate(s); rejectPureWhiteAngel(s, { type: 'LEARN_GUIDANCE' }); }
  }, 120_000);
  it('uses actualS2 promotion167 rather than the initialS9 promotion5', () => {
    const s = taught();
    expect(projectPureWhiteAngel(s).digestion).toContain('8/12');
    expect(pureWhiteAngelAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('/12');
    const final = prepared(); expect(final.week).toBeGreaterThanOrEqual(179);
    expect(originalSunRoots(final)).toEqual(originalSunRoots(originalLightSeeker()));
  }, 180_000);
  it('rejects foreign bottles, unsupported commands and missing independent consent', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'LOCATE_TARGET' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'light-seeker-potion-1' },
      { ...dose, bottleId: 'pure-white-angel-potion-0' }, { ...dose, transformGender: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }, { type: 'RECHARGE_DEVICE' },
    ]) expect(validatePureWhiteAngelCommand(command)).toBe(false);
    expect(validatePureWhiteAngelCommand(dose)).toBe(true);
    expect(PURE_WHITE_ANGEL_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'VERIFY_TARGET', 'PLAN_RETURN']);
  });
  it('records five real bottle-specific jobs,5500 credit,1100 balance and150 preparation', () => {
    const s = prepared(), jobs = journal(s).filter(e => e.command.type === 'POTION_WORK');
    expect(jobs).toHaveLength(5);
    for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    const purchase = journal(s).find(e => e.command.type === 'BUY_POTION')!, prep = journal(s).at(-1)!;
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.before.actions).toBe(purchase.after.actions);
    expect(prep.before.cash - prep.after.cash).toBe(PURE_WHITE_ANGEL_PRICES.preparation); expect(prep.before.actions - prep.after.actions).toBe(1);
    expect(s.pureWhiteAngel.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(s.pureWhiteAngel.bottles.slice(1).every(b => b.labourSteps === 0 && b.status === 'SUPPLIER')).toBe(true);
    expect(hasPureWhiteAngelLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
  }, 180_000);
  it('cancels only the paid current preparation with no refund or bottle regeneration', () => {
    const before = prepared(), s = pw(before, { type: 'LEAVE_PREPARATION' });
    expect(s.pureWhiteAngel.preparedWeek).toBeNull(); expect(s.cash).toBe(before.cash);
    expect(s.pureWhiteAngel.bottles).toEqual(before.pureWhiteAngel.bottles);
    expect(s.pureWhiteAngel.preparations).toEqual(before.pureWhiteAngel.preparations);
    rejectPureWhiteAngel(s, dose); rejectPureWhiteAngel(s, { type: 'LEAVE_PREPARATION' });
    expect(validatePureWhiteAngelState(s)).toBe(true);
  }, 180_000);
  it('pays for the actual seeded outcome without granting free health, spirituality or inherited mastery', () => {
    const before = prepared(), s = pw(before, dose), event = journal(s).at(-1)!;
    expect(s.pureWhiteAngel.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: event.check!.tier, consumedWeek: event.week, preparationWeek: event.week });
    expect(s.pureWhiteAngel.preparedWeek).toBeNull(); expect(event.after.spirituality).toBe(event.before.spirituality);
    expect(event.after.gender).toBe(event.before.gender); expect(originalSunRoots(s)).toEqual(originalSunRoots(before));
    expect(event.cursorAfter).toBe(event.cursorBefore + 1); expect(event.randomAfter).toBe(event.randomBefore! + 1);
    for (const id of PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS) expect(event.after.mastery[id]).toBe(event.before.mastery[id]);
    if (event.after.sequence === 1) {
      expect(event.after.health).toBe(event.before.health);
      expect(event.before.mind - event.after.mind).toBe(event.check!.tier === 'GREAT_SUCCESS' ? 8 : 15);
    } else {
      const severe = event.check!.tier === 'GREAT_FAILURE';
      expect(event.after.health).toBe(Math.max(1, event.before.health - (severe ? 25 : 15)));
      expect(event.after.mind).toBe(Math.max(1, event.before.mind - (severe ? 45 : 25)));
      expect(event.after.acting).toBe(100);
    }
    expect(validatePureWhiteAngelAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 180_000);
  it('finishes with22 skills, two new zeros and unchanged original people and objects', () => {
    const s = promoted(), source = originalLightSeeker(), receipt = journal(s).at(-1)!;
    expect(Object.keys(s.progression.mastery)).toHaveLength(22); expect(s.progression.acting).toBe(0);
    expect(s.pureWhiteAngel.lightSeekerActingAtPromotion).toBe(100);
    for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of PURE_WHITE_ANGEL_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalSunRoots(s)).toEqual(originalSunRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed); rejectPureWhiteAngel(s, dose);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(receipt.after.coreStats[stat]).toBe(receipt.before.coreStats[stat] + 1);
    expect(receipt.after.spirituality).toBe(receipt.before.spirituality); assertValidSliceState(s);
  }, 180_000);
  it('never grants early or free resupply and keeps paid later batches independent', () => {
    const s = taught(); rejectPureWhiteAngel(s, { type: 'REQUEST_SUPPLY' }); rejectPureWhiteAngel(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.pureWhiteAngel.bottles).toHaveLength(3);
    const finish = promoted();
    for (const receipt of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(receipt.before.cash - receipt.after.cash).toBe(100); expect(receipt.before.actions - receipt.after.actions).toBe(1);
      const delivery = journal(finish).find(e => e.command.type === 'RECEIVE_SUPPLY' && e.revision > receipt.revision)!;
      expect(delivery.week).toBeGreaterThan(receipt.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.pureWhiteAngel.bottles.map(b => b.id)).size).toBe(finish.pureWhiteAngel.bottles.length);
  }, 180_000);
});

describe('Pure White Angel immutable source and chronological replay', () => {
  it('reconstructs the exact wounded paid-guidanceS2 source without editing current play', () => {
    const s = promoted(), before = structuredClone(s), view = pureWhiteAngelInheritedView(s), scene = s.pureWhiteAngel.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery);
    expect(view.character).toEqual(scene.character); expect(view.injuries).toEqual(scene.budget.injuries);
    expect(view.health).toBe(50); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.pureWhiteAngel).toEqual(createPureWhiteAngelState()); expect(validateLightSeekerState(view)).toBe(true); expect(s).toEqual(before);
  }, 180_000);
  it('rejects changed identity, manufactured mastery, restored materials and revived Owen', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; }, (s: SliceState) => { s.character.name = '另一个人'; },
      (s: SliceState) => { s.character.age++; }, (s: SliceState) => { s.progression.mastery['sun.s7.holy-light'] = 8; },
      (s: SliceState) => { s.lightSeeker.life.site.playerMetres++; }, (s: SliceState) => { s.lightSeeker.life.site.operatorEnergy++; },
      (s: SliceState) => { s.lightSeeker.life.site.spiritEnergy++; }, (s: SliceState) => { s.lightSeeker.life.site.lamp.oil++; },
      (s: SliceState) => { s.lightSeeker.life.site.shutter.durability++; }, (s: SliceState) => { s.lightSeeker.life.site.screen.durability++; },
      (s: SliceState) => { s.lightSeeker.life.site.board.read = false; }, (s: SliceState) => { s.lightSeeker.life.journal.pop(); },
      (s: SliceState) => { s.lightSeeker.encounter.enemyHealth = 100; }, (s: SliceState) => { s.lightSeeker.encounter.enemyStatus = 'RESISTING'; },
      (s: SliceState) => { s.pureWhiteAngel.sourceScene!.character.gender = 'MALE'; },
      (s: SliceState) => { s.pureWhiteAngel.sourceHistory!.lightSeeker.life.site.operatorEnergy++; },
    ]) { const s = promoted(); mutate(s); expect(validatePureWhiteAngelState(s), mutate.toString()).toBe(false); }
  }, 180_000);
  it('rejects forged journal costs, chronology, randomness and duplicate original identity', () => {
    for (const mutate of [
      (s: SliceState) => { s.cash++; }, (s: SliceState) => { s.actionsRemaining++; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; }, (s: SliceState) => { journal(s)[0]!.after.actions++; },
      (s: SliceState) => { journal(s)[1]!.revision = journal(s)[0]!.revision; },
      (s: SliceState) => { s.pureWhiteAngel.sourceScene!.revision = s.revision + 1; },
      (s: SliceState) => { s.pureWhiteAngel.bottles[0]!.id = 'pure-white-angel-potion-2'; },
      (s: SliceState) => { s.pureWhiteAngel.preparations[1]!.taskId = s.pureWhiteAngel.preparations[0]!.taskId; },
    ]) { const s = prepared(); mutate(s); expect(validatePureWhiteAngelState(s), mutate.toString()).toBe(false); }
    const bad = promoted(); journal(bad).at(-1)!.randomAfter!++; expect(validatePureWhiteAngelState(bad)).toBe(false);
    const wrongCheck = promoted(), check = journal(wrongCheck).at(-1)!.check!; check.roll = check.roll === 1 ? 2 : 1;
    expect(validatePureWhiteAngelState(wrongCheck)).toBe(false);
  }, 180_000);
  it('closes old mutation routes as soon as guidance freezes their actual history', () => {
    const s = taught();
    for (const intent of [
      { type: 'LIGHT_SEEKER', command: { type: 'REFLECT' } }, { type: 'LIGHT_SEEKER', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'BARD', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalSunRoots(s)).toEqual(originalSunRoots(originalLightSeeker()));
  }, 120_000);
});
