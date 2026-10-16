import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS, createApocalypseDemonessState, hasApocalypseDemonessLock, projectApocalypseDemoness,
  validateApocalypseDemonessAcquisitionJournal, validateApocalypseDemonessCommand, validateApocalypseDemonessSource, validateApocalypseDemonessState,
  apocalypseDemonessAcquisitionBlock, apocalypseDemonessCompletedAcquisitionBudgetMatches, apocalypseDemonessFinanceSnapshot,
} from '../../src/domain/apocalypse-demoness/index.js';
import { APOCALYPSE_DEMONESS_ABILITY_IDS, APOCALYPSE_DEMONESS_PREPARATION_IDS } from '../../src/domain/apocalypse-demoness/types.js';
import { APOCALYPSE_DEMONESS_PRICES } from '../../src/domain/apocalypse-demoness/content.js';
import {
  ae, dose, originalDemonessRoots, originalCalamity, prepared, promoted, ordinary,
  rejectApocalypseDemoness, rejectIntent, taught, calamityNaturalPath, unagingNaturalPath, recoveredSource, ready,
  demonessLegacyKeys, directedPrepared, prepareBottle,
} from './apocalypse-demoness-directed-helper.js';

const journal = (s: SliceState) => s.apocalypseDemoness.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Apocalypse Demoness genuine Demoness source and strict commands', () => {
  it('preserves the actual585 source, complete487-command predecessor and original eight roots', async () => {
    expect(await fileHash(calamityNaturalPath)).toBe('cffe4b82ef1798b6bd8687b809efd58338692172bf88bebfecc3bd6ededd9932');
    expect(await fileHash(unagingNaturalPath)).toBe('e11152731ee89cb51c4c411864280a9dfb39c8452a33a898d94348f872d8a195');
    const raw = readObjectEntry<SliceState>(calamityNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(calamityNaturalPath, 'commands');
    const prefix = readObjectEntry<SliceIntent[]>(unagingNaturalPath, 'commands');
    expect(raw).toMatchObject({ schemaVersion: 174, contentVersion: 'calamity-demoness-v174', revision: 586, week: 143, status: 'ACTIVE', health: 70,
      random: { seed: 'assassin-natural-v045', cursor: 207 } });
    expect(commands).toHaveLength(585); expect(prefix).toHaveLength(487); expect(commands.slice(0, 487)).toEqual(prefix);
    expect(commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(readObjectEntry<unknown>(calamityNaturalPath, 'creation')).toEqual(readObjectEntry<unknown>(unagingNaturalPath, 'creation'));
    expect(readObjectEntry<string>(calamityNaturalPath, 'seed')).toEqual(readObjectEntry<string>(unagingNaturalPath, 'seed'));
    const s = originalCalamity();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(s.apocalypseDemoness).toEqual(createApocalypseDemonessState()); expect(originalDemonessRoots(s)).toEqual(originalDemonessRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(7);
    expect(s.injuries).toEqual(raw.injuries); expect(s.injuryRisk).toBe(0);
    expect(s.calamityDemoness.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemySpirituality: 97 });
  }, 60_000);
  it('constructs current roots and independent original bottles without exposing unrelated play', () => {
    const s = createSliceRun('apocalypse-demoness-hidden', sliceDefaultCreationSelection, 'apocalypse-demoness-hidden');
    assertValidSliceState(s);
    expect(projectApocalypseDemoness(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectApocalypseDemoness(s, { type: 'LEARN_GUIDANCE' });
    const other = createApocalypseDemonessState(); other.bottles[0]!.labourSteps = 5;
    expect(s.apocalypseDemoness.bottles[0]!.labourSteps).toBe(0);
  });
  it('requires exact original commands, explicit consumption and three named preparations', () => {
    expect(APOCALYPSE_DEMONESS_ABILITY_IDS).toEqual(['assassin.s1.pulse-containment', 'assassin.s1.mirror-buffer']);
    expect(APOCALYPSE_DEMONESS_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'PLAN_CONTAINMENT', 'CHECK_RETURN']);
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'RECORD_CONDITIONS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'calamity-demoness-potion-1' },
      { ...dose, bottleId: 'apocalypse-demoness-potion-0' }, { ...dose, transformGender: true }, { type: 'FREE_REMOTE_RETURN' }, { type: 'REFILL_OLD_LOAD' },
    ]) expect(validateApocalypseDemonessCommand(command)).toBe(false);
    expect(validateApocalypseDemonessCommand(dose)).toBe(true);
    expect(APOCALYPSE_DEMONESS_PRICES).toEqual({ guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 });
  });
});

