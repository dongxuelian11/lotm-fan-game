import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateSlicePayload } from '../../dist/domain/slice/validation.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
import { validateStarKeySource } from '../../dist/domain/star-key/index.js';
import { starKeyExpectedOriginals, starKeyLifeMasteryGains } from '../../dist/domain/star-key/life.js';

// Static public continuation. The serial lead executes from the repository root
// only after mechanisms and this strategy are frozen. No seed/cursor/state edits,
// searches for favourable rolls, outcome reloads, forced promotion, free refills,
// adaptive combat stance, fixture overwrite, or automatic publication occurs.
// IMPORTANT: this existing initial includes the historical directed S4 origin.
// Never substitute createSliceRun or describe this as a natural ordinary-person run.
const source = 'tests/fixtures/planeswalker-v01740/natural.json';
const peacefulSource = 'tests/fixtures/planeswalker-v01740/original-enemy-approach.json';
const wandererDeathSource = 'tests/fixtures/wanderer-v01500/continued.json';
const SOURCE_HASH = '06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78';
const PEACEFUL_HASH = 'ef0fe46be50b3b8ad09b8ef8551b7fa7fe76542626ccf769a50e31f9babe73f9';
const WANDERER_DEATH_HASH = 'aa074a2c14ca18d3199a667bbec61b47bab05b6796de83649949299c9f03ffa9';
const PREFIX_COMPACT_HASH = 'cef4fc68b02edf0328bb5b5345684f997fa4919427c5e1a4f962d454fad81a8e';
const PEACEFUL_COMPACT_HASH = '8ae8728f0320f9ee21573321b165f5d883efc02b431f46ba612189eb6c10dfe8';
const PEACEFUL_SORTED_HASH = '597c582724d70fe524a3edbc6276942fd556abbdd9b7686f1d781ad4e0a5b864';
const prefixCount = 701;
const ROOTS = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer', 'planeswalker'];
const CASES = ['endpoint-verification', 'anchor-transfer', 'withdrawn-return'];
const NEW_IDS = ['door.s1.endpoint-location', 'door.s1.anchor-maintenance'];
const strategy = Object.freeze({
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12,
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', potionLabourSteps: 5,
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  endpointRoute: ['ENDPOINT_LOCATION', 'WALK_VERIFY', 'MANUAL_VERIFY_ONLY_IF_UNVERIFIED'],
  anchorRoute: ['ANCHOR_MAINTENANCE', 'WALK_CARRY'],
  withdrawalRoute: ['ANCHOR_MAINTENANCE', 'WITHDRAW_OPERATOR', 'WALK_ENTRY', 'RETURN_PARCEL', 'CLOSE_DOOR', 'EXIT_ROOM', 'LEAVE'],
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});
const resumeDirectory = process.argv[2] === '--resume-from' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !resumeDirectory) throw new Error('Usage: star-key-stage.mjs [--resume-from original-first-combat-validator-blocker-directory]');
// This repair continuation accepts ONLY the immutable actual first-combat capture.
const ORIGINAL_PRODUCER_HASH = 'cabe6d7028f3a2ac7319cee7a054fbdaac35f2e0d2fadcfc75a1d4f8621d4263';
const FIRST_COMBAT_BLOCKER_HASH = 'b666ef2deed2d19188793f2fd036c397cde8f695a47b8d1653028e608f019d4f';
const FIRST_COMBAT_INTEGRITY_HASH = '110880a2cc5bafbb80f63b384c975089b1de6821a9b33d633081627423601562';
const producerHash = fileDigest(fileURLToPath(import.meta.url));
verifySourceFiles();
const old = Object.fromEntries(['provenance', 'continuation', 'initial', 'creation', 'seed', 'commands', 'prefixCount', 'inheritedPrefixCount', 'final'].map(k => [k, readObjectEntry(source, k)]));
const peaceful = readObjectEntry(peacefulSource, 'beforeLast');
const wandererDeath = Object.fromEntries(['commands', 'final'].map(k => [k, readObjectEntry(wandererDeathSource, k)]));
assert.equal(old.commands.length, 707); assert.equal(old.final.status, 'DEAD'); assert.equal(old.final.health, 0);
assert.equal(old.final.revision, 1015); assert.equal(old.final.random.cursor, 147);
assert.equal(old.seed, 'secrets-sorcerer-directed-24'); assert.equal(old.initial.random.seed, old.seed); assert.equal(old.initial.random.cursor, 0);
assert.equal(old.provenance.kind, 'DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER'); assert.equal(old.provenance.newRandomChanges, false);
assert.equal(old.prefixCount, 208); assert.equal(old.inheritedPrefixCount, 60);
assert.equal(wandererDeath.commands.length, 209); assert.equal(wandererDeath.final.status, 'DEAD'); assert.equal(wandererDeath.final.health, 0);
assert.equal(peaceful.status, 'ACTIVE'); assert.equal(compactDigest(old.commands.slice(0, prefixCount)), PREFIX_COMPACT_HASH);
assert.equal(compactDigest(peaceful), PEACEFUL_COMPACT_HASH); assert.equal(digest(peaceful), PEACEFUL_SORTED_HASH);
assert.deepEqual(readObjectEntry(peacefulSource, 'lastIntent'), old.commands[prefixCount]);
assert.deepEqual(old.commands[prefixCount], { type: 'PLANESWALKER', command: { type: 'ENCOUNTER_TALK' } });

mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/star-key-01960-');
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {}, treatments = [];
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' });
writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = migrateSliceState(old.initial);
const initial = structuredClone(s);
let original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, failurePhase = 'INITIALIZATION';
let continuationSource = null, resumeExpectedFinal = null;
const view = () => projectSliceState(s).starKey;
const life = () => s.starKey.life;
const currentAttempt = caseId => life().cases[caseId].attempts.at(-1);
const sourceOriginals = state => ({ site: structuredClone(state.planeswalker.life.site) });
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality, cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk, random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting });
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function verifySourceFiles() {
  assert.equal(fileDigest(source), SOURCE_HASH, 'The original707-command death capture is immutable');
  assert.equal(fileDigest(peacefulSource), PEACEFUL_HASH, 'Use the exact existing701-command living boundary');
  assert.equal(fileDigest(wandererDeathSource), WANDERER_DEATH_HASH, 'The separate209-command Wanderer death is immutable');
}
function originals() {
  assert(original);
  for (const root of ROOTS) {
    const live = structuredClone(s[root]);
    if (root === 'planeswalker') live.life.site = structuredClone(original.planeswalker.life.site);
    assert.deepEqual(live, original[root], `Preserve original ${root} history`);
  }
  if (s.starKey.guidanceKnown) {
    assert.deepEqual(s.starKey.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert(validateStarKeySource(s), 'Current original movements reconcile with the original-site journal');
    assert.deepEqual(sourceOriginals(s), starKeyExpectedOriginals(s));
  } else assert.deepEqual(sourceOriginals(s), sourceOriginals(original));
  const site = s.planeswalker.life.site, oldSite = original.planeswalker.life.site;
  for (const key of ['lamp', 'screen', 'kits', 'effect']) assert.deepEqual(site[key], oldSite[key], `No free or replaced original ${key}`);
  assert.equal(site.playerAstralLegs, oldSite.playerAstralLegs); assert.equal(site.parcel.astralLegs, oldSite.parcel.astralLegs);
  assert.deepEqual({ ...site.parcel, location: oldSite.parcel.location, ordinaryMetres: oldSite.parcel.ordinaryMetres }, oldSite.parcel);
  assert.equal(s.wanderer.life.packet.location, 'REMOTE', 'The old remote packet never becomes local stock');
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(starKeyLifeMasteryGains(s))) expectedMastery[id] += gain;
  }
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.starKeyOutcome; assert(outcome, 'No unrelated new battle substituted');
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(expectedMastery, id), 'Mastery must name an existing learned ability');
      expectedMastery[id] = Math.min(500, expectedMastery[id] + 8);
    }
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual applied receipts may change mastery');
  assert.equal(s.random.seed, old.seed);
  const { coreStats: stats, ...identity } = s.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  assert.deepEqual(identity, originalIdentity, 'The same original person retains their identity');
  for (const [id, value] of Object.entries(originalStats)) assert.equal(stats[id], Math.min(500, value + (s.progression.sequence === 1 ? 1 : 0)));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek);
  assert.deepEqual(s.planeswalker.encounter, original.planeswalker.encounter, 'The original Soren is never contacted');
}
function capture(key) {
  if (!prefixVerified) return;
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  const file = `boundary-${unique}.json`;
  write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); boundaries[unique] = file; boundarySteps[unique] = commands.length;
}
function snapshot(name) {
  if (snapshots[name]) return;
  const file = `snapshot-${name}.json`; write(file, s); snapshots[name] = file;
}
function publicControl(intent) {
  if (!prefixVerified) return { kind: 'IMMUTABLE_SOURCE_PREFIX', enabled: true };
  const p = projectSliceState(s);
  if (intent.type === 'STAR_KEY') {
    const available = p.starKey.actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(available, `No current public StarKey control: ${JSON.stringify(intent.command)}`);
    assert(available.enabled, available.reason);
    return { kind: 'STAR_KEY', ...structuredClone(available) };
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
  if (resumeExpectedFinal) assert.deepEqual(s, resumeExpectedFinal, 'Validator repair must preserve the entire actual rejected round result, including all losses and RNG');
  assertValidSliceState(s);
  assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= previous.random.cursor);
  assert.equal(s.revision, previous.revision + 1);
  if (prefixVerified) {
    originals();
    const evidence = { step: commands.length, revision: previous.revision, command: intent, control, randomBefore: previous.random, randomAfter: s.random };
    append('public.jsonl', evidence);
    capture(key ?? `step-${commands.length}-${intent.type === 'STAR_KEY' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`);
  }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}`);
}
function sk(command, key = null) { go({ type: 'STAR_KEY', command }, key); }
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
function ordinary(key = null) {
  clear(); assert.equal(s.status, 'ACTIVE'); assert(!view().insideCase && !view().encounter.inside && !s.combat);
  go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, key); clear();
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  assert(!view().insideCase && !view().encounter.inside && !s.combat, 'Recovery only outside locked scenes');
  clear();
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    assert(n < 600, 'Ordinary preparation budget exhausted'); ordinary();
  }
}
function action(command, key = null) { ready(); sk(command, key); clear(); }

function practice(caseId) {
  const row = () => life().cases[caseId], a = () => currentAttempt(caseId), site = () => s.planeswalker.life.site;
  assert.equal(row().status, 'AVAILABLE', 'One existing public attempt per case; no replaced failures');
  action({ type: 'OBSERVE', caseId }, `${caseId}-source-costs-and-ordinary-alternative`);
  ready({ ap: 1, cash: 10, ...strategy.recoveryBeforePotionAndContact });
  if (site().playerLocation === 'OUTSIDE') {
    const before = site().playerMetres;
    sk({ type: 'WALK_TO_ROOM' }, `${caseId}-actual2metre-walk-back-to-original-entrance`);
    assert.equal(site().playerMetres, before + 2);
  }
  assert.equal(site().playerLocation, 'ENTRY');
  sk({ type: 'INVITE', caseId, method: strategy.caseMethod }, `${caseId}-actual10p1AP-fresh-mara-invitation`);
  assert.equal(row().attempts.length, 1); assert.equal(a().penniesSpent, 10);
  sk({ type: 'READ_SOURCE' }, `${caseId}-current-originals-explained`);
  for (const permission of ['OWNER', 'OPERATOR', 'ABILITY']) sk({ type: 'CONSENT', permission }, `${caseId}-fresh-${permission.toLowerCase()}-consent`);
  assert.equal(site().operatorConsent, 'GRANTED'); assert.equal(site().operatorConsentWeek, s.week);
  sk({ type: 'AGREE_RETURN' }, `${caseId}-ordinary-return-agreed`);
  sk({ type: 'OPEN_DOOR' }, `${caseId}-manually-open-original-shutter`);
  sk({ type: 'INSPECT_PADS' }, `${caseId}-physically-inspect-near-far-and-return-to-entry`);
  sk({ type: 'READ_RETURN_MARKER' }, `${caseId}-read-original-local-return-marker`);
  sk({ type: 'TAKE_PARCEL' }, `${caseId}-take-same-player-owned-original`);
  sk({ type: 'WALK_NEAR' }, `${caseId}-player-and-mara-really-walk-to-near-pad`);
  assert.equal(site().playerLocation, 'NEAR'); assert.equal(site().operatorLocation, 'NEAR'); assert.equal(site().parcel.location, 'PLAYER');
  sk({ type: 'OBSERVE_ENDPOINT' }, `${caseId}-observe-current4metre-endpoint-and-sightline`);
  const paidBefore = { S: s.spirituality, M: s.mind, cursor: s.random.cursor, playerLocation: site().playerLocation, parcelLocation: site().parcel.location };
  const power = caseId === 'endpoint-verification' ? 'ENDPOINT_LOCATION' : 'ANCHOR_MAINTENANCE';
  sk({ type: power }, `${caseId}-one-paid-${power.toLowerCase()}-attempt`);
  assert.equal(s.spirituality, paidBefore.S - (power === 'ENDPOINT_LOCATION' ? 8 : 7)); assert.equal(s.mind, paidBefore.M - 2);
  assert.equal(s.random.cursor, paidBefore.cursor + 1);
  assert.equal(site().playerLocation, paidBefore.playerLocation); assert.equal(site().parcel.location, paidBefore.parcelLocation);
  if (caseId === 'endpoint-verification') {
    const before = { player: site().playerMetres, parcel: site().parcel.ordinaryMetres, cursor: s.random.cursor };
    sk({ type: 'WALK_VERIFY' }, `${caseId}-independent-check-and-actual4metre-walk`);
    assert.equal(site().playerLocation, 'FAR'); assert.equal(site().playerMetres, before.player + 4);
    assert.equal(site().parcel.ordinaryMetres, before.parcel + 4); assert.equal(s.random.cursor, before.cursor + 1);
    if (!a().walkVerified) sk({ type: 'MANUAL_VERIFY' }, `${caseId}-actual-ordinary-verification-after-failure`);
  } else if (caseId === 'anchor-transfer') {
    const before = { player: site().playerMetres, parcel: site().parcel.ordinaryMetres, cursor: s.random.cursor };
    sk({ type: 'WALK_CARRY' }, `${caseId}-independent-check-and-actual4metre-carry`);
    assert.equal(site().playerLocation, 'FAR'); assert.equal(site().playerMetres, before.player + 4);
    assert.equal(site().parcel.ordinaryMetres, before.parcel + 4); assert.equal(s.random.cursor, before.cursor + 1);
  } else {
    const before = { player: site().playerLocation, parcel: site().parcel.location, S: s.spirituality, M: s.mind };
    sk({ type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }, `${caseId}-mara-withdraws-current-participation`);
    assert.equal(life().pending, null); assert.equal(a().anchor.effects, 0);
    assert.equal(site().playerLocation, before.player); assert.equal(site().parcel.location, before.parcel);
    assert.equal(s.spirituality, before.S); assert.equal(s.mind, before.M);
  }
  assert.equal(life().pending, null, 'Application or withdrawal closes the existing finite window');
  sk({ type: 'WALK_ENTRY' }, `${caseId}-real-player-and-mara-walk-back-with-original`);
  assert.equal(site().playerLocation, 'ENTRY'); assert.equal(site().operatorLocation, 'ENTRY');
  sk({ type: 'RETURN_PARCEL' }, `${caseId}-same-original-parcel-returned-to-entry-stand`);
  sk({ type: 'CLOSE_DOOR' }, `${caseId}-manually-close-same-shutter`);
  sk({ type: 'EXIT_ROOM' }, `${caseId}-both-actual2metre-exits`);
  assert.equal(site().playerLocation, 'OUTSIDE'); assert.equal(site().operatorLocation, 'OUTSIDE');
  assert.equal(site().parcel.location, 'ENTRY_STAND'); assert.equal(site().door.state, 'CLOSED');
  sk({ type: 'LEAVE' }, `${caseId}-close-current-contact-without-resetting-mara`);
  assert.equal(row().status, 'EXAMINED'); assert.notEqual(row().result, 'NONE'); assert(a().closed);
  action({ type: 'REPORT', caseId }, `${caseId}-honest-actual-result-report`);
  assert.equal(row().status, 'RESOLVED');
  if (caseId === 'withdrawn-return') { assert.equal(row().result, 'ORDINARY'); assert.equal(a().anchor.effects, 0); }
}
function encounter() {
  const e = () => s.starKey.encounter;
  const oldSite = structuredClone(s.planeswalker.life.site);
  if (e().status === 'AVAILABLE') {
    ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact });
    snapshot('recoveredBeforeEncounter');
    assert.equal(life().playerLocation, 'OUTSIDE'); assert.equal(s.planeswalker.life.site.operatorLocation, 'OUTSIDE');
    assert.equal(life().activeCase, null); assert.equal(life().pending, null);
    sk({ type: 'ENCOUNTER_TALK' }, 'actual4metre-arrival-and-independent-rowan-name-exchange');
    assert.equal(e().targetId, 'SK1-ROWAN-VALE'); assert.equal(e().scene.knownEnemyName, '罗温·维尔');
    assert.equal(e().scene.playerTravelMetres, 4); assert.equal(e().scene.clockSeconds, 4);
    assert.equal(e().enemyHealth, 100); assert.equal(e().enemyMind, 100); assert.equal(e().enemySpirituality, 120);
    assert.equal(e().materials.marks.length, 3); assert(e().materials.marks.every(mark => mark.status === 'HELD'));
    assert.deepEqual(s.planeswalker.life.site, oldSite, 'Independent forecourt arrival leaves the old room and Mara intact');
    sk({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-fight');
    sk({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-rowan-fight'); snapshot('combatStart');
  }
  assert.equal(e().status, 'FIGHTING'); assert.equal(e().policy, strategy.encounterPolicy);
  for (const round of s.combatHistory.slice(e().startHistoryIndex)) assert.equal(round.stance, strategy.combatStance);
  assert.equal(s.combat.encounterId, 'STAR_KEY_DISPUTE');
  while (s.combat && s.combat.round <= strategy.combatRoundCap) {
    const round = s.combat.round;
    go({ type: 'COMBAT_ROUND', stance: strategy.combatStance }, `combat-round-${round}`);
    assert.deepEqual(s.planeswalker.life.site, oldSite);
  }
  if (s.combat) { snapshot('combatFiniteCap'); throw new FiniteEncounterStop('Declared90-round cap reached; actual unfinished battle preserved'); }
  assert(e().terminal, 'Retain the actual terminal receipt');
  assert.equal(e().terminal.exitMetres, 4); assert.equal(e().terminal.exitSeconds, 4);
  assert.equal(e().scene.playerLocation, 'OUTSIDE'); assert.equal(e().scene.playerCoordinate, 0);
  assert.equal(view().encounter.inside, false); capture('actual-ordinary-encounter-exit'); snapshot('combatTerminal');
}
function verifyPrefix() {
  assert.deepEqual(commands, old.commands.slice(0, prefixCount));
  assert.deepEqual(s, migrateSliceState(peaceful), 'Entire migrated original beforeLast must match before any new intent');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 1009); assert.equal(s.week, 201);
  assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 28 });
  assert.deepEqual(s.random, { seed: 'secrets-sorcerer-directed-24', cursor: 94 });
  assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120); assert.equal(s.seer.pollution, 0);
  assert.equal(s.cash, 5280); assert.equal(s.actionsRemaining, 3); assert.deepEqual(s.injuries, []); assert.equal(s.injuryRisk, 0);
  assert.equal(s.progression.pathwayId, 'door'); assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100);
  assert.equal(s.planeswalker.promotionWeek, 193); assert.equal(Object.keys(s.progression.mastery).length, 15);
  assert.equal(Object.values(s.progression.mastery).filter(v => v === 0).length, 7);
  assert.deepEqual(s.character.coreStats, { physique: 27, perception: 28, will: 27, knowledge: 23 });
  const site = s.planeswalker.life.site;
  assert.equal(site.playerLocation, 'ENTRY'); assert.equal(site.elapsedSeconds, 211); assert.equal(site.playerMetres, 40); assert.equal(site.playerAstralLegs, 2);
  assert.equal(site.operatorLocation, 'ENTRY'); assert.equal(site.operatorEnergy, 94); assert.equal(site.operatorConsent, 'WITHDRAWN'); assert.equal(site.operatorConsentWeek, 198);
  assert.equal(site.parcel.location, 'ENTRY_STAND'); assert.equal(site.parcel.ordinaryMetres, 8); assert.equal(site.parcel.astralLegs, 2);
  assert.equal(site.door.state, 'CLOSED'); assert.equal(site.door.operations, 8); assert.equal(site.lamp.oilRemaining, 2); assert.equal(site.screen.state, 'BLANK');
  assert.equal(site.kits['symbolic-transit'].protectionSeconds, 70); assert.equal(site.kits['withdrawn-transit'].protectionSeconds, 90);
  assert.equal(s.planeswalker.encounter.status, 'AVAILABLE'); assert.equal(s.wanderer.life.packet.location, 'REMOTE');
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', {
    provenance: old.provenance, priorContinuation: old.continuation, creation: old.creation, seed: old.seed,
    initialSource: 'natural.initial', initial: old.initial, commands: commands.slice(), commandCount: prefixCount,
    compactCommandsSha256: PREFIX_COMPACT_HASH, sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH,
    rawSourceRoot: 'beforeLast', rawBeforeLastCompactSha256: PEACEFUL_COMPACT_HASH, rawBeforeLastSortedSha256: PEACEFUL_SORTED_HASH,
    migratedWholeStateSha256: digest(original), original707DeathPreserved: true, separate209DeathPreserved: true,
  });
  snapshot('departure'); capture('exact-original701-command-living-source');
}
function consumePotion(bottleId) {
  const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind,
    pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
  sk({ type: 'CONSUME', bottleId, confirmed: true }, `actual-consumption-${bottleId}`);
  const used = s.starKey.bottles.find(b => b.id === bottleId);
  assert.equal(used.status, 'CONSUMED'); assert.equal(s.starKey.preparedWeek, null);
  assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.spirituality);
  assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
  const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome];
  assert(costs); assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1]));
  assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
  for (const [id, value] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], value);
  for (const [id, value] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], Math.min(500, value + (s.progression.sequence === 1 ? 1 : 0)));
  capture(s.progression.sequence === 1 ? 'promotion' : 'actual-potion-failure');
}

function resumeFirstCombat(directory) {
  failurePhase = 'RESUME_PREFLIGHT';
  const input = name => `${directory}/${name}`;
  assert.equal(fileDigest(input('natural.json')), FIRST_COMBAT_BLOCKER_HASH, 'Only the exact recorded813-command blocker is eligible');
  assert.equal(fileDigest(input('capture-integrity.json')), FIRST_COMBAT_INTEGRITY_HASH);
  const saved = JSON.parse(readFileSync(input('natural.json'), 'utf8'));
  const integrity = JSON.parse(readFileSync(input('capture-integrity.json'), 'utf8'));
  assert.equal(saved.stage, 'ACTUAL_BLOCKER'); assert.equal(saved.failurePhase, 'AFTER_APPLY_VALIDATION');
  assert.equal(saved.producerSha256, ORIGINAL_PRODUCER_HASH); assert.equal(integrity.producerSha256, ORIGINAL_PRODUCER_HASH);
  assert.equal(integrity.naturalSha256, FIRST_COMBAT_BLOCKER_HASH); assert.equal(saved.prefixVerified, true); assert.equal(saved.prefixCount, prefixCount);
  assert.equal(saved.commands.length, 813); assert.equal(saved.pendingIntent, null); assert.deepEqual(saved.strategy, strategy);
  assert.equal(saved.seed, old.seed); assert.deepEqual(saved.creation, old.creation); assert.deepEqual(saved.initial, initial);
  assert.deepEqual(saved.commands.slice(0, prefixCount), old.commands.slice(0, prefixCount));
  assert.deepEqual(saved.prefixFinal, migrateSliceState(peaceful), 'Retain the entire verified original701-command source');
  assert.equal(saved.provenance.sourceSha256, SOURCE_HASH); assert.equal(saved.provenance.peacefulSha256, PEACEFUL_HASH);
  assert.equal(saved.provenance.wandererDeathSha256, WANDERER_DEATH_HASH); assert.equal(saved.provenance.newRandomChanges, false);
  assert.deepEqual(saved.lastIntent, { type: 'COMBAT_ROUND', stance: 'CONTROL' }); assert.deepEqual(saved.commands.at(-1), saved.lastIntent);
  assert.deepEqual(saved.commands.at(-2), { type: 'STAR_KEY', command: { type: 'ENCOUNTER_FIGHT' } });
  const before = saved.beforeLast, rejected = saved.final;
  for (const state of [before, rejected]) {
    assert.equal(state.status, 'ACTIVE'); assert.equal(state.progression.sequence, 1); assert.equal(state.progression.acting, 100);
    assert.equal(state.starKey.encounter.status, 'FIGHTING'); assert.equal(state.starKey.encounter.policy, 'ALL');
    assert.equal(state.combat.encounterId, 'STAR_KEY_DISPUTE'); assert.equal(state.starKey.encounter.terminal, null);
  }
  assert.equal(before.revision, 1120); assert.equal(before.combat.round, 1); assert.equal(before.combat.lastRound, null);
  assert.deepEqual(before.random, { seed: old.seed, cursor: 101 }); assert.equal(before.health, 100);
  assert.equal(rejected.revision, 1121); assert.equal(rejected.combat.round, 2); assert.equal(rejected.health, 90);
  assert.deepEqual(rejected.random, { seed: old.seed, cursor: 114 });
  assert.equal(before.combatHistory.length, before.starKey.encounter.startHistoryIndex);
  assert.equal(rejected.combatHistory.length, before.combatHistory.length + 1);
  const checks = { 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256', 'source-prefix.json': 'sourcePrefixSha256',
    'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'summary.json': 'summarySha256' };
  for (const [name, key] of Object.entries(checks)) assert.equal(fileDigest(input(name)), integrity[key], `Preserve original ${name} bytes`);
  const priorIndex = JSON.parse(readFileSync(input('boundaries.index.json'), 'utf8'));
  const priorSteps = JSON.parse(readFileSync(input('boundaries.steps.json'), 'utf8'));
  assert.deepEqual(Object.keys(priorIndex).sort(), Object.keys(priorSteps).sort());
  assert(Object.values(priorSteps).every(step => Number.isSafeInteger(step) && step >= prefixCount && step <= 812));
  assert.equal(priorSteps['independent-optional-rowan-fight'], 812); assert.equal(priorIndex['combat-round-1'], undefined);
  const referenced = [...new Set([...Object.values(priorIndex), ...Object.values(saved.snapshots)])];
  assert.deepEqual(referenced.slice().sort(), Object.keys(integrity.files).sort());
  for (const name of referenced) {
    assert.equal(name, basename(name)); assert(/^(boundary-|snapshot-)[A-Za-z0-9_.-]+\.json$/.test(name));
    assert.equal(fileDigest(input(name)), integrity.files[name]);
  }
  const commandBytes = readFileSync(input('commands.jsonl'), 'utf8'), publicBytes = readFileSync(input('public.jsonl'), 'utf8');
  const lines = commandBytes.split('\n'), publicLines = publicBytes.split('\n');
  assert.equal(lines.pop(), ''); assert.equal(publicLines.pop(), ''); assert.equal(lines.length, 813); assert.equal(publicLines.length, 111);
  for (const [index, line] of lines.entries()) {
    const entry = JSON.parse(line); assert.equal(entry.step, index + 1); assert.deepEqual(entry.intent, saved.commands[index]);
  }
  for (const [index, line] of publicLines.entries()) {
    const entry = JSON.parse(line); assert.equal(entry.step, prefixCount + index + 1); assert.deepEqual(entry.command, saved.commands[entry.step - 1]);
  }
  const rejectedCommand = JSON.parse(lines.at(-1)); assert.deepEqual(rejectedCommand.before, body(before)); assert.deepEqual(rejectedCommand.after, body(rejected));
  assert.deepEqual(JSON.parse(readFileSync(input(saved.snapshots.combatStart), 'utf8')), before);
  const lastBoundary = JSON.parse(readFileSync(input(priorIndex['independent-optional-rowan-fight']), 'utf8'));
  assert.equal(lastBoundary.commandCount, 812); assert.deepEqual(lastBoundary.final, before);
  assertValidSliceState(before);
  // Copy named evidence verbatim into the new unique directory. Original
  // metadata is archived under distinct names; current metadata is built afresh.
  const preservedFiles = {};
  for (const name of ['natural.json', 'summary.json', 'capture-integrity.json', 'boundaries.index.json', 'boundaries.steps.json', 'commands.jsonl', 'public.jsonl']) {
    const target = `prior-blocker-${name}`;
    copyFileSync(input(name), `${outputDir}/${target}`, constants.COPYFILE_EXCL); preservedFiles[target] = fileDigest(input(name));
  }
  for (const name of [...referenced, 'source-prefix.json']) copyFileSync(input(name), `${outputDir}/${name}`, constants.COPYFILE_EXCL);
  Object.assign(boundaries, priorIndex); Object.assign(boundarySteps, priorSteps); Object.assign(snapshots, saved.snapshots); treatments.push(...saved.treatments);
  appendFileSync(`${outputDir}/commands.jsonl`, `${lines.slice(0, 812).join('\n')}\n`);
  appendFileSync(`${outputDir}/public.jsonl`, publicBytes);
  commands.push(...saved.commands.slice(0, 812)); original = structuredClone(saved.prefixFinal); prefixVerified = true;
  s = structuredClone(before); originals();
  continuationSource = {
    kind: 'EXACT_FIRST_COMBAT_VALIDATOR_REPAIR_ONLY', sourceDirectory: basename(directory), originalFailureSha256: FIRST_COMBAT_BLOCKER_HASH,
    originalProducerSha256: ORIGINAL_PRODUCER_HASH, finalProducerSha256: producerHash, originalIntegritySha256: FIRST_COMBAT_INTEGRITY_HASH,
    originalCommandCount: 813, restoredCommandCount: 812, retriedCommand: saved.lastIntent, preservedFiles,
    beforeLastSha256: digest(before), originalRejectedFinalSha256: digest(rejected), replayedFinalSha256: null,
    fullStateUnchanged: false, commandLedgerExactThrough813: false, newRandomChanges: false,
  };
  // Exactly one previously applied command is re-applied after a validator-only
  // repair. Before any next command, the complete result AND813-line ledger
  // must match the rejected original bytes. No campaign/potion/life rerun occurs.
  resumeExpectedFinal = rejected;
  go(saved.lastIntent, 'combat-round-1');
  assert.deepEqual(s, rejected); assert.equal(fileDigest(`${outputDir}/commands.jsonl`), integrity.commandsSha256);
  continuationSource.replayedFinalSha256 = digest(s); continuationSource.fullStateUnchanged = true; continuationSource.commandLedgerExactThrough813 = true;
  resumeExpectedFinal = null;
  write('resume-verification.json', continuationSource);
}

function save(stage, error = null) {
  verifySourceFiles();
  const e = s.starKey.encounter, actualRounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
  const outcomes = actualRounds.map(r => r.starKeyOutcome).filter(Boolean);
  const sum = (rows, selector) => rows.reduce((n, row) => n + selector(row), 0);
  const lifeJournal = life().journal, acquisition = s.starKey.acquisitionJournal;
  write('natural.json', {
    provenance: {
      kind: 'DIRECTED_S4_ORIGIN_EXACT701_PUBLIC_PREFIX_THEN_PUBLIC_STAR_KEY', prior: old.provenance, priorContinuation: old.continuation,
      source, sourceSha256: SOURCE_HASH, peacefulSource, peacefulSha256: PEACEFUL_HASH, sourceRoot: 'beforeLast',
      prefixCompactSha256: PREFIX_COMPACT_HASH, rawBeforeLastCompactSha256: PEACEFUL_COMPACT_HASH, rawBeforeLastSortedSha256: PEACEFUL_SORTED_HASH,
      wandererDeathSource, wandererDeathSha256: WANDERER_DEATH_HASH, original707CommandDeathPreserved: true, separate209CommandDeathPreserved: true,
      inheritedDirectedPrefix: true, newRandomChanges: false,
      originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash,
      originalFailureSha256: continuationSource?.originalFailureSha256 ?? null,
    },
    continuation: { kind: 'EXACT_701_LIVING_PUBLIC_PREFIX_THEN_PUBLIC_STAR_KEY', sourceFixture: source, sourceRoot: `${peacefulSource}:beforeLast`, inheritedDirectedPrefix: true, newRandomChanges: false },
    producerSha256: producerHash, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, continuationSource, strategy, creation: old.creation, seed: old.seed, prefixCount, inheritedPrefixCount: old.prefixCount, inheritedDirectedCommandCount: old.inheritedPrefixCount,
    prefixVerified, commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments,
    stage, error: error ? String(error.stack ?? error) : null, final: s,
  });
  write('boundaries.index.json', boundaries); write('boundaries.steps.json', boundarySteps);
  write('summary.json', {
    stage, strategy, source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, peacefulSha256: PEACEFUL_HASH, wandererDeathSha256: WANDERER_DEATH_HASH, prefixCompactSha256: PREFIX_COMPACT_HASH, migratedWholeSourceSha256: original ? digest(original) : null },
    commands: commands.length, continuationSource, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, final: body(s), originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery,
    lifeCases: Object.fromEntries(CASES.map(id => [id, structuredClone(life().cases[id])])),
    lifeAbilityUse: Object.fromEntries([['endpoint', NEW_IDS[0]], ['anchor', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { attempts: sum(uses, x => x.attempts), checkSuccesses: sum(uses, x => x.successes), actualApplications: sum(uses, x => x.effects), states: uses.map(x => x.state) }];
    })),
    actualCosts: {
      acquisitionCash: sum(acquisition, x => x.before.cash - x.after.cash), acquisitionAP: sum(acquisition, x => x.before.actions - x.after.actions),
      lifeCash: sum(lifeJournal, x => x.before.cash - x.after.cash), lifeAP: sum(lifeJournal, x => x.before.actions - x.after.actions),
      lifeSpirituality: sum(lifeJournal, x => x.before.spirituality - x.after.spirituality), lifeMind: sum(lifeJournal, x => x.before.mind - x.after.mind),
      playerOrdinaryMetres: sum(lifeJournal, x => x.playerWalkedMetres), maraOrdinaryMetres: sum(lifeJournal, x => x.maraWalkedMetres), maraEnergy: sum(lifeJournal, x => x.operatorEnergySpent),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost),
      enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyOriginalMarksSpent: e.materials.marks.filter(mark => mark.status === 'SPENT').length,
      clinic: sum(treatments, t => t.paidPennies), ordinaryWorkCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'WORK').length,
      ordinaryRestCount: commands.slice(prefixCount).filter(c => c.type === 'ACTION' && c.action === 'REST').length,
      note: 'Command ledger retains real work, rest, bills and event costs. Mechanism receipt totals exclude independent weekly settlement. No free healing is claimed.',
    },
    sourceOriginals: original ? sourceOriginals(original) : null, currentOriginals: sourceOriginals(s),
    life: { clockSeconds: life().clockSeconds, elapsedSeconds: life().elapsedSeconds, playerLocation: life().playerLocation, playerTravelMetres: life().playerTravelMetres, maraTravelMetres: life().maraTravelMetres, pending: life().pending },
    encounter: {
      status: e.status, targetId: e.targetId, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
      enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses,
      endpointLocation: { attempts: e.endpointLocationAttempts, successfulWindows: e.endpointLocationChecks, actualApplications: e.endpointLocationSuccesses },
      anchorMaintenance: { attempts: e.anchorMaintenanceAttempts, successfulWindows: e.anchorMaintenanceChecks, actualApplications: e.anchorMaintenanceSuccesses },
    },
    rounds: actualRounds.map(r => ({ round: r.round, stance: r.stance, consequenceDomain: r.consequenceDomain ?? null, consequenceRoll: r.consequenceRoll ?? null,
      result: r.starKeyOutcome ? { playerHealth: r.starKeyOutcome.playerHealthAfter, playerMind: r.starKeyOutcome.playerMindAfter, playerSpirituality: r.starKeyOutcome.playerSpiritualityAfter,
        enemyHealth: r.starKeyOutcome.enemyHealth, enemyMind: r.starKeyOutcome.enemyMind, enemySpirituality: r.starKeyOutcome.enemySpirituality, expiredWindows: r.starKeyOutcome.expiredWindows } : null })),
    bottles: structuredClone(s.starKey.bottles), treatments, boundaries: Object.keys(boundaries), snapshots,
    bodilyMental: 'Health and injuries remain bodily. Casting mind costs and MENTAL consequences remain independent. Neither new ability gives immunity.',
  });
  write('capture-integrity.json', {
    producerSha256: producerHash, originalProducerSha256: continuationSource?.originalProducerSha256 ?? producerHash, finalProducerSha256: producerHash, continuationSource, naturalSha256: fileDigest(`${outputDir}/natural.json`), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`), publicSha256: fileDigest(`${outputDir}/public.jsonl`),
    sourcePrefixSha256: prefixVerified ? fileDigest(`${outputDir}/source-prefix.json`) : null,
    boundaryIndexSha256: fileDigest(`${outputDir}/boundaries.index.json`), boundaryStepsSha256: fileDigest(`${outputDir}/boundaries.steps.json`),
    summarySha256: fileDigest(`${outputDir}/summary.json`), files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])),
  });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, prefixCount, prefixVerified, status: s.status, sequence: s.progression.sequence, week: s.week }));
}

