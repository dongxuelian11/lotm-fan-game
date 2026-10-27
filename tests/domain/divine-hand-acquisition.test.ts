import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  DIVINE_HAND_INHERITED_ABILITY_IDS, createDivineHandState, hasDivineHandLock, projectDivineHand,
  validateDivineHandAcquisitionJournal, validateDivineHandCommand, validateDivineHandSource, validateDivineHandState,
  divineHandAcquisitionBlock, divineHandCompletedAcquisitionBudgetMatches, divineHandFinanceSnapshot,
} from '../../src/domain/divine-hand/index.js';
import { DIVINE_HAND_ABILITY_IDS, DIVINE_HAND_PREPARATION_IDS } from '../../src/domain/divine-hand/types.js';
import { DIVINE_HAND_PRICES } from '../../src/domain/divine-hand/content.js';
import {
  ae, dose, originalWarriorRoots, originalGlory, prepared, promoted, ordinary,
  rejectDivineHand, rejectIntent, taught, gloryNaturalPath, silverKnightDirectedPath, silverKnightNaturalPath, silverNaturalDeathPath, silverV2NaturalDeathPath, recoveredSource, ready,
  warriorLegacyKeys, loadDivineHandFixture, directedPrepared, prepareBottle,
} from './divine-hand-directed-helper.js';

const journal = (s: SliceState) => s.divineHand.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Divine Hand genuine Warrior source and strict commands', () => {
  it('preserves actual158 source, explicit70 directed prefix and separate dead routes', async () => {
    expect(await fileHash(gloryNaturalPath)).toBe('2b29e549f4ef5b51f99267df946cbce2e9a4cdd674770b01b5568d5e13f24dc6');
    expect(await fileHash(silverKnightDirectedPath)).toBe('acab010a42b95613657f19435436a435e7971b8ed6f9381850e852af89ac7cc2');
    const raw = readObjectEntry<SliceState>(gloryNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(gloryNaturalPath, 'commands');
    const directed = readObjectEntry<SliceIntent[]>(silverKnightDirectedPath, 'commands');
    expect(raw).toMatchObject({ schemaVersion: 173, contentVersion: 'glory-v173', revision: 600, week: 146, status: 'ACTIVE', health: 90,
      random: { seed: 'warrior-natural-v042', cursor: 475 } });
    expect(commands).toHaveLength(158); expect(directed).toHaveLength(70); expect(commands.slice(0, 70)).toEqual(directed);
    expect(commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(readObjectEntry<string>(gloryNaturalPath, 'provenance')).toContain('DIRECTED');
    expect(readObjectEntry<SliceState>(gloryNaturalPath, 'startingState')).toEqual(readObjectEntry<SliceState>(silverKnightDirectedPath, 'startingState'));
    const s = originalGlory();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(s.divineHand).toEqual(createDivineHandState()); expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...DIVINE_HAND_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(4);
    expect(s.injuries).toEqual(raw.injuries); expect(s.injuryRisk).toBe(0);
    expect(readObjectEntry<SliceState>(silverKnightNaturalPath, 'final')).toMatchObject({ status: 'ACTIVE', progression: { sequence: 4 }, health: 100, week: 106 });
    for (const [path, week, count] of [[silverNaturalDeathPath, 116, 425], [silverV2NaturalDeathPath, 123, 476]] as const) {
      const dead = readObjectEntry<SliceState>(path, 'final');
      expect(dead).toMatchObject({ status: 'DEAD', health: 0, week, progression: { sequence: 4 } });
      expect(readObjectEntry<SliceIntent[]>(path, 'commands')).toHaveLength(count);
      const migratedDead = loadDivineHandFixture(path, 'final'); rejectDivineHand(migratedDead, { type: 'LEARN_GUIDANCE' });
      expect(migratedDead.status).toBe('DEAD'); expect(migratedDead.health).toBe(0);
    }
  }, 60_000);
  it('constructs current roots and independent original bottles without exposing unrelated play', () => {
    const s = createSliceRun('divine-hand-hidden', sliceDefaultCreationSelection, 'divine-hand-hidden');
    assertValidSliceState(s);
    expect(projectDivineHand(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectDivineHand(s, { type: 'LEARN_GUIDANCE' });
    const other = createDivineHandState(); other.bottles[0]!.labourSteps = 5;
    expect(s.divineHand.bottles[0]!.labourSteps).toBe(0);
  });
  it('requires exact original commands, explicit consumption and three named preparations', () => {
    expect(DIVINE_HAND_ABILITY_IDS).toEqual(['warrior.s1.beam-stabilize', 'warrior.s1.armor-convergence']);
    expect(DIVINE_HAND_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'PLAN_FINITE_LOAD', 'CHECK_RETURN']);
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'RECORD_CONDITIONS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'glory-potion-1' },
      { ...dose, bottleId: 'divine-hand-potion-0' }, { ...dose, transformGender: true }, { type: 'FREE_REMOTE_RETURN' }, { type: 'REFILL_OLD_LOAD' },
    ]) expect(validateDivineHandCommand(command)).toBe(false);
    expect(validateDivineHandCommand(dose)).toBe(true);
    expect(DIVINE_HAND_PRICES).toEqual({ guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 });
  });
});

