import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { fileEvidence, inspectSources, parseArguments } from './sage-save.mjs';

// Recheck immutable actual producer bytes and the observed named boundary count.
// All 651 source commands are natural, including the prior natural507 prefix.
// No post-source outcome, transaction count or successful application is assumed.
// Aliases are audited; every observed unique transaction is checked once.
const SOURCE = 'tests/fixtures/sage-v01780/natural.json';
const SOURCE_SHA = 'a0e37a9db792f8a6906efa92dbec3b13e0c1dff00ad9df492158b7d05b569766';
const PREFIX_SHA = 'b7337b1b8265d38324749a82dfb5b77f9e07fda6d9936c1257a3c2bea3ba9031';
const PREFIX_COUNT = 651, INHERITED_COUNT = 507, SEED = 'pryer-natural-v048';
const PRESERVED = ['tests/fixtures/prophecy-master-v01540/natural.json'];
const PRESERVED_SHA = ['caf13bc9f7342beac74eae0f75641a022c8aaf0d12e179d5c7c58ea0358dcde8'];
const ROOTS = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster', 'sage'];
const NEW_IDS = ['hermit.s1.knowledge-power', 'hermit.s1.power-knowledge'];
const CASES = ['knowledge-power', 'power-knowledge', 'withdrawn-consent'];
const STAGES = [
  'NATURAL651_PREFIX_PUBLIC_KNOWLEDGE_EMPEROR_CONTINUATION',
  'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2',
  'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED',
  'ACTUAL_TERMINAL_WITH_NATURAL651_HISTORY',
];
const STRATEGY = {
  source: 'EXACT651_LIVING_NATURAL_SAGE_FINAL', sourceSeed: SEED, sourceCursor: 340,
  caseMethod: 'ABILITY', caseRoute: 'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, potionAttemptCap: 12, maxCommands: 3500, ordinaryPreparationCap: 600,
  sourceInjuryRecovery: 'DISCOVER_ACTUAL_CLINIC_PAY60_THEN_REST_FOR_TWO_ORIGINAL_HEAVY_WOUNDS', ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST',
  recovery: { health: 100, mind: 100, spirituality: 120, pollution: 0 }, energyBeforeCase: 24, energyBeforeEncounter: 15,
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
};
// Same authority selection as getKnowledgeEmperorCurrentSite: the later
// encounter.currentSite supersedes the frozen completed life.site.
const currentSite = s => s.knowledgeEmperor.encounter.currentSite ??
  (s.knowledgeEmperor.life.sourceWeek === null ? s.knowledgeEmperor.sourceScene?.originals.site ?? s.sage.encounter.currentSite ?? s.knowledgeEmperor.life.site : s.knowledgeEmperor.life.site);
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery, sequence: s.progression.sequence, acting: s.progression.acting });
function compact(s) {
  const life = s.knowledgeEmperor.life, encounter = s.knowledgeEmperor.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, site: currentSite(s),
    life: { activeCase: life.activeCase, pending: life.pending, clockSeconds: currentSite(s).clockSeconds },
    encounter: { status: encounter.status, currentSite: encounter.currentSite, terminal: encounter.terminal } };
}

async function loadRuntime() {
  const modules = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'),
    import('../../dist/domain/slice/migration.js'), import('../../dist/domain/slice/validation.js'),
    import('../../dist/domain/canonical.js'), import('../../dist/domain/knowledge-emperor/index.js'),
    import('../../dist/domain/knowledge-emperor/life.js'), import('../../dist/domain/knowledge-emperor/encounter.js'),
  ]);
  return Object.assign({}, ...modules);
}

