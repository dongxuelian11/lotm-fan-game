import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { fileEvidence, inspectSources, parseArguments } from './sage-save.mjs';

// The exact recorded branch is authoritative. This checks every named file,
// including truthful aliases for promotion and exit; only identical transitions
// share a SQLite check. No alias is counted as an additional gameplay transition.
// All writable files are under a freshly created output directory, never a save
// supplied by the player. The independent original707 death uses its own DB.
const PREFIX_COUNT = 701;
const SEED = 'secrets-sorcerer-directed-24';
const SOURCE = 'tests/fixtures/planeswalker-v01740/natural.json';
const PEACEFUL = 'tests/fixtures/planeswalker-v01740/original-enemy-approach.json';
const WANDERER_DEATH = 'tests/fixtures/wanderer-v01500/continued.json';
const SOURCE_SHA = '06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78';
const PEACEFUL_SHA = 'ef0fe46be50b3b8ad09b8ef8551b7fa7fe76542626ccf769a50e31f9babe73f9';
const WANDERER_SHA = 'aa074a2c14ca18d3199a667bbec61b47bab05b6796de83649949299c9f03ffa9';
const PREFIX_SHA = 'cef4fc68b02edf0328bb5b5345684f997fa4919427c5e1a4f962d454fad81a8e';
const RAW_SOURCE_SHA = '8ae8728f0320f9ee21573321b165f5d883efc02b431f46ba612189eb6c10dfe8';
const ROOTS = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer', 'planeswalker'];
const NEW_IDS = ['door.s1.endpoint-location', 'door.s1.anchor-maintenance'];
const STAGES = ['DIRECTED_S4_ORIGIN_NATURAL_STAR_KEY_PUBLIC_CONTINUATION', 'DIRECTED_S4_ORIGIN_NATURAL_FINITE_POTION_FAILURES_ALIVE_S2', 'DIRECTED_S4_ORIGIN_NATURAL_FINITE_ENCOUNTER_UNRESOLVED', 'DIRECTED_S4_ORIGIN_NATURAL_ACTUAL_TERMINAL'];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting });

async function loadRuntime() {
  const [store, slice, migration, canonical, starKey, life] = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'), import('../../dist/domain/slice/migration.js'),
    import('../../dist/domain/canonical.js'), import('../../dist/domain/star-key/index.js'), import('../../dist/domain/star-key/life.js'),
  ]);
  return { ...store, ...slice, ...migration, ...canonical, ...starKey, ...life };
}
function checkPublic(runtime, state, intent, proof) {
  assert(runtime.validateSlicePayload(intent), 'Strict intent payload');
  const view = runtime.projectSliceState(state);
  if (intent.type === 'STAR_KEY') {
    const control = view.starKey.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    assert(control?.enabled, control?.reason ?? `Missing offered Star Key control: ${JSON.stringify(intent)}`);
    assert.deepEqual(proof.control, { kind: 'STAR_KEY', ...control });
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
    if (key === 'planeswalker') current.life.site = structuredClone(original.planeswalker.life.site);
    assert.deepEqual(current, original[key], `Exact source history: ${key}`);
  }
  if (state.starKey.guidanceKnown) {
    assert.deepEqual(state.starKey.sourceHistory, Object.fromEntries(ROOTS.map(key => [key, original[key]])));
    assert(runtime.validateStarKeySource(state));
    assert.deepEqual({ site: state.planeswalker.life.site }, runtime.starKeyExpectedOriginals(state));
  } else assert.deepEqual(state.planeswalker.life.site, original.planeswalker.life.site);
  const site = state.planeswalker.life.site, old = original.planeswalker.life.site;
  for (const key of ['lamp', 'screen', 'kits', 'effect']) assert.deepEqual(site[key], old[key]);
  assert.equal(site.playerAstralLegs, old.playerAstralLegs); assert.equal(site.parcel.astralLegs, old.parcel.astralLegs);
  assert.deepEqual({ ...site.parcel, location: old.parcel.location, ordinaryMetres: old.parcel.ordinaryMetres }, old.parcel);
  assert.equal(state.wanderer.life.packet.location, 'REMOTE');
  assert.deepEqual(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of NEW_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(runtime.starKeyLifeMasteryGains(state))) mastery[id] += gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    assert(round.starKeyOutcome);
    for (const action of [...round.starKeyOutcome.playerActions, ...round.starKeyOutcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8);
    }
  }
  assert.deepEqual(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: stats, ...originalIdentity } = original.character;
  assert.deepEqual(identity, originalIdentity);
  for (const [key, value] of Object.entries(stats)) assert.equal(coreStats[key], Math.min(500, value + (state.progression.sequence === 1 ? 1 : 0)));
  assert.equal(state.progression.promotionWeek, original.progression.promotionWeek);
}
function checkSqlite(runtime, database, before, intent, after, intentId) {
  if (existsSync(database)) {
    assert(!existsSync(`${database}.sealed`), 'Never reset a sealed verification database');
    const db = new DatabaseSync(database);
    try { db.exec('BEGIN IMMEDIATE; DELETE FROM slice_receipts; DELETE FROM slice_runs; DELETE FROM slice_meta; COMMIT;'); }
    finally { db.close(); }
  }
  let app, fail = false;
  const envelope = { intentId, runId: before.runId, expectedRevision: before.revision, payload: intent };
  try {
    app = new runtime.SqliteSliceStore(database, { beforeWrite: () => { if (fail) throw Error('injected boundary write failure'); } });
    app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' }); app.repository.selectRun(before.runId); });
    fail = true;
    const rejected = app.submitIntent(envelope); assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED', JSON.stringify(rejected));
    assert.deepEqual(app.repository.get(before.runId).state, before); assert.equal(app.repository.receipt(intentId), null); assert.equal(existsSync(`${database}.sealed`), false);
    app.close(); app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(app.repository.get(before.runId).state, before); assert.equal(app.repository.receipt(intentId), null); assert.equal(app.repository.activeRun(), before.runId);
    const committed = app.submitIntent(envelope); assert.equal(committed.ok, true, JSON.stringify(committed)); assert.equal(committed.value.replayed, false);
    assert.deepEqual(committed.value.state, runtime.projectSliceState(after)); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(body(app.repository.get(after.runId).state), body(after)); assert.deepEqual(app.repository.receipt(intentId).receipt, committed.value);
    app.close(); app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.equal(app.repository.activeRun(), after.runId);
    const replay = app.submitIntent(envelope); assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.deepEqual(replay.value, { ...committed.value, replayed: true }); assert.deepEqual(app.repository.get(after.runId).state, after);
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(runtime.projectSliceState(after).canAct, false);
      const blocked = app.submitIntent({ intentId: `${intentId}:sealed`, runId: after.runId, expectedRevision: after.revision, payload: { type: 'ACTION', action: 'REST' } });
      assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(`${intentId}:sealed`), null);
      assert.deepEqual(app.repository.get(after.runId).state, after);
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living result cannot be passed off as a sealed player death');
  } finally { app?.close(); }
}

