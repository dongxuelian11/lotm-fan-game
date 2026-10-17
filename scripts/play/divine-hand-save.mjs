import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { fileEvidence, inspectSources, parseArguments } from './sage-save.mjs';

// Recheck the immutable actual producer capture and its observed boundary count.
// The first70 commands are inherited DIRECTED S3 history; no natural9-to-1 claim.
// Named aliases are audited, but each actual transaction is checked only once.
const SOURCE = 'tests/fixtures/glory-v01760/natural.json';
const SOURCE_SHA = '2b29e549f4ef5b51f99267df946cbce2e9a4cdd674770b01b5568d5e13f24dc6';
const PREFIX_SHA = '666b55baf07fca58e11290cdc86d54702cb9f28d0c87957bb483427ff3bfb8fe';
const PREFIX_COUNT = 158, DIRECTED_COUNT = 70, SEED = 'warrior-natural-v042';
const PRESERVED = [
  'tests/fixtures/silver-knight-v01520/directed.json',
  'tests/fixtures/silver-knight-v01520/natural.json',
  'tests/fixtures/preparation-audit-v01630/silver-natural.json',
  'tests/fixtures/preparation-audit-v01630/silver-v2-natural.json',
];
// Read-only hashes of the four pre-existing artifacts, independent of the
// Divine Hand continuation. They remain independent original historical evidence.
const PRESERVED_SHA = [
  'acab010a42b95613657f19435436a435e7971b8ed6f9381850e852af89ac7cc2',
  '69f6b9361693c203ef26329d51dd0e78b726e4e2f26973cadd8314f18997fa69',
  '11726b7f88373fc1ed129c55d652dc16449d2b633b44d39ca8ffc050618922bc',
  'cb359bf364b8cb3b853073275d26a31e6b446982cf968bc12ec23bf5c9e6d5cb',
];
const ROOTS = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight', 'glory'];
const NEW_IDS = ['warrior.s1.beam-stabilize', 'warrior.s1.armor-convergence'];
const CASES = ['beam-support', 'armor-window', 'withdrawn-support'];
const STAGES = [
  'DIRECTED70_PREFIX_PUBLIC_DIVINE_HAND_CONTINUATION',
  'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED',
  'ACTUAL_TERMINAL_WITH_DIRECTED70_HISTORY',
];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting });
function compact(s) {
  const life = s.divineHand.life, encounter = s.divineHand.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, site: s.glory.life.site,
    life: { activeCase: life.activeCase, pending: life.pending, clockSeconds: life.clockSeconds },
    encounter: { status: encounter.status, scene: encounter.scene, terminal: encounter.terminal } };
}

async function loadRuntime() {
  const modules = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'),
    import('../../dist/domain/slice/migration.js'), import('../../dist/domain/slice/validation.js'),
    import('../../dist/domain/canonical.js'), import('../../dist/domain/divine-hand/index.js'),
    import('../../dist/domain/divine-hand/life.js'), import('../../dist/domain/divine-hand/encounter.js'),
  ]);
  return Object.assign({}, ...modules);
}

function checkPublic(runtime, state, intent, proof, strategy) {
  assert(runtime.validateSlicePayload(intent), 'Strict public intent payload');
  const view = runtime.projectSliceState(state);
  if (intent.type === 'DIVINE_HAND') {
    const control = view.divineHand.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    assert(control?.enabled, control?.reason ?? `Missing offered Divine Hand control: ${JSON.stringify(intent)}`);
    assert.deepEqual(proof.control, control);
  } else if (intent.type === 'ACTION') {
    assert(['WORK', 'REST'].includes(intent.action)); assert(view.canAct, view.actionBlockedReason);
    assert(!view.divineHand.insideCase && !state.combat && state.divineHand.preparedWeek === null);
    assert.deepEqual(proof.control, { kind: 'ACTION', action: intent.action, enabled: true });
  } else if (intent.type === 'EVENT_CHOICE') {
    assert.equal(state.activeEvent?.instanceId, intent.eventInstanceId);
    const control = view.activeEvent?.choices.find(row => row.id === intent.choiceId); assert(control?.enabled);
    assert.equal(intent.choiceId, strategy.eventChoices[view.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : view.activeEvent.id]);
    assert.deepEqual(proof.control, control);
  } else {
    assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, strategy.combatStance);
    assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert(view.combat?.stances.some(row => row.id === intent.stance));
    assert.deepEqual(proof.control, { kind: 'COMBAT_ROUND', stance: intent.stance, round: state.combat.round });
  }
}

