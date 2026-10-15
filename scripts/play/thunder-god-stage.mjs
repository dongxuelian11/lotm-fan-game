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
import { validateThunderGodSource } from '../../dist/domain/thunder-god/index.js';
import { thunderGodExpectedOriginals, thunderGodLifeMasteryGains } from '../../dist/domain/thunder-god/life.js';

// Frozen public strategy, adapted from the verified stage192 producer. This file
// never edits a run, chooses a seed, examines future rolls, reloads a failed
// check, resurrects a dead body, or chooses its stance from observed damage.
const source = 'tests/fixtures/catastrophe-v01710/natural.json';
const peacefulSource = 'tests/fixtures/catastrophe-v01710/original-enemy-approach.json';
const SOURCE_HASH = 'cb8649c4d3dc15b5fa61601591eaed3f99579082f01bffa4f566afbf7ed8dc53';
const PEACEFUL_HASH = '3ee5d4bfb9582aabb88a477bd5f0b5a47c335e8dbe5074b0eafbafff35d8b448';
const PREFIX_HASH = '07628a85b4aa55e280e48387c1065c735b958d71e85834466d306ff3b90b1a23';
const PEACEFUL_STATE_HASH = 'e589b7ed4483b3ffa0420147312798779da7fe80313552e855b5954f7dbe4bd6';
const prefixCount = 599;
const ROOTS = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing', 'catastrophe'];
const CASES = ['located-target', 'personal-impact', 'obscured-return'];
const NEW_IDS = ['tyrant.s1.guided-thunder', 'tyrant.s1.storm-brace'];
const strategy = Object.freeze({
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12,
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', potionLabourSteps: 5,
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  targetRoute: ['GUIDED_THUNDER_ONCE', 'DISCHARGE_TARGET_ONLY_AFTER_SUCCESSFUL_WINDOW', 'MANUAL_INSPECT_AFTER_FAILED_WINDOW_OR_MISS', 'RETRIEVE_SAME_ORIGINAL'],
  personalRoute: ['STORM_BRACE_ONCE', 'RELEASE_IMPACT_ONLY_WITH_ACTIVE_GUARD_ELSE_HAND_RESET', 'RETURN_SAME_PAD'],
  changedRoute: ['GUIDED_THUNDER_ONCE', 'CHANGE_CONDITIONS', 'WITHDRAW_OWNER', 'STOP_PULSE', 'CLEAR_HOOD', 'RETRIEVE_SAME_ORIGINAL'],
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});
const producerHash = fileDigest(fileURLToPath(import.meta.url));
verifySourceFiles();
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(source, k)]));
const peaceful = readObjectEntry(peacefulSource, 'beforeLast');
assert.equal(old.commands.length, 602); assert.equal(old.final.status, 'DEAD');
assert.equal(old.seed, 'sailor-natural-v026'); assert.equal(peaceful.status, 'ACTIVE');
assert.equal(old.final.schemaVersion, 168); assert.equal(old.final.contentVersion, 'catastrophe-v168');
assert.equal(peaceful.schemaVersion, 168); assert.equal(peaceful.contentVersion, 'catastrophe-v168');
assert.equal(digest(old.commands.slice(0, prefixCount)), PREFIX_HASH);
assert.equal(digest(peaceful), PEACEFUL_STATE_HASH);
assert.deepEqual(readObjectEntry(peacefulSource, 'lastIntent'), old.commands[prefixCount]);

