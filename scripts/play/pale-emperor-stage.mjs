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
import { addGameDays } from '../../dist/domain/game-calendar.js';
import { validatePaleEmperorSource, paleEmperorSourceHistory, hasPaleEmperorLock } from '../../dist/domain/pale-emperor/index.js';
import { paleEmperorLifeMasteryGains } from '../../dist/domain/pale-emperor/life.js';

// Frozen public strategy. All815 original commands run unchanged, on the one
// actual living post-cycle source. No seed search, future-roll inspection,
// outcome reload, free resources, fixture mutation, or forced success.
const source = 'tests/fixtures/death-consul-v01730/natural.json';
const SOURCE_HASH = '283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9';
// These inspected hashes use JSON.stringify insertion order, not sorted keys.
const PREFIX_HASH = '7f1377eebd7abfe9032d610ca171cdda2fac8541d5777ba096866b9b9e533caa';
const SOURCE_STATE_HASH = '6f02cbfee03fb205ffbb5017173800c078227ac388790217028f188db50274ab';
const ROOT_HASHES = {
  corpsecollector: 'e1e50c8908522f960e78737811cb16a7fc984ba935b089f1d5dcb4cc12818a0b',
  gravedigger: 'ce7607573601230c64730ca6f9d82f9489e1a3c86736ffd852b67dcdd82cfefb',
  spiritmedium: 'd17f603f4ab4cb5befd1effe9f081f8252b5a65ff70e99fd790f3895d47b8dad',
  spiritGuide: '3f61981e689a6ff548ffdc6c56eaee8750843291b30f80b70c4d010f421ba896',
  gatekeeper: 'ef027769305502c2a4faf019ff352f2c46ce99ddea23079285ef4d6aa230e0be',
  undying: '1cbb960f48e85c005ad943110d8e10aa40a0135c9876139caff7568a9a79ccd7',
  longChapter: '4300c7426ca8dba26baae24156be2fde2779f71c990e39033ef41ec54a79f1a8',
};
const prefixCount = 815;
const ROOTS = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying', 'ferryman', 'deathConsul', 'longChapter'];
const CASES = ['quiet-lid', 'guarded-carry', 'withdrawn-return'];
const NEW_IDS = ['death.s1.residual-quieting', 'death.s1.spiritual-interdiction'];
const strategy = Object.freeze({
  caseMethod: 'ABILITY', encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12,
  commandCap: 3500, readinessActionCap: 1200, boundaryCap: 2686, potionLabourSteps: 5,
  currentEra: 'FERRYMAN_ERA_WORK_REST_CARE_NEXT_WEEK_ONLY',
  ordinaryPolicy: 'AT_AP0_EARN_ONCE_IF_BELOW24_THEN_PAY24_NEXT_WEEK;OTHERWISE_REST_IF_NEEDED_AND_CASH_AT_LEAST32_ELSE_WORK',
  originalInjuryRecovery: 'EARN_ACTUAL60P_CARE_WITHOUT_HEALING_THEN_LATER8P_RESTS_UNTIL_HEALED',
  recoveryBeforePotionAndContact: { health: 100, mind: 100, spirituality: 120, pollution: 0, healed: true },
  acquisition: { guidance: 120, bottleAfterFiveJobs: 80, preparation: 20, resupply: 20, weeksSinceDeathConsulPromotion: 12 },
  quietRoute: ['RESIDUAL_QUIETING_ONCE', 'FIT_LID_IF_CURRENT_WINDOW_ELSE_ORDINARY_FIT', 'RESEAL_ONE_ORIGINAL', 'RETURN_LOAN', 'ACTUAL_LEAVE', 'REPORT'],
  carryRoute: ['SPIRITUAL_INTERDICTION_ONCE', 'CARRY_VESSEL_IF_CURRENT_WINDOW_ELSE_SCREENED_CARRY', 'ORDINARY_FIT', 'RESEAL_SECOND_ORIGINAL', 'RETURN_LOAN', 'ACTUAL_LEAVE', 'REPORT'],
  withdrawalRoute: ['SPIRITUAL_INTERDICTION_ONCE', 'WITHDRAW_CUSTODIAN', 'MANUAL_RETURN_WITHOUT_PROPAGATION_OR_NEW_SEAL', 'RETURN_LOAN', 'ACTUAL_LEAVE', 'REPORT'],
  encounterExit: 'ACTUAL4M_FORECOURT_PLUS12M_ROAD_IF_ALIVE_THEN_REAL_CURRENT_ERA_WORK;STOP_ON_DEATH_OR90_ROUNDS',
});
const producerHash = fileDigest(fileURLToPath(import.meta.url));
assert.equal(fileDigest(source), SOURCE_HASH, 'Whole actual815-command source is immutable');
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(key => [key, readObjectEntry(source, key)]));
assert.equal(old.commands.length, prefixCount); assert.equal(old.final.status, 'ACTIVE');
assert.equal(old.seed, 'corpsecollector-natural-v032'); assert.equal(old.final.schemaVersion, 170); assert.equal(old.final.contentVersion, 'death-consul-v170');
assert.equal(jsonDigest(old.commands), PREFIX_HASH); assert.equal(jsonDigest(old.final), SOURCE_STATE_HASH);
for (const [key, hash] of Object.entries(ROOT_HASHES)) assert.equal(jsonDigest(old.final[key]), hash, `Inspected raw ${key}`);
const resumeDirectory = process.argv[2] === '--resume-from' && process.argv.length === 4 ? resolve(process.argv[3]) : null;
if (process.argv.length > 2 && !resumeDirectory) throw Error('Usage: pale-emperor-stage.mjs [--resume-from actual-blocker-capture-directory]');
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/pale-emperor-01950-');
const commands = [], boundaries = {}, snapshots = {}, treatments = [];
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const append = (name, value) => appendFileSync(`${outputDir}/${name}`, `${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`, '', { flag: 'wx' }); writeFileSync(`${outputDir}/public.jsonl`, '', { flag: 'wx' });
let s = createSliceRun(old.final.runId, old.creation, old.seed);
let initial = structuredClone(s), original = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, continuationSource = null, failurePhase = 'INITIALIZATION', replayingContinuation = false;
let frozenSourceHistory = null, frozenSourceScene = null;
const view = () => projectSliceState(s).paleEmperor;
const life = () => s.paleEmperor.life;
const attempt = id => life().cases[id].attempts.at(-1);
const body = state => ({ status: state.status, revision: state.revision, week: state.week, date: state.date, H: state.health, M: state.mind, S: state.spirituality, cash: state.cash, AP: state.actionsRemaining, pollution: state.seer.pollution, injuries: state.injuries, injuryRisk: state.injuryRisk, random: state.random, mastery: state.progression.mastery, sequence: state.progression.sequence, acting: state.progression.acting, era: state.ferryman.era });
const sum = (rows, get) => rows.reduce((total, row) => total + get(row), 0);
class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}

