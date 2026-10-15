import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { validateMisfortuneKnightSource } from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_ABILITY_IDS, MISFORTUNE_KNIGHT_SOURCE_KEYS } from '../../src/domain/misfortune-knight/types.js';
import { currentMisfortuneKnightCombatSource, misfortuneKnightActionCount, misfortuneKnightEnemyActionCount } from '../../src/domain/misfortune-knight/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/misfortune-knight-v01910';
const SOURCE = 'tests/fixtures/concealment-servant-v01690/natural.json';
const PEACEFUL = 'tests/fixtures/concealment-servant-v01690/original-enemy-approach.json';
const SOURCE_SHA256 = 'b1edff5df12aa0b3a88aa16b2feee5ff63766ea15d4c7346b9ccb294f1c8c7b4';
const PEACEFUL_SHA256 = '667f41064ca3aedc76365a66a05bd26ec2fb47a20d6cbf74ffa744a88b778dba';
const [GUIDED, GUARD] = MISFORTUNE_KNIGHT_ABILITY_IDS;
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const captured = (key: string): SliceState => migrateSliceState(entry<unknown>(key));
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const index = (): Record<string, string> => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));
const boundary = (name: string) => {
  const filename = index()[name];
  if (!filename) throw new Error(`Missing actual Misfortune Knight boundary: ${name}`);
  const file = `${ROOT}/${filename}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string): SliceState => {
  const filename = entry<Record<string, string>>('snapshots')[name];
  if (!filename) throw new Error(`Missing actual Misfortune Knight snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${filename}`, 'utf8')));
};
async function hash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

// Actual same-seed outcome: two failed bottles, a third-bottle success, two
// applied life skills and one blocked guard, then nine fixed-CONTROL rounds
// ending in the player's real death. No later healing, exit or retry is added.
describe('Misfortune Knight exact original518-command public continuation', () => {
  it('pins raw historical files separately from the current migrated campaign', async () => {
    expect(await hash(SOURCE)).toBe(SOURCE_SHA256); expect(await hash(PEACEFUL)).toBe(PEACEFUL_SHA256);
    expect(readObjectEntry(SOURCE, 'final')).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166',
      revision: 529, status: 'DEAD', health: 0, random: { seed: 'sleepless-natural-v020', cursor: 432 }, ending: { kind: 'DEATH' } });
    expect(readObjectEntry(PEACEFUL, 'beforeLast')).toMatchObject({ schemaVersion: 166, contentVersion: 'concealment-servant-v166',
      revision: 519, status: 'ACTIVE', week: 121, health: 100, mind: 100, spirituality: 120, cash: 420, actionsRemaining: 3,
      injuryRisk: 0, injuries: [], random: { seed: 'sleepless-natural-v020', cursor: 341 } });
    expect(entry('final')).toMatchObject({ schemaVersion: 188, contentVersion: 'misfortune-knight-v188' });
    expect(await hash(`${ROOT}/natural.json`)).toBe('597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8');
  }, 120_000);

  it('replays the full untouched518-command prefix and every actual public continuation command', () => {
    const commands = entry<SliceIntent[]>('commands'), oldCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    expect(commands).toHaveLength(694); expect(oldCommands).toHaveLength(528); expect(entry('prefixCount')).toBe(518); expect(entry('prefixVerified')).toBe(true);
    same(commands.slice(0, 518), oldCommands.slice(0, 518)); same(oldCommands[518], readObjectEntry(PEACEFUL, 'lastIntent'));
    same(entry('creation'), readObjectEntry(SOURCE, 'creation')); expect(entry('seed')).toBe('sleepless-natural-v020');
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_PEACEFUL_BOUNDARY_BRANCH', source: SOURCE, sourceSha256: SOURCE_SHA256,
      peacefulSource: PEACEFUL, peacefulSha256: PEACEFUL_SHA256, originalDeathPreserved: true, newRandomChanges: false });
    expect(entry('strategy')).toEqual({ caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12 });
    const final = captured('final'), original = captured('prefixFinal');
    same(original, migrateSliceState(readObjectEntry<unknown>(PEACEFUL, 'beforeLast')));
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.entries()) {
      if (i >= 518) {
        const publicState = projectSliceState(state);
        if (intent.type === 'MISFORTUNE_KNIGHT') {
          const action = publicState.misfortuneKnight.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
          expect(action, `Command ${i + 1} must have its actual public control`).toBeDefined();
          expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
        } else if (intent.type === 'COMBAT_ROUND') {
          expect(publicState.status).toBe('ACTIVE'); expect(publicState.activeEvent).toBeNull();
          expect(publicState.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
        } else if (intent.type === 'ACTION') expect(publicState.canAct, publicState.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
      }
      state = applySliceIntent(state, intent);
      if (i === 517) same(state, original);
    }
    same(state, final); assertValidSliceState(state); same(migrateSliceState(state), state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull();
    expect(entry('continuationSource')).toBeNull(); expect(entry('stage')).toBe('NATURAL_ACTUAL_TERMINAL'); expect(entry('treatments')).toEqual([]);
    expect(Object.keys(index())).toHaveLength(80); expect(new Set(Object.values(index())).size).toBe(80);
    expect(Object.keys(entry<Record<string, string>>('snapshots'))).toEqual(['departure', 'promoted', 'practiced', 'combatStart', 'combatTerminal', 'actualTerminal']);
  }, 120_000);

  it('preserves eight original histories, eighteen inherited masteries, five zeros and historical deaths', () => {
    const original = captured('prefixFinal'), promoted = snapshot('promoted'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(18);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(5);
    for (const root of MISFORTUNE_KNIGHT_SOURCE_KEYS) {
      same(final.misfortuneKnight.sourceHistory![root], original[root]);
      same(promoted[root], original[root]);
      const current = structuredClone(final[root]);
      if (root !== 'spiritWarlock' && root !== 'concealmentServant') same(current, original[root]);
    }
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value);
    expect(Object.keys(final.progression.mastery)).toHaveLength(20); expect(MISFORTUNE_KNIGHT_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
    same(final.misfortuneKnight.encounter.originalHistory, original.combatHistory);
    expect(final.nightwatcher.encounter.enemy.status).toBe('DEAD'); expect(final.fearBishop.encounter.enemyStatus).toBe('SURRENDERED');
    same(final.concealmentServant.encounter, original.concealmentServant.encounter);
    for (const key of ['cases', 'journal', 'erin', 'page', 'trace', 'anchorLight'] as const) same(final.concealmentServant.life[key], original.concealmentServant.life[key]);
    const warlock = structuredClone(final.spiritWarlock); warlock.companion = original.spiritWarlock.companion; same(warlock, original.spiritWarlock);
    expect(original.spiritWarlock.companion).toEqual({ source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, invitedWeek: 53, releases: 1, deployments: 12, recalls: 12 });
    expect(final.character).toMatchObject({ name: original.character.name, gender: 'FEMALE', age: original.character.age });
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek); expect(validateMisfortuneKnightSource(final)).toBe(true);
  }, 120_000);

  it('keeps actual bottle checks, paid labour and professional preparation without healing or replacing the body', () => {
    const final = captured('final'), events = final.misfortuneKnight.acquisitionJournal;
    const consumption = events.filter(receipt => receipt.command.type === 'CONSUME');
    expect(consumption.map(receipt => [receipt.week, receipt.check!.roll, receipt.check!.chance, receipt.check!.tier, receipt.randomBefore, receipt.randomAfter])).toEqual([
      [132, 75, 50, 'FAILURE', 341, 342], [141, 56, 50, 'FAILURE', 342, 343], [151, 37, 50, 'SUCCESS', 343, 344],
    ]);
    expect(final.misfortuneKnight.bottles.map(bottle => [bottle.id, bottle.status, bottle.outcome])).toEqual([
      ['misfortune-knight-potion-1', 'CONSUMED', 'FAILURE'], ['misfortune-knight-potion-2', 'CONSUMED', 'FAILURE'], ['misfortune-knight-potion-3', 'CONSUMED', 'SUCCESS'],
    ]);
    for (const receipt of consumption) {
      if (receipt.command.type !== 'CONSUME') throw new Error('Expected the actual consumed bottle.');
      const bottleId = receipt.command.bottleId, dose = boundary(`consume-${bottleId}`); same(applySliceIntent(dose.before, dose.intent), dose.final);
      expect(receipt.randomAfter).toBe(receipt.randomBefore! + 1); expect(receipt.after.gender).toBe(receipt.before.gender);
      same({ ...dose.final.character, coreStats: dose.before.character.coreStats }, dose.before.character); expect(dose.final.spirituality).toBe(dose.before.spirituality);
      expect(dose.final.misfortuneKnight.bottles.find(bottle => bottle.id === bottleId)?.status).toBe('CONSUMED');
      expect(dose.final.misfortuneKnight.preparedWeek).toBeNull(); same(receipt.after.injuries, receipt.before.injuries);
      for (const [id, value] of Object.entries(receipt.before.mastery)) expect(receipt.after.mastery[id], id).toBe(value);
      if (receipt.after.sequence === 1) {
        expect(dose.final.health).toBe(dose.before.health); expect(dose.final.mind).toBe(dose.before.mind - 15);
        expect(dose.final.character.coreStats).toEqual({ physique: 31, perception: 29, will: 31, knowledge: 24 });
        expect(MISFORTUNE_KNIGHT_ABILITY_IDS.map(id => dose.final.progression.mastery[id])).toEqual([0, 0]);
      } else expect([receipt.after.health - receipt.before.health, receipt.after.mind - receipt.before.mind]).toEqual([-15, -25]);
    }
    for (const receipt of events.filter(receipt => receipt.command.type === 'BUY_POTION')) {
      if (receipt.command.type !== 'BUY_POTION') throw new Error('Expected purchase.');
      const bottleId = receipt.command.bottleId;
      expect(events.filter(row => row.command.type === 'POTION_WORK' && row.command.bottleId === bottleId)).toHaveLength(5);
      expect(receipt.before.cash - receipt.after.cash).toBe(1100);
    }
    for (const receipt of events.filter(receipt => receipt.command.type === 'PREPARE_PROMOTION')) expect(receipt.before.cash - receipt.after.cash).toBe(150);
    expect(final.misfortuneKnight.promotionWeek).toBe(151);
    expect(final.misfortuneKnight.promotionWeek! - captured('prefixFinal').concealmentServant.promotionWeek!).toBeGreaterThanOrEqual(12);
  }, 120_000);

  it('uses one actual original-box motion after the paid guided attempt and records its independent result', () => {
    const cast = boundary('pending-parcel-paid-guided-mishap-attempt'), caught = boundary('pending-parcel-actual-independent-catch');
    same(applySliceIntent(cast.before, cast.intent), cast.final); same(applySliceIntent(caught.before, caught.intent), caught.final);
    expect([cast.before.spirituality - cast.final.spirituality, cast.before.mind - cast.final.mind]).toEqual([6, 2]);
    expect(cast.final.progression.mastery[GUIDED]).toBe(0);
    expect(cast.final.misfortuneKnight.life.practice.pendingGuided).toEqual({ caseId: 'pending-parcel', createdAt: 77, expiresAt: 107, permissionRevision: 4, bonus: 10 });
    expect(cast.final.misfortuneKnight.life.cases['pending-parcel']).toMatchObject({ guidedAttempted: true, parcelAttempted: false, guidedApplied: false, result: 'NONE' });
    same(cast.final.concealmentServant.life.box, cast.before.concealmentServant.life.box);
    expect(caught.final.misfortuneKnight.life.practice.pendingGuided).toBeNull(); expect(caught.final.misfortuneKnight.life.cases['pending-parcel'].parcelAttempted).toBe(true);
    expect(caught.final.progression.mastery[GUIDED]).toBe(0);
    expect(caught.final.misfortuneKnight.life.cases['pending-parcel']).toMatchObject({ guidedOutcome: 'SUCCESS', operationOutcome: 'SUCCESS', guidedEnd: 'APPLIED', guidedApplied: true, result: 'ABILITY' });
    expect(caught.final.lastCheck!.modifiers).toEqual([{ source: '这一次尚未发生的原盒接取', value: 10 }]);
    const practiced = snapshot('practiced'), life = practiced.misfortuneKnight.life, original = captured('prefixFinal');
    expect(life.journal.filter(row => row.command.type === 'GUIDED_MISHAP')).toHaveLength(1);
    expect(life.journal.filter(row => row.command.type === 'CATCH_PARCEL')).toHaveLength(1);
    for (const receipt of life.journal) same(receipt.companion, original.spiritWarlock.companion);
    expect(life.journal.filter(row => row.check).map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter])).toEqual([
      ['GUIDED_MISHAP', 31, 70, 76, 'SUCCESS', 344, 345], ['CATCH_PARCEL', 29, 51, 92, 'SUCCESS', 345, 346],
      ['BOUNDED_NIGHT_GUARD', 24, 32, 62, 'SUCCESS', 346, 347], ['BOUNDED_NIGHT_GUARD', 24, 13, 62, 'SUCCESS', 347, 348],
    ]);
    expect(life.cases['pending-parcel']).toMatchObject({ status: 'RESOLVED', returned: true });
    expect(life.journal.reduce((sum, row) => sum + row.boxMovedMetres, 0)).toBe(practiced.concealmentServant.life.box.travelMetres - life.sourceOriginals!.box.travelMetres);
    expect(life.journal.reduce((sum, row) => sum + row.playerWalkedMetres, 0)).toBe(life.practice.playerTravelMetres);
    expect(life.journal.reduce((sum, row) => sum + row.elapsedSeconds, 0)).toBe(life.practice.elapsedSeconds);
    expect(life.practice).toMatchObject({ elapsedSeconds: 476, playerTravelMetres: 360 });
    expect(practiced.concealmentServant.life).toMatchObject({ clockSeconds: 632, box: { travelMetres: 20 } });
    expect(['actions', 'cash', 'spirituality', 'mind', 'health'].map(key => life.journal.reduce((sum, row) => sum + row.before[key as keyof typeof row.before] - row.after[key as keyof typeof row.after], 0))).toEqual([10, 60, 22, 8, 0]);
    expect(boundary('pending-parcel-honest-report').final.progression.mastery[GUIDED]).toBe(8);
  }, 120_000);

  it('keeps real guard wear, unreleased withdrawal and ordinary cleanup separate from actual application', () => {
    const guard = boundary('personal-dark-guard-paid-guard-and-real-wear'), impact = boundary('personal-dark-guard-actual-light-impact');
    for (const save of [guard, impact]) same(applySliceIntent(save.before, save.intent), save.final);
    expect([guard.before.spirituality - guard.final.spirituality, guard.before.mind - guard.final.mind]).toEqual([8, 3]);
    expect(guard.final.misfortuneKnight.life.practice.plate.integrity).toBe(guard.before.misfortuneKnight.life.practice.plate.integrity - 10);
    expect(guard.final.misfortuneKnight.life.practice.rig.weightState).toBe('ARMED'); expect(guard.final.misfortuneKnight.life.cases['personal-dark-guard'].guardApplied).toBe(false);
    expect(guard.final.misfortuneKnight.life.practice.pendingGuard).toEqual({ caseId: 'personal-dark-guard', createdAt: 223, expiresAt: 253, permissionRevision: 4, reduction: 10 });
    expect(guard.final.progression.mastery[GUARD]).toBe(0); expect(impact.final.misfortuneKnight.life.cases['personal-dark-guard'].impactReleased).toBe(true);
    expect(impact.final.misfortuneKnight.life.cases['personal-dark-guard']).toMatchObject({ guardOutcome: 'SUCCESS', guardEnd: 'APPLIED', guardApplied: true, result: 'ABILITY' });
    expect(impact.final.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'STOPPED', remainingForce: 0, absorbedForce: 10 });
    for (const name of ['withdrawn-path-actual-original-door-obstruction', 'withdrawn-path-current-owner-withdrawal', 'withdrawn-path-actual-unreleased-weight-stop',
      'withdrawn-path-ordinary-clear-original-door', 'withdrawn-path-ordinary-safe-handling-after-withdrawal', 'withdrawn-path-same-original-box-returned',
      'withdrawn-path-same-worn-plate-returned', 'withdrawn-path-same-tray-and-tools-returned', 'withdrawn-path-actual40metre-return']) {
      const save = boundary(name); same(applySliceIntent(save.before, save.intent), save.final);
      expect([save.final.spirituality, save.final.mind]).toEqual([save.before.spirituality, save.before.mind]);
      expect(save.final.misfortuneKnight.life.practice.plate.integrity).toBe(save.before.misfortuneKnight.life.practice.plate.integrity);
    }
    const blocked = boundary('withdrawn-path-actual-original-door-obstruction'), withdrawn = boundary('withdrawn-path-current-owner-withdrawal');
    expect(blocked.final.concealmentServant.life.room.doorBlocked).toBe(true); expect(blocked.final.misfortuneKnight.life.practice.pendingGuard).toBeNull();
    expect(withdrawn.final.misfortuneKnight.life.cases['withdrawn-path'].permission.owner).toBe('WITHDRAWN');
    expect(withdrawn.final.misfortuneKnight.life.practice.rig.weightState).toBe('ARMED');
    const practiced = snapshot('practiced'), life = practiced.misfortuneKnight.life;
    expect(life.cases['withdrawn-path']).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY', guardOutcome: 'SUCCESS', guardEnd: 'BLOCKED', guardApplied: false, impactReleased: false, returned: true });
    expect(life.practice).toMatchObject({ activeCase: null, playerLocation: 'YARD', boxHolder: 'START', pendingGuided: null, pendingGuard: null,
      plate: { holder: 'OWNER', integrity: 45, wear: 20 }, tray: { location: 'OWNER' }, rig: { borrowed: false, weightState: 'OWNER', releases: 1 } });
    expect(life.reflected).toBe(true); expect(practiced.progression.acting).toBe(100); expect(projectSliceState(practiced).misfortuneKnight.insideCase).toBe(false);
    expect(MISFORTUNE_KNIGHT_ABILITY_IDS.map(id => practiced.progression.mastery[id])).toEqual([8, 8]);
    same(practiced.spiritWarlock.companion, captured('prefixFinal').spiritWarlock.companion);
    expect(practiced.concealmentServant.life.erin.location).toBe('EXIT'); expect(life.practice.technician.location).toBe('EXIT');
  }, 120_000);

  it('replays each actual round from its saved source, keeping real counts, BODY and MENTAL consequences and finite costs', () => {
    const final = captured('final'), rounds = final.combatHistory.filter(round => round.misfortuneKnightOutcome);
    expect(rounds.map(round => [round.round, round.winner, round.consequenceDomain ?? null, round.playerCount, round.enemyCount, round.playerCountRoll, round.enemyCountRoll])).toEqual([
      [1, 'ENEMY', 'BODY', 3, 3, 50, 31], [2, 'PLAYER', null, 4, 2, 56, 16], [3, 'PLAYER', null, 3, 1, 41, 3],
      [4, 'ENEMY', 'BODY', 1, 4, 8, 59], [5, 'PLAYER', 'BODY', 4, 3, 57, 42], [6, 'PLAYER', null, 4, 4, 52, 69],
      [7, 'ENEMY', 'BODY', 4, 3, 59, 40], [8, 'ENEMY', 'MENTAL', 4, 2, 72, 15], [9, 'ENEMY', 'BODY', 2, 5, 19, 76],
    ]);
    expect(rounds.map(round => [round.misfortuneKnightOutcome!.source.randomCursor, round.misfortuneKnightOutcome!.randomCursorAfter])).toEqual([
      [348, 359], [359, 369], [369, 377], [377, 387], [387, 399], [399, 411], [411, 423], [423, 433], [433, 444],
    ]);
    for (const round of rounds) {
      const save = boundary(`combat-round-${round.round}`), outcome = round.misfortuneKnightOutcome!;
      expect(save.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' }); same(applySliceIntent(save.before, save.intent), save.final);
      same(outcome.source, currentMisfortuneKnightCombatSource(save.before)); same(save.final.lastCombatRound, round);
      expect(round.playerCount).toBe(misfortuneKnightActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(misfortuneKnightEnemyActionCount(round.enemyCountRoll));
      expect(outcome.playerActions).toHaveLength(round.playerCount); expect(outcome.enemyActions).toHaveLength(round.enemyCount);
      expect(outcome.source).toMatchObject({ targetId: 'MK1-ALDEN-WARD', targetAge: 46, actualBody: true, independentMind: true, policy: 'ALL', randomSeed: 'sleepless-natural-v020' });
      for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
        expect(action.materialsBefore.weapon.charge - action.materialsAfter.weapon.charge).toBe(action.rodChargeSpent);
        if (action.plateWear) expect(action.materialsBefore.plate!.integrity - action.materialsAfter.plate!.integrity).toBe(action.plateWear);
        if (action.finiteResult === 'PENDING') expect(action.masteryApplied).toEqual([]);
        if (action.selectedAbility === 'MIND_PRESSURE') expect(action.attackKind).toBe('MENTAL');
      }
      if (round.consequenceDomain === 'MENTAL') same(outcome.playerInjuriesAfter, outcome.source.playerInjuries);
      expect(outcome.companion.source).toBe('SW5-LEAF-1'); expect(outcome.companion.deployments).toBe(outcome.companion.recalls);
      same(save.final.progression.mastery, save.before.progression.mastery);
    }
    const mental = rounds[7]!; expect(mental.consequenceWeights).toBeNull(); expect(mental.misfortuneKnightOutcome).toMatchObject({ playerHealthAfter: 30, playerMindAfter: 90, playerRiskAfter: 2 });
    const actions = rounds.flatMap(round => [...round.misfortuneKnightOutcome!.playerActions, ...round.misfortuneKnightOutcome!.enemyActions]);
    expect(actions.filter(action => action.selectedAbility === 'MIND_PRESSURE')).toHaveLength(7);
    const newPlans = actions.filter(action => action.planned === GUIDED || action.planned === GUARD);
    expect(newPlans).toHaveLength(6); for (const action of newPlans) expect(action).toMatchObject({ selectedAbility: 'BLOCK', finiteResult: 'UNAVAILABLE', paidCost: 0, mindCost: 0, masteryApplied: [] });
    expect(actions.flatMap(action => action.masteryApplied)).toEqual([]);
    expect(final.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', deployments: 15, recalls: 15 });
    expect(final.misfortuneKnight.encounter).toMatchObject({ spiritDeployments: 3, spiritAssists: 1, spiritRecalls: 3,
      guidedMishapAttempts: 0, guidedMishapSuccesses: 0, nightGuardAttempts: 0, nightGuardSuccesses: 0, totalOwnerMindSpent: 0 });
  }, 120_000);

  it('reopens the exact final JSON without restoring health, resources, spent material or the original dead branch', () => {
    const final = captured('final'), bytes = stableStringify(final), reopened = migrateSliceState(JSON.parse(JSON.stringify(final)));
    assertValidSliceState(reopened); same(reopened, final); same(projectSliceState(reopened), projectSliceState(final)); expect(stableStringify(final)).toBe(bytes);
    expect(final).toMatchObject({ status: 'DEAD', revision: 695, week: 159, health: 0, mind: 90, spirituality: 120, cash: 510, actionsRemaining: 1,
      injuryRisk: 3, combat: null, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 8 }, ending: { kind: 'DEATH' }, random: { seed: 'sleepless-natural-v020', cursor: 444 } });
    expect(final.injuries.map(row => [row.severity, row.acquiredRevision, row.treatedRevision])).toEqual([['LIGHT', 687, null], ['HEAVY', 690, null], ['HEAVY', 693, null]]);
    expect(final.misfortuneKnight.encounter).toMatchObject({ status: 'LOST', enemyHealth: 90, enemyMind: 100, enemySpirituality: 18, enemyStatus: 'RESISTING',
      terminal: { outcome: 'PLAYER_DEAD', round: 9, historyIndex: 35, exitMetres: 0, exitSeconds: 0 },
      scene: { playerLocation: 'YARD', playerCoordinate: 4, playerTravelMetres: 8, clockSeconds: 544 },
      materials: { weapon: { location: 'HAND', charge: 0 }, plate: { id: 'MK1-BATTLE-WOOD-PLATE', paidPennies: 40, location: 'YARD', integrity: 65 } } });
    expect(entry<SliceIntent[]>('commands').at(-1)).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    same(final, boundary('combat-round-9').final); same(final, snapshot('actualTerminal')); same(final, snapshot('combatTerminal'));
    expect(index()['actual-ordinary-encounter-exit']).toBeUndefined(); expect(index()['ordinary-life-after-exit']).toBeUndefined();
    expect(projectSliceState(final).canAct).toBe(false);
    for (const intent of [{ type: 'ACTION', action: 'REST' }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'MISFORTUNE_KNIGHT', command: { type: 'LEAVE_ENCOUNTER' } }] as SliceIntent[]) {
      expect(() => applySliceIntent(final, intent)).toThrow(); expect(stableStringify(final)).toBe(bytes);
    }
    expect(readObjectEntry<SliceState>(SOURCE, 'final').status).toBe('DEAD');
  }, 120_000);
});
