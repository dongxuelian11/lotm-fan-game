import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateSlicePayload } from '../../dist/domain/slice/validation.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
import { validateTimeWormSource } from '../../dist/domain/time-worm/index.js';
import { timeWormExpectedOriginals, timeWormLifeMasteryGains } from '../../dist/domain/time-worm/life.js';

// Freeze this strategy AND all product mechanisms before the first run. Execute
// once from the repository root, only after the serial lead's release preflight.
// Replay the full actual 551-command Error source, including its wounds and
// retreat. No earlier peaceful replacement, directed origin, seed/cursor edit,
// state patch, favourable-roll search, outcome reload, free refill, adaptive
// stance, fixture overwrite, or automatic publication is permitted.
const source = 'tests/fixtures/fate-trojan-v01750/natural.json';
const peacefulSource = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
const originalDeathSource = 'tests/fixtures/deceit-mentor-v01510/natural.json';
const SOURCE_HASH = '4669ff84e79414608c873031a6a46fcfb11727c84eee5ef52a473e6685304c08';
const PEACEFUL_HASH = 'e8ee10feef684891b509016e10c135260835703f572e9c624168996f66cfc381';
const ORIGINAL_DEATH_HASH = 'eb720bdd47384fd4741ebf0afa3020d6b55263fb6ebb2c1f68a5e69468b85dda';
const PREFIX_COMPACT_HASH = 'fe805c7924a0b0009fff1b6cf49cbc8571555a60989271994c26ef162bb35dc2';
const RAW_INITIAL_COMPACT_HASH = '8da3665e38f0f26f0508f587bf2e6c692f0e142c6346304db90a03f772cff1d5';
const RAW_FINAL_COMPACT_HASH = '5971e5ca7dea4e8296f33812953f243766690e8dc76acbc1980238958f5b3efc';
const prefixCount = 551;
const ROOTS = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor', 'fateTrojan'];
const CASES = ['delayed-observation', 'released-interval', 'withdrawn-delay'];
const NEW_IDS = ['error.s1.short-time-theft', 'error.s1.time-release'];
const strategy = deepFreeze({
  source: 'FULL_551_ACTUAL_ACTIVE_FINAL', sourceSeed: 'marauder-natural-v038', sourceCursor: 361,
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90,
  potionAttemptCap: 12, potionLabourSteps: 5, maxCommands: 3500, ordinaryPreparationCap: 600,
  originalWoundRecovery: 'KNOWN_CLINIC_PAID60_THEN_REAL_REST_UNTIL_HEALED',
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST',
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  energyRecovery: { minimumBeforeCase: 9, command: 'RECOVER_ENERGY', onlyOutsideAfterPromotion: true },
  delayedRoute: ['SHORT_TIME_THEFT_ONCE', 'WAIT_3_ONLY_IF_DELAYED', 'EXECUTE_LOOK'],
  releaseRoute: ['SHORT_TIME_THEFT_ONCE', 'TIME_RELEASE_ONCE_ONLY_IF_STORED', 'COMPARE_LABEL_ONCE', 'WAIT_1_UNTIL_TARGET_DUE', 'EXECUTE_LOOK'],
  withdrawalRoute: ['SHORT_TIME_THEFT_ONCE', 'WAIT_1_ONLY_IF_DELAYED', 'WITHDRAW_ABILITY', 'CAPTURE_REMAINING_TARGET_DELAY', 'WAIT_1_UNTIL_TARGET_DUE', 'EXECUTE_LOOK'],
  everyCaseExit: ['EXIT_ROOM', 'LEAVE', 'REPORT'], reflection: 'AFTER_THREE_ACTUAL_REPORTS',
  failureHandling: 'RETAIN_COSTS_AND_FAILED_CHECKS_USE_ORDINARY_COMPLETION_NO_ABILITY_RETRY',
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});
// One exact projection-only repair continuation. The first639 applied commands,
// failures, resources and random cursor are already immutable evidence. This
// option never replays them, accepts another directory, or changes the strategy.
const resumeExact639 = process.argv.length === 3 && process.argv[2] === '--resume-exact639';
assert(process.argv.length === 2 || resumeExact639, 'Usage: time-worm-stage.mjs [--resume-exact639]');
const FIRST_BLOCKER_DIRECTORY = 'output/play/time-worm-01970-Dxns4f';
const FIRST_PRODUCER_HASH = '17bad40046874e8cc5d739a1e1a2508c42968a44cf8d55e55bc7622aad4eacea';
const FIRST_BLOCKER_HASH = '125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd';
const FIRST_INTEGRITY_HASH = '769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc';
const FIRST_STATE_HASH = 'a6204310e886e0b400b4daced33d73bfe0debbce1929a333cc37792b7737e21d';
const producerHash = fileDigest(fileURLToPath(import.meta.url));
verifySourceFiles();
const old = Object.fromEntries(['provenance', 'continuation', 'initial', 'creation', 'seed', 'commands', 'prefixCount', 'inheritedPrefixCount', 'final'].map(k => [k, readObjectEntry(source, k)]));
const peaceful = Object.fromEntries(['initial', 'creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(peacefulSource, k)]));
const originalDeath = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(originalDeathSource, k)]));
assert.equal(old.commands.length, prefixCount); assert.equal(old.prefixCount, 451); assert.equal(old.inheritedPrefixCount, 352);
assert.equal(old.provenance.kind, 'SAME_SEED_PUBLIC_NATURAL_PREFIX'); assert.equal(old.provenance.newRandomChanges, false);
assert.equal(old.initial.schemaVersion, 172); assert.equal(old.final.schemaVersion, 172); assert.equal(old.final.contentVersion, 'fate-trojan-v172');
assert.equal(old.seed, strategy.sourceSeed); assert.deepEqual(old.initial.random, { seed: old.seed, cursor: 0 });
assert.equal(compactDigest(old.initial), RAW_INITIAL_COMPACT_HASH); assert.equal(compactDigest(old.commands), PREFIX_COMPACT_HASH); assert.equal(compactDigest(old.final), RAW_FINAL_COMPACT_HASH);
assert.equal(peaceful.commands.length, 451); assert.deepEqual(old.commands.slice(0, 451), peaceful.commands);
assert.deepEqual(old.creation, peaceful.creation); assert.equal(old.seed, peaceful.seed);
assert.equal(originalDeath.commands.length, 456); assert.equal(originalDeath.final.status, 'DEAD'); assert.equal(originalDeath.final.health, 0);
assert.equal(originalDeath.final.week, 108); assert.equal(originalDeath.final.random.cursor, 319);
assert.deepEqual(originalDeath.creation, old.creation); assert.equal(originalDeath.seed, old.seed);

mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/time-worm-01970-');
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {}, treatments = [], uniqueTransitions = [], withdrawalEvidence = [];
const capturedSteps = new Map(), snapshotSteps = new Map();
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' }); writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = migrateSliceState(old.initial);
const initial = structuredClone(s);
let original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, failurePhase = 'INITIALIZATION', saved = false, continuationSource = null;
const view = () => projectSliceState(s).timeWorm;
const life = () => s.timeWorm.life;
const currentAttempt = caseId => life().cases[caseId].attempts.at(-1);
const site = () => s.fateTrojan.life.site;
const sourceOriginals = state => ({ site: structuredClone(state.fateTrojan.life.site) });
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality,
  cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk,
  random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting });
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function verifySourceFiles() {
  assert.equal(fileDigest(source), SOURCE_HASH, 'Continue the exact original551-command living final, including wounds and retreat');
  assert.equal(fileDigest(peacefulSource), PEACEFUL_HASH, 'The inherited451-command peaceful source is retained as history only');
  assert.equal(fileDigest(originalDeathSource), ORIGINAL_DEATH_HASH, 'The separate456-command death capture is immutable and never revived');
}
function originals() {
  assert(original);
  for (const root of ROOTS) {
    const live = structuredClone(s[root]);
    if (root === 'fateTrojan') live.life.site = structuredClone(original.fateTrojan.life.site);
    assert.deepEqual(live, original[root], `Preserve the full original ${root} history`);
  }
  if (s.timeWorm.guidanceKnown) {
    assert.deepEqual(s.timeWorm.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert(validateTimeWormSource(s), 'Actual original movements and energy must reconcile with the new journal');
    assert.deepEqual(sourceOriginals(s), timeWormExpectedOriginals(s));
  } else assert.deepEqual(sourceOriginals(s), sourceOriginals(original));
  const p = site(), prior = original.fateTrojan.life.site;
  for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals']) assert.deepEqual(p[key], prior[key], `No duplicate, recharged or unpaid original ${key}`);
  for (const person of ['lina', 'victor']) {
    const { location, energy, travelMetres, ...identity } = p[person];
    const { location: oldLocation, energy: oldEnergy, travelMetres: oldTravel, ...oldIdentity } = prior[person];
    assert.deepEqual(identity, oldIdentity, `Same original adult ${person}`);
  }
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(s.fateTrojan.encounter, original.fateTrojan.encounter, 'The original retreated-from Elias stays alive with his actual body and resources');
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(timeWormLifeMasteryGains(s))) expectedMastery[id] += gain;
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.timeWormOutcome; assert(outcome, 'Only the one independent new encounter can add combat history');
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(expectedMastery, id)); expectedMastery[id] = Math.min(500, expectedMastery[id] + 8);
    }
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual applied effects gain mastery');
  assert.equal(s.random.seed, old.seed); assert.equal(s.runId, original.runId);
  const { coreStats: stats, ...identity } = s.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  assert.deepEqual(identity, originalIdentity, 'The same original person retains their identity');
  for (const [id, value] of Object.entries(originalStats)) assert.equal(stats[id], Math.min(500, value + (s.progression.sequence === 1 ? 1 : 0)));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek);
}
function capture(key) {
  if (!prefixVerified) return;
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  let file = capturedSteps.get(commands.length);
  if (!file) {
    file = `boundary-${unique}.json`; write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); capturedSteps.set(commands.length, file);
    uniqueTransitions.push({ key: unique, file, commandIndex: commands.length, beforeRevision: beforeLast.revision, afterRevision: s.revision });
  }
  boundaries[unique] = file; boundarySteps[unique] = commands.length;
}
function snapshot(name) {
  assert(!snapshots[name], `Duplicate snapshot name ${name}`);
  let file = snapshotSteps.get(commands.length);
  if (!file) { file = `snapshot-${name}.json`; write(file, s); snapshotSteps.set(commands.length, file); }
  snapshots[name] = file;
}
function compact() {
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null,
    life: { activeCase: life().activeCase, clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, pending: life().pending,
      playerLocation: site().playerLocation, playerEnergy: site().playerEnergy, playerTravelMetres: site().playerTravelMetres,
      lina: site().lina, victor: site().victor, currentAttempt: life().activeCase ? currentAttempt(life().activeCase) : null },
    encounter: { status: s.timeWorm.encounter.status, scene: s.timeWorm.encounter.scene, terminal: s.timeWorm.encounter.terminal } };
}
function publicControl(intent) {
  if (!prefixVerified) return { kind: 'IMMUTABLE_SOURCE_PREFIX', enabled: true };
  const p = projectSliceState(s);
  if (intent.type === 'TIME_WORM') {
    const available = p.timeWorm.actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(available, `No current public TimeWorm control: ${JSON.stringify(intent.command)}`); assert(available.enabled, available.reason);
    return { kind: 'TIME_WORM', ...structuredClone(available) };
  }
  if (intent.type === 'ACTION') {
    assert(p.canAct, p.actionBlockedReason ?? 'Public ordinary action unavailable'); assert(['WORK', 'REST'].includes(intent.action));
    assert(!view().insideCase && !view().encounter.inside && !s.combat && s.timeWorm.preparedWeek === null, 'Never recover within a locked scene or prepared potion');
    return { kind: 'ACTION', action: intent.action, enabled: p.canAct, reason: p.actionBlockedReason };
  }
  if (intent.type === 'EVENT_CHOICE') {
    assert(p.activeEvent && s.activeEvent.instanceId === intent.eventInstanceId);
    const choice = p.activeEvent.choices.find(c => c.id === intent.choiceId); assert(choice?.enabled, 'Only the actual enabled public event choice');
    return { kind: 'EVENT_CHOICE', eventId: p.activeEvent.id, ...structuredClone(choice) };
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(p.status, 'ACTIVE'); assert.equal(p.activeEvent, null); assert(p.combat);
  assert(p.combat.stances.some(stance => stance.id === intent.stance)); assert.equal(intent.stance, strategy.combatStance);
  return { kind: 'COMBAT_ROUND', stance: intent.stance, enabled: true, round: s.combat.round };
}
function go(intent, key = null) {
  pendingIntent = structuredClone(intent); failurePhase = 'PUBLIC_PREFLIGHT';
  assert(commands.length < strategy.maxCommands, 'Finite command budget exhausted; retain actual blocker'); assert(validateSlicePayload(intent), 'Strict public intent required');
  const control = publicControl(intent), beforePublic = prefixVerified ? structuredClone(compact()) : null;
  const previous = s; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
  s = applySliceIntent(s, intent); commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
  // Persist the real applied transition BEFORE validation. A validator blocker
  // must not erase an already drawn roll, failed bottle or actual combat loss.
  append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= prefixCount, before: body(previous), after: body(s) });
  if (prefixVerified) append('public.jsonl', { step: commands.length, revision: previous.revision, command: intent, control,
    randomBefore: previous.random, randomAfter: s.random, before: beforePublic, after: compact() });
  assertValidSliceState(s); assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= previous.random.cursor); assert.equal(s.revision, previous.revision + 1);
  if (prefixVerified) { originals(); capture(key ?? `step-${commands.length}-${intent.type === 'TIME_WORM' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`); }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}`);
}
function tw(command, key = null) { go({ type: 'TIME_WORM', command }, key); }
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = projectSliceState(s).activeEvent, choiceId = strategy.eventChoices[event.id.startsWith('ORIGIN') ? 'ORIGIN' : event.id];
    assert(choiceId, `Unplanned event ${event.id}; preserve its actual choices`);
    const prior = event.id === 'LIFE-CARE-01' ? structuredClone(body(s)) : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, prior ? 'actual-clinic-pay60' : `event-${event.id}-${choiceId}`);
    if (prior) {
      assert(s.cash <= prior.cash - 60, 'Treatment and any actual due weekly charges remain paid'); assert.equal(s.health, prior.H, 'Payment is not healing');
      assert.equal(s.injuryRisk, prior.injuryRisk);
      for (const injury of prior.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const retained = s.injuries.find(i => i.id === injury.id); assert(retained); assert.equal(retained.treatedRevision, prior.revision + 1); assert.equal(retained.acquiredRevision, injury.acquiredRevision);
      }
      treatments.push({ paidPennies: 60, before: prior, after: structuredClone(body(s)) });
    }
  }
  assert.equal(s.activeEvent, null); assert.equal(s.pulse, 'NONE');
}
function ordinary(key = null, forceRest = false) {
  clear(); assert.equal(s.status, 'ACTIVE'); assert(!view().insideCase && !view().encounter.inside && !s.combat);
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, key); clear();
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  assert(!view().insideCase && !view().encounter.inside && !s.combat && s.timeWorm.preparedWeek === null, 'Recovery only outside unlocked scenes'); clear();
  assert(ap <= s.weeklyBudget);
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    assert(n < strategy.ordinaryPreparationCap, 'Finite ordinary preparation exhausted'); ordinary();
  }
}
function action(command, key = null) { ready(); tw(command, key); clear(); }
function recoverOriginalInjuries() {
  assert.equal(s.health, 40); assert.equal(s.injuryRisk, 2); assert.equal(s.careKnown, true); assert.equal(s.world.careAvailable, true);
  assert.equal(s.injuries.length, 3); assert.equal(s.injuries.filter(i => i.severity === 'LIGHT').length, 2); assert.equal(s.injuries.filter(i => i.severity === 'HEAVY').length, 1);
  for (let n = 0; s.injuries.length; n++) {
    assert(n < 30, 'Real clinic/rest recovery did not finish; never remove a wound directly');
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    ready({ ap: 1, cash: untreated ? 60 : 0 }); ordinary(untreated ? 'actual-rest-requests-known-clinic' : 'actual-subsequent-injury-rest', true);
  }
  assert.equal(treatments.length, 1); assert.equal(s.injuryRisk, 0); assert(s.health >= 80);
  assert.equal(site().playerEnergy, 9, 'Ordinary health care never refills the original local body energy');
  capture('original-two-light-one-heavy-wounds-actually-healed'); snapshot('afterOriginalCare');
}
function recoverSceneEnergy() {
  assert.equal(s.progression.sequence, 1);
  for (let n = 0; site().playerEnergy < strategy.energyRecovery.minimumBeforeCase; n++) {
    assert(n < 5); ready({ ap: 1, cash: 15 });
    const prior = { energy: site().playerEnergy, clock: site().clockSeconds, metres: site().playerTravelMetres };
    tw({ type: 'RECOVER_ENERGY' }, 'actual-outside-paid-energy-rest');
    const receipt = life().journal.at(-1);
    assert.equal(receipt.before.cash - receipt.after.cash, 15); assert.equal(receipt.before.actions - receipt.after.actions, 1);
    assert.equal(receipt.elapsedSeconds, 60); assert.equal(site().clockSeconds, prior.clock + 60);
    assert.equal(site().playerEnergy, Math.min(100, prior.energy + 20)); assert.equal(site().playerTravelMetres, prior.metres); clear();
  }
}
function waitForDeclaredLook(caseId, key) {
  const a = () => currentAttempt(caseId);
  for (let n = 0; a().declaration.state === 'DELAYED' && life().clockSeconds < a().declaration.dueAt; n++) {
    assert(n < 3, 'No extra target interval may be invented');
    const prior = { clock: life().clockSeconds, ap: s.actionsRemaining, week: s.week };
    tw({ type: 'WAIT_1' }, `${key}-real-one-second-wait`);
    assert.equal(life().clockSeconds, prior.clock + 1); assert.equal(s.actionsRemaining, prior.ap); assert.equal(s.week, prior.week);
  }
}
function practice(caseId) {
  const row = () => life().cases[caseId], a = () => currentAttempt(caseId);
  assert.equal(row().status, 'AVAILABLE'); action({ type: 'OBSERVE', caseId }, `${caseId}-actual-original-observation`);
  ready({ ap: 1, cash: 20, ...strategy.recoveryBeforePotionAndContact }); recoverSceneEnergy(); ready({ ap: 1, cash: 20 });
  const before = structuredClone(site());
  tw({ type: 'PREPARE', caseId, method: strategy.caseMethod }, `${caseId}-actual20p1AP-fresh-preparation`);
  assert.equal(row().attempts.length, 1); assert.equal(a().penniesSpent, 20);
  for (const permission of ['OWNER', 'OBSERVER', 'ABILITY']) tw({ type: 'CONSENT', permission }, `${caseId}-fresh-${permission.toLowerCase()}-consent`);
  tw({ type: 'APPROACH' }, `${caseId}-both-original-bodies-walk-four-metres-to-desk`);
  assert.equal(site().playerLocation, 'DESK'); assert.equal(site().lina.location, 'DESK'); assert.equal(site().victor.location, 'OUTSIDE');
  assert.equal(site().playerTravelMetres, before.playerTravelMetres + 4); assert.equal(site().lina.travelMetres, before.lina.travelMetres + 4);
  tw({ type: 'BASELINE_LOOK' }, `${caseId}-actual-ordinary-baseline-look`);
  tw({ type: 'DECLARE_LOOK' }, `${caseId}-one-new-pending-original-label-look`);
  assert.equal(a().declaration.state, 'PENDING');
  const paid = { S: s.spirituality, M: s.mind, cursor: s.random.cursor, clock: life().clockSeconds, ap: s.actionsRemaining, week: s.week };
  tw({ type: 'SHORT_TIME_THEFT' }, `${caseId}-single-paid-short-time-theft-attempt`);
  assert.equal(s.spirituality, paid.S - 8); assert.equal(s.mind, paid.M - 2); assert.equal(s.random.cursor, paid.cursor + 1);
  assert.equal(life().clockSeconds, paid.clock + 1); assert.equal(s.actionsRemaining, paid.ap); assert.equal(s.week, paid.week); assert.equal(a().theft.attempts, 1);
  const theftSucceeded = a().theft.successes === 1;
  assert.equal(a().declaration.state, theftSucceeded ? 'DELAYED' : 'PENDING'); assert.equal(!!life().pending, theftSucceeded);
  assert.equal(a().theft.effects, 0, 'A successful cast alone is not applied mastery');
  if (theftSucceeded) { assert.equal(a().declaration.dueAt, life().clockSeconds + 3); assert.equal(life().pending.expiresAt, a().declaration.dueAt); }
  if (caseId === 'delayed-observation') {
    if (theftSucceeded) tw({ type: 'WAIT_3' }, `${caseId}-actual-three-second-target-delay`);
  } else if (caseId === 'released-interval') {
    if (theftSucceeded) {
      const cost = { S: s.spirituality, M: s.mind, cursor: s.random.cursor, clock: life().clockSeconds };
      tw({ type: 'TIME_RELEASE' }, `${caseId}-single-paid-release-from-real-stored-interval`);
      assert.equal(s.spirituality, cost.S - 6); assert.equal(s.mind, cost.M - 2); assert.equal(s.random.cursor, cost.cursor + 1); assert.equal(life().clockSeconds, cost.clock + 1);
      assert.equal(a().release.attempts, 1); assert.equal(a().release.effects, 0, 'Release casting alone does not apply the interval');
    } else assert.equal(a().release.attempts, 0, 'Failure cannot manufacture a releasable charge');
    const compare = { cursor: s.random.cursor, energy: site().playerEnergy, clock: life().clockSeconds, due: a().declaration.dueAt };
    tw({ type: 'COMPARE_LABEL' }, `${caseId}-one-real-comparison-with-ordinary-fallback`);
    assert.equal(s.random.cursor, compare.cursor + 1); assert.equal(site().playerEnergy, compare.energy - 1); assert.equal(life().clockSeconds, compare.clock + 1);
    if (a().release.successes === 1) {
      assert(a().comparisonAt < compare.due); assert.equal(a().comparisonBonus, 8); assert.equal(a().release.effects, 1);
      assert.equal(a().declaration.state, 'DELAYED', 'Own interval use does not refund the target delay'); assert(life().clockSeconds < a().declaration.dueAt);
    } else { assert.equal(a().comparisonBonus, 0); assert.equal(a().release.effects, 0); }
    assert.equal(life().pending, null); waitForDeclaredLook(caseId, caseId);
  } else {
    if (theftSucceeded) tw({ type: 'WAIT_1' }, `${caseId}-one-real-second-before-withdrawal`);
    const actual = { clock: life().clockSeconds, declaration: structuredClone(a().declaration), pending: structuredClone(life().pending), S: s.spirituality, M: s.mind, ap: s.actionsRemaining, week: s.week };
    tw({ type: 'WITHDRAW_CONSENT', permission: 'ABILITY' }, `${caseId}-withdraw-ability-without-refunding-target-time`);
    assert.equal(a().permission.ability, 'WITHDRAWN'); assert.equal(a().permission.owner, 'GRANTED'); assert.equal(life().pending, null);
    assert.equal(life().clockSeconds, actual.clock); assert.deepEqual(a().declaration, actual.declaration);
    assert.equal(s.spirituality, actual.S); assert.equal(s.mind, actual.M); assert.equal(s.actionsRemaining, actual.ap); assert.equal(s.week, actual.week);
    const remaining = Math.max(0, a().declaration.dueAt - life().clockSeconds);
    if (theftSucceeded) { assert.equal(a().declaration.delayedSeconds, 1); assert.equal(remaining, 2); }
    withdrawalEvidence.push({ caseId, step: commands.length, before: actual, after: { clock: life().clockSeconds, declaration: structuredClone(a().declaration), pending: life().pending }, targetRemainingSeconds: remaining });
    capture(`${caseId}-actual-remaining-target-time-preserved`); waitForDeclaredLook(caseId, caseId);
  }
  tw({ type: 'EXECUTE_LOOK' }, `${caseId}-original-owner-actually-executes-the-declared-look`);
  assert.equal(a().declaration.state, 'EXECUTED'); assert.equal(a().theft.effects, theftSucceeded ? 1 : 0);
  if (theftSucceeded) { assert.equal(a().declaration.delayedSeconds, 3); assert(a().declaration.executedAt >= a().declaration.dueAt); }
  else assert.equal(a().result, 'ORDINARY');
  assert.equal(life().pending, null);
  tw({ type: 'EXIT_ROOM' }, `${caseId}-both-original-bodies-walk-four-metres-out`);
  assert.equal(site().playerTravelMetres, before.playerTravelMetres + 8); assert.equal(site().lina.travelMetres, before.lina.travelMetres + 8);
  assert.equal(site().playerLocation, 'OUTSIDE'); assert.equal(site().lina.location, 'OUTSIDE'); assert.equal(site().victor.location, 'OUTSIDE');
  assert.deepEqual(site().parcel, before.parcel);
  tw({ type: 'LEAVE' }, `${caseId}-close-this-contact-without-resetting-any-body`); clear();
  assert.equal(row().status, 'EXAMINED'); assert(a().closed); assert.equal(row().attempts.length, 1);
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-report`); assert.equal(row().status, 'RESOLVED');
}
function consumePotion(bottleId) {
  const prior = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), H: s.health, M: s.mind, S: s.spirituality,
    pollution: s.seer.pollution, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor, energy: site().playerEnergy };
  tw({ type: 'CONSUME', bottleId, confirmed: true }, `actual-consumption-${bottleId}`);
  const used = s.timeWorm.bottles.find(b => b.id === bottleId); assert.equal(used.status, 'CONSUMED'); assert.equal(s.timeWorm.preparedWeek, null);
  assert.equal(s.random.cursor, prior.cursor + 1); assert.equal(s.spirituality, prior.S); assert.equal(site().playerEnergy, prior.energy);
  assert.deepEqual(s.injuries, prior.injuries); assert.equal(s.injuryRisk, prior.risk);
  const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome]; assert(costs);
  assert.equal(s.health, Math.max(1, prior.H - costs[0])); assert.equal(s.mind, Math.max(1, prior.M - costs[1])); assert.equal(s.seer.pollution, Math.min(100, prior.pollution + costs[2]));
  for (const [id, value] of Object.entries(prior.mastery)) assert.equal(s.progression.mastery[id], value);
  for (const [id, value] of Object.entries(prior.stats)) assert.equal(s.character.coreStats[id], Math.min(500, value + (s.progression.sequence === 1 ? 1 : 0)));
  capture(s.progression.sequence === 1 ? 'promotion' : 'actual-potion-failure'); clear();
}
function encounter() {
  const e = () => s.timeWorm.encounter, priorSite = structuredClone(site());
  assert.equal(e().status, 'AVAILABLE'); ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact }); snapshot('recoveredBeforeEncounter');
  assert.equal(life().activeCase, null); assert.equal(life().pending, null);
  assert.equal(site().playerLocation, 'OUTSIDE'); assert.equal(site().lina.location, 'OUTSIDE'); assert.equal(site().victor.location, 'OUTSIDE');
  tw({ type: 'ENCOUNTER_TALK' }, 'actual-four-metre-arrival-and-independent-adrian-name-exchange');
  assert.equal(e().targetId, 'TW1-ADRIAN'); assert.equal(e().scene.knownEnemyName, '艾德里安·凯斯'); assert.equal(e().scene.playerTravelMetres, 4); assert.equal(e().scene.clockSeconds, 4);
  assert.equal(e().enemyHealth, 100); assert.equal(e().enemyMind, 100); assert.equal(e().enemySpirituality, 120); assert.equal(e().materials.marks.length, 3); assert(e().materials.marks.every(m => m.status === 'HELD'));
  assert.deepEqual(site(), priorSite, 'The independent yard does not change archived registry people or resources');
  tw({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-fight');
  tw({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-adrian-fight'); snapshot('combatStart');
  assert.equal(e().status, 'FIGHTING'); assert.equal(s.combat.encounterId, 'TIME_WORM_DISPUTE');
  while (s.combat && s.combat.round <= strategy.combatRoundCap) {
    const round = s.combat.round; go({ type: 'COMBAT_ROUND', stance: strategy.combatStance }, `combat-round-${round}`); assert.deepEqual(site(), priorSite);
  }
  if (s.combat) { snapshot('combatFiniteCap'); throw new FiniteEncounterStop('Declared90-round cap reached; retain actual unfinished battle'); }
  assert(e().terminal); assert.equal(e().terminal.exitMetres, 4); assert.equal(e().terminal.exitSeconds, 4);
  assert.equal(e().scene.playerLocation, 'OUTSIDE'); assert.equal(e().scene.playerCoordinate, 0); assert.equal(view().encounter.inside, false);
  capture('actual-ordinary-four-metre-encounter-exit'); snapshot('combatTerminal');
}
function verifyPrefix() {
  assert.deepEqual(commands, old.commands); assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated full551 actual final must match before new play');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 552); assert.equal(s.week, 127); assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 27 });
  assert.deepEqual(s.random, { seed: old.seed, cursor: 361 }); assert.equal(s.health, 40); assert.equal(s.mind, 100); assert.equal(s.spirituality, 90);
  assert.equal(s.cash, 472); assert.equal(s.actionsRemaining, 3); assert.equal(s.seer.pollution, 0); assert.equal(s.injuryRisk, 2); assert.equal(s.injuries.length, 3);
  assert.equal(s.progression.pathwayId, 'error'); assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100); assert.equal(s.fateTrojan.promotionWeek, 119);
  assert.equal(Object.keys(s.progression.mastery).length, 14); assert.deepEqual(Object.entries(s.progression.mastery).filter(([, v]) => v === 0).map(([id]) => id), ['error.s5.thought-theft']);
  assert.deepEqual(s.character.coreStats, { physique: 28, perception: 27, will: 25, knowledge: 25 });
  assert.equal(site().clockSeconds, 745); assert.equal(site().playerTravelMetres, 86); assert.equal(site().playerEnergy, 9);
  assert.equal(site().playerLocation, 'OUTSIDE'); assert.equal(site().lina.location, 'OUTSIDE'); assert.equal(site().victor.location, 'OUTSIDE');
  assert.equal(site().lina.energy, 96); assert.equal(site().lina.travelMetres, 4); assert.equal(site().victor.energy, 88); assert.equal(site().victor.travelMetres, 12);
  assert.equal(site().cabinet.open, false); assert.equal(site().cabinet.recognitionHolder, 'OWNER'); assert.equal(site().link.holder, 'OWNER'); assert.equal(site().link.returnPending, false);
  assert.equal(site().parcel.location, 'OUTSIDE'); assert.equal(site().parcel.ordinaryMetres, 8); assert.equal(site().fate.status, 'COMPLETED'); assert.equal(site().fate.paidToPlayer, 12); assert.equal(site().fate.escrowPennies, 0);
  assert.deepEqual(site().seals.map(x => x.charges), [0, 0, 1]); assert(site().seals.every(x => x.ownerId === 'FT2-LINA'));
  assert.equal(s.parasite.life.host.mode, 'NONE'); assert.equal(s.parasite.life.host.control, 'HOST'); assert.equal(s.parasite.life.host.awareness, 'AWARE');
  assert.equal(s.fateTrojan.encounter.status, 'RETREATED'); assert.equal(s.fateTrojan.encounter.enemyHealth, 100); assert.equal(s.fateTrojan.encounter.enemyMind, 100); assert.equal(s.fateTrojan.encounter.enemySpirituality, 55);
  assert.equal(s.fateTrojan.encounter.terminal.round, 9); assert.equal(s.activeEvent, null); assert.equal(s.combat, null); assert.equal(s.debts.reduce((n, d) => n + d.remaining, 0), 0);
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', { provenance: old.provenance, priorContinuation: old.continuation, creation: old.creation, seed: old.seed,
    initialSource: `${source}:initial`, initial: old.initial, rawFinal: old.final, commands: commands.slice(), commandCount: prefixCount,
    sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH, originalDeathSha256: ORIGINAL_DEATH_HASH,
    rawSourceRoot: 'final', compactCommandsSha256: PREFIX_COMPACT_HASH, rawInitialCompactSha256: RAW_INITIAL_COMPACT_HASH, rawFinalCompactSha256: RAW_FINAL_COMPACT_HASH,
    migratedWholeStateSha256: digest(original), original456CommandDeathPreserved: true, inheritedDirectedPrefix: false });
  snapshot('departure'); capture('exact-original551-command-living-source');
}
function restoreExact639() {
  failurePhase = 'RESUME_PREFLIGHT';
  const input = name => `${FIRST_BLOCKER_DIRECTORY}/${name}`;
  assert.equal(fileDigest(input('natural.json')), FIRST_BLOCKER_HASH);
  assert.equal(fileDigest(input('capture-integrity.json')), FIRST_INTEGRITY_HASH);
  const savedCapture = JSON.parse(readFileSync(input('natural.json'), 'utf8'));
  const integrity = JSON.parse(readFileSync(input('capture-integrity.json'), 'utf8'));
  assert.equal(savedCapture.producerSha256, FIRST_PRODUCER_HASH); assert.equal(integrity.producerSha256, FIRST_PRODUCER_HASH);
  assert.equal(integrity.naturalSha256, FIRST_BLOCKER_HASH); assert.equal(savedCapture.stage, 'ACTUAL_BLOCKER');
  assert.equal(savedCapture.failurePhase, 'PUBLIC_PREFLIGHT'); assert.equal(savedCapture.prefixCount, prefixCount); assert.equal(savedCapture.prefixVerified, true);
  assert.equal(savedCapture.commands.length, 639); assert.deepEqual(savedCapture.strategy, strategy);
  assert.deepEqual(savedCapture.pendingIntent, { type: 'TIME_WORM', command: { type: 'WAIT_1' } });
  assert.deepEqual(savedCapture.lastIntent, { type: 'TIME_WORM', command: { type: 'WITHDRAW_CONSENT', permission: 'ABILITY' } });
  assert.deepEqual(savedCapture.commands.at(-1), savedCapture.lastIntent); assert.deepEqual(savedCapture.commands.slice(0, prefixCount), old.commands);
  assert.deepEqual(savedCapture.creation, old.creation); assert.equal(savedCapture.seed, old.seed); assert.deepEqual(savedCapture.initial, initial);
  assert.deepEqual(savedCapture.prefixFinal, migrateSliceState(old.final)); assert.equal(savedCapture.provenance.sourceSha256, SOURCE_HASH);
  assert.equal(savedCapture.provenance.originalDeathSha256, ORIGINAL_DEATH_HASH); assert.equal(savedCapture.provenance.newRandomChanges, false);
  const restored = savedCapture.final, attempt = restored.timeWorm.life.cases['withdrawn-delay'].attempts.at(-1);
  assert.equal(digest(restored), FIRST_STATE_HASH); assert.equal(restored.revision, 640); assert.equal(restored.status, 'ACTIVE');
  assert.deepEqual(restored.random, { seed: old.seed, cursor: 366 }); assert.equal(restored.week, 143); assert.equal(restored.actionsRemaining, 0);
  assert.equal(restored.timeWorm.life.activeCase, 'withdrawn-delay'); assert.equal(restored.timeWorm.life.clockSeconds, 888); assert.equal(restored.timeWorm.life.pending, null);
  assert.equal(attempt.permission.ability, 'WITHDRAWN'); assert.equal(attempt.permission.owner, 'GRANTED'); assert.equal(attempt.permission.observer, 'GRANTED');
  assert.equal(attempt.declaration.state, 'DELAYED'); assert.equal(attempt.declaration.dueAt, 890); assert.equal(attempt.declaration.delayedSeconds, 1);
  assert.equal(attempt.theft.attempts, 1); assert.equal(attempt.theft.successes, 1); assert.equal(attempt.theft.effects, 0);
  assert.equal(restored.timeWorm.encounter.status, 'AVAILABLE'); assert.equal(restored.combat, null); assert.equal(restored.activeEvent, null);
  // Every member is hash-verified before copying. The current ledgers begin with
  // the exact639/88 original lines; distinct prior-blocker copies remain intact.
  const checks = { 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256', 'source-prefix.json': 'sourcePrefixSha256',
    'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256', 'summary.json': 'summarySha256' };
  for (const [name, key] of Object.entries(checks)) assert.equal(fileDigest(input(name)), integrity[key]);
  const priorIndex = JSON.parse(readFileSync(input('boundaries.index.json'), 'utf8'));
  const priorSteps = JSON.parse(readFileSync(input('boundaries.steps.json'), 'utf8'));
  const priorTransitions = JSON.parse(readFileSync(input('transitions.json'), 'utf8'));
  assert.deepEqual(Object.keys(priorIndex).sort(), Object.keys(priorSteps).sort());
  assert.equal(priorTransitions.length, 89);
  for (const [i, transition] of priorTransitions.entries()) {
    assert.equal(transition.commandIndex, prefixCount + i); assert.equal(transition.beforeRevision, transition.commandIndex); assert.equal(transition.afterRevision, transition.commandIndex + 1);
    assert.equal(priorIndex[transition.key], transition.file); assert.equal(priorSteps[transition.key], transition.commandIndex);
  }
  const referenced = [...new Set([...Object.values(priorIndex), ...Object.values(savedCapture.snapshots)])];
  assert.deepEqual(referenced.slice().sort(), Object.keys(integrity.files).sort());
  for (const name of referenced) {
    assert.equal(name, basename(name)); assert(/^(boundary-|snapshot-)[A-Za-z0-9_.-]+\.json$/.test(name)); assert.equal(fileDigest(input(name)), integrity.files[name]);
  }
  const lastBoundary = JSON.parse(readFileSync(input(priorTransitions.at(-1).file), 'utf8'));
  assert.equal(lastBoundary.commandCount, 639); assert.deepEqual(lastBoundary.final, restored); assert.deepEqual(lastBoundary.beforeLast, savedCapture.beforeLast);
  const commandBytes = readFileSync(input('commands.jsonl')), publicBytes = readFileSync(input('public.jsonl'));
  const lines = commandBytes.toString('utf8').split('\n'), publicLines = publicBytes.toString('utf8').split('\n');
  assert.equal(lines.pop(), ''); assert.equal(publicLines.pop(), ''); assert.equal(lines.length, 639); assert.equal(publicLines.length, 88);
  for (const [i, line] of lines.entries()) { const entry = JSON.parse(line); assert.equal(entry.step, i + 1); assert.deepEqual(entry.intent, savedCapture.commands[i]); }
  for (const [i, line] of publicLines.entries()) { const entry = JSON.parse(line); assert.equal(entry.step, prefixCount + i + 1); assert.deepEqual(entry.command, savedCapture.commands[entry.step - 1]); }
  const preservedFiles = {};
  for (const name of ['natural.json', 'capture-integrity.json', 'summary.json', 'commands.jsonl', 'public.jsonl', 'source-prefix.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json']) {
    const target = `prior-blocker-${name}`; copyFileSync(input(name), `${outputDir}/${target}`, constants.COPYFILE_EXCL); preservedFiles[target] = fileDigest(input(name));
  }
  for (const name of [...referenced, 'source-prefix.json']) copyFileSync(input(name), `${outputDir}/${name}`, constants.COPYFILE_EXCL);
  appendFileSync(`${outputDir}/commands.jsonl`, commandBytes); appendFileSync(`${outputDir}/public.jsonl`, publicBytes);
  assert.equal(fileDigest(`${outputDir}/commands.jsonl`), integrity.commandsSha256); assert.equal(fileDigest(`${outputDir}/public.jsonl`), integrity.publicSha256);
  commands.push(...savedCapture.commands); Object.assign(boundaries, priorIndex); Object.assign(boundarySteps, priorSteps); Object.assign(snapshots, savedCapture.snapshots);
  uniqueTransitions.push(...priorTransitions); for (const transition of priorTransitions) capturedSteps.set(transition.commandIndex, transition.file);
  treatments.push(...savedCapture.treatments); withdrawalEvidence.push(...savedCapture.withdrawalEvidence);
  original = structuredClone(savedCapture.prefixFinal); s = structuredClone(restored); beforeLast = structuredClone(savedCapture.beforeLast);
  lastIntent = structuredClone(savedCapture.lastIntent); pendingIntent = structuredClone(savedCapture.pendingIntent); prefixVerified = true;
  assertValidSliceState(s); originals(); assert.deepEqual(s, restored); assert.equal(digest(s), FIRST_STATE_HASH);
  continuationSource = { kind: 'EXACT_639_PUBLIC_PREFLIGHT_PROJECTION_REPAIR_ONLY', sourceDirectory: FIRST_BLOCKER_DIRECTORY,
    originalProducerSha256: FIRST_PRODUCER_HASH, finalProducerSha256: producerHash, originalFailureSha256: FIRST_BLOCKER_HASH, originalIntegritySha256: FIRST_INTEGRITY_HASH,
    originalCommandCount: 639, restoredCommandCount: commands.length, sourcePrefixCount: prefixCount, pendingIntent: structuredClone(savedCapture.pendingIntent),
    originalFinalSha256: FIRST_STATE_HASH, restoredFinalSha256: digest(s), fullStateUnchanged: true, replayedPriorCommands: 0,
    commandsPrefixBytes: commandBytes.length, commandsPrefixSha256: integrity.commandsSha256, publicPrefixBytes: publicBytes.length, publicPrefixSha256: integrity.publicSha256,
    exactCommandLedgerThrough639: true, exactPublicLedgerThrough639: true, originalStateRandom: structuredClone(restored.random), newRandomChanges: false, preservedFiles };
  write('resume-verification.json', continuationSource); failurePhase = 'IDLE';
}
function finishExactWithdrawnCase() {
  const caseId = 'withdrawn-delay', a = () => currentAttempt(caseId), before = a().siteAtStart;
  // This is the first unexecuted original command. Both waits remain public,
  // real one-second waits; no roll or already applied command is repeated.
  const cursor = s.random.cursor;
  tw({ type: 'WAIT_1' }, `${caseId}-real-one-second-wait`); assert.equal(life().clockSeconds, 889); assert.equal(s.random.cursor, cursor);
  waitForDeclaredLook(caseId, caseId); assert.equal(life().clockSeconds, 890); assert.equal(s.random.cursor, cursor);
  tw({ type: 'EXECUTE_LOOK' }, `${caseId}-original-owner-actually-executes-the-declared-look`);
  assert.equal(a().declaration.state, 'EXECUTED'); assert.equal(a().declaration.delayedSeconds, 3); assert.equal(a().theft.effects, 1); assert.equal(a().release.effects, 0); assert.equal(life().pending, null);
  tw({ type: 'EXIT_ROOM' }, `${caseId}-both-original-bodies-walk-four-metres-out`);
  assert.equal(site().playerTravelMetres, before.playerTravelMetres + 8); assert.equal(site().lina.travelMetres, before.lina.travelMetres + 8);
  assert.equal(site().playerLocation, 'OUTSIDE'); assert.equal(site().lina.location, 'OUTSIDE'); assert.equal(site().victor.location, 'OUTSIDE'); assert.deepEqual(site().parcel, before.parcel);
  tw({ type: 'LEAVE' }, `${caseId}-close-this-contact-without-resetting-any-body`); clear();
  assert.equal(life().cases[caseId].status, 'EXAMINED'); assert(a().closed); assert.equal(life().cases[caseId].attempts.length, 1);
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-report`); assert.equal(life().cases[caseId].status, 'RESOLVED');
}
function save(stage, error = null) {
  assert(!saved); saved = true; verifySourceFiles();
  const e = s.timeWorm.encounter, rounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length), outcomes = rounds.map(r => r.timeWormOutcome).filter(Boolean);
  const sum = (rows, selector) => rows.reduce((n, row) => n + selector(row), 0), journal = life().journal, acquisition = s.timeWorm.acquisitionJournal;
  write('natural.json', {
    provenance: { kind: 'SAME_SEED_EXACT551_PUBLIC_PREFIX_THEN_PUBLIC_TIME_WORM', prior: old.provenance, priorContinuation: old.continuation,
      source, sourceSha256: SOURCE_HASH, sourceRoot: 'final', peacefulSource, peacefulSha256: PEACEFUL_HASH, originalDeathSource, originalDeathSha256: ORIGINAL_DEATH_HASH,
      original456CommandDeathPreserved: true, inheritedDirectedPrefix: false, newRandomChanges: false },
    continuation: { kind: 'EXACT_551_PUBLIC_LIVING_PREFIX_THEN_PUBLIC_TIME_WORM', sourceFixture: source, sourceRoot: 'final', originalDeathFixture: originalDeathSource, newRandomChanges: false },
    producerSha256: producerHash, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, continuationSource, strategy, creation: old.creation, seed: old.seed, prefixCount, inheritedPrefixCount: old.prefixCount,
    prefixVerified, commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments, withdrawalEvidence, stage, error: error ? String(error.stack ?? error) : null, final: s,
  });
  write('boundaries.index.json', boundaries); write('boundaries.steps.json', boundarySteps); write('transitions.json', uniqueTransitions);
  write('summary.json', {
    stage, producerSha256: producerHash, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, continuationSource, strategy, source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH, originalDeathSha256: ORIGINAL_DEATH_HASH,
      prefixCompactSha256: PREFIX_COMPACT_HASH, rawFinalCompactSha256: RAW_FINAL_COMPACT_HASH, migratedWholeSourceSha256: original ? digest(original) : null },
    commands: commands.length, final: body(s), originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery,
    lifeCases: Object.fromEntries(CASES.map(id => [id, structuredClone(life().cases[id])])),
    lifeAbilityUse: Object.fromEntries([['theft', NEW_IDS[0]], ['release', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { attempts: sum(uses, x => x.attempts), checkSuccesses: sum(uses, x => x.successes), actualApplications: sum(uses, x => x.effects), states: uses.map(x => x.state) }];
    })),
    actualCosts: { acquisitionCash: sum(acquisition, x => x.before.cash - x.after.cash), acquisitionAP: sum(acquisition, x => x.before.actions - x.after.actions),
      lifeCash: sum(journal, x => x.before.cash - x.after.cash), lifeAP: sum(journal, x => x.before.actions - x.after.actions),
      lifeSpirituality: sum(journal, x => x.before.spirituality - x.after.spirituality), lifeMind: sum(journal, x => x.before.mind - x.after.mind),
      playerOrdinaryMetres: sum(journal, x => x.playerWalkedMetres), linaOrdinaryMetres: sum(journal, x => x.linaWalkedMetres), victorOrdinaryMetres: sum(journal, x => x.victorWalkedMetres),
      playerEnergySpent: sum(journal, x => x.playerEnergySpent), playerEnergyRecovered: sum(journal, x => x.playerEnergyRecovered), linaEnergySpent: sum(journal, x => x.linaEnergySpent), victorEnergySpent: sum(journal, x => x.victorEnergySpent),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyOriginalMarksSpent: e.materials.marks.filter(m => m.status === 'SPENT').length,
      clinic: sum(treatments, t => t.paidPennies), ordinaryWorkCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
      note: 'Mechanism receipts are actual costs; independent weekly settlement remains in the full ledger. No free body, energy, spirituality, cash or time refill.' },
    sourceOriginals: original ? sourceOriginals(original) : null, currentOriginals: sourceOriginals(s), withdrawalEvidence,
    life: { clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, playerLocation: life().playerLocation, playerTravelMetres: life().playerTravelMetres,
      linaTravelMetres: life().linaTravelMetres, victorTravelMetres: life().victorTravelMetres, pending: life().pending },
    encounter: { status: e.status, targetId: e.targetId, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
      enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      shortTimeTheft: { attempts: e.shortTimeTheftAttempts, successfulWindows: e.shortTimeTheftChecks, actualApplications: e.shortTimeTheftSuccesses },
      timeRelease: { attempts: e.timeReleaseAttempts, successfulWindows: e.timeReleaseChecks, actualApplications: e.timeReleaseSuccesses } },
    rounds: rounds.map(r => ({ round: r.round, stance: r.stance, consequenceDomain: r.consequenceDomain ?? null, consequenceRoll: r.consequenceRoll ?? null,
      result: r.timeWormOutcome ? { playerHealth: r.timeWormOutcome.playerHealthAfter, playerMind: r.timeWormOutcome.playerMindAfter, playerSpirituality: r.timeWormOutcome.playerSpiritualityAfter,
        enemyHealth: r.timeWormOutcome.enemyHealth, enemyMind: r.timeWormOutcome.enemyMind, enemySpirituality: r.timeWormOutcome.enemySpirituality,
        expiredWindows: r.timeWormOutcome.expiredWindows, waits: r.timeWormOutcome.waits, targetDelays: r.timeWormOutcome.targetDelays } : null })),
    bottles: structuredClone(s.timeWorm.bottles), treatments, boundaries: Object.keys(boundaries), uniqueTransitions: uniqueTransitions.length, snapshots,
    bodilyMental: 'Health and injuries remain bodily; casting mind costs and MENTAL consequences are independent. Neither ability prevents death or reverses executed actions.',
  });
  write('capture-integrity.json', { producerSha256: producerHash, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, continuationSource, resumeVerificationSha256: continuationSource ? fileDigest(`${outputDir}/resume-verification.json`) : null, naturalSha256: fileDigest(`${outputDir}/natural.json`), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`),
    publicSha256: fileDigest(`${outputDir}/public.jsonl`), sourcePrefixSha256: prefixVerified ? fileDigest(`${outputDir}/source-prefix.json`) : null,
    boundaryIndexSha256: fileDigest(`${outputDir}/boundaries.index.json`), boundaryStepsSha256: fileDigest(`${outputDir}/boundaries.steps.json`), transitionsSha256: fileDigest(`${outputDir}/transitions.json`),
    summarySha256: fileDigest(`${outputDir}/summary.json`), files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])) });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, prefixCount, prefixVerified, status: s.status, sequence: s.progression.sequence, week: s.week, producerSha256: producerHash }));
}