function originals() {
  assert(original);
  for (const root of ROOTS) {
    if (root === 'ferryman') {
      const { era: _current, ...current } = s.ferryman, { era: _start, ...start } = original.ferryman;
      assert.deepEqual(current, start, 'Only ferryman.era may evolve; all original S3 history stays frozen');
    } else assert.deepEqual(s[root], original[root], `Preserve entire original ${root}`);
  }
  if (s.paleEmperor.guidanceKnown) {
    if (frozenSourceHistory === null) { frozenSourceHistory = structuredClone(s.paleEmperor.sourceHistory); frozenSourceScene = structuredClone(s.paleEmperor.sourceScene); }
    assert.deepEqual(s.paleEmperor.sourceHistory, frozenSourceHistory, 'Guidance history checkpoint never changes');
    assert.deepEqual(s.paleEmperor.sourceScene, frozenSourceScene, 'Guidance scene checkpoint never changes');
    const current = paleEmperorSourceHistory(s); current.ferryman.era = structuredClone(frozenSourceHistory.ferryman.era);
    assert.deepEqual(current, frozenSourceHistory); assert.deepEqual(frozenSourceScene.originals, original.deathConsul.life.site);
    assert(validatePaleEmperorSource(s), 'Actual inherited validators must accept the unchanged source checkpoint');
  }
  assert.deepEqual(s.town, original.town, 'Old historical club remains historical inventory');
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.equal(s.random.seed, old.seed); assert.equal(s.runId, original.runId);
  assert.equal(s.progression.promotionWeek, 5); assert.equal(s.deathConsul.promotionWeek, 3284);
  const character = structuredClone(s.character); character.coreStats = structuredClone(original.character.coreStats);
  assert.deepEqual(character, original.character, 'Same name, gender, creation age, identity and body history');
  assert.deepEqual(s.character.coreStats, Object.fromEntries(Object.entries(original.character.coreStats).map(([key, n]) => [key, n + (s.progression.sequence === 1 ? 1 : 0)])));
  const expectedMastery = structuredClone(original.progression.mastery);
  if (s.progression.sequence === 1) {
    for (const id of NEW_IDS) expectedMastery[id] = 0;
    for (const [id, gain] of Object.entries(paleEmperorLifeMasteryGains(s))) expectedMastery[id] = Math.min(500, expectedMastery[id] + gain);
  }
  let enemyPaid = 0, marks = 0;
  const spentIds = new Set();
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const outcome = round.paleEmperorOutcome; assert(outcome, 'No unrelated battle may replace the declared encounter');
    assert.equal(round.stance, strategy.combatStance); assert.equal(outcome.source.policy, strategy.encounterPolicy);
    assert.equal(outcome.source.clubHeld, false, 'The old historical club cannot become a current weapon');
    const ordered = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
    assert(outcome.playerActions.length <= round.playerCount && outcome.enemyActions.length <= round.enemyCount);
    assert.deepEqual(ordered.map(a => a.order), ordered.map((_, index) => index));
    assert.deepEqual(round.moves, ordered.map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })));
    assert(['BODY', 'MENTAL', 'NONE'].includes(outcome.consequenceDomain)); assert.equal(round.consequenceDomain ?? 'NONE', outcome.consequenceDomain);
    assert.equal(outcome.rootAfter.thirdPartiesInArea, 0);
    for (const action of ordered) {
      assert.equal(action.elapsedSeconds, 5); assert(['BODY', 'MENTAL', 'NONE'].includes(action.attackKind));
      for (const id of action.masteryApplied) { assert(Object.hasOwn(expectedMastery, id)); expectedMastery[id] = Math.min(500, expectedMastery[id] + 8); }
      if (action.spiritMarksSpent) {
        assert.equal(action.actor, 'ENEMY'); assert.equal(action.spiritMarksSpent, 1); assert(action.spiritMarkId && !spentIds.has(action.spiritMarkId));
        spentIds.add(action.spiritMarkId);
      }
    }
    enemyPaid += sum(outcome.enemyActions, a => a.paidCost); marks += sum(outcome.enemyActions, a => a.spiritMarksSpent);
    assert.equal(outcome.enemySpirituality, 120 - enemyPaid, 'Alden receives no spiritual regeneration');
    assert.equal(outcome.materialsAfter.marks.remaining, 3 - marks); assert.equal(outcome.materialsAfter.marks.pieces.filter(p => p.state === 'SPENT').length, marks);
  }
  assert.deepEqual(s.progression.mastery, expectedMastery, 'Only actual reported life applications and combat receipts earn mastery');
  const l = life(), journal = l.journal;
  assert.equal(l.elapsedSeconds, sum(journal, row => row.elapsedSeconds)); assert.equal(l.clockSeconds, l.elapsedSeconds);
  assert.equal(l.playerTravelMetres, sum(journal, row => row.playerWalkedMetres));
  let expectedSite = null;
  for (const receipt of journal) { assert.deepEqual(receipt.siteBefore, expectedSite, 'Same original annex assets continue from the preceding receipt'); expectedSite = receipt.siteAfter; }
  assert.deepEqual(l.site, expectedSite);
  if (l.site) {
    assert.equal(l.site.id, 'PE1-ANNEX'); assert.equal(l.site.vessel.id, 'PE1-VESSEL-1'); assert.equal(l.site.vessel.quantity, 1); assert.equal(l.site.vessel.nature, 'NON_SENTIENT_RESIDUAL');
    assert.equal(l.site.vessel.travelledMetres, sum(journal, row => row.vesselCarriedMetres));
    assert.deepEqual(l.site.seals.map(seal => [seal.id, seal.price]), [['PE1-SEAL-1', 4], ['PE1-SEAL-2', 4]]);
    assert.equal(l.site.seals.filter(seal => seal.state === 'USED').length, journal.filter(row => row.command.type === 'RESEAL').length);
    assert(journal.filter(row => row.command.type === 'BUY_SEALS').length <= 1, 'Two original seals only, never restocked');
    assert.equal(l.nora.id, 'PE1-NORA'); assert.equal(l.nora.energy, 100 - sum(journal, row => row.noraEnergySpent));
    assert.equal(l.nora.travelMetres, sum(journal, row => row.noraWalkedMetres));
  }
}

