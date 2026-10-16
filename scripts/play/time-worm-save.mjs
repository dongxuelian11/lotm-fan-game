import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { fileEvidence, inspectSources, parseArguments } from './sage-save.mjs';

// Verify the genuine full551 living continuation, not the earlier451 peaceful
// state or the separate456 death. Aliases share a real transition and never add
// gameplay. Every writable DB/log lives in a newly created verification folder.
const PREFIX_COUNT = 551, PEACEFUL_COUNT = 451;
const SEED = 'marauder-natural-v038';
const SOURCE = 'tests/fixtures/fate-trojan-v01750/natural.json';
const PEACEFUL = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
const ORIGINAL_DEATH = 'tests/fixtures/deceit-mentor-v01510/natural.json';
const SOURCE_SHA = '4669ff84e79414608c873031a6a46fcfb11727c84eee5ef52a473e6685304c08';
const PEACEFUL_SHA = 'e8ee10feef684891b509016e10c135260835703f572e9c624168996f66cfc381';
const DEATH_SHA = 'eb720bdd47384fd4741ebf0afa3020d6b55263fb6ebb2c1f68a5e69468b85dda';
const PREFIX_SHA = 'fe805c7924a0b0009fff1b6cf49cbc8571555a60989271994c26ef162bb35dc2';
const RAW_FINAL_SHA = '5971e5ca7dea4e8296f33812953f243766690e8dc76acbc1980238958f5b3efc';
const ROOTS = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor', 'fateTrojan'];
const NEW_IDS = ['error.s1.short-time-theft', 'error.s1.time-release'];
const CASES = ['delayed-observation', 'released-interval', 'withdrawn-delay'];
const STAGES = ['SAME_SEED_FULL_PUBLIC_TIME_WORM', 'SAME_SEED_NATURAL_FINITE_POTION_FAILURES_ALIVE_S2', 'SAME_SEED_NATURAL_FINITE_ENCOUNTER_UNRESOLVED', 'SAME_SEED_NATURAL_ACTUAL_TERMINAL'];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting });
function compact(s) {
  const life = s.timeWorm.life, site = s.fateTrojan.life.site, encounter = s.timeWorm.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null,
    life: { activeCase: life.activeCase, clockSeconds: life.clockSeconds, elapsedSeconds: life.elapsedSeconds, pending: life.pending,
      playerLocation: site.playerLocation, playerEnergy: site.playerEnergy, playerTravelMetres: site.playerTravelMetres,
      lina: site.lina, victor: site.victor, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts.at(-1) : null },
    encounter: { status: encounter.status, scene: encounter.scene, terminal: encounter.terminal } };
}

async function loadRuntime() {
  const modules = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'), import('../../dist/domain/slice/migration.js'),
    import('../../dist/domain/slice/validation.js'), import('../../dist/domain/canonical.js'), import('../../dist/domain/time-worm/index.js'), import('../../dist/domain/time-worm/life.js'),
  ]);
  return Object.assign({}, ...modules);
}

function checkPublic(runtime, state, intent, proof) {
  assert(runtime.validateSlicePayload(intent), 'Strict intent payload');
  const view = runtime.projectSliceState(state);
  if (intent.type === 'TIME_WORM') {
    const control = view.timeWorm.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    assert(control?.enabled, control?.reason ?? `Missing offered Time Worm control: ${JSON.stringify(intent)}`);
    assert.deepEqual(proof.control, { kind: 'TIME_WORM', ...control });
  } else if (intent.type === 'ACTION') {
    assert(['WORK', 'REST'].includes(intent.action)); assert(view.canAct, view.actionBlockedReason);
    assert.deepEqual(proof.control, { kind: 'ACTION', action: intent.action, enabled: view.canAct, reason: view.actionBlockedReason });
  } else if (intent.type === 'EVENT_CHOICE') {
    assert.equal(state.activeEvent?.instanceId, intent.eventInstanceId);
    const control = view.activeEvent?.choices.find(row => row.id === intent.choiceId); assert(control?.enabled);
    assert.deepEqual(proof.control, { kind: 'EVENT_CHOICE', eventId: view.activeEvent.id, ...control });
  } else {
    assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, 'CONTROL');
    assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert(view.combat?.stances.some(row => row.id === intent.stance));
    assert.deepEqual(proof.control, { kind: 'COMBAT_ROUND', stance: intent.stance, enabled: true, round: state.combat.round });
  }
}

