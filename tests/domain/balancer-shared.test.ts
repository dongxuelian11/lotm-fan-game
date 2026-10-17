import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { createBalancerState, validateBalancerAcquisitionJournal, validateBalancerJournalContinuity } from '../../src/domain/balancer/index.js';
import { BALANCER_ABILITY_IDS } from '../../src/domain/balancer/types.js';
import { BALANCER_CASE_IDS } from '../../src/domain/balancer/life.js';
import { validateBalancerEncounter } from '../../src/domain/balancer/encounter.js';
import { balancerAbilityWheel, BALANCER_COUNT_WHEEL, BALANCER_ENEMY_ABILITY_WHEEL, BALANCER_ENEMY_COUNT_WHEEL, validateBalancerCombatRound } from '../../src/domain/balancer/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/balancer-v01840';
const NATURAL = `${ROOT}/natural.json`;
const RECOVERY = 'tests/fixtures/recovery-v01620/natural.json';
const RECOVERY_HASH = '3589c7d792bc5974dc79452a9d9f10ae68832da565e97ad88f06f61915f07942';
const DEAD = 'tests/fixtures/chaos-hunter-v01600/natural.json';
const DEAD_HASH = '8e65fcb081f33b5714534acf7d5e47227247ed90e8aa20d00861dc51f2e43588';
const SEED = 'arbiter-natural-v066';
const [SENSE, RESIST] = BALANCER_ABILITY_IDS;
const SNAPSHOTS = ['departure', 'treated', 'promoted', 'practiced', 'combatStart', 'combatTerminal'] as const;
const entry = <T>(key: string): T => readObjectEntry<T>(NATURAL, key);
const final = () => migrateSliceState(entry<unknown>('final'));
const prefix = () => migrateSliceState(entry<unknown>('prefixFinal'));
const snapshot = (name: typeof SNAPSHOTS[number]) => migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
const boundaryIndex = () => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundary(name: string) {
  const file = boundaryIndex()[name]; expect(file).toBe(`boundary-${name}.json`);
  const path = `${ROOT}/${file}`;
  return { beforeLast: migrateSliceState(readObjectEntry(path, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: migrateSliceState(readObjectEntry(path, 'final')) };
}
async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex');
}
function oldFacts(s: SliceState, old: SliceState): void {
  for (const key of ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage'] as const) expect(s[key], key).toEqual(old[key]);
  const { life: originalLife, ...originalHunter } = old.chaosHunter;
  const { life: currentLife, ...currentHunter } = s.chaosHunter;
  expect(currentHunter).toEqual(originalHunter);
  if (s.balancer.life.source) {
    expect(s.balancer.life.source.snapshot).toEqual(originalLife);
    expect(currentLife.cases).toEqual(originalLife.cases); expect(currentLife.reflected).toBe(originalLife.reflected);
    expect(currentLife.paper.text).toBe(originalLife.paper.text); expect(currentLife.table).toEqual(originalLife.table);
  } else expect(currentLife).toEqual(originalLife);
  expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
  expect(s.runId).toBe(old.runId); expect(s.random.seed).toBe(old.random.seed);
  expect(s.character.gender).toBe(old.character.gender); expect(s.character.age).toBe(old.character.age);
  for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  expect(s.chaosHunter.encounter).toMatchObject({ targetId: 'CH3-EDRIC', status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70 });
}

// Sixteen focused cases use the frozen public capture, never a directed cursor or resource edit.
describe('Balancer real same-seed continuation and frozen public boundaries', () => {
  it('preserves both original files and continues the entire living 483-command branch, never the separate 477-command death', async () => {
    expect(await sha256(RECOVERY)).toBe(RECOVERY_HASH); expect(await sha256(DEAD)).toBe(DEAD_HASH);
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: RECOVERY, sourceSha256: RECOVERY_HASH, newRandomChanges: false });
    const original = readObjectEntry<SliceIntent[]>(RECOVERY, 'commands'), commands = entry<SliceIntent[]>('commands');
    expect(original).toHaveLength(483); expect(commands).toHaveLength(594); expect(commands.slice(0, 483)).toEqual(original);
    expect(entry('prefixCount')).toBe(483); expect(entry('prefixVerified')).toBe(true); expect(entry('seed')).toBe(SEED);
    expect(entry('stage')).toBe('NATURAL_BALANCER_PUBLIC_CONTINUATION'); expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    const living = prefix(), dead = migrateSliceState(readObjectEntry(DEAD, 'final'));
    expect(living).toEqual(migrateSliceState(readObjectEntry(RECOVERY, 'final'))); expect(living).toEqual(snapshot('departure'));
    expect(living).toMatchObject({ revision: 484, week: 115, status: 'ACTIVE', health: 70, mind: 100, spirituality: 116, cash: 400, actionsRemaining: 1, injuryRisk: 0, random: { seed: SEED, cursor: 310 } });
    expect(living.balancer).toEqual(createBalancerState()); expect(Object.keys(living.progression.mastery)).toHaveLength(15);
    expect(readObjectEntry<SliceIntent[]>(DEAD, 'commands')).toHaveLength(477);
    expect(dead).toMatchObject({ revision: 478, status: 'DEAD', health: 0, injuryRisk: 3, ending: { kind: 'DEATH' } });
    const bytes = JSON.stringify(dead);
    for (const intent of [{ type: 'ACTION', action: 'REST' }, { type: 'BALANCER', command: { type: 'LEARN_GUIDANCE' } }] as const) expect(() => applySliceIntent(dead, intent)).toThrow();
    expect(JSON.stringify(dead)).toBe(bytes); assertValidSliceState(dead); assertValidSliceState(living);
  });

  it('replays all 594 public commands from original creation and seed through every exact saved milestone', () => {
    const commands = entry<SliceIntent[]>('commands'), commandBytes = JSON.stringify(commands), expected = final();
    const milestones = new Map(SNAPSHOTS.map(name => { const s = snapshot(name); return [s.revision, s] as const; }));
    let replay = createSliceRun(expected.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    expect(replay).toEqual(migrateSliceState(entry<unknown>('initial')));
    expect(commands).toHaveLength(594);
    for (const command of commands) {
      expect(validateSlicePayload(command)).toBe(true); replay = applySliceIntent(replay, command);
      const milestone = milestones.get(replay.revision); if (milestone) expect(replay).toEqual(milestone);
    }
    expect(replay).toEqual(expected); expect(JSON.stringify(commands)).toBe(commandBytes);
    expect(replay.random).toEqual({ seed: SEED, cursor: 367 }); assertValidSliceState(replay);
  }, 30_000);

  it('indexes 76 distinct boundaries in 85 JSON files and replays every recorded before/intent/final transition', () => {
    const index = boundaryIndex(); expect(Object.keys(index)).toHaveLength(76); expect(new Set(Object.values(index)).size).toBe(76);
    expect(readdirSync(ROOT).filter(name => name.endsWith('.json'))).toHaveLength(85);
    expect(entry('snapshots')).toEqual(Object.fromEntries(SNAPSHOTS.map(name => [name, `snapshot-${name}.json`])));
    for (const [name, file] of Object.entries(index)) {
      expect(file).toBe(`boundary-${name}.json`); const b = boundary(name), bytes = JSON.stringify(b.beforeLast);
      expect(validateSlicePayload(b.lastIntent), name).toBe(true); expect(b.final.revision, name).toBe(b.beforeLast.revision + 1);
      expect(applySliceIntent(b.beforeLast, b.lastIntent), name).toEqual(b.final); expect(JSON.stringify(b.beforeLast), name).toBe(bytes);
      expect(b.final.random.seed, name).toBe(SEED); expect(b.final.random.cursor, name).toBeGreaterThanOrEqual(b.beforeLast.random.cursor);
    }
    for (const name of SNAPSHOTS) { const s = snapshot(name); expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s); assertValidSliceState(s); }
  }, 60_000);

  it('pays the actual 60-penny clinic charge plus the weekly 30-penny bill before rest clears revision 482 HEAVY', () => {
    const old = prefix(), first = boundary('clinic-real-rest-1'), paid = boundary('clinic-actual-pay60'), rest = boundary('clinic-real-rest-2'), treated = snapshot('treated');
    expect(old.injuries).toHaveLength(1); expect(old.injuries[0]).toMatchObject({ acquiredRevision: 482, severity: 'HEAVY', treatedRevision: null });
    expect(first.beforeLast).toEqual(old); expect(first.final).toMatchObject({ health: 78, cash: 400, actionsRemaining: 0 });
    expect(paid.beforeLast).toEqual(first.final); expect(paid.lastIntent).toMatchObject({ type: 'EVENT_CHOICE', choiceId: 'PAY' });
    expect(entry<unknown[]>('treatments')).toEqual([{ paidPennies: 60, before: { cash: 400, health: 78, risk: 0, week: 115, revision: 485, injuries: old.injuries }, cashAfter: 310, healthAfter: 78, injuriesAfter: [{ ...old.injuries[0]!, treatedRevision: 486 }] }]);
    expect(paid.beforeLast.cash - paid.final.cash).toBe(60 + 30); expect(paid.final.health).toBe(78);
    expect(paid.final.injuries).toEqual([{ ...old.injuries[0]!, treatedRevision: 486 }]); expect(paid.final.date).toEqual(addGameDays(paid.beforeLast.date, 7));
    expect(rest.beforeLast).toEqual(paid.final); expect(rest.final).toEqual(treated);
    expect(treated).toMatchObject({ revision: 487, week: 116, health: 86, cash: 310, actionsRemaining: 2, injuries: [], injuryRisk: 0, random: { seed: SEED, cursor: 310 } });
    oldFacts(treated, old);
  });

  it('records paid guidance, three distinct preparations and five jobs on the one original bottle', () => {
    const s = snapshot('promoted'), journal = s.balancer.acquisitionJournal; expect(journal).toHaveLength(12);
    const guidance = journal.filter(e => e.command.type === 'LEARN_GUIDANCE'); expect(guidance).toHaveLength(1);
    expect([guidance[0]!.before.cash - guidance[0]!.after.cash, guidance[0]!.before.actions - guidance[0]!.after.actions]).toEqual([500, 1]);
    const tasks = journal.filter(e => e.command.type === 'PREPARE_TASK');
    expect(tasks.map(e => e.command.type === 'PREPARE_TASK' && e.command.taskId)).toEqual(['REVIEW_RECORDS', 'CHECK_LIMITS', 'MARK_EXIT']);
    const jobs = journal.filter(e => e.command.type === 'POTION_WORK'); expect(jobs).toHaveLength(5);
    expect(jobs.map(e => e.command)).toEqual(Array.from({ length: 5 }, () => ({ type: 'POTION_WORK', bottleId: 'balancer-potion-1' })));
    expect([...tasks, ...jobs].every(e => e.before.actions - e.after.actions === 1 && e.before.cash === e.after.cash)).toBe(true);
    const bought = journal.find(e => e.command.type === 'BUY_POTION')!, prepared = journal.find(e => e.command.type === 'PREPARE_PROMOTION')!;
    expect([bought.before.cash - bought.after.cash, bought.before.actions - bought.after.actions]).toEqual([900, 0]);
    expect([prepared.before.cash - prepared.after.cash, prepared.before.actions - prepared.after.actions]).toEqual([140, 1]);
    expect(journal.reduce((sum, e) => sum + e.before.cash - e.after.cash, 0)).toBe(1540);
    expect(journal.filter(e => e.command.type === 'REQUEST_SUPPLY' || e.command.type === 'RECEIVE_SUPPLY')).toEqual([]);
    expect(validateBalancerAcquisitionJournal(s)).toBe(true); expect(validateBalancerJournalContinuity(s)).toBe(true);
  });

  it('earns first-bottle SUCCESS at the unchanged next d100 and adds only two zero-mastery abilities', () => {
    const b = boundary('consume-balancer-potion-1'), s = snapshot('promoted'), old = prefix(); expect(b.final).toEqual(s);
    expect(s.balancer.acquisitionJournal.at(-1)!.check).toMatchObject({ ability: 'will', chance: 38, roll: 36, tier: 'SUCCESS' });
    expect(s.balancer.bottles[0]).toMatchObject({ id: 'balancer-potion-1', status: 'CONSUMED', labourSteps: 5, acquiredWeek: 126, consumedWeek: 126, preparationWeek: 126, outcome: 'SUCCESS' });
    expect(s.balancer.bottles.slice(1)).toEqual(old.balancer.bottles.slice(1));
    expect(s.balancer).toMatchObject({ promotionWeek: 126, chaosHunterActingAtPromotion: 100, preparedWeek: null, resupply: { requestedWeek: null, deliveries: 0 } });
    expect(s.balancer.promotionWeek! - old.chaosHunter.promotionWeek!).toBe(20);
    expect(s).toMatchObject({ health: 100, mind: 85, spirituality: 120, cash: 90, progression: { sequence: 2, acting: 0 } });
    expect([b.beforeLast.mind - s.mind, s.health - b.beforeLast.health, s.spirituality - b.beforeLast.spirituality]).toEqual([15, 0, 0]);
    expect(s.cash).toBe(b.beforeLast.cash); expect(s.actionsRemaining).toBe(b.beforeLast.actionsRemaining); expect(s.random).toEqual({ seed: SEED, cursor: b.beforeLast.random.cursor + 1 });
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(BALANCER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); oldFacts(s, old);
  });

  it('buys the single existing guide plate for 30 pennies with its original integrity 65 and source snapshot', () => {
    const b = boundary('buy-original-guide-plate-once'), s = b.final, old = prefix();
    expect(b.beforeLast.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'GUIDE', holder: 'GUIDE', location: 'START', integrity: 65, acquiredWeek: null });
    expect(s.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 126 });
    expect(b.beforeLast.cash - s.cash).toBe(30); expect(s.actionsRemaining).toBe(b.beforeLast.actionsRemaining); expect(s.random).toEqual(b.beforeLast.random);
    expect(s.balancer.life.source).toMatchObject({ root: 'chaosHunter.life', promotionWeek: 126, introducedWeek: 126, guardPlate: b.beforeLast.balancer.life.guardPlate });
    expect(s.balancer.life.source!.snapshot).toEqual(old.chaosHunter.life);
    expect(s.chaosHunter.life).toEqual({ ...old.chaosHunter.life, clockSeconds: old.chaosHunter.life.clockSeconds + 2 });
    expect(s.chaosHunter.life.clockSeconds - b.beforeLast.chaosHunter.life.clockSeconds).toBe(2);
    const bytes = JSON.stringify(s); expect(() => applySliceIntent(s, { type: 'BALANCER', command: { type: 'BUY_GUARD_PLATE' } })).toThrow(); expect(JSON.stringify(s)).toBe(bytes);
  });

  it('senses only the already-visible 120 mm offset, pays 5 spirituality and earns 8 mastery after honest return', () => {
    const b = boundary('visible-imbalance-imbalance_sensing-4-actual'), s = b.final, event = s.balancer.life.journal.at(-1)!;
    expect(event.check).toMatchObject({ ability: 'perception', chance: 60, roll: 17, tier: 'SUCCESS' });
    expect(event.source).toMatchObject({ actorLocation: 'A', currentConsent: 'GRANTED', volunteerId: 'CH3-MIRA', objectId: 'CH3-PARCEL', objectLocation: 'B', distanceMetres: 4, physicalTruth: { displacementMm: 120, obscuredByPaper: false } });
    expect(s.balancer.life.operation.truth).toEqual(b.beforeLast.balancer.life.operation.truth);
    expect(s.balancer.life.cases['visible-imbalance'].attempts.at(-1)).toMatchObject({ sensingTier: 'SUCCESS', sensingAnswer: { kind: 'VISIBLE_DEVIATION', displacementMm: 120 }, verifiedOffsetMm: null, resultRead: false });
    expect([b.beforeLast.actionsRemaining - s.actionsRemaining, b.beforeLast.spirituality - s.spirituality, b.beforeLast.mind - s.mind]).toEqual([1, 5, 2]);
    expect(s.random).toEqual({ seed: SEED, cursor: 312 });
    const report = boundary('visible-imbalance-honest-report').final, attempt = report.balancer.life.cases['visible-imbalance'].attempts.at(-1)!;
    expect(attempt).toMatchObject({ verifiedOffsetMm: 120, playerTravelMetres: 16, elapsedSeconds: 41, resultRead: true, objectsReturned: true, closed: true, result: 'ABILITY', appliedAbilityIds: [SENSE] });
    expect(report.progression.mastery[SENSE]).toBe(8); expect(report.progression.mastery[RESIST]).toBe(0);
  });

  it('retains failed covered sensing, respects withdrawal and obtains the offset only through real manual inspection', () => {
    const failed = boundary('withdrawn-inspection-imbalance_sensing-4-actual'), withdrawn = boundary('withdrawn-inspection-withdraw_permission-5-actual'), uncovered = boundary('withdrawn-inspection-remove_cover-7-actual');
    expect(failed.final.balancer.life.journal.at(-1)!.check).toMatchObject({ roll: 74, tier: 'FAILURE' });
    expect(failed.final.balancer.life.cases['withdrawn-inspection'].attempts.at(-1)).toMatchObject({ sensingAnswer: { kind: 'UNRESOLVED', displacementMm: null }, verifiedOffsetMm: null, spiritualitySpent: 5, mindSpent: 4 });
    expect(failed.final.balancer.life.operation.truth!.obscuredByPaper).toBe(true);
    expect(withdrawn.final.balancer.life.cases['withdrawn-inspection'].attempts.at(-1)).toMatchObject({ consent: 'WITHDRAWN', permissionWithdrawn: true });
    expect(withdrawn.final.balancer.life.operation).toEqual(withdrawn.beforeLast.balancer.life.operation); expect(withdrawn.final.random).toEqual(withdrawn.beforeLast.random);
    expect(() => applySliceIntent(withdrawn.final, { type: 'BALANCER', command: { type: 'IMBALANCE_SENSING', caseId: 'withdrawn-inspection' } })).toThrow();
    expect(uncovered.beforeLast.chaosHunter.life.playerLocation).toBe('B'); expect(uncovered.final.chaosHunter.life.paper).toMatchObject({ holder: 'PLAYER', location: 'B' });
    expect(uncovered.final.balancer.life.operation.truth!.obscuredByPaper).toBe(false);
    const report = boundary('withdrawn-inspection-honest-report').final;
    expect(report.balancer.life.cases['withdrawn-inspection'].attempts.at(-1)).toMatchObject({ sensingTier: 'FAILURE', consent: 'WITHDRAWN', coverRemoved: true, verifiedOffsetMm: 120, objectsReturned: true, closed: true, result: 'ORDINARY', playerTravelMetres: 16, appliedAbilityIds: [] });
    expect(BALANCER_ABILITY_IDS.map(id => report.progression.mastery[id])).toEqual([8, 0]);
  });

  it('keeps resistance FAILURE and the safe ordinary brace without impact damage, plate wear or resistance mastery', () => {
    const failed = boundary('measured-impact-measured_resistance-5-actual'), brace = boundary('measured-impact-ordinary_brace-7-actual'), s = snapshot('practiced');
    expect(failed.final.balancer.life.journal.at(-1)!.check).toMatchObject({ ability: 'knowledge', chance: 52, roll: 55, tier: 'FAILURE' });
    expect([failed.beforeLast.actionsRemaining - failed.final.actionsRemaining, failed.beforeLast.spirituality - failed.final.spirituality, failed.beforeLast.mind - failed.final.mind]).toEqual([1, 6, 4]);
    expect(failed.final.balancer.life.operation.effect).toBeNull(); expect(failed.final.random).toEqual({ seed: SEED, cursor: 314 });
    expect(brace.beforeLast.chaosHunter.life.parcel).toMatchObject({ holder: 'PLAYER', location: 'B', quantity: 1, massGrams: 350 });
    expect(brace.final.chaosHunter.life.parcel).toMatchObject({ holder: 'TABLE', location: 'B', quantity: 1 });
    expect(brace.final.health).toBe(brace.beforeLast.health); expect(brace.final.balancer.life.guardPlate).toEqual(brace.beforeLast.balancer.life.guardPlate);
    expect(s.balancer.life.cases['measured-impact'].attempts.at(-1)).toMatchObject({ resistanceTier: 'FAILURE', result: 'ORDINARY', spiritualitySpent: 6, mindSpent: 4, healthLost: 0, appliedAbilityIds: [], impact: { actor: 'PLAYER', target: 'PLAYER', objectId: 'CH3-PARCEL', mode: 'ORDINARY_BRACE', healthLoss: 0, plateWear: 0, resistanceApplied: false } });
    expect(s.balancer.life.guardPlate.integrity).toBe(65); expect(BALANCER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 0]);
    expect(s.balancer.life.reflected).toBe(true); expect(s.progression.acting).toBe(100);
  });

  it('preserves all 15 original skills and seven histories while only real movement and handovers change the original room', () => {
    const old = prefix(), s = snapshot('practiced'), room = s.chaosHunter.life, original = old.chaosHunter.life;
    oldFacts(s, old); oldFacts(final(), old); expect(old.combatHistory).toHaveLength(22);
    expect(room.guide).toEqual(original.guide); expect(room.volunteer).toEqual(original.volunteer); expect(room.paper).toEqual(original.paper); expect(room.table).toEqual(original.table);
    expect(room.parcel).toEqual({ ...original.parcel, handovers: original.parcel.handovers + 3, returns: original.parcel.returns + 3 });
    expect(room.line).toEqual({ ...original.line, returns: original.line.returns + 3 });
    expect([room.playerTravelMetres - original.playerTravelMetres, room.guideTravelMetres - original.guideTravelMetres, room.clockSeconds - original.clockSeconds]).toEqual([48, 40, 151]);
    expect(room.playerLocation).toBe('START'); expect(Object.keys(room).sort()).toEqual(Object.keys(original).sort());
    expect(BALANCER_CASE_IDS.map(id => s.balancer.life.cases[id].result)).toEqual(['ABILITY', 'ORDINARY', 'ORDINARY']);
    for (const id of BALANCER_CASE_IDS) expect(s.balancer.life.cases[id]).toMatchObject({ status: 'RESOLVED', contactOpen: false, returned: true, closes: 1 });
    expect(s.balancer.life.operation).toEqual({ door: 'OPEN', truth: null, effect: null });
  });

  it('pays encounter preparation and physically clears the same Mira, guide and originals before optional combat', () => {
    const paid = boundary('real-combat-preparation'), cleared = boundary('same-mira-and-guide-ordinary-clearance'), s = snapshot('combatStart'), old = prefix();
    expect(paid.lastIntent).toEqual({ type: 'BALANCER', command: { type: 'PREPARE_ENCOUNTER' } });
    expect([paid.beforeLast.mind - paid.final.mind, paid.beforeLast.cash - paid.final.cash, paid.beforeLast.actionsRemaining - paid.final.actionsRemaining]).toEqual([2, 0, 0]); expect(paid.final.random).toEqual(paid.beforeLast.random);
    expect(s.balancer.encounter.clearance).toMatchObject({ miraId: 'CH3-MIRA', miraConsent: 'GRANTED', miraMetres: 8, guideId: 'GUIDE', guideConsent: 'GRANTED', guideMetres: 4, playerMetres: 4, elapsedSeconds: 16, carriedItems: ['CH3-PARCEL', 'CH3-LINE', 'CH3-RULE-PAPER'] });
    expect(cleared.final.chaosHunter.life.clockSeconds - cleared.beforeLast.chaosHunter.life.clockSeconds).toBe(16);
    expect(s.chaosHunter.life.volunteer).toEqual({ ...old.chaosHunter.life.volunteer, location: 'OUTSIDE' });
    expect(s.chaosHunter.life.guide).toEqual({ ...old.chaosHunter.life.guide, location: 'OUTSIDE' });
    for (const item of [s.chaosHunter.life.parcel, s.chaosHunter.life.line, s.chaosHunter.life.paper]) expect(item).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE', quantity: 1 });
    expect(s.balancer.encounter).toMatchObject({ targetId: 'BA2-CASPAR', status: 'FIGHTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.balancer.encounter.originalEncounter).toEqual(old.chaosHunter.encounter); expect(s.balancer.encounter.originalHistory).toEqual(old.combatHistory);
    expect(s.balancer.encounter.startSource).toMatchObject({ targetAge: 46, actualBody: true, independentMind: true, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, randomSeed: SEED, randomCursor: 314 });
    expect(validateBalancerEncounter(s)).toBe(true);
  });

  it('projects actual public wheels, independent health and mind, paid powers and visible physical risk without mutating the save', () => {
    const s = snapshot('combatStart'), bytes = JSON.stringify(s), view = projectSliceState(s), combat = view.combat!;
    expect(combat.playerCountWheel).toEqual(BALANCER_COUNT_WHEEL); expect(combat.enemyCountWheel).toEqual(BALANCER_ENEMY_COUNT_WHEEL);
    expect(combat.enemyAbilityWheel).toEqual(BALANCER_ENEMY_ABILITY_WHEEL); expect(combat.playerAbilityWheel).toEqual(balancerAbilityWheel(s, null));
    expect(combat.enemyAbilityWheel.map(a => [a.id, a.weight])).toEqual([['ARC_BOLT', 35], ['WARD', 20], ['BODY_STRIKE', 20], ['COMPOSE', 10], ['MENTAL_PRESSURE', 10], ['ACCIDENT', 5]]);
    expect(combat.enemyAbilityWheel.find(a => a.id === 'MENTAL_PRESSURE')!.label).toContain('只造成精神后果');
    expect(combat.balancer).toMatchObject({ targetId: 'BA2-CASPAR', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, guardPlate: { integrity: 65 } });
    expect(combat.balancer!.summary).toContain('精神压力和弧光不受原板抗衡'); expect(combat.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(view.balancer.abilities).toHaveLength(17); expect(view.balancer.resources).toMatchObject({ health: 100, mind: 98, spirituality: 120 });
    expect(JSON.stringify(s)).toBe(bytes);
    const injured = boundary('combat-round-4').final, danger = projectSliceState(injured);
    expect(danger.balancer.injuryRisk).toBe(1); expect(danger.balancer.injuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
    expect(danger.combat!.consequenceWeights.death).toBeGreaterThan(combat.consequenceWeights.death);
  });

  it('retains five real rounds, unused paid abilities and the actual new HEAVY injury that precedes retreat', () => {
    const s = snapshot('combatTerminal'), old = prefix(), rounds = s.combatHistory.slice(old.combatHistory.length);
    expect(rounds.map(r => r.stance)).toEqual(['DEFEND', 'CONTROL', 'ATTACK', 'DEFEND', 'RETREAT']);
    expect(rounds.map(r => r.balancerOutcome!.randomCursorAfter)).toEqual([327, 336, 348, 364, 367]);
    for (const round of rounds) expect(validateBalancerCombatRound(round)).toBe(true);
    expect(rounds[0]!.balancerOutcome).toMatchObject({ playerHealthAfter: 90, playerMindAfter: 97, playerRiskAfter: 0 });
    const fourth = rounds[3]!.balancerOutcome!, sense = fourth.playerActions.find(a => a.id === SENSE && a.check)!, resist = fourth.playerActions.find(a => a.id === RESIST)!;
    expect(sense.check!.tier).toBe('GREAT_SUCCESS'); expect(resist.check!.tier).toBe('SUCCESS');
    expect([sense.paidCost, resist.paidCost, resist.mindCost]).toEqual([5, 6, 1]);
    expect(fourth.enemyActions.filter(a => a.id === 'COMPOSE')).toHaveLength(2);
    expect(rounds.flatMap(r => r.balancerOutcome!.playerActions).flatMap(a => a.masteryApplied)).toEqual([]);
    expect(rounds.flatMap(r => [...r.balancerOutcome!.playerActions, ...r.balancerOutcome!.enemyActions]).every(a => a.plateWear === 0)).toBe(true);
    expect(rounds[3]!).toMatchObject({ winner: 'ENEMY', consequenceDomain: 'BODY', consequenceRoll: 70 });
    expect(fourth).toMatchObject({ playerHealthAfter: 60, playerMindAfter: 96, playerRiskAfter: 1 });
    expect(rounds[4]!.balancerOutcome!.source.playerInjuries.at(-1)).toMatchObject({ acquiredRevision: 593, severity: 'HEAVY', treatedRevision: null });
    expect(rounds[4]!).toMatchObject({ stance: 'RETREAT', retreat: 'SUCCESS' }); expect(rounds[4]!.balancerOutcome!.playerActions).toEqual([]);
    expect(s.balancer.encounter.terminal).toEqual({ outcome: 'RETREATED', round: 5, historyIndex: 26, enemyHealth: 90, enemyMind: 100, enemySpirituality: 67, enemyStatus: 'RESISTING', exitMetres: 4, exitSeconds: 4 });
    expect(s).toMatchObject({ status: 'ACTIVE', health: 60, mind: 96, spirituality: 120, injuryRisk: 1 }); expect(s.injuries).toHaveLength(2);
    expect(s.chaosHunter.life.playerLocation).toBe('START'); expect(s.balancer.life.guardPlate).toMatchObject({ integrity: 65, location: 'START' });
    expect(BALANCER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 0]); oldFacts(s, old);
  });

  it('persists post-retreat WORK, the real weekly bill and both untreated injuries in the exact final save', () => {
    const b = boundary('ordinary-life-after-actual-exit'), s = final(); expect(b.beforeLast).toEqual(snapshot('combatTerminal'));
    expect(b.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' }); expect(b.final).toEqual(s);
    expect(s).toMatchObject({ revision: 595, week: 135, status: 'ACTIVE', health: 60, mind: 96, spirituality: 120, cash: 690, actionsRemaining: 3, injuryRisk: 1, random: { seed: SEED, cursor: 367 } });
    expect(s.date).toEqual(addGameDays(b.beforeLast.date, 7)); expect(s.cash - b.beforeLast.cash).toBe(180 - 30);
    expect(s.injuries).toEqual(b.beforeLast.injuries); expect(s.injuries.map(i => [i.acquiredRevision, i.severity, i.treatedRevision])).toEqual([[590, 'LIGHT', null], [593, 'HEAVY', null]]);
    expect(s.balancer.encounter).toEqual(b.beforeLast.balancer.encounter); expect(s.chaosHunter.life).toEqual(b.beforeLast.chaosHunter.life);
    expect(s.random).toEqual(b.beforeLast.random); expect(s.seer.completedSources).toEqual(b.beforeLast.seer.completedSources);
    expect(s.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(s.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s); assertValidSliceState(s);
  });

  it('rejects forged original plates, finance and source identities as well as future saves and malformed commands', () => {
    const s = snapshot('combatStart'), bytes = JSON.stringify(s);
    for (const mutate of [
      (bad: SliceState) => { bad.balancer.life.guardPlate.integrity = 64; },
      (bad: SliceState) => { bad.balancer.encounter.preparation!.finance.weeklyBudget++; },
      (bad: SliceState) => { bad.balancer.encounter.startSource!.targetId = 'CH3-EDRIC' as never; },
    ]) {
      const bad = structuredClone(s); mutate(bad); expect(validateBalancerEncounter(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: 999 })).toThrow(); expect(() => assertValidSliceState({ ...s, schemaVersion: 999 })).toThrow();
    for (const command of [{ type: 'BUY_GUARD_PLATE', free: true }, { type: 'IMBALANCE_SENSING', caseId: 'unknown' }, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact', health: 100 }, { type: 'CONSUME', bottleId: 'balancer-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'chaos-hunter-potion-1' }]) expect(validateSlicePayload({ type: 'BALANCER', command })).toBe(false);
    expect(JSON.stringify(s)).toBe(bytes); assertValidSliceState(s);
  });
});
