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
import { validatePureWhiteAngelSource } from '../../dist/domain/pure-white-angel/index.js';
import { pureWhiteAngelExpectedOriginals, pureWhiteAngelLifeMasteryGains } from '../../dist/domain/pure-white-angel/life.js';
import { pureWhiteAngelEncounterOriginalEvents } from '../../dist/domain/pure-white-angel/encounter.js';

// Frozen public strategy. Replay the actual complete729-command living capture.
// Never edit a run, choose a replacement seed, inspect future rolls, reload a
// failed check, resurrect a body, or change the fixed strategy after an outcome.
const source = 'tests/fixtures/light-seeker-v01720/natural.json';
const SOURCE_HASH = '0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556';
const PREFIX_HASH = '5df5681e46346992f05a11a41a279ea659e98e77bf288a4bf891dcaa28be95b4';
const SOURCE_STATE_HASH = '07cac5fb2cbe060c179152c3f634bbc70a4534a2d2b752399bf31ae08df450ff';
const prefixCount = 729;
const ROOTS = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor', 'lightSeeker'];
const CASES = ['residue-trace', 'personal-impact', 'screened-return'];
const NEW_IDS = ['sun.s1.focused-purification', 'sun.s1.warm-radiance-guard'];
const strategy = Object.freeze({
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12,
  ordinaryActions: 'WORK_ONCE_PER_WEEK_WHEN_FIT_THEN_REST', potionLabourSteps: 5,
  livingExitPreparation: { action: 'REST_UNTIL_PUBLIC_WORK_ENABLED_AND_UNPAID_THIS_WEEK', actionCap: 30 },
  originalInjuryRecovery: ['PUBLIC_CARE_DISCOVERY_IF_UNKNOWN', 'ACTUAL_REST_TO_CLINIC', 'PAY_60_PENNIES', 'LATER_ORDINARY_REST'],
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: 0 },
  residueRoute: ['FOCUSED_PURIFICATION_ONCE', 'CLEANSE_SAMPLE_ONLY_AFTER_SUCCESSFUL_WINDOW', 'MANUAL_CONTAIN_AFTER_FAILED_WINDOW_OR_CHECK', 'RETRIEVE_SAME_ORIGINAL'],
  personalRoute: ['WARM_RADIANCE_GUARD_ONCE', 'RELEASE_IMPACT_ONLY_WITH_ACTIVE_GUARD_ELSE_HANDLE_RESET', 'RETURN_SAME_PAD'],
  changedRoute: ['WARM_RADIANCE_GUARD_ONCE', 'CHANGE_CONDITIONS', 'WITHDRAW_OWNER', 'STOP', 'HANDLE_RESET_WITH_ACTUAL_PAD_WEAR', 'OPEN_SHUTTER_IF_CLOSED_AND_USABLE', 'RETRIEVE_SAME_ORIGINALS'],
  spiritChoice: ['ASK_ORIGINAL_REED', 'ACKNOWLEDGE_CURRENT_REFUSAL'],
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});
const producerHash = fileDigest(fileURLToPath(import.meta.url));
verifySourceFiles();
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(source, k)]));
assert.equal(old.commands.length, prefixCount); assert.equal(old.final.status, 'ACTIVE');
assert.equal(old.seed, 'bard-natural-v029');
assert.equal(old.final.schemaVersion, 169); assert.equal(old.final.contentVersion, 'light-seeker-v169');
assert.equal(digest(old.commands), PREFIX_HASH);
assert.equal(digest(old.final), SOURCE_STATE_HASH);

