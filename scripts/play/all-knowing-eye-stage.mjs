import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateSlicePayload } from '../../dist/domain/slice/validation.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
import { validateAllKnowingEyeSource } from '../../dist/domain/all-knowing-eye/index.js';
import { allKnowingEyeExpectedOriginals, allKnowingEyeLifeMasteryGains } from '../../dist/domain/all-knowing-eye/life.js';

// Frozen public strategy, adapted from the current stage191 producer. This file
// never edits a run, chooses a seed, examines future rolls, reloads a failed
// check, resurrects a dead body, or chooses its stance from observed damage.
const source = 'tests/fixtures/wisdom-angel-v01700/natural.json';
const peacefulSource = 'tests/fixtures/wisdom-angel-v01700/original-enemy-approach.json';
const defensiveSource = 'tests/fixtures/wisdom-angel-v01700/defensive-round-2.json';
const SOURCE_HASH = '2e24ce11c787ba9b51d10d58b2abe9917c17a34a000d10394605944d52043e96';
const PEACEFUL_HASH = 'c208e391bb21812061361737bf5b22d6d3b21352945231eb81d0bd11c7be1fdd';
const DEFENSIVE_HASH = '6d34a93817e084cc3937eb15cde42300137d9d3b71c8ff84d814c42c8a46f870';
const PREFIX_HASH = 'fdd5fbf89a63d0bdaa4cc7fe547b8f2c683f92449232f14b8b6bcc5066419ebb';
const prefixCount = 537;
const ROOTS = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar', 'wisdomAngel'];
const CASES = ['original-paper-check', 'pending-slider', 'changed-conditions'];
const NEW_IDS = ['reader.s1.bounded-insight', 'reader.s1.pending-forecast'];
const strategy = Object.freeze({
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12,
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', potionLabourSteps: 5,
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  paperRoute: ['BOUNDED_INSIGHT', 'VERIFY_HANDOVER', 'MANUAL_COMPARE_ONLY_IF_UNVERIFIED'],
  sliderRoute: ['PENDING_FORECAST', 'CATCH_SLIDER', 'RETRIEVE_SAME_ORIGINAL'],
  changedRoute: ['PENDING_FORECAST', 'CHANGE_CONDITIONS', 'WITHDRAW_OWNER', 'HAND_STOP', 'CLEAR_SIGHTLINE', 'RETRIEVE_SLIDER'],
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});
const producerHash = fileDigest(fileURLToPath(import.meta.url));
verifySourceFiles();
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(source, k)]));
const peaceful = readObjectEntry(peacefulSource, 'beforeLast');
assert.equal(old.commands.length, 543); assert.equal(old.final.status, 'DEAD');
assert.equal(old.seed, 'reader-natural-v023'); assert.equal(peaceful.status, 'ACTIVE');
assert.equal(digest(old.commands.slice(0, prefixCount)), PREFIX_HASH);
assert.equal(digest(peaceful), '0bdef91b0322a86ff947b6f2d0df7326e8b9f8be4b47f2bc7536e8c7c4de802d');
assert.deepEqual(readObjectEntry(peacefulSource, 'lastIntent'), old.commands[prefixCount]);