function checkOriginals(runtime, state, original) {
  for (const key of ROOTS) {
    const current = structuredClone(state[key]);
    if (key === 'glory') current.life.site = structuredClone(original.glory.life.site);
    assert.deepEqual(current, original[key], `Exact original eight-root history: ${key}`);
  }
  const site = state.glory.life.site, old = original.glory.life.site;
  if (state.divineHand.guidanceKnown) {
    assert.deepEqual(state.divineHand.sourceHistory, Object.fromEntries(ROOTS.map(key => [key, original[key]])));
    assert(runtime.validateDivineHandSource(state), 'Authenticated acquisition history');
    assert.deepEqual({ site }, runtime.divineHandExpectedOriginals(state), 'Original site is the exact merged life/combat ledger result');
  } else assert.deepEqual(site, old);
  assert(runtime.validateDivineHandLifeState(state), 'Replay the actual new life ledger');
  assert(runtime.validateDivineHandEncounterState(state), 'Replay the actual independent encounter ledger');
  const unchanged = structuredClone(site);
  for (const key of ['clockSeconds', 'playerLocation', 'playerTravelMetres', 'playerEnergy']) unchanged[key] = old[key];
  for (const who of ['celia', 'evan']) for (const key of ['location', 'travelMetres', 'energy']) unchanged[who][key] = old[who][key];
  unchanged.armor.integrity = old.armor.integrity;
  for (const key of ['location', 'worn', 'remaining', 'consumed']) unchanged.pads[key] = old.pads[key];
  assert.deepEqual(unchanged, old, 'No original field outside journal-proven body movement, energy, armor wear and finite pads changes');
  assert.deepEqual(site.load, old.load, 'Exhausted original load0/1 never replenishes');
  assert.deepEqual(site.armorSource, old.armorSource, 'Source armor snapshot65 is historical, not the live armor60');
  assert.deepEqual(site.bridge, old.bridge); assert.deepEqual(site.plates, old.plates);
  assert(site.armor.integrity <= old.armor.integrity); assert(site.pads.remaining <= old.pads.remaining);
  assert.deepEqual(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of NEW_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(runtime.divineHandLifeMasteryGains(state))) mastery[id] += gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    assert(round.divineHandOutcome, 'No unrelated new combat replaces the captured continuation');
    for (const action of [...round.divineHandOutcome.playerActions, ...round.divineHandOutcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8);
    }
  }
  assert.deepEqual(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: stats, ...oldIdentity } = original.character;
  assert.deepEqual(identity, oldIdentity);
  for (const [key, value] of Object.entries(stats)) assert.equal(coreStats[key], Math.min(500, value + (state.progression.sequence === 1 ? 1 : 0)));
  assert.equal(state.progression.promotionWeek, original.progression.promotionWeek);
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, SEED);
}

