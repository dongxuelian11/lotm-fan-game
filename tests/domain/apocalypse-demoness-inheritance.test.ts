import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { validateCalamityDemonessState } from '../../src/domain/calamity-demoness/index.js';
import { createApocalypseDemonessState, apocalypseDemonessInheritedView, validateApocalypseDemonessSource, validateApocalypseDemonessState,
  validateApocalypseDemonessAcquisitionJournal, validateApocalypseDemonessJournalContinuity } from '../../src/domain/apocalypse-demoness/index.js';
import { apocalypseDemonessOriginalSnapshot, apocalypseDemonessExpectedOriginals } from '../../src/domain/apocalypse-demoness/life.js';
import { demonessLegacyKeys, originalDemonessRoots, originalCalamity, prepared, promoted, taught, rejectIntent, ae, ready } from './apocalypse-demoness-directed-helper.js';

const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const journal = (s: SliceState) => s.apocalypseDemoness.acquisitionJournal;

describe('Apocalypse Demoness exact eight-root history and continuing original bodies', () => {
  it('offers the frozen actual S2 view to native validators without modifying either historical location', () => {
    const s = promoted(), before = digest(s), view = apocalypseDemonessInheritedView(s), scene = s.apocalypseDemoness.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery);
    expect(view.character).toEqual(scene.character); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision); expect(view.week).toBe(scene.week); expect(view.date).toEqual(scene.date);
    expect(view.apocalypseDemoness).toEqual(createApocalypseDemonessState()); expect(digest(originalDemonessRoots(view))).toBe(digest(originalDemonessRoots(originalCalamity())));
    expect(validateCalamityDemonessState(view)).toBe(true); expect(digest(s)).toBe(before);
    expect(view.calamityDemoness).not.toBe(s.calamityDemoness); expect(view.calamityDemoness.life.site).not.toBe(s.calamityDemoness.life.site);
    expect(view.calamityDemoness.life.site).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28, clockSeconds: 217 });
    expect(view.calamityDemoness.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 22, clockSeconds: 407 });
  }, 240_000);

  it('preserves all eighteen original skills including seven zeros and adds only two zero skills', () => {
    const s = promoted(), old = originalCalamity(), originalIds = Object.keys(old.progression.mastery);
    expect(originalIds).toHaveLength(18); expect(originalIds.filter(id => old.progression.mastery[id] === 0)).toHaveLength(7);
    for (const id of originalIds) expect(s.progression.mastery[id]).toBe(old.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery).filter(id => !originalIds.includes(id))).toEqual(['assassin.s1.pulse-containment', 'assassin.s1.mirror-buffer']);
    expect(s.progression.mastery['assassin.s1.pulse-containment']).toBe(0); expect(s.progression.mastery['assassin.s1.mirror-buffer']).toBe(0);
    expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age); expect(s.character.name).toBe(old.character.name);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(old.character.coreStats[key] + 1);
  }, 240_000);

  it('keeps the original dead and surrendered people, wounds, disease care and Iris retreat separate', () => {
    const s = promoted(), original = originalCalamity(), history = s.apocalypseDemoness.sourceHistory!;
    for (const key of demonessLegacyKeys) expect(digest(s[key])).toBe(digest(original[key]));
    expect(history.pain.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD' });
    expect(history.despair.encounter).toMatchObject({ enemyHealth: 60, enemyMind: 100, enemySpirituality: 12, enemyStatus: 'SURRENDERED', enemyDisease: 0, enemyRisk: 1 });
    expect(history.despair.encounter.enemyInjuries).toHaveLength(2); expect(history.despair.encounter.terminal!.enemyDisease).toBe(2);
    expect(history.unagingDemoness.encounter).toMatchObject({ enemyHealth: 70, enemyMind: 100, enemySpirituality: 100, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT' });
    expect(history.unagingDemoness.encounter.enemyInjuries).toHaveLength(1);
    expect(history.calamityDemoness.encounter).toMatchObject({ status: 'RETREATED', targetId: 'CD2-IRIS', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyPosition: 'YARD' });
    expect(history.calamityDemoness.encounter.enemyInjuries).toEqual([]); expect(history.calamityDemoness.encounter.powerUses).toEqual({ FORCE_STRIKE: 3, GUARD: 2, DISRUPT: 0 });
    expect(s.combatHistory.slice(0, original.combatHistory.length)).toEqual(original.combatHistory); expect(original.combatHistory).toHaveLength(13);
    expect(validateApocalypseDemonessSource(s)).toBe(true); expect(validateApocalypseDemonessAcquisitionJournal(s)).toBe(true);
  }, 240_000);

  it('keeps consumed old residue, exhausted old load, returned old plates and unused combat plate without copying inventory', () => {
    let s = promoted(); const source = s.apocalypseDemoness.sourceScene!.originals, history = digest(originalDemonessRoots(s));
    expect(source.site).toEqual(s.calamityDemoness.encounter.currentSite); expect(source.site).not.toEqual(s.calamityDemoness.life.site);
    expect(source.site.load).toMatchObject({ remainingLoads: 0, appliedLoads: 1 }); expect(source.site.residue).toMatchObject({ id: 'CD2-RESIDUE-1', status: 'CONSUMED' });
    expect(source.site.box).toMatchObject({ state: 'CLOSED', scorched: true, pulses: 1 }); expect(source.site.plates.map(p => [p.status, p.location, p.charges])).toEqual([['RETURNED', 'CUSTODIAN', 0], ['RETURNED', 'CUSTODIAN', 0], ['RETURNED', 'CUSTODIAN', 1]]);
    expect(source.combatPlate).toMatchObject({ id: 'CD2-COMBAT-PLATE', charges: 3, initialCharges: 3, paidPennies: 20 });
    expect(s.apocalypseDemoness.life.site).not.toBe(source.site); expect(s.apocalypseDemoness.life.residue).toBeNull(); expect(s.apocalypseDemoness.life.load).toBeNull();
    s = ae(ready(s, { cash: 100 }), { type: 'RECOVER_ENERGY' });
    expect(s.apocalypseDemoness.life.site!.playerEnergy).toBe(42); expect(s.calamityDemoness.encounter.currentSite!.playerEnergy).toBe(22); expect(s.calamityDemoness.life.site.playerEnergy).toBe(28);
    expect(digest(originalDemonessRoots(s))).toBe(history); expect(apocalypseDemonessExpectedOriginals(s)).toEqual(apocalypseDemonessOriginalSnapshot(s));
    expect(s.apocalypseDemoness.sourceScene!.originals).toEqual(source);
  }, 240_000);

  it('rejects identity edits, free old mastery, restored old stock and changes to either frozen old site', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.name = '另一个人'; }, s => { s.character.age++; }, s => { s.character.coreStats.will++; },
      s => { s.progression.mastery['assassin.s7.black-flame'] = 8; }, s => { s.progression.mastery['assassin.s4.plague'] = 8; },
      s => { s.calamityDemoness.life.site.playerEnergy = 100; }, s => { s.calamityDemoness.life.site.playerLocation = 'OUTSIDE'; }, s => { s.calamityDemoness.encounter.currentSite!.playerEnergy = 100; },
      s => { s.calamityDemoness.encounter.currentSite!.vera!.location = 'ENTRY'; }, s => { s.calamityDemoness.encounter.currentSite!.marcus!.energy++; }, s => { s.calamityDemoness.encounter.currentSite!.playerTravelMetres++; },
      s => { s.calamityDemoness.encounter.currentSite!.load.remainingLoads = 1; }, s => { s.calamityDemoness.encounter.currentSite!.residue!.status = 'CONTAINED'; }, s => { s.calamityDemoness.encounter.currentSite!.box.scorched = false; },
      s => { s.calamityDemoness.encounter.currentSite!.plates[2]!.location = 'PLAYER'; }, s => { s.calamityDemoness.encounter.plate!.charges = 0; },
      s => { s.calamityDemoness.encounter.enemySpirituality = 120; }, s => { s.calamityDemoness.encounter.enemyStatus = 'SURRENDERED'; }, s => { s.pain.encounter.enemyHealth = 100; },
      s => { s.despair.encounter.enemyDisease = 2; }, s => { s.unagingDemoness.encounter.enemyInjuries = []; }, s => { s.calamityDemoness.life.journal.pop(); },
      s => { s.apocalypseDemoness.sourceScene!.character.gender = 'MALE'; }, s => { s.apocalypseDemoness.sourceHistory!.calamityDemoness.encounter.currentSite!.playerEnergy++; },
      s => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ];
    const base = promoted(); for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
  }, 240_000);

  it('rejects forged chronology, paid stock, checks, source identity and accidental duplicate original inventory', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.cash++; }, s => { s.actionsRemaining++; }, s => { s.spirituality--; }, s => { journal(s)[0]!.after.cash++; }, s => { journal(s)[0]!.after.actions++; },
      s => { journal(s)[1]!.revision = journal(s)[0]!.revision; }, s => { journal(s)[0]!.week = s.week + 1; }, s => { s.apocalypseDemoness.sourceScene!.revision = s.revision + 1; },
      s => { s.apocalypseDemoness.sourceScene!.random.cursor = s.random.cursor + 1; }, s => { s.apocalypseDemoness.sourceScene!.finance.weeklyBudget++; }, s => { journal(s).at(-1)!.finance.weeklyBudget++; },
      s => { s.apocalypseDemoness.bottles[0]!.id = 'apocalypse-demoness-potion-2'; }, s => { s.apocalypseDemoness.preparations[1]!.taskId = s.apocalypseDemoness.preparations[0]!.taskId; },
      s => { Object.assign(s.apocalypseDemoness, { freeSupply: true }); }, s => { Object.assign(journal(s)[0]!, { waivedCost: true }); }, s => { Object.assign(s.apocalypseDemoness.sourceScene!.originals, { copiedMirror: 'PLAYER' }); },
    ];
    const base = prepared(); for (const mutate of mutations) { const s = structuredClone(base); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
    const promotedBase = promoted(); for (const mutate of [
      (s: SliceState) => { const e = journal(s).at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
      (s: SliceState) => { journal(s).at(-1)!.randomAfter!++; },
      (s: SliceState) => { s.apocalypseDemoness.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = structuredClone(promotedBase); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
  }, 240_000);

  it('closes all old mutation routes at paid guidance while preserving lawful historical validation at S1', () => {
    const s = taught();
    for (const intent of [
      { type: 'CALAMITY_DEMONESS', command: { type: 'ENCOUNTER_TALK' } }, { type: 'CALAMITY_DEMONESS', command: { type: 'REFLECT' } },
      { type: 'UNAGING_DEMONESS', command: { type: 'REFLECT' } }, { type: 'DESPAIR', command: { type: 'REFLECT' } }, { type: 'ASSASSIN', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(digest(originalDemonessRoots(s))).toBe(digest(originalDemonessRoots(originalCalamity()))); expect(validateApocalypseDemonessJournalContinuity(s)).toBe(true);
    expect(validateCalamityDemonessState(apocalypseDemonessInheritedView(promoted()))).toBe(true);
  }, 240_000);
});