describe('Apocalypse Demoness per-bottle acquisition and actual weekly economy', () => {
  it('starts with an eligible wounded source and keeps physical originals through ordinary recovery', () => {
    const original = originalCalamity(), taughtOriginal = ae(original, { type: 'LEARN_GUIDANCE' });
    expect(journal(taughtOriginal)[0]!.before).toMatchObject({ health: 70, mind: 100, spirituality: 120, cash: 610, actions: 3 });
    expect(taughtOriginal.injuries).toEqual(original.injuries);
    const healed = recoveredSource(); expect(healed.health).toBe(100); expect(healed.injuries).toEqual([]);
    expect(healed.injuryRisk).toBe(0); expect(originalDemonessRoots(healed)).toEqual(originalDemonessRoots(original));
    expect(healed.calamityDemoness.encounter.currentSite!.playerEnergy).toBe(22); expect(original.health).toBe(70);
  }, 60_000);
  it('requires the actual closed currentSite before charging guidance and never substitutes historical ENTRY', () => {
    const source = originalCalamity();
    const missing = structuredClone(source); missing.calamityDemoness.encounter.currentSite = null;
    expect(apocalypseDemonessAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    const stale = structuredClone(source); stale.calamityDemoness.encounter.currentSite = structuredClone(stale.calamityDemoness.life.site);
    expect(apocalypseDemonessAcquisitionBlock(stale, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    const adultInside = structuredClone(source); adultInside.calamityDemoness.encounter.currentSite!.vera!.location = 'ENTRY';
    expect(apocalypseDemonessAcquisitionBlock(adultInside, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(apocalypseDemonessAcquisitionBlock(source, { type: 'LEARN_GUIDANCE' })).toBeNull();
  }, 60_000);
  it('pays for guidance and freezes all eight real roots, identity, original room and finance', () => {
    const before = ready(recoveredSource(), { cash: 500 }), s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!, scene = s.apocalypseDemoness.sourceScene!;
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([e.before.health, e.before.mind, e.before.spirituality]);
    expect(scene.originals).toEqual({ site: before.calamityDemoness.encounter.currentSite, combatPlate: before.calamityDemoness.encounter.plate }); expect(scene.finance).toEqual(apocalypseDemonessFinanceSnapshot(before));
    expect(e.finance).toEqual(scene.finance); expect(scene.character).toEqual(before.character);
    for (const key of demonessLegacyKeys) expect(s.apocalypseDemoness.sourceHistory![key]).toEqual(before[key]);
    expect(s.apocalypseDemoness.sourceHistory!.calamityDemoness).not.toBe(s.calamityDemoness);
    expect(scene.originals.site).toMatchObject({ clockSeconds: 407, playerLocation: 'OUTSIDE', playerTravelMetres: 78, playerEnergy: 22,
      vera: { location: 'OUTSIDE', energy: 92, travelMetres: 8 }, marcus: { location: 'OUTSIDE', energy: 70, travelMetres: 30 },
      load: { remainingLoads: 0, appliedLoads: 1 }, residue: { status: 'CONSUMED' }, box: { state: 'CLOSED', scorched: true, pulses: 1 } });
    expect(scene.originals.combatPlate).toMatchObject({ id: 'CD2-COMBAT-PLATE', location: 'PLAYER', charges: 3 });
    expect(s.calamityDemoness.life.site.playerLocation).toBe('ENTRY');
    expect(scene.originals.site).not.toBe(s.calamityDemoness.encounter.currentSite);
    expect(validateApocalypseDemonessSource(s)).toBe(true); expect(validateApocalypseDemonessAcquisitionJournal(s)).toBe(true); rejectApocalypseDemoness(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('uses the real S2 promotion clock, per-bottle five jobs and separate professional work', () => {
    const s = taught(); expect(s.calamityDemoness.promotionWeek).toBe(134);
    expect(apocalypseDemonessAcquisitionBlock(originalCalamity(), { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const p = prepared(), jobs = journal(p).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(p).find(e => e.command.type === 'BUY_POTION')!;
    expect(p.week).toBeGreaterThanOrEqual(146); expect(jobs).toHaveLength(5);
    for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.before.actions).toBe(purchase.after.actions);
    expect(p.apocalypseDemoness.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(p.apocalypseDemoness.bottles.slice(1).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0)).toBe(true);
    expect(journal(p).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(originalDemonessRoots(p)).toEqual(originalDemonessRoots(originalCalamity())); assertValidSliceState(p);
  }, 60_000);
  it('preserves actual paid preparation cancellation and rejects ordinary escape while locked', () => {
    const s = prepared(), event = journal(s).at(-1)!;
    expect(event.command.type).toBe('PREPARE_PROMOTION'); expect(event.before.cash - event.after.cash).toBe(150);
    expect(hasApocalypseDemonessLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ae(s, { type: 'LEAVE_PREPARATION' }), cancellation = journal(left).at(-1)!;
    expect(cancellation.after).toEqual(cancellation.before); expect(hasApocalypseDemonessLock(left)).toBe(false);
    expect(left.apocalypseDemoness.bottles[0]!.status).toBe('PLAYER'); expect(left.apocalypseDemoness.preparations).toEqual(s.apocalypseDemoness.preparations);
    expect(originalDemonessRoots(left)).toEqual(originalDemonessRoots(s)); rejectApocalypseDemoness(left, dose); assertValidSliceState(left);
  }, 60_000);
  it('reconciles the last action through the actual shared weekly bill without free recovery', () => {
    let before = ready(recoveredSource(), { cash: 700 }); while (before.actionsRemaining > 1) before = ordinary(before);
    expect(before.actionsRemaining).toBe(1);
    const s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect(e.after.actions).toBe(0); expect(s.week).toBe(e.week + 1);
    expect(apocalypseDemonessCompletedAcquisitionBudgetMatches(s, e)).toBe(true);
    expect([s.health, s.mind, s.spirituality]).toEqual([e.after.health, e.after.mind, e.after.spirituality]);
    const forged = structuredClone(s); forged.cash++; expect(validateApocalypseDemonessState(forged)).toBe(false);
    const forgedFinance = structuredClone(s); forgedFinance.weeklyBudget++; expect(validateApocalypseDemonessState(forgedFinance)).toBe(false);
  }, 60_000);
  it('permits zero-action cancellation, retains its costs and only then settles the week', () => {
    let s = ready(ae(prepared(), { type: 'LEAVE_PREPARATION' }), { ap: 3, cash: 250 });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = ae(s, { type: 'PREPARE_PROMOTION' });
    expect(s.actionsRemaining).toBe(0); const week = s.week;
    const after = ae(s, { type: 'LEAVE_PREPARATION' }), e = journal(after).at(-1)!;
    expect(e.before).toEqual(e.after); expect(after.week).toBe(week + 1); expect(after.apocalypseDemoness.bottles[0]!.status).toBe('PLAYER');
    expect(apocalypseDemonessCompletedAcquisitionBudgetMatches(after, e)).toBe(true); assertValidSliceState(after);
  }, 60_000);
  it('records the actual same-seed result and preserves every original bottle and failed cost', () => {
    const before = prepared(), s = ae(before, dose), e = journal(s).at(-1)!, kind = e.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const h = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, m = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([Math.max(1, e.before.health - h), Math.max(1, e.before.mind - m), e.before.spirituality]);
    expect(e.after.sequence).toBe(succeeds ? 1 : 2); expect(e.cursorAfter).toBe(e.cursorBefore + 1); expect(e.randomAfter).toBe(e.randomBefore! + 1);
    expect(s.apocalypseDemoness.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: e.week, preparationWeek: e.week });
    expect(s.apocalypseDemoness.preparedWeek).toBeNull(); expect(originalDemonessRoots(s)).toEqual(originalDemonessRoots(before));
    for (const id of APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateApocalypseDemonessAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('finishes with20 exact skills, two new zeros and no free stock or identity change', () => {
    const s = promoted(), source = originalCalamity(), e = journal(s).at(-1)!;
    expect(e.command.type).toBe('CONSUME'); expect(e.after.sequence).toBe(1); expect(s.apocalypseDemoness.calamityDemonessActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toHaveLength(20); expect(s.progression.acting).toBe(0);
    for (const id of APOCALYPSE_DEMONESS_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(9);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalDemonessRoots(s)).toEqual(originalDemonessRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(e.after.coreStats[stat]).toBe(e.before.coreStats[stat] + 1);
    expect(e.after.spirituality).toBe(e.before.spirituality); rejectApocalypseDemoness(s, dose); assertValidSliceState(s);
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
    expect(s.apocalypseDemoness.preparedWeek).toBeNull(); expect(s.apocalypseDemoness.bottles[0]!.status).toBe('CONSUMED');
    expect(originalDemonessRoots(s)).toEqual(originalDemonessRoots(before));
    for (const id of APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateApocalypseDemonessAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('requires three real failed bottles, paid replacement and the next real week in an isolated directed branch', () => {
    let s = directedPrepared(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    for (let number = 1; number <= 3; number++) {
      s = ae(s, { type: 'CONSUME', bottleId: `apocalypse-demoness-potion-${number}`, confirmed: true });
      expect(s.progression.sequence).toBe(2);
      if (number < 3) { rejectApocalypseDemoness(s, { type: 'REQUEST_SUPPLY' }); s = prepareBottle(s, `apocalypse-demoness-potion-${number + 1}`); }
    }
    expect(s.apocalypseDemoness.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_FAILURE', 'FAILURE']);
    s = ready(s, { ap: 2, cash: 100 });
    s = ae(s, { type: 'REQUEST_SUPPLY' }); const request = journal(s).at(-1)!;
    expect(request.before.cash - request.after.cash).toBe(100); expect(request.before.actions - request.after.actions).toBe(1);
    rejectApocalypseDemoness(s, { type: 'RECEIVE_SUPPLY' }); expect(s.apocalypseDemoness.bottles).toHaveLength(3);
    s = ready(s, { afterWeek: request.week }); s = ae(s, { type: 'RECEIVE_SUPPLY' });
    const delivery = journal(s).at(-1)!; expect(delivery.week).toBeGreaterThan(request.week); expect(delivery.before).toEqual(delivery.after);
    expect(s.apocalypseDemoness.bottles).toHaveLength(6);
    expect(s.apocalypseDemoness.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(originalDemonessRoots(s)).toEqual(originalDemonessRoots(originalCalamity())); assertValidSliceState(s);
  }, 60_000);
  it('ordinary S1 rest keeps the real120 spirituality ceiling and does not refill site energy', () => {
    const s = promoted(), rested = ordinary(s, undefined, true);
    expect(s.spirituality).toBe(120); expect(rested.spirituality).toBe(120);
    expect(projectSliceState(s).maxSpirituality).toBe(120); expect(projectSliceState(rested).maxSpirituality).toBe(120);
    expect(() => assertValidSliceState({ ...rested, spirituality: 121 })).toThrow();
    expect(rested.progression.sequence).toBe(1); expect(rested.apocalypseDemoness.life.site).toEqual(s.apocalypseDemoness.life.site);
    expect(originalDemonessRoots(rested)).toEqual(originalDemonessRoots(s)); assertValidSliceState(rested);
  }, 60_000);
  it('exposes natural effects and paid originals without claiming a complete formula or free old mastery', () => {
    const s = promoted(), view = projectApocalypseDemoness(s);
    expect(view).toMatchObject({ title: '末日魔女·魔女序列1', formulaKnown: false, formula: [], originalGender: 'MALE', currentGender: 'FEMALE' });
    expect(view.abilities).toHaveLength(20); expect(view.abilities.slice(-2).map(a => [a.id, a.label, a.mastery])).toEqual([
      ['assassin.s1.pulse-containment', '脉冲收束', 0], ['assassin.s1.mirror-buffer', '镜面缓冲', 0],
    ]);
    for (const ability of view.abilities.slice(-2)) {
      expect(ability.description).toContain('8灵性与2精神'); expect(ability.description).toContain('20秒');
      expect(ability.description).not.toMatch(/unknown|DESIGN_CANDIDATE|G层|L236|第四支柱|特莉丝/);
    }
    expect(view.inheritedTools).toContain('CD2-COMBAT-PLATE'); expect(view.inheritedTools).toContain('余3次');
  }, 60_000);
  it('does not issue premature or free replacement originals', () => {
    const s = taught(); rejectApocalypseDemoness(s, { type: 'REQUEST_SUPPLY' }); rejectApocalypseDemoness(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.apocalypseDemoness.bottles).toHaveLength(3); expect(s.apocalypseDemoness.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const e of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(e.before.cash - e.after.cash).toBe(100); expect(e.before.actions - e.after.actions).toBe(1);
      const delivery = journal(finish).find(d => d.command.type === 'RECEIVE_SUPPLY' && d.revision > e.revision)!;
      expect(delivery.week).toBeGreaterThan(e.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.apocalypseDemoness.bottles.map(b => b.id)).size).toBe(finish.apocalypseDemoness.bottles.length);
  }, 60_000);
});