function capture(key) {
  if (!prefixVerified || replayingContinuation) return;
  assert(Object.keys(boundaries).length < strategy.boundaryCap, 'Declared boundary cap exhausted');
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  const file = `boundary-${unique}.json`; write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); boundaries[unique] = file;
}
function snapshot(name) {
  if (snapshots[name] || replayingContinuation) return;
  const file = `snapshot-${name}.json`; write(file, s); snapshots[name] = file;
}
function publicControl(intent) {
  if (!prefixVerified) return { kind: 'IMMUTABLE_SOURCE_PREFIX', enabled: true };
  const p = projectSliceState(s);
  if (intent.type === 'PALE_EMPEROR' || intent.type === 'FERRYMAN') {
    if (intent.type === 'FERRYMAN') assert(['ERA_ENTER', 'ERA_WORK', 'ERA_REST', 'ERA_CARE', 'ERA_NEXT_WEEK'].includes(intent.command.type), 'Never reopen an original-epoch activity');
    const actions = intent.type === 'PALE_EMPEROR' ? p.paleEmperor.actions : p.ferryman.era.actions;
    const offered = actions.find(a => isDeepStrictEqual(a.command, intent.command));
    assert(offered, `No current public control: ${JSON.stringify(intent)}`); assert(offered.enabled, offered.reason);
    return { kind: intent.type, ...structuredClone(offered) };
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(p.status, 'ACTIVE'); assert.equal(p.activeEvent, null); assert(p.combat);
  assert.equal(intent.stance, strategy.combatStance); assert(p.combat.stances.some(a => a.id === intent.stance));
  return { kind: 'COMBAT_ROUND', stance: intent.stance, enabled: true, round: s.combat.round };
}
function verifyEraTransition(previous, intent) {
  if (intent.type !== 'FERRYMAN') return;
  const type = intent.command.type;
  assert.deepEqual(s.random, previous.random, 'Ordinary current-era life never rolls or reseeds');
  if (type === 'ERA_WORK') {
    assert.equal(s.cash, previous.cash + 24); assert.equal(s.actionsRemaining, Math.max(0, previous.actionsRemaining - 1));
    assert.equal(s.ferryman.era.works, previous.ferryman.era.works + 1); assert.equal(s.ferryman.era.income, previous.ferryman.era.income + 24);
    if (previous.actionsRemaining === 0) { assert(previous.cash < 24 && !previous.ferryman.era.emergencyWorkUsed); assert.equal(s.ferryman.era.emergencyWorks, previous.ferryman.era.emergencyWorks + 1); }
  } else if (type === 'ERA_REST') {
    assert.equal(s.cash, previous.cash - 8); assert.equal(s.actionsRemaining, previous.actionsRemaining - 1);
    assert.equal(s.health, Math.min(100, previous.health + 5)); assert.equal(s.mind, Math.min(100, previous.mind + 8)); assert.equal(s.spirituality, Math.min(120, previous.spirituality + 10)); assert.equal(s.seer.pollution, Math.max(0, previous.seer.pollution - 4));
    assert.deepEqual(s.injuries, previous.injuries.filter(i => !(s.health >= 80 && i.acquiredRevision < s.revision && (i.severity === 'LIGHT' || i.treatedRevision !== null && i.treatedRevision < s.revision))));
  } else if (type === 'ERA_CARE') {
    assert.equal(s.cash, previous.cash - 60); assert.equal(s.actionsRemaining, previous.actionsRemaining - 1); assert.equal(s.injuryRisk, previous.injuryRisk);
    assert.deepEqual(s.injuries, previous.injuries.map(i => ({ ...i, treatedRevision: i.severity === 'HEAVY' && i.treatedRevision === null ? s.revision : i.treatedRevision })));
  } else if (type === 'ERA_NEXT_WEEK') {
    assert.equal(previous.actionsRemaining, 0); assert.equal(s.cash, previous.cash - 24); assert.equal(s.actionsRemaining, 4);
    assert.equal(s.week, previous.week + 1); assert.deepEqual(s.date, addGameDays(previous.date, 7));
  } else {
    assert.equal(type, 'ERA_ENTER'); assert.equal(s.cash, previous.cash); assert.equal(s.actionsRemaining, previous.actionsRemaining);
    assert.equal(s.ferryman.era.travelledMetres, previous.ferryman.era.travelledMetres + 12); assert.equal(s.ferryman.era.elapsedSeconds, previous.ferryman.era.elapsedSeconds + 12);
  }
  if (type !== 'ERA_REST') {
    for (const key of ['health', 'mind', 'spirituality']) assert.equal(s[key], previous[key]);
    assert.equal(s.seer.pollution, previous.seer.pollution);
    if (type !== 'ERA_CARE') { assert.deepEqual(s.injuries, previous.injuries); assert.equal(s.injuryRisk, previous.injuryRisk); }
  }
  if (type !== 'ERA_NEXT_WEEK') { assert.equal(s.week, previous.week); assert.deepEqual(s.date, previous.date); }
}
function go(intent, key = null) {
  pendingIntent = structuredClone(intent); failurePhase = 'PUBLIC_PREFLIGHT';
  assert(commands.length < strategy.commandCap, 'Declared command cap exhausted; preserve actual state');
  assert(validateSlicePayload(intent), 'Strict public payload required'); const control = publicControl(intent);
  const previous = s; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
  s = applySliceIntent(s, intent); commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
  append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= prefixCount, before: body(previous), after: body(s) });
  assertValidSliceState(s); assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= previous.random.cursor); assert.equal(s.revision, previous.revision + 1);
  if (prefixVerified) {
    verifyEraTransition(previous, intent); originals();
    if (intent.type === 'FERRYMAN' && intent.command.type === 'ERA_CARE') treatments.push({ before: structuredClone(body(previous)), after: structuredClone(body(s)), paidPennies: 60 });
    // Replayed legitimate tail controls are re-derived from their real public
    // state as well; the new log is complete rather than just a resumed suffix.
    append('public.jsonl', { step: commands.length, revision: previous.revision, command: intent, control, randomBefore: previous.random, randomAfter: s.random });
    if (!replayingContinuation) capture(key ?? `step-${commands.length}-${intent.command?.type.toLowerCase() ?? intent.type.toLowerCase()}`);
  }
  failurePhase = 'IDLE';
  if (prefixVerified && s.status !== 'ACTIVE') throw new ActualTerminalStop(`Actual ${s.status}; never resume or resurrect`);
}
const pe = (command, key = null) => go({ type: 'PALE_EMPEROR', command }, key);
const era = (type, key = null) => go({ type: 'FERRYMAN', command: { type } }, key);
function clear() { assert.equal(s.activeEvent, null); assert.equal(s.pulse, 'NONE'); assert.equal(s.eventQueue.length, 0); }
function ordinary(key = null, recovering = false) {
  clear(); assert.equal(s.status, 'ACTIVE'); assert(!s.combat && !hasPaleEmperorLock(s), 'No ordinary work through a ritual or scene lock');
  if (s.ferryman.era.location !== 'RECEPTION') { era('ERA_ENTER', key); return; }
  if (s.actionsRemaining === 0) { era(s.cash < 24 ? 'ERA_WORK' : 'ERA_NEXT_WEEK', key); return; }
  era(recovering && s.cash >= 32 ? 'ERA_REST' : 'ERA_WORK', key);
}
function care(key) {
  const before = structuredClone(body(s)); era('ERA_CARE', key);
  assert.equal(s.cash, before.cash - 60); assert.equal(s.actionsRemaining, before.AP - 1); assert.equal(s.health, before.H); assert.equal(s.injuryRisk, before.injuryRisk);
  assert.equal(s.injuries.length, before.injuries.length);
  for (const injury of before.injuries) {
    assert.deepEqual(s.injuries.find(i => i.id === injury.id), { ...injury, treatedRevision: injury.severity === 'HEAVY' && injury.treatedRevision === null ? before.revision + 1 : injury.treatedRevision });
  }
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, healed = false, afterWeek = -1 } = {}) {
  clear(); assert(ap <= 4); assert(!hasPaleEmperorLock(s), 'Recovery never bypasses a pending scene');
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || healed && s.injuries.length > 0 || s.week <= afterWeek; n++) {
    assert(n < strategy.readinessActionCap, 'Declared ordinary preparation budget exhausted');
    if (s.actionsRemaining === 0 || s.ferryman.era.location !== 'RECEPTION') { ordinary(); continue; }
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    const recovering = s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || healed && s.injuries.length > 0;
    if (healed && untreated && s.cash >= 60) care('actual-current-era-60p-care-without-healing');
    else ordinary(null, recovering && !(healed && untreated));
  }
}
function action(command, key = null) { ready(); pe(command, key); clear(); }
function recoverOriginalInjuries() {
  if (snapshots.recoveredOriginalInjuries) return;
  assert.equal(life().journal.length, 0);
  ready(strategy.recoveryBeforePotionAndContact);
  const heavy = original.injuries.filter(i => i.severity === 'HEAVY').map(i => i.id);
  assert(heavy.every(id => treatments.some(t => t.before.injuries.some(i => i.id === id && i.treatedRevision === null) && t.after.injuries.some(i => i.id === id && i.treatedRevision === t.before.revision + 1))), 'Each actual original heavy wound has its paid treatment');
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  assert(s.revision > Math.max(...treatments.map(t => t.after.revision)), 'Later actual paid rest follows care'); snapshot('recoveredOriginalInjuries');
}

