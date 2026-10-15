import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { validateConcealmentServantState } from '../../src/domain/concealment-servant/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  MISFORTUNE_KNIGHT_INHERITED_ABILITY_IDS, createMisfortuneKnightState, hasMisfortuneKnightLock,
  projectMisfortuneKnight, misfortuneKnightInheritedView, validateMisfortuneKnightAcquisitionJournal,
  validateMisfortuneKnightCommand, validateMisfortuneKnightSource, validateMisfortuneKnightState,
} from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_ABILITY_IDS, MISFORTUNE_KNIGHT_PREPARATION_IDS } from '../../src/domain/misfortune-knight/types.js';
import { mk, directedInitial2, directedInitialCursor, dose, originalDarknessRoots, originalConcealmentServant,
  prepared, promoted, recoverResources, rejectMisfortuneKnight, rejectIntent, step, taught,
  concealmentServantNaturalPath, concealmentServantBranchPath, darknessLegacyKeys, loadMisfortuneKnightFixture,
} from './misfortune-knight-directed-helper.js';

const journal = (s: SliceState) => s.misfortuneKnight.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Misfortune Knight source boundary: raw evidence is separate from migration', () => {
  it('pins original raw166 living518 branch and retains raw528 DEAD final without revival', async () => {
    expect(await fileHash(concealmentServantNaturalPath)).toBe('b1edff5df12aa0b3a88aa16b2feee5ff63766ea15d4c7346b9ccb294f1c8c7b4');
    expect(await fileHash(concealmentServantBranchPath)).toBe('667f41064ca3aedc76365a66a05bd26ec2fb47a20d6cbf74ffa744a88b778dba');
    const branch = readObjectEntry<SliceState>(concealmentServantBranchPath, 'beforeLast');
    const final = readObjectEntry<SliceState>(concealmentServantNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(concealmentServantNaturalPath, 'commands');
    expect(branch).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166', revision: 519, status: 'ACTIVE', health: 100, random: { seed: 'sleepless-natural-v020', cursor: 341 } });
    expect(final).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166', revision: 529, status: 'DEAD', health: 0, random: { seed: 'sleepless-natural-v020', cursor: 432 } });
    expect(commands).toHaveLength(528); expect(commands.slice(0, 518)).toHaveLength(518);
    expect(commands[517]).toEqual({ type: 'ACTION', action: 'REST' });
    expect(commands[518]).toEqual({ type: 'CONCEALMENT_SERVANT', command: { type: 'ENCOUNTER_TALK' } });
    expect(branch.concealmentServant.encounter.approachWeek).toBeNull(); expect(final.concealmentServant.encounter.status).toBe('LOST');
    expect(final.ending?.kind).toBe('DEATH'); expect(branch.ending).toBeNull();
  }, 60_000);
  it('explicitly migrates current entry and preserves all eight roots, eighteen skills and five zeros', () => {
    const raw = readObjectEntry<SliceState>(concealmentServantBranchPath, 'beforeLast'), s = originalConcealmentServant();
    expect(s).toMatchObject({ schemaVersion: 188, contentVersion: 'misfortune-knight-v188', status: 'ACTIVE', revision: 519 });
    expect(s.misfortuneKnight).toEqual(createMisfortuneKnightState()); expect(originalDarknessRoots(s)).toEqual(originalDarknessRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...MISFORTUNE_KNIGHT_INHERITED_ABILITY_IDS]); expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5);
    expect(s.debts).toHaveLength(4); expect(s.debts.every(d => d.remaining === 0)).toBe(true); expect(s.seer.pollution).toBe(0);
    assertValidSliceState(s);
    const dead = loadMisfortuneKnightFixture(concealmentServantNaturalPath, 'final'); rejectMisfortuneKnight(dead, { type: 'LEARN_GUIDANCE' }); expect(dead.status).toBe('DEAD');
  }, 60_000);
  it('advances five real weeks for directed units; cash, AP and future cursor are not natural evidence', () => {
    const original = originalConcealmentServant(), female = directedInitial2(), male = directedInitial2('SUCCESS', 'MALE');
    expect(original.week).toBe(121); expect(projectMisfortuneKnight(original).digestion).toContain('7/12');
    expect(female.week).toBe(126); expect(male.week).toBe(126); expect(female.cash).toBe(100000); expect(female.actionsRemaining).toBe(100);
    expect(female.random.seed).toBe(original.random.seed); expect(female.random.cursor).toBeGreaterThanOrEqual(original.random.cursor);
    expect(originalDarknessRoots(male)).toEqual(originalDarknessRoots(original)); expect(male.progression).toEqual(original.progression);
    expect(male.character).toEqual({ ...female.character, gender: 'MALE' }); expect(original.character.gender).toBe('FEMALE');
    expect(() => directedInitialCursor(taught(), 'SUCCESS')).toThrow(/precede/); assertValidSliceState(male);
  }, 60_000);
  it('hides unrelated paths and keeps independent bottles and nested scene states', () => {
    const s = createSliceRun('misfortune-hidden', sliceDefaultCreationSelection, 'misfortune-hidden');
    expect(projectMisfortuneKnight(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectMisfortuneKnight(s, { type: 'LEARN_GUIDANCE' }); const other = createMisfortuneKnightState(); other.bottles[0]!.labourSteps = 5;
    expect(s.misfortuneKnight.bottles[0]!.labourSteps).toBe(0);
  });
});