// Stored SQL rows prove rollback of backup bytes, receipt JSON, timestamps and
// active-run selection. Merely comparing the projected state is insufficient.
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
    assert(!existsSync(`${database}.sealed`), 'Never reset any sealed verification database');
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
      assert.deepEqual(app.repository.get(after.runId).state, after, 'Inject failure after complete actual apply');
      const receipt = app.repository.receipt(intentId); assert(receipt);
      assert.equal(receipt.fingerprint, runtime.stableStringify(envelope)); assert.deepEqual(receipt.receipt.state, expectedPublic);
      assert.equal(app.repository.activeRun(), before.runId); injectedAfterApply++;
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
    assert.deepEqual(runtime.projectSliceState(app.repository.get(after.runId).state), expectedPublic); assert.equal(app.repository.activeRun(), after.runId);
    const replay = app.submitIntent(envelope);
    assert.equal(replay.ok, true, JSON.stringify(replay)); assert.deepEqual(replay.value, { ...committed.value, replayed: true });
    assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
    const staleId = `${intentId}:stale`, stale = app.submitIntent({ ...envelope, intentId: staleId });
    assert.equal(stale.ok, false); assert.equal(stale.error.code, 'REVISION_CONFLICT', JSON.stringify(stale));
    assert.equal(app.repository.receipt(staleId), null); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.deepEqual(storedRows(database), committedRows, 'Stale request must not change body, backup, receipt, timestamp or active run');
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(expectedPublic.canAct, false);
      const blockedId = `${intentId}:sealed`, blocked = app.submitIntent({ intentId: blockedId, runId: after.runId, expectedRevision: after.revision, payload: { type: 'ACTION', action: 'REST' } });
      assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(blockedId), null);
      assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
      assert.deepEqual(json(`${database}.sealed`), [after.runId]);
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living result is not a sealed death');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.equal(app.repository.receipt(staleId), null);
  } finally { app?.close(); }
}