function practice(caseId) {
  const row = () => life().cases[caseId], a = () => attempt(caseId);
  if (row().status === 'RESOLVED') return;
  assert(['AVAILABLE', 'OBSERVED', 'ACTIVE', 'EXAMINED'].includes(row().status), 'Never substitute a new paid attempt for an interrupted one');
  if (row().status === 'AVAILABLE') pe({ type: 'OBSERVE', caseId }, `${caseId}-actual-source-and-ordinary-alternative`);
  if (row().status === 'OBSERVED') {
    if (life().playerLocation === 'RECEPTION') {
      ready({ ap: 2, cash: life().site ? 10 : 18, ...strategy.recoveryBeforePotionAndContact });
      pe({ type: 'WALK_TO_ANNEX' }, `${caseId}-actual12m12s-road-arrival-1AP`);
    }
    if (life().site.seals.every(seal => seal.state === 'SUPPLIER')) pe({ type: 'BUY_SEALS' }, 'actual8p-only-two-original-seals');
    pe({ type: 'INVITE', caseId, method: strategy.caseMethod }, `${caseId}-fresh10p1AP-nora-invitation`);
  }
  if (row().status === 'ACTIVE') {
    assert.equal(life().activeCase, caseId); assert.equal(row().attempts.length, 1); assert.equal(row().method, strategy.caseMethod);
    for (const [permission, field] of [['CUSTODIAN', 'custodian'], ['ABILITY', 'ability']]) {
      if (a().permission[field] === 'UNASKED') pe({ type: 'CONSENT', permission }, `${caseId}-fresh-${field}-consent`);
    }
    if (!a().prepared) pe({ type: 'PREPARE_VESSEL' }, `${caseId}-actual-walk-and-open-same-vessel`);
    if (a().result === 'NONE' && a().permission.custodian === 'GRANTED') {
      if (a().observedVersion !== life().site.vessel.version) pe({ type: 'OBSERVE_VESSEL' }, `${caseId}-observe-current-original-and4m-line`);
      const use = caseId === 'quiet-lid' ? 'quieting' : 'interdiction';
      if (a()[use].attempts === 0) pe({ type: caseId === 'quiet-lid' ? 'RESIDUAL_QUIETING' : 'SPIRITUAL_INTERDICTION' }, `${caseId}-one-paid-window-attempt`);
      assert.equal(a()[use].attempts, 1, 'No retry to replace the actual paid check');
      if (caseId === 'quiet-lid' && !a().lidFitted) pe({ type: life().pending?.kind === 'QUIETING' ? 'FIT_LID' : 'ORDINARY_FIT' }, `${caseId}-actual-lid-action-or-ordinary-fallback`);
      else if (caseId === 'guarded-carry' && !a().carried) pe({ type: life().pending?.kind === 'INTERDICTION' ? 'CARRY_VESSEL' : 'SCREENED_CARRY' }, `${caseId}-actual4m-carry-or-ordinary-fallback`);
      else if (caseId === 'withdrawn-return') pe({ type: 'WITHDRAW_CONSENT', permission: 'CUSTODIAN' }, `${caseId}-actual-current-withdrawal-no-refund`);
    }
    if (caseId === 'withdrawn-return') {
      assert.equal(a().permission.custodian, 'WITHDRAWN'); assert.equal(life().pending, null); assert.equal(a().interdiction.effects, 0);
      if (!a().manualReturned) pe({ type: 'MANUAL_RETURN' }, `${caseId}-screened-same-vessel4m-return-no-new-seal`);
    } else {
      if (!a().lidFitted) pe({ type: 'ORDINARY_FIT' }, `${caseId}-ordinary-original-screen-and-lid-with-real-scuff`);
      if (!a().resealed) pe({ type: 'RESEAL' }, `${caseId}-consume-one-actual-original-seal`);
    }
    if (!a().loanReturned) pe({ type: 'RETURN_LOAN' }, `${caseId}-return-same-original-loan-safe-box`);
    pe({ type: 'LEAVE' }, `${caseId}-nora-actual-exit-and-player12m-road-return`);
  }
  assert.equal(row().status, 'EXAMINED'); assert.equal(life().playerLocation, 'RECEPTION'); assert.equal(life().nora.present, false); assert.equal(life().nora.location, 'AWAY'); assert.equal(life().pending, null);
  action({ type: 'REPORT', caseId }, `${caseId}-honest-report-of-actual-applications-and-failures`);
}
function encounter() {
  const e = () => s.paleEmperor.encounter;
  if (e().status === 'AVAILABLE') {
    ready({ ap: 2, ...strategy.recoveryBeforePotionAndContact }); snapshot('recoveredBeforeEncounter');
    assert.equal(life().playerLocation, 'RECEPTION'); assert.equal(life().nora.present, false); assert.equal(life().nora.location, 'AWAY'); assert.equal(life().site.vessel.location, 'NEAR');
    pe({ type: 'ENCOUNTER_TALK' }, 'actual16m16s-arrival-independent-alden');
  }
  if (e().status === 'READY') {
    if (!view().encounter.policyConfirmed) pe({ type: 'ENCOUNTER_POLICY', policy: strategy.encounterPolicy }, 'fixed-all-policy-before-independent-encounter');
    assert.equal(e().policy, strategy.encounterPolicy); pe({ type: 'ENCOUNTER_FIGHT' }, 'one-optional-independent-alden-fight'); snapshot('combatStart');
  }
  if (e().status === 'FIGHTING') {
    assert.equal(e().policy, strategy.encounterPolicy);
    while (s.combat && s.combat.round <= strategy.combatRoundCap) go({ type: 'COMBAT_ROUND', stance: strategy.combatStance }, `combat-round-${s.combat.round}`);
    if (s.combat) { snapshot('combatFiniteCap'); throw new FiniteEncounterStop('Declared90-round cap reached; actual unresolved encounter preserved'); }
  }
  assert.equal(s.combat, null); assert(e().terminal);
  assert.equal(e().terminal.exitMetres, 4); assert.equal(e().terminal.exitSeconds, 4); assert.equal(e().terminal.roadExitMetres, 12); assert.equal(e().terminal.roadExitSeconds, 12);
  assert.equal(e().scene.playerLocation, 'OUTSIDE'); assert.equal(e().scene.playerCoordinate, 0); assert.equal(e().scene.roadTravelMetres, 24);
  assert.equal(view().encounter.inside, false); snapshot('combatTerminal');
}

