import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  TIME_WORM_INHERITED_ABILITY_IDS, createTimeWormState, hasTimeWormLock, projectTimeWorm,
  validateTimeWormAcquisitionJournal, validateTimeWormCommand, validateTimeWormSource, validateTimeWormState,
  timeWormAcquisitionBlock, timeWormCompletedAcquisitionBudgetMatches, timeWormFinanceSnapshot,
} from '../../src/domain/time-worm/index.js';
import { TIME_WORM_ABILITY_IDS, TIME_WORM_PREPARATION_IDS } from '../../src/domain/time-worm/types.js';
import { TIME_WORM_PRICES } from '../../src/domain/time-worm/content.js';
import {
  ae, dose, originalErrorRoots, originalFateTrojan, prepared, promoted, ordinary,
  rejectTimeWorm, rejectIntent, taught, fateTrojanNaturalPath, deceitMentorPeacefulPath, deceitMentorDeathPath, recoveredSource, ready,
  errorLegacyKeys, loadTimeWormFixture, directedPrepared, prepareBottle,
} from './time-worm-directed-helper.js';

const journal = (s: SliceState) => s.timeWorm.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Time Worm genuine Error source and strict commands', () => {
  it('retains the full raw551 living terminal and its wounds, keeping451 peace and456 death separate', async () => {
    expect(await fileHash(fateTrojanNaturalPath)).toBe('4669ff84e79414608c873031a6a46fcfb11727c84eee5ef52a473e6685304c08');
    expect(await fileHash(deceitMentorPeacefulPath)).toBe('e8ee10feef684891b509016e10c135260835703f572e9c624168996f66cfc381');
    expect(await fileHash(deceitMentorDeathPath)).toBe('eb720bdd47384fd4741ebf0afa3020d6b55263fb6ebb2c1f68a5e69468b85dda');
    const raw = readObjectEntry<SliceState>(fateTrojanNaturalPath, 'final');
    const dead = readObjectEntry<SliceState>(deceitMentorDeathPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(fateTrojanNaturalPath, 'commands');
    const peacefulCommands = readObjectEntry<SliceIntent[]>(deceitMentorPeacefulPath, 'commands');
    expect(raw).toMatchObject({ schemaVersion: 172, contentVersion: 'fate-trojan-v172', revision: 552, week: 127, status: 'ACTIVE', health: 40,
      random: { seed: 'marauder-natural-v038', cursor: 361 } });
    expect(commands).toHaveLength(551); expect(commands.slice(0, 451)).toEqual(peacefulCommands);
    expect(commands[550]).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(dead).toMatchObject({ status: 'DEAD', health: 0, revision: 457, week: 108, random: { cursor: 319 } });
    const s = originalFateTrojan();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(s.timeWorm).toEqual(createTimeWormState()); expect(originalErrorRoots(s)).toEqual(originalErrorRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...TIME_WORM_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(1);
    expect(s.injuries).toEqual(raw.injuries); expect(s.injuryRisk).toBe(2);
    const migratedDead = loadTimeWormFixture(deceitMentorDeathPath, 'final');
    rejectTimeWorm(migratedDead, { type: 'LEARN_GUIDANCE' }); expect(migratedDead.health).toBe(0); expect(migratedDead.status).toBe('DEAD');
  }, 60_000);
  it('constructs current roots and independent original bottles without exposing unrelated play', () => {
    const s = createSliceRun('time-worm-hidden', sliceDefaultCreationSelection, 'time-worm-hidden');
    assertValidSliceState(s);
    expect(projectTimeWorm(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectTimeWorm(s, { type: 'LEARN_GUIDANCE' });
    const other = createTimeWormState(); other.bottles[0]!.labourSteps = 5;
    expect(s.timeWorm.bottles[0]!.labourSteps).toBe(0);
  });
  it('requires exact original commands, explicit consumption and three named preparations', () => {
    expect(TIME_WORM_ABILITY_IDS).toEqual(['error.s1.short-time-theft', 'error.s1.time-release']);
    expect(TIME_WORM_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'DECLARE_PENDING_ACTION', 'PLAN_RETURN']);
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'RECORD_CONDITIONS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'fate-trojan-potion-1' },
      { ...dose, bottleId: 'time-worm-potion-0' }, { ...dose, transformGender: true }, { type: 'FREE_REMOTE_RETURN' }, { type: 'REFILL_LAMP' },
    ]) expect(validateTimeWormCommand(command)).toBe(false);
    expect(validateTimeWormCommand(dose)).toBe(true);
    expect(TIME_WORM_PRICES).toEqual({ guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 });
  });
});