const resumeDirectory = process.argv[2] === '--resume-from' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !resumeDirectory) throw new Error('Usage: all-knowing-eye-stage.mjs [--resume-from actual-blocker-capture-directory]');
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/all-knowing-eye-01920-');
const commands = [], boundaries = {}, snapshots = {}, treatments = [], publicDecisions = [];
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' });
writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = createSliceRun(old.final.runId, old.creation, old.seed);
let initial = structuredClone(s), original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, continuationSource = null, failurePhase = 'INITIALIZATION', replayingContinuation = false;
const view = () => projectSliceState(s).allKnowingEye;
const life = () => s.allKnowingEye.life;
const currentAttempt = caseId => life().cases[caseId].attempts.at(-1);
const sourceOriginals = state => Object.fromEntries(['playerLocation', 'playerTravelMetres', 'clockSeconds', 'room', 'mara', 'papers', 'device'].map(k => [k, structuredClone(state.wisdomAngel.life[k])]));
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality, cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk, random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting });
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function verifySourceFiles() {
  assert.equal(fileDigest(source), SOURCE_HASH, 'The original543-command death capture is immutable');
  assert.equal(fileDigest(peacefulSource), PEACEFUL_HASH, 'Use the exact existing537-command living boundary');
  assert.equal(fileDigest(defensiveSource), DEFENSIVE_HASH, 'The separate defensive death is immutable');
}
function originals() {
  assert(original);
  for (const root of ROOTS) {
    const live = structuredClone(s[root]);
    if (root === 'wisdomAngel') Object.assign(live.life, sourceOriginals(original));
    if (root === 'mysticismMagister') live.crafts = structuredClone(original.mysticismMagister.crafts);
    assert.deepEqual(live, original[root], `Preserve original ${root} history`);
  }
  if (s.allKnowingEye.guidanceKnown) {
    assert.deepEqual(s.allKnowingEye.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert(validateAllKnowingEyeSource(s), 'Actual original movements and old craft consumption reconcile with receipts');
    assert.deepEqual(sourceOriginals(s), allKnowingEyeExpectedOriginals(s));
  } else {
    assert.deepEqual(sourceOriginals(s), sourceOriginals(original));
    assert.deepEqual(s.mysticismMagister.crafts, original.mysticismMagister.crafts);
  }
  assert.deepEqual(s.wisdomAngel.life.device, original.wisdomAngel.life.device, 'Old AMBER device stays at0 charges');
  for (let i = 0; i < original.wisdomAngel.life.papers.length; i++) {
    const paper = { ...s.wisdomAngel.life.papers[i], location: original.wisdomAngel.life.papers[i].location };
    assert.deepEqual(paper, original.wisdomAngel.life.papers[i], 'Same paper text, identity and original readWeek');
  }
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(allKnowingEyeLifeMasteryGains(s))) expectedMastery[id] += gain;
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.allKnowingEyeOutcome; assert(outcome, 'No unrelated new battle substituted');
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
      for (const id of action.masteryApplied) {
        assert(Object.hasOwn(expectedMastery, id), 'Mastery must name an existing learned ability');
        expectedMastery[id] = Math.min(500, expectedMastery[id] + 8);
      }
    }
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual applied receipts may change mastery');
  assert.equal(s.random.seed, old.seed); assert.equal(s.character.name, original.character.name);
  assert.equal(s.character.gender, original.character.gender); assert.equal(s.character.age, original.character.age);
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek);
  assert.deepEqual(s.wisdomAngel.encounter, original.wisdomAngel.encounter, 'Victor is never contacted');
}
function capture(key) {
  if (!prefixVerified || replayingContinuation) return;
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  const file = `boundary-${unique}.json`;
  write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); boundaries[unique] = file;
}
function snapshot(name) {
  if (snapshots[name] || replayingContinuation) return;
  const file = `snapshot-${name}.json`; write(file, s); snapshots[name] = file;
}
function publicControl(intent) {
  if (!prefixVerified) return { kind: 'IMMUTABLE_SOURCE_PREFIX', enabled: true };
  const p = projectSliceState(s);
  if (intent.type === 'ALL_KNOWING_EYE') {
    const available = p.allKnowingEye.actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(available, `No current public AllKnowingEye control: ${JSON.stringify(intent.command)}`);
    assert(available.enabled, available.reason);
    return { kind: 'ALL_KNOWING_EYE', ...structuredClone(available) };
  }
  if (intent.type === 'ACTION') {
    assert(p.canAct, p.actionBlockedReason ?? 'Public ordinary action is unavailable');
    assert(['WORK', 'REST'].includes(intent.action), 'This fixed continuation uses only actual ordinary work/rest');
    return { kind: 'ACTION', action: intent.action, enabled: p.canAct, reason: p.actionBlockedReason };
  }
  if (intent.type === 'EVENT_CHOICE') {
    assert(p.activeEvent && s.activeEvent.instanceId === intent.eventInstanceId);
    const choice = p.activeEvent.choices.find(c => c.id === intent.choiceId); assert(choice?.enabled, 'Public event choice must be enabled');
    return { kind: 'EVENT_CHOICE', eventId: p.activeEvent.id, ...structuredClone(choice) };
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(p.status, 'ACTIVE'); assert.equal(p.activeEvent, null); assert(p.combat);
  assert(p.combat.stances.some(stance => stance.id === intent.stance), 'Declared stance must be publicly offered');
  assert.equal(intent.stance, strategy.combatStance);
  return { kind: 'COMBAT_ROUND', stance: intent.stance, enabled: true, round: s.combat.round };
}
function go(intent, key = null) {
  pendingIntent = structuredClone(intent); failurePhase = 'PUBLIC_PREFLIGHT';
  assert(commands.length < 3500, 'Finite command budget exhausted; preserve actual blocker');
  assert(validateSlicePayload(intent), 'Strict public intent payload is required');
  const control = publicControl(intent);
  const previous = s; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
  s = applySliceIntent(s, intent);
  commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
  append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= prefixCount, before: body(previous), after: body(s) });
  assertValidSliceState(s);
  assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= previous.random.cursor);
  assert.equal(s.revision, previous.revision + 1);
  if (prefixVerified) {
    originals();
    if (!replayingContinuation) {
      const evidence = { step: commands.length, revision: previous.revision, command: intent, control, randomBefore: previous.random, randomAfter: s.random };
      publicDecisions.push(evidence); append('public.jsonl', evidence);
      capture(key ?? `step-${commands.length}-${intent.type === 'ALL_KNOWING_EYE' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`);
    }
  }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}`);
}
function eg(command, key = null) { go({ type: 'ALL_KNOWING_EYE', command }, key); }
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = projectSliceState(s).activeEvent;
    const choiceId = strategy.eventChoices[event.id.startsWith('ORIGIN') ? 'ORIGIN' : event.id];
    assert(choiceId, `Unplanned event ${event.id}; preserve it without inventing a choice`);
    const prior = event.id === 'LIFE-CARE-01' ? structuredClone(body(s)) : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, prior ? 'actual-clinic-pay60' : `event-${event.id}-${choiceId}`);
    if (prior) {
      assert(s.cash <= prior.cash - 60, 'Treatment and any due weekly costs are actually paid');
      assert.equal(s.health, prior.H, 'Treatment payment is not free healing');
      for (const injury of prior.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const sameInjury = s.injuries.find(i => i.id === injury.id); assert(sameInjury);
        assert.equal(sameInjury.treatedRevision, prior.revision + 1); assert.equal(sameInjury.acquiredRevision, injury.acquiredRevision);
      }
      treatments.push({ paidPennies: 60, before: prior, after: structuredClone(body(s)) });
    }
  }
  assert.equal(s.activeEvent, null);
}
function ordinary(key = null, forceRest = false) {
  clear(); assert.equal(s.status, 'ACTIVE'); assert(!view().insideCase && !view().encounter.inside && !s.combat);
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, key); clear();
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  assert(!view().insideCase && !view().encounter.inside && !s.combat, 'Recovery only outside locked scenes');
  clear();
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    assert(n < 600, 'Ordinary preparation budget exhausted'); ordinary();
  }
}
function action(command, key = null) { ready(); eg(command, key); clear(); }

function practice(caseId) {
  const row = () => life().cases[caseId], a = () => currentAttempt(caseId);
  if (row().status === 'RESOLVED') return;
  assert(['AVAILABLE', 'OBSERVED', 'ACTIVE', 'EXAMINED'].includes(row().status), 'Never replace an interrupted ability attempt');
  if (row().status === 'AVAILABLE') action({ type: 'OBSERVE', caseId }, `${caseId}-source-costs-and-ordinary-alternative`);
  if (row().status === 'OBSERVED') {
    if (life().rig.purchasedWeek === null) {
      ready({ cash: 30 }); eg({ type: 'BUY_RIG' }, 'actual30p1AP-unique-nonpowered-rig'); clear();
    }
    if (life().playerLocation === 'OUTSIDE') {
      ready({ ap: 1, cash: 10, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'WALK_TO_ROOM' }, `${caseId}-actual4metre-walk-to-original-entrance`);
    }
    assert.equal(life().playerLocation, 'EXIT');
    eg({ type: 'INVITE', caseId, method: strategy.caseMethod }, `${caseId}-actual10p1AP-fresh-irena-invitation`);
  }
  if (row().status === 'ACTIVE') {
    assert.equal(life().activeCase, caseId); assert.equal(row().method, strategy.caseMethod); assert.equal(row().attempts.length, 1);
    if (!a().sourceRead) eg({ type: 'READ_SOURCE' }, `${caseId}-current-originals-explained`);
    if (!a().entered) {
      for (const [permission, key] of [['OWNER', 'owner'], ['TECHNICIAN', 'technician'], ['ABILITY', 'ability']]) {
        if (a().permission[key] === 'UNASKED') eg({ type: 'CONSENT', permission }, `${caseId}-fresh-${permission.toLowerCase()}-consent`);
      }
      if (!a().returnAgreed) eg({ type: 'AGREE_RETURN' }, `${caseId}-ordinary-return-agreed`);
      eg({ type: 'ENTER_ROOM' }, `${caseId}-three-actual-original4metre-walks`);
    }
    if (!a().exited && !a().papersReturned) {
      if (!a().papersTaken) eg({ type: 'TAKE_PAPERS' }, `${caseId}-take-same-two-originals`);
      if (!a().readFirst) eg({ type: 'READ_FIRST' }, `${caseId}-reread-first-original`);
      if (!a().readSecond) eg({ type: 'READ_SECOND' }, `${caseId}-reread-second-original`);
      if (caseId === 'original-paper-check') {
        if (!a().handoverObserved) eg({ type: 'OBSERVE_HANDOVER' }, `${caseId}-observe-current-positions`);
        if (!a().insight.attempts) eg({ type: 'BOUNDED_INSIGHT' }, `${caseId}-one-paid-insight-attempt`);
        if (!a().handoverAttempted) eg({ type: 'VERIFY_HANDOVER' }, `${caseId}-independent-current-verification`);
        if (!a().handoverVerified) eg({ type: 'MANUAL_COMPARE' }, `${caseId}-ordinary-comparison-after-failure`);
      } else {
        if (!a().rigPlaced) eg({ type: 'PLACE_RIG' }, `${caseId}-place-owned-original-rig`);
        if (!a().sliderCocked) eg({ type: 'COCK_SLIDER' }, `${caseId}-actual-manual-cocking`);
        if (!a().observedVersions.length) eg({ type: 'OBSERVE_SLIDER' }, `${caseId}-observe-actual-direction-and-sightline`);
        if (!a().forecast.attempts) eg({ type: 'PENDING_FORECAST' }, `${caseId}-one-paid-forecast-attempt`);
        if (caseId === 'pending-slider') {
          if (!a().catchAttempted) eg({ type: 'CATCH_SLIDER' }, `${caseId}-actual-release-and-independent-catch`);
          // A failed catch is already stopped on the floor. Do not invent a
          // second HAND_STOP on a motion that no longer exists.
          if (life().rig.motion === 'COCKED') eg({ type: 'HAND_STOP' }, `${caseId}-ordinary-manual-stop`);
          if (life().rig.sliderLocation !== 'RIG') eg({ type: 'RETRIEVE_SLIDER' }, `${caseId}-retrieve-same-original-from-actual-location`);
        } else {
          if (!a().conditionChanged) eg({ type: 'CHANGE_CONDITIONS' }, `${caseId}-actual-direction-and-sightline-change`);
          if (a().permission.owner === 'GRANTED') eg({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, `${caseId}-current-owner-withdrawal`);
          if (life().rig.motion === 'COCKED') eg({ type: 'HAND_STOP' }, `${caseId}-ordinary-stop-after-withdrawal`);
          if (life().rig.sightline === 'SHUTTERED') eg({ type: 'CLEAR_SIGHTLINE' }, `${caseId}-ordinary-open-same-shutter`);
          if (life().rig.sliderLocation !== 'RIG') eg({ type: 'RETRIEVE_SLIDER' }, `${caseId}-ordinary-retrieve-same-original`);
          assert.equal(a().forecast.effects, 0, 'Changed conditions never earn an application reward');
        }
      }
      eg({ type: 'RETURN_PAPERS' }, `${caseId}-same-original-papers-returned`);
    }
    if (a().rigPlaced && !a().rigReturned) eg({ type: 'RETURN_RIG' }, `${caseId}-same-owned-rig-returned-to-player`);
    if (!a().exited) eg({ type: 'EXIT_ROOM' }, `${caseId}-three-actual4metre-exits`);
    eg({ type: 'LEAVE' }, `${caseId}-actual-walk-out-and-adults-leave`);
  }
  assert.equal(row().status, 'EXAMINED'); assert.notEqual(row().result, 'NONE');
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-report`);
}
function encounter() {
  const e = () => s.allKnowingEye.encounter;
  if (e().status === 'AVAILABLE') {
    ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact });
    snapshot('recoveredBeforeEncounter');
    assert.equal(life().playerLocation, 'OUTSIDE'); assert.equal(life().maraPresent, false);
    assert.equal(life().irena.present, false); assert.equal(life().irena.location, 'AWAY');
    eg({ type: 'ENCOUNTER_TALK' }, 'actual4metre-arrival-and-edwin-name-exchange');
  }
  if (e().status === 'READY') {
    if (!view().encounter.policyConfirmed) eg({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-fight');
    assert.equal(e().policy, strategy.encounterPolicy);
    eg({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-edwin-fight'); snapshot('combatStart');
  }
  if (e().status === 'FIGHTING') {
    assert.equal(e().policy, strategy.encounterPolicy);
    for (const round of s.combatHistory.slice(e().startHistoryIndex)) assert.equal(round.stance, strategy.combatStance);
    while (s.combat && s.combat.round <= strategy.combatRoundCap) {
      const round = s.combat.round; go({ type: 'COMBAT_ROUND', stance: strategy.combatStance }, `combat-round-${round}`);
    }
    if (s.combat) { snapshot('combatFiniteCap'); throw new FiniteEncounterStop('Declared90-round cap reached; actual unfinished battle preserved'); }
  }
  assert.equal(s.combat, null); assert(e().terminal, 'Retain the actual terminal receipt');
  assert.equal(e().terminal.exitMetres, 4); assert.equal(e().terminal.exitSeconds, 4);
  assert.equal(e().scene.playerLocation, 'OUTSIDE'); assert.equal(e().scene.playerCoordinate, 0);
  assert.equal(view().encounter.inside, false); capture('actual-ordinary-encounter-exit'); snapshot('combatTerminal');
}

function verifyPrefix() {
  assert.deepEqual(commands, old.commands.slice(0, prefixCount));
  assert.deepEqual(s, migrateSliceState(peaceful), 'Compare the entire migrated existing living source');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 538); assert.equal(s.week, 125);
  assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1351, month: 11, day: 13 });
  assert.equal(s.random.cursor, 180); assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120);
  assert.equal(s.cash, 410); assert.equal(s.actionsRemaining, 3); assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100); assert.equal(s.wisdomAngel.promotionWeek, 117);
  assert.equal(Object.keys(s.progression.mastery).length, 19); assert.equal(Object.values(s.progression.mastery).filter(v => v === 0).length, 5);
  assert.equal(s.wisdomAngel.encounter.status, 'AVAILABLE'); assert.equal(s.wisdomAngel.encounter.playerLocation, 'OUTSIDE');
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', { creation: old.creation, seed: old.seed, commands: commands.slice(), commandCount: prefixCount, canonicalSha256: PREFIX_HASH, rawSourceSha256: PEACEFUL_HASH, rawSourceRoot: 'beforeLast', migratedWholeStateSha256: digest(original) });
  snapshot('departure'); capture('exact-original537-command-living-source');
}
function copyPrior(name, directory) {
  assert.equal(name, basename(name), 'Capture references must be local unique filenames');
  copyFileSync(`${directory}/${name}`, `${outputDir}/${name}`, constants.COPYFILE_EXCL);
}
function resumeTail(directory) {
  const file = `${directory}/natural.json`, entry = key => readObjectEntry(file, key);
  assert.equal(entry('stage'), 'ACTUAL_BLOCKER', 'Never resume a real death, completed outcome, or finite strategy cap');
  const provenance = entry('provenance');
  assert.equal(provenance.sourceSha256, SOURCE_HASH); assert.equal(provenance.peacefulSha256, PEACEFUL_HASH);
  assert.equal(provenance.defensiveSha256, DEFENSIVE_HASH); assert.equal(entry('producerSha256'), producerHash);
  assert.deepEqual(entry('strategy'), strategy, 'Resume cannot change the declared strategy');
  assert.equal(entry('seed'), old.seed); assert.deepEqual(entry('creation'), old.creation); assert.equal(entry('prefixVerified'), true);
  const previous = entry('commands'); assert.deepEqual(previous.slice(0, prefixCount), old.commands.slice(0, prefixCount));
  assert.deepEqual(migrateSliceState(entry('prefixFinal')), original);
  const priorFinal = entry('final'), priorBefore = entry('beforeLast'), priorIntent = entry('lastIntent'), phase = entry('failurePhase');
  assert.equal(priorFinal.status, 'ACTIVE', 'No dead body can be resumed');
  // The complete recorded tail is replayed, never loaded into a hand-edited run.
  // Only the last post-apply validation failure may be retried from beforeLast.
  // Its unchanged resource/RNG/results fingerprint prevents converting failure
  // into success after a wiring repair. The full rejected capture is retained.
  const retryLast = phase === 'AFTER_APPLY_VALIDATION';
  const replayCount = previous.length - (retryLast ? 1 : 0);
  if (retryLast) { assert.deepEqual(previous.at(-1), priorIntent); assert.equal(priorBefore.status, 'ACTIVE'); }
  replayingContinuation = true;
  try { for (const intent of previous.slice(prefixCount, replayCount)) go(intent); }
  finally { replayingContinuation = false; }
  assert.deepEqual(s, migrateSliceState(retryLast ? priorBefore : priorFinal), 'Entire saved legitimate continuation must replay exactly');
  const priorIndex = JSON.parse(readFileSync(`${directory}/boundaries.index.json`, 'utf8'));
  const priorSnapshots = entry('snapshots');
  for (const name of new Set([...Object.values(priorIndex), ...Object.values(priorSnapshots)])) {
    if (!Object.values(boundaries).includes(name) && !Object.values(snapshots).includes(name)) copyPrior(name, directory);
  }
  Object.assign(boundaries, priorIndex); Object.assign(snapshots, priorSnapshots);
  treatments.push(...entry('treatments'));
  const priorHash = fileDigest(file), preserved = `prior-blocker-${priorHash}.json`;
  copyFileSync(file, `${outputDir}/${preserved}`, constants.COPYFILE_EXCL);
  copyFileSync(`${directory}/public.jsonl`, `${outputDir}/prior-public-${priorHash}.jsonl`, constants.COPYFILE_EXCL);
  continuationSource = { directory, sha256: priorHash, preserved, commandCount: previous.length, retryLast, previousPhase: phase, randomCursor: s.random.cursor };
  if (retryLast) {
    go(priorIntent, 'same-blocked-final-command-retried-once');
    assert.deepEqual(body(s), body(migrateSliceState(priorFinal)), 'A repaired validator cannot alter actual costs, failures, injuries, mastery, or RNG');
    assert.deepEqual(s.allKnowingEye, priorFinal.allKnowingEye, 'All actual new scene outcomes remain unchanged');
  }
}