try {
  if (resumeDirectory) resumeFirstCombat(resumeDirectory);
  else {
    assertValidSliceState(s); assert.deepEqual(s.random, old.initial.random);
    for (const intent of old.commands.slice(0, prefixCount)) go(intent);
    verifyPrefix();
    ready({ ap: 1, cash: 500, ...strategy.recoveryBeforePotionAndContact });
    sk({ type: 'LEARN_GUIDANCE' }, 'actual500p-guidance-and-frozen-eight-root-source');
    assert.equal(s.starKey.acquisitionJournal.at(-1).before.cash - s.starKey.acquisitionJournal.at(-1).after.cash, 500);
    for (const taskId of ['VERIFY_ORIGINALS', 'RECORD_ENDPOINTS', 'MARK_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
    for (let number = 0; s.progression.sequence === 2 && number < strategy.potionAttemptCap; number++) {
      let bottle = s.starKey.bottles.find(b => b.status === 'PLAYER') ?? s.starKey.bottles.find(b => b.status === 'SUPPLIER');
      if (!bottle) {
        ready({ cash: 100 }); action({ type: 'REQUEST_SUPPLY' }, `request-real-supply-after-${number}-failures`);
        const requestedWeek = s.starKey.resupply.requestedWeek, length = s.starKey.bottles.length;
        assert.notEqual(requestedWeek, null); ready({ afterWeek: requestedWeek });
        sk({ type: 'RECEIVE_SUPPLY' }, `actual-later-week-new-supply-${number}`);
        assert.equal(s.starKey.bottles.length, length + 3); bottle = s.starKey.bottles.find(b => b.status === 'SUPPLIER');
      }
      assert(bottle); const bottleId = bottle.id;
      if (bottle.status === 'SUPPLIER') {
        while (s.starKey.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-labour`);
        ready({ cash: 1250 }); sk({ type: 'BUY_POTION', bottleId }, `actual1100p-buy-${bottleId}`);
        const purchase = s.starKey.acquisitionJournal.at(-1); assert.equal(purchase.before.cash - purchase.after.cash, 1100);
      }
      ready({ ap: 1, cash: 150, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.planeswalker.promotionWeek + 11 });
      sk({ type: 'PREPARE_PROMOTION' }, `actual150p-current-week-preparation-${bottleId}`);
      const preparation = s.starKey.acquisitionJournal.at(-1); assert.equal(preparation.before.cash - preparation.after.cash, 150);
      assert.equal(s.starKey.preparedWeek, s.week); assert(s.week - s.planeswalker.promotionWeek >= 12);
      consumePotion(bottleId);
    }
    if (s.progression.sequence === 1) {
      assert.equal(s.starKey.planeswalkerActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
      for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
      for (const caseId of CASES) practice(caseId);
      action({ type: 'REFLECT' }, 'three-honest-actual-reports-reflected');
      assert.equal(s.progression.acting, 100); snapshot('practiced');
    }
  }
  if (s.progression.sequence !== 1) save('DIRECTED_S4_ORIGIN_NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
  else {
    encounter();
    clear();
    if (s.wagePaidWeek === s.week) ready({ afterWeek: s.week });
    ready({ ap: 1 });
    go({ type: 'ACTION', action: 'WORK' }, 'actual-paid-work-after-living-exit'); clear();
    originals(); save('DIRECTED_S4_ORIGIN_NATURAL_STAR_KEY_PUBLIC_CONTINUATION');
  }
} catch (error) {
  if (error instanceof ActualTerminalStop) {
    if (s.starKey.encounter.terminal) snapshot('combatTerminal');
    snapshot('actualTerminal'); save('DIRECTED_S4_ORIGIN_NATURAL_ACTUAL_TERMINAL');
  } else if (error instanceof FiniteEncounterStop) save('DIRECTED_S4_ORIGIN_NATURAL_FINITE_ENCOUNTER_UNRESOLVED', error);
  else { save('ACTUAL_BLOCKER', error); throw error; }
}

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
