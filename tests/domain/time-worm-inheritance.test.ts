import { describe, expect, it } from 'vitest';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateFateTrojanState } from '../../src/domain/fate-trojan/index.js';
import {
  createTimeWormState, timeWormInheritedView, validateTimeWormSource, validateTimeWormState,
  validateTimeWormAcquisitionJournal, validateTimeWormJournalContinuity,
} from '../../src/domain/time-worm/index.js';
import { originalErrorRoots, originalFateTrojan, prepared, promoted, taught, rejectIntent } from './time-worm-directed-helper.js';

const journal = (s: SliceState) => s.timeWorm.acquisitionJournal;

describe('Time Worm immutable original history and replay evidence', () => {
  it('provides the paid-guidance S2 view to native old validators without mutating current state', () => {
    const s = promoted(), before = structuredClone(s), view = timeWormInheritedView(s), scene = s.timeWorm.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery);
    expect(view.character).toEqual(scene.character); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.week).toBe(scene.week); expect(view.date).toEqual(scene.date); expect(view.timeWorm).toEqual(createTimeWormState());
    expect(originalErrorRoots(view)).toEqual(originalErrorRoots(originalFateTrojan()));
    expect(validateFateTrojanState(view)).toBe(true); expect(s).toEqual(before);
    expect(view.fateTrojan).not.toBe(s.fateTrojan); expect(view.fateTrojan.life.site).not.toBe(s.fateTrojan.life.site);
  }, 60_000);
  it('preserves all consumed and supplier bottles, original bodies and fulfilled obligations', () => {
    const s = promoted(), old = s.timeWorm.sourceHistory!, source = originalFateTrojan();
    for (const key of ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor', 'fateTrojan'] as const) {
      expect(old[key].bottles).toEqual(source[key].bottles);
      expect(old[key].bottles.filter(b => b.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    }
    expect(old.dreamStealer.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
    expect(old.fateTrojan.bottles.slice(1).map(b => [b.status, b.labourSteps, b.acquiredWeek])).toEqual([['SUPPLIER', 0, null], ['SUPPLIER', 0, null]]);
    expect(old.parasite.life.host).toMatchObject({ mode: 'NONE', awareness: 'AWARE', control: 'HOST' });
    expect(old.fateTrojan.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 55 });
    expect(old.fateTrojan.life.site.fate).toMatchObject({ status: 'COMPLETED', paidToPlayer: 12, escrowPennies: 0 });
    expect(old.fateTrojan.life.site.seals.map(seal => seal.charges)).toEqual([0, 0, 1]);
    expect(validateTimeWormSource(s)).toBe(true); expect(validateTimeWormAcquisitionJournal(s)).toBe(true);
  }, 60_000);
  it('rejects identity edits, free old mastery, restored resources and moved original bodies', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.name = '另一个人'; }, s => { s.character.age++; },
      s => { s.character.coreStats.will++; }, s => { s.progression.mastery['error.s5.thought-theft'] = 8; },
      s => { s.fateTrojan.life.site.playerEnergy = 100; }, s => { s.fateTrojan.life.site.lina.energy = 100; },
      s => { s.fateTrojan.life.site.victor.location = 'DESK'; }, s => { s.fateTrojan.life.site.playerLocation = 'DESK'; },
      s => { s.fateTrojan.life.site.playerTravelMetres++; }, s => { s.fateTrojan.life.site.clockSeconds++; },
      s => { s.fateTrojan.life.site.parcel.ordinaryMetres++; }, s => { s.fateTrojan.life.site.parcel.location = 'CABINET'; },
      s => { s.fateTrojan.life.site.fate.paidToPlayer = 0; }, s => { s.fateTrojan.life.site.link.holder = 'PLAYER'; },
      s => { s.fateTrojan.life.site.seals[0]!.charges = 1; }, s => { s.fateTrojan.life.site.seals[2]!.location = 'PLAYER'; },
      s => { s.parasite.life.host.control = 'BOUNDED_TOKEN_TASK'; }, s => { s.parasite.life.thought.targetPaused = true; },
      s => { s.parasite.encounter.enemyHealth = 100; }, s => { s.fateTrojan.encounter.enemySpirituality = 120; },
      s => { s.deceitMentor.life.lamp.oil++; }, s => { s.deceitMentor.life.candle.remaining++; },
      s => { s.fateTrojan.life.journal.pop(); }, s => { s.fateTrojan.bottles[1]!.status = 'PLAYER'; },
      s => { s.timeWorm.sourceScene!.character.gender = 'MALE'; }, s => { s.timeWorm.sourceHistory!.fateTrojan.life.site.playerEnergy++; },
      s => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ];
    for (const mutate of mutations) { const s = promoted(); mutate(s); expect(validateTimeWormState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged payments, event chronology, snapshots, original bottle identity and extra fields', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.cash++; }, s => { s.actionsRemaining++; }, s => { s.spirituality--; },
      s => { journal(s)[0]!.after.cash++; }, s => { journal(s)[0]!.after.actions++; },
      s => { journal(s)[1]!.revision = journal(s)[0]!.revision; }, s => { journal(s)[0]!.week = s.week + 1; },
      s => { s.timeWorm.sourceScene!.revision = s.revision + 1; }, s => { s.timeWorm.sourceScene!.random.cursor = s.random.cursor + 1; },
      s => { s.timeWorm.sourceScene!.finance.weeklyBudget++; }, s => { journal(s).at(-1)!.finance.weeklyBudget++; },
      s => { s.timeWorm.bottles[0]!.id = 'time-worm-potion-2'; },
      s => { s.timeWorm.preparations[1]!.taskId = s.timeWorm.preparations[0]!.taskId; },
      s => { Object.assign(s.timeWorm, { freeSupply: true }); }, s => { Object.assign(journal(s)[0]!, { waivedCost: true }); },
      s => { Object.assign(s.timeWorm.sourceScene!.originals, { copiedParcel: 'PLAYER' }); },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); expect(validateTimeWormState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const event = journal(s).at(-1)!, check = event.check!; event.check = { ...check, roll: check.roll === 1 ? 2 : 1 }; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.timeWorm.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateTimeWormState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('closes old mutation routes at paid guidance while all old records stay available', () => {
    const s = taught();
    for (const intent of [
      { type: 'FATE_TROJAN', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'FATE_TROJAN', command: { type: 'REFLECT' } },
      { type: 'FIRE_THIEF', command: { type: 'REFLECT' } },
      { type: 'MARAUDER', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalErrorRoots(s)).toEqual(originalErrorRoots(originalFateTrojan()));
    expect(validateTimeWormJournalContinuity(s)).toBe(true);
  }, 60_000);
});