function checkOriginals(runtime, state, original) {
  for (const key of ROOTS) {
    const current = structuredClone(state[key]);
    if (key === 'fateTrojan') current.life.site = structuredClone(original.fateTrojan.life.site);
    assert.deepEqual(current, original[key], `Exact eight-root source history: ${key}`);
  }
  if (state.timeWorm.guidanceKnown) {
    assert.deepEqual(state.timeWorm.sourceHistory, Object.fromEntries(ROOTS.map(key => [key, original[key]])));
    assert(runtime.validateTimeWormSource(state));
    assert.deepEqual({ site: state.fateTrojan.life.site }, runtime.timeWormExpectedOriginals(state));
  } else assert.deepEqual(state.fateTrojan.life.site, original.fateTrojan.life.site);
  const site = structuredClone(state.fateTrojan.life.site), old = original.fateTrojan.life.site;
  for (const key of ['clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy']) site[key] = old[key];
  for (const who of ['lina', 'victor']) for (const key of ['location', 'travelMetres', 'energy']) site[who][key] = old[who][key];
  assert.deepEqual(site, old, 'Only journal-proven original movement, energy and clock may change; parcel, carry, recognition, seals and people stay original');
  assert.deepEqual(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of NEW_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(runtime.timeWormLifeMasteryGains(state))) mastery[id] += gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    assert(round.timeWormOutcome, 'No unrelated battle replaces this continuation');
    for (const action of [...round.timeWormOutcome.playerActions, ...round.timeWormOutcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8);
    }
  }
  assert.deepEqual(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: stats, ...originalIdentity } = original.character;
  assert.deepEqual(identity, originalIdentity);
  for (const [key, value] of Object.entries(stats)) assert.equal(coreStats[key], Math.min(500, value + (state.progression.sequence === 1 ? 1 : 0)));
  assert.equal(state.progression.promotionWeek, original.progression.promotionWeek);
  assert.equal(state.random.seed, SEED);
}

// Compare stored bytes, including rolling backup, timestamps, receipts and active
// run selection. A deserialized state equality alone cannot prove row rollback.
function storedRows(database) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    return {
      runs: db.prepare('SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id').all(),
      receipts: db.prepare('SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id').all(),
      meta: db.prepare('SELECT key,value FROM slice_meta ORDER BY key').all(),
    };
  } finally { db.close(); }
}

function checkSqlite(runtime, database, before, intent, after, intentId) {
  if (existsSync(database)) {
    assert(!existsSync(`${database}.sealed`), 'Never reset a sealed verification database');
    const db = new DatabaseSync(database);
    try { db.exec('BEGIN IMMEDIATE; DELETE FROM slice_receipts; DELETE FROM slice_runs; DELETE FROM slice_meta; COMMIT;'); }
    finally { db.close(); }
  }
  let app, inject = false, injectedAfterApply = 0;
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = runtime.projectSliceState(after);
  try {
    app = new runtime.SqliteSliceStore(database, { beforeWrite: () => {
      if (!inject) return;
      assert.deepEqual(app.repository.get(after.runId).state, after, 'Failure is injected after the complete actual intent was applied');
      const receipt = app.repository.receipt(intentId);
      assert(receipt); assert.equal(receipt.fingerprint, runtime.stableStringify(envelope));
      assert.deepEqual(receipt.receipt.state, expectedPublic); assert.equal(app.repository.activeRun(), before.runId);
      injectedAfterApply++;
      throw Error('injected boundary write failure after apply and receipt');
    } });
    app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' }); app.repository.selectRun(before.runId); });
    const originalRows = storedRows(database);
    inject = true;
    const rejected = app.submitIntent(envelope);
    assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED', JSON.stringify(rejected)); assert.equal(injectedAfterApply, 1);
    assert.deepEqual(app.repository.get(before.runId).state, before); assert.equal(app.repository.receipt(intentId), null);
    assert.deepEqual(storedRows(database), originalRows); assert.equal(existsSync(`${database}.sealed`), false);
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), originalRows); assert.deepEqual(app.repository.get(before.runId).state, before);
    assert.equal(app.repository.receipt(intentId), null); assert.equal(app.repository.activeRun(), before.runId);
    const committed = app.submitIntent(envelope);
    assert.equal(committed.ok, true, JSON.stringify(committed)); assert.equal(committed.value.replayed, false);
    assert.deepEqual(committed.value.state, expectedPublic); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(app.repository.receipt(intentId).receipt, committed.value);
    const committedRows = storedRows(database);
    assert.equal(committedRows.runs.length, 1); assert.equal(committedRows.receipts.length, 1);
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(runtime.projectSliceState(app.repository.get(after.runId).state), expectedPublic);
    assert.equal(app.repository.activeRun(), after.runId);
    const replay = app.submitIntent(envelope);
    assert.equal(replay.ok, true, JSON.stringify(replay)); assert.deepEqual(replay.value, { ...committed.value, replayed: true });
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(expectedPublic.canAct, false);
      const blocked = app.submitIntent({ intentId: `${intentId}:sealed`, runId: after.runId, expectedRevision: after.revision, payload: { type: 'ACTION', action: 'REST' } });
      assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(`${intentId}:sealed`), null);
      assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
      assert.deepEqual(json(`${database}.sealed`), [after.runId]);
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living result must never be reported as a sealed player death');
  } finally { app?.close(); }
}