function save(stage, error = null) {
  verifySourceFiles();
  const e = s.allKnowingEye.encounter, actualRounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
  const outcomes = actualRounds.map(r => r.allKnowingEyeOutcome).filter(Boolean);
  const sum = (rows, selector) => rows.reduce((n, row) => n + selector(row), 0);
  const lifeJournal = life().journal, acquisition = s.allKnowingEye.acquisitionJournal;
  write('natural.json', {
    provenance: { kind: 'SAME_SEED_ORIGINAL537_LIVING_BOUNDARY_BRANCH', source, sourceSha256: SOURCE_HASH, peacefulSource, peacefulSha256: PEACEFUL_HASH, sourceRoot: 'beforeLast', defensiveSource, defensiveSha256: DEFENSIVE_HASH, original543CommandDeathPreserved: true, separateDefensiveDeathPreserved: true, newRandomChanges: false },
    producerSha256: producerHash, strategy, creation: old.creation, seed: old.seed, prefixCount, prefixVerified, continuationSource,
    commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments,
    stage, error: error ? String(error.stack ?? error) : null, final: s,
  });
  write('boundaries.index.json', boundaries);
  write('summary.json', {
    stage, strategy, source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH, defensiveSha256: DEFENSIVE_HASH, prefixCanonicalSha256: PREFIX_HASH, migratedWholeSourceSha256: original ? digest(original) : null },
    commands: commands.length, continuationSource, final: body(s), acting: s.progression.acting,
    originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery,
    lifeCases: Object.fromEntries(CASES.map(id => [id, structuredClone(life().cases[id])])),
    lifeAbilityUse: Object.fromEntries([['insight', NEW_IDS[0]], ['forecast', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { attempts: sum(uses, x => x.attempts), checkSuccesses: sum(uses, x => x.successes), actualApplications: sum(uses, x => x.effects), states: uses.map(x => x.state) }];
    })),
    actualCosts: {
      acquisitionCash: sum(acquisition, x => x.before.cash - x.after.cash), acquisitionAP: sum(acquisition, x => x.before.actions - x.after.actions),
      lifeCash: sum(lifeJournal, x => x.before.cash - x.after.cash), lifeAP: sum(lifeJournal, x => x.before.actions - x.after.actions),
      lifeSpirituality: sum(lifeJournal, x => x.before.spirituality - x.after.spirituality), lifeMind: sum(lifeJournal, x => x.before.mind - x.after.mind),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      clinic: sum(treatments, t => t.paidPennies), ordinaryWorkCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
      note: 'Command ledger records actual work, rest, weekly bills and event payments; separate mechanism receipts exclude unrelated weekly settlement.',
    },
    originalCrafts: original?.mysticismMagister.crafts ?? null, finalCrafts: s.mysticismMagister.crafts,
    consumedOldCraftIds: outcomes.flatMap(o => o.consumedCraftIds), inheritedFlashSample: s.polymath.samples.FLASH,
    sourceOriginals: sourceOriginals(s), life: { clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, playerLocation: life().playerLocation, playerTravelMetres: life().playerTravelMetres, maraPresent: life().maraPresent, irena: life().irena, rig: life().rig, pending: life().pending },
    encounter: { status: e.status, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      boundedInsight: { attempts: e.boundedInsightAttempts, successfulWindows: e.boundedInsightChecks, actualApplications: e.boundedInsightSuccesses },
      pendingForecast: { attempts: e.pendingForecastAttempts, successfulWindows: e.pendingForecastChecks, actualApplications: e.pendingForecastSuccesses } },
    rounds: actualRounds.map(r => ({ round: r.round, stance: r.stance, consequenceDomain: r.consequenceDomain ?? null, consequenceRoll: r.consequenceRoll ?? null, result: r.allKnowingEyeOutcome ? { playerHealth: r.allKnowingEyeOutcome.playerHealthAfter, playerMind: r.allKnowingEyeOutcome.playerMindAfter, playerSpirituality: r.allKnowingEyeOutcome.playerSpiritualityAfter, enemyHealth: r.allKnowingEyeOutcome.enemyHealth, enemyMind: r.allKnowingEyeOutcome.enemyMind, consumedCraftIds: r.allKnowingEyeOutcome.consumedCraftIds, expiredWindows: r.allKnowingEyeOutcome.expiredWindows } : null })),
    bottles: structuredClone(s.allKnowingEye.bottles), treatments, boundaries: Object.keys(boundaries), snapshots,
    bodilyMental: 'Health/injuries are bodily effects. Mind payment and MENTAL consequences are independent; a forecast does not give mental immunity.',
  });
  write('capture-integrity.json', { producerSha256: producerHash, naturalSha256: fileDigest(`${outputDir}/natural.json`), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`), publicSha256: fileDigest(`${outputDir}/public.jsonl`), files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])) });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
}

try {
  for (const intent of old.commands.slice(0, prefixCount)) go(intent);
  verifyPrefix();
  if (resumeDirectory) resumeTail(resumeDirectory);
  if (s.progression.sequence === 2) {
    if (!s.allKnowingEye.guidanceKnown) {
      ready({ ap: 1, cash: 500, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'LEARN_GUIDANCE' }, 'actual500p-guidance-and-frozen-eight-root-source');
    }
    for (const taskId of ['VERIFY_ORIGINALS', 'RECORD_CONDITIONS', 'MARK_RETURN']) {
      if (!s.allKnowingEye.preparations.some(row => row.taskId === taskId)) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
    }
  }
  for (let number = s.allKnowingEye.bottles.filter(b => b.status === 'CONSUMED').length; s.progression.sequence === 2 && number < strategy.potionAttemptCap; number++) {
    let bottle = s.allKnowingEye.bottles.find(b => b.status === 'PLAYER') ?? s.allKnowingEye.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      if (s.allKnowingEye.resupply.requestedWeek === null) { ready({ cash: 100 }); action({ type: 'REQUEST_SUPPLY' }, `request-real-supply-after-${number}-failures`); }
      ready({ afterWeek: s.allKnowingEye.resupply.requestedWeek });
      eg({ type: 'RECEIVE_SUPPLY' }, `actual-later-week-new-supply-${number}`);
      bottle = s.allKnowingEye.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.allKnowingEye.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-labour`);
      ready({ cash: 1250 }); eg({ type: 'BUY_POTION', bottleId }, `actual1100p-buy-${bottleId}`);
    }
    if (s.allKnowingEye.preparedWeek === null) {
      ready({ ap: 1, cash: 150, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.wisdomAngel.promotionWeek + 11 });
      eg({ type: 'PREPARE_PROMOTION' }, `actual150p-current-week-preparation-${bottleId}`);
    }
    assert.equal(s.allKnowingEye.preparedWeek, s.week); assert(s.week - s.wisdomAngel.promotionWeek >= 12);
    const oldMastery = structuredClone(s.progression.mastery);
    eg({ type: 'CONSUME', bottleId, confirmed: true }, `actual-consumption-${bottleId}`);
    for (const [id, value] of Object.entries(oldMastery)) assert.equal(s.progression.mastery[id], value);
  }
  if (s.progression.sequence !== 1) save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
  else {
    if (life().journal.length === 0) { for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted'); }
    for (const caseId of CASES) practice(caseId);
    if (!life().reflected) action({ type: 'REFLECT' }, 'three-honest-actual-reports-reflected');
    assert.equal(s.progression.acting, 100); snapshot('practiced');
    encounter();
    if (!boundaries['actual-paid-work-after-living-exit']) {
      clear();
      if (s.wagePaidWeek === s.week) ready({ afterWeek: s.week });
      ready({ ap: 1 });
      go({ type: 'ACTION', action: 'WORK' }, 'actual-paid-work-after-living-exit'); clear();
    }
    save('NATURAL_ALL_KNOWING_EYE_PUBLIC_CONTINUATION');
  }
} catch (error) {
  if (error instanceof ActualTerminalStop) {
    if (s.allKnowingEye.encounter.terminal) snapshot('combatTerminal');
    snapshot('actualTerminal'); save('NATURAL_ACTUAL_TERMINAL');
  } else if (error instanceof FiniteEncounterStop) save('NATURAL_FINITE_ENCOUNTER_UNRESOLVED', error);
  else { save('ACTUAL_BLOCKER', error); throw error; }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
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