function verifyPrefix() {
  assert.deepEqual(commands, old.commands, 'Every one of the original815 commands in original order');
  assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated original final, including all old histories');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 816); assert.equal(s.week, 3290); assert.deepEqual(s.date, { epoch: 'FIFTH_EPOCH', year: 1412, month: 7, day: 15 });
  assert.equal(s.random.cursor, 359); assert.equal(s.health, 20); assert.equal(s.mind, 100); assert.equal(s.spirituality, 95); assert.equal(s.cash, 34); assert.equal(s.actionsRemaining, 1); assert.equal(s.injuryRisk, 6);
  assert.deepEqual(s.injuries, old.final.injuries); assert.deepEqual(s.injuries.map(i => [i.severity, i.treatedRevision]), [['HEAVY', null], ['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
  assert.equal(s.progression.pathwayId, 'death'); assert.equal(s.progression.sequence, 2); assert.equal(s.progression.acting, 100); assert.equal(s.deathConsul.promotionWeek, 3284);
  assert.equal(Object.keys(s.progression.mastery).length, 17); assert.equal(Object.values(s.progression.mastery).filter(n => n === 0).length, 5);
  assert.equal(s.character.name, '伊莲'); assert.equal(s.character.gender, 'FEMALE'); assert.equal(s.character.age, 26); assert.deepEqual(s.character.coreStats, { physique: 32, perception: 28, will: 26, knowledge: 22 });
  assert.equal(s.deathConsul.encounter.status, 'RETREATED'); assert.equal(s.deathConsul.encounter.enemyHealth, 80); assert.equal(s.deathConsul.encounter.enemySpirituality, 46); assert.equal(s.deathConsul.encounter.enemyInjuries.length, 2);
  assert.equal(s.undying.encounter.status, 'AVAILABLE'); assert.equal(s.undying.encounter.enemy.health, 100); assert.equal(s.undying.lifecycle.experiencedCycles, 1);
  assert.equal(s.deathConsul.life.site.operatorLocation, 'OUTSIDE'); assert.equal(s.deathConsul.life.site.operatorEnergy, 94); assert.equal(s.deathConsul.life.site.door.state, 'OPEN'); assert.equal(s.deathConsul.life.site.door.operations, 17);
  assert.equal(s.deathConsul.life.site.residual.strength, 1); assert.equal(s.deathConsul.life.site.residual.scorch, 1); assert.equal(s.deathConsul.life.site.material.remaining, 0);
  original = structuredClone(s); prefixVerified = true; originals();
  write('source-prefix.json', { creation: old.creation, seed: old.seed, commands: commands.slice(), commandCount: prefixCount, jsonStringifySha256: PREFIX_HASH, rawSourceSha256: SOURCE_HASH, rawSourceRoot: 'final', rawWholeStateSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, migratedWholeStateSha256: jsonDigest(original), inspectedRootHashes: ROOT_HASHES });
  snapshot('departure'); capture('exact-original815-command-living-source');
}
function copyPrior(name, directory, expectedHash) {
  assert.equal(name, basename(name), 'Only local capture filenames'); assert.equal(fileDigest(`${directory}/${name}`), expectedHash, `Prior capture integrity: ${name}`);
  copyFileSync(`${directory}/${name}`, `${outputDir}/${name}`, constants.COPYFILE_EXCL);
}
function resumeTail(directory) {
  const file = `${directory}/natural.json`, entry = key => readObjectEntry(file, key);
  const integrity = JSON.parse(readFileSync(`${directory}/capture-integrity.json`, 'utf8'));
  assert.equal(fileDigest(file), integrity.naturalSha256); assert.equal(integrity.producerSha256, producerHash);
  assert.equal(entry('stage'), 'ACTUAL_BLOCKER', 'Never resume death, completed outcome or finite cap');
  const provenance = entry('provenance'); assert.equal(provenance.sourceSha256, SOURCE_HASH); assert.equal(provenance.rawSourceStateSha256, SOURCE_STATE_HASH); assert.equal(provenance.sourceRoot, 'final');
  assert.equal(entry('producerSha256'), producerHash); assert.deepEqual(entry('strategy'), strategy); assert.equal(entry('seed'), old.seed); assert.deepEqual(entry('creation'), old.creation); assert.equal(entry('prefixVerified'), true);
  const previous = entry('commands'); assert.deepEqual(previous.slice(0, prefixCount), old.commands); assert.deepEqual(migrateSliceState(entry('prefixFinal')), original);
  const priorFinal = entry('final'), priorBefore = entry('beforeLast'), priorIntent = entry('lastIntent'), phase = entry('failurePhase');
  assert.equal(priorFinal.status, 'ACTIVE', 'No dead body can be resumed');
  const retryLast = phase === 'AFTER_APPLY_VALIDATION', replayCount = previous.length - (retryLast ? 1 : 0);
  if (retryLast) { assert.deepEqual(previous.at(-1), priorIntent); assert.equal(priorBefore.status, 'ACTIVE'); }
  replayingContinuation = true;
  try { for (const intent of previous.slice(prefixCount, replayCount)) go(intent); } finally { replayingContinuation = false; }
  assert.deepEqual(s, migrateSliceState(retryLast ? priorBefore : priorFinal), 'Complete legitimate tail replay, never loaded or edited');
  assert.equal(fileDigest(`${directory}/boundaries.index.json`), integrity.indexSha256);
  const priorIndex = JSON.parse(readFileSync(`${directory}/boundaries.index.json`, 'utf8')), priorSnapshots = entry('snapshots');
  for (const name of new Set([...Object.values(priorIndex), ...Object.values(priorSnapshots)])) {
    if (Object.values(boundaries).includes(name) || Object.values(snapshots).includes(name)) assert.equal(fileDigest(`${outputDir}/${name}`), integrity.files[name]);
    else copyPrior(name, directory, integrity.files[name]);
  }
  Object.assign(boundaries, priorIndex); Object.assign(snapshots, priorSnapshots); assert.deepEqual(treatments, entry('treatments'), 'Every recorded treatment is re-derived from the legitimate tail');
  const priorHash = fileDigest(file), preserved = `prior-blocker-${priorHash}.json`;
  copyFileSync(file, `${outputDir}/${preserved}`, constants.COPYFILE_EXCL);
  assert.equal(fileDigest(`${directory}/public.jsonl`), integrity.publicSha256);
  copyFileSync(`${directory}/public.jsonl`, `${outputDir}/prior-public-${priorHash}.jsonl`, constants.COPYFILE_EXCL);
  continuationSource = { directory, sha256: priorHash, preserved, commandCount: previous.length, retryLast, previousPhase: phase, randomCursor: s.random.cursor };
  if (retryLast) {
    go(priorIntent, 'same-blocked-final-command-retried-once');
    assert.deepEqual(s, migrateSliceState(priorFinal), 'Wiring repair cannot alter actual costs, body, history, outcomes, mastery or RNG');
  }
}

function save(stage, error = null) {
  assert.equal(fileDigest(source), SOURCE_HASH);
  const e = s.paleEmperor.encounter, actualRounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length), outcomes = actualRounds.map(r => r.paleEmperorOutcome).filter(Boolean);
  const journal = life().journal, acquisition = s.paleEmperor.acquisitionJournal;
  const exactExpectedBoundaries = prefixVerified ? commands.length - prefixCount + 1 - (failurePhase === 'AFTER_APPLY_VALIDATION' ? 1 : 0) : 0;
  const captureBudget = { prefixTransitions: prefixCount, continuationTransitions: Math.max(0, commands.length - prefixCount), capturedSourceTransitions: prefixVerified ? 1 : 0, exactExpectedBoundaries, actualBoundaries: Object.keys(boundaries).length, maximumBoundaries: strategy.boundaryCap, snapshots: Object.keys(snapshots).length };
  if (stage !== 'ACTUAL_BLOCKER') assert.equal(captureBudget.actualBoundaries, exactExpectedBoundaries, 'Every actual continuation transition is captured exactly once');
  // Stream separate top-level roots; do not stringify a giant duplicate capture tree.
  const natural = `${outputDir}/natural.json`; writeFileSync(natural, '{', { flag: 'wx' }); let first = true;
  const property = (key, value) => { appendFileSync(natural, `${first ? '' : ','}${JSON.stringify(key)}:${JSON.stringify(value)}`); first = false; };
  property('provenance', { kind: 'SAME_SEED_COMPLETE815_COMMAND_ACTUAL_LIVING_SOURCE', source, sourceSha256: SOURCE_HASH, sourceRoot: 'final', rawSourceStateSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, entireOriginalPrefixPreserved: true, oldOwenHistoricalAvailablePreserved: true, oldNolanRetreatPreserved: true, experiencedCycles: 1, noNewSeedOrRandomEdits: true });
  for (const [key, value] of Object.entries({ producerSha256: producerHash, strategy, creation: old.creation, seed: old.seed, prefixCount, prefixVerified, continuationSource, commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments, captureBudget, stage, error: error ? String(error.stack ?? error) : null, final: s })) property(key, value);
  appendFileSync(natural, '}'); write('boundaries.index.json', boundaries);
  write('summary.json', {
    stage, strategy, captureBudget, commands: commands.length, continuationSource, final: body(s),
    source: { prefixCount, prefixVerified, sourceSha256: SOURCE_HASH, prefixJsonStringifySha256: PREFIX_HASH, rawSourceStateSha256: SOURCE_STATE_HASH, rawSchemaVersion: old.final.schemaVersion, rawContentVersion: old.final.contentVersion, migratedWholeStateSha256: original ? jsonDigest(original) : null, inspectedRootHashes: ROOT_HASHES },
    originalMastery: original?.progression.mastery ?? null, mastery: s.progression.mastery, lifeCases: Object.fromEntries(CASES.map(id => [id, life().cases[id]])),
    lifeAbilityUse: Object.fromEntries([['quieting', NEW_IDS[0]], ['interdiction', NEW_IDS[1]]].map(([key, id]) => {
      const uses = CASES.flatMap(caseId => life().cases[caseId].attempts.map(a => a[key]));
      return [id, { actualCasts: sum(uses, use => use.attempts), successfulWindows: sum(uses, use => use.successes), actualApplications: sum(uses, use => use.effects), states: uses.map(use => use.state) }];
    })),
    actualCosts: {
      acquisitionCash: sum(acquisition, row => row.before.cash - row.after.cash), acquisitionAP: sum(acquisition, row => row.before.actions - row.after.actions),
      lifeCash: sum(journal, row => row.before.cash - row.after.cash), lifeAP: sum(journal, row => row.before.actions - row.after.actions), lifeSpirituality: sum(journal, row => row.before.spirituality - row.after.spirituality), lifeMind: sum(journal, row => row.before.mind - row.after.mind),
      playerWalkedMetres: sum(journal, row => row.playerWalkedMetres), noraWalkedMetres: sum(journal, row => row.noraWalkedMetres), noraEnergy: sum(journal, row => row.noraEnergySpent), vesselCarriedMetres: sum(journal, row => row.vesselCarriedMetres), lifeSeconds: sum(journal, row => row.elapsedSeconds),
      combatSpirituality: sum(outcomes.flatMap(o => o.playerActions), a => a.paidCost), combatMindCasting: sum(outcomes.flatMap(o => o.playerActions), a => a.mindCost), enemySpirituality: sum(outcomes.flatMap(o => o.enemyActions), a => a.paidCost), enemyMarksSpent: sum(outcomes.flatMap(o => o.enemyActions), a => a.spiritMarksSpent), clinic: sum(treatments, t => t.paidPennies),
      era: original ? Object.fromEntries(['works', 'rests', 'weeksAdvanced', 'income', 'expenses', 'emergencyWorks', 'treatments'].map(key => [key, s.ferryman.era[key] - original.ferryman.era[key]])) : null,
      note: 'The actual source starts H20/cash34/AP1 with two untreated heavy and two light wounds. Every24p income,60p care,8p rest,24p real week, new bottle, failed check, seal and movement remains in actual public receipts.',
    },
    sourceHistorySha256: s.paleEmperor.sourceHistory ? jsonDigest(s.paleEmperor.sourceHistory) : null, sourceSceneSha256: s.paleEmperor.sourceScene ? jsonDigest(s.paleEmperor.sourceScene) : null,
    originalTown: original?.town ?? null, currentTown: s.town, life: life(),
    encounter: { status: e.status, terminal: e.terminal, scene: e.scene, materials: e.materials, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: e.enemyInjuries, powerUses: e.powerUses, inheritedApplications: e.inheritedApplications,
      residualQuieting: { actualCasts: e.residualQuietingAttempts, successfulWindows: e.residualQuietingChecks, actualApplications: e.residualQuietingSuccesses }, spiritualInterdiction: { actualCasts: e.spiritualInterdictionAttempts, successfulWindows: e.spiritualInterdictionChecks, actualApplications: e.spiritualInterdictionSuccesses } },
    rounds: actualRounds.map(r => ({ round: r.round, stance: r.stance, first: r.first, countWheels: { playerRoll: r.playerCountRoll, playerCount: r.playerCount, enemyRoll: r.enemyCountRoll, enemyCount: r.enemyCount }, consequenceDomain: r.paleEmperorOutcome?.consequenceDomain ?? r.consequenceDomain ?? 'NONE', consequenceRoll: r.consequenceRoll ?? null, result: r.paleEmperorOutcome ?? null })),
    bottles: s.paleEmperor.bottles, treatments, boundaries: Object.keys(boundaries), snapshots,
    bodilyMental: 'BODY club consequences remain separate from MENTAL spiritual pressure. New windows affect only a later eligible observed original source effect, never already resolved harm. Casts and failed or unused windows earn no application mastery.',
  });
  write('capture-integrity.json', { producerSha256: producerHash, naturalSha256: fileDigest(natural), commandsSha256: fileDigest(`${outputDir}/commands.jsonl`), publicSha256: fileDigest(`${outputDir}/public.jsonl`), indexSha256: fileDigest(`${outputDir}/boundaries.index.json`), summarySha256: fileDigest(`${outputDir}/summary.json`), sourcePrefixSha256: prefixVerified ? fileDigest(`${outputDir}/source-prefix.json`) : null, captureBudget, files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileDigest(`${outputDir}/${name}`)])) });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, boundaries: Object.keys(boundaries).length, status: s.status, sequence: s.progression.sequence, week: s.week }));
}