describe('Divine Hand per-bottle acquisition and actual weekly economy', () => {
  it('starts with an eligible wounded source and keeps physical originals through ordinary recovery', () => {
    const original = originalGlory(), taughtOriginal = ae(original, { type: 'LEARN_GUIDANCE' });
    expect(journal(taughtOriginal)[0]!.before).toMatchObject({ health: 90, mind: 100, spirituality: 96, cash: 500, actions: 2 });
    expect(taughtOriginal.injuries).toEqual(original.injuries);
    const healed = recoveredSource(); expect(healed.health).toBe(100); expect(healed.injuries).toEqual([]);
    expect(healed.injuryRisk).toBe(0); expect(originalWarriorRoots(healed)).toEqual(originalWarriorRoots(original));
    expect(healed.glory.life.site.playerEnergy).toBe(35); expect(original.health).toBe(90);
  }, 60_000);
  it('pays for guidance and freezes all eight real roots, identity, original room and finance', () => {
    const before = ready(recoveredSource(), { cash: 500 }), s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!, scene = s.divineHand.sourceScene!;
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([e.before.health, e.before.mind, e.before.spirituality]);
    expect(scene.originals).toEqual({ site: before.glory.life.site }); expect(scene.finance).toEqual(divineHandFinanceSnapshot(before));
    expect(e.finance).toEqual(scene.finance); expect(scene.character).toEqual(before.character);
    for (const key of warriorLegacyKeys) expect(s.divineHand.sourceHistory![key]).toEqual(before[key]);
    expect(s.divineHand.sourceHistory!.glory).not.toBe(s.glory);
    expect(s.glory.life.site).toMatchObject({ clockSeconds: 293, playerLocation: 'OUTSIDE', playerTravelMetres: 60, playerEnergy: 35,
      celia: { location: 'OUTSIDE', energy: 80, travelMetres: 20 }, evan: { location: 'OUTSIDE', energy: 82, travelMetres: 18 },
      armor: { id: 'SK3-LIFE-ARMOR', integrity: 60 }, armorSource: { snapshot: { integrity: 65 } },
      pads: { location: 'BENCH', remaining: 1, consumed: 1 }, load: { remainingLoads: 0, appliedLoads: 1 } });
    expect(validateDivineHandSource(s)).toBe(true); expect(validateDivineHandAcquisitionJournal(s)).toBe(true); rejectDivineHand(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('uses the real S2 promotion clock, per-bottle five jobs and separate professional work', () => {
    const s = taught(); expect(s.glory.promotionWeek).toBe(138);
    expect(divineHandAcquisitionBlock(originalGlory(), { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const p = prepared(), jobs = journal(p).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(p).find(e => e.command.type === 'BUY_POTION')!;
    expect(p.week).toBeGreaterThanOrEqual(150); expect(jobs).toHaveLength(5);
    for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.before.actions).toBe(purchase.after.actions);
    expect(p.divineHand.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(p.divineHand.bottles.slice(1).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0)).toBe(true);
    expect(journal(p).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(originalWarriorRoots(p)).toEqual(originalWarriorRoots(originalGlory())); assertValidSliceState(p);
  }, 60_000);
  it('preserves actual paid preparation cancellation and rejects ordinary escape while locked', () => {
    const s = prepared(), event = journal(s).at(-1)!;
    expect(event.command.type).toBe('PREPARE_PROMOTION'); expect(event.before.cash - event.after.cash).toBe(150);
    expect(hasDivineHandLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ae(s, { type: 'LEAVE_PREPARATION' }), cancellation = journal(left).at(-1)!;
    expect(cancellation.after).toEqual(cancellation.before); expect(hasDivineHandLock(left)).toBe(false);
    expect(left.divineHand.bottles[0]!.status).toBe('PLAYER'); expect(left.divineHand.preparations).toEqual(s.divineHand.preparations);
    expect(originalWarriorRoots(left)).toEqual(originalWarriorRoots(s)); rejectDivineHand(left, dose); assertValidSliceState(left);
  }, 60_000);
  it('reconciles the last action through the actual shared weekly bill without free recovery', () => {
    let before = ready(recoveredSource(), { cash: 700 }); while (before.actionsRemaining > 1) before = ordinary(before);
    expect(before.actionsRemaining).toBe(1);
    const s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect(e.after.actions).toBe(0); expect(s.week).toBe(e.week + 1);
    expect(divineHandCompletedAcquisitionBudgetMatches(s, e)).toBe(true);
    expect([s.health, s.mind, s.spirituality]).toEqual([e.after.health, e.after.mind, e.after.spirituality]);
    const forged = structuredClone(s); forged.cash++; expect(validateDivineHandState(forged)).toBe(false);
    const forgedFinance = structuredClone(s); forgedFinance.weeklyBudget++; expect(validateDivineHandState(forgedFinance)).toBe(false);
  }, 60_000);
  it('permits zero-action cancellation, retains its costs and only then settles the week', () => {
    let s = ready(ae(prepared(), { type: 'LEAVE_PREPARATION' }), { ap: 3, cash: 250 });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = ae(s, { type: 'PREPARE_PROMOTION' });
    expect(s.actionsRemaining).toBe(0); const week = s.week;
    const after = ae(s, { type: 'LEAVE_PREPARATION' }), e = journal(after).at(-1)!;
    expect(e.before).toEqual(e.after); expect(after.week).toBe(week + 1); expect(after.divineHand.bottles[0]!.status).toBe('PLAYER');
    expect(divineHandCompletedAcquisitionBudgetMatches(after, e)).toBe(true); assertValidSliceState(after);
  }, 60_000);
  it('records the actual same-seed result and preserves every original bottle and failed cost', () => {
    const before = prepared(), s = ae(before, dose), e = journal(s).at(-1)!, kind = e.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const h = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, m = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([Math.max(1, e.before.health - h), Math.max(1, e.before.mind - m), e.before.spirituality]);
    expect(e.after.sequence).toBe(succeeds ? 1 : 2); expect(e.cursorAfter).toBe(e.cursorBefore + 1); expect(e.randomAfter).toBe(e.randomBefore! + 1);
    expect(s.divineHand.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: e.week, preparationWeek: e.week });
    expect(s.divineHand.preparedWeek).toBeNull(); expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(before));
    for (const id of DIVINE_HAND_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateDivineHandAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('finishes with22 exact skills, two new zeros and no free stock or identity change', () => {
    const s = promoted(), source = originalGlory(), e = journal(s).at(-1)!;
    expect(e.command.type).toBe('CONSUME'); expect(e.after.sequence).toBe(1); expect(s.divineHand.gloryActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toHaveLength(22); expect(s.progression.acting).toBe(0);
    for (const id of DIVINE_HAND_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of DIVINE_HAND_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(e.after.coreStats[stat]).toBe(e.before.coreStats[stat] + 1);
    expect(e.after.spirituality).toBe(e.before.spirituality); rejectDivineHand(s, dose); assertValidSliceState(s);
  }, 60_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('records the %s potion branch from an explicit isolated initial input', tier => {
    const before = directedPrepared([tier]), s = ae(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(tier);
    const succeeds = tier === 'GREAT_SUCCESS' || tier === 'SUCCESS';
    const healthCost = succeeds ? 0 : tier === 'FAILURE' ? 15 : 25;
    const mindCost = tier === 'GREAT_SUCCESS' ? 8 : tier === 'SUCCESS' ? 15 : tier === 'FAILURE' ? 25 : 45;
    expect(e.after.health).toBe(Math.max(1, e.before.health - healthCost));
    expect(e.after.mind).toBe(Math.max(1, e.before.mind - mindCost));
    expect(e.after.pollution).toBe(Math.min(100, e.before.pollution + (succeeds ? 0 : tier === 'FAILURE' ? 30 : 60)));
    expect(e.after.spirituality).toBe(e.before.spirituality); expect(e.after.injuries).toEqual(e.before.injuries);
    expect(s.divineHand.preparedWeek).toBeNull(); expect(s.divineHand.bottles[0]!.status).toBe('CONSUMED');
    expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(before));
    for (const id of DIVINE_HAND_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateDivineHandAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('refuses an independent fourth original even after three genuine failed bottles', () => {
    let s = directedPrepared(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    for (let number = 1; number <= 3; number++) {
      s = ae(s, { type: 'CONSUME', bottleId: `divine-hand-potion-${number}`, confirmed: true });
      expect(s.progression.sequence).toBe(2);
      if (number < 3) { rejectDivineHand(s, { type: 'REQUEST_SUPPLY' }); s = prepareBottle(s, `divine-hand-potion-${number + 1}`); }
    }
    expect(s.divineHand.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    s = ready(s, { ap: 2, cash: 120 });
    const bottles = structuredClone(s.divineHand.bottles), history = structuredClone(journal(s));
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'BUY_POTION', bottleId: 'divine-hand-potion-4' }]) rejectDivineHand(s, command);
    expect(s.divineHand.bottles).toEqual(bottles); expect(journal(s)).toEqual(history);
    expect(s.divineHand.bottles).toHaveLength(3);
    expect(s.divineHand.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(divineHandAcquisitionBlock(s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'divine-hand-potion-1' })).toBeNull();
    expect(validateDivineHandAcquisitionJournal(s)).toBe(true);
    expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(originalGlory())); assertValidSliceState(s);
  }, 60_000);
  it('ordinary S1 rest keeps the real120 spirituality ceiling and does not refill site energy', () => {
    const s = promoted(), rested = ordinary(s, undefined, true);
    expect(s.spirituality).toBe(120); expect(rested.spirituality).toBe(120);
    expect(projectSliceState(s).maxSpirituality).toBe(120); expect(projectSliceState(rested).maxSpirituality).toBe(120);
    expect(() => assertValidSliceState({ ...rested, spirituality: 121 })).toThrow();
    expect(rested.progression.sequence).toBe(1); expect(rested.glory.life.site).toEqual(s.glory.life.site);
    expect(originalWarriorRoots(rested)).toEqual(originalWarriorRoots(s)); assertValidSliceState(rested);
  }, 60_000);
  it('does not issue premature or free replacement originals', () => {
    const s = taught(); rejectDivineHand(s, { type: 'REQUEST_SUPPLY' }); rejectDivineHand(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.divineHand.bottles).toHaveLength(3); expect(s.divineHand.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const e of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(e.before.cash - e.after.cash).toBe(100); expect(e.before.actions - e.after.actions).toBe(1);
      const delivery = journal(finish).find(d => d.command.type === 'RECEIVE_SUPPLY' && d.revision > e.revision)!;
      expect(delivery.week).toBeGreaterThan(e.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.divineHand.bottles.map(b => b.id)).size).toBe(finish.divineHand.bottles.length);
  }, 60_000);
});
