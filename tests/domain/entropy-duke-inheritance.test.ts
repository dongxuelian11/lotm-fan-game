import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createEntropyDukeState, hasEntropyDukeOldPractice, validateEntropyDukeAcquisitionJournal } from '../../src/domain/entropy-duke/index.js';
import { ENTROPY_DUKE_ABILITY_IDS } from '../../src/domain/entropy-duke/types.js';
import { validateLawyerState } from '../../src/domain/lawyer/index.js';
import { validateBarbarianState } from '../../src/domain/barbarian/index.js';
import { validateBriberState } from '../../src/domain/briber/index.js';
import { validateCorruptionBaronState } from '../../src/domain/corruption-baron/index.js';
import { validateMentorDisorderState } from '../../src/domain/mentor-disorder/index.js';
import { validateFallenEarlState } from '../../src/domain/fallen-earl/index.js';
import { hasFrenzyMageLock, hasFrenzyMageRitualLock, isFrenzyMage, validateFrenzyMageState } from '../../src/domain/frenzy-mage/index.js';
import { hasFrenzyMageLifeLock, validateFrenzyMageLife } from '../../src/domain/frenzy-mage/life.js';
import { hasFrenzyMageEncounterLock } from '../../src/domain/frenzy-mage/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { blackEmperorLegacyKeys, frenzyMageNaturalPath, originalFrenzyMage, promoted, rejectIntent, rejectEntropyDuke } from './entropy-duke-directed-helper.js';

const validators = [validateLawyerState, validateBarbarianState, validateBriberState, validateCorruptionBaronState, validateMentorDisorderState, validateFallenEarlState, validateFrenzyMageState];
const legacyMastery = (s: SliceState) => Object.fromEntries(Object.entries(s.progression.mastery).filter(([id]) => !ENTROPY_DUKE_ABILITY_IDS.includes(id as typeof ENTROPY_DUKE_ABILITY_IDS[number])));
function preserved(s: SliceState, old: SliceState): void {
  for (const key of blackEmperorLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.injuries).toEqual(old.injuries); expect(s.injuryRisk).toBe(old.injuryRisk);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
  expect(s.briber.gifts).toEqual(old.briber.gifts);
}

