import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateCatastropheState } from '../../src/domain/catastrophe/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  THUNDER_GOD_INHERITED_ABILITY_IDS, createThunderGodState, hasThunderGodLock,
  projectThunderGod, thunderGodInheritedView, validateThunderGodAcquisitionJournal,
  validateThunderGodCommand, validateThunderGodSource, validateThunderGodState,
  thunderGodAcquisitionBlock,
} from '../../src/domain/thunder-god/index.js';
import { THUNDER_GOD_ABILITY_IDS, THUNDER_GOD_PREPARATION_IDS } from '../../src/domain/thunder-god/types.js';
import { THUNDER_GOD_PRICES } from '../../src/domain/thunder-god/content.js';
import {
  tg, dose, originalTyrantRoots, originalCatastrophe, prepared, promoted, ready, rejectThunderGod,
  rejectIntent, taught, catastropheNaturalPath, catastropheBranchPath, tyrantLegacyKeys, loadThunderGodFixture,
} from './thunder-god-directed-helper.js';

const journal = (s: SliceState) => s.thunderGod.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Thunder God original source: raw evidence is separate from migration', () => {
  it('pins raw168 living599 checkpoint and preserves the actual602-command death', async () => {
    expect(await fileHash(catastropheNaturalPath)).toBe('cb8649c4d3dc15b5fa61601591eaed3f99579082f01bffa4f566afbf7ed8dc53');
    expect(await fileHash(catastropheBranchPath)).toBe('3ee5d4bfb9582aabb88a477bd5f0b5a47c335e8dbe5074b0eafbafff35d8b448');
    const branch = readObjectEntry<SliceState>(catastropheBranchPath, 'beforeLast');
    const final = readObjectEntry<SliceState>(catastropheNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(catastropheNaturalPath, 'commands');
    expect(branch).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 600, status: 'ACTIVE', health: 100, random: { seed: 'sailor-natural-v026', cursor: 267 } });
    expect(final).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 603, status: 'DEAD', health: 0, random: { seed: 'sailor-natural-v026', cursor: 282 } });
    expect(commands).toHaveLength(602); expect(commands.slice(0, 599)).toHaveLength(599);
    expect(commands[598]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[599]).toEqual({ type: 'CATASTROPHE', command: { type: 'ENCOUNTER_TALK' } });
    expect(branch.catastrophe.encounter.approachWeek).toBeNull(); expect(final.catastrophe.encounter.status).toBe('LOST');
    expect(final.ending?.kind).toBe('DEATH'); expect(branch.ending).toBeNull();
  }, 60_000);
  it('explicitly migrates historical inputs while preserving eight roots,22 skills and seven zeros', () => {
    const raw = readObjectEntry<SliceState>(catastropheBranchPath, 'beforeLast'), s = originalCatastrophe();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, status: 'ACTIVE', revision: 600 });
    expect(s.thunderGod).toEqual(createThunderGodState()); expect(originalTyrantRoots(s)).toEqual(originalTyrantRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...THUNDER_GOD_INHERITED_ABILITY_IDS]); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7);
    expect(s.seer.pollution).toBe(0); expect(s.injuries).toEqual([]); assertValidSliceState(s);
    const dead = loadThunderGodFixture(catastropheNaturalPath, 'final'); rejectThunderGod(dead, { type: 'LEARN_GUIDANCE' }); expect(dead.status).toBe('DEAD');
    expect(() => migrateSliceState({ ...raw, schemaVersion: CURRENT_SCHEMA_VERSION + 1, contentVersion: 'unknown-future' })).toThrow();
    expect(() => migrateSliceState({ ...raw, contentVersion: 'catastrophe-v167' })).toThrow();
  }, 60_000);
  it('keeps every original bay resource and independent old outcome', () => {
    const raw = readObjectEntry<SliceState>(catastropheBranchPath, 'beforeLast'), s = originalCatastrophe(), site = s.catastrophe.life.site;
    expect(site).toEqual(raw.catastrophe.life.site);
    expect(site).toMatchObject({ id: 'CT2-COVE', boundaryMetres: 12, clockSeconds: 123, playerPosition: 'EXIT', playerTravelMetres: 12,
      keeper: { id: 'CT2-NORA', age: 45, alive: true, position: 'CONTROL', energy: 88, travelMetres: 36 },
      water: { originalUnits: 20, bayUnits: 20, channelUnits: 0 }, gate: { position: 'CLOSED', durability: 96, operations: 4 },
      buoy: { offsetMetres: 0 }, mooring: { durability: 99 }, winch: { durability: 99 }, wheel: { durability: 99, turns: 1 } });
    expect(s.cataclysmPriest.encounter.enemy.status).toBe('DEAD'); expect(s.seaKing.encounter.status).toBe('RESOLVED');
    expect(s.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    expect(originalTyrantRoots(s)).toEqual(originalTyrantRoots(raw));
  }, 60_000);
  it('hides unrelated paths and creates independent bottles and nested scene state', () => {
    const s = createSliceRun('thunder-hidden', sliceDefaultCreationSelection, 'thunder-hidden');
    expect(projectThunderGod(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectThunderGod(s, { type: 'LEARN_GUIDANCE' }); const other = createThunderGodState(); other.bottles[0]!.labourSteps = 5;
    expect(s.thunderGod.bottles[0]!.labourSteps).toBe(0);
  });
});

describe('Thunder God finite actual acquisition', () => {
  it('requires real500 guidance funds and seals the source without free recovery', () => {
    const original = originalCatastrophe(); rejectThunderGod(original, { type: 'LEARN_GUIDANCE' });
    const before = ready(original, { cash: 500 }), s = tg(before, { type: 'LEARN_GUIDANCE' }), event = journal(s)[0]!, scene = s.thunderGod.sourceScene!;
    expect(event.before.cash - event.after.cash).toBe(500); expect(event.before.actions - event.after.actions).toBe(1);
    expect(event.after.health).toBe(event.before.health); expect(event.after.mind).toBe(event.before.mind); expect(event.after.spirituality).toBe(event.before.spirituality);
    expect(scene.originals).toEqual(before.catastrophe.life.site);
    for (const key of tyrantLegacyKeys) expect(s.thunderGod.sourceHistory![key]).toEqual(before[key]);
    expect(s.thunderGod.sourceHistory!.catastrophe).not.toBe(s.catastrophe); expect(scene.character).toEqual(before.character);
    expect(event.actor).toMatchObject({ pathwayId: 'tyrant', catastrophePromotionWeek: 131, sailorPromotionWeek: 7 });
    expect([event.cursorBefore, event.cursorAfter, event.check]).toEqual([before.random.cursor, before.random.cursor, null]);
    expect(validateThunderGodSource(s)).toBe(true); expect(validateThunderGodAcquisitionJournal(s)).toBe(true); rejectThunderGod(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('requires three complete original reports, original chronology and exactly22 old skills', () => {
    const mutations = [
      (s: SliceState) => { s.catastrophe.life.reflected = false; },
      (s: SliceState) => { s.catastrophe.life.cases['buoy-return'].status = 'EXAMINED'; },
      (s: SliceState) => { s.catastrophe.life.cases['withdrawn-request'].attempts[0]!.keeperReturned = false; },
      (s: SliceState) => { s.catastrophe.seaKingActingAtPromotion = 99; },
      (s: SliceState) => { s.seaKing.promotionWeek = null; },
      (s: SliceState) => { s.sailor.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.consumedWeek = 8; },
      (s: SliceState) => { delete s.progression.mastery['tyrant.s7.water-control']; },
      (s: SliceState) => { s.progression.mastery['tyrant.s1.invented'] = 0; },
    ];
    for (const mutate of mutations) { const s = ready(originalCatastrophe(), { cash: 500 }); mutate(s); rejectThunderGod(s, { type: 'LEARN_GUIDANCE' }); }
  }, 60_000);
  it('uses the real S2promotion131 clock rather than general S9promotion7', () => {
    const s = taught(); expect(s.week - s.catastrophe.promotionWeek!).toBeLessThan(12);
    expect(projectThunderGod(s).digestion).toContain(`${s.week - 131}/12`);
    expect(s.progression.promotionWeek).toBe(7); expect(s.catastrophe.promotionWeek).toBe(131);
    expect(thunderGodAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('/12');
    const final = prepared(); expect(final.week).toBeGreaterThanOrEqual(143); expect(originalTyrantRoots(final)).toEqual(originalTyrantRoots(originalCatastrophe()));
  }, 60_000);
  it('rejects absent confirmation, invented commands, old preparation IDs and foreign bottles', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'catastrophe-potion-1' },
      { ...dose, bottleId: 'thunder-god-potion-0' }, { ...dose, transformGender: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }, { type: 'RECHARGE_DEVICE' },
    ]) expect(validateThunderGodCommand(command)).toBe(false);
    expect(validateThunderGodCommand(dose)).toBe(true); expect(THUNDER_GOD_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'LOCATE_TARGET', 'MARK_RETURN']);
  });
  it('records exactly five paid-in-actions jobs,5500 credit and1100 balance on one original', () => {
    const s = prepared(), jobs = journal(s).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(s).find(e => e.command.type === 'BUY_POTION')!;
    expect(jobs).toHaveLength(5); for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.after.actions).toBe(purchase.before.actions);
    expect(s.thunderGod.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(s.thunderGod.bottles.slice(1).every(b => b.labourSteps === 0 && b.status === 'SUPPLIER')).toBe(true);
    expect(THUNDER_GOD_PRICES).toMatchObject({ potion: 6600, labourCredit: 5500, labourBalance: 1100 });
    expect(journal(s).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(s.actionsRemaining).toBeLessThanOrEqual(3); expect(s.weeklyBudget).toBe(3); expect(s.random.seed).toBe('sailor-natural-v026');
    expect(validateThunderGodAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('keeps actual cancellation costs, blocks ordinary escape from prepared site and retains original bottle', () => {
    const s = prepared(), site = journal(s).at(-1)!; expect(site.command.type).toBe('PREPARE_PROMOTION');
    expect(site.before.cash - site.after.cash).toBe(150); expect(site.before.actions - site.after.actions).toBe(1);
    expect(hasThunderGodLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = tg(s, { type: 'LEAVE_PREPARATION' }), event = journal(left).at(-1)!;
    expect(event.before).toEqual(event.after); expect(hasThunderGodLock(left)).toBe(false);
    expect(left.thunderGod.bottles[0]!.status).toBe('PLAYER'); expect(left.thunderGod.preparations).toEqual(s.thunderGod.preparations);
    rejectThunderGod(left, dose); expect(validateThunderGodAcquisitionJournal(left)).toBe(true);
  }, 60_000);
  it('records the actual same-seed bottle outcome, costs and one draw without replacing failure', () => {
    const before = prepared(), s = tg(before, dose), event = journal(s).at(-1)!, kind = event.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const healthCost = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, mindCost = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([event.after.health, event.after.mind, event.after.spirituality]).toEqual([Math.max(1, event.before.health - healthCost), Math.max(1, event.before.mind - mindCost), event.before.spirituality]);
    expect(event.after.sequence).toBe(succeeds ? 1 : 2); expect(s.character.gender).toBe('FEMALE');
    expect(s.thunderGod.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: event.week, preparationWeek: event.week });
    expect(s.thunderGod.preparedWeek).toBeNull(); expect(originalTyrantRoots(s)).toEqual(originalTyrantRoots(before));
    expect([event.cursorAfter, event.randomAfter]).toEqual([event.cursorBefore + 1, event.randomBefore! + 1]);
    for (const id of THUNDER_GOD_INHERITED_ABILITY_IDS) expect(event.after.mastery[id]).toBe(event.before.mastery[id]);
    expect(validateThunderGodAcquisitionJournal(s)).toBe(true); expect(validateThunderGodState(s)).toBe(true);
  }, 60_000);
  it('finishes with24 exact skills, two new zeros and unchanged actual old identities/resources', () => {
    const s = promoted(), source = originalCatastrophe(), receipt = journal(s).at(-1)!;
    expect(receipt.command.type).toBe('CONSUME'); expect(receipt.after.sequence).toBe(1);
    expect(Object.keys(s.progression.mastery)).toHaveLength(24); expect(s.progression.acting).toBe(0); expect(s.thunderGod.catastropheActingAtPromotion).toBe(100);
    for (const id of THUNDER_GOD_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of THUNDER_GOD_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(9);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalTyrantRoots(s)).toEqual(originalTyrantRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed); rejectThunderGod(s, dose);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(receipt.after.coreStats[stat]).toBe(receipt.before.coreStats[stat] + 1);
    expect(receipt.after.spirituality).toBe(receipt.before.spirituality); assertValidSliceState(s);
  }, 60_000);
  it('does not request free resupply before all originals actually fail', () => {
    const s = taught(); rejectThunderGod(s, { type: 'REQUEST_SUPPLY' }); rejectThunderGod(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.thunderGod.bottles).toHaveLength(3); expect(s.thunderGod.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const receipt of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(receipt.before.cash - receipt.after.cash).toBe(100); expect(receipt.before.actions - receipt.after.actions).toBe(1);
      const delivery = journal(finish).find(e => e.command.type === 'RECEIVE_SUPPLY' && e.revision > receipt.revision)!;
      expect(delivery.week).toBeGreaterThan(receipt.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.thunderGod.bottles.map(b => b.id)).size).toBe(finish.thunderGod.bottles.length);
  }, 60_000);
});

describe('Thunder God immutable anchors and exact acquisition replay', () => {
  it('reconstructs the genuine paid-guidance S2 checkpoint without editing live state', () => {
    const s = promoted(), before = structuredClone(s), view = thunderGodInheritedView(s), scene = s.thunderGod.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery); expect(view.character).toEqual(scene.character);
    expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision); expect(view.thunderGod).toEqual(createThunderGodState());
    expect(validateCatastropheState(view)).toBe(true); expect(s).toEqual(before);
  }, 60_000);
  it('rejects changed source identity, original zero mastery and unsupported original-site edits', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; }, (s: SliceState) => { s.character.name = '另一个人'; }, (s: SliceState) => { s.character.age++; },
      (s: SliceState) => { s.progression.mastery['tyrant.s3.water-recollection'] = 8; },
      (s: SliceState) => { s.catastrophe.life.site.playerTravelMetres++; }, (s: SliceState) => { s.catastrophe.life.site.keeper.travelMetres++; },
      (s: SliceState) => { s.catastrophe.life.site.keeper.energy++; }, (s: SliceState) => { s.catastrophe.life.site.water.bayUnits++; },
      (s: SliceState) => { s.catastrophe.life.site.gate.durability++; }, (s: SliceState) => { s.catastrophe.life.site.wheel.durability++; },
      (s: SliceState) => { s.catastrophe.life.site.mooring.durability++; }, (s: SliceState) => { s.catastrophe.life.site.winch.durability++; },
      (s: SliceState) => { s.catastrophe.life.site.buoy.offsetMetres++; }, (s: SliceState) => { s.catastrophe.life.journal.pop(); },
      (s: SliceState) => { s.catastrophe.encounter.approachWeek = s.week; },
      (s: SliceState) => { s.thunderGod.sourceScene!.character.gender = 'MALE'; },
      (s: SliceState) => { s.thunderGod.sourceHistory!.catastrophe.life.site.keeper.energy++; },
      (s: SliceState) => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ]) { const s = promoted(); mutate(s); expect(validateThunderGodState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged resource deltas, chronology, random checks, bottle identity and duplicate preparations', () => {
    for (const mutate of [
      (s: SliceState) => { s.cash++; }, (s: SliceState) => { s.actionsRemaining++; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; }, (s: SliceState) => { journal(s)[0]!.after.actions++; },
      (s: SliceState) => { journal(s)[1]!.revision = journal(s)[0]!.revision; },
      (s: SliceState) => { journal(s)[0]!.week = s.week + 1; },
      (s: SliceState) => { s.thunderGod.sourceScene!.revision = s.revision + 1; },
      (s: SliceState) => { s.thunderGod.sourceScene!.random.cursor = s.random.cursor + 1; },
      (s: SliceState) => { s.thunderGod.bottles[0]!.id = 'thunder-god-potion-2'; },
      (s: SliceState) => { s.thunderGod.preparations[1]!.taskId = s.thunderGod.preparations[0]!.taskId; },
    ]) { const s = prepared(); mutate(s); expect(validateThunderGodState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const result = journal(s).at(-1)!.check!; result.roll = result.roll === 1 ? 2 : 1; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.thunderGod.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateThunderGodState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('closes all old mutation routes once current guidance freezes their history', () => {
    const s = taught();
    for (const intent of [
      { type: 'CATASTROPHE', command: { type: 'REFLECT' } },
      { type: 'CATASTROPHE', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'SAILOR', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalTyrantRoots(s)).toEqual(originalTyrantRoots(originalCatastrophe()));
  }, 60_000);
});
