import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBalancerState, hasBalancerOldPractice, validateBalancerAcquisitionJournal, validateBalancerState } from '../../src/domain/balancer/index.js';
import { BALANCER_ABILITY_IDS } from '../../src/domain/balancer/types.js';
import { validateArbiterState } from '../../src/domain/arbiter/index.js';
import { validateSheriffState } from '../../src/domain/sheriff/index.js';
import { validateInterrogatorState } from '../../src/domain/interrogator/index.js';
import { validateJudgeState } from '../../src/domain/judge/index.js';
import { validatePunishmentKnightState } from '../../src/domain/punishment-knight/index.js';
import { validateImperativeMageState } from '../../src/domain/imperative-mage/index.js';
import { hasChaosHunterLock, hasChaosHunterRitualLock, isChaosHunter, validateChaosHunterState } from '../../src/domain/chaos-hunter/index.js';
import { hasChaosHunterLifeLock, validateChaosHunterLife } from '../../src/domain/chaos-hunter/life.js';
import { hasChaosHunterEncounterLock } from '../../src/domain/chaos-hunter/encounter.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { justiciarLegacyKeys, recoveryNaturalPath, chaosHunterNaturalPath, originalChaosHunter, promoted, rejectIntent, rejectBalancer } from './balancer-directed-helper.js';

const validators = [validateArbiterState, validateSheriffState, validateInterrogatorState, validateJudgeState, validatePunishmentKnightState, validateImperativeMageState, validateChaosHunterState];
const legacyMastery = (s: SliceState) => Object.fromEntries(Object.entries(s.progression.mastery).filter(([id]) => !BALANCER_ABILITY_IDS.includes(id as typeof BALANCER_ABILITY_IDS[number])));
function preserved(s: SliceState, old: SliceState): void {
  for (const key of justiciarLegacyKeys) expect(s[key], key).toEqual(old[key]);
  expect(s.injuries).toEqual(old.injuries); expect(s.injuryRisk).toBe(old.injuryRisk);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
  expect(s.character.appearanceDescription).toBe(old.character.appearanceDescription);
}

