import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createAncientEvilState } from '../../src/domain/ancient-evil/index.js';
import { ANCIENT_EVIL_ABILITY_IDS } from '../../src/domain/ancient-evil/types.js';
import { validatePrisonerState } from '../../src/domain/prisoner/index.js';
import { validateMadmanState } from '../../src/domain/madman/index.js';
import { validateWerewolfState } from '../../src/domain/werewolf/index.js';
import { validateZombieState } from '../../src/domain/zombie/index.js';
import { validateWraithState } from '../../src/domain/wraith/index.js';
import { validatePuppetState } from '../../src/domain/puppet/index.js';
import { hasSilentDiscipleLock, hasSilentDiscipleRitualLock, isSilentDisciple, validateSilentDiscipleState } from '../../src/domain/silent-disciple/index.js';
import { hasSilentDiscipleLifeLock, validateSilentDiscipleLife, validateSilentDiscipleLifeOriginal } from '../../src/domain/silent-disciple/life.js';
import { hasSilentDiscipleEncounterLock } from '../../src/domain/silent-disciple/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { chainedLegacyKeys, silentDiscipleNaturalPath, originalSilentDisciple, promoted, ae, rejectIntent, rejectAncientEvil } from './ancient-evil-directed-helper.js';

const validators = [validatePrisonerState, validateMadmanState, validateWerewolfState, validateZombieState, validateWraithState, validatePuppetState, validateSilentDiscipleState];
const legacyMastery = (s: SliceState) => Object.fromEntries(Object.entries(s.progression.mastery).filter(([id]) => !ANCIENT_EVIL_ABILITY_IDS.includes(id as typeof ANCIENT_EVIL_ABILITY_IDS[number])));

function preservedOldRecords(s: SliceState, old: SliceState): void {
  for (const key of chainedLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.injuries).toEqual(old.injuries); expect(s.injuryRisk).toBe(old.injuryRisk);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
}