try {
  for (const intent of old.commands) go(intent);
  verifyPrefix(); if (resumeDirectory) resumeTail(resumeDirectory);
  recoverOriginalInjuries();
  if (s.progression.sequence === 2) {
    if (!s.paleEmperor.guidanceKnown) { ready({ cash: 120 }); pe({ type: 'LEARN_GUIDANCE' }, 'actual120p-guidance-frozen-eight-stages-and-long-history'); }
    assert.equal(s.paleEmperor.sourceEra, 'POST_CYCLE');
    for (const taskId of ['VERIFY_PROVENANCE', 'VERIFY_RESIDUAL', 'PLAN_RETURN']) if (!s.paleEmperor.preparations.some(row => row.taskId === taskId)) action({ type: 'PREPARE_TASK', taskId }, `actual-preparation-${taskId}`);
  }
  while (s.progression.sequence === 2 && s.paleEmperor.bottles.filter(b => b.status === 'CONSUMED').length < strategy.potionAttemptCap) {
    let bottle = s.paleEmperor.bottles.find(b => b.status === 'PLAYER') ?? s.paleEmperor.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      if (s.paleEmperor.resupply.requestedWeek === null) { ready({ cash: 20 }); pe({ type: 'REQUEST_SUPPLY' }, 'actual20p-supply-request-after-real-failures'); }
      ready({ afterWeek: s.paleEmperor.resupply.requestedWeek }); pe({ type: 'RECEIVE_SUPPLY' }, 'actual-later-week-three-new-original-bottles');
      bottle = s.paleEmperor.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.paleEmperor.bottles.find(b => b.id === bottleId).labourSteps < strategy.potionLabourSteps) action({ type: 'POTION_WORK', bottleId }, `${bottleId}-actual-bottle-specific-job`);
      ready({ cash: 100 }); const cash = s.cash; pe({ type: 'BUY_POTION', bottleId }, `actual80p-buy-${bottleId}`); assert.equal(s.cash, cash - 80);
    }
    if (s.paleEmperor.preparedWeek === null) {
      ready({ cash: 20, ...strategy.recoveryBeforePotionAndContact, afterWeek: s.deathConsul.promotionWeek + 11 });
      pe({ type: 'PREPARE_PROMOTION' }, `actual20p-current-week-preparation-${bottleId}`);
    }
    assert.equal(s.paleEmperor.preparedWeek, s.week); assert(s.week - s.deathConsul.promotionWeek >= 12);
    const before = structuredClone(body(s)), stats = structuredClone(s.character.coreStats);
    pe({ type: 'CONSUME', bottleId, confirmed: true }, `actual-consume-${bottleId}`);
    const consumed = s.paleEmperor.bottles.find(b => b.id === bottleId); assert.equal(consumed.status, 'CONSUMED'); assert.equal(s.paleEmperor.preparedWeek, null); assert.equal(s.random.cursor, before.random.cursor + 1);
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[consumed.outcome]; assert(costs);
    assert.equal(s.health, Math.max(1, before.H - costs[0])); assert.equal(s.mind, Math.max(1, before.M - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2])); assert.equal(s.spirituality, before.S);
    assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.injuryRisk);
    for (const [id, n] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], n);
    assert.deepEqual(s.character.coreStats, Object.fromEntries(Object.entries(stats).map(([key, n]) => [key, n + (s.progression.sequence === 1 ? 1 : 0)])));
  }
  if (s.progression.sequence !== 1) save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
  else {
    if (life().journal.length === 0) { for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted'); }
    for (const caseId of CASES) practice(caseId);
    if (!life().reflected) action({ type: 'REFLECT' }, 'three-honest-reports-reflected');
    assert.equal(s.progression.acting, 100); snapshot('practiced'); encounter();
    if (!boundaries['actual-current-era-paid-work-after-living16m-exit']) { ready(); era('ERA_WORK', 'actual-current-era-paid-work-after-living16m-exit'); clear(); }
    save('NATURAL_PALE_EMPEROR_PUBLIC_CONTINUATION');
  }
} catch (error) {
  if (error instanceof ActualTerminalStop || prefixVerified && s.status !== 'ACTIVE') {
    if (s.paleEmperor.encounter.terminal) snapshot('combatTerminal'); snapshot('actualTerminal'); save('NATURAL_ACTUAL_TERMINAL', error instanceof ActualTerminalStop ? null : error);
    if (!(error instanceof ActualTerminalStop)) throw error;
  } else if (error instanceof FiniteEncounterStop) save('NATURAL_FINITE_ENCOUNTER_UNRESOLVED', error);
  else { save('ACTUAL_BLOCKER', error); throw error; }
}

function jsonDigest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); } return hash.digest('hex');
}
// Parse only the selected top-level root. UTF-8 code points may span chunks;
// skipped old snapshots never become a giant in-memory all-captures tree.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE'; const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end(); let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw Error('Expected top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') { if (/\s/.test(c) || c === ',') continue; if (c === '}') throw Error(`Missing JSON entry: ${wanted}`); if (c !== '"') throw Error('Expected JSON property name'); key = '"'; escaped = false; phase = 'KEY_STRING'; continue; }
        if (phase === 'KEY_STRING') { key += c; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; } continue; }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') { if (/\s/.test(c)) continue; if (selected) captureStart = i; depth = 0; quoted = false; escaped = false; kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE'; }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; } }
          else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart)); if (!n) break;
    }
  } finally { closeSync(fd); }
  throw Error(`Missing JSON entry: ${wanted}`);
}
