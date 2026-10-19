import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBarrenMatriarchState, hasBarrenMatriarchOldPractice, validateBarrenMatriarchAcquisitionJournal, validateBarrenMatriarchState } from '../../src/domain/barren-matriarch/index.js';
import { BARREN_MATRIARCH_ABILITY_IDS } from '../../src/domain/barren-matriarch/types.js';
import { validateCultivatorState } from '../../src/domain/cultivator/index.js';
import { validatePhysicianState } from '../../src/domain/physician/index.js';
import { validateHarvestpriestState } from '../../src/domain/harvestpriest/index.js';
import { validateBiologistState } from '../../src/domain/biologist/index.js';
import { validateDruidState } from '../../src/domain/druid/index.js';
import { validateAncientAlchemistState } from '../../src/domain/ancient-alchemist/index.js';
import { hasCoffinBearerLock, hasCoffinBearerRitualLock, isCoffinBearer, validateCoffinBearerState } from '../../src/domain/coffin-bearer/index.js';
import { hasCoffinBearerLifeLock, validateCoffinBearerLife } from '../../src/domain/coffin-bearer/life.js';
import { hasCoffinBearerEncounterLock } from '../../src/domain/coffin-bearer/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { motherLegacyKeys, coffinBearerNaturalPath, originalCoffinBearer, promoted, rejectIntent } from './barren-matriarch-directed-helper.js';

const validators = [validateCultivatorState, validatePhysicianState, validateHarvestpriestState, validateBiologistState, validateDruidState, validateAncientAlchemistState, validateCoffinBearerState];
const legacyMastery = (s: SliceState) => Object.fromEntries(Object.entries(s.progression.mastery).filter(([id]) => !BARREN_MATRIARCH_ABILITY_IDS.includes(id as typeof BARREN_MATRIARCH_ABILITY_IDS[number])));
function preserved(s: SliceState, old: SliceState): void {
  for (const key of motherLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.injuries).toEqual(old.injuries); expect(s.injuryRisk).toBe(old.injuryRisk);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
  expect(s.character.appearanceDescription).toBe(old.character.appearanceDescription);
}

