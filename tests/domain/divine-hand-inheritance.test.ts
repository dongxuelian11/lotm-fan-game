import { describe, expect, it } from 'vitest';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateGloryState } from '../../src/domain/glory/index.js';
import {
  createDivineHandState, divineHandInheritedView, validateDivineHandSource, validateDivineHandState,
  validateDivineHandAcquisitionJournal, validateDivineHandJournalContinuity,
} from '../../src/domain/divine-hand/index.js';
import { originalWarriorRoots, originalGlory, prepared, promoted, taught, rejectIntent } from './divine-hand-directed-helper.js';

const journal = (s: SliceState) => s.divineHand.acquisitionJournal;

describe('Divine Hand immutable original history and replay evidence', () => {
  it('provides the paid-guidance S2 view to native old validators without mutating current state', () => {
    const s = promoted(), before = structuredClone(s), view = divineHandInheritedView(s), scene = s.divineHand.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery);
    expect(view.character).toEqual(scene.character); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.week).toBe(scene.week); expect(view.date).toEqual(scene.date); expect(view.divineHand).toEqual(createDivineHandState());
    expect(originalWarriorRoots(view)).toEqual(originalWarriorRoots(originalGlory()));
    expect(validateGloryState(view)).toBe(true); expect(s).toEqual(before);
    expect(view.glory).not.toBe(s.glory); expect(view.glory.life.site).not.toBe(s.glory.life.site);
  }, 60_000);
  it('preserves all bottles, actual paid stock and separate surrendered and dead bodies', () => {
    const s = promoted(), old = s.divineHand.sourceHistory!, source = originalGlory();
    for (const key of ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight', 'glory'] as const) {
      expect(old[key].bottles).toEqual(source[key].bottles);
      expect(old[key].bottles.filter(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    }
    expect(old.gladiator.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'SUCCESS', null]);
    expect(old.demonHunter.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_SUCCESS', null]);
    expect(old.glory.bottles.slice(1).map(b => [b.status, b.labourSteps, b.acquiredWeek])).toEqual([['SUPPLIER', 0, null], ['SUPPLIER', 0, null]]);
    expect(old.glory.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 110, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(old.glory.encounter.enemyInjuries).toHaveLength(1); expect(old.glory.encounter.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(old.glory.life.site.load).toMatchObject({ remainingLoads: 0, appliedLoads: 1 });
    expect(old.glory.life.site.pads).toMatchObject({ remaining: 1, consumed: 1, location: 'BENCH' });
    expect(old.glory.life.site.plates.map(plate => plate.charges)).toEqual([0, 0, 1]);
    expect(old.demonHunter.encounter).toEqual(source.demonHunter.encounter);
    expect(validateDivineHandSource(s)).toBe(true); expect(validateDivineHandAcquisitionJournal(s)).toBe(true);
  }, 60_000);
  it('rejects identity edits, free old mastery, restored resources and moved original bodies', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.name = '另一个人'; }, s => { s.character.age++; },
      s => { s.character.coreStats.will++; }, s => { s.progression.mastery['warrior.s5.damage-sharing'] = 8; },
      s => { s.glory.life.site.playerEnergy = 100; }, s => { s.glory.life.site.celia.energy = 100; },
      s => { s.glory.life.site.evan.location = 'BENCH'; }, s => { s.glory.life.site.playerLocation = 'BENCH'; },
      s => { s.glory.life.site.playerTravelMetres++; }, s => { s.glory.life.site.clockSeconds++; },
      s => { s.glory.life.site.armor!.integrity = 65; }, s => { s.silverKnight.life.armor.integrity = 60; },
      s => { s.glory.life.site.armorSource!.snapshot.integrity = 60; }, s => { s.glory.life.site.load.remainingLoads = 1; },
      s => { s.glory.life.site.pads.remaining = 2; }, s => { s.glory.life.site.pads.location = 'PLAYER'; },
      s => { s.glory.life.site.plates[0]!.charges = 1; }, s => { s.glory.life.site.plates[2]!.location = 'PLAYER'; },
      s => { s.glory.encounter.enemyHealth = 100; }, s => { s.glory.encounter.enemySpirituality = 120; },
      s => { s.glory.encounter.weaponLocation = 'HAND'; }, s => { s.glory.encounter.enemyInjuries = []; },
      s => { s.glory.life.journal.pop(); }, s => { s.glory.bottles[1]!.status = 'PLAYER'; },
      s => { s.divineHand.sourceScene!.character.gender = 'MALE'; }, s => { s.divineHand.sourceHistory!.glory.life.site.playerEnergy++; },
      s => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ];
    for (const mutate of mutations) { const s = promoted(); mutate(s); expect(validateDivineHandState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged payments, event chronology, snapshots, original bottle identity and extra fields', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.cash++; }, s => { s.actionsRemaining++; }, s => { s.spirituality--; },
      s => { journal(s)[0]!.after.cash++; }, s => { journal(s)[0]!.after.actions++; },
      s => { journal(s)[1]!.revision = journal(s)[0]!.revision; }, s => { journal(s)[0]!.week = s.week + 1; },
      s => { s.divineHand.sourceScene!.revision = s.revision + 1; }, s => { s.divineHand.sourceScene!.random.cursor = s.random.cursor + 1; },
      s => { s.divineHand.sourceScene!.finance.weeklyBudget++; }, s => { journal(s).at(-1)!.finance.weeklyBudget++; },
      s => { s.divineHand.bottles[0]!.id = 'divine-hand-potion-2'; },
      s => { s.divineHand.preparations[1]!.taskId = s.divineHand.preparations[0]!.taskId; },
      s => { Object.assign(s.divineHand, { freeSupply: true }); }, s => { Object.assign(journal(s)[0]!, { waivedCost: true }); },
      s => { Object.assign(s.divineHand.sourceScene!.originals, { copiedArmor: 'PLAYER' }); },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); expect(validateDivineHandState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const event = journal(s).at(-1)!, check = event.check!; event.check = { ...check, roll: check.roll === 1 ? 2 : 1 }; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.divineHand.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateDivineHandState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('closes old mutation routes at paid guidance while all old records stay available', () => {
    const s = taught();
    for (const intent of [
      { type: 'GLORY', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'GLORY', command: { type: 'REFLECT' } },
      { type: 'DAWN_PALADIN', command: { type: 'REFLECT' } },
      { type: 'WARRIOR', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalWarriorRoots(s)).toEqual(originalWarriorRoots(originalGlory()));
    expect(validateDivineHandJournalContinuity(s)).toBe(true);
  }, 60_000);
});
