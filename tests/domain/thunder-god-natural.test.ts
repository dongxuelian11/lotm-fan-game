import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { validateThunderGodSource } from '../../src/domain/thunder-god/index.js';
import { THUNDER_GOD_ABILITY_IDS, THUNDER_GOD_SOURCE_KEYS } from '../../src/domain/thunder-god/types.js';
import { thunderGodExpectedOriginals, thunderGodLifeMasteryGains } from '../../src/domain/thunder-god/life.js';
import { currentThunderGodCombatSource, replayThunderGodCombatRound, thunderGodActionCount, thunderGodEnemyActionCount } from '../../src/domain/thunder-god/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const ROOT = 'tests/fixtures/thunder-god-v01930';
const SOURCE = 'tests/fixtures/catastrophe-v01710/natural.json';
const PEACEFUL = 'tests/fixtures/catastrophe-v01710/original-enemy-approach.json';
const SOURCE_SHA = 'cb8649c4d3dc15b5fa61601591eaed3f99579082f01bffa4f566afbf7ed8dc53';
const PEACEFUL_SHA = '3ee5d4bfb9582aabb88a477bd5f0b5a47c335e8dbe5074b0eafbafff35d8b448';
const [GUIDED, GUARD] = THUNDER_GOD_ABILITY_IDS;
const entry = <T>(key: string): T => readObjectEntry<T>(`${ROOT}/natural.json`, key);
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const canonicalHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const boundaryFiles: Record<string, string> = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8'));
const snapshotFiles = entry<Record<string, string>>('snapshots');
// Reuse read-only migrated checkpoints; boundary states remain short-lived.
const checkpoints = new Map<string, SliceState>();
const captured = (key: string): SliceState => {
  if (!checkpoints.has(key)) checkpoints.set(key, migrateSliceState(entry<unknown>(key)));
  return checkpoints.get(key)!;
};
const snapshot = (name: string): SliceState => {
  const filename = snapshotFiles[name];
  if (!filename) throw new Error(`Missing actual Thunder God snapshot: ${name}`);
  const key = `snapshot:${name}`;
  if (!checkpoints.has(key)) checkpoints.set(key, migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${filename}`, 'utf8'))));
  return checkpoints.get(key)!;
};
const boundary = (name: string) => {
  const filename = boundaryFiles[name];
  if (!filename) throw new Error(`Missing actual Thunder God boundary: ${name}`);
  const path = `${ROOT}/${filename}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(path, 'final')) };
};
const publicControl = (state: SliceState, intent: SliceIntent) => {
  const view = projectSliceState(state);
  if (intent.type === 'THUNDER_GOD') {
    const action = view.thunderGod.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(action, `Public control for ${JSON.stringify(intent)}`).toBeDefined();
    expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action);
    expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(choice => choice.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull();
    expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
};
const replayBoundary = (name: string) => {
  const save = boundary(name); publicControl(save.before, save.intent);
  same(applySliceIntent(save.before, save.intent), save.final); return save;
};
async function fileHash(path: string) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

// Frozen actual route: the original599 living prefix, three failed bottles,
// a paid later-week fourth bottle, three honest life reports and ten fixed
// ALL/CONTROL rounds ending in death. No seed search or post-death continuation.
describe('Thunder God exact original599-command public continuation', () => {
  it('pins raw168 sources and raw190 capture independently of current migration', async () => {
    expect(await fileHash(SOURCE)).toBe(SOURCE_SHA); expect(await fileHash(PEACEFUL)).toBe(PEACEFUL_SHA);
    expect(await fileHash(`${ROOT}/natural.json`)).toBe('d682e3656fa4f8fb70f09e38b71355c50b4657c5ab7263201afa3c97b2c3f8b1');
    const rawSource = readObjectEntry<SliceState>(PEACEFUL, 'beforeLast');
    expect(rawSource).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168', revision: 600,
      status: 'ACTIVE', week: 138, health: 100, mind: 100, spirituality: 120, cash: 350, actionsRemaining: 3,
      injuries: [], injuryRisk: 0, random: { seed: 'sailor-natural-v026', cursor: 267 } });
    expect(canonicalHash(rawSource)).toBe('e589b7ed4483b3ffa0420147312798779da7fe80313552e855b5954f7dbe4bd6');
    expect(readObjectEntry(SOURCE, 'final')).toMatchObject({ schemaVersion: 168, contentVersion: 'catastrophe-v168',
      revision: 603, status: 'DEAD', health: 0, random: { seed: 'sailor-natural-v026', cursor: 282 }, ending: { kind: 'DEATH' } });
    expect(entry('final')).toMatchObject({ schemaVersion: 190, contentVersion: 'thunder-god-v190', status: 'DEAD' });
    expect(captured('final')).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    same(captured('prefixFinal'), migrateSliceState(rawSource));
  }, 60_000);

  it('replays all820 same-seed commands with every continuation control publicly available', () => {
    const commands = entry<SliceIntent[]>('commands'), oldCommands = readObjectEntry<SliceIntent[]>(SOURCE, 'commands');
    expect(commands).toHaveLength(820); expect(oldCommands).toHaveLength(602);
    expect(entry('prefixCount')).toBe(599); expect(entry('prefixVerified')).toBe(true);
    same(commands.slice(0, 599), oldCommands.slice(0, 599));
    expect(canonicalHash(commands.slice(0, 599))).toBe('07628a85b4aa55e280e48387c1065c735b958d71e85834466d306ff3b90b1a23');
    same(oldCommands[599], readObjectEntry(PEACEFUL, 'lastIntent'));
    same(entry('creation'), readObjectEntry(SOURCE, 'creation')); expect(entry('seed')).toBe('sailor-natural-v026');
    expect(entry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL599_LIVING_BOUNDARY_BRANCH', source: SOURCE,
      sourceSha256: SOURCE_SHA, peacefulSource: PEACEFUL, peacefulSha256: PEACEFUL_SHA, sourceRoot: 'beforeLast',
      rawSourceStateSha256: 'e589b7ed4483b3ffa0420147312798779da7fe80313552e855b5954f7dbe4bd6',
      rawSchemaVersion: 168, rawContentVersion: 'catastrophe-v168', original602CommandDeathPreserved: true, newRandomChanges: false });
    expect(entry('strategy')).toMatchObject({ caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL',
      combatRoundCap: 90, potionAttemptCap: 12, ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', potionLabourSteps: 5 });
    const final = captured('final');
    let state = createSliceRun(final.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed'));
    same(state, captured('initial'));
    for (const [i, intent] of commands.entries()) {
      if (i >= 599) publicControl(state, intent);
      const previousRevision = state.revision; state = applySliceIntent(state, intent);
      expect(state.revision).toBe(previousRevision + 1);
      if (i === 598) same(state, captured('prefixFinal'));
      if (i >= 599 && i < commands.length - 1) expect(state.status, `No early death at command ${i + 1}`).toBe('ACTIVE');
    }
    same(state, final); assertValidSliceState(state); same(migrateSliceState(state), state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(captured('initial').revision + commands.length);
    expect(entry('pendingIntent')).toBeNull(); expect(entry('error')).toBeNull(); expect(entry('continuationSource')).toBeNull();
    expect(entry('treatments')).toEqual([]); expect(entry('stage')).toBe('NATURAL_ACTUAL_TERMINAL');
    expect(Object.keys(boundaryFiles)).toHaveLength(222);
    expect(Object.keys(snapshotFiles)).toEqual(['departure', 'promoted', 'practiced', 'recoveredBeforeEncounter', 'combatStart', 'combatTerminal', 'actualTerminal']);
  }, 180_000);

  it('preserves eight frozen roots,22 old masteries with7 zeros, and credits only actual applications', () => {
    const original = captured('prefixFinal'), promoted = snapshot('promoted'), final = captured('final');
    expect(Object.keys(original.progression.mastery)).toHaveLength(22);
    expect(Object.values(original.progression.mastery).filter(value => value === 0)).toHaveLength(7);
    for (const root of THUNDER_GOD_SOURCE_KEYS) {
      same(final.thunderGod.sourceHistory![root], original[root]); same(promoted[root], original[root]);
      if (root !== 'catastrophe') same(final[root], original[root]);
    }
    same(final.thunderGod.sourceScene, promoted.thunderGod.sourceScene);
    same(final.thunderGod.sourceScene!.originals, original.catastrophe.life.site);
    same(final.catastrophe.encounter, original.catastrophe.encounter);
    expect(final.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, attemptWeek: null });
    same(final.combatHistory.slice(0, original.combatHistory.length), original.combatHistory); same(final.town, original.town);
    same({ ...final.character, coreStats: original.character.coreStats }, original.character);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(final.character.coreStats[key]).toBe(original.character.coreStats[key] + 1);
    expect(final.progression.promotionWeek).toBe(original.progression.promotionWeek);
    expect(THUNDER_GOD_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0]);
    expect(thunderGodLifeMasteryGains(final)).toEqual({ [GUIDED]: 8, [GUARD]: 8 });
    const applied = final.combatHistory.flatMap(round => round.thunderGodOutcome
      ? [...round.thunderGodOutcome.playerActions, ...round.thunderGodOutcome.enemyActions].flatMap(action => action.masteryApplied) : []);
    expect(applied).toEqual(['tyrant.s9.balance']);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(final.progression.mastery[id], id).toBe(value + (id === 'tyrant.s9.balance' ? 8 : 0));
    expect(Object.keys(final.progression.mastery)).toHaveLength(24);
    expect(Object.values(final.progression.mastery).filter(value => value === 0)).toHaveLength(7);
    expect(THUNDER_GOD_ABILITY_IDS.map(id => final.progression.mastery[id])).toEqual([8, 8]);
    expect(validateThunderGodSource(final)).toBe(true);
  }, 60_000);

  it('replays three failed bottles, paid next-week resupply and the fourth actual successful bottle', () => {
    const guidance = replayBoundary('actual500p-guidance-and-frozen-eight-root-source');
    expect(guidance.before.cash - guidance.final.cash).toBe(500);
    for (let n = 1; n <= 4; n++) {
      const bottleId = `thunder-god-potion-${n}`;
      const buy = replayBoundary(`actual1100p-buy-${bottleId}`), prepared = replayBoundary(`actual150p-current-week-preparation-${bottleId}`);
      const dose = replayBoundary(`actual-consumption-${bottleId}`);
      expect(buy.before.cash - buy.final.cash).toBe(1100); expect(prepared.before.cash - prepared.final.cash).toBe(150);
      expect(dose.before).toMatchObject({ health: 100, mind: 100, spirituality: 120, seer: { pollution: 0 } });
      expect(dose.before.thunderGod.preparedWeek).toBe(dose.before.week); expect(dose.final.thunderGod.preparedWeek).toBeNull();
      expect(dose.final.thunderGod.bottles[n - 1]).toMatchObject({ id: bottleId, status: 'CONSUMED', labourSteps: 5, outcome: n === 4 ? 'SUCCESS' : 'FAILURE' });
      expect(dose.final).toMatchObject(n === 4 ? { health: 100, mind: 85, progression: { sequence: 1 } }
        : { health: 85, mind: 75, seer: { pollution: 30 }, progression: { sequence: 2 } });
      expect(() => applySliceIntent(dose.final, dose.intent)).toThrow();
    }
    const request = replayBoundary('request-real-supply-after-3-failures');
    expect(request.before.thunderGod.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    expect([request.before.cash - request.final.cash, request.before.actionsRemaining - request.final.actionsRemaining]).toEqual([100, 1]);
    expect(request.final.thunderGod.resupply).toEqual({ requestedWeek: 169, deliveries: 0 });
    expect(() => applySliceIntent(request.final, { type: 'THUNDER_GOD', command: { type: 'RECEIVE_SUPPLY' } })).toThrow();
    const received = replayBoundary('actual-later-week-new-supply-3');
    expect(received.before.week).toBe(170); expect(received.before.week).toBeGreaterThan(request.final.week);
    same(received.final.thunderGod.bottles.slice(0, 3), received.before.thunderGod.bottles);
    expect(received.final.thunderGod.bottles.slice(3).map(bottle => [bottle.id, bottle.stockedWeek, bottle.status, bottle.labourSteps]))
      .toEqual([['thunder-god-potion-4', 170, 'SUPPLIER', 0], ['thunder-god-potion-5', 170, 'SUPPLIER', 0], ['thunder-god-potion-6', 170, 'SUPPLIER', 0]]);
    const promoted = snapshot('promoted'), journal = promoted.thunderGod.acquisitionJournal;
    expect(journal.filter(row => row.command.type === 'CONSUME').map(row => [row.week, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]))
      .toEqual([[149, 84, 44, 'FAILURE', 267, 268], [159, 75, 44, 'FAILURE', 268, 269], [168, 94, 44, 'FAILURE', 269, 270], [178, 36, 44, 'SUCCESS', 270, 271]]);
    expect(journal.filter(row => row.command.type === 'POTION_WORK')).toHaveLength(20);
    expect(journal.filter(row => row.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(journal.reduce((sum, row) => sum + row.before.cash - row.after.cash, 0)).toBe(5600);
    expect(journal.reduce((sum, row) => sum + row.before.actions - row.after.actions, 0)).toBe(29);
    expect(promoted).toMatchObject({ revision: 733, week: 178, cash: 30, actionsRemaining: 1, character: { coreStats: { physique: 35, perception: 28, will: 28, knowledge: 22 } } });
    expect(promoted.thunderGod.promotionWeek! - captured('prefixFinal').catastrophe.promotionWeek!).toBeGreaterThanOrEqual(12);
  }, 60_000);

  it('applies guided thunder only through the subsequent separate target discharge and honest report', () => {
    const cast = replayBoundary('located-target-one-paid-guided-thunder-attempt');
    expect([cast.before.spirituality - cast.final.spirituality, cast.before.mind - cast.final.mind]).toEqual([8, 2]);
    expect(cast.final.thunderGod.life.pending).toMatchObject({ kind: 'GUIDED', caseId: 'located-target', targetId: 'TG1-TARGET-1', bonus: 10 });
    expect(cast.final.thunderGod.life.target).toMatchObject({ durability: 100, marks: 0, location: 'HOLDER', pulse: 'ARMED' });
    expect(cast.final.progression.mastery[GUIDED]).toBe(0);
    const hit = replayBoundary('located-target-separate-actual-will-check-and-original-target-hit-or-miss');
    expect(hit.final.lastCheck).toMatchObject({ roll: 74, chance: 90, tier: 'SUCCESS', modifiers: [{ source: '同一已定位原靶的有限雷势引导', value: 10 }] });
    expect(hit.final.thunderGod.life.pending).toBeNull(); expect(hit.final.progression.mastery[GUIDED]).toBe(0);
    expect(hit.final.thunderGod.life.target).toMatchObject({ durability: 95, marks: 1, pulse: 'SPENT' });
    expect(hit.final.thunderGod.life.cases['located-target'].attempts[0]).toMatchObject({ dischargeAttempted: true, targetHit: true,
      guided: { attempts: 1, successes: 1, effects: 1, state: 'APPLIED' } });
    expect(replayBoundary('located-target-honest-actual-result-and-cost-report').final.progression.mastery[GUIDED]).toBe(8);
  }, 60_000);

  it('pays for guard and prevents only the declared5-health bodily impact while the actual scene has0AP', () => {
    const cast = replayBoundary('personal-impact-one-paid-guard-attempt');
    expect([cast.before.actionsRemaining, cast.final.actionsRemaining]).toEqual([0, 0]);
    expect([cast.before.spirituality - cast.final.spirituality, cast.before.mind - cast.final.mind]).toEqual([6, 2]);
    expect(cast.final.thunderGod.life.pending).toMatchObject({ kind: 'GUARD', caseId: 'personal-impact', targetId: 'TG1-PAD-1' });
    expect(cast.final.progression.mastery[GUARD]).toBe(0); expect(projectSliceState(cast.final).canAct).toBe(false);
    expect(() => applySliceIntent(cast.final, { type: 'ACTION', action: 'REST' })).toThrow();
    const impact = replayBoundary('personal-impact-actual-declared-impact-with-current-guard');
    expect(impact.final.thunderGod.life.journal.at(-1)!.source).toMatchObject({ effectType: 'BODY', rawHealthLoss: 5, preventedHealthLoss: 5 });
    expect([impact.final.health, impact.final.mind, impact.final.spirituality, impact.final.actionsRemaining]).toEqual([100, 98, 114, 0]);
    same(impact.final.injuries, impact.before.injuries); expect(impact.final.injuryRisk).toBe(impact.before.injuryRisk);
    expect(impact.final.thunderGod.life.pending).toBeNull(); expect(impact.final.progression.mastery[GUARD]).toBe(0);
    expect(impact.final.thunderGod.life.pad).toMatchObject({ durability: 90, impacts: 1, manualResets: 0 });
    expect(impact.final.thunderGod.life.cases['personal-impact'].attempts[0]).toMatchObject({ healthLost: 0, healthPrevented: 5,
      guard: { attempts: 1, successes: 1, effects: 1, state: 'APPLIED' } });
    const leave = replayBoundary('personal-impact-end-current-contact-and-finn-actually-leaves');
    expect([leave.before.week, leave.before.actionsRemaining, leave.final.week, leave.final.actionsRemaining]).toEqual([182, 0, 183, 3]);
    expect(replayBoundary('personal-impact-honest-actual-result-and-cost-report').final.progression.mastery[GUARD]).toBe(8);
  }, 60_000);

  it('invalidates the second successful guided window and preserves real0AP withdrawal cleanup', () => {
    const cast = replayBoundary('obscured-return-one-paid-guided-thunder-attempt');
    expect(cast.final.thunderGod.life.pending).toMatchObject({ kind: 'GUIDED', conditionVersion: 4 });
    const changed = replayBoundary('obscured-return-finn-actually-closes-original-hood-and-changes-version');
    expect(changed.final.thunderGod.life.pending).toBeNull();
    expect(changed.final.thunderGod.life.target).toMatchObject({ hood: 'CLOSED', line: 'OBSCURED' });
    expect(changed.final.thunderGod.life.cases['obscured-return'].attempts[0]!.guided).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'INVALIDATED' });
    for (const name of ['current-keeper-withdrawal', 'ordinary-stop-after-withdrawal', 'ordinary-real-walk-and-open-same-hood',
      'ordinary-retrieve-same-original-to-player-pack', 'actual-twelve-metre-route-exit-and-keeper-return', 'end-current-contact-and-finn-actually-leaves']) {
      const save = replayBoundary(`obscured-return-${name}`), receipt = save.final.thunderGod.life.journal.at(-1)!;
      expect(save.before.actionsRemaining).toBe(0); expect([receipt.before.actions, receipt.after.actions]).toEqual([0, 0]);
      expect([receipt.before.spirituality - receipt.after.spirituality, receipt.before.mind - receipt.after.mind]).toEqual([0, 0]);
      expect(save.final.progression.mastery[GUIDED]).toBe(8);
    }
    const result = snapshot('practiced').thunderGod.life.cases['obscured-return'];
    expect(result).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY', returned: true });
    expect(result.attempts[0]).toMatchObject({ dischargeAttempted: false, conditionChanged: true, pulseStopped: true, hoodCleared: true, targetRetrieved: true, closed: true });
  }, 60_000);

  it('balances three real life reports, original water and tools, new walking and keeper-energy debits', () => {
    const practiced = snapshot('practiced'), life = practiced.thunderGod.life;
    const before = captured('prefixFinal').catastrophe.life.site, after = practiced.catastrophe.life.site;
    expect(life.journal.filter(row => row.check).map(row => [row.command.type, row.checkBase, row.check!.roll, row.check!.chance, row.check!.tier, row.randomBefore, row.randomAfter]))
      .toEqual([['GUIDED_THUNDER', 28, 17, 70, 'SUCCESS', 271, 272], ['DISCHARGE_TARGET', 28, 74, 90, 'SUCCESS', 272, 273],
        ['STORM_BRACE', 28, 55, 70, 'SUCCESS', 273, 274], ['GUIDED_THUNDER', 28, 60, 70, 'SUCCESS', 274, 275]]);
    expect((['actions', 'cash', 'spirituality', 'mind', 'health'] as const).map(key => life.journal.reduce((sum, row) => sum + row.before[key] - row.after[key], 0)))
      .toEqual([12, 90, 22, 6, 0]);
    const elapsed = life.journal.reduce((sum, row) => sum + row.elapsedSeconds, 0);
    const playerWalk = life.journal.reduce((sum, row) => sum + row.playerWalkedMetres, 0);
    const keeperWalk = life.journal.reduce((sum, row) => sum + row.keeperWalkedMetres, 0);
    const keeperEnergy = life.journal.reduce((sum, row) => sum + row.keeperEnergySpent, 0);
    expect([elapsed, playerWalk, keeperWalk, keeperEnergy]).toEqual([298, 96, 36, 3]);
    expect([after.clockSeconds, after.playerTravelMetres, after.keeper.travelMetres, after.keeper.energy])
      .toEqual([before.clockSeconds + elapsed, before.playerTravelMetres + playerWalk, before.keeper.travelMetres + keeperWalk, before.keeper.energy - keeperEnergy]);
    for (const key of ['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel'] as const) same(after[key], before[key]);
    same(after, thunderGodExpectedOriginals(practiced)); same(captured('final').catastrophe.life.site, after);
    expect(after).toMatchObject({ clockSeconds: 421, playerPosition: 'EXIT', playerTravelMetres: 108, keeper: { alive: true, position: 'CONTROL', energy: 85, travelMetres: 72 } });
    expect(life).toMatchObject({ reflected: true, activeCase: null, pending: null, clockSeconds: 421, elapsedSeconds: 298,
      playerLocation: 'OUTSIDE', playerTravelMetres: 96, keeperPresent: false,
      finn: { alive: true, health: 100, mind: 100, present: false, location: 'AWAY', travelMetres: 60 },
      target: { owner: 'PLAYER', location: 'PLAYER', durability: 95, marks: 1, hood: 'OPEN', line: 'CLEAR', pulse: 'STOPPED' },
      pad: { owner: 'PLAYER', location: 'PLAYER', durability: 90, registered: false, impacts: 1 } });
    expect(life.journal.reduce((sum, row) => sum + row.finnWalkedMetres, 0)).toBe(life.finn.travelMetres);
    expect(Object.values(life.cases).map(row => [row.result, row.returned, row.contactOpen])).toEqual([['ABILITY', true, false], ['ABILITY', true, false], ['ORDINARY', true, false]]);
    expect([practiced.progression.acting, practiced.progression.mastery[GUIDED], practiced.progression.mastery[GUARD]]).toEqual([100, 8, 8]);
  }, 60_000);

  it('replays all10 real rounds with ordered RNG slots, finite resources and independent BODY versus MENTAL effects', () => {
    const final = captured('final'), rounds = final.combatHistory.filter(round => round.thunderGodOutcome);
    expect(rounds.map(round => [round.round, round.winner, round.consequenceDomain ?? null, round.playerCount, round.enemyCount, round.playerCountRoll, round.enemyCountRoll]))
      .toEqual([[1, 'ENEMY', 'BODY', 3, 6, 41, 98], [2, 'ENEMY', 'BODY', 3, 4, 33, 66], [3, 'ENEMY', 'BODY', 4, 2, 63, 20],
        [4, 'ENEMY', 'BODY', 3, 2, 34, 22], [5, 'PLAYER', null, 4, 4, 70, 51], [6, 'ENEMY', 'BODY', 2, 4, 17, 74],
        [7, 'ENEMY', 'MENTAL', 1, 2, 3, 22], [8, 'PLAYER', 'BODY', 6, 5, 99, 80], [9, 'PLAYER', null, 3, 2, 44, 25], [10, 'ENEMY', 'BODY', 2, 4, 18, 61]]);
    expect(rounds.map(round => [round.thunderGodOutcome!.source.randomCursor, round.thunderGodOutcome!.randomCursorAfter]))
      .toEqual([[275, 293], [293, 307], [307, 319], [319, 328], [328, 341], [341, 354], [354, 361], [361, 380], [380, 391], [391, 404]]);
    expect(rounds.map(round => [round.thunderGodOutcome!.playerHealthAfter, round.thunderGodOutcome!.playerMindAfter]))
      .toEqual([[90, 100], [60, 100], [50, 100], [20, 100], [20, 100], [10, 100], [10, 90], [10, 90], [10, 88], [0, 84]]);
    for (const round of rounds) {
      const save = replayBoundary(`combat-round-${round.round}`), outcome = round.thunderGodOutcome!;
      expect(save.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
      same(outcome.source, currentThunderGodCombatSource(save.before)); same(replayThunderGodCombatRound(outcome.source, 'CONTROL').round, round);
      same(save.final.lastCombatRound, round); same(save.final.progression.mastery, outcome.masteryAfter);
      expect(outcome.source).toMatchObject({ targetId: 'TG1-OREN-GAGE', targetAge: 48, actualBody: true, independentMind: true,
        policy: 'ALL', clubHeld: false, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, randomSeed: 'sailor-natural-v026' });
      expect(round.playerCount).toBe(thunderGodActionCount(round.playerCountRoll)); expect(round.enemyCount).toBe(thunderGodEnemyActionCount(round.enemyCountRoll));
      expect(outcome.playerActions).toHaveLength(round.playerCount); expect(outcome.enemyActions).toHaveLength(round.enemyCount);
      const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
      same(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })));
      expect(round.first).toBe(round.round % 2 === 1 ? 'PLAYER' : 'ENEMY'); expect(actions[0]!.actor).toBe(round.first);
      expect(actions.map(action => action.order)).toEqual(actions.map((_, i) => i));
      let cursor = outcome.source.randomCursor + 2;
      for (const [i, action] of actions.entries()) {
        expect(action.atSeconds).toBe(outcome.source.root.clockSeconds + i * 5); expect(action.elapsedSeconds).toBe(5);
        expect(action.randomCursorBefore).toBeGreaterThanOrEqual(cursor); expect(action.randomCursorAfter).toBeGreaterThanOrEqual(action.randomCursorBefore);
        expect(action.randomCursorAfter - action.randomCursorBefore).toBe(Number(action.check !== null) + Number(action.resistanceRoll !== null));
        cursor = action.randomCursorAfter;
        expect(action.materialsBefore.weapon.charge - action.materialsAfter.weapon.charge).toBe(action.rodChargeSpent);
        if (action.actor === 'PLAYER') expect(action.physicalFactor).toBe([1, 1, .95, .9, .8, .8, .8, .8, .8, .8][round.round - 1]);
        if (action.selectedAbility === 'SEA_SONG' && action.succeeded) expect(action.attackKind).toBe('MENTAL');
      }
      // One final winner draw, plus a bodily consequence draw only when needed.
      expect(outcome.randomCursorAfter - cursor).toBe(1 + Number(round.consequenceDomain === 'BODY'));
      expect(outcome.rootAfter.clockSeconds - outcome.source.root.clockSeconds).toBe(60);
      expect(outcome.source.playerSpirituality - outcome.playerSpiritualityAfter).toBe(outcome.playerActions.reduce((sum, action) => sum + action.paidCost, 0));
      expect(outcome.source.body.enemySpirituality - outcome.enemySpirituality).toBe(outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
      expect(outcome.source.playerMind - outcome.playerMindAfter).toBe(outcome.playerActions.reduce((sum, action) => sum + action.mindCost, 0) + (round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0));
      expect(save.final.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
      if (round.consequenceDomain === 'MENTAL') {
        expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
        same(outcome.playerInjuriesAfter, outcome.source.playerInjuries);
        expect(outcome.playerRiskAfter).toBe(outcome.source.playerRisk); expect(outcome.playerHealthAfter).toBe(outcome.source.playerHealth);
      }
    }
    const playerActions = rounds.flatMap(round => round.thunderGodOutcome!.playerActions), enemyActions = rounds.flatMap(round => round.thunderGodOutcome!.enemyActions);
    expect([playerActions.reduce((n, action) => n + action.paidCost, 0), playerActions.reduce((n, action) => n + action.mindCost, 0),
      enemyActions.reduce((n, action) => n + action.paidCost, 0), enemyActions.reduce((n, action) => n + action.rodChargeSpent, 0)]).toEqual([25, 6, 118, 4]);
    expect(playerActions.filter(action => action.selectedAbility === GUIDED).map(action => [action.finiteResult, action.paidCost, action.mindCost, action.masteryApplied]))
      .toEqual([['FAILED', 8, 2, []], ['RESISTED', 8, 2, []]]);
    expect(playerActions.filter(action => action.selectedAbility === GUARD).map(action => [action.finiteResult, action.paidCost, action.mindCost, action.masteryApplied])).toEqual([['FAILED', 6, 2, []]]);
    expect(final.thunderGod.encounter).toMatchObject({ inheritedApplications: { 'tyrant.s9.balance': 1 }, totalOwnerMindSpent: 6,
      guidedThunderAttempts: 2, guidedThunderChecks: 0, guidedThunderSuccesses: 0, stormBraceAttempts: 1, stormBraceChecks: 0, stormBraceSuccesses: 0,
      powerUses: { LIGHTNING: 4, WIND_WARD: 4, SEA_SONG: 9, OBSCURE: 1 } });
  }, 60_000);

  it('reopens the actual death with closed controls, preserving both deaths and no invented exit or paid work', () => {
    const final = captured('final'), terminal = boundary('combat-round-10');
    same(terminal.final, final); same(snapshot('combatTerminal'), final); same(snapshot('actualTerminal'), final);
    same(captured('beforeLast'), terminal.before); same(entry('lastIntent'), terminal.intent);
    expect(entry<SliceIntent[]>('commands').at(-1)).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(final).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      status: 'DEAD', revision: 821, week: 187, health: 0, mind: 84, spirituality: 106, cash: 930, actionsRemaining: 1,
      injuryRisk: 5, combat: null, activeEvent: null, ending: { kind: 'DEATH' }, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 20 },
      random: { seed: 'sailor-natural-v026', cursor: 404 } });
    expect(final.injuries.map(row => [row.severity, row.acquiredRevision, row.treatedRevision])).toEqual([
      ['LIGHT', 812, null], ['HEAVY', 813, null], ['LIGHT', 814, null], ['HEAVY', 815, null], ['LIGHT', 817, null]]);
    expect(final.thunderGod.encounter).toMatchObject({ status: 'LOST', enemyHealth: 90, enemyMind: 100, enemySpirituality: 2, enemyStatus: 'RESISTING',
      terminal: { outcome: 'PLAYER_DEAD', round: 10, historyIndex: 27, exitMetres: 0, exitSeconds: 0 },
      scene: { playerLocation: 'PLATFORM', playerCoordinate: 4, playerTravelMetres: 10, clockSeconds: 604 },
      materials: { weapon: { location: 'HAND', charge: 0, condition: 100 } } });
    const reopened = migrateSliceState(JSON.parse(JSON.stringify(final))); assertValidSliceState(reopened);
    same(reopened, final); const view = projectSliceState(reopened); same(view, projectSliceState(final));
    expect(view.canAct).toBe(false); expect(view.combat).toBeNull(); expect(view.thunderGod.actions.some(action => action.enabled)).toBe(false);
    const before = stableStringify(reopened);
    for (const intent of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
      { type: 'COMBAT_ROUND', stance: 'CONTROL' }, { type: 'THUNDER_GOD', command: { type: 'LEAVE_ENCOUNTER' } }] satisfies SliceIntent[]) {
      expect(() => applySliceIntent(reopened, intent)).toThrow();
      expect(stableStringify(reopened)).toBe(before);
    }
    const oldDeath = migrateSliceState(readObjectEntry<unknown>(SOURCE, 'final'));
    expect(oldDeath).toMatchObject({ status: 'DEAD', health: 0, revision: 603, ending: { kind: 'DEATH' } });
    expect(projectSliceState(oldDeath).canAct).toBe(false);
  }, 60_000);
});