const resumeDirectory = process.argv[2] === '--resume-from' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !resumeDirectory) throw new Error('Usage: thunder-god-stage.mjs [--resume-from actual-blocker-capture-directory]');
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/thunder-god-01930-');
const commands = [], boundaries = {}, snapshots = {}, treatments = [], publicDecisions = [];
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' });
writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = createSliceRun(old.final.runId, old.creation, old.seed);
let initial = structuredClone(s), original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, continuationSource = null, failurePhase = 'INITIALIZATION', replayingContinuation = false, frozenSourceScene = null;
const view = () => projectSliceState(s).thunderGod;
const life = () => s.thunderGod.life;
const currentAttempt = caseId => life().cases[caseId].attempts.at(-1);
const sourceOriginals = state => structuredClone(state.catastrophe.life.site);
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality, cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk, random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting });
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function verifySourceFiles() {
  assert.equal(fileDigest(source), SOURCE_HASH, 'The original602-command death capture is immutable');
  assert.equal(fileDigest(peacefulSource), PEACEFUL_HASH, 'Use the exact existing599-command living boundary');
}
function originals() {
  assert(original);
  for (const root of ROOTS) {
    const live = structuredClone(s[root]);
    // Compare inherited history through a read-only view. The live original
    // site is never reset: its actual changes must match the new life journal.
    if (root === 'catastrophe') live.life.site = sourceOriginals(original);
    assert.deepEqual(live, original[root], `Preserve original ${root} history`);
  }
  if (s.thunderGod.guidanceKnown) {
    assert.deepEqual(s.thunderGod.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    if (frozenSourceScene === null) frozenSourceScene = structuredClone(s.thunderGod.sourceScene);
    assert.deepEqual(s.thunderGod.sourceScene, frozenSourceScene, 'The paid-guidance sourceScene is immutable');
    assert.deepEqual(s.thunderGod.sourceScene.originals, sourceOriginals(original));
    assert(validateThunderGodSource(s), 'Only audited actual original-site walks, clock and keeper effort may change');
    assert.deepEqual(sourceOriginals(s), thunderGodExpectedOriginals(s));
  } else assert.deepEqual(sourceOriginals(s), sourceOriginals(original));
  const site = sourceOriginals(s), start = sourceOriginals(original);
  for (const key of ['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel']) {
    assert.deepEqual(site[key], start[key], `The same original ${key} is unchanged`);
  }
  const journal = life().journal;
  const sum = key => journal.reduce((n, row) => n + row[key], 0);
  assert.equal(site.clockSeconds, start.clockSeconds + sum('elapsedSeconds'));
  assert.equal(site.playerTravelMetres, start.playerTravelMetres + sum('playerWalkedMetres'));
  assert.equal(site.keeper.travelMetres, start.keeper.travelMetres + sum('keeperWalkedMetres'));
  assert.equal(site.keeper.energy, start.keeper.energy - sum('keeperEnergySpent'));
  assert.deepEqual(s.town, original.town, 'The old club and every original town item stay in their real locations');
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(thunderGodLifeMasteryGains(s))) expectedMastery[id] += gain;
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.thunderGodOutcome; assert(outcome, 'No unrelated new battle substituted');
    const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
    assert(outcome.playerActions.length <= round.playerCount && outcome.enemyActions.length <= round.enemyCount, 'Actual action counts cannot exceed the public wheels');
    if (actions.length < round.playerCount + round.enemyCount) assert.equal(outcome.enemyStatus, 'SURRENDERED', 'Only an actual early surrender truncates this fixed CONTROL round');
    assert.deepEqual(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })), 'Public action order comes from the actual receipts');
    assert.deepEqual(actions.map(action => action.order), actions.map((_, index) => index));
    assert.equal(outcome.source.clubHeld, original.town.clubLocation === 'HAND');
    for (const action of actions) {
      assert.equal(action.elapsedSeconds, 5);
      for (const id of action.masteryApplied) {
        assert(Object.hasOwn(expectedMastery, id), 'Mastery must name an existing learned ability');
        expectedMastery[id] = Math.min(500, expectedMastery[id] + 8);
      }
    }
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual applied receipts may change mastery');
  assert.equal(s.random.seed, old.seed);
  const character = structuredClone(s.character); character.coreStats = structuredClone(original.character.coreStats);
  assert.deepEqual(character, original.character, 'The original name, gender, age and identity remain unchanged');
  assert.deepEqual(s.character.coreStats, Object.fromEntries(Object.entries(original.character.coreStats).map(([key, value]) => [key, value + (s.progression.sequence === 1 ? 1 : 0)])));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek);
  assert.deepEqual(s.catastrophe.encounter, original.catastrophe.encounter, 'The original Vale is never contacted');
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
  if (intent.type === 'THUNDER_GOD') {
    const available = p.thunderGod.actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(available, `No current public ThunderGod control: ${JSON.stringify(intent.command)}`);
    assert(available.enabled, available.reason);
    return { kind: 'THUNDER_GOD', ...structuredClone(available) };
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
      capture(key ?? `step-${commands.length}-${intent.type === 'THUNDER_GOD' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`);
    }
  }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}`);
}
function eg(command, key = null) { go({ type: 'THUNDER_GOD', command }, key); }
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
  assert(['AVAILABLE', 'OBSERVED', 'ACTIVE', 'EXAMINED'].includes(row().status), 'Never replace an interrupted paid ability attempt');
  if (row().status === 'AVAILABLE') action({ type: 'OBSERVE', caseId }, `${caseId}-source-costs-and-ordinary-alternative`);
  if (row().status === 'OBSERVED') {
    if (life().target.purchasedWeek === null) {
      ready({ cash: 40 }); eg({ type: 'BUY_TARGET' }, 'actual40p1AP-unique-original-target'); clear();
    }
    if (life().pad.purchasedWeek === null) {
      ready({ cash: 20 }); eg({ type: 'BUY_PAD' }, 'actual20p1AP-unique-personal-pad'); clear();
    }
    if (life().playerLocation === 'OUTSIDE') {
      ready({ ap: 1, cash: 10, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'WALK_TO_SITE' }, `${caseId}-contact-at-same-original-exit-no-invented-travel`);
    }
    assert.equal(life().playerLocation, 'EXIT');
    eg({ type: 'INVITE', caseId, method: strategy.caseMethod }, `${caseId}-actual10p1AP-fresh-finn-invitation`);
  }
  if (row().status === 'ACTIVE') {
    assert.equal(life().activeCase, caseId); assert.equal(row().method, strategy.caseMethod); assert.equal(row().attempts.length, 1);
    if (!a().sourceRead) eg({ type: 'READ_SOURCE' }, `${caseId}-current-originals-and-bodily-cost-explained`);
    if (!a().entered) {
      for (const [permission, key] of [['OWNER', 'owner'], ['TECHNICIAN', 'technician'], ['ABILITY', 'ability']]) {
        if (a().permission[key] === 'UNASKED') eg({ type: 'CONSENT', permission }, `${caseId}-fresh-${permission.toLowerCase()}-consent`);
      }
      if (!a().returnAgreed) eg({ type: 'AGREE_RETURN' }, `${caseId}-ordinary-return-and-actual-one-keeper-energy`);
      eg({ type: 'ENTER_SITE' }, `${caseId}-player-and-finn-actual-six-metre-entry`);
    }
    if (!a().exited && a().result === 'NONE') {
      if (caseId === 'personal-impact') {
        if (!a().padWorn) eg({ type: 'WEAR_PAD' }, `${caseId}-actual-walk-to-twelve-metres-and-wear-original-pad`);
        if (!a().adultsCleared) eg({ type: 'CLEAR_ADULTS' }, `${caseId}-keeper-and-finn-actually-walk-outside-impact-line`);
        if (!a().impactRegistered) eg({ type: 'REGISTER_IMPACT' }, `${caseId}-declare-one-personal-impact-pad10-and-unprotected-health5`);
        if (!a().guard.attempts) eg({ type: 'STORM_BRACE' }, `${caseId}-one-paid-guard-attempt`);
        if (!a().impactReleased && !a().handReset) {
          if (a().guard.state === 'ACTIVE') eg({ type: 'RELEASE_IMPACT' }, `${caseId}-actual-declared-impact-with-current-guard`);
          else eg({ type: 'HAND_RESET' }, `${caseId}-ordinary-safe-reset-after-failed-guard-with-actual-pad-wear`);
        }
      } else {
        if (!a().targetPlaced) eg({ type: 'PLACE_TARGET' }, `${caseId}-actual-walk-to-twelve-metres-and-place-same-original-target`);
        // Resume only incomplete setup. Cleanup may already have moved the
        // player back to the original target after permission withdrawal.
        if (a().observedTargetVersion === null) {
          if (life().playerLocation === 'TARGET') eg({ type: 'STEP_BACK' }, `${caseId}-actual-six-metre-step-back`);
          if (!a().adultsCleared) eg({ type: 'CLEAR_ADULTS' }, `${caseId}-keeper-and-finn-actually-walk-outside-target-line`);
          eg({ type: 'OBSERVE_TARGET' }, `${caseId}-locate-same-original-target-and-current-version`);
        }
        if (!a().guided.attempts) eg({ type: 'GUIDED_THUNDER' }, `${caseId}-one-paid-guided-thunder-attempt`);
        if (caseId === 'located-target') {
          if (!a().dischargeAttempted && !a().manuallyInspected && a().guided.state === 'ACTIVE') {
            eg({ type: 'DISCHARGE_TARGET' }, `${caseId}-separate-actual-will-check-and-original-target-hit-or-miss`);
          }
          if (!a().targetHit && !a().manuallyInspected) eg({ type: 'MANUAL_INSPECT' }, `${caseId}-actual-close-up-ordinary-inspection-after-failure`);
        } else {
          if (!a().conditionChanged) eg({ type: 'CHANGE_CONDITIONS' }, `${caseId}-finn-actually-closes-original-hood-and-changes-version`);
          if (a().permission.owner === 'GRANTED') eg({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, `${caseId}-current-keeper-withdrawal`);
          assert.equal(life().pending, null, 'Changed conditions and withdrawal invalidate the old window');
          if (life().target.pulse === 'ARMED') eg({ type: 'STOP_PULSE' }, `${caseId}-ordinary-stop-after-withdrawal`);
          if (life().target.hood === 'CLOSED') eg({ type: 'CLEAR_HOOD' }, `${caseId}-ordinary-real-walk-and-open-same-hood`);
          if (life().target.location === 'HOLDER') eg({ type: 'RETRIEVE_TARGET' }, `${caseId}-ordinary-retrieve-same-original-to-player-pack`);
          assert.equal(a().guided.effects, 0, 'Changed conditions never earn an application reward');
        }
      }
    }
    if (life().pending || life().target.pulse === 'ARMED' || life().pad.registered) eg({ type: 'STOP_PULSE' }, `${caseId}-ordinary-stop-unused-effect`);
    if (life().target.hood === 'CLOSED') eg({ type: 'CLEAR_HOOD' }, `${caseId}-ordinary-clear-original-hood`);
    if (life().target.location === 'HOLDER') eg({ type: 'RETRIEVE_TARGET' }, `${caseId}-same-original-target-returned-to-pack`);
    if (life().pad.location === 'WORN') eg({ type: 'RETURN_PAD' }, `${caseId}-same-original-pad-returned-to-pack`);
    if (!a().exited) eg({ type: 'EXIT_SITE' }, `${caseId}-actual-twelve-metre-route-exit-and-keeper-return`);
    eg({ type: 'LEAVE' }, `${caseId}-end-current-contact-and-finn-actually-leaves`);
  }
  assert.equal(row().status, 'EXAMINED'); assert.notEqual(row().result, 'NONE');
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-and-cost-report`);
}
function encounter() {
  const e = () => s.thunderGod.encounter;
  if (e().status === 'AVAILABLE') {
    ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact });
    snapshot('recoveredBeforeEncounter');
    assert.equal(life().playerLocation, 'OUTSIDE'); assert.equal(life().keeperPresent, false);
    assert.equal(life().finn.present, false); assert.equal(life().finn.location, 'AWAY');
    assert.equal(s.catastrophe.life.site.playerPosition, 'EXIT'); assert.equal(s.catastrophe.life.site.keeper.position, 'CONTROL');
    eg({ type: 'ENCOUNTER_TALK' }, 'actual4metre-dry-platform-arrival-and-oren-name-exchange');
  }
  if (e().status === 'READY') {
    if (!view().encounter.policyConfirmed) eg({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-fight');
    assert.equal(e().policy, strategy.encounterPolicy);
    eg({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-oren-fight'); snapshot('combatStart');
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
  assert.deepEqual(s, migrateSliceState(peaceful), 'Compare the entire migrated original599 living state');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 600); assert.equal(s.week, 138);
  assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 2, day: 12 });
  assert.equal(s.random.cursor, 267); assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120);
  assert.equal(s.cash, 350); assert.equal(s.actionsRemaining, 3); assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  assert.equal(s.character.name, '托林'); assert.equal(s.character.gender, 'FEMALE'); assert.equal(s.character.age, 26);
  assert.deepEqual(s.character.coreStats, { physique: 34, perception: 27, will: 27, knowledge: 21 });
  assert.equal(s.progression.pathwayId, 'tyrant'); assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100);
  assert.equal(s.catastrophe.promotionWeek, 131); assert.equal(s.progression.promotionWeek, 7);
  assert.equal(Object.keys(s.progression.mastery).length, 22); assert.equal(Object.values(s.progression.mastery).filter(v => v === 0).length, 7);
  assert.equal(s.catastrophe.encounter.status, 'AVAILABLE'); assert.equal(s.catastrophe.encounter.approachWeek, null);
  assert.deepEqual(sourceOriginals(s), {
    id: 'CT2-COVE', boundaryMetres: 12, clockSeconds: 123, playerPosition: 'EXIT', playerTravelMetres: 12,
    keeper: { id: 'CT2-NORA', name: '诺拉', age: 45, alive: true, position: 'CONTROL', energy: 88, travelMetres: 36 },
    water: { id: 'CT2-WATER', originalUnits: 20, bayUnits: 20, channelUnits: 0 },
    gate: { id: 'CT2-GATE', owner: 'CT2-NORA', position: 'CLOSED', durability: 96, operations: 4 },
    buoy: { id: 'CT2-BUOY', owner: 'CT2-NORA', offsetMetres: 0 },
    mooring: { id: 'CT2-MOORING', owner: 'CT2-NORA', durability: 99 },
    winch: { id: 'CT2-WINCH', owner: 'CT2-NORA', durability: 99 },
    wheel: { id: 'CT2-WHEEL', owner: 'CT2-NORA', durability: 99, turns: 1 },
  });
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', { creation: old.creation, seed: old.seed, commands: commands.slice(), commandCount: prefixCount, canonicalSha256: PREFIX_HASH, rawSourceSha256: PEACEFUL_HASH, rawSourceRoot: 'beforeLast', rawWholeStateSha256: PEACEFUL_STATE_HASH, rawSchemaVersion: peaceful.schemaVersion, rawContentVersion: peaceful.contentVersion, migratedWholeStateSha256: digest(original) });
  snapshot('departure'); capture('exact-original599-command-living-source');
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
  assert.equal(entry('producerSha256'), producerHash);
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
    assert.deepEqual(s, migrateSliceState(priorFinal), 'A wiring repair cannot alter any actual body, original source, costs, failures, injuries, outcomes, mastery, or RNG');
  }
}

