import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import { validateSlicePayload } from '../../src/domain/slice/validation';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import { CALAMITY_DEMONESS_ABILITY_IDS } from '../../src/domain/calamity-demoness/types';
import { CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL, CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL } from '../../src/domain/calamity-demoness/combat';
import { UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL, UNAGING_DEMONESS_ENEMY_COUNT_WHEEL } from '../../src/domain/unaging-demoness/combat';
import { playerText } from '../../src/shared/player-text';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/calamity-demoness-v01770';
const OLD = 'tests/fixtures/unaging-demoness-v01530/natural.json';
const LEGACY = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness'] as const;
const CASES = ['mirror-screen', 'black-flame-channel', 'revoked-window'] as const;
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
const natural = <T,>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
function snapshot(key: 'departureStart' | 'promoted' | 'practiced' | 'combatStart' | 'final'): SliceState {
  return migrateSliceState(key === 'final' ? natural('final') : JSON.parse(readFileSync(`${ROOT}/snapshot-${key}.json`, 'utf8')));
}
function boundary(name: string) {
  if (!index[name]) throw new Error(`Missing actual Calamity Demoness boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry(file, 'final')) };
}
function preserveOriginals(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender); expect(after.character.age).toBe(before.character.age);
  for (const root of LEGACY) expect(after[root]).toEqual(before[root]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(after.progression.mastery[id]).toBe(mastery);
}

describe('Calamity Demoness actual585-command continuation and shared invariants', () => {
  it('replays from original creation and seed, reaches the complete migrated487 prefix and exact final state', () => {
    const creation = natural<Parameters<typeof createSliceRun>[1]>('creation');
    const seed = natural<string>('seed'), commands = natural<SliceIntent[]>('commands');
    const originalCommands = readObjectEntry<SliceIntent[]>(OLD, 'commands');
    const old = migrateSliceState(readObjectEntry(OLD, 'final')), expected = snapshot('final');
    expect(creation).toEqual(readObjectEntry(OLD, 'creation')); expect(seed).toBe(readObjectEntry(OLD, 'seed'));
    expect(seed).toBe('assassin-natural-v045'); expect(commands).toHaveLength(585); expect(originalCommands).toHaveLength(487);
    expect(natural('prefixCount')).toBe(487); expect(natural('prefixVerified')).toBe(true);
    expect(commands.slice(0, 487)).toEqual(originalCommands);
    let state = createSliceRun(expected.runId, creation, seed);
    expect(state).toEqual(migrateSliceState(natural('initial')));
    commands.forEach((intent, i) => {
      expect(validateSlicePayload(intent)).toBe(true); state = applySliceIntent(state, intent);
      if (i === 486) { expect(state).toEqual(old); expect(state).toEqual(snapshot('departureStart')); }
    });
    expect(state).toEqual(expected); assertValidSliceState(state);
    expect(state.random).toEqual({ seed: 'assassin-natural-v045', cursor: 207 });
    expect(state.revision).toBe(586); expect(commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
  }, 120_000);

  it('keeps the original natural provenance and exact source bytes rather than substituting directed setup', () => {
    expect(natural('provenance')).toEqual({ kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', source: OLD, newRandomChanges: false });
    expect(natural('continuation')).toMatchObject({ kind: 'NATURAL_UNAGING_DEMONESS_PREFIX_THEN_PUBLIC_CALAMITY_DEMONESS',
      sourceFixture: OLD, exactPublicPrefixCommands: 487, sourceS3Setup: 'NATURAL', fullNaturalS9ToS2: true, newRandomChanges: false });
    const sources = natural<{ file: string; sha256: string }[]>('sourcePreservation'); expect(sources).toHaveLength(1);
    expect(sources[0]!.file).toBe(OLD);
    for (const source of sources) expect(createHash('sha256').update(readFileSync(source.file)).digest('hex')).toBe(source.sha256);
  });

  it('migrates the original full state without changing its seven roots, resources, injuries or next random draw', () => {
    const original = readObjectEntry<SliceState>(OLD, 'final'), bytes = JSON.stringify(original), migrated = migrateSliceState(original);
    expect(migrated).toEqual(snapshot('departureStart'));
    for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      expect((migrated as unknown as Record<string, unknown>)[key]).toEqual(value);
    }
    expect(migrated).toMatchObject({ health: 70, mind: 100, spirituality: 111, week: 124, revision: 488,
      random: { seed: 'assassin-natural-v045', cursor: 177 }, progression: { sequence: 3, acting: 100 } });
    expect(migrated.injuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(migrated.injuries[0]!.treatedRevision).toBeNull();
    expect(JSON.stringify(original)).toBe(bytes); expect(migrateSliceState(migrated)).toEqual(migrated); assertValidSliceState(migrated);
  });

  it('preserves all seven complete old roots, sixteen old masteries and original combat history across actual S2 snapshots', () => {
    const old = snapshot('departureStart'); expect(Object.keys(old.progression.mastery)).toHaveLength(16);
    for (const key of ['promoted', 'practiced', 'combatStart', 'final'] as const) {
      const state = snapshot(key); preserveOriginals(old, state);
      expect(state.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    }
    expect(old.pain.encounter.enemyStatus).toBe('DEAD');
    expect(old.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyStatus: 'SURRENDERED', enemyHealth: 60 });
    expect(old.unagingDemoness.encounter).toMatchObject({ targetId: 'UD3-CORBIN', enemyHealth: 70, enemySpirituality: 100, enemyStatus: 'SURRENDERED' });
  });

  it('pays the actual60p clinic without instant healing and clears the original heavy injury only after the recorded later rest', () => {
    const pay = boundary('clinic-actual-pay60'), rest = boundary('clinic-original-heavy-healed');
    expect(pay.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(pay.beforeLast).toMatchObject({ cash: 520, health: 78, revision: 490 });
    expect(pay.final).toMatchObject({ cash: 460, health: 78, revision: 491 });
    expect(pay.beforeLast.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    expect(pay.final.injuries[0]).toEqual({ ...pay.beforeLast.injuries[0], treatedRevision: 491 });
    expect(rest.beforeLast).toEqual(pay.final); expect(rest.lastIntent).toEqual({ type: 'ACTION', action: 'REST' });
    expect(rest.final.health).toBe(86); expect(rest.final.injuries).toEqual([]);
    expect(applySliceIntent(pay.beforeLast, pay.lastIntent)).toEqual(pay.final);
    expect(applySliceIntent(rest.beforeLast, rest.lastIntent)).toEqual(rest.final);
    preserveOriginals(snapshot('departureStart'), rest.final);
  });

  it('consumes only the actual first independent bottle with SUCCESS and adds two zero masteries without restoring health or spirituality', () => {
    const dose = boundary('actual-promotion'), old = snapshot('departureStart'), state = snapshot('promoted');
    expect(dose.lastIntent).toEqual({ type: 'CALAMITY_DEMONESS', command: { type: 'CONSUME', bottleId: 'calamity-demoness-potion-1', confirmed: true } });
    expect(dose.final).toEqual(state); expect(applySliceIntent(dose.beforeLast, dose.lastIntent)).toEqual(state);
    expect(state.progression).toMatchObject({ pathwayId: 'demoness', sequence: 2, acting: 0 });
    expect(state.calamityDemoness).toMatchObject({ promotionWeek: 134, unagingDemonessActingAtPromotion: 100, preparedWeek: null });
    expect(state.calamityDemoness.bottles.filter(b => b.status === 'CONSUMED')).toHaveLength(1);
    expect(state.calamityDemoness.bottles[0]).toMatchObject({ id: 'calamity-demoness-potion-1', outcome: 'SUCCESS', labourSteps: 5, acquiredWeek: 134, preparationWeek: 134, consumedWeek: 134 });
    expect(state.calamityDemoness.bottles.slice(1)).toEqual(dose.beforeLast.calamityDemoness.bottles.slice(1));
    expect(Object.keys(state.progression.mastery)).toHaveLength(18);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...CALAMITY_DEMONESS_ABILITY_IDS]);
    for (const id of CALAMITY_DEMONESS_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0);
    expect(state.health).toBe(dose.beforeLast.health); expect(state.spirituality).toBe(dose.beforeLast.spirituality);
    expect(state.injuries).toEqual(dose.beforeLast.injuries); expect(state.random.cursor).toBe(dose.beforeLast.random.cursor + 1);
    preserveOriginals(old, state);
  });

  it('records actual72m walking, the same original mirrors and adults, load12→7/wear5 and one consumed non-biological residue', () => {
    const state = snapshot('practiced'), life = state.calamityDemoness.life, site = life.site, oldLife = state.unagingDemoness.life;
    expect(life.reflected).toBe(true); expect(state.progression.acting).toBe(100);
    expect(site).toMatchObject({ playerTravelMetres: 72, playerEnergy: 28, clockSeconds: 217, playerLocation: 'ENTRY' });
    expect(site.source).toMatchObject({ root: 'unagingDemoness.life', promotionWeek: state.unagingDemoness.promotionWeek });
    for (const [key, value] of Object.entries(site.source!.snapshot)) expect(value).toEqual((oldLife as unknown as Record<string, unknown>)[key]);
    expect(site.mirrorA).toEqual(oldLife.mirrorA); expect(site.mirrorB).toEqual(oldLife.mirrorB);
    expect(site.vera).toMatchObject({ id: oldLife.vera.id, name: oldLife.vera.name, age: 46, alive: true, travelMetres: 6, energy: 94 });
    expect(site.marcus).toMatchObject({ id: oldLife.marcus.id, name: oldLife.marcus.name, age: 41, alive: true, travelMetres: 28, energy: 72 });
    expect(site.load).toMatchObject({ initialForce: 12, remainingLoads: 0, appliedLoads: 1, finalForce: 7, bufferedForce: 5 });
    expect(site.plates.map(p => ({ id: p.id, charges: p.charges, wear: p.wear, status: p.status, paid: p.paidPennies }))).toEqual([
      { id: 'CD2-PLATE-1', charges: 0, wear: 5, status: 'RETURNED', paid: 20 },
      { id: 'CD2-PLATE-2', charges: 0, wear: 0, status: 'RETURNED', paid: 20 },
      { id: 'CD2-PLATE-3', charges: 1, wear: 0, status: 'RETURNED', paid: 20 },
    ]);
    expect(site.residue).toMatchObject({ id: 'CD2-RESIDUE-1', quantity: 1, biological: false, fictional: true, status: 'CONSUMED', location: 'BOX', acquiredWithPlateId: 'CD2-PLATE-2' });
    expect(site.box).toMatchObject({ state: 'CLOSED', scorched: true, pulses: 1, pulseSeconds: 10, handovers: 0 });
    for (const id of CALAMITY_DEMONESS_ABILITY_IDS) {
      const applications = CASES.flatMap(caseId => life.cases[caseId].attempts).filter(a => a.appliedAbilityIds.includes(id));
      expect(applications).toHaveLength(1); expect(state.progression.mastery[id]).toBe(applications.length * 8);
    }
    for (const caseId of CASES) expect(life.cases[caseId]).toMatchObject({ status: 'RESOLVED', contactOpen: false });
    expect(life.cases['revoked-window'].attempts.at(-1)).toMatchObject({ closed: true, permissionWithdrawn: true, abilityTier: null, appliedAbilityIds: [], spiritualitySpent: 0, routeWalked: true, routeReturned: true, plateReturned: true });
  });

  it('projects the exact physical enemy ability/count mappings at both new S2 and preserved old S3 starts', () => {
    const start = snapshot('combatStart'), battle = projectSliceState(start).combat!;
    expect(battle.title).toBe('灾难魔女 · 镜廊外院'); expect(battle.enemyName).toContain('伊瑞丝');
    expect(battle.enemyAbilityWheel).toEqual(CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL);
    expect(battle.enemyCountWheel).toEqual(CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL);
    expect(battle.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual([
      { id: 'FORCE_STRIKE', weight: 35 }, { id: 'GUARD', weight: 25 }, { id: 'BODY_STRIKE', weight: 20 }, { id: 'DISRUPT', weight: 15 }, { id: 'ACCIDENT', weight: 5 },
    ]);
    const old = projectSliceState(migrateSliceState(readObjectEntry(OLD, 'combatStart'))).combat!;
    expect(old.title).toBe('不老魔女 · 原镜小院交战'); expect(old.enemyName).toContain('科宾');
    expect(old.enemyAbilityWheel).toEqual(UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL.map(w => ({ ...w, label: playerText(w.label) })));
    expect(old.enemyCountWheel).toEqual(UNAGING_DEMONESS_ENEMY_COUNT_WHEEL.map(w => ({ ...w, label: playerText(w.label) })));
  });

  it('keeps three actual BODY rounds, the failed paid screen, zero new combat applications and the real heavy injury', () => {
    const final = snapshot('final'), rounds = final.combatHistory.filter(r => r.calamityDemonessOutcome);
    expect(rounds).toHaveLength(3); expect(rounds.map(r => r.stance)).toEqual(['DEFEND', 'CONTROL', 'RETREAT']);
    for (const round of rounds) expect(round.consequenceDomain).toBe('BODY');
    expect(rounds[1]).toMatchObject({ consequenceRoll: 86, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    const newActions = rounds.flatMap(r => r.calamityDemonessOutcome!.playerActions)
      .filter(a => CALAMITY_DEMONESS_ABILITY_IDS.includes(a.id as typeof CALAMITY_DEMONESS_ABILITY_IDS[number]));
    expect(newActions).toHaveLength(1);
    expect(newActions[0]).toMatchObject({ id: 'assassin.s2.mirror-screen', paidCost: 6, succeeded: false, applied: false, appliedAmount: 0, plateChargeSpent: 0 });
    expect(newActions.filter(a => a.applied)).toHaveLength(0);
    expect(final.calamityDemoness.encounter.plate).toMatchObject({ id: 'CD2-COMBAT-PLATE', initialCharges: 3, charges: 3, paidPennies: 20 });
    for (const id of CALAMITY_DEMONESS_ABILITY_IDS) expect(final.progression.mastery[id]).toBe(snapshot('practiced').progression.mastery[id]);
    expect(final.injuries.map(i => i.severity)).toEqual(['HEAVY']); expect(final.injuries[0]).toMatchObject({ acquiredRevision: 584, treatedRevision: null });
  });

  it('keeps the resisting H100/S97 original opponent after ordinary retreat and WORK, with78m current travel distinct from72m practice history', () => {
    const terminal = boundary('combat-terminal'), ordinary = boundary('ordinary-life-after-actual-exit'), final = snapshot('final');
    expect(terminal.lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'RETREAT' });
    expect(applySliceIntent(terminal.beforeLast, terminal.lastIntent)).toEqual(terminal.final);
    expect(ordinary.beforeLast).toEqual(terminal.final); expect(ordinary.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(applySliceIntent(ordinary.beforeLast, ordinary.lastIntent)).toEqual(final); expect(ordinary.final).toEqual(final);
    expect(final).toMatchObject({ status: 'ACTIVE', health: 70, mind: 100, spirituality: 120, week: 143, injuryRisk: 0 }); expect(final.combat).toBeNull();
    const e = final.calamityDemoness.encounter;
    expect(e).toMatchObject({ status: 'RETREATED', targetId: 'CD2-IRIS', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97, enemyStatus: 'RESISTING', enemyPosition: 'YARD', weaponLocation: 'HAND', enemyInjuries: [] });
    expect(e.terminal).toMatchObject({ outcome: 'RETREATED', round: 3, exitMetres: 2, exitSeconds: 2, playerEnergyPaid: 2 });
    expect(e.startSite).toEqual(final.calamityDemoness.life.site);
    expect(e.startSite).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 72, playerEnergy: 28 });
    expect(e.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 78, playerEnergy: 22, vera: { location: 'OUTSIDE' }, marcus: { location: 'OUTSIDE' } });
    expect(projectSliceState(final).calamityDemoness.encounter.site).toEqual(e.currentSite);
    expect(final.calamityDemoness.encounter).toEqual(terminal.final.calamityDemoness.encounter);
    expect(final.lastCombatRound).toEqual(terminal.final.lastCombatRound);
    preserveOriginals(snapshot('departureStart'), final);
  });
});