describe('BarrenMatriarch inherits the complete674-command original Mother campaign', () => {
  it('replays every original command and retains the real wounds, live samples, dry sample and Nolan surrender', () => {
    const original = readObjectEntry<SliceState>(coffinBearerNaturalPath, 'final'), bytes = JSON.stringify(original), s = originalCoffinBearer();
    expect(readObjectEntry<SliceIntent[]>(coffinBearerNaturalPath, 'commands')).toHaveLength(674);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, revision: 675, week: 174,
      status: 'ACTIVE', health: 50, mind: 100, spirituality: 116, cash: 335, actionsRemaining: 3, injuryRisk: 5,
      character: { gender: 'FEMALE' }, progression: { pathwayId: 'mother', sequence: 3, acting: 100 }, random: { seed: 'cultivator-natural-v069', cursor: 208 } });
    expect(s.coffinBearer.promotionWeek).toBe(165); expect(s.coffinBearer.life.reflected).toBe(true);
    expect(s.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CB3-NOLAN', enemyStatus: 'SURRENDERED', enemyHealth: 50, enemyMind: 100, enemySpirituality: 67 });
    expect(s.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[131, 'HEAVY', null], [671, 'LIGHT', null], [672, 'HEAVY', null], [673, 'LIGHT', null]]);
    expect(s.coffinBearer.life.owner).toMatchObject({ id: 'CB3-ADA', name: '艾达·芬恩', age: 46, alive: true, independentMind: true });
    expect(s.coffinBearer.life.recipient).toMatchObject({ id: 'CB3-LENA', name: '莉娜·肖', age: 39, alive: true, independentMind: true });
    expect(s.coffinBearer.life.samples.find(sample => sample.id === 'CB3-DRY-1')).toMatchObject({ alive: false, vitality: 0, quantity: 1 });
    expect(s.barrenMatriarch).toEqual(createBarrenMatriarchState()); expect(migrateSliceState(s)).toEqual(s); expect(s).toEqual(migrateSliceState(original));
    expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);
  it('adds precisely two zero-mastered abilities while every one of the actual13 old weights remains', () => {
    const old = originalCoffinBearer(), s = promoted(); preserved(s, old);
    expect(legacyMastery(s)).toEqual(old.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(15);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...BARREN_MATRIARCH_ABILITY_IDS]);
    for (const id of BARREN_MATRIARCH_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ['mother.s8.condition-observation', 'mother.s6.specimen-study', 'mother.s5.ground-passage']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression.acting).toBe(0); expect(s.barrenMatriarch.coffinBearerActingAtPromotion).toBe(100);
    expect(validators.map(validate => validate(s))).toEqual(validators.map(() => true)); assertValidSliceState(s);
  });
  it('shows the real stored digestion and wounds while predecessor commands stay closed', () => {
    const s = promoted(), view = projectSliceState(s); expect(isCoffinBearer(s)).toBe(false);
    for (const key of motherLegacyKeys) expect(view[key].acting, key).toBe(100);
    expect(view.coffinBearer.actions).toEqual([]); expect(view.coffinBearer.life.actions).toEqual([]); expect(view.coffinBearer.encounter.actions).toEqual([]);
    expect(view.coffinBearer.insideCase).toBe(false); expect(hasCoffinBearerLock(s)).toBe(false);
    expect(view.barrenMatriarch.abilities).toHaveLength(15); expect(view.barrenMatriarch.injuries).toEqual(s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: false })));
    expect(view.barrenMatriarch.inheritedHistory.join(' ')).toContain('原诺兰：已投降');
  });
  it('cannot reopen old cases, restock old originals or replay the surrendered original opponent', () => {
    const s = promoted();
    const intents: SliceIntent[] = [
      ...(['CULTIVATOR', 'PHYSICIAN', 'HARVESTPRIEST', 'BIOLOGIST', 'DRUID', 'ANCIENT_ALCHEMIST', 'COFFIN_BEARER'] as const).map(type => ({ type, command: { type: 'REFLECT' } } as SliceIntent)),
      { type: 'COFFIN_BEARER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'COFFIN_BEARER', command: { type: 'POTION_WORK', bottleId: 'coffin-bearer-potion-3' } },
      { type: 'COFFIN_BEARER', command: { type: 'BUY_POTION', bottleId: 'coffin-bearer-potion-3' } },
      { type: 'COFFIN_BEARER', command: { type: 'REQUEST_SUPPLY' } }, { type: 'COFFIN_BEARER', command: { type: 'RECEIVE_SUPPLY' } },
      { type: 'COFFIN_BEARER', command: { type: 'ENCOUNTER_TALK' } }, { type: 'COFFIN_BEARER', command: { type: 'ENCOUNTER_FIGHT' } },
      { type: 'COFFIN_BEARER', command: { type: 'OBSERVE', caseId: 'fresh-transfer' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
    preserved(s, originalCoffinBearer());
  });
  it('preserves physical and ritual locks even under an unsupported bare sequence2 label', () => {
    const s = originalCoffinBearer(); s.coffinBearer.life.playerLocation = 'A';
    expect(hasCoffinBearerLifeLock(s)).toBe(true); expect(hasBarrenMatriarchOldPractice(s)).toBe(true); expect(validateCoffinBearerLife(s)).toBe(false);
    s.progression.sequence = 2; expect(s.barrenMatriarch.promotionWeek).toBeNull(); expect(hasCoffinBearerLifeLock(s)).toBe(true);
    s.coffinBearer.preparedWeek = s.week; s.coffinBearer.encounter.status = 'READY';
    expect(hasCoffinBearerRitualLock(s)).toBe(true); expect(hasCoffinBearerEncounterLock(s)).toBe(true); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each([
    ['original person location', (s: SliceState) => { Object.assign(s.coffinBearer.life.owner, { location: 'B' }); }],
    ['original recipient health', (s: SliceState) => { Object.assign(s.coffinBearer.life.recipient, { health: 99 }); }],
    ['original sample vitality', (s: SliceState) => { s.coffinBearer.life.samples[0]!.vitality++; }],
    ['original paper', (s: SliceState) => { s.coffinBearer.life.paper.text += ' altered'; }],
    ['original box holder', (s: SliceState) => { s.coffinBearer.life.box.holder = 'PLAYER'; }],
    ['unlogged travel', (s: SliceState) => { s.coffinBearer.life.playerTravelMetres += 4; s.coffinBearer.life.clockSeconds += 4; }],
  ] as const)('rejects changing %s without physical history', (_name, mutate) => {
    for (const s of [originalCoffinBearer(), promoted()]) { mutate(s); expect(validateCoffinBearerLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
  it.each([
    ['missing skill', (s: SliceState) => { delete s.progression.mastery['mother.s5.ground-passage']; }],
    ['invented skill', (s: SliceState) => { s.progression.mastery['mother.s1.unsupported'] = 0; }],
    ['gifted old mastery', (s: SliceState) => { s.progression.mastery['mother.s8.condition-observation'] = 1; }],
    ['gifted new mastery', (s: SliceState) => { s.progression.mastery[BARREN_MATRIARCH_ABILITY_IDS[0]] = 8; }],
    ['forged digestion', (s: SliceState) => { s.barrenMatriarch.coffinBearerActingAtPromotion = 0; }],
    ['missing source digestion', (s: SliceState) => { s.coffinBearer.ancientAlchemistActingAtPromotion = 0; }],
    ['missing real promotion', (s: SliceState) => { s.barrenMatriarch.promotionWeek = null; }],
    ['rewritten original surrender', (s: SliceState) => { s.coffinBearer.encounter.enemyStatus = 'RESISTING'; }],
    ['restored original enemy health', (s: SliceState) => { s.coffinBearer.encounter.enemyHealth = 100; }],
    ['erased old bottle work', (s: SliceState) => { s.cultivator.bottles[0]!.labourSteps = 0; }],
    ['changed original age', (s: SliceState) => { s.character.age++; }],
  ] as const)('rejects %s at the persisted boundary', (_name, mutate) => {
    const s = promoted(); mutate(s); expect(() => assertValidSliceState(s)).toThrow(); expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(false); expect(validateBarrenMatriarchState(s)).toBe(false);
  });
  it('rejects a bare fake promotion without guidance, purchase, preparations, accepted change or journal', () => {
    const s = originalCoffinBearer(); s.progression.sequence = 2; s.barrenMatriarch.promotionWeek = s.week; s.barrenMatriarch.coffinBearerActingAtPromotion = 100;
    for (const id of BARREN_MATRIARCH_ABILITY_IDS) s.progression.mastery[id] = 0;
    expect(validateBarrenMatriarchAcquisitionJournal(s)).toBe(false); expect(validateBarrenMatriarchState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
});