describe('Entropy Duke inheritance preserves actual Black Emperor histories', () => {
  it('retains the actual living prefix separately from the immutable fatal558-command ending', () => {
    const dead = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'final'), bytes = JSON.stringify(dead), s = originalFrenzyMage();
    expect(readObjectEntry<SliceIntent[]>(frenzyMageNaturalPath, 'commands')).toHaveLength(558);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, revision: 556, week: 141,
      status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 540, injuryRisk: 2,
      progression: { pathwayId: 'black-emperor', sequence: 3, acting: 100 }, random: { seed: 'lawyer-natural-v063', cursor: 189 } });
    expect(s.frenzyMage.promotionWeek).toBe(133); expect(s.frenzyMage.life.reflected).toBe(true); expect(s.frenzyMage.encounter.status).toBe('AVAILABLE');
    expect(s.fallenEarl.encounter).toMatchObject({ targetId: 'FE4-MARLOW-VENN', enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[184, 'HEAVY', null], [436, 'HEAVY', null]]);
    expect(s.briber.gifts.slice(10).every(g => g.location === 'PLAYER')).toBe(true);
    expect(dead).toMatchObject({ revision: 559, status: 'DEAD', health: 0, injuryRisk: 3 });
    expect(s.entropyDuke).toEqual(createEntropyDukeState()); expect(migrateSliceState(s)).toEqual(s); expect(JSON.stringify(dead)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);
  it('adds only the two exact zero-mastered S2 skills while preserving all seven roots and old zeros', () => {
    const old = originalFrenzyMage(), s = promoted(); preserved(s, old);
    expect(legacyMastery(s)).toEqual(old.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...ENTROPY_DUKE_ABILITY_IDS]);
    for (const id of ENTROPY_DUKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ['black-emperor.s7.bribery-weakening', 'black-emperor.s5.disorder', 'black-emperor.s3.ordered-deviation']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression.acting).toBe(0); expect(s.entropyDuke.frenzyMageActingAtPromotion).toBe(100);
    expect(validators.map(validate => validate(s))).toEqual(validators.map(() => true)); assertValidSliceState(s);
  });
  it('shows each stored old digestion while keeping predecessor actions and encounters closed', () => {
    const s = promoted(), view = projectSliceState(s); expect(isFrenzyMage(s)).toBe(false);
    for (const key of blackEmperorLegacyKeys) expect(view[key].acting, key).toBe(100);
    expect(view.frenzyMage.actions).toEqual([]); expect(view.frenzyMage.life.actions).toEqual([]); expect(view.frenzyMage.encounter.actions).toEqual([]);
    expect(view.frenzyMage.insideCase).toBe(false); expect(hasFrenzyMageLock(s)).toBe(false);
    expect(view.entropyDuke.abilities).toHaveLength(14); expect(view.entropyDuke.injuries).toEqual(s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: false })));
  });
  it('cannot reopen predecessor cases, restock old originals, reuse old reports or gift old inventory for free', () => {
    const s = promoted();
    const intents: SliceIntent[] = [
      ...(['LAWYER', 'BARBARIAN', 'BRIBER', 'CORRUPTION_BARON', 'MENTOR_DISORDER', 'FALLEN_EARL', 'FRENZY_MAGE'] as const).map(type => ({ type, command: { type: 'REFLECT' } } as SliceIntent)),
      { type: 'FRENZY_MAGE', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'FRENZY_MAGE', command: { type: 'POTION_WORK', bottleId: 'frenzy-mage-potion-3' } },
      { type: 'FRENZY_MAGE', command: { type: 'BUY_POTION', bottleId: 'frenzy-mage-potion-3' } },
      { type: 'FRENZY_MAGE', command: { type: 'REQUEST_SUPPLY' } }, { type: 'FRENZY_MAGE', command: { type: 'RECEIVE_SUPPLY' } },
      { type: 'FRENZY_MAGE', command: { type: 'ENCOUNTER_TALK' } }, { type: 'FRENZY_MAGE', command: { type: 'ENCOUNTER_FIGHT' } },
      { type: 'FRENZY_MAGE', command: { type: 'OBSERVE', caseId: 'courier-route' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
    preserved(s, originalFrenzyMage());
  });
  it('keeps real old physical and ritual locks even under an unsupported bare sequence2 label', () => {
    const s = originalFrenzyMage(); s.frenzyMage.life.playerLocation = 'A';
    expect(hasFrenzyMageLifeLock(s)).toBe(true); expect(hasEntropyDukeOldPractice(s)).toBe(true); expect(validateFrenzyMageLife(s)).toBe(false);
    s.progression.sequence = 2;
    expect(s.entropyDuke.promotionWeek).toBeNull(); expect(hasFrenzyMageLifeLock(s)).toBe(true);
    s.frenzyMage.preparedWeek = s.week; s.frenzyMage.encounter.status = 'READY';
    expect(hasFrenzyMageRitualLock(s)).toBe(true); expect(hasFrenzyMageEncounterLock(s)).toBe(true); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each([
    ['original person location', (s: SliceState) => { s.frenzyMage.life.volunteer.location = 'B'; }],
    ['original guide location', (s: SliceState) => { s.frenzyMage.life.guide.location = 'A'; }],
    ['original ball owner', (s: SliceState) => { s.frenzyMage.life.ball.holder = 'PLAYER'; }],
    ['original paper', (s: SliceState) => { s.frenzyMage.life.paper.holder = 'PLAYER'; }],
    ['unlogged travel', (s: SliceState) => { s.frenzyMage.life.playerTravelMetres += 4; s.frenzyMage.life.clockSeconds += 4; }],
  ] as const)('rejects changing %s without a physical history', (_name, mutate) => {
    for (const s of [originalFrenzyMage(), promoted()]) { mutate(s); expect(validateFrenzyMageLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
  it.each([
    ['missing skill', (s: SliceState) => { delete s.progression.mastery['black-emperor.s5.disorder']; }],
    ['invented skill', (s: SliceState) => { s.progression.mastery['black-emperor.s1.unsupported'] = 0; }],
    ['gifted mastery', (s: SliceState) => { s.progression.mastery['black-emperor.s3.ordered-deviation'] = 1; }],
    ['forged digestion', (s: SliceState) => { s.entropyDuke.frenzyMageActingAtPromotion = 0; }],
    ['missing source digestion', (s: SliceState) => { s.frenzyMage.fallenEarlActingAtPromotion = 0; }],
    ['missing real promotion', (s: SliceState) => { s.entropyDuke.promotionWeek = null; }],
    ['recalled gift', (s: SliceState) => { Object.assign(s.briber.gifts[0]!, { location: 'PLAYER', destination: null, givenWeek: null }); }],
  ] as const)('rejects %s at the persisted state boundary', (_name, mutate) => {
    const s = promoted(); mutate(s); expect(() => assertValidSliceState(s)).toThrow(); expect(validateEntropyDukeAcquisitionJournal(s)).toBe(false);
  });
  it('preserves the exact original death and rejects any post-mortem acquisition or ordinary action', () => {
    const original = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'final'), bytes = JSON.stringify(original), dead = migrateSliceState(original);
    expect(dead).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' }, injuryRisk: 3 });
    expect(dead.frenzyMage.encounter.status).toBe('LOST'); expect(dead.entropyDuke).toEqual(createEntropyDukeState());
    for (const key of blackEmperorLegacyKeys) expect(dead[key]).toEqual(original[key]);
    expect(migrateSliceState(JSON.parse(JSON.stringify(dead)))).toEqual(dead); expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(dead);
    rejectEntropyDuke(dead, { type: 'LEARN_GUIDANCE' }); rejectIntent(dead, { type: 'ACTION', action: 'REST' });
  });
  it('replays the final three authentic S3 commands from the living prefix into the same death', () => {
    const commands = readObjectEntry<SliceIntent[]>(frenzyMageNaturalPath, 'commands'), original = readObjectEntry<SliceState>(frenzyMageNaturalPath, 'final');
    let s = originalFrenzyMage(); for (const command of commands.slice(555)) s = applySliceIntent(s, command);
    expect(s).toEqual(migrateSliceState(original)); expect(s.entropyDuke).toEqual(createEntropyDukeState());
  });
});