const resumeDirectory = process.argv[2] === '--resume-from' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !resumeDirectory) throw new Error('Usage: pure-white-angel-stage.mjs [--resume-from actual-blocker-capture-directory]');
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/pure-white-angel-01940-');
const commands = [], boundaries = {}, snapshots = {}, treatments = [], publicDecisions = [];
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' });
writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = createSliceRun(old.final.runId, old.creation, old.seed);
let initial = structuredClone(s), original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, continuationSource = null, failurePhase = 'INITIALIZATION', replayingContinuation = false, frozenSourceScene = null;
const view = () => projectSliceState(s).pureWhiteAngel;
const life = () => s.pureWhiteAngel.life;
const currentAttempt = caseId => life().cases[caseId].attempts.at(-1);
const sourceOriginals = state => structuredClone(state.lightSeeker.life.site);
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality, cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk, random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting });
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function verifySourceFiles() {
  assert.equal(fileDigest(source), SOURCE_HASH, 'The entire original729-command living capture is immutable');
}
function originals() {
  assert(original);
  for (const root of ROOTS) {
    const live = structuredClone(s[root]);
    // Only this read-only comparison view substitutes frozen provenance.
    // The authoritative original gallery is never reset or repaired.
    if (root === 'lightSeeker') live.life.site = sourceOriginals(original);
    assert.deepEqual(live, original[root], `Preserve original ${root} history`);
  }
  if (s.pureWhiteAngel.guidanceKnown) {
    assert.deepEqual(s.pureWhiteAngel.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    if (frozenSourceScene === null) frozenSourceScene = structuredClone(s.pureWhiteAngel.sourceScene);
    assert.deepEqual(s.pureWhiteAngel.sourceScene, frozenSourceScene, 'The paid-guidance sourceScene is immutable');
    assert.deepEqual(s.pureWhiteAngel.sourceScene.originals, sourceOriginals(original));
    assert(validatePureWhiteAngelSource(s), 'Only audited current original-gallery changes may differ from frozen provenance');
    assert.deepEqual(sourceOriginals(s), pureWhiteAngelExpectedOriginals(s));
  } else assert.deepEqual(sourceOriginals(s), sourceOriginals(original));
  const site = sourceOriginals(s), start = sourceOriginals(original), journal = life().journal;
  for (const key of ['id', 'lengthMetres', 'ordinaryExit', 'operatorId', 'operatorName', 'operatorAge', 'spiritId', 'spiritName', 'spiritLocation', 'spiritMetres', 'spiritEnergy', 'lamp', 'cover', 'screen', 'light', 'board']) {
    assert.deepEqual(site[key], start[key], `The same original ${key} is unchanged`);
  }
  const sum = key => journal.reduce((n, row) => n + row[key], 0);
  assert.equal(site.elapsedSeconds, start.elapsedSeconds + sum('elapsedSeconds'));
  assert.equal(life().elapsedSeconds, sum('elapsedSeconds'));
  if (s.pureWhiteAngel.promotionWeek !== null) assert.equal(life().clockSeconds, site.elapsedSeconds);
  assert.equal(life().playerTravelMetres, sum('playerWalkedMetres'));
  assert.equal(life().ivan.travelMetres, sum('ivanWalkedMetres'));
  assert.equal(site.operatorMetres, start.operatorMetres + sum('maraWalkedMetres'));
  assert.equal(site.operatorEnergy, start.operatorEnergy - sum('ownerEnergySpent'));
  let expectedSite = start;
  for (const receipt of journal) {
    assert.deepEqual(receipt.originalsBefore, expectedSite, 'Every original-site mutation starts at the previous actual receipt');
    const innerWalk = receipt.originalsAfter.playerMetres - receipt.originalsBefore.playerMetres;
    assert(innerWalk >= 0 && innerWalk <= receipt.playerWalkedMetres, 'Original gallery walking is a subset of actual walking including its outside approach');
    assert.equal(receipt.originalsAfter.elapsedSeconds - receipt.originalsBefore.elapsedSeconds, receipt.elapsedSeconds);
    assert.equal(receipt.originalsBefore.operatorEnergy - receipt.originalsAfter.operatorEnergy, receipt.ownerEnergySpent);
    expectedSite = receipt.originalsAfter;
  }
  assert.deepEqual(site, expectedSite);
  const transitions = journal.flatMap(r => r.transitions);
  const shutterOperations = transitions.filter(t => ['CLOSE_SHUTTER', 'OPEN_SHUTTER', 'SHUTTER_BROKEN'].includes(t)).length;
  assert.equal(site.shutter.id, start.shutter.id); assert.equal(site.shutter.location, start.shutter.location);
  assert.equal(site.shutter.operations, start.shutter.operations + shutterOperations);
  assert.equal(site.shutter.durability, start.shutter.durability - shutterOperations, 'No old shutter repair or free toggle');
  const cleanses = transitions.filter(t => t === 'CLEANSE').length;
  assert(cleanses <= 1); assert.equal(life().sample.residueUnits, 1 - cleanses, 'The one original fictional residue unit never respawns');
  assert.equal(life().sample.id, 'PW1-RESIDUE-1'); assert.equal(life().pad.id, 'PW1-PAD-1');
  assert.equal(life().pad.durability, 100 - 10 * (life().pad.impacts + life().pad.resets));
  assert.equal(life().pad.impacts, transitions.filter(t => t === 'RELEASE_IMPACT').length);
  assert.equal(life().pad.resets, transitions.filter(t => t === 'HANDLE_RESET').length);
  assert.deepEqual(s.town, original.town, 'Every inherited town item stays in its real location');
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(pureWhiteAngelEncounterOriginalEvents(s), [], 'The independent forecourt never mutates the old gallery');
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(pureWhiteAngelLifeMasteryGains(s))) expectedMastery[id] = Math.min(500, expectedMastery[id] + gain);
  }
  let enemyPaid = 0, enemyCharges = 0;
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.pureWhiteAngelOutcome; assert(outcome, 'No unrelated new battle substituted');
    const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
    assert(outcome.playerActions.length <= round.playerCount && outcome.enemyActions.length <= round.enemyCount, 'Actual action counts cannot exceed the public wheels');
    if (actions.length < round.playerCount + round.enemyCount) assert.equal(outcome.enemyStatus, 'SURRENDERED', 'Only an actual early surrender truncates this fixed CONTROL round');
    assert.deepEqual(round.moves, actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })), 'Public action order comes from actual receipts');
    assert.deepEqual(actions.map(action => action.order), actions.map((_, index) => index));
    assert.equal(outcome.source.clubHeld, original.town.clubLocation === 'HAND');
    assert(['BODY', 'MENTAL', 'NONE'].includes(outcome.consequenceDomain), 'Every consequence identifies its actual bodily, mental, or absent domain');
    assert.equal(round.consequenceDomain ?? 'NONE', outcome.consequenceDomain);
    assert.equal(outcome.rootAfter.thirdPartiesInArea, 0);
    for (const action of actions) {
      assert.equal(action.elapsedSeconds, 5);
      assert(['BODY', 'MENTAL', 'NONE'].includes(action.attackKind));
      for (const id of action.masteryApplied) {
        assert(Object.hasOwn(expectedMastery, id), 'Mastery must name an existing learned ability');
        expectedMastery[id] = Math.min(500, expectedMastery[id] + 8);
      }
    }
    enemyPaid += outcome.enemyActions.reduce((n, a) => n + a.paidCost, 0);
    enemyCharges += outcome.enemyActions.reduce((n, a) => n + a.rodChargeSpent, 0);
    assert.equal(outcome.enemySpirituality, 120 - enemyPaid, 'The independent enemy receives no regeneration');
    assert.equal(outcome.materialsAfter.weapon.charge, 4 - enemyCharges);
    assert.equal(outcome.materialsAfter.weapon.pieces.filter(p => p.state === 'SPENT').length, enemyCharges);
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual applied receipts and honest life reports may change mastery');
  assert.equal(s.random.seed, old.seed);
  const character = structuredClone(s.character); character.coreStats = structuredClone(original.character.coreStats);
  assert.deepEqual(character, original.character, 'Original name, gender, age and identity remain unchanged');
  assert.deepEqual(s.character.coreStats, Object.fromEntries(Object.entries(original.character.coreStats).map(([key, value]) => [key, value + (s.progression.sequence === 1 ? 1 : 0)])));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek);
  assert.deepEqual(s.lightSeeker.encounter, original.lightSeeker.encounter, 'The original Owen stays dead; the original encounter is never reopened');
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
  if (intent.type === 'PURE_WHITE_ANGEL') {
    const available = p.pureWhiteAngel.actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(available, `No current public PureWhiteAngel control: ${JSON.stringify(intent.command)}`);
    assert(available.enabled, available.reason);
    return { kind: 'PURE_WHITE_ANGEL', ...structuredClone(available) };
  }
  if (intent.type === 'ACTION') {
    assert(p.canAct, p.actionBlockedReason ?? 'Public ordinary action is unavailable');
    if (intent.action === 'INVESTIGATE') {
      assert.equal(intent.targetId, 'CARE-ACCESS-01', 'Only the fixed original-injury clinic discovery is authorized');
      const target = p.investigateTargets.find(t => t.id === intent.targetId);
      assert(target, 'The ordinary clinic must be publicly discoverable now');
      assert(p.recovery.actions.discover.enabled, p.recovery.actions.discover.reason);
      return { kind: 'ACTION', action: intent.action, targetId: intent.targetId, target: structuredClone(target), recovery: structuredClone(p.recovery.actions.discover), enabled: true };
    }
    assert(['WORK', 'REST'].includes(intent.action), 'The fixed continuation uses only ordinary work/rest and actual clinic discovery');
    const available = p.recovery.actions[intent.action === 'REST' ? 'rest' : 'work'];
    assert(available.enabled, available.reason);
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
      capture(key ?? `step-${commands.length}-${intent.type === 'PURE_WHITE_ANGEL' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`);
    }
  }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}`);
}
function eg(command, key = null) { go({ type: 'PURE_WHITE_ANGEL', command }, key); }
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
  const workAllowed = projectSliceState(s).recovery.actions.work.enabled;
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week || !workAllowed ? 'REST' : 'WORK' }, key); clear();
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, injuries = Infinity, afterWeek = -1 } = {}) {
  assert(!view().insideCase && !view().encounter.inside && !s.combat, 'Recovery only outside locked scenes');
  clear();
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.injuries.length > injuries || s.week <= afterWeek; n++) {
    assert(n < 600, 'Ordinary preparation budget exhausted'); ordinary();
  }
}
function action(command, key = null) { ready(); eg(command, key); clear(); }

function recoverOriginalInjuries() {
  if (snapshots.recoveredOriginalInjuries) return;
  assert.equal(life().journal.length, 0, 'Recover the actual old injuries before any new gallery practice');
  const heavyIds = original.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).map(i => i.id);
  clear();
  if (s.injuries.some(i => heavyIds.includes(i.id) && i.treatedRevision === null) && !s.careKnown) {
    ready({ ap: 1, cash: 60 });
    go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'public-original-injury-clinic-discovery-1AP');
    assert.equal(s.careKnown, true); clear();
  }
  for (let n = 0; s.injuries.some(i => heavyIds.includes(i.id) && i.treatedRevision === null); n++) {
    assert(n < 30, 'Finite original-heavy-injury clinic budget exhausted');
    assert(projectSliceState(s).recovery.careAvailable, 'The discovered ordinary clinic must actually be available');
    ready({ ap: 1, cash: 60 }); ordinary('original-heavy-injury-rest-and-current-clinic-invitation', true);
  }
  assert(heavyIds.every(id => treatments.some(t => t.before.injuries.some(i => i.id === id && i.treatedRevision === null) && t.after.injuries.some(i => i.id === id && i.treatedRevision === t.before.revision + 1))), 'Each original untreated heavy injury needs its actual paid60p treatment receipt');
  ready(strategy.recoveryBeforePotionAndContact);
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  const latestTreatment = Math.max(...treatments.map(t => t.after.revision));
  assert(s.revision > latestTreatment, 'Paid clinic treatment must be followed by later ordinary recovery');
  snapshot('recoveredOriginalInjuries'); capture('original-injuries-actually-treated-and-later-rested');
}

function practice(caseId) {
  const row = () => life().cases[caseId], a = () => currentAttempt(caseId), site = () => s.lightSeeker.life.site;
  if (row().status === 'RESOLVED') return;
  assert(['AVAILABLE', 'OBSERVED', 'ACTIVE', 'EXAMINED'].includes(row().status), 'Never replace an interrupted paid ability attempt');
  if (row().status === 'AVAILABLE') action({ type: 'OBSERVE', caseId }, `${caseId}-source-costs-and-ordinary-alternative`);
  if (row().status === 'OBSERVED') {
    if (life().sample.purchasedWeek === null) {
      ready({ cash: 40 }); eg({ type: 'BUY_SAMPLE' }, 'actual40p1AP-unique-one-unit-fictional-residue'); clear();
    }
    if (life().pad.purchasedWeek === null) {
      ready({ cash: 20 }); eg({ type: 'BUY_PAD' }, 'actual20p1AP-unique-personal-pad'); clear();
    }
    if (life().playerLocation === 'OUTSIDE') {
      ready({ ap: 1, cash: 10, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'WALK_TO_GALLERY' }, `${caseId}-actual-four-metre-walk-to-original-entry`);
    }
    assert.equal(life().playerLocation, 'ENTRY');
    eg({ type: 'INVITE', caseId, method: strategy.caseMethod }, `${caseId}-actual10p1AP-fresh-ivan-invitation`);
  }
  if (row().status === 'ACTIVE') {
    assert.equal(life().activeCase, caseId); assert.equal(row().method, strategy.caseMethod); assert.equal(row().attempts.length, 1);
    if (!a().sourceRead) eg({ type: 'READ_SOURCE' }, `${caseId}-current-originals-and-bodily-cost-explained`);
    if (!a().entered) {
      if (!a().spiritAsked) eg({ type: 'ASK_SPIRIT' }, `${caseId}-ask-same-original-reed-and-record-current-refusal`);
      if (!a().refusalAcknowledged) eg({ type: 'ACKNOWLEDGE_REFUSAL' }, `${caseId}-respect-original-reed-without-motion-or-energy-cost`);
      for (const [permission, key] of [['OWNER', 'owner'], ['TECHNICIAN', 'technician'], ['ABILITY', 'ability']]) {
        if (a().permission[key] === 'UNASKED') eg({ type: 'CONSENT', permission }, `${caseId}-fresh-${permission.toLowerCase()}-consent`);
      }
      if (!a().returnAgreed) eg({ type: 'AGREE_RETURN' }, `${caseId}-ordinary-return-agreement`);
      if (site().operatorLocation !== 'SIDE') eg({ type: 'MOVE_OWNER_SIDE' }, `${caseId}-mara-actual-walk-to-safe-side`);
      if (life().ivan.location === 'ENTRY') eg({ type: 'MOVE_TECHNICIAN_SIDE' }, `${caseId}-ivan-actually-walks-nine-metres-to-side`);
      eg({ type: 'ENTER_GALLERY' }, `${caseId}-player-actual-six-metre-original-gallery-entry`);
    }
    if (!a().exited && a().result === 'NONE') {
      if (caseId === 'residue-trace') {
        if (!a().samplePlaced) eg({ type: 'PLACE_SAMPLE' }, `${caseId}-place-same-original-residue-at-actual-far-end`);
        if (site().shutter.state === 'CLOSED') eg({ type: 'OPEN_SHUTTER' }, `${caseId}-actual-walk-and-wear-to-open-original-shutter`);
        if (!a().observedSampleVersions.includes(life().sample.version)) eg({ type: 'OBSERVE_SAMPLE' }, `${caseId}-close-observation-of-same-actual-version`);
        if (!a().focused.attempts && life().sample.residueUnits === 1 && !life().sample.contained) eg({ type: 'FOCUSED_PURIFICATION' }, `${caseId}-one-paid-focused-window-attempt`);
        if (!a().cleanseAttempted && a().focused.state === 'ACTIVE' && life().sample.residueUnits === 1) {
          eg({ type: 'CLEANSE_SAMPLE' }, `${caseId}-separate-actual-will18-check-and-finite-unit-result`);
        }
        if (!a().sampleHandled) eg({ type: 'MANUAL_CONTAIN' }, `${caseId}-actual-ordinary-containment-after-failed-window-or-check`);
      } else {
        if (!a().padWorn) eg({ type: 'WEAR_PAD' }, `${caseId}-actually-wear-same-original-personal-pad`);
        if (!a().impactDeclared) eg({ type: 'DECLARE_IMPACT' }, `${caseId}-declare-one-personal-impact-pad10-and-unprotected-health5`);
        if (!a().guard.attempts) eg({ type: 'WARM_RADIANCE_GUARD' }, `${caseId}-one-paid-personal-guard-attempt`);
        if (caseId === 'personal-impact') {
          if (!a().impactReleased && !a().impactReset) {
            if (a().guard.state === 'ACTIVE') eg({ type: 'RELEASE_IMPACT' }, `${caseId}-actual-declared-impact-with-current-guard`);
            else eg({ type: 'HANDLE_RESET' }, `${caseId}-ordinary-safe-reset-after-failed-guard-with-actual-pad-wear`);
          }
        } else {
          if (!a().conditionChanged) eg({ type: 'CHANGE_CONDITIONS' }, `${caseId}-ivan-actual24metre-walk-and-original-shutter-close-wear`);
          if (a().permission.owner === 'GRANTED') eg({ type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, `${caseId}-current-mara-withdrawal`);
          assert.equal(life().pending, null, 'Changed conditions and withdrawal invalidate the old window');
          if (!a().stopped) eg({ type: 'STOP' }, `${caseId}-explicit-ordinary-stop-after-withdrawal`);
          if (!a().impactReset) eg({ type: 'HANDLE_RESET' }, `${caseId}-ordinary-safe-reset-with-pad10-no-impact-release`);
          assert.equal(a().impactReleased, false, 'No impact is released after the changed condition');
          assert.equal(a().guard.effects, 0, 'The invalidated guard never earns an application reward');
        }
      }
    }
    if (life().pending) eg({ type: 'STOP' }, `${caseId}-ordinary-stop-unused-window`);
    if (site().shutter.state === 'CLOSED' && site().shutter.durability > 0) eg({ type: 'OPEN_SHUTTER' }, `${caseId}-ordinary-real-six-metre-walk-and-original-shutter-wear`);
    if (life().sample.location === 'FAR') eg({ type: 'RETRIEVE_SAMPLE' }, `${caseId}-same-original-sample-returned-to-player`);
    if (life().pad.location === 'WORN') eg({ type: 'RETRIEVE_PAD' }, `${caseId}-same-original-pad-returned-to-player`);
    if (!a().exited) eg({ type: 'EXIT_GALLERY' }, `${caseId}-actual-six-metre-gallery-return`);
    eg({ type: 'LEAVE' }, `${caseId}-end-current-contact-and-ivan-actually-leaves`);
  }
  assert.equal(row().status, 'EXAMINED'); assert.notEqual(row().result, 'NONE');
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-cost-and-application-report`);
}

