import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection, type SliceCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createApocalypseDemonessState, apocalypseDemonessInheritedView, validateApocalypseDemonessAcquisitionJournal, validateApocalypseDemonessJournalContinuity, validateApocalypseDemonessSource, validateApocalypseDemonessState } from '../../src/domain/apocalypse-demoness/index.js';
import { APOCALYPSE_DEMONESS_ABILITY_IDS, APOCALYPSE_DEMONESS_SOURCE_KEYS } from '../../src/domain/apocalypse-demoness/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalCalamity, calamityNaturalPath, originalDemonessRoots, prepared, promoted, taught, rejectIntent } from './apocalypse-demoness-directed-helper.js';
import { validateCalamityDemonessState } from '../../src/domain/calamity-demoness/index.js';
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Apocalypse Demoness current format and genuine original continuity', () => {
  it('preserves every original174 field and initializes only genuinely missing roots', () => {
    const old = readObjectEntry<Record<string, unknown>>(calamityNaturalPath, 'final'), bytes = stableStringify(old), s = migrateSliceState(old);
    const creation = sliceDefaultCreationSelection;
    const defaults = createSliceRun(s.runId, creation, s.random.seed) as unknown as Record<string, unknown>, current = s as unknown as Record<string, unknown>;
    const added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k)); expect(added).toContain('apocalypseDemoness');
    expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const k of Object.keys(old)) if (k !== 'schemaVersion' && k !== 'contentVersion') same(current[k], old[k]);
    for (const k of added) same(current[k], defaults[k]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.apocalypseDemoness, createApocalypseDemonessState()); same(migrateSliceState(s), s); expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 60_000);
  it('retains18 real skills, seven zeroes and the actual spent sources and two scene checkpoints', () => {
    const s = originalCalamity(), raw = readObjectEntry<SliceState>(calamityNaturalPath, 'final');
    expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(Object.values(s.progression.mastery).filter(x => x === 0)).toHaveLength(7);
    for (const id of APOCALYPSE_DEMONESS_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of APOCALYPSE_DEMONESS_SOURCE_KEYS) same(s[key], raw[key]);
    const site = s.calamityDemoness.encounter.currentSite!;
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 22, clockSeconds: 407, playerTravelMetres: 78 });
    expect(s.calamityDemoness.life.site).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28, clockSeconds: 217, playerTravelMetres: 72 });
    expect(site.load).toMatchObject({ remainingLoads: 0, appliedLoads: 1 });
    expect(site.residue).toMatchObject({ status: 'CONSUMED' }); expect(site.box).toMatchObject({ state: 'CLOSED', scorched: true, pulses: 1 });
    expect(site.plates.map(p => [p.charges, p.location])).toEqual([[0, 'CUSTODIAN'], [0, 'CUSTODIAN'], [1, 'CUSTODIAN']]);
    expect(s.calamityDemoness.encounter.plate).toMatchObject({ id: 'CD2-COMBAT-PLATE', charges: 3, location: 'PLAYER' });
    same(s.injuries, raw.injuries); same(s.combatHistory, raw.combatHistory); same(s.character, raw.character);
    expect(s.health).toBe(70); expect(s.injuryRisk).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 60_000);
  it('fails closed for missing current roots, forged old roots and unknown future formats', () => {
    const raw = readObjectEntry<Record<string, unknown>>(calamityNaturalPath, 'final'), s = originalCalamity();
    const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing.apocalypseDemoness;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...raw, apocalypseDemoness: createApocalypseDemonessState() }, bytes = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(bytes);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 60_000);
  it('requires exact command payload and independent bottle confirmation', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'PREPARE_TASK', taskId: 'PLAN_CONTAINMENT' }, { type: 'CONSUME', bottleId: 'apocalypse-demoness-potion-1', confirmed: true }]) expect(validateSlicePayload({ type: 'APOCALYPSE_DEMONESS', command })).toBe(true);
    for (const command of [{ type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'LOCATE_ANYTHING' }, { type: 'CONSUME', bottleId: 'apocalypse-demoness-potion-1', confirmed: false }, { type: 'CONSUME', bottleId: 'calamity-demoness-potion-2', confirmed: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }]) expect(validateSlicePayload({ type: 'APOCALYPSE_DEMONESS', command })).toBe(false);
  });
});