describe('Misfortune Knight finite acquisition with actual source journals', () => {
  it('guidance costs500 and1AP and seals the live old room and same original leaf', () => {
    const before = directedInitial2(), s = mk(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!, scene = s.misfortuneKnight.sourceScene!;
    expect([s.cash, s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([99500, 99, 100, 100, 120]);
    expect(scene).toMatchObject({ week: 126, random: { seed: 'sleepless-natural-v020' }, city: 'BACKLUND' });
    expect(scene.originals.box).toEqual(before.concealmentServant.life.box); expect(scene.originals.trace).toEqual(before.concealmentServant.life.trace);
    expect(scene.originals.erin).toEqual(before.concealmentServant.life.erin); expect(scene.companion).toEqual(before.spiritWarlock.companion); expect(scene.character).toEqual(before.character);
    for (const key of darknessLegacyKeys) expect(s.misfortuneKnight.sourceHistory![key]).toEqual(before[key]);
    expect(s.misfortuneKnight.sourceHistory!.concealmentServant).not.toBe(s.concealmentServant);
    expect(e.actor).toMatchObject({ pathwayId: 'darkness', concealmentServantPromotionWeek: 114, sleeplessPromotionWeek: 5 });
    expect([e.cursorBefore, e.cursorAfter, e.check]).toEqual([before.random.cursor, before.random.cursor, null]);
    expect(validateMisfortuneKnightSource(s)).toBe(true); expect(validateMisfortuneKnightAcquisitionJournal(s)).toBe(true); rejectMisfortuneKnight(s, { type: 'LEARN_GUIDANCE' });
    rejectMisfortuneKnight(originalConcealmentServant(), { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('requires all three old actual reports, exact source chronology and eighteen old skills', () => {
    const mutations = [
      (s: SliceState) => { s.concealmentServant.life.reflected = false; },
      (s: SliceState) => { s.concealmentServant.life.cases['consented-box'].status = 'EXAMINED'; },
      (s: SliceState) => { s.concealmentServant.life.cases['withdrawn-consent'].attempts[0]!.boxReturned = false; },
      (s: SliceState) => { s.concealmentServant.fearBishopActingAtPromotion = 99; },
      (s: SliceState) => { s.fearBishop.promotionWeek = null; },
      (s: SliceState) => { s.sleepless.bottles[0]!.consumedWeek = 6; },
      (s: SliceState) => { delete s.progression.mastery['darkness.s5.spirit-assistance']; },
      (s: SliceState) => { s.progression.mastery['darkness.s1.invented'] = 0; },
    ];
    for (const mutate of mutations) { const s = directedInitial2(); mutate(s); rejectMisfortuneKnight(s, { type: 'LEARN_GUIDANCE' }); }
  }, 60_000);
  it('cannot use the general S9 promotion week as the actual S2 twelve-week clock', () => {
    let s = originalConcealmentServant(); while (s.week < 125) s = step(s, { type: 'ACTION', action: 'REST' });
    s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
    s = mk(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) s = mk(s, { type: 'PREPARE_TASK', taskId });
    s = mk(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); rejectMisfortuneKnight(s, { type: 'PREPARE_PROMOTION' }); rejectMisfortuneKnight(s, dose);
    expect(s.concealmentServant.promotionWeek).toBe(114); expect(s.progression.promotionWeek).toBe(5);
  }, 60_000);
  it('rejects absent confirmation, invented commands and foreign bottle identities', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'CREATE_SOUL' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'concealment-servant-potion-1' },
      { ...dose, bottleId: 'misfortune-knight-potion-0' }, { ...dose, transformGender: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }, { type: 'DECLINE_TRANSFORMATION' },
    ]) expect(validateMisfortuneKnightCommand(command)).toBe(false);
    expect(validateMisfortuneKnightCommand(dose)).toBe(true);
  });
  it('five real jobs give exactly5500 credit only to that bottle and leave1100 payable', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = mk(s, { type: 'POTION_WORK', bottleId: 'misfortune-knight-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]); rejectMisfortuneKnight(s, { type: 'POTION_WORK', bottleId: 'misfortune-knight-potion-2' });
    s = mk(s, { type: 'BUY_POTION', bottleId: 'misfortune-knight-potion-2' }); expect(s.cash).toBe(before.cash - 1100);
    s = mk(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(before.cash - 1100 - 6600);
    rejectMisfortuneKnight(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(validateMisfortuneKnightAcquisitionJournal(s)).toBe(true);
    expect(prepared('SUCCESS', true)).toMatchObject({ cash: 98250, actionsRemaining: 90 });
  }, 60_000);
  it('partial jobs give no partial credit and cancellation keeps costs and untouched bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = mk(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const cash = s.cash; s = mk(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(cash - 6600);
    expect(s.misfortuneKnight.preparations).toEqual([]); rejectMisfortuneKnight(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(); expect(hasMisfortuneKnightLock(ready)).toBe(true); rejectIntent(ready, { type: 'ACTION', action: 'REST' });
    const left = mk(ready, { type: 'LEAVE_PREPARATION' }); expect(hasMisfortuneKnightLock(left)).toBe(false);
    expect([left.cash, left.actionsRemaining, left.character.gender]).toEqual([ready.cash, ready.actionsRemaining, ready.character.gender]);
    expect(left.misfortuneKnight.bottles[0]!.status).toBe('PLAYER'); rejectMisfortuneKnight(left, dose);
    expect(mk(left, { type: 'PREPARE_PROMOTION' }).cash).toBe(left.cash - 150);
  }, 60_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('records actual %s without changing source body or old resources', kind => {
    const before = prepared(kind), s = mk(before, dose), event = journal(s).at(-1)!, succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const healthCost = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, mindCost = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([s.health, s.mind, s.spirituality]).toEqual([Math.max(1, before.health - healthCost), Math.max(1, before.mind - mindCost), before.spirituality]);
    expect(s.progression.sequence).toBe(succeeds ? 1 : 2); expect(s.character.gender).toBe('FEMALE');
    expect(s.misfortuneKnight.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 126, preparationWeek: 126 });
    expect(s.misfortuneKnight.preparedWeek).toBeNull(); expect(originalDarknessRoots(s)).toEqual(originalDarknessRoots(before));
    expect(s.character.age).toBe(26); expect(s.character.name).toBe('罗温'); expect(s.character.traits).toEqual(before.character.traits); expect(s.injuries).toEqual(before.injuries);
    for (const id of MISFORTUNE_KNIGHT_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(before.progression.mastery[id]);
    expect([event.cursorAfter, event.randomAfter]).toEqual([event.cursorBefore + 1, event.randomBefore! + 1]); expect(event.check!.tier).toBe(kind);
    expect(validateMisfortuneKnightAcquisitionJournal(s)).toBe(true); expect(validateMisfortuneKnightState(s)).toBe(true);
    if (succeeds) {
      expect(Object.keys(s.progression.mastery)).toHaveLength(20); expect(s.progression.acting).toBe(0); expect(s.misfortuneKnight.concealmentServantActingAtPromotion).toBe(100);
      for (const id of MISFORTUNE_KNIGHT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(7); rejectMisfortuneKnight(s, dose);
    }
  }, 60_000);
  it.each(['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('declared male unit input remains male for %s', kind => {
    const before = prepared(kind, false, 'MALE'), s = mk(before, dose);
    expect(before.character.gender).toBe('MALE'); expect(s.character.gender).toBe('MALE');
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(before.character)); expect(originalDarknessRoots(s)).toEqual(originalDarknessRoots(before)); assertValidSliceState(s);
  }, 60_000);
  it('three consumed failures need paid resupply, a real later week and three new IDs', () => {
    let s = taught('THREE_FAILURES'); for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) s = mk(s, { type: 'PREPARE_TASK', taskId });
    for (let n = 1; n <= 3; n++) {
      s = recoverResources(s); const bottleId = `misfortune-knight-potion-${n}`;
      s = mk(s, { type: 'BUY_POTION', bottleId }); s = mk(s, { type: 'PREPARE_PROMOTION' }); s = mk(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.misfortuneKnight.bottles[n - 1]!.outcome).toBe('FAILURE'); expect(s.progression.sequence).toBe(2);
    }
    const old = structuredClone(s.misfortuneKnight.bottles), cash = s.cash, ap = s.actionsRemaining;
    s = mk(s, { type: 'REQUEST_SUPPLY' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 100, ap - 1]); rejectMisfortuneKnight(s, { type: 'RECEIVE_SUPPLY' });
    const requested = s.week, remaining = s.actionsRemaining; for (let n = 0; n < remaining; n++) s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBeGreaterThan(requested); s = mk(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.misfortuneKnight.bottles.slice(0, 3)).toEqual(old); expect(s.misfortuneKnight.bottles.slice(3).map(b => b.id)).toEqual(['misfortune-knight-potion-4', 'misfortune-knight-potion-5', 'misfortune-knight-potion-6']);
    expect(s.misfortuneKnight.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0)).toBe(true); assertValidSliceState(s);
  }, 60_000);
});

describe('Misfortune Knight immutable anchors and exact acquisition replay', () => {
  it('reconstructs the genuine paid-guidance S2 checkpoint without editing live state', () => {
    const s = promoted('SUCCESS', 'MALE'), before = structuredClone(s), view = misfortuneKnightInheritedView(s), scene = s.misfortuneKnight.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery); expect(view.character).toEqual(scene.character);
    expect(view.character.gender).toBe('MALE'); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.misfortuneKnight).toEqual(createMisfortuneKnightState()); expect(validateConcealmentServantState(view)).toBe(true); expect(s).toEqual(before);
  }, 60_000);
  it('rejects changed identity, old zero mastery, duplicate leaf and unsupported original-object edits', () => {
    for (const mutate of [
      (s: SliceState) => { s.character.gender = 'MALE'; }, (s: SliceState) => { s.character.name = '另一个人'; }, (s: SliceState) => { s.character.age++; },
      (s: SliceState) => { s.progression.mastery['darkness.s5.spirit-assistance'] = 8; },
      (s: SliceState) => { s.spiritWarlock.companion.deployments++; }, (s: SliceState) => { s.spiritWarlock.companion.recalls++; },
      (s: SliceState) => { s.concealmentServant.life.box.travelMetres++; },
      (s: SliceState) => { s.concealmentServant.life.erin.travelMetres++; }, (s: SliceState) => { s.concealmentServant.life.trace.searches++; },
      (s: SliceState) => { s.concealmentServant.life.page.text += '赠送'; }, (s: SliceState) => { s.concealmentServant.life.anchorLight.on = true; },
      (s: SliceState) => { s.concealmentServant.life.journal.pop(); },
      (s: SliceState) => { s.misfortuneKnight.sourceScene!.character.gender = 'MALE'; },
      (s: SliceState) => { s.misfortuneKnight.sourceHistory!.spiritWarlock.companion.recalls++; },
      (s: SliceState) => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ]) { const s = promoted(); mutate(s); expect(validateMisfortuneKnightState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects free resources, changed costs, replaced random results and repeated bottles', () => {
    for (const mutate of [
      (s: SliceState) => { s.cash++; }, (s: SliceState) => { s.actionsRemaining++; }, (s: SliceState) => { s.spirituality--; },
      (s: SliceState) => { journal(s)[0]!.after.cash++; }, (s: SliceState) => { journal(s)[0]!.after.actions++; },
      (s: SliceState) => { journal(s).at(-1)!.check!.roll = 1; }, (s: SliceState) => { journal(s).at(-1)!.randomAfter = journal(s).at(-1)!.randomAfter! + 1; },
      (s: SliceState) => { s.misfortuneKnight.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.misfortuneKnight.preparations[1]!.taskId = s.misfortuneKnight.preparations[0]!.taskId; },
    ]) { const s = promoted(); mutate(s); expect(validateMisfortuneKnightState(s), mutate.toString()).toBe(false); }
  }, 60_000);
});