describe('Balancer inheritance preserves the complete recovery continuation and distinct original death', () => {
  it('replays the entire actual483 recovery source and preserves the last real wound and original Edric surrender', () => {
    const original = readObjectEntry<SliceState>(recoveryNaturalPath, 'final'), bytes = JSON.stringify(original), s = originalChaosHunter();
    expect(readObjectEntry<SliceIntent[]>(recoveryNaturalPath, 'commands')).toHaveLength(483);
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION, revision: 484, week: 115,
      status: 'ACTIVE', health: 70, mind: 100, spirituality: 116, cash: 400, actionsRemaining: 1, injuryRisk: 0,
      progression: { pathwayId: 'justiciar', sequence: 3, acting: 100 }, random: { seed: 'arbiter-natural-v066', cursor: 310 } });
    expect(s.chaosHunter.promotionWeek).toBe(106); expect(s.chaosHunter.life.reflected).toBe(true);
    expect(s.chaosHunter.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CH3-EDRIC', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 92 });
    expect(s.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[482, 'HEAVY', null]]);
    expect(s.chaosHunter.life.volunteer).toMatchObject({ id: 'CH3-MIRA', name: '米拉·佩恩', age: 43, alive: true, independentMind: true });
    expect(s.chaosHunter.life.parcel).toMatchObject({ id: 'CH3-PARCEL', quantity: 1, massGrams: 350 });
    expect(s.balancer).toEqual(createBalancerState()); expect(migrateSliceState(s)).toEqual(s); expect(s).toEqual(migrateSliceState(original));
    expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(s);
  }, 30_000);
  it('adds exactly two zero-mastered S2 skills and retains all15 old values including legitimate zeros', () => {
    const old = originalChaosHunter(), s = promoted(); preserved(s, old);
    expect(legacyMastery(s)).toEqual(old.progression.mastery); expect(Object.keys(s.progression.mastery)).toHaveLength(17);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...BALANCER_ABILITY_IDS]);
    for (const id of BALANCER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ['justiciar.s9.authority', 'justiciar.s7.mental-pressure', 'justiciar.s5.punishment', 'justiciar.s5.confinement', 'justiciar.s5.wound-verdict']) expect(s.progression.mastery[id]).toBe(0);
    expect(s.progression.acting).toBe(0); expect(s.balancer.chaosHunterActingAtPromotion).toBe(100);
    expect(validators.map(validate => validate(s))).toEqual(validators.map(() => true)); assertValidSliceState(s);
  });
  it('shows each stored old digestion and original injury while predecessor actions and encounters remain closed', () => {
    const s = promoted(), view = projectSliceState(s); expect(isChaosHunter(s)).toBe(false);
    for (const key of justiciarLegacyKeys) expect(view[key].acting, key).toBe(100);
    expect(view.chaosHunter.actions).toEqual([]); expect(view.chaosHunter.life.actions).toEqual([]); expect(view.chaosHunter.encounter.actions).toEqual([]);
    expect(view.chaosHunter.insideCase).toBe(false); expect(hasChaosHunterLock(s)).toBe(false);
    expect(view.balancer.abilities).toHaveLength(17); expect(view.balancer.injuries).toEqual(s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: false })));
    expect(view.balancer.inheritedHistory.join(' ')).toContain('原埃德里克：已投降');
  });
  it('cannot reopen old cases, restock old originals or replay the original surrendered opponent', () => {
    const s = promoted();
    const intents: SliceIntent[] = [
      ...(['ARBITER', 'SHERIFF', 'INTERROGATOR', 'JUDGE', 'PUNISHMENT_KNIGHT', 'IMPERATIVE_MAGE', 'CHAOS_HUNTER'] as const).map(type => ({ type, command: { type: 'REFLECT' } } as SliceIntent)),
      { type: 'CHAOS_HUNTER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'CHAOS_HUNTER', command: { type: 'POTION_WORK', bottleId: 'chaos-hunter-potion-3' } },
      { type: 'CHAOS_HUNTER', command: { type: 'BUY_POTION', bottleId: 'chaos-hunter-potion-3' } },
      { type: 'CHAOS_HUNTER', command: { type: 'REQUEST_SUPPLY' } }, { type: 'CHAOS_HUNTER', command: { type: 'RECEIVE_SUPPLY' } },
      { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_TALK' } }, { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_FIGHT' } },
      { type: 'CHAOS_HUNTER', command: { type: 'OBSERVE', caseId: 'paired-line' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
    preserved(s, originalChaosHunter());
  });
  it('keeps real physical and ritual locks even under an unsupported bare sequence2 label', () => {
    const s = originalChaosHunter(); s.chaosHunter.life.playerLocation = 'A';
    expect(hasChaosHunterLifeLock(s)).toBe(true); expect(hasBalancerOldPractice(s)).toBe(true); expect(validateChaosHunterLife(s)).toBe(false);
    s.progression.sequence = 2;
    expect(s.balancer.promotionWeek).toBeNull(); expect(hasChaosHunterLifeLock(s)).toBe(true);
    s.chaosHunter.preparedWeek = s.week; s.chaosHunter.encounter.status = 'READY';
    expect(hasChaosHunterRitualLock(s)).toBe(true); expect(hasChaosHunterEncounterLock(s)).toBe(true); expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each([
    ['original person location', (s: SliceState) => { s.chaosHunter.life.volunteer.location = 'B'; }],
    ['original guide location', (s: SliceState) => { s.chaosHunter.life.guide.location = 'A'; }],
    ['original parcel holder', (s: SliceState) => { s.chaosHunter.life.parcel.holder = 'PLAYER'; }],
    ['original paper', (s: SliceState) => { s.chaosHunter.life.paper.holder = 'PLAYER'; }],
    ['original line', (s: SliceState) => { s.chaosHunter.life.line.holder = 'FLOOR'; }],
    ['unlogged travel', (s: SliceState) => { s.chaosHunter.life.playerTravelMetres += 4; s.chaosHunter.life.clockSeconds += 4; }],
  ] as const)('rejects changing %s without a physical history', (_name, mutate) => {
    for (const s of [originalChaosHunter(), promoted()]) { mutate(s); expect(validateChaosHunterLife(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
  it.each([
    ['missing skill', (s: SliceState) => { delete s.progression.mastery['justiciar.s5.confinement']; }],
    ['invented skill', (s: SliceState) => { s.progression.mastery['justiciar.s1.unsupported'] = 0; }],
    ['gifted old mastery', (s: SliceState) => { s.progression.mastery['justiciar.s9.authority'] = 1; }],
    ['gifted new mastery', (s: SliceState) => { s.progression.mastery[BALANCER_ABILITY_IDS[0]] = 8; }],
    ['forged digestion', (s: SliceState) => { s.balancer.chaosHunterActingAtPromotion = 0; }],
    ['missing source digestion', (s: SliceState) => { s.chaosHunter.imperativeMageActingAtPromotion = 0; }],
    ['missing real promotion', (s: SliceState) => { s.balancer.promotionWeek = null; }],
    ['rewritten original surrender', (s: SliceState) => { s.chaosHunter.encounter.enemyStatus = 'RESISTING'; }],
    ['restored original enemy health', (s: SliceState) => { s.chaosHunter.encounter.enemyHealth = 100; }],
    ['erased old bottle work', (s: SliceState) => { s.arbiter.bottles[0]!.labourSteps = 0; }],
    ['changed original age', (s: SliceState) => { s.character.age++; }],
  ] as const)('rejects %s at the persisted state boundary', (_name, mutate) => {
    const s = promoted(); mutate(s); expect(() => assertValidSliceState(s)).toThrow(); expect(validateBalancerAcquisitionJournal(s)).toBe(false); expect(validateBalancerState(s)).toBe(false);
  });
  it('rejects a bare fake promotion without actual guidance, purchase, preparations, check or journal', () => {
    const s = originalChaosHunter(); s.progression.sequence = 2; s.balancer.promotionWeek = s.week; s.balancer.chaosHunterActingAtPromotion = 100;
    for (const id of BALANCER_ABILITY_IDS) s.progression.mastery[id] = 0;
    expect(validateBalancerAcquisitionJournal(s)).toBe(false); expect(validateBalancerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('preserves the complete original477-command death and rejects all post-mortem recovery/acquisition', () => {
    const original = readObjectEntry<SliceState>(chaosHunterNaturalPath, 'final'), bytes = JSON.stringify(original), dead = migrateSliceState(original);
    expect(readObjectEntry<SliceIntent[]>(chaosHunterNaturalPath, 'commands')).toHaveLength(477);
    expect(dead).toMatchObject({ revision: 478, status: 'DEAD', health: 0, ending: { kind: 'DEATH' }, injuryRisk: 3 });
    expect(dead.chaosHunter.encounter.status).toBe('LOST'); expect(dead.balancer).toEqual(createBalancerState());
    for (const key of justiciarLegacyKeys) expect(dead[key]).toEqual(original[key]);
    expect(migrateSliceState(JSON.parse(JSON.stringify(dead)))).toEqual(dead); expect(JSON.stringify(original)).toBe(bytes); assertValidSliceState(dead);
    rejectBalancer(dead, { type: 'LEARN_GUIDANCE' }); rejectIntent(dead, { type: 'ACTION', action: 'REST' });
  });
  it('replays all477 fatal-source commands to the same immutable death through current public intents', () => {
    const original = readObjectEntry<SliceState>(chaosHunterNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(chaosHunterNaturalPath, 'commands');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(chaosHunterNaturalPath, 'creation');
    const seed = readObjectEntry<string>(chaosHunterNaturalPath, 'seed');
    let s = createSliceRun(original.runId, creation, seed); for (const command of commands) s = applySliceIntent(s, command);
    expect(s).toEqual(migrateSliceState(original)); expect(s.balancer).toEqual(createBalancerState());
  }, 30_000);
});
