import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Static candidate. Lead runs after compilation, once per intentional public route:
// node --max-old-space-size=512 scripts/play/wisdom-angel-stage.mjs
// No state edits, reseeding, cursor search, failure reloads, free injury treatment,
// old-prefix substitution, death erasure, or overwrite of existing captures.
const load = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('index');
const { migrateSliceState } = await load('migration');
const { validateSlicePayload } = await load('validation');
const sourceFixture = 'tests/fixtures/insight-scholar-v01460/peaceful.json';
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final', 'prefixCount'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed } = old, prefixCount = old.commands.length;
const CASES = ['record-handover', 'changed-condition', 'withdrawn-consent'];
const NEW_IDS = ['reader.s2.conditional-synthesis', 'reader.s2.observed-response'];
const MAX_COMMANDS = 2200, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, snapshots = {}, treatments = [];
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false, paidCraft = null;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/wisdom-angel-01700-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => pub().wisdomAngel;
const life = () => s.wisdomAngel.life, attempt = id => life().cases[id].attempts.at(-1);
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 423-command prefix');
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  const name = `${unique}.json`; write(`${outputDir}/${name}`, { beforeLast, lastIntent, final: s });
  boundaries[unique] = name;
}
function go(intent, boundary = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite public strategy exhausted; preserve its actual blocker');
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent); assertValidSliceState(next);
  assert.equal(next.random.seed, seed); assert(next.random.cursor >= s.random.cursor);
  assert.equal(next.revision, s.revision + 1); assert.equal(next.weeklyBudget, 3);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null;
  if (prefixVerified) {
    append(commandsFile, { index: commands.length, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
    append(publicFile, { index: commands.length, public: pub() });
    if (boundary) capture(boundary);
    console.log(JSON.stringify({ index: commands.length, intent, week: s.week, status: s.status, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting }));
  }
}
function wa(command, boundary = null) {
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a public action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'WISDOM_ANGEL', command }, boundary ?? `public-${command.type.toLowerCase()}${'caseId' in command ? `-${command.caseId}` : ''}`);
}
function clear() {
  for (let count = 0; s.activeEvent && count < 20; count++) {
    const event = pub().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline' : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE' : event.id === 'DEBT-SETTLE-01' ? 'DEFER' : event.id === 'LIFE-CARE-01' ? 'PAY' : null;
    assert(choiceId, `Unexpected event ${event.id}; retain the actual pending event`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Unavailable actual choice ${event.id}/${choiceId}`);
    const before = event.id === 'LIFE-CARE-01' ? { cash: s.cash, week: s.week, revision: s.revision, injuries: structuredClone(s.injuries) } : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, before ? 'clinic-pay60' : null);
    if (before) {
      assert(s.cash <= before.cash - 60, 'PAY60 and actual week-end charges remain paid');
      for (const oldInjury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const injury = s.injuries.find(i => i.id === oldInjury.id); assert(injury, 'Treatment must not instantly heal the original wound'); assert.notEqual(injury.treatedRevision, null);
      }
      treatments.push({ paidPennies: 60, before, cashAfter: s.cash, injuriesAfter: structuredClone(s.injuries) });
    }
  }
  assert.equal(s.activeEvent, null, 'Event chain still pending');
}
function ordinary(boundary = null, forceRest = false) {
  clear(); assert.equal(s.status, 'ACTIVE', 'Actual death cannot continue ordinary life');
  assert(pub().canAct && !view().insideCase && !s.combat, 'Never work/rest through a real scene lock');
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, boundary); clear();
}
function ready({ cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear(); assert(ap <= 3);
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) ordinary();
}
function action(command, boundary = null) { ready(); wa(command, boundary); clear(); }
function recoverOriginalInjuries() {
  assert.equal(s.health, 100); assert.equal(s.injuryRisk, 1);
  assert.equal(s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 1);
  assert.equal(s.injuries.length, 1);
  if (!s.careKnown) {
    ready({ cash: 60, ap: 2 }); assert(pub().investigateTargets.some(t => t.id === 'CARE-ACCESS-01'));
    const health = s.health, injuries = structuredClone(s.injuries);
    go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'clinic-actual-discovery');
    assert.equal(s.health, health); assert.deepEqual(s.injuries, injuries); clear();
  }
  while (s.injuries.length) {
    ready({ cash: s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 60 : 0 });
    ordinary(s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 'clinic-invitation-rest' : 'treated-injury-later-rest', true);
  }
  assert(treatments.length > 0, 'Original untreated heavy injury requires real PAY60'); assert.equal(s.injuryRisk, 0);
}
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.character.gender, old.final.character.gender); assert.equal(s.random.seed, seed);
  for (const key of ['reader', 'reasoner', 'detective', 'polymath', 'prophet', 'insightScholar']) assert.deepEqual(s[key], old.final[key], `Preserve every original ${key} fact`);
  const original = old.final.mysticismMagister, current = s.mysticismMagister;
  assert.equal(current.practice.kitsUsed, original.practice.kitsUsed + (paidCraft ? 1 : 0), 'Only one real paid new material package is used');
  assert.equal(current.craftAttemptWeek, paidCraft?.week ?? original.craftAttemptWeek);
  assert.equal(current.crafts.length, original.crafts.length + (paidCraft?.piece ? 1 : 0), 'Only the actual paid successful production creates a new original piece');
  for (const prior of original.crafts) {
    const piece = current.crafts.find(p => p.id === prior.id); assert(piece);
    assert.equal(piece.sourceKitId, prior.sourceKitId); assert.equal(piece.createdWeek, prior.createdWeek); assert.equal(piece.power, prior.power);
    if (prior.status === 'CONSUMED') assert.deepEqual(piece, prior, 'Already consumed original cannot refill');
    else if (piece.status === 'CONSUMED') assert(piece.usedWeek >= s.wisdomAngel.promotionWeek, 'Only actual new-stage consumption may change original held piece');
    else assert.deepEqual(piece, prior);
  }
  if (paidCraft?.piece) {
    const piece = current.crafts.find(p => p.id === paidCraft.piece.id); assert(piece);
    assert.deepEqual({ ...piece, status: paidCraft.piece.status, usedWeek: paidCraft.piece.usedWeek }, paidCraft.piece, 'Actual new piece retains its source and fixed power');
    if (piece.status === 'CONSUMED') assert(piece.usedWeek >= paidCraft.week);
  }
  assert.deepEqual({ ...current, crafts: original.crafts, craftAttemptWeek: original.craftAttemptWeek, practice: { ...current.practice, kitsUsed: original.practice.kitsUsed } }, original, 'Only the explicit paid inherited production and actual original-piece consumption may change S5 fields');
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Preserve original mastery ${id}`);
  assert.deepEqual(s.town, old.final.town, 'No free club or ordinary equipment');
  assert.equal(s.insightScholar.encounter.status, 'RESOLVED'); assert.equal(s.insightScholar.encounter.enemyHealth, 100);
  assert.equal(s.prophet.encounter.enemy.health, 70); assert.equal(s.prophet.encounter.enemy.status, 'SURRENDERED');
}
function practice(caseId) {
  ready({ ap: 2, health: 90, mind: 85, spirituality: 30 });
  wa({ type: 'PREPARE', caseId, method: 'ABILITY' }, `${caseId}-prepared`); wa({ type: 'PERFORM', caseId }, `${caseId}-opened`);
  const step = (type, key = null) => wa({ type, caseId }, key);
  for (const type of ['READ_SOURCE', 'CONSENT_OWNER', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_PAPERS', 'READ_FIRST', 'READ_SECOND']) step(type);
  if (caseId === 'record-handover') {
    step('SYNTHESIS', `${caseId}-synthesis-outcome`);
    if (!attempt(caseId).synthesis.successes) step('MANUAL_COMPARE', 'failed-synthesis-ordinary-comparison');
    step('VERIFY_HANDOVER', 'record-handover-actual-verification');
  } else if (caseId === 'changed-condition') {
    step('TAKE_DEVICE'); step('OBSERVE_CONDITION'); step('FIRST_DEMONSTRATION', 'actual-first-demo');
    step('SYNTHESIS', 'changed-condition-original-model');
    wa({ type: 'PREDICT', caseId, prediction: 'WHITE' }, 'original-condition-prediction');
    step('SWITCH_FILTER', 'physically-changed-filter');
    assert.equal(life().device.conditionVersion, 2); assert.equal(life().device.charges, 1);
    assert.notEqual(attempt(caseId).synthesis.state, 'ACTIVE'); assert.equal(attempt(caseId).models[0].version, 1);
    assert(!view().actions.find(a => a.command.type === 'SYNTHESIS' && a.command.caseId === caseId)?.enabled, 'Changed real source must be observed again before synthesis');
    step('OBSERVE_CONDITION'); step('SYNTHESIS', 'changed-condition-updated-model');
    // Deliberately preserve the original WHITE prediction, then record a new
    // conditional prediction from the actually visible AMBER filter.
    wa({ type: 'PREDICT', caseId, prediction: 'AMBER' }, 'updated-condition-prediction');
    step('RESPONSE', 'changed-condition-response-outcome');
    step('SECOND_DEMONSTRATION', 'actual-second-demo'); step('VERIFY_RESULT', 'result-verified');
    assert.equal(life().device.charges, 0); assert.equal(life().device.demonstrations, 2);
    assert.equal(attempt(caseId).predictions.length, 2); assert.equal(attempt(caseId).predictions[0].prediction, 'WHITE');
    assert(!view().actions.find(a => a.command.type === 'SECOND_DEMONSTRATION' && a.command.caseId === caseId)?.enabled, 'No free third demonstration');
  } else {
    step('TAKE_DEVICE'); step('SYNTHESIS', `${caseId}-synthesis-outcome`);
    step('WITHDRAW_CONSENT', 'owner-current-consent-withdrawn');
    assert.equal(attempt(caseId).synthesis.effects, 0); assert.equal(attempt(caseId).response.effects, 0);
    assert(view().actions.filter(a => ['SYNTHESIS', 'RESPONSE', 'VERIFY_HANDOVER', 'FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION'].includes(a.command.type) && 'caseId' in a.command && a.command.caseId === caseId).every(a => !a.enabled));
  }
  const stop = view().actions.find(a => a.command.type === 'STOP_METHOD' && a.command.caseId === caseId);
  if (stop?.enabled) step('STOP_METHOD', `${caseId}-explicit-stop`);
  step('RETURN_PAPERS', `${caseId}-same-papers-returned`);
  if (attempt(caseId).deviceTaken) step('RETURN_DEVICE', `${caseId}-same-device-returned`);
  step('EXIT_ROOM', `${caseId}-actual-ordinary-exit`); step('INSPECT'); step('CLOSE', `${caseId}-closed`); clear();
  assert.equal(life().cases[caseId].status, 'EXAMINED'); assert(life().papers.every(p => p.location === 'TABLE')); assert.equal(life().device.location, 'TABLE'); assert.equal(life().mara.location, 'EXIT');
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => {
    appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false;
    if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value));
  };
  for (const [key, value] of Object.entries({ creation, seed, commands, prefixCount, stage, sourceFixture, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s);
  property('boundaryIndex', 'boundaries.index.json'); property('treatments', treatments); property('paidCraft', paidCraft);
  if (error) { property('pendingIntent', pendingIntent); property('error', String(error)); property('stack', error.stack ?? null); }
  appendFileSync(path, '}'); return path;
}
function save(stage) {
  const naturalPath = writeNatural(stage); write(`${outputDir}/boundaries.index.json`, boundaries);
  const summary = { stage, outputDir, prefixCount, commands: commands.length, prefixVerified, week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, injuryRisk: s.injuryRisk, injuries: s.injuries, random: s.random, treatments, paidCraft,
    bottles: s.wisdomAngel.bottles.map(b => ({ id: b.id, outcome: b.outcome, status: b.status })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), mastery: Object.fromEntries(NEW_IDS.map(id => [id, s.progression.mastery[id]])), encounter: s.wisdomAngel.encounter };
  write(`${outputDir}/summary.json`, summary);
  // Each full transition is one standalone file; no giant all-boundaries object.
  // Publishing is exclusive. Existing authoritative captures cannot be overwritten.
  const fixtureDir = 'tests/fixtures/wisdom-angel-v01700'; mkdirSync(fixtureDir, { recursive: true });
  for (const [source, target] of [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'], [`${outputDir}/boundaries.index.json`, 'boundaries.index.json'], ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...Object.values(boundaries).map(name => [`${outputDir}/${name}`, name])]) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries), summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount, 423); assert.equal(old.prefixCount, 329); assert.equal(seed, 'reader-natural-v023');
  const deathCommands = readObjectEntry('tests/fixtures/insight-scholar-v01460/natural.json', 'commands');
  const deathFinal = readObjectEntry('tests/fixtures/insight-scholar-v01460/natural.json', 'final');
  assert.equal(deathCommands.length, 425); assert.equal(deathFinal.status, 'DEAD'); assert.equal(deathFinal.health, 0);
  assert.deepEqual(old.commands.slice(0, 421), deathCommands.slice(0, 421), 'Living branch is original public choice before death, never resurrection');
  s = createSliceRun(old.final.runId, creation, seed); assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands); assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated original terminal must match without any repairs');
  assert.deepEqual(s.random, old.final.random); assert.equal(s.random.cursor, 173);
  assert.equal(s.week, 106); assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120); assert.equal(s.cash, 640); assert.equal(s.actionsRemaining, 1);
  assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100); assert.equal(s.insightScholar.promotionWeek, 99);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  recoverOriginalInjuries(); assertLegacyPreserved();
  ready({ cash: 500, ap: 2 }); snapshot('guidanceStart'); const guideCash = s.cash;
  wa({ type: 'LEARN_GUIDANCE' }, 'independent-guidance'); assert.equal(s.cash, guideCash - 500); clear();
  for (const taskId of ['VERIFY_SOURCE', 'STATE_CONDITIONS', 'CHECK_LIMITS']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.wisdomAngel.bottles.find(b => b.status === 'PLAYER') ?? s.wisdomAngel.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({ type: 'REQUEST_SUPPLY' }, 'paid-real-supply-request'); const requestedWeek = s.wisdomAngel.resupply.requestedWeek;
      ready({ afterWeek: requestedWeek }); wa({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-supply'); bottle = s.wisdomAngel.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'Independent source bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.wisdomAngel.bottles.find(b => b.id === bottleId).labourSteps < 5) action({ type: 'POTION_WORK', bottleId });
      ready({ cash: 920 }); const cash = s.cash; wa({ type: 'BUY_POTION', bottleId }, 'buy-independent-bottle'); assert.equal(s.cash, cash - 800);
    }
    ready({ cash: 120, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.insightScholar.promotionWeek + 11 });
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    wa({ type: 'PREPARE_PROMOTION' }, 'current-week-paid-preparation'); assert.equal(s.cash, prep.cash - 120); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind, pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk };
    wa({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'promotion' : 'actual-potion-failure');
    assert.equal(s.wisdomAngel.preparedWeek, null); assert.equal(s.wisdomAngel.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.spirituality, before.spirituality); assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const tier = s.wisdomAngel.bottles.find(b => b.id === bottleId).outcome;
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[tier]; assert(costs);
    assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], stat + (s.progression.sequence === 2 ? 1 : 0));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite independent bottles all failed; preserve the real costs without forced promotion');
  assert.equal(s.wisdomAngel.insightScholarActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const caseId of CASES) { action({ type: 'OBSERVE', caseId }); practice(caseId); action({ type: 'REPORT', caseId }, `${caseId}-report`); }
  action({ type: 'REFLECT' }, 'reflection'); assert.equal(s.progression.acting, 100); assertLegacyPreserved();
  for (const [index, key] of ['synthesis', 'response'].entries()) assert.equal(s.progression.mastery[NEW_IDS[index]], CASES.reduce((n, id) => n + (attempt(id)[key].effects > 0 ? 8 : 0), 0));
  assert.equal(life().device.charges, 0); assert.equal(life().device.demonstrations, 2); snapshot('practiced');
  // Real, once-per-week inherited production, with its original cost and draw.
  // Neither a failure nor success replaces the still-held original MM5-FLASH-3.
  ready({ cash: 160, ap: 2, spirituality: 4 });
  const craftBefore = { cash: s.cash, ap: s.actionsRemaining, spirituality: s.spirituality, week: s.week, cursor: s.random.cursor, count: s.mysticismMagister.crafts.length, kits: s.mysticismMagister.practice.kitsUsed, originalHeld: structuredClone(s.mysticismMagister.crafts.find(p => p.id === 'MM5-FLASH-3')) };
  wa({ type: 'MAKE_INHERITED_FLASH' }, 'actual-paid-inherited-craft');
  assert.equal(s.cash, craftBefore.cash - 160); assert.equal(s.actionsRemaining, craftBefore.ap - 1); assert.equal(s.spirituality, craftBefore.spirituality - 4);
  assert.equal(s.week, craftBefore.week); assert.equal(s.random.cursor, craftBefore.cursor + 1); assert.equal(s.mysticismMagister.practice.kitsUsed, craftBefore.kits + 1);
  assert.equal(s.mysticismMagister.craftAttemptWeek, craftBefore.week); assert.deepEqual(s.mysticismMagister.crafts.find(p => p.id === 'MM5-FLASH-3'), craftBefore.originalHeld);
  assert([craftBefore.count, craftBefore.count + 1].includes(s.mysticismMagister.crafts.length));
  paidCraft = { week: craftBefore.week, paidPennies: 160, paidSpirituality: 4, paidActions: 1, randomBefore: craftBefore.cursor, randomAfter: s.random.cursor, piece: s.mysticismMagister.crafts.length === craftBefore.count + 1 ? structuredClone(s.mysticismMagister.crafts.at(-1)) : null };
  assertLegacyPreserved(); clear();
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 }); assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  wa({ type: 'ENCOUNTER_TALK' }, 'original-enemy-approach'); wa({ type: 'ENCOUNTER_FIGHT' }, 'original-enemy-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'WISDOM_ANGEL_DISPUTE'); assert.equal(s.wisdomAngel.encounter.enemySpirituality, 120);
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, round === 0 ? 'combat-first' : `combat-round-${round + 1}`);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat, 'Combat has no extra mastery award');
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not terminated'); assert(s.wisdomAngel.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(s.wisdomAngel.encounter.playerLocation, 'OUTSIDE'); ordinary('ordinary-life-after-actual-exit'); }
  assertLegacyPreserved();
  assert.equal(readObjectEntry('tests/fixtures/insight-scholar-v01460/natural.json', 'final').status, 'DEAD');
  assert.deepEqual(readObjectEntry('tests/fixtures/insight-scholar-v01460/natural.json', 'commands'), deathCommands, 'Original425 death branch remains separate and unchanged');
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  const blocker = writeNatural('ACTUAL_BLOCKER', error); write(`${outputDir}/blocker.boundaries.index.json`, boundaries);
  console.error(JSON.stringify({ passed: false, outputDir, blocker, commandCount: commands.length, prefixVerified, error: String(error) })); throw error;
}

// Streaming top-level entry reader: skipped historical snapshot trees are never
// retained or parsed. StringDecoder preserves UTF-8 across 64KiB chunks.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START';
  let key = '', selected = false, quoted = false, escaped = false, depth = 0;
  let kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected a top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON object entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected a JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
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
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) {
            if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); }
            phase = 'AFTER'; selected = false; captureStart = -1;
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