function checkResume(runtime, source, summary, integrity, commands, pin) {
  const continuation = readObjectEntry(join(source.root, 'natural.json'), 'continuationSource');
  assert.deepEqual(summary.continuationSource, continuation); assert.deepEqual(integrity.continuationSource, continuation);
  if (continuation === null) return null;
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  assert.equal(continuation.kind, 'EXACT_FIRST_COMBAT_VALIDATOR_REPAIR_ONLY');
  assert.equal(continuation.originalFailureSha256, 'b666ef2deed2d19188793f2fd036c397cde8f695a47b8d1653028e608f019d4f');
  assert.equal(continuation.originalIntegritySha256, '110880a2cc5bafbb80f63b384c975089b1de6821a9b33d633081627423601562');
  assert.equal(continuation.originalProducerSha256, 'cabe6d7028f3a2ac7319cee7a054fbdaac35f2e0d2fadcfc75a1d4f8621d4263');
  assert.equal(continuation.finalProducerSha256, integrity.producerSha256);
  assert.equal(continuation.originalCommandCount, 813); assert.equal(continuation.restoredCommandCount, 812);
  assert.equal(continuation.fullStateUnchanged, true); assert.equal(continuation.commandLedgerExactThrough813, true); assert.equal(continuation.newRandomChanges, false);
  assert.deepEqual(continuation.retriedCommand, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
  const resumePath = join(source.root, 'resume-verification.json'); pin(resumePath); assert.deepEqual(json(resumePath), continuation);
  const preserved = ['natural.json', 'summary.json', 'capture-integrity.json', 'boundaries.index.json', 'boundaries.steps.json', 'commands.jsonl', 'public.jsonl'];
  assert.deepEqual(Object.keys(continuation.preservedFiles).sort(), preserved.map(name => `prior-blocker-${name}`).sort());
  for (const [name, sha] of Object.entries(continuation.preservedFiles)) { assert.equal(name, basename(name)); assert.match(sha, /^[0-9a-f]{64}$/); pin(join(source.root, name), sha); }
  const priorPath = join(source.root, 'prior-blocker-natural.json'), priorIntegrity = json(join(source.root, 'prior-blocker-capture-integrity.json'));
  assert.equal(continuation.preservedFiles['prior-blocker-natural.json'], continuation.originalFailureSha256);
  assert.equal(continuation.preservedFiles['prior-blocker-capture-integrity.json'], continuation.originalIntegritySha256);
  assert.equal(priorIntegrity.naturalSha256, continuation.originalFailureSha256); assert.equal(priorIntegrity.producerSha256, continuation.originalProducerSha256);
  assert.equal(readObjectEntry(priorPath, 'stage'), 'ACTUAL_BLOCKER'); assert.equal(readObjectEntry(priorPath, 'failurePhase'), 'AFTER_APPLY_VALIDATION');
  assert.equal(readObjectEntry(priorPath, 'producerSha256'), continuation.originalProducerSha256);
  assert.deepEqual(readObjectEntry(priorPath, 'commands'), commands.slice(0, 813));
  assert.deepEqual(readObjectEntry(priorPath, 'lastIntent'), continuation.retriedCommand); assert.equal(readObjectEntry(priorPath, 'pendingIntent'), null);
  const before = readObjectEntry(priorPath, 'beforeLast'), rejected = readObjectEntry(priorPath, 'final');
  assert.equal(before.revision, 1120); assert.equal(before.random.cursor, 101); assert.equal(rejected.revision, 1121); assert.equal(rejected.random.cursor, 114); assert.equal(rejected.health, 90);
  assert.equal(hash(before), continuation.beforeLastSha256); assert.equal(hash(rejected), continuation.originalRejectedFinalSha256);
  assert.equal(continuation.replayedFinalSha256, continuation.originalRejectedFinalSha256);
  const first = source.entries.find(row => row.name === 'combat-round-1'); assert(first);
  assert.equal(readObjectEntry(first.path, 'commandCount'), 813);
  assert.deepEqual(readObjectEntry(first.path, 'beforeLast'), before); assert.deepEqual(readObjectEntry(first.path, 'final'), rejected);
  assert.deepEqual(readObjectEntry(first.path, 'lastIntent'), continuation.retriedCommand);
  for (const [name, count, field] of [['commands.jsonl', 813, 'commandsSha256'], ['public.jsonl', 111, 'publicSha256']]) {
    const priorBytes = readFileSync(join(source.root, `prior-blocker-${name}`), 'utf8');
    assert.equal(createHash('sha256').update(priorBytes).digest('hex'), priorIntegrity[field]);
    const lines = readFileSync(join(source.root, name), 'utf8').split('\n');
    assert.equal(`${lines.slice(0, count).join('\n')}\n`, priorBytes, `Exact preserved ${name} prefix bytes`);
  }
  for (const [name, field] of [['summary.json', 'summarySha256'], ['boundaries.index.json', 'boundaryIndexSha256'], ['boundaries.steps.json', 'boundaryStepsSha256']]) {
    assert.equal(continuation.preservedFiles[`prior-blocker-${name}`], priorIntegrity[field]);
  }
  assert.equal(integrity.sourcePrefixSha256, priorIntegrity.sourcePrefixSha256);
  const priorIndex = json(join(source.root, 'prior-blocker-boundaries.index.json')), priorSteps = json(join(source.root, 'prior-blocker-boundaries.steps.json'));
  const currentIndex = Object.fromEntries(source.entries.map(row => [row.name, row.filename]));
  assert.deepEqual(Object.keys(priorIndex), Object.keys(priorSteps));
  for (const [name, filename] of Object.entries(priorIndex)) { assert.equal(currentIndex[name], filename); assert(priorSteps[name] >= 701 && priorSteps[name] <= 812); }
  for (const [filename, sha] of Object.entries(priorIntegrity.files)) assert.equal(integrity.files[filename], sha, `Original named capture remains byte-identical: ${filename}`);
  return continuation;
}

async function verify(options) {
  assert.equal(options.key, 'boundaries'); assert.equal(options.start, 0);
  assert(options.expectedBoundaries !== undefined, 'Supply the exact observed named --expected-boundaries count');
  const source = inspectSources(options), summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
  assert.equal(source.count, source.entries.length, 'No partial verification'); assert.equal(new Set(source.entries.map(row => row.filename)).size, source.entries.length);
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER is evidence, not a completed save verification');
  const immutable = new Map();
  const pin = (path, hash) => { const evidence = fileEvidence(path); if (hash) assert.equal(evidence.sha256, hash, path); immutable.set(path, evidence); };
  pin(SOURCE, SOURCE_SHA); pin(PEACEFUL, PEACEFUL_SHA); pin(WANDERER_DEATH, WANDERER_SHA);
  assert.match(integrity.producerSha256, /^[0-9a-f]{64}$/);
  pin(fileURLToPath(new URL('./star-key-stage.mjs', import.meta.url)), integrity.producerSha256);
  for (const [name, field] of [['natural.json', 'naturalSha256'], ['summary.json', 'summarySha256'], ['commands.jsonl', 'commandsSha256'], ['public.jsonl', 'publicSha256'], ['boundaries.index.json', 'boundaryIndexSha256'], ['boundaries.steps.json', 'boundaryStepsSha256'], ['source-prefix.json', 'sourcePrefixSha256']]) { assert.match(integrity[field], /^[0-9a-f]{64}$/, `Missing integrity hash: ${field}`); pin(join(source.root, name), integrity[field]); }
  pin(join(source.root, 'capture-integrity.json'));
  const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
  assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles);
  for (const name of expectedFiles) { assert.equal(name, basename(name)); assert.match(integrity.files[name], /^[0-9a-f]{64}$/); pin(join(source.root, name), integrity.files[name]); }
  assert.deepEqual(source.entries.map(row => row.name), summary.boundaries);
  const steps = json(join(source.root, 'boundaries.steps.json')); assert.deepEqual(Object.keys(steps), summary.boundaries);
  const commands = readObjectEntry(join(source.root, 'natural.json'), 'commands');
  const prefix = readObjectEntry(join(source.root, 'source-prefix.json'), 'commands');
  assert.equal(prefix.length, PREFIX_COUNT); assert.equal(compactHash(prefix), PREFIX_SHA); assert.deepEqual(commands.slice(0, PREFIX_COUNT), prefix);
  assert.deepEqual(readObjectEntry(SOURCE, 'commands').slice(0, PREFIX_COUNT), prefix);
  assert.equal(commands.length, summary.commands); assert(commands.length < 3500);
  const provenance = readObjectEntry(join(source.root, 'natural.json'), 'provenance');
  assert.equal(provenance.kind, 'DIRECTED_S4_ORIGIN_EXACT701_PUBLIC_PREFIX_THEN_PUBLIC_STAR_KEY');
  assert.equal(provenance.inheritedDirectedPrefix, true); assert.equal(provenance.newRandomChanges, false);
  assert.equal(provenance.original707CommandDeathPreserved, true); assert.equal(provenance.separate209CommandDeathPreserved, true);
  assert.equal(summary.source.prefixCount, PREFIX_COUNT); assert.equal(summary.source.prefixVerified, true);
  assert.equal(summary.source.sourceSha256, SOURCE_SHA); assert.equal(summary.source.peacefulSha256, PEACEFUL_SHA); assert.equal(summary.source.wandererDeathSha256, WANDERER_SHA); assert.equal(summary.source.prefixCompactSha256, PREFIX_SHA);
  assert.equal(readObjectEntry(join(source.root, 'natural.json'), 'stage'), summary.stage);
  assert.equal(readObjectEntry(join(source.root, 'natural.json'), 'pendingIntent'), null);
  const commandRows = readFileSync(join(source.root, 'commands.jsonl'), 'utf8').trimEnd().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const publicRows = readFileSync(join(source.root, 'public.jsonl'), 'utf8').trimEnd().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.equal(commandRows.length, commands.length); assert.equal(publicRows.length, commands.length - PREFIX_COUNT);
  for (const [index, row] of commandRows.entries()) {
    assert.equal(row.step, index + 1); assert.deepEqual(row.intent, commands[index]); assert.equal(row.sourcePrefix, index < PREFIX_COUNT);
    assert.equal(row.after.revision, row.before.revision + 1); assert.equal(row.after.random.seed, SEED); assert(row.after.random.cursor >= row.before.random.cursor);
    if (index) assert.deepEqual(row.before, commandRows[index - 1].after);
  }
  const runtime = await loadRuntime(), originalRaw = readObjectEntry(PEACEFUL, 'beforeLast'); assert.equal(compactHash(originalRaw), RAW_SOURCE_SHA);
  assert.equal(originalRaw.schemaVersion, 171); assert.equal(originalRaw.contentVersion, 'planeswalker-v171');
  const original = runtime.migrateSliceState(originalRaw), initial = runtime.migrateSliceState(readObjectEntry(join(source.root, 'natural.json'), 'initial'));
  // Current format follows explicit migration. Raw193 capture checks stay below.
  const CURRENT_SCHEMA_VERSION = initial.schemaVersion, CURRENT_CONTENT_VERSION = initial.contentVersion;
  const migrate = raw => { const value = runtime.migrateSliceState(raw); assert.equal(value.schemaVersion, CURRENT_SCHEMA_VERSION); assert.equal(value.contentVersion, CURRENT_CONTENT_VERSION); runtime.assertValidSliceState(value); return value; };
  assert.deepEqual(initial, migrate(readObjectEntry(SOURCE, 'initial')), 'Keep the actual historical directed initial, without replacement');
  assert.deepEqual(migrate(readObjectEntry(join(source.root, 'natural.json'), 'prefixFinal')), original);
  assert.deepEqual(body(initial), commandRows[0].before); assert.deepEqual(body(original), commandRows[PREFIX_COUNT - 1].after);
  assert.equal(original.revision, 1009); assert.equal(original.status, 'ACTIVE'); assert.equal(original.random.cursor, 94);
  mkdirSync(options.outputDirectory, { recursive: true });
  const outputDir = mkdtempSync(join(options.outputDirectory, `boundaries-${options.tag}-`)), commonDatabase = join(outputDir, 'verification.sqlite');
  const continuationSource = checkResume(runtime, source, summary, integrity, commands, pin);
  const checks = [], named = [], uniqueSteps = new Map(); let current = null, previousFinalHash = null;
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  try {
    for (const entry of source.entries) {
      current = entry.name; const step = readObjectEntry(entry.path, 'commandCount'); assert.equal(step, steps[entry.name]);
      const file = immutable.get(entry.path) ?? fileEvidence(entry.path), known = uniqueSteps.get(step);
      if (known) {
        assert.equal(file.sha256, known.sourceSha256, 'A repeated step must be the exact same genuine capture, never a different outcome');
        named.push({ name: entry.name, source: entry.filename, step, aliasOf: known.name, sourceSha256: file.sha256 }); continue;
      }
      assert.equal(step, PREFIX_COUNT + uniqueSteps.size, 'Every actual continuation transition appears exactly once in the unique sequence');
      const rawAfter = readObjectEntry(entry.path, 'final'); assert.equal(rawAfter.schemaVersion, 193); assert.equal(rawAfter.contentVersion, 'star-key-v193');
      const before = migrate(readObjectEntry(entry.path, 'beforeLast')), after = migrate(rawAfter), intent = readObjectEntry(entry.path, 'lastIntent');
      assert.equal(before.status, 'ACTIVE'); assert.equal(after.runId, before.runId); assert.equal(after.revision, before.revision + 1); assert.equal(after.revision, initial.revision + step);
      assert.deepEqual(intent, commands[step - 1]); assert.deepEqual(body(before), commandRows[step - 1].before); assert.deepEqual(body(after), commandRows[step - 1].after);
      if (previousFinalHash) assert.equal(hash(before), previousFinalHash);
      if (step > PREFIX_COUNT) {
        const proof = publicRows[step - PREFIX_COUNT - 1]; assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent);
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.randomAfter, after.random); checkPublic(runtime, before, intent, proof); checkOriginals(runtime, before, original);
      }
      checkOriginals(runtime, after, original);
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      checkSqlite(runtime, database, before, intent, after, `star-key196:${step}`);
      const row = { name: entry.name, source: entry.filename, step, sourceSha256: file.sha256, finalSha256: hash(after), status: after.status, revision: after.revision, database: relative(outputDir, database), checks: ['rollback-no-receipt', 'reopen-before-no-receipt', 'public-private-body-equality', 'reopen-after', 'idempotent-retry', ...(after.status === 'DEAD' ? ['sealed-reopen-no-further-action'] : ['living-no-terminal-sidecar'])] };
      uniqueSteps.set(step, row); checks.push(row); named.push({ name: entry.name, source: entry.filename, step, aliasOf: null, sourceSha256: file.sha256 });
      previousFinalHash = row.finalSha256; console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(uniqueSteps.size, commands.length - PREFIX_COUNT + 1); assert.equal(named.length, source.entries.length);
    const final = migrate(readObjectEntry(join(source.root, 'natural.json'), 'final'));
    assert.equal(hash(final), previousFinalHash); assert.deepEqual(body(final), summary.final); assert.deepEqual(body(final), commandRows.at(-1).after);
    if (summary.stage === 'DIRECTED_S4_ORIGIN_NATURAL_STAR_KEY_PUBLIC_CONTINUATION') {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 1); assert.equal(final.progression.acting, 100);
      for (const id of ['endpoint-verification', 'anchor-transfer', 'withdrawn-return']) assert.equal(final.starKey.life.cases[id].status, 'RESOLVED');
      assert.equal(final.starKey.life.reflected, true); assert.equal(final.starKey.life.pending, null); assert.equal(final.starKey.life.playerLocation, 'OUTSIDE');
      assert.equal(final.planeswalker.life.site.operatorLocation, 'OUTSIDE'); assert.equal(final.planeswalker.life.site.parcel.location, 'ENTRY_STAND');
      assert.equal(final.combat, null); assert.equal(final.starKey.encounter.terminal.exitMetres, 4); assert.equal(final.starKey.encounter.terminal.exitSeconds, 4);
      assert(summary.boundaries.includes('actual-paid-work-after-living-exit'));
    } else if (summary.stage === 'DIRECTED_S4_ORIGIN_NATURAL_FINITE_POTION_FAILURES_ALIVE_S2') {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
      const consumed = final.starKey.bottles.filter(row => row.status === 'CONSUMED'); assert.equal(consumed.length, 12);
      assert(consumed.every(row => ['FAILURE', 'GREAT_FAILURE'].includes(row.outcome)));
    } else if (summary.stage === 'DIRECTED_S4_ORIGIN_NATURAL_FINITE_ENCOUNTER_UNRESOLVED') {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.starKey.encounter.status, 'FIGHTING'); assert.equal(final.starKey.encounter.terminal, null);
      assert(final.combat); assert.equal(summary.rounds.length, 90); assert(summary.rounds.every(row => row.stance === 'CONTROL'));
    } else {
      assert.equal(final.status, 'DEAD'); assert.equal(final.health, 0); assert(!summary.boundaries.includes('actual-paid-work-after-living-exit'));
      if (final.starKey.encounter.terminal) { assert.equal(final.starKey.encounter.terminal.outcome, 'PLAYER_DEAD'); assert.equal(final.starKey.encounter.terminal.exitMetres, 0); }
    }

    // This separate historical source really ended at707 commands. Its actual
    // beforeLast and intent produce the old death, without changing this branch.
    const originalDeathCommands = readObjectEntry(SOURCE, 'commands'); assert.equal(originalDeathCommands.length, 707);
    const oldBefore = migrate(readObjectEntry(SOURCE, 'beforeLast')), oldIntent = readObjectEntry(SOURCE, 'lastIntent'), oldFinal = migrate(readObjectEntry(SOURCE, 'final'));
    assert.deepEqual(oldIntent, originalDeathCommands.at(-1)); assert.equal(oldFinal.status, 'DEAD'); assert.equal(oldFinal.health, 0); assert.equal(oldFinal.revision, 1015); assert.equal(oldFinal.random.cursor, 147);
    const oldDatabase = join(outputDir, 'original707-sealed-death.sqlite'); checkSqlite(runtime, oldDatabase, oldBefore, oldIntent, oldFinal, 'star-key196:original707');
    const wanderer = readObjectEntry(WANDERER_DEATH, 'final'); assert.equal(wanderer.status, 'DEAD'); assert.equal(wanderer.health, 0); assert.equal(readObjectEntry(WANDERER_DEATH, 'commands').length, 209);
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Source remains immutable: ${path}`);
    const result = { passed: true, stage: summary.stage, sourceDirectory: source.root, outputDir, continuationSource, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: named.filter(row => row.aliasOf !== null).length, naturalPlayerDeaths: checks.filter(row => row.status === 'DEAD').length, original707DeathSeparatelySealed: true, named, checks };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: result.stage, allNamedCaptures: result.allNamedCaptures, uniqueTransitions: result.uniqueTransitions, aliases: result.aliases, naturalPlayerDeaths: result.naturalPlayerDeaths, original707DeathSeparatelySealed: true, outputDir }));
    return result;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, namedVerified: named.length, uniqueVerified: checks.length, error: String(error), named, checks }, null, 2), { flag: 'wx' }); throw error;
  }
}

try {
  const args = process.argv.slice(2);
  if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/star-key-v01960');
  if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0196/sqlite');
  const options = parseArguments(args);
  if (options.help) console.log('Usage: node --expose-gc scripts/play/star-key-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nChecks every named immutable capture and every unique real SQLite transition, plus the separate original707 sealed death.');
  else await verify(options);
} catch (error) { console.error(error); process.exitCode = 1; }

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