function save(stage, error = null) {
  verifySourceFiles();
  const e = s.thunderGod.encounter, actualRounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
  const outcomes = actualRounds.map(r => r.thunderGodOutcome).filter(Boolean);
  const sum = (rows, selector) => rows.reduce((n, row) => n + selector(row), 0);
  const lifeJournal = life().journal, acquisition = s.thunderGod.acquisitionJournal;
  const sortedActions = outcome => [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const initialSite = original ? sourceOriginals(original) : null, finalSite = sourceOriginals(s);
  write('natural.json', {
    provenance: { kind: 'SAME_SEED_ORIGINAL599_LIVING_BOUNDARY_BRANCH', source, sourceSha256: SOURCE_HASH, peacefulSource, peacefulSha256: PEACEFUL_HASH, sourceRoot: 'beforeLast', rawSourceStateSha256: PEACEFUL_STATE_HASH, rawSchemaVersion: peaceful.schemaVersion, rawContentVersion: peaceful.contentVersion, original602CommandDeathPreserved: true, newRandomChanges: false },
    producerSha256: producerHash, strategy, creation: old.creation, seed: old.seed, prefixCount, prefixVerified, continuationSource,
    commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments,
    stage, error: error ? String(error.stack ?? error) : null, final: s,
  });
  write('boundaries.index.json', boundaries);
  write('summary.json', {
    stage, strategy, source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH, prefixCanonicalSha256: PREFIX_HASH, rawWholeSourceSha256: PEACEFUL_STATE_HASH, rawSchemaVersion: peaceful.schemaVersion, rawContentVersion: peaceful.contentVersion, migratedWholeSourceSha256: original ? digest(original) : null, original602CommandDeathPreserved: true },
    commands: commands.length, continuationSource, final: body(s), acting: s.progression.acting,
    originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery,
    lifeCases: Object.fromEntries(CASES.map(id => [id, structuredClone(life().cases[id])])),
    lifeAbilityUse: Object.fromEntries([['guided', NEW_IDS[0]], ['guard', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { actualCasts: sum(uses, x => x.attempts), successfulWindows: sum(uses, x => x.successes), actualApplications: sum(uses, x => x.effects), states: uses.map(x => x.state) }];
    })),
    actualCosts: {
      acquisitionCash: sum(acquisition, x => x.before.cash - x.after.cash), acquisitionAP: sum(acquisition, x => x.before.actions - x.after.actions),
      lifeCash: sum(lifeJournal, x => x.before.cash - x.after.cash), lifeAP: sum(lifeJournal, x => x.before.actions - x.after.actions),
      lifeSpirituality: sum(lifeJournal, x => x.before.spirituality - x.after.spirituality), lifeMind: sum(lifeJournal, x => x.before.mind - x.after.mind), lifeHealthLost: sum(lifeJournal, x => x.before.health - x.after.health),
      sourceKeeperEnergy: sum(lifeJournal, x => x.keeperEnergySpent), sourceKeeperWalkedMetres: sum(lifeJournal, x => x.keeperWalkedMetres),
      sourcePlayerWalkedMetres: sum(lifeJournal, x => x.playerWalkedMetres), finnWalkedMetres: sum(lifeJournal, x => x.finnWalkedMetres), sourceClockSeconds: sum(lifeJournal, x => x.elapsedSeconds),
      targetDurabilitySpent: 100 - life().target.durability, personalPadDurabilitySpent: 100 - life().pad.durability,
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyRodChargesSpent: sum(outcomes.flatMap(o => o.enemyActions), a => a.rodChargeSpent),
      clinic: sum(treatments, t => t.paidPennies), ordinaryWorkCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
      note: 'The public command ledger records actual work, rest, weekly finance and any real treatment. Scene receipts account only their actual costs; the healthy original599 boundary requires no forced clinic.',
    },
    sourceOriginals: { before: initialSite, after: finalSite,
      frozenWaterGateAndTools: initialSite ? Object.fromEntries(['water', 'gate', 'buoy', 'mooring', 'winch', 'wheel'].map(key => [key, isDeepStrictEqual(initialSite[key], finalSite[key])])) : null,
      oldEncounterUncontacted: isDeepStrictEqual(s.catastrophe.encounter, peaceful.catastrophe.encounter),
      sourceHistorySha256: s.thunderGod.sourceHistory ? digest(s.thunderGod.sourceHistory) : null, sourceSceneSha256: s.thunderGod.sourceScene ? digest(s.thunderGod.sourceScene) : null },
    inheritedInventory: { originalTown: original?.town ?? null, currentTown: s.town },
    life: { clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, playerLocation: life().playerLocation, playerTravelMetres: life().playerTravelMetres,
      keeperPresent: life().keeperPresent, finn: life().finn, target: life().target, pad: life().pad, pending: life().pending },
    encounter: { status: e.status, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      inheritedApplications: e.inheritedApplications, screenReveals: e.screenReveals,
      guidedThunder: { actualCasts: e.guidedThunderAttempts, successfulWindows: e.guidedThunderChecks, actualApplications: e.guidedThunderSuccesses },
      stormBrace: { actualCasts: e.stormBraceAttempts, successfulWindows: e.stormBraceChecks, actualApplications: e.stormBraceSuccesses } },
    rounds: actualRounds.map(r => ({ round: r.round, stance: r.stance, first: r.first,
      countWheels: { playerRoll: r.playerCountRoll, playerCount: r.playerCount, enemyRoll: r.enemyCountRoll, enemyCount: r.enemyCount },
      consequenceDomain: r.consequenceDomain ?? null, consequenceRoll: r.consequenceRoll ?? null,
      result: r.thunderGodOutcome ? { playerHealth: r.thunderGodOutcome.playerHealthAfter, playerMind: r.thunderGodOutcome.playerMindAfter, playerSpirituality: r.thunderGodOutcome.playerSpiritualityAfter,
        enemyHealth: r.thunderGodOutcome.enemyHealth, enemyMind: r.thunderGodOutcome.enemyMind, enemySpirituality: r.thunderGodOutcome.enemySpirituality,
        actualPlayerActions: r.thunderGodOutcome.playerActions.length, actualEnemyActions: r.thunderGodOutcome.enemyActions.length,
        actualOrderedActions: sortedActions(r.thunderGodOutcome), expiredWindows: r.thunderGodOutcome.expiredWindows, pendingAfter: r.thunderGodOutcome.pendingEnemyActionAfter,
        windowsAfter: r.thunderGodOutcome.windowsAfter, materialsAfter: r.thunderGodOutcome.materialsAfter } : null })),
    bottles: structuredClone(s.thunderGod.bottles), treatments, boundaries: Object.keys(boundaries), snapshots,
    bodilyMental: 'Health and injuries are bodily effects. Casting mind costs and MENTAL pressure remain independent. StormBrace applies only to one later actual visible BODY effect and provides no mental immunity.',
  });
  write('capture-integrity.json', { producerSha256: producerHash, naturalSha256: fileDigest(`${outputDir}/natural.json`), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`), publicSha256: fileDigest(`${outputDir}/public.jsonl`), files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])) });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
}

try {
  for (const intent of old.commands.slice(0, prefixCount)) go(intent);
  verifyPrefix();
  if (resumeDirectory) resumeTail(resumeDirectory);
  if (s.progression.sequence === 2) {
    if (!s.thunderGod.guidanceKnown) {
      ready({ ap: 1, cash: 500, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'LEARN_GUIDANCE' }, 'actual500p-guidance-and-frozen-eight-root-source');
    }
    for (const taskId of ['VERIFY_ORIGINALS', 'LOCATE_TARGET', 'MARK_RETURN']) {
      if (!s.thunderGod.preparations.some(row => row.taskId === taskId)) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
    }
  }
  for (let number = s.thunderGod.bottles.filter(b => b.status === 'CONSUMED').length; s.progression.sequence === 2 && number < strategy.potionAttemptCap; number++) {
    let bottle = s.thunderGod.bottles.find(b => b.status === 'PLAYER') ?? s.thunderGod.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      if (s.thunderGod.resupply.requestedWeek === null) { ready({ cash: 100 }); action({ type: 'REQUEST_SUPPLY' }, `request-real-supply-after-${number}-failures`); }
      ready({ afterWeek: s.thunderGod.resupply.requestedWeek });
      eg({ type: 'RECEIVE_SUPPLY' }, `actual-later-week-new-supply-${number}`);
      bottle = s.thunderGod.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.thunderGod.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-labour`);
      ready({ cash: 1250 }); eg({ type: 'BUY_POTION', bottleId }, `actual1100p-buy-${bottleId}`);
    }
    if (s.thunderGod.preparedWeek === null) {
      ready({ ap: 1, cash: 150, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.catastrophe.promotionWeek + 11 });
      eg({ type: 'PREPARE_PROMOTION' }, `actual150p-current-week-preparation-${bottleId}`);
    }
    assert.equal(s.thunderGod.preparedWeek, s.week); assert(s.week - s.catastrophe.promotionWeek >= 12);
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
    save('NATURAL_THUNDER_GOD_PUBLIC_CONTINUATION');
  }
} catch (error) {
  if (error instanceof ActualTerminalStop || prefixVerified && s.status !== 'ACTIVE') {
    if (s.thunderGod.encounter.terminal) snapshot('combatTerminal');
    snapshot('actualTerminal'); save('NATURAL_ACTUAL_TERMINAL', error instanceof ActualTerminalStop ? null : error);
    if (!(error instanceof ActualTerminalStop)) throw error;
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