function checkPublic(runtime, state, intent, proof, strategy) {
  assert(runtime.validateSlicePayload(intent), 'Strict public intent payload');
  const view = runtime.projectSliceState(state);
  assert.equal(view.status, 'ACTIVE', 'New S1 continuation commands never reopen terminal history');
  if (intent.type === 'KNOWLEDGE_EMPEROR') {
    const control = view.knowledgeEmperor.actions.find(row => runtime.stableStringify(row.command) === runtime.stableStringify(intent.command));
    assert(control?.enabled, control?.reason ?? `Missing offered Knowledge Emperor control: ${JSON.stringify(intent)}`);
    assert.deepEqual(proof.control, control);
    if (intent.command.type === 'SET_COMBAT_POLICY') assert.equal(intent.command.policy, strategy.encounterPolicy);
    if (intent.command.type === 'ENCOUNTER_FIGHT') assert.equal(state.knowledgeEmperor.encounter.policy, strategy.encounterPolicy);
  } else if (intent.type === 'ACTION') {
    assert(['WORK', 'REST'].includes(intent.action) || (intent.action === 'INVESTIGATE' && intent.targetId === 'CARE-ACCESS-01' && !state.careKnown));
    assert(view.canAct, view.actionBlockedReason);
    assert(!view.knowledgeEmperor.insideCase && !state.combat && state.knowledgeEmperor.preparedWeek === null);
    assert.deepEqual(proof.control, { kind: 'ACTION', action: intent.action, ...(intent.targetId ? { targetId: intent.targetId } : {}), enabled: true });
  } else if (intent.type === 'EVENT_CHOICE') {
    assert.equal(state.activeEvent?.instanceId, intent.eventInstanceId);
    const control = view.activeEvent?.choices.find(row => row.id === intent.choiceId); assert(control?.enabled);
    assert.equal(intent.choiceId, strategy.eventChoices[view.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : view.activeEvent.id]);
    assert.deepEqual(proof.control, control);
  } else {
    assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, strategy.combatStance);
    assert.equal(state.knowledgeEmperor.encounter.policy, strategy.encounterPolicy);
    assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert(view.combat?.stances.some(row => row.id === intent.stance));
    assert.deepEqual(proof.control, { kind: 'COMBAT_ROUND', stance: intent.stance, round: state.combat.round });
  }
}

function checkOriginals(runtime, state, original) {
  // Historical life.site, encounter.startSite and encounter.currentSite all stay
  // exact. New authority is the S1 life ledger, then the S1 encounter ledger.
  for (const key of ROOTS) assert.deepEqual(state[key], original[key], `Exact immutable original eight-root history: ${key}`);
  const site = currentSite(state), old = original.sage.encounter.currentSite;
  assert(old, 'The source has an actual currentSite; historical ENTRY is not authority');
  assert.deepEqual(site, runtime.getKnowledgeEmperorCurrentSite(state), 'Use the actual current site authority');
  const sourceOriginals = { site: old, workshop: original.scrollProfessor.workshop };
  if (state.knowledgeEmperor.guidanceKnown) {
    assert.deepEqual(state.knowledgeEmperor.sourceHistory, Object.fromEntries(ROOTS.map(key => [key, original[key]])));
    assert.deepEqual(state.knowledgeEmperor.sourceScene.originals, sourceOriginals, 'Acquisition freezes the actual current objects and finite original workshop');
    assert(runtime.validateKnowledgeEmperorSource(state), 'Authenticated acquisition history');
  }
  if (state.knowledgeEmperor.promotionWeek === null) {
    assert.equal(state.knowledgeEmperor.life.sourceWeek, null, 'Guidance and failed potions never initialize a second live scene');
    assert.deepEqual(state.knowledgeEmperor.life, runtime.createKnowledgeEmperorLifeState());
    assert.deepEqual(site, old);
  } else {
    assert.equal(state.knowledgeEmperor.life.sourceWeek, state.knowledgeEmperor.promotionWeek);
    assert(runtime.validateKnowledgeEmperorCurrentSite(site, sourceOriginals), 'Current body and original objects remain valid');
  }
  assert(runtime.validateKnowledgeEmperorLifeState(state), 'Replay the actual new life ledger');
  assert(runtime.validateKnowledgeEmperorEncounterState(state), 'Replay the actual independent encounter ledger');
  assert.deepEqual(state.sage.ritual, original.sage.ritual, 'Stopped disaster, damage and injured adults remain exact');
  assert.deepEqual(state.sage.encounter, original.sage.encounter, 'Original living retreated Merrin is not reopened');
  assert.deepEqual(site.materials, old.materials, 'Original returned and spent kits never replenish');
  assert.deepEqual(site.conduit, old.conduit);
  assert.deepEqual(site.source, old.source, 'Original source snapshot remains historical');
  assert.equal(site.archive.id, old.archive.id); assert.equal(site.archive.location, old.archive.location);
  assert.equal(site.record.id, old.record.id); assert.equal(site.record.location, old.record.location);
  assert.equal(site.body, 'SOLID'); assert.equal(site.form.active, false);
  for (const key of ['id', 'name', 'age', 'alive', 'willing']) assert.deepEqual(site.iris[key], old.iris[key]);
  assert(site.iris.energy <= old.iris.energy); assert(site.iris.travelMetres >= old.iris.travelMetres);
  assert(site.clockSeconds >= old.clockSeconds); assert(site.playerTravelMetres >= old.playerTravelMetres);
  assert.deepEqual(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory, 'Existing death, surrender and retreat history is never rewritten');
  assert.deepEqual(state.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of NEW_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(runtime.knowledgeEmperorLifeMasteryGains(state))) mastery[id] += gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    assert(round.knowledgeEmperorOutcome, 'No unrelated combat replaces the captured continuation');
    for (const action of [...round.knowledgeEmperorOutcome.playerActions, ...round.knowledgeEmperorOutcome.enemyActions]) for (const id of action.masteryApplied) {
      assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8);
    }
  }
  assert.deepEqual(state.progression.mastery, mastery, 'Only actual life/combat applications can grant mastery');
  const { coreStats, ...identity } = state.character, { coreStats: stats, ...oldIdentity } = original.character;
  assert.deepEqual(identity, oldIdentity, 'One original body and gender, no replacement or free rejuvenation');
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
  // Only this run's freshly allocated scratch DB is reset between checks. Never
  // open/reset a supplied DB or any fixture; sealed terminal DBs remain separate.
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
      for (const payload of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }]) {
        const blockedId = `${intentId}:sealed:${payload.type}`, blocked = app.submitIntent({ intentId: blockedId, runId: after.runId, expectedRevision: after.revision, payload });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(blockedId), null);
        assert.deepEqual(app.repository.get(after.runId).state, after); assert.deepEqual(storedRows(database), committedRows);
        assert.deepEqual(json(`${database}.sealed`), [after.runId]);
      }
    } else assert.equal(existsSync(`${database}.sealed`), false, 'A living result is not a sealed death');
    app.close(); app = undefined; app = new runtime.SqliteSliceStore(database);
    assert.deepEqual(storedRows(database), committedRows); assert.deepEqual(app.repository.get(after.runId).state, after);
    assert.equal(app.repository.receipt(staleId), null);
  } finally { app?.close(); }
}