describe('Time Worm per-bottle acquisition and actual weekly economy', () => {
  it('requires actual care, subsequent rest and wages while preserving the original room and old bodies', () => {
    const original = originalFateTrojan();
    rejectTimeWorm(original, { type: 'LEARN_GUIDANCE' });
    const commands: SliceIntent[] = [], cared = ordinary(original, commands, true);
    expect(commands).toEqual([{ type: 'ACTION', action: 'REST' }, expect.objectContaining({ type: 'EVENT_CHOICE', choiceId: 'PAY' })]);
    expect(cared.cash).toBe(original.cash - 60);
    expect(cared.injuries.find(i => i.severity === 'HEAVY')!.treatedRevision).not.toBeNull();
    expect(cared.injuries).toHaveLength(3);
    const healed = recoveredSource(); expect(healed.health).toBe(100); expect(healed.injuries).toEqual([]);
    expect(healed.injuryRisk).toBe(0); expect(originalErrorRoots(healed)).toEqual(originalErrorRoots(original));
    expect(healed.fateTrojan.life.site.playerEnergy).toBe(9); expect(original.health).toBe(40);
  }, 60_000);
  it('pays for guidance and freezes all eight real roots, identity, original room and finance', () => {
    const before = ready(recoveredSource(), { cash: 500 }), s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!, scene = s.timeWorm.sourceScene!;
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([e.before.health, e.before.mind, e.before.spirituality]);
    expect(scene.originals).toEqual({ site: before.fateTrojan.life.site }); expect(scene.finance).toEqual(timeWormFinanceSnapshot(before));
    expect(e.finance).toEqual(scene.finance); expect(scene.character).toEqual(before.character);
    for (const key of errorLegacyKeys) expect(s.timeWorm.sourceHistory![key]).toEqual(before[key]);
    expect(s.timeWorm.sourceHistory!.fateTrojan).not.toBe(s.fateTrojan);
    expect(s.fateTrojan.life.site).toMatchObject({ clockSeconds: 745, playerLocation: 'OUTSIDE', playerTravelMetres: 86, playerEnergy: 9,
      lina: { location: 'OUTSIDE', energy: 96, travelMetres: 4 }, victor: { location: 'OUTSIDE', energy: 88, travelMetres: 12 },
      cabinet: { open: false, recognitionHolder: 'OWNER' }, link: { holder: 'OWNER', returnPending: false },
      parcel: { id: 'FT2-PARCEL', location: 'OUTSIDE', ordinaryMetres: 8 }, fate: { status: 'COMPLETED', paidToPlayer: 12, escrowPennies: 0 } });
    expect(validateTimeWormSource(s)).toBe(true); expect(validateTimeWormAcquisitionJournal(s)).toBe(true); rejectTimeWorm(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('uses the real S2 promotion clock, per-bottle five jobs and separate professional work', () => {
    const s = taught(); expect(s.fateTrojan.promotionWeek).toBe(119);
    expect(timeWormAcquisitionBlock(originalFateTrojan(), { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const p = prepared(), jobs = journal(p).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(p).find(e => e.command.type === 'BUY_POTION')!;
    expect(p.week).toBeGreaterThanOrEqual(131); expect(jobs).toHaveLength(5);
    for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.before.actions).toBe(purchase.after.actions);
    expect(p.timeWorm.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(p.timeWorm.bottles.slice(1).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0)).toBe(true);
    expect(journal(p).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(originalErrorRoots(p)).toEqual(originalErrorRoots(originalFateTrojan())); assertValidSliceState(p);
  }, 60_000);
  it('preserves actual paid preparation cancellation and rejects ordinary escape while locked', () => {
    const s = prepared(), event = journal(s).at(-1)!;
    expect(event.command.type).toBe('PREPARE_PROMOTION'); expect(event.before.cash - event.after.cash).toBe(150);
    expect(hasTimeWormLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ae(s, { type: 'LEAVE_PREPARATION' }), cancellation = journal(left).at(-1)!;
    expect(cancellation.after).toEqual(cancellation.before); expect(hasTimeWormLock(left)).toBe(false);
    expect(left.timeWorm.bottles[0]!.status).toBe('PLAYER'); expect(left.timeWorm.preparations).toEqual(s.timeWorm.preparations);
    expect(originalErrorRoots(left)).toEqual(originalErrorRoots(s)); rejectTimeWorm(left, dose); assertValidSliceState(left);
  }, 60_000);
  it('reconciles the last action through the actual shared weekly bill without free recovery', () => {
    let before = ready(recoveredSource(), { cash: 700 }); while (before.actionsRemaining > 1) before = ordinary(before);
    expect(before.actionsRemaining).toBe(1);
    const s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect(e.after.actions).toBe(0); expect(s.week).toBe(e.week + 1);
    expect(timeWormCompletedAcquisitionBudgetMatches(s, e)).toBe(true);
    expect([s.health, s.mind, s.spirituality]).toEqual([e.after.health, e.after.mind, e.after.spirituality]);
    const forged = structuredClone(s); forged.cash++; expect(validateTimeWormState(forged)).toBe(false);
    const forgedFinance = structuredClone(s); forgedFinance.weeklyBudget++; expect(validateTimeWormState(forgedFinance)).toBe(false);
  }, 60_000);
  it('permits zero-action cancellation, retains its costs and only then settles the week', () => {
    let s = ready(ae(prepared(), { type: 'LEAVE_PREPARATION' }), { ap: 3, cash: 250 });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = ae(s, { type: 'PREPARE_PROMOTION' });
    expect(s.actionsRemaining).toBe(0); const week = s.week;
    const after = ae(s, { type: 'LEAVE_PREPARATION' }), e = journal(after).at(-1)!;
    expect(e.before).toEqual(e.after); expect(after.week).toBe(week + 1); expect(after.timeWorm.bottles[0]!.status).toBe('PLAYER');
    expect(timeWormCompletedAcquisitionBudgetMatches(after, e)).toBe(true); assertValidSliceState(after);
  }, 60_000);
  it('records the actual same-seed result and preserves every original bottle and failed cost', () => {
    const before = prepared(), s = ae(before, dose), e = journal(s).at(-1)!, kind = e.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const h = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, m = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([Math.max(1, e.before.health - h), Math.max(1, e.before.mind - m), e.before.spirituality]);
    expect(e.after.sequence).toBe(succeeds ? 1 : 2); expect(e.cursorAfter).toBe(e.cursorBefore + 1); expect(e.randomAfter).toBe(e.randomBefore! + 1);
    expect(s.timeWorm.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: e.week, preparationWeek: e.week });
    expect(s.timeWorm.preparedWeek).toBeNull(); expect(originalErrorRoots(s)).toEqual(originalErrorRoots(before));
    for (const id of TIME_WORM_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateTimeWormAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('finishes with16 exact skills, two new zeros and no free stock or identity change', () => {
    const s = promoted(), source = originalFateTrojan(), e = journal(s).at(-1)!;
    expect(e.command.type).toBe('CONSUME'); expect(e.after.sequence).toBe(1); expect(s.timeWorm.fateTrojanActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toHaveLength(16); expect(s.progression.acting).toBe(0);
    for (const id of TIME_WORM_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of TIME_WORM_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(3);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalErrorRoots(s)).toEqual(originalErrorRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(e.after.coreStats[stat]).toBe(e.before.coreStats[stat] + 1);
    expect(e.after.spirituality).toBe(e.before.spirituality); rejectTimeWorm(s, dose); assertValidSliceState(s);
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
    expect(s.timeWorm.preparedWeek).toBeNull(); expect(s.timeWorm.bottles[0]!.status).toBe('CONSUMED');
    expect(originalErrorRoots(s)).toEqual(originalErrorRoots(before));
    for (const id of TIME_WORM_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateTimeWormAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('requires three real failed bottles, paid replacement and the next real week in an isolated directed branch', () => {
    let s = directedPrepared(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    for (let number = 1; number <= 3; number++) {
      s = ae(s, { type: 'CONSUME', bottleId: `time-worm-potion-${number}`, confirmed: true });
      expect(s.progression.sequence).toBe(2);
      if (number < 3) { rejectTimeWorm(s, { type: 'REQUEST_SUPPLY' }); s = prepareBottle(s, `time-worm-potion-${number + 1}`); }
    }
    expect(s.timeWorm.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    s = ready(s, { ap: 2, cash: 100 });
    s = ae(s, { type: 'REQUEST_SUPPLY' }); const request = journal(s).at(-1)!;
    expect(request.before.cash - request.after.cash).toBe(100); expect(request.before.actions - request.after.actions).toBe(1);
    rejectTimeWorm(s, { type: 'RECEIVE_SUPPLY' }); expect(s.timeWorm.bottles).toHaveLength(3);
    s = ready(s, { afterWeek: request.week }); s = ae(s, { type: 'RECEIVE_SUPPLY' });
    const delivery = journal(s).at(-1)!; expect(delivery.week).toBeGreaterThan(request.week); expect(delivery.before).toEqual(delivery.after);
    expect(s.timeWorm.bottles).toHaveLength(6);
    expect(s.timeWorm.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(originalErrorRoots(s)).toEqual(originalErrorRoots(originalFateTrojan())); assertValidSliceState(s);
  }, 60_000);
  it('ordinary S1 rest keeps the real120 spirituality ceiling and does not refill site energy', () => {
    const s = promoted(), rested = ordinary(s, undefined, true);
    expect(s.spirituality).toBe(120); expect(rested.spirituality).toBe(120);
    expect(rested.progression.sequence).toBe(1); expect(rested.fateTrojan.life.site).toEqual(s.fateTrojan.life.site);
    expect(originalErrorRoots(rested)).toEqual(originalErrorRoots(s)); assertValidSliceState(rested);
  }, 60_000);
  it('does not issue premature or free replacement originals', () => {
    const s = taught(); rejectTimeWorm(s, { type: 'REQUEST_SUPPLY' }); rejectTimeWorm(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.timeWorm.bottles).toHaveLength(3); expect(s.timeWorm.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const e of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(e.before.cash - e.after.cash).toBe(100); expect(e.before.actions - e.after.actions).toBe(1);
      const delivery = journal(finish).find(d => d.command.type === 'RECEIVE_SUPPLY' && d.revision > e.revision)!;
      expect(delivery.week).toBeGreaterThan(e.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.timeWorm.bottles.map(b => b.id)).size).toBe(finish.timeWorm.bottles.length);
  }, 60_000);
});