function checkResume(runtime, source, summary, integrity, commands, pin) {
  const naturalPath = join(source.root, 'natural.json'), continuation = readObjectEntry(naturalPath, 'continuationSource');
  assert.deepEqual(summary.continuationSource, continuation); assert.deepEqual(integrity.continuationSource, continuation);
  const originalProducer = continuation?.originalProducerSha256 ?? integrity.producerSha256;
  for (const record of [summary, integrity]) { assert.equal(record.originalProducerSha256, originalProducer); assert.equal(record.finalProducerSha256, integrity.producerSha256); }
  assert.equal(readObjectEntry(naturalPath, 'originalProducerSha256'), originalProducer); assert.equal(readObjectEntry(naturalPath, 'finalProducerSha256'), integrity.producerSha256);
  if (continuation === null) { assert.equal(integrity.resumeVerificationSha256, null); return { continuation, members: [] }; }
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  assert.equal(continuation.kind, 'EXACT_639_PUBLIC_PREFLIGHT_PROJECTION_REPAIR_ONLY');
  assert.equal(continuation.sourceDirectory, 'output/play/time-worm-01970-Dxns4f');
  assert.equal(continuation.originalProducerSha256, '17bad40046874e8cc5d739a1e1a2508c42968a44cf8d55e55bc7622aad4eacea');
  assert.equal(continuation.originalFailureSha256, '125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd');
  assert.equal(continuation.originalIntegritySha256, '769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc');
  assert.equal(continuation.originalFinalSha256, 'a6204310e886e0b400b4daced33d73bfe0debbce1929a333cc37792b7737e21d');
  assert.equal(continuation.restoredFinalSha256, continuation.originalFinalSha256); assert.equal(continuation.finalProducerSha256, integrity.producerSha256);
  assert.equal(continuation.originalCommandCount, 639); assert.equal(continuation.restoredCommandCount, 639); assert.equal(continuation.sourcePrefixCount, PREFIX_COUNT);
  assert.equal(continuation.fullStateUnchanged, true); assert.equal(continuation.replayedPriorCommands, 0); assert.equal(continuation.newRandomChanges, false);
  assert.equal(continuation.exactCommandLedgerThrough639, true); assert.equal(continuation.exactPublicLedgerThrough639, true);
  const wait = { type: 'TIME_WORM', command: { type: 'WAIT_1' } };
  assert.deepEqual(continuation.pendingIntent, wait); assert.deepEqual(continuation.originalStateRandom, { seed: SEED, cursor: 366 });
  assert.match(integrity.resumeVerificationSha256, /^[0-9a-f]{64}$/);
  pin(join(source.root, 'resume-verification.json'), integrity.resumeVerificationSha256);
  assert.deepEqual(json(join(source.root, 'resume-verification.json')), continuation);
  const preserved = ['natural.json', 'capture-integrity.json', 'summary.json', 'commands.jsonl', 'public.jsonl', 'source-prefix.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json'];
  const members = ['resume-verification.json', ...preserved.map(name => `prior-blocker-${name}`)];
  assert.deepEqual(Object.keys(continuation.preservedFiles).sort(), members.slice(1).sort());
  for (const [name, sha] of Object.entries(continuation.preservedFiles)) { assert.match(sha, /^[0-9a-f]{64}$/); pin(join(source.root, name), sha); }
  const priorPath = join(source.root, 'prior-blocker-natural.json'), priorIntegrity = json(join(source.root, 'prior-blocker-capture-integrity.json'));
  assert.equal(continuation.preservedFiles['prior-blocker-natural.json'], continuation.originalFailureSha256);
  assert.equal(continuation.preservedFiles['prior-blocker-capture-integrity.json'], continuation.originalIntegritySha256);
  assert.equal(priorIntegrity.naturalSha256, continuation.originalFailureSha256); assert.equal(priorIntegrity.producerSha256, originalProducer);
  const metadataHashes = { 'summary.json': 'summarySha256', 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256', 'source-prefix.json': 'sourcePrefixSha256', 'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256' };
  for (const [name, field] of Object.entries(metadataHashes)) assert.equal(continuation.preservedFiles[`prior-blocker-${name}`], priorIntegrity[field]);
  assert.equal(readObjectEntry(priorPath, 'stage'), 'ACTUAL_BLOCKER'); assert.equal(readObjectEntry(priorPath, 'failurePhase'), 'PUBLIC_PREFLIGHT');
  assert.equal(readObjectEntry(priorPath, 'producerSha256'), originalProducer); assert.deepEqual(readObjectEntry(priorPath, 'pendingIntent'), wait);
  assert.deepEqual(readObjectEntry(priorPath, 'lastIntent'), { type: 'TIME_WORM', command: { type: 'WITHDRAW_CONSENT', permission: 'ABILITY' } });
  assert.deepEqual(readObjectEntry(priorPath, 'commands'), commands.slice(0, 639)); assert.deepEqual(commands[639], wait);
  for (const key of ['initial', 'prefixFinal', 'strategy', 'creation', 'seed', 'provenance', 'continuation']) assert.deepEqual(readObjectEntry(naturalPath, key), readObjectEntry(priorPath, key), `Exact pre-repair ${key}`);
  const priorFinal = readObjectEntry(priorPath, 'final'); assert.equal(hash(priorFinal), continuation.originalFinalSha256);
  assert.equal(priorFinal.revision, 640); assert.equal(priorFinal.status, 'ACTIVE'); assert.equal(priorFinal.week, 143); assert.equal(priorFinal.actionsRemaining, 0);
  assert.deepEqual(priorFinal.random, continuation.originalStateRandom); assert.equal(priorFinal.timeWorm.life.clockSeconds, 888); assert.equal(priorFinal.timeWorm.life.pending, null);
  const attempt = priorFinal.timeWorm.life.cases['withdrawn-delay'].attempts.at(-1);
  assert.deepEqual(attempt.permission, { owner: 'GRANTED', observer: 'GRANTED', ability: 'WITHDRAWN' });
  assert.equal(attempt.declaration.state, 'DELAYED'); assert.equal(attempt.declaration.dueAt, 890); assert.equal(attempt.declaration.delayedSeconds, 1);
  assert.equal(integrity.sourcePrefixSha256, priorIntegrity.sourcePrefixSha256);
  for (const [name, count, bytesField, hashField, integrityField] of [
    ['commands.jsonl', 639, 'commandsPrefixBytes', 'commandsPrefixSha256', 'commandsSha256'],
    ['public.jsonl', 88, 'publicPrefixBytes', 'publicPrefixSha256', 'publicSha256'],
  ]) {
    const prior = join(source.root, `prior-blocker-${name}`), evidence = fileEvidence(prior);
    assert.equal(continuation[bytesField], evidence.bytes); assert.equal(continuation[hashField], priorIntegrity[integrityField]);
    assert.equal(filePrefixHash(join(source.root, name), evidence.bytes), evidence.sha256, `Exact original ${name} prefix bytes`);
    let rows = 0; for (const row of readJsonLines(prior)) { rows++; assert.equal(row.step, name === 'commands.jsonl' ? rows : PREFIX_COUNT + rows); }
    assert.equal(rows, count);
  }
  const priorIndex = json(join(source.root, 'prior-blocker-boundaries.index.json')), priorSteps = json(join(source.root, 'prior-blocker-boundaries.steps.json'));
  const priorTransitions = json(join(source.root, 'prior-blocker-transitions.json')), transitions = json(join(source.root, 'transitions.json'));
  const currentIndex = Object.fromEntries(source.entries.map(row => [row.name, row.filename])), steps = json(join(source.root, 'boundaries.steps.json'));
  assert.deepEqual(Object.keys(priorIndex), Object.keys(priorSteps)); assert.deepEqual(Object.keys(currentIndex).slice(0, Object.keys(priorIndex).length), Object.keys(priorIndex));
  for (const [name, filename] of Object.entries(priorIndex)) { assert.equal(currentIndex[name], filename); assert.equal(steps[name], priorSteps[name]); }
  assert.equal(priorTransitions.length, 639 - PREFIX_COUNT + 1); assert.deepEqual(transitions.slice(0, priorTransitions.length), priorTransitions);
  const priorSnapshots = readObjectEntry(priorPath, 'snapshots');
  assert.deepEqual(Object.keys(priorIntegrity.files).sort(), [...new Set([...Object.values(priorIndex), ...Object.values(priorSnapshots)])].sort());
  for (const [name, filename] of Object.entries(priorSnapshots)) assert.equal(summary.snapshots[name], filename);
  for (const [filename, sha] of Object.entries(priorIntegrity.files)) assert.equal(integrity.files[filename], sha, `Preserve the complete original capture member: ${filename}`);
  const lastPrior = join(source.root, priorTransitions.at(-1).file);
  assert.deepEqual(readObjectEntry(lastPrior, 'final'), priorFinal); assert.deepEqual(readObjectEntry(lastPrior, 'beforeLast'), readObjectEntry(priorPath, 'beforeLast'));
  const resumed = transitions[priorTransitions.length]; assert.equal(resumed.commandIndex, 640);
  const firstPath = join(source.root, resumed.file); assert.deepEqual(readObjectEntry(firstPath, 'beforeLast'), priorFinal, 'Resume exact639 final without replay or any state patch');
  assert.deepEqual(readObjectEntry(firstPath, 'lastIntent'), wait);
  const firstFinal = readObjectEntry(firstPath, 'final'); assert.deepEqual(firstFinal.random, priorFinal.random); assert.equal(firstFinal.timeWorm.life.clockSeconds, 889);
  return { continuation, members };
}

async function verify(options) {
  assert.equal(options.key, 'boundaries'); assert.equal(options.start, 0);
  assert(options.expectedBoundaries !== undefined, 'Supply the exact observed named --expected-boundaries count; it is never guessed');
  const source = inspectSources(options), naturalPath = join(source.root, 'natural.json');
  const summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
  assert.equal(source.count, source.entries.length, 'No partial verification');
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER is preserved evidence, not a completed save verification');
  const immutable = new Map();
  const pin = (path, sha) => { const evidence = fileEvidence(path); if (sha) assert.equal(evidence.sha256, sha, path); immutable.set(path, evidence); return evidence; };
  pin(SOURCE, SOURCE_SHA); pin(PEACEFUL, PEACEFUL_SHA); pin(ORIGINAL_DEATH, DEATH_SHA);
  assert.match(integrity.producerSha256, /^[0-9a-f]{64}$/);
  pin(fileURLToPath(new URL('./time-worm-stage.mjs', import.meta.url)), integrity.producerSha256);
  const metadataFiles = { 'natural.json': 'naturalSha256', 'summary.json': 'summarySha256', 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256', 'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256', 'source-prefix.json': 'sourcePrefixSha256' };
  for (const [name, field] of Object.entries(metadataFiles)) { assert.match(integrity[field], /^[0-9a-f]{64}$/, `Missing integrity hash: ${field}`); pin(join(source.root, name), integrity[field]); }
  pin(join(source.root, 'capture-integrity.json'));
  assert.deepEqual(readObjectEntry(naturalPath, 'snapshots'), summary.snapshots);
  const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
  assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles, 'Every boundary and snapshot member is hashed exactly once');
  for (const name of expectedFiles) {
    assert.equal(name, basename(name)); assert.match(integrity.files[name], /^[0-9a-f]{64}$/);
    const path = realpathSync(join(source.root, name)); assert.equal(path, join(source.root, name), 'Capture members cannot be external symlinks'); pin(path, integrity.files[name]);
  }
  assert.deepEqual(source.entries.map(row => row.name), summary.boundaries);
  const steps = json(join(source.root, 'boundaries.steps.json')), transitions = json(join(source.root, 'transitions.json'));
  assert.deepEqual(Object.keys(steps), summary.boundaries); assert(Array.isArray(transitions));
  const commands = readObjectEntry(naturalPath, 'commands'), prefix = readObjectEntry(SOURCE, 'commands');
  assert.equal(prefix.length, PREFIX_COUNT); assert.equal(compactHash(prefix), PREFIX_SHA);
  assert.deepEqual(commands.slice(0, PREFIX_COUNT), prefix); assert.equal(commands.length, summary.commands); assert(commands.length >= PREFIX_COUNT && commands.length < 3500);
  const prefixPath = join(source.root, 'source-prefix.json');
  assert.deepEqual(readObjectEntry(prefixPath, 'commands'), prefix);
  assert.deepEqual(prefix.slice(0, PEACEFUL_COUNT), readObjectEntry(PEACEFUL, 'commands'));
  const provenance = readObjectEntry(naturalPath, 'provenance');
  assert.equal(provenance.kind, 'SAME_SEED_EXACT551_PUBLIC_PREFIX_THEN_PUBLIC_TIME_WORM');
  assert.equal(provenance.inheritedDirectedPrefix, false); assert.equal(provenance.newRandomChanges, false); assert.equal(provenance.original456CommandDeathPreserved, true);
  assert.equal(provenance.source, SOURCE); assert.equal(provenance.sourceRoot, 'final'); assert.equal(provenance.sourceSha256, SOURCE_SHA);
  assert.equal(provenance.peacefulSource, PEACEFUL); assert.equal(provenance.peacefulSha256, PEACEFUL_SHA);
  assert.equal(provenance.originalDeathSource, ORIGINAL_DEATH); assert.equal(provenance.originalDeathSha256, DEATH_SHA);
  assert.deepEqual(provenance.prior, readObjectEntry(SOURCE, 'provenance')); assert.deepEqual(provenance.priorContinuation, readObjectEntry(SOURCE, 'continuation'));
  assert.deepEqual(readObjectEntry(naturalPath, 'continuation'), { kind: 'EXACT_551_PUBLIC_LIVING_PREFIX_THEN_PUBLIC_TIME_WORM', sourceFixture: SOURCE, sourceRoot: 'final', originalDeathFixture: ORIGINAL_DEATH, newRandomChanges: false });
  assert.equal(readObjectEntry(naturalPath, 'producerSha256'), integrity.producerSha256);
  assert.equal(readObjectEntry(naturalPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(naturalPath, 'inheritedPrefixCount'), PEACEFUL_COUNT);
  assert.equal(readObjectEntry(naturalPath, 'prefixVerified'), true); assert.equal(readObjectEntry(naturalPath, 'seed'), SEED);
  assert.deepEqual(readObjectEntry(naturalPath, 'creation'), readObjectEntry(SOURCE, 'creation'));
  assert.deepEqual(readObjectEntry(naturalPath, 'creation'), readObjectEntry(PEACEFUL, 'creation'));
  assert.equal(readObjectEntry(naturalPath, 'stage'), summary.stage); assert.equal(readObjectEntry(naturalPath, 'pendingIntent'), null);
  const naturalError = readObjectEntry(naturalPath, 'error');
  if (summary.stage === STAGES[2]) assert.equal(typeof naturalError, 'string'); else assert.equal(naturalError, null);
  assert.equal(readObjectEntry(naturalPath, 'failurePhase'), 'IDLE'); assert.deepEqual(readObjectEntry(naturalPath, 'strategy'), summary.strategy);
  assert.equal(summary.producerSha256, integrity.producerSha256);
  assert.equal(summary.source.prefixCount, PREFIX_COUNT); assert.equal(summary.source.prefixVerified, true);
  assert.equal(summary.source.sourceSha256, SOURCE_SHA); assert.equal(summary.source.peacefulSha256, PEACEFUL_SHA); assert.equal(summary.source.originalDeathSha256, DEATH_SHA);
  assert.equal(summary.source.prefixCompactSha256, PREFIX_SHA); assert.equal(summary.source.rawFinalCompactSha256, RAW_FINAL_SHA);

  const runtime = await loadRuntime(), rawSource = readObjectEntry(SOURCE, 'final');
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  // Historical raw172 identity is independent of the compiled current version.
  assert.equal(rawSource.schemaVersion, 172); assert.equal(rawSource.contentVersion, 'fate-trojan-v172'); assert.equal(compactHash(rawSource), RAW_FINAL_SHA);
  const original = runtime.migrateSliceState(rawSource);
  const CURRENT_SCHEMA_VERSION = original.schemaVersion, CURRENT_CONTENT_VERSION = original.contentVersion;
  const migrate = raw => { const state = runtime.migrateSliceState(raw); assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION); assert.equal(state.contentVersion, CURRENT_CONTENT_VERSION); runtime.assertValidSliceState(state); return state; };
  const initial = migrate(readObjectEntry(naturalPath, 'initial'));
  assert.deepEqual(initial, migrate(readObjectEntry(SOURCE, 'initial')));
  let capturedPrefixHash;
  {
    const capturedPrefix = readObjectEntry(naturalPath, 'prefixFinal');
    assert.equal(capturedPrefix.schemaVersion, 194); assert.equal(capturedPrefix.contentVersion, 'time-worm-v194');
    capturedPrefixHash = hash(capturedPrefix); assert.deepEqual(migrate(capturedPrefix), original);
  }
  assert.equal(initial.random.seed, SEED); assert.equal(initial.random.cursor, 0);
  assert.equal(original.revision, 552); assert.equal(original.status, 'ACTIVE'); assert.equal(original.week, 127);
  assert.deepEqual(original.random, { seed: SEED, cursor: 361 });
  assert.deepEqual([original.health, original.mind, original.spirituality, original.cash, original.actionsRemaining, original.injuryRisk], [40, 100, 90, 472, 3, 2]);
  assert.deepEqual(original.injuries.map(row => row.severity), ['LIGHT', 'LIGHT', 'HEAVY']); assert(original.injuries.every(row => row.treatedRevision === null));
  assert.equal(Object.keys(original.progression.mastery).length, 14);
  assert.deepEqual(Object.entries(original.progression.mastery).filter(([, value]) => value === 0).map(([id]) => id), ['error.s5.thought-theft']);
  const peaceful = migrate(readObjectEntry(PEACEFUL, 'final'));
  for (const key of ROOTS.slice(0, -1)) assert.deepEqual(original[key], peaceful[key], `Immutable earlier451 history: ${key}`);
  // These hashes describe the recorded194 migration, never a future runtime's
  // newly appended defaults. Current private equality is checked after migration.
  assert.equal(readObjectEntry(prefixPath, 'migratedWholeStateSha256'), capturedPrefixHash);
  assert.equal(readObjectEntry(prefixPath, 'rawFinalCompactSha256'), RAW_FINAL_SHA); assert.equal(readObjectEntry(prefixPath, 'compactCommandsSha256'), PREFIX_SHA);
  assert.equal(summary.source.migratedWholeSourceSha256, capturedPrefixHash); assert.deepEqual(summary.originalMastery, original.progression.mastery);
  assert.deepEqual(readObjectEntry(prefixPath, 'initial'), readObjectEntry(SOURCE, 'initial')); assert.deepEqual(readObjectEntry(prefixPath, 'rawFinal'), rawSource);
  assert.equal(readObjectEntry(prefixPath, 'commandCount'), PREFIX_COUNT); assert.equal(readObjectEntry(prefixPath, 'rawSourceRoot'), 'final');
  assert.equal(readObjectEntry(prefixPath, 'sourceSha256'), SOURCE_SHA); assert.equal(readObjectEntry(prefixPath, 'peacefulSha256'), PEACEFUL_SHA); assert.equal(readObjectEntry(prefixPath, 'originalDeathSha256'), DEATH_SHA);
  assert.equal(readObjectEntry(prefixPath, 'inheritedDirectedPrefix'), false); assert.equal(readObjectEntry(prefixPath, 'original456CommandDeathPreserved'), true);
  const resumed = checkResume(runtime, source, summary, integrity, commands, pin);
  const expectedMembers = [...Object.keys(metadataFiles), 'capture-integrity.json', ...expectedFiles, ...resumed.members].sort();
  assert.deepEqual(readdirSync(source.root).sort(), expectedMembers, 'No unaccounted capture members, including exact preserved blocker evidence');

  let ledgerCount = 0, ledgerTail = null, sourceRow = null;
  for (const row of readJsonLines(join(source.root, 'commands.jsonl'))) {
    assert.equal(row.step, ++ledgerCount); assert.deepEqual(row.intent, commands[ledgerCount - 1]); assert.equal(row.sourcePrefix, ledgerCount <= PREFIX_COUNT);
    assert.equal(row.after.revision, row.before.revision + 1); assert.equal(row.before.random.seed, SEED); assert.equal(row.after.random.seed, SEED); assert(row.after.random.cursor >= row.before.random.cursor);
    if (ledgerTail) assert.deepEqual(row.before, ledgerTail); else assert.deepEqual(row.before, body(initial));
    ledgerTail = row.after; if (ledgerCount === PREFIX_COUNT) sourceRow = row;
  }
  assert.equal(ledgerCount, commands.length); assert.deepEqual(sourceRow.after, body(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1, 'Every actual continuation transition plus source551 is captured once');
  assert.equal(summary.uniqueTransitions, transitions.length);
  const byStep = new Map(), byName = new Map(source.entries.map(row => [row.name, row]));
  for (const [index, transition] of transitions.entries()) {
    assert.deepEqual(Object.keys(transition).sort(), ['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
    const step = PREFIX_COUNT + index; assert.equal(transition.commandIndex, step);
    const entry = byName.get(transition.key); assert(entry); assert.equal(transition.file, entry.filename); assert.equal(steps[transition.key], step);
    assert.equal(transition.beforeRevision, initial.revision + step - 1); assert.equal(transition.afterRevision, initial.revision + step); byStep.set(step, transition);
  }
  const named = [], firstNames = new Map();
  for (const entry of source.entries) {
    const step = steps[entry.name], transition = byStep.get(step); assert(transition, `Unknown transition for alias ${entry.name}`);
    assert.equal(entry.filename, transition.file, 'Aliases point at the exact same captured file, never a second outcome');
    assert.equal(immutable.get(entry.path).sha256, integrity.files[transition.file]);
    const aliasOf = firstNames.get(step) ?? null;
    if (aliasOf === null) { assert.equal(entry.name, transition.key); firstNames.set(step, entry.name); }
    named.push({ name: entry.name, source: entry.filename, step, aliasOf, sourceSha256: immutable.get(entry.path).sha256 });
  }
  assert.equal(firstNames.size, transitions.length);

  const outputPath = resolve(options.outputDirectory); let ancestor = outputPath;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const intendedOutput = resolve(realpathSync(ancestor), relative(ancestor, outputPath)), inside = relative(source.root, intendedOutput);
  assert(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside), 'Writable verification output must be outside immutable capture directory');
  mkdirSync(outputPath, { recursive: true });
  const outputRoot = realpathSync(outputPath); assert.equal(outputRoot, intendedOutput);
  const outputDir = mkdtempSync(join(outputRoot, `boundaries-${options.tag}-`)), commonDatabase = join(outputDir, 'verification.sqlite');
  const checks = [], publicRows = readJsonLines(join(source.root, 'public.jsonl')), ledger = readJsonLines(join(source.root, 'commands.jsonl'));
  let commandRow, current = null, previousFinalHash = null;
  for (let i = 0; i < PREFIX_COUNT; i++) commandRow = ledger.next().value;
  try {
    for (const [index, transition] of transitions.entries()) {
      current = transition.key; const step = transition.commandIndex, path = join(source.root, transition.file);
      assert.equal(readObjectEntry(path, 'commandCount'), step);
      const rawBefore = readObjectEntry(path, 'beforeLast'), rawAfter = readObjectEntry(path, 'final');
      // Raw capture194 evidence stays raw; migrations may advance beyond194 later.
      assert.equal(rawAfter.schemaVersion, 194); assert.equal(rawAfter.contentVersion, 'time-worm-v194');
      assert.equal(rawBefore.schemaVersion, 194); assert.equal(rawBefore.contentVersion, 'time-worm-v194');
      const before = migrate(rawBefore), after = migrate(rawAfter), intent = readObjectEntry(path, 'lastIntent');
      assert.equal(before.status, 'ACTIVE'); assert.equal(after.runId, before.runId); assert.equal(after.revision, before.revision + 1);
      assert.equal(before.revision, transition.beforeRevision); assert.equal(after.revision, transition.afterRevision);
      if (index > 0) commandRow = ledger.next().value;
      assert(commandRow); assert.equal(commandRow.step, step); assert.deepEqual(intent, commands[step - 1]);
      assert.deepEqual(body(before), commandRow.before); assert.deepEqual(body(after), commandRow.after);
      if (previousFinalHash) assert.equal(hash(before), previousFinalHash, 'Every complete state is the exact preceding final');
      else { assert.deepEqual(before, migrate(readObjectEntry(SOURCE, 'beforeLast'))); assert.deepEqual(after, original); }
      if (step > PREFIX_COUNT) {
        const proof = publicRows.next().value; assert(proof); assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent);
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.randomAfter, after.random);
        assert.deepEqual(proof.before, compact(before)); assert.deepEqual(proof.after, compact(after));
        checkPublic(runtime, before, intent, proof); checkOriginals(runtime, before, original);
      }
      checkOriginals(runtime, after, original);
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      checkSqlite(runtime, database, before, intent, after, `time-worm197:${step}`);
      const row = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file], finalSha256: hash(after), status: after.status, revision: after.revision, database: relative(outputDir, database), checks: ['after-apply-rollback-no-receipt', 'original-rows-unchanged', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'same-intent-idempotent', ...(after.status === 'DEAD' ? ['sealed-reopen-no-further-action'] : ['living-no-terminal-sidecar'])] };
      checks.push(row); previousFinalHash = row.finalSha256; console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(publicRows.next().done, true);
    const final = migrate(readObjectEntry(naturalPath, 'final'));
    assert.equal(hash(final), previousFinalHash); assert.deepEqual(body(final), summary.final); assert.deepEqual(body(final), ledgerTail);
    assert.deepEqual(summary.mastery, final.progression.mastery); assert.deepEqual(summary.sourceOriginals, { site: original.fateTrojan.life.site });
    assert.deepEqual(summary.currentOriginals, { site: final.fateTrojan.life.site }); assert.deepEqual(readObjectEntry(naturalPath, 'withdrawalEvidence'), summary.withdrawalEvidence);
    const last = transitions.at(-1), lastPath = join(source.root, last.file);
    assert.deepEqual(migrate(readObjectEntry(naturalPath, 'beforeLast')), migrate(readObjectEntry(lastPath, 'beforeLast')));
    assert.deepEqual(readObjectEntry(naturalPath, 'lastIntent'), commands.at(-1));
    if (summary.stage === STAGES[0]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 1); assert.equal(final.progression.acting, 100);
      for (const id of CASES) assert.equal(final.timeWorm.life.cases[id].status, 'RESOLVED');
      assert.equal(final.timeWorm.life.reflected, true); assert.equal(final.timeWorm.life.pending, null); assert.equal(final.timeWorm.life.playerLocation, 'OUTSIDE');
      assert.equal(final.fateTrojan.life.site.playerLocation, 'OUTSIDE');
      for (const who of ['lina', 'victor']) assert.equal(final.fateTrojan.life.site[who].location, 'OUTSIDE');
      assert.equal(final.combat, null); assert.equal(final.timeWorm.encounter.terminal.exitMetres, 4); assert.equal(final.timeWorm.encounter.terminal.exitSeconds, 4);
      assert(summary.boundaries.includes('actual-paid-work-after-living-four-metre-exit'));
    } else if (summary.stage === STAGES[1]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
      const consumed = final.timeWorm.bottles.filter(row => row.status === 'CONSUMED'); assert.equal(consumed.length, summary.strategy.potionAttemptCap);
      assert(consumed.every(row => ['FAILURE', 'GREAT_FAILURE'].includes(row.outcome)));
    } else if (summary.stage === STAGES[2]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.timeWorm.encounter.status, 'FIGHTING'); assert.equal(final.timeWorm.encounter.terminal, null); assert(final.combat);
      assert.equal(summary.rounds.length, summary.strategy.combatRoundCap); assert(summary.rounds.every(row => row.stance === 'CONTROL'));
    } else {
      assert.equal(final.status, 'DEAD'); assert.equal(final.health, 0); assert.equal(checks.at(-1).status, 'DEAD');
      // An actual later ordinary death may retain an earlier living combat exit.
      // Never relabel that preserved encounter result as a combat death.
      if (final.timeWorm.encounter.terminal?.outcome === 'PLAYER_DEAD') { assert.equal(final.timeWorm.encounter.terminal.exitMetres, 0); assert.equal(final.timeWorm.encounter.terminal.exitSeconds, 0); }
    }

    // The original456 death is an independent immutable branch, never this
    // continuation's endpoint and never a DB reused for a later living state.
    const oldCommands = readObjectEntry(ORIGINAL_DEATH, 'commands'); assert.equal(oldCommands.length, 456); assert.deepEqual(oldCommands.slice(0, 449), prefix.slice(0, 449));
    assert.deepEqual(prefix.slice(449, 451), [{ type: 'DECEIT_MENTOR', command: { type: 'LEAVE_ENCOUNTER' } }, { type: 'ACTION', action: 'WORK' }]);
    assert.deepEqual(oldCommands.slice(449, 451), [{ type: 'DECEIT_MENTOR', command: { type: 'ENCOUNTER_FIGHT' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }]);
    const rawDeath = readObjectEntry(ORIGINAL_DEATH, 'final'); assert.equal(rawDeath.schemaVersion, 149); assert.equal(rawDeath.contentVersion, 'deceit-mentor-v149');
    const oldBefore = migrate(readObjectEntry(ORIGINAL_DEATH, 'beforeLast')), oldIntent = readObjectEntry(ORIGINAL_DEATH, 'lastIntent'), oldFinal = migrate(rawDeath);
    assert.deepEqual(oldIntent, oldCommands.at(-1)); assert.equal(oldFinal.status, 'DEAD'); assert.equal(oldFinal.health, 0); assert.equal(oldFinal.revision, 457); assert.equal(oldFinal.week, 108); assert.deepEqual(oldFinal.random, { seed: SEED, cursor: 319 });
    const oldDatabase = join(outputDir, 'original456-sealed-death.sqlite'); checkSqlite(runtime, oldDatabase, oldBefore, oldIntent, oldFinal, 'time-worm197:original456');
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Source remains immutable: ${path}`);
    assert.deepEqual(readdirSync(source.root).sort(), expectedMembers);
    const result = { passed: true, stage: summary.stage, sourceDirectory: source.root, outputDir, continuationSource: resumed.continuation, currentSchemaVersion: CURRENT_SCHEMA_VERSION, currentContentVersion: CURRENT_CONTENT_VERSION, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: named.filter(row => row.aliasOf !== null).length, naturalPlayerDeaths: checks.filter(row => row.status === 'DEAD').length, original456DeathSeparatelySealed: true, named, checks };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: result.stage, allNamedCaptures: result.allNamedCaptures, uniqueTransitions: result.uniqueTransitions, aliases: result.aliases, naturalPlayerDeaths: result.naturalPlayerDeaths, original456DeathSeparatelySealed: true, outputDir }));
    return result;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, uniqueVerified: checks.length, error: String(error), named, checks }, null, 2), { flag: 'wx' }); throw error;
  } finally { ledger.return?.(); publicRows.return?.(); }
}

try {
  const args = process.argv.slice(2);
  if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/time-worm-v01970');
  if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0197/sqlite');
  const options = parseArguments(args);
  if (options.help) console.log('Usage: node scripts/play/time-worm-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nChecks the exact observed full named capture set and every unique real SQLite transition, plus the separate original456 sealed death.');
  else await verify(options);
} catch (error) { console.error(error); process.exitCode = 1; }

// Same bounded streaming reader used by the preceding save verification and
// tests/helpers/read-object-entry.ts. Never parse a whole natural/boundary file.
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

function* readJsonLines(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let pending = '';
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null); pending += n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        assert(line.length > 0, `Blank ledger row: ${path}`); yield JSON.parse(line);
      }
      if (!n) { assert.equal(pending, '', `Ledger must end in a complete newline: ${path}`); break; }
    }
  } finally { closeSync(fd); }
}

function filePrefixHash(path, bytes) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), hash = createHash('sha256');
  let remaining = bytes;
  try {
    while (remaining > 0) {
      const n = readSync(fd, buffer, 0, Math.min(remaining, buffer.length), null);
      assert(n > 0, `Truncated original ledger prefix: ${path}`); hash.update(buffer.subarray(0, n)); remaining -= n;
    }
    return hash.digest('hex');
  } finally { closeSync(fd); }
}
