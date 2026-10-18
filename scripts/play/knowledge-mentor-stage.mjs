import assert from 'node:assert/strict';
import {appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// STATIC CANDIDATE: the author has not executed this file, imported a game
// module, built, tested, opened a database, or changed any product source.
// The lead may run from the repository root AFTER compiling integrated sources:
// node --max-old-space-size=512 scripts/play/knowledge-mentor-stage.mjs
// Every game transition is an exact public command. No reseed, state patch,
// failure reload, fabricated treatment, old-stage recharge or success search.
const moduleAt = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} = await moduleAt('index');
const {migrateSliceState} = await moduleAt('migration');
const {validateSlicePayload} = await moduleAt('validation');
const old = JSON.parse(readFileSync('tests/fixtures/arcane-scholar-v01430/natural.json', 'utf8'));
const {creation, seed} = old, prefixCount = old.commands.length;
const CASES = ['documented-cycle', 'consented-transfer', 'blocked-cycle'];
const OBJECTS = ['AL4-BOX-1', 'AL4-FRAME-1'];
const NEW_IDS = ['paragon.s2.protocol-binding', 'paragon.s2.bounded-calibration'];
const MAX_COMMANDS = 2000, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, boundaryManifest = [], snapshots = {};
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, recovery = null;
mkdirSync('output/play', {recursive: true});
// Distinct capture directory preserves an earlier failed run instead of erasing it.
const outputDir = mkdtempSync('output/play/knowledge-mentor-01670-');
const streams = Object.fromEntries(['commands','public','private'].map(kind => [kind, `${outputDir}/${kind}.jsonl`]));
for (const path of Object.values(streams)) writeFileSync(path, '', {flag: 'wx'});
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const write = (path, value) => writeFileSync(path, JSON.stringify(value));
const publicState = () => projectSliceState(s);
const view = () => publicState().knowledgeMentor;
const attempt = () => view().life.currentAttempt;
const original = id => s.alchemist.life.creations.find(o => o.id === id);
const successful = result => result && ['SUCCESS','GREAT_SUCCESS'].includes(result.tier);
function capture(key) {
  assert(prefixVerified, 'New-stage boundaries require verified complete historical replay');
  let unique = key, suffix = 2;
  while (Object.hasOwn(boundaries, unique)) unique = `${key}-${suffix++}`;
  const boundary = {beforeLast, lastIntent, final: structuredClone(s), public: publicState()};
  const path = `${outputDir}/${unique}-save-boundary.json`;
  write(path, boundary);
  // Only explicit milestones stay in memory/fixtures. Every transition is also
  // streamed to private/public JSONL after the verified prefix. Historical
  // private evidence stays in its original fixture rather than being duplicated.
  boundaries[unique] = boundary;
  boundaryManifest.push({key: unique, commandIndex: commands.length, revision: s.revision, path});
}
function snapshot(key) { snapshots[key] = structuredClone(s); }
function go(intent, key = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite command budget exhausted; preserve actual blocker');
  beforeLast = structuredClone(s); lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent);
  assertValidSliceState(next);
  assert.equal(next.random.seed, seed, 'No reseeding during historical replay or continuation');
  assert(next.random.cursor >= s.random.cursor, 'No random cursor rewind');
  s = next;
  commands.push(structuredClone(intent)); pendingIntent = null;
  const index = commands.length;
  append(streams.commands, {index, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision,
    randomBefore: beforeLast.random, randomAfter: s.random});
  if (prefixVerified) {
    append(streams.private, {index, final: s});
    append(streams.public, {index, public: publicState()});
  }
  if (key) capture(key);
  if (prefixVerified) console.log(JSON.stringify({index, command: intent, week: s.week,
    status: s.status, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash,
    AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting}));
}
function km(command, key = null) {
  // Reading enabled public actions does not run a check or consume randomness.
  const entry = view().actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  assert(entry, `Command is not projected: ${JSON.stringify(command)}`);
  assert(entry.enabled, `Public action blocked: ${entry.reason}`);
  go({type: 'KNOWLEDGE_MENTOR', command}, key);
}
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = publicState().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline'
      : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE'
      : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'PAY' : null;
    assert(choiceId, `Unexpected public event ${event.id}; preserve it for review`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Chosen option unavailable: ${event.id}/${choiceId}`);
    const pay = event.id === 'LIFE-CARE-01', cash = s.cash;
    go({type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId}, pay ? 'clinic-actual-pay60' : null);
    if (pay) assert.equal(s.cash, cash - 60, 'Only a real medical PAY event counts as treatment payment');
  }
  assert.equal(s.activeEvent, null, 'Pending event loop did not finish');
}
function ordinary(key = null) {
  clear();
  assert.equal(s.status, 'ACTIVE', 'No ordinary continuation or revival after actual death');
  assert(!view().insideCase && !s.combat, 'No work/rest through a locked preparation, case or encounter');
  go({type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK'}, key);
  clear();
}
function ready({cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1} = {}) {
  clear();
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind ||
    s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) ordinary();
}
function action(command, key = null) { ready(); km(command, key); clear(); }
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed);
  assert.equal(s.character.gender, old.final.character.gender);
  for (const key of ['savant','archaeologist','appraiser','artisan','astronomer','arcaneScholar'])
    assert.deepEqual(s[key], old.final[key], `Preserve original ${key} history, old consent, bottles and Corwin outcome`);
  const current = structuredClone(s.alchemist), prior = structuredClone(old.final.alchemist);
  assert.deepEqual(current.life.creations.map(o => o.id), prior.life.creations.map(o => o.id));
  for (const o of current.life.creations) {
    const before = prior.life.creations.find(x => x.id === o.id);
    // Only real resource/location changes of the same two original creations
    // are permitted; manufacture/source/owner identities and all other history stay.
    for (const key of ['charge','durability','location','active']) o[key] = before[key];
  }
  assert.deepEqual(current, prior, 'Keep dead Osric, drained gardens, returned Helena property and original manufacture');
}
function recoverOriginalLightWounds() {
  assert.equal(s.health, 80); assert.equal(s.injuryRisk, 1);
  assert.equal(s.injuries.length, 2);
  assert(s.injuries.every(i => i.severity === 'LIGHT'), 'This source has two LIGHT wounds, not the 0.166 heavy-wound branch');
  const originalWounds = structuredClone(s.injuries), cashBefore = s.cash;
  if (!s.careKnown) {
    assert(s.actionsRemaining >= 1);
    assert(publicState().investigateTargets.some(t => t.id === 'CARE-ACCESS-01'));
    go({type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01'}, 'clinic-discovery');
    clear();
  }
  assert.deepEqual(s.injuries, originalWounds, 'Clinic discovery neither heals nor upgrades light wounds');
  const inspected = publicState().recovery;
  assert.equal(inspected.lightCount, 2); assert.equal(inspected.untreatedHeavyCount, 0);
  assert.equal(inspected.stage, 'REST_TO_HEAL');
  const beforeRest = {health: s.health, injuries: structuredClone(s.injuries), cash: s.cash};
  go({type: 'ACTION', action: 'REST'}, 'original-light-wounds-actual-rest');
  clear();
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  assert(s.health >= 80);
  recovery = {kind: 'ORIGINAL_LIGHT_WOUNDS_REST', originalWounds, inspected, beforeRest,
    cashBefore, treatmentPaid: 0,
    explanation: 'Two actual LIGHT injuries resolve through existing later REST at H≥80. Clinic discovery is real and uncharged. No heavy-wound PAY event existed or was fabricated.'};
}
function recharge(id) {
  if (original(id).charge >= 3) return;
  ready({cash: 40, spirituality: 3});
  const before = structuredClone(original(id)), cash = s.cash, spirituality = s.spirituality;
  km({type: 'RECHARGE', objectId: id}, `paid-recharge-${id.toLowerCase()}`);
  assert.equal(original(id).charge, 3); assert.equal(original(id).durability, before.durability);
  const payment = s.knowledgeMentor.life.recharges.at(-1);
  assert.equal(payment.cashBefore, cash); assert.equal(payment.paidPennies, 40);
  assert(s.cash <= cash - 40, 'Preserve recharge cost plus any real week-end bill');
  assert.equal(s.spirituality, spirituality - 3);
  clear();
}
function practice(caseId) {
  for (const id of OBJECTS) recharge(id);
  ready({ap: 2, cash: 60, health: 90, mind: 85, spirituality: 20});
  const cmd = (type, key = null) => km({type, caseId}, key);
  const move = to => { if (attempt().ownerNode !== to) km({type: 'MOVE', caseId, to}); };
  km({type: 'PREPARE', caseId, method: 'ABILITY'});
  if (caseId === 'consented-transfer') {
    km({type: 'CONSENT', caseId, permission: 'PROGRAM'});
    km({type: 'CONSENT', caseId, permission: 'PARCEL'}, 'vera-current-consents');
  }
  cmd('PERFORM'); cmd('READ_RECORDS'); cmd('MEASURE_BASELINE'); cmd('MEASURE_BASELINE');
  cmd('BUY_PLATE'); cmd('BIND_PLATE', `${caseId}-binding-outcome`);
  assert.equal(attempt().paidPennies, 60); assert.equal(attempt().baselines.length, 2);
  if (successful(attempt().bindCheck)) cmd('INSTALL_PLATE');
  if (caseId === 'consented-transfer') { cmd('TAKE_PARCEL'); cmd('LOAD_PARCEL'); }
  if (caseId === 'blocked-cycle') cmd('PLACE_STOP_BAR');
  if (attempt().plate.status === 'INSTALLED') cmd('START_PROGRAM', `${caseId}-program-outcome`);
  // Use the single real attempt, then ordinary physical controls on failure.
  // No retried binding/start/calibration and no command chooses a check roll.
  while (attempt().completedSteps < 3) {
    const a = attempt();
    if (a.stopBar.loadRunning) {
      if (a.programActive && !a.calibrationCheck) cmd('CALIBRATE', 'blocked-cycle-calibration-outcome');
      if (attempt().stopBar.loadRunning || attempt().programActive) cmd('MANUAL_STOP', 'blocked-cycle-ordinary-stop');
      move('BENCH_START'); cmd('CLEAR_STOP_BAR');
      continue;
    }
    if (a.programActive) { move('BENCH_START'); cmd('PROGRAM_STEP'); }
    else { move(a.completedSteps === 2 ? 'BENCH_END' : 'BENCH_START'); cmd('MANUAL_STEP'); }
  }
  assert(!attempt().programActive && !attempt().stopBar.loadRunning);
  if (caseId === 'consented-transfer') {
    move('BENCH_END'); cmd('COLLECT_PARCEL'); move('BENCH_START');
    cmd('RETURN_PARCEL', 'vera-same-parcel-returned');
    assert.equal(attempt().parcel.id, 'KM2-VERA-PARCEL');
    assert.equal(attempt().parcel.holder, 'KM2-VERA');
  }
  move('BENCH_START'); cmd('RECYCLE_PLATE'); move('BENCH_END');
  cmd('RETURN_ORIGINALS'); cmd('VERIFY'); cmd('CLOSE', `${caseId}-closed`);
  clear();
  assert.equal(s.knowledgeMentor.life.cases[caseId].status, 'EXAMINED');
  assert(OBJECTS.every(id => original(id).location === 'PLAYER' && !original(id).active));
  assertLegacyPreserved();
}
function save(stage) {
  const summary = {stage, commands: commands.length, prefixCount, prefixVerified,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.knowledgeMentor.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: view().life.cases, encounter: s.knowledgeMentor.encounter, recovery, outputDir};
  const result = {creation, seed, runId: s.runId, commands, prefixCount, prefixVerified, stage,
    ...snapshots, beforeLast, lastIntent, final: s, public: publicState(), summary, streams, boundaryManifest};
  write(`${outputDir}/natural.json`, result);
  write(`${outputDir}/boundary-manifest.json`, boundaryManifest);
  write('output/play/knowledge-mentor-stage-natural.json', result);
  mkdirSync('tests/fixtures/knowledge-mentor-v01670', {recursive: true});
  write('tests/fixtures/knowledge-mentor-v01670/natural.json', result);
  write('tests/fixtures/knowledge-mentor-v01670/boundaries.json', boundaries);
  console.log(JSON.stringify({passed: true, ...summary, cases: summary.cases.map(c => ({id:c.id,result:c.result})),
    boundaries: Object.keys(boundaries)}));
}
try {
  assert.equal(prefixCount, 564, 'Replay all original S3 commands, never just a convenient living prefix');
  assert.equal(old.stage, 'FULL_NATURAL_BRANCH');
  s = createSliceRun(old.final.runId, creation, seed);
  assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands);
  assert.deepEqual(s, migrateSliceState(old.final), 'Full migrated final must match before continuation');
  assert.deepEqual(s.random, old.final.random, 'Migration/replay may not alter the inherited RNG state');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.week, 147); assert.equal(s.cash, 556);
  assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  append(streams.private, {index: prefixCount, final: s});
  append(streams.public, {index: prefixCount, public: publicState()});
  recoverOriginalLightWounds();
  ready({cash: 500, ap: 2}); snapshot('guidanceStart');
  const guideCash = s.cash;
  km({type: 'LEARN_GUIDANCE'}, 'guidance'); assert.equal(s.cash, guideCash - 500); clear();
  for (const taskId of ['INSPECT_RECORDS','CHECK_ORIGINALS','PLAN_WITHDRAWAL'])
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.knowledgeMentor.bottles.find(b => b.status === 'PLAYER') ?? s.knowledgeMentor.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-real-next-week-supply');
      const requestedWeek = s.knowledgeMentor.resupply.requestedWeek;
      ready({afterWeek: requestedWeek}); assert(s.week > requestedWeek);
      km({type: 'RECEIVE_SUPPLY'}, 'receive-real-next-week-supply');
      bottle = s.knowledgeMentor.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A separate real original bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.knowledgeMentor.bottles.find(b => b.id === bottleId).labourSteps < 5)
        action({type: 'POTION_WORK', bottleId});
      ready({cash: 920}); const cash = s.cash;
      km({type: 'BUY_POTION', bottleId}, 'buy-independent-five-work-bottle');
      assert.equal(s.cash, cash - 800);
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.arcaneScholar.promotionWeek + 11});
    const preparation = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    km({type: 'PREPARE_PROMOTION'}, 'paid-current-week-preparation');
    assert.equal(s.cash, preparation.cash - 120); assert.equal(s.actionsRemaining, preparation.ap - 1);
    assert.equal(s.week, preparation.week); assert.equal(s.knowledgeMentor.preparedWeek, s.week);
    const mastery = structuredClone(s.progression.mastery), spirituality = s.spirituality;
    const originals = structuredClone(s.alchemist.life.creations);
    km({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 2 ? 'promotion' : 'consume-failure');
    assert.equal(s.knowledgeMentor.preparedWeek, null);
    assert.equal(s.knowledgeMentor.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.spirituality, spirituality); assert.deepEqual(s.alchemist.life.creations, originals);
    for (const [id, value] of Object.entries(mastery)) assert.equal(s.progression.mastery[id], value);
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 2, 'Finite actual bottles all failed; retain costs and blocker, never force promotion');
  assert.equal(s.progression.acting, 0); assert.equal(s.knowledgeMentor.arcaneScholarActingAtPromotion, 100);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0);
  snapshot('promoted');
  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId}); practice(caseId);
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.knowledgeMentor.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection'); assert.equal(s.progression.acting, 100);
  snapshot('practiced');
  // Exactly three paid preparations, regardless of their natural outcomes.
  // Failed materials remain recycled; combat can proceed with zero READY plates.
  for (let n = 0; n < 3; n++) {
    ready({cash: 60, spirituality: 4});
    const cash = s.cash, spirituality = s.spirituality;
    km({type: 'PREPARE_COMBAT_PLATE'}, `combat-plate-attempt-${n + 1}`);
    const payment = s.knowledgeMentor.life.combatPlates.at(-1);
    assert.equal(payment.cashBefore, cash); assert.equal(payment.paidPennies, 60);
    assert(s.cash <= cash - 60, 'Preserve plate cost plus any real week-end bill');
    assert.equal(s.spirituality, spirituality - 4);
    assert.equal(s.knowledgeMentor.life.combatPlates.length, n + 1); clear();
  }
  for (const id of OBJECTS) recharge(id);
  ready({ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0});
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  km({type: 'ENCOUNTER_TALK'}, 'rowan-actual-entry');
  km({type: 'ENCOUNTER_FIGHT'}, 'combat-start'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'KNOWLEDGE_MENTOR_DISPUTE');
  assert.equal(s.knowledgeMentor.encounter.targetId, 'KM2-ROWAN-HALE');
  assert.equal(s.knowledgeMentor.encounter.enemySpirituality, 120);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Finite actual encounter has not reached its terminal outcome');
  assert(s.knowledgeMentor.encounter.terminal);
  assertLegacyPreserved();
  if (s.status === 'ACTIVE') {
    assert.equal(s.knowledgeMentor.encounter.exitTravelMetres, 4);
    assert.equal(s.knowledgeMentor.encounter.exitSeconds, 4);
    assert(OBJECTS.every(id => original(id).location === 'PLAYER' && !original(id).active));
    const ids = s.knowledgeMentor.encounter.carriedPlateIds;
    assert(s.knowledgeMentor.life.combatPlates.filter(p => ids.includes(p.id)).every(p => p.location === 'PLAYER'));
    ordinary('ordinary-life-after-actual-exit');
  } else {
    assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0);
    assert.equal(s.knowledgeMentor.encounter.terminal.outcome, 'PLAYER_DEAD');
    assert(OBJECTS.every(id => original(id).location === 'YARD' && !original(id).active));
    assert.equal(s.knowledgeMentor.encounter.exitTravelMetres, 0);
  }
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  const blocker = {creation, seed, commands, prefixCount, prefixVerified, ...snapshots,
    beforeLast, lastIntent, pendingIntent, final: s, public: s ? publicState() : null,
    recovery, streams, boundaryManifest, error: String(error), stack: error.stack};
  write(`${outputDir}/blocker.json`, blocker);
  write(`${outputDir}/boundary-manifest.json`, boundaryManifest);
  write('output/play/knowledge-mentor-stage-blocker.json', blocker);
  throw error;
}
