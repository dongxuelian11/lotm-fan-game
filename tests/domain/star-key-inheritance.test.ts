import { describe, expect, it } from 'vitest';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validatePlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import {
  createStarKeyState, starKeyInheritedView, validateStarKeySource, validateStarKeyState,
  validateStarKeyAcquisitionJournal, validateStarKeyJournalContinuity,
} from '../../src/domain/star-key/index.js';
import { originalDoorRoots, originalPlaneswalker, prepared, promoted, taught, rejectIntent } from './star-key-directed-helper.js';

const journal = (s: SliceState) => s.starKey.acquisitionJournal;

describe('Star Key immutable original history and replay evidence', () => {
  it('provides the paid-guidance S2 view to native old validators without mutating current state', () => {
    const s = promoted(), before = structuredClone(s), view = starKeyInheritedView(s), scene = s.starKey.sourceScene!;
    expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(scene.budget.mastery);
    expect(view.character).toEqual(scene.character); expect(view.random).toEqual(scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.week).toBe(scene.week); expect(view.date).toEqual(scene.date); expect(view.starKey).toEqual(createStarKeyState());
    expect(originalDoorRoots(view)).toEqual(originalDoorRoots(originalPlaneswalker()));
    expect(validatePlaneswalkerState(view)).toBe(true); expect(s).toEqual(before);
    expect(view.planeswalker).not.toBe(s.planeswalker); expect(view.planeswalker.life.site).not.toBe(s.planeswalker.life.site);
  }, 60_000);
  it('preserves the real brewed S8 bottles rather than inventing finished-potion timestamps', () => {
    const s = promoted(), old = s.starKey.sourceHistory!.trickmaster;
    expect(old.formulaKnown).toBe(true); expect(old.bottles.length).toBeGreaterThan(0);
    for (const b of old.bottles) {
      expect(b.brewedWeek).toBeGreaterThan(0); expect(b).not.toHaveProperty('acquiredWeek'); expect(b).not.toHaveProperty('consumedWeek');
      expect(b.inputIds).toEqual(old.batches.find(batch => batch.id === b.batchId)!.materials.map(m => m.id));
    }
    expect(validateStarKeySource(s)).toBe(true); expect(validateStarKeyAcquisitionJournal(s)).toBe(true);
  }, 60_000);
  it('rejects identity edits, free old mastery, restored resources and moved original bodies', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.name = '另一个人'; }, s => { s.character.age++; },
      s => { s.character.coreStats.will++; }, s => { s.progression.mastery['door.s5.invisible-hand'] = 8; },
      s => { s.wanderer.life.energy.remaining++; }, s => { s.wanderer.life.packet.location = 'PLAYER'; },
      s => { s.planeswalker.life.site.lamp.oilRemaining++; }, s => { s.planeswalker.life.site.operatorEnergy = 100; },
      s => { s.planeswalker.life.site.operatorConsent = 'GRANTED'; }, s => { s.planeswalker.life.site.operatorConsentWeek = s.week; },
      s => { s.planeswalker.life.site.playerMetres++; }, s => { s.planeswalker.life.site.elapsedSeconds++; },
      s => { s.planeswalker.life.site.parcel.ordinaryMetres++; }, s => { s.planeswalker.life.site.parcel.location = 'PLAYER'; },
      s => { s.planeswalker.life.site.kits['symbolic-transit'].protectionSeconds = 90; },
      s => { s.secretsSorcerer.life.banishment.restrained = true; }, s => { s.secretsSorcerer.life.banishment.returns++; },
      s => { s.planeswalker.life.journal.pop(); }, s => { s.trickmaster.batches[0]!.materials[0]!.quantity++; },
      s => { s.starKey.sourceScene!.character.gender = 'MALE'; }, s => { s.starKey.sourceHistory!.planeswalker.life.site.operatorEnergy++; },
      s => { journal(s).at(-1)!.after.gender = 'MALE'; },
    ];
    for (const mutate of mutations) { const s = promoted(); mutate(s); expect(validateStarKeyState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged payments, event chronology, snapshots, original bottle identity and extra fields', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.cash++; }, s => { s.actionsRemaining++; }, s => { s.spirituality--; },
      s => { journal(s)[0]!.after.cash++; }, s => { journal(s)[0]!.after.actions++; },
      s => { journal(s)[1]!.revision = journal(s)[0]!.revision; }, s => { journal(s)[0]!.week = s.week + 1; },
      s => { s.starKey.sourceScene!.revision = s.revision + 1; }, s => { s.starKey.sourceScene!.random.cursor = s.random.cursor + 1; },
      s => { s.starKey.sourceScene!.finance.weeklyBudget++; }, s => { journal(s).at(-1)!.finance.weeklyBudget++; },
      s => { s.starKey.bottles[0]!.id = 'star-key-potion-2'; },
      s => { s.starKey.preparations[1]!.taskId = s.starKey.preparations[0]!.taskId; },
      s => { Object.assign(s.starKey, { freeSupply: true }); }, s => { Object.assign(journal(s)[0]!, { waivedCost: true }); },
      s => { Object.assign(s.starKey.sourceScene!.originals, { remoteParcel: 'LOCAL' }); },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); expect(validateStarKeyState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const check = journal(s).at(-1)!.check!; check.roll = check.roll === 1 ? 2 : 1; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.starKey.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateStarKeyState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('closes old mutation routes at paid guidance while all old records stay available', () => {
    const s = taught();
    for (const intent of [
      { type: 'PLANESWALKER', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'PLANESWALKER', command: { type: 'REFLECT' } },
      { type: 'RECORDER', command: { type: 'RECORD', sample: 'FLASH' } },
      { type: 'APPRENTICE', command: { type: 'REFLECT' } },
    ] as SliceIntent[]) rejectIntent(s, intent);
    expect(originalDoorRoots(s)).toEqual(originalDoorRoots(originalPlaneswalker()));
    expect(validateStarKeyJournalContinuity(s)).toBe(true);
  }, 60_000);
});