function encounter() {
  const e = () => s.pureWhiteAngel.encounter;
  if (e().status === 'AVAILABLE') {
    ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact });
    snapshot('recoveredBeforeEncounter');
    assert.equal(life().playerLocation, 'OUTSIDE'); assert.equal(life().maraPresent, false);
    assert.equal(life().ivan.present, false); assert.equal(life().ivan.location, 'AWAY');
    assert.equal(s.lightSeeker.life.site.playerLocation, 'ENTRY');
    assert.equal(s.lightSeeker.life.site.operatorLocation, 'SIDE'); assert.equal(s.lightSeeker.life.site.spiritLocation, 'SIDE');
    eg({ type: 'ENCOUNTER_TALK' }, 'actual4metre-independent-forecourt-arrival-and-silas-name-exchange');
  }
  if (e().status === 'READY') {
    if (!view().encounter.policyConfirmed) eg({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-fight');
    assert.equal(e().policy, strategy.encounterPolicy);
    eg({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-silas-fight'); snapshot('combatStart');
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
  assert.deepEqual(commands, old.commands, 'Replay every original command in the exact original order');
  assert.deepEqual(s, migrateSliceState(old.final), 'Compare the entire actual migrated729-command final state');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 730); assert.equal(s.week, 175);
  assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 10, day: 28 });
  assert.equal(s.random.cursor, 356); assert.equal(s.health, 50); assert.equal(s.mind, 100); assert.equal(s.spirituality, 87);
  assert.equal(s.cash, 540); assert.equal(s.actionsRemaining, 3); assert.equal(s.injuries.length, 3); assert.equal(s.injuryRisk, 3);
  assert.equal(s.injuries.filter(i => i.severity === 'LIGHT').length, 2);
  assert.equal(s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 1);
  assert.deepEqual(s.injuries, old.final.injuries, 'Original acquired and untreated injury receipts remain exact');
  assert.equal(s.character.name, '塞琳'); assert.equal(s.character.gender, 'FEMALE'); assert.equal(s.character.age, 26);
  assert.deepEqual(s.character.coreStats, { physique: 30, perception: 26, will: 29, knowledge: 24 });
  assert.equal(s.progression.pathwayId, 'sun'); assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100);
  assert.equal(s.lightSeeker.promotionWeek, 167); assert.equal(s.progression.promotionWeek, 5);
  assert.equal(Object.keys(s.progression.mastery).length, 20); assert.equal(Object.values(s.progression.mastery).filter(v => v === 0).length, 5);
  assert.equal(s.lightSeeker.encounter.status, 'RESOLVED'); assert.equal(s.lightSeeker.encounter.enemyStatus, 'DEAD'); assert.equal(s.lightSeeker.encounter.enemyHealth, 0);
  assert.deepEqual(sourceOriginals(s), {
    id: 'LS2-GALLERY', lengthMetres: 6, ordinaryExit: 'OPEN', elapsedSeconds: 976,
    playerLocation: 'ENTRY', playerMetres: 94,
    operatorId: 'LS2-MARA', operatorName: '玛拉', operatorAge: 46, operatorLocation: 'SIDE', operatorMetres: 33,
    operatorEnergy: 90, operatorConsent: 'GRANTED', operatorConsentWeek: 174,
    spiritId: 'LS2-REED', spiritName: '芦影', spiritLocation: 'SIDE', spiritMetres: 18,
    spiritEnergy: 96, spiritConsent: 'CLOSED', spiritConsentWeek: 171,
    shutter: { id: 'LS2-SHUTTER', location: 'SCREEN', state: 'OPEN', durability: 81, operations: 19 },
    lamp: { id: 'LS2-LAMP', oil: 3 }, cover: { id: 'LS2-COVER', position: 'OWNER_STAND', durability: 100 },
    screen: { id: 'LS2-SCREEN', location: 'SCREEN', durability: 99, inspections: 1 },
    light: { mode: 'OFF', expiresAt: null },
    board: { id: 'LS2-MARK', inscription: 'NORTH_ARCH', location: 'FAR_STAND', owner: 'LS2-MARA', read: true },
  });
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', { creation: old.creation, seed: old.seed, commands: commands.slice(), commandCount: prefixCount, canonicalSha256: PREFIX_HASH, rawSourceSha256: SOURCE_HASH, rawSourceRoot: 'final', rawWholeStateSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, migratedWholeStateSha256: digest(original) });
  snapshot('departure'); capture('exact-original729-command-living-source');
}
function copyPrior(name, directory) {
  assert.equal(name, basename(name), 'Capture references must be local unique filenames');
  copyFileSync(`${directory}/${name}`, `${outputDir}/${name}`, constants.COPYFILE_EXCL);
}
function resumeTail(directory) {
  const file = `${directory}/natural.json`, entry = key => readObjectEntry(file, key);
  assert.equal(entry('stage'), 'ACTUAL_BLOCKER', 'Never resume a real death, completed outcome, or finite strategy cap');
  const provenance = entry('provenance');
  assert.equal(provenance.sourceSha256, SOURCE_HASH); assert.equal(provenance.rawSourceStateSha256, SOURCE_STATE_HASH); assert.equal(provenance.sourceRoot, 'final');
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
  const e = s.pureWhiteAngel.encounter, actualRounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
  const outcomes = actualRounds.map(r => r.pureWhiteAngelOutcome).filter(Boolean);
  const sum = (rows, selector) => rows.reduce((n, row) => n + selector(row), 0);
  const lifeJournal = life().journal, acquisition = s.pureWhiteAngel.acquisitionJournal;
  const sortedActions = outcome => [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const initialSite = original ? sourceOriginals(original) : null, finalSite = sourceOriginals(s);
  write('natural.json', {
    provenance: { kind: 'SAME_SEED_COMPLETE729_COMMAND_ACTUAL_LIVING_SOURCE', source, sourceSha256: SOURCE_HASH, sourceRoot: 'final', rawSourceStateSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, entireOriginalPrefixPreserved: true, originalDeadOwenPreserved: true, newRandomChanges: false },
    producerSha256: producerHash, strategy, creation: old.creation, seed: old.seed, prefixCount, prefixVerified, continuationSource,
    commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments,
    stage, error: error ? String(error.stack ?? error) : null, final: s,
  });
  write('boundaries.index.json', boundaries);
  write('summary.json', {
    stage, strategy, source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, prefixCanonicalSha256: PREFIX_HASH, rawWholeSourceSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, migratedWholeSourceSha256: original ? digest(original) : null, entireOriginalPrefixPreserved: true, originalDeadOwenPreserved: true },
    commands: commands.length, continuationSource, final: body(s), acting: s.progression.acting,
    originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery,
    lifeCases: Object.fromEntries(CASES.map(id => [id, structuredClone(life().cases[id])])),
    lifeAbilityUse: Object.fromEntries([['focused', NEW_IDS[0]], ['guard', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { actualCasts: sum(uses, x => x.attempts), successfulWindows: sum(uses, x => x.successes), actualApplications: sum(uses, x => x.effects), states: uses.map(x => x.state) }];
    })),
    actualCosts: {
      acquisitionCash: sum(acquisition, x => x.before.cash - x.after.cash), acquisitionAP: sum(acquisition, x => x.before.actions - x.after.actions),
      lifeCash: sum(lifeJournal, x => x.before.cash - x.after.cash), lifeAP: sum(lifeJournal, x => x.before.actions - x.after.actions),
      lifeSpirituality: sum(lifeJournal, x => x.before.spirituality - x.after.spirituality), lifeMind: sum(lifeJournal, x => x.before.mind - x.after.mind), lifeHealthLost: sum(lifeJournal, x => x.before.health - x.after.health),
      sourceMaraEnergy: sum(lifeJournal, x => x.ownerEnergySpent), sourceMaraWalkedMetres: sum(lifeJournal, x => x.maraWalkedMetres),
      actualPlayerWalkedMetres: sum(lifeJournal, x => x.playerWalkedMetres), sourceGalleryWalkedMetres: sum(lifeJournal, x => x.originalsAfter.playerMetres - x.originalsBefore.playerMetres), ivanWalkedMetres: sum(lifeJournal, x => x.ivanWalkedMetres), sourceClockSeconds: sum(lifeJournal, x => x.elapsedSeconds),
      originalResidueUnitsConsumed: 1 - life().sample.residueUnits, originalShutterDurabilitySpent: initialSite ? initialSite.shutter.durability - finalSite.shutter.durability : 0, personalPadDurabilitySpent: 100 - life().pad.durability,
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyRodChargesSpent: sum(outcomes.flatMap(o => o.enemyActions), a => a.rodChargeSpent),
      clinic: sum(treatments, t => t.paidPennies), ordinaryWorkCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
      note: 'The actual729-command source starts at H50 with two light and one untreated heavy injury. Public clinic discovery, actual60p treatment and later ordinary rest are recorded before guidance. Current injury recovery, weekly finance, failed checks and every real scene cost remain in the command ledger.',
    },
    sourceOriginals: { before: initialSite, after: finalSite,
      frozenLampCoverScreenLightBoard: initialSite ? Object.fromEntries(['lamp', 'cover', 'screen', 'light', 'board'].map(key => [key, isDeepStrictEqual(initialSite[key], finalSite[key])])) : null,
      oldDeadOwenEncounterUnchanged: isDeepStrictEqual(s.lightSeeker.encounter, old.final.lightSeeker.encounter), enemyOriginalEvents: pureWhiteAngelEncounterOriginalEvents(s),
      sourceHistorySha256: s.pureWhiteAngel.sourceHistory ? digest(s.pureWhiteAngel.sourceHistory) : null, sourceSceneSha256: s.pureWhiteAngel.sourceScene ? digest(s.pureWhiteAngel.sourceScene) : null },
    inheritedInventory: { originalTown: original?.town ?? null, currentTown: s.town },
    life: { clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, playerLocation: life().playerLocation, playerTravelMetres: life().playerTravelMetres,
      maraPresent: life().maraPresent, ivan: life().ivan, sample: life().sample, pad: life().pad, pending: life().pending },
    encounter: { status: e.status, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      inheritedApplications: e.inheritedApplications, screenReveals: e.screenReveals,
      focusedPurification: { actualCasts: e.focusedPurificationAttempts, successfulWindows: e.focusedPurificationChecks, actualApplications: e.focusedPurificationSuccesses },
      warmRadianceGuard: { actualCasts: e.warmRadianceGuardAttempts, successfulWindows: e.warmRadianceGuardChecks, actualApplications: e.warmRadianceGuardSuccesses } },
    rounds: actualRounds.map(r => ({ round: r.round, stance: r.stance, first: r.first,
      countWheels: { playerRoll: r.playerCountRoll, playerCount: r.playerCount, enemyRoll: r.enemyCountRoll, enemyCount: r.enemyCount },
      consequenceDomain: r.pureWhiteAngelOutcome?.consequenceDomain ?? r.consequenceDomain ?? 'NONE', consequenceRoll: r.consequenceRoll ?? null,
      result: r.pureWhiteAngelOutcome ? { playerHealth: r.pureWhiteAngelOutcome.playerHealthAfter, playerMind: r.pureWhiteAngelOutcome.playerMindAfter, playerSpirituality: r.pureWhiteAngelOutcome.playerSpiritualityAfter,
        enemyHealth: r.pureWhiteAngelOutcome.enemyHealth, enemyMind: r.pureWhiteAngelOutcome.enemyMind, enemySpirituality: r.pureWhiteAngelOutcome.enemySpirituality,
        actualPlayerActions: r.pureWhiteAngelOutcome.playerActions.length, actualEnemyActions: r.pureWhiteAngelOutcome.enemyActions.length,
        actualOrderedActions: sortedActions(r.pureWhiteAngelOutcome), expiredWindows: r.pureWhiteAngelOutcome.expiredWindows, pendingAfter: r.pureWhiteAngelOutcome.pendingEnemyActionAfter,
        windowsAfter: r.pureWhiteAngelOutcome.windowsAfter, materialsAfter: r.pureWhiteAngelOutcome.materialsAfter } : null })),
    bottles: structuredClone(s.pureWhiteAngel.bottles), treatments, boundaries: Object.keys(boundaries), snapshots,
    bodilyMental: 'Health and injuries are bodily effects. Casting mind costs and MENTAL pressure remain independent. WarmRadianceGuard applies only to one later actual visible BODY effect and provides no mental immunity.',
  });
  write('capture-integrity.json', { producerSha256: producerHash, naturalSha256: fileDigest(`${outputDir}/natural.json`), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`), publicSha256: fileDigest(`${outputDir}/public.jsonl`), files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])) });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
}

try {
  for (const intent of old.commands.slice(0, prefixCount)) go(intent);
  verifyPrefix();
  if (resumeDirectory) resumeTail(resumeDirectory);
  recoverOriginalInjuries();
  if (s.progression.sequence === 2) {
    if (!s.pureWhiteAngel.guidanceKnown) {
      ready({ ap: 1, cash: 500, ...strategy.recoveryBeforePotionAndContact });
      eg({ type: 'LEARN_GUIDANCE' }, 'actual500p-guidance-and-frozen-eight-root-source');
    }
    for (const taskId of ['VERIFY_ORIGINALS', 'VERIFY_TARGET', 'PLAN_RETURN']) {
      if (!s.pureWhiteAngel.preparations.some(row => row.taskId === taskId)) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
    }
  }
  for (let number = s.pureWhiteAngel.bottles.filter(b => b.status === 'CONSUMED').length; s.progression.sequence === 2 && number < strategy.potionAttemptCap; number++) {
    let bottle = s.pureWhiteAngel.bottles.find(b => b.status === 'PLAYER') ?? s.pureWhiteAngel.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      if (s.pureWhiteAngel.resupply.requestedWeek === null) { ready({ cash: 100 }); action({ type: 'REQUEST_SUPPLY' }, `request-real-supply-after-${number}-failures`); }
      ready({ afterWeek: s.pureWhiteAngel.resupply.requestedWeek });
      eg({ type: 'RECEIVE_SUPPLY' }, `actual-later-week-new-supply-${number}`);
      bottle = s.pureWhiteAngel.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.pureWhiteAngel.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-labour`);
      ready({ cash: 1250 }); eg({ type: 'BUY_POTION', bottleId }, `actual1100p-buy-${bottleId}`);
    }
    if (s.pureWhiteAngel.preparedWeek === null) {
      ready({ ap: 1, cash: 150, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.lightSeeker.promotionWeek + 11 });
      eg({ type: 'PREPARE_PROMOTION' }, `actual150p-current-week-preparation-${bottleId}`);
    }
    assert.equal(s.pureWhiteAngel.preparedWeek, s.week); assert(s.week - s.lightSeeker.promotionWeek >= 12);
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
      for (let n = 0; ; n++) {
        const current = projectSliceState(s);
        if (current.canAct && current.recovery.actions.work.enabled && s.wagePaidWeek !== s.week) break;
        assert(n < strategy.livingExitPreparation.actionCap, 'Finite living-exit ordinary recovery budget exhausted');
        ordinary('living-exit-actual-rest-until-public-paid-work-is-enabled', true);
      }
      go({ type: 'ACTION', action: 'WORK' }, 'actual-paid-work-after-living-exit'); clear();
    }
    save('NATURAL_PURE_WHITE_ANGEL_PUBLIC_CONTINUATION');
  }
} catch (error) {
  if (error instanceof ActualTerminalStop || prefixVerified && s.status !== 'ACTIVE') {
    if (s.pureWhiteAngel.encounter.terminal) snapshot('combatTerminal');
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