export async function verifyKnowledgeEmperorBoundaries(options) {
  assert.equal(options.key, 'boundaries'); assert.equal(options.start, 0);
  assert(options.expectedBoundaries !== undefined, 'Supply the observed --expected-boundaries count; never guess it before the producer runs');
  const source = inspectSources(options), naturalPath = join(source.root, 'natural.json');
  const summary = json(join(source.root, 'summary.json')), integrity = json(join(source.root, 'capture-integrity.json'));
  assert.equal(source.count, source.entries.length, 'No partial verification');
  assert(Number.isSafeInteger(options.expectedBoundaries) && options.expectedBoundaries > 0);
  assert(STAGES.includes(summary.stage), 'An ACTUAL_BLOCKER is preserved evidence, not a completed continuation');
  const immutable = new Map();
  const pin = (path, sha) => { const evidence = fileEvidence(path); if (sha) assert.equal(evidence.sha256, sha, path); immutable.set(path, evidence); return evidence; };
  pin(SOURCE, SOURCE_SHA);
  assert.match(integrity.producerSha256, /^[0-9a-f]{64}$/);
  pin(fileURLToPath(new URL('./knowledge-emperor-stage.mjs', import.meta.url)), integrity.producerSha256);
  const metadataFiles = { 'natural.json': 'naturalSha256', 'summary.json': 'summarySha256', 'commands.jsonl': 'commandsSha256', 'public.jsonl': 'publicSha256',
    'boundaries.index.json': 'boundaryIndexSha256', 'boundaries.steps.json': 'boundaryStepsSha256', 'transitions.json': 'transitionsSha256', 'source-prefix.json': 'sourcePrefixSha256' };
  for (const [name, field] of Object.entries(metadataFiles)) {
    const path = join(source.root, name); assert.equal(realpathSync(path), path, 'Capture metadata cannot be an external symlink');
    assert.match(integrity[field], /^[0-9a-f]{64}$/, `Missing integrity hash: ${field}`); pin(path, integrity[field]);
  }
  const integrityPath = join(source.root, 'capture-integrity.json'); assert.equal(realpathSync(integrityPath), integrityPath); pin(integrityPath);
  assert.deepEqual(source.indexEvidence, immutable.get(source.indexPath));
  assert(summary.snapshots && typeof summary.snapshots === 'object' && !Array.isArray(summary.snapshots));
  assert(integrity.files && typeof integrity.files === 'object' && !Array.isArray(integrity.files));
  assert.deepEqual(readObjectEntry(naturalPath, 'snapshots'), summary.snapshots);
  const expectedFiles = [...new Set([...source.entries.map(row => row.filename), ...Object.values(summary.snapshots)])].sort();
  assert.deepEqual(Object.keys(integrity.files).sort(), expectedFiles, 'Every boundary and snapshot is hashed exactly once');
  for (const name of expectedFiles) {
    assert.equal(name, basename(name)); assert(name.endsWith('.json')); assert.match(integrity.files[name], /^[0-9a-f]{64}$/);
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
  assert.equal(readObjectEntry(SOURCE, 'prefixCount'), INHERITED_COUNT);
  const priorProvenance = readObjectEntry(SOURCE, 'provenance');
  assert.equal(priorProvenance.kind, 'SAME_SEED_PUBLIC_NATURAL_PREFIX');
  assert.equal(priorProvenance.source, PRESERVED[0]); assert.equal(priorProvenance.sourceSha256, PRESERVED_SHA[0]);
  assert.equal(priorProvenance.newRandomChanges, false);
  const prefixPath = join(source.root, 'source-prefix.json'), provenance = readObjectEntry(naturalPath, 'provenance');
  assert.equal(provenance.kind, 'EXACT651_PUBLIC_SAGE_THEN_PUBLIC_KNOWLEDGE_EMPEROR');
  assert.equal(provenance.inheritedDirectedPrefix, false); assert.equal(provenance.fullNaturalS9ToS1, summary.final.sequence === 1); assert.equal(provenance.newRandomChanges, false);
  assert.equal(provenance.source, SOURCE); assert.equal(provenance.sourceRoot, 'final'); assert.equal(provenance.sourceSha256, SOURCE_SHA);
  assert.deepEqual(provenance.prior, priorProvenance);
  assert.deepEqual(readObjectEntry(naturalPath, 'continuation'), { kind: 'EXACT651_LIVING_PREFIX_THEN_PUBLIC_KNOWLEDGE_EMPEROR', sourceFixture: SOURCE, sourceRoot: 'final', sourceS3Setup: 'NATURAL', newRandomChanges: false });
  const preserved = PRESERVED.map((file, index) => ({ file, sha256: pin(file, PRESERVED_SHA[index]).sha256, commands: readObjectEntry(file, 'commands').length, status: readObjectEntry(file, 'final').status }));
  assert.deepEqual(provenance.preserved, preserved); assert.deepEqual(summary.source.preserved, preserved);
  assert.deepEqual(readObjectEntry(prefixPath, 'preserved'), preserved);
  // The prior natural507 source remains independent original evidence; neither
  // that source nor any embedded death/surrender history is rewritten.
  assert.equal(new Set(preserved.map(row => realpathSync(row.file))).size, PRESERVED.length);
  assert.equal(preserved[0].commands, INHERITED_COUNT); assert.equal(preserved[0].status, 'ACTIVE');
  assert.equal(readObjectEntry(naturalPath, 'producerSha256'), integrity.producerSha256); assert.equal(summary.producerSha256, integrity.producerSha256);
  assert.equal(readObjectEntry(naturalPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(naturalPath, 'inheritedPrefixCount'), INHERITED_COUNT);
  assert.equal(readObjectEntry(naturalPath, 'prefixVerified'), true); assert.equal(readObjectEntry(naturalPath, 'seed'), SEED);
  assert.equal(readObjectEntry(naturalPath, 'stage'), summary.stage); assert.equal(readObjectEntry(naturalPath, 'pendingIntent'), null);
  if (summary.stage === STAGES[2]) assert.equal(typeof readObjectEntry(naturalPath, 'error'), 'string'); else assert.equal(readObjectEntry(naturalPath, 'error'), null);
  assert.equal(readObjectEntry(naturalPath, 'failurePhase'), 'IDLE'); assert.deepEqual(readObjectEntry(naturalPath, 'strategy'), summary.strategy);
  assert.equal(summary.source.prefixCount, PREFIX_COUNT); assert.equal(summary.source.prefixVerified, true);
  assert.equal(summary.source.sourceSha256, SOURCE_SHA); assert.equal(summary.source.prefixCompactSha256, PREFIX_SHA);
  assert.deepEqual(summary.strategy, STRATEGY, 'Exact frozen public strategy, including costs, finite limits and event choices');

  const runtime = await loadRuntime(), rawSource = readObjectEntry(SOURCE, 'final');
  const hash = value => createHash('sha256').update(runtime.stableStringify(value)).digest('hex');
  assert.equal(rawSource.schemaVersion, 175); assert.equal(rawSource.contentVersion, 'sage-v175');
  const original = runtime.migrateSliceState(rawSource);
  const currentSchemaVersion = original.schemaVersion, currentContentVersion = original.contentVersion;
  assert.equal(currentSchemaVersion, 197); assert.equal(currentContentVersion, 'knowledge-emperor-v197');
  const migrate = raw => { const state = runtime.migrateSliceState(raw); assert.equal(state.schemaVersion, currentSchemaVersion); assert.equal(state.contentVersion, currentContentVersion); runtime.assertValidSliceState(state); return state; };
  const capturedPrefix = readObjectEntry(naturalPath, 'prefixFinal'), captureSchemaVersion = capturedPrefix.schemaVersion, captureContentVersion = capturedPrefix.contentVersion;
  assert.equal(captureSchemaVersion, 197); assert.equal(captureContentVersion, 'knowledge-emperor-v197');
  assert.deepEqual(migrate(capturedPrefix), original);
  const initial = migrate(readObjectEntry(naturalPath, 'initial')); assert.deepEqual(initial, migrate(readObjectEntry(SOURCE, 'initial')));
  assert.equal(initial.random.seed, SEED); assert.equal(initial.progression.sequence, null);
  assert.equal(original.status, 'ACTIVE'); assert.equal(original.revision, 652);
  assert.equal(original.revision, initial.revision + PREFIX_COUNT); assert.equal(original.week, 152); assert.deepEqual(original.random, { seed: SEED, cursor: 340 });
  assert.equal(original.health, 40); assert.equal(original.mind, 98); assert.equal(original.spirituality, 120); assert.equal(original.cash, 770); assert.equal(original.actionsRemaining, 3);
  assert.equal(original.progression.sequence, 2); assert.equal(original.progression.acting, 100);
  assert.deepEqual(original.injuries, [
    { id: 'pryer-rebuild-natural:combat:2:PLAYER:648:0', severity: 'HEAVY', acquiredRevision: 648, treatedRevision: null },
    { id: 'pryer-rebuild-natural:combat:4:PLAYER:650:1', severity: 'HEAVY', acquiredRevision: 650, treatedRevision: null },
  ]);
  assert.equal(original.careKnown, false); assert.equal(original.injuryRisk, 1);
  const originalSite = original.sage.encounter.currentSite;
  assert(originalSite); assert.equal(originalSite.playerLocation, 'OUTSIDE'); assert.equal(originalSite.iris.location, 'OUTSIDE');
  assert.equal(originalSite.playerEnergy, 30); assert.equal(originalSite.playerTravelMetres, 66); assert.equal(originalSite.clockSeconds, 510);
  assert.equal(original.sage.life.site.playerEnergy, 36); assert.equal(original.sage.life.site.playerTravelMetres, 60); assert.equal(original.sage.life.site.clockSeconds, 202);
  assert.equal(originalSite.body, 'SOLID'); assert.equal(originalSite.form.active, false);
  assert.equal(original.sage.encounter.status, 'RETREATED'); assert(original.sage.encounter.enemyHealth > 0);
  assert.equal(original.sage.encounter.enemyStatus, 'RESISTING');
  assert.deepEqual(readObjectEntry(prefixPath, 'rawInitial'), readObjectEntry(SOURCE, 'initial')); assert.deepEqual(readObjectEntry(prefixPath, 'rawFinal'), rawSource);
  assert.deepEqual(readObjectEntry(prefixPath, 'commands'), prefix); assert.equal(readObjectEntry(prefixPath, 'rawCommandsSha256'), PREFIX_SHA);
  assert.equal(readObjectEntry(prefixPath, 'migratedWholeStateSha256'), hash(capturedPrefix)); assert.equal(summary.source.migratedWholeSourceSha256, hash(capturedPrefix));
  assert.equal(readObjectEntry(prefixPath, 'source'), SOURCE); assert.equal(readObjectEntry(prefixPath, 'sourceSha256'), SOURCE_SHA);
  assert.equal(readObjectEntry(prefixPath, 'prefixCount'), PREFIX_COUNT); assert.equal(readObjectEntry(prefixPath, 'inheritedDirectedPrefix'), false);
  assert.deepEqual(summary.originalMastery, original.progression.mastery);

  // Recreate the exact original creation and replay all651 original public
  // commands once. Keep only one replay state, rather than a prefix-state array.
  const creation = readObjectEntry(SOURCE, 'creation');
  assert.deepEqual(readObjectEntry(PRESERVED[0], 'creation'), creation);
  assert.deepEqual(readObjectEntry(PRESERVED[0], 'commands'), prefix.slice(0, INHERITED_COUNT));
  let prefixState = runtime.createSliceRun(initial.runId, creation, SEED);
  assert.deepEqual(prefixState, initial, 'Current creation equals migrated immutable original initial');
  let ledgerCount = 0, ledgerTail = null, sourceRow = null, sourceBeforeLastSha256 = null;
  const sourceContinues = [];
  for (const row of readJsonLines(join(source.root, 'commands.jsonl'))) {
    assert.equal(row.step, ++ledgerCount); assert.deepEqual(row.intent, commands[ledgerCount - 1]); assert.equal(row.sourcePrefix, ledgerCount <= PREFIX_COUNT);
    assert.equal(row.after.revision, row.before.revision + 1); assert.equal(row.before.random.seed, SEED); assert.equal(row.after.random.seed, SEED);
    assert(row.after.random.cursor >= row.before.random.cursor);
    assert(row.before.status === 'ACTIVE' || (row.before.status === 'SLICE_COMPLETE' && row.intent.type === 'CONTINUE_LIFE'), 'Only the original completed slice may explicitly continue life; actual death never resumes');
    if (ledgerTail) assert.deepEqual(row.before, ledgerTail); else assert.deepEqual(row.before, body(initial));
    if (ledgerCount <= PREFIX_COUNT) {
      assert(runtime.validateSlicePayload(row.intent), `Strict original public command ${ledgerCount}`);
      assert.deepEqual(body(prefixState), row.before);
      if (row.intent.type === 'CONTINUE_LIFE') {
        const publicBefore = runtime.projectSliceState(prefixState);
        assert.equal(publicBefore.status, 'SLICE_COMPLETE');
        assert(publicBefore.ending && publicBefore.ending.kind !== 'DEATH');
        assert.equal(publicBefore.caseArchive.length, 0);
        sourceContinues.push({ step: ledgerCount, beforeRevision: prefixState.revision, endingKind: prefixState.ending.kind });
      }
      // Sage's original natural.json has no beforeLast field. Derive this
      // checkpoint from the exact creation plus first650 commands, never invent it.
      if (ledgerCount === PREFIX_COUNT) sourceBeforeLastSha256 = hash(prefixState);
      prefixState = runtime.applySliceIntent(prefixState, row.intent); runtime.assertValidSliceState(prefixState);
      if (row.intent.type === 'CONTINUE_LIFE') assert.equal(prefixState.status, 'ACTIVE');
      assert.deepEqual(body(prefixState), row.after, `Exact source prefix body/RNG at command ${ledgerCount}`);
      if (ledgerCount === INHERITED_COUNT) assert.deepEqual(prefixState, migrate(readObjectEntry(PRESERVED[0], 'final')), 'Prior natural507 is an exact replayed prefix');
      if (ledgerCount === PREFIX_COUNT) {
        assert.deepEqual(prefixState, original, 'All651 original commands produce the exact migrated full final state');
        assert.deepEqual(runtime.projectSliceState(prefixState), runtime.projectSliceState(original));
        prefixState = null; global.gc?.();
      }
    }
    ledgerTail = row.after; if (ledgerCount === PREFIX_COUNT) sourceRow = row;
  }
  assert.equal(ledgerCount, commands.length); assert.deepEqual(sourceRow.after, body(original));
  assert.equal(transitions.length, commands.length - PREFIX_COUNT + 1, 'One source651 end transaction and every actual new command exactly once');
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
  const checks = [], actualTreatments = [], publicRows = readJsonLines(join(source.root, 'public.jsonl')), ledger = readJsonLines(join(source.root, 'commands.jsonl'));
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
      else { assert.equal(hash(before), sourceBeforeLastSha256, 'Exact replayed source650 state'); assert.deepEqual(after, original); }
      if (step > PREFIX_COUNT) {
        const proof = publicRows.next().value; assert(proof); assert.equal(proof.step, step); assert.equal(proof.revision, before.revision); assert.deepEqual(proof.command, intent);
        assert.deepEqual(proof.randomBefore, before.random); assert.deepEqual(proof.randomAfter, after.random);
        assert.deepEqual(proof.before, compact(before)); assert.deepEqual(proof.after, compact(after));
        checkPublic(runtime, before, intent, proof, summary.strategy); checkOriginals(runtime, before, original);
        if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
          assert.equal(intent.choiceId, 'PAY');
          actualTreatments.push({ paidPennies: 60, before: body(before), after: body(after) });
        }
        if (intent.type === 'KNOWLEDGE_EMPEROR' && intent.command.type === 'CONSUME') {
          assert.equal(after.random.cursor, before.random.cursor + 1); assert.equal(after.knowledgeEmperor.preparedWeek, null);
          assert.deepEqual(currentSite(after), currentSite(before), 'No potion movement, energy refill or material restoration');
          assert.deepEqual(after.injuries, before.injuries, 'A potion does not heal the original body');
          if (after.progression.sequence === 1) {
            assert.equal(after.health, before.health); assert.equal(after.spirituality, before.spirituality);
            assert.deepEqual(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) });
          }
        }
      }
      checkOriginals(runtime, after, original);
      const finalSha256 = hash(after);
      for (const [name, snapshot] of snapshotsByHash) if (snapshot.step === step) assert.equal(snapshot.sha256, finalSha256, `Snapshot is actual transaction final: ${name}`);
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${step}.sqlite`) : commonDatabase;
      checkSqlite(runtime, database, before, intent, after, `knowledge-emperor200:${step}`);
      const row = { name: transition.key, source: transition.file, step, sourceSha256: integrity.files[transition.file], finalSha256,
        status: after.status, revision: after.revision, database: relative(outputDir, database),
        checks: ['after-apply-rollback-no-receipt', 'original-rows-unchanged', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'same-intent-idempotent', 'stale-revision-no-mutation', 'reopen-after-stale',
          ...(after.status === 'DEAD' ? ['sealed-reopen-no-further-action', 'dead-continue-life-archived'] : ['living-no-terminal-sidecar'])] };
      checks.push(row); previousFinalHash = finalSha256; console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(ledger.next().done, true); assert.equal(publicRows.next().done, true);
    const final = migrate(readObjectEntry(naturalPath, 'final')), life = final.knowledgeEmperor.life, encounter = final.knowledgeEmperor.encounter;
    assert.equal(hash(final), previousFinalHash); assert.deepEqual(body(final), summary.final); assert.deepEqual(body(final), ledgerTail);
    assert.deepEqual(summary.mastery, final.progression.mastery); assert.deepEqual(summary.sourceOriginals, { site: originalSite });
    assert.deepEqual(summary.currentOriginals, { site: currentSite(final) }); assert.deepEqual(summary.life, life); assert.deepEqual(summary.lifeCases, life.cases);
    assert.deepEqual(summary.encounter, encounter); assert.deepEqual(summary.bottles, final.knowledgeEmperor.bottles);
    assert.deepEqual(summary.rounds, final.combatHistory.slice(original.combatHistory.length));
    assert.deepEqual(summary.treatments, readObjectEntry(naturalPath, 'treatments'));
    assert.deepEqual(summary.treatments, actualTreatments, 'Clinic claims must be actual captured PAY transitions');
    const attempts = CASES.flatMap(id => life.cases[id].attempts);
    assert.deepEqual(summary.lifeAbilityUse, Object.fromEntries(NEW_IDS.map((id, index) => {
      const key = index === 0 ? 'knowledgePowerTier' : 'powerKnowledgeTier';
      return [id, { attempts: attempts.filter(a => a[key] !== null).length,
        checkSuccesses: attempts.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(a[key])).length,
        actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length }];
    })));
    const lastPath = join(source.root, transitions.at(-1).file);
    assert.deepEqual(migrate(readObjectEntry(naturalPath, 'beforeLast')), migrate(readObjectEntry(lastPath, 'beforeLast')));
    assert.deepEqual(readObjectEntry(naturalPath, 'lastIntent'), commands.at(-1));
    if (summary.stage === STAGES[0]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 1); assert.equal(final.progression.acting, 100);
      for (const id of CASES) { assert.equal(life.cases[id].status, 'RESOLVED'); assert.equal(life.cases[id].attempts.length, 1); }
      assert.equal(life.reflected, true); assert.equal(life.pending, null); assert.equal(life.activeCase, null);
      assert.equal(currentSite(final).playerLocation, 'OUTSIDE');
      assert.equal(currentSite(final).iris.location, 'OUTSIDE');
      assert.equal(final.combat, null); assert.equal(encounter.currentSite.playerLocation, 'OUTSIDE');
      assert.equal(encounter.terminal.exitMetres, 4); assert.equal(encounter.terminal.exitSeconds, 4);
      assert(summary.boundaries.includes('actual-work-after-living-exit'));
    } else if (summary.stage === STAGES[1]) {
      assert.equal(final.status, 'ACTIVE'); assert.equal(final.progression.sequence, 2); assert.equal(summary.rounds.length, 0);
      const consumed = final.knowledgeEmperor.bottles.filter(row => row.status === 'CONSUMED'); assert.equal(consumed.length, summary.strategy.potionAttemptCap);
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
      fullNaturalS9ToS1: final.progression.sequence === 1, inheritedDirectedPrefix: false, inheritedDirectedCommands: 0, inheritedNaturalCommands: INHERITED_COUNT, exactSourceCommands: PREFIX_COUNT,
      commands: commands.length, allNamedCaptures: named.length, uniqueTransitions: checks.length, aliases: named.filter(row => row.aliasOf !== null).length,
      actualPlayerDeaths: checks.filter(row => row.status === 'DEAD').length,
      preservedOriginalEvidence: preserved, sourceOldLifeSnapshotEnergy: original.sage.life.site.playerEnergy, sourceActualEnergy: originalSite.playerEnergy,
      sourceOriginalMaterials: originalSite.materials, finalOriginalMaterials: currentSite(final).materials,
      sourceOriginalWorkshop: original.scrollProfessor.workshop, finalOriginalWorkshop: final.scrollProfessor.workshop,
      sourcePrefixReplayed: true, sourcePrefixReplayCommands: PREFIX_COUNT, sourceBeforeLastSha256, sourceContinues, actualTreatments,
      actualPotionConsumptions: final.knowledgeEmperor.bottles.filter(b => b.status === 'CONSUMED').map(b => ({ id: b.id, outcome: b.outcome })),
      actualNewPublicCommands: [...new Set(commands.slice(PREFIX_COUNT).map(intent => intent.type === 'KNOWLEDGE_EMPEROR' ? `${intent.type}:${intent.command.type}` : intent.type === 'ACTION' ? `${intent.type}:${intent.action}${intent.targetId ? `:${intent.targetId}` : ''}` : intent.type))],
      actualLifeLedgerEntries: life.journal.length, actualEncounterLedgerEntries: encounter.journal.length, actualNewCombatRounds: summary.rounds.length,
      lifeAbilityUse: summary.lifeAbilityUse, named, checks };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stage: result.stage, allNamedCaptures: result.allNamedCaptures, uniqueTransitions: result.uniqueTransitions,
      aliases: result.aliases, actualPlayerDeaths: result.actualPlayerDeaths, fullNaturalS9ToS1: result.fullNaturalS9ToS1, preservedOriginalEvidence: preserved.length, outputDir }));
    return result;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, uniqueVerified: checks.length, error: String(error), named, checks }, null, 2), { flag: 'wx' });
    throw error;
  } finally { ledger.return?.(); publicRows.return?.(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/knowledge-emperor-v02000');
    if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0200/sqlite');
    const options = parseArguments(args);
    if (options.help) console.log('Usage: node --expose-gc scripts/play/knowledge-emperor-save.mjs --expected-boundaries N [--source-directory DIR] [--output-directory DIR] [--tag NAME]\nN is the actual observed named capture count. Checks every unique transaction and alias while preserving the exact natural651 source, prior natural507 and all eight original roots.');
    else await verifyKnowledgeEmperorBoundaries(options);
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