try {
  if (resumeExact639) restoreExact639();
  else {
  assertValidSliceState(s); assert.deepEqual(s.random, old.initial.random);
  for (const intent of old.commands) {
    go(intent);
    if (commands.length === peaceful.commands.length) assert.deepEqual(s, migrateSliceState(peaceful.final), 'Retain the inherited451-command source as history without starting new play there');
  }
  verifyPrefix(); recoverOriginalInjuries();
  ready({ ap: 1, cash: 500, ...strategy.recoveryBeforePotionAndContact });
  tw({ type: 'LEARN_GUIDANCE' }, 'actual500p-guidance-freezes-eight-original-error-roots');
  assert.equal(s.timeWorm.acquisitionJournal.at(-1).before.cash - s.timeWorm.acquisitionJournal.at(-1).after.cash, 500); clear(); snapshot('guidance');
  for (const taskId of ['VERIFY_ORIGINALS', 'DECLARE_PENDING_ACTION', 'PLAN_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
  for (let number = 0; s.progression.sequence === 2 && number < strategy.potionAttemptCap; number++) {
    let bottle = s.timeWorm.bottles.find(b => b.status === 'PLAYER') ?? s.timeWorm.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      assert(s.timeWorm.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome)));
      ready({ ap: 1, cash: 100 }); tw({ type: 'REQUEST_SUPPLY' }, `actual-paid-resupply-after-${number}-failures`);
      const requestedWeek = s.timeWorm.resupply.requestedWeek, length = s.timeWorm.bottles.length; assert.notEqual(requestedWeek, null); clear(); ready({ afterWeek: requestedWeek });
      tw({ type: 'RECEIVE_SUPPLY' }, `actual-later-week-new-supply-${number}`); assert.equal(s.timeWorm.bottles.length, length + 3); bottle = s.timeWorm.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.timeWorm.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-labour`);
      ready({ cash: 1250 }); tw({ type: 'BUY_POTION', bottleId }, `actual1100p-buy-${bottleId}`);
      assert.equal(s.timeWorm.acquisitionJournal.at(-1).before.cash - s.timeWorm.acquisitionJournal.at(-1).after.cash, 1100);
    }
    ready({ ap: 1, cash: 150, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.fateTrojan.promotionWeek + 11 });
    tw({ type: 'PREPARE_PROMOTION' }, `actual150p-current-week-preparation-${bottleId}`);
    assert.equal(s.timeWorm.acquisitionJournal.at(-1).before.cash - s.timeWorm.acquisitionJournal.at(-1).after.cash, 150);
    assert.equal(s.timeWorm.preparedWeek, s.week); assert(s.week - s.fateTrojan.promotionWeek >= 12); consumePotion(bottleId);
  }
  }
  if (s.progression.sequence !== 1) save('SAME_SEED_NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
  else {
    if (resumeExact639) finishExactWithdrawnCase();
    else {
    assert.equal(s.timeWorm.fateTrojanActingAtPromotion, 100); assert.equal(s.progression.acting, 0); assert.equal(site().playerEnergy, 9);
    for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
    for (const caseId of CASES) practice(caseId);
    }
    action({ type: 'REFLECT' }, 'three-honest-actual-reports-reflected'); assert.equal(s.progression.acting, 100); snapshot('practiced');
    encounter(); clear();
    if (s.wagePaidWeek === s.week) ready({ afterWeek: s.week });
    ready({ ap: 1 }); go({ type: 'ACTION', action: 'WORK' }, 'actual-paid-work-after-living-four-metre-exit'); clear(); originals();
    save('SAME_SEED_FULL_PUBLIC_TIME_WORM');
  }
} catch (error) {
  if (saved) throw error;
  if (error instanceof ActualTerminalStop) {
    if (s.timeWorm.encounter.terminal && !snapshots.combatTerminal) snapshot('combatTerminal'); snapshot('actualTerminal'); save('SAME_SEED_NATURAL_ACTUAL_TERMINAL');
  } else if (error instanceof FiniteEncounterStop) save('SAME_SEED_NATURAL_FINITE_ENCOUNTER_UNRESOLVED', error);
  else { save('ACTUAL_BLOCKER', error); throw error; }
}

function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
function compactDigest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); } return hash.digest('hex');
}
// Read just one top-level entry without retaining unrelated large historical
// snapshots; StringDecoder preserves UTF-8 when a character crosses a chunk.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false; else if (c === '\\') escaped = true;
          else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; }
          continue;
        }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw new Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          if (selected) captureStart = i;
          depth = 0; quoted = false; escaped = false;
          kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) {
            if (escaped) escaped = false; else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON entry: ${wanted}`);
}