describe('Ancient Evil inherited Chained originals and immutable history', () => {
  it('replays all 507 actual public source commands and migrates the exact living W119 ending', () => {
    const old = readObjectEntry<SliceState>(silentDiscipleNaturalPath, 'final'), bytes = JSON.stringify(old);
    const commands = readObjectEntry<SliceIntent[]>(silentDiscipleNaturalPath, 'commands');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(silentDiscipleNaturalPath, 'creation');
    const seed = readObjectEntry<string>(silentDiscipleNaturalPath, 'seed');
    expect(commands).toHaveLength(507); expect(old.schemaVersion).toBe(155); expect(old.contentVersion).toBe('silent-disciple-v155');
    let replay = createSliceRun(old.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    const s = originalSilentDisciple(); expect(replay).toEqual(s); preservedOldRecords(s, old);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, revision: 508, week: 119, status: 'ACTIVE', health: 100, mind: 99, spirituality: 116, cash: 360, actionsRemaining: 3,
      progression: { pathwayId: 'chained', sequence: 3, acting: 100 }, random: { seed: 'prisoner-natural-v057', cursor: 206 }, injuryRisk: 0 });
    expect(s.injuries).toEqual([{ id: 'prisoner-rebuild-natural:combat:1:PLAYER:406:0', severity: 'HEAVY', acquiredRevision: 406, treatedRevision: null }]);
    expect(s.silentDisciple.promotionWeek).toBe(110); expect(s.silentDisciple.life.moon.status).toBe('RESOLVED');
    expect(s.silentDisciple.encounter).toMatchObject({ targetId: 'SD3-CALDER', status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemySpirituality: 116 });
    expect(s.silentDisciple.encounter.blocks.map(b => [b.id, b.status, b.location])).toEqual([
      ['SD3-BLOCK-1', 'READY', 'SOURCE'], ['SD3-BLOCK-2', 'READY', 'SOURCE'], ['SD3-BLOCK-3', 'READY', 'SOURCE'],
    ]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(s.ancientEvil).toEqual(createAncientEvilState());
    expect(migrateSliceState(s)).toEqual(s); expect(JSON.stringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);

  it('directed UNIT promotion retains all seven roots and all 17 exact masteries, adding only two zero IDs', () => {
    const old = originalSilentDisciple(), s = promoted(); preservedOldRecords(s, old);
    expect(legacyMastery(s)).toEqual(old.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...ANCIENT_EVIL_ABILITY_IDS]);
    for (const id of ANCIENT_EVIL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ['chained.s7.toxic-claws', 'chained.s6.steel-body', 'chained.s6.death-craft', 'chained.s5.spirit-possession']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression.acting).toBe(0); expect(s.ancientEvil.silentDiscipleActingAtPromotion).toBe(100);
    expect(validators.map(validate => validate(s))).toEqual(validators.map(() => true)); assertValidSliceState(s);
  });

  it('directed UNIT S2 projects stored old acting and original Calder while all S3 actions stay closed', () => {
    const s = promoted(), view = projectSliceState(s); expect(isSilentDisciple(s)).toBe(false);
    for (const key of chainedLegacyKeys) expect(view[key].acting, key).toBe(100);
    expect(view.silentDisciple.actions).toEqual([]); expect(view.silentDisciple.life.actions).toEqual([]); expect(view.silentDisciple.encounter.actions).toEqual([]);
    expect(view.silentDisciple.encounter.enemy).toMatchObject({ id: 'SD3-CALDER', status: 'SURRENDERED', health: 70 });
    expect(view.silentDisciple.insideCase).toBe(false); expect(hasSilentDiscipleLock(s)).toBe(false);
  });

  it('directed UNIT S2 cannot reopen old cases, restock original bottles, repeat reports or erase old moon consequences', () => {
    const s = promoted();
    const intents: SliceIntent[] = [
      { type: 'PRISONER', command: { type: 'REFLECT' } }, { type: 'MADMAN', command: { type: 'REFLECT' } },
      { type: 'WEREWOLF', command: { type: 'REFLECT' } }, { type: 'ZOMBIE', command: { type: 'REFLECT' } },
      { type: 'WRAITH', command: { type: 'REFLECT' } }, { type: 'PUPPET', command: { type: 'REFLECT' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'REFLECT' } }, { type: 'SILENT_DISCIPLE', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'POTION_WORK', bottleId: 'silent-disciple-potion-2' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'BUY_POTION', bottleId: 'silent-disciple-potion-2' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'REQUEST_SUPPLY' } }, { type: 'SILENT_DISCIPLE', command: { type: 'RECEIVE_SUPPLY' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'BUY_BLOCKS' } }, { type: 'SILENT_DISCIPLE', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'ENCOUNTER_FIGHT' } }, { type: 'SILENT_DISCIPLE', command: { type: 'READ_MOON_NOTICE' } },
      { type: 'SILENT_DISCIPLE', command: { type: 'GUIDED_REST' } }, { type: 'SILENT_DISCIPLE', command: { type: 'WAIT_MOON' } },
      { type: 'WEREWOLF', command: { type: 'HANDLE_MOON', method: 'GUARDED' } },
      { type: 'ZOMBIE', command: { type: 'HANDLE_MOON', method: 'GUARDED' } },
      { type: 'WRAITH', command: { type: 'HANDLE_MOON', method: 'GUARDED' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
    preservedOldRecords(s, originalSilentDisciple());
  });

  it('keeps original S3 physical locks strict and never treats a bare sequence label as actual S2 promotion', () => {
    const old = originalSilentDisciple(); old.silentDisciple.life.playerLocation = 'A';
    expect(hasSilentDiscipleLifeLock(old)).toBe(true); expect(hasSilentDiscipleLock(old)).toBe(true);
    expect(validateSilentDiscipleLifeOriginal(old)).toBe(false); expect(validateSilentDiscipleLife(old)).toBe(false);
    old.progression.sequence = 2;
    expect(old.ancientEvil.promotionWeek).toBeNull(); expect(hasSilentDiscipleLifeLock(old)).toBe(true);
    old.silentDisciple.preparedWeek = old.week; old.silentDisciple.encounter.status = 'READY';
    expect(hasSilentDiscipleRitualLock(old)).toBe(true); expect(hasSilentDiscipleEncounterLock(old)).toBe(true);
    expect(() => assertValidSliceState(old)).toThrow();
  });

  it('rejects unlogged physical movement or new form in both raw original and directed UNIT S2 rooms', () => {
    for (const source of [originalSilentDisciple(), promoted()]) for (const mutate of [
      (s: SliceState) => { s.silentDisciple.life.volunteer.location = 'OUTSIDE'; },
      (s: SliceState) => { s.silentDisciple.life.guide.location = 'OUTSIDE'; },
      (s: SliceState) => { s.silentDisciple.life.volunteer.form = 'RABBIT'; },
      (s: SliceState) => { s.silentDisciple.life.playerTravelMetres += 4; s.silentDisciple.life.clockSeconds += 4; },
      (s: SliceState) => { s.silentDisciple.life.clothing.location = 'TRAY'; s.silentDisciple.life.clothing.worn = false; },
    ]) {
      const s = structuredClone(source); mutate(s);
      expect(validateSilentDiscipleLifeOriginal(s)).toBe(false); expect(validateSilentDiscipleLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
    }
  });

  it('directed UNIT S2 rejects missing, extra or silently boosted inherited skills and forged stored acting', () => {
    const source = promoted();
    for (const mutate of [
      (s: SliceState) => { delete s.progression.mastery['chained.s7.toxic-claws']; },
      (s: SliceState) => { s.progression.mastery['chained.s1.unsupported'] = 0; },
      (s: SliceState) => { s.progression.mastery['chained.s6.steel-body'] = 1; },
      (s: SliceState) => { s.ancientEvil.silentDiscipleActingAtPromotion = 0; },
      (s: SliceState) => { s.silentDisciple.puppetActingAtPromotion = 0; },
      (s: SliceState) => { s.ancientEvil.promotionWeek = null; },
    ]) { const s = structuredClone(source); mutate(s); expect(() => assertValidSliceState(s)).toThrow(); }
  });

  it('preserves a directed actual old S3 fatal round, earned Zombie history and the terminal prohibition on promotion', () => {
    const before = migrateSliceState(readObjectEntry<SliceState>(silentDiscipleNaturalPath, 'combatStart'));
    before.random.cursor = 3; // Explicit UNIT-only cursor before an actual public combat round.
    const dead = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' });
    expect(dead.status).toBe('DEAD'); expect(dead.health).toBe(0); expect(dead.ending?.kind).toBe('DEATH');
    expect(dead.zombie).toEqual(before.zombie); expect(dead.seer.completedSources).toContain('zombie-dispute');
    const saved = JSON.parse(JSON.stringify(dead)), restored = migrateSliceState(saved);
    expect(restored).toEqual(dead); expect(restored.ancientEvil).toEqual(createAncientEvilState()); assertValidSliceState(restored);
    rejectAncientEvil(restored, { type: 'LEARN_GUIDANCE' }); rejectIntent(restored, { type: 'SILENT_DISCIPLE', command: { type: 'PREPARE_PROMOTION' } });
  });

  it('directed UNIT continuation walks the same original room without S3 lock interception or editing old cases', () => {
    let s = promoted(); const before = structuredClone(s), original = structuredClone(s.silentDisciple.life), oldMastery = legacyMastery(s), caseId = 'lasting-form' as const;
    s = ae(s, { type: 'OBSERVE', caseId }); s = ae(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
    s = ae(s, { type: 'WALK', caseId, to: 'A' });
    expect(s.silentDisciple.life.playerLocation).toBe('A'); expect(s.silentDisciple.life.playerTravelMetres).toBe(original.playerTravelMetres + 4);
    const view = projectSliceState(s); expect(view.silentDisciple.insideCase).toBe(false); expect(view.silentDisciple.life.insideCase).toBe(false); expect(view.ancientEvil.life.insideCase).toBe(true);
    expect(hasSilentDiscipleLifeLock(s)).toBe(false); expect(hasSilentDiscipleLock(s)).toBe(false);
    expect(validateSilentDiscipleLifeOriginal(s)).toBe(false); expect(validateSilentDiscipleLife(s)).toBe(true);
    rejectIntent(s, { type: 'ACTION', action: 'WORK' }); rejectIntent(s, { type: 'SILENT_DISCIPLE', command: { type: 'RETURN_A', caseId: 'original-body' } });
    s = ae(s, { type: 'READ_IDENTITY', caseId }); s = ae(s, { type: 'WALK', caseId, to: 'B' }); s = ae(s, { type: 'READ_NOTE', caseId });
    s = ae(s, { type: 'WALK', caseId, to: 'A' }); s = ae(s, { type: 'COMPARE_IDENTITY', caseId }); s = ae(s, { type: 'MANUAL_OPERATION', caseId });
    s = ae(s, { type: 'WALK', caseId, to: 'START' });
    for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = ae(s, { type, caseId });
    expect(s.ancientEvil.life.source?.snapshot).toEqual(original); expect(s.silentDisciple.life.playerTravelMetres).toBe(original.playerTravelMetres + 16);
    for (const key of ['cases', 'note', 'moon', 'volunteer', 'guide', 'clothing', 'bag', 'tray'] as const) expect(s.silentDisciple.life[key], key).toEqual(original[key]);
    for (const key of chainedLegacyKeys.filter(key => key !== 'silentDisciple')) expect(s[key], key).toEqual(before[key]);
    expect(s.silentDisciple.encounter).toEqual(before.silentDisciple.encounter); expect(s.silentDisciple.bottles).toEqual(before.silentDisciple.bottles);
    expect(s.injuries).toEqual(before.injuries); expect(legacyMastery(s)).toEqual(oldMastery);
    expect(validateSilentDiscipleLifeOriginal(s)).toBe(false); expect(validateSilentDiscipleLife(s)).toBe(true); assertValidSliceState(s);
    for (const mutate of [
      (state: SliceState) => { state.silentDisciple.life.playerTravelMetres++; },
      (state: SliceState) => { state.silentDisciple.life.note.records[0]!.text += ' fabricated'; },
      (state: SliceState) => { state.ancientEvil.life.journal.find(event => event.command.type === 'WALK')!.command = { type: 'WALK', caseId, to: 'B' }; },
      (state: SliceState) => {
        const source = state.ancientEvil.life.source!; source.snapshot.cases['original-body'].attempts[0]!.elapsedSeconds++;
        state.ancientEvil.life.journal[0]!.inheritedScene = structuredClone(source);
      },
    ]) { const forged = structuredClone(s); mutate(forged); expect(validateSilentDiscipleLife(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow(); }
  });

});