export async function verifyDivineHandBoundaries(options) {
  assert.equal(options.key, 'boundaries'); assert.equal(options.start, 0);
  assert(options.expectedBoundaries !== undefined, 'Supply the observed --expected-boundaries count; never guess it before the producer runs');
  const source = inspectSources(options), naturalPath = join(source.root, 'natural.json');
  const summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
  assert.equal(source.count, source.entries.length, 'No partial verification');
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER is preserved evidence, not a completed continuation');
  const immutable = new Map();
  const pin = (path, sha) => { const evidence = fileEvidence(path); if (sha) assert.equal(evidence.sha256, sha, path); immutable.set(path, evidence); return evidence; };
  pin(SOURCE, SOURCE_SHA);
  assert.match(integrity.producerSha256, /^[0-9a-f]{64}$/);
  pin(fileURLToPath(new URL('./divine-hand-stage.mjs', import.meta.url)), integrity.producerSha256);
  const metadataFiles = { 'natural.json': 'naturalSha256', 'summary.json': 'summarySha256', 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256',
    'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256', 'source-prefix.json': 'sourcePrefixSha256' };
  for (const [name, field] of Object.entries(metadataFiles)) {
    const path = join(source.root, name); assert.equal(realpathSync(path), path, 'Capture metadata cannot be an external symlink');
    assert.match(integrity[field], /^[0-9a-f]{64}$/, `Missing integrity hash: ${field}`); pin(path, integrity[field]);
  }
  const integrityPath = join(source.root, 'capture-integrity.json'); assert.equal(realpathSync(integrityPath), integrityPath); pin(integrityPath);
  assert.deepEqual(source.indexEvidence, immutable.get(source.indexPath));
  assert.deepEqual(readObjectEntry(naturalPath, 'snapshots'), summary.snapshots);
  const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
  assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles, 'Every boundary and snapshot is hashed exactly once');
  for (const name of expectedFiles) {
    assert.equal(name, basename(name)); assert.match(integrity.files[name], /^[0-9a-f]{64}$/);
    const path = join(source.root, name); assert.equal(realpathSync(path), path, 'No external capture symlinks'); pin(path, integrity.files[name]);
  }
  const expectedMembers = [...Object.keys(metadataFiles), 'capture-integrity.json', ...expectedFiles].sort();
  assert.deepEqual(readdirSync(source.root).sort(), expectedMembers, 'No unaccounted or missing capture members');
  assert.deepEqual(source.entries.map(row => row.name), summary.boundaries);
  const steps = json(join(source.root, 'boundaries.steps.json')), transitions = json(join(source.root, 'transitions.json'));
  assert.deepEqual(Object.keys(steps), summary.boundaries); assert(Array.isArray(transitions));
  const commands = readObjectEntry(naturalPath, 'commands'), prefix = readObjectEntry(SOURCE, 'commands');
  assert.equal(prefix.length, PREFIX_COUNT); assert.equal(compactHash(prefix), PREFIX_SHA);
  assert.deepEqual(commands.slice(0, PREFIX_COUNT), prefix); assert.equal(commands.length, summary.commands);
  assert(commands.length > PREFIX_COUNT && commands.length <= summary.strategy.maxCommands);
  assert.equal(readObjectEntry(SOURCE, 'prefixCount'), DIRECTED_COUNT);
  const priorContinuation = readObjectEntry(SOURCE, 'continuation');
  assert.equal(priorContinuation.sourceS3Setup, 'DIRECTED'); assert.equal(priorContinuation.fullNaturalS9ToS2, false);
  const prefixPath = join(source.root, 'source-prefix.json'), provenance = readObjectEntry(naturalPath, 'provenance');
  assert.equal(provenance.kind, 'DIRECTED70_EXACT158_PUBLIC_GLORY_THEN_PUBLIC_DIVINE_HAND');
  assert.equal(provenance.inheritedDirectedPrefix, true); assert.equal(provenance.fullNaturalS9ToS1, false); assert.equal(provenance.newRandomChanges, false);
  assert.equal(provenance.source, SOURCE); assert.equal(provenance.sourceRoot, 'final'); assert.equal(provenance.sourceSha256, SOURCE_SHA);
  assert.deepEqual(provenance.prior, readObjectEntry(SOURCE, 'provenance')); assert.deepEqual(provenance.priorContinuation, priorContinuation);
  assert.deepEqual(readObjectEntry(naturalPath, 'continuation'), { kind: 'EXACT158_LIVING_PREFIX_THEN_PUBLIC_DIVINE_HAND', sourceFixture: SOURCE, sourceRoot: 'final', sourceS3Setup: 'DIRECTED', newRandomChanges: false });
  const preserved = PRESERVED.map((file, index) => ({ file, sha256: pin(file, PRESERVED_SHA[index]).sha256, commands: readObjectEntry(file, 'commands').length, status: readObjectEntry(file, 'final').status }));
  assert.deepEqual(provenance.preserved, preserved); assert.deepEqual(summary.source.preserved, preserved);
  assert.deepEqual(readObjectEntry(prefixPath, 'preserved'), preserved);
  // Four independently pinned source artifacts remain independent; none is
  // relabeled as the new continuation, a new death, or a natural S9-to-S1 run.
  assert.equal(new Set(preserved.map(row => realpathSync(row.file))).size, PRESERVED.length);
  assert.equal(readObjectEntry(naturalPath, 'producerSha256'), integrity.producerSha256); assert.equal(summary.producerSha256, integrity.producerSha256);
  assert.equal(readObjectEntry(naturalPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(naturalPath, 'inheritedPrefixCount'), DIRECTED_COUNT);
  assert.equal(readObjectEntry(naturalPath, 'prefixVerified'), true); assert.equal(readObjectEntry(naturalPath, 'seed'), SEED);
  assert.equal(readObjectEntry(naturalPath, 'stage'), summary.stage); assert.equal(readObjectEntry(naturalPath, 'pendingIntent'), null);
  if (summary.stage === STAGES[2]) assert.equal(typeof readObjectEntry(naturalPath, 'error'), 'string'); else assert.equal(readObjectEntry(naturalPath, 'error'), null);
  assert.equal(readObjectEntry(naturalPath, 'failurePhase'), 'IDLE'); assert.deepEqual(readObjectEntry(naturalPath, 'strategy'), summary.strategy);
  assert.equal(summary.source.prefixCount, PREFIX_COUNT); assert.equal(summary.source.prefixVerified, true);
  assert.equal(summary.source.sourceSha256, SOURCE_SHA); assert.equal(summary.source.prefixCompactSha256, PREFIX_SHA);
  assert.equal(summary.strategy.source, 'EXACT158_LIVING_FINAL_WITH_DIRECTED70_HISTORY'); assert.equal(summary.strategy.sourceSeed, SEED);
  assert.equal(summary.strategy.sourceCursor, 475); assert.equal(summary.strategy.caseMethod, 'ABILITY');
  assert.equal(summary.strategy.encounterPolicy, 'ALL'); assert.equal(summary.strategy.combatStance, 'CONTROL');
  assert.equal(summary.strategy.combatRoundCap, 90); assert.equal(summary.strategy.potionAttemptCap, 12); assert.equal(summary.strategy.maxCommands, 3500);

  const runtime = await loadRuntime(), rawSource = readObjectEntry(SOURCE, 'final');
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  assert.equal(rawSource.schemaVersion, 173); assert.equal(rawSource.contentVersion, 'glory-v173');
  const original = runtime.migrateSliceState(rawSource);
  const currentSchemaVersion = original.schemaVersion, currentContentVersion = original.contentVersion;
  const migrate = raw => { const state = runtime.migrateSliceState(raw); assert.equal(state.schemaVersion, currentSchemaVersion); assert.equal(state.contentVersion, currentContentVersion); runtime.assertValidSliceState(state); return state; };
  const capturedPrefix = readObjectEntry(naturalPath, 'prefixFinal'), captureSchemaVersion = capturedPrefix.schemaVersion, captureContentVersion = capturedPrefix.contentVersion;
  assert.equal(captureSchemaVersion, 195); assert.equal(captureContentVersion, 'divine-hand-v195');
  assert.deepEqual(migrate(capturedPrefix), original);
  const initial = migrate(readObjectEntry(naturalPath, 'initial')); assert.deepEqual(initial, migrate(readObjectEntry(SOURCE, 'initial')));
  assert.equal(initial.random.seed, SEED); assert.equal(original.status, 'ACTIVE'); assert.equal(original.revision, 600);
  assert.equal(original.revision, initial.revision + PREFIX_COUNT); assert.equal(original.week, 146); assert.deepEqual(original.random, { seed: SEED, cursor: 475 });
  assert.equal(original.health, 90); assert.deepEqual(original.injuries.map(row => row.severity), ['LIGHT']);
  assert.equal(original.glory.life.site.armorSource.snapshot.integrity, 65); assert.equal(original.glory.life.site.armor.integrity, 60);
  assert.equal(original.glory.life.site.load.remainingLoads, 0); assert.equal(original.glory.life.site.load.appliedLoads, 1);
  assert.equal(original.glory.life.site.pads.remaining, 1); assert.equal(original.glory.life.site.playerEnergy, 35);
  assert.deepEqual(readObjectEntry(prefixPath, 'rawInitial'), readObjectEntry(SOURCE, 'initial')); assert.deepEqual(readObjectEntry(prefixPath, 'rawFinal'), rawSource);
  assert.deepEqual(readObjectEntry(prefixPath, 'commands'), prefix); assert.equal(readObjectEntry(prefixPath, 'rawCommandsSha256'), PREFIX_SHA);
  assert.equal(readObjectEntry(prefixPath, 'migratedWholeStateSha256'), hash(capturedPrefix)); assert.equal(summary.source.migratedWholeSourceSha256, hash(capturedPrefix));
  assert.equal(readObjectEntry(prefixPath, 'source'), SOURCE); assert.equal(readObjectEntry(prefixPath, 'sourceSha256'), SOURCE_SHA);
  assert.equal(readObjectEntry(prefixPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(prefixPath, 'inheritedDirectedPrefix'), true);
  assert.deepEqual(summary.originalMastery, original.progression.mastery);

  let ledgerCount = 0, ledgerTail = null, sourceRow = null;
  for (const row of readJsonLines(join(source.root, 'commands.jsonl'))) {
    assert.equal(row.step, ++ledgerCount); assert.deepEqual(row.intent, commands[ledgerCount - 1]); assert.equal(row.sourcePrefix, ledgerCount <= PREFIX_COUNT);
    assert.equal(row.after.revision, row.before.revision + 1); assert.equal(row.before.random.seed, SEED); assert.equal(row.after.random.seed, SEED);
    assert(row.after.random.cursor >= row.before.random.cursor); assert.equal(row.before.status, 'ACTIVE', 'No commands after actual death');
    if (ledgerTail) assert.deepEqual(row.before, ledgerTail); else assert.deepEqual(row.before, body(initial));
    ledgerTail = row.after; if (ledgerCount === PREFIX_COUNT) sourceRow = row;
  }
  assert.equal(ledgerCount, commands.length); assert.deepEqual(sourceRow.after, body(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1, 'One source158 end transaction and every actual new command exactly once');
  assert.equal(summary.uniqueTransitions, transitions.length);
  const byStep = new Map(), byName = new Map(source.entries.map(row => [row.name, row])), uniqueFiles = new Set();
  for (const [index, transition] of transitions.entries()) {
    assert.deepEqual(Object.keys(transition).sort(), ['key', 'file', 'commandIndex', 'beforeRevision', 'afterRevision'].sort());
    const step = PREFIX_COUNT + index; assert.equal(transition.commandIndex, step);
    const entry = byName.get(transition.key); assert(entry); assert.equal(transition.file, entry.filename); assert.equal(steps[transition.key], step);
    assert.equal(transition.beforeRevision, initial.revision + step - 1); assert.equal(transition.afterRevision, initial.revision + step);
    assert(!byStep.has(step)); assert(!uniqueFiles.has(transition.file), 'Different transactions cannot reuse a capture file');
    byStep.set(step, transition); uniqueFiles.add(transition.file);
  }
  const named = [], firstNames = new Map();
  for (const entry of source.entries) {
    const step = steps[entry.name], transition = byStep.get(step); assert(transition, `Unknown alias transition: ${entry.name}`);
    assert.equal(entry.filename, transition.file, 'Aliases must reference the exact same transaction file');
    const aliasOf = firstNames.get(step) ?? null;
    if (aliasOf === null) { assert.equal(entry.name, transition.key); firstNames.set(step, entry.name); }
    named.push({ name: entry.name, source: entry.filename, step, aliasOf, sourceSha256: immutable.get(entry.path).sha256 });
  }
  assert.equal(firstNames.size, transitions.length);
  const snapshotsByHash = new Map();
  for (const [name, filename] of Object.entries(summary.snapshots)) {
    const snapshot = json(join(source.root, filename));
    assert.equal(snapshot.schemaVersion, captureSchemaVersion); assert.equal(snapshot.contentVersion, captureContentVersion);
    const state = migrate(snapshot), step = state.revision - initial.revision; assert(byStep.has(step)); checkOriginals(runtime, state, original);
    snapshotsByHash.set(name, { step, sha256: hash(state) });
  }
  assert.deepEqual(json(join(source.root, summary.snapshots.departure)), capturedPrefix);

  const outputPath = resolve(options.outputDirectory); let ancestor = outputPath;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const intendedOutput = resolve(realpathSync(ancestor), relative(ancestor, outputPath));
  for (const protectedRoot of [source.root, realpathSync('tests/fixtures'), realpathSync('scripts/play')]) {
    const inside = relative(protectedRoot, intendedOutput);
    assert(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside), 'All writable verification files must remain outside immutable inputs');
  }
  mkdirSync(outputPath, { recursive: true }); const outputRoot = realpathSync(outputPath); assert.equal(outputRoot, intendedOutput);
  const outputDir = mkdtempSync(join(outputRoot, `boundaries-${options.tag}-`)), commonDatabase = join(outputDir, 'verification.sqlite');
  const checks = [], publicRows = readJsonLines(join(source.root, 'public.jsonl')), ledger = readJsonLines(join(source.root, 'commands.jsonl'));
  let commandRow, current = null, previousFinalHash = null;
  for (let i = 0; i < PREFIX_COUNT; i++) commandRow = ledger.next().value;
  try {
    for (const [index, transition] of transitions.entries()) {
      current = transition.key; const step = transition.commandIndex, path = join(source.root, transition.file);
      assert.equal(readObjectEntry(path, 'commandCount'), step);
      const rawBefore = readObjectEntry(path, 'beforeLast'), rawAfter = readObjectEntry(path, 'final');
      for (const raw of [rawBefore, rawAfter]) { assert.equal(raw.schemaVersion, captureSchemaVersion); assert.equal(raw.contentVersion, captureContentVersion); }
      const before = migrate(rawBefore), after = migrate(rawAfter), intent = readObjectEntry(path, 'lastIntent');
      assert.equal(before.status, 'ACTIVE'); assert.equal(after.runId, before.runId); assert.equal(after.revision, before.revision + 1);
      assert.equal(before.revision, transition.beforeRevision); assert.equal(after.revision, transition.afterRevision);
      if (index > 0) commandRow = ledger.next().value;
      assert(commandRow); assert.equal(commandRow.step, step); assert.deepEqual(intent, commands[step - 1]);
      assert.deepEqual(body(before), commandRow.before); assert.deepEqual(body(after), commandRow.after);
      if (previousFinalHash) assert.equal(hash(before), previousFinalHash, 'Exact full-state chain, not only matching body totals');
      else { assert.deepEqual(before, migrate(readObjectEntry(SOURCE, 'beforeLast'))); assert.deepEqual(after, original); }
      if (step > PREFIX_COUNT) {
        const proof = publicRows.next().value; assert(proof); assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent);
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.randomAfter, after.random);
        assert.deepEqual(proof.before, compact(before)); assert.deepEqual(proof.after, compact(after));
        checkPublic(runtime, before, intent, proof, summary.strategy); checkOriginals(runtime, before, original);
      }
      checkOriginals(runtime, after, original);
      const finalSha256 = hash(after);
      for (const [name, snapshot] of snapshotsByHash) if (snapshot.step === step) assert.equal(snapshot.sha256, finalSha256, `Snapshot is actual transaction final: ${name}`);
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      checkSqlite(runtime, database, before, intent, after, `divine-hand198:${step}`);
      const row = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file], finalSha256,
        status: after.status, revision: after.revision, database: relative(outputDir, database),
        checks: ['after-apply-rollback-no-receipt', 'original-rows-unchanged', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'same-intent-idempotent', 'stale-revision-no-mutation', 'reopen-after-stale',
          ...(after.status === 'DEAD' ? ['sealed-reopen-no-further-action'] : ['living-no-terminal-sidecar'])] };
      checks.push(row); previousFinalHash = finalSha256; console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(publicRows.next().done, true);
    const final = migrate(readObjectEntry(naturalPath, 'final')), life = final.divineHand.life, encounter = final.divineHand.encounter;
    assert.equal(hash(final), previousFinalHash); assert.deepEqual(body(final), summary.final); assert.deepEqual(body(final), ledgerTail);
    assert.deepEqual(summary.mastery, final.progression.mastery); assert.deepEqual(summary.sourceOriginals, { site: original.glory.life.site });
    assert.deepEqual(summary.currentOriginals, { site: final.glory.life.site }); assert.deepEqual(summary.life, life); assert.deepEqual(summary.lifeCases, life.cases);
    assert.deepEqual(summary.encounter, encounter); assert.deepEqual(summary.bottles, final.divineHand.bottles);
    assert.deepEqual(summary.rounds, final.combatHistory.slice(original.combatHistory.length));
    assert.deepEqual(summary.treatments, readObjectEntry(naturalPath, 'treatments'));
    const uses = key => CASES.flatMap(id => life.cases[id].attempts.map(a => a[key])), sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
    assert.deepEqual(summary.lifeAbilityUse, Object.fromEntries([['beam', NEW_IDS[0]], ['armor', NEW_IDS[1]]].map(([key, id]) => [id,
      { attempts: sum(uses(key), 'attempts'), checkSuccesses: sum(uses(key), 'successes'), actualApplications: sum(uses(key), 'effects'), states: uses(key).map(use => use.state) }])));
    const lastPath = join(source.root, transitions.at(-1).file);
    assert.deepEqual(migrate(readObjectEntry(naturalPath, 'beforeLast')), migrate(readObjectEntry(lastPath, 'beforeLast')));
    assert.deepEqual(readObjectEntry(naturalPath, 'lastIntent'), commands.at(-1));
    if (summary.stage === STAGES[0]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 1); assert.equal(final.progression.acting, 100);
      for (const id of CASES) { assert.equal(life.cases[id].status, 'RESOLVED'); assert.equal(life.cases[id].attempts.length, 1); }
      assert.equal(life.reflected, true); assert.equal(life.pending, null); assert.equal(life.activeCase, null);
      assert.equal(final.glory.life.site.playerLocation, 'OUTSIDE');
      for (const who of ['celia', 'evan']) assert.equal(final.glory.life.site[who].location, 'OUTSIDE');
      assert.equal(final.combat, null); assert.equal(encounter.scene.playerLocation, 'OUTSIDE');
      assert.equal(encounter.terminal.exitMetres, 4); assert.equal(encounter.terminal.exitSeconds, 4);
      assert(summary.boundaries.includes('actual-work-after-living-exit'));
    } else if (summary.stage === STAGES[1]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
      const consumed = final.divineHand.bottles.filter(row => row.status === 'CONSUMED'); assert.equal(consumed.length, summary.strategy.potionAttemptCap);
      assert(consumed.every(row => ['FAILURE', 'GREAT_FAILURE'].includes(row.outcome)));
    } else if (summary.stage === STAGES[2]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(encounter.status, 'FIGHTING'); assert.equal(encounter.terminal, null); assert(final.combat);
      assert.equal(summary.rounds.length, summary.strategy.combatRoundCap); assert(summary.rounds.every(row => row.stance === 'CONTROL'));
    } else {
      assert.equal(final.status, 'DEAD'); assert.equal(final.health, 0); assert.equal(checks.at(-1).status, 'DEAD');
      assert.equal(checks.filter(row => row.status === 'DEAD').length, 1, 'A real death is the final and only terminal new transition');
      // A later ordinary death can retain an earlier living encounter result.
      if (encounter.terminal?.outcome === 'PLAYER_DEAD') { assert.equal(encounter.terminal.exitMetres, 0); assert.equal(encounter.terminal.exitSeconds, 0); }
    }
    for (const [path, evidence] of immutable) assert.deepEqual(fileEvidence(path), evidence, `Source bytes remain immutable: ${path}`);
    assert.deepEqual(readdirSync(source.root).sort(), expectedMembers);
    const result = { passed: true, stage: summary.stage, sourceDirectory: source.root, outputDir,
      producerSha256: integrity.producerSha256, captureNaturalSha256: integrity.naturalSha256, finalStateSha256: hash(final),
      currentSchemaVersion, currentContentVersion, captureSchemaVersion, captureContentVersion,
      fullNaturalS9ToS1: false, inheritedDirectedPrefix: true, inheritedDirectedCommands: DIRECTED_COUNT, exactSourceCommands: PREFIX_COUNT,
      commands: commands.length, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: named.filter(row => row.aliasOf !== null).length,
      actualPlayerDeaths: checks.filter(row => row.status === 'DEAD').length,
      preservedOriginalEvidence: preserved, sourceArmorSnapshotIntegrity: 65, sourceActualArmorIntegrity: 60,
      sourceOriginalLoad: original.glory.life.site.load, finalOriginalLoad: final.glory.life.site.load,
      actualLifeLedgerEntries: life.journal.length, actualEncounterLedgerEntries: encounter.journal.length, actualNewCombatRounds: summary.rounds.length,
      lifeAbilityUse: summary.lifeAbilityUse, named, checks };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: result.stage, allNamedCaptures: result.allNamedCaptures, uniqueTransitions: result.uniqueTransitions,
      aliases: result.aliases, actualPlayerDeaths: result.actualPlayerDeaths, fullNaturalS9ToS1: false, preservedOriginalEvidence: preserved.length, outputDir }));
    return result;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, uniqueVerified: checks.length, error: String(error), named, checks }, null, 2), { flag: 'wx' });
    throw error;
  } finally { ledger.return?.(); publicRows.return?.(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/divine-hand-v01980');
    if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0198/sqlite');
    const options = parseArguments(args);
    if (options.help) console.log('Usage: node --expose-gc scripts/play/divine-hand-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nN is the actual observed named capture count. Checks every unique transaction and alias while preserving directed70 history and four independent originals.');
    else await verifyDivineHandBoundaries(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}

// Bounded reader copied from the existing stage/save tooling. Never parse a
// whole natural/boundary document merely to retrieve one large state entry.
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
        const line = pending.slice(0, end); pending = pending.slice(end + 1); assert(line.length > 0, `Blank ledger row: ${path}`); yield JSON.parse(line);
      }
      if (!n) { assert.equal(pending, '', `Ledger must end in a complete newline: ${path}`); break; }
    }
  } finally { closeSync(fd); }
}