describe('Apocalypse Demoness exact history and bounded source evidence', () => {
  it('replays the original585 commands from actual creation and seed with exact migrated final equality', () => {
    const raw = readObjectEntry<SliceState>(calamityNaturalPath, 'final');
    const creation = readObjectEntry<SliceCreationSelection>(calamityNaturalPath, 'creation');
    const seed = readObjectEntry<string>(calamityNaturalPath, 'seed');
    const commands = readObjectEntry<SliceIntent[]>(calamityNaturalPath, 'commands');
    let s = createSliceRun(raw.runId, creation, seed);
    same(s, migrateSliceState(readObjectEntry<unknown>(calamityNaturalPath, 'initial')));
    expect(commands).toHaveLength(585);
    for (const [index, intent] of commands.entries()) {
      const before = s; s = applySliceIntent(s, intent);
      expect(s.revision, `original command ${index + 1}`).toBe(before.revision + 1);
      expect(s.random.seed).toBe(seed); expect(s.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    }
    same(s, migrateSliceState(raw)); assertValidSliceState(s);
  }, 240_000);
  it('provides the genuine paid-guidance S2 read-only view without changing any current original', () => {
    const s = promoted(), before = structuredClone(s), view = apocalypseDemonessInheritedView(s), scene = s.apocalypseDemoness.sourceScene!;
    expect(view.progression.sequence).toBe(2); same(view.progression.mastery, scene.budget.mastery);
    same(view.character, scene.character); same(view.random, scene.random); expect(view.revision).toBe(scene.revision);
    expect(view.week).toBe(scene.week); same(view.date, scene.date); same(view.apocalypseDemoness, createApocalypseDemonessState());
    same(originalDemonessRoots(view), originalDemonessRoots(originalCalamity()));
    expect(validateCalamityDemonessState(view)).toBe(true); same(s, before);
    expect(view.calamityDemoness).not.toBe(s.calamityDemoness);
    expect(view.calamityDemoness.encounter.currentSite).not.toBe(s.calamityDemoness.encounter.currentSite);
  }, 60_000);
  it('preserves old deaths, surrenders, original Iris and all18 actual mastery entries', () => {
    const s = promoted(), source = originalCalamity(), history = s.apocalypseDemoness.sourceHistory!;
    for (const key of APOCALYPSE_DEMONESS_SOURCE_KEYS) same(history[key], source[key]);
    expect(history.calamityDemoness.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyPosition: 'YARD', plate: { charges: 3 } });
    expect(history.calamityDemoness.encounter.enemyInjuries).toEqual([]);
    expect(history.calamityDemoness.encounter.currentSite!.load).toMatchObject({ remainingLoads: 0, appliedLoads: 1 });
    expect(history.calamityDemoness.encounter.currentSite!.residue).toMatchObject({ status: 'CONSUMED' });
    expect(history.calamityDemoness.life.site.playerLocation).toBe('ENTRY');
    expect(history.calamityDemoness.encounter.currentSite!.playerLocation).toBe('OUTSIDE');
    expect(s.apocalypseDemoness.life.site).toEqual(history.calamityDemoness.encounter.currentSite);
    expect(s.apocalypseDemoness.life.site).not.toBe(history.calamityDemoness.encounter.currentSite);
    expect(validateApocalypseDemonessSource(s)).toBe(true); expect(validateApocalypseDemonessAcquisitionJournal(s)).toBe(true);
  }, 60_000);
  it('rejects edited identity, free old mastery, refilled original resources and historical-site substitution', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.name = '另一个人'; }, s => { s.character.age++; },
      s => { s.character.coreStats.will++; }, s => { s.progression.mastery['assassin.s7.frost'] = 8; },
      s => { s.calamityDemoness.encounter.currentSite!.playerEnergy = 100; },
      s => { s.calamityDemoness.encounter.currentSite!.vera!.energy = 100; },
      s => { s.calamityDemoness.encounter.currentSite!.marcus!.location = 'ENTRY'; },
      s => { s.calamityDemoness.life.site.playerLocation = 'OUTSIDE'; },
      s => { s.calamityDemoness.encounter.currentSite = structuredClone(s.calamityDemoness.life.site); },
      s => { s.apocalypseDemoness.sourceScene!.originals.site = structuredClone(s.calamityDemoness.life.site); },
      s => { s.calamityDemoness.encounter.currentSite!.playerTravelMetres++; },
      s => { s.calamityDemoness.encounter.currentSite!.clockSeconds++; },
      s => { s.calamityDemoness.encounter.currentSite!.load.remainingLoads = 1; },
      s => { s.calamityDemoness.encounter.currentSite!.residue!.status = 'CONTAINED'; },
      s => { s.calamityDemoness.encounter.currentSite!.plates[0]!.charges = 1; },
      s => { s.calamityDemoness.encounter.currentSite!.plates[2]!.location = 'PLAYER'; },
      s => { s.calamityDemoness.encounter.plate!.charges = 2; },
      s => { s.calamityDemoness.encounter.enemyHealth = 99; },
      s => { s.calamityDemoness.encounter.enemySpirituality = 120; },
      s => { s.calamityDemoness.encounter.weaponLocation = 'YARD'; },
      s => { s.calamityDemoness.life.journal.pop(); },
      s => { s.apocalypseDemoness.sourceScene!.character.gender = 'MALE'; },
      s => { s.apocalypseDemoness.sourceHistory!.calamityDemoness.encounter.currentSite!.playerEnergy++; },
      s => { s.apocalypseDemoness.acquisitionJournal.at(-1)!.after.gender = 'MALE'; },
    ];
    for (const mutate of mutations) { const s = promoted(); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('rejects forged payment, chronology, finance, source hashes, bottle identity and extra fields', () => {
    const journal = (s: SliceState) => s.apocalypseDemoness.acquisitionJournal;
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.cash++; }, s => { s.actionsRemaining++; }, s => { s.spirituality--; },
      s => { journal(s)[0]!.after.cash++; }, s => { journal(s)[0]!.after.actions++; },
      s => { journal(s)[1]!.revision = journal(s)[0]!.revision; }, s => { journal(s)[0]!.week = s.week + 1; },
      s => { s.apocalypseDemoness.sourceScene!.revision = s.revision + 1; },
      s => { s.apocalypseDemoness.sourceScene!.random.cursor = s.random.cursor + 1; },
      s => { s.apocalypseDemoness.sourceScene!.finance.weeklyBudget++; }, s => { journal(s).at(-1)!.finance.weeklyBudget++; },
      s => { s.apocalypseDemoness.sourceScene!.historyDigest = '0'.repeat(64); },
      s => { s.apocalypseDemoness.sourceScene!.combatHistoryDigest = '0'.repeat(64); },
      s => { s.apocalypseDemoness.bottles[0]!.id = 'apocalypse-demoness-potion-2'; },
      s => { s.apocalypseDemoness.preparations[1]!.taskId = s.apocalypseDemoness.preparations[0]!.taskId; },
      s => { Object.assign(s.apocalypseDemoness, { freeSupply: true }); },
      s => { Object.assign(journal(s)[0]!, { waivedCost: true }); },
      s => { Object.assign(s.apocalypseDemoness.sourceScene!.originals, { copiedMirror: 'PLAYER' }); },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { const event = journal(s).at(-1)!, check = event.check!; event.check = { ...check, roll: check.roll === 1 ? 2 : 1 }; },
      (s: SliceState) => { const e = journal(s).at(-1)!; e.randomAfter = e.randomAfter! + 1; },
      (s: SliceState) => { s.apocalypseDemoness.bottles.find(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')!.status = 'PLAYER'; },
    ]) { const s = promoted(); mutate(s); expect(validateApocalypseDemonessState(s), mutate.toString()).toBe(false); }
  }, 60_000);
  it('keeps old actions closed after guidance and at S1 while historical validators remain readable', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'CALAMITY_DEMONESS', command: { type: 'ENCOUNTER_TALK' } },
        { type: 'CALAMITY_DEMONESS', command: { type: 'REFLECT' } },
        { type: 'UNAGING_DEMONESS', command: { type: 'REFLECT' } },
        { type: 'ASSASSIN', command: { type: 'REFLECT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      same(originalDemonessRoots(s), originalDemonessRoots(originalCalamity()));
      expect(validateApocalypseDemonessJournalContinuity(s)).toBe(true);
    }
  }, 60_000);
});
